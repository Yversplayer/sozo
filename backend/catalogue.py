"""Routes du lecteur : catalogue, contenu des pages, suivis, progression,
signalements, compte. Toute décision d'accès passe par `acces`."""
from flask import g, jsonify, request

import acces
import argent
import config
import db
import security
import validation as v
from app import auditer, connectee


def _auteur_cle(uid):
    return f"u{uid}"


def _dollars(c):
    return None if c is None else c / 100


def serialiser_livre(cx, b, user, plages=None, a=None, toutes_pages=None, chapitres=None):
    """Le livre tel que le voit CETTE personne : les brouillons d'autrui
    n'apparaissent pas, l'état de chaque page est calculé par acces.
    `toutes_pages` / `chapitres` : déjà lus en lot par le catalogue (sinon,
    deux requêtes PAR livre : 2 000 livres = 4 000 allers-retours)."""
    if plages is None:
        plages = acces.droits(cx, user["id"] if user else None, b["id"])
    if toutes_pages is None:
        toutes_pages = cx.tous("SELECT * FROM pages WHERE book_id = ? ORDER BY n", (b["id"],))
    if chapitres is None:
        chapitres = cx.tous("SELECT titre, page_de, page_a FROM chapters WHERE book_id = ? ORDER BY page_de", (b["id"],))
    pages = []
    for p in toutes_pages:
        e = acces.etat_page(b, p, user, plages, a)
        if e is None:
            continue
        pages.append({"n": p["n"], "access": p["acces"], "status": acces.statut_effectif(p, a),
                      "date": p["publie_le"], "source": p["source"], "etat": e})
    return {
        "id": b["slug"], "title": b["titre"], "author": _auteur_cle(b["owner_id"]), "cat": b["categorie"],
        "cover": {"img": b["couverture"], "style": b["style"]}, "mode": b["mode"], "access": b["acces"],
        "format": "planche" if b["format"] == "planche" else None, "verse": b["format"] == "vers",
        "desc": b["description"], "demo": bool(b["demo"]), "owner": bool(user and b["owner_id"] == user["id"]),
        "price": None if b["acces"] == "free" else {"page": _dollars(b["prix_page"]), "chapter": _dollars(b["prix_chapitre"]), "all": _dollars(b["prix_livre"])},
        "chapters": [{"t": c["titre"], "from": c["page_de"], "to": c["page_a"]}
                     for c in chapitres],
        "pages": pages,
    }


# ── Vitrine publique en cache court ────────────────────────────────────────
# Mesuré au test de charge du 16/10/2026 : CHAQUE page de l'application
# recharge le catalogue, et ~40 ms par appel partaient en requêtes identiques
# pour tout le monde. On garde 15 s ce qui est PUBLIC et identique pour tous
# (livres actifs ayant au moins une page sortie, leurs pages et chapitres,
# leurs auteurs). Ce qui dépend de la personne reste calculé à chaque appel :
# ses droits, ses propres livres (brouillons compris), l'état de chaque page.
# Le texte des pages n'est jamais ici, et la lecture d'une page (servie par
# /api/livres/…/pages/…) ne passe pas par ce cache : retirer un livre ou
# fermer une page prend effet immédiatement pour la lecture ; seule la LISTE
# peut retarder de 15 s au plus sur un autre processus.
DUREE_VITRINE = 15
_VITRINE = {"t": 0.0, "d": None}


def invalider_vitrine():
    _VITRINE["d"] = None


def vitrine(cx):
    import time
    base = (config.moteur(), config.chemin_sqlite() if config.moteur() == "sqlite" else config.url_postgres() + "#" + config.schema_postgres())
    d = _VITRINE["d"]
    if d is not None and _VITRINE.get("base") == base and time.monotonic() - _VITRINE["t"] < DUREE_VITRINE:
        return d
    livres = cx.tous("""SELECT * FROM books b WHERE b.statut = 'actif'
                        AND EXISTS (SELECT 1 FROM pages p WHERE p.book_id = b.id AND p.statut <> 'draft') ORDER BY b.id""")
    ids = [b["id"] for b in livres]
    pages, chapitres, auteurs = {}, {}, {}
    if ids:
        marques = ",".join("?" * len(ids))
        for i in ids:
            pages[i], chapitres[i] = [], []
        for p in cx.tous(f"SELECT * FROM pages WHERE book_id IN ({marques}) ORDER BY book_id, n", ids):
            pages[p["book_id"]].append(p)
        for c in cx.tous(f"SELECT book_id, titre, page_de, page_a FROM chapters WHERE book_id IN ({marques}) ORDER BY book_id, page_de", ids):
            chapitres[c["book_id"]].append(c)
        proprietaires = sorted({b["owner_id"] for b in livres})
        nb = suiveurs_par_auteur(proprietaires)
        for u in cx.tous(f"SELECT * FROM users WHERE actif = 1 AND id IN ({','.join('?' * len(proprietaires))})", proprietaires):
            auteurs[_auteur_cle(u["id"])] = serialiser_auteur(cx, u, nb.get(u["id"], 0))
    d = {"livres": livres, "pages": pages, "chapitres": chapitres, "auteurs": auteurs}
    _VITRINE["d"], _VITRINE["t"], _VITRINE["base"] = d, time.monotonic(), base
    return d


