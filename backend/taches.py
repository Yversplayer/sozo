"""Tâches périodiques — ce qui doit se passer même si personne n'a de
navigateur ouvert.

  · annoncer les pages programmées dont l'heure est venue (la page, elle, est
    déjà lisible à l'heure dite : `acces.statut_effectif` le calcule à chaque
    lecture ; ici on PRÉVIENT les lecteurs qui suivent le livre) ;
  · rappeler aux auteurs que Plume se termine dans 3 jours ;
  · faire expirer les achats jamais payés (48 h) ;
  · effacer les manuscrits d'origine arrivés au bout de leur conservation ;
  · expédier la file des envois (et ses nouveaux essais).

Chaque tâche est IDEMPOTENTE : la lancer deux fois de suite ne produit rien
de plus (réservations atomiques, notifications dédoublonnées).

Lancement : `backend_venv/bin/python backend/tools/taches.py` toutes les 5
minutes (tâche planifiée de l'hébergeur), ou SOZO_TACHES_INTEGREES=1 pour un
fil dans le serveur web, protégé par un verrou PostgreSQL (un seul processus
les exécute, même avec plusieurs workers).
"""
import threading
import time
from datetime import datetime, timedelta, timezone

import argent
import db
import envois
import notifications
from validation import maintenant


def _iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def annoncer_parutions(livre_id=None):
    """Prévient les lecteurs qui suivent un livre de ses nouvelles pages.
    Une page n'est annoncée qu'une fois : elle est RÉSERVÉE (annoncee_le) par
    une mise à jour atomique avant toute notification."""
    m = maintenant()
    total = 0
    cx = db.connecter(globale=True)
    try:
        filtre = " AND p.book_id = ?" if livre_id else ""
        lots = cx.tous(f"""SELECT p.book_id, p.publie_le, MIN(p.n) AS de, MAX(p.n) AS a, COUNT(*) AS nb,
                                  SUM(CASE WHEN p.acces = 'free' THEN 1 ELSE 0 END) AS gratuites
                             FROM pages p JOIN books b ON b.id = p.book_id
                            WHERE p.statut <> 'draft' AND p.publie_le IS NOT NULL AND p.publie_le <= ? AND p.annoncee_le IS NULL
                              AND b.statut = 'actif'{filtre}
                            GROUP BY p.book_id, p.publie_le ORDER BY p.publie_le""", (m, *([livre_id] if livre_id else [])))
        for l in lots:
            pris = cx.execute("""UPDATE pages SET annoncee_le = ? WHERE book_id = ? AND publie_le = ? AND annoncee_le IS NULL
                                 AND statut <> 'draft'""", (m, l["book_id"], l["publie_le"])).rowcount
            if not pris:
                cx.valider()
                continue                        # un autre processus l'a déjà annoncé
            b = cx.un("SELECT slug, titre, owner_id FROM books WHERE id = ?", (l["book_id"],))
            quoi = f"La page {l['de']} est disponible" if l["nb"] == 1 else f"Les pages {l['de']} à {l['a']} sont disponibles"
            prix = "" if not l["gratuites"] else (" (gratuite)" if l["nb"] == 1 else f" ({l['gratuites']} gratuite{'s' if l['gratuites'] > 1 else ''})")
            for f in cx.tous("SELECT user_id FROM follows WHERE book_id = ? AND user_id <> ?", (l["book_id"], b["owner_id"])):
                if notifications.emettre(cx, f["user_id"], "parution", f"Nouveau dans « {b['titre']} »", quoi + prix + ".",
                                         f"/app/lire.html?id={b['slug']}&p={l['de']}", f"parution:{l['book_id']}:{l['publie_le']}"):
                    total += 1
            cx.valider()
    finally:
        cx.fermer()
    return total


def annoncer_ecrits():
    """Lot C : un écrit PROGRAMMÉ n'est annoncé aux abonnés de son auteur qu'à
    son heure (les écrits publiés tout de suite le sont aussitôt, par ecrits.py)."""
    import communaute
    total = 0
    cx = db.connecter(globale=True)
    try:
        for e in cx.tous("""SELECT * FROM ecrits WHERE statut = 'publie' AND annonce_le IS NULL AND publie_le <= ?
                             AND corbeille_le IS NULL AND retire_le IS NULL AND efface_le IS NULL ORDER BY publie_le LIMIT 500""", (maintenant(),)):
            total += communaute.annoncer_ecrit(cx, e)
            cx.valider()
    finally:
        cx.fermer()
    return total


def rappeler_plume():
    """Trois jours avant la fin de Plume : un rappel, une seule fois par abonnement."""
    m = datetime.now(timezone.utc)
    n = 0
    cx = db.connecter(globale=True)
    try:
        for s in cx.tous("""SELECT s.user_id, s.fin, s.payment_id FROM subscriptions s
                             WHERE s.revoque_le IS NULL AND s.fin > ? AND s.fin <= ?
                               AND s.fin = (SELECT MAX(fin) FROM subscriptions x WHERE x.user_id = s.user_id AND x.revoque_le IS NULL)""",
                         (_iso(m), _iso(m + timedelta(days=3)))):
            fin = datetime.strptime(s["fin"], "%Y-%m-%dT%H:%M:%SZ")
            if notifications.emettre(cx, s["user_id"], "plume", "Plume se termine bientôt",
                                     f"Votre abonnement Plume prend fin le {fin.day:02d}/{fin.month:02d}/{fin.year}. Vos versions et vos ventes restent acquises.",
                                     "/app/studio.html#revenus", f"plume:fin:{s['payment_id']}"):
                n += 1
        cx.valider()
    finally:
        cx.fermer()
    return n


def expirer_achats():
    cx = db.connecter(globale=True)
    try:
        n = argent.expirer(cx)
        cx.valider()
        return n
    finally:
        cx.fermer()


def tout():
    """Une passe complète. Rend le bilan, pour le journal de l'hébergeur."""
    import manuscrits
    return {"parutions": annoncer_parutions(), "ecrits": annoncer_ecrits(), "plume": rappeler_plume(), "achats_expires": expirer_achats(),
            "manuscrits_effaces": manuscrits.purger(), "envois": envois.distribuer(limite=200)}


def apres_publication(livre_id):
    """Publication immédiate depuis le studio : on n'attend pas la prochaine
    passe pour prévenir les lecteurs."""
    def _fil():
        try:
            if annoncer_parutions(livre_id):
                envois.distribuer(limite=200)
        except Exception:                      # noqa: BLE001 — la passe périodique reprendra
            pass
    threading.Thread(target=_fil, daemon=True).start()


# ── Exécution dans le serveur web (facultative) ────────────────────────────
_lance = False


def demarrer_dans_le_serveur(intervalle=120):
    """Un fil par processus ; seul celui qui obtient le verrou consultatif
    PostgreSQL travaille (plusieurs workers gunicorn ne doublent rien)."""
    global _lance
    if _lance:
        return
    _lance = True

    def boucle():
        while True:
            time.sleep(intervalle)
            try:
                cx = db.connecter(globale=True)
                try:
                    if cx.moteur == "postgres":
                        if not cx.un("SELECT pg_try_advisory_lock(424242) AS ok")["ok"]:
                            continue
                    try:
                        tout()
                    finally:
                        if cx.moteur == "postgres":
                            cx.execute("SELECT pg_advisory_unlock(424242)")
                finally:
                    cx.fermer()
            except Exception:                  # noqa: BLE001 — une passe ratée ne tue pas le fil
                pass
    threading.Thread(target=boucle, daemon=True, name="sozo-taches").start()
