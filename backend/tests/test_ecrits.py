"""21/10/2026 — écrits (poème, récit, conte, pensée, prière), corbeille des
pages, genres resserrés, mise en forme légère. Chaque test protège une règle
que l'interface ne peut pas tenir seule : le navigateur est celui de n'importe qui."""
import os
import time
import unittest

import admin
import config
import db
import security
import texte
from tests.aide import Personne, TestBase
from tests.test_admin import MDP_ADMIN, creer_admin
from tests.test_argent import sql


def ecrire(p, texte_="Seigneur, garde-moi dans le calme.", nature="pensee", publier=True, **k):
    r = p.post("/api/ecrits", {"nature": nature, "texte": texte_, "publier": publier, **k})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["ecrit"]["id"]


class Ecrits(TestBase):
    def test_un_brouillon_n_existe_que_pour_son_auteur(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, "Texte secret du brouillon.", publier=False)
        self.assertEqual(a.get(f"/api/ecrits/{eid}").status_code, 200)
        for essai in (b.get(f"/api/ecrits/{eid}"), b.post(f"/api/ecrits/{eid}/jaime"), b.post(f"/api/ecrits/{eid}/garde"),
                      b.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Bravo"}),
                      b.patch(f"/api/ecrits/{eid}", {"texte": "Volé"}), b.delete(f"/api/ecrits/{eid}")):
            self.assertEqual(essai.status_code, 404)
        self.assertNotIn(eid, [e["id"] for e in b.get("/api/ecrits").get_json()["ecrits"]])
        # publié : tout compte connecté le lit, mais seul l'auteur le modifie
        self.assertEqual(a.post(f"/api/ecrits/{eid}/publier").status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 200)
        self.assertIn(eid, [e["id"] for e in b.get("/api/ecrits").get_json()["ecrits"]])
        self.assertEqual(b.patch(f"/api/ecrits/{eid}", {"texte": "Volé"}).status_code, 404)
        self.assertEqual(sql("SELECT texte FROM ecrits WHERE id = ?", (eid,))[0]["texte"], "Texte secret du brouillon.")
        # sans compte : rien
        self.assertEqual(self.client.get(f"/api/ecrits/{eid}").status_code, 401)

    def test_l_auteur_vient_de_la_session(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, user_id=b.id, statut="publie", auteur=f"u{b.id}")
        self.assertEqual(sql("SELECT user_id FROM ecrits WHERE id = ?", (eid,))[0]["user_id"], a.id)

    def test_un_j_aime_par_personne(self):
        a, b, c = Personne(self.app), Personne(self.app), Personne(self.app)
        eid = ecrire(a)
        for _ in range(3):
            self.assertEqual(b.post(f"/api/ecrits/{eid}/jaime").status_code, 200)
        r = c.post(f"/api/ecrits/{eid}/jaime").get_json()
        self.assertEqual(r["total"], 2)
        self.assertEqual(b.delete(f"/api/ecrits/{eid}/jaime").get_json()["total"], 1)
        e = next(x for x in b.get("/api/ecrits").get_json()["ecrits"] if x["id"] == eid)
        self.assertEqual((e["jaime"], e["moi"]["jaime"]), (1, False))
        # garder : l'écrit rejoint la bibliothèque de b, pas celle de c
        b.post(f"/api/ecrits/{eid}/garde")
        self.assertEqual([x["id"] for x in b.get("/api/ecrits/gardes").get_json()["ecrits"]], [eid])
        self.assertEqual(c.get("/api/ecrits/gardes").get_json()["ecrits"], [])

    def test_commentaires_retirables_par_qui_de_droit(self):
        a, b, c = Personne(self.app), Personne(self.app), Personne(self.app)
        eid = ecrire(a)
        cb = b.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Amen, merci."}).get_json()["commentaire"]["id"]
        cc = c.post(f"/api/ecrits/{eid}/commentaires", {"texte": "<script>alert(1)</script>"}).get_json()["commentaire"]["id"]
        # un tiers ne retire pas le commentaire d'un autre
        self.assertEqual(c.delete(f"/api/commentaires/{cb}").status_code, 404)
        # l'auteur de l'écrit le peut ; le commentateur aussi pour le sien
        self.assertEqual(a.delete(f"/api/commentaires/{cb}").status_code, 200)
        self.assertEqual(c.delete(f"/api/commentaires/{cc}").status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").get_json()["commentaires"], [])
        # rien n'est effacé : retiré, daté, avec qui l'a retiré
        lignes = sql("SELECT retire_par FROM ecrits_commentaires WHERE ecrit_id = ? ORDER BY id", (eid,))
        self.assertEqual([x["retire_par"] for x in lignes], ["auteur", "commentateur"])

    def test_corbeille_et_retour(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, nature="poeme", titre="Psaume du matin")
        self.assertEqual(a.delete(f"/api/ecrits/{eid}").status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 404)
        self.assertNotIn(eid, [e["id"] for e in b.get("/api/ecrits").get_json()["ecrits"]])
        self.assertEqual(b.post(f"/api/ecrits/{eid}/restaurer").status_code, 404)
        self.assertEqual(a.post(f"/api/ecrits/{eid}/restaurer").status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 200)

    def test_taille_et_apparence_sur_liste_fermee(self):
        a = Personne(self.app)
        self.assertEqual(a.post("/api/ecrits", {"nature": "pensee", "texte": "x" * 601}).status_code, 400)
        self.assertEqual(a.post("/api/ecrits", {"nature": "poeme", "texte": "x" * 601}).status_code, 201)
        self.assertEqual(a.post("/api/ecrits", {"nature": "roman", "texte": "Un roman"}).status_code, 400)
        for mauvaise in ({"fond": "url(https://exemple.com/x.png)"}, {"police": "Comic Sans"}, {"inconnu": 1}, "rouge"):
            self.assertEqual(a.post("/api/ecrits", {"nature": "poeme", "texte": "Un poème", "apparence": mauvaise}).status_code, 400, mauvaise)
        ok = a.post("/api/ecrits", {"nature": "poeme", "texte": "Un poème", "apparence": {"fond": "velours", "alignement": "centre"}})
        self.assertEqual(ok.get_json()["ecrit"]["apparence"], {"fond": "velours", "alignement": "centre"})

    def test_compte_supprime_ses_ecrits_quittent_l_ecran(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, "Texte de a")
        cb = a.post(f"/api/ecrits/{ecrire(b)}/commentaires", {"texte": "Mot de a"}).status_code
        self.assertEqual(cb, 201)
        self.assertEqual(a.c.delete("/api/compte", json={"mot_de_passe": "Lumiere-2026!"}, headers=a._h()).status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 404)
        self.assertNotIn(eid, [e["id"] for e in b.get("/api/ecrits").get_json()["ecrits"]])
        # retirés, pas effacés : la ligne reste, datée, avec son motif
        ligne = sql("SELECT texte, retire_le, retrait_motif FROM ecrits WHERE id = ?", (eid,))[0]
        self.assertEqual((ligne["texte"], ligne["retrait_motif"], bool(ligne["retire_le"])), ("Texte de a", "compte supprimé", True))
        self.assertTrue(sql("SELECT retire_le FROM ecrits_commentaires WHERE user_id = ?", (a.id,))[0]["retire_le"])


class Moderation(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.secret = creer_admin("moderation@sozo.test", "moderation")

    def admin(self):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        c = self.app.test_client()
        r = c.post("/api/admin/sessions", json={"email": "moderation@sozo.test", "mot_de_passe": MDP_ADMIN,
                                                "code": admin._code(self.secret, int(time.time() // 30))})
        self.assertEqual(r.status_code, 200, r.get_json())
        return c, {security.EN_TETE_CSRF: c.get_cookie(admin.COOKIE_CSRF).value}

    def test_signalement_puis_retrait(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = ecrire(a, "Un texte blessant.")
        self.assertEqual(b.post(f"/api/ecrits/{eid}/signaler", {"motif": "Propos blessants"}).status_code, 201)
        c, h = self.admin()
        s = c.get("/api/admin/signalements-ecrits").get_json()["signalements"]
        self.assertEqual(len(s), 1)
        self.assertEqual(c.post(f"/api/admin/signalements-ecrits/{s[0]['id']}", json={"decision": "retirer", "motif": "Charte"}, headers=h).status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 404)
        self.assertNotIn(eid, [e["id"] for e in b.get("/api/ecrits").get_json()["ecrits"]])
        # l'auteur le voit encore (retiré), mais ne le modifie ni ne le republie
        self.assertTrue(a.get(f"/api/ecrits/{eid}").get_json()["ecrit"]["retire"])
        self.assertEqual(a.patch(f"/api/ecrits/{eid}", {"texte": "Corrigé"}).status_code, 409)
        self.assertEqual(a.post(f"/api/ecrits/{eid}/publier").status_code, 409)
        # rien n'est détruit
        self.assertEqual(sql("SELECT texte FROM ecrits WHERE id = ?", (eid,))[0]["texte"], "Un texte blessant.")
        # une session de lecteur n'est pas une session d'administration
        self.assertEqual(b.post(f"/api/admin/signalements-ecrits/{s[0]['id']}", {"decision": "rejeter"}).status_code, 401)


class CorbeilleDesPages(TestBase):
    def detail(self, a, slug):
        return a.get(f"/api/studio/livres/{slug}").get_json()["livre"]

    def test_un_brouillon_de_fin_va_a_la_corbeille_et_revient(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=5, publier=(1, 2), payantes=())
        a.put(f"/api/studio/livres/{slug}/pages/4", {"contenu": "Quatrième, réécrite."})
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}/pages/4").status_code, 200)
        pages = self.detail(a, slug)["pages"]
        self.assertEqual([p["n"] for p in pages], [1, 2, 3, 4])
        self.assertIn("page 5", pages[3]["extrait"])          # l'ancienne page 5 a reculé d'un cran
        jetees = a.get(f"/api/studio/livres/{slug}/corbeille").get_json()["pages"]
        self.assertEqual((len(jetees), jetees[0]["n_avant"], jetees[0]["version"]), (1, 4, 2))
        r = a.post(f"/api/studio/livres/{slug}/corbeille/{jetees[0]['id']}/restaurer")
        self.assertEqual(r.get_json()["n"], 5)
        page = a.get(f"/api/studio/livres/{slug}/pages/5").get_json()
        self.assertEqual((page["contenu"], len(page["versions"]), page["statut"]), ("Quatrième, réécrite.", 2, "draft"))
        self.assertEqual(a.get(f"/api/studio/livres/{slug}/corbeille").get_json()["pages"], [])

    def test_une_page_sortie_ne_bouge_jamais(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=4, publier=(1, 2, 4), payantes=())
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}/pages/2").status_code, 409)     # publiée
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}/pages/3").status_code, 409)     # brouillon entre deux pages sorties
        self.assertEqual([p["n"] for p in self.detail(a, slug)["pages"]], [1, 2, 3, 4])
        # le lecteur lit toujours sa page 4 au même numéro
        self.assertEqual(Personne(self.app).get(f"/api/livres/{slug}/pages/4").status_code, 200)
        # la DERNIÈRE page sortie non plus (aucune page sortie après elle)
        fin = a.livre(pages=3, publier=(1, 2), payantes=())
        self.assertEqual(a.delete(f"/api/studio/livres/{fin}/pages/2").status_code, 409)
        self.assertEqual(a.delete(f"/api/studio/livres/{fin}/pages/3").status_code, 200)

    def test_une_page_jetee_disparait_pour_le_lecteur_aussi(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=3, publier=(1,), payantes=())
        a.delete(f"/api/studio/livres/{slug}/pages/3")
        # l'auteur voit ses brouillons dans le catalogue : la page jetée n'y est plus
        livre = next(b for b in a.get("/api/catalogue").get_json()["books"] if b["id"] == slug)
        self.assertEqual([p["n"] for p in livre["pages"]], [1, 2])
        # une nouvelle page prend la suite, sans trou ni doublon
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages", {"contenu": "Nouvelle."}).get_json()["n"], 3)


class Genres(TestBase):
    def test_genres_resserres_un_ancien_livre_garde_le_sien(self):
        a = Personne(self.app, "auteur")
        r = a.post("/api/studio/livres", {"titre": "X", "categorie": "Roman", "mode": "integral", "acces": "free"})
        self.assertEqual(r.status_code, 400)
        slug = a.livre(pages=1, publier=(), payantes=())
        cx = db.connecter(globale=True)
        try:
            cx.execute("UPDATE books SET categorie = 'Roman' WHERE slug = ?", (slug,))   # un livre d'avant le 21/10
            cx.valider()
        finally:
            cx.fermer()
        self.assertEqual(a.patch(f"/api/studio/livres/{slug}", {"categorie": "Roman", "titre": "Renommé"}).status_code, 200)
        self.assertEqual(a.patch(f"/api/studio/livres/{slug}", {"categorie": "Poésie"}).status_code, 200)
        self.assertEqual(a.patch(f"/api/studio/livres/{slug}", {"categorie": "Roman"}).status_code, 400)   # on ne revient pas en arrière


class MiseEnForme(TestBase):
    def test_texte_nu(self):
        self.assertEqual(texte.nu("# Titre\n> Une **lumière** douce\n***\nFin *ici*"), "Titre\nUne lumière douce\n\nFin ici")

    def test_une_epingle_compare_le_texte_lu(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=1, publier=(), payantes=())
        a.put(f"/api/studio/livres/{slug}/pages/1", {"contenu": "La **lumière** du *matin* entre."})
        a.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [1], "action": "publier"})
        r = Personne(self.app).post("/api/epingles", {"livre": slug, "n": 1, "extrait": "lumière du matin"})
        self.assertEqual(r.status_code, 201, r.get_json())


@unittest.skipUnless(config.moteur() == "postgres" and os.environ.get("SOZO_PG_ROLE"), "PostgreSQL avec rôle applicatif uniquement")
class EcritsRls(TestBase):
    def test_la_base_cache_les_brouillons_d_autrui(self):
        a, b = Personne(self.app), Personne(self.app)
        ecrire(a, "Brouillon de a", publier=False)
        ecrire(a, "Publié de a")
        import flask
        with self.app.test_request_context("/"):
            for qui, attendu in ((a, 2), (b, 1)):
                flask.g.user = {"id": qui.id}
                cx = db.connecter()
                try:
                    # AUCUN filtre dans la requête : c'est la base qui filtre
                    self.assertEqual(cx.un("SELECT COUNT(*) AS n FROM ecrits")["n"], attendu)
                finally:
                    cx.fermer()
            flask.g.user = {"id": b.id}
            cx = db.connecter()
            try:
                with self.assertRaises(Exception):       # écrire au nom d'un autre : refusé par la base
                    cx.execute("INSERT INTO ecrits (user_id, nature, texte, statut, created_at, updated_at) VALUES (?, 'pensee', 'x', 'publie', 'a', 'a')", (a.id,))
            finally:
                cx.annuler()
                cx.fermer()
            flask.g.user = None
