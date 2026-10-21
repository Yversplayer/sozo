/* Sōzō — Explorer : tout le catalogue. Les catégories affichées sont celles
   qui ont VRAIMENT des livres (19/10/2026 : plus de tuile vide), avec leur
   nombre ; recherche par titre, auteur, thème ; filtres d'accès et de parution. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  S.shell('explorer');
  const main = $('#main');
  const books = D.books;
  // 21/10/2026 : plus de photo ; une tuile de velours et son signe, comme sur l'image du propriétaire
  const ICONE = { Foi: 'croix', Spiritualité: 'spark', Poésie: 'feather', Prière: 'heart', Méditation: 'sun', Louange: 'star', Témoignage: 'bulle',
    Recueil: 'library', Récit: 'book', Conte: 'moon' };
  const E = window.SOZO_ECRITS;
  const compte = {};
  books.forEach((b) => { compte[b.cat] = (compte[b.cat] || 0) + 1; });
  const cats = Object.keys(compte).sort((x, y) => compte[y] - compte[x] || x.localeCompare(y, 'fr'));

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
    <section class="ex-tete">
      <label class="search ex-cherche"><span class="sr">Rechercher un titre, un auteur, un thème</span>${S.icon('search')}
        <input type="search" id="q" placeholder="Rechercher un livre, un écrit, un auteur…" autocomplete="off"></label>
      ${cats.length ? `<div class="ex-cats" role="group" aria-label="Catégories"><button class="chip ex-cat" type="button" data-cat="" aria-pressed="true">Toutes <small>${books.length}</small></button>${cats.map((c) => `<button class="chip ex-cat" type="button" data-cat="${S.esc(c)}" aria-pressed="false">${S.esc(c)} <small>${compte[c]}</small></button>`).join('')}</div>
      <div class="vl-tuiles">${cats.slice(0, 6).map((c) => `<button type="button" class="vl-tuile vl-velours" data-cat="${S.esc(c)}">${S.icon(ICONE[c] || 'book')}<strong>${S.esc(c)}</strong><small>${compte[c]} livre${compte[c] > 1 ? 's' : ''}</small></button>`).join('')}</div>` : ''}
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
  $$('.ex-cat, .vl-tuile').forEach((c) => c.addEventListener('click', () => {
    state.cat = c.dataset.cat; render();
    if (c.classList.contains('vl-tuile')) $('#catalogue').scrollIntoView({ behavior: S.reduced ? 'auto' : 'smooth' });
  }));
  render();
  if (state.q) rechercher(state.q);
  S.inkAll(); S.prepAll(); S.reveals(); S.footer();
  if (location.hash === '#q') setTimeout(() => $('#q').focus(), 60);
  else if (S.q('cat')) setTimeout(() => $('#catalogue').scrollIntoView(), 60);
}).catch(window.SOZO_ERREUR);
