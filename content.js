/* ═══════════════════════════════════════════════════════════
   Sōzō — contenu de la landing (template « Site Immersif », étendu)
   Les livres, auteurs, lecteurs, prix et dates sont FICTIFS : c'est un
   brouillon de démonstration, aucun paiement n'est branché.
   Photos : StockSnap (licence CC0), via Openverse — voir CREDITS.md.
   ═══════════════════════════════════════════════════════════ */

/* Illustrations du bento : SVG en ligne (currentColor + vermillon), pour
   suivre le thème clair ET sombre — une image <img> ne le pourrait pas. */
const ILLU = {
  /* grande · gratuit / payant / mixte : un champ de pages, une alternance */
  mix: (() => {
    let s = '';
    const paid = (i) => (i >= 22 && i < 40) || (i >= 58 && i < 66) || i >= 80;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 15; c++) {
      const i = r * 15 + c, x = 40 + c * 55, y = 52 + r * 84;
      s += paid(i)
        ? `<path class="il-acc" d="M${x},${y} h30 l10,10 v44 h-40 z"/>`
        : `<path class="il-line" d="M${x},${y} h30 l10,10 v44 h-40 z M${x + 30},${y} v10 h10"/>`;
    }
    return `<svg viewBox="0 0 900 600" class="il">${s}</svg>`;
  })(),
  /* haute · un calendrier sans règle : un fil du temps, des points irréguliers */
  cal: (() => {
    let s = '<path class="il-line" d="M300,40 V780"/>';
    for (let y = 60; y < 780; y += 24) s += `<path class="il-line" d="M${y % 120 === 60 ? 270 : 284},${y} H${y % 120 === 60 ? 330 : 316}"/>`;
    [84, 108, 132, 276, 588, 612, 636].forEach((y) => { s += `<circle class="il-ink" cx="300" cy="${y}" r="13"/>`; });
    s += '<circle class="il-acc" cx="300" cy="420" r="18"/><circle class="il-acc-line" cx="300" cy="420" r="44"/>';
    s += '<path class="il-line" d="M150,420 H232 M368,420 H450"/>';
    return `<svg viewBox="0 0 600 820" class="il">${s}</svg>`;
  })(),
  /* haute · import : un manuscrit qui se découpe en pages */
  imp: (() => {
    let s = '<rect class="il-line" x="150" y="50" width="300" height="250" rx="4"/>';
    for (let i = 0; i < 9; i++) s += `<rect class="il-ink-soft" x="182" y="${84 + i * 22}" width="${i % 3 === 2 ? 150 : 236}" height="8" rx="4"/>`;
    s += '<path class="il-line il-dash" d="M150,340 H450"/>';
    for (let k = 0; k < 4; k++) {
      const x = 110 + k * 92, y = 400 + (k % 2) * 34;
      s += `<rect class="${k === 2 ? 'il-acc-line' : 'il-line'}" x="${x}" y="${y}" width="104" height="146" rx="3" transform="rotate(${(k - 1.5) * 5} ${x + 52} ${y + 73})"/>`;
    }
    for (let k = 0; k < 4; k++) s += `<rect class="il-line" x="${120 + k * 92}" y="640" width="84" height="116" rx="3"/>`;
    return `<svg viewBox="0 0 600 820" class="il">${s}</svg>`;
  })(),
  /* grande · la liseuse : un passage dont une ligne est entourée à la plume */
  read: (() => {
    let s = '';
    const w = [690, 640, 700, 610, 560, 680, 650, 700, 420];
    w.forEach((L, i) => { s += `<rect class="${i === 4 ? 'il-ink' : 'il-ink-soft'}" x="105" y="${92 + i * 50}" width="${L}" height="12" rx="6"/>`; });
    s += '<path class="il-acc-line il-hand" d="M86,276 C200,248 560,250 700,262 C735,266 732,312 690,318 C540,334 220,330 110,322 C70,318 64,286 96,276"/>';
    return `<svg viewBox="0 0 900 600" class="il">${s}</svg>`;
  })()
};