def suiveurs_par_auteur(ids):
    """Nombre public de lecteurs de chaque auteur : un agrégat SANS identité,
    lu en connexion globale (sous RLS, une personne ne voit que ses propres
    suivis). UNE requête pour tous les auteurs : le catalogue ouvrait une
    connexion PAR auteur (32 à chaque page — goulot mesuré au test de charge
    du 16/10/2026)."""
    if not ids:
        return {}
    cg = db.connecter(globale=True)
    try:
        return {r["owner_id"]: r["n"] for r in cg.tous(
            f"""SELECT b.owner_id, COUNT(DISTINCT f.user_id) AS n FROM follows f JOIN books b ON b.id = f.book_id
                WHERE b.owner_id IN ({','.join('?' * len(ids))}) GROUP BY b.owner_id""", list(ids))}
    finally:
        cg.fermer()


def serialiser_auteur(cx, u, suiveurs=None):
    if suiveurs is None:
        suiveurs = suiveurs_par_auteur([u["id"]]).get(u["id"], 0)
    return {"name": u["nom"], "photo": u["photo"], "city": u["ville"] or "", "since": (u["created_at"] or "")[:4],
            "bio": u["bio"] or "", "followers": suiveurs, "demo": bool(u["demo"])}


def enregistrer(app):

    @app.get("/api/catalogue")
    @connectee
    def lecteur_catalogue():
        """Tout ce que la personne peut voir, en UN appel : depuis Kinshasa,
        chaque aller-retour vers le serveur coûte ; on le paie une fois."""
        cx = db.connecter()
        try:
            a = acces.maintenant()
            uid = g.user["id"]
            plages = {}
            for r in cx.tous("SELECT book_id, page_de, page_a FROM entitlements WHERE user_id = ? AND revoque_le IS NULL", (uid,)):
                plages.setdefault(r["book_id"], []).append((r["page_de"], r["page_a"]))
            # Vitrine publique (en cache court) + livres de la personne (toujours frais)
            vit = vitrine(cx)
            miens = cx.tous("SELECT * FROM books WHERE owner_id = ? ORDER BY id", (uid,))
            pages_par, chap_par = dict(vit["pages"]), dict(vit["chapitres"])
            if miens:
                ids = [b["id"] for b in miens]
                marques = ",".join("?" * len(ids))       # uniquement des « ? » : les ids restent des paramètres
                for i in ids:
                    pages_par[i], chap_par[i] = [], []
                for p in cx.tous(f"SELECT * FROM pages WHERE book_id IN ({marques}) ORDER BY book_id, n", ids):
                    pages_par[p["book_id"]].append(p)
                for c in cx.tous(f"SELECT book_id, titre, page_de, page_a FROM chapters WHERE book_id IN ({marques}) ORDER BY book_id, page_de", ids):
                    chap_par[c["book_id"]].append(c)
            par_id = {b["id"]: b for b in vit["livres"]}
            par_id.update({b["id"]: b for b in miens})
            livres = [par_id[k] for k in sorted(par_id)]
            books = [serialiser_livre(cx, b, g.user, plages.get(b["id"], []), a, pages_par.get(b["id"], []), chap_par.get(b["id"], []))
                     for b in livres]
            auteurs = dict(vit["auteurs"])
            if miens and _auteur_cle(uid) not in auteurs:
                u = cx.un("SELECT * FROM users WHERE id = ? AND actif = 1", (uid,))
                if u:
                    auteurs[_auteur_cle(uid)] = serialiser_auteur(cx, u)
            g.dernieres_pages = {k: (v[-1]["n"] if v else 0) for k, v in pages_par.items()}
            return jsonify(authors=auteurs, books=books, reader=_etat_lecteur(cx, uid, livres))
        finally:
            cx.fermer()

    def _etat_lecteur(cx, uid, livres):
        par_id = {b["id"]: b["slug"] for b in livres}
        follows = [par_id[r["book_id"]] for r in cx.tous("SELECT book_id FROM follows WHERE user_id = ?", (uid,)) if r["book_id"] in par_id]
        progress = {par_id[r["book_id"]]: r["page_n"] for r in cx.tous("SELECT book_id, page_n FROM progress WHERE user_id = ?", (uid,)) if r["book_id"] in par_id}
        purchases = {}
        for r in cx.tous("""SELECT e.book_id, e.page_de, e.page_a, e.created_at FROM entitlements e WHERE e.user_id = ? AND e.revoque_le IS NULL ORDER BY e.created_at""", (uid,)):
            if r["book_id"] not in par_id:
                continue
            slug = par_id[r["book_id"]]
            nmax = g.dernieres_pages.get(r["book_id"], 0)
            fin = r["page_a"] or nmax
            p = purchases.setdefault(slug, {"pages": [], "date": r["created_at"][:10]})
            p["pages"] = sorted(set(p["pages"]) | set(range(r["page_de"], fin + 1)))
        return {"follows": follows, "progress": progress, "purchases": purchases}

    @app.get("/api/livres/<livre>/pages/<int:n>")
    @connectee
    def lecteur_page(livre, n):
        cx = db.connecter()
        try:
            b = cx.un("SELECT id FROM books WHERE slug = ?", (livre,))
            b, p, e = acces.page_et_etat(cx, g.user, b["id"] if b else None, n)
            if e is None:
                return jsonify(erreur="Introuvable."), 404
            ch = cx.un("SELECT titre FROM chapters WHERE book_id = ? AND page_de <= ? AND page_a >= ?", (b["id"], n, n))
            base = {"n": n, "etat": e, "chapitre": ch["titre"] if ch else None}
            if e == "soon":
                return jsonify({**base, "date": p["publie_le"]}), 403
            if e == "locked":
                return jsonify({**base, "options": argent.options(cx, g.user, b, n)}), 402
            # Lecture : limitée par compte (aspiration automatique d'un livre)
            if e != "auteur" and security.depasse(cx, "lecture:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Vous lisez très vite ! Patientez quelques minutes."), 429
            contenu, version = acces.contenu_courant(cx, p["id"])
            rep = dict(base, version=version)
            if e == "owned":
                rep["contenu"] = acces.marquer(contenu, g.user["id"])
                rep["filigrane"] = "Exemplaire " + ("d’" if g.user["nom"][:1].lower() in "aeiouyhâàéèêîïôû" else "de ") + g.user["nom"]
            else:
                rep["contenu"] = contenu
            cx.valider()
            return jsonify(rep)
        finally:
            cx.fermer()

    @app.put("/api/moi/progression")
    @connectee
    def lecteur_progression():
        d = v.corps_json(request)
        livre = v.texte(d, "livre", maxi=80)
        n = v.entier(d, "n", mini=1, maxi=100000)
        cx = db.connecter()
        try:
            b = cx.un("SELECT id FROM books WHERE slug = ?", (livre,))
            _, _, e = acces.page_et_etat(cx, g.user, b["id"] if b else None, n)
            if e not in acces.LISIBLES:
                return jsonify(erreur="Introuvable."), 404
            m = acces.maintenant()
            cx.execute("""INSERT INTO progress (user_id, book_id, page_n, updated_at) VALUES (?, ?, ?, ?)
                          ON CONFLICT (user_id, book_id) DO UPDATE SET page_n = excluded.page_n, updated_at = excluded.updated_at""",
                       (g.user["id"], b["id"], n, m))
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/suivis/<livre>")
    @connectee
    def lecteur_suivre(livre):
        cx = db.connecter()
        try:
            b = cx.un("SELECT id FROM books WHERE slug = ?", (livre,))
            b = acces.livre(cx, g.user, b["id"] if b else None)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            cx.execute("""INSERT INTO follows (user_id, book_id, created_at) VALUES (?, ?, ?)
                          ON CONFLICT (user_id, book_id) DO NOTHING""", (g.user["id"], b["id"], acces.maintenant()))
            cx.valider()
            return jsonify(suivi=True)
        finally:
            cx.fermer()

    @app.delete("/api/suivis/<livre>")
    @connectee
    def ne_plus_suivre(livre):
        cx = db.connecter()
        try:
            b = cx.un("SELECT id FROM books WHERE slug = ?", (livre,))
            if not b or not acces.livre(cx, g.user, b["id"]):
                return jsonify(erreur="Introuvable."), 404
            cx.execute("DELETE FROM follows WHERE user_id = ? AND book_id = ?", (g.user["id"], b["id"]))
            cx.valider()
            return jsonify(suivi=False)
        finally:
            cx.fermer()

    @app.post("/api/signalements")
    @connectee
    def lecteur_signaler():
        d = v.corps_json(request)
        livre = v.texte(d, "livre", maxi=80)
        motif = v.texte(d, "motif", mini=5, maxi=1000, multiligne=True)
        cx = db.connecter()
        try:
            b = cx.un("SELECT id FROM books WHERE slug = ?", (livre,))
            if not b or not acces.livre(cx, g.user, b["id"]):
                return jsonify(erreur="Introuvable."), 404
            sid = cx.inserer("INSERT INTO signalements (user_id, book_id, motif, created_at) VALUES (?, ?, ?, ?)",
                             (g.user["id"], b["id"], motif, acces.maintenant()))
            auditer("signalement", ressource=f"book:{b['id']}", apres=f"signalement:{sid}", cx=cx)
            cx.valider()
            return jsonify(ok=True), 201
        finally:
            cx.fermer()

    # ── Mon compte ─────────────────────────────────────────────────────────
    @app.get("/api/compte")
    @connectee
    def compte_lire():
        cx = db.connecter()
        try:
            u = cx.un("SELECT id, email, nom, role, bio, ville, email_verifie_at, created_at FROM users WHERE id = ?", (g.user["id"],))
            achats = cx.tous(
                """SELECT p.id, p.objet, p.montant, p.devise, p.etat, p.created_at, p.confirme_le, p.page_de, p.page_a,
                          p.operateur, p.reference, p.motif_refus, b.titre, b.slug, r.numero AS recu,
                          rf.created_at AS rembourse_le, rf.motif AS motif_remboursement
                     FROM payments p LEFT JOIN books b ON b.id = p.book_id LEFT JOIN receipts r ON r.payment_id = p.id
                     LEFT JOIN refunds rf ON rf.payment_id = p.id
                    WHERE p.user_id = ? ORDER BY p.id DESC LIMIT 100""", (g.user["id"],))
            return jsonify(compte=u, achats=achats, plume=argent.plume_actif(cx, g.user["id"]))
        finally:
            cx.fermer()

    @app.patch("/api/compte")
    @connectee
    def modifier_compte():
        d = v.corps_json(request)
        champs = {}
        if "nom" in d:
            champs["nom"] = v.texte(d, "nom", mini=2, maxi=60)
        if "bio" in d:
            champs["bio"] = v.texte(d, "bio", requis=False, maxi=600, multiligne=True)
        if "ville" in d:
            champs["ville"] = v.texte(d, "ville", requis=False, maxi=60)
        if not champs:
            raise v.Invalide("Rien à modifier.")
        cx = db.connecter()
        try:
            for k, val in champs.items():   # noms de colonnes : liste fermée ci-dessus, jamais le client
                cx.execute(f"UPDATE users SET {k} = ? WHERE id = ?", (val, g.user["id"]))
            auditer("compte.modification", ressource=f"user:{g.user['id']}", apres=",".join(sorted(champs)), cx=cx)
            cx.valider()
            invalider_vitrine()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/compte/devenir-auteur")
    @connectee
    def devenir_auteur():
        cx = db.connecter()
        try:
            cx.execute("UPDATE users SET role = 'auteur' WHERE id = ?", (g.user["id"],))
            auditer("compte.devenir_auteur", ressource=f"user:{g.user['id']}", cx=cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.delete("/api/compte")
    @connectee
    def supprimer_compte():
        """Suppression demandée par la personne (exigence des stores, RGPD) :
        les données personnelles sont effacées, les sessions fermées. Les
        paiements restent (obligation comptable), rattachés à un compte anonyme."""
        d = v.corps_json(request) if request.data else {}
        mdp = v.texte(d, "mot_de_passe", maxi=200)
        cx = db.connecter()
        try:
            u = cx.un("SELECT password_hash FROM users WHERE id = ?", (g.user["id"],))
            if not security.verifier_mot_de_passe(mdp, u["password_hash"]):
                return jsonify(erreur="Mot de passe incorrect.", champ="mot_de_passe"), 403
            uid = g.user["id"]
            cx.execute("""UPDATE users SET email = ?, nom = 'Compte supprimé', bio = NULL, ville = NULL, photo = NULL,
                          atelier = NULL, actif = 0, password_hash = ? WHERE id = ?""",
                       (f"supprime-{uid}@sozo.invalid", security.hacher_mot_de_passe(security.nouveau_jeton()), uid))
            cx.execute("DELETE FROM follows WHERE user_id = ?", (uid,))
            cx.execute("DELETE FROM progress WHERE user_id = ?", (uid,))
            security.revoquer_toutes(cx, uid)
            auditer("compte.suppression", ressource=f"user:{uid}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        import manuscrits
        manuscrits.effacer_pour(uid)
        invalider_vitrine()            # après validation : la suppression est acquise
        rep = jsonify(ok=True)
        security.effacer_cookies(rep)
        return rep
