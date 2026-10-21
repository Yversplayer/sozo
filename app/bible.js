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
        <form class="bb-go" id="go" role="search"><label class="sr" for="ref">Aller à une référence</label>
          <input id="ref" placeholder="Ex. : Jean 3:16, Ps 23, Ésaïe 26:4" autocomplete="off"><button class="btn btn--sm" type="submit">Aller</button></form>
      </div>
      <p class="note" id="goMsg" aria-live="polite"></p>
      <form class="bb-cherche" id="cherche" role="search"><label class="search search--sm"><span class="sr">Chercher un mot dans toute la Bible</span>${S.icon('search')}<input type="search" id="motB" placeholder="Chercher un mot dans toute la Bible (ex. : berger, lumière)" autocomplete="off"></label>
        <label class="pl-coche"><input type="checkbox" id="ceLivre"> dans ce livre seulement</label></form>
      <div class="bb-res" id="bRes" aria-live="polite" hidden></div>
      <nav class="bb-chaps" id="chaps" aria-label="Chapitres"></nav>
      <article class="bb-text" id="text" aria-live="polite"></article>
      <nav class="rd-nav bb-nav" id="nav" aria-label="Chapitre précédent ou suivant"></nav>
      <aside class="bb-day panel" id="jour" aria-live="polite"><p class="kicker">Le verset du jour</p><p class="ash">Chargement…</p></aside>
      <p class="note">${S.icon('book')} Texte de la Bible Louis Segond (1910), dans le domaine public. Une référence écrite par un auteur (« Ps 23:4 », « Jean 3:16 ») devient un lien vers ce passage.</p>
    </section>
  </div>`;

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
      $('#text').innerHTML = ch.map((t, i) => {
        const n1 = i + 1, hit = v1 && n1 >= v1 && n1 <= v2;
        return `<p id="v${n1}" class="${hit ? 'is-hit' : ''}"><sup>${n1}</sup>${S.esc(t)}<button type="button" class="bb-garder" data-garder="${n1}" aria-label="Garder le verset ${n1}" title="Garder ce verset">${S.icon('garder')}</button></p>`;
      }).join('');
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
  /* Lot D (22/10/2026) : chercher dans toute la Bible (côté serveur : la Bible
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
  $('#text').addEventListener('click', async (e) => {
    const g = e.target.closest('[data-garder]'); if (!g) return;
    g.disabled = true;
    const r = await window.SOZO_API('POST', '/api/versets', { b, c, v1: +g.dataset.garder });
    g.disabled = false;
    if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
    g.classList.add('is-on'); g.setAttribute('aria-label', `Verset ${g.dataset.garder} gardé`);
    S.toast(`${B.BOOKS[b - 1][0]} ${c}:${g.dataset.garder} gardé dans votre bibliothèque.`);
  });
  books();
  fetch(`bible/index.json`).then((r) => r.json()).then((ix) => { index = ix; show(); }).catch(() => show());
  S.footer();
}).catch(window.SOZO_ERREUR);
