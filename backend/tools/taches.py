"""Une passe des tâches périodiques (voir backend/taches.py).

    backend_venv/bin/python backend/tools/taches.py             # une passe, puis s'arrête (tâche planifiée)
    backend_venv/bin/python backend/tools/taches.py --boucle 120  # en continu, toutes les 120 s (worker)
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import db  # noqa: E402
import taches  # noqa: E402


def passe():
    print(json.dumps(taches.tout(), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    db.appliquer_schema()
    if "--boucle" in sys.argv:
        intervalle = int(sys.argv[sys.argv.index("--boucle") + 1])
        while True:
            passe()
            time.sleep(intervalle)
    else:
        passe()
