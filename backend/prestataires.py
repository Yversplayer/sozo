"""Prestataires de paiement — l'interface que devra remplir le futur agrégateur.

Aucun agrégateur n'est choisi (16/10/2026). Ce module fixe le CONTRAT, pour
que son branchement ne touche ni aux droits, ni au registre, ni aux tests :

1. Le prestataire nous notifie (webhook signé, `argent.paiement_webhook`).
2. `traduire()` convertit SA charge utile en événement STANDARD :
       {"event_id", "payment_id", "statut": success|failed|pending|unknown,
        "montant" (centimes), "devise", "frais" (centimes, facultatif)}
3. `argent.traiter_evenement()` applique l'événement : rejeu ignoré, montant et
   devise comparés à l'achat, confirmation atomique, registre.

Pour brancher l'agrégateur retenu : écrire sa classe à partir de SA
documentation réelle (signature, champs, statuts), l'ajouter à ADAPTATEURS,
et donner son secret dans SOZO_WEBHOOK_SECRET_<NOM>. Rien d'autre.

Le SIMULATEUR n'existe qu'en mode test et jamais sur une base distante
(`simulation_permise`) : il ne peut pas confirmer un paiement en production.
"""
import config


class Prestataire:
    """Base : un prestataire qui parle déjà le format standard."""
    nom = "standard"

    def traduire(self, d):
        return d


class Simulateur(Prestataire):
    """Faux prestataire des tests et de la démonstration locale. Ses paiements
    portent prestataire = 'simulateur' : l'administration les affiche TEST."""
    nom = "simulateur"

    ISSUES = {"success", "failed", "pending", "unknown", "montant_faux", "doublon"}

    def evenement(self, paiement, issue, numero):
        statut = {"montant_faux": "success", "doublon": "success"}.get(issue, issue)
        e = {"event_id": f"sim-{paiement['id']}-{numero}", "payment_id": paiement["id"], "statut": statut}
        if statut == "success":
            e.update(montant=paiement["montant"] // 2 if issue == "montant_faux" else paiement["montant"],
                     devise=paiement["devise"], frais=0)
        return e


ADAPTATEURS = {"simulateur": Simulateur()}


def traduire(nom, d):
    return ADAPTATEURS.get(nom, Prestataire()).traduire(d)


def simulation_permise():
    """Jamais en production : mode test exigé, et refusé sur une base distante
    (config.mode_test() le refuse déjà ; on le revérifie ici, à dessein)."""
    return config.mode_test() and not config.base_distante()
