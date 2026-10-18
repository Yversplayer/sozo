"""Charge le catalogue d'EXEMPLE (livres et auteurs inventés, marqués
demo = 1, affichés avec l'étiquette « Exemple » et jamais vendus).

    backend_venv/bin/python backend/tools/demo.py                       # base locale
    backend_venv/bin/python backend/tools/demo.py --en-ligne --projet <ref> [--port 6543]

Le contenu vient de `demo.json`, écrit par `demo_catalogue.py`.

Une base distante est REFUSÉE sans `--en-ligne` : des livres inventés ne
doivent jamais entrer en production par une commande lancée au mauvais
endroit. Avec `--en-ligne` (décision du propriétaire, 18/10/2026 : option A),
l'adresse de la base est collée au clavier, jamais écrite dans une commande ni
dans l'historique, et il faut taper EXEMPLE pour confirmer. Les comptes
d'essai locaux ne sont jamais chargés : seuls des auteurs sans mot de passe
connu (adresse en .invalid, à laquelle aucun e-mail ne part).
Rejouable : ne fait rien si un livre d'exemple est déjà chargé.
"""
import getpass
import json
import os
import re
import sys
from urllib.parse import quote
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import config  # noqa: E402
import db  # noqa: E402
import security  # noqa: E402

KINSHASA = timezone(timedelta(hours=1))
FILLER = ("Ce livre est un exemple, écrit pour montrer comment Sōzō présente un livre page par page. "
          "Le texte de cette page n'a pas été écrit.")


def utc(local):
    if not local:
        return None
    return datetime.fromisoformat(local).replace(tzinfo=KINSHASA).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def centimes(x):
    return None if x is None else int(round(x * 100))


def _en_ligne(args):
    """Prépare la connexion à la base EN LIGNE (même principe que admin_en_ligne.py)."""
    try:
        projet = args[args.index("--projet") + 1]
    except (ValueError, IndexError):
        sys.exit("Indiquez --projet <identifiant du projet Supabase>.")
    port = args[args.index("--port") + 1] if "--port" in args else "6543"
    if not projet.isalnum() or port not in ("5432", "6543"):
        sys.exit("Projet ou port invalide.")
    mdp = getpass.getpass("Collez l'adresse SOZO_DATABASE_URL de Render, ou le seul mot de passe de la base (rien ne s'affiche, c'est normal) : ").strip()
    if not mdp:
        sys.exit("Rien n'a été collé.")
    if mdp.startswith(("postgresql://", "postgres://")):
        url = re.sub(r":(5432|6543)/", f":{port}/", mdp, count=1)
    else:
        url = f"postgresql://postgres.{projet}:{quote(mdp, safe='')}@aws-1-eu-central-1.pooler.supabase.com:{port}/postgres"
    os.environ.update(SOZO_DB_BACKEND="postgres", SOZO_DATABASE_URL=url, SOZO_PG_SCHEMA="public", SOZO_PG_ROLE="sozo_app")
    os.environ.pop("SOZO_MODE_TEST", None)
    if input("Les 14 livres d'exemple vont entrer dans la base EN LIGNE. Tapez EXEMPLE pour confirmer : ").strip() != "EXEMPLE":
        sys.exit("Annulé : rien n'a été chargé.")


def main():
    args = sys.argv[1:]
    if "--en-ligne" in args:
        _en_ligne(args)
    elif config.base_distante():
        sys.exit("Refusé : base distante. Pour la base en ligne, utilisez --en-ligne --projet <ref>.")
    with open(os.path.join(os.path.dirname(__file__), "demo.json"), encoding="utf-8") as f:
        D = json.load(f)
    db.appliquer_schema()
    cx = db.connecter()
    try:
        if cx.un("SELECT id FROM books WHERE demo = 1 LIMIT 1"):
            print("Le catalogue d'exemple est déjà chargé : rien n'a changé.")
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
        print(f"{len(auteurs)} auteurs et {len(D['books'])} livres d'exemple chargés.")
    finally:
        cx.fermer()


if __name__ == "__main__":
    main()
