/* ═══════════════════════════════════════════════════════════
   Sōzō — socle commun : icônes, droits d'accès, couvertures, coquille,
   fenêtres, effet d'encre. Chargé par la landing (icônes, données) et par
   chaque écran de app/.
   ═══════════════════════════════════════════════════════════ */
window.SOZO = (() => {
  const D = window.SOZO_DATA;
  const root = document.documentElement.dataset.root ?? '../';   // préfixe vers la racine du site
  // Une image absente (compte sans photo) reçoit une illustration neutre du site.
  // Mode LÉGER : le téléphone annonce une connexion 2G/3G ou l'économie de
  // données → seulement les photos réduites (480 px, 2 à 5 fois plus légères).
  // Mesuré au test 2G du 16/10/2026 : la première visite coûtait ~900 Ko.
  const conn = navigator.connection || {};
  const leger = !!(conn.saveData || /(^|-)2g$|^3g$/.test(conn.effectiveType || ''));
  const img = (name, small) => `${root}images/${name || 'lib-vieux-livres'}${small || leger ? '-480' : ''}.jpg`;

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
    puces: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    numeros: 'M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5c0-1 2.8-1 2.8.3 0 1-2.8 1.6-2.8 3.2h3',
    image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
    // 21/10/2026 : écrits, mini-Word
    bulle: 'M4 5h16v11H9l-5 4z',
    partager: 'M12 15V3M7 8l5-5 5 5M5 13v7h14v-7',
    garder: 'M6 3h12v18l-6-4-6 4z',
    corbeille: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    restaurer: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
    gras: 'M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z',
    italique: 'M10 4h8M6 20h8M14 4l-4 16',
    titre: 'M5 5v14M14 5v14M5 12h9M18 10l2-1v10',
    citation: 'M5 11h5v6H5zM5 11c0-3 1-5 4-6M14 11h5v6h-5zM14 11c0-3 1-5 4-6',
    separateur: 'M4 12h4M10 12h4M16 12h4',
    gauche: 'M4 6h16M4 10h10M4 14h16M4 18h10',
    centre: 'M4 6h16M7 10h10M4 14h16M7 18h10',
    justifie: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    annuler: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    refaire: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
    loupe: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6',
    cible: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    lampe: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0 0 12 3z',
    plein: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    machine: 'M4 8h16v9H4zM7 11h1M10 11h1M13 11h1M16 11h1M8 14h8M8 5h8v3H8z',
    croix: 'M12 3v18M7 8h10',
    micro: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
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

  /* ─── l'état d'une page — DÉCIDÉ PAR LE SERVEUR (acces.py) ───
     Chaque page du catalogue arrive avec son `etat` calculé pour la personne
     connectée : 'free', 'owned', 'locked', 'soon', ou 'auteur' (le propriétaire
     lit tout). L'écran l'affiche ; il ne le recalcule jamais. Le texte d'une
     page fermée n'est d'ailleurs jamais envoyé au navigateur. */
  function access(b, n) {
    const p = b.pages.find((x) => x.n === n);
    if (!p) return null;
    return p.etat === 'auteur' ? 'free' : (p.etat || null);
  }
  const readable = (st) => st === 'free' || st === 'owned' || st === 'auteur';
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

  /* ─── suivis : enregistrés sur le serveur ───
     L'écran ne change qu'APRÈS la réponse du serveur (aucun faux succès).
     toggleFollow rend une promesse : vrai si le livre est désormais suivi. */
  const follows = () => [...D.reader.follows];
  const isFollowed = (id) => D.reader.follows.includes(id);
  async function toggleFollow(id) {
    const suivi = isFollowed(id);
    const r = await window.SOZO_API(suivi ? 'DELETE' : 'POST', `/api/suivis/${encodeURIComponent(id)}`);
    if (!r.ok) { toast(r.d.erreur || 'Action impossible pour le moment.'); return suivi; }
    if (r.d.suivi) { if (!suivi) D.reader.follows.push(id); } else D.reader.follows = D.reader.follows.filter((x) => x !== id);
    return !!r.d.suivi;
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
  // Nombre de notifications non lues : vient du SERVEUR (majCloche), plus
  // d'un calcul local qui ignorait paiements, ventes et sécurité.
  let nonLues = 0;
  const unread = () => nonLues;
  function majCloche() {
    return fetch('/api/notifications?compte=1', { credentials: 'same-origin', cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!d) return;
      nonLues = d.non_lues;
      const n = nonLues, cloche = document.querySelector('.top a[href="suivis.html#notifications"]'), lien = document.querySelector('.top-link[href="suivis.html"]');
      if (cloche) {
        cloche.querySelectorAll('.dot').forEach((x) => x.remove());
        cloche.setAttribute('aria-label', `Notifications${n ? ` : ${n} nouvelle${n > 1 ? 's' : ''}` : ''}`);
        if (n) cloche.insertAdjacentHTML('beforeend', `<span class="dot dot--abs">${n > 99 ? '99+' : n}</span>`);
      }
      if (lien) { lien.querySelectorAll('.dot').forEach((x) => x.remove()); if (n) lien.insertAdjacentHTML('beforeend', `<span class="dot" aria-label="${n} nouveauté${n > 1 ? 's' : ''}">${n > 99 ? '99+' : n}</span>`); }
      const pastille = document.querySelector('.nav [data-nav="notifications"] .nav-dot');
      if (pastille) { pastille.hidden = !n; pastille.textContent = n > 99 ? '99+' : String(n); pastille.setAttribute('aria-label', `${n} non lue${n > 1 ? 's' : ''}`); }
    }).catch(() => {});
  }
  /* Appareil déjà autorisé : on rappelle au serveur son abonnement une fois
     par session (le navigateur le renouvelle parfois sans prévenir). */
  function synchroAppareil() {
    try { if (sessionStorage.getItem('sozo-push-sync')) return; sessionStorage.setItem('sozo-push-sync', '1'); } catch (e) { return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
    navigator.serviceWorker.getRegistration('/app/').then((reg) => reg && reg.pushManager.getSubscription()).then((sub) => {
      if (!sub || !window.SOZO_API) return;
      const j = sub.toJSON();
      window.SOZO_API('POST', '/api/notifications/appareils', { endpoint: j.endpoint, keys: j.keys, libelle: libelleAppareil() });
    }).catch(() => {});
  }
  function libelleAppareil() {
    const u = navigator.userAgent;
    const os = /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Ordinateur';
    const nav = /Edg\//.test(u) ? 'Edge' : /Firefox/.test(u) ? 'Firefox' : /Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Navigateur';
    return `${nav} · ${os}`;
  }

  /* ─── couverture : photo + typographie ───
     19/10/2026 : l'auteur peut tout choisir (b.apparence.couv, validée par le
     serveur) et envoyer sa propre image (b.image = empreinte). Sans réglage,
     le rendu d'origine est inchangé (la landing en dépend). Les valeurs
     viennent d'un AUTRE auteur : elles sont revérifiées ici avant d'entrer
     dans un attribut style (couleur #RRGGBB, entiers bornés, listes fermées). */
  const POLICES = {
    cormorant: "'Cormorant Garamond', Georgia, serif", inter: "'Inter', system-ui, sans-serif",
    georgia: "Georgia, 'Times New Roman', serif", didone: "Didot, 'Bodoni 72', 'Bodoni MT', Georgia, serif",
    moderne: "'Avenir Next', 'Segoe UI', system-ui, sans-serif", machine: "'Courier New', Courier, monospace",
    manuscrite: "'Snell Roundhand', 'Segoe Script', 'Apple Chancery', 'Brush Script MT', cursive"
  };
  const NOMS_POLICES = { cormorant: 'Cormorant (serif élégante)', inter: 'Inter (sans serif)', georgia: 'Georgia (classique)', didone: 'Didone (contrastée)', moderne: 'Moderne', machine: 'Machine à écrire', manuscrite: 'Manuscrite' };
  const coul = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);
  const ent = (v, a, z, d) => (Number.isInteger(v) && v >= a && v <= z ? v : d);
  const couvUrl = (b) => b.image && b.id ? `/api/livres/${encodeURIComponent(b.id)}/couverture?v=${encodeURIComponent(b.image)}` : null;
  /* La plume de Sōzō (logo, couvertures, bouton Écrire) */
  const PLUME_SVG = '<svg class="cv-plume" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.6 3.2c-6.8.4-12 4.9-13.8 11.6l-1.9 6.3 1.3.4 1.6-4.5c1.5.2 3.3-.2 5-1.3 3.5-2.3 6.4-6.7 7.8-12.5z"/><path fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".7" stroke-linecap="round" d="M6.4 19.4C9.1 13.6 12.7 9 17.4 5.9"/></svg>';
  /* Monogramme : les initiales sur velours, à la place d'un portrait */
  const monogramme = (nom, taille) => {
    const i = String(nom || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase() || '?';
    return `<span class="vl-mono"${taille ? ` style="--t:${Number(taille) | 0}px"` : ''} aria-hidden="true">${esc(i)}</span>`;
  };
  const OVAL = '<svg class="cv-oval" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50,6 C88,4 98,22 97,50 C96,82 76,96 49,95 C16,94 3,76 4,48 C5,18 20,7 50,6 Z"/></svg>';
  function cover(b, opts = {}) {
    const a = author(b.author);
    const c = (b.apparence && b.apparence.couv) || null;
    if (opts.imageUrl && !b.image) b = { ...b, image: 'apercu' };
    const st = b.cover.style;
    const tail = `${b.demo ? '<span class="cv-exemple">Exemple</span>' : ''}`;
    const cls = `cv${opts.d3 === false ? '' : ' cv3d'}${opts.cls ? ' ' + opts.cls : ''}`;
    /* 22/10/2026 : les photos reviennent (« les livres là-bas ont tous leur
       image ; je t'ai dit de diminuer les images, là tu as abusé »). Sans
       réglage de l'auteur, la couverture garde la mise en page velours — filet
       d'or, plume, titre — posée sur la photo choisie à la création du livre,
       sous un voile. Sans photo connue : velours seul, comme avant. */
    if (!c && !b.image) {
      const ph = b.cover && b.cover.img;
      return `<div class="${cls} cv--velours cv--${st}${ph ? ' cv--photo' : ''}"${ph ? ` style="--cv:url('${esc(img(ph, !opts.big))}')"` : ''}>
      <div class="cv-face">${ph ? '<span class="cv-photo" aria-hidden="true"></span>' : ''}
        <span class="cv-cat">${esc(b.cat)}</span>
        <span class="cv-bloc-v">${PLUME_SVG}<span class="cv-title">${esc(b.title)}</span></span>
        <span class="cv-author">${esc(a.name)}</span>
        ${tail}
      </div>
    </div>`;
    }
    const k = c || {};
    // « photo » (ancien réglage) n'existe plus : on le rend en velours
    const fond = k.fond || (b.image ? 'image' : 'photo');
    const url = fond === 'image' ? (opts.imageUrl || couvUrl(b)) : null;   // imageUrl : aperçu d'une image pas encore envoyée
    const photo = fond === 'photo' && b.cover && b.cover.img;               // 22/10/2026 : la photo de la bibliothèque revient
    const v = [];
    if (url) v.push(`--cv:url('${url}')`);
    else if (photo) v.push(`--cv:url('${img(b.cover.img, !opts.big)}')`);
    if (fond === 'uni') v.push(`--cv-fond:${coul(k.couleur1, '#241C1D')}`);
    if (fond === 'degrade') v.push(`--cv-fond:linear-gradient(${ent(k.angle, 0, 360, 160)}deg, ${coul(k.couleur1, '#5C0E1B')}, ${coul(k.couleur2, '#23050A')})`);
    if (fond === 'image' && !url) v.push(`--cv-fond:linear-gradient(160deg, #5C0E1B, #23050A)`);
    v.push(`--cv-x:${ent(k.cadrage_x, 0, 100, 50)}%`, `--cv-y:${ent(k.cadrage_y, 0, 100, 50)}%`, `--cv-zoom:${ent(k.zoom, 100, 300, 100) / 100}`);
    if (k.voile != null) v.push(`--cv-voile:${ent(k.voile, 0, 90, 35) / 100}`, `--cv-voile-c:${coul(k.voile_couleur, '#0C0909')}`);
    v.push(`--cv-police:${POLICES[k.police_titre] || POLICES.cormorant}`, `--cv-taille:${ent(k.taille_titre, 50, 240, 100) / 100}`, `--cv-graisse:${[300, 400, 500, 600, 700, 800].includes(k.graisse) ? k.graisse : 600}`,
      `--cv-esp:${ent(k.espacement, -5, 40, k.capitales ? 10 : -2) / 100}em`, `--cv-titre-c:${coul(k.couleur_titre, '#F8F5EB')}`, `--cv-texte-c:${coul(k.couleur_texte, k.couleur_titre ? coul(k.couleur_titre, '#F8F5EB') : '#F8F5EB')}`,
      `--cv-orn:${coul(k.couleur_ornement, '#D4AF37')}`);
    const al = { gauche: 'start', centre: 'center', droite: 'end' }[k.alignement] || 'start';
    const pos = { haut: 'haut', milieu: 'milieu', bas: 'bas' }[k.position] || 'bas';
    const orn = ['ovale', 'bandeau', 'cadre', 'filet', 'coins'].includes(k.ornement) ? k.ornement : 'aucun';
    const seule = k.image_seule === true && !!url;
    const voile = k.voile != null ? ' cv-voile' : '';
    return `<div class="${cls} cv--perso cv-pos-${pos} cv-al-${al} cv-orn-${orn}${k.capitales ? ' cv-caps' : ''}${k.italique ? ' cv-ital' : ''}${seule ? ' cv-seule' : ''}${voile}${url || photo ? ' cv-a-photo' : ''}" style="${esc(v.join(';'))}">
      <div class="cv-face"${fond === 'uni' || fond === 'degrade' || (fond === 'image' && !url) ? ' data-fond' : ''}>
        <span class="cv-photo" aria-hidden="true"></span>
        ${seule ? `<span class="sr">${esc(b.title)} — ${esc(a.name)}</span>` : `
        <span class="cv-author"${k.afficher_auteur === false ? ' hidden' : ''}>${esc(a.name)}</span>
        <span class="cv-bloc"><span class="cv-title">${esc(b.title)}</span>${k.sous_titre ? `<span class="cv-sous">${esc(k.sous_titre)}</span>` : ''}${orn === 'filet' ? '<i class="cv-filet" aria-hidden="true"></i>' : ''}</span>
        <span class="cv-cat"${k.afficher_categorie === false ? ' hidden' : ''}>${esc(b.cat)}</span>`}
        ${orn === 'ovale' && !seule ? OVAL : ''}${orn === 'coins' && !seule ? '<i class="cv-coin" aria-hidden="true"></i><i class="cv-coin" aria-hidden="true"></i><i class="cv-coin" aria-hidden="true"></i><i class="cv-coin" aria-hidden="true"></i>' : ''}
        ${tail}
      </div>
      <span class="cv-spine" aria-hidden="true"></span><span class="cv-edge" aria-hidden="true"></span>
    </div>`;
  }

  /* ─── mise en page intérieure choisie par l'auteur (b.apparence.page) ───
     Partagée par la liseuse et par l'aperçu de l'atelier : ce que l'auteur
     règle est exactement ce que le lecteur verra. Une ligne « *** » devient
     le séparateur choisi. Tout le texte passe par esc() (ou par la Bible
     intégrée, qui échappe elle-même). */
  const emphase = (h) => h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const SEPARATEURS = { etoiles: '⁂', fleuron: '❦', croix: '✝', trait: '———' };
  const mise = {
    style(pg = {}) {
      const v = [`--pg-police:${POLICES[pg.police] || POLICES.cormorant}`, `--pg-interligne:${(Number.isInteger(pg.interligne) && pg.interligne >= 130 && pg.interligne <= 230 ? pg.interligne : 170) / 100}`];
      if (/^#[0-9a-f]{6}$/i.test(pg.accent || '')) v.push(`--pg-accent:${pg.accent}`);
      return v.join(';');
    },
    classes(pg = {}) {
      return `pg-al-${['justifie', 'centre'].includes(pg.alignement) ? pg.alignement : 'gauche'} pg-lt-${['aucune', 'simple', 'ornee'].includes(pg.lettrine) ? pg.lettrine : 'simple'} pg-ch-${['capitales', 'italique'].includes(pg.titre_chapitre) ? pg.titre_chapitre : 'classique'}`;
    },
    /* 21/10/2026 — la mise en forme du mini-Word, en marques de TEXTE (backend/texte.py) :
       « # titre », « > citation », **gras**, *italique*. f() échappe d'abord tout le
       texte ; les seules balises posées ensuite sont les nôtres, autour d'un texte
       déjà échappé. Aucune balise venue d'un auteur n'entre jamais dans la page. */
    paragraphes(texte, pg = {}, ligne) {
      const sep = SEPARATEURS[pg.separateur];
      const f = ligne || ((t) => (window.SOZO && SOZO.bible ? SOZO.bible.linkify(t) : esc(t)) || '&nbsp;');
      return String(texte || '').split('\n').map((t) => {
        if (/^\s*(\*\s*){3}\s*$/.test(t)) return `<p class="pg-sep" role="separator">${sep ? esc(sep) : '&nbsp;'}</p>`;
        let m = /^(#{1,2}) (.*)$/.exec(t);
        if (m) return `<h3 class="pg-t${m[1].length === 2 ? ' pg-t2' : ''}">${emphase(f(m[2]))}</h3>`;
        m = /^> (.*)$/.exec(t);
        if (m) return `<blockquote class="pg-cit"><p>${emphase(f(m[1]))}</p></blockquote>`;
        return /^(• |\d{1,3}\. )/.test(t) ? `<p class="pg-li">${emphase(f(t))}</p>` : `<p>${emphase(f(t))}</p>`;
      }).join('');
    }
  };

  /* 22/10/2026 — briques de l'Explorer réutilisées par l'Accueil : une rangée
     qui défile vers la gauche, et un écrit posé sur sa photo. */
  function rangee(titre, livres, opts = {}) {
    if (!livres.length) return '';
    return `<section class="xp-rang" aria-label="${esc(titre)}">
      <div class="xp-rang-h"><h2>${esc(titre)}</h2>${opts.lien ? `<a class="ec-lien" href="${esc(opts.lien)}">Tout voir</a>` : ''}
        <span class="xp-fleches"><button type="button" class="xp-fl" data-fl="-1" aria-label="Précédents">${icon('left')}</button><button type="button" class="xp-fl" data-fl="1" aria-label="Suivants">${icon('right')}</button></span></div>
      <div class="xp-defile" tabindex="0">${livres.map((b) => `<a class="xp-livre" href="livre.html?id=${encodeURIComponent(b.id)}">${cover(b, { d3: false })}<strong>${esc(b.title)}</strong><small>${esc(author(b.author).name)}</small></a>`).join('')}</div>
    </section>`;
  }
  function xpEcrit(e, natures) {
    const ph = (e.apparence || {}).image;
    const t = String(e.texte || '').replace(/[#>*•]/g, '');
    return `<a class="xp-ecrit${ph ? ' has-photo' : ''}" href="ecrit.html?id=${e.id}"${ph ? ` style="--xp-photo:url('${esc(img(ph, true))}')"` : ''}>
      <span class="xp-ecrit-n">${esc((natures || {})[e.nature] || '')}</span>
      ${e.titre ? `<strong class="xp-ecrit-t">${esc(e.titre)}</strong>` : ''}
      <span class="xp-ecrit-x">${esc(t.slice(0, 180))}${t.length > 180 ? '…' : ''}</span>
      <span class="xp-ecrit-a">— ${esc(e.auteur.nom)}${e.jaime ? ` · ${icon('heart')} ${e.jaime}` : ''}</span></a>`;
  }
  function brancherRangees(scope = document) {
    scope.querySelectorAll('.xp-rang').forEach((r) => r.querySelectorAll('[data-fl]').forEach((f) => f.addEventListener('click', () => {
      const z = r.querySelector('.xp-defile'); z.scrollBy({ left: +f.dataset.fl * z.clientWidth * 0.85, behavior: reduced ? 'auto' : 'smooth' });
    })));
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
  function modal({ title, body, actions = [], onClose }) {
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'md-wrap';
    wrap.innerHTML = `<div class="md" role="dialog" aria-modal="true" aria-labelledby="mdTitle">
      <button class="md-x" type="button" aria-label="Fermer">${icon('x')}</button>
      <h2 class="md-title" id="mdTitle">${esc(title)}</h2>
      <div class="md-body">${body}</div>
      <div class="md-actions">${actions.map((a, i) => `<button type="button" class="btn ${a.primary ? 'btn--accent' : 'btn--ghost'}" data-i="${i}"${a.disabled ? ' disabled aria-disabled="true"' : ''}>${esc(a.label)}</button>`).join('')}</div>
    </div>`;
    let fermee = false;
    const close = () => { if (fermee) return; fermee = true; wrap.classList.remove('is-open'); setTimeout(() => wrap.remove(), 250); document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); if (onClose) onClose(); };
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

  /* ─── la charte de la communauté (lot E, 21/10/2026) ───
     Le SERVEUR refuse de publier un écrit ou un commentaire tant que la charte
     en vigueur n'est pas acceptée (403, code « charte »). SOZO_API appelle
     alors cette fenêtre ; si la personne accepte, la demande est rejouée telle
     quelle. Rend une promesse : vrai si la charte est acceptée. */
  function charte(version) {
    return new Promise((fin) => {
      let accepte = false;
      const m = modal({
        title: 'La charte de la communauté',
        body: `<p>Avant votre premier écrit public ou votre premier commentaire, quelques règles simples pour que Sōzō reste un lieu sûr et bienveillant.</p>
          <ul class="vl-charte">
            <li>Publiez ce que vous avez écrit vous-même, ou ce que vous avez le droit de partager, en citant l’auteur.</li>
            <li>Respectez chaque personne : ni insulte, ni moquerie, ni harcèlement, ni propos haineux.</li>
            <li>Débattez des idées sans attaquer les personnes, y compris celles qui croient autrement ou qui doutent.</li>
            <li>Rien de violent, d’obscène ou de dangereux ; ni publicité, ni appel à l’argent.</li>
            <li>Ne publiez aucune information privée sur quelqu’un (téléphone, adresse, photos…).</li>
            <li>La modération peut retirer un écrit ou un commentaire contraire à la charte (motif à l’appui) et, en cas de récidive, désactiver un compte.</li>
          </ul>
          <p><a class="vl-lien" href="charte.html" target="_blank" rel="noopener">Lire la charte complète</a></p>
          <label class="cx-check"><input type="checkbox" id="charteOk"><span>J’ai lu la charte et je l’accepte.</span></label>
          <p class="warn" id="charteErr" role="alert" hidden></p>`,
        actions: [{ label: 'Plus tard' }, { label: 'Accepter et continuer', primary: true, onClick: async (close) => {
          const err = m.el.querySelector('#charteErr');
          if (!m.el.querySelector('#charteOk').checked) { err.textContent = 'Cochez la case pour accepter la charte.'; err.hidden = false; return; }
          const r = await window.SOZO_API('POST', '/api/moi/charte', { version });
          if (!r.ok) { err.textContent = r.d.erreur || 'Le serveur n’a pas enregistré votre accord.'; err.hidden = false; return; }
          accepte = true; close();
        } }],
        onClose: () => fin(accepte)
      });
    });
  }
  window.SOZO_CHARTE = charte;

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('is-on'), 3200);
  }

  /* ─── coquille : barre latérale (ordinateur), barre du bas (téléphone) ───
     19/10/2026, demande du propriétaire : « une slide bar comme pour Klassio,
     mais sur un téléphone une barre horizontale », et l'outillage AUTEUR à
     portée de quelques clics — on développe d'abord pour les auteurs.
     · ordinateur : une barre d'icônes à gauche, qui se déplie au survol, au
       clavier (focus) ou avec le bouton menu (épinglée, retenue sur l'appareil) ;
     · téléphone : cinq onglets en bas, « Écrire » au centre ;
     · aria-expanded dit toujours la vérité ; le mouvement réduit coupe l'animation. */
  const sess = () => (window.SozoAuth && SozoAuth.session) || {};
  const pro = () => sess().pro || {};
  const initials = () => { const n = (sess().name || '?').trim().split(/\s+/); return ((n[0] || '?')[0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase(); };
  const ALIAS = { decouvrir: 'accueil', suivis: 'bibliotheque', studio: 'atelier' };
  const NAV = {
    ecrire: [
      ['ecrire', 'ecrits.html?nouveau=1', 'Écrire', 'feather'],
      ['ecrits', 'ecrits.html', 'Mes écrits', 'file'],
      ['atelier', 'studio.html', 'Mes livres', 'book'],
      ['importer', 'studio.html?action=importer', 'Importer un manuscrit', 'upload']
    ],
    lire: [
      ['accueil', 'decouvrir.html', 'Accueil', 'home'],
      ['explorer', 'explorer.html', 'Explorer', 'grid'],
      ['bibliotheque', 'suivis.html', 'Bibliothèque', 'library'],
      ['bible', 'bible.html', 'La Bible', 'book']
    ],
    moi: [
      ['notifications', 'suivis.html#notifications', 'Notifications', 'bell'],
      ['compte', 'compte.html', 'Mon compte', 'user']
    ]
  };
  // Téléphone, comme l'image du propriétaire : Accueil, Explorer, la plume, Bibliothèque, Profil
  const ONGLETS = [['accueil', 'decouvrir.html', 'Accueil', 'home'], ['explorer', 'explorer.html', 'Explorer', 'grid'],
    ['ecrits', 'ecrits.html', 'Écrire', 'feather'], ['bibliotheque', 'suivis.html', 'Bibliothèque', 'library'], ['profil', 'compte.html', 'Profil', 'user']];
  const ouvertGarde = () => { try { return localStorage.getItem('sozo-nav-ouverte') === '1'; } catch (e) { return false; } };
  /* ─── installer l'application (21/10/2026) ───
     Android et ordinateur : la fenêtre d'installation du navigateur
     (beforeinstallprompt). iPhone : Safari ne le permet pas — un guide en
     images (Partager → Sur l'écran d'accueil). Déjà installée : rien. */
  let invite = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invite = e; document.dispatchEvent(new CustomEvent('sozo:installable')); });
  const installee = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
  const installer = {
    possible: () => !installee() && (!!invite || iphone()),
    installee,
    async lancer() {
      if (invite) {
        invite.prompt();
        const r = await invite.userChoice.catch(() => null);
        invite = null;
        if (r && r.outcome === 'accepted') toast('Sōzō s’installe : vous le retrouverez sur votre écran d’accueil.');
        return;
      }
      if (iphone()) {
        modal({ title: 'Installer Sōzō sur votre iPhone', body: `<ol class="vl-ios">
          <li><span>1</span>Dans Safari, touchez le bouton <strong>Partager</strong> ${icon('partager')} en bas de l’écran.</li>
          <li><span>2</span>Choisissez <strong>Sur l’écran d’accueil</strong>.</li>
          <li><span>3</span>Touchez <strong>Ajouter</strong> : l’icône de Sōzō apparaît avec vos applications.</li></ol>
          <p class="note">${icon('shield')} Les pages que vous ouvrez restent lisibles sans réseau sur cet appareil, à votre nom seulement.</p>`, actions: [{ label: 'Compris', primary: true }] });
        return;
      }
      toast('Ce navigateur ne propose pas l’installation. Essayez avec Chrome sur Android, ou Safari sur iPhone.');
    }
  };

  function shell(active) {
    active = ALIAS[active] || active;
    const n = unread();
    // 22/10/2026 : au survol, les lettres glissent l'une après l'autre (inspiré du « curved menu » du propriétaire)
    const lettres = (l) => `<span class="nav-l" aria-hidden="true">${[...l].map((c, j) => `<span style="--j:${j}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</span>`;
    const lien = ([k, h, l, ic]) => `<a class="nav-a${active === k ? ' is-active' : ''}" href="${h}"${active === k ? ' aria-current="page"' : ''} data-nav="${k}" aria-label="${esc(l)}">${icon(ic)}${lettres(l)}${k === 'notifications' ? '<span class="nav-dot" hidden></span>' : ''}</a>`;
    document.body.classList.add('a-nav');
    const nav = document.createElement('aside');
    nav.className = 'nav'; nav.id = 'sozoNav'; nav.setAttribute('aria-label', 'Navigation principale');
    nav.innerHTML = `<div class="nav-in">
        <div class="nav-tete">
          <button class="nav-menu" type="button" id="navMenu" aria-controls="sozoNav" aria-expanded="false" aria-label="Déplier le menu">${icon('sliders')}</button>
          <a class="nav-logo" href="decouvrir.html" aria-label="Sōzō — accueil">${window.SOZO_LOGO || 'Sōzō'}</a>
        </div>
        <a class="nav-a nav-nouveau${active === 'ecrire' ? ' is-active' : ''}" href="ecrits.html?nouveau=1" data-nav="ecrire" aria-label="Écrire">${icon('feather')}${lettres('Écrire')}</a>
        <p class="nav-sec"><span>Lire</span></p>
        ${NAV.lire.map(lien).join('')}
        <p class="nav-sec"><span>Écrire</span></p>
        ${NAV.ecrire.filter(([k]) => k !== 'ecrire').map(lien).join('')}
        <div class="nav-recents" id="navRecents" hidden><p class="nav-sec"><span>Récents</span></p><div class="nav-rec-l"></div></div>
        <div class="nav-bas">
          ${NAV.moi.filter(([k]) => k !== 'compte').map(lien).join('')}
          <div class="nav-moi">
            <button class="nav-a nav-moi-b" type="button" id="navMoi" aria-haspopup="true" aria-expanded="false" aria-controls="navMoiMenu"><span class="nav-av" aria-hidden="true">${esc(initials())}</span><span class="nav-l nav-moi-t"><strong>${esc(sess().name || 'Mon compte')}</strong><small>${pro().actif ? `Auteur · ${esc(pro().nom)}` : 'Lecteur'}</small></span></button>
            <div class="nav-moi-menu" id="navMoiMenu" role="menu" hidden>
              <p class="acct-mail">${esc(sess().email || '')}</p>
              <a role="menuitem" href="compte.html">${icon('user')} Mon compte et paramètres</a>
              <button role="menuitem" type="button" data-plume-ouvrir>${icon('feather')} ${pro().actif ? 'Mon offre Plume' : 'Devenir auteur'}</button>
              <a role="menuitem" href="studio.html">${icon('book')} Mon atelier</a>
              <button role="menuitem" type="button" data-visite>${icon('spark')} Visite guidée</button>
              <button role="menuitem" type="button" data-sortir>${icon('left')} Se déconnecter</button>
            </div>
          </div>
        </div>
      </div>
      <svg class="nav-courbe" viewBox="0 0 100 800" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 Q0 400 0 800 Z"/></svg>`;
    document.body.prepend(nav);
    const head = document.createElement('header');
    head.className = 'top';
    head.innerHTML = `
      <div class="top-in">
        <button class="icon-btn top-tiroir" type="button" id="tiroirBtn" aria-controls="sozoNav" aria-expanded="false" aria-label="Ouvrir le menu">${icon('sliders')}</button>
        <a class="top-logo" href="decouvrir.html" aria-label="Sōzō — accueil">${window.SOZO_LOGO || 'Sōzō'}</a>
        <a class="top-cherche" href="explorer.html#q">${icon('search')}<span>Rechercher un livre, un auteur, un thème…</span></a>
        <div class="top-tools">
          <button class="top-plume${pro().actif ? ' is-pro' : ''}" type="button" data-plume-ouvrir title="${pro().actif ? `Votre offre ${esc(pro().nom)}` : 'Devenir auteur avec Plume'}">${icon('feather')}<span>${pro().actif ? esc(pro().nom) : 'Devenir auteur'}</span></button>
          <a class="btn btn--sm top-ecrire" href="ecrits.html?nouveau=pensee">${icon('pen')} Écrire</a>
          <a class="icon-btn top-loupe" href="explorer.html#q" aria-label="Rechercher un livre">${icon('search')}</a>
          <a class="icon-btn" href="suivis.html#notifications" aria-label="Notifications${n ? ` : ${n} nouvelle${n > 1 ? 's' : ''}` : ''}">${icon('bell')}${n ? `<span class="dot dot--abs">${n}</span>` : ''}</a>
          <div class="acct">
            <button class="avatar" type="button" id="acctBtn" aria-haspopup="true" aria-expanded="false" aria-controls="acctMenu" aria-label="Mon compte">${esc(initials())}</button>
            <div class="acct-menu" id="acctMenu" hidden>
              <p class="acct-name">${esc(sess().name || 'Mon compte')}</p>
              <p class="acct-mail">${esc(sess().email || '')}</p>
              <p class="mono ash">${pro().actif ? `Auteur · ${esc(pro().nom)}` : sess().role === 'auteur' ? 'Lecteur · premier livre offert' : 'Lecteur'}${sess().email_verifie ? '' : ' · e-mail à confirmer'}</p>
              <button type="button" data-plume-ouvrir>${icon('feather')} ${pro().actif ? 'Mon offre Plume' : 'Devenir auteur'}</button>
              <a href="compte.html">${icon('user')} Mon compte</a>
              <a href="studio.html">${icon('feather')} Mon atelier</a>
              <a href="suivis.html">${icon('library')} Ma bibliothèque</a>
              <button type="button" data-visite>${icon('spark')} Visite guidée</button>
              <button type="button" id="logout">${icon('left')} Se déconnecter</button>
            </div>
          </div>
        </div>
      </div>`;
    nav.after(head);
    // « Devenir auteur » / l'offre en cours : la fenêtre Plume ne s'ouvre que sur ce geste
    head.addEventListener('click', (e) => {
      if (!e.target.closest('[data-plume-ouvrir]')) return;
      const m = head.querySelector('#acctMenu'); if (m) m.hidden = true;
      if (window.SOZO.buy) window.SOZO.buy.plume(); else location.href = 'compte.html#plume';
    });
    const tabs = document.createElement('nav');
    tabs.className = 'tabs'; tabs.setAttribute('aria-label', 'Navigation');
    /* 22/10/2026 — la barre du bas devient une barre GLISSANTE horizontale :
       Lire à gauche, la plume fixe au milieu, Écrire et le compte à droite ;
       chaque côté défile au doigt. Le cercle aux initiales remplace « Profil ». */
    const onglet = ([k, h, l, ic]) => `<a href="${h}" class="tb-a${active === k || (k === 'compte' && active === 'compte') ? ' is-active' : ''}"${active === k ? ' aria-current="page"' : ''} data-nav="${k}" aria-label="${esc(l)}">${icon(ic)}${lettres(l)}</a>`;
    tabs.innerHTML = `<div class="tb-cote tb-g">${NAV.lire.map(onglet).join('')}</div>
      <button type="button" class="tabs-ecrire${['ecrits', 'atelier', 'ecrire', 'importer'].includes(active) ? ' is-active' : ''}" id="pilBtn" aria-expanded="false" aria-controls="pilule" data-nav="ecrits">${icon('feather')}<span>Écrire</span></button>
      <div class="tb-cote tb-d">${[['ecrits', 'ecrits.html', 'Mes écrits', 'file'], ['atelier', 'studio.html', 'Mes livres', 'book'], ['notifications', 'suivis.html#notifications', 'Alertes', 'bell']].map(onglet).join('')}
        <a href="compte.html" class="tb-a tb-moi${active === 'compte' ? ' is-active' : ''}" data-nav="compte" aria-label="Mon compte et paramètres"><span class="nav-av" aria-hidden="true">${esc(initials())}</span>${lettres('Moi')}</a></div>`;
    document.body.appendChild(tabs);

    /* 22/10/2026 — la plume déplie une pilule en relief (inspirée du
       « 3D adaptive navigation bar » montré par le propriétaire, portée sans
       React ni bibliothèque : la CSP n'en laisse entrer aucune). Elle porte
       le contenu « Écrire » de la barre latérale. Toucher la plume, Échap ou
       toucher ailleurs la replie ; aria-expanded dit toujours la vérité. */
    const pil = document.createElement('div');
    pil.className = 'pil'; pil.id = 'pilule'; pil.hidden = true;
    pil.innerHTML = `<div class="pil-corps" role="menu" aria-label="Écrire"><i class="pil-reflet" aria-hidden="true"></i><i class="pil-reflet2" aria-hidden="true"></i>
      ${NAV.ecrire.map(([k, h, l, ic], i) => `<a role="menuitem" href="${h}" class="pil-a${active === k ? ' is-active' : ''}" style="--i:${i}">${icon(ic)}<span>${k === 'importer' ? 'Importer' : l}</span></a>`).join('')}</div>`;
    tabs.before(pil);
    const pb = tabs.querySelector('#pilBtn');
    const plier = (ouvrir, focus) => {
      clearTimeout(pil._t);
      pb.setAttribute('aria-expanded', String(ouvrir));
      if (ouvrir) {
        pil.hidden = false; void pil.offsetWidth; pil.classList.add('is-on');
        if (focus) pil.querySelector('.pil-a').focus();
      } else {
        pil.classList.remove('is-on');
        pil._t = setTimeout(() => { pil.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
      }
    };
    pb.addEventListener('click', (e) => { e.stopPropagation(); plier(pb.getAttribute('aria-expanded') !== 'true', e.detail === 0); });
    document.addEventListener('click', (e) => { if (!pil.hidden && !e.target.closest('.pil')) plier(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pil.hidden) { plier(false); pb.focus(); } });
    pil.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const l = [...pil.querySelectorAll('.pil-a')], i = l.indexOf(document.activeElement);
      l[(i + (e.key === 'ArrowRight' ? 1 : l.length - 1)) % l.length].focus(); e.preventDefault();
    });

    /* barre latérale : épinglée (bouton), ou dépliée le temps du survol / du clavier */
    const menu = nav.querySelector('#navMenu');
    const etat = () => {
      const ouvert = nav.classList.contains('is-epinglee') || nav.classList.contains('is-survol');
      menu.setAttribute('aria-expanded', String(ouvert));
      menu.setAttribute('aria-label', nav.classList.contains('is-epinglee') ? 'Replier le menu' : 'Déplier le menu');
    };
    if (ouvertGarde()) { nav.classList.add('is-epinglee'); document.body.classList.add('nav-epinglee'); }
    menu.addEventListener('click', () => {
      const v = !nav.classList.contains('is-epinglee');
      nav.classList.toggle('is-epinglee', v); nav.classList.remove('is-survol');
      document.body.classList.toggle('nav-epinglee', v);
      try { localStorage.setItem('sozo-nav-ouverte', v ? '1' : '0'); } catch (e) {}
      etat();
    });
    let tSortie;
    if (matchMedia('(hover: hover)').matches) {
      nav.addEventListener('pointerenter', () => { clearTimeout(tSortie); nav.classList.add('is-survol'); etat(); });
      nav.addEventListener('pointerleave', () => { tSortie = setTimeout(() => { nav.classList.remove('is-survol'); etat(); }, 180); });
    }
    nav.addEventListener('focusin', () => { nav.classList.add('is-survol'); etat(); });
    nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) { nav.classList.remove('is-survol'); etat(); } });
    nav.addEventListener('keydown', (e) => { if (e.key === 'Escape') { nav.classList.remove('is-survol'); etat(); menu.focus(); } });
    etat();

    /* le petit cercle en bas, comme chez Claude ou ChatGPT : il ouvre le compte */
    const nm = nav.querySelector('#navMoi'), nmm = nav.querySelector('#navMoiMenu');
    const fermerMoi = () => { nmm.hidden = true; nm.setAttribute('aria-expanded', 'false'); };
    nm.addEventListener('click', (e) => { e.stopPropagation(); nmm.hidden = !nmm.hidden; nm.setAttribute('aria-expanded', String(!nmm.hidden)); if (!nmm.hidden) nmm.querySelector('a,button').focus(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.nav-moi')) fermerMoi(); });
    nmm.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermerMoi(); nm.focus(); } });
    nmm.addEventListener('click', (e) => {
      if (e.target.closest('[data-sortir]')) SozoAuth.close();
      if (e.target.closest('[data-plume-ouvrir]')) { fermerMoi(); if (window.SOZO && window.SOZO.buy) window.SOZO.buy.plume(); else location.href = 'compte.html#plume'; }
    });
    /* Récents : les livres en cours et vos derniers écrits, comme l'historique d'une IA */
    const recents = async () => {
      try { await window.SOZO_PRET; } catch (e) {}
      const lignes = [];
      try {
        D.reader.follows.map(book).filter((b) => b && D.reader.progress[b.id]).slice(0, 4)
          .forEach((b) => lignes.push(`<a class="nav-rec" href="lire.html?id=${encodeURIComponent(b.id)}&p=${D.reader.progress[b.id]}" title="${esc(b.title)}">${icon('book')}<span>${esc(b.title)}</span></a>`));
      } catch (e) {}
      const r = await window.SOZO_API('GET', '/api/mes-ecrits').catch(() => null);
      if (r && r.ok) r.d.ecrits.filter((e) => !e.corbeille_le).slice(0, 5).forEach((e) => {
        const t = (e.titre || (e.texte || '').split('\n').find((x) => x.trim()) || 'Sans titre').replace(/^(#{1,2} |> )/, '').replace(/\*+/g, '').slice(0, 60);
        lignes.push(`<a class="nav-rec" href="ecrits.html?id=${e.id}" title="${esc(t)}">${icon('file')}<span>${esc(t)}</span></a>`);
      });
      if (!lignes.length) return;
      nav.querySelector('.nav-rec-l').innerHTML = lignes.join('');
      nav.querySelector('#navRecents').hidden = false;
    };
    recents();
    /* téléphone : la même barre, mais HORIZONTALE (demande du propriétaire) : une bande
       qui glisse depuis la gauche sous la barre du haut et défile au doigt */
    const tb = head.querySelector('#tiroirBtn');
    const voile = document.createElement('div'); voile.className = 'nav-voile'; document.body.appendChild(voile);
    const tiroir = (ouvrir) => {
      nav.style.setProperty('--haut', `${Math.round(head.getBoundingClientRect().bottom)}px`);   // la bande se pose sous la barre du haut
      nav.classList.toggle('is-tiroir', ouvrir); voile.classList.toggle('is-on', ouvrir);
      document.body.classList.toggle('tiroir-ouvert', ouvrir);
      tb.setAttribute('aria-expanded', String(ouvrir)); tb.setAttribute('aria-label', ouvrir ? 'Fermer le menu' : 'Ouvrir le menu');
      if (ouvrir) setTimeout(() => nav.querySelector('.nav-nouveau').focus(), 60); else tb.focus();
    };
    tb.addEventListener('click', () => tiroir(!nav.classList.contains('is-tiroir')));
    voile.addEventListener('click', () => tiroir(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-tiroir')) tiroir(false); });

    const ab = head.querySelector('#acctBtn'), am = head.querySelector('#acctMenu');
    const closeMenu = () => { am.hidden = true; ab.setAttribute('aria-expanded', 'false'); };
    ab.addEventListener('click', (e) => { e.stopPropagation(); am.hidden = !am.hidden; ab.setAttribute('aria-expanded', String(!am.hidden)); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.acct')) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    head.querySelector('#logout').addEventListener('click', () => SozoAuth.close());
    document.addEventListener('click', (e) => { if (e.target.closest('[data-visite]')) { closeMenu(); visite(); } });
    majCloche(); synchroAppareil();
    const onScroll = () => head.classList.toggle('is-scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ─── visite guidée : quatre bulles posées sur la vraie navigation ───
     Pour la personne qui arrive et « ne comprend pas ce qu'elle doit faire »
     (retour du propriétaire, 19/10/2026). Toujours rejouable (menu du compte). */
  function visite() {
    const tel = matchMedia('(max-width: 899px)').matches;
    const cible = (k) => document.querySelector(tel ? `.tabs [data-nav="${k}"]` : `.nav [data-nav="${k}"]`) || document.querySelector(`[data-nav="${k}"]`);
    const ETAPES = [
      ['ecrits', 'Écrire', 'La plume : un poème, une pensée, une prière, un récit ou un conte, en quelques secondes. Ou un livre entier, page après page, que vous publiez quand vous voulez.'],
      ['accueil', 'L’accueil', 'Ce qui paraît, ce que vous lisez, et vos premiers pas : Sōzō vous indique toujours la prochaine étape.'],
      ['explorer', 'Explorer', 'Tout le catalogue, par catégorie, avec une recherche par titre, auteur ou thème.'],
      ['bibliotheque', 'Votre bibliothèque', 'Les livres que vous lisez, les écrits que vous gardez, vos passages épinglés et vos notifications.']
    ];
    let i = 0;
    const bulle = document.createElement('div');
    bulle.className = 'visite'; bulle.setAttribute('role', 'dialog'); bulle.setAttribute('aria-modal', 'false'); bulle.setAttribute('aria-labelledby', 'visiteT');
    document.body.appendChild(bulle);
    const nav = document.querySelector('.nav');
    const fin = () => { bulle.remove(); document.querySelectorAll('.is-visite').forEach((x) => x.classList.remove('is-visite')); if (nav) nav.classList.remove('is-survol'); try { localStorage.setItem('sozo-visite-vue', '1'); } catch (e) {} };
    const montrer = () => {
      const [k, t, d] = ETAPES[i], el = cible(k);
      document.querySelectorAll('.is-visite').forEach((x) => x.classList.remove('is-visite'));
      if (nav && !tel) nav.classList.add('is-survol');
      bulle.innerHTML = `<p class="mono">Étape ${i + 1} sur ${ETAPES.length}</p><h2 id="visiteT">${esc(t)}</h2><p>${esc(d)}</p>
        <div class="visite-acts"><button type="button" class="btn btn--ghost btn--sm" data-v="fin">Passer</button>
        ${i ? '<button type="button" class="btn btn--ghost btn--sm" data-v="prec">Précédent</button>' : ''}
        <button type="button" class="btn btn--accent btn--sm" data-v="suiv">${i < ETAPES.length - 1 ? 'Suivant' : 'C’est parti'}</button></div>`;
      if (el) {
        el.classList.add('is-visite');
        const r = el.getBoundingClientRect();
        if (tel) { bulle.style.left = '12px'; bulle.style.right = '12px'; bulle.style.top = ''; bulle.style.bottom = (innerHeight - r.top + 14) + 'px'; }
        // le menu se déplie à 256 px : la bulle se pose à sa droite
        else { bulle.style.left = (Math.max(r.right, nav ? 256 : 0) + 18) + 'px'; bulle.style.top = Math.max(12, Math.min(innerHeight - 260, r.top - 20)) + 'px'; bulle.style.right = ''; bulle.style.bottom = ''; }
      }
      bulle.querySelector('[data-v="suiv"]').focus();
    };
    bulle.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      if (b.dataset.v === 'fin' || (b.dataset.v === 'suiv' && i === ETAPES.length - 1)) return fin();
      i += b.dataset.v === 'suiv' ? 1 : -1; montrer();
    });
    bulle.addEventListener('keydown', (e) => { if (e.key === 'Escape') fin(); });
    setTimeout(montrer, nav && !tel ? 60 : 0);
  }

  function footer() {
    const f = document.createElement('footer');
    f.className = 'foot';
    f.innerHTML = `<div class="foot-in">
      <div class="foot-brand">${window.SOZO_LOGO || ''}<p>Écrire et lire, calmement : une pensée, une prière, un poème, un livre. Gratuit, payant ou mixte : l'auteur décide, le lecteur sait.</p><p class="foot-tag">Heal your heart · Grown your faith · Glow your spirit</p></div>
      <div><p class="mono ash">ÉCRIRE</p><a href="ecrits.html?nouveau=pensee">Une pensée, un poème</a><a href="ecrits.html">Mes écrits</a><a href="studio.html">Mes livres</a><a href="studio.html?action=importer">Importer un manuscrit</a></div>
      <div><p class="mono ash">LIRE</p><a href="decouvrir.html">Accueil</a><a href="explorer.html">Explorer</a><a href="suivis.html">Ma bibliothèque</a><a href="bible.html">La Bible intégrée</a></div>
      <div><p class="mono ash">Sōzō</p><a href="compte.html">Mon compte</a><a href="${root}index.html">La plateforme</a><a href="charte.html">Charte de la communauté</a><a href="cgu.html">Conditions d’utilisation</a><a href="confidentialite.html">Confidentialité</a></div>
    </div>
    <p class="foot-legal mono ash">© 2026 Sōzō — PLUS QU’UNE APPLICATION, UN CHEMIN</p>`;
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

  return { D, leger, esc, icon, img, money, dateLong, dateShort, dayLong, relDays, parse, now, book, author, booksBy, status, access, readable,
           visiblePages, stats, accessLabel, priceFrom, chapterOf, pagesRange, follows, isFollowed, toggleFollow, notifications, markSeen,
           unread, majCloche, libelleAppareil, sess, cover, bookCard, visite, monogramme, PLUME_SVG, emphase, installer, POLICES, NOMS_POLICES, couvUrl, mise, ink, inkHTML, inkAll, prepDraw, prepAll, modal, toast, shell, footer, tilt, reveals, q, reduced, rangee, xpEcrit, brancherRangees };
})();
