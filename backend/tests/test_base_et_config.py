"""Base (schéma idempotent, audit immuable), validation, configuration, secrets."""
import os
import re
import subprocess
import unittest

import config
import db
import validation
from tests.aide import RACINE_BACKEND, TestBase


class Schema(TestBase):
    def test_schema_rejouable(self):
        db.appliquer_schema()
        db.appliquer_schema()
        cx = db.connecter()
        try:
            self.assertEqual(cx.un("SELECT version FROM schema_meta")["version"], db.VERSION_SCHEMA)
        finally:
            cx.fermer()

    def test_journal_d_audit_immuable(self):
        """La base elle-même refuse de modifier ou d'effacer le journal."""
        cx = db.connecter()
        try:
            cx.execute("INSERT INTO audit_log (at, action, resultat) VALUES (?, ?, ?)", (validation.maintenant(), "test", "ok"))
            cx.valider()
            for sql in ("UPDATE audit_log SET action = 'efface'", "DELETE FROM audit_log"):
                with self.assertRaises(Exception, msg=sql):
                    cx.execute(sql)
                cx.annuler()
            self.assertGreaterEqual(cx.un("SELECT COUNT(*) AS n FROM audit_log")["n"], 1)
        finally:
            cx.fermer()

    def test_route_non_declaree_auditee(self):
        from flask import jsonify
        app = self.app_neuve()
        app.add_url_rule("/api/oubliee2", "oubliee2", lambda: jsonify(ok=1))
        app.test_client().get("/api/oubliee2")
        cx = db.connecter()
        try:
            self.assertIsNotNone(cx.un("SELECT id FROM audit_log WHERE action = ? AND resultat = ?", ("route.non_declaree", "refus")))
        finally:
            cx.fermer()


class Validation(unittest.TestCase):
    def test_textes(self):
        self.assertEqual(validation.texte({"t": "  Bonjour "}, "t"), "Bonjour")
        for mauvais in ({"t": 3}, {"t": ""}, {"t": "a\nb"}, {"t": "x" * 201}, {"t": "a\x00b"}, {}):
            with self.assertRaises(validation.Invalide):
                validation.texte(mauvais, "t")

    def test_argent_en_centimes_entiers(self):
        self.assertEqual(validation.centimes({"p": 25}, "p"), 25)
        for mauvais in (0.25, "25", -1, True, 10 ** 9):
            with self.assertRaises(validation.Invalide, msg=repr(mauvais)):
                validation.centimes({"p": mauvais}, "p")

    def test_dates_ramenees_en_utc(self):
        self.assertEqual(validation.date_heure({"d": "2026-10-15T20:00+01:00"}, "d"), "2026-10-15T19:00:00Z")
        for mauvais in ("15/10/2026", "2026-13-01T10:00", "demain", None, 5):
            with self.assertRaises(validation.Invalide):
                validation.date_heure({"d": mauvais}, "d")

    def test_email_et_choix(self):
        self.assertEqual(validation.email({"email": "Nard@Exemple.CD"}), "nard@exemple.cd")
        with self.assertRaises(validation.Invalide):
            validation.email({"email": "pas-un-email"})
        with self.assertRaises(validation.Invalide):
            validation.choix({"r": "admin"}, "r", {"lecteur", "auteur"})


class Configuration(unittest.TestCase):
    def setUp(self):
        self._env = dict(os.environ)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._env)

    def test_mode_test_refuse_sur_base_distante(self):
        os.environ.update(SOZO_DB_BACKEND="postgres", SOZO_MODE_TEST="1",
                          SOZO_DATABASE_URL="postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres")
        with self.assertRaises(RuntimeError):
            config.mode_test()

    def test_mode_test_accepte_en_local(self):
        os.environ.update(SOZO_DB_BACKEND="sqlite", SOZO_MODE_TEST="1")
        self.assertTrue(config.mode_test())


class AucunSecretDansLeDepot(unittest.TestCase):
    """Parcourt les fichiers suivis (ou suivables) par git : aucune clé, aucun
    .env, aucune base ne doit pouvoir partir sur GitHub — le dépôt est PUBLIC."""
    MOTIFS = [
        re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}"),                # Anthropic
        re.compile(r"sk-(proj-)?[A-Za-z0-9]{32,}"),              # OpenAI
        re.compile(r"AKIA[0-9A-Z]{16}"),                          # AWS
        re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}"),                # GitHub
        re.compile(r"eyJ[A-Za-z0-9_\-]{20,}\.eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}"),  # JWT (clé Supabase)
        re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        re.compile(r"postgres(ql)?://[^:\s]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1)"),  # URL avec mot de passe
    ]

    def fichiers(self):
        racine = os.path.abspath(os.path.join(RACINE_BACKEND, ".."))
        try:
            sortie = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"],
                                    cwd=racine, capture_output=True, text=True, check=True).stdout
            return racine, [l for l in sortie.splitlines() if l]
        except Exception:
            liste = []
            for d, sous, fs in os.walk(racine):
                sous[:] = [s for s in sous if s not in (".git", "backend_venv", "__pycache__", "node_modules")]
                liste += [os.path.relpath(os.path.join(d, f), racine) for f in fs]
            return racine, liste

    def test_aucun_fichier_sensible(self):
        racine, fs = self.fichiers()
        interdits = [f for f in fs if os.path.basename(f) in (".env",) or f.endswith((".db", ".sqlite", ".pem", ".key", "-wal", "-shm"))]
        self.assertEqual(interdits, [])

    def test_aucune_cle(self):
        racine, fs = self.fichiers()
        trouves = []
        for f in fs:
            if f.endswith((".jpg", ".png", ".webp", ".woff2", ".ico", ".pdf")) or "/bible/" in f or "/langue/" in f:
                continue
            try:
                with open(os.path.join(racine, f), encoding="utf-8", errors="ignore") as h:
                    contenu = h.read()
            except (IsADirectoryError, FileNotFoundError):
                continue
            for m in self.MOTIFS:
                if m.search(contenu) and not f.endswith("test_base_et_config.py"):
                    trouves.append(f"{f} : {m.pattern[:30]}")
        self.assertEqual(trouves, [])
