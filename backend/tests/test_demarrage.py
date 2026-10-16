"""Défaut constaté le 16/10/2026 en préparant les tests de charge : avec
plusieurs processus gunicorn, CHAQUE processus applique le schéma au
démarrage, en même temps. Sous PostgreSQL, leurs DDL (politiques RLS,
déclencheurs) s'interbloquaient : « deadlock detected », serveur arrêté.
Le verrou de `appliquer_schema` ne valait que dans un processus."""
import multiprocessing as mp

import db
from tests.aide import TestBase


def _appliquer(file):
    try:
        db.appliquer_schema()
        file.put("ok")
    except Exception as e:                    # noqa: BLE001 — on rapporte, le test juge
        file.put(f"{type(e).__name__}: {e}"[:200])


class DemarrageSimultane(TestBase):
    def test_quatre_processus_appliquent_le_schema_en_meme_temps(self):
        ctx = mp.get_context("spawn")
        file = ctx.Queue()
        procs = [ctx.Process(target=_appliquer, args=(file,)) for _ in range(4)]
        [p.start() for p in procs]
        resultats = [file.get(timeout=120) for _ in procs]
        [p.join(30) for p in procs]
        self.assertEqual(resultats, ["ok"] * 4, resultats)
