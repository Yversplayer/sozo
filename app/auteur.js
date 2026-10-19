/* Sōzō — page d'un auteur : portrait entouré à la plume, livres, calendrier. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('explorer');
  const main = $('#main');
  const id = S.q('id') || '';
  if (!D.authors[id]) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Auteur introuvable</strong><br><a class="btn" href="decouvrir.html">Retour</a></div></div>`;
    S.footer(); return;
  }
  const a = S.author(id), books = S.booksBy(id);
  document.title = `${a.name} — Sōzō`;
  const BANNERS = ['lib-librairie', 'livres-fenetre', 'lib-vieux-livres', 'tasse-fenetre', 'lib-boutique', 'couv-pages', 'lib-etageres'];
  const banner = BANNERS[Object.keys(D.authors).indexOf(id) % BANNERS.length];
  const pubs = books.reduce((n, b) => n + S.stats(b).published, 0);
  const up = [];
  books.forEach((b) => {
    const g = {};
    b.pages.filter((p) => S.access(b, p.n) === 'soon').forEach((p) => (g[p.date] = g[p.date] || []).push(p.n));
    Object.entries(g).forEach(([d, ns]) => up.push({ b, d, ns }));
  });
  up.sort((x, y) => S.parse(x.d) - S.parse(y.d));
  const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const allFollowed = () => books.every((b) => S.isFollowed(b.id));

  main.innerHTML = `
  <div class="au-hero"><img src="${S.img(banner)}" alt=""></div>
  <div class="wrap">
    <div class="au-head">
      <div class="au-big"><img src="${S.img(a.photo, true)}" alt="Portrait d'illustration de ${S.esc(a.name)}"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M58,5 C84,8 98,28 96,54 C94,82 72,97 46,95 C20,93 3,74 5,47 C7,22 26,4 52,4 C64,4 72,7 78,12"/></svg></div>
      <div>
        <p class="kicker">Auteur · ${S.esc(a.city)} · sur Sōzō depuis ${S.esc(a.since)}</p>
        <h1 data-ink-text="${S.esc(a.name)}"></h1>
        <div class="au-stats"><span><b>${books.length}</b> livre${books.length > 1 ? 's' : ''}</span><span><b>${pubs}</b> pages publiées</span><span><b>${a.followers.toLocaleString('fr-FR')}</b> lecteur${a.followers > 1 ? 's' : ''}</span></div>
      </div>
      <button class="btn" type="button" id="followAll"></button>
    </div>
    <section class="sec" style="padding-top:44px">
      <div class="cols">
        <div>
          <p class="hero-lead" style="font-size:21px;color:var(--ink)">${S.esc(a.bio)}</p>
          <div class="sec-head" style="margin-top:34px"><h2 class="sec-title" data-ink-text="Ses [[livres]]"></h2></div>
          <div class="grid">${books.map((b) => S.bookCard(b)).join('')}</div>
        </div>
        <div class="panel">
          <h2 data-ink-text="Prochaines [[parutions]]"></h2>
          ${up.length ? `<div class="cal">${up.slice(0, 6).map(({ b, d, ns }) => { const dt = S.parse(d); return `<a class="cal-row" href="livre.html?id=${b.id}"><div class="cal-day"><b>${dt.getDate()}</b><span>${MO[dt.getMonth()]}</span></div><div>${S.esc(b.title)}<small>${S.esc(S.pagesRange(ns))} · ${dt.getHours()} h</small></div></a>`; }).join('')}</div>`
            : `<p class="ash">Aucune page programmée pour l'instant.</p>`}
          <p class="note">${S.icon('clock')} Seules les dates sont visibles : le contenu reste fermé jusqu'à la parution.</p>
        </div>
      </div>
    </section>
  </div>`;
  const fa = $('#followAll');
  const sync = () => { const on = allFollowed(); fa.innerHTML = `${S.icon(on ? 'check' : 'heart')} ${on ? 'Vous suivez ses livres' : 'Suivre ses livres'}`; fa.classList.toggle('is-on', on); fa.setAttribute('aria-pressed', String(on)); };
  fa.addEventListener('click', async () => {
    const on = allFollowed();
    fa.disabled = true;
    for (const b of books) { if (S.isFollowed(b.id) === on) await S.toggleFollow(b.id); }
    fa.disabled = false;
    sync(); S.toast(on ? `Vous ne suivez plus les livres de ${a.name}.` : `Les livres de ${a.name} sont dans vos suivis.`);
  });
  sync();
  S.inkAll(); S.reveals(); S.footer();
}).catch(window.SOZO_ERREUR);
