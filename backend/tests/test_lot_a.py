"""21/10/2026 — lot A, « compléter ce qui existe » : chaque objet du studio et
du compte a son cycle complet. Chaque test protège une règle que l'écran ne
peut pas tenir seul. Les mêmes principes partout : une page SORTIE ne bouge
jamais, rien de ce qui a été vendu ne s'efface, l'historique ne s'écrase pas."""
import os

import db
from tests.aide import MDP, Personne, TestBase, confirmer_paiement
from tests.test_argent import sql


def numeros(a, slug):
    return [(p["n"], p["extrait"]) for p in a.get(f"/api/studio/livres/{slug}").get_json()["livre"]["pages"]]


class Livres(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def test_corbeille_d_un_livre_jamais_paru(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(titre="Brouillon de livre", pages=2, publier=(), payantes=())
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}").status_code, 200)
        self.assertEqual(a.get(f"/api/studio/livres/{slug}").status_code, 404)             # le studio ne l'atteint plus
        self.assertNotIn(slug, [b["id"] for b in a.get("/api/studio").get_json()["livres"]])
        self.assertNotIn(slug, [b["id"] for b in a.get("/api/catalogue").get_json()["books"]])
        self.assertEqual([b["id"] for b in a.get("/api/studio/corbeille").get_json()["livres"]], [slug])
        self.assertEqual(a.post(f"/api/studio/corbeille/{slug}/restaurer").status_code, 200)
        self.assertEqual(a.get(f"/api/studio/livres/{slug}").status_code, 200)
        # puis pour de bon : tout part, pages et versions comprises
        a.delete(f"/api/studio/livres/{slug}")
        self.assertEqual(a.delete(f"/api/studio/corbeille/{slug}").status_code, 200)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM books WHERE slug = ?", (slug,))[0]["n"], 0)
        self.assertEqual(a.post(f"/api/studio/corbeille/{slug}/restaurer").status_code, 404)

    def test_un_livre_paru_ne_va_pas_a_la_corbeille(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=2, publier=(1,), payantes=())
        r = a.delete(f"/api/studio/livres/{slug}")
        self.assertEqual((r.status_code, r.get_json()["code"]), (409, "deja_paru"))

    def test_retirer_du_catalogue_garde_les_droits_acquis(self):
        a = Personne(self.app, "auteur")
        slug = a.livre()                                   # pages 1-2 gratuites, 3-4 payantes publiées
        acheteur, autre = Personne(self.app), Personne(self.app)
        pid = acheteur.post("/api/paiements", {"objet": "page", "livre": slug, "n": 3, "idempotency_key": "retrait-a"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/catalogue", {"visible": False}).status_code, 200)
        self.assertNotIn(slug, [b["id"] for b in autre.get("/api/catalogue").get_json()["books"]])
        self.assertEqual(autre.get(f"/api/livres/{slug}/pages/1").status_code, 404)
        self.assertEqual(acheteur.get(f"/api/livres/{slug}/pages/3").status_code, 200)    # ce qui est payé reste
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/catalogue", {"visible": True}).status_code, 200)
        self.assertEqual(autre.get(f"/api/livres/{slug}/pages/1").status_code, 200)
        # un livre vendu ne s'efface jamais, même par son auteur
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}").status_code, 409)


class Pages(TestBase):
    def test_inserer_dupliquer(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=4, publier=(1, 2), payantes=())
        r = a.post(f"/api/studio/livres/{slug}/pages", {"contenu": "Insérée.", "apres": 2})
        self.assertEqual(r.get_json()["n"], 3)
        self.assertEqual([x[1][:8] for x in numeros(a, slug)], ["Texte se", "Texte se", "Insérée.", "Texte se", "Texte se"])
        self.assertIn("page 3", numeros(a, slug)[3][1])          # l'ancienne page 3 est devenue la 4
        # avant une page sortie : refusé, rien ne bouge
        r = a.post(f"/api/studio/livres/{slug}/pages", {"contenu": "Non.", "apres": 1})
        self.assertEqual((r.status_code, r.get_json()["code"]), (409, "hors_queue"))
        self.assertEqual(len(numeros(a, slug)), 5)
        # dupliquer un brouillon : la copie vient juste après
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/3/dupliquer").get_json()["n"], 4)
        self.assertEqual(numeros(a, slug)[3][1], "Insérée.")
        # dupliquer une page sortie : la copie va à la fin
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/1/dupliquer").get_json()["n"], 7)

    def test_couper_et_fusionner(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=3, publier=(1,), payantes=())
        a.put(f"/api/studio/livres/{slug}/pages/2", {"contenu": "Premier paragraphe.\nSecond paragraphe."})
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/2/couper", {"position": 20}).get_json()["n"], 3)
        self.assertEqual([x[1] for x in numeros(a, slug)][1:3], ["Premier paragraphe.", "Second paragraphe."])
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/1/couper", {"position": 5}).status_code, 409)   # page sortie
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/2/fusionner").status_code, 200)
        pages = numeros(a, slug)
        self.assertEqual(len(pages), 3)
        self.assertEqual(pages[1][1], "Premier paragraphe.\nSecond paragraphe.")
        # la page absorbée est dans la corbeille, avec ses versions
        self.assertEqual(len(a.get(f"/api/studio/livres/{slug}/corbeille").get_json()["pages"]), 1)

    def test_restaurer_une_ancienne_version(self):
        a = Personne(self.app, "auteur", pro=False)
        slug = a.livre(acces="free", pages=2, publier=(1,), payantes=())
        a.put(f"/api/studio/livres/{slug}/pages/2", {"contenu": "Version deux."})
        v1 = a.get(f"/api/studio/livres/{slug}/pages/2/versions/1").get_json()["version"]["contenu"]
        r = a.post(f"/api/studio/livres/{slug}/pages/2/versions/1/restaurer")
        self.assertEqual(r.get_json()["version"], 3)
        page = a.get(f"/api/studio/livres/{slug}/pages/2").get_json()
        self.assertEqual((page["contenu"], len(page["versions"])), (v1, 3))      # rien n'est écrasé : trois versions
        # une page publiée ne se corrige qu'avec Plume, restauration comprise
        a.put(f"/api/studio/livres/{slug}/pages/1", {"contenu": "Interdit"})
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/1/versions/1/restaurer").status_code, 403)

    def test_effacer_definitivement_une_page_jetee(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=2, publier=(), payantes=())
        pid = a.delete(f"/api/studio/livres/{slug}/pages/2").get_json()["page"]
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}/corbeille/{pid}").status_code, 200)
        self.assertEqual(a.get(f"/api/studio/livres/{slug}/corbeille").get_json()["pages"], [])
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM page_versions WHERE page_id = ?", (pid,))[0]["n"], 0)
        # une page qui n'est PAS dans la corbeille ne s'efface pas par cette route
        vivante = sql("SELECT id FROM pages WHERE n = 1 AND book_id = (SELECT id FROM books WHERE slug = ?)", (slug,))[0]["id"]
        self.assertEqual(a.delete(f"/api/studio/livres/{slug}/corbeille/{vivante}").status_code, 404)


class Ecrits(TestBase):
    def ecrire(self, p, texte="Un mot.", publier=True):
        return p.post("/api/ecrits", {"nature": "pensee", "texte": texte, "publier": publier}).get_json()["ecrit"]["id"]

    def test_programmer_un_ecrit(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = self.ecrire(a, publier=False)
        self.assertEqual(a.post(f"/api/ecrits/{eid}/publier", {"date": "2020-01-01T10:00"}).status_code, 400)   # dans le passé
        r = a.post(f"/api/ecrits/{eid}/publier", {"date": "2099-01-01T10:00"})
        self.assertTrue(r.get_json()["ecrit"]["programme"])
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 404)
        self.assertNotIn(eid, [e["id"] for e in b.get("/api/ecrits").get_json()["ecrits"]])
        self.assertEqual(b.post(f"/api/ecrits/{eid}/jaime").status_code, 404)
        # « publier maintenant » l'avance
        self.assertEqual(a.post(f"/api/ecrits/{eid}/publier").status_code, 200)
        self.assertEqual(b.get(f"/api/ecrits/{eid}").status_code, 200)

    def test_effacer_definitivement(self):
        a, b = Personne(self.app), Personne(self.app)
        eid = self.ecrire(a, "Texte à effacer")
        self.assertEqual(a.delete(f"/api/ecrits/{eid}/definitif").status_code, 409)       # pas encore à la corbeille
        b.post(f"/api/ecrits/{eid}/signaler", {"motif": "À vérifier, svp"})
        a.delete(f"/api/ecrits/{eid}")
        r = a.delete(f"/api/ecrits/{eid}/definitif")
        self.assertEqual((r.status_code, r.get_json()["code"]), (409, "signalement_ouvert"))    # pas de preuve qui disparaît
        cx = db.connecter(globale=True)
        try:
            cx.execute("UPDATE signalements_ecrits SET etat = 'rejete' WHERE ecrit_id = ?", (eid,))
            cx.valider()
        finally:
            cx.fermer()
        self.assertEqual(a.delete(f"/api/ecrits/{eid}/definitif").status_code, 200)
        self.assertEqual(a.get(f"/api/ecrits/{eid}").status_code, 404)
        self.assertNotIn(eid, [e["id"] for e in a.get("/api/mes-ecrits").get_json()["ecrits"]])
        self.assertEqual(sql("SELECT texte FROM ecrits WHERE id = ?", (eid,))[0]["texte"], "")

    def test_repondre_et_corriger(self):
        a, b, c = Personne(self.app), Personne(self.app), Personne(self.app)
        eid, autre = self.ecrire(a), self.ecrire(a)
        cb = b.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Merci"}).get_json()["commentaire"]["id"]
        rc = c.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Moi aussi", "parent": cb}).get_json()["commentaire"]
        self.assertEqual(rc["parent"], cb)
        # répondre à une réponse : on reste sur le fil du commentaire d'origine (un seul niveau)
        rr = a.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Amen", "parent": rc["id"]}).get_json()["commentaire"]
        self.assertEqual(rr["parent"], cb)
        # un commentaire d'un AUTRE écrit n'est pas un parent possible
        self.assertEqual(b.post(f"/api/ecrits/{autre}/commentaires", {"texte": "x", "parent": cb}).status_code, 404)
        # corriger le sien, pas celui d'un autre
        self.assertEqual(b.patch(f"/api/commentaires/{cb}", {"texte": "Merci beaucoup"}).status_code, 200)
        self.assertEqual(c.patch(f"/api/commentaires/{cb}", {"texte": "Volé"}).status_code, 404)
        cx = db.connecter(globale=True)
        try:
            cx.execute("UPDATE ecrits_commentaires SET created_at = '2020-01-01T00:00:00Z' WHERE id = ?", (cb,))
            cx.valider()
        finally:
            cx.fermer()
        r = b.patch(f"/api/commentaires/{cb}", {"texte": "Trop tard"})
        self.assertEqual((r.status_code, r.get_json()["code"]), (409, "trop_tard"))
        lu = {x["id"]: x for x in b.get(f"/api/ecrits/{eid}").get_json()["commentaires"]}
        self.assertEqual((lu[cb]["texte"], lu[cb]["modifie"]), ("Merci beaucoup", True))


class Compte(TestBase):
    def dernier_code(self, email):
        return sql("SELECT sujet FROM envois WHERE destinataire = ? ORDER BY id DESC LIMIT 1", (email,))[0]["sujet"][:6]

    def test_changer_d_adresse(self):
        a = Personne(self.app)
        ailleurs = self.app.test_client()               # une autre session du même compte
        self.assertEqual(ailleurs.post("/api/sessions", json={"email": a.email, "mot_de_passe": MDP}).status_code, 200)
        self.assertEqual(a.post("/api/moi/email/code", {"email": "neuve@exemple.cd", "mot_de_passe": "faux"}).status_code, 403)
        self.assertEqual(a.post("/api/moi/email/code", {"email": "neuve@exemple.cd", "mot_de_passe": MDP}).status_code, 202)
        code = self.dernier_code("neuve@exemple.cd")     # le code part à la NOUVELLE adresse
        ancienne = a.email
        self.assertEqual(a.post("/api/moi/email", {"code": code}).status_code, 200)
        self.assertEqual(a.get("/api/moi").get_json()["moi"]["email"], "neuve@exemple.cd")
        self.assertEqual(ailleurs.get("/api/moi").status_code, 401)                      # les autres sessions tombent
        self.assertIn("a changé", sql("SELECT sujet FROM envois WHERE destinataire = ? ORDER BY id DESC LIMIT 1", (ancienne,))[0]["sujet"])

    def test_adresse_prise_rien_ne_part(self):
        a, b = Personne(self.app), Personne(self.app)
        avant = sql("SELECT COUNT(*) AS n FROM envois WHERE destinataire = ?", (b.email,))[0]["n"]
        self.assertEqual(a.post("/api/moi/email/code", {"email": b.email, "mot_de_passe": MDP}).status_code, 202)   # même réponse
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM envois WHERE destinataire = ?", (b.email,))[0]["n"], avant)

    def test_un_code_d_adresse_ne_change_pas_le_mot_de_passe(self):
        """Sans la distinction des codes, un voleur de session (qui connaît le mot de passe)
        recevait sur SA boîte un code qui suffisait aussi à changer le mot de passe."""
        a = Personne(self.app)
        a.post("/api/moi/email/code", {"email": "voleur@exemple.cd", "mot_de_passe": MDP})
        code = self.dernier_code("voleur@exemple.cd")
        r = a.post("/api/moi/mot-de-passe", {"ancien": MDP, "nouveau": "Autre-mot-2026!", "code": code})
        self.assertEqual(r.status_code, 403)
        # et l'inverse : un code de mot de passe ne valide pas une adresse
        a.post("/api/moi/mot-de-passe/code")
        r = a.post("/api/moi/email", {"code": self.dernier_code(a.email)})
        self.assertEqual(r.status_code, 403)

    def test_appareils_et_deconnexion_partout(self):
        a = Personne(self.app)
        ailleurs = self.app.test_client()
        ailleurs.post("/api/sessions", json={"email": a.email, "mot_de_passe": MDP})
        s = a.get("/api/moi/sessions").get_json()["sessions"]
        self.assertEqual((len(s), sum(x["courante"] for x in s)), (2, 1))
        self.assertEqual(a.post("/api/moi/sessions/autres").status_code, 200)
        self.assertEqual(ailleurs.get("/api/moi").status_code, 401)
        self.assertEqual(a.get("/api/moi").status_code, 200)

    def test_mes_donnees(self):
        a = Personne(self.app)
        a.post("/api/ecrits", {"nature": "poeme", "texte": "Mon poème à moi"})
        r = a.get("/api/moi/donnees")
        self.assertEqual(r.status_code, 200)
        self.assertIn("attachment", r.headers["Content-Disposition"])
        corps = r.get_data(as_text=True)
        self.assertIn("Mon poème à moi", corps)
        self.assertNotIn("password", corps)
        self.assertNotIn("token", corps)

    def test_note_d_epingle_et_notification_supprimee(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(pages=1, publier=(1,), payantes=())
        a, b = Personne(self.app), Personne(self.app)
        eid = a.post("/api/epingles", {"livre": slug, "n": 1, "extrait": "Texte secret de la page 1."}).get_json()["epingle"]["id"]
        self.assertEqual(a.patch(f"/api/epingles/{eid}", {"note": "À relire dimanche"}).status_code, 200)
        self.assertEqual(b.patch(f"/api/epingles/{eid}", {"note": "Volé"}).status_code, 404)
        self.assertEqual(a.get("/api/epingles").get_json()["epingles"][0]["note"], "À relire dimanche")
        cx = db.connecter(globale=True)
        try:
            nid = cx.inserer("INSERT INTO notifications (user_id, type, titre, corps, cle, created_at) VALUES (?, 'test', 't', 'c', 'k1', 'a')", (a.id,))
            cx.valider()
        finally:
            cx.fermer()
        self.assertEqual(b.delete(f"/api/notifications/{nid}").status_code, 404)
        self.assertEqual(a.delete(f"/api/notifications/{nid}").status_code, 200)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM notifications WHERE id = ?", (nid,))[0]["n"], 0)
