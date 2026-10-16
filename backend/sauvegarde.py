"""Sauvegarde et RESTAURATION de Sōzō — une sauvegarde ne vaut que si l'on a
vu sa restauration réussir (règle de Klassio : « jamais restaurée » = « pas
de sauvegarde »).

Ce que contient une sauvegarde :
  · toutes les tables, ligne à ligne (export LOGIQUE : le même fichier se
    restaure sous SQLite ou sous PostgreSQL, ce qui sert aussi de passage de
    l'un à l'autre) ;
  · les manuscrits d'origine encore conservés ;
  · un manifeste : version du schéma, nombre de lignes et EMPREINTE de chaque
    table, pour prouver après coup que la base restaurée est identique.
Ce qu'elle ne contient PAS, exprès : les sessions (après une restauration,
chacun se reconnecte), les compteurs de limitation de débit, les codes à
6 chiffres (ils expirent en 15 minutes de toute façon).

Chiffrement : Fernet (AES-128-CBC + HMAC-SHA256) avec SOZO_CLE_SAUVEGARDE. Le
fichier contient des adresses, des empreintes de mot de passe et des
manuscrits inédits : sans clé, l'export est refusé hors poste de
développement. Un octet modifié, ou une mauvaise clé : la restauration refuse.

Restauration : UNIQUEMENT dans une base vide (jamais par-dessus des données
vivantes), puis vérification table par table contre le manifeste.
"""
import base64
import gzip
import hashlib
import json
import os
import re
import time

import config
import db

FORMAT = "sozo-sauvegarde"
EXCLUES = {"sessions", "admin_sessions", "rate_limits", "codes", "schema_meta"}
ENTETE_CHIFFRE, ENTETE_CLAIR = b"SOZOSAUV1\n", b"SOZOSAUV0\n"


class Refus(Exception):
    pass


def tables():
    """Les tables, dans l'ordre de création du schéma (donc des clés étrangères)."""
    with open(os.path.join(config.RACINE_BACKEND, "schema.sql"), encoding="utf-8") as f:
        noms = re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", f.read())
    return [t for t in noms if t not in EXCLUES]


def _valeur(v):
    if isinstance(v, (bytes, bytearray, memoryview)):
        return {"$b64": base64.b64encode(bytes(v)).decode()}
    return v


def _empreinte(colonnes, lignes):
    h = hashlib.sha256()
    h.update(json.dumps(colonnes, ensure_ascii=False).encode())
    for l in lignes:
        h.update(json.dumps(l, ensure_ascii=False, sort_keys=True, default=str).encode())
    return h.hexdigest()


def _lire_tables(cx):
    out = {}
    for t in tables():
        lignes = cx.tous(f"SELECT * FROM {t} ORDER BY 1, 2")
        colonnes = sorted(lignes[0].keys()) if lignes else sorted(_colonnes(cx, t))
        rangs = [[_valeur(l[c]) for c in colonnes] for l in lignes]
        out[t] = {"colonnes": colonnes, "lignes": rangs, "n": len(rangs), "empreinte": _empreinte(colonnes, rangs)}
    return out


def _colonnes(cx, t):
    return db._colonnes(cx, t)


def _fernet(cle):
    from cryptography.fernet import Fernet
    try:
        return Fernet(cle.encode() if isinstance(cle, str) else cle)
    except (ValueError, TypeError):
        raise Refus("Clé de sauvegarde invalide.")


def exporter(chemin, cle=None, sans_chiffrement=False):
    """Écrit la sauvegarde. Rend le manifeste (sans les données)."""
    cle = cle or os.environ.get("SOZO_CLE_SAUVEGARDE", "")
    if not cle and not (sans_chiffrement and not config.base_distante()):
        raise Refus("Une sauvegarde non chiffrée n'est permise que pour une base locale (--sans-chiffrement).")
    t0 = time.time()
    cx = db.connecter(globale=True)
    try:
        version = cx.un("SELECT version FROM schema_meta")["version"]
        donnees = _lire_tables(cx)
        fichiers = {}
        import manuscrits
        for imp in cx.tous("SELECT DISTINCT empreinte, nature FROM imports WHERE efface_le IS NULL"):
            p = os.path.join(manuscrits.DOSSIER, f"{imp['empreinte']}.{imp['nature']}")
            if os.path.isfile(p):
                with open(p, "rb") as f:
                    fichiers[f"manuscrits/{imp['empreinte']}.{imp['nature']}"] = base64.b64encode(f.read()).decode()
    finally:
        cx.fermer()
    doc = {"format": FORMAT, "version_schema": version, "moteur": config.moteur(), "cree_le": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "tables": donnees, "fichiers": fichiers}
    brut = gzip.compress(json.dumps(doc, ensure_ascii=False).encode(), compresslevel=6)
    contenu = ENTETE_CHIFFRE + _fernet(cle).encrypt(brut) if cle else ENTETE_CLAIR + brut
    temporaire = chemin + ".partiel"
    with open(temporaire, "wb") as f:              # écrit à côté, puis renommé : jamais de sauvegarde à moitié écrite
        f.write(contenu)
    os.replace(temporaire, chemin)
    return {"tables": {t: d["n"] for t, d in donnees.items()}, "fichiers": len(fichiers), "octets": len(contenu),
            "secondes": round(time.time() - t0, 2), "chiffree": bool(cle), "version_schema": version}


