/* Sōzō — ma bibliothèque (19/10/2026, ex-« Mes suivis ») : trois onglets.
   En cours (livres suivis, progression, prochaines parutions), Épingles
   (passages gardés, sur tous les appareils), Notifications (venues du serveur :
   parutions, paiements, ventes, sécurité…). */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('suivis');
  const ICONES = { parution: 'book', paiement: 'tag', vente: 'star', reversement: 'send', plume: 'feather', moderation: 'shield', securite: 'lock', test: 'bell' };
  let notifs = [], epingles = null;
  const charger = async () => { const r = await window.SOZO_API('GET', '/api/notifications'); notifs = r.ok ? r.d.liste : null; };
  const chargerEpingles = async () => { const r = await window.SOZO_API('GET', '/api/epingles'); epingles = r.ok ? r.d.epingles : null; };
  await Promise.all([charger(), chargerEpingles()]);
  const ONGLETS = [['livres', 'En cours', 'book'], ['epingles', 'Épingles', 'tag'], ['notifications', 'Notifications', 'bell']];
  let onglet = (location.hash || '').slice(1);
  if (!ONGLETS.some(([k]) => k === onglet)) onglet = 'livres';
  const main = $('#main');

  function render() {
    const fol = S.follows().map((id) => S.book(id)).filter(Boolean);
    const upcoming = [];
    fol.forEach((b) => { const st = S.stats(b); if (st.next) upcoming.push({ b, st }); });
    upcoming.sort((x, y) => S.parse(x.st.next.date) - S.parse(y.st.next.date));
    const ago = (iso) => { const d = -S.relDays(iso); return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`; };

    const nonLues = notifs ? notifs.filter((x) => !x.lu_le).length : 0;
    main.innerHTML = `<div class="wrap">
      <section class="sec" style="padding-top:44px">
        <p class="kicker">Mon espace lecteur</p>
        <h1 class="sec-title" style="font-size:clamp(36px,4.6vw,62px)" data-ink-text="Ma [[bibliothèque]]"></h1>
        <div class="bi-onglets" role="tablist" aria-label="Ma bibliothèque">${ONGLETS.map(([k, l, ic]) => `<button type="button" role="tab" id="bi-${k}" aria-controls="biPanel" aria-selected="${onglet === k}" tabindex="${onglet === k ? 0 : -1}" data-bi="${k}">${S.icon(ic)} ${l}${k === 'notifications' && nonLues ? ` <span class="dot">${nonLues}</span>` : ''}${k === 'epingles' && epingles && epingles.length ? ` <span class="bi-n">${epingles.length}</span>` : ''}</button>`).join('')}</div>
      </section>
      <div id="biPanel" role="tabpanel" aria-labelledby="bi-${onglet}">
      <section class="sec" id="epingles" style="padding-top:28px"${onglet === 'epingles' ? '' : ' hidden'}>
        ${epingles === null ? `<p class="warn">${S.icon('x')}<span>Épingles indisponibles pour le moment.</span></p>`
          : epingles.length ? (() => { const par = {}; epingles.forEach((e) => (par[e.livre] = par[e.livre] || { titre: e.titre, l: [] }).l.push(e)); return Object.entries(par).map(([slug, g]) => `<div class="panel bi-pins">
              <h2>${S.esc(g.titre)}</h2>
              ${g.l.map((e) => `<div class="bi-pin"><blockquote>« ${S.esc(e.extrait)} »</blockquote><div class="row-acts"><a class="btn btn--ghost btn--sm" href="lire.html?id=${encodeURIComponent(slug)}&p=${e.n}">Page ${e.n} ${S.icon('right')}</a><button class="btn btn--ghost btn--sm" type="button" data-desep="${e.id}">Retirer</button></div></div>`).join('')}
            </div>`).join(''); })()
          : `<div class="empty"><strong>Aucune épingle pour l’instant</strong>Dans la liseuse, sélectionnez une phrase qui vous parle, puis touchez « Épingler ». Elle vous attendra ici, sur tous vos appareils.</div>`}
      </section>
      <section class="sec" id="notifications" style="padding-top:28px"${onglet === 'notifications' ? '' : ' hidden'}>
        <div class="cols">
          <div class="panel">
            <div class="sec-head" style="margin-bottom:10px"><h2 style="margin:0">Notifications</h2>
              ${notifs && notifs.some((x) => !x.lu_le) ? `<button class="btn btn--ghost btn--sm" type="button" id="markAll">Tout marquer comme lu</button>` : ''}</div>
            ${notifs === null ? `<p class="warn">${S.icon('x')}<span>Notifications indisponibles pour le moment.</span></p>`
              : notifs.length ? `<div class="notifs">${notifs.map((x) => `<a class="nt${x.lu_le ? '' : ' is-new'}" href="${S.esc(x.lien || '#')}" data-nid="${x.id}">
                <span class="nt-ic">${S.icon(ICONES[x.type] || 'bell')}</span>
                <span><strong>${S.esc(x.titre)}</strong><p>${S.esc(x.corps)}</p></span>
                <time datetime="${S.esc(x.created_at)}">${x.lu_le ? '' : '<span class="dot">Nouveau</span> '}${ago(x.created_at)}</time></a>`).join('')}</div>`
            : `<div class="empty"><strong>Rien de nouveau</strong>Parutions des livres suivis, paiements, ventes et alertes de sécurité apparaîtront ici.</div>`}
            <p class="note">${S.icon('bell')} Recevez-les aussi sur votre téléphone ou par e-mail : <a href="compte.html#notifications">régler mes notifications</a>.</p>
          </div>
          <div class="panel">
            <h2 data-ink-text="À [[venir]]"></h2>
            ${upcoming.length ? `<div class="cal">${upcoming.map(({ b, st }) => { const dt = S.parse(st.next.date); return `<a class="cal-row" href="livre.html?id=${b.id}"><div class="cal-day"><b>${dt.getDate()}</b><span>${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][dt.getMonth()]}</span></div><div>${S.esc(b.title)}<small>${S.esc(S.pagesRange(st.next.pages))} · ${dt.getHours()} h</small></div></a>`; }).join('')}</div>`
              : `<p class="ash">Aucune parution programmée dans vos livres suivis.</p>`}
          </div>
        </div>
      </section>
      <section class="sec" id="livres" style="padding-top:28px"${onglet === 'livres' ? '' : ' hidden'}>
        <div class="sec-head"><h2 class="sec-title" data-ink-text="Livres [[suivis]]"></h2><span class="mono ash">${fol.length} livre${fol.length > 1 ? 's' : ''}</span></div>
        ${fol.length ? `<div class="bi-etageres" role="list" aria-label="Mes livres sur l’étagère">${(() => {
            const par = innerWidth < 600 ? 3 : 6, rangees = []; for (let i = 0; i < fol.length; i += par) rangees.push(fol.slice(i, i + par));
            return rangees.map((r) => `<div class="bi-rangee">${r.map((b) => { const lu = D.reader.progress[b.id]; return `<a class="bi-livre" role="listitem" href="livre.html?id=${encodeURIComponent(b.id)}" aria-label="${S.esc(b.title)}${lu ? `, lu jusqu’à la page ${lu}` : ''}">${S.cover(b, { d3: false })}${lu ? `<span class="bi-marque">p. ${lu}</span>` : ''}</a>`; }).join('')}</div><div class="bi-planche" aria-hidden="true"></div>`).join('');
          })()}</div>
          <h3 class="bi-sous">Progression</h3>
          <div class="follow-list">${fol.map((b) => {
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
        : `<div class="empty"><strong>Vous ne suivez aucun livre</strong>Suivez un livre pour voir ses nouvelles pages ici.<br><br><a class="btn" href="explorer.html">Parcourir le catalogue</a></div>`}
      </section>
      </div>
    </div>`;
    const tabs = [...document.querySelectorAll('[data-bi]')];
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { onglet = t.dataset.bi; history.replaceState(null, '', '#' + onglet); render(); document.getElementById('bi-' + onglet).focus(); });
      t.addEventListener('keydown', (e) => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault(); onglet = tabs[(i + k + tabs.length) % tabs.length].dataset.bi; history.replaceState(null, '', '#' + onglet); render(); document.getElementById('bi-' + onglet).focus(); });
    });
    document.querySelectorAll('[data-desep]').forEach((x) => x.addEventListener('click', async () => {
      x.disabled = true;
      const r = await window.SOZO_API('DELETE', `/api/epingles/${+x.dataset.desep}`);
      if (!r.ok) { x.disabled = false; S.toast(r.d.erreur || 'Retrait impossible.'); return; }
      epingles = epingles.filter((e) => e.id !== +x.dataset.desep); render();
    }));
    document.querySelectorAll('[data-unf]').forEach((x) => x.addEventListener('click', async () => { x.disabled = true; if (!(await S.toggleFollow(x.dataset.unf))) S.toast('Vous ne suivez plus ce livre.'); render(); }));
    const m = $('#markAll');
    if (m) m.addEventListener('click', async () => { m.disabled = true; const r = await window.SOZO_API('POST', '/api/notifications/lues', {}); if (!r.ok) { m.disabled = false; S.toast(r.d.erreur || 'Action impossible.'); return; } await charger(); render(); S.majCloche(); });
    // Lue au clic : la page suivante s'ouvre aussitôt, la requête survit grâce à keepalive
    // (sans lui, le navigateur l'annulait souvent en quittant la page : notification restée « nouvelle »).
    document.querySelectorAll('[data-nid]').forEach((a) => a.addEventListener('click', () => { window.SOZO_API('POST', '/api/notifications/lues', { ids: [+a.dataset.nid] }, { keepalive: true }); }));
    S.inkAll();
  }
  // La cloche ou le menu mènent à suivis.html#notifications : on change d'onglet sans recharger
  addEventListener('hashchange', () => { const k = location.hash.slice(1); if (ONGLETS.some(([x]) => x === k) && k !== onglet) { onglet = k; render(); } });
  render();
  S.footer();
}).catch(window.SOZO_ERREUR);
