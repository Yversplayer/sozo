"""L'argent de Sōzō : achats, droits, reçus, registre, reversements, Plume.

Sans agrégateur Mobile Money, le paiement est DÉCLARATIF (modèle Klassio) :
le lecteur envoie l'argent au numéro Sōzō, déclare la référence de la
transaction, un administrateur la vérifie et confirme. Rien n'est présenté
comme « payé en ligne ». Quand un agrégateur sera choisi, ses notifications
arriveront par le webhook ci-dessous et passeront par la MÊME confirmation.

Règles (INSPIRATION_SECURITE_BACKEND.md §7) :
* le montant est calculé par le SERVEUR à partir des critères (livre, page,
  chapitre) ; le navigateur n'annonce jamais un prix ;
* clé d'idempotence UNIQUE PAR ACHETEUR : un double clic ne crée qu'un achat ;
* états explicites ; UNKNOWN ≠ FAILED ; une transition est atomique : un
  webhook rejoué, deux administrateurs qui cliquent en même temps → UNE
  confirmation ;
* les droits, le reçu et le registre naissent dans la même transaction que
  la confirmation, et seulement là ;
* un droit acquis n'est jamais retiré, une confirmation jamais annulée.
"""
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from flask import g, jsonify, request

import acces
import config
import db
import security
import prestataires
import validation as v
from app import auditer, connectee, ouverte

OPERATEURS = {"M-Pesa", "Orange Money", "Airtel Money", "Afrimoney", "Virement"}
ETATS_OUVERTS = ("CREATED", "PENDING", "UNKNOWN")


def _now():
    return acces.maintenant()


# ── Plume ──────────────────────────────────────────────────────────────────

def plume_actif(cx, user_id, a=None):
    r = cx.un("SELECT MAX(fin) AS fin FROM subscriptions WHERE user_id = ? AND revoque_le IS NULL", (user_id,))
    fin = r["fin"] if r else None
    return {"actif": bool(fin and fin > (a or _now())), "fin": fin, "prix": config.plume_prix_centimes() / 100}


# ── Ce qu'on peut acheter ──────────────────────────────────────────────────

def _deja(cx, user_id, book_id):
    return acces.droits(cx, user_id, book_id)


def _chapitre(cx, book_id, n):
    return cx.un("SELECT titre, page_de, page_a FROM chapters WHERE book_id = ? AND page_de <= ? AND page_a >= ?", (book_id, n, n))


def options(cx, user, b, n=None):
    """Options d'achat affichables (prix en dollars, pour l'écran)."""
    plages = _deja(cx, user["id"], b["id"])
    out = []
    if n is not None and b["prix_page"] is not None and not acces.couverte(plages, n):
        out.append({"objet": "page", "n": n, "libelle": "Cette page", "detail": f"Page {n}", "prix": b["prix_page"] / 100})
    if n is not None and b["prix_chapitre"] is not None:
        ch = _chapitre(cx, b["id"], n)
        if ch and not any(acces.couverte(plages, k) for k in range(ch["page_de"], ch["page_a"] + 1)):
            out.append({"objet": "chapitre", "n": n, "libelle": f"Le chapitre « {ch['titre']} »",
                        "detail": f"pages {ch['page_de']} à {ch['page_a']}, pages à venir comprises", "prix": b["prix_chapitre"] / 100})
    if b["prix_livre"] is not None and not acces.couverte([(de, a) for de, a in plages if de == 1 and a is None], 1):
        out.append({"objet": "livre", "libelle": "Tout le livre", "detail": "pages payantes présentes et à venir", "prix": b["prix_livre"] / 100})
    return out


