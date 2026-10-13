/* ═══════════════════════════════════════════════════════════
   Sōzō — studio de l'auteur (cahier des charges §3 à §12).
   Vue de l'auteur Nawezi N. (livre repris des maquettes du propriétaire) : brouillons compris.
   Toute modification reste LOCALE à cet onglet : rien n'est publié,
   rien n'est enregistré. Chaque action le dit.
   Règle §11 : une page publiée ne se modifie plus (accès, prix, date) —
   des lecteurs ont peut-être déjà des droits dessus.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('studio');
  const main = $('#main');
  const AUTHOR = 'nawezi-n';
  const mine = S.booksBy(AUTHOR);
  let book = mine.find((b) => b.id === S.q('id')) || mine[0];
  let pages, settings, filter = 'all';
  const MOIS = ['août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function load() {
    pages = book.pages.map((p) => ({ ...p }));                 // copie locale
    settings = { mode: book.mode, access: book.access, price: { ...(book.price || { page: null, chapter: null, all: null }) } };
  }
  const local = (msg) => S.toast(`${msg} — modification locale, rien n'est publié dans cette démonstration.`);
  const eff = (p) => S.status(p);                                // programmée + date passée = publiée
  const isPub = (p) => eff(p) === 'published';
  const toLocalInput = (iso) => iso ? iso.slice(0, 16) : '';

  function kpis() {
    const c = { published: 0, scheduled: 0, draft: 0, paid: 0 };
    let next = null;
    pages.forEach((p) => { const s = eff(p); c[s]++; if (p.access === 'paid') c.paid++; if (s === 'scheduled' && (!next || S.parse(p.date) < S.parse(next))) next = p.date; });
    return `<div class="kpis">
      <div class="kpi"><strong>${c.published}</strong><span>Publiées</span></div>
      <div class="kpi"><strong>${c.scheduled}</strong><span>Programmées</span></div>
      <div class="kpi"><strong>${c.draft}</strong><span>Brouillons</span></div>
      <div class="kpi"><strong>${c.paid}<small style="font-size:16px;color:var(--ash)"> / ${pages.length}</small></strong><span>Pages payantes</span></div>
      <div class="kpi kpi--accent"><strong>${next ? S.dateShort(next) : '—'}</strong><span>${next ? 'Prochaine parution · ' + S.parse(next).getHours() + ' h' : 'Rien de programmé'}</span></div>
    </div>`;
  }

  /* frise : août → décembre 2026, un point par date de parution */
  function timeline() {
    const t0 = +new Date('2026-08-01T00:00'), t1 = +new Date('2027-01-01T00:00');
    const x = (iso) => ((+S.parse(iso) - t0) / (t1 - t0)) * 100;
    const g = {};
    pages.filter((p) => p.date && eff(p) !== 'draft').forEach((p) => (g[p.date] = g[p.date] || []).push(p));
    const months = ['2026-08-16', '2026-09-15', '2026-10-16', '2026-11-15', '2026-12-16'];
    const today = S.now();
    const tPos = Math.min(100, Math.max(0, ((+today - t0) / (t1 - t0)) * 100));
    return `<div class="timeline"><div class="tl">
      <div class="tl-axis"></div>
      ${months.map((m, i) => `<span class="tl-month" style="left:${x(m + 'T00:00')}%">${MOIS[i]} 2026</span>`).join('')}
      <div class="tl-today" style="left:${tPos}%"><span>aujourd'hui</span></div>
      ${Object.entries(g).sort((a, b) => S.parse(a[0]) - S.parse(b[0])).map(([d, ps]) => `<div class="tl-ev${eff(ps[0]) === 'scheduled' ? ' is-soon' : ''}" style="left:${x(d)}%;--s:${10 + Math.min(ps.length, 5) * 4}px" title="${S.esc(S.pagesRange(ps.map((p) => p.n)))} — ${S.esc(S.dateLong(d))}"><i></i><span>p. ${ps.length > 2 ? `${ps[0].n}–${ps[ps.length - 1].n}` : ps.map((p) => p.n).join(', ')}</span></div>`).join('')}
    </div></div>
    <p class="legend" style="margin-top:6px"><span><i style="background:var(--ink);border-radius:50%;width:12px;height:12px"></i>Publiée</span><span><i style="border:2px solid var(--ver);border-radius:50%;width:12px;height:12px"></i>Programmée</span><span>Aucune règle de rythme : publiez quand vous voulez.</span></p>`;
  }

  function rows() {
    const list = pages.filter((p) => filter === 'all' || eff(p) === filter);
    const chapter = (n) => (S.chapterOf(book, n) || { t: '—' }).t;
    return list.map((p) => {
      const s = eff(p), pub = s === 'published';
      const st = { published: ['Publiée', 'owned'], scheduled: ['Programmée', 'soon'], draft: ['Brouillon', 'draft'] }[s];
      return `<tr data-n="${p.n}" class="${pub ? 'is-pub' : ''}">
        <td>${pub ? `<span class="sr">Page publiée, non modifiable</span>` : `<input type="checkbox" aria-label="Sélectionner la page ${p.n}" data-sel="${p.n}">`}</td>
        <td><strong>Page ${p.n}</strong></td>
        <td class="ash">${S.esc(chapter(p.n))}</td>
        <td><span class="badge badge--${st[1]}">${st[0]}</span></td>
        <td>${pub ? `<span>${p.access === 'free' ? 'Gratuit' : 'Payant'}</span>` : `<select data-acc="${p.n}" aria-label="Accès de la page ${p.n}"><option value="free"${p.access === 'free' ? ' selected' : ''}>Gratuit</option><option value="paid"${p.access === 'paid' ? ' selected' : ''}>Payant</option></select>`}</td>
        <td>${p.access === 'paid' ? (settings.price.page != null ? S.money(settings.price.page) : 'chapitre / livre') : '—'}</td>
        <td>${pub ? S.esc(S.dateLong(p.date)) : `<input type="datetime-local" data-date="${p.n}" value="${toLocalInput(p.date)}" aria-label="Date de parution de la page ${p.n}">`}</td>
        <td class="ash">${p.source === 'editor' ? 'Éditeur direct' : 'Import PDF'}</td>
        <td>${pub ? `<button class="btn btn--ghost btn--sm" type="button" data-plume="${p.n}" title="Accès, prix et date verrouillés : des lecteurs ont peut-être déjà des droits sur cette page">${S.icon('edit')} Corriger <span class="plume-tag">Plume</span></button>` : `<span class="row-acts"><a class="btn btn--ghost btn--sm" href="ecrire.html?id=${book.id}&p=${p.n}">${S.icon('edit')} Écrire</a><button class="btn btn--ghost btn--sm" type="button" data-now="${p.n}">Publier</button></span>`}</td>
      </tr>`;
    }).join('');
  }

  function render() {
    const c = S.stats({ ...book, pages });
    main.innerHTML = `<div class="wrap">
      <div class="st-head">
        ${S.cover(book, { d3: false })}
        <div>
          <p class="kicker">Studio auteur · Nawezi N.</p>
          <h1 data-ink-text="${S.esc(book.title)}"></h1>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            ${mine.map((b) => `<a class="chip" href="studio.html?id=${b.id}" aria-pressed="${b.id === book.id}">${S.esc(b.title)}</a>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn--ghost" href="livre.html?id=${book.id}">${S.icon('eye')} Voir comme un lecteur</a>
          <a class="btn" href="ecrire.html?id=${book.id}&p=${pages.length + 1}">${S.icon('pen')} Écrire une page</a>
          <button class="btn btn--ghost" type="button" id="newPage">${S.icon('plus')} Nouvelle page</button>
        </div>
      </div>
      ${kpis()}
      <div class="st-grid">
        <section class="panel" id="import">
          <h2 data-ink-text="Le [[manuscrit]]"></h2>
          ${book.file ? `<div class="import-card"><span class="import-ic">${S.icon('file')}</span><div>
            <strong>${S.esc(book.file)}</strong> <span class="badge badge--owned">${S.icon('check')} Découpage validé</span>
            <div class="import-bar"><i></i></div>
            <span class="ash" style="font-size:14px">${pages.filter((p) => p.source === 'pdf').length} pages extraites du PDF · ${pages.filter((p) => p.source === 'editor').length} écrites dans l'éditeur · relu le 18/09/2026</span></div></div>`
          : `<p class="ash">Ce livre a été écrit directement dans l'éditeur de Sōzō.</p>`}
          <label class="drop" id="drop">${S.icon('upload')}<strong>Déposer un PDF, un EPUB ou un DOCX</strong><br>ou cliquer pour choisir un fichier — le découpage en pages se fait ensuite, page par page.
            <input type="file" accept=".pdf,.epub,.docx,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="sr" id="file"></label>
          <p class="note" id="dropMsg" aria-live="polite"></p>
          <div class="thumbs" aria-label="Aperçu des pages">${pages.map((p) => `<div class="thumb${p.source === 'editor' ? ' is-editor' : ''}" title="Page ${p.n} — ${p.source === 'editor' ? 'éditeur' : 'import PDF'}">${'<i></i>'.repeat(6)}<b>${p.n}</b></div>`).join('')}</div>
        </section>
        <section class="panel">
          <h2 data-ink-text="Vos [[règles]]"></h2>
          <div class="modes">
            <div class="mode-row"><p>Publication</p><div class="seg-c" data-set="mode">${[['integral', 'Tout publier'], ['progressive', 'Progressive']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${settings.mode === k}">${l}</button>`).join('')}</div></div>
            <div class="mode-row"><p>Accès au livre</p><div class="seg-c" data-set="access">${[['free', 'Gratuit'], ['paid', 'Payant'], ['mixed', 'Mixte']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${settings.access === k}">${l}</button>`).join('')}</div></div>
            <div class="mode-row"><p>Prix (laisser vide pour ne pas proposer)</p>
              <div class="price-box">${[['page', 'Une page'], ['chapter', 'Un chapitre'], ['all', 'Tout le contenu payant']].map(([k, l]) => `<label class="price-opt"><span>${l}</span><span><input type="number" min="0" step="0.01" inputmode="decimal" data-price="${k}" value="${settings.price[k] != null ? settings.price[k].toFixed(2) : ''}" style="width:90px;height:36px;border:1px solid var(--line);border-radius:3px;padding:0 8px;background:var(--bone)"> $</span></label>`).join('')}</div></div>
          </div>
          <p class="note">${S.icon('shield')} Un changement de prix ne touche que les achats futurs : ce qu'un lecteur a payé reste à lui.</p>
        </section>
      </div>
      <section class="panel offer" id="offre" style="margin-bottom:18px">
        <div class="offer-in">
          <div>
            <p class="kicker">Votre offre</p>
            <h2 data-ink-text="Compte [[gratuit]]"></h2>
            <p class="ash">Publier, vendre, programmer : tout est inclus. Sur chaque vente, Sōzō prend sa commission.</p>
            <div class="split" id="split"></div>
          </div>
          <div class="plume-card">
            <p class="mono">Plume · 4,99 $ / mois</p>
            <ul>
              <li>Corriger une page déjà publiée, sans rien retirer aux lecteurs qui l’ont achetée</li>
              <li>Historique des versions de chaque page</li>
              <li>Statistiques de lecture et de vente</li>
              <li>Mise en page du livre (ornements, lettrines)</li>
              <li>Commission réduite à 10 %</li>
            </ul>
            <button class="btn btn--accent" type="button" id="plumeBtn">Passer à Plume</button>
          </div>
        </div>
        <p class="note">${S.icon('tag')} Taux et prix proposés pour la démonstration, à fixer par le porteur du projet. Frais du prestataire Mobile Money : inconnus tant qu’il n’est pas choisi.</p>
      </section>
      <section class="panel" id="calendrier" style="margin-bottom:18px">
        <h2 data-ink-text="Le [[calendrier]]"></h2>
        ${timeline()}
      </section>
      <section class="panel" id="pages">
        <div class="sec-head" style="margin-bottom:12px"><h2 style="margin:0" data-ink-text="Les [[pages]]"></h2>
          <div class="tbl-tools" role="group" aria-label="Filtrer">${[['all', `Toutes (${pages.length})`], ['published', `Publiées (${c.published})`], ['scheduled', `Programmées (${c.scheduled})`], ['draft', `Brouillons (${c.draft})`]].map(([k, l]) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div></div>
        <div class="bulk" id="bulk" role="group" aria-label="Actions sur la sélection">
          <strong id="selCount"></strong>
          <button class="btn btn--sm" type="button" data-bulk="free">Gratuit</button>
          <button class="btn btn--sm" type="button" data-bulk="paid">Payant</button>
          <label class="sr" for="bulkDate">Date de parution</label><input type="datetime-local" id="bulkDate" style="width:200px">
          <button class="btn btn--sm" type="button" data-bulk="date">Programmer</button>
          <button class="btn btn--sm" type="button" data-bulk="now">Publier maintenant</button>
          <button class="btn btn--sm" type="button" data-bulk="draft">Remettre en brouillon</button>
        </div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th><span class="sr">Sélection</span></th><th>Page</th><th>Chapitre</th><th>État</th><th>Accès</th><th>Prix</th><th>Parution</th><th>Source</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody id="tbody">${rows()}</tbody></table></div>
        <p class="local-note">${S.icon('eyeOff')} Les brouillons ne sont visibles que par vous. Les pages publiées sont verrouillées : des lecteurs ont peut-être déjà des droits dessus.</p>
      </section>
    </div>`;
    bind();
    S.inkAll();
  }

  const selected = () => [...document.querySelectorAll('[data-sel]:checked')].map((x) => +x.dataset.sel);
  function syncBulk() {
    const n = selected().length;
    $('#bulk').classList.toggle('is-on', n > 0);
    $('#selCount').textContent = `${n} page${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`;
    document.querySelectorAll('#tbody tr').forEach((tr) => { const c = tr.querySelector('[data-sel]'); tr.classList.toggle('is-sel', !!(c && c.checked)); });
  }
  const page = (n) => pages.find((p) => p.n === n);
  const nowIso = () => { const d = new Date(Date.now() - 60000); d.setSeconds(0, 0); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };

  function bind() {
    document.querySelectorAll('[data-sel]').forEach((x) => x.addEventListener('change', syncBulk));
    document.querySelectorAll('[data-filter]').forEach((x) => x.addEventListener('click', () => { filter = x.dataset.filter; render(); $('#pages').scrollIntoView({ block: 'start' }); }));
    document.querySelectorAll('[data-acc]').forEach((x) => x.addEventListener('change', () => { page(+x.dataset.acc).access = x.value; local(`Page ${x.dataset.acc} : ${x.value === 'free' ? 'gratuite' : 'payante'}`); render(); }));
    document.querySelectorAll('[data-date]').forEach((x) => x.addEventListener('change', () => {
      const p = page(+x.dataset.date);
      if (!x.value) { p.date = null; p.status = 'draft'; } else { p.date = x.value; p.status = 'scheduled'; }
      local(`Page ${p.n} : ${p.date ? 'programmée le ' + S.dateLong(p.date) : 'remise en brouillon'}`); render();
    }));
    document.querySelectorAll('[data-now]').forEach((x) => x.addEventListener('click', () => {
      const p = page(+x.dataset.now);
      S.modal({ title: `Publier la page ${p.n} maintenant ?`, body: `<p>Une fois publiée, son accès, son prix et sa date ne pourront plus être modifiés : des lecteurs pourront l'acheter ou la lire.</p><p class="warn">${S.icon('lock')}<span>Dans cette démonstration, la publication reste locale à cet onglet : aucun lecteur ne la verra.</span></p>`,
        actions: [{ label: 'Annuler' }, { label: 'Publier (démo locale)', primary: true, onClick: (close) => { p.status = 'scheduled'; p.date = nowIso(); close(); local(`Page ${p.n} publiée`); render(); } }] });
    }));
    document.querySelectorAll('[data-bulk]').forEach((x) => x.addEventListener('click', () => {
      const sel = selected(); if (!sel.length) return;
      const k = x.dataset.bulk;
      if (k === 'date' && !$('#bulkDate').value) { S.toast('Choisissez d’abord une date et une heure.'); $('#bulkDate').focus(); return; }
      sel.forEach((n) => {
        const p = page(n);
        if (k === 'free' || k === 'paid') p.access = k;
        if (k === 'date') { p.date = $('#bulkDate').value; p.status = 'scheduled'; }
        if (k === 'now') { p.date = nowIso(); p.status = 'scheduled'; }
        if (k === 'draft') { p.status = 'draft'; p.date = null; }
      });
      local(`${S.pagesRange(sel).replace(/^p/, 'P')} : ${{ free: 'gratuites', paid: 'payantes', date: 'programmées', now: 'publiées', draft: 'remises en brouillon' }[k]}`);
      render();
    }));
    document.querySelectorAll('[data-set]').forEach((grp) => grp.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
      settings[grp.dataset.set] = btn.dataset.v;
      grp.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      local(grp.dataset.set === 'mode' ? (btn.dataset.v === 'integral' ? 'Mode « tout publier » choisi' : 'Mode progressif choisi') : `Accès : ${btn.textContent}`);
    })));
    document.querySelectorAll('[data-price]').forEach((inp) => inp.addEventListener('change', () => {
      const v = inp.value === '' ? null : Math.max(0, Math.round(parseFloat(inp.value.replace(',', '.')) * 100) / 100);
      settings.price[inp.dataset.price] = isFinite(v) ? v : null;
      local(v == null ? 'Option de prix retirée' : `Prix fixé à ${S.money(v)}`);
      $('#tbody').innerHTML = rows(); bind(); split();
    }));
    $('#newPage').addEventListener('click', () => {
      const n = pages.length + 1;
      pages.push({ n, access: settings.access === 'free' ? 'free' : 'paid', status: 'draft', date: null, source: 'editor' });
      local(`Page ${n} créée en brouillon`); filter = 'draft'; render();
    });
    const drop = $('#drop'), file = $('#file');
    const took = (f) => {
      if (!f) return;
      const ok = /\.(pdf|epub|docx)$/i.test(f.name);
      $('#dropMsg').innerHTML = ok
        ? `${S.icon('file')} <span><strong>${S.esc(f.name)}</strong> (${(f.size / 1048576).toFixed(1).replace('.', ',')} Mo) reçu par le navigateur. L'extraction et le découpage se font sur le serveur, qui n'est pas branché dans cette démonstration : aucune page n'a été importée.</span>`
        : `${S.icon('x')} <span>Format non pris en charge : PDF, EPUB ou DOCX seulement.</span>`;
    };
    file.addEventListener('change', () => took(file.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => took(e.dataTransfer.files[0]));
  }

  /* répartition d'une vente — PROPOSITION de démonstration (15 % ; 10 % avec Plume) */
  const COMMISSION = { free: 0.15, plume: 0.10 };
  function split() {
    const el = $('#split'); if (!el) return;
    const p = settings.price.page ?? settings.price.chapter ?? settings.price.all;
    if (p == null || settings.access === 'free') { el.innerHTML = `<p class="ash">Livre gratuit : aucune vente, aucune commission.</p>`; return; }
    const cut = (r) => Math.round(p * r * 100) / 100;
    el.innerHTML = `<p class="mono ash">Sur une vente à ${S.money(p)}</p>
      <div class="split-bar"><i style="width:${(1 - COMMISSION.free) * 100}%"></i></div>
      <div class="split-row"><span>Vous recevez</span><strong>${S.money(p - cut(COMMISSION.free))}</strong></div>
      <div class="split-row ash"><span>Commission Sōzō (15 %)</span><span>${S.money(cut(COMMISSION.free))}</span></div>
      <div class="split-row ash"><span>Avec Plume (10 %)</span><span>vous recevez ${S.money(p - cut(COMMISSION.plume))}</span></div>`;
  }
  function plumeModal(n) {
    S.modal({ title: n ? `Corriger la page ${n}` : 'Passer à Plume',
      body: `${n ? `<p>Cette page est publiée : son accès, son prix et sa date ne changent plus, parce que des lecteurs ont peut-être déjà des droits dessus.</p><p>Avec <strong>Plume</strong>, vous pouvez en corriger le <em>texte</em> : Sōzō crée une nouvelle version, garde l’ancienne dans l’historique, et chaque lecteur qui l’a achetée conserve son accès.</p>` : `<p><strong>Plume</strong> ajoute la correction des pages publiées (avec historique des versions), les statistiques de lecture, la mise en page du livre et une commission réduite à 10 %.</p>`}
        <p class="warn">${S.icon('lock')}<span><strong>Abonnement non branché dans cette démonstration.</strong> Aucun paiement ne sera demandé, aucune fonction ne sera débloquée.</span></p>`,
      actions: [{ label: 'Fermer' }, { label: 'S’abonner — 4,99 $ / mois', primary: true, disabled: true }] });
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-plume], #plumeBtn');
    if (t) plumeModal(t.dataset.plume ? +t.dataset.plume : null);
  });
  const _render = render;
  render = function () { _render(); split(); };

  load(); render(); S.footer();
  if (location.hash) setTimeout(() => { const el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }, 60);
})();
