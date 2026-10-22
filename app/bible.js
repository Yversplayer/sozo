/* Sōzō — la Bible intégrée : livres, chapitres, versets ; aller à une référence. */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, B = S.bible, $ = (s, c = document) => c.querySelector(s);
  S.shell('bible');
  const main = $('#main');
  const q = new URLSearchParams(location.search);
  let b = Math.min(66, Math.max(1, +q.get('b') || 23)), c = Math.max(1, +q.get('c') || 26);
  let [v1, v2] = (q.get('v') || (q.get('b') ? '' : '4')).split('-').map((x) => +x || null);
  if (v1 && !v2) v2 = v1;
  let index = null;

  main.innerHTML = `<div class="wrap bb">
    <aside class="bb-side" aria-label="Livres de la Bible">
      <label class="search search--sm"><span class="sr">Filtrer les livres</span>${S.icon('search')}<input type="search" id="bf" placeholder="Filtrer les livres…" autocomplete="off"></label>
      <div class="bb-books" id="books"></div>
    </aside>
    <section class="bb-main">
      <div class="bb-top">
        <div><p class="kicker">La Bible · Louis Segond 1910</p><h1 id="bTitle"></h1></div>
        <button class="btn btn--accent btn--sm bb-lire-btn" type="button" id="lireSeul">${S.icon('eye')} Lire seulement</button>
        <form class="bb-go" id="go" role="search"><label class="sr" for="ref">Aller à une référence</label>
          <input id="ref" placeholder="Ex. : Jean 3:16, Ps 23, Ésaïe 26:4" autocomplete="off"><button class="btn btn--sm" type="submit">Aller</button></form>
      </div>
      <p class="note" id="goMsg" aria-live="polite"></p>
      <form class="bb-cherche" id="cherche" role="search"><label class="search search--sm"><span class="sr">Chercher un mot dans toute la Bible</span>${S.icon('search')}<input type="search" id="motB" placeholder="Chercher un mot dans toute la Bible (ex. : berger, lumière)" autocomplete="off"></label>
        <label class="pl-coche"><input type="checkbox" id="ceLivre"> dans ce livre seulement</label></form>
      <div class="bb-res" id="bRes" aria-live="polite" hidden></div>
      <nav class="bb-chaps" id="chaps" aria-label="Chapitres"></nav>
      <article class="bb-text" id="text" aria-live="polite"></article>
      <div id="suite" class="bb-suite" aria-live="polite"></div>
      <span id="sentinelle" aria-hidden="true"></span>
      <nav class="rd-nav bb-nav" id="nav" aria-label="Chapitre précédent ou suivant"></nav>
      <aside class="bb-day panel" id="jour" aria-live="polite"><p class="kicker">Le verset du jour</p><p class="ash">Chargement…</p></aside>
      <p class="note">${S.icon('book')} Texte de la Bible Louis Segond (1910), dans le domaine public. Une référence écrite par un auteur (« Ps 23:4 », « Jean 3:16 ») devient un lien vers ce passage.</p>
    </section>
  </div>
  <button class="btn bb-sortir" type="button" id="sortirLecture" hidden>${S.icon('x')} Quitter la lecture</button>`;

  /* 22/10/2026 — versets gardés en couleur (image « S.O.A.P. » du propriétaire) :
     chacun choisit sa couleur, le verset se surligne dans le texte. */
  const COULEURS = [['or', 'Or'], ['rose', 'Rose'], ['ciel', 'Ciel'], ['menthe', 'Menthe'], ['lavande', 'Lavande'], ['peche', 'Pêche']];
  let gardes = [];
  const garde = (bb, cc, n) => gardes.find((x) => x.b === bb && x.c === cc && n >= x.v1 && n <= x.v2);
  const versets = (bb, cc, ch, avecHit) => ch.map((t, i) => {
    const n1 = i + 1, hit = avecHit && v1 && n1 >= v1 && n1 <= v2, g = garde(bb, cc, n1);
    return `<p id="${avecHit ? `v${n1}` : `v${bb}-${cc}-${n1}`}" class="bb-v${hit ? ' is-hit' : ''}${g ? ` is-garde bb-c-${g.couleur || 'or'}` : ''}" data-b="${bb}" data-c="${cc}" data-v="${n1}"><sup>${n1}</sup>${S.esc(t)}<button type="button" class="bb-garder${g ? ' is-on' : ''}" data-garder="${n1}" aria-label="${g ? `Verset ${n1} gardé : changer sa couleur` : `Garder le verset ${n1}`}" title="${g ? 'Changer la couleur' : 'Garder ce verset'}">${S.icon('garder')}</button></p>`;
  }).join('');

  const testament = (i) => i < 39 ? 'Ancien Testament' : 'Nouveau Testament';
  function books(filter = '') {
    const f = B.fold(filter);
    let html = '', last = '';
    B.BOOKS.forEach(([name, more], i) => {
      if (f && !B.fold(name + more).includes(f)) return;
      if (testament(i) !== last) { last = testament(i); html += `<p class="mono ash">${last}</p>`; }
      html += `<a href="bible.html?b=${i + 1}&c=1" class="${i + 1 === b ? 'is-on' : ''}"${i + 1 === b ? ' aria-current="true"' : ''}>${S.esc(name)}</a>`;
    });
    $('#books').innerHTML = html || '<p class="ash">Aucun livre.</p>';
  }

  async function show() {
    const name = B.BOOKS[b - 1][0];
    document.title = `${name} ${c} — Bible — Sōzō`;
    S.ink($('#bTitle'), `${name} [[${c}]]`);
    const n = index ? index[b - 1][1].length : 0;
    $('#chaps').innerHTML = n ? Array.from({ length: n }, (_, i) => `<a href="bible.html?b=${b}&c=${i + 1}" class="${i + 1 === c ? 'is-on' : ''}"${i + 1 === c ? ' aria-current="page"' : ''}>${i + 1}</a>`).join('') : '';
    $('#text').innerHTML = `<p class="ash">Chargement de ${S.esc(name)}…</p>`;
    try {
      const book = await B.load(b);
      const ch = book[c - 1];
      if (!ch) { $('#text').innerHTML = `<div class="empty"><strong>Ce chapitre n'existe pas</strong>${S.esc(name)} compte ${book.length} chapitre${book.length > 1 ? 's' : ''}.</div>`; return; }
      $('#text').innerHTML = versets(b, c, ch, true);
      const prev = c > 1 ? [b, c - 1] : b > 1 ? [b - 1, index ? index[b - 2][1].length : 1] : null;
      const next = c < book.length ? [b, c + 1] : b < 66 ? [b + 1, 1] : null;
      $('#nav').innerHTML = `${prev ? `<a class="btn" href="bible.html?b=${prev[0]}&c=${prev[1]}">${S.icon('left')} ${S.esc(B.BOOKS[prev[0] - 1][0])} ${prev[1]}</a>` : '<span></span>'}
        ${next ? `<a class="btn" href="bible.html?b=${next[0]}&c=${next[1]}">${S.esc(B.BOOKS[next[0] - 1][0])} ${next[1]} ${S.icon('right')}</a>` : ''}`;
      if (v1) { const el = $(`#v${v1}`); if (el) el.scrollIntoView({ block: 'center', behavior: S.reduced ? 'auto' : 'smooth' }); }
    } catch (e) {
      $('#text').innerHTML = `<div class="empty"><strong>Le texte n'a pas pu être chargé</strong>Vérifiez la connexion, puis rechargez la page.</div>`;
    }
  }

  $('#bf').addEventListener('input', (e) => books(e.target.value));
  $('#go').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = B.parse($('#ref').value.trim());
    if (!r) { $('#goMsg').textContent = 'Référence non reconnue. Essayez « Jean 3:16 », « Ps 23 » ou « 1 Co 13:4-7 ».'; return; }
    location.href = B.href(r);
  });
  /* Lot D (21/10/2026) : chercher dans toute la Bible (côté serveur : la Bible
     entière est trop lourde pour un téléphone), le verset du jour, garder un verset. */
  const nomRef = (x) => `${B.BOOKS[x.b - 1][0]} ${x.c}:${x.v}`;
  let tB;
  $('#cherche').addEventListener('submit', (e) => e.preventDefault());
  const chercher = async () => {
    const q = $('#motB').value.trim(), z = $('#bRes');
    if (q.length < 3) { z.hidden = true; return; }
    z.hidden = false; z.innerHTML = '<p class="ash"><span class="spin" aria-hidden="true"></span> Recherche…</p>';
    const r = await window.SOZO_API('GET', `/api/bible/recherche?q=${encodeURIComponent(q)}${$('#ceLivre').checked ? `&livre=${b}` : ''}`);
    if (!r.ok) { z.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'La recherche n’a pas abouti.')}</span></p>`; return; }
    z.innerHTML = r.d.total ? `<p class="ash">${r.d.total} verset${r.d.total > 1 ? 's' : ''}${r.d.total > r.d.versets.length ? `, les ${r.d.versets.length} premiers` : ''}</p>
      <ol class="bb-res-l">${r.d.versets.map((x) => `<li><a href="bible.html?b=${x.b}&c=${x.c}&v=${x.v}"><strong>${S.esc(nomRef(x))}</strong> ${S.esc(x.t)}</a></li>`).join('')}</ol>`
      : '<p class="ash">Aucun verset ne contient ces mots.</p>';
  };
  $('#motB').addEventListener('input', () => { clearTimeout(tB); tB = setTimeout(chercher, 450); });
  $('#ceLivre').addEventListener('change', chercher);
  window.SOZO_API('GET', '/api/bible/jour').then((r) => {
    const x = r.ok && r.d.verset;
    $('#jour').innerHTML = x ? `<p class="kicker">Le verset du jour</p><blockquote>« ${S.esc(x.t)} »</blockquote>
      <p><a href="bible.html?b=${x.b}&c=${x.c}&v=${x.v}">${S.esc(nomRef(x))}</a></p>` : '<p class="kicker">Le verset du jour</p><p class="ash">Indisponible pour le moment.</p>';
  });
  /* garder : une petite palette sous le verset, jamais une fenêtre */
  main.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-garder]');
    const choix = e.target.closest('[data-couleur]');
    if (choix) {
      const p = choix.closest('.bb-v'), bb = +p.dataset.b, cc = +p.dataset.c, n1 = +p.dataset.v;
      const ex = garde(bb, cc, n1);
      if (choix.dataset.couleur === 'retirer') {
        const r = await window.SOZO_API('DELETE', `/api/versets/${ex.id}`);
        if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
        gardes = gardes.filter((x) => x !== ex);
        p.className = p.className.replace(/\s?is-garde|\s?bb-c-\S+/g, '');
      } else {
        const r = await window.SOZO_API('POST', '/api/versets', { b: bb, c: cc, v1: n1, couleur: choix.dataset.couleur });
        if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
        if (ex) ex.couleur = choix.dataset.couleur; else gardes.push({ id: r.d.id, b: bb, c: cc, v1: n1, v2: n1, couleur: choix.dataset.couleur });
        p.className = p.className.replace(/\s?bb-c-\S+/g, '') + ` is-garde bb-c-${choix.dataset.couleur}`;
        S.toast(`${B.BOOKS[bb - 1][0]} ${cc}:${n1} gardé dans votre bibliothèque.`);
      }
      p.querySelector('.bb-palette') && p.querySelector('.bb-palette').remove();
      return;
    }
    if (!g) return;
    const p = g.closest('.bb-v');
    const ouverte = p.querySelector('.bb-palette');
    main.querySelectorAll('.bb-palette').forEach((x) => x.remove());
    if (ouverte) return;
    const ex = garde(+p.dataset.b, +p.dataset.c, +p.dataset.v);
    p.insertAdjacentHTML('beforeend', `<span class="bb-palette" role="group" aria-label="Couleur du verset">${COULEURS.map(([k, l]) => `<button type="button" class="bb-pastille bb-c-${k}" data-couleur="${k}" aria-label="${l}" title="${l}"></button>`).join('')}${ex ? '<button type="button" class="ec-lien" data-couleur="retirer">Retirer</button>' : ''}</span>`);
  });

  /* « Lire seulement » : le texte seul, les chapitres qui s'enchaînent en
     défilant, le verset lu éclairé (la concentration de la liseuse). */
  let lecture = false, apres = [b, c], tLu = null;
  const suivant = ([bb, cc]) => (index && cc < index[bb - 1][1].length ? [bb, cc + 1] : bb < 66 ? [bb + 1, 1] : null);
  async function ajouterChapitre() {
    const nx = suivant(apres); if (!nx) return;
    apres = nx;
    const book = await B.load(nx[0]), ch = book[nx[1] - 1]; if (!ch) return;
    $('#suite').insertAdjacentHTML('beforeend', `<section class="bb-chap"><h2>${S.esc(B.BOOKS[nx[0] - 1][0])} ${nx[1]}</h2><div class="bb-text">${versets(nx[0], nx[1], ch, false)}</div></section>`);
  }
  const fin = new IntersectionObserver((es) => { if (lecture && es.some((x) => x.isIntersecting)) ajouterChapitre(); }, { rootMargin: '600px 0px' });
  fin.observe($('#sentinelle'));
  function eclairer() {
    if (!lecture) return;
    const y = innerHeight * 0.4;
    let best = null, d = 1e9;
    main.querySelectorAll('.bb-v').forEach((el) => { const r = el.getBoundingClientRect(); const dd = Math.abs(r.top + r.height / 2 - y); if (dd < d) { d = dd; best = el; } });
    main.querySelectorAll('.bb-v.is-lu').forEach((el) => el !== best && el.classList.remove('is-lu'));
    if (best) best.classList.add('is-lu');
  }
  addEventListener('scroll', () => { cancelAnimationFrame(tLu); tLu = requestAnimationFrame(eclairer); }, { passive: true });
  function basculer(on) {
    lecture = on;
    document.body.classList.toggle('bb-lecture', on);
    $('#sortirLecture').hidden = !on;
    if (on) { apres = [b, c]; eclairer(); $('#sortirLecture').focus(); }
    else { $('#suite').innerHTML = ''; main.querySelectorAll('.is-lu').forEach((x) => x.classList.remove('is-lu')); $('#lireSeul').focus(); }
  }
  $('#lireSeul').addEventListener('click', () => basculer(true));
  $('#sortirLecture').addEventListener('click', () => basculer(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && lecture) basculer(false); });
  books();
  Promise.all([
    fetch(`bible/index.json`).then((r) => r.json()).then((ix) => { index = ix; }).catch(() => {}),
    window.SOZO_API('GET', '/api/versets').then((r) => { if (r.ok) gardes = r.d.versets; })
  ]).then(show);
  S.footer();
}).catch(window.SOZO_ERREUR);
