"""Écrits : poème, récit, conte, pensée, prière (21/10/2026).

Le propriétaire : « Sōzō n'est pas seulement basé sur la lecture et l'écriture
des livres. Il faut pouvoir publier un récit, un poème, un conte, une phrase.
Les gens peuvent à leur tour liker, partager, épingler… et même commenter. »

Règles, chacune tenue par le SERVEUR (le navigateur est celui de n'importe qui) :
* un brouillon n'existe que pour son auteur : pour tout autre compte, 404 ;
* l'auteur, la nature, l'état viennent de la session et de la base, jamais du
  corps de la requête ;
* rien ne s'efface : la corbeille se récupère ; un commentaire retiré reste en
  base, daté, avec qui l'a retiré ; la modération retire sans détruire ;
* j'aime et « garder » : un geste par personne (clé primaire), et seulement sur
  un écrit publié qu'on peut lire ;
* un commentaire se retire par son auteur ou par l'auteur de l'écrit ;
  n'importe qui peut signaler, la modération (rôle « moderation ») tranche.
"""
import json

from flask import g, jsonify, request

import acces
import db
import security
import validation as v
from app import auditer, connectee

NATURES = {"poeme": "Poème", "recit": "Récit", "conte": "Conte", "pensee": "Pensée", "priere": "Prière"}
# Une pensée tient en quelques phrases ; un récit ou un conte peut être long.
TAILLE_MAX = {"pensee": 600, "priere": 4000, "poeme": 8000, "recit": 30000, "conte": 30000}
EXTRAIT_FIL = 700          # le fil montre le début d'un long texte ; l'écrit entier s'ouvre à part
PAR_PAGE = 20

# Apparence d'un écrit : listes fermées, comme celle d'un livre (studio.apparence_propre)
_APPARENCE = {
    "police": {"cormorant", "inter", "georgia", "didone", "moderne", "machine", "manuscrite"},
    "alignement": {"gauche", "centre", "justifie"},
    "fond": {"ivoire", "velours", "nuit", "parchemin"},
    "taille": {"normale", "grande"},
}


def apparence_propre(d):
    if d is None:
        return None
    if not isinstance(d, dict) or set(d) - set(_APPARENCE):
        raise v.Invalide("Apparence invalide.", "apparence")
    out = {}
    for k, val in d.items():
        if val is None:
            continue
        if isinstance(val, bool) or val not in _APPARENCE[k]:
            raise v.Invalide(f"Valeur refusée pour « {k} ».", "apparence")
        out[k] = val
    return out


def _apparence_lue(e):
    try:
        a = json.loads(e["apparence"]) if e["apparence"] else {}
        return a if isinstance(a, dict) else {}
    except (ValueError, TypeError):
        return {}


def _lisible(cx, eid):
    """L'écrit, s'il est visible pour la personne connectée : publié (et pas
    jeté, pas retiré, auteur actif) — ou le sien, quel que soit son état."""
    e = cx.un("""SELECT e.*, u.nom AS auteur_nom, u.actif AS auteur_actif
                   FROM ecrits e JOIN users u ON u.id = e.user_id WHERE e.id = ?""", (eid,))
    if not e or e["efface_le"]:
        return None
    if e["user_id"] == g.user["id"]:
        return e
    if e["statut"] != "publie" or e["corbeille_le"] or e["retire_le"] or not e["auteur_actif"]:
        return None
    if e["publie_le"] and e["publie_le"] > acces.maintenant():
        return None          # programmé (22/10/2026) : il n'existe pas encore pour les lecteurs
    return e


def _a_moi(cx, eid):
    return cx.un("SELECT * FROM ecrits WHERE id = ? AND user_id = ? AND efface_le IS NULL", (eid, g.user["id"]))


CORRECTION_MINUTES = 15


def _corrigeable(created_at):
    from datetime import datetime, timedelta, timezone
    try:
        t = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return False
    return datetime.now(timezone.utc) - t <= timedelta(minutes=CORRECTION_MINUTES)


