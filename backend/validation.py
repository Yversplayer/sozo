"""Validation centrale des entrées — toute route la traverse.

Règles :
* le corps JSON doit être un OBJET ; sinon 400 ;
* chaque champ est lu par une fonction de ce module (type, longueur, format) ;
* un champ inattendu est ignoré : il ne décide JAMAIS d'un droit (rôle,
  propriétaire, prix payé, état d'une page viennent du serveur).
"""
import re
from datetime import datetime, timezone


class Invalide(Exception):
    """Entrée refusée : rend une erreur 400 lisible, sans détail interne."""

    def __init__(self, message, champ=None):
        super().__init__(message)
        self.message = message
        self.champ = champ


def corps_json(request):
    donnees = request.get_json(silent=True)
    if not isinstance(donnees, dict):
        raise Invalide("Le corps de la requête doit être un objet JSON.")
    return donnees


def texte(d, champ, *, requis=True, mini=0, maxi=200, multiligne=False):
    v = d.get(champ)
    if v is None or (isinstance(v, str) and not v.strip()):
        if requis:
            raise Invalide(f"« {champ} » est requis.", champ)
        return None
    if not isinstance(v, str):
        raise Invalide(f"« {champ} » doit être un texte.", champ)
    v = v.strip() if not multiligne else v.replace("\r\n", "\n")
    if not multiligne and ("\n" in v or "\r" in v):
        raise Invalide(f"« {champ} » ne doit tenir que sur une ligne.", champ)
    if "\x00" in v:
        raise Invalide(f"« {champ} » contient un caractère interdit.", champ)
    if len(v) < mini:
        raise Invalide(f"« {champ} » compte au moins {mini} caractères.", champ)
    if len(v) > maxi:
        raise Invalide(f"« {champ} » compte au plus {maxi} caractères.", champ)
    return v


_EMAIL = re.compile(r"^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$")


def email(d, champ="email"):
    v = texte(d, champ, maxi=254)
    if not _EMAIL.match(v):
        raise Invalide("Cette adresse e-mail ne semble pas valide.", champ)
    return v.lower()


def entier(d, champ, *, requis=True, mini=None, maxi=None):
    v = d.get(champ)
    if v is None:
        if requis:
            raise Invalide(f"« {champ} » est requis.", champ)
        return None
    if isinstance(v, bool) or not isinstance(v, int):
        raise Invalide(f"« {champ} » doit être un nombre entier.", champ)
    if (mini is not None and v < mini) or (maxi is not None and v > maxi):
        raise Invalide(f"« {champ} » est hors limites.", champ)
    return v


def centimes(d, champ, *, requis=True, maxi=100_000):
    """Un prix arrive en CENTIMES entiers (0,25 $ → 25). Jamais de flottant :
    0,1 + 0,2 ≠ 0,3 en virgule flottante, et c'est de l'argent."""
    return entier(d, champ, requis=requis, mini=0, maxi=maxi)


def choix(d, champ, valeurs, *, requis=True):
    v = d.get(champ)
    if v is None and not requis:
        return None
    if v not in valeurs:
        raise Invalide(f"« {champ} » doit valoir : {', '.join(sorted(valeurs))}.", champ)
    return v


_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$")


def date_heure(d, champ, *, requis=True):
    """Date et heure ISO 8601, ramenées en UTC (« 2026-10-15T20:00:00Z »)."""
    v = d.get(champ)
    if v is None and not requis:
        return None
    if not isinstance(v, str) or not _DATE.match(v):
        raise Invalide(f"« {champ} » doit être une date et une heure (AAAA-MM-JJTHH:MM).", champ)
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        raise Invalide(f"« {champ} » n'est pas une date valide.", champ)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def maintenant():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
