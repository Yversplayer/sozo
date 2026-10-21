"""Communauté (lot C, 22/10/2026) : suivre un auteur, profils publics,
recherche d'auteurs, et les notifications qui relient les gens.

Ce qu'un profil montre est ce que la personne a déjà rendu PUBLIC : son nom,
sa ville et sa présentation, ses livres visibles, ses écrits publiés. Jamais
son adresse e-mail, jamais ce qu'elle lit ni ce qu'elle achète.
"""
from flask import g, jsonify, request

import acces
import db
import notifications
import security
import validation as v
from app import auditer, connectee


def _cle(uid):
    return f"u{uid}"


_A_PUBLIE = """(EXISTS (SELECT 1 FROM ecrits e WHERE e.user_id = u.id AND e.statut = 'publie' AND e.publie_le <= ?
                         AND e.corbeille_le IS NULL AND e.retire_le IS NULL AND e.efface_le IS NULL)
            OR EXISTS (SELECT 1 FROM books b WHERE b.owner_id = u.id AND b.statut = 'actif' AND b.cache_le IS NULL
                       AND b.corbeille_le IS NULL
                       AND EXISTS (SELECT 1 FROM pages p WHERE p.book_id = b.id AND p.n > 0 AND p.statut <> 'draft')))"""


def _public(cx, uid):
    """La personne, si elle est active ET a publié quelque chose (un écrit paru,
    un livre visible) — ou s'il s'agit de soi. Sans cette condition, essayer les
    numéros un à un listait le nom et la ville de lecteurs qui n'ont jamais rien
    rendu public (relevé par la relecture de sécurité du 22/10/2026)."""
    if uid == g.user["id"]:
        return cx.un("SELECT id, nom, ville, bio, created_at FROM users WHERE id = ? AND actif = 1", (uid,))
    return cx.un(f"SELECT u.id, u.nom, u.ville, u.bio, u.created_at FROM users u WHERE u.id = ? AND u.actif = 1 AND {_A_PUBLIE}",
                 (uid, acces.maintenant()))


def _livres_visibles(cx, uid):
    return [b for b in cx.tous("""SELECT b.slug, b.titre FROM books b WHERE b.owner_id = ? AND b.statut = 'actif'
                                    AND b.cache_le IS NULL AND b.corbeille_le IS NULL
                                    AND EXISTS (SELECT 1 FROM pages p WHERE p.book_id = b.id AND p.n > 0 AND p.statut <> 'draft'
                                                AND (p.publie_le IS NULL OR p.publie_le <= ?))
                                  ORDER BY b.id""", (uid, acces.maintenant()))]


def annoncer_ecrit(cx, e):
    """Prévient ceux qui suivent l'auteur, une seule fois par écrit (réservation
    atomique de annonce_le, comme les parutions de pages). Rend le nombre de
    personnes prévenues. Ne fait rien pour un écrit pas encore paru."""
    m = acces.maintenant()
    if e["statut"] != "publie" or not e["publie_le"] or e["publie_le"] > m or e["corbeille_le"] or e["retire_le"]:
        return 0
    if cx.execute("UPDATE ecrits SET annonce_le = ? WHERE id = ? AND annonce_le IS NULL", (m, e["id"])).rowcount != 1:
        return 0
    auteur = cx.un("SELECT nom FROM users WHERE id = ?", (e["user_id"],))
    import ecrits as _e
    quoi = _e.NATURES.get(e["nature"], "écrit").lower()
    n = 0
    for f in cx.tous("SELECT user_id FROM abonnements WHERE auteur_id = ?", (e["user_id"],)):
        if notifications.emettre(cx, f["user_id"], "abonnements", f"{auteur['nom']} a publié",
                                 (f"« {e['titre']} »" if e["titre"] else f"Un nouveau {quoi}") + " vous attend.",
                                 f"/app/ecrit.html?id={e['id']}", f"ecrit:{e['id']}"):
            n += 1
    return n


