"""Qui peut lire quoi — LA source de vérité de Sōzō (comme school.py chez Klassio).

Aucune route ne réimplémente ces règles : elles appellent ce module.

État d'une page pour une personne donnée :
    'auteur'  le propriétaire du livre : il lit tout, brouillons compris
    'free'    gratuite et publiée
    'owned'   payante, publiée, couverte par un droit acquis (jamais retiré)
    'locked'  payante, publiée, non achetée → prix, jamais le texte
    'soon'    programmée → la date, jamais le texte
    None      invisible : brouillon d'un autre, livre retiré, page inexistante
              → la route répond 404 (un 403 dirait déjà « ça existe »)

Une page « programmée » dont la date est passée EST publiée : le statut
effectif se calcule à l'instant, il ne dépend d'aucune tâche planifiée qui
pourrait tomber en panne.

Sécurité de lecture (pratiques des liseuses numériques) :
* le texte ne sort que page par page, par l'API, après ce contrôle ; jamais
  un fichier entier, jamais le manuscrit source ;
* une page achetée porte un filigrane nominatif (visible dans la liseuse) et
  une marque invisible : une fuite reste traçable jusqu'au compte ;
* le débit de lecture est limité par compte (aspiration automatique).
"""
from datetime import datetime, timezone

LISIBLES = ("auteur", "free", "owned")


def maintenant():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def statut_effectif(page, a=None):
    if page["statut"] == "scheduled" and page["publie_le"] and page["publie_le"] <= (a or maintenant()):
        return "published"
    return page["statut"]


def livre(cx, user, book_id):
    """Le livre, s'il est visible pour cette personne ; sinon None (→ 404).
    Visible : par son propriétaire toujours ; par les autres s'il n'est pas
    retiré ET qu'au moins une page n'est plus un brouillon."""
    try:
        book_id = int(book_id)
    except (TypeError, ValueError):
        return None
    b = cx.un("SELECT * FROM books WHERE id = ?", (book_id,))
    if not b:
        return None
    if user and b["owner_id"] == user["id"]:
        return b
    if b["statut"] != "actif":
        # Livre retiré : il disparaît du catalogue, MAIS celui qui en a acheté
        # des pages les garde — un droit acquis n'est jamais retiré.
        if user and cx.un("SELECT id FROM entitlements WHERE user_id = ? AND book_id = ? AND revoque_le IS NULL LIMIT 1", (user["id"], book_id)):
            return b
        return None
    if not cx.un("SELECT id FROM pages WHERE book_id = ? AND statut <> 'draft' LIMIT 1", (book_id,)):
        return None
    return b


def droits(cx, user_id, book_id):
    """Plages de pages acquises : [(de, a_ou_None), …]."""
    if not user_id:
        return []
    return [(r["page_de"], r["page_a"]) for r in cx.tous(
        "SELECT page_de, page_a FROM entitlements WHERE user_id = ? AND book_id = ? AND revoque_le IS NULL", (user_id, book_id))]


def couverte(plages, n):
    return any(de <= n and (a is None or n <= a) for de, a in plages)


def etat_page(book, page, user, plages, a=None):
    """État d'une page — la règle, en un seul endroit."""
    if user and book["owner_id"] == user["id"]:
        return "auteur"
    if book["statut"] != "actif":
        # retiré : seules les pages déjà acquises restent lisibles
        return "owned" if page["acces"] == "paid" and statut_effectif(page, a) == "published" and couverte(plages, page["n"]) else None
    s = statut_effectif(page, a)
    if s == "draft":
        return None
    if s == "scheduled":
        return "soon"
    if page["acces"] == "free":
        return "free"
    return "owned" if couverte(plages, page["n"]) else "locked"


def page_et_etat(cx, user, book_id, n):
    """(livre, page, état) ou (None, None, None) si invisible."""
    b = livre(cx, user, book_id)
    if not b:
        return None, None, None
    try:
        n = int(n)
    except (TypeError, ValueError):
        return None, None, None
    p = cx.un("SELECT * FROM pages WHERE book_id = ? AND n = ?", (b["id"], n))
    if not p:
        return None, None, None
    e = etat_page(b, p, user, droits(cx, user["id"] if user else None, b["id"]))
    if e is None:
        return None, None, None
    return b, p, e


def contenu_courant(cx, page_id):
    v = cx.un("SELECT contenu, version FROM page_versions WHERE page_id = ? AND is_current = 1", (page_id,))
    return (v["contenu"], v["version"]) if v else ("", 0)


# ── Marque invisible : l'identifiant du lecteur, en caractères de largeur nulle ──
_ZW = {"0": "​", "1": "‌"}
_BORD = "⁠"


def marquer(contenu, user_id):
    """Insère, après le premier paragraphe, l'identifiant du compte codé en
    binaire avec des caractères invisibles. Le texte s'affiche à l'identique ;
    une copie qui circule désigne le compte qui l'a extraite."""
    code = _BORD + "".join(_ZW[b] for b in format(int(user_id), "b")) + _BORD
    i = contenu.find("\n")
    return contenu + code if i < 0 else contenu[:i] + code + contenu[i:]


def lire_marque(texte):
    a = texte.find(_BORD)
    b = texte.find(_BORD, a + 1)
    if a < 0 or b < 0:
        return None
    bits = "".join("0" if c == "​" else "1" for c in texte[a + 1:b] if c in ("​", "‌"))
    return int(bits, 2) if bits else None
