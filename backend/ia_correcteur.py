"""Relecture d'une page par l'IA (Claude, Anthropic) — demandée par le
propriétaire le 19/10/2026 : « le dictionnaire corrige des fautes
inexistantes ; rajoute une IA derrière ».

Le correcteur du navigateur (app/langue/correcteur.js) reste le premier
filet : il tourne sur l'appareil, sans rien envoyer. La relecture par l'IA est
un SECOND avis, à la demande de l'auteur (un bouton), jamais automatique :

* elle n'écrit rien. Elle PROPOSE ; l'auteur clique pour appliquer ;
* elle ne part que si l'auteur la lance, sur une page de SON livre, et le
  bouton dit que le texte est envoyé à Anthropic pour être relu ;
* chaque proposition est VÉRIFIÉE ici : l'extrait fautif doit figurer tel
  quel dans la page, et la correction doit le changer. Ce que le modèle
  invente (un passage absent, une « faute » identique au texte) est jeté ;
* sans ANTHROPIC_API_KEY, rien ne part (503 « relecture indisponible ») ;
  une panne, un refus ou une réponse tronquée rendent une erreur honnête,
  jamais une fausse page « sans faute » ;
* plafond par auteur et par jour (SOZO_IA_PLAFOND_JOUR, 40 par défaut).
"""
import json
import os

MODELE_PAR_DEFAUT = "claude-opus-5-5"
DELAI_SECONDES = 25
TEXTE_MAX = 8000
TYPES = ("orthographe", "grammaire", "conjugaison", "accord", "ponctuation", "style")


class Indisponible(Exception):
    """La relecture n'a pas pu se faire (clé absente, panne, refus)."""


def active():
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


def plafond_jour():
    try:
        return max(0, int(os.environ.get("SOZO_IA_PLAFOND_JOUR", "40")))
    except ValueError:
        return 40


def _schema():
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["corrections"],
        "properties": {
            "corrections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["extrait", "correction", "type", "explication"],
                    "properties": {
                        "extrait": {"type": "string"},
                        "correction": {"type": "string"},
                        "type": {"type": "string", "enum": list(TYPES)},
                        "explication": {"type": "string"},
                    },
                },
            }
        },
    }


CONSIGNE = (
    "Tu es correcteur professionnel de langue française pour une plateforme d'édition chrétienne. "
    "On te donne UNE page écrite par un auteur. Relève seulement les VRAIES fautes : orthographe, "
    "grammaire, conjugaison, accords, ponctuation fautive. Ne signale jamais une tournure correcte, "
    "un choix de style, un régionalisme assumé, un nom propre, un nom biblique, une citation de la "
    "Bible (Louis Segond 1910 : son orthographe et sa ponctuation anciennes sont voulues), une "
    "apostrophe droite ou courbe, ni une majuscule après « ! » ou « ? » dans une exclamation. "
    "Dans le doute, ne signale rien : une fausse alerte fait perdre confiance à l'auteur. "
    "Pour chaque faute : `extrait` recopie EXACTEMENT les quelques mots fautifs tels qu'ils "
    "apparaissent dans la page (assez pour être uniques), `correction` donne ces mêmes mots "
    "corrigés, `explication` dit la règle en une phrase simple. Le type « style » est réservé aux "
    "répétitions ou lourdeurs flagrantes, au plus trois. Une page sans faute rend une liste vide."
)


def _client():
    import anthropic
    return anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""), timeout=DELAI_SECONDES, max_retries=0)


def _appeler(texte):
    """Rend la liste brute proposée par le modèle. Lève Indisponible."""
    import anthropic
    try:
        rep = _client().messages.create(
            model=os.environ.get("SOZO_IA_MODELE") or MODELE_PAR_DEFAUT,
            max_tokens=8000,
            system=CONSIGNE,
            messages=[{"role": "user", "content": "Page à relire :\n<page>\n" + texte + "\n</page>"}],
            # Relire une page demande de l'attention, pas une longue réflexion.
            # La sortie structurée garantit un JSON au schéma (type sur liste fermée).
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": _schema()}},
        )
    except anthropic.APIError as e:
        raise Indisponible("Le service de relecture ne répond pas. Réessayez dans un moment.") from e
    if getattr(rep, "stop_reason", None) != "end_turn":
        # Refus ou réponse tronquée : on ne prétend pas que la page est juste.
        raise Indisponible("La relecture n'a pas abouti pour cette page.")
    brut = next((b.text for b in rep.content if getattr(b, "type", None) == "text"), "")
    try:
        d = json.loads(brut)
    except ValueError as e:
        raise Indisponible("La relecture n'a pas abouti pour cette page.") from e
    liste = d.get("corrections") if isinstance(d, dict) else None
    if not isinstance(liste, list):
        raise Indisponible("La relecture n'a pas abouti pour cette page.")
    return liste


def filtrer(texte, liste):
    """Ne garde que les propositions VÉRIFIABLES dans le texte, avec leur
    position. Rien de ce que le modèle invente ne passe."""
    out, prises = [], []
    for c in liste[:60]:
        if not isinstance(c, dict):
            continue
        ext, cor, typ, expl = c.get("extrait"), c.get("correction"), c.get("type"), c.get("explication")
        if not all(isinstance(x, str) for x in (ext, cor, typ, expl)) or typ not in TYPES:
            continue
        if not ext.strip() or ext == cor or len(ext) > 300 or len(cor) > 300:
            continue
        debut = texte.find(ext)
        while debut >= 0 and any(a < debut + len(ext) and debut < b for a, b in prises):
            debut = texte.find(ext, debut + 1)          # même extrait plus loin : on prend l'occurrence libre
        if debut < 0:
            continue                                     # extrait absent de la page : inventé, jeté
        prises.append((debut, debut + len(ext)))
        out.append({"debut": debut, "fin": debut + len(ext), "extrait": ext, "correction": cor,
                    "type": typ, "explication": expl.strip()[:300]})
    return sorted(out, key=lambda x: x["debut"])


def relire(texte):
    if not active():
        raise Indisponible("La relecture par l'IA n'est pas encore activée sur ce serveur.")
    return filtrer(texte, _appeler(texte))
