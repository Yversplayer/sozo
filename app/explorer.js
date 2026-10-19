/* Sōzō — Explorer : tout le catalogue. Les catégories affichées sont celles
   qui ont VRAIMENT des livres (19/10/2026 : plus de tuile vide), avec leur
   nombre ; recherche par titre, auteur, thème ; filtres d'accès et de parution. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  S.shell('explorer');
  const main = $('#main');
  const books = D.books;
  const PHOTO = { Foi: 'foi-bougie', Spiritualité: 'foi-priere-lumiere', Poésie: 'cat-poesie', Roman: 'lectrice-canape', Jeunesse: 'cat-jeunesse', Essai: 'cat-essai',
    Histoire: 'cat-histoire', Biographie: 'lecteur-livre-rouge', 'Développement personnel': 'foi-aube-bras', Nouvelles: 'foi-bougies-rang', Recueil: 'foi-fleurs-sechees',
    Théâtre: 'lib-boutique', Polar: 'couv-fenetre-rouge', Manga: 'couv-capuche', Fantasy: 'couv-jardin', 'Roman graphique': 'couv-spirale' };
  const ICONE = { Foi: 'heart', Spiritualité: 'spark', Poésie: 'feather', Roman: 'book', Jeunesse: 'star', Essai: 'pen', Histoire: 'column', Biographie: 'user',
    'Développement personnel': 'sun', Nouvelles: 'file', Recueil: 'library', Théâtre: 'type', Polar: 'search', Manga: 'grid', Fantasy: 'moon', 'Roman graphique': 'grid' };
  const compte = {};
  books.forEach((b) => { compte[b.cat] = (compte[b.cat] || 0) + 1; });
  const cats = Object.keys(compte).sort((x, y) => compte[y] - compte[x] || x.localeCompare(y, 'fr'));

  main.innerHTML = `<div class="wrap ex">
    <section class="ex-tete">
      <h1 class="ex-titre">Explorer</h1>
      <label class="search ex-cherche"><span class="sr">Rechercher un titre, un auteur, un thème</span>${S.icon('search')}
        <input type="search" id="q" placeholder="Rechercher un titre, un auteur, un thème…" autocomplete="off"></label>
      ${cats.length ? `<div class="ex-cats" role="group" aria-label="Catégories"><button class="chip ex-cat" type="button" data-cat="" aria-pressed="true">Tout <small>${books.length}</small></button>${cats.map((c) => `<button class="chip ex-cat" type="button" data-cat="${S.esc(c)}" aria-pressed="false">${S.esc(c)} <small>${compte[c]}</small></button>`).join('')}</div>` : ''}
    </section>
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
        <a class="ex-au" href="auteur.html?id=${encodeURIComponent(id)}"><img src="${S.img(a.photo, true)}" alt="" loading="lazy"><strong>${S.esc(a.name)}</strong><small>${S.booksBy(id).length} livre${S.booksBy(id).length > 1 ? 's' : ''}</small></a>`).join('')}</div>
    </section>` : ''}
  </div>`;

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
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $$('[data-access]').forEach((c) => c.addEventListener('click', () => { state.access = c.dataset.access; $$('[data-access]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }));
  $$('[data-run]').forEach((c) => c.addEventListener('click', () => { state.run = c.dataset.run; $$('[data-run]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render(); }));
  $$('.ex-cat').forEach((c) => c.addEventListener('click', () => {
    state.cat = c.dataset.cat; render();
  }));
  render();
  S.inkAll(); S.prepAll(); S.reveals(); S.footer();
  if (location.hash === '#q') setTimeout(() => $('#q').focus(), 60);
  else if (S.q('cat')) setTimeout(() => $('#catalogue').scrollIntoView(), 60);
}).catch(window.SOZO_ERREUR);
