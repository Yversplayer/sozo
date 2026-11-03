/* Sōzō — ma bibliothèque (19/10/2026, ex-« Mes suivis ») : En cours (livres
   suivis, progression, prochaines parutions), Abonnements ; et Mes notes
   (?vue=notes) : passages gardés, versets, marque-pages, écrits gardés.
   Les notifications vivent sous la cloche depuis le 03/11/2026
   (notifications.js) ; sur téléphone, la bibliothèque devient le Profil. */
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
  /* 30/10/2026 — l'application a deux onglets distincts sur la même page :
     Bibliothèque (livres, abonnements, notifications) et Notes (passages
     épinglés, versets, marque-pages, écrits gardés), via ?vue=notes. */
  const NOTES = S.q('vue') === 'notes';
  if (NOTES) document.title = 'Mes notes — Sōzō';
  // 03/11/2026 : les notifications ont quitté la bibliothèque pour la cloche (notifications.html)
  if (location.hash === '#notifications') { location.replace('notifications.html'); return; }
  const ONGLETS = NOTES ? [['epingles', 'Passages et versets', 'tag'], ['ecrits', 'Écrits gardés', 'garder']]
    : [['livres', 'En cours', 'book'], ['abonnements', 'Abonnements', 'user']];
  let onglet = (location.hash || '').slice(1);
  if (!ONGLETS.some(([k]) => k === onglet)) onglet = ONGLETS[0][0];
  const main = $('#main');

  /* 22/10/2026 — la bibliothèque « en piles » (image « My Library » du
     propriétaire) : chaque collection est un éventail de couvertures, ou
     d'écrits posés sur leur photo ; un toucher mène à son contenu. */
  function eventail(items) {
    return `<span class="bp-fan" aria-hidden="true">${items.slice(0, 5).map((h, i, a) => `<span class="bp-carte" style="--i:${i};--n:${a.length}">${h}</span>`).join('')}</span>`;
  }
  function piles(fol) {
    const lus = fol.filter((b) => D.reader.progress[b.id]);
    const aCommencer = fol.filter((b) => !D.reader.progress[b.id]);
    const achetes = Object.keys(D.reader.purchases || {}).map((id) => S.book(id)).filter(Boolean);
    const ecr = (gardes || []).map((e) => `<span class="bp-ecrit${(e.apparence || {}).image ? ' has-photo' : ''}"${(e.apparence || {}).image ? ` style="--xp-photo:url('${S.esc(S.img(e.apparence.image, true))}')"` : ''}><span>${S.esc(String(e.texte || '').replace(/[#>*•]/g, '').slice(0, 60))}</span></span>`);
    const vers = versets.map((x) => `<span class="bp-verset bb-c-${S.esc(x.couleur || 'or')}"><span>${S.esc(String(x.t || '').slice(0, 70))}</span></span>`);
    const P = [
      ['En cours', lus.map((b) => S.cover(b, { d3: false })), '#livres-progression', 'rose'],
      ['À commencer', aCommencer.map((b) => S.cover(b, { d3: false })), '#livres-progression', 'or'],
      ['Mes achats', achetes.map((b) => S.cover(b, { d3: false })), 'compte.html', 'menthe'],
      ['Écrits gardés', ecr, '#ecrits', 'lavande'],
      ['Mes versets', vers, '#epingles', 'ciel']
    ].filter(([, l]) => l.length);
    if (!P.length) return '';
    return `<div class="bp" role="list" aria-label="Mes piles">${P.map(([t, l, h, c]) => `<a class="bp-pile bb-c-${c}" role="listitem" href="${h}"${h.startsWith('#') ? ` data-pile="${h.slice(1)}"` : ''}>
      ${eventail(l)}<span class="bp-t"><strong>${S.esc(t)}</strong><small>${l.length}</small></span></a>`).join('')}</div>`;
  }

  /* 03/11/2026 — NOTES, sur téléphone : un CARNET. Le propriétaire trouvait
     Bibliothèque, Écrire et Notes « beaucoup trop semblables, ennuyeux ».
     Ici, pas d'onglets ni de cartes : les passages gardés se lisent comme
     surlignés au feutre (la couleur choisie pour un verset), rangés par livre,
     puis les marque-pages et les écrits gardés. Mêmes gestes qu'avant
     (page, note, retirer), mêmes réponses du serveur. */
  const TEL = matchMedia('(max-width: 899px)').matches;
  function carnet() {
    const nP = (epingles || []).length, nV = versets.length, nM = signets.length, nE = (gardes || []).length, total = nP + nV + nM + nE;
    const saut = [['passages', 'Passages', nP], ['versets', 'Versets', nV], ['marque-pages', 'Marque-pages', nM], ['ecrits-gardes', 'Écrits', nE]].filter((x) => x[2]);
    const acts = (h) => `<div class="cn-acts">${h}</div>`;
    const par = {}; (epingles || []).forEach((e) => (par[e.livre] = par[e.livre] || { titre: e.titre, l: [] }).l.push(e));
    return `<div class="cn">
      <header class="cn-tete"><h1>Mes notes</h1><p>${total ? `${total} note${total > 1 ? 's' : ''} gardée${total > 1 ? 's' : ''}` : 'Votre carnet est encore vierge'}</p></header>
      ${saut.length > 1 ? `<nav class="cn-saut" aria-label="Aller à">${saut.map(([k, l, n]) => `<a href="#${k}">${l} <span>${n}</span></a>`).join('')}</nav>` : ''}
      ${epingles === null ? `<p class="warn">${S.icon('x')}<span>Épingles indisponibles pour le moment.</span></p>` : ''}
      ${nP ? `<section class="cn-sec" id="passages" aria-labelledby="ntP"><h2 id="ntP">Passages</h2>${Object.entries(par).map(([slug, g]) => `
        <h3 class="cn-livre">${S.book(slug) ? `<span class="bi-cv">${S.cover(S.book(slug), { d3: false })}</span>` : ''}<span>${S.esc(g.titre)}</span></h3>
        ${g.l.map((e) => `<article class="cn-note-l" data-pin="${e.id}"><p class="cn-surl bb-c-or"><mark>${S.esc(e.extrait)}</mark></p>
          ${e.note ? `<p class="cn-perso">${S.esc(e.note)}</p>` : ''}
          ${acts(`<a href="lire.html?id=${encodeURIComponent(slug)}&p=${e.n}">Page ${e.n} ${S.icon('right')}</a><button type="button" data-note="${e.id}">${e.note ? 'Modifier ma note' : 'Ajouter une note'}</button><button type="button" data-desep="${e.id}">Retirer</button>`)}</article>`).join('')}`).join('')}</section>` : ''}
      ${nV ? `<section class="cn-sec" id="versets" aria-labelledby="ntV"><h2 id="ntV">Versets</h2>${versets.map((x) => `<article class="cn-note-l"><p class="cn-surl bb-c-${S.esc(x.couleur || 'or')}"><mark>${S.esc(x.t)}</mark></p>
        ${acts(`<a href="bible.html?b=${x.b}&c=${x.c}&v=${x.v1}${x.v2 !== x.v1 ? '-' + x.v2 : ''}">${S.esc(NOMS_B[x.b - 1])} ${x.c}:${x.v1}${x.v2 !== x.v1 ? '–' + x.v2 : ''} ${S.icon('right')}</a><button type="button" data-verset="${x.id}">Retirer</button>`)}</article>`).join('')}</section>` : ''}
      ${nM ? `<section class="cn-sec" id="marque-pages" aria-labelledby="ntM"><h2 id="ntM">Marque-pages</h2><ul class="cn-signets">${signets.map((x) => `<li>${S.icon('garder')}<a href="lire.html?id=${encodeURIComponent(x.livre)}&p=${x.n}"><strong>${S.esc(x.titre)}</strong><span>page ${x.n}</span></a><button type="button" data-signet="${x.id}" aria-label="Retirer le marque-page de « ${S.esc(x.titre)} »">${S.icon('x')}</button></li>`).join('')}</ul></section>` : ''}
      ${nE ? `<section class="cn-sec" id="ecrits-gardes" aria-labelledby="ntE"><h2 id="ntE">Écrits gardés</h2>${gardes.map((e) => `<article class="cn-ecrit"><p>${S.esc(String(e.texte || '').replace(/[#>*•]/g, '').trim().slice(0, 220))}${String(e.texte || '').length > 220 ? '…' : ''}</p>
        <p class="cn-de">— ${S.esc(e.auteur.nom)} · ${S.esc(E.NATURES[e.nature] || '')}</p>${acts(`<a href="ecrit.html?id=${e.id}">Lire ${S.icon('right')}</a>`)}</article>`).join('')}</section>` : ''}
      ${total ? '' : `<div class="pf-vide"><strong>Rien de gardé pour l’instant</strong><p>Dans la liseuse, sélectionnez une phrase et touchez « Épingler » ; dans la Bible, colorez un verset ; sous un écrit, touchez « Garder ». Tout se retrouve ici.</p><a class="ap-b ap-b--voile" href="bible.html">Ouvrir la Bible</a></div>`}
    </div>`;
  }
  function render() {
    const fol = S.follows().map((id) => S.book(id)).filter(Boolean);

    const nonLues = notifs ? notifs.filter((x) => !x.lu_le).length : 0;
    // 30/10/2026 — un compteur sur chaque pastille (image « My Library » du propriétaire)
    const COMPTES = { livres: fol.length, abonnements: (abonnements || []).length, epingles: (epingles || []).length + versets.length + signets.length, ecrits: (gardes || []).length };
    const nNotes = COMPTES.epingles + COMPTES.ecrits;
    main.innerHTML = NOTES && TEL ? carnet() : `<div class="wrap">
      <section class="sec" style="padding-top:44px">
        <h1 class="sec-title" style="font-size:clamp(34px,4.6vw,52px)">${NOTES ? 'Mes notes' : 'Ma bibliothèque'}</h1>
        <p class="bi-compte">${NOTES ? `${nNotes} note${nNotes > 1 ? 's' : ''} gardée${nNotes > 1 ? 's' : ''}` : `${fol.length} livre${fol.length > 1 ? 's' : ''} suivi${fol.length > 1 ? 's' : ''}`}</p>
        <div class="bi-onglets" role="tablist" aria-label="${NOTES ? 'Mes notes' : 'Ma bibliothèque'}">${ONGLETS.map(([k, l, ic]) => `<button type="button" role="tab" id="bi-${k}" aria-controls="biPanel" aria-selected="${onglet === k}" tabindex="${onglet === k ? 0 : -1}" data-bi="${k}">${S.icon(ic)} ${l}${k === 'notifications' && nonLues ? ` <span class="dot">${nonLues}</span>` : ''}${k !== 'notifications' && COMPTES[k] ? ` <span class="bi-n">${COMPTES[k]}</span>` : ''}</button>`).join('')}</div>
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
              <h2>${S.book(slug) ? `<span class="bi-cv">${S.cover(S.book(slug), { d3: false })}</span>` : ''}${S.esc(g.titre)}</h2>
              ${g.l.map((e) => `<div class="bi-pin" data-pin="${e.id}"><blockquote>« ${S.esc(e.extrait)} »</blockquote>
                ${e.note ? `<p class="bi-note">${S.icon('edit')} ${S.esc(e.note)}</p>` : ''}
                <div class="row-acts"><a class="btn btn--ghost btn--sm" href="lire.html?id=${encodeURIComponent(slug)}&p=${e.n}">Page ${e.n} ${S.icon('right')}</a>
                <button class="btn btn--ghost btn--sm" type="button" data-note="${e.id}">${e.note ? 'Modifier la note' : 'Ajouter une note'}</button>
                <button class="btn btn--ghost btn--sm" type="button" data-desep="${e.id}">Retirer</button></div></div>`).join('')}
            </div>`).join(''); })()
          : `<div class="empty"><strong>Aucune épingle pour l’instant</strong>Dans la liseuse, sélectionnez une phrase qui vous parle, puis touchez « Épingler ». Elle vous attendra ici, sur tous vos appareils.</div>`}
      </section>
      <section class="sec" id="livres" style="padding-top:28px"${onglet === 'livres' ? '' : ' hidden'}>
        ${piles(fol)}
        <div class="sec-head"><h2 class="sec-title" data-ink-text="Livres [[suivis]]"></h2><span class="mono ash">${fol.length} livre${fol.length > 1 ? 's' : ''}</span></div>
        ${fol.length ? `<div class="bi-etageres" role="list" aria-label="Mes livres sur l’étagère">${(() => {
            const par = innerWidth < 600 ? 3 : 6, rangees = []; for (let i = 0; i < fol.length; i += par) rangees.push(fol.slice(i, i + par));
            return rangees.map((r) => `<div class="bi-rangee">${r.map((b) => { const lu = D.reader.progress[b.id]; return `<a class="bi-livre" role="listitem" href="livre.html?id=${encodeURIComponent(b.id)}" aria-label="${S.esc(b.title)}${lu ? `, lu jusqu’à la page ${lu}` : ''}">${S.cover(b, { d3: false })}${lu ? `<span class="bi-marque">p. ${lu}</span>` : ''}</a>`; }).join('')}</div><div class="bi-planche" aria-hidden="true"></div>`).join('');
          })()}</div>
          <h3 class="bi-sous" id="livres-progression">Progression</h3>
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
    // une pile mène à son onglet (écrits, versets) ou à sa liste (progression)
    document.querySelectorAll('[data-pile]').forEach((x) => x.addEventListener('click', (e) => {
      const cible = x.dataset.pile;
      if ((cible === 'ecrits' || cible === 'epingles') && !NOTES) { e.preventDefault(); location.href = `suivis.html?vue=notes#${cible}`; return; }
      if (cible === 'ecrits' || cible === 'epingles') { e.preventDefault(); onglet = cible; history.replaceState(null, '', '#' + onglet); render(); document.getElementById('bi-' + onglet).focus(); }
    }));
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
