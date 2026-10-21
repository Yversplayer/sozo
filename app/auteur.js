/* ═══════════════════════════════════════════════════════════
   Sōzō — la page d'une personne qui écrit (lot C, 21/10/2026).
   Pour TOUS : l'auteur d'un livre comme celle qui publie une seule pensée.
   Le serveur (/api/profils/<id>) ne rend que ce qui est déjà public : nom,
   ville, présentation, livres visibles, écrits parus. Suivre la personne
   (abonnement) ou suivre ses livres un par un restent deux gestes distincts.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, D = S.D, E = window.SOZO_ECRITS, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  S.shell('explorer');
  const main = $('#main');
  const id = S.q('id') || '';
  const uid = /^u\d+$/.test(id) ? +id.slice(1) : 0;
  const r = uid ? await window.SOZO_API('GET', `/api/profils/${uid}`) : { ok: false, d: {} };
  if (!r.ok) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Profil introuvable</strong>Le compte a peut-être été supprimé.<br><br><a class="btn" href="decouvrir.html">Retour</a></div></div>`;
    S.footer(); return;
  }
  const p = r.d.profil;
  document.title = `${p.nom} — Sōzō`;
  const books = S.booksBy ? S.booksBy(id) : [];
  const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const up = [];
  books.forEach((b) => {
    const g = {};
    b.pages.filter((x) => S.access(b, x.n) === 'soon').forEach((x) => (g[x.date] = g[x.date] || []).push(x.n));
    Object.entries(g).forEach(([d, ns]) => up.push({ b, d, ns }));
  });
  up.sort((x, y) => S.parse(x.d) - S.parse(y.d));
  const depuis = S.dateLong(p.depuis).replace(/ à .*/, '').replace(/^\d+ /, '');

  main.innerHTML = `
  <div class="au-hero vl-velours" aria-hidden="true"></div>
  <div class="wrap">
    <div class="au-head">
      <div class="au-big">${S.monogramme(p.nom, 112)}</div>
      <div>
        <p class="kicker">${p.ville ? `${S.esc(p.ville)} · ` : ''}sur Sōzō depuis ${S.esc(depuis)}</p>
        <h1>${S.esc(p.nom)}</h1>
        <div class="au-stats"><span><b>${p.ecrits}</b> écrit${p.ecrits > 1 ? 's' : ''}</span><span><b>${p.livres.length}</b> livre${p.livres.length > 1 ? 's' : ''}</span><span><b id="nbAbonnes">${p.abonnes}</b> abonné${p.abonnes > 1 ? 's' : ''}</span></div>
      </div>
      ${p.moi.soi ? `<a class="btn btn--ghost" href="compte.html">${S.icon('edit')} Modifier mon profil</a>` : `<button class="btn" type="button" id="suivre" aria-pressed="${p.moi.abonne}"></button>`}
    </div>
    ${p.bio ? `<p class="au-bio">${S.esc(p.bio)}</p>` : ''}
    <div class="vl-onglets au-onglets" role="tablist" aria-label="Ses publications">
      <button role="tab" type="button" data-o="ecrits" aria-selected="true">Écrits</button>
      ${books.length ? `<button role="tab" type="button" data-o="livres" aria-selected="false">Livres</button>` : ''}
    </div>
    <section id="oEcrits" class="sec" style="padding-top:22px"><div class="vl-fil" id="fil" aria-busy="true"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
      <div class="ex-plus"><button class="btn btn--ghost" type="button" id="plus" hidden>Voir plus</button></div></section>
    <section id="oLivres" class="sec" style="padding-top:22px" hidden>
      <div class="cols">
        <div class="grid">${books.map((b) => S.bookCard(b)).join('')}</div>
        <div class="panel">
          <h2>Prochaines parutions</h2>
          ${up.length ? `<div class="cal">${up.slice(0, 6).map(({ b, d, ns }) => { const dt = S.parse(d); return `<a class="cal-row" href="livre.html?id=${b.id}"><div class="cal-day"><b>${dt.getDate()}</b><span>${MO[dt.getMonth()]}</span></div><div>${S.esc(b.title)}<small>${S.esc(S.pagesRange(ns))} · ${dt.getHours()} h</small></div></a>`; }).join('')}</div>`
            : '<p class="ash">Aucune page programmée pour l’instant.</p>'}
          <p class="note">${S.icon('clock')} Seules les dates sont visibles : le contenu reste fermé jusqu’à la parution.</p>
        </div>
      </div>
    </section>
  </div>`;

  /* ses écrits : du serveur, page après page */
  let ecrits = [], suite = null;
  async function charger() {
    const rr = await window.SOZO_API('GET', `/api/ecrits?${new URLSearchParams({ auteur: id, ...(suite ? { avant: suite } : {}) })}`);
    const fil = $('#fil'); fil.removeAttribute('aria-busy');
    if (!rr.ok) { fil.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(rr.d.erreur || 'Les écrits n’ont pas pu se charger.')}</span></p>`; return; }
    ecrits = ecrits.concat(rr.d.ecrits); suite = rr.d.suite;
    fil.innerHTML = ecrits.length ? ecrits.map((e) => E.carte(e)).join('') : `<div class="empty" style="grid-column:1/-1"><strong>Aucun écrit publié pour l’instant</strong></div>`;
    $('#plus').hidden = !suite;
  }
  E.brancher($('#fil'), (eid) => ecrits.find((e) => e.id === eid));
  $('#plus').addEventListener('click', charger);
  charger();
  $$('[data-o]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-o]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $('#oEcrits').hidden = b.dataset.o !== 'ecrits'; $('#oLivres').hidden = b.dataset.o !== 'livres';
  }));

  /* suivre : l'état affiché est celui que le serveur confirme */
  const sv = $('#suivre');
  const peindre = (on) => { sv.innerHTML = `${S.icon(on ? 'check' : 'plus')} ${on ? 'Abonné' : 'Suivre'}`; sv.setAttribute('aria-pressed', String(on)); sv.classList.toggle('btn--ghost', on); };
  if (sv) {
    peindre(p.moi.abonne);
    sv.addEventListener('click', async () => {
      const oui = sv.getAttribute('aria-pressed') !== 'true';
      sv.disabled = true;
      const rr = await window.SOZO_API(oui ? 'POST' : 'DELETE', `/api/profils/${uid}/abonnement`);
      sv.disabled = false;
      if (!rr.ok) { S.toast(rr.d.erreur || 'Le serveur a refusé.'); return; }
      peindre(rr.d.abonne); $('#nbAbonnes').textContent = rr.d.abonnes;
      S.toast(rr.d.abonne ? `Vous suivez ${p.nom} : ses nouveaux écrits vous seront signalés.` : `Vous ne suivez plus ${p.nom}.`);
    });
  }
  S.footer();
}).catch(window.SOZO_ERREUR);