def _compteurs(cx, ids):
    if not ids:
        return {}, {}, set(), set()
    marques = ",".join("?" * len(ids))
    jaime = {r["ecrit_id"]: r["n"] for r in cx.tous(
        f"SELECT ecrit_id, COUNT(*) AS n FROM ecrits_gestes WHERE nature = 'jaime' AND ecrit_id IN ({marques}) GROUP BY ecrit_id", ids)}
    coms = {r["ecrit_id"]: r["n"] for r in cx.tous(
        f"""SELECT ecrit_id, COUNT(*) AS n FROM ecrits_commentaires
             WHERE retire_le IS NULL AND ecrit_id IN ({marques}) GROUP BY ecrit_id""", ids)}
    miens = cx.tous(f"SELECT ecrit_id, nature FROM ecrits_gestes WHERE user_id = ? AND ecrit_id IN ({marques})",
                    (g.user["id"], *ids))
    return (jaime, coms, {r["ecrit_id"] for r in miens if r["nature"] == "jaime"},
            {r["ecrit_id"] for r in miens if r["nature"] == "garde"})


def _servir(cx, lignes, *, entier=False):
    ids = [e["id"] for e in lignes]
    jaime, coms, j_moi, g_moi = _compteurs(cx, ids)
    out = []
    for e in lignes:
        texte = e["texte"]
        long = not entier and len(texte) > EXTRAIT_FIL
        if long:
            coupe = texte.rfind("\n", 0, EXTRAIT_FIL)
            texte = texte[:coupe if coupe > EXTRAIT_FIL // 2 else EXTRAIT_FIL].rstrip()
        out.append({
            "id": e["id"], "nature": e["nature"], "nature_nom": NATURES[e["nature"]], "titre": e["titre"], "texte": texte,
            "long": long, "apparence": _apparence_lue(e), "statut": e["statut"], "publie_le": e["publie_le"],
            "maj": e["updated_at"], "corbeille_le": e["corbeille_le"], "retire": bool(e["retire_le"]),
            "programme": bool(e["statut"] == "publie" and e["publie_le"] and e["publie_le"] > acces.maintenant()),
            "auteur": {"id": f"u{e['user_id']}", "nom": e["auteur_nom"]}, "mien": e["user_id"] == g.user["id"],
            "jaime": jaime.get(e["id"], 0), "commentaires": coms.get(e["id"], 0),
            "moi": {"jaime": e["id"] in j_moi, "garde": e["id"] in g_moi},
        })
    return out


def _lire_corps(d, nature):
    titre = v.texte(d, "titre", requis=False, maxi=120) or ""
    texte = v.texte(d, "texte", mini=1, maxi=TAILLE_MAX[nature], multiligne=True)
    if not texte.strip():
        raise v.Invalide("Le texte est vide.", "texte")
    return titre, texte


def enregistrer(app):

    # ── Le fil : écrits publiés ────────────────────────────────────────────
    @app.get("/api/ecrits")
    @connectee
    def ecrits_fil():
        nature = request.args.get("nature") or None
        if nature and nature not in NATURES:
            raise v.Invalide("Nature inconnue.", "nature")
        auteur = request.args.get("auteur") or ""
        avant = request.args.get("avant") or ""
        conditions = ["e.statut = 'publie'", "e.corbeille_le IS NULL", "e.retire_le IS NULL", "u.actif = 1", "e.publie_le <= ?"]
        params = [acces.maintenant()]
        if nature:
            conditions.append("e.nature = ?")
            params.append(nature)
        if auteur:
            if not (auteur.startswith("u") and auteur[1:].isdigit()):
                raise v.Invalide("Auteur inconnu.", "auteur")
            conditions.append("e.user_id = ?")
            params.append(int(auteur[1:]))
        if avant:
            if not avant.isdigit():
                raise v.Invalide("Curseur invalide.", "avant")
            conditions.append("e.id < ?")
            params.append(int(avant))
        cx = db.connecter()
        try:
            lignes = cx.tous(f"""SELECT e.*, u.nom AS auteur_nom FROM ecrits e JOIN users u ON u.id = e.user_id
                                  WHERE {' AND '.join(conditions)} ORDER BY e.id DESC LIMIT {PAR_PAGE + 1}""", params)
            suite = len(lignes) > PAR_PAGE
            lignes = lignes[:PAR_PAGE]
            return jsonify(ecrits=_servir(cx, lignes), suite=lignes[-1]["id"] if suite else None, natures=NATURES)
        finally:
            cx.fermer()

    @app.get("/api/mes-ecrits")
    @connectee
    def mes_ecrits():
        cx = db.connecter()
        try:
            lignes = cx.tous("""SELECT e.*, u.nom AS auteur_nom FROM ecrits e JOIN users u ON u.id = e.user_id
                                 WHERE e.user_id = ? AND e.efface_le IS NULL ORDER BY e.updated_at DESC, e.id DESC LIMIT 500""", (g.user["id"],))
            return jsonify(ecrits=_servir(cx, lignes), natures=NATURES)
        finally:
            cx.fermer()

    @app.get("/api/ecrits/gardes")
    @connectee
    def ecrits_gardes():
        cx = db.connecter()
        try:
            lignes = cx.tous("""SELECT e.*, u.nom AS auteur_nom FROM ecrits_gestes x
                                  JOIN ecrits e ON e.id = x.ecrit_id JOIN users u ON u.id = e.user_id
                                 WHERE x.user_id = ? AND x.nature = 'garde' AND e.corbeille_le IS NULL AND e.retire_le IS NULL AND e.efface_le IS NULL
                                   AND (e.statut = 'publie' AND u.actif = 1 AND e.publie_le <= ? OR e.user_id = ?)
                                 ORDER BY x.created_at DESC LIMIT 500""", (g.user["id"], acces.maintenant(), g.user["id"]))
            return jsonify(ecrits=_servir(cx, lignes))
        finally:
            cx.fermer()

    @app.get("/api/ecrits/<int:eid>")
    @connectee
    def ecrit_lire(eid):
        cx = db.connecter()
        try:
            e = _lisible(cx, eid)
            if not e:
                return jsonify(erreur="Introuvable."), 404
            coms = cx.tous("""SELECT c.id, c.texte, c.created_at, c.user_id, c.parent_id, c.modifie_le, u.nom FROM ecrits_commentaires c
                                JOIN users u ON u.id = c.user_id
                               WHERE c.ecrit_id = ? AND c.retire_le IS NULL AND u.actif = 1 ORDER BY c.id LIMIT 300""", (eid,))
            moi = g.user["id"]
            return jsonify(ecrit=_servir(cx, [e], entier=True)[0], commentaires=[
                {"id": c["id"], "texte": c["texte"], "le": c["created_at"], "auteur": {"id": f"u{c['user_id']}", "nom": c["nom"]},
                 "parent": c["parent_id"], "modifie": bool(c["modifie_le"]),
                 "peut_modifier": c["user_id"] == moi and _corrigeable(c["created_at"]),
                 "peut_retirer": c["user_id"] == moi or e["user_id"] == moi} for c in coms])
        finally:
            cx.fermer()

    # ── Écrire, publier, jeter, récupérer ──────────────────────────────────
    @app.post("/api/ecrits")
    @connectee
    def ecrit_creer():
        d = v.corps_json(request)
        nature = v.choix(d, "nature", set(NATURES))
        titre, texte = _lire_corps(d, nature)
        apparence = apparence_propre(d.get("apparence"))
        publier = d.get("publier") is True
        cx = db.connecter()
        try:
            if security.depasse(cx, "ecrit:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Beaucoup d’écrits en peu de temps : réessayez dans une heure."), 429
            m = acces.maintenant()
            eid = cx.inserer("""INSERT INTO ecrits (user_id, nature, titre, texte, apparence, statut, publie_le, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                             (g.user["id"], nature, titre, texte, json.dumps(apparence) if apparence else None,
                              "publie" if publier else "brouillon", m if publier else None, m, m))
            auditer("ecrit.creation", ressource=f"ecrit:{eid}", apres="publie" if publier else "brouillon", cx=cx)
            cx.valider()
            e = cx.un("SELECT e.*, u.nom AS auteur_nom FROM ecrits e JOIN users u ON u.id = e.user_id WHERE e.id = ?", (eid,))
            return jsonify(ecrit=_servir(cx, [e], entier=True)[0]), 201
        finally:
            cx.fermer()

    @app.patch("/api/ecrits/<int:eid>")
    @connectee
    def ecrit_modifier(eid):
        d = v.corps_json(request)
        cx = db.connecter()
        try:
            e = _a_moi(cx, eid)
            if not e:
                return jsonify(erreur="Introuvable."), 404
            if e["retire_le"]:
                return jsonify(erreur="Cet écrit a été retiré par la modération : il ne se modifie plus."), 409
            if e["corbeille_le"]:
                return jsonify(erreur="Cet écrit est dans la corbeille : récupérez-le d’abord."), 409
            nature = v.choix(d, "nature", set(NATURES)) if "nature" in d else e["nature"]
            champs = {"nature": nature}
            if "titre" in d:
                champs["titre"] = v.texte(d, "titre", requis=False, maxi=120) or ""
            if "texte" in d or nature != e["nature"]:
                champs["texte"] = _lire_corps({"texte": d.get("texte", e["texte"])}, nature)[1]
            if "apparence" in d:
                a = apparence_propre(d.get("apparence"))
                champs["apparence"] = json.dumps(a) if a else None
            champs["updated_at"] = acces.maintenant()
            for k, val in champs.items():     # colonnes : liste fermée ci-dessus, jamais le client
                cx.execute(f"UPDATE ecrits SET {k} = ? WHERE id = ? AND user_id = ?", (val, eid, g.user["id"]))
            cx.valider()
            e = cx.un("SELECT e.*, u.nom AS auteur_nom FROM ecrits e JOIN users u ON u.id = e.user_id WHERE e.id = ?", (eid,))
            return jsonify(ecrit=_servir(cx, [e], entier=True)[0])
        finally:
            cx.fermer()

    def _changer_etat(eid, action, date=None):
        cx = db.connecter()
        try:
            e = _a_moi(cx, eid)
            if not e:
                return jsonify(erreur="Introuvable."), 404
            if e["retire_le"]:
                return jsonify(erreur="Cet écrit a été retiré par la modération."), 409
            m = acces.maintenant()
            if action == "publier":
                if e["corbeille_le"]:
                    return jsonify(erreur="Cet écrit est dans la corbeille : récupérez-le d’abord."), 409
                if date:
                    # Programmer (22/10/2026) : seulement un brouillon, et dans le futur
                    if e["statut"] == "publie" and e["publie_le"] and e["publie_le"] <= m:
                        return jsonify(erreur="Cet écrit est déjà publié."), 409
                    cx.execute("UPDATE ecrits SET statut = 'publie', publie_le = ?, updated_at = ? WHERE id = ?", (date, m, eid))
                else:
                    # « Publier maintenant » avance aussi un écrit programmé
                    cx.execute("""UPDATE ecrits SET statut = 'publie', updated_at = ?,
                                  publie_le = CASE WHEN publie_le IS NULL OR publie_le > ? THEN ? ELSE publie_le END WHERE id = ?""", (m, m, m, eid))
            elif action == "depublier":
                cx.execute("UPDATE ecrits SET statut = 'brouillon', updated_at = ? WHERE id = ?", (m, eid))
            elif action == "corbeille":
                if e["corbeille_le"]:
                    return jsonify(erreur="Déjà dans la corbeille."), 409
                cx.execute("UPDATE ecrits SET corbeille_le = ?, updated_at = ? WHERE id = ?", (m, m, eid))
            else:   # restaurer : l'écrit revient tel qu'il était (publié ou brouillon)
                if not e["corbeille_le"]:
                    return jsonify(erreur="Cet écrit n’est pas dans la corbeille."), 409
                cx.execute("UPDATE ecrits SET corbeille_le = NULL, updated_at = ? WHERE id = ?", (m, eid))
            auditer(f"ecrit.{action}", ressource=f"ecrit:{eid}", cx=cx)
            cx.valider()
            e = cx.un("SELECT e.*, u.nom AS auteur_nom FROM ecrits e JOIN users u ON u.id = e.user_id WHERE e.id = ?", (eid,))
            return jsonify(ecrit=_servir(cx, [e], entier=True)[0])
        finally:
            cx.fermer()

    @app.post("/api/ecrits/<int:eid>/publier")
    @connectee
    def ecrit_publier(eid):
        d = v.corps_json(request) if request.data else {}
        date = v.date_heure(d, "date", requis=False)
        if date and date <= acces.maintenant():
            raise v.Invalide("La date de parution doit être dans le futur (ou publiez maintenant).", "date")
        return _changer_etat(eid, "publier", date)

    @app.delete("/api/ecrits/<int:eid>/definitif")
    @connectee
    def ecrit_effacer(eid):
        """Effacer pour de bon un écrit de SA corbeille : le texte et le titre sont
        vidés, ses j'aime retirés ; la ligne reste (les commentaires et le journal
        y sont rattachés). Refusé tant qu'un signalement est en cours d'examen :
        effacer ne doit pas servir à faire disparaître une preuve."""
        cx = db.connecter()
        try:
            e = _a_moi(cx, eid)
            if not e:
                return jsonify(erreur="Introuvable."), 404
            if not e["corbeille_le"]:
                return jsonify(erreur="Mettez d’abord l’écrit à la corbeille."), 409
            if cx.un("SELECT id FROM signalements_ecrits WHERE ecrit_id = ? AND etat = 'ouvert' LIMIT 1", (eid,)):
                return jsonify(erreur="Un signalement de cet écrit est en cours d’examen : il ne peut pas être effacé pour l’instant.", code="signalement_ouvert"), 409
            m = acces.maintenant()
            cx.execute("UPDATE ecrits SET titre = '', texte = '', apparence = NULL, efface_le = ?, updated_at = ? WHERE id = ?", (m, m, eid))
            cx.execute("DELETE FROM ecrits_gestes WHERE ecrit_id = ?", (eid,))
            cx.execute("UPDATE ecrits_commentaires SET retire_le = COALESCE(retire_le, ?), retire_par = COALESCE(retire_par, 'auteur') WHERE ecrit_id = ?", (m, eid))
            auditer("ecrit.efface", ressource=f"ecrit:{eid}", cx=cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/ecrits/<int:eid>/depublier")
    @connectee
    def ecrit_depublier(eid):
        return _changer_etat(eid, "depublier")

    @app.delete("/api/ecrits/<int:eid>")
    @connectee
    def ecrit_corbeille(eid):
        return _changer_etat(eid, "corbeille")

    @app.post("/api/ecrits/<int:eid>/restaurer")
    @connectee
    def ecrit_restaurer(eid):
        return _changer_etat(eid, "restaurer")

    # ── J'aime, garder ─────────────────────────────────────────────────────
    def _geste(eid, nature, oui):
        cx = db.connecter()
        try:
            e = _lisible(cx, eid)
            # Un brouillon (même le sien) ne se « like » pas : il n'est pas publié
            if not e or e["statut"] != "publie" or e["corbeille_le"] or e["retire_le"]:
                return jsonify(erreur="Introuvable."), 404
            if security.depasse(cx, "geste:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Trop de gestes en peu de temps. Réessayez dans quelques minutes."), 429
            existe = cx.un("SELECT 1 AS x FROM ecrits_gestes WHERE ecrit_id = ? AND user_id = ? AND nature = ?", (eid, g.user["id"], nature))
            if oui and not existe:
                cx.execute("INSERT INTO ecrits_gestes (ecrit_id, user_id, nature, created_at) VALUES (?, ?, ?, ?)",
                           (eid, g.user["id"], nature, acces.maintenant()))
            elif not oui and existe:
                cx.execute("DELETE FROM ecrits_gestes WHERE ecrit_id = ? AND user_id = ? AND nature = ?", (eid, g.user["id"], nature))
            cx.valider()
            n = cx.un("SELECT COUNT(*) AS n FROM ecrits_gestes WHERE ecrit_id = ? AND nature = ?", (eid, nature))["n"]
            return jsonify(ok=True, actif=oui, total=n)
        finally:
            cx.fermer()

    @app.post("/api/ecrits/<int:eid>/jaime")
    @connectee
    def ecrit_jaime(eid):
        return _geste(eid, "jaime", True)

    @app.delete("/api/ecrits/<int:eid>/jaime")
    @connectee
    def ecrit_jaime_retirer(eid):
        return _geste(eid, "jaime", False)

    @app.post("/api/ecrits/<int:eid>/garde")
    @connectee
    def ecrit_garder(eid):
        return _geste(eid, "garde", True)

    @app.delete("/api/ecrits/<int:eid>/garde")
    @connectee
    def ecrit_garde_retirer(eid):
        return _geste(eid, "garde", False)

    # ── Commentaires ───────────────────────────────────────────────────────
    @app.post("/api/ecrits/<int:eid>/commentaires")
    @connectee
    def ecrit_commenter(eid):
        d = v.corps_json(request)
        texte = v.texte(d, "texte", mini=1, maxi=1000, multiligne=True)
        parent = v.entier(d, "parent", mini=1, requis=False)
        if not texte.strip():
            raise v.Invalide("Le commentaire est vide.", "texte")
        cx = db.connecter()
        try:
            e = _lisible(cx, eid)
            if not e or e["statut"] != "publie" or e["corbeille_le"] or e["retire_le"]:
                return jsonify(erreur="Introuvable."), 404
            if parent is not None:
                # Une réponse vise un commentaire de CET écrit, visible, et de premier niveau
                pc = cx.un("SELECT id, parent_id FROM ecrits_commentaires WHERE id = ? AND ecrit_id = ? AND retire_le IS NULL", (parent, eid))
                if not pc:
                    return jsonify(erreur="Introuvable."), 404
                parent = pc["parent_id"] or pc["id"]
            if security.depasse(cx, "commentaire:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Beaucoup de commentaires en peu de temps : réessayez dans une heure."), 429
            m = acces.maintenant()
            cid = cx.inserer("INSERT INTO ecrits_commentaires (ecrit_id, user_id, texte, created_at, parent_id) VALUES (?, ?, ?, ?, ?)",
                             (eid, g.user["id"], texte.strip(), m, parent))
            auditer("ecrit.commentaire", ressource=f"ecrit:{eid}", apres=f"commentaire:{cid}", cx=cx)
            cx.valider()
            return jsonify(commentaire={"id": cid, "texte": texte.strip(), "le": m, "auteur": {"id": f"u{g.user['id']}", "nom": g.user["nom"]},
                                        "parent": parent, "modifie": False, "peut_modifier": True, "peut_retirer": True}), 201
        finally:
            cx.fermer()

    @app.patch("/api/commentaires/<int:cid>")
    @connectee
    def commentaire_modifier(cid):
        """Corriger SON commentaire, dans les 15 minutes : une faute de frappe se
        corrige, une conversation déjà lue ne se réécrit pas."""
        texte = v.texte(v.corps_json(request), "texte", mini=1, maxi=1000, multiligne=True)
        if not texte.strip():
            raise v.Invalide("Le commentaire est vide.", "texte")
        cx = db.connecter()
        try:
            c = cx.un("SELECT * FROM ecrits_commentaires WHERE id = ? AND user_id = ? AND retire_le IS NULL", (cid, g.user["id"]))
            if not c:
                return jsonify(erreur="Introuvable."), 404
            if not _corrigeable(c["created_at"]):
                return jsonify(erreur="Un commentaire se corrige dans les 15 minutes qui suivent sa publication.", code="trop_tard"), 409
            cx.execute("UPDATE ecrits_commentaires SET texte = ?, modifie_le = ? WHERE id = ?", (texte.strip(), acces.maintenant(), cid))
            auditer("ecrit.commentaire_modifie", ressource=f"commentaire:{cid}", cx=cx)
            cx.valider()
            return jsonify(ok=True, texte=texte.strip())
        finally:
            cx.fermer()

    @app.delete("/api/commentaires/<int:cid>")
    @connectee
    def commentaire_retirer(cid):
        cx = db.connecter()
        try:
            c = cx.un("""SELECT c.id, c.user_id, c.retire_le, e.user_id AS auteur_ecrit FROM ecrits_commentaires c
                           JOIN ecrits e ON e.id = c.ecrit_id WHERE c.id = ?""", (cid,))
            moi = g.user["id"]
            # Ni le sien, ni sous son écrit : le commentaire n'existe pas pour cette personne
            if not c or c["retire_le"] or moi not in (c["user_id"], c["auteur_ecrit"]):
                return jsonify(erreur="Introuvable."), 404
            par = "commentateur" if c["user_id"] == moi else "auteur"
            cx.execute("UPDATE ecrits_commentaires SET retire_le = ?, retire_par = ? WHERE id = ?", (acces.maintenant(), par, cid))
            auditer("ecrit.commentaire_retire", ressource=f"commentaire:{cid}", apres=par, cx=cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    # ── Signaler, modérer ──────────────────────────────────────────────────
    @app.post("/api/ecrits/<int:eid>/signaler")
    @connectee
    def ecrit_signaler(eid):
        d = v.corps_json(request)
        motif = v.texte(d, "motif", mini=5, maxi=1000, multiligne=True)
        cid = v.entier(d, "commentaire", mini=1, requis=False)
        cx = db.connecter()
        try:
            e = _lisible(cx, eid)
            if not e or e["statut"] != "publie":
                return jsonify(erreur="Introuvable."), 404
            if cid is not None and not cx.un("SELECT id FROM ecrits_commentaires WHERE id = ? AND ecrit_id = ? AND retire_le IS NULL", (cid, eid)):
                return jsonify(erreur="Introuvable."), 404
            if security.depasse(cx, "signalement:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Beaucoup de signalements en peu de temps : réessayez plus tard."), 429
            sid = cx.inserer("INSERT INTO signalements_ecrits (user_id, ecrit_id, commentaire_id, motif, created_at) VALUES (?, ?, ?, ?, ?)",
                             (g.user["id"], eid, cid, motif, acces.maintenant()))
            auditer("ecrit.signalement", ressource=f"ecrit:{eid}", apres=f"signalement_ecrit:{sid}", cx=cx)
            cx.valider()
            return jsonify(ok=True), 201
        finally:
            cx.fermer()


def enregistrer_admin(app, admin_requis, role_requis, trace):
    """Routes de modération, posées par admin.py (même garde : session
    d'administration, rôle « moderation » pour agir)."""

    @app.get("/api/admin/signalements-ecrits")
    @admin_requis
    def admin_signalements_ecrits():
        cx = db.connecter()
        try:
            return jsonify(signalements=cx.tous(
                """SELECT s.id, s.motif, s.etat, s.created_at, s.ecrit_id, s.commentaire_id, e.titre, e.nature,
                          substr(e.texte, 1, 300) AS extrait, c.texte AS commentaire, u.nom AS par, a.nom AS auteur,
                          e.retire_le, c.retire_le AS commentaire_retire_le
                     FROM signalements_ecrits s JOIN ecrits e ON e.id = s.ecrit_id JOIN users u ON u.id = s.user_id
                     JOIN users a ON a.id = e.user_id LEFT JOIN ecrits_commentaires c ON c.id = s.commentaire_id
                    ORDER BY CASE WHEN s.etat = 'ouvert' THEN 0 ELSE 1 END, s.id DESC LIMIT 200"""))
        finally:
            cx.fermer()

    @app.post("/api/admin/signalements-ecrits/<int:sid>")
    @admin_requis
    @role_requis("moderation")
    def traiter_signalement_ecrit(sid):
        d = v.corps_json(request)
        decision = v.choix(d, "decision", {"retirer", "rejeter"})
        motif = v.texte(d, "motif", mini=3, maxi=300) if decision == "retirer" else None
        cx = db.connecter()
        try:
            s = cx.un("SELECT * FROM signalements_ecrits WHERE id = ? AND etat = 'ouvert'", (sid,))
            if not s:
                return jsonify(erreur="Déjà traité (ou introuvable)."), 409
            m = acces.maintenant()
            if decision == "retirer":
                if s["commentaire_id"]:
                    cx.execute("UPDATE ecrits_commentaires SET retire_le = COALESCE(retire_le, ?), retire_par = COALESCE(retire_par, 'moderation') WHERE id = ?",
                               (m, s["commentaire_id"]))
                else:
                    cx.execute("UPDATE ecrits SET retire_le = COALESCE(retire_le, ?), retrait_motif = ? WHERE id = ?", (m, motif, s["ecrit_id"]))
            cx.execute("UPDATE signalements_ecrits SET etat = ? WHERE id = ?", ("traite" if decision == "retirer" else "rejete", sid))
            trace("signalement_ecrit." + decision, f"signalement_ecrit:{sid}", motif or "", cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()
