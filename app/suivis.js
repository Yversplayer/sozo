/* Sōzō — mes suivis : notifications de parution + livres suivis et progression. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  const notifs = S.notifications();
  const seen = (() => { try { return +localStorage.getItem('sozo-notif-vues') || 0; } catch (e) { return 0; } })();
  S.shell('suivis');
  const main = $('#main');

  function render() {
    const fol = S.follows().map((id) => S.book(id)).filter(Boolean);
    const upcoming = [];
    fol.forEach((b) => { const st = S.stats(b); if (st.next) upcoming.push({ b, st }); });
    upcoming.sort((x, y) => S.parse(x.st.next.date) - S.parse(y.st.next.date));
    const ago = (iso) => { const d = -S.relDays(iso); return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`; };

    main.innerHTML = `<div class="wrap">
      <section class="sec" style="padding-top:44px">
        <p class="kicker">Lecteur de démonstration</p>
        <h1 class="sec-title" style="font-size:clamp(36px,4.6vw,62px)" data-ink-text="Mes [[suivis]]"></h1>
      </section>
      <section class="sec" id="notifications" style="padding-top:34px">
        <div class="cols">
          <div class="panel">
            <div class="sec-head" style="margin-bottom:10px"><h2 style="margin:0">Notifications</h2>
              ${notifs.length ? `<button class="btn btn--ghost btn--sm" type="button" id="markAll">Tout marquer comme lu</button>` : ''}</div>
            ${notifs.length ? `<div class="notifs">${notifs.map((x) => {
              const isNew = S.parse(x.date).getTime() > seen;
              const first = x.pages[0];
              return `<a class="nt${isNew ? ' is-new' : ''}" href="lire.html?id=${x.book.id}&p=${first}">
                <span class="nt-ic">${S.icon('bell')}</span>
                <span><strong>${S.esc(S.pagesRange(x.pages).replace(/^p/, 'P'))} — ${S.esc(x.book.title)}</strong>
                <p>${S.esc(S.author(x.book.author).name)} · ${x.pages.every((n) => S.readable(S.access(x.book, n))) ? 'à lire maintenant' : 'payante — prix affiché sur la page'}</p></span>
                <time datetime="${x.date}">${isNew ? '<span class="dot">Nouveau</span> ' : ''}${ago(x.date)}</time></a>`;
            }).join('')}</div>`
            : `<div class="empty"><strong>Rien de nouveau</strong>Les pages des livres que vous suivez apparaîtront ici à leur parution.</div>`}
            <p class="note">${S.icon('bell')} Notifications affichées dans l'application. L'envoi par e-mail ou push n'est pas encore branché.</p>
          </div>
          <div class="panel">
            <h2 data-ink-text="À [[venir]]"></h2>
            ${upcoming.length ? `<div class="cal">${upcoming.map(({ b, st }) => { const dt = S.parse(st.next.date); return `<a class="cal-row" href="livre.html?id=${b.id}"><div class="cal-day"><b>${dt.getDate()}</b><span>${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][dt.getMonth()]}</span></div><div>${S.esc(b.title)}<small>${S.esc(S.pagesRange(st.next.pages))} · ${dt.getHours()} h</small></div></a>`; }).join('')}</div>`
              : `<p class="ash">Aucune parution programmée dans vos livres suivis.</p>`}
          </div>
        </div>
      </section>
      <section class="sec" id="livres" style="padding-top:40px">
        <div class="sec-head"><h2 class="sec-title" data-ink-text="Livres [[suivis]]"></h2><span class="mono ash">${fol.length} livre${fol.length > 1 ? 's' : ''}</span></div>
        ${fol.length ? `<div class="follow-list">${fol.map((b) => {
          const st = S.stats(b), vis = S.visiblePages(b), pub = vis.filter((p) => S.access(b, p.n) !== 'soon');
          const read = D.reader.progress[b.id] || 0, pct = pub.length ? Math.round((Math.min(read, pub.length) / pub.length) * 100) : 0;
          const resume = vis.find((p) => p.n === read) ? read : (vis[0] && vis[0].n);
          return `<div class="fl-row">
            <a href="livre.html?id=${b.id}" aria-label="${S.esc(b.title)}">${S.cover(b, { d3: false })}</a>
            <div><h3>${S.esc(b.title)}</h3><p>${S.esc(S.author(b.author).name)} · ${S.esc(b.cat)} · <span class="badge badge--${b.access}">${S.accessLabel(b)}</span></p>
              <div class="prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression"><i style="width:${pct}%"></i></div>
              <p>${read ? `Lu jusqu'à la page ${read} — ${pub.length} pages parues` : `${pub.length} pages parues`}${st.next ? ` · <span style="color:var(--ver-text)">page ${st.next.pages[0]} le ${S.esc(S.dateLong(st.next.date))}</span>` : ' · livre complet'}</p></div>
            <div class="fl-act"><a class="btn btn--sm" href="lire.html?id=${b.id}&p=${resume}">${read ? 'Reprendre' : 'Commencer'} ${S.icon('right')}</a>
              <button class="btn btn--ghost btn--sm" type="button" data-unf="${b.id}">Ne plus suivre</button></div>
          </div>`;
        }).join('')}</div>`
        : `<div class="empty"><strong>Vous ne suivez aucun livre</strong>Suivez un livre pour voir ses nouvelles pages ici.<br><br><a class="btn" href="decouvrir.html#catalogue">Parcourir le catalogue</a></div>`}
      </section>
    </div>`;
    document.querySelectorAll('[data-unf]').forEach((x) => x.addEventListener('click', async () => { x.disabled = true; if (!(await S.toggleFollow(x.dataset.unf))) S.toast('Vous ne suivez plus ce livre.'); render(); }));
    const m = $('#markAll');
    if (m) m.addEventListener('click', () => { S.markSeen(); location.reload(); });
    S.inkAll();
  }
  render();
  S.footer();
}).catch(window.SOZO_ERREUR);