def lire(chemin, cle=None):
    cle = cle or os.environ.get("SOZO_CLE_SAUVEGARDE", "")
    with open(chemin, "rb") as f:
        contenu = f.read()
    if contenu.startswith(ENTETE_CHIFFRE):
        if not cle:
            raise Refus("Sauvegarde chiffrée : la clé est nécessaire.")
        from cryptography.fernet import InvalidToken
        try:
            brut = _fernet(cle).decrypt(contenu[len(ENTETE_CHIFFRE):])
        except InvalidToken:
            raise Refus("Sauvegarde altérée, ou mauvaise clé : restauration refusée.")
    elif contenu.startswith(ENTETE_CLAIR):
        brut = contenu[len(ENTETE_CLAIR):]
    else:
        raise Refus("Ce fichier n'est pas une sauvegarde Sōzō.")
    try:
        doc = json.loads(gzip.decompress(brut))
    except (OSError, ValueError):
        raise Refus("Sauvegarde illisible (fichier tronqué ou corrompu).")
    if doc.get("format") != FORMAT:
        raise Refus("Format de sauvegarde inconnu.")
    for t, d in doc["tables"].items():               # chaque table doit avoir l'empreinte annoncée
        if _empreinte(d["colonnes"], d["lignes"]) != d["empreinte"] or len(d["lignes"]) != d["n"]:
            raise Refus(f"Table « {t} » altérée dans la sauvegarde.")
    return doc


def restaurer(chemin, cle=None):
    """Restaure dans une base VIDE, puis vérifie. Rend le rapport."""
    t0 = time.time()
    doc = lire(chemin, cle)
    db.appliquer_schema()
    cx = db.connecter(globale=True)
    try:
        version = cx.un("SELECT version FROM schema_meta")["version"]
        if doc["version_schema"] > version:
            raise Refus(f"Sauvegarde d'un schéma plus récent ({doc['version_schema']}) que ce serveur ({version}).")
        occupees = [t for t in tables() if cx.un(f"SELECT COUNT(*) AS n FROM {t}")["n"]]
        if occupees:
            raise Refus(f"La base n'est pas vide ({', '.join(occupees[:5])}…) : restauration refusée, rien n'a été écrit.")
        for t in tables():
            d = doc["tables"].get(t)
            if not d or not d["lignes"]:
                continue
            presentes = _colonnes(cx, t)
            cols = [c for c in d["colonnes"] if c in presentes]      # schéma plus récent : colonnes nouvelles à leur défaut
            idx = [d["colonnes"].index(c) for c in cols]
            sql = f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})"
            for l in d["lignes"]:
                cx.execute(sql, tuple(base64.b64decode(l[i]["$b64"]) if isinstance(l[i], dict) else l[i] for i in idx))
        if cx.moteur == "postgres":
            # les compteurs d'identifiants repartent APRÈS le plus grand restauré
            for t in tables():
                if "id" in _colonnes(cx, t):
                    cx.execute(f"SELECT setval(pg_get_serial_sequence('{config.schema_postgres()}.{t}', 'id'), "
                               f"COALESCE((SELECT MAX(id) FROM {t}), 1), (SELECT MAX(id) FROM {t}) IS NOT NULL)")
        cx.valider()
    except Exception:
        cx.annuler()
        raise
    finally:
        cx.fermer()
    import manuscrits
    os.makedirs(manuscrits.DOSSIER, exist_ok=True)
    for nom, b64 in doc["fichiers"].items():
        octets = base64.b64decode(b64)
        attendu = os.path.basename(nom).split(".")[0]
        if hashlib.sha256(octets).hexdigest() != attendu:     # le nom EST l'empreinte du contenu
            raise Refus(f"Manuscrit altéré : {nom}.")
        cible = os.path.join(manuscrits.DOSSIER, os.path.basename(nom))
        if not os.path.exists(cible):
            with open(cible, "wb") as f:
                f.write(octets)
    rapport = verifier(doc)
    rapport["secondes"] = round(time.time() - t0, 2)
    return rapport


def verifier(doc):
    """Relit la base et la compare au manifeste, table par table."""
    cx = db.connecter(globale=True)
    try:
        actuel = _lire_tables(cx)
    finally:
        cx.fermer()
    ecarts = {}
    for t, d in doc["tables"].items():
        a = actuel.get(t)
        cols = [c for c in d["colonnes"] if a and c in a["colonnes"]]
        if not a:
            ecarts[t] = "table absente"
            continue
        # comparaison sur les colonnes de la sauvegarde (une colonne ajoutée depuis ne fausse rien)
        ia, idd = [a["colonnes"].index(c) for c in cols], [d["colonnes"].index(c) for c in cols]
        if _empreinte(cols, [[l[i] for i in ia] for l in a["lignes"]]) != _empreinte(cols, [[l[i] for i in idd] for l in d["lignes"]]):
            ecarts[t] = f"{a['n']} ligne(s) restaurée(s), {d['n']} attendue(s), ou contenu différent"
    return {"ok": not ecarts, "ecarts": ecarts, "tables": len(doc["tables"]),
            "lignes": sum(d["n"] for d in doc["tables"].values()), "fichiers": len(doc["fichiers"])}


def nouvelle_cle():
    from cryptography.fernet import Fernet
    return Fernet.generate_key().decode()
