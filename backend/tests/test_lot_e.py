"""21/10/2026 — lot E : la charte de la communauté, la modération directe des
écrits et des commentaires, les compteurs du tableau d'administration.

Les règles qui comptent :
* publier ou commenter sans la charte EN VIGUEUR est refusé par le serveur ;
* la modération retire sans détruire, et ne rétablit QUE ce qu'elle a retiré —
  jamais un commentaire que son auteur a lui-même retiré ;
* agir exige le rôle « moderation » ; une session de lecteur n'ouvre rien."""
import time

import admin
import charte
import db
import security
from tests.aide import MDP, Personne, TestBase
from tests.test_admin import MDP_ADMIN, creer_admin
from tests.test_argent import sql


def ecrire(p, t="Un mot.", **k):
    r = p.post("/api/ecrits", {"nature": "pensee", "texte": t, **k})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["ecrit"]["id"]


class Charte(TestBase):
    def test_publier_ou_commenter_exige_la_charte(self):
        a = Personne(self.app, charte=False)
        self.assertFalse(a.get("/api/moi").get_json()["moi"]["charte"])
        # un brouillon reste libre : il n'expose rien
        eid = ecrire(a, "Brouillon")
        r = a.post("/api/ecrits", {"nature": "pensee", "texte": "Tout de suite", "publier": True})
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "charte"))
        self.assertEqual(a.post(f"/api/ecrits/{eid}/publier").status_code, 403)
        self.assertEqual(a.post(f"/api/ecrits/{eid}/publier", {"date": "2099-01-01T10:00"}).status_code, 403)   # programmer aussi
        b = Personne(self.app)
        autre = ecrire(b, "Publié", publier=True)
        self.assertEqual(a.post(f"/api/ecrits/{autre}/commentaires", {"texte": "Merci"}).status_code, 403)
        self.assertEqual(a.post(f"/api/ecrits/{autre}/jaime").status_code, 200)          # aimer reste libre
        # une version périmée ne vaut pas acceptation
        self.assertEqual(a.post("/api/moi/charte", {"version": "2020-01-01"}).status_code, 409)
        self.assertEqual(a.post(f"/api/ecrits/{autre}/commentaires", {"texte": "Merci"}).status_code, 403)
        self.assertEqual(a.post("/api/moi/charte", {"version": charte.VERSION}).status_code, 200)
        self.assertTrue(a.get("/api/moi").get_json()["moi"]["charte"])
        self.assertEqual(a.post(f"/api/ecrits/{eid}/publier").status_code, 200)
        self.assertEqual(a.post(f"/api/ecrits/{autre}/commentaires", {"texte": "Merci"}).status_code, 201)

    def test_une_nouvelle_charte_se_fait_accepter_de_nouveau(self):
        a = Personne(self.app)
        ancienne = charte.VERSION
        charte.VERSION = "2099-01-01"
        try:
            self.assertFalse(a.get("/api/moi").get_json()["moi"]["charte"])
            self.assertEqual(a.post("/api/ecrits", {"nature": "pensee", "texte": "x", "publier": True}).status_code, 403)
        finally:
            charte.VERSION = ancienne
        self.assertTrue(a.get("/api/moi").get_json()["moi"]["charte"])


