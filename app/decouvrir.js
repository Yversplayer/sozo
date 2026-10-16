/* Sōzō — Découvrir : héros, catégories, parutions à venir, catalogue, auteurs. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('decouvrir');
  const main = $('#main');
  const books = D.books;
  const now = S.now();

  /* nouvelles pages publiées ces 7 derniers jours (tous livres) */
  let fresh = 0;
  books.forEach((b) => b.pages.forEach((p) => { if (S.status(p) === 'published' && p.date && S.relDays(p.date) <= 0 && S.relDays(p.date) >= -7) fresh++; }));

  const cats = [
    ['Roman', 'Des vies entières', 'lectrice-canape', 'book'], ['Poésie', 'Un poème par semaine', 'cat-poesie', 'feather'],
    ['Polar', 'Une page, un indice', 'couv-fenetre-rouge', 'search'], ['Jeunesse', 'À lire ensemble', 'cat-jeunesse', 'star'],
    ['Foi', 'Des mots pour l’âme', 'foi-bougie', 'heart'], ['Manga', 'Chapitre par chapitre', 'couv-capuche', 'spark']
  ];
  const faces = ['foi-priere-bordeaux', 'portrait-sourire', 'portrait-boucles', 'portrait-jeune-homme', 'autrice-ordinateur', 'portrait-bureau'];

  /* prochaine parution de chaque livre (date seulement : jamais le contenu) */
  const soon = books.map((b) => ({ b, st: S.stats(b) })).filter((x) => x.st.next).sort((x, y) => S.parse(x.st.next.date) - S.parse(y.st.next.date));
  const countdown = (iso) => {
    const ms = Math.max(0, S.parse(iso) - S.now());
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    return `<b>${d} j</b><b>${h} h</b><b>${String(m).padStart(2, '0')} min</b>`;
  };

  main.innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <p class="kicker">Découvrir · lire · suivre</p>
      <h1 data-ink-text="Des histoires qui paraissent [[à leur rythme]]."></h1>
      <p class="hero-lead">Lisez ce qui est offert, n'achetez que ce que vous voulez, et sachez toujours quand arrive la page suivante.</p>
      <div class="hero-actions">
        <a class="btn" href="#catalogue">Explorer le catalogue ${S.icon('right')}</a>
        <a class="btn btn--ghost" href="suivis.html">Mes suivis</a>
      </div>
      <div class="hero-proof">
        <span class="faces">${faces.map((f) => `<img src="${S.img(f, true)}" alt="">`).join('')}</span>
        <p><strong>${Object.keys(D.authors).length} auteurs, ${books.length} livres</strong><br>tous fictifs, pour la démonstration</p>
      </div>
    </div>
    <div class="hero-art">
      <img src="${S.img('foi-priere-lumiere')}" alt="Une femme recueillie dans la lumière d'une fenêtre">
      <div class="stack3d" aria-hidden="true">${[books[3], books[1], books[0]].map((b) => S.cover(b, { big: true })).join('')}</div>
      <div class="seal"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M58,5 C84,8 98,28 96,54 C94,82 72,97 46,95 C20,93 3,74 5,47 C7,22 26,4 52,4 C64,4 72,7 78,12"/></svg><div><strong>${fresh}</strong><span>pages parues<br>cette semaine</span></div></div>
    </div>
  </section>

  <div class="wrap">
    <ul class="promises">
      <li>${S.icon('gift')}<div><strong>Pages gratuites</strong><span>Ce qui est offert se lit librement</span></div></li>
      <li>${S.icon('tag')}<div><strong>Prix avant achat</strong><span>Page, chapitre ou livre entier</span></div></li>
      <li>${S.icon('shield')}<div><strong>Droits conservés</strong><span>Une page payée reste à vous</span></div></li>
      <li>${S.icon('calendar')}<div><strong>Dates annoncées</strong><span>Jamais de contenu en avance</span></div></li>
    </ul>

    <section class="sec">
      <div class="sec-head"><div><p class="kicker">Parcourir par catégorie</p><h2 class="sec-title" data-ink-text="Trouvez votre [[prochaine lecture]]"></h2></div>
        <a class="sec-link" href="#catalogue">Tout le catalogue ${S.icon('right')}</a></div>
      <div class="cats">${cats.map(([n, h, im, ic], i) => `
        <button class="cat rv" style="--d:${i}" type="button" data-cat="${n}" aria-pressed="false">
          <img src="${S.img(im, true)}" alt="" loading="lazy"><span class="cat-ic">${S.icon(ic)}</span><strong>${n}</strong><small>${h}</small></button>`).join('')}
      </div>
    </section>

    <section class="sec">
      <div class="sec-head"><div><p class="kicker">Calendrier des auteurs</p><h2 class="sec-title" data-ink-text="Paraît [[bientôt]]"></h2></div>
        <span class="mono ash">Seule la date est visible avant la parution</span></div>
      <div class="rail">${soon.map(({ b, st }) => `
        <a class="soon-card" href="livre.html?id=${b.id}">
          ${S.cover(b, { d3: false })}
          <div><span class="soon-when">${S.icon('clock')} ${S.esc(S.dateLong(st.next.date))}</span>
            <strong>${S.esc(b.title)}</strong><span>${S.esc(S.pagesRange(st.next.pages).replace(/^p/, 'P'))} · ${S.esc(S.author(b.author).name)}</span>
            <span class="count" data-cd="${st.next.date}">${countdown(st.next.date)}</span></div>
        </a>`).join('')}</div>
    </section>

    <section class="sec" id="catalogue">
      <div class="sec-head"><div><p class="kicker">Catalogue</p><h2 class="sec-title" data-ink-text="Tous les [[livres]]"></h2></div></div>
      <div class="finder">
        <label class="search"><span class="sr">Rechercher un titre, un auteur, une catégorie</span>${S.icon('search')}
          <input type="search" id="q" placeholder="Rechercher un titre, un auteur, une catégorie…" autocomplete="off"></label>
        <div class="filters" role="group" aria-label="Filtres">
          <span class="mono ash">Accès</span>
          ${[['', 'Tous'], ['free', 'Gratuit'], ['paid', 'Payant'], ['mixed', 'Mixte']].map(([v, l]) => `<button class="chip" type="button" data-access="${v}" aria-pressed="${v === '' ? 'true' : 'false'}">${l}</button>`).join('')}
          <span class="sep" aria-hidden="true"></span>
          <span class="mono ash">Parution</span>
          ${[['', 'Toutes'], ['live', 'En cours'], ['done', 'Complet']].map(([v, l]) => `<button class="chip" type="button" data-run="${v}" aria-pressed="${v === '' ? 'true' : 'false'}">${l}</button>`).join('')}
          <label class="sr" for="sort">Trier</label>
          <select id="sort"><option value="new">Dernières parutions</option><option value="title">Titre A → Z</option><option value="price">Prix croissant</option></select>
        </div>
      </div>
      <p class="results-meta" id="meta" aria-live="polite"></p>
      <div class="grid" id="grid"></div>
    </section>

    <section class="sec">
      <div class="sec-head"><div><p class="kicker">Ils écrivent sur Sōzō</p><h2 class="sec-title" data-ink-text="Les [[auteurs]]"></h2></div><span class="mono ash">Auteurs fictifs · photos d'illustration</span></div>
      <div class="authors">${Object.entries(D.authors).map(([id, a], i) => `
        <a class="au rv" style="--d:${i % 6}" href="auteur.html?id=${id}">
          <span class="au-ph"><img src="${S.img(a.photo, true)}" alt="" loading="lazy"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M58,5 C84,8 98,28 96,54 C94,82 72,97 46,95 C20,93 3,74 5,47 C7,22 26,4 52,4 C64,4 72,7 78,12"/></svg></span>
          <strong>${S.esc(a.name)}</strong><span>${S.esc(a.city)} · ${S.booksBy(id).length} livre${S.booksBy(id).length > 1 ? 's' : ''}</span></a>`).join('')}</div>
    </section>

    <section class="band">
      <div class="band-in on-dark">
        <div class="band-copy">
          <p class="kicker">Suivre un livre</p>
          <h2 data-ink-text="Une page paraît, [[vous le savez]]."></h2>
          <p>Suivez un livre : chaque nouvelle page apparaît dans vos notifications, avec sa date. L'envoi par e-mail ou push viendra avec le serveur.</p>
          <a class="btn" href="suivis.html">Voir mes suivis ${S.icon('right')}</a>
        </div>
        <img src="${S.img('cafe-lunettes')}" alt="Un livre ouvert, des lunettes et un café" loading="lazy">
      </div>
      <ul class="trust">
        <li>${S.icon('pen')} Des auteurs indépendants</li>
        <li>${S.icon('tag')} Des prix fixés par l'auteur</li>
        <li>${S.icon('shield')} Vos achats ne disparaissent pas</li>
        <li>${S.icon('eyeOff')} Aucun PDF téléchargeable</li>
      </ul>
    </section>
  </div>`;

  /* ─── catalogue : recherche + filtres, tout côté client (données de démo) ─── */
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const state = { q: '', access: '', run: '', cat: S.q('cat') || '', sort: 'new' };
  const lastDate = (b) => Math.max(...b.pages.filter((p) => S.status(p) === 'published' && p.date).map((p) => +S.parse(p.date)), 0);
  function render() {
    const q = norm(state.q.trim());
    let list = books.filter((b) => {
      const st = S.stats(b);
      if (state.access && b.access !== state.access) return false;
      if (state.run === 'live' && !(st.scheduled || st.draft)) return false;
      if (state.run === 'done' && (st.scheduled || st.draft)) return false;
      if (state.cat && b.cat !== state.cat && !(state.cat === 'Manga' && b.cat === 'Roman graphique')) return false;
      if (q && !norm([b.title, S.author(b.author).name, b.cat, b.desc].join(' ')).includes(q)) return false;
      return true;
    });
    if (state.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    else if (state.sort === 'price') list.sort((a, b) => (S.priceFrom(a) ?? 0) - (S.priceFrom(b) ?? 0));
    else list.sort((a, b) => lastDate(b) - lastDate(a));
    $('#meta').textContent = `${list.length} livre${list.length > 1 ? 's' : ''}${state.cat ? ` · ${state.cat}` : ''}${state.q ? ` · « ${state.q} »` : ''}`;
    $('#grid').innerHTML = list.length ? list.map((b) => S.bookCard(b)).join('')
      : `<div class="empty" style="grid-column:1/-1"><strong>Aucun livre ne correspond</strong>Essayez un autre mot, ou retirez un filtre.<br><br><button class="btn btn--ghost btn--sm" type="button" id="reset">Tout afficher</button></div>`;
    const r = $('#reset'); if (r) r.addEventListener('click', reset);
    document.querySelectorAll('.cat').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === state.cat)));
  }
  function reset() {
    Object.assign(state, { q: '', access: '', run: '', cat: '' }); $('#q').value = '';
    document.querySelectorAll('[data-access],[data-run]').forEach((c) => c.setAttribute('aria-pressed', String((c.dataset.access ?? c.dataset.run) === '')));
    render();
  }
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  document.querySelectorAll('[data-access]').forEach((c) => c.addEventListener('click', () => {
    state.access = c.dataset.access; document.querySelectorAll('[data-access]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render();
  }));
  document.querySelectorAll('[data-run]').forEach((c) => c.addEventListener('click', () => {
    state.run = c.dataset.run; document.querySelectorAll('[data-run]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); render();
  }));
  document.querySelectorAll('.cat').forEach((c) => c.addEventListener('click', () => {
    state.cat = state.cat === c.dataset.cat ? '' : c.dataset.cat; render();
    $('#catalogue').scrollIntoView({ behavior: S.reduced ? 'auto' : 'smooth', block: 'start' });
  }));
  render();

  /* décomptes : mis à jour chaque minute, sans jamais révéler de contenu */
  setInterval(() => document.querySelectorAll('[data-cd]').forEach((el) => { el.innerHTML = countdown(el.dataset.cd); }), 60000);

  S.inkAll(); S.prepAll(); S.reveals(); S.footer();
  if (location.hash === '#catalogue' || S.q('cat')) setTimeout(() => $('#catalogue').scrollIntoView(), 50);
}).catch(window.SOZO_ERREUR);
