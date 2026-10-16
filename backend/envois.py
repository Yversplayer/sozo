"""Expédition de la file `envois` (e-mails et notifications d'appareil).

Une ligne n'est expédiée que par UN processus : elle est réservée par une
mise à jour atomique (attente → en_cours) avant tout envoi. Sans cela, le fil
déclenché après une requête et la tâche périodique pouvaient envoyer deux fois
le même code. Une réservation restée « en_cours » plus de 10 minutes (serveur
tombé pendant l'envoi) redevient disponible.

Reprises : 1 min, 5 min, 30 min, 2 h ; au 5e échec, « abandonne ». Une erreur
définitive (adresse refusée, configuration absente) abandonne tout de suite.
"""
import threading
from datetime import datetime, timedelta, timezone

import db
import mailer

PALIERS = [1, 5, 30, 120]
MAX_ESSAIS = 5


def _iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def _maintenant():
    return datetime.now(timezone.utc)


def _expedier(e):
    if e["canal"] == "email":
        return mailer.expedier(e["destinataire"], e["sujet"], e["texte"], e["html"])
    import push
    return push.expedier(e)


def distribuer(limite=50, ids=None):
    """Expédie ce qui est dû. Rend {envoyes, echecs, abandons}."""
    bilan = {"envoyes": 0, "echecs": 0, "abandons": 0}
    m = _maintenant()
    cx = db.connecter(globale=True)
    try:
        filtre = f" AND id IN ({','.join('?' * len(ids))})" if ids else ""
        candidats = cx.tous(f"""SELECT id FROM envois WHERE (etat = 'attente' AND prochain_essai <= ?)
                                OR (etat = 'en_cours' AND prochain_essai <= ?){filtre} ORDER BY id LIMIT ?""",
                            (_iso(m), _iso(m - timedelta(minutes=10)), *(ids or []), limite))
        for c in candidats:
            # Réservation atomique : une seule connexion obtient la ligne
            pris = cx.execute("""UPDATE envois SET etat = 'en_cours', prochain_essai = ? WHERE id = ?
                                 AND (etat = 'attente' OR (etat = 'en_cours' AND prochain_essai <= ?))""",
                              (_iso(_maintenant()), c["id"], _iso(m - timedelta(minutes=10)))).rowcount == 1
            cx.valider()
            if not pris:
                continue
            e = cx.un("SELECT * FROM envois WHERE id = ?", (c["id"],))
            try:
                _expedier(e)
            except Exception as err:          # noqa: BLE001 — toute panne de canal est consignée, jamais propagée
                temporaire = getattr(err, "temporaire", True)
                essais = e["essais"] + 1
                if not temporaire or essais >= MAX_ESSAIS:
                    cx.execute("UPDATE envois SET etat = 'abandonne', essais = ?, erreur = ? WHERE id = ?", (essais, str(err)[:300], e["id"]))
                    bilan["abandons"] += 1
                else:
                    suite = _maintenant() + timedelta(minutes=PALIERS[min(essais - 1, len(PALIERS) - 1)])
                    cx.execute("UPDATE envois SET etat = 'attente', essais = ?, erreur = ?, prochain_essai = ? WHERE id = ?",
                               (essais, str(err)[:300], _iso(suite), e["id"]))
                    bilan["echecs"] += 1
                cx.valider()
                continue
            # Envoyé. Un code de sécurité n'a plus à rester lisible en base.
            if e["sensible"]:
                cx.execute("UPDATE envois SET etat = 'envoye', envoye_le = ?, erreur = NULL, texte = '[contenu effacé après envoi]', html = NULL WHERE id = ?",
                           (_iso(_maintenant()), e["id"]))
            else:
                cx.execute("UPDATE envois SET etat = 'envoye', envoye_le = ?, erreur = NULL WHERE id = ?", (_iso(_maintenant()), e["id"]))
            cx.valider()
            bilan["envoyes"] += 1
    finally:
        cx.fermer()
    return bilan


def declencher():
    """Après la validation d'une requête : expédie tout de suite, sans faire
    attendre la personne (un code doit arriver en secondes, pas au prochain
    passage de la tâche périodique). En mode capture, il n'y a rien à faire."""
    import config
    if config.email_mode() == "capture" and not config.push_actif():
        return
    t = threading.Thread(target=_sans_bruit, daemon=True)
    t.start()
    return t


def _sans_bruit():
    try:
        distribuer(limite=20)
    except Exception:                         # noqa: BLE001 — la tâche périodique reprendra
        pass
