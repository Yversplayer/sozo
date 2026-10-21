"""Avis sur les livres (backlog, 21/10/2026, demandé par le propriétaire).

Une note de 1 à 5 et, si l'on veut, quelques lignes. Règles tenues par le SERVEUR :
* un avis par personne et par livre (UNIQUE) : le redonner le remplace ;
* seulement sur un livre dont la personne peut LIRE au moins une page — on ne
  note pas un livre qu'on n'a pas pu ouvrir ; jamais sur son propre livre ;
* un avis est public : la charte de la communauté est exigée (charte.py) ;
* la modération retire sans détruire ; rétablir ne rend que ce qu'elle a retiré.
  La moyenne ne compte que les avis visibles.
* Aucun avis inventé : la fiche n'affiche que ceux qui existent.
"""
from flask import g, jsonify, request

import acces
import charte
import db
import notifications
import security
import validation as v
from app import auditer, connectee


def _lisible_par_moi(cx, b):
    """Au moins une page que la personne peut lire (gratuite, achetée, offerte)."""
    plages, m = acces.droits(cx, g.user["id"], b["id"]), acces.maintenant()
    return any(acces.etat_page(b, p, g.user, plages, m) in ("free", "owned")
               for p in cx.tous("SELECT * FROM pages WHERE book_id = ? AND n > 0 ORDER BY n", (b["id"],)))


def _livre(cx, slug):
    b0 = cx.un("SELECT id FROM books WHERE slug = ?", (slug,))
    return acces.livre(cx, g.user, b0["id"] if b0 else None)


def resume(cx, book_id):
    """Moyenne et nombre des avis VISIBLES. Ces lignes sont celles des lecteurs :
    sous PostgreSQL la RLS laisse lire les avis visibles à tous (lecture), donc
    la connexion de la personne suffit."""
    r = cx.un("SELECT COUNT(*) AS n, AVG(note) AS m FROM avis WHERE book_id = ? AND retire_le IS NULL", (book_id,))
    return {"nombre": r["n"], "moyenne": round(float(r["m"]), 1) if r["n"] else None}


