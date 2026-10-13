"""Envoi d'e-mails. Aujourd'hui : mode CAPTURE uniquement.

Le message est rédigé et rangé dans la table `emails` avec l'état
« capture » — rien ne part. Tant qu'aucun fournisseur n'est branché (et le
domaine vérifié : SPF/DKIM), l'interface ne dit jamais « e-mail envoyé ».
"""
from validation import maintenant


def preparer(cx, destinataire, sujet, corps):
    cx.execute("INSERT INTO emails (destinataire, sujet, corps, etat, created_at) VALUES (?, ?, ?, 'capture', ?)",
               (destinataire, sujet, corps, maintenant()))
    return "capture"