class ModerationDirecte(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.secret = creer_admin("moderation-e@sozo.test", "moderation")
        cls.secret_lecture = creer_admin("lecture-e@sozo.test", "lecture")

    def admin(self, email="moderation-e@sozo.test", secret=None):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        c = self.app.test_client()
        r = c.post("/api/admin/sessions", json={"email": email, "mot_de_passe": MDP_ADMIN,
                                                "code": admin._code(secret or self.secret, int(time.time() // 30))})
        self.assertEqual(r.status_code, 200, r.get_json())
        return c, {security.EN_TETE_CSRF: c.get_cookie(admin.COOKIE_CSRF).value}

    def test_retirer_puis_retablir_un_ecrit(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, "Texte à examiner", publier=True)
        b.post(f"/api/ecrits/{eid}/signaler", {"motif": "Hors charte"})
        c, h = self.admin()
        liste = c.get("/api/admin/communaute?quoi=ecrits").get_json()["lignes"]
        self.assertIn(eid, [x["id"] for x in liste])
        self.assertEqual(c.post(f"/api/admin/ecrits/{eid}/retirer", json={"motif": ""}, headers=h).status_code, 400)   # motif exigé
        self.assertEqual(c.post(f"/api/admin/ecrits/{eid}/retirer", json={"motif": "Contraire à la charte"}, headers=h).status_code, 200)
        self.assertEqual(c.post(f"/api/admin/ecrits/{eid}/retirer", json={"motif": "Encore"}, headers=h).status_code, 409)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 404)                                   # plus visible
        self.assertEqual(c.get("/api/admin/signalements-ecrits").get_json()["signalements"][0]["etat"], "traite")
        self.assertIn(eid, [x["id"] for x in c.get("/api/admin/communaute?quoi=ecrits&retires=1").get_json()["lignes"]])
        cx = db.connecter(globale=True)
        try:
            self.assertEqual(cx.un("SELECT texte FROM ecrits WHERE id = ?", (eid,))["texte"], "Texte à examiner")   # rien de détruit
            self.assertEqual(len(cx.tous("SELECT id FROM notifications WHERE user_id = ? AND type = 'moderation'", (a.id,))), 1)
        finally:
            cx.fermer()
        self.assertEqual(c.post(f"/api/admin/ecrits/{eid}/retablir", json={}, headers=h).status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 200)

    def test_un_commentaire_retire_par_son_auteur_ne_se_retablit_pas(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, publier=True)
        mod = b.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Insulte"}).get_json()["commentaire"]["id"]
        lui = b.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Je regrette"}).get_json()["commentaire"]["id"]
        self.assertEqual(b.delete(f"/api/commentaires/{lui}").status_code, 200)                      # retiré par son auteur
        c, h = self.admin()
        visibles = [x["id"] for x in c.get("/api/admin/communaute?quoi=commentaires").get_json()["lignes"]]
        self.assertIn(mod, visibles)
        self.assertNotIn(lui, visibles)
        self.assertEqual(c.post(f"/api/admin/commentaires/{mod}/retirer", json={"motif": "Insulte"}, headers=h).status_code, 200)
        fil = lambda: [x["id"] for x in a.get(f"/api/ecrits/{eid}").get_json()["commentaires"]]
        self.assertNotIn(mod, fil())
        self.assertEqual(c.post(f"/api/admin/commentaires/{lui}/retablir", json={}, headers=h).status_code, 409)   # pas à sa place
        self.assertEqual(c.post(f"/api/admin/commentaires/{mod}/retablir", json={}, headers=h).status_code, 200)
        self.assertEqual(c.post(f"/api/admin/commentaires/{mod}/retablir", json={}, headers=h).status_code, 409)

    def test_agir_exige_le_role_moderation(self):
        a = Personne(self.app)
        eid = ecrire(a, publier=True)
        c, h = self.admin("lecture-e@sozo.test", self.secret_lecture)
        self.assertEqual(c.get("/api/admin/communaute?quoi=ecrits").status_code, 200)                  # voir : oui
        self.assertEqual(c.post(f"/api/admin/ecrits/{eid}/retirer", json={"motif": "Essai"}, headers=h).status_code, 403)
        self.assertEqual(a.post(f"/api/admin/ecrits/{eid}/retirer", {"motif": "Essai"}).status_code, 401)   # session de lecteur

    def test_compteurs_du_tableau(self):
        a, b = Personne(self.app), Personne(self.app)
        c, h = self.admin()
        t0 = c.get("/api/admin/tableau").get_json()
        eid = ecrire(a, publier=True)
        ecrire(a, "Brouillon")
        b.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Beau"})
        b.post(f"/api/profils/{a.id}/abonnement")
        t1 = c.get("/api/admin/tableau").get_json()
        self.assertEqual((t1["ecrits"] - t0["ecrits"], t1["commentaires"] - t0["commentaires"], t1["abonnements"] - t0["abonnements"]), (1, 1, 1))


def executer(q, p=()):
    cx = db.connecter(globale=True)
    try:
        cx.execute(q, p)
        cx.valider()
    finally:
        cx.fermer()


class EffacerSousRLS(TestBase):
    """21/10/2026 — trouvé par la suite PostgreSQL : effacer pour de bon touche
    des lignes d'AUTRES comptes (droits, cadeaux, signalements, suivis, j'aime).
    Sous PostgreSQL, la connexion de l'auteur ne les voit pas : les gardes ne
    voyaient rien, et le nettoyage les laissait en place. Ces tests n'ont de
    sens complet que sous PostgreSQL (pg_tests.py) ; sous SQLite, ils tiennent
    les mêmes règles sans RLS."""

    def test_un_livre_offert_ne_va_pas_a_la_corbeille(self):
        a, lecteur = Personne(self.app, "auteur"), Personne(self.app)
        slug = a.livre(pages=1, publier=(), payantes=())
        bid = sql("SELECT id FROM books WHERE slug = ?", (slug,))[0]["id"]
        creer_admin("cadeau-e@sozo.test", "finance")
        adm = sql("SELECT id FROM admin_users WHERE email = 'cadeau-e@sozo.test'")[0]["id"]
        executer("INSERT INTO dons (user_id, objet, book_id, debut, motif, admin_id, created_at) VALUES (?, 'livre', ?, '2026-01-01T00:00:00Z', 'essai', ?, '2026-01-01T00:00:00Z')",
                 (lecteur.id, bid, adm))
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}").status_code, 409)       # un lecteur y a droit

    def test_un_livre_signale_ne_s_efface_pas_puis_part_avec_les_lignes_des_autres(self):
        a, b = Personne(self.app, "auteur"), Personne(self.app)
        slug = a.livre(pages=1, publier=(), payantes=())
        bid = sql("SELECT id FROM books WHERE slug = ?", (slug,))[0]["id"]
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}").status_code, 200)       # à la corbeille
        executer("INSERT INTO signalements (user_id, book_id, motif, created_at) VALUES (?, ?, 'À vérifier', '2026-01-01T00:00:00Z')", (b.id, bid))
        executer("INSERT INTO follows (user_id, book_id, created_at) VALUES (?, ?, '2026-01-01T00:00:00Z')", (b.id, bid))
        r = a.delete(f"/api/studio/corbeille/{slug}")
        self.assertEqual((r.status_code, r.get_json().get("code")), (409, "signalement_ouvert"))    # pas de preuve qui disparaît
        executer("UPDATE signalements SET etat = 'traite' WHERE book_id = ?", (bid,))
        self.assertEqual(a.delete(f"/api/studio/corbeille/{slug}").status_code, 200)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM books WHERE id = ?", (bid,))[0]["n"], 0)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM follows WHERE book_id = ?", (bid,))[0]["n"], 0)

    def test_effacer_un_ecrit_signale_puis_ses_j_aime(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, "À effacer", publier=True)
        b.post(f"/api/ecrits/{eid}/jaime")
        b.post(f"/api/ecrits/{eid}/signaler", {"motif": "À vérifier, svp"})
        a.delete(f"/api/ecrits/{eid}")
        self.assertEqual(a.delete(f"/api/ecrits/{eid}/definitif").status_code, 409)
        executer("UPDATE signalements_ecrits SET etat = 'rejete' WHERE ecrit_id = ?", (eid,))
        self.assertEqual(a.delete(f"/api/ecrits/{eid}/definitif").status_code, 200)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM ecrits_gestes WHERE ecrit_id = ?", (eid,))[0]["n"], 0)


