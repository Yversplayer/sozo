"""Lot D (21/10/2026) : la Bible et la liseuse, en plus riche.

* Bible : chercher un mot dans TOUTE la Bible (côté serveur : la Bible entière
  pèse 4,4 Mo, trop pour un téléphone en 3G), un verset du jour, des versets
  gardés (synchronisés d'un appareil à l'autre).
* Liseuse : chercher dans un livre — SEULEMENT dans les pages que la personne a
  le droit de lire (acces.etat_page) : une page payante non achetée ne laisse
  jamais fuir un mot, pas même un numéro de page où un mot apparaîtrait ;
  des marque-pages (seulement sur une page lisible).
"""
import json
import os
import threading
import unicodedata
from datetime import datetime, timedelta, timezone

from flask import g, jsonify, request

import acces
import config
import db
import security
import validation as v
from app import connectee

_BIBLE = None
_verrou = threading.Lock()


def _bible():
    """[(b, c, v, texte)], chargé une fois par processus depuis app/bible/NN.json."""
    global _BIBLE
    with _verrou:
        if _BIBLE is None:
            out = []
            d = os.path.join(config.RACINE_SITE, "app", "bible")
            for b in range(1, 67):
                p = os.path.join(d, f"{b:02d}.json")
                if not os.path.isfile(p):
                    continue
                with open(p, encoding="utf-8") as h:
                    for c, versets in enumerate(json.load(h), start=1):
                        for n, t in enumerate(versets, start=1):
                            out.append((b, c, n, t))
            _BIBLE = out
    return _BIBLE


def plier(t):
    """Sans accents ni casse : « eternel » trouve « Éternel »."""
    return "".join(ch for ch in unicodedata.normalize("NFD", str(t).lower()) if unicodedata.category(ch) != "Mn")


_PLIEE = None


def _bible_pliee():
    global _PLIEE
    if _PLIEE is None:
        _PLIEE = [plier(t) for (_, _, _, t) in _bible()]
    return _PLIEE


# Versets du jour : un choix fixe, le même pour tous le même jour (heure de Kinshasa)
JOUR = [(19, 23, 1), (23, 40, 31), (43, 14, 27), (50, 4, 13), (19, 46, 2), (45, 8, 28), (40, 11, 28), (19, 121, 1), (24, 29, 11),
        (46, 13, 4), (19, 37, 5), (23, 41, 10), (43, 1, 5), (19, 139, 14), (33, 6, 8), (19, 119, 105), (20, 3, 5), (43, 3, 16),
        (45, 12, 12), (50, 4, 6), (58, 11, 1), (62, 4, 8), (19, 34, 9), (23, 43, 2), (40, 5, 9), (48, 6, 9), (19, 90, 12),
        (25, 3, 23), (43, 15, 5), (19, 27, 1), (47, 12, 9), (51, 3, 14), (60, 5, 7), (19, 16, 11), (23, 26, 3), (40, 6, 34)]


def verset_du_jour():
    auj = datetime.now(timezone(timedelta(hours=1))).date()
    b, c, n = JOUR[auj.toordinal() % len(JOUR)]
    for (bb, cc, vv, t) in _bible():
        if (bb, cc, vv) == (b, c, n):
            return {"b": b, "c": c, "v": n, "t": t, "jour": auj.isoformat()}
    return None


