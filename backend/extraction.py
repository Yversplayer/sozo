"""Extraction d'un manuscrit (PDF, EPUB, DOCX) en pages de texte.

Importer ≠ publier : ce module ne rend rien visible. Il produit du texte que
le studio range en BROUILLONS ; la publication reste une décision de l'auteur.

Défenses :
* le type est reconnu par les OCTETS du fichier, jamais par son extension ni
  par le type annoncé par le navigateur ;
* une archive (EPUB, DOCX) est lue avec des plafonds : nombre d'entrées,
  taille décompressée totale — une « bombe zip » de 10 Ko qui se déplie en
  10 Go est arrêtée avant d'avoir rempli la mémoire ;
* le XML est lu par la bibliothèque standard (expat refuse les entités
  externes ; la « bombe des milliards de rires » est bornée depuis expat 2.4) ;
* le fichier source n'est JAMAIS servi : il reste en stockage privé.
"""
import html
import io
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from html.parser import HTMLParser

MAX_PAGES = 2000
MAX_ENTREES_ZIP = 2000
MAX_DECOMPRESSE = 80 * 1024 * 1024
CIBLE_PAGE = 1800          # caractères visés par page quand le fichier n'a pas de pagination


class Refus(Exception):
    pass


def nature(octets):
    if octets[:5] == b"%PDF-":
        return "pdf"
    if octets[:4] == b"PK\x03\x04":
        try:
            z = zipfile.ZipFile(io.BytesIO(octets))
            noms = set(z.namelist())
        except zipfile.BadZipFile:
            raise Refus("Archive illisible.")
        if "word/document.xml" in noms:
            return "docx"
        if "mimetype" in noms and z.read("mimetype")[:20].strip() == b"application/epub+zip":
            return "epub"
    raise Refus("Format non reconnu : PDF, EPUB ou DOCX seulement.")


def _zip_sur(octets):
    z = zipfile.ZipFile(io.BytesIO(octets))
    infos = z.infolist()
    if len(infos) > MAX_ENTREES_ZIP:
        raise Refus("Archive trop complexe.")
    if sum(i.file_size for i in infos) > MAX_DECOMPRESSE:
        raise Refus("Archive trop volumineuse une fois décompressée.")
    return z


def _decouper(paragraphes):
    """Paragraphes → pages d'environ CIBLE_PAGE caractères, sans couper un paragraphe."""
    pages, cur = [], []
    for p in paragraphes:
        if p == "\f":                      # saut de page explicite
            if cur:
                pages.append("\n".join(cur)); cur = []
            continue
        if cur and sum(len(x) for x in cur) + len(p) > CIBLE_PAGE:
            pages.append("\n".join(cur)); cur = []
        cur.append(p)
    if cur:
        pages.append("\n".join(cur))
    return [x.strip() for x in pages if x.strip()]


def _pdf(octets):
    from pypdf import PdfReader
    try:
        r = PdfReader(io.BytesIO(octets))
        if r.is_encrypted:
            raise Refus("PDF protégé par un mot de passe.")
        if len(r.pages) > MAX_PAGES:
            raise Refus(f"Plus de {MAX_PAGES} pages.")
        pages = [re.sub(r"[ \t]+\n", "\n", (pg.extract_text() or "")).strip() for pg in r.pages]
    except Refus:
        raise
    except Exception:
        raise Refus("PDF illisible.")
    if not any(pages):
        raise Refus("Ce PDF ne contient pas de texte (pages scannées). La reconnaissance de texte (OCR) n'est pas encore branchée.")
    return [p for p in pages if p]


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _docx(octets):
    z = _zip_sur(octets)
    racine = ET.fromstring(z.read("word/document.xml"))
    paras = []
    for p in racine.iter(W + "p"):
        txt, saut = [], False
        for el in p.iter():
            if el.tag == W + "t" and el.text:
                txt.append(el.text)
            elif el.tag == W + "tab":
                txt.append("\t")
            elif el.tag == W + "br" and el.get(W + "type") == "page":
                saut = True
        if saut:
            paras.append("\f")
        t = "".join(txt).strip()
        if t:
            paras.append(t)
    return _decouper(paras)


