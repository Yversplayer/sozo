"""Configuration de Sōzō — tout vient des variables d'environnement.

Aucun secret dans le dépôt : ils sont saisis par le propriétaire dans
l'hébergeur (Render) et documentés dans `.env.example` ([SECRET] / [PUBLIC]).
"""
import os

RACINE_BACKEND = os.path.dirname(os.path.abspath(__file__))
RACINE_SITE = os.path.abspath(os.path.join(RACINE_BACKEND, ".."))


def _bool(nom, defaut=False):
    v = os.environ.get(nom)
    if v is None:
        return defaut
    return v.strip().lower() in ("1", "true", "oui", "yes", "on")


def moteur():
    """« sqlite » (développement, défaut) ou « postgres » (production, tests PG)."""
    m = os.environ.get("SOZO_DB_BACKEND", "sqlite").strip().lower()
    if m not in ("sqlite", "postgres"):
        raise RuntimeError("SOZO_DB_BACKEND doit valoir « sqlite » ou « postgres ».")
    return m


def chemin_sqlite():
    return os.environ.get("SOZO_DB_PATH", os.path.join(RACINE_BACKEND, "sozo.db"))


def url_postgres():
    url = os.environ.get("SOZO_DATABASE_URL", "")
    if moteur() == "postgres" and not url:
        raise RuntimeError("SOZO_DATABASE_URL manque alors que SOZO_DB_BACKEND=postgres.")
    return url


def schema_postgres():
    """Schéma PostgreSQL de travail : « public » en production, un schéma
    jetable pendant les tests (jamais les tables réelles)."""
    s = os.environ.get("SOZO_PG_SCHEMA", "public")
    if not s.replace("_", "").isalnum():
        raise RuntimeError("SOZO_PG_SCHEMA invalide.")
    return s


def base_distante():
    """Vrai si la base n'est pas sur cette machine. Sert à REFUSER les
    réglages de test (contournements) loin d'un poste de développement."""
    if moteur() == "sqlite":
        return False
    url = url_postgres()
    return not any(h in url for h in ("@localhost", "@127.0.0.1", "host=localhost", "host=127.0.0.1", "%2Ftmp", "host=/"))


def mode_test():
    """SOZO_MODE_TEST=1 n'est accepté que sur une base locale.

    Pourquoi : un réglage de test qui contourne une règle (limitation de
    débit, envoi d'e-mails…) ne doit jamais pouvoir s'activer en production
    par une variable oubliée. Klassio a gardé cette leçon de son
    contournement d'abonnement : refusé sur une base distante."""
    if not _bool("SOZO_MODE_TEST"):
        return False
    if base_distante():
        raise RuntimeError("SOZO_MODE_TEST est refusé sur une base distante.")
    return True


def https_force():
    """En production, derrière Cloudflare : HSTS et cookies « Secure »."""
    return _bool("SOZO_HTTPS", defaut=False)


def secret_proxy():
    """[SECRET] Secret partagé avec le Worker Cloudflare : seule une requête
    qui le porte peut annoncer l'IP réelle du visiteur (étape 2)."""
    return os.environ.get("SOZO_SECRET_PROXY", "")


# ── Argent (étape 5) — PROPOSITIONS de démonstration, à fixer par le propriétaire ──
def commission_pct(plume=False):
    """Commission Sōzō sur une vente, en pourcentage entier."""
    return int(os.environ.get("SOZO_COMMISSION_PLUME_PCT" if plume else "SOZO_COMMISSION_PCT", "10" if plume else "15"))


def plume_prix_centimes():
    return int(os.environ.get("SOZO_PLUME_PRIX_CENTIMES", "499"))


def numeros_paiement():
    """[PUBLIC] Où le lecteur envoie son paiement Mobile Money, en attendant un
    agrégateur. Format : « M-Pesa=+243…,Orange Money=+243… ». Vide = les
    paiements ne sont pas ouverts (sauf en mode test, clairement signalé)."""
    brut = os.environ.get("SOZO_PAIEMENT_NUMEROS", "").strip()
    out = []
    for part in brut.split(","):
        if "=" in part:
            nom, num = part.split("=", 1)
            if nom.strip() and num.strip():
                out.append({"operateur": nom.strip(), "numero": num.strip()})
    return out


def secret_webhook(prestataire):
    """[SECRET] Secret HMAC des notifications d'un prestataire de paiement."""
    if not prestataire.replace("_", "").isalnum():
        return ""
    return os.environ.get("SOZO_WEBHOOK_SECRET_" + prestataire.upper(), "")


# ── Messages sortants (e-mail, notifications d'appareil) ───────────────────

# Adresse de contact du propriétaire (16/10/2026) : réponse aux e-mails,
# bas de page. Elle est publique par nature (affichée sur le site).
CONTACT_DEFAUT = "mudeyimusimwa@gmail.com"


def email_contact():
    """[PUBLIC] Adresse où les lecteurs et auteurs répondent."""
    return os.environ.get("SOZO_EMAIL_CONTACT", CONTACT_DEFAUT).strip()


