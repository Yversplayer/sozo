"""22/10/2026 — lot C, la communauté : suivre un auteur, profils, recherche,
notifications sociales. Chaque test protège une règle : on ne s'abonne qu'en
son nom, un profil ne montre que ce qui est public, une notification part une
fois et à la bonne personne."""
import os
import sqlite3
import tempfile
import unittest

import config
import db
from tests.aide import Personne, TestBase
from tests.test_argent import sql


def notifs(p, type_=None):
    cx = db.connecter(globale=True)
    try:
        q = "SELECT type, titre, cle FROM notifications WHERE user_id = ?" + (" AND type = ?" if type_ else "")
        return cx.tous(q, (p.id, type_) if type_ else (p.id,))
    finally:
        cx.fermer()


def ecrire(p, t="Un mot.", **k):
    r = p.post("/api/ecrits", {"nature": "pensee", "texte": t, **k})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["ecrit"]["id"]


class Abonnements(TestBase):
    def test_suivre_un_auteur(self):
        a, b = Personne(self.app, nom="Ruth Auteure"), Personne(self.app)
        self.assertEqual(b.post(f"/api/profils/{a.id}/abonnement").status_code, 200)
        self.assertEqual(b.post(f"/api/profils/{a.id}/abonnement").get_json()["abonnes"], 1)   # une seule fois
        p = b.get(f"/api/profils/{a.id}").get_json()["profil"]
        self.assertEqual((p["abonnes"], p["moi"]["abonne"]), (1, True))
        self.assertNotIn(a.email, b.get(f"/api/profils/{a.id}").get_data(as_text=True))       # jamais l'adresse
        self.assertEqual([x["type"] for x in notifs(a, "communaute")], ["communaute"])
        self.assertEqual(b.post(f"/api/profils/{b.id}/abonnement").status_code, 400)          # pas soi-même
        self.assertEqual(b.post("/api/profils/999999/abonnement").status_code, 404)
        self.assertEqual(b.delete(f"/api/profils/{a.id}/abonnement").get_json()["abonnes"], 0)

    def test_le_fil_des_abonnements_et_l_annonce(self):
        a, autre, b, c = Personne(self.app), Personne(self.app), Personne(self.app), Personne(self.app)
        b.post(f"/api/profils/{a.id}/abonnement")
        mien = ecrire(a, "Pour mes abonnés", publier=True)
        ecrire(autre, "D'un autre", publier=True)
        self.assertEqual([e["id"] for e in b.get("/api/ecrits?abonnements=1").get_json()["ecrits"]], [mien])
        self.assertEqual(len(notifs(b, "abonnements")), 1)
        self.assertEqual(notifs(c, "abonnements"), [])                                        # pas abonné : rien
        # dépublier puis republier n'annonce pas deux fois
        a.post(f"/api/ecrits/{mien}/depublier")
        a.post(f"/api/ecrits/{mien}/publier")
        self.assertEqual(len(notifs(b, "abonnements")), 1)

    def test_un_ecrit_programme_s_annonce_a_son_heure(self):
        import taches
        a, b = Personne(self.app), Personne(self.app)
        b.post(f"/api/profils/{a.id}/abonnement")
        eid = ecrire(a, "Plus tard")
        a.post(f"/api/ecrits/{eid}/publier", {"date": "2099-01-01T10:00"})
        taches.annoncer_ecrits()
        self.assertEqual(notifs(b, "abonnements"), [])                                        # pas encore paru
        cx = db.connecter(globale=True)
        try:
            cx.execute("UPDATE ecrits SET publie_le = '2020-01-01T00:00:00Z' WHERE id = ?", (eid,))
            cx.valider()
        finally:
            cx.fermer()
        taches.annoncer_ecrits()
        taches.annoncer_ecrits()
        self.assertEqual(len(notifs(b, "abonnements")), 1)


