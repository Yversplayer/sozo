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
      <p class="kicker">Explorer</p>
      <h1 class="sec-title" data-ink-text="Trouvez votre [[prochaine lecture]]"></h1>
      <label class="search"><span class="sr">Rechercher un titre, un auteur, un thème</span>${S.icon('search')}
        <input type="search" id="q" placeholder="Rechercher un titre, un auteur, un thème…" autocomplete="off"></label>
    </section>
    ${cats.length ? `<section class="sec ex-sec" aria-label="Catégories"><div class="cats cats--ex">${cats.map((c, i) => `
      <button class="cat rv" style="--d:${i % 6}" type="button" data-cat="${S.esc(c)}" aria-pressed="false">
        <img src="${S.img(PHOTO[c] || 'lib-vieux-livres', true)}" alt="" loading="lazy"><span class="cat-ic">${S.icon(ICONE[c] || 'book')}</span><strong>${S.esc(c)}</strong><small>${compte[c]} livre${compte[c] > 1 ? 's' : ''}</small></button>`).join('')}
    </div></section>` : ''}
    <section class="sec ex-sec" id="catalogue">
      <div class="filters" role="group" aria-label="Filtres">
        <span class="mono ash">Accès</span>
        ${[['', 'Tous'], ['free', 'Gratuit'], ['paid', 'Payant'], ['mixed', 'Mixte']].map(([v, l]) => `<button class="chip" type="button" data-access="${v}" aria-pressed="${v === '' ? 'true' : 'false'}">${l}</button>`).join('')}
        <span class="sep" aria-hidden="true"></span>
        <span class="mono ash">Parution</span>
        ${[['', 'Toutes'], ['live', 'En cours'], ['done', 'Complet']].map(([v, l]) => `<button class="chip" type="button" data-run="${v}" aria-pressed="${v === '' ? 'true' : 'false'}">${l}</button>`).join('')}
        <label class="sr" for="sort">Trier</label>
        <select id="sort"><option value="new">Dernières parutions</option><option value="title">Titre A → Z</option><option value="price">Prix croissant</option></select>
      </div>
      <p class="results-meta" id="meta" aria-live="polite"></p>
      <div class="grid" id="grid"></div>
    </section>
    <section class="sec">
      <div class="sec-head"><div><p class="kicker">Ils écrivent sur Sōzō</p><h2 class="sec-title" data-ink-text="Les [[auteurs]]"></h2></div></div>
      <div class="authors">${Object.keys(D.authors).length ? '' : `<div class="empty" style="grid-column:1/-1"><strong>Aucun auteur pour l’instant</strong>Le vôtre peut être le premier nom ici. <a href="studio.html">Ouvrir mon atelier</a></div>`}${Object.entries(D.authors).map(([id, a], i) => `
        <a class="au rv" style="--d:${i % 6}" href="auteur.html?id=${encodeURIComponent(id)}">
          <span class="au-ph"><img src="${S.img(a.photo, true)}" alt="" loading="lazy"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M58,5 C84,8 98,28 96,54 C94,82 72,97 46,95 C20,93 3,74 5,47 C7,22 26,4 52,4 C64,4 72,7 78,12"/></svg></span>
          <strong>${S.esc(a.name)}</strong><span>${S.esc(a.city)} · ${S.booksBy(id).length} livre${S.booksBy(id).length > 1 ? 's' : ''}</span></a>`).join('')}</div>
    </section>
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
    $$('.cat').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === state.cat)));
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
  $$('.cat').forEach((c) => c.addEventListener('click', () => {
    state.cat = state.cat === c.dataset.cat ? '' : c.dataset.cat; render();
    $('#catalogue').scrollIntoView({ behavior: S.reduced ? 'auto' : 'smooth', block: 'start' });
  }));
  render();
  S.inkAll(); S.prepAll(); S.reveals(); S.footer();
  if (location.hash === '#q') setTimeout(() => $('#q').focus(), 60);
  else if (S.q('cat')) setTimeout(() => $('#catalogue').scrollIntoView(), 60);
}).catch(window.SOZO_ERREUR);
