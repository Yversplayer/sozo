/* ═══════════════════════════════════════════════════════════
   Sōzō — le reçu d'un achat, à imprimer (22/10/2026).
   Tout vient du serveur (/api/paiements/<id>) : un achat qui n'a pas été
   confirmé par Sōzō n'a PAS de reçu, et cette page le dit au lieu d'en
   fabriquer un.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, $ = (s) => document.querySelector(s);
  document.body.classList.add('vl-recu-page');
  const main = $('#main');
  const id = +S.q('id');
  const r = id ? await window.SOZO_API('GET', `/api/paiements/${id}`) : { ok: false, d: {} };
  if (!r.ok || !r.d.recu) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Pas de reçu pour cet achat</strong>${r.ok ? 'Un reçu n’existe qu’une fois le paiement confirmé par Sōzō.' : 'Cet achat est introuvable.'}<br><br><a class="btn" href="compte.html">Mon compte</a></div></div>`;
    return;
  }
  const p = r.d.paiement, moi = S.sess();
  const quoi = { page: `Page ${p.page_de}`, chapitre: `Pages ${p.page_de} à ${p.page_a || '…'}`, livre: 'Le livre entier', plume: 'Plume (30 jours)' }[p.objet] || p.objet;
  main.innerHTML = `<article class="vl-recu">
    <header><div class="vl-recu-logo">${window.SOZO_LOGO || 'Sōzō'}</div><div><h1>Reçu</h1><p>N° ${S.esc(r.d.recu)}</p></div></header>
    <dl>
      <div><dt>Émis le</dt><dd>${S.esc(S.dateLong(r.d.recu_le || p.confirme_le))}</dd></div>
      <div><dt>Au nom de</dt><dd>${S.esc(moi.name || '')}<br><small>${S.esc(moi.email || '')}</small></dd></div>
      <div><dt>Objet</dt><dd>${S.esc(quoi)}${r.d.livre ? ` — « ${S.esc(r.d.livre.titre)} »` : ''}</dd></div>
      <div><dt>Payé par</dt><dd>${S.esc(p.operateur || 'Mobile Money')}${p.reference ? ` · référence ${S.esc(p.reference)}` : ''}</dd></div>
      <div><dt>Confirmé le</dt><dd>${S.esc(S.dateLong(p.confirme_le))}</dd></div>
      <div class="vl-recu-total"><dt>Montant</dt><dd>${S.money(p.montant / 100)}</dd></div>
    </dl>
    <p class="ash">Ce reçu atteste un paiement confirmé par Sōzō. Ce que vous avez acheté reste à vous, même si l’auteur modifie son livre.</p>
    <div class="vl-recu-a"><button class="btn" type="button" id="imprimer">${S.icon('file')} Imprimer ou enregistrer en PDF</button><a class="btn btn--ghost" href="compte.html">Retour au compte</a></div>
  </article>`;
  $('#imprimer').addEventListener('click', () => print());
}).catch(window.SOZO_ERREUR);