window.SITE_CONTENT = {

  brand: {
    name: 'Sōzō',
    title: 'Sōzō — publiez votre livre page après page',
    description: "Sōzō : l'auteur publie à son rythme, gratuit, payant ou mixte ; le lecteur sait toujours ce qu'il achète.",
    kicker: 'HEAL YOUR HEART · GROWN YOUR FAITH · GLOW YOUR SPIRIT',
    copyright: '© 2026 — Sōzō · BROUILLON DE DÉMONSTRATION',
    signature: 'PLUS QU’UNE APPLICATION, UN CHEMIN.',
    socials: [
      { label: 'DÉCOUVRIR ↗', url: 'app/decouvrir.html' },
      { label: 'STUDIO AUTEUR ↗', url: 'app/studio.html' }
    ]
  },

  hook: {
    line1: 'Publiez votre livre',
    line2a: 'page après',
    line2b: 'page.',
    image: 'images/hero-crepuscule.jpg',
    imageAlt: 'Une lectrice en silhouette, un livre ouvert, face à la mer au crépuscule',
    floaters: ['images/c/f1.jpg', 'images/c/f2.jpg', 'images/c/f3.jpg', 'images/c/f4.jpg', 'images/c/f5.jpg',
               'images/c/f6.jpg', 'images/c/f7.jpg', 'images/c/f8.jpg', 'images/c/f9.jpg', 'images/c/f10.jpg']
  },

  positioning: 'Gratuit, payant ou mixte — à votre rythme.',

  manifesto: {
    text: "Sōzō, ancien verbe grec : sauver, guérir, [[restaurer]]. Une maison pour les livres qui relèvent, où l'auteur décide de tout — ce qui est offert, ce qui se paie, le jour où chaque page paraît — et où le lecteur sait toujours ce qu'il achète."
  },

  proof: {
    layout: 'masonry',
    kicker: 'ILS LISENT, ILS ÉCRIVENT',
    title: 'Une page à la fois',
    sub: 'Des lecteurs qui attendent le jeudi, des auteurs qui publient quand ils sont prêts.',
    meta: 'HUIT LECTURES EN COURS — SCÈNES D’ILLUSTRATION',
    projects: [
      { img: 'images/c/m1.jpg', title: 'Nadia lit « Les Heures salées »', meta: 'ROMAN — PAGE 12 — GRATUITE' },
      { img: 'images/c/m2.jpg', title: 'Jonas suit « La Fenêtre rouge »', meta: 'POLAR — PAGE 7 ACHETÉE' },
      { img: 'images/c/m3.jpg', title: 'Mireille programme sa page 15', meta: 'ROMAN GRAPHIQUE — LE 15 NOV.' },
      { img: 'images/c/m4.jpg', title: 'Awa relit ses poèmes', meta: 'POÉSIE — LIVRE GRATUIT' },
      { img: 'images/c/m5.jpg', title: 'Clara attend jeudi', meta: 'NOUVELLES — PAGE 9 À VENIR' },
      { img: 'images/c/m6.jpg', title: 'Kofi lit à son fils', meta: 'JEUNESSE — GRATUIT' },
      { img: 'images/c/m7.jpg', title: 'Nawezi relit « Croix de bois »', meta: 'BROUILLON — VISIBLE PAR L’AUTEUR SEUL' },
      { img: 'images/c/m8.jpg', title: 'Sofia achète un chapitre', meta: '0,35 $ — PRIX AFFICHÉ AVANT' }
    ]
  },

  /* texte encré n° 1 — [[mots]] = ovale à la plume ; {{pic:fichier|alt}} =
     une photo qui s'ouvre dans la phrase, puis s'entoure d'un cercle */
  inkReaders: {
    kicker: 'EN CE MOMENT SUR Sōzō — SCÈNES D’ILLUSTRATION',
    text: 'Amina {{pic:pic-lectrice-echarpe|Une lectrice en écharpe}} lit la page 9 dans le bus. Jonas {{pic:pic-lecteur-livre-rouge|Un lecteur, un livre rouge à la main}} attend la suite, annoncée pour [[jeudi, 20 h]]. Et Mireille {{pic:pic-autrice-ordinateur|Une autrice à son ordinateur}} vient de programmer trois pages pour le mois prochain.'
  },

  library: {
    title: 'Une bibliothèque [[qui respire]].',
    sub: "Romans, poésie, mangas, polars, essais : des livres complets et des livres qui s'écrivent sous vos yeux, page après page.",
    catsTitle: 'Trouvez votre [[prochaine lecture]]',
    promises: [
      { icon: 'gift', title: 'Des pages gratuites, vraiment', text: 'Ce qui est offert se lit sans rien payer.' },
      { icon: 'tag', title: 'Le prix avant l’achat', text: 'Page, chapitre ou livre : le montant d’abord.' },
      { icon: 'shield', title: 'Vos achats restent à vous', text: 'Une page payée ne peut plus vous être retirée.' },
      { icon: 'clock', title: 'Chaque date annoncée', text: '« Page 8 — disponible le 15 novembre ».' }
    ],
    labels: [
      { text: 'Roman', shelf: 0, at: 0.08 }, { text: 'Poésie', shelf: 0, at: 0.42 }, { text: 'Manga', shelf: 0, at: 0.78 },
      { text: 'Polar', shelf: 1, at: 0.2 }, { text: 'Jeunesse', shelf: 1, at: 0.55 }, { text: 'Foi', shelf: 1, at: 0.86 }
    ],
    cats: [
      { name: 'Roman', hint: 'Des vies entières', img: 'images/lectrice-canape-480.jpg', icon: 'book' },
      { name: 'Poésie', hint: 'Un poème par semaine', img: 'images/cat-poesie-480.jpg', icon: 'spark' },
      { name: 'Polar', hint: 'Une page, un indice', img: 'images/couv-fenetre-rouge-480.jpg', icon: 'search' },
      { name: 'Jeunesse', hint: 'À lire ensemble', img: 'images/cat-jeunesse-480.jpg', icon: 'star' },
      { name: 'Essai', hint: 'Penser lentement', img: 'images/cat-essai-480.jpg', icon: 'spark' },
      { name: 'Foi', hint: 'Des mots pour l’âme', img: 'images/foi-bougie-480.jpg', icon: 'feather' }
    ]
  },

  motto: {
    kicker: 'CE QUI GUIDE Sōzō',
    words: [
      { word: 'Écrire', hint: "Dans l'éditeur, ou en important un PDF, un EPUB, un DOCX." },
      { word: 'Publier', hint: 'Tout le livre aujourd’hui, ou une page dans deux semaines.' },
      { word: 'Lire', hint: 'Chaque page dit ce qu’elle est : gratuite, payante, à venir.' }
    ]
  },

  /* le livre en 3D : cinq états, cinq faces de page */
  book: {
    title: 'Chaque page dit [[ce qu’elle est]].',
    states: [
      { key: 'free', name: 'Gratuite', text: 'Ouverte à tous, sans rien payer.' },
      { key: 'paid', name: 'Payante', text: 'Le prix s’affiche avant tout achat.' },
      { key: 'owned', name: 'Achetée', text: 'Une fois payée, elle reste à vous.' },
      { key: 'soon', name: 'Programmée', text: 'Sa date est visible, jamais son contenu.' },
      { key: 'draft', name: 'Brouillon', text: 'Visible par l’auteur seul.' }
    ]
  },

  universes: {
    introA: 'Un',
    introB: 'livre,',
    introC: '3 gestes.',
    cta: 'Ouvrir le studio →',
    image: 'images/foi-bible-cafe.jpg',
    items: [
      { name: 'Écrivez ou importez', meta: 'GESTE — 01', desc: "Rédigez dans l'éditeur, ou déposez un PDF, un EPUB, un DOCX : Sōzō le découpe en pages que vous relisez, corrigez et réordonnez." },
      { name: 'Fixez vos règles', meta: 'GESTE — 02', desc: 'Tout gratuit, tout payant, ou mixte : pages 1 à 5 offertes, la suite à 0,10 $. Par page, par chapitre ou le livre entier.' },
      { name: 'Programmez', meta: 'GESTE — 03', desc: "Une page aujourd'hui, trois dans deux semaines, rien en août. Le calendrier est le vôtre, et vous le changez quand vous voulez." }
    ]
  },

  bento: {
    kicker: 'POUR LES AUTEURS',
    title: 'Quatre libertés',
    sub: 'Rien ne vous est imposé : ni rythme, ni prix, ni format.',
    meta: 'LE STUDIO — DÉMONSTRATION AVEC DONNÉES FICTIVES',
    features: [
      { size: 'big', svg: ILLU.mix, title: 'Gratuit, payant ou mixte', meta: 'PAR PAGE — PAR CHAPITRE — LIVRE ENTIER' },
      { size: 'tall', svg: ILLU.cal, title: 'Un calendrier sans règle', meta: 'DATE — HEURE — AUCUN MINIMUM' },
      { size: 'tall', svg: ILLU.imp, title: 'Importez votre manuscrit', meta: 'PDF — EPUB — DOCX' },
      { size: 'big', svg: ILLU.read, title: 'Une liseuse faite pour lire', meta: 'CLAIR — SÉPIA — SOMBRE — TAILLE DU TEXTE' }
    ]
  },

  inkAuthors: {
    kicker: 'POUR LES AUTEURS',
    text: 'Vous fixez le prix [[d’une page]], d’un chapitre {{pic:pic-foi-priere-bordeaux|Une femme, les mains jointes}} ou du livre entier. Le lecteur le voit {{pic:pic-lectrice-telephone|Une lectrice sur son téléphone}} avant de payer. Et ce qu’il a acheté [[reste à lui]].'
  },

  testimonial: {
    kicker: 'SAUVER · GUÉRIR · RESTAURER',
    figure: '',
    unit: '',
    quote: 'Certains livres se lisent. D’autres relèvent celles et ceux qui les lisent.',
    author: 'CE QUE CROIT SŌZŌ'
  },

  objections: {
    items: ['Pas de rythme imposé.', 'Pas de minimum de pages.', 'Pas de PDF téléchargeable.'],
    finale: 'Juste',
    pill: 'vos règles.'
  },

  contact: {
    kicker: 'LISTE D’ATTENTE — OUVERTURE PROCHAINE',
    label: 'Entrer dans la bibliothèque →',
    reassurance: 'BROUILLON DE DÉMONSTRATION — LIVRES, AUTEURS ET LECTEURS FICTIFS'
  },

  trail: Array.from({ length: 20 }, (_, i) => `images/c/t${i + 1}.jpg`)
};

