/* ═══════════════════════════════════════════════════════════
   SITE IMMERSIF — moteur d'animations (scroll scrubé, scènes épinglées)
   Smooth scroll lerp + scènes épinglées scrubées :
   · hero pasteboard → explosion radiale → zoom texte → série
   · manifeste rempli caractère par caractère + rail
   · panneau sélection, carte vedette voyageuse, parallaxe colonnes
   · bande lime diagonale à lettres dispersées + doodle dessiné
   · processus : zoom plein écran → rideau de lames → compteur odomètre
   · témoignage : le chiffre-clé qui monte, la citation dessous
   · finale : phrases encrées, ratures dessinées, traînée sous la souris
   EXTENSION SŌZŌ (11/10/2026, accord du propriétaire) : texte encré dans
   plusieurs scènes et dans les titres, photos entourées à la plume, livre 3D.
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  /* Le mode statique ne se déclenche plus QUE sur « prefers-reduced-motion ».
     Le template d'origine y basculait aussi sur tout appareil tactile et sous
     900 px : le scroll scrubé détourne le défilement natif, ce qui est plus
     risqué au doigt. Choix assumé ici — mobile et tablette ont droit aux
     mêmes scènes que le desktop. `touch` reste calculé : il sert à la
     traînée souris, qui n'a pas de sens sans curseur. */
  const staticMode = reduced;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (p, a, b, e) => { const t = clamp((p - a) / (b - a), 0, 1); return e ? e(t) : t; };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const wrapper = $('#smooth');
  if (staticMode) document.body.classList.add('static');

  let vh = innerHeight, vw = innerWidth;
  let target = 0, current = 0;
  let paused = false;

  function docTop(el) {
    let t = 0, n = el;
    while (n) { t += n.offsetTop; n = n.offsetParent; }
    return t;
  }

  /* ═══════════ OUTILS ═══════════ */

  /* trait SVG qui se dessine — longueurs en pixels écran
     (avec non-scaling-stroke, Chromium évalue les dashes à l'écran).
     Les longueurs sont recalculées quand les fontes arrivent ou que
     la fenêtre change : la taille du svg suit celle du texte. */
  const drawRegistry = [];
  function makeDraw(el) {
    if (staticMode) { el.style.strokeDasharray = 'none'; el.style.strokeDashoffset = '0'; return () => {}; }
    const item = { el, L: 1, lastV: 1 };
    item.calc = () => {
      const svg = el.ownerSVGElement;
      const vb = svg.viewBox.baseVal;
      const sx = (svg.clientWidth || 100) / ((vb && vb.width) || 100);
      const sy = (svg.clientHeight || 100) / ((vb && vb.height) || 100);
      item.L = el.getTotalLength() * Math.max(sx, sy, 1) * 1.25;
      el.style.strokeDasharray = item.L;
      el.style.strokeDashoffset = item.L * item.lastV;
      // ceinture et bretelles : invisible tant que le dessin n'a pas commencé
      el.style.opacity = item.lastV >= 0.999 ? '0' : '1';
    };
    item.calc();
    drawRegistry.push(item);
    return (v) => {
      item.lastV = clamp(v, 0, 1);
      el.style.strokeDashoffset = item.L * item.lastV;
      el.style.opacity = item.lastV >= 0.999 ? '0' : '1';
    };
  }
  function refreshDraws() { drawRegistry.forEach((d) => d.calc()); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshDraws);

  /* image qui naît entre deux mots puis remplit l'écran.
     Croissance en ratio paysage (~1.9:1) avant d'atteindre 100vw × 100vh. */
  function makeGrow(el) {
    const img = $('img', el);
    const line = el.parentElement;
    const pin = line.closest('.pin');
    let xOff = 0, yOff = 0, fs = 57;
    return {
      measure() {
        fs = parseFloat(getComputedStyle(line).fontSize);
        let leftW = 0, rightW = 0, seen = false;
        [...line.children].forEach((c) => {
          if (c === el) { seen = true; return; }
          if (c.classList.contains('hl')) { if (seen) rightW += c.offsetWidth; else leftW += c.offsetWidth; }
        });
        xOff = (leftW - rightW) / 2;
        yOff = (docTop(line) - docTop(pin)) + line.offsetHeight / 2 - vh / 2;
      },
      set(t, zoom = 1, lift = t) {
        const w = vw * t;
        const h = Math.min(vh, Math.max(w / 1.9, vh * Math.pow(t, 1.6)));
        el.style.width = w.toFixed(1) + 'px';
        el.style.height = h.toFixed(1) + 'px';
        const m = fs * 0.13 + Math.min(t * 60, fs * 0.12);
        el.style.marginLeft = el.style.marginRight = m.toFixed(1) + 'px';
        el.style.borderRadius = t > 0.985 ? '0' : '2px';
        line.style.transform = `translate(${(-xOff * t).toFixed(1)}px, ${(-yOff * lift).toFixed(1)}px)`;
        img.style.transform = `translate(-50%, -50%) scale(${zoom})`;
      }
    };
  }

  /* ═══════════ SPLITS ═══════════ */
  function splitChars(el, inner, outer) {
    const text = el.textContent;
    el.textContent = '';
    [...text].forEach((c, i) => {
      if (c === ' ') { el.appendChild(document.createTextNode(' ')); return; }
      const sp = document.createElement('span');
      sp.className = inner;
      sp.textContent = c;
      if (outer) {
        const o = document.createElement('span');
        o.className = outer;
        sp.style.setProperty('--i', i);
        o.appendChild(sp);
        el.appendChild(o);
      } else el.appendChild(sp);
    });
  }

  // manifeste : chaque caractère dans un span .fc, mots insécables, svg conservé
  function splitFillChars(root) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.style.whiteSpace = 'nowrap';
            [...part].forEach((c) => {
              const sp = document.createElement('span');
              sp.className = 'fc';
              sp.textContent = c;
              w.appendChild(sp);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'svg') {
          walk(child);
        }
      });
    };
    walk(root);
  }

  const fillText = $('#fillText');
  splitFillChars(fillText);
  const fillChars = $$('.fc', fillText);

  $$('.mw').forEach((el) => splitChars(el, 'sc'));
  const footerName = $('#footerName');
  splitChars(footerName, 'chi', 'ch');

  $$('.floaters .fl').forEach((f, i) => f.style.setProperty('--fi', i));

  /* ═══════════ RÉVÉLATIONS ═══════════ */
  const revealTargets = [...$$('.reveal'), footerName, ...$$('.band-block')];
  let revealCache = [];
  function cacheReveals() {
    revealCache = revealTargets
      .filter((el) => !el.classList.contains('in-view'))
      .map((el) => ({ el, top: docTop(el) }));
  }
  function checkReveals(pos) {
    for (let i = revealCache.length - 1; i >= 0; i--) {
      if (pos + vh * 0.88 > revealCache[i].top) {
        const el = revealCache[i].el;
        el.classList.add('in-view');
        const doodle = el.querySelector && el.querySelector('.doodle path');
        if (doodle && doodle.__draw) doodle.__animate();
        revealCache.splice(i, 1);
      }
    }
  }

  /* doodle : dessin progressif au rAF (le scrub par transition CSS
     est peu fiable avec des dasharray posés en inline) */
  $$('.doodle path').forEach((p) => {
    p.__draw = makeDraw(p);
    p.__animate = () => {
      const t0 = performance.now(), dur = 1300;
      const tick = (now) => {
        const k = clamp((now - t0) / dur, 0, 1);
        p.__draw(1 - easeInOut(k));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
  });

  /* ═══════════ PARALLAXE (colonnes de la sélection) ═══════════ */
  let pxCache = [];
  function cacheParallax() {
    pxCache = $$('[data-pspeed]').map((el) => ({
      el, speed: +el.dataset.pspeed, top: docTop(el), h: el.offsetHeight
    }));
  }

  /* souris : parallaxe douce du pasteboard */
  let mx = 0, my = 0, mxT = 0, myT = 0;
  addEventListener('mousemove', (e) => {
    mxT = (e.clientX / vw - 0.5) * 2;
    myT = (e.clientY / vh - 0.5) * 2;
  }, { passive: true });

  /* ═══════════ SYSTÈME DE SCÈNES ═══════════ */
  const scenes = [];
  function addScene(sel, update) {
    const root = $(sel);
    if (!root) return;
    scenes.push({ root, pin: $('.pin', root), mult: +root.dataset.pin, start: 0, len: 1, update, lastP: -1 });
  }
  /* EXTENSION SŌZŌ — même chose qu'addScene, mais pour un élément donné :
     les scènes .s-ink sont plusieurs, un sélecteur ne trouverait que la première. */
  function addSceneEl(root, update) {
    scenes.push({ root, pin: $('.pin', root), mult: +root.dataset.pin, start: 0, len: 1, update, lastP: -1 });
  }
  function measureScenes() {
    /* EXTENSION SŌZŌ — toutes les hauteurs d'abord, PUIS les positions.
       Le template mesurait chaque scène dans l'ordre de déclaration, qui
       était aussi l'ordre du document. Les scènes ajoutées (texte encré,
       livre 3D) sont déclarées plus tôt qu'elles n'apparaissent : une
       scène mesurée avant que celles qui la précèdent aient pris leur
       hauteur se calait des milliers de pixels trop haut (livre 3D vide). */
    scenes.forEach((s) => { s.root.style.height = s.mult * vh + 'px'; });
    scenes.forEach((s) => {
      s.start = docTop(s.root);
      s.len = (s.mult - 1) * vh;
      s.lastP = -1;
    });
  }
  function renderScenes(pos) {
    scenes.forEach((s) => {
      if (pos + vh < s.start - vh || pos > s.start + s.len + vh * 2) return;
      const y = clamp(pos - s.start, 0, s.len);
      s.pin.style.transform = `translate3d(0, ${y}px, 0)`;
      const p = clamp((pos - s.start) / s.len, 0, 1);
      if (Math.abs(p - s.lastP) < 0.0004) return;
      s.lastP = p;
      s.update(p);
    });
  }

  /* ─── SCÈNE 1 · HERO ─── */
  const grow1 = makeGrow($('#grow1'));
  const grow1Img = $('#grow1 img');
  const floaters = $$('.floaters .fl');
  let flDirs = [];
  const heroLine1 = $('#heroLine1');
  const heroKicker = $('#heroKicker');
  const introWords = $$('#spotIntro span');

  function measureFloaters() {
    flDirs = floaters.map((f) => {
      f.style.transform = 'none';   // mesurer la position au repos, sans le transform du frame précédent
      const r = f.getBoundingClientRect();
      const ex = r.left + r.width / 2 - vw / 2;
      const ey = r.top + r.height / 2 - vh / 2;
      const n = Math.max(1, Math.hypot(ex, ey));
      return { x: ex / n, y: (ey / n) * 1.5, d: +f.dataset.d, ex, ey };
    });
  }

  addScene('.s-hero', (p) => {
    /* on TRAVERSE le nuage : les visuels naissent petits et resserrés au
       centre, s'ouvrent vers leur place en grandissant, puis dérivent vers
       les bords. Une partie n'arrive qu'en cours de route. Il en reste donc
       toujours à l'écran quand l'image naît entre les mots. */
    const enter = seg(p, 0, 0.17, easeOut);
    const drift = seg(p, 0.06, 0.46);
    const flScale = mix(0.74, 1, enter) * mix(1, 1.22, drift);
    floaters.forEach((f, i) => {
      const dir = flDirs[i] || { x: 0, y: -1, d: 0.5, ex: 0, ey: 0 };
      const pull = (1 - enter) * 0.16;
      const dist = drift * (0.8 + dir.d) * vh * 1.15;
      const tx = -dir.ex * pull + dir.x * dist + mx * dir.d * 40;
      const ty = -dir.ey * pull + dir.y * dist + my * dir.d * 26;
      f.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${(drift * dir.d * (i % 2 ? 8 : -8)).toFixed(2)}deg) scale(${flScale.toFixed(3)})`;
    });

    // le kicker et la ligne 1 s'estompent sur place…
    heroKicker.style.opacity = 1 - seg(p, 0.01, 0.10);
    heroLine1.style.opacity = 1 - seg(p, 0.03, 0.15);
    // …puis la ligne 2 monte occuper le centre, SEULE, avant tout zoom
    const lift = seg(p, 0.05, 0.22, easeInOut);

    // l'image naît entre les mots puis remplit l'écran
    const g = seg(p, 0.26, 0.58, easeInOut);
    grow1.set(g, 1 + seg(p, 0.58, 1) * 0.06, Math.max(lift, g));
    grow1Img.style.filter = `brightness(${(1 - seg(p, 0.58, 0.70) * 0.16).toFixed(3)})`;

    // titre blanc, mot à mot, pendant la croissance — il tient un moment
    // puis s'efface juste avant que l'image nue ne quitte l'écran
    const fadeOut = seg(p, 0.82, 0.92);
    introWords.forEach((w, i) => {
      const k = seg(p, 0.50 + i * 0.022, 0.60 + i * 0.022, easeOut);
      w.style.opacity = (k * (1 - fadeOut)).toFixed(3);
      w.style.transform = `translateY(${((1 - k) * 14).toFixed(1)}px)`;
    });
  });

  /* ─── SCÈNE 2 · MANIFESTE ─── */
  const boxDraw = makeDraw($('#boxPath'));
  let lastFillIdx = 0;
  addScene('.s-fill', (p) => {
    const idx = Math.round(seg(p, 0.05, 0.58) * fillChars.length);
    if (idx !== lastFillIdx) {
      const lo = Math.min(idx, lastFillIdx), hi = Math.max(idx, lastFillIdx);
      for (let i = lo; i < hi; i++) fillChars[i].classList.toggle('on', i < idx);
      lastFillIdx = idx;
    }
    boxDraw(1 - seg(p, 0.42, 0.56));
    fillText.classList.toggle('greyed', p > 0.68);
  });

  /* ═══════════ EXTENSION SŌZŌ · TEXTE ENCRÉ « UN PEU PARTOUT » ═══════════
     Demande du propriétaire (11/10/2026) : l'effet du manifeste — texte qui
     s'encre lettre à lettre, ovale tracé à la plume — doit revenir sur toute
     la landing, et entourer aussi des IMAGES. Chaque caractère compte pour
     une unité, chaque photo aussi : la photo s'ouvre quand l'encre l'atteint
     (sans reflux du texte : sa place est réservée), puis un cercle l'entoure.
     Un ovale de mots se trace quand l'encre dépasse son dernier caractère. */
  function inkUnits(textEl) {
    splitFillChars(textEl);
    const units = $$('.fc, .ink-pic', textEl);
    const pics = [];
    units.forEach((u, i) => { if (u.classList.contains('ink-pic')) pics.push({ el: u, k: i, draw: makeDraw($('.ink-pic-svg path', u)) }); });
    const ovals = $$('.ink-oval', textEl).map((o) => {
      const cs = $$('.fc', o);
      return { last: units.indexOf(cs[cs.length - 1]), draw: makeDraw($('.ink-oval-svg path', o)) };
    });
    /* `span` dépasse le texte de INK_TAIL unités : sans cette marge, un ovale
       ou une photo en fin de phrase ne finissait jamais de se tracer. */
    return { units, pics, ovals, n: units.length, span: units.length + INK_TAIL, last: 0 };
  }
  const INK_TAIL = 18;
  function paintInk(u, idx) {
    if (idx !== u.last) {
      const lo = Math.min(idx, u.last), hi = Math.max(idx, u.last);
      for (let i = lo; i < Math.min(hi, u.n); i++) { const el = u.units[i]; if (el.classList.contains('fc')) el.classList.toggle('on', i < idx); }
      u.last = idx;
    }
    u.pics.forEach((p) => {
      p.el.style.setProperty('--o', easeOut(clamp((idx - p.k) / 6, 0, 1)).toFixed(3));
      p.draw(1 - clamp((idx - p.k - 5) / 14, 0, 1));
    });
    u.ovals.forEach((o) => o.draw(1 - clamp((idx - o.last) / 10, 0, 1)));
  }

  // scènes épinglées .s-ink
  $$('.s-ink').forEach((sec) => {
    const u = inkUnits($('.ink-text', sec));
    const kick = $('.ink-kicker', sec);
    addSceneEl(sec, (p) => {
      if (kick) kick.style.opacity = seg(p, 0, 0.08).toFixed(3);
      paintInk(u, Math.round(seg(p, 0.05, 0.78) * u.span));
    });
  });

  // titres [data-ink] hors scène : l'encre suit la position dans l'écran
  const inkTitles = $$('[data-ink]').map((el) => ({ el, u: inkUnits(el), top: 0 }));
  function measureTitles() { inkTitles.forEach((t) => { t.top = docTop(t.el); }); }
  function renderTitles(pos) {
    inkTitles.forEach((t) => paintInk(t.u, Math.round(seg(pos + vh - t.top, vh * 0.1, vh * 0.6) * t.u.span)));
  }

  /* ─── EXTENSION SŌZŌ · LE LIVRE EN 3D — trois feuillets tournent, cinq
     états de page défilent dans la légende. Rien n'y est simulé comme
     « payé » : la page achetée porte la date de son achat fictif. ─── */
  const bkBook = $('#bkBook');
  if (bkBook) {
    const leaves = $$('.bk-leaf', bkBook);
    const legend = $$('#bkLegend li');
    const bkT = inkUnits($('#bkTitle'));
    const TURN = [[0.20, 0.32], [0.42, 0.54], [0.72, 0.84]];
    const STATE = [0.06, 0.30, 0.52, 0.63, 0.84];
    let lastS = -2;
    addScene('.s-book', (p) => {
      paintInk(bkT, Math.round(seg(p, 0, 0.14) * bkT.span));
      const rise = seg(p, 0, 0.16, easeOut);
      bkBook.style.transform = `rotateX(${mix(58, 24, rise).toFixed(2)}deg) rotateZ(${mix(-12, -5, rise).toFixed(2)}deg) rotateY(${(Math.sin(p * Math.PI) * 5).toFixed(2)}deg) translateY(${((1 - rise) * 70).toFixed(1)}px)`;
      leaves.forEach((lf, i) => {
        const t = seg(p, TURN[i][0], TURN[i][1], easeInOut);
        // après la rotation de 180°, l'axe Z local est inversé : d'où le signe
        const z = t > 0.5 ? -(i + 1) * 2 : (leaves.length - i) * 2;
        lf.style.transform = `rotateY(${(-180 * t).toFixed(2)}deg) translateZ(${z}px)`;
        lf.classList.toggle('is-turning', t > 0.02 && t < 0.98);
      });
      let st = -1;
      STATE.forEach((th, i) => { if (p >= th) st = i; });
      if (st !== lastS) {
        legend.forEach((li, i) => { li.classList.toggle('is-on', i === st); li.classList.toggle('is-past', i < st); });
        lastS = st;
      }
    });
  }

  /* arrivée désordonnée des cartes : chacune surgit du bas, décalée
     et légèrement tournée, puis se pose sur la grille au scroll */
  const arrivals = [];
  function measureArrivals() {
    arrivals.length = 0;
    $$('.coll-grid .card, .bento-grid .card').forEach((card, i) => {
      const seed = ((i * 137 + 41) % 89) / 89;
      arrivals.push({
        card,
        top: docTop(card),
        dx: (i % 2 ? 1 : -1) * (70 + seed * 120),
        dy: 150 + seed * 170,
        rot: (i % 3 === 0 ? 1 : -1) * (4 + seed * 7)
      });
    });
  }
  function renderArrivals(pos) {
    for (const a of arrivals) {
      const t = seg(pos + vh, a.top + 60, a.top + 60 + vh * 0.6, easeOut);
      const k = 1 - t;
      a.card.style.transform = `translate3d(${(a.dx * k).toFixed(1)}px, ${(a.dy * k).toFixed(1)}px, 0) rotate(${(a.rot * k).toFixed(2)}deg)`;
    }
  }

  /* ─── SCÈNE 4 · DEVISE — train de mots-clés horizontal ─── */
  const mottoTrack = $('#mottoTrack');
  const mottoHint = $('#mottoHint');
  const MOTTO = (window.SITE_CONTENT && window.SITE_CONTENT.motto) || null;
  const mottoHints = MOTTO ? MOTTO.words.map((w) => w.hint) : [];
  let mottoWords = [], mottoActive = -1, mottoHintTimer = 0;

  function measureMotto() {
    mottoWords = $$('.mw', mottoTrack).map((el) => {
      const chars = $$('.sc', el);
      return {
        el, chars,
        amps: chars.map((_, i) => (((i * 7919 + 31) % 13) - 6) / 6 || 0.45),
        center: el.offsetLeft + el.offsetWidth / 2
      };
    });
  }

  addScene('.s-motto', (p) => {
    if (!mottoWords.length) return;
    // le train glisse : chaque mot passe par le centre de l'écran
    const t = seg(p, 0.03, 0.97);
    const first = mottoWords[0].center;
    const last = mottoWords[mottoWords.length - 1].center;
    const x = vw / 2 - mix(first, last, t);
    mottoTrack.style.transform = `translate(${x.toFixed(1)}px, -50%)`;

    let best = 0, bestD = 1e9;
    mottoWords.forEach((w, wi) => {
      const rel = clamp((w.center + x - vw / 2) / vw, -1.3, 1.3);
      const d = Math.abs(rel);
      if (d < bestD) { bestD = d; best = wi; }
      // loin du centre : lettres dispersées et mot en retrait ; au centre : posé
      w.el.style.opacity = (1 - Math.min(d * 1.1, 0.75)).toFixed(3);
      w.chars.forEach((c, i) => {
        c.style.transform = `translate3d(0, ${(w.amps[i] * rel * vh * 0.3).toFixed(1)}px, 0) rotate(${(w.amps[i] * rel * 6).toFixed(2)}deg)`;
      });
    });

    if (best !== mottoActive) {
      mottoActive = best;
      mottoHint.classList.add('swap');
      clearTimeout(mottoHintTimer);
      mottoHintTimer = setTimeout(() => {
        mottoHint.textContent = mottoHints[best] || '';
        mottoHint.classList.remove('swap');
      }, 150);
    }
  });

  /* ─── SCÈNE 5 · PROCESSUS — des tirages posés un à un sur la table ─── */
  const grow2 = makeGrow($('#grow2'));
  const nightLineEl = $('#nightLine');
  const nightWords = [$('#nw1'), $('#nw2'), $('#nw3')];
  const STEPS = ((window.SITE_CONTENT && window.SITE_CONTENT.universes) || { items: [] }).items;
  const stepEls = $$('.pstep');
  const stepsCta = $('#stepsCta');
  const ctaOvalDraw = makeDraw($('#ctaOval'));
  const slats = $$('#nightWipe span');
  const bigNum = $('#bigNum'), bigRoll = $('#bigRoll');
  if (bigRoll && STEPS.length) bigRoll.innerHTML = STEPS.map((_, i) => `<i>${i + 1}</i>`).join('');

  addScene('.s-night', (p) => {
    // intro : les mots se posent, l'image naît entre eux
    nightWords.forEach((w, i) => {
      const k = seg(p, 0.01 + i * 0.024, 0.06 + i * 0.024, easeOut);
      w.style.opacity = k.toFixed(3);
      w.style.transform = `translateY(${((1 - k) * 16).toFixed(1)}px)`;
    });
    // le zoom atteint le plein écran PUIS continue d'avancer :
    // la caméra ne recule jamais, c'est le rideau qui coupe.
    const g = seg(p, 0.08, 0.30, easeInOut);
    grow2.set(g, 1 + seg(p, 0.30, 0.52, easeOut) * 0.18);

    // rideau de lames : couvre de gauche à droite, se retire de droite à
    // gauche — il découvre une scène entièrement typographique.
    slats.forEach((sl, i) => {
      const j = slats.length - 1 - i;
      const cover = seg(p, 0.30 + i * 0.005, 0.360 + i * 0.005, easeInOut);
      const clear = seg(p, 0.42 + j * 0.005, 0.480 + j * 0.005, easeInOut);
      sl.style.transformOrigin = clear > 0 ? 'top' : 'bottom';
      sl.style.transform = `scaleY(${(cover - clear).toFixed(4)})`;
    });
    nightLineEl.style.opacity = p > 0.41 ? 0 : 1;

    // le compteur défile comme un odomètre pendant que l'étape permute
    const cont = seg(p, 0.50, 0.88) * Math.max(STEPS.length - 1, 1);
    // les étapes montent DÈS que le rideau couvre : quand il se retire,
    // la scène est déjà dressée
    const gate = seg(p, 0.335, 0.44);
    if (bigNum) {
      bigNum.style.opacity = gate.toFixed(3);
      bigRoll.style.transform = `translateY(${(-cont).toFixed(4)}em)`;
    }
    stepEls.forEach((el, i) => {
      const d = cont - i;
      // relais asymétrique : l'étape en cours s'efface vite, la suivante
      // entre plus tôt — jamais deux textes en pleine opacité, jamais de trou
      const vis = d >= 0 ? clamp(1 - d / 0.35, 0, 1) : clamp((d + 0.75) / 0.4, 0, 1);
      el.style.opacity = (vis * gate).toFixed(3);
      el.style.transform = `translateY(calc(-50% + ${(-d * 96).toFixed(1)}px))`;
    });
    // conversion : le CTA conclut le voyage, ovale dessiné à la main
    const eCta = seg(p, 0.89, 0.94, easeOut);
    stepsCta.style.opacity = eCta;
    stepsCta.style.transform = `translate(-50%, ${((1 - eCta) * 26).toFixed(1)}px)`;
    ctaOvalDraw(1 - seg(p, 0.92, 0.99));
  });

  /* ─── SCÈNE 8 · TÉMOIGNAGE — guillemet, parole, filet, signature ─── */
  const qGlyph = $('.q-glyph'), qText = $('#quoteText'), qRule = $('.q-rule');
  const qName = $('#quoteAuthor'), qCtx = $('#figKicker');
  const bigFigure = $('#bigFigure'), figVal = $('#figVal');

  /* le chiffre est posé par content.js : on le lit, puis on le fait monter
     de 0. C'est une pièce à conviction sous la signature, pas le sujet. */
  const figRaw = figVal ? figVal.textContent.trim() : '';
  const FIG_TARGET = parseFloat(figRaw.replace(',', '.'));
  const FIG_DEC = (figRaw.split(/[.,]/)[1] || '').length;
  const hasFig = !!figRaw && isFinite(FIG_TARGET);
  if (!hasFig) { const st = $('.q-stack'); if (st) st.classList.add('no-fig'); }
  let figLast = null;

  addScene('.s-quote', (p) => {
    const g = seg(p, 0.03, 0.15, easeOut);
    qGlyph.style.opacity = g.toFixed(3);
    qGlyph.style.transform = `translateY(${((1 - g) * 28).toFixed(1)}px)`;

    // la parole, d'un bloc : c'est elle qu'on vient lire
    const t = seg(p, 0.11, 0.36, easeOut);
    qText.style.opacity = t.toFixed(3);
    qText.style.transform = `translateY(${((1 - t) * 32).toFixed(1)}px)`;

    // le filet se trace de gauche à droite, puis la signature se pose
    qRule.style.transform = `scaleX(${seg(p, 0.38, 0.58, easeInOut).toFixed(4)})`;
    const n = seg(p, 0.52, 0.64, easeOut);
    qName.style.opacity = n.toFixed(3);
    qName.style.transform = `translateY(${((1 - n) * 14).toFixed(1)}px)`;
    const c = seg(p, 0.57, 0.69, easeOut);
    qCtx.style.opacity = c.toFixed(3);
    qCtx.style.transform = `translateY(${((1 - c) * 14).toFixed(1)}px)`;

    if (hasFig) {
      const f = seg(p, 0.58, 0.84, easeOut);
      bigFigure.style.opacity = Math.min(1, f * 3.5).toFixed(3);
      const v = (FIG_TARGET * f).toFixed(FIG_DEC);
      if (v !== figLast) { figVal.textContent = v; figLast = v; }
    }
  });

  /* ─── SCÈNE 6 · FINALE ─── */
  const fsEls = [$('#fs1'), $('#fs2'), $('#fs3'), $('#fs4')];
  const pillDraw = makeDraw($('#pillPath'));

  addScene('.s-final', (p) => {
    [0.08, 0.2, 0.34, 0.52].forEach((th, i) => fsEls[i].classList.toggle('on', p > th));
    pillDraw(1 - seg(p, 0.56, 0.72));
  });

  /* traînée d'images sous la souris (comme l'original) :
     chaque déplacement dépose la photo suivante de la réserve
     à la position du curseur ; elle surgit puis s'efface. */
  const sceneFinal = scenes.find((s) => s.root.classList.contains('s-final'));
  const trailImgs = $$('#trail img');
  let trailIdx = 0, trailZ = 10, trailAcc = 0, trailX = null, trailY = null;

  addEventListener('mousemove', (e) => {
    if (staticMode || !sceneFinal || !trailImgs.length) return;     // 21/10/2026 : plus aucune photo sur la landing
    if (current + vh < sceneFinal.start || current > sceneFinal.start + sceneFinal.len + vh) {
      trailX = trailY = null;
      return;
    }
    if (trailX === null) { trailX = e.clientX; trailY = e.clientY; return; }
    trailAcc += Math.hypot(e.clientX - trailX, e.clientY - trailY);
    trailX = e.clientX; trailY = e.clientY;
    if (trailAcc < 38) return;
    trailAcc = 0;
    const r = sceneFinal.pin.getBoundingClientRect();
    spawnTrail(e.clientX - r.left, e.clientY - r.top);
  }, { passive: true });

  function spawnTrail(x, y) {
    const img = trailImgs[trailIdx % trailImgs.length];
    trailIdx++;
    const rot = ((trailIdx * 47) % 17) - 8;
    img.style.zIndex = ++trailZ;
    img.getAnimations().forEach((a) => a.cancel());
    const at = (s) => `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -50%) rotate(${rot}deg) scale(${s})`;
    img.animate(
      [
        { opacity: 0, transform: at(0.5) },
        { opacity: 1, transform: at(1), offset: 0.14 },
        { opacity: 1, transform: at(1), offset: 0.72 },
        { opacity: 0, transform: at(0.94) }
      ],
      { duration: 3600, easing: 'cubic-bezier(0.19, 1, 0.22, 1)', fill: 'forwards' }
    );
  }

  /* ═══════════ MESURE GLOBALE ═══════════ */
  let docH = 1;
  function measure() {
    vh = innerHeight; vw = innerWidth;
    if (!staticMode) {
      measureScenes();
      grow1.measure(); grow2.measure();
      measureFloaters();
      measureMotto();
      measureArrivals();
      measureTitles();
    }
    if (!staticMode) refreshDraws();
    docH = wrapper.scrollHeight;
    if (!staticMode) document.body.style.height = docH + 'px';
    cacheReveals();
    cacheParallax();
  }

  /* ═══════════ RENDU ═══════════ */
  function render(pos) {
    if (!staticMode) {
      wrapper.style.transform = `translate3d(0, ${-pos.toFixed(1)}px, 0)`;
      renderScenes(pos);
      renderArrivals(pos);
      renderTitles(pos);
      for (const px of pxCache) {
        px.el.style.transform = `translate3d(0, ${((pos + vh / 2 - (px.top + px.h / 2)) * px.speed).toFixed(2)}px, 0)`;
      }
    }
    checkReveals(pos);
    document.body.classList.toggle('is-scrolled', pos > vh * 0.08);
  }

  function frame() {
    if (!paused) {
      target = scrollY;
      current = staticMode ? target : lerp(current, target, 0.085);
      if (Math.abs(current - target) < 0.05) current = target;
      mx = lerp(mx, mxT, 0.06);
      my = lerp(my, myT, 0.06);
      render(current);
    }
    requestAnimationFrame(frame);
  }

  /* ancres */
  $$('a[data-nav], a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || !id.startsWith('#')) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      // data-landing : atterrir un peu APRÈS le début d'une scène épinglée
      // pour que son contenu soit déjà visible (ex. « Six séries, six mondes. »)
      const landing = staticMode ? 0 : (+a.dataset.landing || 0) * vh;
      scrollTo({ top: docTop(el) + landing, behavior: staticMode ? 'smooth' : 'auto' });
    });
  });

  /* ═══════════ PRELOADER / BOOT ═══════════ */
  const loader = $('#loader'), loaderBar = $('#loaderBar');
  const loaderWordmark = $('.loader-wordmark');

  /* passage de relais : le nom du loader vole jusqu'à sa place dans le
     dock. On pose d'abord `handoff`, qui met le dock à sa position finale
     en le laissant invisible : la cible ne bouge donc plus pendant le vol
     et l'arrivée est franche. Le dock se révèle une fois le vol terminé. */
  const HANDOFF_MS = 900;
  function handOffWordmark() {
    const target = $('.dock-wordmark');
    if (!target || !loaderWordmark) return;
    document.body.classList.add('handoff');
    const from = loaderWordmark.getBoundingClientRect();
    const to = target.getBoundingClientRect();   // dock déjà en place
    if (!from.width || !to.width) { document.body.classList.remove('handoff'); return; }
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    loaderWordmark.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(to.width / from.width).toFixed(4)})`;
    // bascule atomique : le nom du loader s'éteint et le dock s'allume au
    // même instant, superposés — aucun trou visible entre les deux.
    setTimeout(() => {
      loaderWordmark.classList.add('landed');
      document.body.classList.remove('handoff');
    }, HANDOFF_MS);
  }

  function boot() {
    measure();
    current = target = scrollY;
    requestAnimationFrame(frame);
    document.body.classList.add('is-ready');
    handOffWordmark();
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 1400);
    addEventListener('load', measure, { once: true });
    let mt;
    $$('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', () => { clearTimeout(mt); mt = setTimeout(measure, 120); }, { once: true });
    });
  }

  if (!staticMode) document.body.classList.add('is-smooth');

  if (reduced) {
    loader.remove();
    document.body.classList.add('is-ready');
    boot();
  } else {
    // setInterval plutôt que rAF : continue (throttlé) en arrière-plan
    const t0 = performance.now(), dur = 700;
    const timer = setInterval(() => {
      const p = clamp((performance.now() - t0) / dur, 0, 1);
      loaderBar.style.transform = `scaleX(${(1 - Math.pow(1 - p, 2)).toFixed(4)})`;
      if (p >= 1) { clearInterval(timer); setTimeout(boot, 60); }
    }, 16);
  }

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 200); });

  /* hook de debug (captures outillées) */
  window.__ea = {
    scrub(y) { paused = true; current = target = y; scenes.forEach((s) => (s.lastP = -1)); render(y); },
    resume() { paused = false; }
  };
})();
