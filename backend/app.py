"""Sōzō — application Flask : une seule origine sert les pages ET l'API.

Garde-fous du socle (INSPIRATION_SECURITE_BACKEND.md, §1, §5, §6) :
* FERMÉ PAR DÉFAUT — une route d'API doit être déclarée publique (`@ouverte`)
  ou soumise à une connexion / une permission ; une route oubliée répond 403.
  Un test vérifie que chaque route est déclarée.
* Fichiers du site servis sur LISTE BLANCHE : ni `backend/`, ni `.env`, ni la
  base, ni le venv ne peuvent sortir, même par « ../ ».
* En-têtes : CSP stricte (aucun script en ligne, aucun domaine tiers),
  nosniff, DENY, no-referrer, HSTS en HTTPS.
* Une erreur 500 ne renvoie jamais un chemin, une requête SQL ou une trace.
"""
import logging
import gzip
import os
import secrets
from functools import wraps

from flask import Flask, abort, g, jsonify, request, send_from_directory

import config
import db
from validation import Invalide, maintenant

journal = logging.getLogger("sozo")

# ---------------------------------------------------------------------------
# Déclaration des routes — fermé par défaut
# ---------------------------------------------------------------------------
_DECLAREES = {}


def ouverte(f):
    """Route publique, explicitement. Tout le reste exige une session."""
    _DECLAREES[f.__name__] = "ouverte"

    @wraps(f)
    def enveloppe(*a, **k):
        return f(*a, **k)
    enveloppe._sozo = "ouverte"
    return enveloppe


def connectee(f):
    """Route réservée à une personne connectée : la session (cookie) est lue
    avant chaque requête ; sans elle, 401 et une ligne au journal d'audit."""
    _DECLAREES[f.__name__] = "connectee"

    @wraps(f)
    def enveloppe(*a, **k):
        user = getattr(g, "user", None)
        if not user:
            auditer("acces.refuse", ressource=request.path, resultat="refus")
            return jsonify(erreur="Connexion requise."), 401
        return f(*a, **k)
    enveloppe._sozo = "connectee"
    return enveloppe


def auditer(action, *, ressource=None, avant=None, apres=None, resultat="ok", cx=None):
    """Inscrit une ligne au journal d'audit (immuable). Ne fait jamais
    échouer la requête : un journal en panne est signalé dans les logs."""
    propre = cx is None
    try:
        cx = cx or db.connecter()
        user = getattr(g, "user", None) if _dans_requete() else None
        cx.execute(
            "INSERT INTO audit_log (at, user_id, ip, action, ressource, avant, apres, resultat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (maintenant(), user["id"] if user else None, ip_client() if _dans_requete() else None,
             action, ressource, avant, apres, resultat))
        if propre:
            cx.valider()
    except Exception:  # pragma: no cover — on journalise, on ne casse pas la réponse
        journal.exception("audit impossible : %s", action)
    finally:
        if propre and cx is not None:
            cx.fermer()


def _dans_requete():
    try:
        return request.path is not None
    except RuntimeError:
        return False


def ip_client():
    """L'IP réelle n'est crue que si le Worker Cloudflare prouve son identité
    par le secret partagé. Sinon, tout le monde aurait l'IP du proxy — ou
    pourrait s'inventer une IP pour contourner la limitation de débit."""
    secret = config.secret_proxy()
    fournie = request.headers.get("X-Sozo-Proxy", "")
    if secret and fournie and secrets.compare_digest(secret, fournie):
        return request.headers.get("CF-Connecting-IP", request.remote_addr)
    return request.remote_addr


# ---------------------------------------------------------------------------
# Compression — mesurée au test de charge du 16/10/2026 : le catalogue pesait
# 231 Ko (8,5 Ko compressé) et TOUTES les pages le rechargent. En 2G (~25 Ko/s),
# c'était ~9 s et 231 Ko de forfait par page.
# ---------------------------------------------------------------------------
COMPRESSIBLES = {"text/html", "text/css", "text/javascript", "application/javascript", "application/json",
                 "image/svg+xml", "text/plain", "application/manifest+json"}
_GZ, _GZ_MAX = {}, 48 * 1024 * 1024          # fichiers statiques déjà compressés (mémoire bornée)