def enregistrer(app):

    @app.get("/api/profils/<int:uid>")
    @connectee
    def profil(uid):
        cx = db.connecter()
        try:
            u = _public(cx, uid)
            if not u:
                return jsonify(erreur="Introuvable."), 404
            m = acces.maintenant()
            nb_ecrits = cx.un("""SELECT COUNT(*) AS n FROM ecrits WHERE user_id = ? AND statut = 'publie' AND publie_le <= ?
                                  AND corbeille_le IS NULL AND retire_le IS NULL AND efface_le IS NULL""", (uid, m))["n"]
            livres = _livres_visibles(cx, uid)
            moi = g.user["id"]
            return jsonify(profil={
                "id": _cle(uid), "nom": u["nom"], "ville": u["ville"], "bio": u["bio"], "depuis": u["created_at"],
                "livres": [{"id": b["slug"], "titre": b["titre"]} for b in livres], "ecrits": nb_ecrits,
                "abonnes": cx.un("SELECT COUNT(*) AS n FROM abonnements WHERE auteur_id = ?", (uid,))["n"],
                "moi": {"soi": uid == moi, "abonne": bool(cx.un("SELECT 1 AS x FROM abonnements WHERE user_id = ? AND auteur_id = ?", (moi, uid)))},
            })
        finally:
            cx.fermer()

    def _abonner(uid, oui):
        cx = db.connecter()
        try:
            moi = g.user["id"]
            if uid == moi:
                raise v.Invalide("On ne se suit pas soi-même.")
            u = _public(cx, uid)
            if not u:
                return jsonify(erreur="Introuvable."), 404
            if security.depasse(cx, "geste:compte", str(moi)):
                cx.valider()
                return jsonify(erreur="Trop de gestes en peu de temps. Réessayez dans quelques minutes."), 429
            existe = cx.un("SELECT 1 AS x FROM abonnements WHERE user_id = ? AND auteur_id = ?", (moi, uid))
            if oui and not existe:
                cx.execute("INSERT INTO abonnements (user_id, auteur_id, created_at) VALUES (?, ?, ?)", (moi, uid, acces.maintenant()))
                notifications.emettre(cx, uid, "communaute", "Un nouvel abonné", f"{g.user['nom']} suit désormais vos écrits.",
                                      f"/app/auteur.html?id={_cle(moi)}", f"abonne:{moi}")
                auditer("abonnement", ressource=f"user:{uid}", cx=cx)
            elif not oui and existe:
                cx.execute("DELETE FROM abonnements WHERE user_id = ? AND auteur_id = ?", (moi, uid))
            cx.valider()
            n = cx.un("SELECT COUNT(*) AS n FROM abonnements WHERE auteur_id = ?", (uid,))["n"]
            return jsonify(ok=True, abonne=oui, abonnes=n)
        finally:
            cx.fermer()

    @app.post("/api/profils/<int:uid>/abonnement")
    @connectee
    def s_abonner(uid):
        return _abonner(uid, True)

    @app.delete("/api/profils/<int:uid>/abonnement")
    @connectee
    def se_desabonner(uid):
        return _abonner(uid, False)

    @app.get("/api/abonnements")
    @connectee
    def mes_abonnements():
        cx = db.connecter()
        try:
            lignes = cx.tous("""SELECT u.id, u.nom, u.ville FROM abonnements a JOIN users u ON u.id = a.auteur_id
                                 WHERE a.user_id = ? AND u.actif = 1 ORDER BY a.created_at DESC LIMIT 500""", (g.user["id"],))
            return jsonify(auteurs=[{"id": _cle(x["id"]), "nom": x["nom"], "ville": x["ville"]} for x in lignes])
        finally:
            cx.fermer()

    @app.get("/api/profils")
    @connectee
    def chercher_profils():
        """Recherche d'auteurs par leur nom : seulement des personnes qui ont
        publié quelque chose (un livre visible ou un écrit paru)."""
        q = (request.args.get("q") or "").strip()
        if len(q) < 2 or len(q) > 60:
            raise v.Invalide("Tapez au moins deux lettres.", "q")
        motif = "%" + q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        cx = db.connecter()
        try:
            m = acces.maintenant()
            lignes = cx.tous(f"""SELECT u.id, u.nom, u.ville FROM users u WHERE u.actif = 1 AND LOWER(u.nom) LIKE ? ESCAPE '\\'
                                   AND {_A_PUBLIE} ORDER BY u.nom LIMIT 20""", (motif, m))
            return jsonify(auteurs=[{"id": _cle(x["id"]), "nom": x["nom"], "ville": x["ville"]} for x in lignes])
        finally:
            cx.fermer()
