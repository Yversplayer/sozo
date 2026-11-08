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
  /* 03/11/2026 — L'ACCUEIL DE L'APPLICATION, refait sur les captures Netflix et
     Webtoon du propriétaire : « simple et épuré, l'accent directement sur les
     œuvres et l'écriture ».
     · en haut, la plume seule, mes téléchargements et la cloche (Netflix) ;
     · une œuvre à la belle couverture, en grand au milieu, avec « Aller lire »
       (la liseuse) et « S'abonner » (Webtoon) ;
     · le fond prend la couleur de cette couverture (Netflix), assombrie ;
     · des rangées de couvertures, et entre elles des MOTS : citations, pensées,
       prières, posées sans cadre, avec trois gestes — j'aime, commenter,
       partager — et leurs vrais nombres (« évite les cases »).
     Rien d'inventé à l'écran : les nombres sont ceux du serveur, un écrit d'un
     auteur inventé porte « Exemple », comme ses livres. */
  if (tel) {
    const photos = autres.filter((b) => (b.cover && b.cover.img) || b.image);
    const jour = Math.floor(Date.now() / 864e5);
    const une = photos.length ? photos[jour % photos.length] : aLaUne;
    const premiere = (b) => { const v = S.visiblePages(b).find((p) => S.readable(S.access(b, p.n))); return v ? v.n : null; };
    const allerLire = (b) => { const lu = D.reader.progress[b.id]; const vis = S.visiblePages(b); return vis.some((p) => p.n === lu) ? `lire.html?id=${encodeURIComponent(b.id)}&p=${lu}` : premiere(b) ? `lire.html?id=${encodeURIComponent(b.id)}&p=${premiere(b)}` : `livre.html?id=${encodeURIComponent(b.id)}`; };
    const abo = (b) => S.isFollowed(b.id);
    /* 08/11/2026 — l'accueil des maquettes Stitch du propriétaire : la plume
       et « Sōzō », la cloche et le profil ; Livres · Écrits · La Bible ; le
       LIVRE DU JOUR dans une carte teintée par sa couverture ; reprendre la
       lecture (barre de progression, page) ; la pensée du moment et le verset
       du jour en cartes ; les rangées de couvertures avec leur prix ; l'invitation
       à écrire. Rien d'inventé : chaque nombre vient du serveur. */
    const boutonAbo = (b) => `<button class="sx-btn sx-btn--contour" type="button" data-abo="${S.esc(b.id)}" aria-pressed="${abo(b)}">${S.icon(abo(b) ? 'check' : 'plus')}<span>${abo(b) ? 'Abonné(e)' : 'S’abonner'}</span></button>`;
    const prix = (b) => {
      if (b.access === 'free') return '<span class="sx-chip sx-chip--or">Gratuit</span>';
      const p = S.priceFrom(b);
      return p != null ? `<span class="sx-chip sx-chip--bord">${b.access === 'mixed' ? 'Dès ' : ''}${S.esc(S.money(p))}</span>` : `<span class="sx-chip">${S.esc(S.accessLabel(b))}</span>`;
    };
    const carteLivre = (b) => `<a class="sx-livre" href="livre.html?id=${encodeURIComponent(b.id)}">${S.cover(b, { d3: false })}<b>${S.esc(b.title)}</b><span>${S.esc(S.author(b.author).name)}</span>${prix(b)}</a>`;
    const rang = (titre, livres, lien) => livres.length ? `<section aria-label="${S.esc(titre)}">
      <div class="sx-h"><h2>${S.esc(titre)}</h2>${lien ? `<a href="${lien}">Voir tout</a>` : ''}</div>
      <div class="sx-rang" data-sans-glisse>${livres.map(carteLivre).join('')}</div>
    </section>` : '';
    const reprise = enCours.filter((b) => D.reader.progress[b.id]);
    const parCat = cats.map((c) => [c, autres.filter((b) => b.cat === c && b !== une)]).filter(([, l]) => l.length >= 2).slice(0, 3);
    const total = (b) => S.visiblePages(b).filter((p) => S.access(b, p.n) !== 'soon').length;
    const carteReprise = (b) => `<a class="sx-carte sx-reprise" href="${lienLecture(b)}">
        ${S.cover(b, { d3: false })}
        <span class="sx-reprise-t"><span class="sx-sur">En cours</span><b>${S.esc(b.title)}</b><small>${S.esc(S.author(b.author).name)}</small>
          <span class="sx-reprise-p"><span class="sx-prog" role="progressbar" aria-valuenow="${pctDe(b)}" aria-valuemin="0" aria-valuemax="100" aria-label="${S.esc(b.title)} : ${pctDe(b)} % lu"><i style="width:${pctDe(b)}%"></i></span><small>Page ${D.reader.progress[b.id]}${total(b) ? ` / ${total(b)}` : ''} · ${pctDe(b)} %</small></span></span>
        <span class="sx-reprise-go" aria-hidden="true">${S.icon('right')}</span>
      </a>`;
    main.innerHTML = `<div class="ap-dec sx-page">
      <div class="ap-fond" aria-hidden="true"></div>
      <header class="sx-barre" id="apBarre">
        <a class="ap-logo" href="decouvrir.html" aria-label="Sōzō — accueil">${S.PLUME_OR}<span class="ap-logo-t" aria-hidden="true">Sōzō</span></a>
        <span class="sx-barre-d">
          <a class="sx-ic" href="profil.html#telechargements" aria-label="Mes téléchargements">${S.icon('download')}</a>
          <a class="sx-ic" href="notifications.html" data-cloche aria-label="Notifications">${S.icon('bell')}</a>
          <a class="sx-ic" href="profil.html" aria-label="Mon profil"><span class="sx-av" aria-hidden="true">${S.esc(initiales)}</span></a>
        </span>
      </header>
      <div class="sx-ecran">
      <nav class="sx-pilules" aria-label="Que lire ?" data-sans-glisse><a class="sx-pilule is-on" href="explorer.html">${S.icon('book')}Livres</a><a class="sx-pilule" href="explorer.html?vue=ecrits">${S.icon('feather')}Écrits</a><a class="sx-pilule" href="bible.html">${S.icon('library')}La Bible</a></nav>
      ${une ? `<section class="sx-une" aria-labelledby="uneT">
        <span class="sx-sur sx-une-sur">${S.icon('star')} Livre du jour</span>
        <a class="sx-une-cv" href="livre.html?id=${encodeURIComponent(une.id)}" aria-label="${S.esc(une.title)} — la fiche du livre">${S.cover(une, { big: true, d3: false })}</a>
        <h1 class="sx-une-t" id="uneT">${S.esc(une.title)}</h1>
        <p class="sx-une-m">${S.esc(une.cat)} · ${S.esc(S.accessLabel(une))} · ${S.esc(S.author(une.author).name)}</p>
        <div class="sx-une-b"><a class="sx-btn sx-btn--plein" href="${allerLire(une)}">${S.icon('book')}<span>Aller lire</span></a>${boutonAbo(une)}</div>
      </section>` : `<section class="sx-une sx-carte--douce sx-vide"><strong>Les premiers livres arrivent</strong>En attendant, écrivez le vôtre.</section>`}
      <aside class="sx-carte sx-installer" id="bandeauInstaller" hidden>${S.PLUME_OR}<span>Installez Sōzō sur votre écran d’accueil, et lisez même sans réseau.</span>
        <span class="sx-installer-a"><button class="sx-btn sx-btn--plein sx-btn--petit" type="button" id="instOui">Installer</button><button class="sx-btn sx-btn--doux sx-btn--petit" type="button" id="instNon">Plus tard</button></span></aside>
      ${reprise.length ? `<section aria-label="Reprendre la lecture">
        <div class="sx-h"><h2>Reprendre la lecture</h2><a href="profil.html">Voir tout</a></div>
        <div class="sx-rang sx-rang--reprise" data-sans-glisse>${reprise.map(carteReprise).join('')}</div>
      </section>` : ''}
      <div id="apMot1"></div>
      ${rang('Nouveautés', nouveautes.filter((b) => b !== une), 'explorer.html')}
      <figure class="sx-carte sx-verset" id="versetJour" hidden></figure>
      <div id="apMot2"></div>
      ${rang('Pour vous', pourVous.filter((b) => b !== une).slice(0, 12), 'explorer.html')}
      ${parCat.map(([c, l], i) => `${rang(c, l, `explorer.html?cat=${encodeURIComponent(c)}`)}<div id="apMot${i + 3}"></div>`).join('')}
      <section class="sx-invite" aria-labelledby="inviteT">
        <span class="sx-sur">${S.icon('feather')} Inspiration &amp; partage</span>
        <h2 id="inviteT">Et vous, qu’avez-vous sur le cœur ?</h2>
        <p>Une pensée, une prière, un poème : quelques mots suffisent. C’est gratuit, toujours.</p>
        <a class="sx-btn sx-btn--or" href="ecrits.html?nouveau=pensee">${S.icon('feather')}<span>Écrire une pensée</span></a>
      </section>
      </div>
    </div>`;
    const dec = main.querySelector('.ap-dec');
    if (une) S.teinte(une).then((t) => S.poserTeinte(dec, t));
    const barre = $('#apBarre');
    const auDefil = () => barre.classList.toggle('is-defile', scrollY > 12);
    addEventListener('scroll', auDefil, { passive: true }); auDefil();

    main.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-abo]'); if (!b) return;
      b.disabled = true;
      const on = await S.toggleFollow(b.dataset.abo);
      b.disabled = false;
      b.outerHTML = boutonAbo(S.book(b.dataset.abo));
      S.toast(on ? 'Abonné(e) : ses nouvelles pages arriveront dans vos notifications.' : 'Vous n’êtes plus abonné(e) à ce livre.');
    });

    /* les mots : les plus aimés d'abord, courts seulement (une citation se lit d'un regard) */
    let mots = [];
    const sansMarques = (t) => String(t || '').split('\n').map((l) => l.replace(/^(#{1,2} |> |• )/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')).join('\n').trim();
    // typographie française : pas de « : » ni de « ? » orphelin en début de ligne
    const fr = (t) => t.replace(/ ([:;!?])/g, '\u202F$1');
    const mot = (e, i = 0) => {
      let t = sansMarques(e.texte), source = '';
      const m = /\n— ([^\n]+)$/.exec(t);
      if (m) { source = m[1]; t = t.slice(0, m.index).trim(); }
      const auteur = /^u\d+$/.test(e.auteur.id) ? `<a href="auteur.html?id=${encodeURIComponent(e.auteur.id)}">${S.esc(e.auteur.nom)}</a>` : S.esc(e.auteur.nom);
      const nature = (E.NATURES[e.nature] || 'Écrit');
      return `<figure class="sx-carte sx-mot" data-ecrit="${e.id}">
        <div class="sx-mot-tete">${S.monogramme(e.auteur.nom)}<div><b>${auteur}</b><small>${S.esc(nature)}${e.publie_le ? ` · ${S.esc(S.depuisJours(e.publie_le))}` : ''}${e.exemple ? ' · Exemple' : ''}</small></div></div>
        ${i === 0 ? `<span class="sx-sur">${S.icon('feather')} Pensée du moment</span>` : ''}
        <blockquote><p>« ${fr(S.esc(t)).replace(/\n/g, '<br>')} »</p></blockquote>
        ${source ? `<figcaption class="sx-mot-source">— ${S.esc(source)}</figcaption>` : ''}
        <footer class="sx-gestes">
          <button type="button" class="vl-geste" data-geste="jaime" aria-pressed="${e.moi.jaime}" aria-label="J’aime${e.jaime ? ` (${e.jaime})` : ''}">${S.icon('heart')}<span data-n>${e.jaime || ''}</span></button>
          <a class="vl-geste" href="ecrit.html?id=${e.id}#commentaires" aria-label="Commentaires${e.commentaires ? ` (${e.commentaires})` : ''}">${S.icon('bulle')}<span>${e.commentaires || ''}</span></a>
          <button type="button" class="vl-geste" data-geste="garde" aria-pressed="${e.moi.garde}" aria-label="${e.moi.garde ? 'Gardé dans ma bibliothèque' : 'Garder dans ma bibliothèque'}">${S.icon('garder')}<span class="vl-geste-l">${e.moi.garde ? 'Gardé' : 'Garder'}</span></button>
          <button type="button" class="vl-geste" data-geste="partager" aria-label="Partager">${S.icon('partager')}</button>
        </footer>
      </figure>`;
    };
    window.SOZO_API('GET', '/api/ecrits').then((r) => {
      if (!r.ok) return;
      mots = r.d.ecrits.filter((e) => !e.long && sansMarques(e.texte).length <= 280 && e.statut === 'publie')
        .sort((x, y) => (y.jaime || 0) - (x.jaime || 0) || (y.publie_le || '').localeCompare(x.publie_le || ''));
      // un mot du jour qui change chaque jour, puis les plus aimés
      if (mots.length > 1) mots.unshift(mots.splice(jour % mots.length, 1)[0]);
      mots.slice(0, 5).forEach((e, i) => { const z = $(`#apMot${i + 1}`); if (z) z.outerHTML = mot(e, i); });
    });
    E.brancher(main, (id) => mots.find((e) => e.id === id));
    window.SOZO_API('GET', '/api/bible/jour').then((r) => {
      const x = r.ok && r.d.verset; if (!x) return;
      const nom = S.bible ? S.bible.BOOKS[x.b - 1][0] : '';
      const z = $('#versetJour');
      z.innerHTML = `<span class="sx-sur">${S.icon('sun')} Verset du jour</span><blockquote><p>« ${fr(S.esc(x.t))} »</p></blockquote>
        <figcaption><b>${S.esc(nom)} ${x.c}:${x.v}</b><a class="sx-btn sx-btn--doux sx-btn--petit" href="bible.html?b=${x.b}&c=${x.c}&v=${x.v}">${S.icon('book')}Méditer</a></figcaption>`;
      z.hidden = false;
    });
    const bandeau = () => {
      let plusTard = 0; try { plusTard = +localStorage.getItem('sozo-installer-plus-tard') || 0; } catch (e) {}
      $('#bandeauInstaller').hidden = !(S.installer.possible() && Date.now() - plusTard > 30 * 864e5);
    };
    bandeau(); document.addEventListener('sozo:installable', bandeau);
    $('#instOui').addEventListener('click', async () => { await S.installer.lancer(); bandeau(); });
    $('#instNon').addEventListener('click', () => { try { localStorage.setItem('sozo-installer-plus-tard', String(Date.now())); } catch (e) {} $('#bandeauInstaller').hidden = true; });
    if (S.q('bienvenue')) {
      history.replaceState(null, '', 'decouvrir.html');
      S.modal({ title: `Bienvenue${prenom ? `, ${prenom}` : ''} !`, body: `<p>Sōzō est un lieu calme pour <strong>lire</strong> — des livres, des écrits courts, la Bible — et pour <strong>écrire</strong> ce qui vous touche.</p>
        <p class="ash">Glissez du doigt vers la gauche ou la droite pour passer d’un onglet à l’autre.</p>`,
        actions: [{ label: 'Commencer', primary: true }] });
    }
    return;
  }
  main.innerHTML = `<div class="wrap ac vl-ac">
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
