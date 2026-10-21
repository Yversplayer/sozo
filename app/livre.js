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
  const ONGLETS = [['propos', 'À propos'], ['sommaire', 'Sommaire'], ...(b.price ? [['prix', 'Prix']] : []), ...(voisins.length ? [['similaires', same.length ? 'Du même auteur' : 'Similaires']] : [])];
  const derniere = Math.max(0, ...b.pages.filter((p) => S.status(p) === 'published' && p.date).map((p) => +S.parse(p.date)));
  main.innerHTML = `<div class="lv">
    <header class="lv-tete">
      <div class="lv-cv">${S.cover(b, { big: true, d3: false })}</div>
      <h1 class="lv-titre">${S.esc(b.title)}</h1>
      <a class="lv-auteur" href="auteur.html?id=${encodeURIComponent(a.id)}">par ${S.esc(a.name)}</a>
      <div class="lv-pastilles"><span class="badge badge--${b.access}">${S.accessLabel(b)}</span><span class="badge badge--free">${S.esc(b.cat)}</span>${b.demo ? '<span class="badge badge--exemple">Exemple</span>' : ''}</div>
      <dl class="lv-chiffres">
        <div>${S.icon('book')}<dt>Pages</dt><dd>${st.published}</dd></div>
        <div>${S.icon('file')}<dt>Chapitres</dt><dd>${b.chapters.length || '—'}</dd></div>
        <div>${S.icon(st.next ? 'clock' : 'check')}<dt>${st.next ? 'Prochaine page' : 'Parution'}</dt><dd>${st.next ? S.esc(S.dateShort(st.next.date)) : b.mode === 'progressive' ? 'à jour' : 'complet'}</dd></div>
      </dl>
      <div class="lv-actions">
        <a class="btn btn--accent lv-lire" href="${pagesLues}">${firstReadable ? (prog ? `Reprendre page ${prog}` : 'Commencer à lire') : 'Voir la première page'}</a>
        <button class="btn lv-plus" type="button" id="follow"></button>
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
    const on = S.isFollowed(b.id);
    fb.innerHTML = S.icon(on ? 'check' : 'plus');
    fb.setAttribute('aria-pressed', String(on));
    fb.setAttribute('aria-label', on ? 'Vous suivez ce livre (ne plus suivre)' : 'Suivre ce livre');
    fb.title = on ? 'Suivi' : 'Suivre ce livre';
  };
  fb.addEventListener('click', async () => {
    fb.disabled = true;
    const on = await S.toggleFollow(b.id); fb.disabled = false; syncF();
    S.toast(on ? 'Livre suivi — ses nouvelles pages apparaîtront dans vos notifications.' : 'Vous ne suivez plus ce livre.');
  });
  syncF();
  const ba = $('#buyAll');
  if (ba) ba.addEventListener('click', () => S.buy.recap(b, allOpt));

  /* 22/10/2026 : signaler un livre (le serveur était prêt, l'écran n'avait pas de bouton) */
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
  S.reveals(); S.footer();
}).catch(window.SOZO_ERREUR);
