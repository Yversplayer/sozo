/* Sōzō — l'Accueil, une fois connecté (refonte du 19/10/2026 ; 22/10/2026 :
   la LECTURE d'abord, à la demande des premiers testeurs — « Que voulez-vous
   lire ? », reprendre, à la une, nouveautés, écrits ; écrire un mot vient
   ensuite, plus discret, et reste gratuit).
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
    ['Partager votre premier écrit', false, 'ecrits.html?nouveau=pensee']
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
  /* 22/10/2026 — « en cliquant sur Accueil, l'utilisateur doit se sentir comme
     s'il venait d'ouvrir son propre monde » (le propriétaire). En haut, SON
     monde : une photo selon l'heure, son prénom, sa lecture en cours, ses
     raccourcis. Ensuite, le meilleur de Sōzō avec le dessin d'Explorer. */
  const PHOTO_HEURE = heure < 5 ? 'foi-bougie-nuit' : heure < 11 ? 'foi-soleil-mer' : heure < 17 ? 'foi-champ-dore' : heure < 20 ? 'hero-crepuscule' : 'foi-livre-nuit';
  const lecture = enCours[0];
  const pctDe = (b) => { const lu = D.reader.progress[b.id] || 0; const pub = S.visiblePages(b).filter((p) => S.access(b, p.n) !== 'soon'); return pub.length ? Math.round((Math.min(lu, pub.length) / pub.length) * 100) : 0; };
  const lienLecture = (b) => { const lu = D.reader.progress[b.id]; const vis = S.visiblePages(b); return `lire.html?id=${encodeURIComponent(b.id)}&p=${vis.find((x) => x.n === lu) ? lu : (vis[0] ? vis[0].n : 1)}`; };
  const catsSuivies = [...new Set(enCours.map((b) => b.cat))];
  const pourVous = autres.filter((b) => catsSuivies.includes(b.cat) && !enCours.includes(b));
  /* 30/10/2026 — l'APPLICATION (captures du propriétaire) : sur téléphone,
     Découvrir est clair et dégagé — bonjour, recherche, la Bible et la cloche,
     reprendre la lecture, nouveautés, pour vous, catégories, écrits aimés.
     Pas de photo plein écran : la page s'affiche vite en 3G. */
  const tel = matchMedia('(max-width: 899px)').matches;
  const cats = [...new Set(autres.map((b) => b.cat))].slice(0, 8);
  const nNotifs = S.unread();
  const initiales = (() => { const n = (moi.name || '?').trim().split(/\s+/); return ((n[0] || '?')[0] + (n.length > 1 ? n[n.length - 1][0] : '')).toUpperCase(); })();
  const appli = () => `<div class="ap ap-dec">
    <header class="ap-tete">
      <a class="ap-moi" href="compte.html" aria-label="Mon profil"><span class="nav-av" aria-hidden="true">${S.esc(initiales)}</span></a>
      <h1>${S.esc(salut)}${prenom ? `, ${S.esc(prenom)}` : ''}</h1>
      <a class="ap-rond" href="bible.html" aria-label="La Bible">${S.icon('book')}</a>
      <a class="ap-rond" href="suivis.html#notifications" aria-label="Notifications${nNotifs ? ` : ${nNotifs} nouvelle${nNotifs > 1 ? 's' : ''}` : ''}">${S.icon('bell')}${nNotifs ? `<span class="ap-pastille">${nNotifs}</span>` : ''}</a>
    </header>
    <a class="ap-cherche" href="explorer.html#q">${S.icon('search')}<span>Rechercher livres, auteurs…</span></a>
    <p class="ap-verset" id="versetJour" hidden></p>
    <aside class="vl-installer" id="bandeauInstaller" hidden><span>${S.icon('upload')} Installez Sōzō sur votre écran d’accueil, et lisez même sans réseau.</span>
      <span class="row-acts"><button class="btn btn--accent btn--sm" type="button" id="instOui">Installer</button><button class="ec-lien" type="button" id="instNon">Plus tard</button></span></aside>
    ${lecture ? `<a class="ap-reprise" href="${lienLecture(lecture)}"><span class="ap-reprise-cv">${S.cover(lecture, { d3: false })}</span>
      <span class="ap-reprise-t"><small>Continuer la lecture</small><strong>${S.esc(lecture.title)}</strong><span>${S.esc(S.author(lecture.author).name)}</span>
      <span class="prog" role="progressbar" aria-valuenow="${pctDe(lecture)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression"><i style="width:${pctDe(lecture)}%"></i></span><em>${pctDe(lecture)} % lu</em></span></a>`
      : `<a class="ap-reprise ap-reprise--vide" href="explorer.html"><span class="ap-reprise-t"><small>Votre première lecture</small><strong>Trouvez un livre qui vous parle</strong><span>Explorer le catalogue ${S.icon('right')}</span></span></a>`}
    ${aLaUne ? `<a class="ap-une" href="livre.html?id=${encodeURIComponent(aLaUne.id)}"><span class="ap-une-t"><span class="ap-une-k">${S.icon('star')} À la une</span><strong>${S.esc(aLaUne.title)}</strong><span>${S.esc(S.author(aLaUne.author).name)}</span><em>Découvrir ${S.icon('right')}</em></span><span class="ap-une-cv">${S.cover(aLaUne, { d3: false })}</span></a>` : ''}
    ${cats.length ? `<nav class="ap-ronds" aria-label="Catégories">${cats.map((c) => { const l = autres.filter((b) => b.cat === c); return `<a class="ap-rond-cat" href="explorer.html?cat=${encodeURIComponent(c)}"><span class="ap-rond-img" style="background-image:url('${S.esc(S.img(l[0].cover.img, true))}')"></span><span>${S.esc(c)}</span></a>`; }).join('')}
      <a class="ap-rond-cat" href="explorer.html?vue=ecrits"><span class="ap-rond-img ap-rond-img--ic">${S.icon('feather')}</span><span>Écrits</span></a></nav>` : ''}
    ${S.rangee('Nouveautés', nouveautes.slice(1), { lien: 'explorer.html' })}
    ${S.rangee('Pour vous', pourVous.slice(0, 12), { lien: 'explorer.html' })}
    <section class="xp-rang" aria-label="Les écrits les plus aimés">
      <div class="xp-rang-h"><h2>Écrits aimés</h2><a class="ec-lien" href="explorer.html?vue=ecrits">Tout voir</a></div>
      <div class="xp-defile" id="moAimes" tabindex="0"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
    </section>
  </div>`;
  main.innerHTML = tel ? appli() : `<div class="wrap ac vl-ac">
    <section class="mo-hero" style="--mo-photo:url('${S.esc(S.img(PHOTO_HEURE))}')">
      <div class="mo-hero-t">
        <p class="mo-k">Votre Sōzō · ${S.esc(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        <h1>${S.esc(salut)}${prenom ? `, ${S.esc(prenom)}` : ''}</h1>
        <p class="mo-q">Que voulez-vous lire aujourd’hui ?</p>
        <p class="vl-jour mo-jour" id="versetJour" hidden></p>
        <a class="ac-cherche vl-cherche mo-cherche" href="explorer.html#q">${S.icon('search')}<span>Rechercher un livre, un écrit, un auteur…</span></a>
      </div>
      <div class="mo-moi">
        ${lecture ? `<a class="mo-lecture" href="${lienLecture(lecture)}"><span class="mo-lecture-cv">${S.cover(lecture, { d3: false })}</span>
          <span class="mo-lecture-t"><small>Reprendre la lecture</small><strong>${S.esc(lecture.title)}</strong><span class="ash">${S.esc(S.author(lecture.author).name)}</span>
          <span class="prog" role="progressbar" aria-valuenow="${pctDe(lecture)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression"><i style="width:${pctDe(lecture)}%"></i></span></span></a>`
          : `<a class="mo-lecture mo-lecture--vide" href="explorer.html"><span class="mo-lecture-t"><small>Votre première lecture</small><strong>Trouvez un livre qui vous parle</strong><span class="ash">Explorer le catalogue ${S.icon('right')}</span></span></a>`}
        <nav class="mo-raccourcis" aria-label="Mes raccourcis">
          <a href="suivis.html">${S.icon('library')}<span>Ma bibliothèque</span><small>${D.reader.follows.length} suivi${D.reader.follows.length > 1 ? 's' : ''}</small></a>
          <a href="ecrits.html">${S.icon('feather')}<span>Mes écrits</span><small>écrire un mot</small></a>
          <a href="bible.html">${S.icon('book')}<span>La Bible</span><small>le verset du jour</small></a>
          ${miens.length ? `<a href="studio.html">${S.icon('pen')}<span>Mes livres</span><small>${miens.length} livre${miens.length > 1 ? 's' : ''}</small></a>` : ''}
        </nav>
      </div>
    </section>

    <aside class="vl-installer" id="bandeauInstaller" hidden><span>${S.icon('upload')} Installez Sōzō sur votre écran d’accueil, et lisez même sans réseau.</span>
      <span class="row-acts"><button class="btn btn--accent btn--sm" type="button" id="instOui">Installer</button><button class="ec-lien" type="button" id="instNon">Plus tard</button></span></aside>

    ${enCours.length > 1 ? S.rangee('Vos lectures', enCours, { lien: 'suivis.html' }) : ''}
    ${S.rangee('Pour vous', pourVous.slice(0, 14), { lien: 'explorer.html' })}
    ${S.rangee('Le meilleur de Sōzō', nouveautes, { lien: 'explorer.html' })}
    <section class="xp-rang" aria-label="Les écrits les plus aimés">
      <div class="xp-rang-h"><h2>Les écrits les plus aimés</h2><a class="ec-lien" href="explorer.html?vue=ecrits">Tous les écrits</a>
        <span class="xp-fleches"><button type="button" class="xp-fl" data-fl="-1" aria-label="Précédents">${S.icon('left')}</button><button type="button" class="xp-fl" data-fl="1" aria-label="Suivants">${S.icon('right')}</button></span></div>
      <div class="xp-defile" id="moAimes" tabindex="0"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
    </section>

    <nav class="vl-lire-quoi" aria-label="Que voulez-vous lire ?">
      ${[...new Set(autres.map((b) => b.cat))].slice(0, 6).map((c) => `<a class="chip" href="explorer.html?cat=${encodeURIComponent(c)}">${S.esc(c)}</a>`).join('')}
      <a class="chip" href="explorer.html?vue=ecrits">${S.icon('feather')} Écrits courts</a>
      <a class="chip" href="bible.html">${S.icon('book')} La Bible</a>
    </nav>

    <section class="sec ac-sec" aria-labelledby="ecritsT">
      <div class="sec-head"><h2 class="sec-title" id="ecritsT">Écrits du jour</h2><a class="sec-link" href="explorer.html?vue=ecrits">Tous les écrits ${S.icon('right')}</a></div>
      <div class="ex-cats" role="group" aria-label="Quels écrits"><button class="chip chip--sm" type="button" data-fil="" aria-pressed="true">Tous</button><button class="chip chip--sm" type="button" data-fil="1" aria-pressed="false">Mes abonnements</button></div>
      <div class="vl-fil" id="fil" aria-busy="true"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement des écrits…</p></div>
    </section>

    <section class="vl-plume-carte vl-plume-carte--calme vl-velours" aria-labelledby="plumeT">
      <div class="vl-plume-t">
        <h2 id="plumeT">${S.PLUME_SVG.replace('cv-plume', 'vl-plume-g')}Écrire un mot</h2>
        <p>Une pensée, une prière, un poème : écrivez-le et partagez-le. C’est gratuit, toujours.</p>
      </div>
      <div class="vl-natures" role="list">${Object.entries(E.NATURES).map(([k, l]) => `<a role="listitem" class="vl-nature" href="ecrits.html?nouveau=${k}"><strong>${S.esc(l)}</strong><small>${S.esc(E.AIDE[k])}</small></a>`).join('')}
        <a role="listitem" class="vl-nature vl-nature--livre" href="studio.html?action=nouveau"><strong>Un livre</strong><small>Page après page</small></a></div>
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

  /* L'application installable : un bandeau discret, une fois refusé il se tait 30 jours */
  const bandeau = () => {
    let plusTard = 0; try { plusTard = +localStorage.getItem('sozo-installer-plus-tard') || 0; } catch (e) {}
    $('#bandeauInstaller').hidden = !(S.installer.possible() && Date.now() - plusTard > 30 * 864e5);
  };
  bandeau(); document.addEventListener('sozo:installable', bandeau);
  $('#instOui').addEventListener('click', async () => { await S.installer.lancer(); bandeau(); });
  $('#instNon').addEventListener('click', () => { try { localStorage.setItem('sozo-installer-plus-tard', String(Date.now())); } catch (e) {} $('#bandeauInstaller').hidden = true; });

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
  if ($('#fil')) chargerFil(false);
  S.brancherRangees(main);
  window.SOZO_API('GET', '/api/ecrits').then((r) => {
    const l = r.ok ? [...r.d.ecrits].sort((x, y) => (y.jaime || 0) - (x.jaime || 0)).slice(0, 10) : [];
    $('#moAimes').innerHTML = l.length ? l.map((e) => S.xpEcrit(e, E.NATURES)).join('') : `<div class="empty"><strong>Aucun écrit pour l’instant</strong>Le premier peut être le vôtre.</div>`;
  });
  window.SOZO_API('GET', '/api/bible/jour').then((r) => {
    const x = r.ok && r.d.verset; if (!x) return;
    const nom = S.bible ? S.bible.BOOKS[x.b - 1][0] : '';
    const z = $('#versetJour');
    z.innerHTML = `<span>« ${S.esc(x.t)} »</span> <a href="bible.html?b=${x.b}&c=${x.c}&v=${x.v}">${S.esc(nom)} ${x.c}:${x.v}</a>`;
    z.hidden = false;
  });
  $$('[data-fil]').forEach((c) => c.addEventListener('click', () => { $$('[data-fil]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); chargerFil(!!c.dataset.fil); }));
  if ($('#fil')) E.brancher($('#fil'), (id) => ecrits.find((e) => e.id === id));

  const px = $('#pasX');
  if (px) px.addEventListener('click', () => { try { localStorage.setItem('sozo-pas-ferme', auteur ? 'a' : 'l'); } catch (e) {} $('.ac-pas').remove(); });
  S.inkAll(); S.prepAll(); S.reveals(); S.tilt(main); S.footer();

  /* Arrivée après la création du compte : on accueille, on propose la visite */
  if (S.q('bienvenue')) {
    history.replaceState(null, '', 'decouvrir.html');
    S.modal({ title: `Bienvenue${prenom ? `, ${prenom}` : ''} !`, body: `<p>Sōzō est un lieu calme pour <strong>lire</strong> — des livres, des écrits courts, la Bible — et pour partager ce qui vous touche.</p>
      <ul class="bv-l bv-l--court"><li><span>${S.icon('grid')}</span><div><strong>Explorer</strong><small>Tous les livres et les écrits, par catégorie ou par recherche.</small></div></li>
      <li><span>${S.icon('library')}</span><div><strong>Bibliothèque</strong><small>Vos livres suivis, vos passages gardés, vos notifications.</small></div></li>
      <li><span>${S.icon('feather')}</span><div><strong>Écrire un mot</strong><small>Une pensée, une prière, un poème : gratuit, toujours. Et votre premier livre vous est offert.</small></div></li></ul>`,
      actions: [{ label: 'Plus tard' }, { label: 'Faire la visite (30 s)', primary: true, onClick: (close) => { close(); S.visite(); } }] });
  }
}).catch(window.SOZO_ERREUR);
