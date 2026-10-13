/* ═══════════════════════════════════════════════════════════
   Sōzō — options d'achat et récapitulatif avant paiement.
   Règle du cahier des charges (§8) : aucun contenu payant n'est facturé
   sans que le prix ait été affiché. Le récapitulatif nomme le contenu,
   les pages à paraître et le prix AVANT tout bouton de paiement.
   Le paiement n'est PAS branché : le bouton « Payer » est désactivé et le
   dit. Aucun achat n'est jamais simulé comme réussi.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const S = window.SOZO, D = S.D;

  /* Ce qu'on peut acheter autour d'une page n (ou pour le livre entier). */
  function options(b, n) {
    if (!b.price) return [];
    const owned = (D.reader.purchases[b.id] || { pages: [] }).pages;
    const paid = b.pages.filter((p) => p.access === 'paid' && S.status(p) !== 'draft');
    const out = [];
    if (n != null && b.price.page != null && !owned.includes(n)) {
      out.push({ k: 'page', label: `Cette page`, detail: `Page ${n}`, pages: [n], price: b.price.page });
    }
    const ch = n != null ? S.chapterOf(b, n) : null;
    if (ch && b.price.chapter != null) {
      const cp = paid.filter((p) => p.n >= ch.from && p.n <= ch.to);
      if (cp.length && !cp.some((p) => owned.includes(p.n))) {
        out.push({ k: 'chapter', label: `Le chapitre « ${ch.t} »`, detail: S.pagesRange(cp.map((p) => p.n)), pages: cp.map((p) => p.n), price: b.price.chapter });
      }
    }
    if (b.price.all != null && paid.length) {
      const already = paid.filter((p) => owned.includes(p.n)).length;
      out.push({ k: 'all', label: 'Tout le contenu payant', detail: `${paid.length} pages payantes${already ? `, dont ${already} déjà achetées` : ''}`, pages: paid.map((p) => p.n), price: b.price.all });
    }
    return out;
  }

  function recap(b, opt) {
    const future = opt.pages.filter((n) => S.access(b, n) === 'soon');
    const body = `
      <div class="recap">
        <div><span>Livre</span><strong>${S.esc(b.title)}</strong></div>
        <div><span>Contenu</span><strong>${S.esc(opt.label)} — ${S.esc(opt.detail)}</strong></div>
        ${future.length ? `<div><span>À paraître</span><strong>${S.esc(S.pagesRange(future))} : ouvertes à leur date</strong></div>` : ''}
        <div><span>Prix</span><strong style="font-size:22px">${S.money(opt.price)}</strong></div>
      </div>
      <p class="note">${S.icon('shield')} Une fois payé, ce contenu reste à vous, même si l'auteur modifie ensuite son livre.</p>
      <p class="warn">${S.icon('lock')}<span><strong>Paiement non branché dans cette démonstration.</strong> Rien ne sera débité et aucun accès ne sera ouvert. Le bouton ci-dessous restera inactif tant qu'un vrai moyen de paiement n'est pas relié.</span></p>`;
    S.modal({ title: 'Récapitulatif avant paiement', body, actions: [
      { label: 'Annuler' },
      { label: `Payer ${S.money(opt.price)}`, primary: true, disabled: true }
    ] });
  }

  S.buy = { options, recap };
})();
