"""Conservation des manuscrits d'origine — décision du 16/10/2026.

Le fichier importé (PDF, EPUB, DOCX) ne sert plus une fois son texte extrait :
le texte vit dans les pages, versionné, et c'est lui que l'auteur corrige. Le
garder indéfiniment n'apporte rien et expose une œuvre souvent INÉDITE (une
fuite du stockage livrerait des livres entiers non publiés).

Règle :
  · le fichier d'origine est conservé 90 jours après l'import (le temps de
    vérifier le découpage, ou de le refaire), puis effacé ;
  · il est effacé aussitôt si le compte de l'auteur est supprimé ;
  · la trace de l'import (nom, taille, empreinte, pages créées) reste, avec la
    date d'effacement : on sait ce qui a existé, sans garder le contenu.
Durée réglable : SOZO_CONSERVATION_MANUSCRITS_JOURS.

Deux auteurs peuvent importer le MÊME fichier (même empreinte, donc même nom
sur disque) : il n'est effacé que lorsqu'aucun import encore conservé ne le
référence.
"""
import os
from datetime import datetime, timedelta, timezone

import config
import db
from validation import maintenant

DOSSIER = os.path.join(config.RACINE_BACKEND, "stockage", "manuscrits")


def jours():
    try:
        return max(1, int(os.environ.get("SOZO_CONSERVATION_MANUSCRITS_JOURS", "90")))
    except ValueError:
        return 90


def echeance(created_at):
    d = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ") + timedelta(days=jours())
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def _effacer(cx, lignes):
    m = maintenant()
    n = 0
    for imp in lignes:
        cx.execute("UPDATE imports SET efface_le = ? WHERE id = ? AND efface_le IS NULL", (m, imp["id"]))
        encore = cx.un("SELECT COUNT(*) AS n FROM imports WHERE empreinte = ? AND efface_le IS NULL", (imp["empreinte"],))["n"]
        if not encore:
            chemin = os.path.join(DOSSIER, f"{imp['empreinte']}.{imp['nature']}")
            if os.path.isfile(chemin):
                os.remove(chemin)
                n += 1
    return n


def purger():
    """Efface les originaux arrivés à échéance. Rend le nombre de fichiers effacés."""
    limite = (datetime.now(timezone.utc) - timedelta(days=jours())).strftime("%Y-%m-%dT%H:%M:%SZ")
    cx = db.connecter(globale=True)
    try:
        n = _effacer(cx, cx.tous("SELECT id, empreinte, nature FROM imports WHERE efface_le IS NULL AND created_at < ?", (limite,)))
        cx.valider()
        return n
    finally:
        cx.fermer()


def effacer_pour(user_id):
    """Suppression d'un compte : ses originaux partent tout de suite. Appelé
    APRÈS la validation de la suppression : un fichier effacé ne revient pas,
    on ne l'efface donc que pour une suppression acquise."""
    cx = db.connecter(globale=True)
    try:
        n = _effacer(cx, cx.tous("SELECT id, empreinte, nature FROM imports WHERE user_id = ? AND efface_le IS NULL", (user_id,)))
        cx.valider()
        return n
    finally:
        cx.fermer()
