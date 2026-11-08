/* ═══════════════════════════════════════════════════════════
   Sōzō — MON PROFIL.
   03/11/2026 : sur les captures Webtoon « Mes séries » du propriétaire
   (Bibliothèque supprimée) : Récents, Abonnements, Téléchargements, Achetés,
   Commentaires ; une ligne par œuvre et « Continuer à lire ».
   08/11/2026 : d'après les maquettes Stitch, et la demande du propriétaire :
   « qu'on puisse passer d'une rubrique à l'autre en glissant le doigt, sans
   être obligé d'appuyer sur les boutons — et que ça ne se ressente pas dans
   le menu ». Les rubriques sont côte à côte dans un défilement horizontal
   NATIF (scroll-snap, ecrans.css .sx-pager) : il suit le doigt comme une
   application, et il est exclu du geste « onglet voisin » de ui.js
   ([data-sans-glisse]) — glisser dans le profil ne change jamais l'onglet du
   bas. Les pastilles suivent la rubrique visible ; les toucher y mène.
   En tête : la carte de la personne et quatre nombres RÉELS (livres
   commencés, abonnements, auteurs suivis, livres achetés).

   Tout vient du serveur (catalogue, abonnements, écrits, commentaires) ou du
   cache de cet appareil (téléchargements) : rien d'inventé.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('profil');
  const main = $('#main');
  const moi = S.sess();
  const E = window.SOZO_ECRITS;
  const ONGLETS = [['recents', 'Récents'], ['abonnements', 'Abonnements'], ['ecrits', 'Mes écrits'], ['telechargements', 'Téléchargements'], ['achetes', 'Achetés'], ['commentaires', 'Commentaires']];
  let onglet = (location.hash || '').slice(1);
  if (!ONGLETS.some(([k]) => k === onglet)) onglet = 'recents';
  let auteurs = null, commentaires = null, telecharges = null, ecrits = null;

  const lu = D.reader.progress || {}, luLe = D.reader.lu_le || {};
  const pagesParues = (b) => S.visiblePages(b).filter((p) => S.access(b, p.n) !== 'soon');
  const ou = (b) => {
    const n = lu[b.id]; if (!n) return 'Pas encore commencé';
    const c = S.chapterOf(b, n), i = c ? b.chapters.indexOf(c) : -1;
    return c ? `Chap. ${i + 1} : ${c.t}` : `Page ${n}`;
  };
  const pct = (b) => { const t = pagesParues(b).length, n = lu[b.id] || 0; return t ? Math.min(100, Math.round((Math.min(n, t) / t) * 100)) : 0; };
  const lienLire = (b) => {
    const vis = S.visiblePages(b), n = lu[b.id];
    const p = vis.some((x) => x.n === n) ? n : (vis.find((x) => S.readable(S.access(b, x.n))) || vis[0] || { n: 1 }).n;
    return `lire.html?id=${encodeURIComponent(b.id)}&p=${p}`;
  };
  const ligne = (b, sous, quand, action, barre) => `<li class="pf-l sx-pf-l">
    <a class="pf-cv" href="livre.html?id=${encodeURIComponent(b.id)}" aria-label="${S.esc(b.title)} — la fiche">${S.cover(b, { d3: false })}</a>
    <a class="pf-t" href="livre.html?id=${encodeURIComponent(b.id)}"><strong>${S.esc(b.title)}</strong><span>${sous}</span>${barre ? `<span class="sx-prog"><i style="width:${pct(b)}%"></i></span>` : ''}${quand ? `<small>${quand}</small>` : ''}</a>
    ${action}</li>`;
  const continuer = (b) => `<a class="sx-btn sx-btn--plein sx-btn--petit" href="${lienLire(b)}">${lu[b.id] ? 'Continuer' : 'Lire'}</a>`;
  const vide = (titre, texte, lien, libelle) => `<div class="sx-vide">${S.PLUME_OR}<strong>${titre}</strong><span>${texte}</span>${lien ? `<a class="sx-btn sx-btn--doux sx-btn--petit" href="${lien}">${libelle}</a>` : ''}</div>`;
  const attente = '<p class="sx-chapeau" role="status"><span class="spin" aria-hidden="true"></span> Chargement…</p>';
  const compte = (html) => `<p class="pf-compte">${html}</p>`;

  function contenu(k) {
    if (k === 'recents') {
      const l = Object.keys(lu).map((id) => S.book(id)).filter(Boolean).sort((x, y) => (luLe[y.id] || '').localeCompare(luLe[x.id] || ''));
      const nouv = l.filter((b) => pagesParues(b).some((p) => p.n > lu[b.id] && S.readable(S.access(b, p.n)))).length;
      return l.length ? compte(`<span><strong>${l.length}</strong> livre${l.length > 1 ? 's' : ''} commencé${l.length > 1 ? 's' : ''}</span>${nouv ? `<span><strong>${nouv}</strong> avec des pages à lire</span>` : ''}`)
          + `<ul class="pf-liste">${l.map((b) => ligne(b, S.esc(ou(b)), luLe[b.id] ? `Lu ${S.depuisJours(luLe[b.id])} · ${pct(b)} %` : '', continuer(b), true)).join('')}</ul>`
        : vide('Aucune lecture pour l’instant', 'Ouvrez un livre : il viendra se ranger ici, avec la page où vous vous êtes arrêté.', 'explorer.html', 'Trouver un livre');
    }
    if (k === 'abonnements') {
      const l = (D.reader.follows || []).map((id) => S.book(id)).filter(Boolean);
      if (auteurs === null && !l.length) return attente;
      const a = auteurs || [];
      if (!l.length && !a.length) return vide('Aucun abonnement', 'Sur un livre, touchez « S’abonner » : ses nouvelles pages vous seront signalées.', 'decouvrir.html', 'Découvrir des livres');
      return (a.length ? `<h2 class="pf-h">Auteurs suivis <small>${a.length}</small></h2>
          <div class="sx-avatars" data-sans-glisse>${a.map((x) => `<span class="sx-avatar"><a href="auteur.html?id=${encodeURIComponent(x.id)}">${S.monogramme(x.nom, 58)}<b>${S.esc(x.nom.split(/\s+/)[0])}</b></a>
            <button type="button" class="sx-avatar-x" data-desabo="${S.esc(x.id)}" aria-label="Ne plus suivre ${S.esc(x.nom)}">${S.icon('x')}</button></span>`).join('')}</div>` : '')
        + (l.length ? `<h2 class="pf-h">Livres <small>${l.length}</small></h2><ul class="pf-liste">${l.map((b) => { const st = S.stats(b); return ligne(b, S.esc(S.author(b.author).name), st.next ? `La suite le ${S.esc(S.dateShort(st.next.date))}` : b.mode === 'progressive' ? 'À jour' : 'Complet', continuer(b)); }).join('')}</ul>` : '');
    }
    if (k === 'ecrits') {
      if (ecrits === null) return attente;
      const l = ecrits.filter((e) => !e.corbeille_le);
      const pub = l.filter((e) => e.statut === 'publie').length;
      return l.length ? compte(`<span><strong>${pub}</strong> publié${pub > 1 ? 's' : ''}</span>${l.length - pub ? `<span><strong>${l.length - pub}</strong> brouillon${l.length - pub > 1 ? 's' : ''}</span>` : ''}`)
          + `<div class="sx-fil" id="pfEcrits">${l.slice(0, 20).map((e) => `<div class="sx-pf-ecrit">${E.carte(e)}<a class="sx-lien" href="ecrits.html?id=${e.id}">${S.icon('edit')} ${e.statut === 'publie' ? 'Modifier' : 'Reprendre ce brouillon'}</a></div>`).join('')}</div>`
          + (l.length > 20 ? '<a class="sx-btn sx-btn--doux sx-btn--bloc" href="ecrits.html">Tous mes écrits</a>' : '')
        : vide('Aucun écrit', 'Une pensée, une prière, un poème : quelques mots suffisent.', 'ecrits.html?nouveau=pensee', 'Écrire une pensée');
    }
    if (k === 'telechargements') {
      if (telecharges === null) return attente;
      const l = telecharges.map((x) => ({ x, b: S.book(x.slug) })).filter((y) => y.b);
      return l.length ? compte(`<span>${S.icon('download')}<strong>${l.length}</strong> livre${l.length > 1 ? 's' : ''} lisible${l.length > 1 ? 's' : ''} sans réseau sur cet appareil</span>`)
          + `<ul class="pf-liste">${l.map(({ x, b }) => ligne(b, `${x.pages} page${x.pages > 1 ? 's' : ''} sans réseau`, `Téléchargé ${S.depuisJours(x.le)}`,
            `<span class="pf-acts"><a class="sx-btn sx-btn--plein sx-btn--petit" href="${lienLire(b)}">Lire</a><button class="sx-ic pf-x" type="button" data-retirer="${S.esc(b.id)}" aria-label="Retirer « ${S.esc(b.title)} » de cet appareil">${S.icon('x')}</button></span>`)).join('')}</ul>`
        : vide('Rien sur cet appareil', 'Sur la fiche d’un livre, touchez « Sans réseau » : vous le lirez même sans connexion.', 'decouvrir.html', 'Choisir un livre');
    }
    if (k === 'achetes') {
      const l = Object.entries(D.reader.purchases || {}).map(([id, p]) => ({ b: S.book(id), p })).filter((y) => y.b);
      return l.length ? compte(`<span><strong>${l.length}</strong> livre${l.length > 1 ? 's' : ''} débloqué${l.length > 1 ? 's' : ''}</span>`)
          + `<ul class="pf-liste">${l.map(({ b, p }) => ligne(b, S.esc(S.pagesRange(p.pages).replace(/^p/, 'P')), `Depuis le ${S.esc(S.dateShort(p.date + 'T12:00'))}`, continuer(b))).join('')}</ul>
            <a class="sx-carte sx-ligne sx-pf-recus" href="compte.html#hAchats"><span class="sx-ligne-ic">${S.icon('file')}</span><span class="sx-ligne-t"><b>Mes paiements et reçus</b><small>Mobile Money, confirmés par Sōzō</small></span>${S.icon('chevron')}</a>`
        : vide('Aucun achat', 'Les livres gratuits se lisent sans rien acheter. Ce que vous débloquez reste à vous.', null);
    }
    if (commentaires === null) return attente;
    return commentaires.length ? compte(`<span>${S.icon('bulle')}<strong>${commentaires.length}</strong> commentaire${commentaires.length > 1 ? 's' : ''}</span>`)
        + `<ul class="pf-coms">${commentaires.map((c) => `<li class="sx-carte">
          <p class="pf-com-sur">${S.esc(c.sur)}${c.page ? ` <span>#${c.page}</span>` : ''}</p>
          <p class="pf-com-t">${S.esc(c.texte)}</p>
          <p class="pf-com-d"><time datetime="${S.esc(c.le)}">${S.esc(S.dayLong(new Date(c.le)))}</time><a class="sx-lien" href="${S.esc(c.lien)}">${c.page ? 'Ouvrir la page' : 'Voir l’écrit'} ${S.icon('right')}</a></p></li>`).join('')}</ul>`
      : vide('Aucun commentaire', 'À la fin d’un chapitre, ou sous un écrit qui vous touche, laissez un mot : il se retrouvera ici.', 'explorer.html?vue=ecrits', 'Lire des écrits');
  }

  const initiales = (moi.name || '?').trim().split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const pro = moi.pro || {};
  const nb = () => [
    [Object.keys(lu).length, 'Livres lus'],
    [(D.reader.follows || []).length, 'Abonnements'],
    [auteurs ? auteurs.length : '…', 'Auteurs'],
    [Object.keys(D.reader.purchases || {}).length, 'Achetés']
  ];
  main.innerHTML = `<div class="pf sx-page">
    <header class="sx-barre" id="pfBarre">
      <a class="ap-logo" href="decouvrir.html" aria-label="Sōzō — accueil">${S.PLUME_OR}<span class="ap-logo-t" aria-hidden="true">Sōzō</span></a>
      <span class="sx-barre-d">
        <a class="sx-ic" href="notifications.html" data-cloche aria-label="Notifications">${S.icon('bell')}</a>
        <a class="sx-ic" href="compte.html" aria-label="Paramètres">${S.icon('reglages')}</a>
      </span>
    </header>
    <div class="sx-ecran">
      <section class="sx-carte sx-moi">
        <div class="sx-moi-h">
          <span class="sx-moi-av" aria-hidden="true">${S.esc(initiales)}</span>
          <div><h1>${S.esc(moi.name || 'Mon profil')}</h1>
            <p>${moi.role === 'auteur' ? 'Auteur' : 'Lecteur'}${pro.actif ? ` · <span class="sx-chip sx-chip--or">${S.icon('feather')} ${S.esc(pro.nom || 'Plume')}</span>` : ''}</p></div>
          <a class="sx-ic" href="compte.html#profil" aria-label="Modifier mon profil">${S.icon('edit')}</a>
        </div>
        <dl class="sx-moi-n" id="pfNombres"></dl>
      </section>
      <div class="sx-onglets" data-sans-glisse>
        <nav class="sx-pilules" role="tablist" aria-label="Mon profil">${ONGLETS.map(([k, l]) => `<button type="button" class="sx-pilule" role="tab" id="pf-${k}" aria-controls="pfp-${k}" aria-selected="${onglet === k}" tabindex="${onglet === k ? 0 : -1}" data-pf="${k}">${l}</button>`).join('')}</nav>
      </div>
      <div class="sx-pager" id="pfPager" data-sans-glisse>
        ${ONGLETS.map(([k]) => `<section id="pfp-${k}" role="tabpanel" aria-labelledby="pf-${k}" data-pfp="${k}"></section>`).join('')}
      </div>
    </div>
  </div>`;

  const pager = $('#pfPager'), tabs = [...main.querySelectorAll('[data-pf]')];
  const panneau = (k) => $(`#pfp-${k}`);
  const peindreNombres = () => { $('#pfNombres').innerHTML = nb().map(([n, l]) => `<div><dd>${n}</dd><dt>${l}</dt></div>`).join(''); };
  function peindre(k) {
    panneau(k).innerHTML = contenu(k);
    if (k === 'ecrits' && ecrits) E.brancher(panneau(k), (id) => ecrits.find((e) => e.id === id));
    if (k === onglet) ajuster();
  }
  // la hauteur suit la rubrique visible (sinon la plus longue laisse un grand vide sous les autres)
  function ajuster() { const p = panneau(onglet); if (p) pager.style.height = `${p.scrollHeight}px`; }
  function marquer(k) {
    onglet = k;
    tabs.forEach((t) => { const on = t.dataset.pf === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: S.reduced ? 'auto' : 'smooth' }); });
    history.replaceState(null, '', '#' + k);
    ajuster();
  }
  function aller(k, focus) {
    const i = ONGLETS.findIndex(([x]) => x === k);
    pager.scrollTo({ left: i * pager.clientWidth, behavior: S.reduced ? 'auto' : 'smooth' });
    marquer(k);
    if (focus) $(`#pf-${k}`).focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => aller(t.dataset.pf));
    t.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); aller(tabs[(i + d + tabs.length) % tabs.length].dataset.pf, true); });
  });
  let tFin;
  pager.addEventListener('scroll', () => {
    clearTimeout(tFin);
    tFin = setTimeout(() => { const i = Math.round(pager.scrollLeft / pager.clientWidth); const k = (ONGLETS[i] || ONGLETS[0])[0]; if (k !== onglet) marquer(k); }, 90);
  }, { passive: true });
  addEventListener('resize', () => { pager.scrollLeft = ONGLETS.findIndex(([x]) => x === onglet) * pager.clientWidth; ajuster(); });

  main.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-retirer]');
    if (r) {
      r.disabled = true;
      await window.SOZO_HORS.retirer(r.dataset.retirer);
      telecharges = await window.SOZO_HORS.liste();
      S.toast('Retiré de cet appareil.'); peindre('telechargements'); return;
    }
    const a = e.target.closest('[data-desabo]');
    if (a) {
      a.disabled = true;
      const q = await window.SOZO_API('DELETE', `/api/profils/${a.dataset.desabo.slice(1)}/abonnement`);
      if (!q.ok) { a.disabled = false; S.toast(q.d.erreur || 'Le serveur a refusé.'); return; }
      auteurs = auteurs.filter((x) => x.id !== a.dataset.desabo); peindre('abonnements'); peindreNombres();
      S.toast('Vous ne suivez plus cet auteur.');
    }
  });
  addEventListener('hashchange', () => { const k = location.hash.slice(1); if (ONGLETS.some(([x]) => x === k) && k !== onglet) aller(k); });
  const barre = $('#pfBarre');
  addEventListener('scroll', () => barre.classList.toggle('is-defile', scrollY > 12), { passive: true });

  peindreNombres();
  ONGLETS.forEach(([k]) => peindre(k));
  pager.scrollLeft = ONGLETS.findIndex(([x]) => x === onglet) * pager.clientWidth;
  marquer(onglet);
  S.majCloche();
  // ce qui ne vient pas du catalogue arrive ensuite, sans bloquer l'écran
  const [ab, co, te, me] = await Promise.all([
    window.SOZO_API('GET', '/api/abonnements'),
    window.SOZO_API('GET', '/api/moi/commentaires'),
    window.SOZO_HORS ? window.SOZO_HORS.liste().catch(() => []) : Promise.resolve([]),
    window.SOZO_API('GET', '/api/mes-ecrits')
  ]);
  auteurs = ab.ok ? ab.d.auteurs : [];
  commentaires = co.ok ? co.d.commentaires : [];
  telecharges = te;
  ecrits = me.ok ? me.d.ecrits : [];
  ['abonnements', 'commentaires', 'telechargements', 'ecrits'].forEach(peindre);
  peindreNombres();
}).catch(window.SOZO_ERREUR);