def _compresser(rep):
    """gzip si le navigateur l'accepte. Pas de risque BREACH ici : aucune
    réponse ne mêle un secret (jeton, mot de passe) à un texte renvoyé tel
    que fourni par un tiers — le jeton CSRF vit dans un cookie, jamais dans
    le corps."""
    if (rep.status_code != 200 or "gzip" not in request.headers.get("Accept-Encoding", "")
            or rep.mimetype not in COMPRESSIBLES or rep.headers.get("Content-Encoding") or request.method == "HEAD"):
        return rep
    statique = rep.direct_passthrough
    cle = (request.path, rep.headers.get("ETag"), rep.headers.get("Content-Length")) if statique else None
    if cle and cle in _GZ:
        donnees = _GZ[cle]
    else:
        rep.direct_passthrough = False
        brut = rep.get_data()
        if len(brut) < 1024:
            return rep
        donnees = gzip.compress(brut, compresslevel=6)
        if cle and sum(len(x) for x in _GZ.values()) + len(donnees) < _GZ_MAX:
            _GZ[cle] = donnees
    rep.direct_passthrough = False
    rep.set_data(donnees)
    rep.headers["Content-Encoding"] = "gzip"
    rep.headers["Content-Length"] = str(len(donnees))
    rep.vary.add("Accept-Encoding")
    if rep.headers.get("ETag", "").startswith('"'):        # même ressource, autre codage : étiquette « faible »
        rep.headers["ETag"] = "W/" + rep.headers["ETag"]
    return rep


# ---------------------------------------------------------------------------
# Fichiers du site — liste blanche
# ---------------------------------------------------------------------------
FICHIERS_RACINE = {"index.html", "favicon.svg", "styles.css", "sozo.css", "sozo.js", "app.js", "content.js"}
DOSSIERS_PUBLICS = {"app", "assets", "images", "illustrations", "admin"}
# Les SEULES routes qui reçoivent un fichier (multipart) au lieu de JSON — toujours avec le jeton CSRF
ENVOIS_DE_FICHIER = {"importer"}
EXTENSIONS = {".html", ".css", ".js", ".json", ".txt", ".svg", ".jpg", ".jpeg", ".png", ".webp", ".woff2", ".ico"}

