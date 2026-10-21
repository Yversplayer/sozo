/* Sōzō — l'Accueil, une fois connecté (refonte du 19/10/2026).
   « Quand une personne se connecte ou crée son compte, qu'elle se repère
   facilement » : une salutation, deux portes (Écrire, Lire), les premiers
   pas calculés sur SES données réelles, puis ce qu'elle lit, ce qu'elle écrit,
   ce qui paraît. Le catalogue complet vit dans Explorer. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  if (location.hash === '#catalogue') { location.replace('explorer.html' + (S.q('cat') ? `?cat=${encodeURIComponent(S.q('cat'))}` : '')); return; }
  S.shell('accueil');
  const main = $('#main');
  const moi = S.sess();
  const auteur = moi.role === 'auteur';
  const prenom = (moi.name || '').trim().split(/\s+/)[0] || '';
  const heure = new Date().getHours();
  const salut = heure < 5 ? 'Bonne nuit' : heure < 18 ? 'Bonjour' : 'Bonsoir';
  const autres = D.books.filter((b) => !b.owner);
  const miens = D.books.filter((b) => b.owner);

  /* ─── premiers pas : cochés d'après les données du serveur ─── */
  const lus = Object.keys(D.reader.progress || {}).length;
  const PAS = auteur ? [
    ['Créer votre premier livre', miens.length > 0, 'studio.html?action=nouveau'],
    ['Écrire ou importer une page', miens.some((b) => b.pages.length > 0), 'studio.html?action=ecrire'],
    ['Habiller votre couverture', miens.some((b) => (b.apparence && b.apparence.couv) || b.image), 'studio.html?action=couverture'],
    ['Publier une page', miens.some((b) => b.pages.some((p) => p.status !== 'draft')), 'studio.html?action=publier'],
    ['Suivre un autre auteur', D.reader.follows.some((id) => !miens.some((b) => b.id === id)), 'explorer.html']
  ] : [
    ['Explorer le catalogue', lus > 0 || D.reader.follows.length > 0, 'explorer.html'],
    ['Suivre un livre', D.reader.follows.length > 0, 'explorer.html'],
    ['Lire une première page', lus > 0, autres[0] ? `lire.html?id=${encodeURIComponent(autres[0].id)}` : 'explorer.html'],
    ['Ouvrir votre atelier d’auteur', false, 'studio.html']
  ];
  const faits = PAS.filter((p) => p[1]).length;
  let cache = false;
  try { cache = localStorage.getItem('sozo-pas-ferme') === (auteur ? 'a' : 'l'); } catch (e) {}
  const pasVisibles = !cache && faits < PAS.length;

  /* ─── reprendre ─── */
  const enCours = D.reader.follows.map((id) => S.book(id)).filter((b) => b && !b.owner).slice(0, 6);
  const parution = (b) => Math.max(0, ...b.pages.filter((p) => S.status(p) === 'published' && p.date).map((p) => +S.parse(p.date)));
  const nouveautes = [...autres].sort((x, y) => parution(y) - parution(x)).slice(0, 8);
  const aLaUne = nouveautes[0];
  const soon = D.books.map((b) => ({ b, st: S.stats(b) })).filter((x) => x.st.next).sort((x, y) => S.parse(x.st.next.date) - S.parse(y.st.next.date)).slice(0, 10);

  /* 21/10/2026 — l'accueil de l'image du propriétaire : « Bonjour », la
     recherche, la plume (écrire tout de suite), à la une sur velours, les
     nouveautés, puis les écrits du jour. Calme, sans photo. */
  const E = window.SOZO_ECRITS;
  main.innerHTML = `<div class="wrap ac vl-ac">
    <section class="vl-salut">
      <h1>${S.esc(salut)}${prenom ? `, ${S.esc(prenom)}` : ''}</h1>
      <p>Que voulez-vous écrire, ou lire, aujourd’hui ?</p>
      <a class="ac-cherche vl-cherche" href="explorer.html#q">${S.icon('search')}<span>Rechercher un livre, un écrit, un auteur…</span></a>
    </section>

    <section class="vl-plume-carte vl-velours" aria-labelledby="plumeT">
      <div class="vl-plume-t">
        <h2 id="plumeT">${S.PLUME_SVG.replace('cv-plume', 'vl-plume-g')}La plume</h2>
        <p>Une pensée, une prière, un poème : écrivez-le maintenant, publiez-le quand vous voulez.</p>
      </div>
      <div class="vl-natures" role="list">${Object.entries(E.NATURES).map(([k, l]) => `<a role="listitem" class="vl-nature" href="ecrits.html?nouveau=${k}"><strong>${S.esc(l)}</strong><small>${S.esc(E.AIDE[k])}</small></a>`).join('')}
        <a role="listitem" class="vl-nature vl-nature--livre" href="studio.html?action=nouveau"><strong>Un livre</strong><small>Page après page</small></a></div>
    </section>

    ${aLaUne ? `<section class="ac-sec"><a class="vl-une vl-velours" href="livre.html?id=${encodeURIComponent(aLaUne.id)}">
        <div class="vl-une-t"><span class="vl-or">À la une</span><h2>${S.esc(aLaUne.title)}</h2><p>${S.esc(S.author(aLaUne.author).name)}</p><span class="btn btn--accent btn--sm">Découvrir</span></div>
        <div class="vl-une-cv">${S.cover(aLaUne, { big: true, d3: false })}</div></a></section>` : ''}

    ${enCours.length ? `<section class="sec ac-sec">
      <div class="sec-head"><h2 class="sec-title">Reprendre la lecture</h2><a class="sec-link" href="suivis.html">Tout voir ${S.icon('right')}</a></div>
      <div class="ac-reprise">${enCours.slice(0, 3).map((b) => { const lu = D.reader.progress[b.id]; const vis = S.visiblePages(b); const pub = vis.filter((p) => S.access(b, p.n) !== 'soon'); const p = vis.find((x) => x.n === lu) ? lu : (vis[0] && vis[0].n); const pct = pub.length ? Math.round((Math.min(lu || 0, pub.length) / pub.length) * 100) : 0;
        return `<a class="ac-rep" href="lire.html?id=${encodeURIComponent(b.id)}&p=${p}"><span class="ac-rep-cv">${S.cover(b, { d3: false })}</span><span class="ac-rep-t"><small class="badge badge--free">${lu ? `Page ${lu}` : 'À commencer'}</small><strong>${S.esc(b.title)}</strong><small class="ash">${S.esc(S.author(b.author).name)}</small><span class="prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression"><i style="width:${pct}%"></i></span></span></a>`; }).join('')}</div>
    </section>` : ''}

    ${nouveautes.length ? `<section class="sec ac-sec">
      <div class="sec-head"><h2 class="sec-title">Nouveautés</h2><a class="sec-link" href="explorer.html">Voir tout ${S.icon('right')}</a></div>
      <div class="vl-rang" id="nouv">${nouveautes.map((b) => `<a class="vl-livre" href="livre.html?id=${encodeURIComponent(b.id)}">${S.cover(b, { d3: false })}<strong>${S.esc(b.title)}</strong><small>${S.esc(b.cat)}</small></a>`).join('')}</div>
    </section>` : ''}

    <section class="sec ac-sec" aria-labelledby="ecritsT">
      <div class="sec-head"><h2 class="sec-title" id="ecritsT">Écrits du jour</h2><a class="sec-link" href="explorer.html?vue=ecrits">Tous les écrits ${S.icon('right')}</a></div>
      <div class="ex-cats" role="group" aria-label="Quels écrits"><button class="chip chip--sm" type="button" data-fil="" aria-pressed="true">Tous</button><button class="chip chip--sm" type="button" data-fil="1" aria-pressed="false">Mes abonnements</button></div>
      <div class="vl-fil" id="fil" aria-busy="true"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement des écrits…</p></div>
    </section>

    ${pasVisibles ? `<section class="panel ac-pas" aria-labelledby="pasT">
      <div class="ac-pas-h"><div><p class="kicker">Premiers pas · ${faits} sur ${PAS.length}</p><h2 id="pasT">${auteur ? 'Votre livre, en quelques gestes' : 'Bien commencer sur Sōzō'}</h2></div>
        <div class="ac-pas-acts"><button class="btn btn--ghost btn--sm" type="button" data-visite>${S.icon('spark')} Visite guidée</button><button class="icon-btn" type="button" id="pasX" aria-label="Masquer les premiers pas">${S.icon('x')}</button></div></div>
      <div class="ac-pas-barre" role="progressbar" aria-valuemin="0" aria-valuemax="${PAS.length}" aria-valuenow="${faits}" aria-label="Premiers pas accomplis"><i style="width:${(faits / PAS.length) * 100}%"></i></div>
      <ol class="ac-pas-l">${PAS.map(([l, ok, h], i) => `<li class="${ok ? 'is-fait' : ''}"><a href="${h}"><span class="ac-pas-n">${ok ? S.icon('check') : i + 1}</span><span>${S.esc(l)}</span>${ok ? '' : S.icon('right')}</a></li>`).join('')}</ol>
    </section>` : ''}

    ${soon.length ? `<section class="sec ac-sec">
      <div class="sec-head"><h2 class="sec-title">Paraît bientôt</h2><span class="ash" style="font-size:14px">Seule la date est visible avant la parution</span></div>
      <div class="rail">${soon.map(({ b, st }) => `
        <a class="soon-card" href="livre.html?id=${encodeURIComponent(b.id)}">
          ${S.cover(b, { d3: false })}
          <div><span class="soon-when">${S.icon('clock')} ${S.esc(S.dateLong(st.next.date))}</span>
            <strong>${S.esc(b.title)}</strong><span>${S.esc(S.pagesRange(st.next.pages).replace(/^p/, 'P'))} · ${S.esc(S.author(b.author).name)}</span></div>
        </a>`).join('')}</div>
    </section>` : ''}
  </div>`;

  /* Écrits du jour : la réponse du serveur, ou un état honnête */
  let ecrits = [];
  const chargerFil = async (abos) => {
    const fil = $('#fil');
    fil.setAttribute('aria-busy', 'true');
    const r = await window.SOZO_API('GET', abos ? '/api/ecrits?abonnements=1' : '/api/ecrits');
    fil.removeAttribute('aria-busy');
    if (!r.ok) { fil.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Les écrits n’ont pas pu se charger.')}</span></p>`; return; }
    ecrits = r.d.ecrits.slice(0, 8);
    fil.innerHTML = ecrits.length ? ecrits.map((e) => E.carte(e)).join('')
      : abos ? `<div class="empty"><strong>Rien de neuf chez vos abonnements</strong>Suivez les auteurs qui vous touchent : touchez leur nom, puis « Suivre ».</div>`
      : `<div class="empty"><strong>Aucun écrit pour l’instant</strong>Le premier peut être le vôtre : une phrase suffit.<br><br><a class="btn" href="ecrits.html?nouveau=pensee">${S.icon('feather')} Écrire une pensée</a></div>`;
  };
  chargerFil(false);
  $$('[data-fil]').forEach((c) => c.addEventListener('click', () => { $$('[data-fil]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); chargerFil(!!c.dataset.fil); }));
  E.brancher($('#fil'), (id) => ecrits.find((e) => e.id === id));

  const px = $('#pasX');
  if (px) px.addEventListener('click', () => { try { localStorage.setItem('sozo-pas-ferme', auteur ? 'a' : 'l'); } catch (e) {} $('.ac-pas').remove(); });
  S.inkAll(); S.prepAll(); S.reveals(); S.tilt(main); S.footer();

  /* Arrivée après la création du compte : on accueille, on propose la visite */
  if (S.q('bienvenue')) {
    history.replaceState(null, '', 'decouvrir.html');
    S.modal({ title: `Bienvenue${prenom ? `, ${prenom}` : ''} !`, body: `<p>Sōzō est un lieu calme pour <strong>écrire</strong> — une phrase, un poème, un livre — et pour lire.</p>
      <ul class="bv-l bv-l--court"><li><span>${S.icon('feather')}</span><div><strong>Écrire</strong><small>La plume, toujours à portée : une pensée, un poème, une prière, ou un livre entier.</small></div></li>
      <li><span>${S.icon('grid')}</span><div><strong>Explorer</strong><small>Tous les livres, par catégorie ou par recherche.</small></div></li>
      <li><span>${S.icon('library')}</span><div><strong>Bibliothèque</strong><small>Vos livres suivis, vos épingles, vos notifications.</small></div></li></ul>`,
      actions: [{ label: 'Plus tard' }, { label: 'Faire la visite (30 s)', primary: true, onClick: (close) => { close(); S.visite(); } }] });
  }
}).catch(window.SOZO_ERREUR);
