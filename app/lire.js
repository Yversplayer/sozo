/* ═══════════════════════════════════════════════════════════
   Sōzō — la liseuse. Rendue dans l'application : aucun fichier n'est proposé
   au téléchargement (cahier des charges §15).
   Ce qui s'affiche dépend de SOZO.access() — et rien d'autre :
     free / owned → le texte ; locked → la page floutée et un cadenas ;
     soon → la date, jamais le contenu ; brouillon → la page n'existe pas.

   19/10/2026, demandes du propriétaire :
   · trois façons de lire : page par page, en glissant (gauche → droite),
     ou en défilement continu (haut → bas, « comme un document Word ») ;
   · un mode concentration ; des passages à épingler ;
   · une page payante = la page floutée, un cadenas dessus. Le flou est fait
     de mots de remplissage : le texte d'une page fermée n'est JAMAIS envoyé ;
   · la mise en page choisie par l'auteur (police, lettrine, séparateurs).
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const API = window.SOZO_API;
  const b = S.book(S.q('id') || '');
  const body = document.body;

  /* réglages de lecture : préférence de l'appareil (stockage optionnel) */
  const PREF = 'sozo-liseuse';
  let pref = { fs: 20, w: 'm', mode: 'light', defil: 'page', auteur: true, focusP: true };
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(PREF)); } catch (e) {}
  if (stored) pref = { ...pref, ...stored };
  else if (window.SozoTheme && SozoTheme.get() === 'dark') pref.mode = 'dark';   // première visite : suit le thème du site
  if (!['page', 'glisser', 'continu'].includes(pref.defil)) pref.defil = 'page';
  const save = () => { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  const W = { s: '32em', m: '38em', l: '46em' };
  const apply = () => {
    body.dataset.mode = pref.mode;
    body.dataset.defil = pref.defil;
    body.style.setProperty('--rd-fs', pref.fs + 'px');
    body.style.setProperty('--rd-w', W[pref.w]);
  };
  apply();

  if (!b) { body.innerHTML = `<main class="rd-main"><div class="empty"><strong>Livre introuvable</strong><br><a class="btn" href="explorer.html">Retour au catalogue</a></div></main>`; return; }
  const visible = S.visiblePages(b);                  // brouillons exclus
  let n = +S.q('p') || (visible[0] && visible[0].n);
  const a = S.author(b.author);
  const pg = () => (pref.auteur && b.apparence && b.apparence.page) || {};
  const poeme = b.cat === 'Poésie' || b.verse;

  /* ─── barre du haut ─── */
  const top = document.createElement('header');
  top.className = 'rd-top';
  const seg = (k, opts) => `<div class="seg-c">${opts.map(([v, l]) => `<button type="button" data-${k}="${v}" aria-pressed="${String(pref[k] === v)}">${l}</button>`).join('')}</div>`;
  top.innerHTML = `
    <a class="icon-btn" href="livre.html?id=${encodeURIComponent(b.id)}" aria-label="Retour à la fiche du livre">${S.icon('left')}</a>
    <div class="rd-title"><strong>${S.esc(b.title)}</strong><span id="rdOu"></span></div>
    <button class="icon-btn" type="button" id="chercheBtn" aria-expanded="false" aria-controls="chercheL" aria-label="Chercher dans ce livre" title="Chercher dans ce livre">${S.icon('search')}</button>
    <button class="icon-btn" type="button" id="signetBtn" aria-pressed="false" aria-label="Marque-page sur cette page" title="Marque-page">${S.icon('garder')}</button>
    <button class="icon-btn" type="button" id="voixBtn" aria-pressed="false" aria-label="Écouter la page" title="Écouter la page">${S.icon('bulle')}</button>
    <button class="icon-btn" type="button" id="pinsBtn" aria-expanded="false" aria-controls="pins" aria-label="Mes épingles">${S.icon('tag')}<span class="dot dot--abs" id="pinsN" hidden></span></button>
    <button class="icon-btn" type="button" id="focusBtn" aria-pressed="false" aria-label="Mode concentration">${S.icon('eye')}</button>
    <button class="icon-btn" type="button" id="setBtn" aria-expanded="false" aria-controls="settings" aria-label="Réglages de lecture">${S.icon('type')}</button>
    <span class="rd-prog" id="rdProg"></span>
    <div class="rd-settings" id="settings" role="group" aria-label="Réglages de lecture">
      <div><p>Défilement</p>${seg('defil', [['page', 'Page à page'], ['glisser', 'Glisser ⇆'], ['continu', 'Continu ⇅']])}</div>
      <div><p>Taille du texte</p><div class="seg-c"><button type="button" data-fs="-2" aria-label="Réduire le texte">A−</button><button type="button" data-fs="0" aria-label="Taille par défaut">${S.icon('type')}</button><button type="button" data-fs="2" aria-label="Agrandir le texte">A+</button></div></div>
      <div><p>Largeur de ligne</p>${seg('w', [['s', 'Étroite'], ['m', 'Moyenne'], ['l', 'Large']])}</div>
      <div><p>Ambiance</p>${seg('mode', [['light', 'Clair'], ['sepia', 'Sépia'], ['dark', 'Sombre']])}</div>
      <label class="rd-coche"><input type="checkbox" id="prefAuteur"${pref.auteur ? ' checked' : ''}> Mise en page de l’auteur</label>
      <label class="rd-coche"><input type="checkbox" id="prefFocusP"${pref.focusP ? ' checked' : ''}> En concentration, éclairer le paragraphe lu</label>
    </div>
    <aside class="rd-pins rd-cherche" id="chercheL" hidden aria-label="Chercher dans ce livre"><div class="rd-pins-h"><strong>Chercher dans ce livre</strong><button class="icon-btn" type="button" id="chercheX" aria-label="Fermer">${S.icon('x')}</button></div>
      <form id="chercheF" role="search"><label class="search search--sm"><span class="sr">Mot ou phrase</span>${S.icon('search')}<input type="search" id="chercheQ" placeholder="Un mot, une phrase…" autocomplete="off"></label></form>
      <p class="ash rd-cherche-n">Seules les pages que vous pouvez lire sont parcourues.</p><div id="chercheR" aria-live="polite"></div></aside>
    <aside class="rd-pins" id="pins" hidden aria-label="Mes épingles dans ce livre"><div class="rd-pins-h"><strong>Mes épingles</strong><button class="icon-btn" type="button" id="pinsX" aria-label="Fermer">${S.icon('x')}</button></div><div id="pinsL"></div></aside>`;
  body.prepend(top);
  const sortie = document.createElement('button');
  sortie.type = 'button'; sortie.className = 'rd-sortie btn btn--sm'; sortie.innerHTML = `${S.icon('x')} Quitter la concentration`;
  body.appendChild(sortie);

  const main = $('#main');

  /* ─── une page : en-tête + contenu selon son état ─── */
  const countdown = (iso) => {
    const ms = Math.max(0, S.parse(iso) - S.now());
    return [[Math.floor(ms / 864e5), 'jours'], [Math.floor(ms / 36e5) % 24, 'heures'], [Math.floor(ms / 6e4) % 60, 'min']]
      .map(([v, l]) => `<b>${v}<small>${l}</small></b>`).join('');
  };
  // Mots de remplissage pour le flou : RIEN du vrai texte (il n'est pas envoyé)
  const MOTS = 'la lumière chemin parole matin silence cœur prière route maison fleuve espérance grâce pain foi ville jour nuit main voix promesse souffle enfant eau'.split(' ');
  function flou(k) {
    let x = (k * 7919) % 2147483647 || 1, out = '';
    const tirer = () => (x = (x * 48271) % 2147483647);
    for (let l = 0; l < 7; l++) {
      let p = '';
      const nb = 22 + (tirer() % 18);
      for (let i = 0; i < nb; i++) p += MOTS[tirer() % MOTS.length] + ' ';
      out += `<p>${p}</p>`;
    }
    return out;
  }
  function verrou(p) {
    if (b.demo) {
      return `<div class="rd-verrou"><div class="rd-flou" aria-hidden="true">${flou(p.n)}</div>
        <div class="rd-cadenas"><span class="rd-cadenas-ic">${S.icon('lock')}</span><strong>Page payante d’un livre d’exemple</strong><small>Ce livre montre comment une page payante se présente. Il ne se vend pas.</small></div></div>`;
    }
    const opts = S.buy.options(b, p.n);
    const des = opts.length ? Math.min(...opts.map((o) => o.price)) : null;
    return `<div class="rd-verrou"><div class="rd-flou" aria-hidden="true">${flou(p.n)}</div>
      <div class="rd-cadenas"><span class="rd-cadenas-ic">${S.icon('lock')}</span><strong>Page ${p.n} payante</strong>
        ${des != null ? `<button class="btn btn--accent btn--sm" type="button" data-debloquer="${p.n}">Débloquer · dès ${S.money(des)}</button>` : '<small>Cette page n’est pas à vendre séparément.</small>'}</div></div>`;
  }
  function entete(p) {
    const st = S.access(b, p.n), ch = S.chapterOf(b, p.n);
    const badge = {
      free: `<span class="badge badge--free">Gratuite</span>`,
      owned: `<span class="badge badge--owned">${S.icon('check')} Achetée</span>`,
      locked: `<span class="badge badge--locked">${S.icon('lock')} Payante</span>`,
      soon: `<span class="badge badge--soon">${S.icon('clock')} À venir</span>`
    }[st] || '';
    return `<p class="rd-chap">${ch ? S.esc(ch.t) : ''}</p><div class="rd-page-h"><h1>Page ${p.n}</h1>${badge}</div>`;
  }
  function corps(p) {
    const st = S.access(b, p.n);
    if (S.readable(st)) return `<div class="rd-zone" data-texte="${p.n}" aria-busy="true"><p class="ash"><span class="spin" style="display:inline-block;vertical-align:-3px"></span> Chargement de la page…</p></div>`;
    if (st === 'locked') return verrou(p);
    if (st === 'soon') {
      const suivi = S.isFollowed(b.id);
      return `<div class="when">${S.icon('calendar')}
        <p class="mono">Page ${p.n} — disponible le</p>
        <strong>${S.esc(S.dayLong(S.parse(p.date)))}</strong>
        <span>à ${S.parse(p.date).getHours()} h</span>
        <div class="cd" data-cd="${S.esc(p.date)}" aria-label="Temps restant">${countdown(p.date)}</div>
        <em>Le contenu de cette page reste invisible jusqu'à sa parution.</em>
        <button class="btn${suivi ? ' is-on' : ''}" type="button" data-suivre aria-pressed="${suivi}">${S.icon(suivi ? 'check' : 'bell')} ${suivi ? 'Vous suivez ce livre' : 'Suivre pour être prévenu'}</button>
      </div>`;
    }
    return '';
  }
  const feuille = (p) => `<article class="rd-feuille" data-n="${p.n}" aria-label="Page ${p.n}">${entete(p)}${corps(p)}</article>`;

  /* Le texte vient du serveur, une page à la fois, SEULEMENT si le serveur
     l'autorise. Une page achetée porte le filigrane renvoyé par le serveur. */
  function rendreTexte(k, d) {
    if (b.format === 'planche') {
      const i0 = (k * 3) % D.panels.length;
      return `<div class="planche">${[0, 1, 2].map((i) => `<figure><img src="${S.img(D.panels[(i0 + i) % D.panels.length])}" alt="Case ${i + 1} de la planche ${k}"><figcaption>${S.esc(D.bubbles[(k + i) % D.bubbles.length])}</figcaption></figure>`).join('')}</div>`
        + (d.contenu ? `<div class="rd-text"><p>${S.esc(d.contenu)}</p></div>` : '');
    }
    if (!d.contenu || !d.contenu.trim()) return `<div class="empty"><strong>Page vide</strong>L'auteur n'a pas encore écrit cette page.</div>`;
    const m = pg();
    return `<div class="rd-text ${S.mise.classes(m)}${poeme ? ' is-poem' : ''}${d.filigrane ? ' is-protege' : ''}" style="${S.esc(S.mise.style(m))}" data-page="${k}">${S.mise.paragraphes(d.contenu, m)}</div>`
      + (d.filigrane ? `<p class="rd-filigrane">${S.icon('shield')} ${S.esc(d.filigrane)} · reproduction interdite</p>` : '');
  }
  const charges = new Set();
  async function chargerTexte(zone) {
    const k = +zone.dataset.texte;
    if (charges.has(k)) return;
    charges.add(k);
    const r = await API('GET', `/api/livres/${encodeURIComponent(b.id)}/pages/${k}`);
    if (!zone.isConnected) return;
    zone.removeAttribute('aria-busy');
    if (r.ok) {
      zone.innerHTML = rendreTexte(k, r.d);
      if (r.d.filigrane) protegerCopie(zone);
      surlignerEpingles(zone);
      if (r.d.etat !== 'auteur' && k === n) progression(k);
    } else if (r.status === 402 || r.status === 403) {
      location.reload();                                   // l'état a changé depuis l'ouverture : on recharge
    } else {
      charges.delete(k);
      zone.innerHTML = `<div class="empty"><strong>Page indisponible</strong>${S.esc(r.d.erreur || 'Le serveur ne répond pas.')}</div>`;
    }
  }
  let tProg;
  function progression(k) {
    const p = b.pages.find((x) => x.n === k);
    if (!p || p.etat === 'auteur' || !['free', 'owned'].includes(p.etat)) return;   // l'auteur relit : pas de progression
    clearTimeout(tProg); tProg = setTimeout(() => API('PUT', '/api/moi/progression', { livre: b.id, n: k }), 900);
  }

  /* Page achetée : la copie est limitée à une citation (300 signes), suivie de
     sa source — comme les liseuses du commerce. Ce n'est pas une protection
     absolue (rien n'empêche une photo de l'écran) : c'est une dissuasion, et la
     marque invisible du serveur désigne le compte d'une copie qui circule. */
  function protegerCopie(zone) {
    zone.addEventListener('copy', (e) => {
      const t = String(window.getSelection() || '');
      if (t.length <= 300) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', t.slice(0, 300) + `… — « ${b.title} », ${a.name}, sur Sōzō`);
      S.toast('Copie limitée à une citation de 300 signes.');
    });
  }

  /* ─── rendu selon le défilement choisi ─── */
  let observateurs = [];
  function rendre() {
    observateurs.forEach((o) => o.disconnect()); observateurs = [];
    charges.clear();
    $$('.rd-nav, .rd-strip').forEach((x) => x.remove());
    const ici = visible.find((p) => p.n === n);
    if (!ici) {
      main.innerHTML = `<article class="rd-main"><div class="empty"><strong>Cette page n'est pas publiée</strong>Elle n'existe pas, ou l'auteur la prépare encore.<br><br><a class="btn btn--ghost" href="livre.html?id=${encodeURIComponent(b.id)}">Voir le sommaire</a></div></article>`;
      ou(); return;
    }
    if (pref.defil === 'page') {
      main.innerHTML = `<div class="rd-flux rd-flux--page"><div class="rd-main">${feuille(ici)}</div></div>`;
      const idx = visible.indexOf(ici), prev = visible[idx - 1], next = visible[idx + 1];
      const nav = document.createElement('nav');
      nav.className = 'rd-nav'; nav.setAttribute('aria-label', 'Pages');
      nav.innerHTML = `${prev ? `<a class="btn" href="lire.html?id=${encodeURIComponent(b.id)}&p=${prev.n}" rel="prev" data-aller="${prev.n}">${S.icon('left')} Page ${prev.n}</a>` : '<span></span>'}
        ${next ? `<a class="btn" href="lire.html?id=${encodeURIComponent(b.id)}&p=${next.n}" rel="next" data-aller="${next.n}">Page ${next.n} ${S.icon('right')}</a>` : `<a class="btn" href="livre.html?id=${encodeURIComponent(b.id)}">Fin des pages parues</a>`}`;
      main.after(nav);
      nav.after(bande());
      $$('[data-texte]', main).forEach(chargerTexte);
      progression(n);
    } else {
      const glisser = pref.defil === 'glisser';
      main.innerHTML = `<div class="rd-flux rd-flux--${pref.defil}" id="flux">${visible.map((p) => `<div class="rd-main">${feuille(p)}</div>`).join('')}</div>`;
      main.after(bande());
      const flux = $('#flux');
      // Le texte se charge à l'approche ; la page « courante » est celle qui occupe l'écran
      const o1 = new IntersectionObserver((es) => es.forEach((e) => {
        const z = e.target.querySelector('[data-texte]');
        if (e.isIntersecting && z) chargerTexte(z);
      }), { root: glisser ? flux : null, rootMargin: glisser ? '0px 120% 0px 120%' : '900px 0px' });
      const o2 = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { n = +e.target.dataset.n; ou(); progression(n); }
      }), { root: glisser ? flux : null, rootMargin: glisser ? '0px' : '-45% 0px -50% 0px', threshold: glisser ? 0.6 : 0 });
      observateurs = [o1, o2];
      // On se place D'ABORD sur la page demandée (sans animation), puis on
      // observe : sinon la page 1, visible un instant, devenait « courante ».
      const cible = flux.querySelector(`[data-n="${n}"]`);
      if (cible) {
        if (glisser) { flux.style.scrollBehavior = 'auto'; flux.scrollLeft = cible.parentElement.offsetLeft; flux.style.scrollBehavior = ''; }
        else cible.scrollIntoView({ block: 'start' });
      }
      // La page demandée et ses voisines se chargent TOUT DE SUITE : un onglet en
      // arrière-plan retarde l'observation, le lecteur ne doit pas attendre.
      const i0 = visible.findIndex((p) => p.n === n);
      visible.slice(Math.max(0, i0 - 1), i0 + 2).forEach((p) => { const z = flux.querySelector(`[data-texte="${p.n}"]`); if (z) chargerTexte(z); });
      // un minuteur et non requestAnimationFrame : un onglet en arrière-plan suspend les images, pas les minuteurs
      setTimeout(() => $$('.rd-feuille', flux).forEach((el) => { o1.observe(el); o2.observe(el); }), 0);
    }
    ou();
  }
  function bande() {
    const el = document.createElement('div');
    el.className = 'rd-strip';
    el.innerHTML = `<div class="strip" aria-label="Toutes les pages">${visible.map((p) => {
      const s = S.access(b, p.n), cls = { free: 'st-free', owned: 'st-owned', locked: 'st-locked', soon: 'st-soon' }[s];
      return `<a class="${cls}${p.n === n ? ' is-here' : ''}" href="lire.html?id=${encodeURIComponent(b.id)}&p=${p.n}" data-aller="${p.n}"${p.n === n ? ' aria-current="page"' : ''} aria-label="Page ${p.n}">${p.n}</a>`;
    }).join('')}</div><div class="legend"><span><i class="st-free"></i>Gratuite</span><span><i class="st-owned"></i>Achetée</span><span><i class="st-locked"></i>Payante</span><span><i class="st-soon"></i>À venir</span></div>`;
    return el;
  }
  /* où l'on en est : titre, barre de progression, adresse (sans recharger) */
  function ou() {
    const idx = visible.findIndex((p) => p.n === n);
    $('#rdOu').textContent = `${idx >= 0 ? `Page ${n} sur ${visible.length}` : 'Page introuvable'} · ${a.name}`;
    $('#rdProg').style.width = idx >= 0 ? `${((idx + 1) / visible.length) * 100}%` : '0';
    document.title = `${b.title}, page ${n} — Sōzō`;
    history.replaceState(null, '', `lire.html?id=${encodeURIComponent(b.id)}&p=${n}`);
    $$('.rd-strip a').forEach((x) => { const ici = +x.dataset.aller === n; x.classList.toggle('is-here', ici); if (ici) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
    majSignet();
  }

  /* ─── Lot D (22/10/2026) : marque-pages, recherche dans le livre, voix ─── */
  let signets = [];
  function majSignet() {
    const bt = document.getElementById('signetBtn'); if (!bt) return;
    const on = signets.some((x) => x.n === n);
    bt.setAttribute('aria-pressed', String(on));
    bt.setAttribute('aria-label', on ? `Retirer le marque-page de la page ${n}` : `Poser un marque-page sur la page ${n}`);
  }
  API('GET', `/api/signets?livre=${encodeURIComponent(b.id)}`).then((r) => { if (r.ok) { signets = r.d.signets; majSignet(); } });
  function aller(k) {
    if (!visible.some((p) => p.n === k)) return;
    n = k;
    if (pref.defil === 'page') { rendre(); scrollTo(0, 0); return; }
    const cible = document.querySelector(`#flux [data-n="${k}"]`);
    if (!cible) return;
    if (pref.defil === 'glisser') $('#flux').scrollTo({ left: cible.parentElement.offsetLeft, behavior: S.reduced ? 'auto' : 'smooth' });
    else cible.scrollIntoView({ behavior: S.reduced ? 'auto' : 'smooth', block: 'start' });
  }

  /* ─── épingles ─── */
  let epingles = [];
  const INVISIBLES = /[​‌‍⁠﻿]/g;
  const nettoie = (t) => String(t || '').replace(INVISIBLES, '').replace(/'/g, '’').replace(/\s+/g, ' ').trim();
  async function chargerEpingles() {
    const r = await API('GET', `/api/epingles?livre=${encodeURIComponent(b.id)}`);
    if (!r.ok) return;
    epingles = r.d.epingles;
    majPins();
    $$('.rd-text[data-page]').forEach((t) => surlignerEpingles(t.parentElement));
  }
  function majPins() {
    const c = $('#pinsN'); c.hidden = !epingles.length; c.textContent = epingles.length;
    $('#pinsL').innerHTML = epingles.length ? epingles.map((e) => `<div class="rd-pin"><blockquote>« ${S.esc(e.extrait)} »</blockquote>
        <div><button type="button" class="btn btn--ghost btn--sm" data-aller="${e.n}">Page ${e.n}</button> <button type="button" class="btn btn--ghost btn--sm" data-desepingler="${e.id}">Retirer</button></div></div>`).join('')
      : `<p class="ash">Sélectionnez un passage dans une page que vous pouvez lire, puis touchez « Épingler ». Vos épingles vous suivent sur tous vos appareils.</p>`;
  }
  /* Surligne un extrait dans un paragraphe, même coupé par un lien biblique */
  function surlignerEpingles(zone) {
    const t = zone && zone.querySelector('.rd-text[data-page]'); if (!t) return;
    const k = +t.dataset.page;
    epingles.filter((e) => e.n === k && !t.querySelector(`mark.pin[data-epingle="${e.id}"]`)).forEach((e) => {
      const cible = nettoie(e.extrait);
      for (const p of t.querySelectorAll('p')) {
        const propre = p.textContent.replace(INVISIBLES, '').replace(/'/g, '’');
        const debut = propre.indexOf(cible);
        if (debut < 0) continue;
        marquer(p, debut, debut + cible.length, e.id);
        break;
      }
    });
  }
  function marquer(p, debut, fin, id) {
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let pos = 0, nd; const morceaux = [];
    while ((nd = w.nextNode())) {
      const txt = nd.nodeValue.replace(INVISIBLES, '');
      const a0 = pos, a1 = pos + txt.length;
      if (a1 > debut && a0 < fin && txt.length === nd.nodeValue.length) morceaux.push([nd, Math.max(0, debut - a0), Math.min(txt.length, fin - a0)]);
      pos = a1;
    }
    morceaux.forEach(([nd, x, y]) => {
      const r = document.createRange(); r.setStart(nd, x); r.setEnd(nd, y);
      const m = document.createElement('mark'); m.className = 'pin'; m.dataset.epingle = id; m.title = 'Passage épinglé';
      try { r.surroundContents(m); } catch (er) {}
    });
  }
  // Bouton flottant « Épingler » sur une sélection dans une page lisible
  const bulle = document.createElement('div');
  bulle.className = 'rd-bulle'; bulle.hidden = true;
  bulle.innerHTML = `<button type="button" class="btn btn--accent btn--sm" id="epingler">${S.icon('tag')} Épingler</button>`;
  body.appendChild(bulle);
  let selection = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(bulle._t);
    bulle._t = setTimeout(() => {
      const sel = getSelection();
      const r0 = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : null;
      const noeud = r0 && r0.commonAncestorContainer;
      const page = noeud && (noeud.nodeType === 1 ? noeud : noeud.parentElement).closest('.rd-text[data-page]');
      const texte = nettoie(sel && sel.toString());
      if (!page || texte.length < 2) { bulle.hidden = true; selection = null; return; }
      selection = { n: +page.dataset.page, texte, protege: page.classList.contains('is-protege') };
      const r = r0.getBoundingClientRect();
      bulle.hidden = false;
      bulle.style.left = `${Math.max(8, Math.min(innerWidth - 150, r.left + r.width / 2 - 60))}px`;
      bulle.style.top = `${Math.max(64, r.top - 52) + scrollY}px`;
    }, 220);
  });
  $('#epingler', bulle).addEventListener('mousedown', (e) => e.preventDefault());   // garder la sélection
  $('#epingler', bulle).addEventListener('click', async () => {
    if (!selection) return;
    const max = selection.protege ? 300 : 600;
    if (selection.texte.length > max) { S.toast(`Un passage épinglé garde ${max} signes au plus${selection.protege ? ' sur une page achetée' : ''}.`); return; }
    const btn = $('#epingler', bulle); btn.disabled = true;
    const r = await API('POST', '/api/epingles', { livre: b.id, n: selection.n, extrait: selection.texte });
    btn.disabled = false;
    if (!r.ok) { S.toast(r.d.erreur || 'Épingle refusée.'); return; }
    epingles.unshift(r.d.epingle); majPins();
    getSelection().removeAllRanges(); bulle.hidden = true;
    const zone = document.querySelector(`.rd-text[data-page="${r.d.epingle.n}"]`);
    if (zone) surlignerEpingles(zone.parentElement);
    S.toast('Passage épinglé : retrouvez-le ici et dans votre bibliothèque.');
  });

  /* ─── concentration : rien que le texte ─── */
  function concentration(on) {
    body.classList.toggle('is-focus', on);
    $('#focusBtn').setAttribute('aria-pressed', String(on));
    if (on) { $('#settings').classList.remove('is-open'); $('#setBtn').setAttribute('aria-expanded', 'false'); sortie.focus(); S.toast('Concentration : Échap ou le bouton en bas pour revenir.'); }
    else $('#focusBtn').focus();
    eclairer();
  }
  /* 21/10/2026, le propriétaire : « pourquoi doit-on commencer à se concentrer
     seulement au milieu de l'écran ? Dès les premières lignes, on doit avoir
     l'effet. » Le paragraphe éclairé était celui le plus proche du MILIEU de
     l'écran : en haut d'une page, les premières lignes restaient éteintes.
     Désormais une LIGNE DE LECTURE, au tiers de l'écran, éclaire le premier
     paragraphe qui la dépasse ; en haut de page (rien encore défilé), c'est
     le premier paragraphe. Un toucher sur un paragraphe, ou ↑ / ↓, choisit
     soi-même où l'on en est. */
  let tEcl, choisi = null;
  // les blocs de lecture : paragraphes, titres, citations (enfants directs du texte)
  const BLOCS = '.rd-text > p:not(.pg-sep), .rd-text > .pg-t, .rd-text > .pg-cit';
  const paragraphesVus = () => $$(BLOCS).filter((p) => {
    const r = p.getBoundingClientRect();
    return r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  });
  function poser(best) {
    $$('.rd-text .is-lu').forEach((p) => p !== best && p.classList.remove('is-lu'));
    if (best) best.classList.add('is-lu');
  }
  function eclairer() {
    cancelAnimationFrame(tEcl);
    const faire = () => {
      if (!body.classList.contains('is-focus') || !pref.focusP) { poser(null); return; }
      if (choisi && choisi.isConnected) { const r = choisi.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) { poser(choisi); return; } }
      choisi = null;
      const vus = paragraphesVus();
      if (!vus.length) { poser(null); return; }
      const ligne = innerHeight * 0.34;
      const enHaut = (document.scrollingElement || document.documentElement).scrollTop < 8;
      poser(enHaut ? vus[0] : (vus.find((p) => p.getBoundingClientRect().bottom > ligne) || vus[vus.length - 1]));
    };
    tEcl = requestAnimationFrame(faire);
    setTimeout(faire, 120);          // si l'onglet ne peint pas (arrière-plan), l'état reste juste
  }
  // capture : le défilement d'un conteneur (mode « glisser ») compte aussi
  addEventListener('scroll', () => { choisi = null; eclairer(); }, { passive: true, capture: true });
  document.addEventListener('click', (e) => {
    if (!body.classList.contains('is-focus') || !pref.focusP || getSelection().toString()) return;
    const p = e.target.closest('.rd-text > :is(p:not(.pg-sep), .pg-t, .pg-cit)');
    if (p) { choisi = p; poser(p); }
  });
  function deplacer(sens) {
    const tous = $$(BLOCS).filter((p) => p.getBoundingClientRect().height);
    const ici = $('.rd-text .is-lu');
    const i = Math.max(0, Math.min(tous.length - 1, tous.indexOf(ici) + sens));
    const p = tous[i]; if (!p) return;
    choisi = p; poser(p);
    const r = p.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight - 60) scrollBy({ top: r.top - innerHeight * 0.3, behavior: S.reduced ? 'auto' : 'smooth' });
  }
  sortie.addEventListener('click', () => concentration(false));

  /* ─── interactions ─── */
  const setBtn = $('#setBtn'), panel = $('#settings'), pins = $('#pins');
  setBtn.addEventListener('click', () => { const o = panel.classList.toggle('is-open'); setBtn.setAttribute('aria-expanded', String(o)); });
  document.addEventListener('click', (e) => { if (!top.contains(e.target)) { panel.classList.remove('is-open'); setBtn.setAttribute('aria-expanded', 'false'); } });
  $('#signetBtn').addEventListener('click', async () => {
    const bt = $('#signetBtn'), ex = signets.find((x) => x.n === n);
    bt.disabled = true;
    const r = ex ? await API('DELETE', `/api/signets/${ex.id}`) : await API('POST', '/api/signets', { livre: b.id, n });
    bt.disabled = false;
    if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
    signets = ex ? signets.filter((x) => x !== ex) : [...signets, { id: r.d.id, n }];
    majSignet(); S.toast(ex ? 'Marque-page retiré.' : `Marque-page posé sur la page ${n}. Retrouvez-le dans votre bibliothèque.`);
  });
  const cherche = $('#chercheL');
  const chercheBasc = (o) => { cherche.hidden = !o; $('#chercheBtn').setAttribute('aria-expanded', String(o)); if (o) setTimeout(() => $('#chercheQ').focus(), 30); };
  $('#chercheBtn').addEventListener('click', () => chercheBasc(cherche.hidden));
  $('#chercheX').addEventListener('click', () => { chercheBasc(false); $('#chercheBtn').focus(); });
  let tC;
  const lancerRecherche = async () => {
    const q = $('#chercheQ').value.trim(), z = $('#chercheR');
    if (q.length < 2) { z.innerHTML = ''; return; }
    z.innerHTML = '<p class="ash"><span class="spin" aria-hidden="true"></span> Recherche…</p>';
    const r = await API('GET', `/api/livres/${encodeURIComponent(b.id)}/recherche?q=${encodeURIComponent(q)}`);
    if (!r.ok) { z.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'La recherche n’a pas abouti.')}</span></p>`; return; }
    z.innerHTML = r.d.resultats.length ? `<ol class="rd-cherche-l">${r.d.resultats.map((x) => `<li><a href="lire.html?id=${encodeURIComponent(b.id)}&p=${x.n}" data-aller="${x.n}"><strong>Page ${x.n}</strong> ${S.esc(x.extrait)}</a></li>`).join('')}</ol>`
      : '<p class="ash">Rien trouvé dans les pages que vous pouvez lire.</p>';
  };
  $('#chercheQ').addEventListener('input', () => { clearTimeout(tC); tC = setTimeout(lancerRecherche, 400); });
  $('#chercheF').addEventListener('submit', (e) => { e.preventDefault(); lancerRecherche(); });
  $('#chercheR').addEventListener('click', (e) => { const l = e.target.closest('[data-aller]'); if (!l || pref.defil !== 'page') return; e.preventDefault(); aller(+l.dataset.aller); chercheBasc(false); });
  /* Écouter la page : la voix du téléphone (synthèse vocale du navigateur). On
     choisit une voix INSTALLÉE sur l'appareil quand il y en a une : le texte ne
     part alors nulle part. Sinon, on le dit avant de lire. */
  const voixBt = $('#voixBtn');
  if (!('speechSynthesis' in window)) voixBt.hidden = true;
  const voixLocale = () => { const vs = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang)); return vs.find((v) => v.localService) || null; };
  voixBt.addEventListener('click', () => {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); voixBt.setAttribute('aria-pressed', 'false'); return; }
    const zone = document.querySelector(pref.defil === 'page' ? '.rd-text[data-page]' : `#flux [data-n="${n}"] .rd-text, .rd-text[data-page="${n}"]`);
    const t = zone ? zone.innerText.replace(/[​‌‍⁠﻿]/g, '').trim() : '';
    if (!t) { S.toast('Cette page n’a pas de texte à lire pour vous.'); return; }
    const parler = () => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'fr-FR'; u.rate = 0.95;
      const loc = voixLocale(); if (loc) u.voice = loc;
      u.onend = u.onerror = () => voixBt.setAttribute('aria-pressed', 'false');
      speechSynthesis.speak(u); voixBt.setAttribute('aria-pressed', 'true');
    };
    if (!voixLocale() && localStorage.getItem('sozo-voix-ok') !== '1') {
      S.modal({ title: 'Écouter la page', body: '<p>Ce navigateur n’a pas de voix française installée sur l’appareil : sa voix passe par Internet (le texte de la page est alors envoyé au service vocal du navigateur).</p>',
        actions: [{ label: 'Annuler' }, { label: 'Écouter quand même', primary: true, onClick: (close) => { close(); try { localStorage.setItem('sozo-voix-ok', '1'); } catch (er) {} parler(); } }] });
      return;
    }
    parler();
  });
  addEventListener('pagehide', () => { try { speechSynthesis.cancel(); } catch (e) {} });
  const pinsBasc = (o) => { pins.hidden = !o; $('#pinsBtn').setAttribute('aria-expanded', String(o)); };
  $('#pinsBtn').addEventListener('click', () => pinsBasc(pins.hidden));
  $('#pinsX').addEventListener('click', () => pinsBasc(false));
  $('#focusBtn').addEventListener('click', () => concentration(!body.classList.contains('is-focus')));
  const presse = (sel, k) => panel.querySelectorAll(sel).forEach((y) => y.setAttribute('aria-pressed', String(y.dataset[k] === pref[k])));
  panel.querySelectorAll('[data-fs]').forEach((x) => x.addEventListener('click', () => { const d = +x.dataset.fs; pref.fs = d ? Math.min(28, Math.max(15, pref.fs + d)) : 20; apply(); save(); }));
  panel.querySelectorAll('[data-w]').forEach((x) => x.addEventListener('click', () => { pref.w = x.dataset.w; presse('[data-w]', 'w'); apply(); save(); }));
  panel.querySelectorAll('[data-mode]').forEach((x) => x.addEventListener('click', () => { pref.mode = x.dataset.mode; presse('[data-mode]', 'mode'); apply(); save(); }));
  panel.querySelectorAll('[data-defil]').forEach((x) => x.addEventListener('click', () => { if (pref.defil === x.dataset.defil) return; pref.defil = x.dataset.defil; presse('[data-defil]', 'defil'); apply(); save(); rendre(); }));
  $('#prefAuteur').addEventListener('change', (e) => { pref.auteur = e.target.checked; save(); rendre(); });
  $('#prefFocusP').addEventListener('change', (e) => { pref.focusP = e.target.checked; save(); eclairer(); });

  document.addEventListener('click', async (e) => {
    const al = e.target.closest('[data-aller]');
    if (al && !e.metaKey && !e.ctrlKey) { e.preventDefault(); pinsBasc(false); aller(+al.dataset.aller); return; }
    const de = e.target.closest('[data-desepingler]');
    if (de) {
      de.disabled = true;
      const r = await API('DELETE', `/api/epingles/${+de.dataset.desepingler}`);
      if (!r.ok) { de.disabled = false; S.toast(r.d.erreur || 'Retrait impossible.'); return; }
      epingles = epingles.filter((x) => x.id !== +de.dataset.desepingler);
      $$(`mark.pin[data-epingle="${de.dataset.desepingler}"]`).forEach((m) => m.replaceWith(...m.childNodes));
      majPins(); return;
    }
    const db = e.target.closest('[data-debloquer]');
    if (db) { acheter(+db.dataset.debloquer); return; }
    const sv = e.target.closest('[data-suivre]');
    if (sv) {
      sv.disabled = true;
      const on = await S.toggleFollow(b.id); sv.disabled = false;
      $$('[data-suivre]').forEach((x) => { x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); x.innerHTML = `${S.icon(on ? 'check' : 'bell')} ${on ? 'Vous suivez ce livre' : 'Suivre pour être prévenu'}`; });
      S.toast(on ? 'Vous serez prévenu dans vos notifications à la parution.' : 'Vous ne suivez plus ce livre.');
    }
  });
  /* Le cadenas ouvre le choix : page, chapitre ou livre — le prix avant tout paiement */
  function acheter(k) {
    const opts = S.buy.options(b, k);
    if (!opts.length) return;
    const m = S.modal({ title: `Débloquer la page ${k}`, body: `<p class="ash">${S.esc(a.name)} a choisi de vendre la suite. Ce que vous achetez reste à vous ; aucun fichier n'est téléchargé, la lecture se fait ici.</p>
      <fieldset class="opts"><legend class="sr">Que voulez-vous acheter ?</legend>
      ${opts.map((o, i) => `<label class="opt"><input type="radio" name="opt" value="${i}"${i === 0 ? ' checked' : ''}><span><strong>${S.esc(o.label)}</strong><small>${S.esc(o.detail)}</small></span><strong>${S.money(o.price)}</strong></label>`).join('')}
      </fieldset>`,
      actions: [{ label: 'Annuler' }, { label: 'Continuer', primary: true, onClick: (close) => { const i = +(m.el.querySelector('input[name="opt"]:checked') || { value: 0 }).value; close(); S.buy.recap(b, opts[i]); } }] });
  }
  setInterval(() => $$('[data-cd]').forEach((x) => { x.innerHTML = countdown(x.dataset.cd); }), 30000);

  addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || document.querySelector('.md-wrap')) return;
    if (e.key === 'Escape' && body.classList.contains('is-focus')) { concentration(false); return; }
    if (body.classList.contains('is-focus') && pref.focusP && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !(e.target.closest && e.target.closest('input, textarea, select'))) { e.preventDefault(); deplacer(e.key === 'ArrowDown' ? 1 : -1); return; }
    if (e.key === 'Escape' && !pins.hidden) { pinsBasc(false); return; }
    if (e.key === 'Escape' && panel.classList.contains('is-open')) { panel.classList.remove('is-open'); setBtn.setAttribute('aria-expanded', 'false'); setBtn.focus(); return; }
    if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) { concentration(!body.classList.contains('is-focus')); return; }
    if (pref.defil === 'continu') return;
    const idx = visible.findIndex((p) => p.n === n);
    if (e.key === 'ArrowLeft' && visible[idx - 1]) { e.preventDefault(); aller(visible[idx - 1].n); }
    if (e.key === 'ArrowRight' && visible[idx + 1]) { e.preventDefault(); aller(visible[idx + 1].n); }
  });
  /* page à page : on glisse aussi du doigt */
  let x0 = null, y0 = null;
  main.addEventListener('touchstart', (e) => { if (pref.defil !== 'page') return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  main.addEventListener('touchend', (e) => {
    if (pref.defil !== 'page' || x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || String(getSelection())) return;
    const idx = visible.findIndex((p) => p.n === n);
    const cible = visible[idx + (dx < 0 ? 1 : -1)];
    if (cible) aller(cible.n);
  }, { passive: true });
  /* la barre s'efface quand on lit, revient quand on remonte */
  let lastY = scrollY;
  addEventListener('scroll', () => { const y = scrollY; top.classList.toggle('is-hidden', y > lastY && y > 120 && !panel.classList.contains('is-open') && pins.hidden); lastY = y; }, { passive: true });

  rendre();
  chargerEpingles();
}).catch(window.SOZO_ERREUR);
