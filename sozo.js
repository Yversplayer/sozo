/* ═══════════════════════════════════════════════════════════
   Sōzō — construction des blocs propres à la landing, AVANT app.js
   (le moteur mesure le DOM au démarrage : tout doit déjà être en place).
   · textes encrés des scènes épinglées : [[mots]] → ovale ; {{pic:…}} →
     photo qui s'ouvre dans la phrase puis s'entoure d'un cercle
   · promesses, étagère (référence « Not Nahid »), catégories photo
   · livre en 3D : cinq états de page
   · bouton de thème du dock
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  const C = window.SITE_CONTENT, S = window.SOZO;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const OVAL = 'M50,6 C88,4 98,22 97,50 C96,82 76,96 49,95 C16,94 3,76 4,48 C5,18 20,7 50,6 Z';
  /* cercle « à la main » : il ne se referme pas tout à fait, il déborde */
  const LOOP = 'M58,5 C84,8 98,28 96,54 C94,82 72,97 46,95 C20,93 3,74 5,47 C7,22 26,4 52,4 C64,4 72,7 78,12';
  const svg = (cls, d) => `<svg class="${cls}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;

  function inkTokens(t) {
    return t
      .replace(/\[\[(.+?)\]\]/g, (_, w) => `<span class="ink-oval">${w}${svg('ink-oval-svg', OVAL)}</span>`)
      .replace(/\{\{pic:([\w-]+)\|(.+?)\}\}/g, (_, f, alt) =>
        `<span class="ink-pic"><span class="ink-pic-img"><img src="images/c/${f}.jpg" alt="${alt}"></span>${svg('ink-pic-svg', LOOP)}</span>`);
  }

  /* ─── 1. textes des scènes encrées ─── */
  $$('[data-content]').forEach((el) => {
    const v = el.dataset.content.split('.').reduce((o, k) => o && o[k], C);
    if (v == null) return;
    if (el.classList.contains('ink-text')) el.innerHTML = inkTokens(v); else el.textContent = v;
  });

  /* ─── 2. bibliothèque ─── */
  const L = C.library;
  $('#libTitle').innerHTML = inkTokens(L.title);
  $('#libSub').textContent = L.sub;
  $('#catsTitle').innerHTML = inkTokens(L.catsTitle);
  $('#szPromises').innerHTML = L.promises.map((p, i) =>
    `<li class="reveal" style="--i:${i}"><span class="sz-prom-ic">${S.icon(p.icon)}</span><span><strong>${p.title}</strong><span>${p.text}</span></span></li>`).join('');

  /* étagère : générée, mais déterministe (même rendu à chaque visite) */
  const PAL = ['#6B0F1A', '#4A0B14', '#8C1D2A', '#2A1014', '#D4AF37', '#B8912A', '#E9DCC0', '#F3EBDD', '#7A4B3A', '#A8862A', '#5A3A2E', '#C9A86A', '#9E3B45'];
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const light = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150; };
  const catalog = S.D.books.slice();
  const shelvesEl = $('#szShelves');
  let html = '';
  for (let s = 0; s < 2; s++) {
    const real = catalog.slice(s * 6, s * 6 + 6);
    let items = '';
    const count = 44;
    const slots = new Set(real.map((_, i) => 2 + i * 7 + (s ? 3 : 0)));
    let r = 0;
    for (let i = 0; i < count; i++) {
      if (i === (s ? 9 : 21)) {   // une pile couchée, comme sur une vraie étagère
        items += `<span class="sz-stack" aria-hidden="true">${[0, 1, 2].map((k) => `<i style="--c:${PAL[(i + k * 4) % PAL.length]};--sw:${88 - k * 9}px"></i>`).join('')}</span>`;
        continue;
      }
      const c = PAL[Math.floor(rnd() * PAL.length)];
      const ink = light(c) ? '#2A1014' : '#F8F5EB';
      const lean = (i === count - 1 || i === 0) ? (s ? -7 : 6) : (rnd() < 0.06 ? -4 : 0);
      const band = Math.floor(rnd() * 4);
      if (slots.has(i) && real[r]) {
        const b = real[r++], a = S.author(b.author);
        items += `<a class="sz-bk sz-bk--real" href="app/livre.html?id=${b.id}" style="--k:${i};--w:${38 + Math.round(rnd() * 8)}px;--h:${84 + Math.round(rnd() * 12)}%;--c:${c};--t:${ink};--r:${lean}deg" data-band="${band}" aria-label="${S.esc(b.title)}, de ${S.esc(a.name)} — ${S.esc(b.cat)}">`
          + `<span class="sz-bk-t" aria-hidden="true">${S.esc(b.title)}</span><span class="sz-tip" aria-hidden="true"><strong>${S.esc(b.title)}</strong>${S.esc(a.name)} · ${S.esc(b.cat)}</span></a>`;
      } else {
        items += `<span class="sz-bk" aria-hidden="true" style="--k:${i};--w:${18 + Math.round(rnd() * 22)}px;--h:${62 + Math.round(rnd() * 32)}%;--c:${c};--t:${ink};--r:${lean}deg" data-band="${band}"></span>`;
      }
    }
    const labels = L.labels.filter((l) => l.shelf === s).map((l) =>
      `<a class="sz-label" style="--at:${l.at}" href="app/decouvrir.html?cat=${encodeURIComponent(l.text)}">${l.text}</a>`).join('');
    html += `<div class="sz-shelf reveal"><div class="sz-row">${items}</div><div class="sz-plank" aria-hidden="true"></div>${labels}</div>`;
  }
  shelvesEl.innerHTML = html;

  $('#szCats').innerHTML = L.cats.map((c, i) =>
    `<a class="sz-cat reveal" style="--i:${i}" href="app/decouvrir.html?cat=${encodeURIComponent(c.name)}">
      <img src="${c.img}" alt="" loading="lazy"><span class="sz-cat-ic">${S.icon(c.icon)}</span>
      <strong>${c.name}</strong><span>${c.hint}</span></a>`).join('');

  /* tout autre titre [data-ink] écrit en dur dans la page : [[mots]] → ovale */
  $$('[data-ink]').forEach((el) => { if (el.textContent.includes('[[')) el.innerHTML = inkTokens(el.textContent); });

  /* ─── 3. le livre en 3D — « Le Carnet bleu », livre fictif propre à cette
     scène (pages 1 à 6 dans l'ordre) : il n'est pas dans le catalogue de la démo. ─── */
  const B = C.book;
  $('#bkTitle').innerHTML = inkTokens(B.title);
  $('#bkLegend').innerHTML = B.states.map((s, i) =>
    `<li data-k="${s.key}" style="--i:${i}"><span class="bk-dot bk-dot--${s.key}"></span><strong>${s.name}</strong><span>${s.text}</span></li>`).join('');

  const T = S.D.texts['heures-salees'];
  const para = (i) => T[i].map((t) => `<p>${t}</p>`).join('');
  const bars = (n) => Array.from({ length: n }, (_, i) => `<span class="pg-bar" style="width:${[96, 88, 93, 70, 91, 84, 95, 62][i % 8]}%"></span>`).join('');
  const head = (n, tag, k) => `<header class="pg-h"><span class="mono">PAGE ${n}</span><span class="pg-tag pg-tag--${k}">${tag}</span></header>`;
  const face = {
    title: `<div class="pg pg--title"><span class="mono">INÈS KANZA</span><strong>Le Carnet<br>bleu</strong>${svg('pg-oval', OVAL)}<span class="mono">ROMAN · PARUTION PROGRESSIVE</span></div>`,
    p1: `<div class="pg">${head(1, 'GRATUITE', 'free')}${para(0)}<footer class="pg-f mono">1</footer></div>`,
    p2: `<div class="pg">${head(2, 'GRATUITE', 'free')}${para(1)}<footer class="pg-f mono">2</footer></div>`,
    p3: `<div class="pg pg--locked">${head(3, 'PAYANTE', 'paid')}<div class="pg-blur">${bars(8)}</div>
          <div class="pg-buy">${S.icon('lock')}<strong>Page 3 — 0,10 $</strong><span>ou tout le chapitre 1 : 0,35 $</span><span class="pg-btn">Acheter cette page</span><span class="pg-small">Le prix s’affiche avant tout paiement.</span></div><footer class="pg-f mono">3</footer></div>`,
    p4: `<div class="pg">${head(4, 'ACHETÉE LE 02/10', 'owned')}${para(3)}<footer class="pg-f mono">4</footer></div>`,
    p5: `<div class="pg pg--soon">${head(5, 'PROGRAMMÉE', 'soon')}<div class="pg-date">${S.icon('calendar')}<span class="mono">DISPONIBLE LE</span><strong>15 octobre 2026</strong><span>à 20 h</span><em>Le contenu reste invisible jusque-là.</em></div><footer class="pg-f mono">5</footer></div>`,
    p6: `<div class="pg pg--draft">${head(6, 'BROUILLON', 'draft')}<p class="mono pg-who">VUE DE L’AUTRICE — INVISIBLE POUR LES LECTEURS</p><p>Nour descend au port. Le pêcheur dit qu’il a vu, lui aussi, des lettres sur le sable, il y a longtemps<span class="pg-caret"></span></p><footer class="pg-f mono">6</footer></div>`,
    end: `<div class="pg pg--end"><span class="mono">À SUIVRE</span><strong>Page 7</strong><span>le 29 octobre 2026</span></div>`
  };
  const leaves = [[face.p1, face.p2], [face.p3, face.p4], [face.p5, face.p6]];
  $('#bkBook').innerHTML =
    `<div class="bk-cover"></div><div class="bk-block bk-block--l"></div><div class="bk-block bk-block--r"></div>
     <div class="bk-page bk-page--l">${face.title}</div><div class="bk-page bk-page--r">${face.end}</div>` +
    leaves.map(([f, b], i) => `<div class="bk-leaf" style="--li:${i}"><div class="bk-face bk-face--front">${f}</div><div class="bk-face bk-face--back">${b}</div></div>`).join('');
  $('#bkFlat').innerHTML = [face.p1, face.p3, face.p4, face.p5, face.p6].map((f) => `<div class="bk-flat-pg">${f}</div>`).join('');

  /* ─── 4. thème : nocturne par défaut ; le choix se fait dans Mon compte
     (demande du propriétaire, 17/10/2026), plus de bouton sur la vitrine ─── */
})();
