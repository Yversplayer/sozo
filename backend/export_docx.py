"""Exporter son texte en Word (.docx), pour l'AUTEUR seulement (22/10/2026).

« Pas de PDF téléchargeable » vaut pour les LECTEURS : un livre vendu page par
page ne sort jamais d'un bloc. Mais l'auteur, lui, doit pouvoir reprendre SON
texte : relire sur papier, l'envoyer à un éditeur, le garder. Les routes qui
appellent ce module vérifient que le livre (ou l'écrit) est à lui.

Un .docx est une archive zip de quelques fichiers XML : on l'écrit à la main,
sans dépendance (même principe que les bulletins PDF de Klassio). Les marques
de la Plume deviennent des styles Word : « # » Titre 1, « ## » Titre 2,
« > » citation, « *** » saut de section, **gras**, *italique*, « • » et
« 1. » des paragraphes de liste.
"""
import io
import re
import zipfile
from xml.sax.saxutils import escape

_EMPHASE = re.compile(r"(\*\*(.+?)\*\*|\*(.+?)\*)")
# caractères interdits dans un XML 1.0 (un texte collé peut en contenir)
_INTERDITS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _runs(texte):
    """Un paragraphe en « runs » Word : gras et italique conservés."""
    out, i = [], 0
    for m in _EMPHASE.finditer(texte):
        if m.start() > i:
            out.append((texte[i:m.start()], ""))
        out.append((m.group(2), "<w:b/>") if m.group(2) is not None else (m.group(3), "<w:i/>"))
        i = m.end()
    if i < len(texte):
        out.append((texte[i:], ""))
    return "".join(f'<w:r><w:rPr>{p}</w:rPr><w:t xml:space="preserve">{escape(_INTERDITS.sub("", t))}</w:t></w:r>' for t, p in out if t)


def _para(texte, style=None, saut=False):
    # Python 3.9 : pas de barre oblique inverse dans une expression d'f-string
    st = '<w:pStyle w:val="%s"/>' % style if style else ""
    ppr = "<w:pPr>" + st + ("<w:pageBreakBefore/>" if saut else "") + "</w:pPr>"
    return "<w:p>" + ppr + _runs(texte) + "</w:p>"


def paragraphes(contenu, saut=False):
    """Les lignes d'une page (ou d'un écrit) en paragraphes Word."""
    out = []
    for k, ligne in enumerate(str(contenu or "").split("\n")):
        s = saut and k == 0
        if re.match(r"^\s*(\*\s*){3}\s*$", ligne):
            out.append(_para("⁂", "Separateur", s))
        elif ligne.startswith("## "):
            out.append(_para(ligne[3:], "Heading2", s))
        elif ligne.startswith("# "):
            out.append(_para(ligne[2:], "Heading1", s))
        elif ligne.startswith("> "):
            out.append(_para(ligne[2:], "Quote", s))
        else:
            out.append(_para(ligne, None, s))
    return "".join(out)


_STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:rPr><w:sz w:val="56"/><w:color w:val="6B0F1A"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="600"/></w:pPr><w:rPr><w:i/><w:color w:val="6B5B56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Separateur"><w:name w:val="Separateur"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="8E6B1F"/></w:rPr></w:style>
</w:styles>"""

_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

_DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""


def document(titre, sous_titre, sections):
    """`sections` : liste de (titre de section ou None, contenu en marques).
    Chaque section commence sur une nouvelle page."""
    corps = _para(titre, "Title") + (_para(sous_titre, "Subtitle") if sous_titre else "")
    for i, (t, contenu) in enumerate(sections):
        if t:
            corps += _para(t, "Heading1", saut=i > 0)
            corps += paragraphes(contenu)
        else:
            corps += paragraphes(contenu, saut=i > 0)
    xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
           f'{corps}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
           '</w:body></w:document>')
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _TYPES)
        z.writestr("_rels/.rels", _RELS)
        z.writestr("word/_rels/document.xml.rels", _DOC_RELS)
        z.writestr("word/styles.xml", _STYLES)
        z.writestr("word/document.xml", xml)
    return tampon.getvalue()


def nom_de_fichier(titre):
    import unicodedata
    s = unicodedata.normalize("NFD", titre).encode("ascii", "ignore").decode()
    return (re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")[:60] or "sozo") + ".docx"
