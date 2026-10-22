/* ═══════════════════════════════════════════════════════════
   Sōzō — écrire les pages d'un livre (refonte du 21/10/2026).

   « Lorsque l'utilisateur clique sur une page, il doit pouvoir défiler vers
   les autres de haut en bas, et les modifier directement » (le
   propriétaire). Toutes les pages s'empilent comme dans Word ; chacune est
   une feuille de la Plume (plume.js), modifiable sur place.

   Ce qui ne change pas, page par page :
   * le SERVEUR fait foi : « enregistrée » n'apparaît qu'après sa réponse ;
   * une copie de secours reste sur l'appareil tant que la page n'est pas
     enregistrée (une coupure réseau ne fait rien perdre) ;
   * conflit entre deux fenêtres : on ne choisit pas à la place de l'auteur ;
   * une page publiée sans Plume reste en lecture seule ;
   * pas d'enregistrement à chaque frappe (chaque envoi crée une version) :
     après 20 s de calme, ou avec « Enregistrer », ⌘S / Ctrl S.
   Le correcteur tourne sur l'appareil (Web Worker) ; la relecture par l'IA
   ne part qu'à la demande de l'auteur, après son accord.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, $ = (s, c = document) => c.querySelector(s);
  document.body.classList.add('ecriture');
  const main = $('#main');
  const id = S.q('id'), depart = +S.q('p') || 1;
  if (!id) { location.replace('studio.html'); return; }
  const enc = encodeURIComponent;
  const URL_LIVRE = `/api/studio/livres/${enc(id)}`;
  const PERSO = 'sozo-dico-perso';
  const ESSAI = `Il a manger son pain en silance, puis il a voulu sortir dehors. Les maison du quartier dormaient encore.Je ne voulais quitter cette ville , mais ils on décidé de partir sans moi.

Nous mange ensemble ce soir. Cette homme marchait vers la mer ; elle à peur de la nuit. J'ai du partir tôt pour monter en haut de la colline...

Quand je marche dans la vallée de l’ombre de la mort (Psaume 23:4), je pense à ma mère. Une lumière, une lumière douce, une lumière qui ne s’éteint pas.`;
  let personal = [];
  try { personal = JSON.parse(localStorage.getItem(PERSO)) || []; } catch (e) {}

  const [rl, rs] = await Promise.all([window.SOZO_API('GET', URL_LIVRE), window.SOZO_API('GET', '/api/studio')]);
  if (!rl.ok) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Livre introuvable</strong>${S.esc(rl.d.erreur || '')} Il n’existe pas, ou il n’est pas le vôtre.<br><br><a class="btn" href="studio.html">Retour à mes livres</a></div></div>`;
    S.footer(); return;
  }
  let livre = rl.d.livre;
  const plume = rs.ok && rs.d.plume && rs.d.plume.actif;
  const pg = (livre.apparence && livre.apparence.page) || {};
  const ETAT = { published: 'Publiée', scheduled: 'Programmée', draft: 'Brouillon' };

  let panneau = false;
  try { panneau = localStorage.getItem('sozo-ed-panneau') === '1'; } catch (e) {}
  main.innerHTML = `
  <header class="ec-barre">
    <a class="icon-btn" href="studio.html?id=${enc(id)}&tab=pages" aria-label="Retour à mes livres">${S.icon('left')}</a>
    <div class="ec-titre"><strong>${S.esc(livre.titre)}</strong><span id="etatDoc" role="status" aria-live="polite"></span></div>
    <div class="ec-outils">
      <label class="sr" for="allerA">Aller à la page</label>
      <select class="pl-sel ec-aller" id="allerA"></select>
      <button class="btn btn--ghost btn--sm" type="button" id="panneauBtn" aria-expanded="${panneau}" aria-controls="edPanneau">${S.icon('check')} <span class="ec-l">Correction</span> <span class="ec-nb" id="nbFautes" hidden></span></button>
      <button class="btn btn--ghost btn--sm" type="button" id="iaBtn">${S.icon('spark')} <span class="ec-l">IA</span></button>
      <button class="btn btn--sm" type="button" id="saveBtn">Enregistrer</button>
    </div>
  </header>
  <div class="ec">
    <div id="barre"></div>
    <div id="doc" aria-label="Les pages du livre"></div>
    <div class="ec-fin"><button class="btn btn--ghost" type="button" id="ajouter">${S.icon('plus')} Ajouter une page à la fin</button></div>
    <footer class="ec-pied" aria-live="polite"><span id="count"></span><span id="objectif"></span>
      <span class="ec-pied-a"><button class="ec-lien" type="button" id="essai" hidden>Essayer le correcteur</button>
      <button class="ec-lien" type="button" id="fixTypo" disabled>Harmoniser la typographie</button></span></footer>
  </div>
  <aside class="ed-side ec-panneau" id="edPanneau" aria-label="Correction"${panneau ? '' : ' hidden'}>
    <div class="ec-panneau-h"><strong>Correction <small class="ash" id="pageCorr"></small></strong>
      <label class="ec-coche"><input type="checkbox" id="souligner" checked> Souligner</label>
      <button class="icon-btn" type="button" id="panneauX" aria-label="Fermer la correction">${S.icon('x')}</button></div>
    <div class="ed-status" id="status" aria-live="polite"><span class="spin" aria-hidden="true"></span> Chargement du dictionnaire…</div>
    <div class="panel ed-ia" id="ia" hidden aria-live="polite"></div>
    <div class="ed-sum" id="sum" role="group" aria-label="Filtrer les remarques"></div>
    <div class="ed-list" id="list"></div>
    <div class="panel ed-word" id="word" hidden></div>
    <details class="ed-hist" id="hist" hidden><summary id="histT"></summary><ol id="histL"></ol><p class="ash" style="font-size:13px">Rien n’est effacé : chaque version reste conservée.</p></details>
    <p class="ec-astuce">Les références bibliques (« Ps 23:4 ») deviennent des liens pour le lecteur. ⌘ S ou Ctrl S : tout enregistrer. ⌘ F ou Ctrl F : rechercher.</p>
  </aside>`;
  const remplirAller = () => { $('#allerA').innerHTML = livre.pages.map((p) => `<option value="${p.n}">Page ${p.n}</option>`).join(''); };
  remplirAller();

  /* ─── la Plume ─── */
  const ed = window.SOZO_PLUME.editeur({
    barre: $('#barre'), doc: $('#doc'),
    reglages: { police: pg.police || 'cormorant', alignement: pg.alignement || 'gauche' },
    etiquette: (n) => `Texte de la page ${n}`,
    surReglage: async (k, v) => {
      // police et alignement : ceux que verra le LECTEUR, donc un réglage du livre
      const page = { ...((livre.apparence && livre.apparence.page) || {}), [k]: v };
      const r = await window.SOZO_API('PATCH', URL_LIVRE, { apparence: { couv: (livre.apparence && livre.apparence.couv) || {}, page } });
      if (!r.ok) { S.toast(r.d.erreur || 'Réglage refusé par le serveur.'); return; }
      livre.apparence = r.d.livre.apparence;
      S.toast(k === 'police' ? 'Police du livre enregistrée : vos lecteurs la verront aussi.' : 'Alignement du livre enregistré : vos lecteurs le verront aussi.');
    },
    surFocus: (f) => surFocus(f),
    surSaisie: (f) => change(f),
    surObjectif: () => compter(),
    surClic: (f) => { if (f === corrigee) montrerRemarqueSousCurseur(f); }
  });
  const parN = new Map();          // n → feuille
  let charges = [0, -1];           // pages chargées [de, a]
  const total = () => livre.pages.length;
  const infoPage = (n) => livre.pages.find((p) => p.n === n) || {};
  const derniereSortie = () => Math.max(0, ...livre.pages.filter((p) => p.statut !== 'draft').map((p) => p.n));
  const jetable = (n) => infoPage(n).statut === 'draft' && n > derniereSortie();
  const clefSecours = (n) => `sozo-secours:${id}:${n}`;
  let motsDebut = null;

  function entete(p) {
    return `<strong>Page ${p.n}</strong><span>${ETAT[p.statut] || ''}${p.acces === 'paid' ? ' · payante' : ''}</span><span data-etat>${p.version ? `version ${p.version}` : 'vide'}</span>
      <span class="pl-page-a">
        <a class="icon-btn" href="lire.html?id=${enc(id)}&p=${p.n}" target="_blank" rel="noopener" data-apercu="${p.n}" aria-label="Aperçu lecteur de la page ${p.n}" title="Aperçu lecteur">${S.icon('eye')}</a>
        ${jetable(p.n) ? `<button class="icon-btn" type="button" data-jeter="${p.n}" aria-label="Mettre la page ${p.n} à la corbeille" title="Mettre à la corbeille">${S.icon('corbeille')}</button>` : ''}
        <span class="pl-menu"><button class="icon-btn" type="button" data-menu-page="${p.n}" aria-haspopup="true" aria-expanded="false" aria-label="Plus d’actions sur la page ${p.n}" title="Plus d’actions">${S.icon('dots')}</button>
          <span class="pl-pop pl-pop--d" data-pop-page="${p.n}" hidden>
            ${p.n >= derniereSortie() ? `<button type="button" data-pg="inserer">${S.icon('plus')} Insérer une page après <small>un brouillon vide, juste après celle-ci</small></button>` : ''}
            <button type="button" data-pg="dupliquer">${S.icon('file')} Dupliquer la page <small>${p.n >= derniereSortie() ? 'la copie vient juste après' : 'la copie va à la fin du livre'}</small></button>
            ${jetable(p.n) ? `<button type="button" data-pg="couper">${S.icon('separateur')} Couper avant ce paragraphe <small>placez d’abord le curseur dans le paragraphe</small></button>` : ''}
            ${jetable(p.n) && jetable(p.n + 1) ? `<button type="button" data-pg="fusionner">${S.icon('down')} Fusionner avec la page suivante <small>la suivante va à la corbeille</small></button>` : ''}
          </span></span>
      </span>`;
  }
  function creerFeuille(p, avant) {
    const verrou = p.statut === 'published' && !plume;
    const f = ed.ajouter({ cle: p.n, texte: p.contenu, verrou, entete: entete(p), avant });
    Object.assign(f, { n: p.n, version: p.version, enregistre: ed.texte(f), statut: p.statut, envoi: null, tAuto: null, tSecours: null });
    const h = f.bloc.querySelector('.pl-page-h');
    if (verrou) h.insertAdjacentHTML('afterend', `<p class="warn ec-msg">${S.icon('lock')}<span><strong>Page publiée.</strong> Son texte ne se corrige qu’avec Plume, en nouvelle version (l’ancienne reste dans l’historique). <button class="btn btn--sm" type="button" data-plume>Passer à Plume</button></span></p>`);
    else if (p.statut === 'published') h.insertAdjacentHTML('afterend', `<p class="note ec-msg">${S.icon('feather')} Page publiée, corrigée avec Plume : chaque enregistrement crée une nouvelle version.</p>`);
    let secours = null;
    try { secours = localStorage.getItem(clefSecours(p.n)); } catch (e) {}
    if (secours != null && secours !== f.enregistre && !verrou) {
      h.insertAdjacentHTML('afterend', `<p class="warn ec-msg" data-secours>${S.icon('clock')}<span>Une copie plus récente de cette page est restée sur cet appareil. <button class="btn btn--sm" type="button" data-reprendre>La reprendre</button> <button class="btn btn--ghost btn--sm" type="button" data-oublier>L’oublier</button></span></p>`);
      f.secours = secours;
    } else if (secours != null) { try { localStorage.removeItem(clefSecours(p.n)); } catch (e) {} }
    parN.set(p.n, f);
    return f;
  }

  /* ─── chargement par lots de 24 (un livre de 2 000 pages ne part pas d'un bloc) ─── */
  let enCharge = false;
  async function charger(de, a, devant) {
    de = Math.max(1, de); a = Math.min(total(), a);
    if (a < de || enCharge) return;
    enCharge = true;
    const r = await window.SOZO_API('GET', `${URL_LIVRE}/textes?de=${de}&a=${a}`);
    enCharge = false;
    if (!r.ok) { S.toast(r.d.erreur || 'Ces pages n’ont pas pu se charger.'); return; }
    const avant = devant ? parN.get(charges[0]) : null;
    const hautAvant = avant ? avant.bloc.getBoundingClientRect().top : 0;
    r.d.pages.forEach((p) => { if (!parN.has(p.n)) creerFeuille(p, avant); });
    if (avant) scrollBy(0, avant.bloc.getBoundingClientRect().top - hautAvant);   // le texte sous les yeux ne saute pas
    charges = charges[1] < charges[0] ? [de, a] : [Math.min(charges[0], de), Math.max(charges[1], a)];
    compter();
  }
  addEventListener('scroll', () => {
    if (enCharge || !total()) return;
    if (charges[1] < total() && innerHeight + scrollY > document.documentElement.scrollHeight - 1600) charger(charges[1] + 1, charges[1] + 24);
    else if (charges[0] > 1 && scrollY < 900) charger(charges[0] - 24, charges[0] - 1, true);
  }, { passive: true });

  async function vider() { ed.feuilles.slice().forEach((f) => ed.retirer(f)); parN.clear(); charges = [0, -1]; corrigee = null; }
  async function aller(n, focus) {
    if (!parN.has(n)) {
      // trop loin : on recharge autour de la page demandée, après avoir tout enregistré
      await toutEnregistrer();
      if (ed.feuilles.some(sale)) { S.toast('Des pages ne sont pas enregistrées : enregistrez-les avant d’aller si loin.'); return; }
      await vider();
      await charger(n - 3, n + 20);
    }
    const f = parN.get(n);
    if (!f) return;
    f.bloc.scrollIntoView({ block: 'start', behavior: S.reduced ? 'auto' : 'smooth' });
    if (focus && !f.verrou) setTimeout(() => f.el.focus({ preventScroll: true }), 60);
  }

  /* ─── enregistrer ─── */
  const sale = (f) => !f.verrou && ed.texte(f) !== f.enregistre;
  const marque = (f, t) => { const e = f.bloc.querySelector('[data-etat]'); if (e) e.textContent = t; etatDoc(); };
  function etatDoc() {
    const n = ed.feuilles.filter(sale).length;
    $('#etatDoc').textContent = n ? `${n} page${n > 1 ? 's' : ''} non enregistrée${n > 1 ? 's' : ''}` : `${total()} page${total() > 1 ? 's' : ''} · tout est enregistré`;
  }
  function enregistrer(f) {
    if (!sale(f)) return Promise.resolve();
    if (f.envoi) return f.envoi;
    const texte = ed.texte(f);
    marque(f, 'enregistrement…');
    f.envoi = window.SOZO_API('PUT', `${URL_LIVRE}/pages/${f.n}`, { contenu: texte, version_attendue: f.version || 0 }).then((r) => {
      f.envoi = null;
      if (r.status === 409 && r.d.code === 'conflit') { conflit(f, texte, r.d); return; }
      if (!r.ok) {
        marque(f, r.status === 0 ? 'hors ligne · copie gardée sur cet appareil' : 'non enregistrée');
        S.toast(r.d.erreur || 'Le serveur a refusé l’enregistrement.');
        return;
      }
      f.enregistre = texte;
      if (r.d.version) f.version = r.d.version;
      if (!sale(f)) { try { localStorage.removeItem(clefSecours(f.n)); } catch (e) {} }
      marque(f, sale(f) ? 'modifiée' : `enregistrée · version ${f.version}`);
      infoPage(f.n).version = f.version;
    });
    return f.envoi;
  }
  const toutEnregistrer = () => Promise.all(ed.feuilles.filter(sale).map(enregistrer));
  function conflit(f, mien, serveur) {
    marque(f, 'conflit : modifiée ailleurs');
    S.modal({ title: `La page ${f.n} a changé ailleurs`, body: `<p>Une autre fenêtre ou un autre appareil a enregistré la <strong>version ${serveur.version}</strong> de cette page pendant que vous écriviez.</p>
      <div class="recap"><div><span>Début de l’autre version</span><strong>${S.esc((serveur.contenu || '').slice(0, 120)) || '(vide)'}…</strong></div></div>
      <p class="note">${S.icon('shield')} Quel que soit votre choix, rien n’est effacé : chaque version reste dans l’historique.</p>`,
      actions: [
        { label: 'Reprendre l’autre version', onClick: (close) => { close(); ed.remplacerTout(f, serveur.contenu || ''); f.enregistre = ed.texte(f); f.version = serveur.version; marque(f, `version ${f.version} chargée`); change(f, true); } },
        { label: 'Garder mon texte', primary: true, onClick: (close) => { close(); f.version = serveur.version; ed.remplacerTout(f, mien); enregistrer(f); } }
      ] });
  }
  function change(f, maintenant) {
    if (f.verrou) return;
    if (sale(f)) marque(f, 'modifiée');
    clearTimeout(f.tSecours); f.tSecours = setTimeout(() => { try { if (sale(f)) localStorage.setItem(clefSecours(f.n), ed.texte(f)); } catch (e) {} }, 600);
    clearTimeout(f.tAuto); f.tAuto = setTimeout(() => { if (sale(f)) enregistrer(f); }, 20000);
    compter();
    if (f === corrigee) { clearTimeout(tCheck); tCheck = setTimeout(verifier, maintenant ? 0 : 450); }
  }
  $('#saveBtn').addEventListener('click', async () => { await toutEnregistrer(); if (!ed.feuilles.some(sale)) S.toast('Tout est enregistré.'); });
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); toutEnregistrer(); } });
  addEventListener('beforeunload', (e) => { if (ed.feuilles.some(sale)) { e.preventDefault(); e.returnValue = ''; } });

  /* ─── compteur et objectif ─── */
  function compter() {
    const f = ed.active;
    const tout = ed.feuilles.reduce((s, x) => s + ed.mots(ed.plat(x)), 0);
    if (motsDebut == null && ed.feuilles.length) motsDebut = tout;
    const ici = f ? ed.mots(ed.plat(f)) : 0;
    $('#count').textContent = f ? `Page ${f.n} : ${ici} mot${ici > 1 ? 's' : ''} · ${Math.max(1, Math.round(ici / 230))} min de lecture` : `${tout} mots dans les pages ouvertes`;
    const obj = ed.objectif(), fait = Math.max(0, tout - (motsDebut || 0));
    $('#objectif').innerHTML = obj ? `<span class="ec-obj" role="progressbar" aria-valuemin="0" aria-valuemax="${obj}" aria-valuenow="${Math.min(fait, obj)}" aria-label="Objectif de mots"><i style="width:${Math.min(100, (fait / obj) * 100)}%"></i></span> ${fait} / ${obj} mots${fait >= obj ? ' · objectif atteint' : ''}` : '';
  }

  /* ─── le correcteur : il suit la page où l'on écrit ─── */
  const TYPES = { orth: ['Orthographe', 'orth'], gram: ['Grammaire', 'gram'], typo: ['Typographie', 'typo'], voc: ['Vocabulaire', 'voc'] };
  let issues = [], seq = 0, ready = false, filter = '', corrigee = null, tCheck;
  const ignored = new Set();
  const plain = () => (corrigee ? ed.plat(corrigee) : '');
  const keyOf = (x) => `${x.rule}|${plain().slice(x.s, x.e)}`;
  const visible = () => issues.filter((x) => x.type !== 'auto' && !ignored.has(keyOf(x)) && (!filter || x.type === filter));
  const ouvrirPanneau = (o) => {
    panneau = o; $('#edPanneau').hidden = !o; $('#panneauBtn').setAttribute('aria-expanded', String(o));
    document.body.classList.toggle('ec-avec-panneau', o);
    try { localStorage.setItem('sozo-ed-panneau', o ? '1' : '0'); } catch (e) {}
  };
  document.body.classList.toggle('ec-avec-panneau', panneau);
  $('#panneauBtn').addEventListener('click', () => ouvrirPanneau(!panneau));
  $('#panneauX').addEventListener('click', () => { ouvrirPanneau(false); $('#panneauBtn').focus(); });
  let souligner = true;
  try { souligner = localStorage.getItem('sozo-ed-souligner') !== '0'; } catch (e) {}
  $('#souligner').checked = souligner;
  document.body.classList.toggle('ec-sans-soulignes', !souligner);
  $('#souligner').addEventListener('change', (e) => { souligner = e.target.checked; document.body.classList.toggle('ec-sans-soulignes', !souligner); try { localStorage.setItem('sozo-ed-souligner', souligner ? '1' : '0'); } catch (er) {} });

  function surFocus(f) {
    if (corrigee !== f) {
      corrigee = f; issues = []; filter = ''; propositions = [];
      $('#ia').hidden = true; $('#word').hidden = true;
      $('#pageCorr').textContent = `· page ${f.n}`;
      $('#allerA').value = String(f.n);
      $('#essai').hidden = !!ed.plat(f).trim() || f.verrou;
      list(); verifier(); histoire(f);
    }
    compter();
  }
  async function histoire(f) {
    $('#hist').hidden = true;
    const r = await window.SOZO_API('GET', `${URL_LIVRE}/pages/${f.n}`);
    if (!r.ok || corrigee !== f || r.d.versions.length < 2) return;
    $('#histT').textContent = `Historique de la page ${f.n} : ${r.d.versions.length} versions`;
    $('#histL').innerHTML = r.d.versions.map((v) => `<li><strong>Version ${v.version}</strong> <span class="ash">${S.esc(S.dateLong(v.created_at))}${v.remplacee_le ? '' : ' · courante'}</span>
      ${v.remplacee_le ? `<span class="row-acts"><button class="ec-lien" type="button" data-voir-v="${v.version}">Voir</button><button class="ec-lien" type="button" data-restaurer-v="${v.version}">Restaurer</button></span>` : ''}</li>`).join('');
    $('#hist').hidden = false;
  }
  /* Revenir à une ancienne version (21/10/2026) : le serveur crée une NOUVELLE
     version avec l'ancien texte — rien n'est écrasé, pas même ce qu'on quitte. */
  $('#histL').addEventListener('click', async (e) => {
    const vv = e.target.closest('[data-voir-v]'), rv = e.target.closest('[data-restaurer-v]');
    const f = corrigee; if (!f || (!vv && !rv)) return;
    const ver = +(vv || rv).dataset[vv ? 'voirV' : 'restaurerV'];
    if (vv) {
      const r = await window.SOZO_API('GET', `${URL_LIVRE}/pages/${f.n}/versions/${ver}`);
      if (!r.ok) { S.toast(r.d.erreur || 'Version introuvable.'); return; }
      S.modal({ title: `Page ${f.n} · version ${ver}`, body: `<p class="ash">${S.esc(S.dateLong(r.d.version.created_at))}</p><div class="rd-text ec-version">${S.mise.paragraphes(r.d.version.contenu, {}, (t) => S.esc(t) || '&nbsp;')}</div>`,
        actions: [{ label: 'Fermer' }, { label: 'Restaurer cette version', primary: true, onClick: (close) => { close(); restaurerVersion(f, ver); } }] });
      return;
    }
    restaurerVersion(f, ver);
  });
  async function restaurerVersion(f, ver) {
    if (sale(f) && !confirm(`La page ${f.n} a des modifications non enregistrées : elles seront remplacées par la version ${ver}. Continuer ?`)) return;
    const r = await window.SOZO_API('POST', `${URL_LIVRE}/pages/${f.n}/versions/${ver}/restaurer`);
    if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
    const pg = await window.SOZO_API('GET', `${URL_LIVRE}/pages/${f.n}`);
    if (pg.ok) {
      ed.remplacerTout(f, pg.d.contenu); f.enregistre = ed.texte(f); f.version = pg.d.version;
      try { localStorage.removeItem(clefSecours(f.n)); } catch (er) {}
      marque(f, `version ${ver} restaurée · version ${f.version}`);
    }
    S.toast(r.d.inchange ? 'C’est déjà le texte actuel.' : `Version ${ver} restaurée (nouvelle version ${r.d.version}). Rien n’est effacé.`);
    histoire(f); verifier();
  }
  function list() {
    if (!corrigee) return;
    const v = issues.filter((x) => x.type !== 'auto' && !ignored.has(keyOf(x)));
    const c = { orth: 0, gram: 0, typo: 0, voc: 0 };
    v.forEach((x) => { c[x.type] = (c[x.type] || 0) + 1; });
    const nb = v.length, pastille = $('#nbFautes');
    pastille.hidden = !nb; pastille.textContent = nb;
    $('#panneauBtn').setAttribute('aria-label', `Correction${nb ? ` : ${nb} remarque${nb > 1 ? 's' : ''} sur la page ${corrigee.n}` : ''}`);
    $('#sum').innerHTML = Object.entries(TYPES).map(([k, [l]]) => `<button type="button" class="ed-chip ed-chip--${k}" data-f="${k}" aria-pressed="${filter === k}"><b>${c[k]}</b>${l}</button>`).join('');
    const vis = visible(), t = plain();
    $('#list').innerHTML = vis.length ? vis.map((x, i) => `
      <article class="ed-item ed-item--${x.type}" data-i="${i}">
        <p class="mono">${TYPES[x.type][0]}</p>
        <p class="ed-ctx">…${S.esc(t.slice(Math.max(0, x.s - 24), x.s))}<mark>${S.esc(t.slice(x.s, x.e)) || '␣'}</mark>${S.esc(t.slice(x.e, x.e + 24))}…</p>
        <p>${S.esc(x.msg)}</p>
        <div class="ed-acts">
          ${corrigee.verrou ? '' : x.sugg.slice(0, 4).map((s, k) => `<button type="button" class="btn btn--sm" data-fix="${i}" data-k="${k}">${S.esc(s.trim() || '(supprimer)')}</button>`).join('')}
          ${x.type === 'orth' ? `<button type="button" class="btn btn--ghost btn--sm" data-add="${i}">Ajouter au dictionnaire</button>` : ''}
          <button type="button" class="btn btn--ghost btn--sm" data-ign="${i}">Ignorer</button>
        </div>
      </article>`).join('')
      : `<div class="empty"><strong>${filter ? 'Rien dans cette catégorie' : 'Aucune faute relevée'}</strong>${filter ? '' : 'Le correcteur ne voit rien à reprendre sur cette page. Relisez tout de même : aucun outil ne remplace l’œil de l’auteur.'}</div>`;
    const harmo = issues.filter((x) => (x.type === 'typo' || x.type === 'auto') && x.sugg.length && !ignored.has(keyOf(x))).length;
    $('#fixTypo').disabled = !harmo || corrigee.verrou;
    $('#fixTypo').innerHTML = `${S.icon('check')} Harmoniser la typographie${harmo ? ` (${harmo})` : ''}`;
    $('#fixTypo').title = 'Apostrophes courbes, espaces fines avant ; : ! ?, points de suspension…';
    ed.souligner(corrigee, visible());
  }
  function appliquer(x, s) {
    if (!ed.remplacer(corrigee, x.s, x.e, s)) { S.toast('Ce passage a changé : relancez la correction.'); return; }
    const d = s.length - (x.e - x.s);
    issues = issues.filter((y) => y !== x).map((y) => (y.s >= x.e ? { ...y, s: y.s + d, e: y.e + d } : y));
    list();
  }
  $('#list').addEventListener('click', (e) => {
    const fx = e.target.closest('[data-fix]'), a = e.target.closest('[data-add]'), g = e.target.closest('[data-ign]'), item = e.target.closest('.ed-item');
    const vis = visible();
    if (fx) { const x = vis[+fx.dataset.fix]; appliquer(x, x.sugg[+fx.dataset.k]); return; }
    if (a) { const x = vis[+a.dataset.add]; const w = plain().slice(x.s, x.e); personal.push(w); try { localStorage.setItem(PERSO, JSON.stringify(personal)); } catch (er) {} S.toast(`« ${w} » ajouté à votre dictionnaire (sur cet appareil).`); verifier(); return; }
    if (g) { ignored.add(keyOf(vis[+g.dataset.ign])); list(); return; }
    if (item) { const x = vis[+item.dataset.i]; ed.selectionner(corrigee, x.s, x.e); }
  });
  $('#sum').addEventListener('click', (e) => { const c = e.target.closest('[data-f]'); if (!c) return; filter = filter === c.dataset.f ? '' : c.dataset.f; list(); });
  $('#fixTypo').addEventListener('click', () => {
    const typo = issues.filter((x) => (x.type === 'typo' || x.type === 'auto') && x.sugg.length && !ignored.has(keyOf(x))).sort((a, z) => z.s - a.s);
    let n = 0, last = Infinity;
    typo.forEach((x) => { if (x.e > last) return; if (ed.remplacer(corrigee, x.s, x.e, x.sugg[0])) n++; last = x.s; });
    S.toast(`${n} correction${n > 1 ? 's' : ''} typographique${n > 1 ? 's' : ''} appliquée${n > 1 ? 's' : ''}. ⌘Z pour annuler.`);
    change(corrigee, true);
  });
  // Un clic sur un mot souligné montre sa remarque, comme dans Word
  function montrerRemarqueSousCurseur(f) {
    const o = ed.curseur(f);
    if (o == null) return;
    const vis = visible(), i = vis.findIndex((x) => o >= x.s && o <= x.e);
    if (i < 0) return;
    if (!panneau) ouvrirPanneau(true);
    const el = $(`#list .ed-item[data-i="${i}"]`);
    if (el) { el.scrollIntoView({ block: 'nearest' }); el.classList.add('is-vise'); setTimeout(() => el.classList.remove('is-vise'), 1400); }
  }

  const status = (h) => { $('#status').innerHTML = h; };
  let worker;
  try { worker = new Worker('langue/correcteur.js?v=5'); } catch (e) { status(`${S.icon('x')} Ce navigateur ne peut pas lancer le correcteur.`); }
  if (worker) {
    worker.onmessage = (ev) => {
      const d = ev.data;
      if (d.type === 'progress') status(`<span class="spin" aria-hidden="true"></span> ${S.esc(d.step)}`);
      if (d.type === 'ready') { ready = true; status(`${S.icon('check')} Dictionnaire chargé : ${d.forms.toLocaleString('fr-FR')} formes du français.`); verifier(); }
      if (d.type === 'result' && d.id === seq && corrigee) { issues = d.issues; list(); }
      if (d.type === 'wordinfo') showWord(d.info);
      if (d.type === 'error') status(`${S.icon('x')} Le correcteur a rencontré un problème : ${S.esc(d.message)}`);
    };
    worker.onerror = () => status(`${S.icon('x')} Le dictionnaire n’a pas pu être chargé (connexion ?). Vous pouvez écrire quand même.`);
    worker.postMessage({ type: 'init', base: new URL('langue/', location.href).href });
  }
  const verifier = () => { if (ready && corrigee) worker.postMessage({ type: 'check', id: ++seq, text: plain(), personal }); };

  /* ─── relecture par l'IA (Claude) : un second avis, à la demande, page par page ─── */
  const IA_OK = 'sozo-ia-accord';
  const T_IA = { orthographe: 'Orthographe', grammaire: 'Grammaire', conjugaison: 'Conjugaison', accord: 'Accord', ponctuation: 'Ponctuation', style: 'Style' };
  let propositions = [];
  function peindreIA() {
    const el = $('#ia');
    el.hidden = false;
    el.innerHTML = `<div class="ed-ia-h"><strong>${S.icon('spark')} Relecture par l’IA · page ${corrigee.n}</strong><button class="icon-btn" type="button" data-ia-fermer aria-label="Fermer">${S.icon('x')}</button></div>`
      + (propositions.length ? propositions.map((p, i) => `<article class="ed-item ed-item--ia">
          <p class="mono">${T_IA[p.type] || 'Remarque'}</p>
          <p class="ed-ctx"><del>${S.esc(p.extrait)}</del> → <ins>${S.esc(p.correction)}</ins></p>
          <p>${S.esc(p.explication)}</p>
          <div class="ed-acts"><button type="button" class="btn btn--sm" data-ia-app="${i}">Appliquer</button><button type="button" class="btn btn--ghost btn--sm" data-ia-ign="${i}">Ignorer</button></div></article>`).join('')
        : `<p class="ash">L’IA ne relève aucune faute sur cette page. Relisez tout de même : rien ne remplace votre œil.</p>`);
  }
  async function relectureIA() {
    if (!corrigee) { S.toast('Cliquez d’abord dans la page à relire.'); return; }
    const texte = plain();
    if (!texte.trim()) { S.toast('La page est vide : rien à relire.'); return; }
    let accord = false; try { accord = localStorage.getItem(IA_OK) === '1'; } catch (e) {}
    if (!accord) {
      S.modal({ title: 'Relecture par l’IA', body: `<p>Le texte de la page ${corrigee.n} va être envoyé à <strong>Anthropic (Claude)</strong>, le temps d’être relu. L’IA ne publie rien et n’enregistre rien : elle propose des corrections, et c’est vous qui décidez de chacune.</p><p class="note">${S.icon('shield')} Le correcteur de l’éditeur, lui, fonctionne sur votre appareil sans rien envoyer.</p>`,
        actions: [{ label: 'Annuler' }, { label: 'J’accepte, relire la page', primary: true, onClick: (close) => { close(); try { localStorage.setItem(IA_OK, '1'); } catch (e) {} relectureIA(); } }] });
      return;
    }
    ouvrirPanneau(true);
    const btn = $('#iaBtn'), el = $('#ia'), f = corrigee;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    el.hidden = false; el.innerHTML = `<p><span class="spin" style="display:inline-block;vertical-align:-3px"></span> L’IA relit la page ${f.n}… (quelques secondes)</p>`;
    const r = await window.SOZO_API('POST', `${URL_LIVRE}/pages/${f.n}/relecture`, { texte });
    btn.disabled = false; btn.removeAttribute('aria-busy');
    if (corrigee !== f) return;
    if (!r.ok) {
      el.innerHTML = `<div class="ed-ia-h"><strong>${S.icon('spark')} Relecture par l’IA</strong><button class="icon-btn" type="button" data-ia-fermer aria-label="Fermer">${S.icon('x')}</button></div><p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'La relecture n’a pas pu se faire.')}${r.d.code === 'ia_inactive' ? ' Le correcteur de l’éditeur reste disponible.' : ''}</span></p>`;
      return;
    }
    propositions = r.d.corrections;
    peindreIA();
  }
  $('#iaBtn').addEventListener('click', relectureIA);
  $('#ia').addEventListener('click', (e) => {
    if (e.target.closest('[data-ia-fermer]')) { $('#ia').hidden = true; return; }
    const ap = e.target.closest('[data-ia-app]'), ig = e.target.closest('[data-ia-ign]');
    if (ig) { propositions.splice(+ig.dataset.iaIgn, 1); peindreIA(); return; }
    if (!ap) return;
    const p = propositions[+ap.dataset.iaApp], t = plain();
    // le texte a pu bouger depuis la relecture : on cherche l'extrait au plus près de sa place d'origine
    let at = t.indexOf(p.extrait, Math.max(0, p.debut - 80));
    if (at < 0) at = t.indexOf(p.extrait);
    if (at < 0 || !ed.remplacer(corrigee, at, at + p.extrait.length, p.correction)) S.toast('Ce passage a changé depuis la relecture : correction ignorée.');
    propositions.splice(+ap.dataset.iaApp, 1); peindreIA();
  });

  /* ─── fiche du mot (double-clic) : nature, synonymes, conjugaison ─── */
  let selMot = null;
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
  $('#word').addEventListener('mousedown', (e) => { if (e.target.closest('[data-syn]')) e.preventDefault(); });
  $('#word').addEventListener('click', (e) => {
    const s = e.target.closest('[data-syn]'); if (!s || !selMot || !corrigee || corrigee.verrou) return;
    corrigee.el.focus({ preventScroll: true });
    const sl = getSelection(); sl.removeAllRanges(); sl.addRange(selMot);
    document.execCommand('insertText', false, s.dataset.syn);
    change(corrigee, true);
  });
  $('#doc').addEventListener('dblclick', () => {
    setTimeout(() => {
      const sl = getSelection(), w = sl.toString().trim();
      if (worker && ready && sl.rangeCount && /^[\p{L}’'-]{2,}$/u.test(w)) {
        selMot = sl.getRangeAt(0).cloneRange();
        if (!panneau) ouvrirPanneau(true);
        const el = $('#word'); el.hidden = false;
        el.innerHTML = `<p class="mono ash">Le mot</p><h3>${S.esc(w)}</h3><p class="ash"><span class="spin" style="display:inline-block;vertical-align:-3px"></span> Recherche de la nature, des synonymes et de la conjugaison…</p>`;
        worker.postMessage({ type: 'word', w });
      }
    }, 10);
  });

  /* ─── actions des feuilles : copie de secours, aperçu, corbeille, Plume ─── */
  $('#doc').addEventListener('click', async (e) => {
    const bloc = e.target.closest('.pl-page'); if (!bloc) return;
    const f = parN.get(+bloc.dataset.cle); if (!f) return;
    if (e.target.closest('[data-reprendre]')) { ed.remplacerTout(f, f.secours); bloc.querySelector('[data-secours]').remove(); change(f, true); return; }
    if (e.target.closest('[data-oublier]')) { try { localStorage.removeItem(clefSecours(f.n)); } catch (er) {} bloc.querySelector('[data-secours]').remove(); return; }
    const ap = e.target.closest('[data-apercu]');
    // l'aperçu montre ce que le SERVEUR a : on enregistre d'abord
    if (ap && sale(f)) { e.preventDefault(); await enregistrer(f); if (!sale(f)) open(ap.href, '_blank', 'noopener'); return; }
    if (e.target.closest('[data-plume]')) { const r = await window.SOZO_API('GET', '/api/studio'); if (r.ok) S.buy.plume(); else S.toast(r.d.erreur || 'Plume est indisponible pour le moment.'); return; }
    if (e.target.closest('[data-jeter]')) { jeter(f); return; }
    const mb = e.target.closest('[data-menu-page]');
    if (mb) {
      const pop = bloc.querySelector('[data-pop-page]'), ouvrir = pop.hidden;
      document.querySelectorAll('[data-pop-page]').forEach((x) => { x.hidden = true; });
      document.querySelectorAll('[data-menu-page]').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      pop.hidden = !ouvrir; mb.setAttribute('aria-expanded', String(ouvrir));
      return;
    }
    const act = e.target.closest('[data-pg]');
    if (act) { bloc.querySelector('[data-pop-page]').hidden = true; actionPage(f, act.dataset.pg); }
  });
  // le curseur garde sa place quand on ouvre le menu d'une page
  $('#doc').addEventListener('mousedown', (e) => { if (e.target.closest('[data-pg], [data-menu-page]')) e.preventDefault(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.pl-page-a .pl-menu')) document.querySelectorAll('[data-pop-page]').forEach((x) => { x.hidden = true; }); });

  /* Insérer, dupliquer, couper, fusionner (21/10/2026). Tout part du texte
     ENREGISTRÉ : on enregistre d'abord, et le serveur refuse ce qui ferait
     bouger une page sortie. */
  function positionCoupe(f) {
    const sl = getSelection();
    if (!sl.rangeCount || !f.el.contains(sl.anchorNode)) return null;
    let blocC = sl.anchorNode;
    while (blocC && blocC.parentNode !== f.el) blocC = blocC.parentNode;
    const blocs = [...f.el.children], i = blocs.indexOf(blocC);
    if (i <= 0) return 0;
    const copie = f.el.cloneNode(true);
    [...copie.children].slice(i).forEach((x) => x.remove());
    return window.SOZO_PLUME.versTexte(copie).length + 1;
  }
  async function actionPage(f, k) {
    let pos = null;
    if (k === 'couper') {
      pos = positionCoupe(f);
      if (!pos) { S.toast('Placez le curseur dans le paragraphe qui doit commencer la nouvelle page (pas le premier).'); return; }
    }
    await toutEnregistrer();
    if (ed.feuilles.some(sale)) { S.toast('Des pages ne sont pas enregistrées : rien n’a changé.'); return; }
    const base = `${URL_LIVRE}/pages/${f.n}`;
    const r = k === 'inserer' ? await window.SOZO_API('POST', `${URL_LIVRE}/pages`, { contenu: '', apres: f.n })
      : k === 'dupliquer' ? await window.SOZO_API('POST', `${base}/dupliquer`)
      : k === 'couper' ? await window.SOZO_API('POST', `${base}/couper`, { position: pos })
      : await window.SOZO_API('POST', `${base}/fusionner`);
    if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
    const cible = r.d.n || f.n;
    await reconstruire(cible);
    aller(cible, true);
    S.toast({ inserer: `Page ${cible} insérée.`, dupliquer: `Copie créée : page ${cible}.`, couper: `La page est coupée : la suite est maintenant la page ${cible}.`, fusionner: 'Pages fusionnées. L’ancienne page suivante est dans la corbeille.' }[k]);
  }
  async function relireLivre() {
    const r = await window.SOZO_API('GET', URL_LIVRE);
    if (r.ok) livre = r.d.livre;
    remplirAller();
  }
  async function reconstruire(autour) {
    await vider();
    await relireLivre();
    await charger(autour - 3, autour + 20);
    etatDoc();
  }
  function jeter(f) {
    S.modal({ title: `Mettre la page ${f.n} à la corbeille ?`, body: `<p>Elle quitte le livre, avec toutes ses versions, et reste dans la corbeille de l’atelier : vous pourrez la récupérer quand vous voulez.</p>${f.n < total() ? '<p class="ash">Les brouillons qui la suivent reculent d’un numéro.</p>' : ''}`,
      actions: [{ label: 'Annuler' }, { label: 'Mettre à la corbeille', primary: true, onClick: async (close) => {
        close();
        await toutEnregistrer();
        if (ed.feuilles.some(sale)) { S.toast('Des pages ne sont pas enregistrées : rien n’a été jeté.'); return; }
        const n = f.n;
        const r = await window.SOZO_API('DELETE', `${URL_LIVRE}/pages/${n}`);
        if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
        try { localStorage.removeItem(clefSecours(n)); } catch (e) {}
        await reconstruire(Math.max(1, n - 1));
        annulable(r.d.page, n);
      } }] });
  }
  // « Annuler » : la page revient à SA place (restaurée à la fin, puis remise au bon numéro)
  function annulable(pid, n) {
    const t = document.createElement('div');
    t.className = 'ec-annuler';
    t.setAttribute('role', 'status');
    t.innerHTML = `<span>Page ${n} mise à la corbeille.</span> <button class="btn btn--sm btn--accent" type="button">Annuler</button>`;
    document.body.appendChild(t);
    const fin = setTimeout(() => t.remove(), 10000);
    t.querySelector('button').addEventListener('click', async () => {
      clearTimeout(fin); t.remove();
      const r = await window.SOZO_API('POST', `${URL_LIVRE}/corbeille/${pid}/restaurer`);
      if (!r.ok) { S.toast(r.d.erreur || 'La page n’a pas pu revenir. Elle reste dans la corbeille de l’atelier.'); return; }
      await relireLivre();
      const sortie = derniereSortie();
      const queue = livre.pages.filter((p) => p.n > sortie).map((p) => p.n);
      if (r.d.n !== n && queue.includes(n)) {
        const ordre = queue.filter((x) => x !== r.d.n);
        ordre.splice(queue.indexOf(n), 0, r.d.n);
        const ro = await window.SOZO_API('POST', `${URL_LIVRE}/pages/ordre`, { ordre });
        if (!ro.ok) S.toast(`La page est revenue en page ${r.d.n} : ${ro.d.erreur || 'elle n’a pas pu reprendre sa place.'}`);
      }
      await reconstruire(n);
      S.toast(`La page ${n} est revenue.`);
    });
  }
  $('#ajouter').addEventListener('click', async () => {
    const r = await window.SOZO_API('POST', `${URL_LIVRE}/pages`, { contenu: '' });
    if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
    await relireLivre();
    if (!$('#doc .pl-page')) $('#doc').innerHTML = '';
    if (charges[1] === r.d.n - 1 || charges[1] < charges[0]) await charger(r.d.n, r.d.n); else await reconstruire(r.d.n);
    aller(r.d.n, true);
    etatDoc();
  });
  $('#allerA').addEventListener('change', (e) => aller(+e.target.value, true));
  $('#essai').addEventListener('click', () => {
    const f = ed.active; if (!f || f.verrou || ed.plat(f).trim()) return;
    ed.remplacerTout(f, ESSAI); $('#essai').hidden = true;
    S.toast('Texte d’essai, avec des fautes volontaires. Il n’est enregistré que si vous l’enregistrez.'); change(f, true);
  });

  /* ─── départ : les pages autour de celle demandée ─── */
  if (!total()) {
    $('#doc').innerHTML = `<div class="empty"><strong>Ce livre n’a pas encore de page</strong>Ajoutez la première : elle reste un brouillon, visible par vous seul.</div>`;
  } else {
    await charger(depart - 5, depart + 18);
    const f = parN.get(depart) || ed.feuilles[0];
    if (f) {
      $('#allerA').value = String(f.n);
      f.bloc.scrollIntoView({ block: 'start' });
      if (!f.verrou) f.el.focus({ preventScroll: true });
    }
  }
  etatDoc(); compter();
}).catch(window.SOZO_ERREUR);
