/* Sōzō — ma bibliothèque (19/10/2026, ex-« Mes suivis ») : trois onglets.
   En cours (livres suivis, progression, prochaines parutions), Épingles
   (passages gardés, sur tous les appareils), Notifications (venues du serveur :
   parutions, paiements, ventes, sécurité…). */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('suivis');
  const ICONES = { parution: 'book', paiement: 'tag', vente: 'star', reversement: 'send', plume: 'feather', moderation: 'shield', securite: 'lock', test: 'bell', communaute: 'bulle', abonnements: 'feather' };
  let notifs = [], epingles = null, gardes = null;
  const E = window.SOZO_ECRITS;
  const charger = async () => { const r = await window.SOZO_API('GET', '/api/notifications'); notifs = r.ok ? r.d.liste : null; };
  const chargerEpingles = async () => { const r = await window.SOZO_API('GET', '/api/epingles'); epingles = r.ok ? r.d.epingles : null; };
  // 21/10/2026 : les écrits qu'on « garde » (poèmes, pensées, prières…) ont leur onglet
  const chargerGardes = async () => { const r = await window.SOZO_API('GET', '/api/ecrits/gardes'); gardes = r.ok ? r.d.ecrits : null; };
  let abonnements = null, versets = [], signets = [];
  const chargerLot = async () => {
    const [a, b] = await Promise.all([window.SOZO_API('GET', '/api/versets'), window.SOZO_API('GET', '/api/signets')]);
    versets = a.ok ? a.d.versets : []; signets = b.ok ? b.d.signets : [];
  };
  const chargerAbos = async () => { const r = await window.SOZO_API('GET', '/api/abonnements'); abonnements = r.ok ? r.d.auteurs : null; };
  await Promise.all([charger(), chargerEpingles(), chargerGardes(), chargerAbos(), chargerLot()]);
  const NOMS_B = ['Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome', 'Josué', 'Juges', 'Ruth', '1 Samuel', '2 Samuel', '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras', 'Néhémie', 'Esther', 'Job', 'Psaumes', 'Proverbes', 'Ecclésiaste', 'Cantique des Cantiques', 'Ésaïe', 'Jérémie', 'Lamentations', 'Ézéchiel', 'Daniel', 'Osée', 'Joël', 'Amos', 'Abdias', 'Jonas', 'Michée', 'Nahum', 'Habacuc', 'Sophonie', 'Aggée', 'Zacharie', 'Malachie', 'Matthieu', 'Marc', 'Luc', 'Jean', 'Actes des Apôtres', 'Romains', '1 Corinthiens', '2 Corinthiens', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens', '1 Thessaloniciens', '2 Thessaloniciens', '1 Timothée', '2 Timothée', 'Tite', 'Philémon', 'Hébreux', 'Jacques', '1 Pierre', '2 Pierre', '1 Jean', '2 Jean', '3 Jean', 'Jude', 'Apocalypse'];
  const ONGLETS = [['livres', 'En cours', 'book'], ['ecrits', 'Écrits gardés', 'garder'], ['abonnements', 'Abonnements', 'user'], ['epingles', 'Épingles', 'tag'], ['notifications', 'Notifications', 'bell']];
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
        <h1 class="sec-title" style="font-size:clamp(34px,4.6vw,52px)">Ma bibliothèque</h1>
        <div class="bi-onglets" role="tablist" aria-label="Ma bibliothèque">${ONGLETS.map(([k, l, ic]) => `<button type="button" role="tab" id="bi-${k}" aria-controls="biPanel" aria-selected="${onglet === k}" tabindex="${onglet === k ? 0 : -1}" data-bi="${k}">${S.icon(ic)} ${l}${k === 'notifications' && nonLues ? ` <span class="dot">${nonLues}</span>` : ''}${k === 'epingles' && epingles && epingles.length ? ` <span class="bi-n">${epingles.length}</span>` : ''}${k === 'ecrits' && gardes && gardes.length ? ` <span class="bi-n">${gardes.length}</span>` : ''}</button>`).join('')}</div>
      </section>
      <div id="biPanel" role="tabpanel" aria-labelledby="bi-${onglet}">
      <section class="sec" id="ecrits" style="padding-top:28px"${onglet === 'ecrits' ? '' : ' hidden'}>
        ${gardes === null ? `<p class="warn">${S.icon('x')}<span>Écrits gardés indisponibles pour le moment.</span></p>`
          : gardes.length ? `<div class="vl-fil" id="filGardes">${gardes.map((e) => E.carte(e)).join('')}</div>`
          : `<div class="empty"><strong>Aucun écrit gardé</strong>Sous un poème, une pensée ou une prière qui vous parle, touchez « Garder » : il vous attendra ici.<br><br><a class="btn btn--ghost btn--sm" href="explorer.html?vue=ecrits">Lire des écrits</a></div>`}
      </section>
      <section class="sec" id="abonnements" style="padding-top:28px"${onglet === 'abonnements' ? '' : ' hidden'}>
        ${abonnements === null ? `<p class="warn">${S.icon('x')}<span>Abonnements indisponibles pour le moment.</span></p>`
          : abonnements.length ? `<ul class="vl-notes-l">${abonnements.map((a) => `<li><a class="vl-note vl-abo" href="auteur.html?id=${encodeURIComponent(a.id)}">${S.monogramme(a.nom, 40)}<span><strong>${S.esc(a.nom)}</strong>${a.ville ? `<small>${S.esc(a.ville)}</small>` : ''}</span></a>
              <button class="btn btn--ghost btn--sm" type="button" data-desabo="${S.esc(a.id)}">Ne plus suivre</button></li>`).join('')}</ul>`
          : `<div class="empty"><strong>Vous ne suivez personne</strong>Sur la page d’un auteur, touchez « Suivre » : ses nouveaux écrits vous seront signalés.<br><br><a class="btn btn--ghost btn--sm" href="explorer.html?vue=ecrits">Lire des écrits</a></div>`}
      </section>
      <section class="sec" id="epingles" style="padding-top:28px"${onglet === 'epingles' ? '' : ' hidden'}>
        ${signets.length ? `<div class="panel bi-pins"><h2>Mes marque-pages</h2>${signets.map((x) => `<div class="bi-pin bi-signet"><span>${S.icon('garder')} <strong>${S.esc(x.titre)}</strong> · page ${x.n}</span>
          <span class="row-acts"><a class="btn btn--ghost btn--sm" href="lire.html?id=${encodeURIComponent(x.livre)}&p=${x.n}">Ouvrir ${S.icon('right')}</a><button class="btn btn--ghost btn--sm" type="button" data-signet="${x.id}">Retirer</button></span></div>`).join('')}</div>` : ''}
        ${versets.length ? `<div class="panel bi-pins"><h2>Mes versets</h2>${versets.map((x) => `<div class="bi-pin"><blockquote>« ${S.esc(x.t)} »</blockquote>
          <div class="row-acts"><a class="btn btn--ghost btn--sm" href="bible.html?b=${x.b}&c=${x.c}&v=${x.v1}${x.v2 !== x.v1 ? '-' + x.v2 : ''}">${S.esc(NOMS_B[x.b - 1])} ${x.c}:${x.v1}${x.v2 !== x.v1 ? '–' + x.v2 : ''} ${S.icon('right')}</a><button class="btn btn--ghost btn--sm" type="button" data-verset="${x.id}">Retirer</button></div></div>`).join('')}</div>` : ''}
        ${epingles === null ? `<p class="warn">${S.icon('x')}<span>Épingles indisponibles pour le moment.</span></p>`
          : epingles.length ? (() => { const par = {}; epingles.forEach((e) => (par[e.livre] = par[e.livre] || { titre: e.titre, l: [] }).l.push(e)); return Object.entries(par).map(([slug, g]) => `<div class="panel bi-pins">
              <h2>${S.esc(g.titre)}</h2>
              ${g.l.map((e) => `<div class="bi-pin" data-pin="${e.id}"><blockquote>« ${S.esc(e.extrait)} »</blockquote>
                ${e.note ? `<p class="bi-note">${S.icon('edit')} ${S.esc(e.note)}</p>` : ''}
                <div class="row-acts"><a class="btn btn--ghost btn--sm" href="lire.html?id=${encodeURIComponent(slug)}&p=${e.n}">Page ${e.n} ${S.icon('right')}</a>
                <button class="btn btn--ghost btn--sm" type="button" data-note="${e.id}">${e.note ? 'Modifier la note' : 'Ajouter une note'}</button>
                <button class="btn btn--ghost btn--sm" type="button" data-desep="${e.id}">Retirer</button></div></div>`).join('')}
            </div>`).join(''); })()
          : `<div class="empty"><strong>Aucune épingle pour l’instant</strong>Dans la liseuse, sélectionnez une phrase qui vous parle, puis touchez « Épingler ». Elle vous attendra ici, sur tous vos appareils.</div>`}
      </section>
      <section class="sec" id="notifications" style="padding-top:28px"${onglet === 'notifications' ? '' : ' hidden'}>
        <div class="cols">
          <div class="panel">
            <div class="sec-head" style="margin-bottom:10px"><h2 style="margin:0">Notifications</h2>
              ${notifs && notifs.some((x) => !x.lu_le) ? `<button class="btn btn--ghost btn--sm" type="button" id="markAll">Tout marquer comme lu</button>` : ''}</div>
            ${notifs === null ? `<p class="warn">${S.icon('x')}<span>Notifications indisponibles pour le moment.</span></p>`
              : notifs.length ? `<div class="notifs">${notifs.map((x) => `<div class="nt-l"><a class="nt${x.lu_le ? '' : ' is-new'}" href="${S.esc(x.lien || '#')}" data-nid="${x.id}">
                <span class="nt-ic">${S.icon(ICONES[x.type] || 'bell')}</span>
                <span><strong>${S.esc(x.titre)}</strong><p>${S.esc(x.corps)}</p></span>
                <time datetime="${S.esc(x.created_at)}">${x.lu_le ? '' : '<span class="dot">Nouveau</span> '}${ago(x.created_at)}</time>
                </a><button class="icon-btn nt-x" type="button" data-suppr-notif="${x.id}" aria-label="Supprimer cette notification" title="Supprimer">${S.icon('x')}</button></div>`).join('')}</div>`
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
    document.querySelectorAll('[data-signet], [data-verset]').forEach((x) => x.addEventListener('click', async () => {
      x.disabled = true;
      const sig = x.dataset.signet;
      const r = await window.SOZO_API('DELETE', sig ? `/api/signets/${sig}` : `/api/versets/${x.dataset.verset}`);
      if (!r.ok) { x.disabled = false; S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
      if (sig) signets = signets.filter((y) => y.id !== +sig); else versets = versets.filter((y) => y.id !== +x.dataset.verset);
      render();
    }));
    document.querySelectorAll('[data-desabo]').forEach((x) => x.addEventListener('click', async () => {
      x.disabled = true;
      const r = await window.SOZO_API('DELETE', `/api/profils/${x.dataset.desabo.slice(1)}/abonnement`);
      if (!r.ok) { x.disabled = false; S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
      abonnements = abonnements.filter((a) => a.id !== x.dataset.desabo); render();
    }));
    const fg = $('#filGardes');
    if (fg) E.brancher(fg, (id) => gardes.find((e) => e.id === id));
    // 21/10/2026 : une note personnelle sur une épingle ; supprimer une notification
    document.querySelectorAll('[data-note]').forEach((x) => x.addEventListener('click', () => {
      const e = epingles.find((y) => y.id === +x.dataset.note);
      const m = S.modal({ title: 'Ma note', body: `<blockquote class="bi-pin-cit">« ${S.esc(e.extrait)} »</blockquote>
        <label class="cx-field">Note <small>visible par vous seul</small><textarea id="pinNote" rows="4" maxlength="500">${S.esc(e.note || '')}</textarea></label><p class="cx-err" id="pinErr" role="alert"></p>`,
        actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async (close) => {
          const note = m.el.querySelector('#pinNote').value.trim();
          const r = await window.SOZO_API('PATCH', `/api/epingles/${e.id}`, { note: note || null });
          if (!r.ok) { m.el.querySelector('#pinErr').textContent = r.d.erreur || 'Le serveur a refusé.'; return; }
          e.note = r.d.note; close(); render();
        } }] });
      setTimeout(() => m.el.querySelector('#pinNote').focus(), 50);
    }));
    document.querySelectorAll('[data-suppr-notif]').forEach((x) => x.addEventListener('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      x.disabled = true;
      const r = await window.SOZO_API('DELETE', `/api/notifications/${x.dataset.supprNotif}`);
      if (!r.ok) { x.disabled = false; S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
      notifs = notifs.filter((n) => n.id !== +x.dataset.supprNotif); render(); S.majCloche();
    }));
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
