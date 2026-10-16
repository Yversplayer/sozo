"""Peuple une base JETABLE pour les tests de charge (tools/k6/).

    SOZO_DB_BACKEND=postgres SOZO_DATABASE_URL=… SOZO_PG_SCHEMA=charge \\
      backend_venv/bin/python backend/tools/seed_charge.py --lecteurs 400 --auteurs 20 --base-url http://127.0.0.1:5085

Volume visé : un LANCEMENT réaliste — la démonstration (13 livres) plus
40 livres de 40 pages, 400 lecteurs qui suivent des livres et en ont acheté.
Refuse la base de développement et toute base distante. Écrit
tools/k6/env.json (jamais versionné : il contient le mot de passe d'essai).
"""
import argparse
import json
import os
import random
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import config  # noqa: E402
import db  # noqa: E402
import security  # noqa: E402

MDP = "Charge-Sozo-2026!"
PHRASES = ["La pluie tombait sur Kinshasa comme une promesse tenue.", "Elle relut la lettre une troisième fois, sans trembler.",
           "Au marché de Gambela, personne ne parlait de la nuit.", "Le fleuve gardait ses secrets, et lui les siens.",
           "Il comprit enfin pourquoi sa mère priait à l'aube.", "Les pages du carnet sentaient encore la fumée."]


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lecteurs", type=int, default=400)
    ap.add_argument("--auteurs", type=int, default=20)
    ap.add_argument("--livres-par-auteur", type=int, default=2)
    ap.add_argument("--pages", type=int, default=40)
    ap.add_argument("--base-url", default="http://127.0.0.1:5085")
    a = ap.parse_args()
    if config.base_distante():
        sys.exit("Refusé : base distante.")
    if config.moteur() == "sqlite" and os.path.abspath(config.chemin_sqlite()) == os.path.abspath(os.path.join(config.RACINE_BACKEND, "sozo.db")):
        sys.exit("Refusé : jamais sur la base de développement. Donnez SOZO_DB_PATH vers un fichier jetable.")
    random.seed(16102026)
    sys.path.insert(0, os.path.dirname(__file__))
    import demo
    demo.main()
    hache = security.hacher_mot_de_passe(MDP)          # un seul hachage : même mot de passe d'essai pour tous
    m = datetime.now(timezone.utc)
    cx = db.connecter(globale=True)
    try:
        auteurs, livres = [], []
        for i in range(a.auteurs):
            uid = cx.inserer("INSERT INTO users (email, nom, role, password_hash, email_verifie_at, created_at, bio, ville) VALUES (?, ?, 'auteur', ?, ?, ?, ?, 'Kinshasa')",
                             (f"auteur{i}@charge.test", f"Auteur de charge {i}", hache, iso(m), iso(m), "Auteur généré pour les tests de charge."))
            mes = []
            for j in range(a.livres_par_auteur):
                acces = random.choice(["free", "paid", "mixed", "mixed"])
                slug = f"charge-{i}-{j}"
                bid = cx.inserer("""INSERT INTO books (owner_id, slug, titre, categorie, description, couverture, style, format, mode, acces,
                                    prix_page, prix_chapitre, prix_livre, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'texte', 'progressive', ?, ?, ?, ?, ?, ?)""",
                                 (uid, slug, f"Le livre {i}-{j}", random.choice(["Roman", "Foi", "Poésie", "Essai"]), "Un livre de test de charge.",
                                  random.choice(["couv-pages", "couv-fenetre", "couv-spirale", "couv-plafond"]), random.choice("abcd"), acces,
                                  None if acces == "free" else 25, None if acces == "free" else 100, None if acces == "free" else 400, iso(m), iso(m)))
                for c in range(4):
                    de = c * (a.pages // 4) + 1
                    cx.execute("INSERT INTO chapters (book_id, titre, page_de, page_a) VALUES (?, ?, ?, ?)", (bid, f"Chapitre {c + 1}", de, de + a.pages // 4 - 1))
                gratuites, payantes = [], []
                for n in range(1, a.pages + 1):
                    if n > a.pages - 4:
                        statut, quand = "scheduled", m + timedelta(days=n - a.pages + 5)
                    else:
                        statut, quand = "published", m - timedelta(days=a.pages - n)
                    page_acces = "free" if acces == "free" or (acces == "mixed" and n <= 8) else "paid"
                    pid = cx.inserer("INSERT INTO pages (book_id, n, acces, statut, publie_le, annoncee_le, source, created_at) VALUES (?, ?, ?, ?, ?, ?, 'editor', ?)",
                                     (bid, n, page_acces, statut, iso(quand), iso(quand) if statut == "published" else None, iso(m)))
                    texte = "\n".join(random.choice(PHRASES) * 4 for _ in range(6))[:1800]
                    cx.execute("INSERT INTO page_versions (page_id, version, contenu, is_current, auteur_id, created_at) VALUES (?, 1, ?, 1, ?, ?)", (pid, texte, uid, iso(m)))
                    if statut == "published":
                        (gratuites if page_acces == "free" else payantes).append(n)
                livres.append({"slug": slug, "gratuites": gratuites, "payantes": payantes, "id": bid})
                mes.append(slug)
            auteurs.append({"email": f"auteur{i}@charge.test", "livres": mes})
        lecteurs = []
        payants = [l for l in livres if l["payantes"]]
        for k in range(a.lecteurs):
            uid = cx.inserer("INSERT INTO users (email, nom, role, password_hash, email_verifie_at, created_at) VALUES (?, ?, 'lecteur', ?, ?, ?)",
                             (f"lecteur{k}@charge.test", f"Lecteur {k}", hache, iso(m), iso(m)))
            for l in random.sample(livres, 3):
                cx.execute("INSERT INTO follows (user_id, book_id, created_at) VALUES (?, ?, ?)", (uid, l["id"], iso(m)))
            achete = None
            if k % 3 == 0:              # un lecteur sur trois a acheté un livre entier
                l = random.choice(payants)
                pid = cx.inserer("""INSERT INTO payments (user_id, objet, book_id, page_de, page_a, montant, etat, idempotency_key, prestataire, created_at, updated_at, confirme_le)
                                    VALUES (?, 'livre', ?, 1, NULL, 400, 'CONFIRMED', ?, 'charge', ?, ?, ?)""", (uid, l["id"], f"charge-{k}", iso(m), iso(m), iso(m)))
                cx.execute("INSERT INTO entitlements (user_id, book_id, page_de, page_a, payment_id, created_at) VALUES (?, ?, 1, NULL, ?, ?)", (uid, l["id"], pid, iso(m)))
                achete = l["slug"]
            lecteurs.append({"email": f"lecteur{k}@charge.test", "achete": achete})
        cx.valider()
    finally:
        cx.fermer()
    sortie = os.path.abspath(os.path.join(config.RACINE_BACKEND, "..", "tools", "k6", "env.json"))
    with open(sortie, "w") as f:
        json.dump({"base": a.base_url, "mdp": MDP, "lecteurs": lecteurs, "auteurs": auteurs,
                   "livres": [{k: v for k, v in l.items() if k != "id"} for l in livres]}, f)
    print(f"{a.auteurs} auteurs, {len(livres)} livres de {a.pages} pages, {a.lecteurs} lecteurs (+ démonstration). → {sortie}")


if __name__ == "__main__":
    main()
