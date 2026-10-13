/* ═══════════════════════════════════════════════════════════
   Sōzō — la Bible intégrée (Louis Segond 1910, domaine public).
   · reconnaît les références bibliques dans le texte d'un auteur
     (« Ésaïe 26:4 », « Ps 23:4 », « 1 Co 13:4-7 », « Jean 3.16 »)
     et en fait des liens vers le verset ;
   · charge UN livre à la fois (app/bible/NN.json, 3 à 240 Ko) : la
     Bible entière pèse 4,4 Mo, trop pour une connexion lente ;
   · affiche le verset dans une fenêtre, sans quitter la page lue.
   Une référence n'est reconnue qu'avec chapitre ET verset (sauf les
   Psaumes) : « Jean » ou « Marc » seuls sont des prénoms, pas des livres.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const S = window.SOZO;
  const BASE = (document.documentElement.dataset.root ?? '../') + 'app/bible/';
  /* nom affiché, puis variantes reconnues (sans accents, abréviations usuelles) */
  const BOOKS = [
    ['Genèse', 'Gn Gen Genese'], ['Exode', 'Ex Exo'], ['Lévitique', 'Lv Lev Levitique'], ['Nombres', 'Nb Nomb'], ['Deutéronome', 'Dt Deut Deuteronome'],
    ['Josué', 'Jos Josue'], ['Juges', 'Jg Jug'], ['Ruth', 'Rt'], ['1 Samuel', '1S 1Sam'], ['2 Samuel', '2S 2Sam'], ['1 Rois', '1R 1Ro'], ['2 Rois', '2R 2Ro'],
    ['1 Chroniques', '1Ch 1Chr'], ['2 Chroniques', '2Ch 2Chr'], ['Esdras', 'Esd'], ['Néhémie', 'Ne Né Neh Nehemie'], ['Esther', 'Est'], ['Job', 'Jb'],
    ['Psaumes', 'Ps Psaume Psa'], ['Proverbes', 'Pr Prov Proverbe'], ['Ecclésiaste', 'Ec Eccl Ecclesiaste Qohelet'], ['Cantique des Cantiques', 'Ct Cantique Cant'],
    ['Ésaïe', 'Es És Esaie Esaïe Ésaie Isaïe Isaie Is'], ['Jérémie', 'Jr Jé Jer Jeremie'], ['Lamentations', 'Lm Lam'], ['Ézéchiel', 'Ez Éz Ezechiel Ézech'],
    ['Daniel', 'Dn Dan'], ['Osée', 'Os Osee'], ['Joël', 'Jl Joel'], ['Amos', 'Am'], ['Abdias', 'Ab Abd'], ['Jonas', 'Jon'], ['Michée', 'Mi Mich Michee'],
    ['Nahum', 'Na Nah'], ['Habacuc', 'Ha Hab'], ['Sophonie', 'So Soph'], ['Aggée', 'Ag Agg Aggee'], ['Zacharie', 'Za Zach'], ['Malachie', 'Ml Mal'],
    ['Matthieu', 'Mt Matt'], ['Marc', 'Mc Mr'], ['Luc', 'Lc Lu'], ['Jean', 'Jn'], ['Actes des Apôtres', 'Ac Actes Act'], ['Romains', 'Rm Ro Rom'],
    ['1 Corinthiens', '1Co 1Cor'], ['2 Corinthiens', '2Co 2Cor'], ['Galates', 'Ga Gal'], ['Éphésiens', 'Ep Ép Eph Éph Ephesiens'], ['Philippiens', 'Ph Phil'],
    ['Colossiens', 'Col'], ['1 Thessaloniciens', '1Th 1Thes'], ['2 Thessaloniciens', '2Th 2Thes'], ['1 Timothée', '1Tm 1Ti 1Tim 1Timothee'],
    ['2 Timothée', '2Tm 2Ti 2Tim 2Timothee'], ['Tite', 'Tt Tit'], ['Philémon', 'Phm Philemon'], ['Hébreux', 'Hé He Heb Héb Hebreux'], ['Jacques', 'Jc Jac'],
    ['1 Pierre', '1P 1Pi'], ['2 Pierre', '2P 2Pi'], ['1 Jean', '1Jn'], ['2 Jean', '2Jn'], ['3 Jean', '3Jn'], ['Jude', 'Jud'], ['Apocalypse', 'Ap Apoc']
  ];
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s.]/g, '');
  const ALIAS = new Map();
  BOOKS.forEach(([name, more], i) => [name, ...more.split(' ')].forEach((a) => ALIAS.set(fold(a), i + 1)));
  const names = [...new Set(BOOKS.flatMap(([n, m]) => [n, ...m.split(' ')]))]
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/^([123])\s*/, '$1\\s?').replace(/\s+/g, '\\s+'));
  /* livre · chapitre · [: ou , ou .] · verset · [- verset] */
  const RX = new RegExp(`(?<![\\p{L}\\d])(${names.join('|')})\\.?\\s+(\\d{1,3})(?:\\s*[:,.]\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?(?![\\p{L}\\d])`, 'giu');

  function parse(str) {
    RX.lastIndex = 0;
    const m = RX.exec(str);
    return m ? toRef(m) : null;
  }
  function toRef(m) {
    const b = ALIAS.get(fold(m[1]));
    if (!b) return null;
    const c = +m[2], v1 = m[3] ? +m[3] : null, v2 = m[4] ? +m[4] : v1;
    if (!v1 && b !== 19) return null;                       // chapitre seul : Psaumes uniquement
    return { b, c, v1, v2: v2 && v2 >= v1 ? v2 : v1, label: `${BOOKS[b - 1][0]} ${c}${v1 ? ':' + v1 + (v2 && v2 !== v1 ? '–' + v2 : '') : ''}` };
  }
  const href = (r, page = 'bible.html') => `${page}?b=${r.b}&c=${r.c}${r.v1 ? `&v=${r.v1}${r.v2 !== r.v1 ? '-' + r.v2 : ''}` : ''}`;

  /* texte brut d'auteur → HTML échappé, références converties en liens */
  function linkify(text, page) {
    let out = '', last = 0, m;
    RX.lastIndex = 0;
    while ((m = RX.exec(text))) {
      const r = toRef(m);
      if (!r) continue;
      out += S.esc(text.slice(last, m.index)) +
        `<a class="bref" href="${href(r, page)}" data-b="${r.b}" data-c="${r.c}" data-v1="${r.v1 || ''}" data-v2="${r.v2 || ''}">${S.esc(m[0])}</a>`;
      last = m.index + m[0].length;
    }
    return out + S.esc(text.slice(last));
  }

  const cache = {};
  function load(b) {
    if (!cache[b]) cache[b] = fetch(`${BASE}${String(b).padStart(2, '0')}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch((e) => { delete cache[b]; throw e; });
    return cache[b];
  }
  async function verses(r) {
    const book = await load(r.b), ch = book[r.c - 1];
    if (!ch) return [];
    const a = r.v1 || 1, z = r.v2 || ch.length;
    return ch.slice(a - 1, z).map((t, i) => ({ n: a + i, t }));
  }

  /* fenêtre d'aperçu : le verset, sans quitter la lecture */
  let pop = null;
  async function preview(a) {
    const r = { b: +a.dataset.b, c: +a.dataset.c, v1: +a.dataset.v1 || null, v2: +a.dataset.v2 || null };
    r.label = `${BOOKS[r.b - 1][0]} ${r.c}${r.v1 ? ':' + r.v1 + (r.v2 && r.v2 !== r.v1 ? '–' + r.v2 : '') : ''}`;
    close();
    pop = document.createElement('div');
    pop.className = 'bpop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', r.label);
    pop.innerHTML = `<div class="bpop-h"><strong>${S.esc(r.label)}</strong><span class="mono">Louis Segond 1910</span><button type="button" class="md-x" aria-label="Fermer">${S.icon('x')}</button></div><div class="bpop-t" aria-live="polite"><span class="bpop-wait">Chargement du verset…</span></div><a class="btn btn--sm" href="${a.getAttribute('href')}">Ouvrir dans la Bible ${S.icon('right')}</a>`;
    document.body.appendChild(pop);
    const rect = a.getBoundingClientRect();
    const w = Math.min(380, innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, rect.left + rect.width / 2 - w / 2)) + 'px';
    /* landing : le contenu défile par transformation (scroll lissé) ; la
       fenêtre se fixe à l'écran et se ferme au premier défilement */
    if (document.body.classList.contains('is-smooth')) {
      pop.style.position = 'fixed'; pop.style.top = Math.min(rect.bottom + 10, innerHeight - 260) + 'px';
      addEventListener('scroll', close, { once: true, passive: true });
    } else pop.style.top = (rect.bottom + scrollY + 10) + 'px';
    pop.querySelector('.md-x').addEventListener('click', close);
    try {
      const vs = await verses(r);
      if (!pop) return;
      pop.querySelector('.bpop-t').innerHTML = vs.length
        ? vs.slice(0, 8).map((v) => `<p><sup>${v.n}</sup> ${S.esc(v.t)}</p>`).join('') + (vs.length > 8 ? `<p class="ash">… ${vs.length - 8} versets de plus</p>` : '')
        : `<p class="ash">Ce passage n'existe pas dans cette traduction.</p>`;
    } catch (e) {
      if (pop) pop.querySelector('.bpop-t').innerHTML = `<p class="ash">Le verset n'a pas pu être chargé (connexion ?). Le lien reste utilisable.</p>`;
    }
  }
  function close() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.bref');
    if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); preview(a); return; }
    if (pop && !e.target.closest('.bpop')) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  S.bible = { BOOKS, parse, linkify, href, load, verses, fold };
})();
