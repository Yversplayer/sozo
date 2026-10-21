"""Le texte d'une page ou d'un écrit, avec sa mise en forme légère.

Depuis le 21/10/2026, l'éditeur (« un mini Word ») permet le gras, l'italique,
les titres et les citations. Tout reste du TEXTE, rangé ligne par ligne, avec
quelques marques que la liseuse traduit (app/ui.js, `mise.paragraphes`) :

    # Titre            un titre dans la page
    > citation         un passage en retrait
    ***                le séparateur choisi par l'auteur
    **gras**  *italique*

Pourquoi du texte et pas du HTML : le texte vient de n'importe qui. Du HTML
enregistré tel quel rouvrirait la porte aux scripts ; ici, le navigateur
échappe TOUT avant de poser les marques, et le serveur ne stocke jamais de
balise. `nu()` rend le texte tel que le lecteur le lit, sans les marques : une
épingle ou une recherche compare ce que l'œil voit, pas la cuisine.
"""
import re

_EMPHASE = re.compile(r"\*\*(.+?)\*\*|\*(.+?)\*")
_PREFIXE = re.compile(r"^(#{1,2} |> |• |\d{1,3}\. )")
_SEPARATEUR = re.compile(r"^\s*(\*\s*){3}\s*$")


def nu(contenu):
    lignes = []
    for ligne in str(contenu or "").split("\n"):
        if _SEPARATEUR.match(ligne):
            lignes.append("")
            continue
        ligne = _PREFIXE.sub("", ligne)
        lignes.append(_EMPHASE.sub(lambda m: m.group(1) or m.group(2), ligne))
    return "\n".join(lignes)