/* ═══════════════════════════════════════════════════════════
   INJECTION — remplit le DOM avant sozo.js et app.js.
   Différences avec le template : le logo vectoriel du dock et du loader
   n'est pas écrasé par du texte ; le footer mène à la démo (pas d'e-mail
   tant que le domaine n'existe pas) ; le bento porte des SVG en ligne.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const C = window.SITE_CONTENT;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const set = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const OVAL = '<svg class="box-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path id="boxPath" d="M50,6 C88,4 98,22 97,50 C96,82 76,96 49,95 C16,94 3,76 4,48 C5,18 20,7 50,6 Z"/></svg>';

  document.title = C.brand.title;

  // 1 · accroche
  set('#heroKicker', C.brand.kicker);
  set('#heroLine1', C.hook.line1);
  const hls = $$('#heroLine2 .hl');
  if (hls.length === 2) { hls[0].textContent = C.hook.line2a; hls[1].textContent = C.hook.line2b; }
  const g1 = $('#grow1 img');
  if (g1) { g1.src = C.hook.image; g1.alt = C.hook.imageAlt; }
  $$('.floaters .fl img').forEach((img, i) => { if (C.hook.floaters[i]) img.src = C.hook.floaters[i]; });

  // 2 · positionnement
  const intro = $('#spotIntro');
  if (intro) intro.innerHTML = C.positioning.split(' ').map((w) => `<span>${w}</span>`).join(' ');

  // 3 · manifeste
  const fill = $('#fillText');
  if (fill) fill.innerHTML = C.manifesto.text.replace(/\[\[(.+?)\]\]/, `<span class="boxed" id="boxedPhrase">$1${OVAL}</span>`);

  // 4 · preuve (masonry)
  const head = $$('#travaux .coll-head > *');
  if (head.length === 4) {
    head[0].textContent = C.proof.kicker; head[1].textContent = C.proof.title;
    head[2].textContent = C.proof.sub; head[3].textContent = C.proof.meta;
  }
  const grid = $('#collGrid');
  if (grid) {
    grid.className = 'coll-grid';
    const SPEEDS = [-0.05, 0.06, -0.028, 0.085];
    grid.innerHTML = SPEEDS.map((s, ci) =>
      `<div class="col" data-pspeed="${s}">` +
      C.proof.projects.slice(ci * 2, ci * 2 + 2).map((p) =>
        `<figure class="card"><div class="card-img"><img src="${p.img}" alt="${p.title} — ${p.meta}"></div><figcaption>${p.title}<span class="mono">${p.meta}</span></figcaption></figure>`
      ).join('') + '</div>'
    ).join('');
  }

  // 5 · devise
  set('#mottoKicker', C.motto.kicker);
  const mtrack = $('#mottoTrack');
  if (mtrack) mtrack.innerHTML = C.motto.words.map((w) => `<span class="mw">${w.word}</span>`).join('');

  // 6-7 · processus
  set('#nw1', C.universes.introA); set('#nw2', C.universes.introB); set('#nw3', C.universes.introC);
  const g2 = $('#grow2 img');
  if (g2) { g2.src = C.universes.image; g2.alt = 'Une bible ouverte et un café sur une table'; }
  const psteps = $('#psteps');
  if (psteps) psteps.innerHTML = C.universes.items.map((u) =>
    `<div class="pstep"><span class="pstep-meta mono ash">${u.meta}</span><h3>${u.name}</h3><p>${u.desc}</p></div>`).join('');
  const sCta = $('#stepsCtaLink');
  if (sCta) sCta.childNodes[0].textContent = C.universes.cta;

  // bento
  set('#bentoKicker', C.bento.kicker); set('#bentoTitle', C.bento.title);
  set('#bentoSub', C.bento.sub); set('#bentoMeta', C.bento.meta);
  const bg = $('#bentoGrid');
  if (bg) bg.innerHTML = C.bento.features.map((f) =>
    `<figure class="card b-${f.size}"><div class="card-img card-illu">${f.svg}</div><figcaption>${f.title}<span class="mono">${f.meta}</span></figcaption></figure>`).join('');

  // 8 · témoignage
  set('#figKicker', C.testimonial.kicker || '');
  const figM = String(C.testimonial.figure || '').trim().match(/^([^\d.,+-]*[+−-]?)\s*(-?[\d.,]+)/);
  set('#figPre', figM ? figM[1] : ''); set('#figVal', figM ? figM[2] : ''); set('#figUnit', C.testimonial.unit || '');
  set('#quoteText', C.testimonial.quote); set('#quoteAuthor', C.testimonial.author);

  // 9 · objections
  C.objections.items.forEach((t, i) => set('#fs' + (i + 1), t));
  const fs4 = $('#fs4');
  if (fs4) fs4.innerHTML = `${C.objections.finale} <span class="pill" id="pillPhrase">${C.objections.pill}<svg class="pill-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path id="pillPath" d="M50,6 C88,4 98,22 97,50 C96,82 76,96 49,95 C16,94 3,76 4,48 C5,18 20,7 50,6 Z"/></svg></span>`;
  $$('#trail img').forEach((img, i) => { img.src = C.trail[i % C.trail.length]; });

  // 10 · conversion (pas d'e-mail : le domaine n'existe pas encore)
  set('.footer-kicker', C.contact.kicker);
  set('.footer-mail-text', C.contact.label);
  set('.footer-reassurance', C.contact.reassurance);
  const bottom = $$('.footer-bottom > p');
  if (bottom.length === 3) {
    bottom[0].textContent = C.brand.copyright;
    bottom[1].innerHTML = C.brand.socials.map((s) => `<a href="${s.url}">${s.label}</a>`).join('&nbsp;&nbsp;&nbsp;');
    bottom[2].textContent = C.brand.signature;
  }
})();
