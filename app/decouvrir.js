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

  main.innerHTML = `<div class="wrap ac">
    <section class="ac-tete">
      <div class="ac-profil">
        <a class="ac-avatar" href="compte.html" aria-label="Mon compte">${S.esc(((moi.name || '?').trim()[0] || '?').toUpperCase())}</a>
        <div><strong>${S.esc(salut)}${prenom ? `, ${S.esc(prenom)}` : ''}</strong><small>${auteur ? 'Qu’allez-vous écrire aujourd’hui ?' : 'Que voulez-vous lire aujourd’hui ?'}</small></div>
        <a class="ac-rond" href="suivis.html" aria-label="Ma bibliothèque">${S.icon('heart')}</a>
        <a class="ac-rond" href="suivis.html#notifications" aria-label="Notifications">${S.icon('bell')}</a>
      </div>
      <a class="ac-cherche" href="explorer.html#q">${S.icon('search')}<span>Rechercher un livre, un auteur…</span></a>
      <div class="ac-portes">
        <a class="ac-porte ac-porte--ecrire" href="studio.html?action=ecrire">${S.icon('feather')}<span><strong>Écrire</strong><small>${auteur ? (miens.length ? 'Reprendre ou commencer une page' : 'Créer votre premier livre') : 'Ouvrir votre atelier'}</small></span></a>
        <a class="ac-porte" href="studio.html?action=brouillons">${S.icon('file')}<span><strong>Brouillons</strong><small>Vos pages en cours</small></span></a>
        <a class="ac-porte" href="explorer.html">${S.icon('book')}<span><strong>Lire</strong><small>${D.books.length} livre${D.books.length > 1 ? 's' : ''}</small></span></a>
      </div>
    </section>

    ${aLaUne ? `<section class="ac-sec ac-sec--une"><a class="ac-une" href="livre.html?id=${encodeURIComponent(aLaUne.id)}" style="--cv:url('${S.img(aLaUne.cover.img)}')">
        <span class="ac-une-fond" aria-hidden="true"></span>
        <div class="ac-une-t"><span class="ac-une-pastille">À la une</span><h2>${S.esc(aLaUne.title)}</h2><p>${S.esc(aLaUne.desc)}</p><span class="btn btn--accent btn--sm">Lire la suite</span></div>
        <div class="ac-une-cv">${S.cover(aLaUne, { big: true })}</div></a></section>` : ''}

    ${pasVisibles ? `<section class="panel ac-pas" aria-labelledby="pasT">
      <div class="ac-pas-h"><div><p class="kicker">Premiers pas · ${faits} sur ${PAS.length}</p><h2 id="pasT">${auteur ? 'Votre livre, en quelques gestes' : 'Bien commencer sur Sōzō'}</h2></div>
        <div class="ac-pas-acts"><button class="btn btn--ghost btn--sm" type="button" data-visite>${S.icon('spark')} Visite guidée</button><button class="icon-btn" type="button" id="pasX" aria-label="Masquer les premiers pas">${S.icon('x')}</button></div></div>
      <div class="ac-pas-barre" role="progressbar" aria-valuemin="0" aria-valuemax="${PAS.length}" aria-valuenow="${faits}" aria-label="Premiers pas accomplis"><i style="width:${(faits / PAS.length) * 100}%"></i></div>
      <ol class="ac-pas-l">${PAS.map(([l, ok, h], i) => `<li class="${ok ? 'is-fait' : ''}"><a href="${h}"><span class="ac-pas-n">${ok ? S.icon('check') : i + 1}</span><span>${S.esc(l)}</span>${ok ? '' : S.icon('right')}</a></li>`).join('')}</ol>
    </section>` : ''}

    ${auteur ? `<section class="sec ac-sec">
      <div class="sec-head"><div><p class="kicker">Votre atelier</p><h2 class="sec-title" data-ink-text="Vos [[livres]]"></h2></div><a class="sec-link" href="studio.html">Ouvrir l’atelier ${S.icon('right')}</a></div>
      ${miens.length ? `<div class="ac-miens">${miens.map((b) => { const st = S.stats(b); return `<div class="ac-mien">
          <a href="studio.html?id=${encodeURIComponent(b.id)}" aria-label="${S.esc(b.title)}">${S.cover(b, { d3: false })}</a>
          <div><strong>${S.esc(b.title)}</strong><small class="ash">${b.pages.length} page${b.pages.length > 1 ? 's' : ''} · ${st.published} publiée${st.published > 1 ? 's' : ''}${st.scheduled ? ` · ${st.scheduled} programmée${st.scheduled > 1 ? 's' : ''}` : ''}</small>
            <div class="row-acts"><a class="btn btn--accent btn--sm" href="studio.html?id=${encodeURIComponent(b.id)}&action=ecrire">${S.icon('pen')} Écrire</a><a class="btn btn--ghost btn--sm" href="studio.html?id=${encodeURIComponent(b.id)}&action=couverture">Couverture</a></div></div></div>`; }).join('')}</div>`
        : `<div class="empty"><strong>Votre étagère est vide</strong>Créez un livre en une minute : un titre, une catégorie, et c’est parti.<br><br><a class="btn btn--accent" href="studio.html?action=nouveau">${S.icon('plus')} Créer mon premier livre</a></div>`}
    </section>` : ''}

    ${enCours.length ? `<section class="sec ac-sec">
      <div class="sec-head"><h2 class="sec-title">Reprendre la lecture</h2><a class="sec-link" href="suivis.html">Tout voir ${S.icon('right')}</a></div>
      <div class="ac-reprise">${enCours.slice(0, 3).map((b) => { const lu = D.reader.progress[b.id]; const vis = S.visiblePages(b); const pub = vis.filter((p) => S.access(b, p.n) !== 'soon'); const p = vis.find((x) => x.n === lu) ? lu : (vis[0] && vis[0].n); const pct = pub.length ? Math.round((Math.min(lu || 0, pub.length) / pub.length) * 100) : 0;
        return `<a class="ac-rep" href="lire.html?id=${encodeURIComponent(b.id)}&p=${p}"><span class="ac-rep-cv">${S.cover(b, { d3: false })}</span><span class="ac-rep-t"><small class="badge badge--free">${lu ? `Page ${lu}` : 'À commencer'}</small><strong>${S.esc(b.title)}</strong><small class="ash">${S.esc(S.author(b.author).name)}</small><span class="prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression"><i style="width:${pct}%"></i></span></span></a>`; }).join('')}</div>
    </section>` : ''}


    ${nouveautes.length ? `<section class="sec ac-sec">
      <div class="sec-head"><h2 class="sec-title">Nouveautés</h2><a class="sec-link" href="explorer.html">Tout explorer ${S.icon('right')}</a></div>
      <div class="ac-genres" role="group" aria-label="Genres"><button class="chip" type="button" data-genre="" aria-pressed="true">Tous</button>${[...new Set(autres.map((b) => b.cat))].map((c) => `<button class="chip" type="button" data-genre="${S.esc(c)}" aria-pressed="false">${S.esc(c)}</button>`).join('')}</div>
      <div class="ac-rang ac-rang--cartes" id="nouv">${nouveautes.map((b) => S.bookCard(b)).join('')}</div>
    </section>` : `<section class="sec ac-sec"><div class="empty"><strong>Les premiers livres arrivent</strong>${auteur ? 'Le vôtre peut être le premier : ' : ''}<a href="studio.html">ouvrir l’atelier</a>.</div></section>`}

    ${soon.length ? `<section class="sec ac-sec">
      <div class="sec-head"><div><p class="kicker">Calendrier des auteurs</p><h2 class="sec-title" data-ink-text="Paraît [[bientôt]]"></h2></div><span class="mono ash">Seule la date est visible avant la parution</span></div>
      <div class="rail">${soon.map(({ b, st }) => `
        <a class="soon-card" href="livre.html?id=${encodeURIComponent(b.id)}">
          ${S.cover(b, { d3: false })}
          <div><span class="soon-when">${S.icon('clock')} ${S.esc(S.dateLong(st.next.date))}</span>
            <strong>${S.esc(b.title)}</strong><span>${S.esc(S.pagesRange(st.next.pages).replace(/^p/, 'P'))} · ${S.esc(S.author(b.author).name)}</span></div>
        </a>`).join('')}</div>
    </section>` : ''}
  </div>`;

  // Genres : filtrent les nouveautés sur place
  $$('[data-genre]').forEach((c) => c.addEventListener('click', () => {
    $$('[data-genre]').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    const liste = [...autres].sort((x, y) => parution(y) - parution(x)).filter((b) => !c.dataset.genre || b.cat === c.dataset.genre).slice(0, 12);
    $('#nouv').innerHTML = liste.map((b) => S.bookCard(b)).join('');
  }));
  const px = $('#pasX');
  if (px) px.addEventListener('click', () => { try { localStorage.setItem('sozo-pas-ferme', auteur ? 'a' : 'l'); } catch (e) {} $('.ac-pas').remove(); });
  S.inkAll(); S.prepAll(); S.reveals(); S.tilt(main); S.footer();

  /* Arrivée après la création du compte : on accueille, on propose la visite */
  if (S.q('bienvenue')) {
    history.replaceState(null, '', 'decouvrir.html');
    S.modal({ title: `Bienvenue${prenom ? `, ${prenom}` : ''} !`, body: `<p>Sōzō est fait d’abord pour <strong>écrire et publier</strong>, page par page — et pour lire.</p>
      <ul class="bv-l bv-l--court"><li><span>${S.icon('feather')}</span><div><strong>Écrire</strong><small>Le bouton doré, toujours à portée : à gauche sur ordinateur, au centre en bas sur téléphone.</small></div></li>
      <li><span>${S.icon('grid')}</span><div><strong>Explorer</strong><small>Tous les livres, par catégorie ou par recherche.</small></div></li>
      <li><span>${S.icon('library')}</span><div><strong>Bibliothèque</strong><small>Vos livres suivis, vos épingles, vos notifications.</small></div></li></ul>`,
      actions: [{ label: 'Plus tard' }, { label: 'Faire la visite (30 s)', primary: true, onClick: (close) => { close(); S.visite(); } }] });
  }
}).catch(window.SOZO_ERREUR);
