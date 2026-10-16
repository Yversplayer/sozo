"""Étape 3 — qui lit quoi. Le texte d'une page fermée ne sort JAMAIS."""
import os
import re

import acces
import security
from tests.aide import Personne, TestBase, confirmer_paiement


class Regles(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.auteur = Personne(cls.app, "auteur")
        cls.slug = cls.auteur.livre()                 # 1-2 gratuites publiées, 3-4 payantes publiées, 5-6 payantes brouillon
        cls.auteur.post(f"/api/studio/livres/{cls.slug}/pages/lot", {"pages": [5], "action": "programmer", "date": "2099-01-01T10:00Z"})
        cls.lecteur = Personne(cls.app)

    def page(self, qui, n):
        return qui.get(f"/api/livres/{self.slug}/pages/{n}")

    def test_gratuite_lisible(self):
        r = self.page(self.lecteur, 1)
        self.assertEqual(r.status_code, 200)
        self.assertIn("Texte secret de la page 1", r.get_json()["contenu"])

    def test_payante_non_achetee_sans_texte(self):
        r = self.page(self.lecteur, 3)
        self.assertEqual(r.status_code, 402)
        self.assertNotIn("Texte secret", r.get_data(as_text=True))
        self.assertTrue(r.get_json()["options"])                 # le prix, oui

    def test_programmee_date_seulement(self):
        r = self.page(self.lecteur, 5)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.get_json()["date"], "2099-01-01T10:00:00Z")
        self.assertNotIn("Texte secret", r.get_data(as_text=True))

    def test_brouillon_invisible(self):
        self.assertEqual(self.page(self.lecteur, 6).status_code, 404)
        self.assertEqual(self.page(self.lecteur, 99).status_code, 404)

    def test_le_catalogue_ne_montre_pas_les_brouillons_d_autrui(self):
        livres = self.lecteur.get("/api/catalogue").get_json()["books"]
        b = [x for x in livres if x["id"] == self.slug][0]
        self.assertEqual([p["n"] for p in b["pages"]], [1, 2, 3, 4, 5])
        self.assertEqual({p["n"]: p["etat"] for p in b["pages"]}, {1: "free", 2: "free", 3: "locked", 4: "locked", 5: "soon"})
        self.assertNotIn("Texte secret", str(livres))

    def test_l_auteur_lit_tout(self):
        self.assertEqual(self.page(self.auteur, 6).get_json()["etat"], "auteur")

    def test_achat_confirme_ouvre_la_page_avec_filigrane(self):
        lec = Personne(self.app)
        p = lec.post("/api/paiements", {"objet": "page", "livre": self.slug, "n": 3, "idempotency_key": "achat-page-3"}).get_json()["paiement"]
        self.assertEqual(self.page(lec, 3).status_code, 402)       # créé n'est pas payé
        confirmer_paiement(p["id"])
        r = self.page(lec, 3)
        self.assertEqual(r.status_code, 200)
        d = r.get_json()
        self.assertEqual(d["etat"], "owned")
        self.assertEqual(acces.lire_marque(d["contenu"]), lec.id)   # la copie désigne son compte
        self.assertIn("Exemplaire de", d["filigrane"])
        self.assertEqual(self.page(lec, 4).status_code, 402)        # la page voisine reste fermée

    def test_livre_retire_garde_les_droits_acquis(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        acheteur, autre = Personne(self.app), Personne(self.app)
        pid = acheteur.post("/api/paiements", {"objet": "livre", "livre": slug, "idempotency_key": "achat-livre-1"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        import db
        cx = db.connecter()
        try:
            cx.execute("UPDATE books SET statut = 'retire' WHERE slug = ?", (slug,))
            cx.valider()
        finally:
            cx.fermer()
        self.assertEqual(acheteur.get(f"/api/livres/{slug}/pages/3").status_code, 200)   # payé : reste à lui
        self.assertEqual(autre.get(f"/api/livres/{slug}/pages/1").status_code, 404)      # retiré pour les autres
        self.assertNotIn(slug, [b["id"] for b in autre.get("/api/catalogue").get_json()["books"]])

    def test_limite_de_lecture(self):
        avant = security.LIMITES["lecture:compte"]
        security.LIMITES["lecture:compte"] = (3, 10)
        try:
            lec = Personne(self.app)
            codes = [self.page(lec, 1).status_code for _ in range(5)]
            self.assertEqual(codes[:3], [200, 200, 200])
            self.assertEqual(codes[-1], 429)
        finally:
            security.LIMITES["lecture:compte"] = avant

    def test_anonyme_refuse(self):
        self.assertEqual(self.app.test_client().get(f"/api/livres/{self.slug}/pages/1").status_code, 401)
        self.assertEqual(self.app.test_client().get("/api/catalogue").status_code, 401)


class Balayage(TestBase):
    """Chaque route paramétrée, appelée par B avec les identifiants de A, doit
    répondre 404 (ou 401 pour l'administration). Une route paramétrée absente
    de ROUTES fait échouer le test : elle ne peut pas sortir du filet en silence."""

    ROUTES = {
        # règle : (méthode, url avec {slug} {n} {pid} {rid}, codes acceptés)
        "lecteur_page": [("GET", "/api/livres/{slug_brouillon}/pages/1", {404})],
        "lecteur_suivre": [("POST", "/api/suivis/{slug_brouillon}", {404})],
        "ne_plus_suivre": [("DELETE", "/api/suivis/{slug_brouillon}", {404})],
        "paiement_lire": [("GET", "/api/paiements/{pid}", {404})],
        "paiement_declarer": [("POST", "/api/paiements/{pid}/declaration", {404}, {"operateur": "M-Pesa", "reference": "ABC12345"})],
        "paiement_annuler": [("POST", "/api/paiements/{pid}/annulation", {404})],
        "paiement_simuler": [("POST", "/api/paiements/{pid}/simulation", {404}, {"issue": "success"})],
        "admin_rembourser": [("POST", "/api/admin/paiements/{pid}/rembourser", {401}, {"motif": "essai"})],
        "studio_livre": [("GET", "/api/studio/livres/{slug}", {404})],
        "modifier_livre": [("PATCH", "/api/studio/livres/{slug}", {404}, {"titre": "Volé"})],
        "studio_chapitres": [("PUT", "/api/studio/livres/{slug}/chapitres", {404}, {"chapitres": []})],
        "nouvelle_page": [("POST", "/api/studio/livres/{slug}/pages", {404})],
        "studio_page": [("GET", "/api/studio/livres/{slug}/pages/1", {404})],
        "enregistrer_page": [("PUT", "/api/studio/livres/{slug}/pages/1", {404}, {"contenu": "écrasé"})],
        "studio_ordre": [("POST", "/api/studio/livres/{slug}/pages/ordre", {404}, {"ordre": [1]})],
        "studio_lot": [("POST", "/api/studio/livres/{slug}/pages/lot", {404}, {"pages": [1], "action": "publier"})],
        "importer": [("POST", "/api/studio/livres/{slug}/import", {404, 400})],
        "admin_confirmer": [("POST", "/api/admin/paiements/{pid}/confirmer", {401})],
        "admin_refuser": [("POST", "/api/admin/paiements/{pid}/refuser", {401}, {"motif": "essai"})],
        "traiter_reversement": [("POST", "/api/admin/reversements/{rid}/payer", {401}, {"reference": "abc"})],
        "moderer_livre": [("POST", "/api/admin/livres/1/retirer", {401}, {"motif": "essai"})],
        "traiter_signalement": [("POST", "/api/admin/signalements/1", {401}, {"etat": "traite"})],
        "moderer_utilisateur": [("POST", "/api/admin/utilisateurs/1/desactiver", {401}, {"motif": "essai"})],
    }
    # Routes paramétrées hors balayage, avec la raison :
    EXEMPTES = {
        "fichier": "fichiers statiques du site, sur liste blanche (test_socle)",
        "paiement_webhook": "pas de session : authentifiée par signature HMAC (test_argent)",
    }

    def test_toute_route_parametree_est_balayee(self):
        params = {r.endpoint for r in self.app.url_map.iter_rules() if r.arguments}
        oubliees = params - set(self.ROUTES) - set(self.EXEMPTES)
        self.assertEqual(oubliees, set(), "Route paramétrée hors du balayage : ajoutez-la à ROUTES")

    def test_b_ne_voit_rien_de_a(self):
        os.environ["SOZO_MODE_TEST"] = "1"
        a, b = Personne(self.app, "auteur"), Personne(self.app, "auteur")
        slug = a.livre(publier=())                    # que des brouillons
        vendu = Personne(self.app, "auteur").livre()
        pid = a.post("/api/paiements", {"objet": "page", "livre": vendu, "n": 3, "idempotency_key": "balayage-a"}).get_json()["paiement"]["id"]
        cle = {"slug": slug, "slug_brouillon": slug, "pid": pid, "rid": 1, "n": 1}
        for ep, essais in self.ROUTES.items():
            for essai in essais:
                meth, url, attendus = essai[:3]
                corps = essai[3] if len(essai) > 3 else None
                u = url.format(**cle)
                if meth == "GET":
                    r = b.get(u)
                elif meth == "DELETE":
                    r = b.delete(u)
                else:
                    r = getattr(b, meth.lower())(u, corps)
                self.assertIn(r.status_code, attendus, f"{ep} {meth} {u} → {r.status_code} {r.get_data(as_text=True)[:120]}")
                self.assertNotIn("Texte secret", r.get_data(as_text=True), ep)