def enregistrer(app):

    @app.get("/api/livres/<livre>/avis")
    @connectee
    def avis_lire(livre):
        cx = db.connecter()
        try:
            b = _livre(cx, livre)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            lignes = cx.tous("""SELECT a.id, a.user_id, a.note, a.texte, a.created_at, a.modifie_le, u.nom FROM avis a
                                  JOIN users u ON u.id = a.user_id
                                 WHERE a.book_id = ? AND a.retire_le IS NULL AND u.actif = 1 ORDER BY a.id DESC LIMIT 200""", (b["id"],))
            moi = g.user["id"]
            mien = cx.un("SELECT id, note, texte, retire_le FROM avis WHERE book_id = ? AND user_id = ?", (b["id"], moi))
            return jsonify(resume=resume(cx, b["id"]),
                           avis=[{"id": a["id"], "note": a["note"], "texte": a["texte"], "le": a["modifie_le"] or a["created_at"],
                                  "auteur": {"id": f"u{a['user_id']}", "nom": a["nom"]}, "mien": a["user_id"] == moi} for a in lignes],
                           mien=mien,
                           peut=b["owner_id"] != moi and _lisible_par_moi(cx, b))
        finally:
            cx.fermer()

    @app.put("/api/livres/<livre>/avis")
    @connectee
    def avis_donner(livre):
        d = v.corps_json(request)
        note = v.entier(d, "note", mini=1, maxi=5)
        texte = (v.texte(d, "texte", requis=False, maxi=1000, multiligne=True) or "").strip()
        cx = db.connecter()
        try:
            b = _livre(cx, livre)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            if b["owner_id"] == g.user["id"]:
                return jsonify(erreur="On ne note pas son propre livre."), 403
            if not _lisible_par_moi(cx, b):
                return jsonify(erreur="Lisez au moins une page de ce livre avant de donner votre avis."), 403
            if not charte.acceptee(cx, g.user["id"]):
                return charte.refus()
            ex = cx.un("SELECT id, retire_le FROM avis WHERE book_id = ? AND user_id = ?", (b["id"], g.user["id"]))
            if ex and ex["retire_le"]:
                return jsonify(erreur="Votre avis a été retiré par la modération."), 409
            if security.depasse(cx, "geste:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Trop de gestes en peu de temps. Réessayez dans quelques minutes."), 429
            m = acces.maintenant()
            if ex:
                cx.execute("UPDATE avis SET note = ?, texte = ?, modifie_le = ? WHERE id = ?", (note, texte, m, ex["id"]))
                aid = ex["id"]
            else:
                aid = cx.inserer("INSERT INTO avis (user_id, book_id, note, texte, created_at) VALUES (?, ?, ?, ?, ?)",
                                 (g.user["id"], b["id"], note, texte, m))
            auditer("avis", ressource=f"book:{b['id']}", apres=f"avis:{aid} note:{note}", cx=cx)
            cx.valider()
            if not ex:
                # chez l'auteur : connexion globale, après validation (notifications.emettre_chez_autrui)
                notifications.emettre_chez_autrui(b["owner_id"], "communaute", f"Nouvel avis sur « {b['titre']} »",
                                                  f"{g.user['nom']} : {'★' * note}{'☆' * (5 - note)}", f"/app/livre.html?id={livre}#avis", f"avis:{aid}")
            return jsonify(ok=True, id=aid, resume=resume(cx, b["id"]))
        finally:
            cx.fermer()

    @app.delete("/api/livres/<livre>/avis")
    @connectee
    def avis_retirer(livre):
        cx = db.connecter()
        try:
            b = _livre(cx, livre)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            if cx.execute("DELETE FROM avis WHERE book_id = ? AND user_id = ? AND retire_le IS NULL", (b["id"], g.user["id"])).rowcount != 1:
                return jsonify(erreur="Introuvable."), 404
            cx.valider()
            return jsonify(ok=True, resume=resume(cx, b["id"]))
        finally:
            cx.fermer()


def enregistrer_admin(app, admin_requis, role_requis, trace):

    @app.get("/api/admin/avis")
    @admin_requis
    def admin_avis():
        retires = request.args.get("retires") == "1"
        cx = db.connecter()
        try:
            return jsonify(lignes=cx.tous(f"""SELECT a.id, a.note, a.texte, a.created_at, a.retire_le, b.titre, b.slug, u.nom AS auteur
                                                FROM avis a JOIN books b ON b.id = a.book_id JOIN users u ON u.id = a.user_id
                                               WHERE a.retire_le IS {'NOT ' if retires else ''}NULL ORDER BY a.id DESC LIMIT 100"""))
        finally:
            cx.fermer()

    @app.post("/api/admin/avis/<int:aid>/<action>")
    @admin_requis
    @role_requis("moderation")
    def moderer_avis(aid, action):
        if action not in ("retirer", "retablir"):
            return jsonify(erreur="Introuvable."), 404
        motif = v.texte(v.corps_json(request), "motif", mini=3, maxi=300) if action == "retirer" else None
        cx = db.connecter()
        try:
            m = acces.maintenant()
            if action == "retirer":
                cur = cx.execute("UPDATE avis SET retire_le = ? WHERE id = ? AND retire_le IS NULL", (m, aid))
            else:
                cur = cx.execute("UPDATE avis SET retire_le = NULL WHERE id = ? AND retire_le IS NOT NULL", (aid,))
            if cur.rowcount != 1:
                return jsonify(erreur="Déjà fait (ou introuvable)."), 409
            trace("avis." + action, f"avis:{aid}", motif or "rétabli", cx)
            a = cx.un("SELECT user_id FROM avis WHERE id = ?", (aid,))
            notifications.emettre(cx, a["user_id"], "moderation", "Avis retiré par la modération" if action == "retirer" else "Avis rétabli",
                                  f"Motif : {motif}" if action == "retirer" else "Votre avis est de nouveau visible.",
                                  "/app/suivis.html", f"moderation:avis:{aid}:{action}:{m}")
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()
