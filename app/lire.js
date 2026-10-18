/* ═══════════════════════════════════════════════════════════
   Sōzō — la liseuse. Une page à la fois, rendue dans l'application :
   aucun fichier n'est proposé au téléchargement (cahier des charges §15).
   Ce qui s'affiche dépend de SOZO.access() — et rien d'autre :
     free / owned → le texte ; locked → le prix et l'achat ;
     soon → la date, jamais le contenu ; brouillon → la page n'existe pas.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  const b = S.book(S.q('id') || '');
  const body = document.body;

  /* réglages de lecture : préférence de l'appareil (stockage optionnel) */
  const PREF = 'sozo-liseuse';
  let pref = { fs: 20, w: 'm', mode: 'light' };
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(PREF)); } catch (e) {}
  if (stored) pref = { ...pref, ...stored };
  else if (window.SozoTheme && SozoTheme.get() === 'dark') pref.mode = 'dark';   // première visite : suit le thème du site
  const save = () => { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  const W = { s: '32em', m: '38em', l: '46em' };
  const apply = () => {
    body.dataset.mode = pref.mode;
    body.style.setProperty('--rd-fs', pref.fs + 'px');
    body.style.setProperty('--rd-w', W[pref.w]);
  };
  apply();

  if (!b) { body.innerHTML = `<main class="rd-main"><div class="empty"><strong>Livre introuvable</strong><br><a class="btn" href="decouvrir.html">Retour au catalogue</a></div></main>`; return; }
  const visible = S.visiblePages(b);                  // brouillons exclus
  const n = +S.q('p') || (visible[0] && visible[0].n);
  const page = visible.find((p) => p.n === n);
  const idx = visible.indexOf(page);
  const a = S.author(b.author);
  document.title = `${b.title}, page ${n} — Sōzō`;

  const top = document.createElement('header');
  top.className = 'rd-top';
  top.innerHTML = `
    <a class="icon-btn" href="livre.html?id=${b.id}" aria-label="Retour à la fiche du livre">${S.icon('left')}</a>
    <div class="rd-title"><strong>${S.esc(b.title)}</strong><span>${page ? `Page ${n} sur ${visible.length}` : 'Page introuvable'} · ${S.esc(a.name)}</span></div>
    <button class="icon-btn" type="button" id="setBtn" aria-expanded="false" aria-controls="settings" aria-label="Réglages de lecture">${S.icon('type')}</button>
    <span class="rd-prog" style="width:${page ? ((idx + 1) / visible.length) * 100 : 0}%"></span>
    <div class="rd-settings" id="settings" role="group" aria-label="Réglages de lecture">
      <div><p>Taille du texte</p><div class="seg-c"><button type="button" data-fs="-2" aria-label="Réduire le texte">A−</button><button type="button" data-fs="0" aria-label="Taille par défaut">${S.icon('type')}</button><button type="button" data-fs="2" aria-label="Agrandir le texte">A+</button></div></div>
      <div><p>Largeur de ligne</p><div class="seg-c">${[['s', 'Étroite'], ['m', 'Moyenne'], ['l', 'Large']].map(([k, l]) => `<button type="button" data-w="${k}" aria-pressed="${pref.w === k}">${l}</button>`).join('')}</div></div>
      <div><p>Ambiance</p><div class="seg-c">${[['light', 'Clair'], ['sepia', 'Sépia'], ['dark', 'Sombre']].map(([k, l]) => `<button type="button" data-mode="${k}" aria-pressed="${pref.mode === k}">${l}</button>`).join('')}</div></div>
    </div>`;
  body.prepend(top);

  const main = $('#main');
  const ch = page ? S.chapterOf(b, n) : null;
  const st = page ? S.access(b, n) : null;

  /* Le texte vient du serveur, une page à la fois, et SEULEMENT si le serveur
     l'autorise. Une page achetée porte le filigrane renvoyé par le serveur. */
  function textOf(contenu, filigrane) {
    if (b.format === 'planche') {
      const k = (n * 3) % D.panels.length;
      return `<div class="planche">${[0, 1, 2].map((i) => `<figure><img src="${S.img(D.panels[(k + i) % D.panels.length])}" alt="Case ${i + 1} de la planche ${n}"><figcaption>${S.esc(D.bubbles[(n + i) % D.bubbles.length])}</figcaption></figure>`).join('')}</div>`
        + (contenu ? `<div class="rd-text"><p>${S.esc(contenu)}</p></div>` : '');
    }
    const poem = b.cat === 'Poésie' || b.verse;
    const line = (t) => (S.bible ? S.bible.linkify(t) : S.esc(t)) || '&nbsp;';   // « Ps 23:4 » → lien vers la Bible intégrée
    const lignes = (contenu || '').split('\n');
    if (!contenu || !contenu.trim()) return `<div class="empty"><strong>Page vide</strong>L'auteur n'a pas encore écrit cette page.</div>`;
    return `<div class="rd-text${poem ? ' is-poem' : ''}${filigrane ? ' is-protege' : ''}">${lignes.map((t) => `<p>${line(t)}</p>`).join('')}</div>`
      + (filigrane ? `<p class="rd-filigrane">${S.icon('shield')} ${S.esc(filigrane)} · reproduction interdite</p>` : '');
  }

  const countdown = (iso) => {
    const ms = Math.max(0, S.parse(iso) - S.now());
    return [[Math.floor(ms / 864e5), 'jours'], [Math.floor(ms / 36e5) % 24, 'heures'], [Math.floor(ms / 6e4) % 60, 'min']]
      .map(([v, l]) => `<b>${v}<small>${l}</small></b>`).join('');
  };

  let content = '';
  if (!page) {
    content = `<div class="empty"><strong>Cette page n'est pas publiée</strong>Elle n'existe pas, ou l'auteur la prépare encore.<br><br><a class="btn btn--ghost" href="livre.html?id=${b.id}">Voir le sommaire</a></div>`;
  } else {
    const badge = {
      free: `<span class="badge badge--free">Gratuite</span>`,
      owned: `<span class="badge badge--owned">${S.icon('check')} Achetée le ${S.dateShort((D.reader.purchases[b.id] || {}).date + 'T12:00')}</span>`,
      locked: `<span class="badge badge--locked">${S.icon('lock')} Payante</span>`,
      soon: `<span class="badge badge--soon">${S.icon('clock')} À venir</span>`
    }[st];
    content = `<p class="rd-chap">${ch ? S.esc(ch.t) : ''}</p><div class="rd-page-h"><h1>Page ${n}</h1>${badge}</div>`;
    if (S.readable(st)) content += `<div id="rdTexte" aria-busy="true"><p class="ash"><span class="spin" style="display:inline-block;vertical-align:-3px"></span> Chargement de la page…</p></div>`;
    else if (st === 'locked' && b.demo) {
      content += `<div class="gate">
        <div class="gate-ghost" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<span style="width:${[96, 90, 94, 72, 88, 92, 80, 95, 60][i]}%"></span>`).join('')}</div>
        <div class="gate-card">${S.icon('lock')}
          <h2>Page payante d’un livre d’exemple</h2>
          <p>Ce livre montre comment une page payante se présente sur Sōzō. Il a été écrit pour l’exemple et ne se vend pas.</p>
        </div></div>`;
    } else if (st === 'locked') {
      const opts = S.buy.options(b, n);
      content += `<div class="gate">
        <div class="gate-ghost" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<span style="width:${[96, 90, 94, 72, 88, 92, 80, 95, 60][i]}%"></span>`).join('')}</div>
        <div class="gate-card">
          ${S.icon('lock')}
          <h2>Cette page est payante</h2>
          <p>${S.esc(a.name)} a choisi de vendre la suite. Choisissez ce que vous voulez lire — le prix s'affiche avant tout paiement.</p>
          <fieldset class="opts"><legend class="sr">Que voulez-vous acheter ?</legend>
          ${opts.map((o, i) => `<label class="opt"><input type="radio" name="opt" value="${i}"${i === 0 ? ' checked' : ''}><span><strong>${S.esc(o.label)}</strong><small>${S.esc(o.detail)}</small></span><strong>${S.money(o.price)}</strong></label>`).join('')}
          </fieldset>
          <button class="btn btn--accent" type="button" id="buyBtn">Continuer — ${opts[0] ? S.money(opts[0].price) : ''}</button>
          <p class="gate-legal">Ce que vous achetez reste à vous. Aucun PDF n'est téléchargé : la lecture se fait ici.</p>
        </div></div>`;
    } else if (st === 'soon') {
      const following = S.isFollowed(b.id);
      content += `<div class="when">${S.icon('calendar')}
        <p class="mono">Page ${n} — disponible le</p>
        <strong>${S.esc(S.dayLong(S.parse(page.date)))}</strong>
        <span>à ${S.parse(page.date).getHours()} h</span>
        <div class="cd" id="cd" aria-label="Temps restant">${countdown(page.date)}</div>
        <em>Le contenu de cette page reste invisible jusqu'à sa parution.</em>
        <button class="btn${following ? ' is-on' : ''}" type="button" id="followBtn" aria-pressed="${following}">${S.icon(following ? 'check' : 'bell')} ${following ? 'Vous suivez ce livre' : 'Suivre pour être prévenu'}</button>
      </div>`;
    }
  }
  main.innerHTML = `<article class="rd-main">${content}</article>`;

  if (page && S.readable(st)) {
    window.SOZO_API('GET', `/api/livres/${encodeURIComponent(b.id)}/pages/${n}`).then((r) => {
      const zone = $('#rdTexte');
      zone.removeAttribute('aria-busy');
      if (r.ok) {
        zone.innerHTML = textOf(r.d.contenu, r.d.filigrane);
        if (r.d.etat !== 'auteur') window.SOZO_API('PUT', '/api/moi/progression', { livre: b.id, n });
        if (r.d.filigrane) protegerCopie(zone);
      } else if (r.status === 402 || r.status === 403) {
        location.reload();                                   // l'état a changé depuis l'ouverture : on recharge
      } else {
        zone.innerHTML = `<div class="empty"><strong>Page indisponible</strong>${S.esc(r.d.erreur || 'Le serveur ne répond pas.')}</div>`;
      }
    });
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

  /* navigation : uniquement entre pages visibles (les brouillons n'existent pas pour le lecteur) */
  const prev = visible[idx - 1], next = visible[idx + 1];
  const nav = document.createElement('nav');
  nav.className = 'rd-nav'; nav.setAttribute('aria-label', 'Pages');
  nav.innerHTML = `${prev ? `<a class="btn" href="lire.html?id=${b.id}&p=${prev.n}" rel="prev">${S.icon('left')} Page ${prev.n}</a>` : '<span></span>'}
    ${next ? `<a class="btn" href="lire.html?id=${b.id}&p=${next.n}" rel="next">Page ${next.n} ${S.icon('right')}</a>` : `<a class="btn" href="livre.html?id=${b.id}">Fin des pages parues</a>`}`;
  main.after(nav);
  const strip = document.createElement('div');
  strip.className = 'rd-strip';
  strip.innerHTML = `<div class="strip" aria-label="Toutes les pages">${visible.map((p) => {
    const s = S.access(b, p.n), cls = { free: 'st-free', owned: 'st-owned', locked: 'st-locked', soon: 'st-soon' }[s];
    return `<a class="${cls}${p.n === n ? ' is-here' : ''}" href="lire.html?id=${b.id}&p=${p.n}"${p.n === n ? ' aria-current="page"' : ''} aria-label="Page ${p.n}">${p.n}</a>`;
  }).join('')}</div><div class="legend"><span><i class="st-free"></i>Gratuite</span><span><i class="st-owned"></i>Achetée</span><span><i class="st-locked"></i>Payante</span><span><i class="st-soon"></i>À venir</span></div>`;
  nav.after(strip);

  /* interactions */
  const setBtn = $('#setBtn'), panel = $('#settings');
  setBtn.addEventListener('click', () => { const o = panel.classList.toggle('is-open'); setBtn.setAttribute('aria-expanded', String(o)); });
  document.addEventListener('click', (e) => { if (!top.contains(e.target)) { panel.classList.remove('is-open'); setBtn.setAttribute('aria-expanded', 'false'); } });
  panel.querySelectorAll('[data-fs]').forEach((x) => x.addEventListener('click', () => { const d = +x.dataset.fs; pref.fs = d ? Math.min(26, Math.max(16, pref.fs + d)) : 20; apply(); save(); }));
  panel.querySelectorAll('[data-w]').forEach((x) => x.addEventListener('click', () => { pref.w = x.dataset.w; panel.querySelectorAll('[data-w]').forEach((y) => y.setAttribute('aria-pressed', String(y === x))); apply(); save(); }));
  panel.querySelectorAll('[data-mode]').forEach((x) => x.addEventListener('click', () => { pref.mode = x.dataset.mode; panel.querySelectorAll('[data-mode]').forEach((y) => y.setAttribute('aria-pressed', String(y === x))); apply(); save(); }));
  const buyBtn = $('#buyBtn');
  if (buyBtn) {
    const opts = S.buy.options(b, n);
    document.querySelectorAll('input[name="opt"]').forEach((r) => r.addEventListener('change', () => { buyBtn.textContent = `Continuer — ${S.money(opts[+r.value].price)}`; }));
    buyBtn.addEventListener('click', () => S.buy.recap(b, opts[+(document.querySelector('input[name="opt"]:checked') || { value: 0 }).value]));
  }
  const fb = $('#followBtn');
  if (fb) fb.addEventListener('click', async () => {
    fb.disabled = true;
    const on = await S.toggleFollow(b.id); fb.disabled = false;
    fb.classList.toggle('is-on', on); fb.setAttribute('aria-pressed', String(on));
    fb.innerHTML = `${S.icon(on ? 'check' : 'bell')} ${on ? 'Vous suivez ce livre' : 'Suivre pour être prévenu'}`;
    S.toast(on ? 'Vous serez prévenu dans vos notifications à la parution.' : 'Vous ne suivez plus ce livre.');
  });
  if ($('#cd')) setInterval(() => { $('#cd').innerHTML = countdown(page.date); }, 30000);
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || document.querySelector('.md-wrap')) return;
    if (e.key === 'ArrowLeft' && prev) location.href = `lire.html?id=${b.id}&p=${prev.n}`;
    if (e.key === 'ArrowRight' && next) location.href = `lire.html?id=${b.id}&p=${next.n}`;
  });
  /* la barre s'efface quand on lit, revient quand on remonte */
  let lastY = scrollY;
  addEventListener('scroll', () => { const y = scrollY; top.classList.toggle('is-hidden', y > lastY && y > 120 && !panel.classList.contains('is-open')); lastY = y; }, { passive: true });
}).catch(window.SOZO_ERREUR);
