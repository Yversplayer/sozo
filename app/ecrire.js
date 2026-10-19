/* ═══════════════════════════════════════════════════════════
   Sōzō — l'éditeur de page, avec correction du français en direct.
   Technique : un <textarea> transparent posé sur un calque qui reproduit
   le même texte et souligne les fautes. On écrit dans un vrai champ (copier,
   coller, annuler, clavier, accessibilité : tout reste natif) ; le calque ne
   sert qu'à montrer. Le correcteur tourne dans un Web Worker.
   Le brouillon s'enregistre sur CET appareil seulement : rien n'est publié.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, $ = (s, c = document) => c.querySelector(s);
  S.shell('studio');
  const main = $('#main');
  const id = S.q('id'), n = +S.q('p');
  if (!id || !n) { location.replace('studio.html'); return; }
  const URL_PAGE = `/api/studio/livres/${encodeURIComponent(id)}/pages/${n}`;
  const KEY = `sozo-secours:${id}:${n}`;          // copie de secours, si le réseau tombe
  const PERSO = 'sozo-dico-perso';
  const ESSAI = `Il a manger son pain en silance, puis il a voulu sortir dehors. Les maison du quartier dormaient encore.Je ne voulais quitter cette ville , mais ils on décidé de partir sans moi.

Nous mange ensemble ce soir. Cette homme marchait vers la mer ; elle à peur de la nuit. J'ai du partir tôt pour monter en haut de la colline...

Quand je marche dans la vallée de l’ombre de la mort (Psaume 23:4), je pense à ma mère. Une lumière, une lumière douce, une lumière qui ne s’éteint pas.`;
  let personal = [];
  try { personal = JSON.parse(localStorage.getItem(PERSO)) || []; } catch (e) {}
  let ignored = new Set();
  let issues = [], seq = 0, ready = false;

  // La page vient du SERVEUR : texte courant, version, statut, Plume.
  const [rp, rl] = await Promise.all([window.SOZO_API('GET', URL_PAGE), window.SOZO_API('GET', `/api/studio/livres/${encodeURIComponent(id)}`)]);
  if (!rp.ok || !rl.ok) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Page introuvable</strong>${S.esc(rp.d.erreur || rl.d.erreur || '')} Elle n’existe pas, ou ce livre n’est pas le vôtre.<br><br><a class="btn" href="studio.html">Retour à l’atelier</a></div></div>`;
    S.footer(); return;
  }
  const page = rp.d, livre = rl.d.livre;
  const total = livre.pages.length;
  const verrou = page.statut === 'published' && !page.plume;     // publiée sans Plume : lecture seule
  let enregistre = page.contenu;                                // dernier texte confirmé par le serveur
  let version = page.version;
  let secours = null;
  try { secours = localStorage.getItem(KEY); } catch (e) {}
  if (secours === enregistre) { secours = null; try { localStorage.removeItem(KEY); } catch (e) {} }
  const ETAT = { published: ['Publiée', 'owned'], scheduled: ['Programmée', 'soon'], draft: ['Brouillon', 'draft'] }[page.statut];

  main.innerHTML = `<div class="wrap ed">
    <div class="ed-head">
      <a class="icon-btn" href="studio.html?id=${encodeURIComponent(id)}" aria-label="Retour à l’atelier">${S.icon('left')}</a>
      <div><p class="kicker">Atelier · ${S.esc(livre.titre)}</p><h1>Page ${n} <small class="ash ed-sur">sur ${total}</small></h1></div>
      <span class="badge badge--${ETAT[1]}">${ETAT[0]}</span>
      <span class="ed-save mono ash" id="save" role="status" aria-live="polite">${version ? `Version ${version}` : ''}</span>
      <span class="ed-nav">
        ${n > 1 ? `<a class="btn btn--ghost btn--sm" href="ecrire.html?id=${encodeURIComponent(id)}&p=${n - 1}" aria-label="Page précédente">${S.icon('left')}</a>` : ''}
        ${n < total ? `<a class="btn btn--ghost btn--sm" href="ecrire.html?id=${encodeURIComponent(id)}&p=${n + 1}" aria-label="Page suivante">${S.icon('right')}</a>` : ''}
        <a class="btn btn--ghost btn--sm" id="apercu" href="lire.html?id=${encodeURIComponent(id)}&p=${n}" target="_blank" rel="noopener">${S.icon('eye')} Aperçu lecteur</a>
        <button class="btn btn--accent btn--sm" type="button" id="saveBtn"${verrou ? ' disabled' : ''}>${S.icon('check')} Enregistrer</button>
      </span>
    </div>
    ${verrou ? `<p class="warn" style="margin-bottom:14px">${S.icon('lock')}<span><strong>Page publiée.</strong> Des lecteurs ont peut-être des droits dessus : son texte ne se corrige qu’avec Plume, en nouvelle version (l’ancienne reste dans l’historique). Vous pouvez la relire et passer le correcteur. <button class="btn btn--sm" type="button" id="plumeBtn">Passer à Plume</button></span></p>` : ''}
    ${page.statut === 'published' && page.plume ? `<p class="note" style="margin:0 0 14px">${S.icon('feather')} Page publiée, corrigée avec Plume : chaque enregistrement crée une nouvelle version ; les lecteurs voient toujours le texte courant.</p>` : ''}
    ${secours != null && !verrou ? `<p class="warn" id="secours" style="margin-bottom:14px">${S.icon('clock')}<span>Une copie de cette page, plus récente que celle du serveur, est restée sur cet appareil (enregistrement interrompu ?). <button class="btn btn--sm" type="button" id="restaurer">Reprendre cette copie</button> <button class="btn btn--ghost btn--sm" type="button" id="oublier">L’oublier</button></span></p>` : ''}
    <div class="ed-grid">
      <section class="ed-paper" aria-label="Texte de la page">
        <div class="ed-tools" role="toolbar" aria-label="Outils">
          <span class="mono ash" id="count"></span>
          <button class="btn btn--ghost btn--sm" type="button" id="essai"${enregistre ? ' hidden' : ''}>${S.icon('spark')} Voir le correcteur à l’œuvre</button>
          <button class="btn btn--ghost btn--sm" type="button" id="fixTypo" disabled>${S.icon('check')} Harmoniser la typographie</button>
          <button class="btn btn--accent btn--sm" type="button" id="iaBtn">${S.icon('spark')} Relecture par l’IA</button>
        </div>
        <div class="ed-stack">
          <div class="ed-back" id="back" aria-hidden="true"></div>
          <textarea id="ta" spellcheck="false" lang="fr" aria-label="Texte de la page ${n}" aria-describedby="status" placeholder="Écrivez ici…"${verrou ? ' readonly' : ''}>${S.esc(enregistre)}</textarea>
        </div>
        <p class="note">${S.icon('book')} Les références bibliques (« Ps 23:4 », « Jean 3:16 ») deviendront des liens pour le lecteur. Raccourci : ⌘ S ou Ctrl S pour enregistrer.</p>
      </section>
      <aside class="ed-side" aria-label="Correction">
        <div class="panel ed-status" id="status" aria-live="polite"><span class="spin" aria-hidden="true"></span> Chargement du dictionnaire…</div>
        <div class="panel ed-ia" id="ia" hidden aria-live="polite"></div>
        <div class="ed-sum" id="sum" role="group" aria-label="Filtrer les remarques"></div>
        <div class="ed-list" id="list"></div>
        <div class="panel ed-word" id="word" hidden></div>
        ${page.versions.length > 1 ? `<details class="panel ed-hist"><summary>Historique : ${page.versions.length} versions</summary><ol>${page.versions.map((v) => `<li><strong>Version ${v.version}</strong> <span class="ash">${S.esc(S.dateLong(v.created_at))}${v.remplacee_le ? '' : ' · courante'}</span></li>`).join('')}</ol><p class="ash" style="font-size:13px">Rien n’est effacé : chaque version reste conservée.</p></details>` : ''}
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
  const visible = () => issues.filter((x) => x.type !== 'auto' && !ignored.has(keyOf(x)) && (!filter || x.type === filter));

  function list() {
    const v = issues.filter((x) => x.type !== 'auto' && !ignored.has(keyOf(x)));
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
    const harmo = issues.filter((x) => (x.type === 'typo' || x.type === 'auto') && x.sugg.length && !ignored.has(keyOf(x))).length;
    $('#fixTypo').disabled = !harmo;
    $('#fixTypo').innerHTML = `${S.icon('check')} Harmoniser la typographie${harmo ? ` (${harmo})` : ''}`;
    $('#fixTypo').title = 'Apostrophes courbes, espaces fines avant ; : ! ?, points de suspension…';
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
    const typo = issues.filter((x) => (x.type === 'typo' || x.type === 'auto') && x.sugg.length && !ignored.has(keyOf(x))).sort((a, z) => z.s - a.s);
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
  try { worker = new Worker('langue/correcteur.js?v=5'); } catch (e) { status(`${S.icon('x')} Ce navigateur ne peut pas lancer le correcteur.`); }
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

  /* ─── relecture par l'IA (Claude) : un second avis, à la demande ───
     Le texte part vers Anthropic seulement après l'accord de l'auteur (retenu
     sur l'appareil). Le serveur vérifie chaque proposition dans le texte ;
     ici, rien ne change sans un clic sur « Appliquer ». */
  const IA_OK = 'sozo-ia-accord';
  const T_IA = { orthographe: 'Orthographe', grammaire: 'Grammaire', conjugaison: 'Conjugaison', accord: 'Accord', ponctuation: 'Ponctuation', style: 'Style' };
  let propositions = [];
  function peindreIA() {
    const el = $('#ia');
    el.hidden = false;
    el.innerHTML = `<div class="ed-ia-h"><strong>${S.icon('spark')} Relecture par l’IA</strong><button class="icon-btn" type="button" data-ia-fermer aria-label="Fermer">${S.icon('x')}</button></div>`
      + (propositions.length ? propositions.map((p, i) => `<article class="ed-item ed-item--ia">
          <p class="mono">${T_IA[p.type] || 'Remarque'}</p>
          <p class="ed-ctx"><del>${S.esc(p.extrait)}</del> → <ins>${S.esc(p.correction)}</ins></p>
          <p>${S.esc(p.explication)}</p>
          <div class="ed-acts"><button type="button" class="btn btn--sm" data-ia-app="${i}">Appliquer</button><button type="button" class="btn btn--ghost btn--sm" data-ia-ign="${i}">Ignorer</button></div></article>`).join('')
        : `<p class="ash">L’IA ne relève aucune faute sur cette page. Relisez tout de même : rien ne remplace votre œil.</p>`);
  }
  async function relectureIA() {
    if (!ta.value.trim()) { S.toast('La page est vide : rien à relire.'); return; }
    let accord = false; try { accord = localStorage.getItem(IA_OK) === '1'; } catch (e) {}
    if (!accord) {
      S.modal({ title: 'Relecture par l’IA', body: `<p>Le texte de cette page va être envoyé à <strong>Anthropic (Claude)</strong>, le temps d’être relu. L’IA ne publie rien et n’enregistre rien : elle propose des corrections, et c’est vous qui décidez de chacune.</p><p class="note">${S.icon('shield')} Le correcteur de l’éditeur, lui, fonctionne sur votre appareil sans rien envoyer.</p>`,
        actions: [{ label: 'Annuler' }, { label: 'J’accepte, relire la page', primary: true, onClick: (close) => { close(); try { localStorage.setItem(IA_OK, '1'); } catch (e) {} relectureIA(); } }] });
      return;
    }
    const btn = $('#iaBtn'), el = $('#ia');
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    el.hidden = false; el.innerHTML = `<p><span class="spin" style="display:inline-block;vertical-align:-3px"></span> L’IA relit la page… (quelques secondes)</p>`;
    const r = await window.SOZO_API('POST', `${URL_PAGE}/relecture`, { texte: ta.value });
    btn.disabled = false; btn.removeAttribute('aria-busy');
    if (!r.ok) {
      el.innerHTML = `<div class="ed-ia-h"><strong>${S.icon('spark')} Relecture par l’IA</strong><button class="icon-btn" type="button" data-ia-fermer aria-label="Fermer">${S.icon('x')}</button></div><p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'La relecture n’a pas pu se faire.')}${r.d.code === 'ia_inactive' ? ' Le correcteur de l’éditeur reste disponible.' : ''}</span></p>`;
      return;
    }
    propositions = r.d.corrections.map((p) => ({ ...p, texte: ta.value }));
    peindreIA();
  }
  $('#iaBtn').addEventListener('click', relectureIA);
  $('#ia').addEventListener('click', (e) => {
    if (e.target.closest('[data-ia-fermer]')) { $('#ia').hidden = true; return; }
    const ap = e.target.closest('[data-ia-app]'), ig = e.target.closest('[data-ia-ign]');
    if (ig) { propositions.splice(+ig.dataset.iaIgn, 1); peindreIA(); return; }
    if (!ap) return;
    const p = propositions[+ap.dataset.iaApp];
    // Le texte a pu bouger depuis la relecture : on cherche l'extrait au plus près de sa place d'origine
    let at = ta.value.indexOf(p.extrait, Math.max(0, p.debut - 80));
    if (at < 0) at = ta.value.indexOf(p.extrait);
    if (at < 0) { S.toast('Ce passage a changé depuis la relecture : correction ignorée.'); propositions.splice(+ap.dataset.iaApp, 1); peindreIA(); return; }
    apply({ s: at, e: at + p.extrait.length }, p.correction);
    propositions.splice(+ap.dataset.iaApp, 1); peindreIA();
  });

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

  /* ─── saisie, enregistrement sur le serveur, compteurs ───
     « Enregistré » ne s'affiche qu'après la réponse du serveur. Entre-temps,
     une copie de secours reste sur l'appareil : une coupure réseau ne fait
     rien perdre. Pas d'enregistrement à chaque frappe : chaque envoi crée
     une version, l'historique resterait illisible. */
  let tCheck, tSecours, tAuto, envoi = null;
  const sale = () => ta.value !== enregistre;
  const marque = (t) => { $('#save').textContent = t; };
  async function enregistrer() {
    if (verrou || !sale()) { if (!verrou) marque(`Enregistré · version ${version}`); return; }
    if (envoi) return envoi;
    const texte = ta.value;
    $('#saveBtn').disabled = true; marque('Enregistrement…');
    envoi = window.SOZO_API('PUT', URL_PAGE, { contenu: texte, version_attendue: version || 0 }).then((r) => {
      envoi = null; $('#saveBtn').disabled = false;
      if (r.status === 409 && r.d.code === 'conflit') { conflit(texte, r.d); return; }
      if (!r.ok) {
        marque(r.status === 0 ? 'Hors ligne · copie gardée sur cet appareil' : 'Non enregistré');
        S.toast(r.d.erreur || 'Le serveur a refusé l’enregistrement.');
        return;
      }
      enregistre = texte;
      if (r.d.version) version = r.d.version;
      if (!sale()) { try { localStorage.removeItem(KEY); } catch (e) {} }
      marque(`Enregistré · version ${version}`);
    });
    return envoi;
  }
  /* Une autre fenêtre a enregistré cette page entre-temps : on ne choisit
     pas à la place de l'auteur, et rien n'est perdu (sa copie reste au secours). */
  function conflit(mien, serveur) {
    marque('Conflit : page modifiée ailleurs');
    S.modal({ title: 'Cette page a changé ailleurs', body: `<p>Une autre fenêtre ou un autre appareil a enregistré la <strong>version ${serveur.version}</strong> de cette page pendant que vous écriviez.</p>
      <div class="recap"><div><span>Début de l’autre version</span><strong>${S.esc((serveur.contenu || '').slice(0, 120)) || '(vide)'}…</strong></div></div>
      <p class="note">${S.icon('shield')} Quel que soit votre choix, rien n’est effacé : chaque version reste dans l’historique.</p>`,
      actions: [
        { label: 'Reprendre l’autre version', onClick: (close) => { close(); ta.value = serveur.contenu || ''; enregistre = ta.value; version = serveur.version; changed(true); marque(`Version ${version} chargée`); } },
        { label: 'Garder mon texte', primary: true, onClick: (close) => { close(); version = serveur.version; ta.value = mien; enregistrer(); } }
      ] });
  }
  function changed(now) {
    const words = (ta.value.match(/[\p{L}\d’'-]+/gu) || []).length;
    $('#count').textContent = `${words} mots · ${ta.value.length} signes · ${Math.max(1, Math.round(words / 230))} min de lecture`;
    paint();
    clearTimeout(tCheck); tCheck = setTimeout(run, now ? 0 : 450);
    if (verrou) return;
    if (sale()) marque('Modifications non enregistrées');
    clearTimeout(tSecours); tSecours = setTimeout(() => { try { if (sale()) localStorage.setItem(KEY, ta.value); } catch (e) {} }, 600);
    clearTimeout(tAuto); tAuto = setTimeout(() => { if (sale()) enregistrer(); }, 20000);
  }
  ta.addEventListener('input', () => { issues = issues.filter((x) => x.e <= ta.selectionStart - 1 || x.s >= ta.value.length); changed(false); });
  ta.addEventListener('scroll', () => { back.scrollTop = ta.scrollTop; });
  $('#saveBtn').addEventListener('click', enregistrer);
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); } });
  addEventListener('beforeunload', (e) => { if (!verrou && sale()) { e.preventDefault(); e.returnValue = ''; } });
  const essai = $('#essai');
  if (essai) essai.addEventListener('click', () => { if (ta.value.trim()) return; ta.value = ESSAI; essai.hidden = true; S.toast('Texte d’essai, avec des fautes volontaires. Il n’est enregistré que si vous cliquez sur « Enregistrer ».'); changed(true); });
  // L'aperçu montre ce que le SERVEUR a : on enregistre d'abord
  $('#apercu').addEventListener('click', async (e) => { if (!verrou && sale()) { e.preventDefault(); await enregistrer(); if (!sale()) open(e.currentTarget.href, '_blank', 'noopener'); } });
  const rest = $('#restaurer');
  if (rest) {
    rest.addEventListener('click', () => { ta.value = secours; $('#secours').remove(); changed(true); });
    $('#oublier').addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (e) {} $('#secours').remove(); });
  }
  const pb = $('#plumeBtn');
  if (pb) pb.addEventListener('click', async () => { const r = await window.SOZO_API('GET', '/api/studio'); if (r.ok) S.buy.plume(r.d.plume.prix); else S.toast(r.d.erreur || 'Plume est indisponible pour le moment.'); });
  changed(true);
  S.inkAll(); S.footer();
}).catch(window.SOZO_ERREUR);
