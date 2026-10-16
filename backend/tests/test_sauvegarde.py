"""Sauvegarde et RESTAURATION (16/10/2026). Le test fait ce qu'on fera le
jour d'un sinistre : exporter une base vivante, la restaurer dans une base
VIDE, vérifier table par table — puis s'en servir (connexion, lecture d'une
page achetée, atelier de l'auteur)."""
import io
import os
import tempfile

import config
import db
import sauvegarde
from tests.aide import MDP, Personne, TestBase, confirmer_paiement
from tests.test_studio import docx


def base_vide():
    """Bascule l'application sur une base vide et rend de quoi revenir."""
    if config.moteur() == "sqlite":
        ancien = os.environ["SOZO_DB_PATH"]
        os.environ["SOZO_DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="sozo-restau-"), "restau.db")
        return ("SOZO_DB_PATH", ancien)
    import psycopg
    ancien = os.environ["SOZO_PG_SCHEMA"]
    with psycopg.connect(config.url_postgres(), autocommit=True) as c:
        c.execute("DROP SCHEMA IF EXISTS sozo_restau CASCADE")
        c.execute("CREATE SCHEMA sozo_restau")
        role = os.environ.get("SOZO_PG_ROLE")
        if role:
            c.execute(f"GRANT USAGE, CREATE ON SCHEMA sozo_restau TO {role}")
    os.environ["SOZO_PG_SCHEMA"] = "sozo_restau"
    return ("SOZO_PG_SCHEMA", ancien)


class Restauration(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        # Une base vivante : auteur, livre, versions, manuscrit importé, achat
        # confirmé (droit, reçu, registre), notification, journal d'audit.
        cls.auteur = Personne(cls.app, "auteur", nom="Auteure Restaurée")
        cls.slug = cls.auteur.livre(prix=(25, 75, 300))
        cls.auteur.put(f"/api/studio/livres/{cls.slug}/pages/5", {"contenu": "Version deux du brouillon"})
        r = cls.auteur.c.post(f"/api/studio/livres/{cls.slug}/import", data={"fichier": (io.BytesIO(docx(["Manuscrit sauvegardé, numéro 9."])), "m.docx")},
                              headers=cls.auteur._h(), content_type="multipart/form-data")
        assert r.status_code == 201, r.get_json()
        cls.lecteur = Personne(cls.app)
        pid = cls.lecteur.post("/api/paiements", {"objet": "livre", "livre": cls.slug, "idempotency_key": "test-cle-sauvegarde"}).get_json()["paiement"]["id"]
        assert confirmer_paiement(pid)
        cls.cle = sauvegarde.nouvelle_cle()
        cls.fichier = os.path.join(tempfile.mkdtemp(prefix="sozo-sauv-"), "sozo.sauv")
        cls.manifeste = sauvegarde.exporter(cls.fichier, cls.cle)

    def test_exporter_restaurer_verifier_puis_utiliser(self):
        self.assertTrue(self.manifeste["chiffree"])
        self.assertGreaterEqual(self.manifeste["tables"]["users"], 2)
        self.assertEqual(self.manifeste["fichiers"], 1)
        with open(self.fichier, "rb") as f:
            self.assertNotIn(b"Restaur", f.read())                       # rien de lisible en clair
        var, ancien = base_vide()
        try:
            rapport = sauvegarde.restaurer(self.fichier, self.cle)
            self.assertTrue(rapport["ok"], rapport["ecarts"])
            self.assertEqual(rapport["lignes"], sum(self.manifeste["tables"].values()))
            # La base restaurée SERT : nouvelle application, mêmes comptes
            from app import creer_app
            app2 = creer_app(); app2.testing = True
            c = app2.test_client()
            self.assertEqual(c.get("/api/moi").status_code, 401)            # sessions non restaurées : on se reconnecte
            self.assertEqual(c.post("/api/sessions", json={"email": self.lecteur.email, "mot_de_passe": MDP}).status_code, 200)
            p = c.get(f"/api/livres/{self.slug}/pages/3")
            self.assertEqual(p.status_code, 200)                           # le droit acheté a survécu
            a = app2.test_client()
            a.post("/api/sessions", json={"email": self.auteur.email, "mot_de_passe": MDP})
            self.assertEqual(a.get(f"/api/studio/livres/{self.slug}/pages/5").get_json()["contenu"], "Version deux du brouillon")
            self.assertEqual(a.get("/api/studio/ventes").get_json()["livres"][0]["net"], 255)
            # les identifiants repartent après les restaurés (pas de collision)
            lec2 = app2.test_client().post("/api/comptes", json={"nom": "Après", "email": "apres-restau@exemple.cd", "mot_de_passe": MDP, "role": "lecteur", "cgu": True},
                          environ_base={"REMOTE_ADDR": "10.77.0.1"})
            self.assertEqual(lec2.status_code, 201, lec2.get_json())
            # et le journal d'audit restauré reste inaltérable
            cx = db.connecter(globale=True)
            try:
                with self.assertRaises(Exception):
                    cx.execute("DELETE FROM audit_log")
                cx.annuler()
            finally:
                cx.fermer()
        finally:
            os.environ[var] = ancien

    def test_jamais_par_dessus_une_base_vivante(self):
        with self.assertRaises(sauvegarde.Refus) as e:
            sauvegarde.restaurer(self.fichier, self.cle)                   # la base de test n'est pas vide
        self.assertIn("pas vide", str(e.exception))

    def test_mauvaise_cle_ou_octet_modifie_refuses(self):
        with self.assertRaises(sauvegarde.Refus):
            sauvegarde.lire(self.fichier, sauvegarde.nouvelle_cle())
        with open(self.fichier, "rb") as f:
            octets = bytearray(f.read())
        octets[len(octets) // 2] ^= 1
        abime = self.fichier + ".abime"
        with open(abime, "wb") as f:
            f.write(bytes(octets))
        with self.assertRaises(sauvegarde.Refus):
            sauvegarde.lire(abime, self.cle)

    def test_sans_cle_refuse_hors_poste_local(self):
        os.environ.pop("SOZO_CLE_SAUVEGARDE", None)
        with self.assertRaises(sauvegarde.Refus):
            sauvegarde.exporter(self.fichier + ".clair")                   # ni clé, ni --sans-chiffrement explicite
