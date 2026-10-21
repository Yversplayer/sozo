/* ═══════════════════════════════════════════════════════════
   Sōzō — le livre de l'AUTEUR, prêt à imprimer (ou à enregistrer en PDF
   depuis la fenêtre d'impression du navigateur). Les routes du studio ne
   répondent qu'à l'auteur : un lecteur n'obtient jamais un livre d'un bloc.
   Pages chargées par lots de 24, comme dans l'éditeur.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, $ = (s) => document.querySelector(s);
  document.body.classList.add('vl-impr-page');
  const main = $('#main'), id = S.q('id'), enc = encodeURIComponent;
  const r = id ? await window.SOZO_API('GET', `/api/studio/livres/${enc(id)}`) : { ok: false, d: {} };
  if (!r.ok) { main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Livre introuvable</strong>Seul son auteur peut l’imprimer.<br><br><a class="btn" href="studio.html">Mes livres</a></div></div>`; return; }
  const b = r.d.livre, pg = (b.apparence && b.apparence.page) || {};
  main.innerHTML = `<div class="vl-impr-a"><span id="imprEtat" aria-live="polite">Préparation des pages…</span><button class="btn" type="button" id="imprimer" disabled>${S.icon('file')} Imprimer ou enregistrer en PDF</button></div>
    <article class="vl-impr">
      <section class="vl-impr-titre"><h1>${S.esc(b.titre)}</h1><p>${S.esc(S.sess().name || '')}</p></section>
      <div id="imprPages" class="rd-text ${S.mise.classes(pg)}" style="${S.esc(S.mise.style(pg))}"></div>
    </article>`;
  const zone = $('#imprPages'), n = b.pages.length;
  for (let de = 1; de <= n; de += 24) {
    const t = await window.SOZO_API('GET', `/api/studio/livres/${enc(id)}/textes?de=${de}&a=${Math.min(n, de + 23)}`);
    if (!t.ok) { $('#imprEtat').textContent = t.d.erreur || 'Des pages n’ont pas pu se charger.'; return; }
    zone.insertAdjacentHTML('beforeend', t.d.pages.map((p) => `<section class="vl-impr-p">${S.mise.paragraphes(p.contenu, pg, (x) => S.esc(x) || '&nbsp;')}<p class="vl-impr-n">${p.n}</p></section>`).join(''));
    $('#imprEtat').textContent = `${Math.min(n, de + 23)} page${n > 1 ? 's' : ''} sur ${n}`;
  }
  $('#imprEtat').textContent = `${n} page${n > 1 ? 's' : ''} prêtes.`;
  $('#imprimer').disabled = false;
  $('#imprimer').addEventListener('click', () => print());
}).catch(window.SOZO_ERREUR);
