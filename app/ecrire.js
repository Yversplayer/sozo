/* ═══════════════════════════════════════════════════════════
   Sōzō — l'éditeur de page, avec correction du français en direct.
   Technique : un <textarea> transparent posé sur un calque qui reproduit
   le même texte et souligne les fautes. On écrit dans un vrai champ (copier,
   coller, annuler, clavier, accessibilité : tout reste natif) ; le calque ne
   sert qu'à montrer. Le correcteur tourne dans un Web Worker.
   Le brouillon s'enregistre sur CET appareil seulement : rien n'est publié.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('studio');
  const main = $('#main');
  const b = S.book(S.q('id') || 'croix-de-bois') || D.books[0];
  const n = +S.q('p') || (b.pages.length + 1);
  const KEY = `sozo-brouillon:${b.id}:${n}`;
  const PERSO = 'sozo-dico-perso';
  const DEMO = `Il a manger son pain en silance, puis il a voulu sortir dehors. Les maison du quartier dormaient encore.Je ne voulais quitter cette ville , mais ils on décidé de partir sans moi.

Nous mange ensemble ce soir. Cette homme marchait vers la mer ; elle à peur de la nuit. J'ai du partir tôt pour monter en haut de la colline...

Quand je marche dans la vallée de l’ombre de la mort (Psaume 23:4), je pense à ma mère. Une lumière, une lumière douce, une lumière qui ne s’éteint pas.`;
  let personal = [];
  try { personal = JSON.parse(localStorage.getItem(PERSO)) || []; } catch (e) {}
  let ignored = new Set();
  let issues = [], seq = 0, ready = false;

  const T = D.texts[b.id] || [];
  let initial = null;
  try { initial = localStorage.getItem(KEY); } catch (e) {}
  if (initial == null) initial = T[n - 1] ? T[n - 1].join('\n') : DEMO;
  const isDemo = initial === DEMO;

  main.innerHTML = `<div class="wrap ed">
    <div class="ed-head">
      <a class="icon-btn" href="studio.html?id=${b.id}" aria-label="Retour au studio">${S.icon('left')}</a>
      <div><p class="kicker">Studio · ${S.esc(b.title)}</p><h1>Page ${n}</h1></div>
      <span class="badge badge--draft">Brouillon</span>
      <span class="ed-save mono ash" id="save" aria-live="polite"></span>
    </div>
    ${isDemo ? `<p class="warn" style="margin-bottom:14px">${S.icon('edit')}<span><strong>Texte d’essai avec des fautes volontaires</strong>, pour voir le correcteur au travail. Effacez-le et écrivez librement.</span></p>` : ''}
    <div class="ed-grid">
      <section class="ed-paper" aria-label="Texte de la page">
        <div class="ed-tools" role="toolbar" aria-label="Outils">
          <span class="mono ash" id="count"></span>
          <button class="btn btn--ghost btn--sm" type="button" id="fixTypo" disabled>${S.icon('check')} Corriger la typographie</button>
        </div>
        <div class="ed-stack">
          <div class="ed-back" id="back" aria-hidden="true"></div>
          <textarea id="ta" spellcheck="false" lang="fr" aria-label="Texte de la page ${n}" aria-describedby="status">${S.esc(initial)}</textarea>
        </div>
        <p class="note">${S.icon('book')} Les références bibliques (« Ps 23:4 », « Jean 3:16 ») deviendront des liens pour le lecteur.</p>
      </section>
      <aside class="ed-side" aria-label="Correction">
        <div class="panel ed-status" id="status" aria-live="polite"><span class="spin" aria-hidden="true"></span> Chargement du dictionnaire…</div>
        <div class="ed-sum" id="sum" role="group" aria-label="Filtrer les remarques"></div>
        <div class="ed-list" id="list"></div>
        <div class="panel ed-word" id="word" hidden></div>
      </aside>
    </div>
  </div>`;

  const ta = $('#ta'), back = $('#back');
  const TYPES = { orth: ['Orthographe', 'orth'], gram: ['Grammaire', 'gram'], typo: ['Typographie', 'typo'], voc: ['Vocabulaire', 'voc'] };
  let filter = '';

  /* ─── calque : même texte, fautes soulignées ─── */
  function paint() {
    const txt = ta.value;
    let html = '', last = 0;
    visible().forEach((x, i) => {
      if (x.s < last) return;
      html += S.esc(txt.slice(last, x.s)) + `<mark class="m-${x.type}" data-i="${i}">${S.esc(txt.slice(x.s, x.e)) || ' '}</mark>`;
      last = x.e;
    });
    back.innerHTML = html + S.esc(txt.slice(last)) + '\n';
    back.scrollTop = ta.scrollTop;
  }
  const keyOf = (x) => `${x.rule}|${ta.value.slice(x.s, x.e)}`;
  const visible = () => issues.filter((x) => !ignored.has(keyOf(x)) && (!filter || x.type === filter));

  function list() {
    const v = issues.filter((x) => !ignored.has(keyOf(x)));
    const c = { orth: 0, gram: 0, typo: 0, voc: 0 };
    v.forEach((x) => { c[x.type] = (c[x.type] || 0) + 1; });
    $('#sum').innerHTML = Object.entries(TYPES).map(([k, [l]]) =>
      `<button type="button" class="ed-chip ed-chip--${k}" data-f="${k}" aria-pressed="${filter === k}"><b>${c[k]}</b>${l}</button>`).join('');
    const vis = visible();
    $('#list').innerHTML = vis.length ? vis.map((x, i) => `
      <article class="ed-item ed-item--${x.type}" data-i="${i}">
        <p class="mono">${TYPES[x.type][0]}</p>
        <p class="ed-ctx">…${S.esc(ta.value.slice(Math.max(0, x.s - 24), x.s))}<mark>${S.esc(ta.value.slice(x.s, x.e)) || '␣'}</mark>${S.esc(ta.value.slice(x.e, x.e + 24))}…</p>
        <p>${S.esc(x.msg)}</p>
        <div class="ed-acts">
          ${x.sugg.slice(0, 4).map((s, k) => `<button type="button" class="btn btn--sm" data-fix="${i}" data-k="${k}">${S.esc(s.trim() || '(supprimer)')}</button>`).join('')}
          ${x.type === 'orth' ? `<button type="button" class="btn btn--ghost btn--sm" data-add="${i}">Ajouter au dictionnaire</button>` : ''}
          <button type="button" class="btn btn--ghost btn--sm" data-ign="${i}">Ignorer</button>
        </div>
      </article>`).join('')
      : `<div class="empty"><strong>${filter ? 'Rien dans cette catégorie' : 'Aucune faute relevée'}</strong>${filter ? '' : 'Le correcteur ne voit rien à reprendre. Relisez tout de même : aucun outil ne remplace l’œil de l’auteur.'}</div>`;
    $('#fixTypo').disabled = !v.some((x) => x.type === 'typo' && x.sugg.length);
    paint();
  }

  /* ─── corrections ─── */
  function apply(x, s) {
    const v = ta.value;
    ta.value = v.slice(0, x.s) + s + v.slice(x.e);
    const d = s.length - (x.e - x.s);
    issues = issues.filter((y) => y !== x).map((y) => (y.s >= x.e ? { ...y, s: y.s + d, e: y.e + d } : y));
    ta.setSelectionRange(x.s + s.length, x.s + s.length);
    changed(true);
  }
  $('#list').addEventListener('click', (e) => {
    const f = e.target.closest('[data-fix]'), a = e.target.closest('[data-add]'), g = e.target.closest('[data-ign]');
    const item = e.target.closest('.ed-item');
    const vis = visible();
    if (f) { const x = vis[+f.dataset.fix]; apply(x, x.sugg[+f.dataset.k]); return; }
    if (a) { const x = vis[+a.dataset.add]; const w = ta.value.slice(x.s, x.e); personal.push(w); try { localStorage.setItem(PERSO, JSON.stringify(personal)); } catch (er) {} S.toast(`« ${w} » ajouté à votre dictionnaire (sur cet appareil).`); run(); return; }
    if (g) { ignored.add(keyOf(vis[+g.dataset.ign])); list(); return; }
    if (item) { const x = vis[+item.dataset.i]; ta.focus(); ta.setSelectionRange(x.s, x.e); scrollToSel(); }
  });
  $('#sum').addEventListener('click', (e) => { const c = e.target.closest('[data-f]'); if (!c) return; filter = filter === c.dataset.f ? '' : c.dataset.f; list(); });
  $('#fixTypo').addEventListener('click', () => {
    const typo = issues.filter((x) => x.type === 'typo' && x.sugg.length && !ignored.has(keyOf(x))).sort((a, z) => z.s - a.s);
    let v = ta.value, last = Infinity;
    typo.forEach((x) => { if (x.e > last) return; v = v.slice(0, x.s) + x.sugg[0] + v.slice(x.e); last = x.s; });
    ta.value = v; S.toast(`${typo.length} correction${typo.length > 1 ? 's' : ''} typographique${typo.length > 1 ? 's' : ''} appliquée${typo.length > 1 ? 's' : ''}.`);
    changed(true);
  });
  function scrollToSel() {
    const before = ta.value.slice(0, ta.selectionStart).split('\n').length;
    ta.scrollTop = Math.max(0, (before - 4) * parseFloat(getComputedStyle(ta).lineHeight));
  }

  /* ─── le correcteur (Web Worker) ─── */
  const status = (h) => { $('#status').innerHTML = h; };
  let worker;
  try { worker = new Worker('langue/correcteur.js'); } catch (e) { status(`${S.icon('x')} Ce navigateur ne peut pas lancer le correcteur.`); }
  if (worker) {
    worker.onmessage = (ev) => {
      const d = ev.data;
      if (d.type === 'progress') status(`<span class="spin" aria-hidden="true"></span> ${S.esc(d.step)}`);
      if (d.type === 'ready') { ready = true; status(`${S.icon('check')} Dictionnaire chargé : ${d.forms.toLocaleString('fr-FR')} formes du français.`); run(); }
      if (d.type === 'result' && d.id === seq) { issues = d.issues; list(); }
      if (d.type === 'wordinfo') showWord(d.info);
      if (d.type === 'error') status(`${S.icon('x')} Le correcteur a rencontré un problème : ${S.esc(d.message)}`);
    };
    worker.onerror = () => status(`${S.icon('x')} Le dictionnaire n’a pas pu être chargé (connexion ?). Vous pouvez écrire quand même.`);
    worker.postMessage({ type: 'init', base: new URL('langue/', location.href).href });
  }
  const run = () => { if (ready) worker.postMessage({ type: 'check', id: ++seq, text: ta.value, personal }); };

  /* ─── fiche du mot sélectionné : nature, lemme, synonymes, conjugaison ─── */
  function showWord(info) {
    const el = $('#word'); el.hidden = false;
    if (!info.known) { el.innerHTML = `<p class="mono ash">Mot</p><h3>${S.esc(info.w)}</h3><p>Inconnu du dictionnaire.${info.sugg.length ? ` Vouliez-vous dire : <strong>${info.sugg.map(S.esc).join('</strong>, <strong>')}</strong> ?` : ''}</p>`; return; }
    const P = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'];
    el.innerHTML = `<p class="mono ash">Le mot</p><h3>${S.esc(info.w)}</h3>
      <p class="ash">${info.lemma !== info.w ? `de « ${S.esc(info.lemma)} » · ` : ''}${info.desc.map(S.esc).join(' · ')}</p>
      ${info.syn.length ? `<p class="mono ash" style="margin-top:12px">Synonymes</p><div class="ed-syn">${info.syn.map((s) => `<button type="button" class="chip" data-syn="${S.esc(s)}">${S.esc(s)}</button>`).join('')}</div>` : ''}
      ${info.conj ? `<p class="mono ash" style="margin-top:12px">Conjugaison de « ${S.esc(info.lemma)} »</p>
        <table class="ed-conj"><thead><tr><th></th><th>présent</th><th>imparfait</th><th>futur</th></tr></thead><tbody>
        ${P.map((p, i) => `<tr><th>${p}</th><td>${S.esc(info.conj.ipre[i])}</td><td>${S.esc(info.conj.iimp[i])}</td><td>${S.esc(info.conj.ifut[i])}</td></tr>`).join('')}
        </tbody></table><p class="ash" style="font-size:13px">Participe passé : ${S.esc(info.conj.ppas || '—')}</p>` : ''}`;
  }
  $('#word').addEventListener('click', (e) => {
    const s = e.target.closest('[data-syn]'); if (!s) return;
    const a = ta.selectionStart, z = ta.selectionEnd;
    if (a === z) return;
    apply({ s: a, e: z }, s.dataset.syn);
  });
  ta.addEventListener('dblclick', () => {
    setTimeout(() => {
      const w = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
      if (worker && ready && /^[\p{L}’'-]{2,}$/u.test(w)) {
        const el = $('#word'); el.hidden = false;
        el.innerHTML = `<p class="mono ash">Le mot</p><h3>${S.esc(w)}</h3><p class="ash"><span class="spin" style="display:inline-block;vertical-align:-3px"></span> Recherche de la nature, des synonymes et de la conjugaison…</p>`;
        worker.postMessage({ type: 'word', w });
      }
    }, 10);
  });

  /* ─── saisie, enregistrement local, compteurs ─── */
  let tCheck, tSave;
  function changed(now) {
    const words = (ta.value.match(/[\p{L}\d’'-]+/gu) || []).length;
    $('#count').textContent = `${words} mots · ${ta.value.length} signes · ${Math.max(1, Math.round(words / 230))} min de lecture`;
    paint();
    clearTimeout(tCheck); tCheck = setTimeout(run, now ? 0 : 450);
    clearTimeout(tSave); tSave = setTimeout(() => {
      try { localStorage.setItem(KEY, ta.value); $('#save').textContent = 'Enregistré sur cet appareil'; } catch (e) { $('#save').textContent = 'Non enregistré (stockage bloqué)'; }
    }, 600);
  }
  ta.addEventListener('input', () => { issues = issues.filter((x) => x.e <= ta.selectionStart - 1 || x.s >= ta.value.length); changed(false); });
  ta.addEventListener('scroll', () => { back.scrollTop = ta.scrollTop; });
  changed(true);
  S.inkAll(); S.footer();
})();