class CompterChezLesAutres(TestBase):
    """21/10/2026 — même famille : les abonnements appartiennent à ceux qui
    suivent. Sous PostgreSQL, un visiteur ne voyait que le sien : le profil
    affichait 0 ou 1 abonné, et un compte supprimé gardait ses abonnés."""

    def test_le_nombre_d_abonnes_est_le_vrai_pour_tout_visiteur(self):
        a, b, c, d = Personne(self.app), Personne(self.app), Personne(self.app), Personne(self.app)
        ecrire(a, "Publié", publier=True)
        b.post(f"/api/profils/{a.id}/abonnement")
        c.post(f"/api/profils/{a.id}/abonnement")
        self.assertEqual(d.get(f"/api/profils/{a.id}").get_json()["profil"]["abonnes"], 2)
        self.assertEqual(c.delete(f"/api/profils/{a.id}/abonnement").get_json()["abonnes"], 1)

    def test_un_compte_supprime_n_a_plus_d_abonnes(self):
        a, b = Personne(self.app), Personne(self.app)
        ecrire(a, "Publié", publier=True)
        b.post(f"/api/profils/{a.id}/abonnement")
        self.assertEqual(a.c.delete("/api/compte", json={"mot_de_passe": MDP}, headers=a._h()).status_code, 200)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM abonnements WHERE auteur_id = ?", (a.id,))[0]["n"], 0)