class NotificationsSociales(TestBase):
    def test_commentaire_reponse_et_j_aime_regroupes(self):
        a, b, c = Personne(self.app), Personne(self.app), Personne(self.app)
        eid = ecrire(a, publier=True)
        cb = b.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Merci"}).get_json()["commentaire"]["id"]
        c.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Moi aussi", "parent": cb})
        a.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Je réponds"})                  # son propre écrit : rien pour soi
        self.assertEqual(len([n for n in notifs(a, "communaute") if n["cle"].startswith("commentaire:")]), 2)
        self.assertEqual(len([n for n in notifs(b, "communaute") if n["cle"].startswith("reponse:")]), 1)
        b.post(f"/api/ecrits/{eid}/jaime")
        c.post(f"/api/ecrits/{eid}/jaime")
        self.assertEqual(len([n for n in notifs(a, "communaute") if n["cle"].startswith("jaime:")]), 1)   # regroupés
        a.post(f"/api/ecrits/{eid}/jaime")
        self.assertEqual(len([n for n in notifs(a, "communaute") if n["cle"].startswith("jaime:")]), 1)


class Recherche(TestBase):
    def test_chercher_des_ecrits_et_des_auteurs(self):
        a, b = Personne(self.app, nom="Ruth Kabasele"), Personne(self.app, nom="Ruth Silencieuse")
        eid = ecrire(a, "La lumière du matin", publier=True)
        ecrire(b, "Brouillon caché lumière")                                                    # pas publié
        self.assertEqual([e["id"] for e in a.get("/api/ecrits?q=LUMIÈRE").get_json()["ecrits"]], [eid])
        self.assertEqual(a.get("/api/ecrits?q=%25%25").get_json()["ecrits"], [])                 # « %% » n'attrape pas tout
        noms = [x["nom"] for x in b.get("/api/profils?q=ruth").get_json()["auteurs"]]
        self.assertEqual(noms, ["Ruth Kabasele"])                                               # rien de public : pas listée
        self.assertEqual(b.get("/api/profils?q=r").status_code, 400)


class MigrationDesNotifications(unittest.TestCase):
    """Le CHECK des types de notification s'élargit sans perdre une ligne."""

    def test_sqlite_reconstruit_sans_perte(self):
        d = tempfile.mkdtemp()
        brute = sqlite3.connect(os.path.join(d, "vieille.db"))
        brute.row_factory = sqlite3.Row
        cx = db.Connexion(brute, "sqlite")
        cx.execute("""CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
                      type TEXT NOT NULL CHECK (type IN ('parution', 'test')), titre TEXT NOT NULL, corps TEXT NOT NULL, lien TEXT,
                      cle TEXT NOT NULL, lu_le TEXT, created_at TEXT NOT NULL, UNIQUE (user_id, cle))""")
        for i in range(3):
            cx.execute("INSERT INTO notifications (user_id, type, titre, corps, cle, created_at) VALUES (1, 'parution', 't', 'c', ?, 'a')", (f"k{i}",))
        with self.assertRaises(Exception):
            cx.execute("INSERT INTO notifications (user_id, type, titre, corps, cle, created_at) VALUES (1, 'communaute', 't', 'c', 'x', 'a')")
        db._types_de_notification(cx)
        db._types_de_notification(cx)                       # idempotent
        self.assertEqual(cx.un("SELECT COUNT(*) AS n FROM notifications")["n"], 3)
        cx.execute("INSERT INTO notifications (user_id, type, titre, corps, cle, created_at) VALUES (1, 'communaute', 't', 'c', 'x', 'a')")
        with self.assertRaises(Exception):                  # l'unicité (user_id, cle) a survécu
            cx.execute("INSERT INTO notifications (user_id, type, titre, corps, cle, created_at) VALUES (1, 'test', 't', 'c', 'k0', 'a')")
        brute.close()


@unittest.skipUnless(config.moteur() == "postgres", "PostgreSQL seulement")
class MigrationPostgres(TestBase):
    def test_la_contrainte_est_remplacee(self):
        cx = db.connecter(globale=True)
        try:
            for r in cx.tous("SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid = 'notifications'::regclass AND contype = 'c'"):
                if "type" in r["d"]:
                    cx.execute(f'ALTER TABLE notifications DROP CONSTRAINT "{r["conname"]}"')
            cx.execute("ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('parution', 'test'))")
            cx.valider()
            db._types_de_notification(cx)
            cx.valider()
            u = cx.inserer("INSERT INTO users (email, nom, role, password_hash, created_at) VALUES ('m@exemple.cd', 'M', 'lecteur', 'x', 'a')")
            cx.execute("INSERT INTO notifications (user_id, type, titre, corps, cle, created_at) VALUES (?, 'communaute', 't', 'c', 'x', 'a')", (u,))
            cx.valider()
        finally:
            cx.fermer()