def _calculer(cx, user, d):
    """Critères → (objet, book, page_de, page_a, montant). Refuse tout ce qui
    n'est pas en vente ou déjà acquis. Le prix vient de la base."""
    objet = v.choix(d, "objet", {"page", "chapitre", "livre", "plume"})
    if objet == "plume":
        if user["role"] != "auteur":
            raise v.Invalide("Plume est réservé aux auteurs.", "objet")
        return objet, None, None, None, config.plume_prix_centimes()
    slug = v.texte(d, "livre", maxi=80)
    b0 = cx.un("SELECT id FROM books WHERE slug = ?", (slug,))
    b = acces.livre(cx, user, b0["id"] if b0 else None)
    if not b or b["statut"] != "actif":
        return None
    if b["owner_id"] == user["id"]:
        raise v.Invalide("Vous ne pouvez pas acheter votre propre livre.", "livre")
    plages = _deja(cx, user["id"], b["id"])
    if objet == "livre":
        if b["prix_livre"] is None:
            raise v.Invalide("Ce livre ne se vend pas en entier.", "objet")
        if any(de == 1 and a is None for de, a in plages):
            raise v.Invalide("Vous possédez déjà ce livre.", "objet")
        return objet, b, 1, None, b["prix_livre"]
    n = v.entier(d, "n", mini=1, maxi=100000)
    _, p, e = acces.page_et_etat(cx, user, b["id"], n)
    if objet == "page":
        if e != "locked" or b["prix_page"] is None:
            raise v.Invalide("Cette page ne s'achète pas à l'unité (gratuite, déjà achetée, à venir ou vendue par chapitre).", "n")
        return objet, b, n, n, b["prix_page"]
    ch = _chapitre(cx, b["id"], n)
    if not ch or b["prix_chapitre"] is None:
        raise v.Invalide("Ce chapitre ne se vend pas.", "n")
    if any(acces.couverte(plages, k) for k in range(ch["page_de"], ch["page_a"] + 1)):
        raise v.Invalide("Vous possédez déjà une partie de ce chapitre : achetez les pages restantes une à une.", "n")
    return objet, b, ch["page_de"], ch["page_a"], b["prix_chapitre"]


# ── La confirmation : un seul chemin, atomique ─────────────────────────────

