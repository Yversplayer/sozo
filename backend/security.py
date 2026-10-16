"""Sécurité des comptes : mots de passe, jetons, sessions, CSRF, débit.

Exigences (INSPIRATION_SECURITE_BACKEND.md §4) et le bug réel derrière chacune :
* mots de passe PBKDF2-HMAC-SHA256, sel aléatoire, 310 000 itérations,
  comparaison en temps constant ;
* jetons (session, vérification, réinitialisation) aléatoires ; seule leur
  EMPREINTE SHA-256 est en base : une fuite de la base ne donne aucune
  session utilisable ;
* session dans un cookie HttpOnly + SameSite=Strict (+ Secure en HTTPS),
  jamais dans le JavaScript ;
* CSRF : second cookie lisible, dérivé du jeton avec un préfixe distinct —
  jamais égal à l'empreinte stockée — renvoyé dans X-CSRF-Token ;
* jetons à usage unique consommés de façon ATOMIQUE (Klassio : une même
  invitation consommée deux fois en parallèle) ;
* limitation de débit par compte ET par IP.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

ITERATIONS = 310_000
DUREE_SESSION = timedelta(days=30)
COOKIE_SESSION = "sozo_session"
COOKIE_CSRF = "sozo_csrf"
EN_TETE_CSRF = "X-CSRF-Token"


def _utc(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def maintenant():
    return datetime.now(timezone.utc)


# ── Mots de passe ──────────────────────────────────────────────────────────

def hacher_mot_de_passe(mdp):
    sel = secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", mdp.encode("utf-8"), sel, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${sel.hex()}${h.hex()}"


def verifier_mot_de_passe(mdp, stocke):
    try:
        algo, it, sel, h = stocke.split("$")
        if algo != "pbkdf2_sha256":
            return False
        calc = hashlib.pbkdf2_hmac("sha256", mdp.encode("utf-8"), bytes.fromhex(sel), int(it))
        return hmac.compare_digest(calc.hex(), h)
    except (ValueError, AttributeError):
        return False


# Calculée une fois : sert à « vérifier » un mot de passe quand le compte
# n'existe pas, pour que la durée de réponse ne trahisse pas son existence.
_LEURRE = None


def verifier_leurre(mdp):
    global _LEURRE
    if _LEURRE is None:
        _LEURRE = hacher_mot_de_passe(secrets.token_hex(8))
    verifier_mot_de_passe(mdp, _LEURRE)
    return False


# ── Jetons ─────────────────────────────────────────────────────────────────

def nouveau_jeton():
    return secrets.token_urlsafe(32)


def empreinte(jeton):
    return hashlib.sha256(("sozo:" + jeton).encode("utf-8")).hexdigest()


def jeton_csrf(jeton_session):
    """Dérivé du jeton de session avec un AUTRE préfixe : il n'est jamais
    égal à l'empreinte stockée en base, et ne permet pas de la retrouver."""
    return hashlib.sha256(("csrf:" + jeton_session).encode("utf-8")).hexdigest()


# ── Sessions ───────────────────────────────────────────────────────────────

