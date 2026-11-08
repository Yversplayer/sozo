/* Sōzō — fiche d'un livre : couverture, chiffres, lire / suivre, puis À propos, Sommaire, Prix, Similaires. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, D = S.D, $ = (s, c = document) => c.querySelector(s);
  S.shell('explorer');
  const main = $('#main');
  const b = S.book(S.q('id') || '');
  if (!b) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Ce livre n'existe pas</strong>Il a peut-être été retiré, ou le lien est incomplet.<br><br><a class="btn" href="decouvrir.html">Retour au catalogue</a></div></div>`;
    S.footer(); return;
  }
  document.title = `${b.title} — Sōzō`;
  const a = S.author(b.author), st = S.stats(b), owned = D.reader.purchases[b.id];
  const visible = S.visiblePages(b);
  const firstReadable = visible.find((p) => S.readable(S.access(b, p.n)));
  const prog = D.reader.progress[b.id];
  const opts = S.buy.options(b, null);
  const allOpt = opts.find((o) => o.k === 'all');

  const label = (n) => {
    const s = S.access(b, n), p = b.pages.find((x) => x.n === n);
    if (s === 'free') return ['Gratuite', 'free', `Publiée le ${S.dateShort(p.date)}`];
    if (s === 'owned') return ['Achetée', 'owned', `Achetée le ${S.dateShort(owned.date + 'T12:00')}`];
    if (s === 'locked') return [b.price.page != null ? S.money(b.price.page) : 'Payante', 'locked', b.price.page != null ? 'À l’unité, ou avec son chapitre' : 'Vendue avec son chapitre ou le livre'];
    if (s === 'soon') return ['À venir', 'soon', `Disponible le ${S.dateLong(p.date)}`];
    return null;
  };
  const strip = visible.map((p) => {
    const s = S.access(b, p.n), cls = { free: 'st-free', owned: 'st-owned', locked: 'st-locked', soon: 'st-soon' }[s];
    return s === 'soon' ? `<span class="${cls}" title="Page ${p.n} — disponible le ${S.dateLong(p.date)}">${p.n}</span>`
      : `<a class="${cls}" href="lire.html?id=${b.id}&p=${p.n}" title="Page ${p.n} — ${label(p.n)[0]}">${p.n}</a>`;
  }).join('');
  const groups = {};
  b.pages.filter((p) => S.access(b, p.n) === 'soon').forEach((p) => (groups[p.date] = groups[p.date] || []).push(p.n));
  const upcoming = Object.entries(groups).sort((x, y) => S.parse(x[0]) - S.parse(y[0]));
  const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  /* Fiche refaite le 19/10/2026 sur le modèle d'une liseuse mobile (demande du
     propriétaire) : couverture centrée, titre, auteur, trois chiffres, un gros
     bouton « Lire » et « + » pour suivre ; puis des onglets. Rien d'inventé :
     pas d'avis ni de notes, Sōzō n'en a pas. */
  const pagesLues = firstReadable ? `lire.html?id=${encodeURIComponent(b.id)}&p=${prog && visible.some((p) => p.n === prog) ? prog : firstReadable.n}` : `lire.html?id=${encodeURIComponent(b.id)}&p=${visible[0] ? visible[0].n : 1}`;
  const same = S.booksBy(a.id).filter((x) => x.id !== b.id);
  const voisins = same.length ? same : D.books.filter((x) => x.cat === b.cat && x.id !== b.id && x.author !== a.id);
  const ONGLETS = [['propos', 'À propos'], ['sommaire', 'Sommaire'], ['avis', 'Avis'], ...(b.price ? [['prix', 'Prix']] : []), ...(voisins.length ? [['similaires', same.length ? 'Du même auteur' : 'Similaires']] : [])];
  const derniere = Math.max(0, ...b.pages.filter((p) => S.status(p) === 'published' && p.date).map((p) => +S.parse(p.date)));
  /* 03/11/2026 — LA FICHE DE L'APPLICATION (captures Webtoon du propriétaire) :
     « enlève les rouges des pages au-dessus, laisse le livre flotter seul avec
     des ombres autour ; juste après la photo de l'œuvre, sa description et son
     auteur ; puis chap. 1, chap. 2, ligne par ligne comme un Webtoon, avec le
     nom que l'auteur a donné à ses chapitres ; un bouton i pour tous les
     détails, et trois points : partager, ajouter, télécharger ».
     L'ordinateur garde sa fiche de librairie. */
  const TEL = matchMedia('(max-width: 899px)').matches;
  const deux = (i) => String(i).padStart(2, '0');
  function ligneChapitre(c, i) {
    const ps = visible.filter((p) => p.n >= c.from && p.n <= c.to);
    if (!ps.length) return '';
    const lisible = ps.find((p) => S.readable(S.access(b, p.n)));
    const etats = ps.map((p) => S.access(b, p.n));
    const tousAVenir = etats.every((x) => x === 'soon');
    const fermes = etats.filter((x) => x === 'locked').length;
    const ici = prog && prog >= c.from && prog <= c.to;
    const lu = prog && prog > c.to;
    const plage = ps.length > 1 ? `Pages ${ps[0].n}–${ps[ps.length - 1].n}` : `Page ${ps[0].n}`;
    const lus = etats.filter((x) => S.readable(x)).length, aVenir = etats.filter((x) => x === 'soon');
    const suite = aVenir.length ? ps.find((p) => S.access(b, p.n) === 'soon') : null;
    const etat = tousAVenir ? `À venir le ${S.dateShort(ps[0].date)}` : fermes === ps.length ? `${S.icon('lock')} Payant${b.price && b.price.chapter != null ? ` · ${S.money(b.price.chapter)}` : ''}`
      : fermes ? `${lus} page${lus > 1 ? 's' : ''} offerte${lus > 1 ? 's' : ''}${lus ? '' : ` · ${S.icon('lock')} payant`}`
      : suite ? `${lus} parue${lus > 1 ? 's' : ''} · la suite le ${S.dateShort(suite.date)}` : etats.includes('owned') ? 'Acheté' : 'Gratuit';
    const nom = c.t && c.t.trim() ? c.t.trim() : `Chapitre ${i + 1}`;
    const cible = (lisible || ps.find((p) => S.access(b, p.n) !== 'soon') || {}).n;
    const dedans = `<span class="ap-chap-n" aria-hidden="true">${deux(i + 1)}</span>
      <span class="ap-chap-t"><strong>Chap. ${i + 1}<i aria-hidden="true">·</i>${S.esc(nom)}</strong><small>${plage} · ${etat}${ici ? ' · <em>vous en êtes là</em>' : ''}</small></span>`;
    return `<li class="ap-chap${lu ? ' is-lu' : ''}${ici ? ' is-ici' : ''}">${tousAVenir || !cible ? `<div class="ap-chap-a">${dedans}<span class="ap-chap-b ap-chap-b--soon">${S.icon('clock')}</span></div>`
      : `<a class="ap-chap-a" href="lire.html?id=${encodeURIComponent(b.id)}&p=${cible}">${dedans}<span class="ap-chap-b">${fermes === ps.length ? 'Voir' : 'Lire'}</span></a>`}</li>`;
  }
  function lignePage(p) {
    const [t, k] = label(p.n);
    const dedans = `<span class="ap-chap-n" aria-hidden="true">${deux(p.n)}</span><span class="ap-chap-t"><strong>Page ${p.n}</strong><small>${k === 'soon' ? `À venir le ${S.dateShort(p.date)}` : S.esc(t)}${prog === p.n ? ' · <em>vous en êtes là</em>' : ''}</small></span>`;
    return `<li class="ap-chap${prog && prog > p.n ? ' is-lu' : ''}${prog === p.n ? ' is-ici' : ''}">${k === 'soon' ? `<div class="ap-chap-a">${dedans}<span class="ap-chap-b ap-chap-b--soon">${S.icon('clock')}</span></div>`
      : `<a class="ap-chap-a" href="lire.html?id=${encodeURIComponent(b.id)}&p=${p.n}">${dedans}<span class="ap-chap-b">${k === 'locked' ? 'Voir' : 'Lire'}</span></a>`}</li>`;
  }
  const lignes = b.chapters.length ? b.chapters.map(ligneChapitre).filter(Boolean) : visible.map(lignePage);
  const chapIci = prog && b.chapters.findIndex((c) => prog >= c.from && prog <= c.to);
  const lireTexte = firstReadable ? (prog ? `Reprendre${chapIci >= 0 && b.chapters.length ? ` · chap. ${chapIci + 1}` : ''} · page ${prog}` : 'Commencer à lire') : 'Voir la première page';
  /* 08/11/2026 — la fiche des maquettes Stitch : la couverture sur la teinte
     du livre, le titre, l'auteur, la note des VRAIS avis (remplie quand ils
     arrivent), la présentation, « Commencer à lire », télécharger et
     s'abonner ; la carte « Livre intégral » quand il reste du payant ; les
     chapitres en lignes ; l'auteur ; du même auteur. */
  const prixLivre = allOpt && st.locked ? allOpt.price : null;
  const fiche = () => `<div class="ap-lv sx-page">
    <div class="ap-fond" aria-hidden="true"></div>
    <header class="sx-barre ap-lv-barre">
      <a class="sx-retour" href="decouvrir.html" data-retour aria-label="Retour">${S.icon('left')}</a>
      <span class="sx-barre-d">
        <button class="sx-ic" type="button" id="lvInfo" aria-haspopup="dialog" aria-label="Tout savoir sur ce livre">${S.icon('info')}</button>
        <span class="ap-menu-z">
          <button class="sx-ic" type="button" id="lvPlus" aria-haspopup="true" aria-expanded="false" aria-controls="lvMenu" aria-label="Plus d’options">${S.icon('dotsv')}</button>
          <span class="ap-menu" id="lvMenu" role="menu" hidden>
            <button role="menuitem" type="button" id="partagerLivre">${S.icon('partager')}<span>Partager</span></button>
            <button role="menuitem" type="button" id="lvAjouter"></button>
            <button role="menuitem" type="button" id="lvTele">${S.icon('download')}<span>Télécharger</span></button>
          </span>
        </span>
      </span>
    </header>
    <div class="sx-ecran">
    <section class="sx-lv-tete">
      <div class="ap-lv-cv">${S.cover(b, { big: true, d3: false })}</div>
      ${b.demo ? '<span class="sx-chip sx-chip--or">Exemple</span>' : `<span class="sx-sur">${S.esc(b.cat)}</span>`}
      <h1>${S.esc(b.title)}</h1>
      <a class="sx-lv-auteur" href="auteur.html?id=${encodeURIComponent(a.id)}" data-glisse-auteur>${S.esc(a.name)}${a.city ? ` · ${S.esc(a.city)}` : ''} ${S.icon('chevron')}</a>
      <p class="sx-lv-m">${S.esc(S.accessLabel(b))} · ${b.chapters.length ? `${b.chapters.length} chapitre${b.chapters.length > 1 ? 's' : ''} · ` : ''}${st.published} page${st.published > 1 ? 's' : ''}<span id="lvNote"></span></p>
      ${b.desc ? `<p class="ap-lv-desc" id="lvDesc">${S.esc(b.desc)}</p>` : ''}
      <a class="sx-btn sx-btn--plein sx-btn--bloc" href="${pagesLues}">${S.icon('book')}<span>${S.esc(lireTexte)}</span></a>
      <div class="sx-lv-b">
        <button class="sx-btn sx-btn--contour" type="button" id="lvTele2">${S.icon('download')}<span>Sans réseau</span></button>
        <button class="sx-btn sx-btn--contour" type="button" id="lvAbo" aria-pressed="false"></button>
      </div>
      <p class="ap-lv-etat sx-chapeau" id="lvEtat" role="status" hidden></p>
    </section>
    ${prixLivre != null ? `<section class="sx-carte sx-integral" aria-labelledby="integralT">
      <span class="sx-sur">${S.icon('book')} Livre intégral</span>
      <div class="sx-integral-l"><div><h2 id="integralT">Débloquer tout le livre</h2><p>Toutes les pages payantes, d’un coup${owned ? ', en plus de celles que vous avez déjà' : ''}.</p></div><b>${S.money(prixLivre)}</b></div>
      <p class="sx-integral-n">${S.icon('shield')} Paiement par Mobile Money, confirmé par Sōzō.</p>
      <button class="sx-btn sx-btn--or sx-btn--bloc" type="button" id="buyAllCarte">Acheter le livre entier</button>
    </section>` : ''}
    ${st.next ? `<p class="sx-carte sx-carte--douce sx-suite">${S.icon('calendar')}<span>La suite paraît le <b>${S.esc(S.dateLong(st.next.date))}</b>. Abonnez-vous pour être prévenu.</span></p>` : ''}
    <section class="ap-chaps" aria-labelledby="chapsT">
      <div class="sx-h"><h2 id="chapsT">${b.chapters.length ? `Chapitres (${lignes.length})` : `Pages (${lignes.length})`}</h2>
        ${lignes.length > 2 ? `<button class="ap-trier" type="button" id="lvTrier" aria-pressed="false">${S.icon('trier')}<span>Du début</span></button>` : ''}</div>
      ${lignes.length ? `<ol class="ap-chaps-l" id="lvChaps">${lignes.join('')}</ol>` : '<p class="sx-chapeau">L’auteur n’a encore rien publié.</p>'}
      ${st.draft ? `<p class="sx-chapeau">L’auteur prépare d’autres pages : elles apparaîtront une fois programmées.</p>` : ''}
    </section>
    <a class="sx-carte sx-auteur-c" href="auteur.html?id=${encodeURIComponent(a.id)}">
      ${S.monogramme(a.name, 52)}<span class="sx-auteur-t"><span class="sx-sur">L’auteur</span><b>${S.esc(a.name)}</b>${a.city ? `<small>${S.esc(a.city)}</small>` : ''}</span>${S.icon('chevron')}
      ${a.bio ? `<p>${S.esc(a.bio)}</p>` : ''}
    </a>
    ${voisins.length ? `<section aria-label="${same.length ? 'Du même auteur' : 'Dans la même veine'}">
      <div class="sx-h"><h2>${same.length ? 'Du même auteur' : 'Dans la même veine'}</h2></div>
      <div class="sx-rang" data-sans-glisse>${voisins.slice(0, 10).map((x) => `<a class="sx-livre" href="livre.html?id=${encodeURIComponent(x.id)}">${S.cover(x, { d3: false })}<b>${S.esc(x.title)}</b><span>${S.esc(S.author(x.author).name)}</span></a>`).join('')}</div>
    </section>` : ''}
    </div>
    <dialog class="ap-feuille" id="lvFiche" aria-labelledby="ficheT">
      <div class="ap-feuille-in">
        <header class="ap-feuille-h"><h2 id="ficheT">${S.esc(b.title)}</h2><button class="ap-ic" type="button" id="lvFicheX" aria-label="Fermer">${S.icon('x')}</button></header>
        <h3>Présentation</h3>
        <p>${S.esc(b.desc) || '<span class="ash">L’auteur n’a pas encore écrit de présentation.</span>'}</p>
        ${b.demo ? '<p class="ash">Livre d’exemple : auteur et texte inventés pour montrer Sōzō. Il ne se vend pas.</p>' : ''}
        <h3>Détails</h3>
        <dl class="ap-details">
          <div><dt>Catégorie</dt><dd>${S.esc(b.cat)}</dd></div>
          <div><dt>Pages publiées</dt><dd>${st.published}</dd></div>
          ${st.scheduled ? `<div><dt>Pages à venir</dt><dd>${st.scheduled}</dd></div>` : ''}
          <div><dt>Parution</dt><dd>${b.mode === 'progressive' ? 'Page après page' : 'Publié en entier'}</dd></div>
          ${derniere ? `<div><dt>Dernière page</dt><dd>${S.esc(S.dayLong(new Date(derniere)))}</dd></div>` : ''}
          <div><dt>Accès</dt><dd>${b.access === 'free' ? 'Gratuit, en entier' : b.access === 'paid' ? 'Payant' : `${st.free} page${st.free > 1 ? 's' : ''} offerte${st.free > 1 ? 's' : ''}, le reste payant`}</dd></div>
          <div><dt>Langue</dt><dd>Français</dd></div>
        </dl>
        ${upcoming.length ? `<h3>Prochaines parutions</h3><ul class="ap-parutions">${upcoming.slice(0, 5).map(([d, ns]) => `<li><strong>${S.esc(S.dateLong(d))}</strong><span>${S.esc(S.pagesRange(ns).replace(/^p/, 'P'))}</span></li>`).join('')}</ul>` : ''}
        ${b.price ? `<h3>Prix</h3><dl class="ap-details">
          ${b.price.page != null ? `<div><dt>Une page</dt><dd>${S.money(b.price.page)}</dd></div>` : ''}
          ${b.price.chapter != null ? `<div><dt>Un chapitre</dt><dd>${S.money(b.price.chapter)}</dd></div>` : ''}
          ${b.price.all != null ? `<div><dt>Tout le contenu payant</dt><dd>${S.money(b.price.all)}</dd></div>` : ''}</dl>
          ${owned ? `<p class="ash">Vous possédez ${S.esc(S.pagesRange(owned.pages))}.</p>` : ''}
          ${allOpt && st.locked ? `<button class="ap-b ap-b--voile" type="button" id="buyAll">Tout le contenu payant — ${S.money(allOpt.price)}</button>` : ''}` : ''}
        <h3>L’auteur</h3>
        <a class="ap-auteur" href="auteur.html?id=${encodeURIComponent(a.id)}">${S.monogramme(a.name, 44)}<span><strong>${S.esc(a.name)}</strong>${a.city ? `<small>${S.esc(a.city)}</small>` : ''}</span></a>
        ${a.bio ? `<p>${S.esc(a.bio)}</p>` : ''}
        <h3>Avis</h3>
        <div id="avisZone" aria-busy="true"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
        ${b.owner ? '' : `<button class="ap-lien ap-lien--doux" type="button" id="signalerLivre">${S.icon('shield')} Signaler ce livre</button>`}
      </div>
    </dialog>
  </div>`;
  // 22/10/2026 : sur ordinateur, la fiche s'ouvre comme celle d'une librairie en ligne
  // (image « Harry Potter » du propriétaire) : la couverture à gauche, le reste à droite.
  main.innerHTML = TEL ? fiche() : `<div class="lv lv--web">
    <header class="lv-tete" style="--lv-photo:url('${S.esc(S.img(b.cover.img))}')">
      <div class="lv-cv">${S.cover(b, { big: true, d3: false })}</div>
      <h1 class="lv-titre">${S.esc(b.title)}</h1>
      <a class="lv-auteur" href="auteur.html?id=${encodeURIComponent(a.id)}">par ${S.esc(a.name)}</a>
      ${b.desc ? `<p class="lv-accroche">${S.esc(b.desc.length > 260 ? b.desc.slice(0, 260).replace(/\s+\S*$/, '') + '…' : b.desc)}</p>` : ''}
      <div class="lv-pastilles"><span class="badge badge--${b.access}">${S.accessLabel(b)}</span><span class="badge badge--free">${S.esc(b.cat)}</span>${b.demo ? '<span class="badge badge--exemple">Exemple</span>' : ''}</div>
      <dl class="lv-chiffres">
        <div>${S.icon('book')}<dt>Pages</dt><dd>${st.published}</dd></div>
        <div>${S.icon('file')}<dt>Chapitres</dt><dd>${b.chapters.length || '—'}</dd></div>
        <div>${S.icon(st.next ? 'clock' : 'check')}<dt>${st.next ? 'Prochaine page' : 'Parution'}</dt><dd>${st.next ? S.esc(S.dateShort(st.next.date)) : b.mode === 'progressive' ? 'à jour' : 'complet'}</dd></div>
      </dl>
      <div class="lv-actions">
        <a class="btn btn--accent lv-lire" href="${pagesLues}">${S.icon('book')} <span class="lv-lire-l">${firstReadable ? (prog ? `Reprendre « ${S.esc(b.title)} », page ${prog}` : `Lire « ${S.esc(b.title)} »`) : 'Voir la première page'}</span><span class="lv-lire-c">${firstReadable ? (prog ? `Reprendre · page ${prog}` : 'Commencer la lecture') : 'Première page'}</span></a>
        <button class="btn lv-plus" type="button" id="follow"></button>
        <button class="btn btn--ghost lv-plus" type="button" id="partagerLivre" aria-label="Partager ce livre" title="Partager">${S.icon('partager')}</button>
      </div>
      ${allOpt && st.locked ? `<button class="ec-lien lv-tout" type="button" id="buyAll">Tout le contenu payant — ${S.money(allOpt.price)}</button>` : ''}
    </header>
    <nav class="lv-onglets" role="tablist" aria-label="À propos du livre">${ONGLETS.map(([k, l], i) => `<button type="button" role="tab" id="lo-${k}" aria-controls="lp-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-lo="${k}">${l}</button>`).join('')}</nav>

    <section class="lv-panneau" id="lp-propos" role="tabpanel" aria-labelledby="lo-propos">
      <h2>Présentation</h2>
      <p class="lv-desc">${S.esc(b.desc) || '<span class="ash">L’auteur n’a pas encore écrit de présentation.</span>'}</p>
      ${b.demo ? '<p class="note">Livre d’exemple : auteur et texte inventés pour montrer Sōzō. Il ne se vend pas.</p>' : ''}
      <h2>Détails</h2>
      <dl class="lv-details">
        <div><dt>Pages publiées</dt><dd>${st.published}</dd></div>
        ${st.scheduled ? `<div><dt>Pages à venir</dt><dd>${st.scheduled}</dd></div>` : ''}
        <div><dt>Parution</dt><dd>${b.mode === 'progressive' ? 'Page après page' : 'Publié en entier'}</dd></div>
        ${derniere ? `<div><dt>Dernière page</dt><dd>${S.esc(S.dayLong(new Date(derniere)))}</dd></div>` : ''}
        <div><dt>Accès</dt><dd>${b.access === 'free' ? 'Gratuit, en entier' : b.access === 'paid' ? 'Payant' : `${st.free} page${st.free > 1 ? 's' : ''} offerte${st.free > 1 ? 's' : ''}, le reste payant`}</dd></div>
        <div><dt>Langue</dt><dd>Français</dd></div>
      </dl>
      <div class="lv-tags"><span class="chip">${S.esc(b.cat)}</span>${b.verse ? '<span class="chip">Vers</span>' : ''}${b.mode === 'progressive' ? '<span class="chip">En cours</span>' : ''}</div>
      ${upcoming.length ? `<h2>Prochaines parutions</h2><div class="cal">${upcoming.slice(0, 5).map(([d, ns]) => {
        const dt = S.parse(d);
        return `<div class="cal-row"><div class="cal-day"><b>${dt.getDate()}</b><span>${MO[dt.getMonth()]}</span></div><div>${S.esc(S.pagesRange(ns).replace(/^p/, 'P'))}<small>à ${dt.getHours()} h — contenu invisible jusque-là</small></div></div>`;
      }).join('')}</div>` : ''}
      <h2>L’auteur</h2>
      <a class="author-card lv-carte" href="auteur.html?id=${encodeURIComponent(a.id)}">${S.monogramme(a.name, 48)}<div><strong>${S.esc(a.name)}</strong>${a.city ? `<span class="ash"> · ${S.esc(a.city)}</span>` : ''}<p>${S.esc(a.bio)}</p></div></a>
      ${b.owner ? '' : `<button class="ec-lien vl-signaler" type="button" id="signalerLivre">${S.icon('shield')} Signaler ce livre</button>`}
    </section>

    <section class="lv-panneau" id="lp-sommaire" role="tabpanel" aria-labelledby="lo-sommaire" hidden>
      <div class="strip" aria-label="État des pages">${strip}</div>
      <div class="legend"><span><i class="st-free"></i>Gratuite</span><span><i class="st-owned"></i>Achetée</span><span><i class="st-locked"></i>Payante</span><span><i class="st-soon"></i>À venir</span></div>
      ${b.chapters.map((c, i) => {
        const ps = visible.filter((p) => p.n >= c.from && p.n <= c.to);
        if (!ps.length) return '';
        return `<details class="chap"${i === 0 || ps.some((p) => p.n === prog) ? ' open' : ''}>
          <summary><span><strong>${S.esc(c.t)}</strong> <span class="ash">· ${S.pagesRange(ps.map((p) => p.n))}</span></span>${S.icon('chevron')}</summary>
          <div class="pl">${ps.map((p) => {
            const [t, k, sub] = label(p.n);
            const inner = `<span class="mono">Page ${p.n}</span><span>${S.esc(sub)}</span><span class="badge badge--${k}">${k === 'locked' ? S.icon('lock') : k === 'owned' ? S.icon('check') : k === 'soon' ? S.icon('clock') : ''}${S.esc(t)}</span>`;
            return k === 'soon' ? `<div class="pl-row">${inner}</div>` : `<a class="pl-row" href="lire.html?id=${encodeURIComponent(b.id)}&p=${p.n}">${inner}</a>`;
          }).join('')}</div></details>`;
      }).join('') || `<div class="pl">${visible.map((p) => { const [t, k, sub] = label(p.n); return `<a class="pl-row" href="lire.html?id=${encodeURIComponent(b.id)}&p=${p.n}"><span class="mono">Page ${p.n}</span><span>${S.esc(sub)}</span><span class="badge badge--${k}">${S.esc(t)}</span></a>`; }).join('')}</div>`}
      ${st.draft ? `<p class="note">${S.icon('eyeOff')} L'auteur prépare d'autres pages : elles n'apparaîtront qu'une fois programmées.</p>` : ''}
    </section>

    <section class="lv-panneau" id="lp-avis" role="tabpanel" aria-labelledby="lo-avis" hidden>
      <div id="avisZone" aria-busy="true"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
    </section>

    ${b.price ? `<section class="lv-panneau" id="lp-prix" role="tabpanel" aria-labelledby="lo-prix" hidden>
      <div class="price-box">
        ${b.price.page != null ? `<div class="price-opt"><span>Une page<br><small>à l'unité</small></span><strong>${S.money(b.price.page)}</strong></div>` : ''}
        ${b.price.chapter != null ? `<div class="price-opt"><span>Un chapitre<br><small>pages à venir comprises</small></span><strong>${S.money(b.price.chapter)}</strong></div>` : ''}
        ${b.price.all != null ? `<div class="price-opt"><span>Tout le contenu payant<br><small>${allOpt ? S.esc(allOpt.detail) : ''}</small></span><strong>${S.money(b.price.all)}</strong></div>` : ''}
      </div>
      ${owned ? `<p class="note">${S.icon('check')} Vous possédez ${S.esc(S.pagesRange(owned.pages))}.</p>` : ''}
      <p class="note">${S.icon('tag')} Le prix s'affiche toujours avant l'achat. Ce que vous payez reste à vous.</p>
    </section>` : ''}

    ${voisins.length ? `<section class="lv-panneau" id="lp-similaires" role="tabpanel" aria-labelledby="lo-similaires" hidden>
      <div class="grid">${voisins.slice(0, 8).map((x) => S.bookCard(x)).join('')}</div>
    </section>` : ''}
  </div>`;

  const ongl = [...document.querySelectorAll('[data-lo]')];
  const montrer = (k) => {
    ongl.forEach((t) => { const on = t.dataset.lo === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; document.getElementById('lp-' + t.dataset.lo).hidden = !on; });
  };
  ongl.forEach((t, i) => {
    t.addEventListener('click', () => montrer(t.dataset.lo));
    t.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); const x = ongl[(i + d + ongl.length) % ongl.length]; montrer(x.dataset.lo); x.focus(); });
  });

  const fb = $('#follow');
  const syncF = () => {
    if (!fb) return;
    const on = S.isFollowed(b.id);
    fb.innerHTML = S.icon(on ? 'check' : 'plus');
    fb.setAttribute('aria-pressed', String(on));
    fb.setAttribute('aria-label', on ? 'Vous suivez ce livre (ne plus suivre)' : 'Suivre ce livre');
    fb.title = on ? 'Suivi' : 'Suivre ce livre';
  };
  if (fb) fb.addEventListener('click', async () => {
    fb.disabled = true;
    const on = await S.toggleFollow(b.id); fb.disabled = false; syncF();
    S.toast(on ? 'Livre suivi — ses nouvelles pages apparaîtront dans vos notifications.' : 'Vous ne suivez plus ce livre.');
  });
  syncF();
  if (TEL) brancherFiche();
  const ba = $('#buyAll');
  if (ba) ba.addEventListener('click', () => S.buy.recap(b, allOpt));

  /* Lot C : partager un livre (le lien ; la page reste derrière la connexion) */
  const pl = document.getElementById('partagerLivre');
  if (pl) pl.addEventListener('click', async () => {
    const url = new URL(`livre.html?id=${encodeURIComponent(b.id)}`, location.href).href;
    if (navigator.share) { try { await navigator.share({ title: `${b.title} — Sōzō`, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); S.toast('Lien copié : collez-le où vous voulez le partager.'); }
    catch (er) { S.modal({ title: 'Partager', body: `<p>Copiez ce lien :</p><p><input class="vl-lien" readonly value="${S.esc(url)}" aria-label="Lien du livre"></p>`, actions: [{ label: 'Fermer', primary: true }] }); }
  });
  /* 21/10/2026 : signaler un livre (le serveur était prêt, l'écran n'avait pas de bouton) */
  const sigL = document.getElementById('signalerLivre');
  if (sigL) sigL.addEventListener('click', () => {
    const m = S.modal({ title: 'Signaler ce livre', body: `<p>Dites en quelques mots ce qui ne va pas. L’équipe de modération de Sōzō lit chaque signalement.</p>
      <label class="cx-field">Motif<textarea id="sigMotif" rows="3" maxlength="1000"></textarea></label><p class="cx-err" id="sigErr" role="alert"></p>`,
      actions: [{ label: 'Annuler' }, { label: 'Envoyer le signalement', primary: true, onClick: async (close) => {
        const motif = m.el.querySelector('#sigMotif').value.trim();
        if (motif.length < 5) { m.el.querySelector('#sigErr').textContent = 'Quelques mots, au moins cinq lettres.'; return; }
        const r = await window.SOZO_API('POST', '/api/signalements', { livre: b.id, motif });
        if (!r.ok) { m.el.querySelector('#sigErr').textContent = r.d.erreur || 'Le signalement n’est pas parti.'; return; }
        close(); S.toast('Merci : le signalement a été transmis à la modération.');
      } }] });
    setTimeout(() => m.el.querySelector('#sigMotif').focus(), 50);
  });
  /* Avis (21/10/2026) : une note de 1 à 5 et quelques lignes. Le serveur
     décide qui peut noter (une page lue, pas son livre, la charte) ; l'écran
     n'affiche que ce qu'il renvoie — jamais un avis ni une moyenne inventés. */
  const etoiles = (n) => `<span class="av-etoiles" aria-label="${n} sur 5">${'★'.repeat(n)}<span aria-hidden="true" class="av-vide">${'★'.repeat(5 - n)}</span></span>`;
  async function avis() {
    const z = $('#avisZone');
    const r = await window.SOZO_API('GET', `/api/livres/${encodeURIComponent(b.id)}/avis`);
    z.removeAttribute('aria-busy');
    if (!r.ok) { z.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Les avis n’ont pas pu se charger.')}</span></p>`; return; }
    const d = r.d, res = d.resume, mien = d.mien;
    const ln = $('#lvNote');
    if (ln && res.nombre) ln.innerHTML = ` · <span class="sx-note">★ ${String(res.moyenne).replace('.', ',')}</span> (${res.nombre} avis)`;
    z.innerHTML = `
      <div class="av-resume">${res.nombre ? `<strong>${String(res.moyenne).replace('.', ',')}</strong>${etoiles(Math.round(res.moyenne))}<span class="ash">${res.nombre} avis</span>` : '<span class="ash">Aucun avis pour l’instant.</span>'}</div>
      ${mien && mien.retire_le ? '<p class="note">Votre avis a été retiré par la modération.</p>' : d.peut ? `<form class="av-form" id="avisForm">
        <fieldset class="av-choix"><legend>${mien ? 'Votre avis' : 'Donner votre avis'}</legend>
          ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="note" value="${n}"${mien && mien.note === n ? ' checked' : ''}><span aria-hidden="true">★</span><span class="sr-only">${n} sur 5</span></label>`).join('')}
        </fieldset>
        <label class="cx-field">Quelques mots <small>facultatif</small><textarea name="texte" rows="3" maxlength="1000">${mien ? S.esc(mien.texte) : ''}</textarea></label>
        <p class="cx-err" id="avisErr" role="alert"></p>
        <div class="av-acts"><button class="btn btn--accent" type="submit">${mien ? 'Mettre à jour' : 'Publier mon avis'}</button>${mien ? '<button class="btn btn--ghost" type="button" id="avisRetirer">Retirer mon avis</button>' : ''}</div>
      </form>` : b.owner ? '' : '<p class="note">Lisez au moins une page de ce livre pour donner votre avis.</p>'}
      <ul class="av-liste">${d.avis.map((a) => `<li><p class="av-tete"><a href="auteur.html?id=${encodeURIComponent(a.auteur.id)}">${S.esc(a.auteur.nom)}</a> ${etoiles(a.note)} <span class="ash">${S.esc(S.dateShort(a.le))}</span></p>${a.texte ? `<p>${S.esc(a.texte)}</p>` : ''}</li>`).join('')}</ul>`;
    const f = $('#avisForm');
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = +((f.elements.note && f.elements.note.value) || 0);
      if (!note) { $('#avisErr').textContent = 'Choisissez une note de 1 à 5 étoiles.'; return; }
      const bt = f.querySelector('[type=submit]'); bt.disabled = true;
      const y = await window.SOZO_API('PUT', `/api/livres/${encodeURIComponent(b.id)}/avis`, { note, texte: f.elements.texte.value });
      bt.disabled = false;
      if (!y.ok) { $('#avisErr').textContent = y.d.erreur || 'Votre avis n’a pas été enregistré.'; return; }
      S.toast('Merci : votre avis est publié.'); avis();
    });
    const rt = $('#avisRetirer');
    if (rt) rt.addEventListener('click', async () => {
      rt.disabled = true;
      const y = await window.SOZO_API('DELETE', `/api/livres/${encodeURIComponent(b.id)}/avis`);
      if (!y.ok) { rt.disabled = false; S.toast(y.d.erreur || 'Le retrait a échoué.'); return; }
      S.toast('Votre avis est retiré.'); avis();
    });
  }
  /* la fiche de l'application : retour, i, trois points, tri des chapitres */
  function brancherFiche() {
    const z = main.querySelector('.ap-lv');
    S.teinte(b).then((t) => S.poserTeinte(z, t));
    const abo = $('#lvAbo');
    const syncAbo = () => { const on = S.isFollowed(b.id); abo.setAttribute('aria-pressed', String(on)); abo.innerHTML = `${S.icon(on ? 'check' : 'plus')}<span>${on ? 'Abonné(e)' : 'S’abonner'}</span>`; };
    syncAbo();
    abo.addEventListener('click', async () => {
      abo.disabled = true; const on = await S.toggleFollow(b.id); abo.disabled = false; syncAbo(); syncAj();
      S.toast(on ? 'Abonné(e) : ses nouvelles pages arriveront dans vos notifications.' : 'Retiré de vos abonnements.');
    });
    const bac = $('#buyAllCarte'); if (bac) bac.addEventListener('click', () => S.buy.recap(b, allOpt));
    const dlg = $('#lvFiche');
    const ouvrirFiche = () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); };
    $('#lvInfo').addEventListener('click', ouvrirFiche);
    $('#lvFicheX').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    const d = $('#lvDesc');
    if (d) d.addEventListener('click', () => d.classList.toggle('is-ouvert'));
    // trois points : Partager, Ajouter (s'abonner), Télécharger
    const plus = $('#lvPlus'), menu = $('#lvMenu'), aj = $('#lvAjouter');
    const ferme = () => { menu.hidden = true; plus.setAttribute('aria-expanded', 'false'); };
    plus.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; plus.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) menu.querySelector('button').focus(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.ap-menu-z')) ferme(); });
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { ferme(); plus.focus(); } });
    menu.addEventListener('click', (e) => { if (e.target.closest('[role=menuitem]')) ferme(); });
    function syncAj() { const on = S.isFollowed(b.id); aj.innerHTML = `${S.icon(on ? 'check' : 'plus')}<span>${on ? 'Abonné(e) — se désabonner' : 'Ajouter à mes abonnements'}</span>`; }
    syncAj();
    aj.addEventListener('click', async () => {
      const on = await S.toggleFollow(b.id); syncAj(); syncAbo();
      S.toast(on ? 'Ajouté à vos abonnements : ses nouvelles pages arriveront dans vos notifications.' : 'Retiré de vos abonnements.');
    });
    const etat = $('#lvEtat');
    const dire = (t) => { etat.textContent = t; etat.hidden = !t; };
    const H = window.SOZO_HORS;
    if (H) H.estTelecharge(b.id).then((oui) => { if (oui) dire('Disponible sans réseau sur cet appareil.'); });
    $('#lvTele2').addEventListener('click', () => $('#lvTele').click());
    $('#lvTele').addEventListener('click', async () => {
      if (!H) return;
      dire('Téléchargement…');
      const r = await H.telecharger(b, (n, t) => dire(`Téléchargement… ${n} page${n > 1 ? 's' : ''} sur ${t}`));
      if (!r.ok) { dire(r.erreur); return; }
      dire(`Disponible sans réseau : ${r.faites} page${r.faites > 1 ? 's' : ''}${r.faites < r.total ? ` sur ${r.total}` : ''}.${r.payantes ? ` ${r.payantes} page${r.payantes > 1 ? 's' : ''} payante${r.payantes > 1 ? 's' : ''} non achetée${r.payantes > 1 ? 's' : ''} reste${r.payantes > 1 ? 'nt' : ''} en ligne.` : ''}`);
    });
    const tri = $('#lvTrier'), liste = $('#lvChaps');
    if (tri) tri.addEventListener('click', () => {
      const inverse = tri.getAttribute('aria-pressed') !== 'true';
      [...liste.children].reverse().forEach((li) => liste.appendChild(li));
      tri.setAttribute('aria-pressed', String(inverse));
      tri.querySelector('span').textContent = inverse ? 'Les derniers' : 'Du début';
    });
    if (location.hash === '#avis') ouvrirFiche();
  }
  avis();
  if (location.hash === '#avis' && !TEL) montrer('avis');

  S.reveals(); S.footer();
}).catch(window.SOZO_ERREUR);
