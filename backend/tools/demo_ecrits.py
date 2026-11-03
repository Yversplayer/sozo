"""Charge des ÉCRITS courts pour que l'accueil ait des mots à montrer
(03/11/2026, le propriétaire : « incruste certains mots et des auteurs
inventés, ou même qui existent vraiment »).

    backend_venv/bin/python backend/tools/demo_ecrits.py                       # base locale
    backend_venv/bin/python backend/tools/demo_ecrits.py --en-ligne --projet <ref> [--port 6543]

Deux sortes de mots, chacune dite pour ce qu'elle est :
* des CITATIONS de croyants d'hier, toutes du domaine public (Augustin,
  Pascal, Thérèse de Lisieux…), publiées par le compte « Trésors de la foi »
  avec leur auteur réel sur la dernière ligne. Rien n'y est inventé : une
  citation douteuse n'entre pas ici ;
* des pensées et des prières courtes écrites pour l'occasion, signées par les
  auteurs INVENTÉS du catalogue d'exemple (demo = 1). L'écran les marque
  « Exemple », comme leurs livres.

Aucun « j'aime » ni commentaire n'est créé : les compteurs partent de zéro et
ne montrent que de vrais gestes.

Mêmes garde-fous que demo.py : une base distante est refusée sans
`--en-ligne` ; avec lui, l'adresse est collée au clavier et il faut taper
CITATIONS. Rejouable : un écrit déjà présent (même compte, même texte) n'est
pas recréé.
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.dirname(__file__))

import config  # noqa: E402
import db  # noqa: E402
import security  # noqa: E402

TRESORS = {"email": "tresors-de-la-foi@sozo.invalid", "nom": "Trésors de la foi",
           "bio": "Des paroles de croyants d'hier, choisies pour aujourd'hui. Toutes sont du domaine public."}

# (texte, auteur réel et source, thèmes, photo)
CITATIONS = [
    ("Tu nous as faits pour toi, Seigneur, et notre cœur est sans repos tant qu'il ne repose en toi.",
     "Augustin d'Hippone, Confessions", ["Foi", "Paix"], "foi-croix-ciel"),
    ("Le cœur a ses raisons que la raison ne connaît point.", "Blaise Pascal, Pensées", ["Foi", "Amour"], None),
    ("Pour moi, la prière, c'est un élan du cœur, c'est un simple regard jeté vers le Ciel, "
     "c'est un cri de reconnaissance et d'amour au sein de l'épreuve comme au sein de la joie.",
     "Thérèse de Lisieux, Histoire d'une âme", ["Louange", "Gratitude"], "foi-priere-lumiere"),
    ("Il faut avoir patience avec tout le monde, mais premièrement avec soi-même.", "François de Sales, Lettres", ["Paix", "Courage"], None),
    ("Aime, et fais ce que tu veux.", "Augustin d'Hippone, Commentaire de la première épître de Jean", ["Amour"], None),
    ("Console-toi, tu ne me chercherais pas si tu ne m'avais trouvé.", "Blaise Pascal, Le Mystère de Jésus", ["Espérance", "Foi"], "foi-bougie-nuit"),
    ("Je veux passer mon Ciel à faire du bien sur la terre.", "Thérèse de Lisieux, Derniers entretiens", ["Espérance", "Amour"], None),
    ("Au soir de cette vie, nous serons jugés sur l'amour.", "Jean de la Croix, Dits de lumière et d'amour", ["Amour", "Foi"], "foi-champ-dore"),
]

# (clé de l'auteur inventé dans demo.json, nature, texte, thèmes, photo)
PENSEES = [
    ("elie-mbuyi", "priere", "Le matin, avant le bruit du monde, je dépose ma journée entre tes mains. Tu la porteras mieux que moi.",
     ["Paix", "Foi"], "foi-soleil-mer"),
    ("ruth-kabasele", "pensee", "Dieu n'est pas pressé. Il a semé le cèdre, et il attend la forêt.", ["Espérance"], None),
    ("samuel-ndombe", "pensee", "J'ai cherché la lumière au bout du chemin ; elle marchait déjà à côté de moi.", ["Foi", "Espérance"], "foi-croix-lac"),
    ("grace-nzuzi", "priere", "Seigneur, apprends-moi à me taire assez longtemps pour t'entendre.", ["Paix"], None),
    ("naomi-tshala", "poeme", "Sur le fleuve lent\nune prière flotte,\nlégère comme une feuille.", ["Louange"], None),
    ("josue-kalala", "pensee", "La foi n'efface pas la nuit : elle y allume une lampe.", ["Épreuve", "Courage"], "foi-bougies"),
]


def _compte(cx, email, nom, bio, ville, photo, invente, m):
    u = cx.un("SELECT id FROM users WHERE email = ?", (email,))
    if u:
        return u["id"]
    # Mot de passe aléatoire jamais affiché, adresse en .invalid : personne ne s'y connecte
    return cx.inserer("""INSERT INTO users (email, nom, role, password_hash, email_verifie_at, created_at, bio, ville, photo, demo)
                         VALUES (?, ?, 'auteur', ?, ?, ?, ?, ?, ?, ?)""",
                      (email, nom, security.hacher_mot_de_passe(security.nouveau_jeton()), m, m, bio, ville, photo, 1 if invente else 0))


def _ecrit(cx, uid, nature, texte, themes, photo, m):
    if cx.un("SELECT id FROM ecrits WHERE user_id = ? AND texte = ?", (uid, texte)):
        return 0
    apparence = {"police": "cormorant", "alignement": "centre", **({"image": photo} if photo else {})}
    cx.inserer("""INSERT INTO ecrits (user_id, nature, titre, texte, apparence, themes, statut, publie_le, created_at, updated_at)
                  VALUES (?, ?, '', ?, ?, ?, 'publie', ?, ?, ?)""",
               (uid, nature, texte, json.dumps(apparence), json.dumps(themes, ensure_ascii=False), m, m, m))
    return 1


def main():
    args = sys.argv[1:]
    if "--en-ligne" in args:
        import demo                      # même préparation que demo.py, avec notre mot à taper
        demo._en_ligne(args, ("CITATIONS", f"{len(CITATIONS)} citations et {len(PENSEES)} pensées d'exemple vont entrer dans la base EN LIGNE."))
    elif config.base_distante():
        sys.exit("Refusé : base distante. Pour la base en ligne, utilisez --en-ligne --projet <ref>.")
    with open(os.path.join(os.path.dirname(__file__), "demo.json"), encoding="utf-8") as f:
        auteurs = json.load(f)["authors"]
    db.appliquer_schema()
    cx = db.connecter(globale=True)
    try:
        m = security._utc(security.maintenant())
        n = 0
        tresors = _compte(cx, TRESORS["email"], TRESORS["nom"], TRESORS["bio"], None, None, False, m)
        for texte, source, themes, photo in CITATIONS:
            n += _ecrit(cx, tresors, "pensee", f"{texte}\n— {source}", themes, photo, m)
        for cle, nature, texte, themes, photo in PENSEES:
            a = auteurs[cle]
            uid = _compte(cx, f"demo-{cle}@sozo.invalid", a["name"], a.get("bio"), a.get("city"), a.get("photo"), True, m)
            n += _ecrit(cx, uid, nature, texte, themes, photo, m)
        cx.valider()
        print(f"{n} écrit{'s' if n > 1 else ''} ajouté{'s' if n > 1 else ''} ({len(CITATIONS)} citations, {len(PENSEES)} pensées d'exemple en tout).")
    finally:
        cx.fermer()


if __name__ == "__main__":
    main()
