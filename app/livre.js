/* Sōzō — fiche d'un livre : couverture 3D, état de chaque page, prix, calendrier. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('decouvrir');
  const main = $('#main');
  const b = S.book(S.q('id') || '');
  if (!b) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Ce livre n'existe pas</strong>Il a peut-être été retiré, ou le lien est incomplet.<br><br><a class="btn" href="decouvrir.html">Retour au catalogue</a></div></div>`;
    S.footer(); return;
  }
  document.title = `${b.title} — Sōzō`;
  const a = S.author(b.author), st = S.stats(b), owned = D.reader.purchases[b.id];
  const visible = S.visiblePages(b);
  const firstReadable = visible.find((p) => S.readable(S.access(b, p.n)));
  const prog = D.reader.progress[b.id];
  const opts = S.buy.options(b, null);
  const allOpt = opts.find((o) => o.k === 'all');

  const label = (n) => {
    const s = S.access(b, n), p = b.pages.find((x) => x.n === n);
    if (s === 'free') return ['Gratuite', 'free', `Publiée le ${S.dateShort(p.date)}`];
    if (s === 'owned') return ['Achetée', 'owned', `Achetée le ${S.dateShort(owned.date + 'T12:00')}`];
    if (s === 'locked') return [b.price.page != null ? S.money(b.price.page) : 'Payante', 'locked', b.price.page != null ? 'À l’unité, ou avec son chapitre' : 'Vendue avec son chapitre ou le livre'];
    if (s === 'soon') return ['À venir', 'soon', `Disponible le ${S.dateLong(p.date)}`];
    return null;
  };
  const strip = visible.map((p) => {
    const s = S.access(b, p.n), cls = { free: 'st-free', owned: 'st-owned', locked: 'st-locked', soon: 'st-soon' }[s];
    return s === 'soon' ? `<span class="${cls}" title="Page ${p.n} — disponible le ${S.dateLong(p.date)}">${p.n}</span>`
      : `<a class="${cls}" href="lire.html?id=${b.id}&p=${p.n}" title="Page ${p.n} — ${label(p.n)[0]}">${p.n}</a>`;
  }).join('');
  const groups = {};
  b.pages.filter((p) => S.access(b, p.n) === 'soon').forEach((p) => (groups[p.date] = groups[p.date] || []).push(p.n));
  const upcoming = Object.entries(groups).sort((x, y) => S.parse(x[0]) - S.parse(y[0]));
  const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  main.innerHTML = `
  <section class="bk-hero on-dark" style="--cv:url('${S.img(b.cover.img)}')">
    <div class="bk-hero-bg" aria-hidden="true"></div>
    <div class="bk-hero-in">
      <div data-tilt>${S.cover(b, { big: true })}</div>
      <div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge badge--${b.access}">${S.accessLabel(b)}</span>
          <span class="badge badge--free">${S.esc(b.cat)}</span>
          <span class="badge badge--free">${b.mode === 'progressive' ? 'Parution progressive' : 'Publié en entier'}</span>
        </div>
        <h1 data-ink-text="${S.esc(b.title)}"></h1>
        <a class="bk-by" href="auteur.html?id=${a.id}"><img src="${S.img(a.photo, true)}" alt="">${S.esc(a.name)}</a>
        <p class="bk-desc">${S.esc(b.desc)}</p>
        <div class="bk-facts">
          <div><strong>${st.published}</strong><span>pages publiées</span></div>
          ${st.scheduled ? `<div><strong>${st.scheduled}</strong><span>pages à venir</span></div>` : ''}
          <div><strong>${S.priceFrom(b) == null ? 'Gratuit' : 'dès ' + S.money(S.priceFrom(b))}</strong><span>${b.access === 'mixed' ? `${st.free} page${st.free > 1 ? 's' : ''} offerte${st.free > 1 ? 's' : ''}` : b.access === 'free' ? 'tout le livre' : 'contenu payant'}</span></div>
          ${st.next ? `<div><strong>${S.dateShort(st.next.date)}</strong><span>prochaine page</span></div>` : ''}
        </div>
        <div class="bk-actions">
          ${firstReadable ? `<a class="btn btn--accent" href="lire.html?id=${b.id}&p=${prog && visible.some((p) => p.n === prog) ? prog : firstReadable.n}">${prog ? `Reprendre page ${prog}` : 'Commencer à lire'} ${S.icon('right')}</a>` : `<a class="btn btn--accent" href="lire.html?id=${b.id}&p=${visible[0].n}">Voir la première page ${S.icon('right')}</a>`}
          <button class="btn btn--ghost" type="button" id="follow"></button>
          ${allOpt && st.locked ? `<button class="btn btn--ghost" type="button" id="buyAll">Tout le contenu payant — ${S.money(allOpt.price)}</button>` : ''}
        </div>
      </div>
    </div>
  </section>

  <div class="wrap">
    <section class="sec" style="padding-top:40px">
      <p class="kicker">Les pages, une par une</p>
      <div class="strip" aria-label="État des pages">${strip}</div>
      <div class="legend">
        <span><i class="st-free"></i>Gratuite</span><span><i class="st-owned"></i>Achetée</span>
        <span><i class="st-locked"></i>Payante</span><span><i class="st-soon"></i>À venir — date seulement</span>
      </div>
    </section>

    <section class="sec" style="padding-top:40px">
      <div class="cols">
        <div class="panel">
          <h2 data-ink-text="Sommaire"></h2>
          ${b.chapters.map((c, i) => {
            const ps = visible.filter((p) => p.n >= c.from && p.n <= c.to);
            if (!ps.length) return '';
            return `<details class="chap"${i === 0 || ps.some((p) => p.n === prog) ? ' open' : ''}>
              <summary><span><strong>${S.esc(c.t)}</strong> <span class="mono ash">· ${S.pagesRange(ps.map((p) => p.n))}</span></span>${S.icon('chevron')}</summary>
              <div class="pl">${ps.map((p) => {
                const [t, k, sub] = label(p.n);
                const inner = `<span class="mono">Page ${p.n}</span><span>${S.esc(sub)}</span><span class="badge badge--${k}">${k === 'locked' ? S.icon('lock') : k === 'owned' ? S.icon('check') : k === 'soon' ? S.icon('clock') : ''}${S.esc(t)}</span>`;
                return k === 'soon' ? `<div class="pl-row">${inner}</div>` : `<a class="pl-row" href="lire.html?id=${b.id}&p=${p.n}">${inner}</a>`;
              }).join('')}</div></details>`;
          }).join('')}
          ${st.draft ? `<p class="note">${S.icon('eyeOff')} L'auteur prépare d'autres pages : elles n'apparaîtront qu'une fois programmées.</p>` : ''}
        </div>
        <div>
          <div class="panel">
            <h2 data-ink-text="${b.price ? 'Les [[prix]]' : 'Gratuit, [[en entier]]'}"></h2>
            ${b.price ? `<div class="price-box">
              ${b.price.page != null ? `<div class="price-opt"><span>Une page<br><small>à l'unité</small></span><strong>${S.money(b.price.page)}</strong></div>` : ''}
              ${b.price.chapter != null ? `<div class="price-opt"><span>Un chapitre<br><small>pages à venir comprises</small></span><strong>${S.money(b.price.chapter)}</strong></div>` : ''}
              ${b.price.all != null ? `<div class="price-opt"><span>Tout le contenu payant<br><small>${allOpt ? S.esc(allOpt.detail) : ''}</small></span><strong>${S.money(b.price.all)}</strong></div>` : ''}
            </div>
            ${owned ? `<p class="note">${S.icon('check')} Vous possédez ${S.esc(S.pagesRange(owned.pages))}, achetées le ${S.dateShort(owned.date + 'T12:00')}.</p>` : ''}
            <p class="note">${S.icon('tag')} Le prix s'affiche toujours avant l'achat. Ce que vous payez reste à vous.</p>`
            : `<p>Toutes les pages de ce livre se lisent librement${st.scheduled ? ', y compris celles qui paraîtront' : ''}.</p>`}
          </div>
          ${upcoming.length ? `<div class="panel"><h2 data-ink-text="Prochaines [[parutions]]"></h2><div class="cal">${upcoming.slice(0, 5).map(([d, ns]) => {
            const dt = S.parse(d);
            return `<div class="cal-row"><div class="cal-day"><b>${dt.getDate()}</b><span>${MO[dt.getMonth()]}</span></div><div>${S.esc(S.pagesRange(ns).replace(/^p/, 'P'))}<small>à ${dt.getHours()} h — contenu invisible jusque-là</small></div></div>`;
          }).join('')}</div></div>` : ''}
          <div class="panel">
            <a class="author-card" href="auteur.html?id=${a.id}"><img src="${S.img(a.photo, true)}" alt=""><div><strong>${S.esc(a.name)}</strong><span class="mono ash"> · ${S.esc(a.city)}</span><p>${S.esc(a.bio)}</p></div></a>
          </div>
        </div>
      </div>
    </section>

    ${(() => {
      const same = S.booksBy(a.id).filter((x) => x.id !== b.id);
      const cat = D.books.filter((x) => x.cat === b.cat && x.id !== b.id && x.author !== a.id);
      const more = same.length ? same : cat;
      if (!more.length) return '';
      return `<section class="sec"><div class="sec-head"><h2 class="sec-title" data-ink-text="${same.length ? `Du même [[auteur]]` : `Dans la même [[catégorie]]`}"></h2></div><div class="grid">${more.slice(0, 4).map((x) => S.bookCard(x)).join('')}</div></section>`;
    })()}
  </div>`;

  const fb = $('#follow');
  const syncF = () => {
    const on = S.isFollowed(b.id);
    fb.innerHTML = `${S.icon(on ? 'check' : 'heart')} ${on ? 'Suivi' : 'Suivre ce livre'}`;
    fb.setAttribute('aria-pressed', String(on));
  };
  fb.addEventListener('click', async () => {
    fb.disabled = true;
    const on = await S.toggleFollow(b.id); fb.disabled = false; syncF();
    S.toast(on ? 'Livre suivi — ses nouvelles pages apparaîtront dans vos notifications.' : 'Vous ne suivez plus ce livre.');
  });
  syncF();
  const ba = $('#buyAll');
  if (ba) ba.addEventListener('click', () => S.buy.recap(b, allOpt));

  S.inkAll(); S.tilt(); S.reveals(); S.footer();
}).catch(window.SOZO_ERREUR);
