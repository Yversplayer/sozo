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

  document.body.dataset.glisseRetour = '1';       // 03/11/2026 : glisser vers la droite ramène à l'œuvre
  /* 08/11/2026 — la page d'auteur des maquettes Stitch : le portrait (son
     monogramme cerclé d'or), la ville et la date d'arrivée, la présentation,
     trois nombres RÉELS (abonnés, livres, écrits), « Suivre » et
     « Partager » ; puis Livres et Écrits en pastilles, et ses prochaines
     parutions. Sans « auteur vérifié » ni dons : Sōzō n'en a pas. */
  main.innerHTML = `<div class="sx-page sx-au">
    <header class="sx-barre" id="auBarre">
      <a class="sx-retour" href="decouvrir.html" data-retour aria-label="Retour">${S.icon('left')}</a>
      <span class="sx-barre-t">${S.esc(p.nom)}</span>
      <button class="sx-ic" type="button" id="auPartager" aria-label="Partager ce profil">${S.icon('partager')}</button>
    </header>
    <div class="sx-ecran">
      <section class="sx-au-tete">
        <span class="sx-au-av">${S.monogramme(p.nom, 104)}</span>
        <h1>${S.esc(p.nom)}</h1>
        <p class="sx-chapeau">${p.ville ? `${S.icon('home')} ${S.esc(p.ville)} · ` : ''}sur Sōzō depuis ${S.esc(depuis)}</p>
        ${p.bio ? `<p class="sx-au-bio">${S.esc(p.bio)}</p>` : ''}
        <dl class="sx-moi-n"><div><dd id="nbAbonnes">${p.abonnes}</dd><dt>Abonné${p.abonnes > 1 ? 's' : ''}</dt></div><div><dd>${p.livres.length}</dd><dt>Livre${p.livres.length > 1 ? 's' : ''}</dt></div><div><dd>${p.ecrits}</dd><dt>Écrit${p.ecrits > 1 ? 's' : ''}</dt></div></dl>
        <div class="sx-une-b">
          ${p.moi.soi ? `<a class="sx-btn sx-btn--contour" href="compte.html#profil">${S.icon('edit')}<span>Modifier mon profil</span></a>` : '<button class="sx-btn sx-btn--plein" type="button" id="suivre" aria-pressed="false"></button>'}
          <button class="sx-btn sx-btn--contour" type="button" id="auPartager2">${S.icon('partager')}<span>Partager</span></button>
        </div>
      </section>
      <nav class="sx-pilules" role="tablist" aria-label="Ses publications" data-sans-glisse>
        ${books.length ? `<button role="tab" type="button" class="sx-pilule" data-o="livres" aria-selected="true">${S.icon('book')}Livres <small>${books.length}</small></button>` : ''}
        <button role="tab" type="button" class="sx-pilule" data-o="ecrits" aria-selected="${books.length ? 'false' : 'true'}">${S.icon('feather')}Écrits <small>${p.ecrits}</small></button>
      </nav>
      <section id="oLivres"${books.length ? '' : ' hidden'}>
        ${books[0] ? `<a class="sx-carte sx-au-une" href="livre.html?id=${encodeURIComponent(books[0].id)}">${S.cover(books[0], { d3: false })}
          <span class="sx-au-une-t"><span class="sx-sur">${S.esc(books[0].cat)}</span><b>${S.esc(books[0].title)}</b><small>${S.esc((books[0].desc || '').slice(0, 110))}${(books[0].desc || '').length > 110 ? '…' : ''}</small>
          <span class="sx-chip ${books[0].access === 'free' ? 'sx-chip--or' : 'sx-chip--bord'}">${books[0].access === 'free' ? 'Gratuit' : S.priceFrom(books[0]) != null ? `Dès ${S.esc(S.money(S.priceFrom(books[0])))}` : S.esc(S.accessLabel(books[0]))}</span></span></a>` : ''}
        ${books.length > 1 ? `<div class="sx-tuiles">${books.slice(1).map((b) => `<a class="sx-tuile" href="livre.html?id=${encodeURIComponent(b.id)}"><span class="sx-tuile-cv">${S.cover(b, { d3: false })}</span><b>${S.esc(b.title)}</b><small>${S.esc(b.cat)} · ${S.esc(S.accessLabel(b))}</small></a>`).join('')}</div>` : ''}
        <div class="sx-carte sx-carte--douce sx-parutions"><h2>Prochaines parutions</h2>
          ${up.length ? `<div class="cal">${up.slice(0, 6).map(({ b, d, ns }) => { const dt = S.parse(d); return `<a class="cal-row" href="livre.html?id=${b.id}"><div class="cal-day"><b>${dt.getDate()}</b><span>${MO[dt.getMonth()]}</span></div><div>${S.esc(b.title)}<small>${S.esc(S.pagesRange(ns))} · ${dt.getHours()} h</small></div></a>`; }).join('')}</div>`
            : '<p class="sx-chapeau">Aucune page programmée pour l’instant.</p>'}
        </div>
      </section>
      <section id="oEcrits"${books.length ? ' hidden' : ''}><div class="sx-fil" id="fil" aria-busy="true"><p class="sx-chapeau"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
        <button class="sx-btn sx-btn--doux sx-btn--bloc" type="button" id="plus" hidden>Voir plus</button></section>
    </div>
  </div>`;
  const partagerProfil = async () => {
    const url = new URL(`auteur.html?id=${encodeURIComponent(id)}`, location.href).href;
    if (navigator.share) { try { await navigator.share({ title: `${p.nom} — Sōzō`, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); S.toast('Lien copié : collez-le où vous voulez le partager.'); } catch (er) { S.toast('Le partage n’est pas possible sur cet appareil.'); }
  };
  $('#auPartager').addEventListener('click', partagerProfil);
  $('#auPartager2').addEventListener('click', partagerProfil);
  const auB = $('#auBarre');
  addEventListener('scroll', () => auB.classList.toggle('is-defile', scrollY > 12), { passive: true });

  /* ses écrits : du serveur, page après page */
  let ecrits = [], suite = null;
  async function charger() {
    const rr = await window.SOZO_API('GET', `/api/ecrits?${new URLSearchParams({ auteur: id, ...(suite ? { avant: suite } : {}) })}`);
    const fil = $('#fil'); fil.removeAttribute('aria-busy');
    if (!rr.ok) { fil.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(rr.d.erreur || 'Les écrits n’ont pas pu se charger.')}</span></p>`; return; }
    ecrits = ecrits.concat(rr.d.ecrits); suite = rr.d.suite;
    fil.innerHTML = ecrits.length ? ecrits.map((e) => E.carte(e)).join('') : `<div class="sx-vide">${S.PLUME_OR}<strong>Aucun écrit publié pour l’instant</strong></div>`;
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
  const peindre = (on) => { sv.innerHTML = `${S.icon(on ? 'check' : 'plus')}<span>${on ? 'Abonné(e)' : 'Suivre'}</span>`; sv.setAttribute('aria-pressed', String(on)); sv.classList.toggle('sx-btn--plein', !on); sv.classList.toggle('sx-btn--contour', on); };
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
}).catch(window.SOZO_ERREUR);
