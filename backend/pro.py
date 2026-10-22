"""Passer Pro — devenir auteur (22/10/2026, décision du propriétaire après le
conseil du 21/10).

On s'inscrit LECTEUR, sans question. On lit, on aime, on commente, on publie
des écrits courts : tout cela reste gratuit, pour toujours. Écrire des LIVRES
et les vendre, c'est « Plume » : trois offres, choisies quand on le veut.

Règles tenues par le SERVEUR (l'écran ne fait que les montrer) :
* sans Pro : UN livre à la fois, gratuit seulement — l'avant-goût offert ;
  deux relectures par l'IA et un import de manuscrit, une fois pour toutes ;
* avec Pro : autant de livres que l'offre le permet, vente, corrections des
  pages parues, commission selon l'offre ;
* ce qui existe ne casse jamais : un livre déjà en vente reste en vente, un
  livre au-delà du plafond reste en ligne ; seul ce qui est NOUVEAU est borné.
* Plume d'avant (abonnement à 4,99 $, cadeaux « Plume ») vaut « Plume d'or ».

Refus : 403 avec code « pro_requis » — l'écran l'annonce par une petite note
dans un coin, jamais par un écran entier.
"""
from flask import jsonify

import acces

# Prix en centimes de dollar, pour 30 jours. L'année = 10 mois (deux offerts) :
# c'est aussi UNE vérification Mobile Money par an au lieu de douze.
OFFRES = {
    "plume": {"nom": "Plume", "pour": "Vos premiers livres", "mois": 200, "livres": 3, "commission": 15, "rang": 1},
    "plume_or": {"nom": "Plume d’or", "pour": "L’auteur qui publie régulièrement", "mois": 500, "livres": 10, "commission": 10, "rang": 2},
    "scriptorium": {"nom": "Scriptorium", "pour": "Une église, un ministère, une maison d’édition", "mois": 1500, "livres": None, "commission": 8, "rang": 3},
}
DUREES = {"mois": (30, 1), "annee": (365, 10)}          # (jours, nombre de mois facturés)
ANCIENNE = "plume_or"           # Plume d'avant le 22/10/2026 (4,99 $ / 30 j)
COMMISSION_SANS_PRO = 15
ESSAIS = {"livres": 1, "ia": 2, "import": 1}


def prix(offre, duree):
    jours, mois = DUREES[duree]
    return OFFRES[offre]["mois"] * mois, jours


def _actives(cx, user_id, a):
    """(offre, fin) de chaque abonnement ou cadeau Plume en cours."""
    out = []
    for r in cx.tous("SELECT offre, fin FROM subscriptions WHERE user_id = ? AND revoque_le IS NULL AND debut <= ? AND fin > ?", (user_id, a, a)):
        out.append((r["offre"] or ANCIENNE, r["fin"]))
    for r in cx.tous("SELECT offre, fin FROM dons WHERE user_id = ? AND objet = 'plume' AND revoque_le IS NULL AND debut <= ? AND fin > ?", (user_id, a, a)):
        out.append((r["offre"] or ANCIENNE, r["fin"]))
    return [(o, f) for o, f in out if o in OFFRES]


def etat(cx, user_id, a=None):
    """Ce que la personne peut faire : son offre (la plus haute en cours), ses
    plafonds, ses essais restants. Calculé à chaque appel, jamais stocké."""
    a = a or acces.maintenant()
    actives = _actives(cx, user_id, a)
    if actives:
        offre = max(actives, key=lambda x: OFFRES[x[0]]["rang"])[0]
        fin = max(f for o, f in actives if o == offre)
        o = OFFRES[offre]
        return {"pro": True, "offre": offre, "nom": o["nom"], "fin": fin, "livres_max": o["livres"], "commission": o["commission"], "essais": None}
    ia = cx.un("SELECT COALESCE(SUM(n), 0) AS n FROM ia_usages WHERE user_id = ?", (user_id,))["n"]
    imp = cx.un("SELECT COUNT(*) AS n FROM imports WHERE user_id = ?", (user_id,))["n"]
    return {"pro": False, "offre": None, "nom": None, "fin": None, "livres_max": ESSAIS["livres"], "commission": COMMISSION_SANS_PRO,
            "essais": {"ia": max(0, ESSAIS["ia"] - ia), "import": max(0, ESSAIS["import"] - imp)}}


def commission(cx, auteur_id, a=None):
    return etat(cx, auteur_id, a)["commission"]


def nb_livres(cx, user_id):
    """Les livres qui comptent dans le plafond : ceux qui existent encore (la
    corbeille compte : on ne contourne pas le plafond en jetant)."""
    return cx.un("SELECT COUNT(*) AS n FROM books WHERE owner_id = ?", (user_id,))["n"]


def refus(message):
    return jsonify(erreur=message, code="pro_requis"), 403


def peut_creer_livre(cx, user_id, payant):
    """None si c'est permis ; sinon la réponse de refus."""
    e = etat(cx, user_id)
    if payant and not e["pro"]:
        return refus("Vendre un livre fait partie de Plume. Votre premier livre peut être gratuit, sans abonnement.")
    if e["livres_max"] is not None and nb_livres(cx, user_id) >= e["livres_max"]:
        if not e["pro"]:
            return refus("Votre livre offert est déjà commencé. Pour en écrire d’autres, passez à Plume.")
        return refus(f"Votre offre {e['nom']} permet {e['livres_max']} livres. Une offre plus grande vous en ouvre davantage.")
    return None


def vue(cx, user_id):
    """Pour l'écran : l'état, et les offres avec leurs prix (affichés seulement
    si la personne ouvre elle-même la fenêtre Plume)."""
    e = etat(cx, user_id)
    offres = []
    for k, o in OFFRES.items():
        pm, _ = prix(k, "mois")
        pa, _ = prix(k, "annee")
        offres.append({"id": k, "nom": o["nom"], "pour": o["pour"], "livres": o["livres"], "commission": o["commission"],
                       "mois": pm / 100, "annee": pa / 100})
    return {**e, "offres": offres, "livres": nb_livres(cx, user_id)}


def enregistrer(app):
    from flask import g
    import db
    from app import connectee

    @app.get("/api/moi/pro")
    @connectee
    def moi_pro():
        cx = db.connecter()
        try:
            return jsonify(pro=vue(cx, g.user["id"]))
        finally:
            cx.fermer()
