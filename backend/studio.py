"""Le studio de l'auteur : atelier personnalisé, livres, chapitres, pages,
versions, programmation en lot, import de manuscrit.

Le propriétaire vient TOUJOURS de la session : un livre d'un autre répond 404.
Règles reprises du cahier des charges et de Klassio :
* importer ≠ publier : un import ne crée que des brouillons ;
* l'historique ne s'écrase pas : chaque enregistrement crée une version ;
* une page publiée garde son accès, son prix, sa date (des lecteurs ont peut-
  être des droits dessus) ; son TEXTE ne se corrige qu'avec Plume, en nouvelle
  version ;
* une opération en lot est vérifiée EN ENTIER avant la première écriture.
"""
import hashlib
import json
import os
import re
import unicodedata

from flask import g, jsonify, request

import acces
import argent
import catalogue
import config
import db
import extraction
import manuscrits
import security
import validation as v
from app import auditer, connectee

# 21/10/2026, le propriétaire : « enlève tout ce qui est roman, etc. ; on reste sur
# poésie, foi… ». Sōzō devient un lieu calme d'écriture chrétienne. Un livre créé
# AVANT garde son ancien genre (ANCIENNES) tant que l'auteur ne le change pas.
CATEGORIES = {"Poésie", "Foi", "Prière", "Méditation", "Louange", "Témoignage", "Spiritualité", "Recueil", "Récit", "Conte"}
ANCIENNES = {"Roman", "Polar", "Jeunesse", "Essai", "Histoire", "Manga", "Roman graphique", "Nouvelles", "Fantasy",
             "Développement personnel", "Théâtre", "Biographie"}
AMBIANCES = {"nuit", "parchemin", "or", "aube"}
DOSSIER_STOCKAGE = os.path.join(config.RACINE_BACKEND, "stockage", "manuscrits")

# ── Apparence d'un livre (19/10/2026) ─────────────────────────────────────
# L'auteur dessine sa couverture et la mise en page de ses pages. Tout arrive
# du navigateur, donc de n'importe qui : chaque clé est sur liste fermée,
# chaque valeur bornée. Une couleur est « #RRGGBB » et rien d'autre (une
# valeur CSS libre permettrait « url(…) » vers un site tiers, ou pire).
# Le JSON enregistré est RECONSTRUIT ici : une clé inconnue n'est jamais gardée.
POLICES = {"cormorant", "inter", "georgia", "didone", "moderne", "machine", "manuscrite"}
_COULEUR = re.compile(r"^#[0-9a-fA-F]{6}$")
_COUV = {
    "fond": ("choix", {"photo", "image", "uni", "degrade"}),
    "couleur1": ("couleur",), "couleur2": ("couleur",), "angle": ("entier", 0, 360),
    "cadrage_x": ("entier", 0, 100), "cadrage_y": ("entier", 0, 100), "zoom": ("entier", 100, 300),
    "voile": ("entier", 0, 90), "voile_couleur": ("couleur",),
    "police_titre": ("choix", POLICES), "taille_titre": ("entier", 50, 240), "graisse": ("choix", {300, 400, 500, 600, 700, 800}),
    "capitales": ("bool",), "espacement": ("entier", -5, 40), "italique": ("bool",),
    "alignement": ("choix", {"gauche", "centre", "droite"}), "position": ("choix", {"haut", "milieu", "bas"}),
    "couleur_titre": ("couleur",), "couleur_texte": ("couleur",), "sous_titre": ("texte", 80),
    "afficher_auteur": ("bool",), "afficher_categorie": ("bool",),
    "ornement": ("choix", {"aucun", "ovale", "bandeau", "cadre", "filet", "coins"}), "couleur_ornement": ("couleur",),
    "image_seule": ("bool",),
}
_PAGE = {
    "police": ("choix", POLICES), "accent": ("couleur",),
    "lettrine": ("choix", {"aucune", "simple", "ornee"}), "alignement": ("choix", {"gauche", "justifie", "centre"}),
    "interligne": ("entier", 130, 230), "separateur": ("choix", {"aucun", "etoiles", "fleuron", "croix", "trait"}),
    "titre_chapitre": ("choix", {"classique", "capitales", "italique"}),
}


def _valeur_apparence(champ, regle, val):
    nature = regle[0]
    if nature == "choix":
        if val not in regle[1] or isinstance(val, bool):
            raise v.Invalide(f"Valeur refusée pour « {champ} ».", champ)
        return val
    if nature == "couleur":
        if not isinstance(val, str) or not _COULEUR.match(val):
            raise v.Invalide(f"« {champ} » doit être une couleur #RRGGBB.", champ)
        return val.upper()
    if nature == "entier":
        if isinstance(val, bool) or not isinstance(val, int) or not regle[1] <= val <= regle[2]:
            raise v.Invalide(f"« {champ} » doit être un entier entre {regle[1]} et {regle[2]}.", champ)
        return val
    if nature == "bool":
        if not isinstance(val, bool):
            raise v.Invalide(f"« {champ} » doit valoir vrai ou faux.", champ)
        return val
    t = v.texte({champ: val}, champ, requis=False, maxi=regle[1])
    return t or ""


