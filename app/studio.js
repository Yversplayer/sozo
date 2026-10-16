/* ═══════════════════════════════════════════════════════════
   Sōzō — l'atelier de l'auteur, branché sur le serveur (/api/studio…).

   Un espace à soi : ambiance, photo, nom et citation choisis par l'auteur ;
   ses livres debout sur une étagère en 3D ; ses chiffres en cartes.
   Puis, pour chaque livre : pages, import, réglages, calendrier.

   Règles reprises du serveur, jamais recalculées ici :
   · l'écran ne change qu'APRÈS la réponse du serveur (aucun faux succès) ;
   · importer ≠ publier : un manuscrit importé ne crée que des brouillons ;
   · une page publiée garde son accès, son prix et sa date ; son texte ne se
     corrige qu'avec Plume, en nouvelle version ;
   · un lot est vérifié en entier par le serveur avant la première écriture.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  S.shell('studio');
  const main = $('#main');
  const API = window.SOZO_API;
  const enc = encodeURIComponent;
  const usd = (c) => (c == null ? '—' : S.money(c / 100));
  const versCentimes = (s) => { const t = String(s || '').trim().replace(',', '.'); if (!t) return null; const v = Math.round(parseFloat(t) * 100); return isFinite(v) && v >= 0 ? v : NaN; };
  const enDollars = (c) => (c == null ? '' : (c / 100).toFixed(2));
  const versUTC = (local) => (local ? new Date(local).toISOString().slice(0, 19) + 'Z' : null);
  const AMB = { nuit: 'Nuit d’écriture', parchemin: 'Parchemin', or: 'Feuille d’or', aube: 'Aube' };
  const SOURCE = { editor: 'Éditeur', pdf: 'Import PDF', epub: 'Import EPUB', docx: 'Import DOCX' };
  const ETAT = { published: ['Publiée', 'owned'], scheduled: ['Programmée', 'soon'], draft: ['Brouillon', 'draft'] };
  const STYLES = { a: 'Classique', b: 'Capitales', c: 'Bandeau', d: 'Médaillon' };

  let at = null, livre = null, onglet = S.q('tab') || 'pages', filtre = 'all', dejaRendu = false;

  /* Une couverture du studio, dessinée comme celles du catalogue */
  const couv = (b, opts) => { D.authors.moi = { name: at.nom }; return S.cover({ author: 'moi', cover: { img: b.couverture, style: b.style || 'a' }, title: b.titre, cat: b.categorie }, opts); };
  const erreur = (r) => S.toast(r.d.erreur || 'Le serveur a refusé l’opération.');
  function attente(btn, on) { if (!btn) return; btn.disabled = on; btn.setAttribute('aria-busy', String(on)); }
  function urlEtat() {
    const p = new URLSearchParams();
    if (livre) { p.set('id', livre.id); p.set('tab', onglet); }
    history.replaceState(null, '', `studio.html${p.toString() ? '?' + p : ''}${location.hash}`);
  }

  async function charger() {
    const r = await API('GET', '/api/studio');
    if (!r.ok) throw new Error('studio ' + r.status);
    at = r.d;
    const id = S.q('id') || (at.livres[0] && at.livres[0].id);
    livre = null;
    if (at.role === 'auteur' && id) await ouvrirLivre(id, false);
    if (at.role === 'auteur' && !livre && at.livres[0] && id !== at.livres[0].id) await ouvrirLivre(at.livres[0].id, false);
    rendre();
  }
  async function ouvrirLivre(id, redessiner = true) {
    const r = await API('GET', `/api/studio/livres/${enc(id)}`);
    if (!r.ok) { if (redessiner) erreur(r); return; }
    livre = r.d.livre;
    if (redessiner) { rendre(); $('#livre').scrollIntoView({ behavior: S.reduced ? 'auto' : 'smooth', block: 'start' }); }
  }
  async function relireLivre() {
    const [a, b] = await Promise.all([API('GET', '/api/studio'), API('GET', `/api/studio/livres/${enc(livre.id)}`)]);
    if (a.ok) at = a.d;
    if (b.ok) livre = b.d.livre;
    rendre(true);
  }

  /* ═══════════ L'ATELIER (en-tête 3D) ═══════════ */
  const nomParDefaut = () => `L’atelier ${/^[aeiouyhâàéèêîïôû]/i.test(at.nom) ? 'd’' : 'de '}${at.nom}`;
  function atelier() {
    const a = at.atelier || {}, amb = a.ambiance || 'nuit';
    const nom = a.nom || nomParDefaut();
    const photo = a.photo || 'auteur-bureau';
    const pages = at.livres.reduce((s, b) => s + b.sorties, 0);
    const lecteur = at.role !== 'auteur';
    return `<section class="at at--${lecteur ? 'parchemin' : amb}" id="atelier" aria-label="Votre atelier">
      <div class="at-bg" style="--ph:url('${S.img(photo)}')" aria-hidden="true"></div>
      <div class="at-dust" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
      <div class="wrap at-in">
        <div class="at-id">
          <p class="at-kicker">${lecteur ? 'Studio auteur' : `Atelier · ${S.esc(AMB[amb])}`}</p>
          <h1 class="at-title" data-ink-text="${S.esc(lecteur ? 'Votre [[atelier]] vous attend' : nom)}"></h1>
          ${lecteur ? `<p class="at-quote">Écrivez dans l’éditeur ou importez un manuscrit, publiez page par page, gratuitement ou contre paiement. Vous restez lecteur : rien ne change dans vos achats ni vos suivis.</p>`
            : a.citation ? `<blockquote class="at-quote">« ${S.esc(a.citation)} »</blockquote>` : `<p class="at-quote at-quote--vide">Ajoutez une phrase qui vous accompagne quand vous écrivez.</p>`}
          <div class="at-acts">
            ${lecteur ? `<button class="btn btn--accent" type="button" id="devenir">${S.icon('feather')} Ouvrir mon atelier d’auteur</button>`
              : `<button class="btn btn--accent" type="button" id="nouveau">${S.icon('plus')} Nouveau livre</button>
                 <button class="btn at-btn-ghost" type="button" id="perso">${S.icon('sliders')} Personnaliser l’atelier</button>`}
          </div>
        </div>
        ${lecteur ? `<div class="at-stage" aria-hidden="true"><div class="at-shelf"><div class="at-books">${['couv-pages', 'couv-plafond', 'couv-spirale'].map((c, i) => `<span class="at-book is-ghost" style="--i:${i}">${couv({ couverture: c, style: 'abd'[i], titre: ['Votre premier livre', 'Un recueil', 'Un roman'][i], categorie: '' }, { d3: false })}</span>`).join('')}</div><div class="at-plank"><i></i></div></div></div>`
          : `<div class="at-stage"><div class="at-shelf">
              <div class="at-books" role="list" aria-label="Votre étagère">${at.livres.length ? at.livres.slice(0, 7).map((b, i) => `<a class="at-book${livre && livre.id === b.id ? ' is-on' : ''}" role="listitem" href="studio.html?id=${enc(b.id)}" data-livre="${S.esc(b.id)}" style="--i:${i}" aria-label="${S.esc(b.titre)}${livre && livre.id === b.id ? ' (ouvert)' : ''}">${couv(b, { d3: false })}</a>`).join('')
                : `<button class="at-book at-book--new" type="button" data-nouveau style="--i:0">${S.icon('plus')}<span>Votre premier livre</span></button>${['couv-plafond', 'couv-spirale'].map((c, i) => `<span class="at-book is-ghost" style="--i:${i + 1}" aria-hidden="true">${couv({ couverture: c, style: 'bd'[i], titre: ['Un recueil', 'Un roman'][i], categorie: '' }, { d3: false })}</span>`).join('')}`}</div>
              <div class="at-plank"><i></i></div>
            </div></div>`}
      </div>
    </section>
    ${lecteur ? '' : `<div class="wrap"><div class="at-stats">
      ${carte('Solde disponible', usd(at.solde), 'tag', 'Revenus nets, moins les reversements demandés', true)}
      ${carte('Gagné au total', usd(at.gagne), 'star', 'Après la commission de Sōzō')}
      ${carte('Livres', at.livres.length, 'library', at.livres.some((b) => b.statut === 'retire') ? 'Dont au moins un retiré par la modération' : 'Sur votre étagère')}
      ${carte('Pages sorties', pages, 'book', 'Publiées ou programmées')}
      ${carte('Plume', at.plume.actif ? 'Active' : 'Non', 'feather', at.plume.actif ? `Jusqu’au ${S.dateLong(at.plume.fin)}` : `${S.money(at.plume.prix)} pour 30 jours`)}
    </div></div>`}
    ${!lecteur && at.plume.actif && (new Date(at.plume.fin) - Date.now()) < 5 * 864e5 ? `<div class="wrap"><p class="warn at-rappel">${S.icon('feather')}<span><strong>Plume se termine le ${S.esc(S.dateLong(at.plume.fin))}.</strong> Ensuite, vos pages publiées redeviennent verrouillées et la commission repasse au taux normal ; vos versions et vos ventes restent acquises. <button class="btn btn--sm" type="button" data-prolonger>Prolonger de 30 jours</button></span></p></div>` : ''}`;
  }
  const carte = (l, v, ic, sous, accent) => `<div class="at-card${accent ? ' at-card--or' : ''}" data-tilt><span class="at-card-ic">${S.icon(ic)}</span><strong>${S.esc(String(v))}</strong><span class="at-card-l">${S.esc(l)}</span><small>${S.esc(sous)}</small><i class="at-glare" aria-hidden="true"></i></div>`;

  /* ═══════════ UN LIVRE ═══════════ */
  const ONGLETS = [['pages', 'Pages', 'file'], ['import', 'Importer', 'upload'], ['reglages', 'Réglages', 'sliders'], ['calendrier', 'Calendrier', 'calendar']];
  function espaceLivre() {
    if (!at.livres.length) {
      return `<section class="at-work" id="livre"><div class="empty"><strong>Votre étagère est vide</strong>Créez un livre, puis écrivez dans l’éditeur ou importez un manuscrit (PDF, EPUB, DOCX).<br><br><button class="btn btn--accent" type="button" data-nouveau>${S.icon('plus')} Créer mon premier livre</button></div></section>`;
    }
    if (!livre) return '';
    if (!ONGLETS.some(([k]) => k === onglet)) onglet = 'pages';
    const p = livre.pages, n = (s) => p.filter((x) => x.statut === s).length;
    return `<section class="at-work" id="livre" aria-label="${S.esc(livre.titre)}">
      ${at.livres.length > 1 ? `<div class="at-switch" role="group" aria-label="Changer de livre">${at.livres.map((b) => `<a class="chip" href="studio.html?id=${enc(b.id)}" data-livre="${S.esc(b.id)}" aria-pressed="${b.id === livre.id}">${S.esc(b.titre)}</a>`).join('')}</div>` : ''}
      <div class="at-bk">
        <div class="at-bk-cv" data-tilt>${couv(livre)}</div>
        <div class="at-bk-id">
          <p class="kicker">${S.esc(livre.categorie)} · ${{ free: 'Gratuit', paid: 'Payant', mixed: 'Mixte' }[livre.acces]} · ${livre.mode === 'progressive' ? 'Publication progressive' : 'Tout publier'}</p>
          <h2 class="at-bk-t">${S.esc(livre.titre)}</h2>
          <p class="at-bk-n"><span><b>${n('published')}</b> publiée${n('published') > 1 ? 's' : ''}</span><span><b>${n('scheduled')}</b> programmée${n('scheduled') > 1 ? 's' : ''}</span><span><b>${n('draft')}</b> brouillon${n('draft') > 1 ? 's' : ''}</span><span><b>${livre.suiveurs}</b> lecteur${livre.suiveurs > 1 ? 's le suivent' : ' le suit'}</span></p>
          ${livre.statut === 'retire' ? `<p class="warn">${S.icon('lock')}<span><strong>Livre retiré par la modération.</strong> ${S.esc(livre.retrait_motif || '')} Il n’apparaît plus dans le catalogue ; les lecteurs qui l’ont acheté le gardent.</span></p>` : ''}
        </div>
        <div class="at-bk-acts">
          <a class="btn btn--ghost" href="livre.html?id=${enc(livre.id)}">${S.icon('eye')} Voir comme un lecteur</a>
          <button class="btn" type="button" id="ecrireNouvelle">${S.icon('pen')} Écrire une nouvelle page</button>
        </div>
      </div>
      <div class="at-tabs" role="tablist" aria-label="Espaces du livre">
        ${ONGLETS.map(([k, l, ic]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="atPanel" aria-selected="${onglet === k}" tabindex="${onglet === k ? 0 : -1}" data-tab="${k}">${S.icon(ic)}<span>${l}</span></button>`).join('')}
      </div>
      <div class="at-panel" id="atPanel" role="tabpanel" aria-labelledby="tab-${onglet}">${{ pages: panPages, import: panImport, reglages: panReglages, calendrier: panCalendrier }[onglet]()}</div>
    </section>`;
  }

  /* ─── Pages ─── */
  function panPages() {
    const p = livre.pages, c = (s) => p.filter((x) => x.statut === s).length;
    if (!p.length) return `<div class="empty"><strong>Aucune page pour l’instant</strong>Écrivez la première dans l’éditeur, ou importez votre manuscrit : il sera découpé en brouillons.<br><br><button class="btn" type="button" data-goto="import">${S.icon('upload')} Importer un manuscrit</button></div>`;
    const liste = p.filter((x) => filtre === 'all' || x.statut === filtre);
    const chap = (n) => { const ch = livre.chapitres.find((x) => n >= x.page_de && n <= x.page_a); return ch ? ch.titre : '—'; };
    const prixPage = livre.prix.page != null ? usd(livre.prix.page) : 'au chapitre ou au livre';
    // Seule la queue de brouillons (après la dernière page sortie) se réordonne : les droits suivent les numéros
    const derniereSortie = Math.max(0, ...p.filter((x) => x.statut !== 'draft').map((x) => x.n));
    const queue = p.filter((x) => x.n > derniereSortie).map((x) => x.n);
    return `<div class="tbl-tools" role="group" aria-label="Filtrer les pages">${[['all', `Toutes (${p.length})`], ['published', `Publiées (${c('published')})`], ['scheduled', `Programmées (${c('scheduled')})`], ['draft', `Brouillons (${c('draft')})`]].map(([k, l]) => `<button class="chip" type="button" data-filtre="${k}" aria-pressed="${filtre === k}">${l}</button>`).join('')}</div>
      <div class="bulk" id="bulk" role="group" aria-label="Actions sur la sélection">
        <strong id="selCount"></strong>
        ${livre.acces !== 'free' ? `<button class="btn btn--sm" type="button" data-lot="gratuit">Gratuit</button><button class="btn btn--sm" type="button" data-lot="payant">Payant</button>` : ''}
        <label class="sr" for="lotDate">Date et heure de parution</label><input type="datetime-local" id="lotDate" class="at-date">
        <button class="btn btn--sm" type="button" data-lot="programmer">Programmer</button>
        <button class="btn btn--sm" type="button" data-lot="publier">Publier maintenant</button>
        <button class="btn btn--sm" type="button" data-lot="brouillon">Remettre en brouillon</button>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th><label class="sr" for="toutSel">Tout sélectionner</label><input type="checkbox" id="toutSel"></th><th>Page</th><th>Début du texte</th><th>Chapitre</th><th>État</th><th>Accès</th><th>Parution</th><th>Source</th><th><span class="sr">Actions</span></th></tr></thead>
      <tbody>${liste.length ? '' : `<tr><td colspan="9" class="ash">Aucune page dans ce filtre. <button class="btn btn--ghost btn--sm" type="button" data-filtre="all">Voir toutes les pages</button></td></tr>`}${liste.map((x) => {
        const pub = x.statut === 'published', bloquee = x.statut === 'scheduled' && !x.mots, st = bloquee ? ['Bloquée : page vide', 'locked'] : ETAT[x.statut];
        return `<tr data-n="${x.n}" class="${pub ? 'is-pub' : ''}">
          <td>${pub ? `<span class="lockd" title="Publiée : des lecteurs ont peut-être des droits dessus">${S.icon('lock')}<span class="sr">Page publiée, verrouillée</span></span>` : `<input type="checkbox" data-sel="${x.n}" aria-label="Sélectionner la page ${x.n}">`}</td>
          <td><strong>${x.n}</strong>${x.version > 1 ? ` <span class="mono ash">v${x.version}</span>` : ''}${queue.length > 1 && queue.includes(x.n) ? `<span class="at-ordre">${x.n > queue[0] ? `<button type="button" class="icon-btn" data-monter="${x.n}" aria-label="Monter la page ${x.n}">↑</button>` : ''}${x.n < queue[queue.length - 1] ? `<button type="button" class="icon-btn" data-descendre="${x.n}" aria-label="Descendre la page ${x.n}">↓</button>` : ''}</span>` : ''}</td>
          <td class="at-extrait">${x.extrait ? S.esc(x.extrait.slice(0, 70)) + (x.extrait.length > 70 ? '…' : '') : '<span class="ash">Page vide</span>'}<small>${x.mots} mot${x.mots > 1 ? 's' : ''}</small></td>
          <td class="ash">${S.esc(chap(x.n))}</td>
          <td><span class="badge badge--${st[1]}">${st[0]}</span></td>
          <td>${x.acces === 'free' ? 'Gratuit' : `Payant <small class="ash">${prixPage}</small>`}</td>
          <td>${x.publie_le ? S.esc(S.dateLong(x.publie_le)) : '<span class="ash">—</span>'}</td>
          <td class="ash">${SOURCE[x.source] || S.esc(x.source)}</td>
          <td>${pub ? `<a class="btn btn--ghost btn--sm" href="ecrire.html?id=${enc(livre.id)}&p=${x.n}" data-corriger="${x.n}">${S.icon('edit')} Corriger ${at.plume.actif ? '' : '<span class="plume-tag">Plume</span>'}</a>`
            : `<span class="row-acts"><a class="btn btn--ghost btn--sm" href="ecrire.html?id=${enc(livre.id)}&p=${x.n}">${S.icon('edit')} Écrire</a><button class="btn btn--ghost btn--sm" type="button" data-publier="${x.n}">Publier</button></span>`}</td>
        </tr>`;
      }).join('')}</tbody></table></div>
      <p class="local-note">${S.icon('eyeOff')} Les brouillons ne sont visibles que par vous. Une page publiée est verrouillée (accès, prix, date) : des lecteurs ont peut-être déjà des droits dessus.</p>`;
  }
  const choisies = () => $$('[data-sel]:checked').map((x) => +x.dataset.sel);
  function syncSel() {
    const n = choisies().length, bulk = $('#bulk');
    if (!bulk) return;
    bulk.classList.toggle('is-on', n > 0);
    $('#selCount').textContent = `${n} page${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`;
    $$('tbody tr').forEach((tr) => { const c = tr.querySelector('[data-sel]'); tr.classList.toggle('is-sel', !!(c && c.checked)); });
  }
  async function lot(action, pages, btn) {
    const corps = { pages, action };
    if (action === 'programmer') {
      const v = $('#lotDate').value;
      if (!v) { S.toast('Choisissez d’abord une date et une heure.'); $('#lotDate').focus(); return; }
      corps.date = versUTC(v);
    }
    attente(btn, true);
    const r = await API('POST', `/api/studio/livres/${enc(livre.id)}/pages/lot`, corps);
    attente(btn, false);
    if (!r.ok) { erreur(r); return; }
    S.toast(`${S.pagesRange(pages).replace(/^p/, 'P')} : ${{ gratuit: 'gratuite', payant: 'payante', programmer: 'programmée', publier: 'publiée', brouillon: 'remise en brouillon' }[action]}${pages.length > 1 ? 's' : ''}.`);
    await relireLivre();
  }

  /* ─── Importer ─── */
  function panImport() {
    return `<div class="at-import">
      <label class="drop at-drop" id="drop">${S.icon('upload')}<strong>Déposez un PDF, un EPUB ou un DOCX</strong><br>ou cliquez pour choisir un fichier (25 Mo au plus).
        <input type="file" id="fichier" class="sr" accept=".pdf,.epub,.docx,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>
      <div class="at-up" id="up" hidden>
        <div class="import-card"><span class="import-ic">${S.icon('file')}</span><div>
          <strong id="upNom"></strong> <span class="ash" id="upTaille"></span>
          <div class="import-bar at-bar" id="upBar"><i style="width:0"></i></div>
          <span class="ash" id="upEtat" role="status" aria-live="polite"></span>
        </div></div>
      </div>
      <ul class="at-promesses">
        <li>${S.icon('shield')}<span><strong>Rien n’est publié.</strong> Chaque page extraite devient un brouillon, visible par vous seul.</span></li>
        <li>${S.icon('file')}<span><strong>Le découpage suit votre fichier.</strong> Les sauts de page sont respectés ; sinon, environ 1 800 signes par page.</span></li>
        <li>${S.icon('lock')}<span><strong>Votre manuscrit reste privé.</strong> Le fichier d’origine n’est jamais servi à personne, et il est effacé ${livre.conservation_jours} jours après l’import : le texte, lui, reste dans vos pages.</span></li>
      </ul>
      ${livre.imports.length ? `<h3 class="at-h3">Imports précédents</h3><div class="tbl-wrap"><table class="tbl at-tbl-min"><thead><tr><th>Fichier</th><th>Format</th><th>Taille</th><th>Pages créées</th><th>Le</th><th>Fichier d’origine</th></tr></thead><tbody>
        ${livre.imports.map((i) => `<tr><td>${S.esc(i.nom_fichier)}</td><td class="mono">${S.esc(i.nature.toUpperCase())}</td><td>${(i.taille / 1048576).toFixed(1).replace('.', ',')} Mo</td><td>${i.pages_creees}</td><td>${S.esc(S.dateLong(i.created_at))}</td><td class="ash">${i.efface_le ? `effacé le ${S.esc(S.dateLong(i.efface_le).replace(/ à .*/, ''))}` : `conservé jusqu’au ${S.esc(S.dateLong(i.conserve_jusqu_au).replace(/ à .*/, ''))}`}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </div>`;
  }
  function envoyer(f) {
    if (!f) return;
    const up = $('#up'), bar = $('#upBar'), barI = $('#upBar i'), etat = $('#upEtat');
    up.hidden = false;
    $('#upNom').textContent = f.name;
    $('#upTaille').textContent = `· ${(f.size / 1048576).toFixed(1).replace('.', ',')} Mo`;
    bar.classList.remove('is-wait', 'is-err');
    if (f.size > 25 * 1024 * 1024) { bar.classList.add('is-err'); etat.textContent = 'Fichier trop volumineux : 25 Mo au plus.'; return; }
    const fd = new FormData(); fd.append('fichier', f);
    const x = new XMLHttpRequest();
    x.open('POST', `/api/studio/livres/${enc(livre.id)}/import`);
    x.setRequestHeader('X-CSRF-Token', SozoAuth.csrf());
    // Progression RÉELLE de l'envoi ; puis une barre d'attente tant que le
    // serveur découpe — jamais une fausse progression vers 100 %.
    x.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const p = Math.round((e.loaded / e.total) * 100);
      barI.style.width = p + '%';
      etat.textContent = p < 100 ? `Envoi : ${p} %` : 'Fichier reçu. Le serveur lit et découpe le manuscrit…';
      if (p >= 100) bar.classList.add('is-wait');
    };
    x.onload = async () => {
      bar.classList.remove('is-wait');
      let d = {}; try { d = JSON.parse(x.responseText); } catch (e) {}
      if (x.status === 201) {
        const msg = `<strong>${d.pages} page${d.pages > 1 ? 's' : ''} créée${d.pages > 1 ? 's' : ''} en brouillon</strong> (à partir de la page ${d.premiere}). Rien n’est publié : relisez, puis publiez quand vous voulez.`;
        S.toast(`${d.pages} brouillon${d.pages > 1 ? 's' : ''} ajouté${d.pages > 1 ? 's' : ''}.`);
        const [a, r] = await Promise.all([API('GET', '/api/studio'), API('GET', `/api/studio/livres/${enc(livre.id)}`)]);
        if (a.ok) at = a.d;
        if (r.ok) livre = r.d.livre;
        rendre(true);
        $('#up').hidden = false; $('#upNom').textContent = f.name; $('#upBar i').style.width = '100%';
        $('#upEtat').innerHTML = `${msg} <button class="btn btn--sm" type="button" data-goto="pages" data-filtre-va="draft">Voir les brouillons</button>`;
      } else {
        bar.classList.add('is-err');
        etat.textContent = d.erreur || 'Le serveur a refusé ce fichier.';
      }
    };
    x.onerror = () => { bar.classList.remove('is-wait'); bar.classList.add('is-err'); etat.textContent = 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.'; };
    barI.style.width = '0'; etat.textContent = 'Envoi : 0 %';
    x.send(fd);
  }

  /* ─── Réglages ─── */
  function galerie(nom, choisi, filtreImg) {
    const imgs = at.images.filter(filtreImg || (() => true)).sort((a, b) => (b.startsWith('couv') - a.startsWith('couv')) || a.localeCompare(b));
    return `<div class="at-gal" role="radiogroup" aria-label="Choisir une image">${imgs.map((i) => `<label class="at-gal-i"><input type="radio" name="${nom}" value="${S.esc(i)}"${i === choisi ? ' checked' : ''}><img src="${S.img(i, true)}" alt="" loading="lazy" decoding="async"><span class="sr">${S.esc(i)}</span></label>`).join('')}</div>`;
  }
  function champsLivre(b) {
    const prix = b.prix || {};
    return `<label class="cx-field">Titre<input name="titre" maxlength="120" required value="${S.esc(b.titre || '')}"></label>
      <label class="cx-field">Catégorie<select name="categorie">${at.categories.map((c) => `<option${c === b.categorie ? ' selected' : ''}>${S.esc(c)}</option>`).join('')}</select></label>
      <label class="cx-field">Présentation <small>visible sur la fiche du livre</small><textarea name="description" maxlength="1500" rows="4">${S.esc(b.description || '')}</textarea></label>
      <fieldset class="at-radios"><legend>Publication</legend>
        ${[['integral', 'Tout publier', 'Toutes les pages sortent ensemble'], ['progressive', 'Progressive', 'Vous programmez la parution page par page']].map(([k, l, d]) => `<label><input type="radio" name="mode" value="${k}"${(b.mode || 'progressive') === k ? ' checked' : ''}><span><strong>${l}</strong><small>${d}</small></span></label>`).join('')}
      </fieldset>
      <fieldset class="at-radios at-radios--3"><legend>Accès</legend>
        ${[['free', 'Gratuit', 'Tout est lisible'], ['paid', 'Payant', 'Chaque page s’achète'], ['mixed', 'Mixte', 'Vous choisissez page par page']].map(([k, l, d]) => `<label><input type="radio" name="acces" value="${k}"${(b.acces || 'free') === k ? ' checked' : ''}><span><strong>${l}</strong><small>${d}</small></span></label>`).join('')}
      </fieldset>
      <fieldset class="at-prix" data-prix${(b.acces || 'free') === 'free' ? ' hidden' : ''}><legend>Prix en dollars <small>laisser vide pour ne pas proposer</small></legend>
        ${[['prix_page', 'Une page', prix.page], ['prix_chapitre', 'Un chapitre', prix.chapitre], ['prix_livre', 'Tout le contenu payant', prix.livre]].map(([k, l, v]) => `<label class="price-opt"><span>${l}</span><span><input name="${k}" inputmode="decimal" placeholder="—" value="${enDollars(v)}" aria-label="${l}, en dollars"> $</span></label>`).join('')}
      </fieldset>`;
  }
  function lirePrix(form) {
    const d = {};
    for (const k of ['prix_page', 'prix_chapitre', 'prix_livre']) {
      const v = versCentimes(form.elements[k].value);
      if (Number.isNaN(v)) { form.elements[k].setAttribute('aria-invalid', 'true'); form.elements[k].focus(); return null; }
      form.elements[k].removeAttribute('aria-invalid');
      d[k] = v;
    }
    return d;
  }
  function panReglages() {
    return `<div class="at-reg">
      <form class="panel at-form" id="formLivre" novalidate>
        <h3 class="at-h3">Le livre</h3>
        ${champsLivre(livre)}
        <p class="note">${S.icon('shield')} Un nouveau prix ne touche que les achats futurs : ce qu’un lecteur a payé reste à lui.</p>
        <p class="cx-err" id="errLivre" role="alert"></p>
        <button class="btn btn--accent" type="submit">Enregistrer</button>
      </form>
      <div class="at-reg-side">
        <form class="panel at-form" id="formCouv">
          <h3 class="at-h3">La couverture</h3>
          <div class="at-couv-prev" id="couvPrev">${couv(livre)}</div>
          <label class="cx-field">Style<select name="style">${Object.entries(STYLES).map(([k, l]) => `<option value="${k}"${livre.style === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          ${galerie('couverture', livre.couverture, null)}
          <button class="btn" type="submit">Changer la couverture</button>
        </form>
        <form class="panel at-form" id="formChap">
          <h3 class="at-h3">Les chapitres</h3>
          <div id="chaps">${(livre.chapitres.length ? livre.chapitres : [{ titre: '', page_de: 1, page_a: Math.max(1, livre.pages.length) }]).map(ligneChap).join('')}</div>
          <button class="btn btn--ghost btn--sm" type="button" id="ajChap">${S.icon('plus')} Ajouter un chapitre</button>
          <p class="cx-err" id="errChap" role="alert"></p>
          <button class="btn" type="submit">Enregistrer les chapitres</button>
        </form>
      </div>
    </div>`;
  }
  const ligneChap = (c) => `<div class="at-chap"><input aria-label="Titre du chapitre" placeholder="Titre" maxlength="120" value="${S.esc(c.titre)}" data-c="titre"><label>p.<input type="number" min="1" value="${c.page_de}" data-c="page_de" aria-label="Première page"></label><label>à<input type="number" min="1" value="${c.page_a}" data-c="page_a" aria-label="Dernière page"></label><button type="button" class="icon-btn" data-supp aria-label="Retirer ce chapitre">${S.icon('x')}</button></div>`;

  /* ─── Calendrier ─── */
  function panCalendrier() {
    const ev = livre.pages.filter((p) => p.publie_le && p.statut !== 'draft');
    if (!ev.length) return `<div class="empty"><strong>Rien n’est encore daté</strong>Sélectionnez des brouillons dans « Pages », choisissez une date, puis « Programmer ». Aucune règle de rythme : publiez quand vous voulez.</div>`;
    const t = (iso) => +new Date(iso), auj = Date.now();
    const t0 = Math.min(auj, ...ev.map((p) => t(p.publie_le))) - 7 * 864e5, t1 = Math.max(auj, ...ev.map((p) => t(p.publie_le))) + 14 * 864e5;
    const x = (v) => ((v - t0) / (t1 - t0)) * 100;
    const mois = []; const d = new Date(t0); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + 1);
    while (+d < t1) { mois.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
    const g = {}; ev.forEach((p) => (g[p.publie_le] = g[p.publie_le] || []).push(p));
    const prochaines = ev.filter((p) => p.statut === 'scheduled').sort((a, b) => t(a.publie_le) - t(b.publie_le));
    return `<div class="timeline"><div class="tl">
        <div class="tl-axis"></div>
        ${mois.map((m) => `<span class="tl-month" style="left:${x(+m)}%">${m.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>`).join('')}
        <div class="tl-today" style="left:${x(auj)}%"><span>aujourd’hui</span></div>
        ${Object.entries(g).sort((a, b) => t(a[0]) - t(b[0])).map(([dt, ps]) => `<div class="tl-ev${ps[0].statut === 'scheduled' ? ' is-soon' : ''}" style="left:${x(t(dt))}%;--s:${10 + Math.min(ps.length, 5) * 4}px" title="${S.esc(S.pagesRange(ps.map((p) => p.n)))} — ${S.esc(S.dateLong(dt))}"><i></i><span>p. ${ps.length > 2 ? `${ps[0].n}–${ps[ps.length - 1].n}` : ps.map((p) => p.n).join(', ')}</span></div>`).join('')}
      </div></div>
      <p class="legend at-legend"><span><i class="lg-pub"></i>Publiée</span><span><i class="lg-soon"></i>Programmée</span></p>
      ${prochaines.length ? `<h3 class="at-h3">Prochaines parutions</h3><ul class="at-next">${prochaines.slice(0, 8).map((p) => `<li><strong>${S.esc(S.dateLong(p.publie_le))}</strong><span>Page ${p.n} · ${p.acces === 'paid' ? 'payante' : 'gratuite'}</span></li>`).join('')}</ul>` : ''}`;
  }

  /* ═══════════ REVENUS ET PLUME (niveau de l'auteur) ═══════════ */
  function revenus() {
    return `<section class="at-rev" id="revenus"><div class="sec-head"><h2 class="sec-title" data-ink-text="Vos [[revenus]]"></h2></div><div id="revIn"><p class="ash" role="status">Chargement des ventes…</p></div></section>`;
  }
  async function chargerRevenus() {
    const el = $('#revIn'); if (!el) return;
    const [v, m] = await Promise.all([API('GET', '/api/studio/ventes'), API('GET', '/api/paiements/moyens')]);
    if (!v.ok) { el.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(v.d.erreur || 'Ventes indisponibles pour le moment.')}</span></p>`; return; }
    const d = v.d, ops = (m.ok && m.d.operateurs) || [];
    const ex = 100, com = d.plume.actif ? d.commission_plume : d.commission;
    el.innerHTML = `<div class="at-rev-grid">
      <div class="panel">
        <div class="at-money">
          <div><span>Gagné</span><strong>${usd(d.gagne)}</strong></div>
          <div><span>Reversé ou demandé</span><strong>${usd(d.verse)}</strong></div>
          <div class="is-or"><span>Disponible</span><strong>${usd(d.solde)}</strong></div>
        </div>
        <h3 class="at-h3">Par livre</h3>
        ${d.livres.length ? `<div class="tbl-wrap"><table class="tbl at-tbl-min"><thead><tr><th>Livre</th><th>Ventes confirmées</th><th>Net pour vous</th></tr></thead><tbody>${d.livres.map((b) => `<tr><td>${S.esc(b.titre)}</td><td>${b.ventes}</td><td>${usd(b.net)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ash">Aucun livre.</p>'}
        <p class="note">${S.icon('tag')} Sur une vente à ${S.money(ex / 100)}, vous recevez ${S.money((ex - Math.round(ex * com / 100)) / 100)} : la commission de Sōzō est de ${com} %${d.plume.actif ? ' (Plume)' : `, ${d.commission_plume} % avec Plume`}. Une vente ne compte qu’une fois le paiement confirmé par Sōzō.</p>
      </div>
      <div class="at-rev-side">
        <form class="panel at-form" id="formRev" novalidate>
          <h3 class="at-h3">Demander un reversement</h3>
          ${d.solde < 100 ? `<p class="ash">Un reversement est possible à partir de 1,00 $ disponible.</p>` : `
          <label class="cx-field">Montant en dollars <small>au plus ${usd(d.solde)}</small><input name="montant" inputmode="decimal" required placeholder="${enDollars(d.solde)}"></label>
          <label class="cx-field">Opérateur<select name="operateur">${ops.map((o) => `<option>${S.esc(o)}</option>`).join('')}</select></label>
          <label class="cx-field">Votre numéro Mobile Money<input name="numero" inputmode="tel" autocomplete="tel" maxlength="30" required placeholder="+243…"></label>
          <p class="cx-err" id="errRev" role="alert"></p>
          <button class="btn btn--accent" type="submit">Demander ${S.icon('right')}</button>
          <p class="note">${S.icon('clock')} Sōzō vérifie puis envoie le montant ; la demande reste « en attente » jusque-là.</p>`}
        </form>
        <div class="panel at-plume${d.plume.actif ? ' is-on' : ''}">
          <p class="mono">Plume · ${S.money(d.plume.prix)} pour 30 jours</p>
          ${d.plume.actif ? `<p><strong>Active jusqu’au ${S.esc(S.dateLong(d.plume.fin))}.</strong></p>` : ''}
          <ul><li>Corriger une page déjà publiée, en nouvelle version, sans rien retirer aux lecteurs</li><li>Historique des versions de chaque page</li><li>Commission réduite à ${d.commission_plume} %</li></ul>
          <button class="btn btn--accent" type="button" id="plumeBtn">${d.plume.actif ? 'Prolonger de 30 jours' : 'Passer à Plume'}</button>
        </div>
      </div>
    </div>
    ${d.reversements.length ? `<h3 class="at-h3">Vos demandes de reversement</h3><div class="tbl-wrap"><table class="tbl at-tbl-min"><thead><tr><th>Demandé le</th><th>Montant</th><th>Opérateur</th><th>État</th><th>Référence</th></tr></thead><tbody>
      ${d.reversements.map((r) => `<tr><td>${S.esc(S.dateLong(r.created_at))}</td><td>${usd(r.montant)}</td><td>${S.esc(r.operateur)}</td><td><span class="badge badge--${{ DEMANDE: 'soon', PAYE: 'owned', REFUSE: 'draft' }[r.etat] || 'draft'}">${{ DEMANDE: 'En attente', PAYE: 'Envoyé', REFUSE: 'Refusé' }[r.etat] || S.esc(r.etat)}</span>${r.motif ? `<small class="ash"> ${S.esc(r.motif)}</small>` : ''}</td><td class="mono">${S.esc(r.reference || '—')}</td></tr>`).join('')}
    </tbody></table></div>` : ''}`;
    S.inkAll(el);
    $('#plumeBtn').addEventListener('click', () => S.buy.plume(d.plume.prix));
    const f = $('#formRev');
    if (f.elements.montant) f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const montant = versCentimes(f.elements.montant.value);
      if (!montant || Number.isNaN(montant)) { $('#errRev').textContent = 'Indiquez un montant.'; f.elements.montant.focus(); return; }
      const btn = f.querySelector('[type=submit]'); attente(btn, true);
      const r = await API('POST', '/api/studio/reversements', { montant, operateur: f.elements.operateur.value, numero: f.elements.numero.value.trim() });
      attente(btn, false);
      if (!r.ok) { $('#errRev').textContent = r.d.erreur || 'Demande refusée.'; return; }
      S.toast('Demande de reversement enregistrée : en attente de Sōzō.');
      const a = await API('GET', '/api/studio'); if (a.ok) at = a.d;
      rendre(true);
    });
  }

  /* ═══════════ FENÊTRES : personnaliser, nouveau livre ═══════════ */
  function personnaliser() {
    const a = at.atelier || {};
    const m = S.modal({ title: 'Personnaliser l’atelier', body: `<form id="formAt" class="at-form" novalidate>
      <fieldset class="at-amb"><legend>Ambiance</legend>${Object.entries(AMB).map(([k, l]) => `<label><input type="radio" name="ambiance" value="${k}"${(a.ambiance || 'nuit') === k ? ' checked' : ''}><span class="at-amb-s at-amb-s--${k}" aria-hidden="true"></span><span>${l}</span></label>`).join('')}</fieldset>
      <label class="cx-field">Nom de l’atelier<input name="nom" maxlength="60" placeholder="${S.esc(nomParDefaut())}" value="${S.esc(a.nom || '')}"></label>
      <label class="cx-field">Votre phrase <small>affichée sous le nom</small><textarea name="citation" maxlength="200" rows="2">${S.esc(a.citation || '')}</textarea></label>
      <p class="cx-field">Photo de fond</p>
      ${galerie('photo', a.photo || 'auteur-bureau', (i) => !i.startsWith('couv'))}
      <p class="cx-err" id="errAt" role="alert"></p></form>`,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, onClick: async (close) => {
        const f = $('#formAt');
        const r = await API('PUT', '/api/studio/atelier', { ambiance: f.elements.ambiance.value, nom: f.elements.nom.value.trim() || null, citation: f.elements.citation.value.trim() || null, photo: f.elements.photo.value || null });
        if (!r.ok) { $('#errAt').textContent = r.d.erreur || 'Réglage refusé.'; return; }
        at.atelier = r.d.atelier; close(); rendre(true); S.toast('Votre atelier est à votre image.');
      } }] });
    const md = m.el.querySelector('.md'); md.classList.add('md--large');
    requestAnimationFrame(() => requestAnimationFrame(() => { md.scrollTop = 0; $('#formAt input[name=ambiance]:checked').focus(); }));
  }

  function nouveauLivre() {
    const m = S.modal({ title: 'Un nouveau livre', body: `<form id="formNouv" class="at-form" novalidate>
      ${champsLivre({ acces: 'free', mode: 'progressive', categorie: at.categories.includes('Roman') ? 'Roman' : at.categories[0] })}
      <p class="cx-field">Couverture</p>
      <div class="at-nouv-cv"><div id="nouvPrev">${couv({ couverture: 'couv-pages', style: 'a', titre: 'Votre titre', categorie: 'Roman' })}</div>
        <label class="cx-field">Style<select name="style">${Object.entries(STYLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
      ${galerie('couverture', 'couv-pages', null)}
      <p class="cx-err" id="errNouv" role="alert"></p></form>`,
      actions: [{ label: 'Annuler' }, { label: 'Créer le livre', primary: true, onClick: async (close) => {
        const f = $('#formNouv'), err = $('#errNouv');
        if (!f.elements.titre.value.trim()) { err.textContent = 'Donnez un titre à votre livre.'; f.elements.titre.focus(); return; }
        const corps = { titre: f.elements.titre.value.trim(), categorie: f.elements.categorie.value, description: f.elements.description.value.trim(), mode: f.elements.mode.value, acces: f.elements.acces.value, couverture: f.elements.couverture.value, style: f.elements.style.value };
        if (corps.acces !== 'free') { const p = lirePrix(f); if (!p) { err.textContent = 'Prix invalide : un nombre comme 0,50.'; return; } Object.assign(corps, p); }
        const r = await API('POST', '/api/studio/livres', corps);
        if (!r.ok) { err.textContent = r.d.erreur || 'Création refusée.'; return; }
        close(); onglet = 'import'; filtre = 'all';
        const a = await API('GET', '/api/studio'); if (a.ok) at = a.d;
        livre = r.d.livre; rendre(true); S.toast('Livre créé. Importez un manuscrit ou écrivez la première page.');
        $('#livre').scrollIntoView({ behavior: S.reduced ? 'auto' : 'smooth' });
      } }] });
    const md = m.el.querySelector('.md'); md.classList.add('md--large');
    const f = $('#formNouv', md);
    requestAnimationFrame(() => requestAnimationFrame(() => { md.scrollTop = 0; f.elements.titre.focus(); }));   // un formulaire s'ouvre sur son premier champ
    const maj = () => {
      $('#nouvPrev').innerHTML = couv({ couverture: f.elements.couverture.value, style: f.elements.style.value, titre: f.elements.titre.value || 'Votre titre', categorie: f.elements.categorie.value });
      $('[data-prix]', md).hidden = f.elements.acces.value === 'free';
    };
    f.addEventListener('input', maj); f.addEventListener('change', maj);
  }

  /* ═══════════ RENDU ET LIENS ═══════════ */
  function rendre(garderDefilement) {
    const y = scrollY;
    main.innerHTML = atelier() + `<div class="wrap">${at.role === 'auteur' ? espaceLivre() + revenus() : ''}</div>`;
    lier();
    S.inkAll(main); S.tilt(main);
    // L'encre ne s'écrit qu'à la première visite : un écran redessiné après
    // une action affiche ses titres d'emblée, sans rejouer l'animation.
    if (dejaRendu) main.querySelectorAll('.ink').forEach((el) => el.classList.add('ink--now', 'ink--on', 'ink--done'));
    dejaRendu = true;
    if (at.role === 'auteur') chargerRevenus();
    urlEtat();
    if (garderDefilement) scrollTo(0, y);
  }

  // Liens délégués, posés une seule fois (le contenu de main est redessiné)
  main.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) { onglet = g.dataset.goto; if (g.dataset.filtreVa) filtre = g.dataset.filtreVa; rendre(true); }
  });

  function lier() {
    const hero = $('.at');
    // Économie de données ou appareil modeste (≤ 2 cœurs) : décor fixe, sans poussière ni parallaxe
    const modeste = (navigator.connection && navigator.connection.saveData) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    if (hero && modeste) hero.classList.add('at--simple');
    if (hero && !modeste && !S.reduced && matchMedia('(hover: hover)').matches) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        hero.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
      hero.addEventListener('pointerleave', () => { hero.style.setProperty('--mx', 0); hero.style.setProperty('--my', 0); });
    }
    const dev = $('#devenir');
    if (dev) dev.addEventListener('click', async () => {
      attente(dev, true);
      const r = await API('POST', '/api/compte/devenir-auteur');
      if (!r.ok) { attente(dev, false); erreur(r); return; }
      SozoAuth.garder(null);              // le rôle a changé : le profil gardé dans l'onglet est périmé
      location.reload();
    });
    $$('#nouveau, [data-nouveau]').forEach((b) => b.addEventListener('click', nouveauLivre));
    const perso = $('#perso'); if (perso) perso.addEventListener('click', personnaliser);
    $$('[data-prolonger]').forEach((b) => b.addEventListener('click', () => S.buy.plume(at.plume.prix)));
    $$('[data-livre]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); filtre = 'all'; ouvrirLivre(a.dataset.livre); }));
    if (!livre) return;

    const nv = $('#ecrireNouvelle');
    nv.addEventListener('click', async () => {
      attente(nv, true);
      const r = await API('POST', `/api/studio/livres/${enc(livre.id)}/pages`, {});
      attente(nv, false);
      if (!r.ok) { erreur(r); return; }
      location.href = `ecrire.html?id=${enc(livre.id)}&p=${r.d.n}`;
    });
    const tabs = $$('[data-tab]');
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { onglet = t.dataset.tab; rendre(true); $(`#tab-${onglet}`).focus(); });
      t.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!k) return;
        e.preventDefault(); onglet = tabs[(i + k + tabs.length) % tabs.length].dataset.tab; rendre(true); $(`#tab-${onglet}`).focus();
      });
    });

    if (onglet === 'pages') {
      $$('[data-filtre]').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.filtre; rendre(true); }));
      $$('[data-sel]').forEach((c) => c.addEventListener('change', syncSel));
      const tout = $('#toutSel');
      if (tout) tout.addEventListener('change', () => { $$('[data-sel]').forEach((c) => { c.checked = tout.checked; }); syncSel(); });
      $$('[data-lot]').forEach((b) => b.addEventListener('click', () => { const s = choisies(); if (s.length) lot(b.dataset.lot, s, b); }));
      $$('[data-monter], [data-descendre]').forEach((b) => b.addEventListener('click', async () => {
        const derniere = Math.max(0, ...livre.pages.filter((x) => x.statut !== 'draft').map((x) => x.n));
        const q = livre.pages.filter((x) => x.n > derniere).map((x) => x.n);
        const n = +(b.dataset.monter || b.dataset.descendre), i = q.indexOf(n), j = b.dataset.monter ? i - 1 : i + 1;
        [q[i], q[j]] = [q[j], q[i]];
        b.disabled = true;
        const r = await API('POST', `/api/studio/livres/${enc(livre.id)}/pages/ordre`, { ordre: q });
        if (!r.ok) { b.disabled = false; erreur(r); return; }
        S.toast('Ordre des brouillons enregistré.');
        await relireLivre();
      }));
      $$('[data-publier]').forEach((b) => b.addEventListener('click', () => {
        const n = +b.dataset.publier;
        S.modal({ title: `Publier la page ${n} maintenant ?`, body: `<p>Une fois publiée, son accès, son prix et sa date ne pourront plus changer : des lecteurs pourront la lire ou l’acheter. Son texte ne se corrigera qu’avec Plume, en nouvelle version.</p>`,
          actions: [{ label: 'Annuler' }, { label: 'Publier', primary: true, onClick: (close) => { close(); lot('publier', [n], b); } }] });
      }));
      $$('[data-corriger]').forEach((a) => a.addEventListener('click', (e) => {
        if (at.plume.actif) return;
        e.preventDefault();
        S.modal({ title: `Corriger la page ${a.dataset.corriger}`, body: `<p>Cette page est publiée : son accès, son prix et sa date ne changent plus, parce que des lecteurs ont peut-être déjà des droits dessus.</p><p>Avec <strong>Plume</strong>, vous pouvez en corriger le <em>texte</em> : Sōzō crée une nouvelle version et garde l’ancienne dans l’historique.</p>`,
          actions: [{ label: 'Fermer' }, { label: `Passer à Plume — ${S.money(at.plume.prix)}`, primary: true, onClick: (close) => { close(); S.buy.plume(at.plume.prix); } }] });
      }));
      syncSel();
    }
    if (onglet === 'import') {
      const drop = $('#drop'), file = $('#fichier');
      file.addEventListener('change', () => envoyer(file.files[0]));
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
      drop.addEventListener('drop', (e) => envoyer(e.dataTransfer.files[0]));
    }
    if (onglet === 'reglages') {
      const fl = $('#formLivre');
      fl.addEventListener('change', () => { $('[data-prix]', fl).hidden = fl.elements.acces.value === 'free'; });
      fl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#errLivre'); err.textContent = '';
        const corps = { titre: fl.elements.titre.value.trim(), categorie: fl.elements.categorie.value, description: fl.elements.description.value.trim(), mode: fl.elements.mode.value, acces: fl.elements.acces.value };
        if (!corps.titre) { err.textContent = 'Le titre est obligatoire.'; return; }
        if (corps.acces !== 'free') { const p = lirePrix(fl); if (!p) { err.textContent = 'Prix invalide : un nombre comme 0,50.'; return; } Object.assign(corps, p); }
        const btn = fl.querySelector('[type=submit]'); attente(btn, true);
        const r = await API('PATCH', `/api/studio/livres/${enc(livre.id)}`, corps);
        attente(btn, false);
        if (!r.ok) { err.textContent = r.d.erreur || 'Modification refusée.'; return; }
        S.toast('Réglages enregistrés.'); await relireLivre();
      });
      const fc = $('#formCouv');
      fc.addEventListener('change', () => { $('#couvPrev').innerHTML = couv({ ...livre, couverture: fc.elements.couverture.value, style: fc.elements.style.value }); });
      fc.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = fc.querySelector('[type=submit]'); attente(btn, true);
        const r = await API('PATCH', `/api/studio/livres/${enc(livre.id)}`, { couverture: fc.elements.couverture.value, style: fc.elements.style.value });
        attente(btn, false);
        if (!r.ok) { erreur(r); return; }
        S.toast('Nouvelle couverture enregistrée.'); await relireLivre();
      });
      const fch = $('#formChap');
      $('#ajChap').addEventListener('click', () => {
        const der = $$('.at-chap [data-c="page_a"]').pop();
        const de = der ? (+der.value || 0) + 1 : 1;
        $('#chaps').insertAdjacentHTML('beforeend', ligneChap({ titre: '', page_de: de, page_a: Math.max(de, livre.pages.length) }));
      });
      fch.addEventListener('click', (e) => { const x = e.target.closest('[data-supp]'); if (x) x.closest('.at-chap').remove(); });
      fch.addEventListener('submit', async (e) => {
        e.preventDefault();
        const chapitres = $$('.at-chap', fch).map((l) => ({ titre: $('[data-c="titre"]', l).value.trim(), page_de: +$('[data-c="page_de"]', l).value, page_a: +$('[data-c="page_a"]', l).value })).filter((c) => c.titre);
        const btn = fch.querySelector('[type=submit]'); attente(btn, true);
        const r = await API('PUT', `/api/studio/livres/${enc(livre.id)}/chapitres`, { chapitres });
        attente(btn, false);
        if (!r.ok) { $('#errChap').textContent = r.d.erreur || 'Chapitres refusés.'; return; }
        S.toast('Chapitres enregistrés.'); await relireLivre();
      });
    }
  }

  charger().then(() => {
    S.footer();
    if (location.hash) { const el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }
  }).catch(window.SOZO_ERREUR);
}).catch(window.SOZO_ERREUR);
