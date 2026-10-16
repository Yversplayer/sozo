"""Remplit une base LOCALE avec le catalogue de démonstration (livres et
auteurs fictifs, marqués demo = 1).

    backend_venv/bin/python backend/tools/demo.py

Refusé sur une base distante : des livres inventés ne doivent jamais
apparaître en production par une commande lancée au mauvais endroit.
Rejouable : ne fait rien si la démonstration est déjà chargée.
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import config  # noqa: E402
import db  # noqa: E402
import security  # noqa: E402

KINSHASA = timezone(timedelta(hours=1))
FILLER = ("La suite de cette page existe dans le manuscrit de l'auteur. Ce livre de démonstration n'en montre "
          "que l'ouverture : le texte réel sera servi page par page par le serveur.")


def utc(local):
    if not local:
        return None
    return datetime.fromisoformat(local).replace(tzinfo=KINSHASA).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def centimes(x):
    return None if x is None else int(round(x * 100))


def main():
    if config.base_distante():
        sys.exit("Refusé : la démonstration ne se charge que sur une base locale.")
    with open(os.path.join(os.path.dirname(__file__), "demo.json"), encoding="utf-8") as f:
        D = json.load(f)
    db.appliquer_schema()
    cx = db.connecter()
    try:
        if cx.un("SELECT id FROM books WHERE demo = 1 LIMIT 1"):
            print("Démonstration déjà chargée.")
            return
        m = security._utc(security.maintenant())
        auteurs = {}
        for cle, a in D["authors"].items():
            uid = cx.inserer("""INSERT INTO users (email, nom, role, password_hash, email_verifie_at, created_at, bio, ville, photo, demo)
                                VALUES (?, ?, 'auteur', ?, ?, ?, ?, ?, ?, 1)""",
                             (f"demo-{cle}@sozo.invalid", a["name"], security.hacher_mot_de_passe(security.nouveau_jeton()), m,
                              f"{a.get('since', '2025')}-01-01T00:00:00Z", a.get("bio"), a.get("city"), a.get("photo")))
            auteurs[cle] = uid
        for b in D["books"]:
            fmt = "planche" if b.get("format") == "planche" else ("vers" if b["cat"] == "Poésie" else "texte")
            prix = b.get("price") or {}
            bid = cx.inserer("""INSERT INTO books (owner_id, slug, titre, categorie, description, couverture, style, format, mode, acces,
                                prix_page, prix_chapitre, prix_livre, fichier_source, demo, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                             (auteurs[b["author"]], b["id"], b["title"], b["cat"], b["desc"], b["cover"]["img"], b["cover"]["style"], fmt,
                              b["mode"], b["access"], centimes(prix.get("page")), centimes(prix.get("chapter")), centimes(prix.get("all")),
                              b.get("file"), m, m))
            for c in b["chapters"]:
                cx.execute("INSERT INTO chapters (book_id, titre, page_de, page_a) VALUES (?, ?, ?, ?)", (bid, c["t"], c["from"], c["to"]))
            textes = D["texts"].get(b["id"], [])
            for p in b["pages"]:
                pid = cx.inserer("INSERT INTO pages (book_id, n, acces, statut, publie_le, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                                 (bid, p["n"], p["access"], p["status"], utc(p["date"]), p["source"], m))
                t = textes[p["n"] - 1] if p["n"] - 1 < len(textes) else None
                contenu = "\n".join(t) if t else ("" if fmt == "planche" else b["desc"] + "\n" + FILLER)
                cx.execute("INSERT INTO page_versions (page_id, version, contenu, is_current, auteur_id, created_at) VALUES (?, 1, ?, 1, ?, ?)",
                           (pid, contenu, auteurs[b["author"]], m))
        cx.valider()
        print(f"{len(auteurs)} auteurs et {len(D['books'])} livres de démonstration chargés.")
    finally:
        cx.fermer()


if __name__ == "__main__":
    main()