def ouvrir_session(cx, user_id, ip, agent):
    jeton = nouveau_jeton()
    m = maintenant()
    cx.execute(
        "INSERT INTO sessions (user_id, token_hash, created_at, expires_at, last_seen, ip, agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, empreinte(jeton), _utc(m), _utc(m + DUREE_SESSION), _utc(m), ip, (agent or "")[:200]))
    # Ménage : les sessions expirées de ce compte disparaissent
    cx.execute("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?", (user_id, _utc(m)))
    return jeton


def lire_session(cx, jeton):
    if not jeton or len(jeton) > 100:
        return None
    return cx.un(
        """SELECT u.id, u.email, u.nom, u.role, u.email_verifie_at, u.theme, s.id AS session_id
             FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.actif = 1""",
        (empreinte(jeton), _utc(maintenant())))


def revoquer_session(cx, session_id):
    cx.execute("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", (_utc(maintenant()), session_id))


def revoquer_toutes(cx, user_id, sauf=None):
    """Changement de mot de passe, désactivation : plus aucune session ancienne."""
    cx.execute("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id <> ?",
               (_utc(maintenant()), user_id, sauf or 0))


def poser_cookies(rep, jeton, https):
    age = int(DUREE_SESSION.total_seconds())
    rep.set_cookie(COOKIE_SESSION, jeton, max_age=age, httponly=True, secure=https, samesite="Strict", path="/")
    rep.set_cookie(COOKIE_CSRF, jeton_csrf(jeton), max_age=age, httponly=False, secure=https, samesite="Strict", path="/")


def effacer_cookies(rep):
    rep.delete_cookie(COOKIE_SESSION, path="/")
    rep.delete_cookie(COOKIE_CSRF, path="/")


# ── Jetons à usage unique (vérification d'e-mail, réinitialisation) ────────

def creer_jeton_usage_unique(cx, user_id, nature, duree):
    jeton = nouveau_jeton()
    cx.execute("INSERT INTO jetons (user_id, nature, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
               (user_id, nature, empreinte(jeton), _utc(maintenant() + duree), _utc(maintenant())))
    return jeton


def consommer_jeton(cx, jeton, nature):
    """Consommation ATOMIQUE : une seule requête marque le jeton comme utilisé
    SI ET SEULEMENT SI il ne l'était pas. Deux requêtes simultanées : une
    seule obtient une ligne modifiée. Rend l'id du compte, ou None."""
    if not jeton or len(jeton) > 100:
        return None
    cur = cx.execute(
        "UPDATE jetons SET used_at = ? WHERE token_hash = ? AND nature = ? AND used_at IS NULL AND expires_at > ?",
        (_utc(maintenant()), empreinte(jeton), nature, _utc(maintenant())))
    if cur.rowcount != 1:
        return None
    ligne = cx.un("SELECT user_id FROM jetons WHERE token_hash = ?", (empreinte(jeton),))
    return ligne["user_id"] if ligne else None


# ── Codes à 6 chiffres, à durée limitée ───────────────────────────────────

DUREE_CODE = timedelta(minutes=15)
ESSAIS_CODE = 5


def _empreinte_code(user_id, objet, code):
    return empreinte(f"code:{objet}:{user_id}:{code}")


def creer_code(cx, user_id, objet):
    """Un code neuf ; l'ancien, s'il en restait un, cesse de valoir."""
    m = maintenant()
    cx.execute("UPDATE codes SET used_at = ? WHERE user_id = ? AND objet = ? AND used_at IS NULL", (_utc(m), user_id, objet))
    code = f"{secrets.randbelow(10 ** 6):06d}"
    cx.execute("INSERT INTO codes (user_id, objet, empreinte, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
               (user_id, objet, _empreinte_code(user_id, objet, code), _utc(m + DUREE_CODE), _utc(m)))
    return code


def verifier_code(cx, user_id, objet, code):
    """Vrai si le code est le bon, encore valable, et consommé PAR CET APPEL.

    Chaque essai est compté AVANT la comparaison, par une mise à jour atomique
    bornée à ESSAIS_CODE : un million de combinaisons ne se parcourent pas en
    5 essais. Le succès consomme le code (used_at) en une seule mise à jour :
    deux requêtes simultanées avec le bon code, une seule réussit."""
    if not code or not str(code).isdigit() or len(str(code)) != 6:
        return False
    m = _utc(maintenant())
    c = cx.un("SELECT id FROM codes WHERE user_id = ? AND objet = ? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1",
              (user_id, objet, m))
    if not c:
        return False
    if cx.execute("UPDATE codes SET essais = essais + 1 WHERE id = ? AND essais < ?", (c["id"], ESSAIS_CODE)).rowcount != 1:
        return False
    bon = cx.un("SELECT empreinte FROM codes WHERE id = ?", (c["id"],))["empreinte"]
    if not secrets.compare_digest(bon, _empreinte_code(user_id, objet, str(code))):
        return False
    return cx.execute("UPDATE codes SET used_at = ? WHERE id = ? AND used_at IS NULL", (m, c["id"])).rowcount == 1


# ── Limitation de débit ────────────────────────────────────────────────────

LIMITES = {
    # action : (essais, fenêtre en minutes)
    "connexion:ip": (20, 15),
    "connexion:compte": (6, 15),
    "inscription:ip": (6, 60),
    "reinit:ip": (6, 60),
    "reinit:compte": (3, 60),
    "verification:ip": (20, 60),
    "code:ip": (30, 15),               # saisies de code (mot de passe oublié)
    "code:compte": (10, 15),
    "codemdp:compte": (5, 60),         # demandes de code pour changer de mot de passe
    "mdp:compte": (10, 15),            # essais du mot de passe actuel
    "lecture:compte": (300, 10),       # pages servies : au-delà, c'est une aspiration
    "paiement:compte": (30, 60),
    "import:compte": (20, 60),
    "admin:ip": (10, 15),
    "admin:compte": (5, 15),
    "admin:reauth": (5, 15),     # codes de confirmation, comptés à part de la connexion
}


def depasse(cx, action, cle):
    """Compte un essai et dit si la limite est dépassée. Atomique (UPSERT) :
    deux requêtes simultanées ne lisent pas le même compteur."""
    essais, minutes = LIMITES[action]
    m = maintenant()
    debut_min = _utc(m - timedelta(minutes=minutes))
    k = f"{action}:{cle}"[:300]
    cx.execute(
        """INSERT INTO rate_limits (cle, debut, n) VALUES (?, ?, 1)
           ON CONFLICT (cle) DO UPDATE SET
             n = CASE WHEN rate_limits.debut < ? THEN 1 ELSE rate_limits.n + 1 END,
             debut = CASE WHEN rate_limits.debut < ? THEN excluded.debut ELSE rate_limits.debut END""",
        (k, _utc(m), debut_min, debut_min))
    ligne = cx.un("SELECT n FROM rate_limits WHERE cle = ?", (k,))
    return ligne["n"] > essais
