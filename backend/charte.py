"""Lot E (21/10/2026) : la charte de la communauté, acceptée AVANT de publier
un écrit ou de commenter.

Le fil des écrits et les commentaires sont la partie de Sōzō où n'importe quel
compte parle à tous les autres. La charte (app/charte.html) dit ce qui y est
accepté ; la modération s'y réfère quand elle retire quelque chose.

* L'acceptation est tenue par le SERVEUR : publier ou commenter sans elle
  rend 403 (code « charte »). L'interface affiche alors la charte et rejoue
  la demande une fois acceptée — un navigateur modifié ne la contourne pas.
* Elle est datée et VERSIONNÉE : si la charte change, VERSION change, et
  chacun l'accepte de nouveau avant son prochain écrit ou commentaire.
* Lire, aimer, garder, signaler restent libres : ils n'exposent rien au public.
"""
from flask import g, jsonify, request

import acces
import db
import validation as v
from app import auditer, connectee

VERSION = "2026-10-21"


def acceptee(cx, uid):
    u = cx.un("SELECT charte_version FROM users WHERE id = ?", (uid,))
    return bool(u) and u["charte_version"] == VERSION


def refus():
    return jsonify(erreur="Acceptez la charte de la communauté pour publier ou commenter.", code="charte", version=VERSION), 403


def enregistrer(app):

    @app.post("/api/moi/charte")
    @connectee
    def accepter_charte():
        # La version lue par la personne doit être la version EN VIGUEUR : un
        # onglet resté ouvert sur l'ancienne charte ne vaut pas acceptation.
        version = v.texte(v.corps_json(request), "version", maxi=20)
        if version != VERSION:
            return jsonify(erreur="La charte a changé : relisez-la avant de l’accepter.", code="charte", version=VERSION), 409
        cx = db.connecter()
        try:
            cx.execute("UPDATE users SET charte_version = ?, charte_le = ? WHERE id = ?", (VERSION, acces.maintenant(), g.user["id"]))
            auditer("charte.acceptation", ressource=f"user:{g.user['id']}", apres=VERSION, cx=cx)
            cx.valider()
            return jsonify(ok=True, version=VERSION)
        finally:
            cx.fermer()