def email_mode():
    """capture (défaut) : rien ne part, le message est rangé ; smtp : un serveur
    SMTP (Gmail avec mot de passe d'application suffit pour démarrer) ;
    brevo : l'API Brevo ; fail : panne simulée, pour les tests de reprise."""
    m = os.environ.get("SOZO_EMAIL_MODE", "capture").strip().lower()
    if m not in ("capture", "smtp", "brevo", "fail"):
        raise RuntimeError("SOZO_EMAIL_MODE doit valoir capture, smtp, brevo ou fail.")
    return m


def email_expediteur():
    """[PUBLIC] Adresse d'expédition. Avec Gmail SMTP, ce DOIT être le compte
    Gmail lui-même (Gmail réécrit sinon l'expéditeur) ; avec Brevo, une
    adresse vérifiée chez Brevo."""
    return os.environ.get("SOZO_EMAIL_FROM", "").strip() or email_contact()


def smtp():
    """[SECRET pour le mot de passe] Réglages SMTP. TLS obligatoire, sauf vers
    un serveur local (tests) : un mot de passe ne voyage jamais en clair."""
    hote = os.environ.get("SOZO_SMTP_HOST", "smtp.gmail.com").strip()
    tls = os.environ.get("SOZO_SMTP_TLS", "starttls").strip().lower()
    if tls not in ("starttls", "ssl", "aucun"):
        raise RuntimeError("SOZO_SMTP_TLS doit valoir starttls, ssl ou aucun.")
    if tls == "aucun" and hote not in ("localhost", "127.0.0.1"):
        raise RuntimeError("SMTP sans chiffrement refusé hors d'un serveur local.")
    return {"hote": hote, "port": int(os.environ.get("SOZO_SMTP_PORT", "465" if tls == "ssl" else "587")), "tls": tls,
            "utilisateur": os.environ.get("SOZO_SMTP_USER", "").strip() or email_expediteur(),
            "mot_de_passe": os.environ.get("SOZO_SMTP_PASSWORD", "")}


def brevo_cle():
    """[SECRET] Clé API Brevo."""
    return os.environ.get("SOZO_BREVO_API_KEY", "")


def url_site():
    """[PUBLIC] Adresse publique du site, pour les liens des messages. Sans
    elle, un lien reçu sur un téléphone pointerait vers localhost."""
    return os.environ.get("SOZO_APP_URL", "http://localhost:4385").rstrip("/")


def vapid():
    """[SECRET pour la clé privée] Clés VAPID des notifications d'appareil
    (Web Push). Absentes : aucune notification d'appareil ne part, et
    l'interface le dit au lieu de faire semblant."""
    prive, public = os.environ.get("SOZO_VAPID_PRIVE", "").strip(), os.environ.get("SOZO_VAPID_PUBLIC", "").strip()
    if not (prive and public) and _bool("SOZO_VAPID_DEV") and _bool("SOZO_MODE_TEST") and not base_distante():
        # Poste de développement seulement : clés rangées par tools/vapid.py --dev
        chemin = os.path.join(RACINE_BACKEND, "stockage", "vapid.json")
        if os.path.isfile(chemin):
            import json
            with open(chemin) as f:
                k = json.load(f)
            prive, public = k.get("prive", ""), k.get("public", "")
    if not (prive and public) and _bool("SOZO_VAPID_AUTO"):
        prive, public = _vapid_auto()
    return {"prive": prive, "public": public, "contact": "mailto:" + email_contact()}


_VAPID_AUTO = {}


def _vapid_auto():
    """Clés générées par le serveur au premier besoin et gardées dans la base
    (table reglages), pour que personne n'ait à recopier une clé privée dans
    l'hébergeur. Écrites UNE fois (ON CONFLICT DO NOTHING) : plusieurs
    processus qui démarrent ensemble relisent tous la même paire. Une paire
    qui changerait obligerait chaque appareil inscrit à se réinscrire."""
    ou = (moteur(), url_postgres() if moteur() == "postgres" else chemin_sqlite(), schema_postgres())
    if ou in _VAPID_AUTO:
        return _VAPID_AUTO[ou]
    import base64
    import json
    from datetime import datetime, timezone

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    import db
    b64 = lambda o: base64.urlsafe_b64encode(o).rstrip(b"=").decode()  # noqa: E731
    k = ec.generate_private_key(ec.SECP256R1())
    neuve = json.dumps({"prive": b64(k.private_numbers().private_value.to_bytes(32, "big")),
                        "public": b64(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))})
    cx = db.connecter(globale=True)
    try:
        cx.execute("INSERT INTO reglages (cle, valeur, created_at) VALUES ('vapid', ?, ?) ON CONFLICT (cle) DO NOTHING",
                   (neuve, datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")))
        paire = json.loads(cx.un("SELECT valeur FROM reglages WHERE cle = 'vapid'")["valeur"])
        cx.valider()
    finally:
        cx.fermer()
    _VAPID_AUTO[ou] = (paire["prive"], paire["public"])
    return _VAPID_AUTO[ou]


def push_actif():
    v = vapid()
    return bool(v["prive"] and v["public"])
