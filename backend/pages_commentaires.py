"""Commenter une page de livre, à la manière d'un webtoon (22/10/2026,
demande du propriétaire : « les gens voient, ils peuvent commenter »).

Règles tenues par le SERVEUR, les mêmes que pour les écrits :
* on ne lit et n'écrit les commentaires que d'une page que l'on peut LIRE
  (gratuite, achetée, offerte, ou la sienne) : une page payante non achetée
  ne laisse rien voir de ce qu'on en dit ;
* commenter est public : la charte de la communauté est exigée ;
* un commentaire se retire par celui qui l'a écrit, ou par l'auteur du livre ;
  il reste en base, daté, avec qui l'a retiré ;
* l'auteur du livre est prévenu (connexion globale : c'est chez lui qu'on écrit).
"""
from flask import g, jsonify, request

import acces
import charte
import db
import envois
import notifications
import security
import validation as v
from app import auditer, connectee


def _page(cx, slug, n):
    """(livre, page, état) d'une page LISIBLE ; sinon la réponse de refus."""
    b0 = cx.un("SELECT id FROM books WHERE slug = ?", (slug,))
    b, p, e = acces.page_et_etat(cx, g.user, b0["id"] if b0 else None, n)
    if e is None:
        return None, (jsonify(erreur="Introuvable."), 404)
    if e not in acces.LISIBLES:
        return None, (jsonify(erreur="Cette page n’est pas lisible pour vous."), 403)
    return (b, p), None


def enregistrer(app):

    @app.get("/api/livres/<livre>/pages/<int:n>/commentaires")
    @connectee
    def page_commentaires(livre, n):
        cx = db.connecter()
        try:
            ok, refus = _page(cx, livre, n)
            if refus:
                return refus
            b, _ = ok
            moi = g.user["id"]
            lignes = cx.tous("""SELECT c.id, c.texte, c.created_at, c.user_id, u.nom FROM pages_commentaires c JOIN users u ON u.id = c.user_id
                                 WHERE c.book_id = ? AND c.n = ? AND c.retire_le IS NULL AND u.actif = 1 ORDER BY c.id LIMIT 300""", (b["id"], n))
            return jsonify(commentaires=[{"id": c["id"], "texte": c["texte"], "le": c["created_at"], "auteur": {"id": f"u{c['user_id']}", "nom": c["nom"]},
                                          "peut_retirer": c["user_id"] == moi or b["owner_id"] == moi} for c in lignes])
        finally:
            cx.fermer()

    @app.post("/api/livres/<livre>/pages/<int:n>/commentaires")
    @connectee
    def page_commenter(livre, n):
        texte = v.texte(v.corps_json(request), "texte", mini=1, maxi=1000, multiligne=True).strip()
        if not texte:
            raise v.Invalide("Le commentaire est vide.", "texte")
        cx = db.connecter()
        try:
            ok, refus = _page(cx, livre, n)
            if refus:
                return refus
            b, _ = ok
            if not charte.acceptee(cx, g.user["id"]):
                return charte.refus()
            if security.depasse(cx, "commentaire:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Beaucoup de commentaires en peu de temps : réessayez dans une heure."), 429
            m = acces.maintenant()
            cid = cx.inserer("INSERT INTO pages_commentaires (book_id, n, user_id, texte, created_at) VALUES (?, ?, ?, ?, ?)",
                             (b["id"], n, g.user["id"], texte, m))
            auditer("page.commentaire", ressource=f"book:{b['id']}:{n}", apres=f"pages_commentaires:{cid}", cx=cx)
            cx.valider()
            if b["owner_id"] != g.user["id"]:
                notifications.emettre_chez_autrui(b["owner_id"], "communaute", f"{g.user['nom']} vous a laissé un mot (page {n})",
                                                  texte[:120], f"/app/lire.html?id={livre}&p={n}", f"page-commentaire:{cid}")
                envois.declencher()
            return jsonify(commentaire={"id": cid, "texte": texte, "le": m, "auteur": {"id": f"u{g.user['id']}", "nom": g.user["nom"]}, "peut_retirer": True}), 201
        finally:
            cx.fermer()

    @app.delete("/api/pages-commentaires/<int:cid>")
    @connectee
    def page_commentaire_retirer(cid):
        cx = db.connecter()
        try:
            c = cx.un("""SELECT c.id, c.user_id, b.owner_id FROM pages_commentaires c JOIN books b ON b.id = c.book_id
                          WHERE c.id = ? AND c.retire_le IS NULL""", (cid,))
            moi = g.user["id"]
            if not c or moi not in (c["user_id"], c["owner_id"]):
                return jsonify(erreur="Introuvable."), 404
            cx.execute("UPDATE pages_commentaires SET retire_le = ?, retire_par = ? WHERE id = ?",
                       (acces.maintenant(), "commentateur" if c["user_id"] == moi else "auteur", cid))
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()
