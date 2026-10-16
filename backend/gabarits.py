"""Gabarits des e-mails de Sōzō : une page HTML sobre aux couleurs de la
marque (bordeaux, blanc cassé, or) et sa version texte.

Tout contenu variable passe par `_e()` : un nom d'utilisateur ou un titre de
livre est saisi par n'importe qui, il ne doit jamais devenir du HTML. Les
styles sont EN LIGNE : la plupart des messageries ignorent les feuilles de
style. Aucune image distante : rien ne « piste » l'ouverture du message.
"""
import html

import config

BORDEAUX, CREME, OR, ENCRE = "#6B0F1A", "#F8F5EB", "#D4AF37", "#2A1014"


def _e(v):
    return html.escape(str(v or ""), quote=True)


def page(titre, paragraphes, *, code=None, bouton=None, note=None, raison=None):
    """Rend (html, texte). `bouton` = (libellé, url) ; `code` = un code à
    6 chiffres affiché en grand ; `raison` = pourquoi la personne reçoit ce
    message (une ligne, en bas)."""
    contact = config.email_contact()
    corps = "".join(f'<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:{ENCRE}">{_e(p)}</p>' for p in paragraphes)
    if code:
        corps += (f'<p style="margin:22px 0;text-align:center"><span style="display:inline-block;padding:14px 22px;border:2px solid {OR};'
                  f'border-radius:8px;font:600 32px/1 Menlo,Consolas,monospace;letter-spacing:8px;color:{BORDEAUX};background:#FFFDF8">{_e(code)}</span></p>')
    if bouton:
        corps += (f'<p style="margin:24px 0;text-align:center"><a href="{_e(bouton[1])}" style="display:inline-block;padding:13px 24px;'
                  f'background:{OR};color:#3A0810;text-decoration:none;border-radius:4px;font-weight:600;font-size:15px">{_e(bouton[0])}</a></p>')
    if note:
        corps += f'<p style="margin:18px 0 0;font-size:13.5px;line-height:1.5;color:#6E5A57">{_e(note)}</p>'
    pied = (f'{_e(raison) + "<br>" if raison else ""}Une question ? Répondez à ce message ou écrivez à '
            f'<a href="mailto:{_e(contact)}" style="color:{BORDEAUX}">{_e(contact)}</a>.<br>Sōzō — plus qu’une application, un chemin.')
    html_ = (f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
             f'<title>{_e(titre)}</title></head><body style="margin:0;background:{CREME};padding:24px 12px;font-family:Georgia,\'Times New Roman\',serif">'
             f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
             f'<table role="presentation" width="100%" style="max-width:560px;background:#FFFDF8;border:1px solid #E7DCC4;border-radius:10px" cellpadding="0" cellspacing="0">'
             f'<tr><td style="background:{BORDEAUX};border-radius:10px 10px 0 0;padding:20px 28px;color:{CREME};font-size:26px;letter-spacing:.5px">Sōzō'
             f'<span style="color:{OR}"> ✒</span></td></tr>'
             f'<tr><td style="padding:28px 28px 8px"><h1 style="margin:0 0 18px;font-size:24px;font-weight:500;color:{ENCRE}">{_e(titre)}</h1>{corps}</td></tr>'
             f'<tr><td style="padding:18px 28px 24px;border-top:1px solid #EFE6D2;font-family:Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#6E5A57">{pied}</td></tr>'
             f'</table></td></tr></table></body></html>')
    texte = titre + "\n\n" + "\n\n".join(paragraphes)
    if code:
        texte += f"\n\n    {code}\n"
    if bouton:
        texte += f"\n\n{bouton[0]} : {bouton[1]}"
    if note:
        texte += "\n\n" + note
    texte += ("\n\n—\n" + (raison + "\n" if raison else "") + f"Une question ? Écrivez à {contact}.\nSōzō — plus qu’une application, un chemin.\n")
    return html_, texte


def lien(chemin):
    return config.url_site() + chemin
