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
import charte
import db
import envois
import notifications
import security
import validation as v
from app import auditer, connectee

# Lot B (21/10/2026) : jusqu'à trois thèmes par écrit, sur liste fermée
THEMES = ("Espérance", "Foi", "Louange", "Gratitude", "Pardon", "Paix", "Amour", "Famille", "Courage", "Épreuve", "Deuil", "Guérison")
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


def themes_propres(d):
    if d is None:
        return None
    if not isinstance(d, list) or len(d) > 3 or any(t not in THEMES for t in d):
        raise v.Invalide("Trois thèmes au plus, choisis dans la liste.", "themes")
    return sorted(set(d), key=THEMES.index)


def _themes_lus(e):
    try:
        t = json.loads(e["themes"]) if e["themes"] else []
        return [x for x in t if x in THEMES] if isinstance(t, list) else []
    except (ValueError, TypeError, KeyError, IndexError):
        return []


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
        return None          # programmé (21/10/2026) : il n'existe pas encore pour les lecteurs
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


def _annoncer(e):
    """Prévenir les abonnés d'un écrit paru : on écrit chez D'AUTRES comptes,
    donc par une connexion globale (voir notifications.emettre_chez_autrui),
    une fois l'écrit validé. La réservation de annonce_le et les notifications
    restent dans UNE transaction : si l'une échoue, l'autre est annulée."""
    import communaute
    cg = db.connecter(globale=True)
    try:
        n = communaute.annoncer_ecrit(cg, e)
        cg.valider()
        return n
    finally:
        cg.fermer()


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
            "long": long, "apparence": _apparence_lue(e), "themes": _themes_lus(e), "statut": e["statut"], "publie_le": e["publie_le"],
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
        theme = request.args.get("theme") or None
        if theme and theme not in THEMES:
            raise v.Invalide("Thème inconnu.", "theme")
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
        if request.args.get("abonnements"):
            conditions.append("e.user_id IN (SELECT auteur_id FROM abonnements WHERE user_id = ?)")
            params.append(g.user["id"])
        q = (request.args.get("q") or "").strip()
        if q:
            if len(q) < 2 or len(q) > 80:
                raise v.Invalide("Tapez au moins deux lettres.", "q")
            motif = "%" + q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            conditions.append("(LOWER(e.titre) LIKE ? ESCAPE '\\' OR LOWER(e.texte) LIKE ? ESCAPE '\\' OR LOWER(u.nom) LIKE ? ESCAPE '\\')")
            params += [motif, motif, motif]
        if theme:
            # liste fermée : la valeur cherchée est l'une des nôtres, entre guillemets JSON
            conditions.append("e.themes LIKE ?")
            params.append(f'%"{theme}"%')
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
            return jsonify(ecrits=_servir(cx, lignes), suite=lignes[-1]["id"] if suite else None, natures=NATURES, themes=THEMES)
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
        themes = themes_propres(d.get("themes"))
        publier = d.get("publier") is True
        cx = db.connecter()
        try:
            if publier and not charte.acceptee(cx, g.user["id"]):
                return charte.refus()
            if security.depasse(cx, "ecrit:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Beaucoup d’écrits en peu de temps : réessayez dans une heure."), 429
            m = acces.maintenant()
            eid = cx.inserer("""INSERT INTO ecrits (user_id, nature, titre, texte, apparence, themes, statut, publie_le, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                             (g.user["id"], nature, titre, texte, json.dumps(apparence) if apparence else None,
                              json.dumps(themes, ensure_ascii=False) if themes else None,
                              "publie" if publier else "brouillon", m if publier else None, m, m))
            auditer("ecrit.creation", ressource=f"ecrit:{eid}", apres="publie" if publier else "brouillon", cx=cx)
            cx.valider()
            e = cx.un("SELECT e.*, u.nom AS auteur_nom FROM ecrits e JOIN users u ON u.id = e.user_id WHERE e.id = ?", (eid,))
            if publier and _annoncer(e):
                envois.declencher()
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
            if "themes" in d:
                t = themes_propres(d.get("themes"))
                champs["themes"] = json.dumps(t, ensure_ascii=False) if t else None
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
                if not charte.acceptee(cx, g.user["id"]):
                    return charte.refus()
                if date:
                    # Programmer (21/10/2026) : seulement un brouillon, et dans le futur
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
            if action == "publier":
                pub = cx.un("SELECT * FROM ecrits WHERE id = ?", (eid,))
                if _annoncer(pub):        # paru maintenant (un écrit programmé sera annoncé par les tâches)
                    envois.declencher()
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
            # Les signalements sont ceux des AUTRES : sous PostgreSQL, la RLS les cache
            # à l'auteur, la garde ne voyait rien et l'effacement passait (constaté
            # le 21/10/2026, invisible sous SQLite). Lecture globale, réduite à un oui/non.
            import studio
            if studio._signale("signalements_ecrits", "ecrit_id", eid):
                return jsonify(erreur="Un signalement de cet écrit est en cours d’examen : il ne peut pas être effacé pour l’instant.", code="signalement_ouvert"), 409
            m = acces.maintenant()
            cx.execute("UPDATE ecrits SET titre = '', texte = '', apparence = NULL, efface_le = ?, updated_at = ? WHERE id = ?", (m, m, eid))
            cx.execute("UPDATE ecrits_commentaires SET retire_le = COALESCE(retire_le, ?), retire_par = COALESCE(retire_par, 'auteur') WHERE ecrit_id = ?", (m, eid))
            auditer("ecrit.efface", ressource=f"ecrit:{eid}", cx=cx)
            cx.valider()
            # Les j'aime sont ceux des lecteurs : même raison, connexion globale,
            # une fois l'effacement validé.
            cg = db.connecter(globale=True)
            try:
                cg.execute("DELETE FROM ecrits_gestes WHERE ecrit_id = ?", (eid,))
                cg.valider()
            finally:
                cg.fermer()
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
            if oui and not existe and nature == "jaime" and e["user_id"] != g.user["id"]:
                # regroupés : une notification par écrit et par jour, pas une par cœur
                notifications.emettre_chez_autrui(e["user_id"], "communaute", f"{g.user['nom']} aime votre {NATURES[e['nature']].lower()}",
                                                  f"« {e['titre']} »" if e["titre"] else "Il touche vos lecteurs.",
                                                  f"/app/ecrit.html?id={eid}", f"jaime:{eid}:{acces.maintenant()[:10]}")
                envois.declencher()
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
            if not charte.acceptee(cx, g.user["id"]):
                return charte.refus()
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
            extrait = texte.strip()[:120]
            pa = cx.un("SELECT user_id FROM ecrits_commentaires WHERE id = ?", (parent,)) if parent is not None else None
            cx.valider()
            if e["user_id"] != g.user["id"]:
                notifications.emettre_chez_autrui(e["user_id"], "communaute", f"{g.user['nom']} a commenté votre {NATURES[e['nature']].lower()}",
                                                  extrait, f"/app/ecrit.html?id={eid}#commentaires", f"commentaire:{cid}")
            if pa and pa["user_id"] not in (g.user["id"], e["user_id"]):
                notifications.emettre_chez_autrui(pa["user_id"], "communaute", f"{g.user['nom']} vous a répondu", extrait,
                                                  f"/app/ecrit.html?id={eid}#commentaires", f"reponse:{cid}")
            envois.declencher()
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

    # ── Lot B (21/10/2026) : export, série d'écriture ───────────────────────
    @app.get("/api/mes-ecrits/export.docx")
    @connectee
    def exporter_ecrits():
        import export_docx
        cx = db.connecter()
        try:
            lignes = cx.tous("""SELECT nature, titre, texte, publie_le, created_at FROM ecrits
                                 WHERE user_id = ? AND efface_le IS NULL AND corbeille_le IS NULL ORDER BY created_at""", (g.user["id"],))
            sections = [(e["titre"] or NATURES[e["nature"]], e["texte"]) for e in lignes]
            octets = export_docx.document("Mes écrits", f"{g.user['nom']} — {len(sections)} écrit{'s' if len(sections) > 1 else ''}", sections)
            auditer("ecrits.export", ressource=f"user:{g.user['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        rep = app.response_class(octets, mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        rep.headers["Content-Disposition"] = 'attachment; filename="mes-ecrits-sozo.docx"'
        return rep

    @app.get("/api/moi/serie")
    @connectee
    def serie():
        """Les jours où la personne a écrit (une page enregistrée, un écrit créé
        ou modifié), à l'heure de Kinshasa : sa série en cours et ses 7 derniers
        jours. Un encouragement discret, jamais une obligation."""
        from datetime import datetime, timedelta, timezone
        kin = timezone(timedelta(hours=1))
        cx = db.connecter()
        try:
            depuis = (datetime.now(timezone.utc) - timedelta(days=400)).strftime("%Y-%m-%dT%H:%M:%SZ")
            dates = [r["d"] for r in cx.tous("SELECT created_at AS d FROM page_versions WHERE auteur_id = ? AND created_at >= ?", (g.user["id"], depuis))]
            dates += [r["d"] for r in cx.tous("SELECT updated_at AS d FROM ecrits WHERE user_id = ? AND updated_at >= ?", (g.user["id"], depuis))]
            dates += [r["d"] for r in cx.tous("SELECT created_at AS d FROM ecrits WHERE user_id = ? AND created_at >= ?", (g.user["id"], depuis))]
        finally:
            cx.fermer()
        jours = set()
        for d in dates:
            try:
                jours.add(datetime.strptime(d, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).astimezone(kin).date())
            except (TypeError, ValueError):
                pass
        auj = datetime.now(kin).date()
        # la série tient si l'on a écrit aujourd'hui OU hier (la journée n'est pas finie)
        j, n = (auj if auj in jours else auj - timedelta(days=1)), 0
        while j in jours:
            n += 1
            j -= timedelta(days=1)
        return jsonify(serie=n, aujourdhui=auj in jours,
                       semaine=[{"jour": (auj - timedelta(days=k)).isoformat(), "ecrit": (auj - timedelta(days=k)) in jours} for k in range(6, -1, -1)])

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

    # ── Lot E (21/10/2026) : modération directe, sans attendre un signalement ──
    # La modération voit les écrits publiés et les commentaires récents, retire
    # et rétablit. Retirer ne détruit rien (retire_le, motif gardé, journal) ;
    # rétablir ne rend QUE ce que la modération a retiré : un commentaire retiré
    # par celui qui l'a écrit (ou par l'auteur de l'écrit) reste retiré — la
    # modération ne fait pas reparler quelqu'un à sa place.
    @app.get("/api/admin/communaute")
    @admin_requis
    def admin_communaute():
        quoi = request.args.get("quoi", "ecrits")
        if quoi not in ("ecrits", "commentaires"):
            raise v.Invalide("Liste inconnue.", "quoi")
        retires = request.args.get("retires") == "1"
        avant = request.args.get("avant", type=int)
        cx = db.connecter()
        try:
            if quoi == "ecrits":
                cond = ["e.statut = 'publie'", "e.efface_le IS NULL", "e.retire_le IS NOT NULL" if retires else "e.retire_le IS NULL"]
                p = []
                if avant:
                    cond.append("e.id < ?")
                    p.append(avant)
                lignes = cx.tous(f"""SELECT e.id, e.nature, e.titre, substr(e.texte, 1, 300) AS extrait, e.publie_le, e.corbeille_le,
                                            e.retire_le, e.retrait_motif, u.nom AS auteur, u.id AS auteur_id,
                                            (SELECT COUNT(*) FROM ecrits_commentaires c WHERE c.ecrit_id = e.id AND c.retire_le IS NULL) AS commentaires,
                                            (SELECT COUNT(*) FROM signalements_ecrits s WHERE s.ecrit_id = e.id AND s.etat = 'ouvert') AS signalements
                                       FROM ecrits e JOIN users u ON u.id = e.user_id
                                      WHERE {' AND '.join(cond)} ORDER BY e.id DESC LIMIT 51""", p)
            else:
                cond = ["c.retire_par = 'moderation'" if retires else "c.retire_le IS NULL"]
                p = []
                if avant:
                    cond.append("c.id < ?")
                    p.append(avant)
                lignes = cx.tous(f"""SELECT c.id, c.texte, c.created_at, c.retire_le, c.retire_par, c.ecrit_id, e.titre, e.nature,
                                            u.nom AS auteur, a.nom AS auteur_ecrit,
                                            (SELECT COUNT(*) FROM signalements_ecrits s WHERE s.commentaire_id = c.id AND s.etat = 'ouvert') AS signalements
                                       FROM ecrits_commentaires c JOIN ecrits e ON e.id = c.ecrit_id
                                       JOIN users u ON u.id = c.user_id JOIN users a ON a.id = e.user_id
                                      WHERE {' AND '.join(cond)} ORDER BY c.id DESC LIMIT 51""", p)
            suite = lignes[49]["id"] if len(lignes) > 50 else None
            return jsonify(lignes=lignes[:50], suite=suite)
        finally:
            cx.fermer()

    @app.post("/api/admin/ecrits/<int:eid>/<action>")
    @admin_requis
    @role_requis("moderation")
    def moderer_ecrit(eid, action):
        if action not in ("retirer", "retablir"):
            return jsonify(erreur="Introuvable."), 404
        motif = v.texte(v.corps_json(request), "motif", mini=3, maxi=300) if action == "retirer" else None
        cx = db.connecter()
        try:
            m = acces.maintenant()
            if action == "retirer":
                cur = cx.execute("UPDATE ecrits SET retire_le = ?, retrait_motif = ? WHERE id = ? AND retire_le IS NULL AND efface_le IS NULL", (m, motif, eid))
            else:
                cur = cx.execute("UPDATE ecrits SET retire_le = NULL, retrait_motif = NULL WHERE id = ? AND retire_le IS NOT NULL AND efface_le IS NULL", (eid,))
            if cur.rowcount != 1:
                return jsonify(erreur="Déjà fait (ou introuvable)."), 409
            if action == "retirer":
                # les signalements ouverts sur cet écrit sont tranchés par ce retrait
                cx.execute("UPDATE signalements_ecrits SET etat = 'traite' WHERE ecrit_id = ? AND commentaire_id IS NULL AND etat = 'ouvert'", (eid,))
            trace("ecrit." + action, f"ecrit:{eid}", motif or "rétabli", cx)
            e = cx.un("SELECT user_id, nature, titre FROM ecrits WHERE id = ?", (eid,))
            nom = f"« {e['titre']} »" if e["titre"] else f"Votre {NATURES[e['nature']].lower()}"
            notifications.emettre(cx, e["user_id"], "moderation", "Écrit retiré par la modération" if action == "retirer" else "Écrit rétabli",
                                  f"{nom} : {motif}" if action == "retirer" else f"{nom} est de nouveau visible.",
                                  f"/app/ecrits.html", f"moderation:ecrit:{eid}:{action}:{m}")
            cx.valider()
            envois.declencher()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/admin/commentaires/<int:cid>/<action>")
    @admin_requis
    @role_requis("moderation")
    def moderer_commentaire(cid, action):
        if action not in ("retirer", "retablir"):
            return jsonify(erreur="Introuvable."), 404
        motif = v.texte(v.corps_json(request), "motif", mini=3, maxi=300) if action == "retirer" else None
        cx = db.connecter()
        try:
            m = acces.maintenant()
            if action == "retirer":
                cur = cx.execute("UPDATE ecrits_commentaires SET retire_le = ?, retire_par = 'moderation' WHERE id = ? AND retire_le IS NULL", (m, cid))
            else:
                # (pas sous un écrit effacé pour de bon par son auteur : il n'a plus de page)
                cur = cx.execute("""UPDATE ecrits_commentaires SET retire_le = NULL, retire_par = NULL WHERE id = ? AND retire_par = 'moderation'
                                    AND ecrit_id IN (SELECT id FROM ecrits WHERE efface_le IS NULL)""", (cid,))
            if cur.rowcount != 1:
                return jsonify(erreur="Déjà fait (ou introuvable)." if action == "retirer"
                               else "Seul un commentaire retiré par la modération peut être rétabli."), 409
            if action == "retirer":
                cx.execute("UPDATE signalements_ecrits SET etat = 'traite' WHERE commentaire_id = ? AND etat = 'ouvert'", (cid,))
            trace("commentaire." + action, f"commentaire:{cid}", motif or "rétabli", cx)
            c = cx.un("SELECT user_id, ecrit_id FROM ecrits_commentaires WHERE id = ?", (cid,))
            notifications.emettre(cx, c["user_id"], "moderation", "Commentaire retiré par la modération" if action == "retirer" else "Commentaire rétabli",
                                  f"Motif : {motif}" if action == "retirer" else "Votre commentaire est de nouveau visible.",
                                  f"/app/ecrit.html?id={c['ecrit_id']}#commentaires", f"moderation:commentaire:{cid}:{action}:{m}")
            cx.valider()
            envois.declencher()
            return jsonify(ok=True)
        finally:
            cx.fermer()