class _Texte(HTMLParser):
    BLOCS = {"p", "div", "h1", "h2", "h3", "h4", "li", "br", "blockquote", "section"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paras, self.cur, self.ignore = [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "head"):
            self.ignore += 1
        elif tag in self.BLOCS:
            self._fin()

    def handle_endtag(self, tag):
        if tag in ("script", "style", "head"):
            self.ignore = max(0, self.ignore - 1)
        elif tag in self.BLOCS:
            self._fin()

    def handle_data(self, data):
        if not self.ignore:
            self.cur.append(data)

    def _fin(self):
        t = re.sub(r"\s+", " ", "".join(self.cur)).strip()
        if t:
            self.paras.append(html.unescape(t))
        self.cur = []


def _epub(octets):
    z = _zip_sur(octets)
    cont = ET.fromstring(z.read("META-INF/container.xml"))
    rf = next((e.get("full-path") for e in cont.iter() if e.tag.endswith("rootfile")), None)
    if not rf:
        raise Refus("EPUB sans table des matières.")
    opf = ET.fromstring(z.read(rf))
    base = posixpath.dirname(rf)
    items = {e.get("id"): e.get("href") for e in opf.iter() if e.tag.endswith("item")}
    paras = []
    for ref in (e.get("idref") for e in opf.iter() if e.tag.endswith("itemref")):
        href = items.get(ref)
        if not href:
            continue
        chemin = posixpath.normpath(posixpath.join(base, href))
        if chemin not in z.namelist():
            continue
        p = _Texte()
        p.feed(z.read(chemin).decode("utf-8", errors="replace"))
        p._fin()
        if p.paras:
            paras.extend(p.paras)
            paras.append("\f")                 # un fichier du livre = au moins une nouvelle page
    return _decouper(paras)


def extraire(octets):
    """Octets d'un manuscrit → (nature, [texte de chaque page])."""
    n = nature(octets)
    try:
        pages = {"pdf": _pdf, "docx": _docx, "epub": _epub}[n](octets)
    except Refus:
        raise
    except (KeyError, ET.ParseError, zipfile.BadZipFile, UnicodeDecodeError):
        raise Refus(f"Fichier {n.upper()} illisible.")
    if not pages:
        raise Refus("Aucun texte trouvé dans ce fichier.")
    if len(pages) > MAX_PAGES:
        raise Refus(f"Plus de {MAX_PAGES} pages.")
    return n, pages


# ── Exécution bornée ───────────────────────────────────────────────────────
# Un PDF de 25 Mo malformé (références circulaires, flux géants) pouvait
# occuper un processus du serveur plusieurs minutes : quelques envois et le
# site ne répondait plus. L'extraction tourne donc dans un processus À PART,
# tué au-delà du délai, avec un plafond de mémoire là où le système le permet.
DELAI_EXTRACTION = 30          # secondes
MEMOIRE_MAX = 1024 * 1024 * 1024


def _enfant(cible, octets, file):
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (MEMOIRE_MAX, MEMOIRE_MAX))
    except (ImportError, ValueError, OSError):
        pass                    # macOS refuse RLIMIT_AS : le délai reste la garde
    try:
        file.put(("ok", cible(octets)))
    except Refus as e:
        file.put(("refus", str(e)))
    except MemoryError:
        file.put(("refus", "Fichier trop lourd à analyser."))
    except Exception:
        file.put(("refus", "Fichier illisible."))


def extraire_borne(octets, delai=None, cible=None):
    """extraire(), mais dans un processus séparé, tué s'il dépasse le délai."""
    import multiprocessing as mp
    import queue
    ctx = mp.get_context("spawn")
    file = ctx.Queue()
    p = ctx.Process(target=_enfant, args=(cible or extraire, octets, file), daemon=True)
    p.start()
    try:
        etat, val = file.get(timeout=delai or DELAI_EXTRACTION)
    except queue.Empty:
        p.kill()
        p.join(5)
        raise Refus("L'analyse de ce fichier a pris trop de temps. Enregistrez-le de nouveau (PDF, EPUB ou DOCX standard) puis réessayez.")
    p.join(5)
    if etat == "refus":
        raise Refus(val)
    return val