def apparence_propre(d):
    """Rend l'apparence validée et reconstruite, ou lève Invalide."""
    if not isinstance(d, dict) or set(d) - {"couv", "page"}:
        raise v.Invalide("Apparence invalide.", "apparence")
    out = {}
    for partie, regles in (("couv", _COUV), ("page", _PAGE)):
        bloc = d.get(partie)
        if bloc is None:
            continue
        if not isinstance(bloc, dict) or len(bloc) > len(regles):
            raise v.Invalide("Apparence invalide.", "apparence")
        inconnues = set(bloc) - set(regles)
        if inconnues:
            raise v.Invalide(f"Réglage inconnu : {sorted(inconnues)[0]}.", "apparence")
        out[partie] = {k: _valeur_apparence(k, regles[k], val) for k, val in bloc.items() if val is not None}
    return out


def apparence_lue(b):
    try:
        a = json.loads(b["apparence"]) if b["apparence"] else {}
        return a if isinstance(a, dict) else {}
    except (ValueError, KeyError, IndexError, TypeError):
        return {}


# Couverture envoyée : le type se reconnaît au CONTENU (signature), jamais au
# nom ni au type annoncé par le navigateur. 2 Mo au plus une fois décodée : le
# navigateur la réduit avant l'envoi (1 200 × 1 800 au plus).
COUVERTURE_MAX = 2 * 1024 * 1024
_SIGNATURES = ((b"\xff\xd8\xff", "image/jpeg"), (b"\x89PNG\r\n\x1a\n", "image/png"))


def type_image(octets):
    for sig, mime in _SIGNATURES:
        if octets.startswith(sig):
            return mime
    if len(octets) > 12 and octets[:4] == b"RIFF" and octets[8:12] == b"WEBP":
        return "image/webp"
    return None


def empreinte_couverture(cx, book_id):
    r = cx.un("SELECT empreinte FROM couvertures WHERE book_id = ?", (book_id,))
    return r["empreinte"][:16] if r else None


def _images_permises():
    d = os.path.join(config.RACINE_SITE, "images")
    return {f[:-4] for f in os.listdir(d) if f.endswith(".jpg") and not f.endswith("-480.jpg")} if os.path.isdir(d) else set()


def _slug(cx, titre):
    s = unicodedata.normalize("NFD", titre).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:50] or "livre"
    base, k = s, 2
    while cx.un("SELECT id FROM books WHERE slug = ?", (s,)):
        s = f"{base}-{k}"; k += 1
    return s


def _a_moi(cx, slug):
    """Le livre SI il appartient à la personne connectée ; sinon None → 404."""
    return cx.un("SELECT * FROM books WHERE slug = ? AND owner_id = ?", (slug, g.user["id"]))


def _prix(d, champ):
    if champ not in d or d[champ] is None:
        return None
    return v.centimes(d, champ, maxi=100_000)


def _nouvelle_version(cx, page_id, contenu):
    m = acces.maintenant()
    n = cx.un("SELECT COALESCE(MAX(version), 0) AS m FROM page_versions WHERE page_id = ?", (page_id,))["m"]
    cx.execute("UPDATE page_versions SET is_current = 0, remplacee_le = ? WHERE page_id = ? AND is_current = 1", (m, page_id))
    cx.execute("INSERT INTO page_versions (page_id, version, contenu, is_current, auteur_id, created_at) VALUES (?, ?, ?, 1, ?, ?)",
               (page_id, n + 1, contenu, g.user["id"], m))
    return n + 1


def _detail(cx, b):
    a = acces.maintenant()
    pages = []
    # Date de la version courante de chaque page, en UNE requête : la liste des
    # brouillons (façon « Notes », 19/10/2026) les range par date de travail.
    maj = {r["page_id"]: r["created_at"] for r in cx.tous(
        """SELECT v.page_id, v.created_at FROM page_versions v JOIN pages p ON p.id = v.page_id
           WHERE p.book_id = ? AND p.n > 0 AND v.is_current = 1""", (b["id"],))}
    for p in cx.tous("SELECT * FROM pages WHERE book_id = ? AND n > 0 ORDER BY n", (b["id"],)):      # n < 0 : corbeille
        txt, ver = acces.contenu_courant(cx, p["id"])
        pages.append({"n": p["n"], "acces": p["acces"], "statut": acces.statut_effectif(p, a), "publie_le": p["publie_le"],
                      "source": p["source"], "version": ver, "extrait": txt[:140], "mots": len(txt.split()),
                      "maj": maj.get(p["id"]) or p["created_at"]})
    return {
        "id": b["slug"], "titre": b["titre"], "categorie": b["categorie"], "description": b["description"],
        "couverture": b["couverture"], "style": b["style"], "format": b["format"], "mode": b["mode"], "acces": b["acces"],
        "prix": {"page": b["prix_page"], "chapitre": b["prix_chapitre"], "livre": b["prix_livre"]},
        "statut": b["statut"], "retrait_motif": b["retrait_motif"], "fichier_source": b["fichier_source"],
        "apparence": apparence_lue(b), "image": empreinte_couverture(cx, b["id"]),
        "chapitres": cx.tous("SELECT titre, page_de, page_a FROM chapters WHERE book_id = ? ORDER BY page_de", (b["id"],)),
        "pages": pages,
        "imports": [{**i, "conserve_jusqu_au": None if i["efface_le"] else manuscrits.echeance(i["created_at"])}
                    for i in cx.tous("SELECT nom_fichier, nature, taille, pages_creees, created_at, efface_le FROM imports WHERE book_id = ? ORDER BY id DESC", (b["id"],))],
        "conservation_jours": manuscrits.jours(),
        "suiveurs": cx.un("SELECT COUNT(*) AS n FROM follows WHERE book_id = ?", (b["id"],))["n"],
    }