def enregistrer(app):

    @app.get("/api/bible/recherche")
    @connectee
    def bible_recherche():
        q = (request.args.get("q") or "").strip()
        if len(q) < 3 or len(q) > 80:
            raise v.Invalide("Tapez au moins trois lettres.", "q")
        livre = request.args.get("livre", type=int)
        mots = plier(q).split()
        bible, pliee = _bible(), _bible_pliee()
        trouves, total = [], 0
        for i, t in enumerate(pliee):
            if livre and bible[i][0] != livre:
                continue
            if all(m in t for m in mots):
                total += 1
                if len(trouves) < 100:
                    b, c, n, texte = bible[i]
                    trouves.append({"b": b, "c": c, "v": n, "t": texte})
        return jsonify(versets=trouves, total=total)

    @app.get("/api/bible/jour")
    @connectee
    def bible_jour():
        return jsonify(verset=verset_du_jour())

    # ── versets gardés ─────────────────────────────────────────────────────
    @app.get("/api/versets")
    @connectee
    def versets_lire():
        cx = db.connecter()
        try:
            lignes = cx.tous("SELECT id, b, c, v1, v2, created_at FROM versets WHERE user_id = ? ORDER BY id DESC LIMIT 1000", (g.user["id"],))
            index = {(b, c, n): t for (b, c, n, t) in _bible()}
            return jsonify(versets=[{**x, "t": " ".join(index.get((x["b"], x["c"], n), "") for n in range(x["v1"], x["v2"] + 1)).strip()} for x in lignes])
        finally:
            cx.fermer()

    @app.post("/api/versets")
    @connectee
    def verset_garder():
        d = v.corps_json(request)
        b = v.entier(d, "b", mini=1, maxi=66)
        c = v.entier(d, "c", mini=1, maxi=150)
        v1 = v.entier(d, "v1", mini=1, maxi=176)
        v2 = v.entier(d, "v2", mini=v1, maxi=176, requis=False) or v1
        # le passage doit EXISTER : on ne garde pas une référence inventée
        if not any((bb, cc, vv) == (b, c, v1) for (bb, cc, vv, _) in _bible()):
            raise v.Invalide("Ce verset n'existe pas.", "v1")
        cx = db.connecter()
        try:
            if cx.un("SELECT COUNT(*) AS n FROM versets WHERE user_id = ?", (g.user["id"],))["n"] >= 1000:
                raise v.Invalide("Vous gardez déjà 1 000 versets : retirez-en quelques-uns.")
            ex = cx.un("SELECT id FROM versets WHERE user_id = ? AND b = ? AND c = ? AND v1 = ? AND v2 = ?", (g.user["id"], b, c, v1, v2))
            vid = ex["id"] if ex else cx.inserer("INSERT INTO versets (user_id, b, c, v1, v2, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                                                 (g.user["id"], b, c, v1, v2, acces.maintenant()))
            cx.valider()
            return jsonify(ok=True, id=vid), 201
        finally:
            cx.fermer()

    @app.delete("/api/versets/<int:vid>")
    @connectee
    def verset_retirer(vid):
        cx = db.connecter()
        try:
            if cx.execute("DELETE FROM versets WHERE id = ? AND user_id = ?", (vid, g.user["id"])).rowcount != 1:
                return jsonify(erreur="Introuvable."), 404
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    # ── liseuse : chercher dans un livre, marque-pages ─────────────────────
    @app.get("/api/livres/<livre>/recherche")
    @connectee
    def livre_recherche(livre):
        import texte
        q = (request.args.get("q") or "").strip()
        if len(q) < 2 or len(q) > 80:
            raise v.Invalide("Tapez au moins deux lettres.", "q")
        cx = db.connecter()
        try:
            b0 = cx.un("SELECT id FROM books WHERE slug = ?", (livre,))
            b = b0 and acces.livre(cx, g.user, b0["id"])
            if not b:
                return jsonify(erreur="Introuvable."), 404
            # Même limite que la lecture page par page : une recherche lit des pages
            if security.depasse(cx, "lecture:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Trop de lectures en peu de temps. Réessayez dans quelques minutes."), 429
            plages = acces.droits(cx, g.user["id"], b["id"])
            m = acces.maintenant()
            mots = plier(q).split()
            out = []
            for p in cx.tous("SELECT * FROM pages WHERE book_id = ? AND n > 0 ORDER BY n", (b["id"],)):
                if acces.etat_page(b, p, g.user, plages, m) not in acces.LISIBLES:
                    continue                    # une page fermée ne dit rien, pas même qu'elle contient le mot
                lu = texte.nu(acces.contenu_courant(cx, p["id"])[0])
                pl = plier(lu)
                if all(x in pl for x in mots):
                    i = pl.find(mots[0])
                    out.append({"n": p["n"], "extrait": ("…" if i > 60 else "") + lu[max(0, i - 60):i + 100].replace("\n", " ") + "…"})
                    if len(out) >= 60:
                        break
            cx.valider()
            return jsonify(resultats=out)
        finally:
            cx.fermer()

    @app.get("/api/signets")
    @connectee
    def signets_lire():
        cx = db.connecter()
        try:
            q = """SELECT s.id, s.n, s.created_at, b.slug AS livre, b.titre FROM signets s JOIN books b ON b.id = s.book_id WHERE s.user_id = ?"""
            p = [g.user["id"]]
            if request.args.get("livre"):
                q += " AND b.slug = ?"
                p.append(request.args.get("livre"))
            return jsonify(signets=cx.tous(q + " ORDER BY s.id DESC LIMIT 500", p))
        finally:
            cx.fermer()

    @app.post("/api/signets")
    @connectee
    def signet_poser():
        """Un marque-page ne se pose que sur une page qu'on peut LIRE."""
        d = v.corps_json(request)
        slug = v.texte(d, "livre", maxi=80)
        n = v.entier(d, "n", mini=1, maxi=100000)
        cx = db.connecter()
        try:
            b0 = cx.un("SELECT id FROM books WHERE slug = ?", (slug,))
            b, p, e = acces.page_et_etat(cx, g.user, b0["id"] if b0 else None, n)
            if e is None:
                return jsonify(erreur="Introuvable."), 404
            if e not in acces.LISIBLES:
                return jsonify(erreur="Cette page n’est pas lisible pour vous."), 403
            ex = cx.un("SELECT id FROM signets WHERE user_id = ? AND book_id = ? AND n = ?", (g.user["id"], b["id"], n))
            sid = ex["id"] if ex else cx.inserer("INSERT INTO signets (user_id, book_id, n, created_at) VALUES (?, ?, ?, ?)",
                                                 (g.user["id"], b["id"], n, acces.maintenant()))
            cx.valider()
            return jsonify(ok=True, id=sid), 201
        finally:
            cx.fermer()

    @app.delete("/api/signets/<int:sid>")
    @connectee
    def signet_retirer(sid):
        cx = db.connecter()
        try:
            if cx.execute("DELETE FROM signets WHERE id = ? AND user_id = ?", (sid, g.user["id"])).rowcount != 1:
                return jsonify(erreur="Introuvable."), 404
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()
