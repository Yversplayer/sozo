/* ═══════════════════════════════════════════════════════════
   Sōzō — MON PROFIL (03/11/2026), sur les deux captures Webtoon « Mes
   séries » du propriétaire : « je t'ai envoyé ce que j'aimerais pour
   l'interface mon profil, donc tu peux supprimer Bibliothèque ».
   Cinq onglets soulignés : Récents (l'historique de lecture), Abonnements,
   Téléchargements (cet appareil), Achetés, Commentaires. Une ligne par
   œuvre : la couverture, le titre, où l'on en est, « lu il y a 15 jours »,
   et « Continuer à lire ». Les paramètres du compte sont derrière la roue.

   Tout vient du serveur (catalogue, abonnements, commentaires) ou du cache
   de cet appareil (téléchargements, relus un par un) : rien d'inventé, pas
   de « j'aime » ni de réponse sur un commentaire, Sōzō n'en compte pas.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('profil');
  const main = $('#main');
  const moi = S.sess();
  const ONGLETS = [['recents', 'Récents'], ['abonnements', 'Abonnements'], ['telechargements', 'Téléchargements'], ['achetes', 'Achetés'], ['commentaires', 'Commentaires']];
  let onglet = (location.hash || '').slice(1);
  if (!ONGLETS.some(([k]) => k === onglet)) onglet = 'recents';
  let auteurs = null, commentaires = null, telecharges = null;

  const lu = D.reader.progress || {}, luLe = D.reader.lu_le || {};
  const pagesParues = (b) => S.visiblePages(b).filter((p) => S.access(b, p.n) !== 'soon');
  const ou = (b) => {
    const n = lu[b.id]; if (!n) return 'Pas encore commencé';
    const c = S.chapterOf(b, n), i = c ? b.chapters.indexOf(c) : -1;
    return c ? `Chap. ${i + 1} : ${c.t}` : `Page ${n}`;
  };
  const lienLire = (b) => {
    const vis = S.visiblePages(b), n = lu[b.id];
    const p = vis.some((x) => x.n === n) ? n : (vis.find((x) => S.readable(S.access(b, x.n))) || vis[0] || { n: 1 }).n;
    return `lire.html?id=${encodeURIComponent(b.id)}&p=${p}`;
  };
  const ligne = (b, sous, quand, action) => `<li class="pf-l">
    <a class="pf-cv" href="livre.html?id=${encodeURIComponent(b.id)}" aria-label="${S.esc(b.title)} — la fiche">${S.cover(b, { d3: false })}</a>
    <a class="pf-t" href="livre.html?id=${encodeURIComponent(b.id)}"><strong>${S.esc(b.title)}</strong><span>${sous}</span>${quand ? `<small>${quand}</small>` : ''}</a>
    ${action}</li>`;
  const continuer = (b) => `<a class="pf-b" href="${lienLire(b)}">${lu[b.id] ? 'Continuer<small>à lire</small>' : 'Commencer<small>à lire</small>'}</a>`;
  const vide = (titre, texte, lien, libelle) => `<div class="pf-vide"><strong>${titre}</strong><p>${texte}</p>${lien ? `<a class="ap-b ap-b--voile" href="${lien}">${libelle}</a>` : ''}</div>`;

  function panneau() {
    if (onglet === 'recents') {
      const l = Object.keys(lu).map((id) => S.book(id)).filter(Boolean).sort((x, y) => (luLe[y.id] || '').localeCompare(luLe[x.id] || ''));
      const nouv = l.filter((b) => pagesParues(b).some((p) => p.n > lu[b.id] && S.readable(S.access(b, p.n)))).length;
      return { compte: `<span>${S.icon('restaurer')}<strong>${l.length}</strong> livre${l.length > 1 ? 's' : ''} au total</span>${nouv ? `<span><strong>${nouv}</strong> avec des pages à lire</span>` : ''}`,
        corps: l.length ? `<ul class="pf-liste">${l.map((b) => ligne(b, S.esc(ou(b)), luLe[b.id] ? `Lu ${S.depuisJours(luLe[b.id])}` : '', continuer(b))).join('')}</ul>`
          : vide('Aucune lecture pour l’instant', 'Ouvrez un livre : il viendra se ranger ici, avec la page où vous vous êtes arrêté.', 'explorer.html', 'Trouver un livre') };
    }
    if (onglet === 'abonnements') {
      const l = (D.reader.follows || []).map((id) => S.book(id)).filter(Boolean);
      const a = auteurs || [];
      return { compte: `<span><strong>${l.length}</strong> livre${l.length > 1 ? 's' : ''}</span>${a.length ? `<span><strong>${a.length}</strong> auteur${a.length > 1 ? 's' : ''}</span>` : ''}`,
        corps: (l.length ? `<ul class="pf-liste">${l.map((b) => { const st = S.stats(b); return ligne(b, S.esc(S.author(b.author).name), st.next ? `La suite le ${S.esc(S.dateShort(st.next.date))}` : b.mode === 'progressive' ? 'À jour' : 'Complet', continuer(b)); }).join('')}</ul>` : '')
          + (a.length ? `<h2 class="pf-h">Auteurs suivis</h2><ul class="pf-liste">${a.map((x) => `<li class="pf-l"><a class="pf-av" href="auteur.html?id=${encodeURIComponent(x.id)}">${S.monogramme(x.nom, 52)}</a>
              <a class="pf-t" href="auteur.html?id=${encodeURIComponent(x.id)}"><strong>${S.esc(x.nom)}</strong>${x.ville ? `<span>${S.esc(x.ville)}</span>` : ''}</a>
              <button class="pf-b pf-b--doux" type="button" data-desabo="${S.esc(x.id)}">Ne plus<small>suivre</small></button></li>`).join('')}</ul>` : '')
          || (auteurs === null ? '<p class="pf-attente" role="status">Chargement…</p>' : vide('Aucun abonnement', 'Sur un livre, touchez « S’abonner » : ses nouvelles pages vous seront signalées.', 'decouvrir.html', 'Découvrir des livres')) };
    }
    if (onglet === 'telechargements') {
      if (telecharges === null) return { compte: '', corps: '<p class="pf-attente" role="status">Lecture de cet appareil…</p>' };
      const l = telecharges.map((x) => ({ x, b: S.book(x.slug) })).filter((y) => y.b);
      return { compte: `<span>${S.icon('download')}<strong>${l.length}</strong> livre${l.length > 1 ? 's' : ''} sur cet appareil</span>`,
        corps: l.length ? `<ul class="pf-liste">${l.map(({ x, b }) => ligne(b, `${x.pages} page${x.pages > 1 ? 's' : ''} sans réseau`, `Téléchargé ${S.depuisJours(x.le)}`,
            `<span class="pf-acts"><a class="pf-b" href="${lienLire(b)}">Lire</a><button class="ap-ic pf-x" type="button" data-retirer="${S.esc(b.id)}" aria-label="Retirer « ${S.esc(b.title)} » de cet appareil">${S.icon('x')}</button></span>`)).join('')}</ul>`
          : vide('Rien sur cet appareil', 'Sur la fiche d’un livre, touchez les trois points puis « Télécharger » : vous le lirez même sans réseau.', 'decouvrir.html', 'Choisir un livre') };
    }
    if (onglet === 'achetes') {
      const l = Object.entries(D.reader.purchases || {}).map(([id, p]) => ({ b: S.book(id), p })).filter((y) => y.b);
      return { compte: `<span><strong>${l.length}</strong> livre${l.length > 1 ? 's' : ''} débloqué${l.length > 1 ? 's' : ''}</span>`,
        corps: l.length ? `<ul class="pf-liste">${l.map(({ b, p }) => ligne(b, S.esc(S.pagesRange(p.pages).replace(/^p/, 'P')), `Depuis le ${S.esc(S.dateShort(p.date + 'T12:00'))}`, continuer(b))).join('')}</ul>
            <a class="pf-lien" href="compte.html#hAchats">Mes paiements et reçus ${S.icon('right')}</a>`
          : vide('Aucun achat', 'Les livres gratuits se lisent sans rien acheter. Ce que vous débloquez reste à vous.', null) };
    }
    if (commentaires === null) return { compte: '', corps: '<p class="pf-attente" role="status">Chargement…</p>' };
    return { compte: `<span>${S.icon('bulle')}<strong>${commentaires.length}</strong> commentaire${commentaires.length > 1 ? 's' : ''}</span>`,
      corps: commentaires.length ? `<ul class="pf-coms">${commentaires.map((c) => `<li>
          <p class="pf-com-sur">${S.esc(c.sur)}${c.page ? ` <span>#${c.page}</span>` : ''}</p>
          <p class="pf-com-t">${S.esc(c.texte)}</p>
          <p class="pf-com-d"><time datetime="${S.esc(c.le)}">${S.esc(S.dayLong(new Date(c.le)))}</time></p>
          <a class="pf-b pf-b--carre" href="${S.esc(c.lien)}">${c.page ? 'Ouvrir la page' : 'Répondre'}</a></li>`).join('')}</ul>`
        : vide('Aucun commentaire', 'À la fin d’un chapitre, ou sous un écrit qui vous touche, laissez un mot : il se retrouvera ici.', 'explorer.html?vue=ecrits', 'Lire des écrits') };
  }

  function rendre(focus) {
    const p = panneau();
    main.innerHTML = `<div class="pf">
      <header class="pf-tete">
        <span class="pf-moi"><span class="nav-av" aria-hidden="true">${S.esc((moi.name || '?').trim().split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase())}</span>
          <span><h1>Mon profil</h1><small>${S.esc(moi.name || '')}</small></span></span>
        <span class="ap-barre-d">
          <a class="ap-ic" href="notifications.html" data-cloche aria-label="Notifications">${S.icon('bell')}</a>
          <a class="ap-ic" href="compte.html" aria-label="Paramètres du compte">${S.icon('reglages')}</a>
        </span>
      </header>
      <nav class="pf-onglets" role="tablist" aria-label="Mon profil">${ONGLETS.map(([k, l]) => `<button type="button" role="tab" id="pf-${k}" aria-controls="pfPanneau" aria-selected="${onglet === k}" tabindex="${onglet === k ? 0 : -1}" data-pf="${k}">${l}</button>`).join('')}</nav>
      <div id="pfPanneau" role="tabpanel" aria-labelledby="pf-${onglet}">
        ${p.compte ? `<p class="pf-compte">${p.compte}</p>` : ''}
        ${p.corps}
      </div>
    </div>`;
    const tabs = [...main.querySelectorAll('[data-pf]')];
    const aller = (k) => { onglet = k; history.replaceState(null, '', '#' + k); rendre(true); };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => aller(t.dataset.pf));
      t.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); aller(tabs[(i + d + tabs.length) % tabs.length].dataset.pf); });
    });
    const actif = $(`#pf-${onglet}`);
    actif.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (focus) actif.focus();
    S.majCloche();
  }

  main.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-retirer]');
    if (r) {
      r.disabled = true;
      await window.SOZO_HORS.retirer(r.dataset.retirer);
      telecharges = await window.SOZO_HORS.liste();
      S.toast('Retiré de cet appareil.'); rendre(); return;
    }
    const a = e.target.closest('[data-desabo]');
    if (a) {
      a.disabled = true;
      const q = await window.SOZO_API('DELETE', `/api/profils/${a.dataset.desabo.slice(1)}/abonnement`);
      if (!q.ok) { a.disabled = false; S.toast(q.d.erreur || 'Le serveur a refusé.'); return; }
      auteurs = auteurs.filter((x) => x.id !== a.dataset.desabo); rendre();
    }
  });
  addEventListener('hashchange', () => { const k = location.hash.slice(1); if (ONGLETS.some(([x]) => x === k) && k !== onglet) { onglet = k; rendre(); } });

  rendre();
  // ce qui ne vient pas du catalogue arrive ensuite, sans bloquer l'écran
  const [ab, co, te] = await Promise.all([
    window.SOZO_API('GET', '/api/abonnements'),
    window.SOZO_API('GET', '/api/moi/commentaires'),
    window.SOZO_HORS ? window.SOZO_HORS.liste().catch(() => []) : Promise.resolve([])
  ]);
  auteurs = ab.ok ? ab.d.auteurs : [];
  commentaires = co.ok ? co.d.commentaires : [];
  telecharges = te;
  rendre();
}).catch(window.SOZO_ERREUR);
