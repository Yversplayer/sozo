/* ═══════════════════════════════════════════════════════════
   Sōzō — socle commun : icônes, droits d'accès, couvertures, coquille,
   fenêtres, effet d'encre. Chargé par la landing (icônes, données) et par
   chaque écran de app/.
   ═══════════════════════════════════════════════════════════ */
window.SOZO = (() => {
  const D = window.SOZO_DATA;
  const root = document.documentElement.dataset.root ?? '../';   // préfixe vers la racine du site
  const img = (name, small) => `${root}images/${name}${small ? '-480' : ''}.jpg`;

  /* Tout texte venant des données passe par esc() avant d'entrer dans le
     HTML : dans le vrai logiciel, titres et descriptions sont saisis par
     les auteurs, donc par n'importe qui. */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ─── icônes (trait 1,6, currentColor) ─── */
  const P = {
    gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1 0 1.5 2 1 5 1zm0 0c1.5-3 5-3.5 5-1 0 1.5-2 1-5 1z',
    tag: 'M3 12V4h8l9 9-8 8zM7.5 8.5h.01',
    shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    book: 'M4 5c3-1.5 5.5-1.5 8 0v14c-2.5-1.5-5-1.5-8 0zM12 5c2.5-1.5 5-1.5 8 0v14c-3-1.5-5.5-1.5-8 0',
    feather: 'M20 4C12 4 6 9 5 18l-1 2M5 18c6 0 11-4 13-9M9 14h5',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z',
    spark: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
    column: 'M4 20h16M5 9h14M12 3l8 4H4zM7 9v9M12 9v9M17 9v9',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
    check: 'M5 12l4 4 10-10',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    plus: 'M12 5v14M5 12h14',
    upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1',
    right: 'M5 12h14M13 6l6 6-6 6',
    left: 'M19 12H5M11 6l-6 6 6 6',
    chevron: 'M9 6l6 6-6 6',
    down: 'M6 9l6 6 6-6',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
    sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
    x: 'M6 6l12 12M18 6L6 18',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
    home: 'M3 11l9-7 9 7v9h-6v-6H9v6H3z',
    library: 'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 3 15.5-3.5 1z',
    pen: 'M14 4l6 6L9 21H3v-6zM12 6l6 6',
    file: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    filter: 'M4 5h16l-6 8v6l-4 2v-8z',
    type: 'M4 7V5h16v2M12 5v14M9 19h6',
    dots: 'M5 12h.01M12 12h.01M19 12h.01',
    send: 'M4 12l16-8-6 16-2-6z',
    draft: 'M5 3h10l4 4v14H5zM9 13l2 2 4-5'
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || P.dots}"/></svg>`;

  /* ─── formats (français, dollars) ─── */
  const money = (n) => n == null ? '' : n.toFixed(2).replace('.', ',') + ' $';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const parse = (iso) => iso ? new Date(iso) : null;
  const dayLong = (d) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  const hour = (d) => `${d.getHours()} h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}`;
  const dateLong = (iso) => { const d = parse(iso); return d ? `${dayLong(d)} à ${hour(d)}` : '—'; };
  const dateShort = (iso) => { const d = parse(iso); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : '—'; };
  const now = () => new Date();
  const relDays = (iso) => Math.round((parse(iso) - now()) / 864e5);

  /* ─── données ─── */
  const book = (id) => D.books.find((b) => b.id === id);
  const author = (id) => ({ id, ...D.authors[id] });
  const booksBy = (aid) => D.books.filter((b) => b.author === aid);

  /* Statut réel d'une page à l'instant présent : une page programmée dont
     la date est passée EST publiée. Le statut n'est pas une étiquette figée. */
  function status(p) {
    if (p.status === 'scheduled' && p.date && parse(p.date) <= now()) return 'published';
    return p.status;
  }

  /* ─── la règle d'accès — LE point central ───
     Retourne ce que voit le LECTEUR de démonstration pour une page :
       null     → page invisible (brouillon : seul l'auteur la voit)
       'soon'   → programmée : date visible, contenu jamais affiché
       'free'   → gratuite et publiée
       'owned'  → payante, publiée, achetée par ce lecteur
       'locked' → payante, publiée, non achetée : prix + achat
     Dans le vrai logiciel, cette décision est prise côté serveur. */
  function access(b, n) {
    const p = b.pages.find((x) => x.n === n);
    if (!p) return null;
    const s = status(p);
    if (s === 'draft') return null;
    if (s === 'scheduled') return 'soon';
    if (p.access === 'free') return 'free';
    const bought = D.reader.purchases[b.id];
    return bought && bought.pages.includes(n) ? 'owned' : 'locked';
  }
  const readable = (st) => st === 'free' || st === 'owned';
  const visiblePages = (b) => b.pages.filter((p) => access(b, p.n) !== null);

  function stats(b) {
    const st = { published: 0, scheduled: 0, draft: 0, free: 0, paid: 0, owned: 0, locked: 0, next: null };
    b.pages.forEach((p) => {
      const s = status(p);
      st[s]++;
      if (s === 'published') { p.access === 'free' ? st.free++ : st.paid++; }
      const a = access(b, p.n);
      if (a === 'owned') st.owned++;
      if (a === 'locked') st.locked++;
      if (s === 'scheduled' && (!st.next || parse(p.date) < parse(st.next.date))) st.next = { date: p.date, pages: [p.n] };
      else if (s === 'scheduled' && st.next && p.date === st.next.date) st.next.pages.push(p.n);
    });
    st.total = b.pages.length;
    return st;
  }
  const accessLabel = (b) => ({ free: 'Gratuit', paid: 'Payant', mixed: 'Mixte' }[b.access]);
  function priceFrom(b) {
    if (!b.price) return null;
    const v = [b.price.page, b.price.chapter, b.price.all].filter((x) => x != null);
    return v.length ? Math.min(...v) : null;
  }
  const chapterOf = (b, n) => b.chapters.find((c) => n >= c.from && n <= c.to);
  const pagesRange = (a) => {
    const s = [...a].sort((x, y) => x - y); if (!s.length) return '';
    const parts = []; let st = s[0], pr = s[0];
    for (let i = 1; i <= s.length; i++) {
      if (s[i] === pr + 1) { pr = s[i]; continue; }
      parts.push(st === pr ? `${st}` : `${st} à ${pr}`); st = pr = s[i];
    }
    return (s.length > 1 ? 'pages ' : 'page ') + parts.join(', ');
  };

  /* ─── suivis (préférence locale : ce n'est pas un droit d'accès) ─── */
  const FKEY = 'sozo-follows';
  function follows() {
    try { const v = JSON.parse(localStorage.getItem(FKEY)); if (Array.isArray(v)) return v; } catch (e) {}
    return [...D.reader.follows];
  }
  const isFollowed = (id) => follows().includes(id);
  function toggleFollow(id) {
    const f = follows(); const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    try { localStorage.setItem(FKEY, JSON.stringify(f)); } catch (e) {}
    return i < 0;
  }

  /* notifications : pages des livres suivis devenues lisibles ces 21 jours */
  function notifications() {
    const out = [];
    follows().forEach((id) => {
      const b = book(id); if (!b) return;
      const groups = {};
      b.pages.forEach((p) => {
        if (status(p) !== 'published' || !p.date) return;
        const d = relDays(p.date);
        if (d <= 0 && d >= -21) (groups[p.date] = groups[p.date] || []).push(p.n);
      });
      Object.entries(groups).forEach(([date, ns]) => out.push({ book: b, date, pages: ns }));
    });
    return out.sort((a, b) => parse(b.date) - parse(a.date));
  }
  const SEEN = 'sozo-notif-vues';
  const seenAt = () => { try { return +localStorage.getItem(SEEN) || 0; } catch (e) { return 0; } };
  const markSeen = () => { try { localStorage.setItem(SEEN, String(Date.now())); } catch (e) {} };
  const unread = () => notifications().filter((n) => parse(n.date).getTime() > seenAt()).length;

  /* ─── couverture : photo + typographie (livres fictifs) ─── */
  function cover(b, opts = {}) {
    const a = author(b.author);
    const st = b.cover.style;
    return `<div class="cv cv--${st}${opts.d3 === false ? '' : ' cv3d'}${opts.cls ? ' ' + opts.cls : ''}" style="--cv:url('${img(b.cover.img, !opts.big)}')">
      <div class="cv-face">
        <span class="cv-photo" aria-hidden="true"></span>
        <span class="cv-author">${esc(a.name)}</span>
        <span class="cv-title">${esc(b.title)}</span>
        <span class="cv-cat">${esc(b.cat)}</span>
        ${st === 'd' ? '<svg class="cv-oval" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50,6 C88,4 98,22 97,50 C96,82 76,96 49,95 C16,94 3,76 4,48 C5,18 20,7 50,6 Z"/></svg>' : ''}
      </div>
      <span class="cv-spine" aria-hidden="true"></span><span class="cv-edge" aria-hidden="true"></span>
    </div>`;
  }

  function bookCard(b, opts = {}) {
    const a = author(b.author), st = stats(b), pf = priceFrom(b);
    const next = st.next ? `<span class="bc-next">${icon('clock')} Page ${st.next.pages[0]} le ${dateShort(st.next.date)}</span>` : '';
    return `<a class="bc" href="livre.html?id=${encodeURIComponent(b.id)}">
      ${cover(b)}
      <span class="bc-meta"><span class="badge badge--${b.access}">${accessLabel(b)}</span><span class="mono ash">${esc(b.cat)}</span></span>
      <strong class="bc-title">${esc(b.title)}</strong>
      <span class="bc-author">${esc(a.name)}</span>
      <span class="bc-foot"><span>${st.published} p. publiées${st.scheduled ? ` · ${st.scheduled} à venir` : ''}</span><span class="bc-price">${pf == null ? 'Gratuit' : 'dès ' + money(pf)}</span></span>
      ${opts.next !== false ? next : ''}
    </a>`;
  }

  /* ─── effet d'encre : le texte se remplit, puis l'ovale se dessine ───
     [[mots]] dans le texte → entourés à la plume. Déclenché à l'entrée dans
     l'écran ; immédiat en mouvement réduit. */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OVAL_D = 'M50,6 C88,4 98,22 97,50 C96,82 76,96 49,95 C16,94 3,76 4,48 C5,18 20,7 50,6 Z';
  function inkHTML(text) {
    return esc(text).replace(/\[\[(.+?)\]\]/g, `<span class="ink-o">$1<svg class="ink-o-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${OVAL_D}"/></svg></span>`);
  }
  function ink(el, text) {
    if (text != null) el.innerHTML = inkHTML(text);
    el.setAttribute('aria-label', el.textContent);
    const walk = (node) => [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const f = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { f.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'ink-w';
          [...part].forEach((ch) => { const s = document.createElement('span'); s.className = 'ink-c'; s.textContent = ch; s.setAttribute('aria-hidden', 'true'); w.appendChild(s); });
          f.appendChild(w);
        });
        node.replaceChild(f, c);
      } else if (c.nodeType === 1 && c.tagName.toLowerCase() !== 'svg') walk(c);
    });
    walk(el);
    el.classList.add('ink');
    const chars = [...el.querySelectorAll('.ink-c')];
    chars.forEach((c, i) => c.style.setProperty('--i', i));
    el.style.setProperty('--n', chars.length);
    const measure = () => el.querySelectorAll('.ink-o-svg path').forEach(prepDraw);
    requestAnimationFrame(measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);   // la police change la largeur
    if (reduced) { el.classList.add('ink--on', 'ink--done'); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      el.classList.add('ink--on');
      setTimeout(() => el.classList.add('ink--done'), Math.min(chars.length * 18, 1100) + 150);
    }), { threshold: 0.4 });
    io.observe(el);
  }
  /* Un trait « non-scaling-stroke » compte ses pointillés en pixels d'ÉCRAN
     (Chromium) : un pathLength="1" y donne des pointillés de 1 px, pas un
     tracé qui se dessine. On mesure donc la longueur réelle à l'écran et on
     la pose en dasharray/dashoffset ; la classe .is-drawn met l'offset à 0. */
  function prepDraw(path) {
    const svg = path.ownerSVGElement, vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    const sx = (r.width || 100) / ((vb && vb.width) || 100), sy = (r.height || 100) / ((vb && vb.height) || 100);
    const L = Math.ceil(path.getTotalLength() * Math.max(sx, sy, 1) * 1.3) + 4;
    path.style.strokeDasharray = L;
    path.style.setProperty('--L', L);
    path.classList.add('draw');
  }
  const prepAll = (scope = document) => scope.querySelectorAll('.ink-o-svg path, .au-ph svg path').forEach(prepDraw);

  const inkAll = (scope = document) => scope.querySelectorAll('[data-ink-text]').forEach((el) => ink(el, el.dataset.inkText));

  /* ─── fenêtre modale accessible (Échap, focus rendu) ─── */
  function modal({ title, body, actions = [] }) {
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'md-wrap';
    wrap.innerHTML = `<div class="md" role="dialog" aria-modal="true" aria-labelledby="mdTitle">
      <button class="md-x" type="button" aria-label="Fermer">${icon('x')}</button>
      <h2 class="md-title" id="mdTitle">${esc(title)}</h2>
      <div class="md-body">${body}</div>
      <div class="md-actions">${actions.map((a, i) => `<button type="button" class="btn ${a.primary ? 'btn--accent' : 'btn--ghost'}" data-i="${i}"${a.disabled ? ' disabled aria-disabled="true"' : ''}>${esc(a.label)}</button>`).join('')}</div>
    </div>`;
    const close = () => { wrap.classList.remove('is-open'); setTimeout(() => wrap.remove(), 250); document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const f = [...wrap.querySelectorAll('button:not([disabled]), a, input, select')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('.md-x').addEventListener('click', close);
    wrap.querySelectorAll('[data-i]').forEach((btn) => btn.addEventListener('click', () => { const a = actions[+btn.dataset.i]; if (a.onClick) a.onClick(close); else close(); }));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => { wrap.classList.add('is-open'); (wrap.querySelector('.md-actions .btn:not([disabled])') || wrap.querySelector('.md-x')).focus(); });
    return { close, el: wrap };
  }

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('is-on'), 3200);
  }

  /* ─── coquille : barre du haut, bandeau démo, barre d'onglets mobile ─── */
  const sess = () => (window.SozoAuth && SozoAuth.session) || {};
  const initials = () => { const n = (sess().name || '?').trim().split(/\s+/); return ((n[0] || '?')[0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase(); };
  function shell(active) {
    const n = unread();
    const links = [
      ['decouvrir', 'decouvrir.html', 'Découvrir', 'home'],
      ['suivis', 'suivis.html', 'Mes suivis', 'heart'],
      ['bible', 'bible.html', 'Bible', 'book'],
      ['studio', 'studio.html', 'Studio auteur', 'pen']
    ];
    const head = document.createElement('header');
    head.className = 'top';
    head.innerHTML = `
      <p class="demo-bar mono">DÉMONSTRATION — LIVRES, AUTEURS, PRIX ET DATES FICTIFS · AUCUN PAIEMENT N'EST BRANCHÉ</p>
      <div class="top-in">
        <a class="top-logo" href="${root}index.html" aria-label="Sōzō — accueil">${window.SOZO_LOGO || 'Sōzō'}</a>
        <nav class="top-nav" aria-label="Navigation">
          ${links.map(([k, h, l]) => `<a class="top-link${active === k ? ' is-active' : ''}" href="${h}"${active === k ? ' aria-current="page"' : ''}>${l}${k === 'suivis' && n ? `<span class="dot" aria-label="${n} nouveauté${n > 1 ? 's' : ''}">${n}</span>` : ''}</a>`).join('')}
        </nav>
        <div class="top-tools">
          <a class="icon-btn" href="decouvrir.html#catalogue" aria-label="Rechercher un livre">${icon('search')}</a>
          <a class="icon-btn" href="suivis.html#notifications" aria-label="Notifications${n ? ` : ${n} nouvelle${n > 1 ? 's' : ''}` : ''}">${icon('bell')}${n ? `<span class="dot dot--abs">${n}</span>` : ''}</a>
          <button class="icon-btn" type="button" id="themeBtn" aria-pressed="false">${icon('moon')}</button>
          <div class="acct">
            <button class="avatar" type="button" id="acctBtn" aria-haspopup="true" aria-expanded="false" aria-controls="acctMenu" aria-label="Mon compte">${esc(initials())}</button>
            <div class="acct-menu" id="acctMenu" hidden>
              <p class="acct-name">${esc(sess().name || 'Mon compte')}</p>
              <p class="acct-mail">${esc(sess().email || '')}</p>
              <p class="mono ash">${sess().role === 'auteur' ? 'Lecteur et auteur' : 'Lecteur'} · compte de démonstration</p>
              <a href="suivis.html">${icon('heart')} Mes suivis</a>
              <a href="studio.html">${icon('pen')} Mon studio</a>
              <button type="button" id="logout">${icon('left')} Se déconnecter</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.prepend(head);
    const tabs = document.createElement('nav');
    tabs.className = 'tabs'; tabs.setAttribute('aria-label', 'Navigation');
    tabs.innerHTML = links.map(([k, h, l, ic]) => `<a href="${h}" class="${active === k ? 'is-active' : ''}"${active === k ? ' aria-current="page"' : ''}>${icon(ic)}<span>${l.replace(' auteur', '')}</span></a>`).join('');
    document.body.appendChild(tabs);
    const tb = head.querySelector('#themeBtn');
    const sync = () => {
      const dark = window.SozoTheme && SozoTheme.get() === 'dark';
      tb.innerHTML = icon(dark ? 'sun' : 'moon');
      tb.setAttribute('aria-pressed', String(dark));
      tb.setAttribute('aria-label', dark ? 'Passer en thème clair' : 'Passer en thème sombre');
    };
    tb.addEventListener('click', () => { SozoTheme.toggle(); sync(); });
    sync();
    const ab = head.querySelector('#acctBtn'), am = head.querySelector('#acctMenu');
    const closeMenu = () => { am.hidden = true; ab.setAttribute('aria-expanded', 'false'); };
    ab.addEventListener('click', (e) => { e.stopPropagation(); am.hidden = !am.hidden; ab.setAttribute('aria-expanded', String(!am.hidden)); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.acct')) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    head.querySelector('#logout').addEventListener('click', () => SozoAuth.close());
    const onScroll = () => head.classList.toggle('is-scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  function footer() {
    const f = document.createElement('footer');
    f.className = 'foot';
    f.innerHTML = `<div class="foot-in">
      <div class="foot-brand">${window.SOZO_LOGO || ''}<p>Publier et lire, à son rythme. Gratuit, payant ou mixte : l'auteur décide, le lecteur sait.</p><p class="foot-tag">Heal your heart · Grown your faith · Glow your spirit</p></div>
      <div><p class="mono ash">LIRE</p><a href="decouvrir.html">Découvrir</a><a href="decouvrir.html#catalogue">Catalogue</a><a href="suivis.html">Mes suivis</a></div>
      <div><p class="mono ash">ÉCRIRE</p><a href="studio.html">Studio auteur</a><a href="studio.html#import">Importer un manuscrit</a><a href="studio.html#calendrier">Calendrier</a></div>
      <div><p class="mono ash">Sōzō</p><a href="bible.html">La Bible intégrée</a><a href="${root}index.html">La plateforme</a><a href="${root}index.html#pages">Gratuit, payant, programmé</a></div>
    </div>
    <p class="foot-legal mono ash">© 2026 Sōzō — PLUS QU’UNE APPLICATION, UN CHEMIN · DÉMONSTRATION · PHOTOS LIBRES (CC0) · AUCUNE DONNÉE RÉELLE</p>`;
    document.body.appendChild(f);
  }

  /* parallaxe 3D douce des couvertures au survol (souris seulement) */
  function tilt(scope = document) {
    if (reduced || matchMedia('(hover: none)').matches) return;
    scope.querySelectorAll('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 22).toFixed(1) + 'deg');
        el.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * 14).toFixed(1) + 'deg');
      });
      el.addEventListener('pointerleave', () => { el.style.removeProperty('--ry'); el.style.removeProperty('--rx'); });
    });
  }

  /* apparitions au défilement */
  function reveals(scope = document) {
    const els = scope.querySelectorAll('.rv');
    if (reduced) { els.forEach((e) => e.classList.add('rv--on')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('rv--on'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  const q = (k) => new URLSearchParams(location.search).get(k);

  return { D, esc, icon, img, money, dateLong, dateShort, dayLong, relDays, parse, now, book, author, booksBy, status, access, readable,
           visiblePages, stats, accessLabel, priceFrom, chapterOf, pagesRange, follows, isFollowed, toggleFollow, notifications, markSeen,
           unread, sess, cover, bookCard, ink, inkHTML, inkAll, prepDraw, prepAll, modal, toast, shell, footer, tilt, reveals, q, reduced };
})();