def enregistrer(app):

    def _auteur():
        if g.user["role"] != "auteur":
            return jsonify(erreur="Le studio est réservé aux auteurs. Activez-le depuis votre compte.", code="pas_auteur"), 403
        return None

    @app.get("/api/studio")
    @connectee
    def studio_atelier():
        cx = db.connecter()
        try:
            u = cx.un("SELECT nom, atelier, role FROM users WHERE id = ?", (g.user["id"],))
            try:
                reglages = json.loads(u["atelier"]) if u["atelier"] else {}
            except ValueError:
                reglages = {}
            livres = []
            for b in cx.tous("SELECT * FROM books WHERE owner_id = ? ORDER BY updated_at DESC", (g.user["id"],)):
                st = cx.un("""SELECT SUM(CASE WHEN statut = 'draft' THEN 1 ELSE 0 END) AS brouillons,
                                     SUM(CASE WHEN statut <> 'draft' THEN 1 ELSE 0 END) AS sorties, COUNT(*) AS total
                                FROM pages WHERE book_id = ? AND n > 0""", (b["id"],))
                livres.append({"id": b["slug"], "titre": b["titre"], "categorie": b["categorie"], "couverture": b["couverture"],
                               "style": b["style"], "acces": b["acces"], "statut": b["statut"], "total": st["total"] or 0,
                               "apparence": apparence_lue(b), "image": empreinte_couverture(cx, b["id"]),
                               "maj": b["updated_at"],
                               "brouillons": st["brouillons"] or 0, "sorties": st["sorties"] or 0})
            gagne, verse, solde = argent.solde_auteur(cx, g.user["id"])
            return jsonify(role=u["role"], nom=u["nom"], atelier=reglages, livres=livres, solde=solde, gagne=gagne,
                           plume=argent.plume_actif(cx, g.user["id"]), images=sorted(_images_permises()),
                           categories=sorted(CATEGORIES))
        finally:
            cx.fermer()

    @app.put("/api/studio/atelier")
    @connectee
    def regler_atelier():
        d = v.corps_json(request)
        r = {"ambiance": v.choix(d, "ambiance", AMBIANCES),
             "nom": v.texte(d, "nom", requis=False, maxi=60),
             "citation": v.texte(d, "citation", requis=False, maxi=200, multiligne=True),
             "photo": v.texte(d, "photo", requis=False, maxi=60)}
        if r["photo"] and r["photo"] not in _images_permises():
            raise v.Invalide("Image inconnue.", "photo")
        cx = db.connecter()
        try:
            cx.execute("UPDATE users SET atelier = ? WHERE id = ?", (json.dumps(r, ensure_ascii=False), g.user["id"]))
            cx.valider()
            return jsonify(atelier=r)
        finally:
            cx.fermer()

    @app.post("/api/studio/livres")
    @connectee
    def creer_livre():
        refus = _auteur()
        if refus:
            return refus
        d = v.corps_json(request)
        titre = v.texte(d, "titre", mini=1, maxi=120)
        cat = v.choix(d, "categorie", CATEGORIES)
        desc = v.texte(d, "description", requis=False, maxi=1500, multiligne=True) or ""
        mode = v.choix(d, "mode", {"integral", "progressive"})
        acces_ = v.choix(d, "acces", {"free", "paid", "mixed"})
        fmt = v.choix(d, "format", {"texte", "vers", "planche"}, requis=False) or "texte"
        couv = v.texte(d, "couverture", requis=False, maxi=60) or "couv-pages"
        if couv not in _images_permises():
            raise v.Invalide("Image de couverture inconnue.", "couverture")
        style = v.choix(d, "style", {"a", "b", "c", "d"}, requis=False) or "a"
        app_ = json.dumps(apparence_propre(d["apparence"]), ensure_ascii=False) if d.get("apparence") is not None else None
        prix = {k: _prix(d, k) for k in ("prix_page", "prix_chapitre", "prix_livre")}
        if acces_ != "free" and all(x is None for x in prix.values()):
            raise v.Invalide("Un livre payant ou mixte a besoin d'au moins un prix.", "prix_page")
        if acces_ == "free":
            prix = {k: None for k in prix}
        cx = db.connecter()
        try:
            m = acces.maintenant()
            slug = _slug(cx, titre)
            bid = cx.inserer("""INSERT INTO books (owner_id, slug, titre, categorie, description, couverture, style, format, mode, acces,
                                prix_page, prix_chapitre, prix_livre, apparence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                             (g.user["id"], slug, titre, cat, desc, couv, style, fmt, mode, acces_, prix["prix_page"], prix["prix_chapitre"], prix["prix_livre"], app_, m, m))
            auditer("livre.creation", ressource=f"book:{bid}", apres=titre, cx=cx)
            cx.valider()
            catalogue.invalider_vitrine()
            return jsonify(livre=_detail(cx, cx.un("SELECT * FROM books WHERE id = ?", (bid,)))), 201
        finally:
            cx.fermer()

    @app.get("/api/studio/livres/<slug>")
    @connectee
    def studio_livre(slug):
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            return jsonify(livre=_detail(cx, b))
        finally:
            cx.fermer()

    @app.patch("/api/studio/livres/<slug>")
    @connectee
    def modifier_livre(slug):
        d = v.corps_json(request)
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            ch = {}
            if "titre" in d: ch["titre"] = v.texte(d, "titre", maxi=120)
            if "categorie" in d: ch["categorie"] = v.choix(d, "categorie", CATEGORIES | ({b["categorie"]} & ANCIENNES))
            if "description" in d: ch["description"] = v.texte(d, "description", requis=False, maxi=1500, multiligne=True) or ""
            if "mode" in d: ch["mode"] = v.choix(d, "mode", {"integral", "progressive"})
            if "acces" in d: ch["acces"] = v.choix(d, "acces", {"free", "paid", "mixed"})
            if "style" in d: ch["style"] = v.choix(d, "style", {"a", "b", "c", "d"})
            if "format" in d: ch["format"] = v.choix(d, "format", {"texte", "vers"})
            if "apparence" in d: ch["apparence"] = json.dumps(apparence_propre(d["apparence"] or {}), ensure_ascii=False)
            if "couverture" in d:
                ch["couverture"] = v.texte(d, "couverture", maxi=60)
                if ch["couverture"] not in _images_permises():
                    raise v.Invalide("Image de couverture inconnue.", "couverture")
            for k in ("prix_page", "prix_chapitre", "prix_livre"):
                if k in d:
                    ch[k] = _prix(d, k)       # un nouveau prix ne touche que les achats FUTURS
            if not ch:
                raise v.Invalide("Rien à modifier.")
            ch["updated_at"] = acces.maintenant()
            for k, val in ch.items():           # colonnes : liste fermée ci-dessus
                cx.execute(f"UPDATE books SET {k} = ? WHERE id = ?", (val, b["id"]))
            auditer("livre.modification", ressource=f"book:{b['id']}", apres=",".join(sorted(ch)), cx=cx)
            cx.valider()
            catalogue.invalider_vitrine()
            return jsonify(livre=_detail(cx, _a_moi(cx, slug)))
        finally:
            cx.fermer()

    @app.put("/api/studio/livres/<slug>/couverture")
    @connectee
    def envoyer_couverture(slug):
        """La couverture créée par l'auteur : une image (data URI base64), dont
        le type est reconnu par sa signature. Remplace la précédente."""
        import base64
        d = v.corps_json(request)
        brut = d.get("image")
        if not isinstance(brut, str) or not brut.startswith("data:") or "," not in brut or len(brut) > COUVERTURE_MAX * 4 // 3 + 200:
            raise v.Invalide("Envoyez une image JPEG, PNG ou WebP de 2 Mo au plus.", "image")
        try:
            octets = base64.b64decode(brut.split(",", 1)[1], validate=True)
        except (ValueError, TypeError):
            raise v.Invalide("Image illisible.", "image")
        mime = type_image(octets)
        if not mime:
            raise v.Invalide("Format refusé : JPEG, PNG ou WebP seulement.", "image")
        if len(octets) > COUVERTURE_MAX:
            raise v.Invalide("Image trop lourde : 2 Mo au plus.", "image")
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            m = acces.maintenant()
            emp = hashlib.sha256(octets).hexdigest()
            cx.execute("DELETE FROM couvertures WHERE book_id = ?", (b["id"],))
            cx.execute("INSERT INTO couvertures (book_id, mime, donnees, empreinte, taille, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                       (b["id"], mime, base64.b64encode(octets).decode(), emp, len(octets), m))
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (m, b["id"]))
            auditer("livre.couverture", ressource=f"book:{b['id']}", apres=f"{mime} {len(octets)} o", cx=cx)
            cx.valider()
            catalogue.invalider_vitrine()
            return jsonify(image=emp[:16])
        finally:
            cx.fermer()

    @app.delete("/api/studio/livres/<slug>/couverture")
    @connectee
    def retirer_couverture(slug):
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            cx.execute("DELETE FROM couvertures WHERE book_id = ?", (b["id"],))
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (acces.maintenant(), b["id"]))
            cx.valider()
            catalogue.invalider_vitrine()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.get("/api/studio/livres/<slug>/textes")
    @connectee
    def studio_textes(slug):
        """L'atelier montre les pages ENTIÈRES (demande du propriétaire,
        19/10/2026), par lots : 24 pages au plus par appel, pour qu'un livre
        de 2 000 pages ne parte pas d'un bloc sur une connexion lente."""
        bornes = {k: request.args.get(k, type=int) for k in ("de", "a")}
        de = v.entier(bornes, "de", mini=1, maxi=100000)
        a = v.entier(bornes, "a", mini=1, maxi=100000)
        if a < de or a - de >= 24:
            raise v.Invalide("24 pages au plus par demande.", "a")
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            t = acces.maintenant()
            pages = []
            for p in cx.tous("SELECT * FROM pages WHERE book_id = ? AND n BETWEEN ? AND ? ORDER BY n", (b["id"], de, a)):
                txt, ver = acces.contenu_courant(cx, p["id"])
                pages.append({"n": p["n"], "contenu": txt, "version": ver, "statut": acces.statut_effectif(p, t), "acces": p["acces"]})
            return jsonify(pages=pages)
        finally:
            cx.fermer()

    @app.post("/api/studio/livres/<slug>/pages/<int:n>/relecture")
    @connectee
    def relecture_ia(slug, n):
        """Second avis de l'IA sur le texte EN COURS dans l'éditeur (pas
        forcément enregistré) d'une page de SON livre. Ne modifie rien."""
        import ia_correcteur
        d = v.corps_json(request)
        texte = v.texte(d, "texte", mini=1, maxi=ia_correcteur.TEXTE_MAX, multiligne=True)
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b or not cx.un("SELECT id FROM pages WHERE book_id = ? AND n = ?", (b["id"], n)):
                return jsonify(erreur="Introuvable."), 404
            if not ia_correcteur.active():
                return jsonify(erreur="La relecture par l’IA n’est pas encore activée sur ce serveur.", code="ia_inactive"), 503
            jour = acces.maintenant()[:10]
            cx.execute("""INSERT INTO ia_usages (user_id, jour, n) VALUES (?, ?, 1)
                          ON CONFLICT (user_id, jour) DO UPDATE SET n = ia_usages.n + 1""", (g.user["id"], jour))
            deja = cx.un("SELECT n FROM ia_usages WHERE user_id = ? AND jour = ?", (g.user["id"], jour))["n"]
            if deja > ia_correcteur.plafond_jour():
                cx.annuler()
                return jsonify(erreur=f"Vous avez utilisé vos {ia_correcteur.plafond_jour()} relectures du jour. Le correcteur de l’éditeur reste disponible.", code="ia_plafond"), 429
            cx.valider()            # compté AVANT l'appel : une panne ne rend pas le quota infini
        finally:
            cx.fermer()
        try:
            corrections = ia_correcteur.relire(texte)
        except ia_correcteur.Indisponible as e:
            return jsonify(erreur=str(e), code="ia_indisponible"), 503
        return jsonify(corrections=corrections, restant=max(0, ia_correcteur.plafond_jour() - deja))

    @app.put("/api/studio/livres/<slug>/chapitres")
    @connectee
    def studio_chapitres(slug):
        d = v.corps_json(request)
        liste = d.get("chapitres")
        if not isinstance(liste, list) or len(liste) > 500:
            raise v.Invalide("« chapitres » doit être une liste.", "chapitres")
        propres = []
        for c in liste:
            if not isinstance(c, dict):
                raise v.Invalide("Chapitre invalide.", "chapitres")
            propres.append((v.texte(c, "titre", maxi=120), v.entier(c, "page_de", mini=1), v.entier(c, "page_a", mini=1)))
        propres.sort(key=lambda x: x[1])
        for i, (t, de, a) in enumerate(propres):
            if a < de or (i and de <= propres[i - 1][2]):
                raise v.Invalide(f"Le chapitre « {t} » chevauche le précédent ou finit avant de commencer.", "chapitres")
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            cx.execute("DELETE FROM chapters WHERE book_id = ?", (b["id"],))
            for t, de, a in propres:
                cx.execute("INSERT INTO chapters (book_id, titre, page_de, page_a) VALUES (?, ?, ?, ?)", (b["id"], t, de, a))
            cx.valider()
            catalogue.invalider_vitrine()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/studio/livres/<slug>/pages")
    @connectee
    def nouvelle_page(slug):
        d = v.corps_json(request)
        contenu = v.texte(d, "contenu", requis=False, maxi=60_000, multiligne=True) or ""
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            n = (cx.un("SELECT MAX(n) AS m FROM pages WHERE book_id = ? AND n > 0", (b["id"],))["m"] or 0) + 1
            pid = cx.inserer("INSERT INTO pages (book_id, n, acces, statut, source, created_at) VALUES (?, ?, ?, 'draft', 'editor', ?)",
                             (b["id"], n, "free" if b["acces"] == "free" else "paid", acces.maintenant()))
            _nouvelle_version(cx, pid, contenu)
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (acces.maintenant(), b["id"]))
            cx.valider()
            return jsonify(n=n), 201
        finally:
            cx.fermer()

    @app.get("/api/studio/livres/<slug>/pages/<int:n>")
    @connectee
    def studio_page(slug, n):
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            p = b and cx.un("SELECT * FROM pages WHERE book_id = ? AND n = ?", (b["id"], n))
            if not p:
                return jsonify(erreur="Introuvable."), 404
            txt, ver = acces.contenu_courant(cx, p["id"])
            versions = cx.tous("SELECT version, created_at, remplacee_le FROM page_versions WHERE page_id = ? ORDER BY version DESC", (p["id"],))
            return jsonify(n=n, contenu=txt, version=ver, versions=versions, statut=acces.statut_effectif(p), acces=p["acces"],
                           publie_le=p["publie_le"], plume=argent.plume_actif(cx, g.user["id"])["actif"])
        finally:
            cx.fermer()

    @app.put("/api/studio/livres/<slug>/pages/<int:n>")
    @connectee
    def enregistrer_page(slug, n):
        d = v.corps_json(request)
        contenu = v.texte(d, "contenu", requis=False, maxi=60_000, multiligne=True) or ""
        attendue = v.entier(d, "version_attendue", mini=0, requis=False)
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            p = b and cx.un("SELECT * FROM pages WHERE book_id = ? AND n = ?", (b["id"], n))
            if not p:
                return jsonify(erreur="Introuvable."), 404
            cx.execute("UPDATE pages SET id = id WHERE id = ?", (p["id"],))   # verrou : la lecture ci-dessous et l'écriture forment un tout
            actuel, ver_actuelle = acces.contenu_courant(cx, p["id"])
            # Deux onglets (ou deux appareils) sur la même page : le second
            # enregistrement écrasait le premier sans rien dire. L'éditeur annonce
            # la version qu'il a lue ; si elle a changé entre-temps, on le dit.
            if attendue is not None and attendue != (ver_actuelle or 0):
                return jsonify(erreur="Cette page a été modifiée ailleurs depuis que vous l'avez ouverte.", code="conflit",
                               version=ver_actuelle, contenu=actuel), 409
            if acces.statut_effectif(p) == "scheduled" and not contenu.strip():
                # Une page programmée vidée sortirait vide à son heure
                return jsonify(erreur="Cette page est programmée : elle ne peut pas être vidée. Remettez-la d'abord en brouillon.", code="programmee_vide"), 409
            if acces.statut_effectif(p) == "published" and not argent.plume_actif(cx, g.user["id"])["actif"]:
                return jsonify(erreur="Cette page est publiée : la corriger demande Plume (une nouvelle version, sans rien retirer aux lecteurs).",
                               code="plume_requis"), 403
            if actuel == contenu:
                return jsonify(ok=True, version=ver_actuelle, inchange=True)
            ver = _nouvelle_version(cx, p["id"], contenu)
            if acces.statut_effectif(p) == "published":
                auditer("page.correction_publiee", ressource=f"book:{b['id']}:page:{n}", apres=f"version {ver}", cx=cx)
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (acces.maintenant(), b["id"]))
            cx.valider()
            return jsonify(ok=True, version=ver)
        finally:
            cx.fermer()

    @app.post("/api/studio/livres/<slug>/pages/lot")
    @connectee
    def studio_lot(slug):
        """Le navigateur envoie des CRITÈRES (numéros, action, date) ; tout est
        vérifié avant la première écriture — un lot est appliqué en entier ou pas du tout."""
        d = v.corps_json(request)
        ns = d.get("pages")
        if not isinstance(ns, list) or not ns or len(ns) > 2000 or not all(isinstance(x, int) and not isinstance(x, bool) for x in ns):
            raise v.Invalide("« pages » doit être une liste de numéros.", "pages")
        action = v.choix(d, "action", {"gratuit", "payant", "programmer", "publier", "brouillon"})
        date = v.date_heure(d, "date") if action == "programmer" else None
        if date and date <= acces.maintenant():
            raise v.Invalide("La date de parution doit être dans le futur (ou choisissez « publier maintenant »).", "date")
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            pages = {p["n"]: p for p in cx.tous("SELECT * FROM pages WHERE book_id = ? AND n > 0", (b["id"],))}
            manquantes = sorted(set(ns) - set(pages))
            if manquantes:
                return jsonify(erreur=f"Pages inexistantes : {manquantes[:10]}"), 400
            publiees = sorted(n for n in set(ns) if acces.statut_effectif(pages[n]) == "published")
            if publiees:
                return jsonify(erreur=f"Pages déjà publiées, donc verrouillées (des lecteurs ont peut-être des droits dessus) : {publiees[:20]}",
                               pages=publiees), 409
            if action == "payant" and b["acces"] == "free":
                return jsonify(erreur="Ce livre est gratuit : changez d'abord son accès (payant ou mixte) et ses prix."), 409
            if action in ("programmer", "publier"):
                vides = sorted(n for n in set(ns) if not acces.contenu_courant(cx, pages[n]["id"])[0].strip())
                if vides:
                    return jsonify(erreur=f"Pages vides, impossibles à publier : {vides[:20]}", pages=vides), 409
            m = acces.maintenant()
            for n in sorted(set(ns)):
                pid = pages[n]["id"]
                if action in ("gratuit", "payant"):
                    cx.execute("UPDATE pages SET acces = ? WHERE id = ?", ("free" if action == "gratuit" else "paid", pid))
                elif action == "programmer":
                    cx.execute("UPDATE pages SET statut = 'scheduled', publie_le = ? WHERE id = ?", (date, pid))
                elif action == "publier":
                    cx.execute("UPDATE pages SET statut = 'published', publie_le = ? WHERE id = ?", (m, pid))
                else:
                    cx.execute("UPDATE pages SET statut = 'draft', publie_le = NULL WHERE id = ?", (pid,))
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (m, b["id"]))
            auditer("pages.lot", ressource=f"book:{b['id']}", apres=f"{action}:{len(set(ns))}", cx=cx)
            cx.valider()
            catalogue.invalider_vitrine()
            if action == "publier":
                import envois, taches
                taches.annoncer_parutions(b["id"])      # les lecteurs qui suivent le livre sont prévenus tout de suite
                envois.declencher()
            return jsonify(ok=True, pages=len(set(ns)))
        finally:
            cx.fermer()

    @app.post("/api/studio/livres/<slug>/pages/ordre")
    @connectee
    def studio_ordre(slug):
        """Réordonner les brouillons de FIN de livre (après la dernière page
        sortie). Les droits d'achat sont attachés aux numéros : déplacer une
        page sortie, ou un brouillon glissé entre deux pages vendues au
        chapitre, changerait ce qu'un lecteur a payé. On ne permute donc que
        la queue de brouillons, où aucun droit ne peut viser un texte précis."""
        d = v.corps_json(request)
        ordre = d.get("ordre")
        if not isinstance(ordre, list) or not ordre or len(ordre) > 2000 or not all(isinstance(x, int) and not isinstance(x, bool) for x in ordre):
            raise v.Invalide("« ordre » doit être une liste de numéros.", "ordre")
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            pages = cx.tous("SELECT id, n, statut, publie_le FROM pages WHERE book_id = ? AND n > 0 ORDER BY n", (b["id"],))
            sorties = [p["n"] for p in pages if acces.statut_effectif(p) != "draft"]
            queue = [p for p in pages if p["n"] > (max(sorties) if sorties else 0)]
            if sorted(ordre) != [p["n"] for p in queue]:
                return jsonify(erreur="Seuls les brouillons placés après la dernière page sortie se réordonnent, et tous doivent figurer dans l'ordre.",
                               code="hors_queue"), 409
            par_n = {p["n"]: p["id"] for p in queue}
            numeros = [p["n"] for p in queue]
            # deux temps : UNIQUE(book_id, n) interdit un échange direct
            for n in numeros:
                cx.execute("UPDATE pages SET n = ? WHERE id = ?", (-n, par_n[n]))
            for nouveau, ancien in zip(numeros, ordre):
                cx.execute("UPDATE pages SET n = ? WHERE id = ?", (nouveau, par_n[ancien]))
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (acces.maintenant(), b["id"]))
            auditer("pages.ordre", ressource=f"book:{b['id']}", apres=",".join(map(str, ordre))[:200], cx=cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    # ── Corbeille des pages (21/10/2026) ───────────────────────────────────
    # « Il faut que l'utilisateur puisse supprimer la page, la placer dans la
    # corbeille, ensuite la récupérer s'il veut » (le propriétaire). Rien ne
    # s'efface : la page garde sa ligne et TOUTES ses versions. Même règle que
    # le réordonnancement : seuls les brouillons de fin de livre (après la
    # dernière page sortie) se jettent — une page sortie ou glissée entre des
    # pages vendues porte peut-être un droit de lecture, et les numéros qui la
    # suivent ne doivent pas bouger.
    @app.delete("/api/studio/livres/<slug>/pages/<int:n>")
    @connectee
    def page_corbeille(slug, n):
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            p = b and cx.un("SELECT * FROM pages WHERE book_id = ? AND n = ? AND n > 0", (b["id"], n))
            if not p:
                return jsonify(erreur="Introuvable."), 404
            pages = cx.tous("SELECT id, n, statut, publie_le FROM pages WHERE book_id = ? AND n > 0 ORDER BY n", (b["id"],))
            sorties = [x["n"] for x in pages if acces.statut_effectif(x) != "draft"]
            if acces.statut_effectif(p) != "draft":
                return jsonify(erreur="Cette page est sortie (ou programmée) : des lecteurs y ont peut-être droit. Elle ne va pas à la corbeille.",
                               code="page_sortie"), 409
            if sorties and n < max(sorties):
                return jsonify(erreur="Ce brouillon est placé entre des pages sorties : le jeter décalerait leurs numéros, donc ce que des lecteurs ont payé.",
                               code="hors_queue"), 409
            m = acces.maintenant()
            cx.execute("UPDATE pages SET n = ?, n_avant = ?, corbeille_le = ? WHERE id = ?", (-p["id"], n, m, p["id"]))
            # Les brouillons qui suivaient reculent d'un cran (dans l'ordre : la place libérée est toujours devant)
            for x in pages:
                if x["n"] > n:
                    cx.execute("UPDATE pages SET n = ? WHERE id = ?", (x["n"] - 1, x["id"]))
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (m, b["id"]))
            auditer("page.corbeille", ressource=f"book:{b['id']}:page:{p['id']}", avant=f"n={n}", cx=cx)
            cx.valider()
            return jsonify(ok=True, page=p["id"])
        finally:
            cx.fermer()

    @app.get("/api/studio/livres/<slug>/corbeille")
    @connectee
    def studio_corbeille(slug):
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            out = []
            for p in cx.tous("SELECT * FROM pages WHERE book_id = ? AND corbeille_le IS NOT NULL ORDER BY corbeille_le DESC", (b["id"],)):
                txt, ver = acces.contenu_courant(cx, p["id"])
                out.append({"id": p["id"], "n_avant": p["n_avant"], "jetee_le": p["corbeille_le"], "version": ver,
                            "extrait": txt[:200], "mots": len(txt.split())})
            return jsonify(pages=out)
        finally:
            cx.fermer()

    @app.post("/api/studio/livres/<slug>/corbeille/<int:pid>/restaurer")
    @connectee
    def page_restaurer(slug, pid):
        """La page revient en BROUILLON, à la fin du livre (sa place d'avant a pu
        être prise) ; l'auteur la remet où il veut avec le réordonnancement."""
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            p = b and cx.un("SELECT * FROM pages WHERE id = ? AND book_id = ? AND corbeille_le IS NOT NULL", (pid, b["id"]))
            if not p:
                return jsonify(erreur="Introuvable."), 404
            n = (cx.un("SELECT MAX(n) AS m FROM pages WHERE book_id = ? AND n > 0", (b["id"],))["m"] or 0) + 1
            m = acces.maintenant()
            cx.execute("UPDATE pages SET n = ?, corbeille_le = NULL, statut = 'draft', publie_le = NULL WHERE id = ?", (n, pid))
            cx.execute("UPDATE books SET updated_at = ? WHERE id = ?", (m, b["id"]))
            auditer("page.restauree", ressource=f"book:{b['id']}:page:{pid}", apres=f"n={n}", cx=cx)
            cx.valider()
            return jsonify(ok=True, n=n)
        finally:
            cx.fermer()

    @app.post("/api/studio/livres/<slug>/import")
    @connectee
    def importer(slug):
        f = request.files.get("fichier")
        if not f:
            raise v.Invalide("Aucun fichier reçu.", "fichier")
        octets = f.read(25 * 1024 * 1024 + 1)
        if len(octets) > 25 * 1024 * 1024:
            return jsonify(erreur="Fichier trop volumineux (25 Mo au plus)."), 413
        cx = db.connecter()
        try:
            b = _a_moi(cx, slug)
            if not b:
                return jsonify(erreur="Introuvable."), 404
            if security.depasse(cx, "import:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Trop d'imports. Réessayez dans une heure."), 429
            try:
                nature, textes = extraction.extraire_borne(octets)
            except extraction.Refus as e:
                auditer("livre.import", ressource=f"book:{b['id']}", apres=str(e)[:100], resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur=str(e)), 422
            empreinte = hashlib.sha256(octets).hexdigest()
            # Stockage PRIVÉ : hors des dossiers servis, jamais téléchargeable
            os.makedirs(DOSSIER_STOCKAGE, exist_ok=True)
            with open(os.path.join(DOSSIER_STOCKAGE, f"{empreinte}.{nature}"), "wb") as h:
                h.write(octets)
            depart = cx.un("SELECT MAX(n) AS m FROM pages WHERE book_id = ? AND n > 0", (b["id"],))["m"] or 0
            m = acces.maintenant()
            for i, t in enumerate(textes, start=1):
                pid = cx.inserer("INSERT INTO pages (book_id, n, acces, statut, source, created_at) VALUES (?, ?, ?, 'draft', ?, ?)",
                                 (b["id"], depart + i, "free" if b["acces"] == "free" else "paid", nature, m))
                _nouvelle_version(cx, pid, t)
            nom = os.path.basename(f.filename or "manuscrit")[:120]
            cx.execute("INSERT INTO imports (user_id, book_id, nom_fichier, nature, taille, empreinte, pages_creees, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                       (g.user["id"], b["id"], nom, nature, len(octets), empreinte, len(textes), m))
            cx.execute("UPDATE books SET fichier_source = ?, updated_at = ? WHERE id = ?", (nom, m, b["id"]))
            auditer("livre.import", ressource=f"book:{b['id']}", apres=f"{nature}:{len(textes)} pages", cx=cx)
            cx.valider()
            return jsonify(ok=True, nature=nature, pages=len(textes), premiere=depart + 1), 201
        finally:
            cx.fermer()
