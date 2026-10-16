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