def confirmer(cx, payment_id, par, frais=0):
    """Passe le paiement en CONFIRMED SI ET SEULEMENT SI il était ouvert, puis
    écrit droits, reçu et registre. Rend False si déjà traité (rejeu).

    `frais` : ce que le prestataire a retenu (centimes). Décision du 16/10/2026 :
    les frais sont pris sur la part de Sōzō, jamais sur celle de l'auteur. Ils
    ont leur propre ligne — sans elle, le registre ne se rapprochait pas du
    relevé de l'opérateur et la commission paraissait plus haute qu'elle n'est."""
    m = _now()
    cur = cx.execute(
        "UPDATE payments SET etat = 'CONFIRMED', confirme_le = ?, confirme_par = ?, updated_at = ? WHERE id = ? AND etat IN ('CREATED', 'PENDING', 'UNKNOWN')",
        (m, par, m, payment_id))
    if cur.rowcount != 1:
        return False
    p = cx.un("SELECT * FROM payments WHERE id = ?", (payment_id,))
    if p["objet"] == "plume":
        actuel = plume_actif(cx, p["user_id"], m)
        debut = actuel["fin"] if actuel["actif"] else m
        fin = (datetime.strptime(debut, "%Y-%m-%dT%H:%M:%SZ") + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        cx.execute("INSERT INTO subscriptions (user_id, debut, fin, payment_id) VALUES (?, ?, ?, ?)", (p["user_id"], debut, fin, payment_id))
        cx.execute("INSERT INTO ledger (payment_id, beneficiaire, author_id, montant, created_at) VALUES (?, 'plateforme', NULL, ?, ?)", (payment_id, p["montant"] - frais, m))
    else:
        cx.execute("INSERT INTO entitlements (user_id, book_id, page_de, page_a, payment_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                   (p["user_id"], p["book_id"], p["page_de"], p["page_a"], payment_id, m))
        auteur = cx.un("SELECT owner_id FROM books WHERE id = ?", (p["book_id"],))["owner_id"]
        pct = config.commission_pct(plume=plume_actif(cx, auteur, m)["actif"])
        commission = (p["montant"] * pct + 50) // 100           # arrondi au centime, en entiers
        cx.execute("INSERT INTO ledger (payment_id, beneficiaire, author_id, montant, created_at) VALUES (?, 'auteur', ?, ?, ?)", (payment_id, auteur, p["montant"] - commission, m))
        cx.execute("INSERT INTO ledger (payment_id, beneficiaire, author_id, montant, created_at) VALUES (?, 'plateforme', NULL, ?, ?)", (payment_id, commission - frais, m))
    if frais:
        cx.execute("INSERT INTO ledger (payment_id, beneficiaire, author_id, montant, created_at) VALUES (?, 'frais', NULL, ?, ?)", (payment_id, frais, m))
    annee = m[:4]
    cx.execute("INSERT INTO receipts (payment_id, user_id, numero, created_at) VALUES (?, ?, ?, ?)",
               (payment_id, p["user_id"], f"SZ-{annee}-{payment_id:06d}", m))
    return True


def rembourser(cx, payment_id, par, motif, reference=None):
    """Remboursement INTÉGRAL d'un paiement confirmé (décision du 16/10/2026 :
    le droit de lecture est retiré). Rien n'est effacé ni réécrit :
    * une ligne dans refunds (UNIQUE : jamais deux fois) ;
    * le droit ou l'abonnement marqués révoqués ;
    * des lignes de registre NÉGATIVES qui annulent la part de l'auteur et de
      Sōzō. Les frais du prestataire, eux, ne reviennent pas : Sōzō les absorbe.
    Rend False si le paiement n'est pas confirmé ou déjà remboursé."""
    p = cx.un("SELECT * FROM payments WHERE id = ? AND etat = 'CONFIRMED'", (payment_id,))
    if not p or cx.un("SELECT id FROM refunds WHERE payment_id = ?", (payment_id,)):
        return False
    m = _now()
    cx.execute("INSERT INTO refunds (payment_id, user_id, montant, motif, reference, par, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
               (payment_id, p["user_id"], p["montant"], motif, reference, par, m))
    cx.execute("UPDATE entitlements SET revoque_le = ? WHERE payment_id = ? AND revoque_le IS NULL", (m, payment_id))
    cx.execute("UPDATE subscriptions SET revoque_le = ? WHERE payment_id = ? AND revoque_le IS NULL", (m, payment_id))
    lignes = cx.tous("SELECT beneficiaire, author_id, SUM(montant) AS s FROM ledger WHERE payment_id = ? GROUP BY beneficiaire, author_id", (payment_id,))
    for l in lignes:
        if l["beneficiaire"] == "frais" or not l["s"]:
            continue
        cx.execute("INSERT INTO ledger (payment_id, beneficiaire, author_id, montant, created_at) VALUES (?, ?, ?, ?, ?)",
                   (payment_id, l["beneficiaire"], l["author_id"], -l["s"], m))
    frais = sum(l["s"] for l in lignes if l["beneficiaire"] == "frais")
    if frais:   # le lecteur récupère tout ; les frais déjà retenus restent une perte de Sōzō
        cx.execute("INSERT INTO ledger (payment_id, beneficiaire, author_id, montant, created_at) VALUES (?, 'plateforme', NULL, ?, ?)",
                   (payment_id, -frais, m))
    return True


DELAI_ACHAT = timedelta(hours=48)


def expirer(cx):
    """Un achat CRÉÉ et jamais déclaré expire après 48 h (décision du 16/10/2026).
    Avant, il restait ouvert indéfiniment : une référence déclarée des semaines
    plus tard restait confirmable, au prix d'alors. Seul CREATED expire : un
    achat DÉCLARÉ (PENDING) attend la vérification, l'argent est peut-être parti."""
    limite = (datetime.utcnow() - DELAI_ACHAT).strftime("%Y-%m-%dT%H:%M:%SZ")
    return cx.execute("UPDATE payments SET etat = 'EXPIRED', updated_at = ? WHERE etat = 'CREATED' AND created_at < ?",
                      (_now(), limite)).rowcount


def refuser(cx, payment_id, par, motif):
    """Refus (référence introuvable, montant faux…) : jamais après confirmation."""
    cur = cx.execute("UPDATE payments SET etat = 'FAILED', motif_refus = ?, confirme_par = ?, updated_at = ? WHERE id = ? AND etat IN ('CREATED', 'PENDING', 'UNKNOWN')",
                     (motif, par, _now(), payment_id))
    return cur.rowcount == 1


def solde_auteur(cx, author_id):
    gagne = cx.un("SELECT COALESCE(SUM(montant), 0) AS s FROM ledger WHERE beneficiaire = 'auteur' AND author_id = ?", (author_id,))["s"]
    verse = cx.un("SELECT COALESCE(SUM(montant), 0) AS s FROM payouts WHERE author_id = ? AND etat IN ('DEMANDE', 'PAYE')", (author_id,))["s"]
    return gagne, verse, gagne - verse


def _public(p):
    return {k: p[k] for k in ("id", "objet", "montant", "devise", "etat", "page_de", "page_a", "operateur", "reference", "motif_refus", "created_at", "confirme_le")}


def traiter_evenement(prestataire, d):
    """Un événement de paiement au format STANDARD de Sōzō (voir prestataires.py),
    déjà authentifié. Commun au webhook réel et au simulateur de test : le
    simulateur passe exactement par les mêmes garde-fous."""
    event_id = v.texte(d, "event_id", maxi=100)
    pid = v.entier(d, "payment_id", mini=1)
    statut = v.choix(d, "statut", {"success", "failed", "pending", "unknown"})
    # Le MONTANT et la DEVISE réellement encaissés sont exigés : une
    # notification signée mais rattachée au mauvais achat (ou partielle) ne
    # doit jamais ouvrir un livre plus cher que ce qui a été payé.
    montant = v.entier(d, "montant", mini=0, maxi=100_000_000) if statut == "success" else None
    devise = v.texte(d, "devise", maxi=3) if statut == "success" else None
    frais = v.entier(d, "frais", mini=0, maxi=100_000_000, requis=False) or 0 if statut == "success" else 0
    # Connexion GLOBALE : le prestataire agit pour le compte de l'acheteur,
    # authentifié par la signature HMAC vérifiée ci-dessus.
    cx = db.connecter(globale=True)
    try:
        cur = cx.execute("INSERT INTO webhook_events (prestataire, event_id, recu_le) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", (prestataire, event_id, _now()))
        if cur.rowcount != 1:
            cx.valider()
            return {"ok": True, "deja_traite": True}
        p = cx.un("SELECT montant, devise, etat FROM payments WHERE id = ?", (pid,))
        if statut == "success" and p and (montant != p["montant"] or devise.upper() != p["devise"] or frais > montant):
            # Encaissement non conforme : rien n'est ouvert, l'achat part en revue
            cx.execute("UPDATE payments SET etat = 'UNKNOWN', motif_refus = ?, updated_at = ? WHERE id = ? AND etat IN ('CREATED', 'PENDING', 'EXPIRED')",
                       (f"Encaissement non conforme : {montant} {devise} reçu(s), {p['montant']} {p['devise']} attendu(s)", _now(), pid))
            auditer("webhook.montant_divergent", ressource=f"payment:{pid}", apres=f"{event_id}:{montant}{devise}", resultat="refus", cx=cx)
            cx.valider()
            return {"ok": True, "applique": False, "revue": True}
        if statut == "success" and p and p["etat"] == "EXPIRED":
            # Argent reçu après l'expiration : on ne le perd pas, un humain tranche
            cx.execute("UPDATE payments SET etat = 'UNKNOWN', motif_refus = 'Payé après expiration', updated_at = ? WHERE id = ? AND etat = 'EXPIRED'", (_now(), pid))
            auditer("webhook.apres_expiration", ressource=f"payment:{pid}", apres=event_id, resultat="refus", cx=cx)
            cx.valider()
            return {"ok": True, "applique": False, "revue": True}
        if statut == "success":
            fait = confirmer(cx, pid, f"prestataire:{prestataire}", frais=frais)
        elif statut == "failed":
            fait = refuser(cx, pid, f"prestataire:{prestataire}", "Refusé par le prestataire")
        elif statut == "unknown":
            fait = cx.execute("UPDATE payments SET etat = 'UNKNOWN', updated_at = ? WHERE id = ? AND etat IN ('CREATED', 'PENDING')", (_now(), pid)).rowcount == 1
        else:
            fait = cx.execute("UPDATE payments SET etat = 'PENDING', updated_at = ? WHERE id = ? AND etat = 'CREATED'", (_now(), pid)).rowcount == 1
        auditer("webhook." + statut, ressource=f"payment:{pid}", apres=event_id, resultat="ok" if fait else "refus", cx=cx)
        cx.valider()
        return {"ok": True, "applique": fait}
    finally:
        cx.fermer()


def enregistrer(app):

    @app.get("/api/paiements/moyens")
    @connectee
    def paiement_moyens():
        nums = config.numeros_paiement()
        test = not nums and config.mode_test()
        if test:
            nums = [{"operateur": "M-Pesa", "numero": "+243 000 000 000 (TEST)"}, {"operateur": "Orange Money", "numero": "+243 000 000 001 (TEST)"}]
        return jsonify(ouverts=bool(nums), test=test, numeros=nums, operateurs=sorted(OPERATEURS))

    @app.post("/api/paiements")
    @connectee
    def paiement_creer():
        d = v.corps_json(request)
        cle = v.texte(d, "idempotency_key", mini=8, maxi=64)
        cx = db.connecter()
        try:
            if security.depasse(cx, "paiement:compte", str(g.user["id"])):
                cx.valider()
                return jsonify(erreur="Trop de demandes de paiement. Réessayez plus tard."), 429
            exist = cx.un("SELECT * FROM payments WHERE user_id = ? AND idempotency_key = ?", (g.user["id"], cle))
            if exist:   # double clic, réseau qui répète : le même achat, pas un second
                cx.valider()
                return jsonify(paiement=_public(exist), deja=True), 200
            r = _calculer(cx, g.user, d)
            if r is None:
                return jsonify(erreur="Introuvable."), 404
            objet, b, de, a, montant = r
            m = _now()
            pid = cx.inserer("""INSERT INTO payments (user_id, objet, book_id, page_de, page_a, montant, etat, idempotency_key, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?)""",
                             (g.user["id"], objet, b["id"] if b else None, de, a, montant, cle, m, m))
            auditer("paiement.creation", ressource=f"payment:{pid}", apres=f"{objet}:{montant}", cx=cx)
            cx.valider()
            return jsonify(paiement=_public(cx.un("SELECT * FROM payments WHERE id = ?", (pid,)))), 201
        finally:
            cx.fermer()

    def _mien(cx, pid):
        p = cx.un("SELECT * FROM payments WHERE id = ? AND user_id = ?", (pid, g.user["id"]))
        return p

    @app.get("/api/paiements/<int:pid>")
    @connectee
    def paiement_lire(pid):
        cx = db.connecter()
        try:
            p = _mien(cx, pid)
            if not p:
                return jsonify(erreur="Introuvable."), 404
            r = cx.un("SELECT numero FROM receipts WHERE payment_id = ?", (pid,))
            return jsonify(paiement=_public(p), recu=r["numero"] if r else None)
        finally:
            cx.fermer()

    @app.post("/api/paiements/<int:pid>/declaration")
    @connectee
    def paiement_declarer(pid):
        d = v.corps_json(request)
        operateur = v.choix(d, "operateur", OPERATEURS)
        reference = v.texte(d, "reference", mini=4, maxi=40)
        if not reference.replace("-", "").replace(".", "").isalnum():
            raise v.Invalide("La référence ne contient que des lettres, des chiffres, « - » ou « . ».", "reference")
        if not config.numeros_paiement() and not config.mode_test():
            return jsonify(erreur="Les paiements ne sont pas encore ouverts sur Sōzō."), 409
        cx = db.connecter()
        try:
            expirer(cx)
            p = _mien(cx, pid)
            if not p:
                return jsonify(erreur="Introuvable."), 404
            if p["etat"] == "EXPIRED":
                cx.valider()
                return jsonify(erreur="Cet achat a expiré (48 h sans paiement). Recommencez l'achat : le prix sera celui d'aujourd'hui.", code="expire"), 409
            # Une même transaction Mobile Money ne paie qu'un achat — y compris celui
            # d'un AUTRE compte : seule lecture globale de ce module, réduite à un oui/non.
            cg = db.connecter(globale=True)
            try:
                deja = cg.un("SELECT id FROM payments WHERE operateur = ? AND reference = ? AND id <> ? AND etat <> 'FAILED'", (operateur, reference, pid))
            finally:
                cg.fermer()
            if deja:
                auditer("paiement.declaration", ressource=f"payment:{pid}", apres="reference_deja_utilisee", resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Cette référence a déjà été déclarée pour un autre achat.", champ="reference"), 409
            cur = cx.execute("UPDATE payments SET etat = 'PENDING', operateur = ?, reference = ?, prestataire = 'declaration', updated_at = ? WHERE id = ? AND etat = 'CREATED'",
                             (operateur, reference, _now(), pid))
            if cur.rowcount != 1:
                return jsonify(erreur="Ce paiement a déjà été déclaré ou traité."), 409
            auditer("paiement.declaration", ressource=f"payment:{pid}", apres=f"{operateur}:{reference}", cx=cx)
            cx.valider()
            return jsonify(paiement=_public(cx.un("SELECT * FROM payments WHERE id = ?", (pid,))))
        finally:
            cx.fermer()

    @app.post("/api/paiements/<int:pid>/annulation")
    @connectee
    def paiement_annuler(pid):
        cx = db.connecter()
        try:
            if not _mien(cx, pid):
                return jsonify(erreur="Introuvable."), 404
            cur = cx.execute("UPDATE payments SET etat = 'CANCELLED', updated_at = ? WHERE id = ? AND user_id = ? AND etat = 'CREATED'", (_now(), pid, g.user["id"]))
            if cur.rowcount != 1:
                return jsonify(erreur="Ce paiement ne peut plus être annulé."), 409
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/paiements/webhook/<prestataire>")
    @ouverte
    def paiement_webhook(prestataire):
        """Notification d'un futur agrégateur. Signée (HMAC-SHA256 du corps
        brut) ; un événement déjà reçu n'est jamais rejoué ; la confirmation
        passe par le même chemin atomique que l'administration."""
        secret = config.secret_webhook(prestataire)
        if not secret:
            return jsonify(erreur="Introuvable."), 404
        brut = request.get_data()
        sig = request.headers.get("X-Sozo-Signature", "")
        attendu = hmac.new(secret.encode(), brut, hashlib.sha256).hexdigest()
        if not sig or not hmac.compare_digest(sig, attendu):
            auditer("webhook.signature", ressource=prestataire, resultat="refus")
            return jsonify(erreur="Signature invalide."), 401
        try:
            d = json.loads(brut)
            assert isinstance(d, dict)
        except Exception:
            raise v.Invalide("Corps JSON invalide.")
        return jsonify(traiter_evenement(prestataire, prestataires.traduire(prestataire, d)))


    @app.post("/api/paiements/<int:pid>/simulation")
    @connectee
    def paiement_simuler(pid):
        """Banc d'essai : joue une réponse de prestataire sur SON propre achat.
        Inexistant (404) hors mode test : un utilisateur ordinaire ne peut pas
        s'en servir en production."""
        if not prestataires.simulation_permise():
            return jsonify(erreur="Introuvable."), 404
        issue = v.choix(v.corps_json(request), "issue", prestataires.Simulateur.ISSUES)
        cx = db.connecter()
        try:
            p = _mien(cx, pid)
            if not p:
                return jsonify(erreur="Introuvable."), 404
            cx.execute("UPDATE payments SET prestataire = 'simulateur' WHERE id = ? AND etat IN ('CREATED', 'PENDING')", (pid,))
            cx.valider()
        finally:
            cx.fermer()
        sim = prestataires.ADAPTATEURS["simulateur"]
        r = traiter_evenement("simulateur", sim.evenement(p, issue, 1))
        if issue == "doublon":       # le prestataire renvoie la MÊME notification
            r = {"premier": r, "second": traiter_evenement("simulateur", sim.evenement(p, issue, 1))}
        return jsonify(r)

    # ── Côté auteur : ventes et reversements ───────────────────────────────
    @app.get("/api/studio/ventes")
    @connectee
    def studio_ventes():
        cx = db.connecter()
        try:
            uid = g.user["id"]
            gagne, verse, solde = solde_auteur(cx, uid)
            parlivre = cx.tous("""SELECT b.slug, b.titre, COUNT(l.id) AS ventes, COALESCE(SUM(l.montant), 0) AS net
                                    FROM books b LEFT JOIN payments p ON p.book_id = b.id AND p.etat = 'CONFIRMED'
                                    LEFT JOIN ledger l ON l.payment_id = p.id AND l.beneficiaire = 'auteur'
                                   WHERE b.owner_id = ? GROUP BY b.id, b.slug, b.titre ORDER BY b.id""", (uid,))
            reversements = cx.tous("SELECT id, montant, operateur, etat, reference, motif, created_at, traite_le FROM payouts WHERE author_id = ? ORDER BY id DESC", (uid,))
            return jsonify(gagne=gagne, verse=verse, solde=solde, livres=parlivre, reversements=reversements,
                           commission=config.commission_pct(), commission_plume=config.commission_pct(plume=True),
                           plume=plume_actif(cx, uid))
        finally:
            cx.fermer()

    @app.post("/api/studio/reversements")
    @connectee
    def demander_reversement():
        d = v.corps_json(request)
        montant = v.centimes(d, "montant", maxi=10_000_000)
        operateur = v.choix(d, "operateur", OPERATEURS)
        numero = v.texte(d, "numero", mini=6, maxi=30)
        if montant < 100:
            raise v.Invalide("Un reversement est d'au moins 1,00 $.", "montant")
        cx = db.connecter()
        try:
            # Verrou d'abord : deux demandes simultanées liraient le même solde et
            # seraient servies deux fois. L'écriture factice prend le verrou de la
            # ligne (PostgreSQL) ou de la base (SQLite) AVANT la relecture.
            cx.execute("UPDATE users SET id = id WHERE id = ?", (g.user["id"],))
            # Le solde est relu ICI, dans la transaction : le navigateur n'annonce rien
            _, _, solde = solde_auteur(cx, g.user["id"])
            if montant > solde:
                return jsonify(erreur=f"Montant supérieur à votre solde ({solde / 100:.2f} $).", champ="montant"), 409
            rid = cx.inserer("INSERT INTO payouts (author_id, montant, operateur, numero, etat, created_at) VALUES (?, ?, ?, ?, 'DEMANDE', ?)",
                             (g.user["id"], montant, operateur, numero, _now()))
            auditer("reversement.demande", ressource=f"payout:{rid}", apres=str(montant), cx=cx)
            cx.valider()
            return jsonify(ok=True, id=rid), 201
        finally:
            cx.fermer()
