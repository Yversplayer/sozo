/* Sōzō — Explorer : tout le catalogue. Les catégories affichées sont celles
   qui ont VRAIMENT des livres (19/10/2026 : plus de tuile vide), avec leur
   nombre ; recherche par titre, auteur, thème ; filtres d'accès et de parution. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  S.shell('explorer');
  const main = $('#main');
  const books = D.books;
  if (matchMedia('(max-width: 899px)').matches) { rechercherTel(); return; }
  // 21/10/2026 : plus de photo ; une tuile de velours et son signe, comme sur l'image du propriétaire
  const ICONE = { Foi: 'croix', Spiritualité: 'spark', Poésie: 'feather', Prière: 'heart', Méditation: 'sun', Louange: 'star', Témoignage: 'bulle',
    Recueil: 'library', Récit: 'book', Conte: 'moon' };
  const E = window.SOZO_ECRITS;
  const compte = {};
  books.forEach((b) => { compte[b.cat] = (compte[b.cat] || 0) + 1; });
  const cats = Object.keys(compte).sort((x, y) => compte[y] - compte[x] || x.localeCompare(y, 'fr'));

  /* 22/10/2026 — Explorer pour le WEB (images « Mark Twain » et « Haiku » du
     propriétaire) : une grande une sur la photo du livre, des rangées qui
     défilent vers la gauche (à la Netflix), des écrits posés sur leur photo ;
     la recherche et tout le catalogue restent dessous. */
  const parution = (b) => Math.max(0, ...b.pages.filter((p) => S.status(p) === 'published' && p.date).map((p) => +S.parse(p.date)));
  const autres = books.filter((b) => !b.owner);
  const recents = [...autres].sort((x, y) => parution(y) - parution(x));
  const une = recents.slice(0, 6);
  const rangees = [['Nouveautés', recents.slice(0, 14), '']]
    .concat(cats.filter((c) => compte[c] >= 2).slice(0, 5).map((c) => [c, autres.filter((b) => b.cat === c), c]))
    .concat([['Gratuits, à lire tout de suite', autres.filter((b) => b.access === 'free'), '']])
    .filter(([, l]) => l.length);
  const vue0 = S.q('vue') === 'ecrits' ? 'ecrits' : 'livres';
  main.innerHTML = `<div class="wrap ex">
    <section class="ex-tete">
      <h1 class="ex-titre">Explorer</h1>
      <div class="vl-onglets ex-vues" role="tablist" aria-label="Que voulez-vous explorer ?">
        <button role="tab" type="button" data-vue="livres" aria-selected="${vue0 === 'livres'}" aria-controls="vueLivres">Livres</button>
        <button role="tab" type="button" data-vue="ecrits" aria-selected="${vue0 === 'ecrits'}" aria-controls="vueEcrits">Écrits</button>
      </div>
    </section>
    <div id="vueLivres"${vue0 === 'livres' ? '' : ' hidden'}>
    ${une.length ? `<section class="xp-une" id="xpUne" aria-roledescription="carrousel" aria-label="À la une">
      <div class="xp-une-fond" id="xpFond" aria-hidden="true"></div>
      <div class="xp-une-t" id="xpTexte" aria-live="polite"></div>
      <div class="xp-une-rang" role="list" aria-label="Choisir le livre à la une">${une.map((b, i) => `<button type="button" role="listitem" class="xp-une-cv" data-une="${i}" aria-label="${S.esc(b.title)}">${S.cover(b, { d3: false })}</button>`).join('')}</div>
    </section>` : ''}
    ${rangees.map(([titre, liste, lien]) => `<section class="xp-rang" aria-label="${S.esc(titre)}">
      <div class="xp-rang-h"><h2>${S.esc(titre)}</h2>${lien ? `<button type="button" class="ec-lien" data-voir="${S.esc(lien)}">Tout voir</button>` : ''}
        <span class="xp-fleches"><button type="button" class="xp-fl" data-fl="-1" aria-label="Précédents">${S.icon('left')}</button><button type="button" class="xp-fl" data-fl="1" aria-label="Suivants">${S.icon('right')}</button></span></div>
      <div class="xp-defile" tabindex="0">${liste.map((b) => `<a class="xp-livre" href="livre.html?id=${encodeURIComponent(b.id)}">${S.cover(b, { d3: false })}<strong>${S.esc(b.title)}</strong><small>${S.esc(S.author(b.author).name)}</small></a>`).join('')}</div>
    </section>`).join('')}
    <section class="xp-rang xp-rang--ecrits" aria-label="Poèmes, pensées, prières">
      <div class="xp-rang-h"><h2>Poèmes, pensées, prières</h2><button type="button" class="ec-lien" data-vue-ecrits>Tous les écrits</button>
        <span class="xp-fleches"><button type="button" class="xp-fl" data-fl="-1" aria-label="Précédents">${S.icon('left')}</button><button type="button" class="xp-fl" data-fl="1" aria-label="Suivants">${S.icon('right')}</button></span></div>
      <div class="xp-defile" id="xpEcrits" tabindex="0"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
    </section>
    <section class="ex-tete" id="tout">
      <h2 class="xp-tout">Tout le catalogue</h2>
      <label class="search ex-cherche"><span class="sr">Rechercher un titre, un auteur, un thème</span>${S.icon('search')}
        <input type="search" id="q" placeholder="Rechercher un livre, un écrit, un auteur…" autocomplete="off"></label>
      ${cats.length ? `<div class="ex-cats" role="group" aria-label="Catégories"><button class="chip ex-cat" type="button" data-cat="" aria-pressed="true">Toutes <small>${books.length}</small></button>${cats.map((c) => `<button class="chip ex-cat" type="button" data-cat="${S.esc(c)}" aria-pressed="false">${S.esc(c)} <small>${compte[c]}</small></button>`).join('')}</div>` : ''}
    </section>
    <section class="ex-sec ex-recherche" id="recherche" hidden aria-live="polite"></section>
    <section class="ex-sec" id="catalogue">
      <div class="ex-barre">
        <div class="ex-filtres" role="group" aria-label="Filtres">
          ${[['', 'Tous'], ['free', 'Gratuits'], ['paid', 'Payants'], ['mixed', 'Mixtes']].map(([v, l]) => `<button class="ex-f" type="button" data-access="${v}" aria-pressed="${v === '' ? 'true' : 'false'}">${l}</button>`).join('')}
          <span class="sep" aria-hidden="true"></span>
          ${[['', 'Toutes parutions'], ['live', 'En cours'], ['done', 'Complets']].map(([v, l]) => `<button class="ex-f" type="button" data-run="${v}" aria-pressed="${v === '' ? 'true' : 'false'}">${l}</button>`).join('')}
        </div>
        <label class="sr" for="sort">Trier</label>
        <select id="sort" class="ex-tri"><option value="new">Récents</option><option value="title">Titre A → Z</option><option value="price">Prix croissant</option></select>
      </div>
      <p class="results-meta" id="meta" aria-live="polite"></p>
      <div class="grid" id="grid"></div>
    </section>
    ${Object.keys(D.authors).length ? `<section class="ex-sec">
      <div class="sec-head"><h2 class="sec-title">Les auteurs</h2></div>
      <div class="ex-auteurs">${Object.entries(D.authors).map(([id, a]) => `
        <a class="ex-au" href="auteur.html?id=${encodeURIComponent(id)}">${S.monogramme(a.name, 64)}<strong>${S.esc(a.name)}</strong><small>${S.booksBy(id).length} livre${S.booksBy(id).length > 1 ? 's' : ''}</small></a>`).join('')}</div>
    </section>` : ''}
    </div>
    <div id="vueEcrits"${vue0 === 'ecrits' ? '' : ' hidden'}>
      <div class="ex-cats" role="group" aria-label="Natures"><button class="chip" type="button" data-nature="" aria-pressed="true">Tous</button>${Object.entries(E.NATURES).map(([k, l]) => `<button class="chip" type="button" data-nature="${k}" aria-pressed="false">${S.esc(l)}</button>`).join('')}</div>
      <div class="ex-cats ex-themes" role="group" aria-label="Thèmes"><span class="ash">Thème</span>${['Espérance', 'Foi', 'Louange', 'Gratitude', 'Pardon', 'Paix', 'Amour', 'Famille', 'Courage', 'Épreuve', 'Deuil', 'Guérison'].map((t) => `<button class="chip chip--sm" type="button" data-theme="${S.esc(t)}" aria-pressed="${S.q('theme') === t}">${S.esc(t)}</button>`).join('')}</div>
      <div class="vl-fil" id="fil" aria-live="polite"></div>
      <div class="ex-plus"><button class="btn btn--ghost" type="button" id="plus" hidden>Voir plus d’écrits</button></div>
    </div>
  </div>`;

  /* ─── la une : la photo du livre, son titre en grand, « Lire » ─── */
  let iUne = 0, tUne = null;
  function peindreUne(i) {
    const b = une[i]; if (!b) return;
    iUne = i;
    const st = S.stats(b), a = S.author(b.author);
    $('#xpFond').style.setProperty('--xp-photo', `url('${S.img(b.cover.img)}')`);
    $('#xpTexte').innerHTML = `<p class="xp-une-k">${S.esc(b.cat)}${b.demo ? ' · exemple' : ''}</p>
      <h2 class="xp-une-titre">${S.esc(b.title)}</h2>
      <p class="xp-une-a">${S.esc(a.name)}</p>
      <dl class="xp-une-meta"><div><dt>Pages</dt><dd>${st.published}</dd></div><div><dt>Accès</dt><dd>${S.esc(S.accessLabel(b))}</dd></div>${st.next ? `<div><dt>Prochaine page</dt><dd>${S.esc(S.dateShort(st.next.date))}</dd></div>` : ''}</dl>
      <p class="xp-une-d">${S.esc((b.desc || '').slice(0, 220))}${(b.desc || '').length > 220 ? '…' : ''}</p>
      <div class="xp-une-acts"><a class="btn btn--accent" href="lire.html?id=${encodeURIComponent(b.id)}">${S.icon('book')} Lire « ${S.esc(b.title)} »</a><a class="btn xp-btn-clair" href="livre.html?id=${encodeURIComponent(b.id)}">Découvrir</a></div>`;
    $$('[data-une]').forEach((x) => x.setAttribute('aria-current', String(+x.dataset.une === i)));
  }
  if (une.length) {
    peindreUne(0);
    $$('[data-une]').forEach((x) => x.addEventListener('click', () => { clearInterval(tUne); peindreUne(+x.dataset.une); }));
    if (!S.reduced && une.length > 1) tUne = setInterval(() => { if (!document.hidden) peindreUne((iUne + 1) % une.length); }, 8000);
    $('#xpUne').addEventListener('pointerenter', () => clearInterval(tUne));
  }
  /* les rangées : glisser au doigt, ou les flèches */
  $$('.xp-rang').forEach((r) => r.querySelectorAll('[data-fl]').forEach((f) => f.addEventListener('click', () => {
    const z = r.querySelector('.xp-defile'); z.scrollBy({ left: +f.dataset.fl * z.clientWidth * 0.85, behavior: S.reduced ? 'auto' : 'smooth' });
  })));
  $$('[data-voir]').forEach((x) => x.addEventListener('click', () => { state.cat = x.dataset.voir; render(); $('#tout').scrollIntoView({ behavior: S.reduced ? 'auto' : 'smooth' }); }));
  /* les écrits du moment, posés sur leur photo : les plus aimés d'abord */
  window.SOZO_API('GET', '/api/ecrits').then((r) => {
    const z = $('#xpEcrits');
    const l = r.ok ? [...r.d.ecrits].sort((x, y) => (y.jaime || 0) - (x.jaime || 0)).slice(0, 12) : [];
    z.innerHTML = l.length ? l.map((e) => `<a class="xp-ecrit${(e.apparence || {}).image ? ' has-photo' : ''}" href="ecrit.html?id=${e.id}"${(e.apparence || {}).image ? ` style="--xp-photo:url('${S.esc(S.img(e.apparence.image, true))}')"` : ''}>
        <span class="xp-ecrit-n">${S.esc(E.NATURES[e.nature] || '')}</span>
        ${e.titre ? `<strong class="xp-ecrit-t">${S.esc(e.titre)}</strong>` : ''}
        <span class="xp-ecrit-x">${S.esc(String(e.texte || '').replace(/[#>*•]/g, '').slice(0, 180))}${String(e.texte || '').length > 180 ? '…' : ''}</span>
        <span class="xp-ecrit-a">— ${S.esc(e.auteur.nom)}${e.jaime ? ` · ${S.icon('heart')} ${e.jaime}` : ''}</span></a>`).join('')
      : `<div class="empty"><strong>Aucun écrit pour l’instant</strong>Le premier peut être le vôtre.</div>`;
  });
  $$('[data-vue-ecrits]').forEach((x) => x.addEventListener('click', () => montrer('ecrits')));

  /* ─── les écrits : du serveur, par nature, page après page ─── */
  let ecrits = [], suite = null, nature = '', theme = S.q('theme') || '', charge = false;
  async function chargerEcrits(neuf) {
    if (charge) return;
    charge = true;
    const fil = $('#fil'), plus = $('#plus');
    if (neuf) { ecrits = []; suite = null; fil.innerHTML = '<p class="ash"><span class="spin" aria-hidden="true"></span> Chargement des écrits…</p>'; }
    const r = await window.SOZO_API('GET', `/api/ecrits?${new URLSearchParams({ ...(nature ? { nature } : {}), ...(theme ? { theme } : {}), ...(suite ? { avant: suite } : {}) })}`);
    charge = false;
    if (!r.ok) { fil.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Les écrits n’ont pas pu se charger.')}</span></p>`; return; }
    ecrits = ecrits.concat(r.d.ecrits); suite = r.d.suite;
    fil.innerHTML = ecrits.length ? ecrits.map((e) => E.carte(e)).join('')
      : `<div class="empty" style="grid-column:1/-1"><strong>Aucun écrit ${nature || theme ? `ici ` : ''}pour l’instant</strong>Le premier peut être le vôtre.<br><br><a class="btn" href="ecrits.html?nouveau=${nature || 'pensee'}">${S.icon('feather')} Écrire</a></div>`;
    plus.hidden = !suite;
  }
  E.brancher($('#fil'), (id) => ecrits.find((e) => e.id === id));
  $('#plus').addEventListener('click', () => chargerEcrits(false));
  $$('[data-nature]').forEach((c) => c.addEventListener('click', () => { nature = c.dataset.nature; $$('[data-nature]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); chargerEcrits(true); }));
  $$('.ex-themes [data-theme]').forEach((c) => c.addEventListener('click', () => { theme = theme === c.dataset.theme ? '' : c.dataset.theme; $$('.ex-themes [data-theme]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.theme === theme))); chargerEcrits(true); }));
  const montrer = (v) => {
    $$('[data-vue]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vue === v)));
    $('#vueLivres').hidden = v !== 'livres'; $('#vueEcrits').hidden = v !== 'ecrits';
    history.replaceState(null, '', v === 'ecrits' ? 'explorer.html?vue=ecrits' : 'explorer.html');
    if (v === 'ecrits' && !ecrits.length) chargerEcrits(true);
  };
  $$('[data-vue]').forEach((b) => b.addEventListener('click', () => montrer(b.dataset.vue)));
  if (vue0 === 'ecrits') chargerEcrits(true);

  /* ─── recherche + filtres, côté client ─── */
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /* 03/11/2026 — l'onglet « Rechercher » de l'application : la recherche en
     haut, sous le titre (comme Netflix et Webtoon) ; « À la une » est déjà sur
     l'accueil. Sur ordinateur, rien ne change. */
  if (matchMedia('(max-width: 899px)').matches) {
    const tete = main.querySelector('.ex-tete'), tout = $('#tout'), rech = $('#recherche');
    tete.querySelector('.ex-titre').textContent = 'Rechercher';
    if (tout) { tete.after(tout); if (rech) tout.after(rech); }
    document.title = 'Rechercher — Sōzō';
  }
  const state = { q: S.q('q') || '', access: '', run: '', cat: S.q('cat') || '', sort: 'new' };
  const lastDate = (b) => Math.max(...b.pages.filter((p) => S.status(p) === 'published' && p.date).map((p) => +S.parse(p.date)), 0);
  function render() {
    const q = norm(state.q.trim());
    const list = books.filter((b) => {
      const st = S.stats(b);
      if (state.access && b.access !== state.access) return false;
      if (state.run === 'live' && !(st.scheduled || st.draft)) return false;
      if (state.run === 'done' && (st.scheduled || st.draft)) return false;
      if (state.cat && b.cat !== state.cat) return false;
      if (q && !norm([b.title, S.author(b.author).name, b.cat, b.desc].join(' ')).includes(q)) return false;
      return true;
    });
    if (state.sort === 'title') list.sort((x, y) => x.title.localeCompare(y.title, 'fr'));
    else if (state.sort === 'price') list.sort((x, y) => (S.priceFrom(x) ?? 0) - (S.priceFrom(y) ?? 0));
    else list.sort((x, y) => lastDate(y) - lastDate(x));
    $('#meta').textContent = `${list.length} livre${list.length > 1 ? 's' : ''}${state.cat ? ` · ${state.cat}` : ''}${state.q ? ` · « ${state.q} »` : ''}`;
    $('#grid').innerHTML = list.length ? list.map((b) => S.bookCard(b)).join('')
      : !books.length ? `<div class="empty" style="grid-column:1/-1"><strong>Aucun livre publié pour l’instant</strong>Les livres apparaîtront ici dès leur première page publiée.<br><br><a class="btn btn--ghost btn--sm" href="studio.html">Publier mon livre</a></div>`
      : `<div class="empty" style="grid-column:1/-1"><strong>Aucun livre ne correspond</strong>Essayez un autre mot, ou retirez un filtre.<br><br><button class="btn btn--ghost btn--sm" type="button" id="reset">Tout afficher</button></div>`;
    const r = $('#reset'); if (r) r.addEventListener('click', reset);
    $$('.ex-cat').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === state.cat)));
  }
  function reset() {
    Object.assign(state, { q: '', access: '', run: '', cat: '' }); $('#q').value = '';
    $$('[data-access],[data-run]').forEach((c) => c.setAttribute('aria-pressed', String((c.dataset.access ?? c.dataset.run) === '')));
    render();
  }
  $('#q').value = state.q;
  /* Lot C : la recherche couvre aussi les écrits et les auteurs (côté serveur) */
  let tR, nR = 0;
  async function rechercher(q) {
    const z = $('#recherche'), n = ++nR;
    if (q.trim().length < 2) { z.hidden = true; z.innerHTML = ''; return; }
    const [re, ra] = await Promise.all([window.SOZO_API('GET', `/api/ecrits?q=${encodeURIComponent(q.trim())}`), window.SOZO_API('GET', `/api/profils?q=${encodeURIComponent(q.trim())}`)]);
    if (n !== nR) return;                               // une frappe plus récente l'emporte
    const ecr = re.ok ? re.d.ecrits.slice(0, 6) : [], aut = ra.ok ? ra.d.auteurs : [];
    z.hidden = !ecr.length && !aut.length;
    z.innerHTML = `${aut.length ? `<h2 class="sec-title">Auteurs</h2><div class="ex-auteurs">${aut.map((a) => `<a class="ex-au" href="auteur.html?id=${encodeURIComponent(a.id)}">${S.monogramme(a.nom, 64)}<strong>${S.esc(a.nom)}</strong>${a.ville ? `<small>${S.esc(a.ville)}</small>` : ''}</a>`).join('')}</div>` : ''}
      ${ecr.length ? `<h2 class="sec-title" style="margin-top:18px">Écrits</h2><div class="vl-fil" id="filR">${ecr.map((e) => E.carte(e)).join('')}</div>` : ''}`;
    if (ecr.length) E.brancher($('#filR'), (id) => ecr.find((e) => e.id === id));
  }
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); clearTimeout(tR); tR = setTimeout(() => rechercher(state.q), 350); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $$('[data-access]').forEach((c) => c.addEventListener('click', () => { state.access = c.dataset.access; $$('[data-access]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }));
  $$('[data-run]').forEach((c) => c.addEventListener('click', () => { state.run = c.dataset.run; $$('[data-run]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }));
  $$('.ex-cat').forEach((c) => c.addEventListener('click', () => { state.cat = c.dataset.cat; render(); }));
  render();
  if (state.q) rechercher(state.q);
  S.inkAll(); S.prepAll(); S.reveals(); S.footer();
  if (location.hash === '#q') setTimeout(() => $('#q').focus(), 60);
  else if (S.q('cat')) setTimeout(() => $('#tout').scrollIntoView(), 60);

  /* ═══ 08/11/2026 — l'onglet « Rechercher » des maquettes Stitch (téléphone) ═══
     La recherche en haut, prête à taper (le clavier sort dès l'arrivée) ;
     les recherches récentes, gardées SUR CET APPAREIL seulement ; les
     catégories en ronds, avec leur nombre réel de livres ; des livres en
     grille ; les auteurs. Pendant la frappe : les livres (sur l'appareil),
     les auteurs et les écrits (le serveur). Sur ordinateur, rien ne change. */
  function rechercherTel() {
    const E = window.SOZO_ECRITS;
    const compte = {};
    books.forEach((b) => { compte[b.cat] = (compte[b.cat] || 0) + 1; });
    const cats = Object.keys(compte).sort((x, y) => compte[y] - compte[x] || x.localeCompare(y, 'fr'));
    const ICONE = { Foi: 'croix', Spiritualité: 'spark', Poésie: 'feather', Prière: 'heart', Méditation: 'sun', Louange: 'star', Témoignage: 'bulle',
      Recueil: 'library', Récit: 'book', Conte: 'moon', Roman: 'book', Jeunesse: 'star', Essai: 'pen', Biographie: 'user', Théologie: 'library',
      Fantasy: 'spark', Histoire: 'calendar', Manga: 'image', Nouvelles: 'file', Polar: 'eye', 'Roman graphique': 'image', Bande: 'image' };
    const parution = (b) => Math.max(0, ...b.pages.filter((p) => S.status(p) === 'published' && p.date).map((p) => +S.parse(p.date)));
    const autres = books.filter((b) => !b.owner).sort((x, y) => parution(y) - parution(x));
    const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const CLE = 'sozo-recherches';
    const recentes = () => { try { return JSON.parse(localStorage.getItem(CLE) || '[]').filter((x) => typeof x === 'string').slice(0, 8); } catch (e) { return []; } };
    const garder = (q) => { q = q.trim(); if (q.length < 2) return; try { localStorage.setItem(CLE, JSON.stringify([q, ...recentes().filter((x) => norm(x) !== norm(q))].slice(0, 8))); } catch (e) {} };
    const oublier = (q) => { try { localStorage.setItem(CLE, JSON.stringify(q == null ? [] : recentes().filter((x) => x !== q))); } catch (e) {} };
    const prix = (b) => {
      if (b.access === 'free') return '<span class="sx-chip sx-chip--or">Gratuit</span>';
      const p = S.priceFrom(b);
      return p != null ? `<span class="sx-chip sx-chip--bord">${b.access === 'mixed' ? 'Dès ' : ''}${S.esc(S.money(p))}</span>` : '';
    };
    const tuile = (b) => `<a class="sx-tuile" href="livre.html?id=${encodeURIComponent(b.id)}"><span class="sx-tuile-cv">${S.cover(b, { d3: false })}${prix(b)}</span><b>${S.esc(b.title)}</b><small>${S.esc(S.author(b.author).name)}</small><span class="sx-sur">${S.esc(b.cat)}</span></a>`;
    const ligneLivre = (b) => `<a class="sx-ligne sx-ligne--livre" href="livre.html?id=${encodeURIComponent(b.id)}">${S.cover(b, { d3: false })}<span class="sx-ligne-t"><b>${S.esc(b.title)}</b><small>${S.esc(S.author(b.author).name)} · ${S.esc(b.cat)}</small>${prix(b)}</span>${S.icon('chevron')}</a>`;
    const ligneAuteur = (id, nom, sous) => `<a class="sx-ligne" href="auteur.html?id=${encodeURIComponent(id)}">${S.monogramme(nom, 46)}<span class="sx-ligne-t"><b>${S.esc(nom)}</b>${sous ? `<small>${S.esc(sous)}</small>` : ''}</span>${S.icon('chevron')}</a>`;
    const vue0 = S.q('vue') === 'ecrits' ? 'ecrits' : 'livres';
    main.innerHTML = `<div class="sx-page sx-cherche">
      <div class="sx-cherche-barre">
        <label class="sx-champ">${S.icon('search')}<span class="sr">Rechercher</span>
          <input type="search" id="q" enterkeyhint="search" placeholder="Rechercher un livre, un écrit, un auteur…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <button type="button" class="sx-annuler" id="annuler">Annuler</button>
      </div>
      <div class="sx-ecran">
        <nav class="sx-pilules" role="tablist" aria-label="Que chercher ?" data-sans-glisse>
          <button type="button" class="sx-pilule" role="tab" data-vue="livres" aria-selected="${vue0 === 'livres'}">${S.icon('book')}Livres</button>
          <button type="button" class="sx-pilule" role="tab" data-vue="ecrits" aria-selected="${vue0 === 'ecrits'}">${S.icon('feather')}Écrits</button>
          <a class="sx-pilule" href="bible.html">${S.icon('library')}La Bible</a>
        </nav>
        <div id="accueilR"></div>
        <div id="resultats" hidden aria-live="polite"></div>
        <div id="vueEcrits" hidden>
          <div class="sx-pilules" role="group" aria-label="Natures" data-sans-glisse><button class="sx-pilule is-on" type="button" data-nature="">Tous</button>${Object.entries(E.NATURES).map(([k, l]) => `<button class="sx-pilule" type="button" data-nature="${k}">${S.esc(l)}</button>`).join('')}</div>
          <div class="sx-fil" id="fil"></div>
          <button class="sx-btn sx-btn--doux sx-btn--bloc" type="button" id="plus" hidden>Voir plus d’écrits</button>
        </div>
      </div>
    </div>`;
    const q = $('#q'), accueil = $('#accueilR'), res = $('#resultats');
    let cat = S.q('cat') || '', vue = vue0;

    function peindreAccueil() {
      const r = recentes();
      accueil.innerHTML = `
        ${r.length ? `<section class="sx-recentes"><div class="sx-h"><span class="sx-sur">Recherches récentes</span><button type="button" id="toutEffacer">Tout effacer</button></div>
          <div class="sx-recentes-l">${r.map((x) => `<span class="sx-recente"><button type="button" data-recente="${S.esc(x)}">${S.icon('clock')}${S.esc(x)}</button><button type="button" class="sx-recente-x" data-oublier="${S.esc(x)}" aria-label="Retirer « ${S.esc(x)} »">${S.icon('x')}</button></span>`).join('')}</div></section>` : ''}
        ${cats.length ? `<section><div class="sx-h"><h2>Catégories</h2></div>
          <div class="sx-ronds">${cats.slice(0, 11).map((c) => `<button type="button" class="sx-rond" data-cat="${S.esc(c)}"><span>${S.icon(ICONE[c] || 'book')}</span><b>${S.esc(c)}</b><small>${compte[c]}</small></button>`).join('')}
            <a class="sx-rond sx-rond--bible" href="bible.html"><span>${S.icon('library')}</span><b>Bible</b><small>LSG</small></a></div></section>` : ''}
        ${autres.length ? `<section><div class="sx-h"><h2>À découvrir</h2><button type="button" data-tout>Tout voir</button></div>
          <div class="sx-tuiles">${autres.slice(0, 6).map(tuile).join('')}</div></section>` : `<div class="sx-vide">${S.PLUME_OR}<strong>Aucun livre publié pour l’instant</strong>Les livres apparaîtront ici dès leur première page publiée.</div>`}
        ${Object.keys(D.authors).length ? `<section><div class="sx-h"><h2>Les auteurs</h2></div>
          <div class="sx-liste">${Object.entries(D.authors).slice(0, 8).map(([id, a]) => ligneAuteur(id, a.name, `${S.booksBy(id).length} livre${S.booksBy(id).length > 1 ? 's' : ''}`)).join('')}</div></section>` : ''}`;
    }

    let nR = 0, tR;
    async function chercher() {
      const t = q.value.trim(), n = ++nR;
      const vide = !t && !cat;
      accueil.hidden = !vide || vue !== 'livres'; res.hidden = vide || vue !== 'livres';
      if (vide) { peindreAccueil(); return; }
      const nt = norm(t);
      const livres = books.filter((b) => (!cat || b.cat === cat) && (!nt || norm([b.title, S.author(b.author).name, b.cat, b.desc].join(' ')).includes(nt)));
      const tete = `${cat ? `<div class="sx-filtre"><span class="sx-chip sx-chip--bord">${S.esc(cat)}</span><button type="button" class="sx-lien" id="sansCat">Toutes les catégories</button></div>` : ''}`;
      const blocLivres = `<section><div class="sx-h"><h2>Livres</h2><span class="sx-compte">${livres.length}</span></div>${livres.length ? `<div class="sx-liste">${livres.slice(0, 30).map(ligneLivre).join('')}</div>` : '<p class="sx-chapeau">Aucun livre ne correspond.</p>'}</section>`;
      res.innerHTML = tete + blocLivres + (t.length >= 2 ? '<div id="resServeur"><p class="sx-chapeau"><span class="spin" aria-hidden="true"></span> Auteurs et écrits…</p></div>' : '');
      const sc = $('#sansCat'); if (sc) sc.addEventListener('click', () => { cat = ''; chercher(); });
      if (t.length < 2) return;
      const [re, ra] = await Promise.all([window.SOZO_API('GET', `/api/ecrits?q=${encodeURIComponent(t)}`), window.SOZO_API('GET', `/api/profils?q=${encodeURIComponent(t)}`)]);
      if (n !== nR) return;                                 // une frappe plus récente l'emporte
      const ecr = re.ok ? re.d.ecrits.slice(0, 8) : [], aut = ra.ok ? ra.d.auteurs : [];
      const z = $('#resServeur'); if (!z) return;
      z.innerHTML = `${aut.length ? `<section><div class="sx-h"><h2>Auteurs</h2><span class="sx-compte">${aut.length}</span></div><div class="sx-liste">${aut.map((a) => ligneAuteur(a.id, a.nom, a.ville)).join('')}</div></section>` : ''}
        ${ecr.length ? `<section><div class="sx-h"><h2>Écrits</h2><span class="sx-compte">${ecr.length}</span></div><div class="sx-fil" id="filR">${ecr.map((e) => E.carte(e)).join('')}</div></section>` : ''}
        ${!aut.length && !ecr.length ? '' : ''}`;
      if (ecr.length) E.brancher($('#filR'), (id) => ecr.find((e) => e.id === id));
    }
    q.addEventListener('input', () => { clearTimeout(tR); tR = setTimeout(chercher, 220); });
    q.addEventListener('search', () => { garder(q.value); q.blur(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { garder(q.value); q.blur(); } });
    res.addEventListener('click', (e) => { if (e.target.closest('a')) garder(q.value); });
    $('#annuler').addEventListener('click', () => { q.value = ''; cat = ''; q.blur(); montrer('livres'); chercher(); });
    accueil.addEventListener('click', (e) => {
      const rec = e.target.closest('[data-recente]'), ou = e.target.closest('[data-oublier]'), c = e.target.closest('[data-cat]');
      if (ou) { oublier(ou.dataset.oublier); peindreAccueil(); return; }
      if (rec) { q.value = rec.dataset.recente; chercher(); return; }
      if (c) { cat = c.dataset.cat; chercher(); scrollTo(0, 0); return; }
      if (e.target.closest('#toutEffacer')) { oublier(null); peindreAccueil(); return; }
      if (e.target.closest('[data-tout]')) { cat = ''; q.value = ''; res.hidden = false; accueil.hidden = true; nR++; res.innerHTML = `<section><div class="sx-h"><h2>Tous les livres</h2><span class="sx-compte">${autres.length}</span></div><div class="sx-tuiles">${autres.map(tuile).join('')}</div></section>`; }
    });

    /* les écrits : du serveur, par nature, page après page */
    let ecrits = [], suite = null, nature = '', charge = false;
    async function chargerEcrits(neuf) {
      if (charge) return; charge = true;
      const fil = $('#fil');
      if (neuf) { ecrits = []; suite = null; fil.innerHTML = '<p class="sx-chapeau"><span class="spin" aria-hidden="true"></span> Chargement des écrits…</p>'; }
      const r = await window.SOZO_API('GET', `/api/ecrits?${new URLSearchParams({ ...(nature ? { nature } : {}), ...(suite ? { avant: suite } : {}) })}`);
      charge = false;
      if (!r.ok) { fil.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Les écrits n’ont pas pu se charger.')}</span></p>`; return; }
      ecrits = ecrits.concat(r.d.ecrits); suite = r.d.suite;
      fil.innerHTML = ecrits.length ? ecrits.map((e) => E.carte(e)).join('') : `<div class="sx-vide">${S.PLUME_OR}<strong>Aucun écrit ici pour l’instant</strong>Le premier peut être le vôtre.<a class="sx-btn sx-btn--plein" href="ecrits.html?nouveau=${nature || 'pensee'}">${S.icon('feather')}Écrire</a></div>`;
      $('#plus').hidden = !suite;
    }
    E.brancher($('#fil'), (id) => ecrits.find((e) => e.id === id));
    $('#plus').addEventListener('click', () => chargerEcrits(false));
    $$('[data-nature]').forEach((c) => c.addEventListener('click', () => { nature = c.dataset.nature; $$('[data-nature]').forEach((x) => x.classList.toggle('is-on', x === c)); chargerEcrits(true); }));
    function montrer(v) {
      vue = v;
      $$('[data-vue]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vue === v)));
      $('#vueEcrits').hidden = v !== 'ecrits';
      history.replaceState(null, '', v === 'ecrits' ? 'explorer.html?vue=ecrits' : 'explorer.html');
      if (v === 'ecrits' && !ecrits.length) chargerEcrits(true);
      chercher();
    }
    $$('[data-vue]').forEach((b) => b.addEventListener('click', () => montrer(b.dataset.vue)));
    if (S.q('q')) q.value = S.q('q');
    montrer(vue0);
    document.title = 'Rechercher — Sōzō';
    /* le clavier prêt à taper, comme si l'on avait touché le champ (pas sur
       la vue Écrits ni une catégorie demandée : on vient y lire) */
    const prete = () => { if (vue === 'livres' && !cat && !S.q('q')) { try { q.focus({ preventScroll: true }); } catch (e) {} } };
    if (document.prerendering) document.addEventListener('prerenderingchange', prete, { once: true }); else setTimeout(prete, 30);
    addEventListener('pageshow', (e) => { if (e.persisted) prete(); });
  }
}).catch(window.SOZO_ERREUR);