CSP = "; ".join([
    "default-src 'none'",
    "script-src 'self'",
    "worker-src 'self'",
    # Les attributs style="" de la landing (positions des images, animations)
    # exigent 'unsafe-inline' pour les STYLES. Les scripts, eux, restent stricts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


def creer_app():
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024   # manuscrits PDF/EPUB/DOCX (étape 4)
    app.config["JSON_AS_ASCII"] = False

    # Le schéma est appliqué AVANT la première requête : si la base refuse,
    # le serveur ne démarre pas (plutôt qu'une API sans tables).
    db.appliquer_schema()

    # ── API ────────────────────────────────────────────────────────────────
    @app.get("/api/sante")
    @ouverte
    def sante():
        return jsonify(ok=True)

    # ── Pages ──────────────────────────────────────────────────────────────
    @app.get("/")
    @ouverte
    def accueil():
        return send_from_directory(config.RACINE_SITE, "index.html")

    @app.get("/<path:chemin>")
    @ouverte
    def fichier(chemin):
        if chemin.startswith("api/"):
            abort(404)
        parties = chemin.split("/")
        if any(p.startswith(".") or p == "" for p in parties):
            abort(404)
        if len(parties) == 1:
            if chemin not in FICHIERS_RACINE:
                abort(404)
        elif parties[0] not in DOSSIERS_PUBLICS:
            abort(404)
        if os.path.splitext(chemin)[1].lower() not in EXTENSIONS:
            abort(404)
        # send_from_directory refuse lui aussi toute sortie du dossier (« ../ »)
        return send_from_directory(config.RACINE_SITE, chemin)

    # ── Garde-fous transverses ─────────────────────────────────────────────
    import admin
    import argent
    import catalogue
    import comptes
    import studio
    import notifications
    for module in (comptes, catalogue, argent, studio, admin, notifications):
        module.enregistrer(app)
    if os.environ.get("SOZO_TACHES_INTEGREES", "").strip() == "1":
        import taches
        taches.demarrer_dans_le_serveur()

    @app.before_request
    def session_et_csrf():
        """Qui parle ? La réponse vient du cookie de session, et de lui seul."""
        import security
        g.user = None
        jeton = request.cookies.get(security.COOKIE_SESSION)
        if jeton and request.path.startswith("/api/"):
            cx = db.connecter()
            try:
                g.user = security.lire_session(cx, jeton)
            finally:
                cx.fermer()
        if request.path.startswith("/api/") and request.method in ("POST", "PUT", "PATCH", "DELETE"):
            # Corps JSON obligatoire : un formulaire HTML d'un autre site ne peut
            # pas fabriquer cette requête (défense CSRF en plus du jeton).
            fichier = request.mimetype == "multipart/form-data" and request.endpoint in ENVOIS_DE_FICHIER
            if request.method != "DELETE" and not request.is_json and not fichier:
                return jsonify(erreur="Le corps doit être du JSON."), 415
            # L'administration a ses propres cookies et son propre jeton (admin.py)
            if g.user and not request.path.startswith("/api/admin/"):   # une session valide agit : elle doit prouver qu'elle vient de nos pages
                fourni = request.headers.get(security.EN_TETE_CSRF, "")
                if not fourni or not secrets.compare_digest(fourni, security.jeton_csrf(jeton)):
                    auditer("csrf.refus", ressource=f"{request.method} {request.path}", resultat="refus")
                    return jsonify(erreur="Requête refusée (jeton de sécurité absent ou faux)."), 403
        return None

    @app.before_request
    def ferme_par_defaut():
        if request.endpoint is None:
            return None   # 404 géré plus bas
        vue = app.view_functions.get(request.endpoint)
        if getattr(vue, "_sozo", None) is None:
            auditer("route.non_declaree", ressource=request.path, resultat="refus")
            return jsonify(erreur="Accès refusé."), 403
        return None

    @app.after_request
    def entetes(rep):
        rep.headers["Content-Security-Policy"] = CSP
        rep.headers["X-Content-Type-Options"] = "nosniff"
        rep.headers["X-Frame-Options"] = "DENY"
        rep.headers["Referrer-Policy"] = "no-referrer"
        rep.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        rep.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        if config.https_force():
            rep.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if request.path.startswith("/api/"):
            # Aucune réponse d'API en cache partagé : elles dépendent de la
            # personne (et de ses droits sur des pages payantes).
            rep.headers["Cache-Control"] = "no-store"
        elif rep.mimetype == "text/html" or request.path in ("/app/sw.js",):
            rep.headers["Cache-Control"] = "no-cache"
        elif request.args.get("v"):
            # Fichier VERSIONNÉ (app.css?v=22) : son contenu ne changera jamais
            # sous cette adresse ; une nouvelle version change l'adresse. Le
            # navigateur le garde un an sans redemander — en 2G, chaque
            # revalidation coûtait un aller-retour (~0,8 s) par fichier et par page.
            rep.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif os.path.splitext(request.path)[1].lower() in (".jpg", ".jpeg", ".png", ".webp", ".woff2", ".ico", ".svg") \
                or request.path.startswith(("/app/bible/", "/app/langue/")):
            rep.headers["Cache-Control"] = "public, max-age=604800"      # images, polices, Bible, dictionnaire : 7 jours
        else:
            rep.headers["Cache-Control"] = "no-cache"                    # non versionné : toujours revérifié
        return _compresser(rep)

    @app.errorhandler(Invalide)
    def invalide(e):
        return jsonify(erreur=e.message, champ=e.champ), 400

    @app.errorhandler(404)
    def introuvable(e):
        if request.path.startswith("/api/"):
            return jsonify(erreur="Introuvable."), 404
        return "Page introuvable.", 404, {"Content-Type": "text/plain; charset=utf-8"}

    @app.errorhandler(405)
    def methode(e):
        return jsonify(erreur="Méthode non autorisée."), 405

    @app.errorhandler(413)
    def trop_gros(e):
        return jsonify(erreur="Fichier trop volumineux."), 413

    @app.errorhandler(Exception)
    def erreur(e):
        # Le détail reste dans les journaux du serveur, avec un numéro que
        # l'utilisateur peut transmettre. Rien d'interne ne sort.
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            return e
        ref = secrets.token_hex(4)
        journal.exception("erreur %s sur %s", ref, request.path)
        return jsonify(erreur="Une erreur est survenue.", reference=ref), 500

    return app


def routes_non_declarees(app):
    """Pour le test « fermé par défaut » : toute vue sans déclaration."""
    return sorted(ep for ep, vue in app.view_functions.items() if getattr(vue, "_sozo", None) is None)


if __name__ == "__main__":   # développement uniquement ; production : gunicorn
    creer_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "4385")), debug=False)
