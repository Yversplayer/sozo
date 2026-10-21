/* ═══════════════════════════════════════════════════════════
   Sōzō — console d'administration (comme celle de Klassio).
   · Comptes d'administration À PART, créés en ligne de commande seulement ;
     connexion par mot de passe + code à 6 chiffres (TOTP).
   · Cookies et jeton CSRF propres (sozo_admin, sozo_admin_csrf).
   · Chaque décision part au serveur, qui la vérifie et l'inscrit au journal ;
     l'écran ne change qu'après sa réponse.
   · Confirmer un paiement ouvre l'accès d'un lecteur et crédite un auteur :
     la console exige d'avoir vu la transaction chez l'opérateur.
   ═══════════════════════════════════════════════════════════ */
(function () {
  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const main = $('#main');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = (c) => (c == null ? '—' : (c / 100).toFixed(2).replace('.', ',') + ' $');
  const date = (iso) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const csrf = () => { const m = document.cookie.match(/(?:^|; )sozo_admin_csrf=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; };
  $('#logo').innerHTML = window.SOZO_LOGO || 'Sōzō';

  async function api(methode, url, corps, rejoue) {
    const o = { method: methode, credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf() } };
    if (methode !== 'GET') { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(corps || {}); }
    try {
      const r = await fetch(url, o);
      const d = await r.json().catch(() => ({}));
      if (r.status === 401 && !url.endsWith('/sessions') && !url.endsWith('/reauth')) { connexion(); throw new Error('session'); }
      // Action sensible : le serveur exige un code frais. On le demande, puis on rejoue UNE fois.
      if (r.status === 403 && d.code === 'reauth' && !rejoue) {
        if (await codeFrais()) return api(methode, url, corps, true);
        return { ok: false, status: 403, d: { erreur: 'Action annulée : code non confirmé.' } };
      }
      return { ok: r.ok, status: r.status, d };
    } catch (e) {
      if (e.message === 'session') throw e;
      return { ok: false, status: 0, d: { erreur: 'Le serveur ne répond pas.' } };
    }
  }

  function codeFrais() {
    const d = $('#dlgCode'), f = $('#codeF');
    f.reset(); $('#codeE').textContent = '';
    d.showModal(); f.elements.code.focus();
    return new Promise((fin) => {
      f.onsubmit = async (e) => {
        if (e.submitter && e.submitter.value === 'annuler') { fin(false); return; }
        e.preventDefault();
        const r = await api('POST', '/api/admin/reauth', { code: f.elements.code.value.trim() });
        if (!r.ok) { $('#codeE').textContent = r.d.erreur || 'Code refusé.'; return; }
        d.close(); fin(true);
      };
    });
  }

  /* ─── fenêtre de décision (élément <dialog> natif : focus et Échap gérés) ─── */
  const dlg = $('#dlg');
  function demander({ titre, corps, bouton, valider }) {
    $('#dlgT').textContent = titre; $('#dlgB').innerHTML = corps; $('#dlgE').textContent = ''; $('#dlgOk').textContent = bouton;
    dlg.showModal();
    const f = $('#dlgF');
    f.onsubmit = async (e) => {
      if (e.submitter && e.submitter.value === 'annuler') return;
      e.preventDefault();
      const ok = $('#dlgOk'); ok.disabled = true;
      const msg = await valider(f);
      ok.disabled = false;
      if (msg) { $('#dlgE').textContent = msg; return; }
      dlg.close();
    };
  }
  let toastT;
  function toast(t) {
    let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 3500);
  }

  /* ─── connexion ─── */
  function connexion() {
    $('#who').textContent = ''; $('#sortir').hidden = true;
    main.innerHTML = `<section class="ad-login">
      <h1>Administration</h1>
      <p class="ash">Accès réservé à l’équipe Sōzō. Les comptes sont créés en ligne de commande ; le code à 6 chiffres vient de votre application d’authentification.</p>
      <form class="at-form" id="fLog" novalidate>
        <label class="cx-field">Adresse e-mail<input type="email" name="email" autocomplete="username" required></label>
        <label class="cx-field">Mot de passe<input type="password" name="mdp" autocomplete="current-password" required></label>
        <label class="cx-field">Code à 6 chiffres<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
        <p class="cx-err" id="eLog" role="alert"></p>
        <button class="btn btn--accent cx-submit" type="submit">Entrer</button>
      </form>
    </section>`;
    const f = $('#fLog');
    f.elements.email.focus();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = f.elements.code.value.replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) { $('#eLog').textContent = 'Le code compte 6 chiffres.'; return; }
      const b = f.querySelector('[type=submit]'); b.disabled = true;
      const r = await api('POST', '/api/admin/sessions', { email: f.elements.email.value.trim(), mot_de_passe: f.elements.mdp.value, code });
      b.disabled = false;
      if (!r.ok) { $('#eLog').textContent = r.d.erreur || 'Connexion refusée.'; f.elements.code.value = ''; return; }
      console_();
    });
  }
  $('#sortir').addEventListener('click', async () => { await api('DELETE', '/api/admin/sessions/courante').catch(() => {}); connexion(); });

  /* ─── la console ─── */
  const ONGLETS = [['tableau', 'Tableau'], ['paiements', 'Paiements'], ['reversements', 'Reversements'], ['cadeaux', 'Cadeaux'], ['livres', 'Livres'], ['communaute', 'Communauté'], ['signalements', 'Signalements'], ['utilisateurs', 'Utilisateurs'], ['audit', 'Journal']];
  let onglet = (location.hash || '#tableau').slice(1), compteurs = {}, roles = [];
  const peut = (r) => roles.includes(r);
  async function console_() {
    const r = await api('GET', '/api/admin/tableau').catch(() => null);
    if (!r) return;
    if (!r.ok) { main.innerHTML = `<p class="warn">${esc(r.d.erreur || 'Console indisponible.')}</p>`; return; }
    compteurs = r.d;
    $('#who').textContent = `${r.d.admin.nom} · ${r.d.admin.roles.join(', ') || 'aucun rôle'}`; roles = r.d.admin.roles; $('#sortir').hidden = false;
    if (!ONGLETS.some(([k]) => k === onglet)) onglet = 'tableau';
    main.innerHTML = `<nav class="at-tabs ad-tabs" role="tablist" aria-label="Sections">${ONGLETS.map(([k, l]) => {
      const n = { paiements: r.d.paiements_attente, reversements: r.d.reversements_attente, signalements: r.d.signalements + r.d.signalements_ecrits }[k];
      return `<button type="button" role="tab" data-o="${k}" id="t-${k}" aria-selected="${onglet === k}" tabindex="${onglet === k ? 0 : -1}">${l}${n ? ` <b class="ad-n">${n}</b>` : ''}</button>`;
    }).join('')}</nav><section id="pan" role="tabpanel" aria-labelledby="t-${onglet}" class="ad-pan"><p class="ad-wait" role="status">Chargement…</p></section>`;
    const tabs = $$('[data-o]');
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { onglet = t.dataset.o; history.replaceState(null, '', '#' + onglet); console_().then(() => $(`#t-${onglet}`).focus()); });
      t.addEventListener('keydown', (e) => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); tabs[(i + k + tabs.length) % tabs.length].click(); } });
    });
    await PANNEAUX[onglet]($('#pan'));
  }
  const vide = (t) => `<div class="empty"><strong>${esc(t)}</strong></div>`;
  const table = (tetes, lignes) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${tetes.map((t) => `<th>${t}</th>`).join('')}</tr></thead><tbody>${lignes.join('')}</tbody></table></div>`;
  const ETAT = { CREATED: 'À payer', PENDING: 'Déclaré', UNKNOWN: 'À examiner', CONFIRMED: 'Confirmé', FAILED: 'Refusé', CANCELLED: 'Annulé', EXPIRED: 'Expiré', DEMANDE: 'Demandé', PAYE: 'Envoyé', REFUSE: 'Refusé' };
  const quoi = (p) => p.objet === 'plume' ? 'Plume (30 j)' : p.objet === 'livre' ? `${esc(p.titre)} — livre` : `${esc(p.titre)} — p. ${p.page_de}${p.page_a !== p.page_de ? `–${p.page_a}` : ''}`;
  const motif = (lib) => `<label class="cx-field">${lib}<textarea name="motif" rows="3" maxlength="300" required></textarea></label>`;

  const PANNEAUX = {
    async tableau(el) {
      const d = compteurs;
      el.innerHTML = `<div class="ad-kpis">
        ${[['Paiements à vérifier', d.paiements_attente, 'paiements'], ['Reversements demandés', d.reversements_attente, 'reversements'], ['Signalements ouverts', d.signalements + d.signalements_ecrits, 'signalements']].map(([l, v, o]) => `<a class="at-card${v ? ' at-card--or' : ''}" href="#${o}" data-aller="${o}"><strong>${v}</strong><span class="at-card-l">${l}</span><small>${v ? 'À traiter' : 'Rien en attente'}</small></a>`).join('')}
        ${[['Encaissé (confirmé)', usd(d.encaisse)], ['Commission Sōzō', usd(d.commission)], ['Dû aux auteurs', usd(d.du_aux_auteurs)], ['Ventes confirmées', d.ventes], ['Utilisateurs actifs', d.utilisateurs], ['Dont auteurs', d.auteurs], ['Livres en ligne', d.livres]].map(([l, v]) => `<div class="at-card"><strong>${esc(v)}</strong><span class="at-card-l">${l}</span></div>`).join('')}
      </div>
      <p class="note">Les montants ne comptent que les paiements CONFIRMÉS. Aucun prestataire n’est branché : chaque paiement est déclaré par le lecteur et vérifié ici, à la main, sur le relevé de l’opérateur.</p>
      <h2 class="ad-h2">Communauté</h2>
      <div class="ad-kpis">
        ${[['Écrits en ligne', d.ecrits], ['Commentaires visibles', d.commentaires], ['Abonnements à des auteurs', d.abonnements], ['Charte acceptée', d.charte], ['Écrits retirés', d.ecrits_retires]].map(([l, v]) => `<a class="at-card" href="#communaute" data-aller="communaute"><strong>${esc(v)}</strong><span class="at-card-l">${l}</span></a>`).join('')}
      </div>`;
      $$('[data-aller]', el).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); onglet = a.dataset.aller; history.replaceState(null, '', '#' + onglet); console_(); }));
    },

    async paiements(el) {
      const filtre = sessionStorage.getItem('ad-pf') || 'PENDING';
      const r = await api('GET', `/api/admin/paiements?etat=${encodeURIComponent(filtre)}`);
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const P = r.d.paiements;
      el.innerHTML = `<div class="tbl-tools"><label class="ad-sel">Afficher <select id="pf">${['PENDING', 'UNKNOWN', 'CREATED', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED', 'TOUS'].map((k) => `<option value="${k}"${k === filtre ? ' selected' : ''}>${k === 'TOUS' ? 'Tous' : ETAT[k]}</option>`).join('')}</select></label></div>
        ${P.length ? table(['Le', 'Lecteur', 'Achat', 'Montant', 'Opérateur', 'Référence', 'État', ''], P.map((p) => `<tr>
          <td>${date(p.updated_at)}</td><td>${esc(p.lecteur)}<br><small class="ash">${esc(p.email)}</small></td><td>${quoi(p)}</td><td><strong>${usd(p.montant)}</strong></td>
          <td>${esc(p.operateur || '—')}</td><td class="mono">${esc(p.reference || '—')}</td><td>${p.prestataire === 'simulateur' ? '<b class="ad-test">TEST</b> ' : ''}${p.rembourse_le ? `Remboursé<br><small class="ash">${esc(p.motif_remboursement)}</small>` : esc(ETAT[p.etat] || p.etat)}${p.motif_refus ? `<br><small class="ash">${esc(p.motif_refus)}</small>` : ''}${p.confirme_par ? `<br><small class="ash">par ${esc(p.confirme_par)}</small>` : ''}</td>
          <td>${!peut('finance') ? '' : ['PENDING', 'UNKNOWN'].includes(p.etat) ? `<span class="row-acts"><button class="btn btn--sm btn--accent" data-conf="${p.id}">Confirmer</button><button class="btn btn--sm btn--ghost" data-ref="${p.id}">Refuser</button></span>` : p.etat === 'CONFIRMED' && !p.rembourse_le ? `<button class="btn btn--sm btn--ghost" data-remb="${p.id}">Rembourser</button>` : ''}</td></tr>`)) : vide('Aucun paiement dans cet état.')}`;
      $('#pf').addEventListener('change', (e) => { sessionStorage.setItem('ad-pf', e.target.value); PANNEAUX.paiements(el); });
      $$('[data-conf]', el).forEach((b) => b.addEventListener('click', () => {
        const p = P.find((x) => x.id === +b.dataset.conf);
        demander({ titre: 'Confirmer ce paiement ?', bouton: 'Confirmer et ouvrir l’accès',
          corps: `<div class="recap"><div><span>Montant attendu</span><strong>${usd(p.montant)}</strong></div><div><span>Opérateur</span><strong>${esc(p.operateur)}</strong></div><div><span>Référence</span><strong class="mono">${esc(p.reference)}</strong></div><div><span>Lecteur</span><strong>${esc(p.lecteur)}</strong></div><div><span>Achat</span><strong>${quoi(p)}</strong></div></div>
            <label class="cx-check"><input type="checkbox" name="vu" required><span>J’ai trouvé cette transaction, de ce montant, sur le relevé ${esc(p.operateur)} de Sōzō.</span></label>
            <p class="note">La confirmation ouvre l’accès du lecteur, émet son reçu et crédite l’auteur. Elle ne se défait pas.</p>`,
          valider: async (f) => {
            if (!f.elements.vu.checked) return 'Cochez la case : la transaction doit avoir été vue chez l’opérateur.';
            const x = await api('POST', `/api/admin/paiements/${p.id}/confirmer`);
            if (!x.ok) return x.d.erreur || 'Confirmation refusée.';
            toast(`Paiement confirmé · reçu ${x.d.recu}`); console_();
          } });
      }));
      $$('[data-remb]', el).forEach((b) => b.addEventListener('click', () => {
        const p = P.find((x) => x.id === +b.dataset.remb);
        demander({ titre: `Rembourser ${usd(p.montant)} ?`, bouton: 'Rembourser et retirer l’accès',
          corps: `<div class="recap"><div><span>Lecteur</span><strong>${esc(p.lecteur)}</strong></div><div><span>Achat</span><strong>${quoi(p)}</strong></div></div>
            ${motif('Motif (le lecteur le verra)')}
            <label class="cx-field">Référence de VOTRE renvoi d’argent <small>facultatif</small><input name="reference" maxlength="120"></label>
            <p class="note">Le droit de lecture est retiré ; le registre reçoit des lignes correctrices (rien n’est effacé). Faites le renvoi d’argent vous-même : Sōzō ne le fait pas.</p>`,
          valider: async (f) => {
            const m = f.elements.motif.value.trim(); if (m.length < 3) return 'Indiquez un motif.';
            const x = await api('POST', `/api/admin/paiements/${p.id}/rembourser`, { motif: m, reference: f.elements.reference.value.trim() || null });
            if (!x.ok) return x.d.erreur || 'Remboursement refusé.';
            toast('Remboursement enregistré : accès retiré.'); console_();
          } });
      }));
      $$('[data-ref]', el).forEach((b) => b.addEventListener('click', () => {
        demander({ titre: 'Refuser ce paiement ?', bouton: 'Refuser', corps: `${motif('Motif (le lecteur le verra)')}<p class="note">Exemple : « Aucune transaction avec cette référence sur notre relevé. »</p>`,
          valider: async (f) => {
            const m = f.elements.motif.value.trim(); if (m.length < 3) return 'Indiquez un motif.';
            const x = await api('POST', `/api/admin/paiements/${b.dataset.ref}/refuser`, { motif: m });
            if (!x.ok) return x.d.erreur || 'Refus impossible.';
            toast('Paiement refusé.'); console_();
          } });
      }));
    },

    async reversements(el) {
      const r = await api('GET', '/api/admin/reversements');
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const R = r.d.reversements;
      el.innerHTML = R.length ? table(['Demandé le', 'Auteur', 'Montant', 'Vers', 'État', ''], R.map((x) => `<tr>
        <td>${date(x.created_at)}</td><td>${esc(x.nom)}<br><small class="ash">${esc(x.email)}</small></td><td><strong>${usd(x.montant)}</strong></td>
        <td>${esc(x.operateur)}<br><span class="mono">${esc(x.numero)}</span></td><td>${esc(ETAT[x.etat] || x.etat)}${x.reference ? `<br><small class="mono">${esc(x.reference)}</small>` : ''}${x.motif ? `<br><small class="ash">${esc(x.motif)}</small>` : ''}</td>
        <td>${x.etat === 'DEMANDE' && peut('finance') ? `<span class="row-acts"><button class="btn btn--sm btn--accent" data-payer="${x.id}">Marquer envoyé</button><button class="btn btn--sm btn--ghost" data-refus="${x.id}">Refuser</button></span>` : ''}</td></tr>`)) : vide('Aucune demande de reversement.');
      $$('[data-payer]', el).forEach((b) => b.addEventListener('click', () => {
        const x = R.find((y) => y.id === +b.dataset.payer);
        demander({ titre: `Reversement de ${usd(x.montant)}`, bouton: 'Enregistrer l’envoi',
          corps: `<p>Envoyez <strong>${usd(x.montant)}</strong> à <strong>${esc(x.nom)}</strong> sur ${esc(x.operateur)} <span class="mono">${esc(x.numero)}</span>, puis indiquez la référence de VOTRE transaction.</p><label class="cx-field">Référence de l’envoi<input name="ref" maxlength="120" required></label>`,
          valider: async (f) => {
            const v = f.elements.ref.value.trim(); if (v.length < 3) return 'Indiquez la référence de l’envoi.';
            const y = await api('POST', `/api/admin/reversements/${x.id}/payer`, { reference: v });
            if (!y.ok) return y.d.erreur || 'Enregistrement refusé.';
            toast('Reversement enregistré.'); console_();
          } });
      }));
      $$('[data-refus]', el).forEach((b) => b.addEventListener('click', () => demander({ titre: 'Refuser ce reversement ?', bouton: 'Refuser', corps: motif('Motif (l’auteur le verra)'),
        valider: async (f) => { const m = f.elements.motif.value.trim(); if (m.length < 3) return 'Indiquez un motif.'; const y = await api('POST', `/api/admin/reversements/${b.dataset.refus}/refuser`, { motif: m }); if (!y.ok) return y.d.erreur; toast('Reversement refusé : le montant redevient disponible pour l’auteur.'); console_(); } })));
    },

    /* Cadeaux (19/10/2026) : offrir un livre ou Plume, sans argent — rôle finance, code frais */
    async cadeaux(el) {
      const r = await api('GET', '/api/admin/dons');
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const D = r.d.dons;
      el.innerHTML = `${peut('finance') ? `<div class="tbl-tools"><button class="btn btn--accent" type="button" id="offrir">Offrir un livre ou Plume</button></div>` : '<p class="note">Offrir demande le rôle « finance ».</p>'}
        <p class="note" style="margin:0 0 12px">Un cadeau ouvre la lecture (ou Plume) à UNE personne. Ce n’est pas une vente : ni paiement, ni reçu, ni revenu pour l’auteur. Chaque cadeau est inscrit au journal et se retire.</p>
        ${D.length ? table(['Le', 'Pour', 'Cadeau', 'Motif', 'Par', 'État', ''], D.map((x) => `<tr>
          <td>${date(x.created_at)}</td><td>${esc(x.nom)}<br><small class="ash">${esc(x.email)}</small></td>
          <td>${x.objet === 'plume' ? `Plume jusqu’au ${date(x.fin)}` : `${esc(x.titre)} — livre entier`}</td><td class="ad-motif">${esc(x.motif)}</td><td>${esc(x.par)}</td>
          <td>${x.revoque_le ? `Retiré le ${date(x.revoque_le)}` : 'Actif'}</td>
          <td>${!x.revoque_le && peut('finance') ? `<button class="btn btn--sm btn--ghost" data-retdon="${x.id}">Retirer</button>` : ''}</td></tr>`)) : vide('Aucun cadeau pour l’instant.')}`;
      const of = $('#offrir');
      if (of) of.addEventListener('click', async () => {
        const lv = await api('GET', '/api/admin/livres');
        const livres = lv.ok ? lv.d.livres.filter((b) => b.statut !== 'retire') : [];
        demander({ titre: 'Offrir', bouton: 'Offrir',
          corps: `<label class="cx-field">E-mail du compte<input name="email" type="email" required autocomplete="off"></label>
            <fieldset class="ad-choix"><legend>Cadeau</legend><label><input type="radio" name="objet" value="livre" checked> Un livre entier (pages à venir comprises)</label><label><input type="radio" name="objet" value="plume"> Plume</label></fieldset>
            <label class="cx-field" data-si-livre>Livre<select name="livre">${livres.map((b) => `<option value="${esc(b.slug)}">${esc(b.titre)} — ${esc(b.auteur)}</option>`).join('')}</select></label>
            <label class="cx-field" data-si-plume hidden>Durée en jours<input name="jours" type="number" min="1" max="365" value="30"></label>
            ${motif('Motif (inscrit au journal)')}
            <p class="note">Un code à 6 chiffres frais vous sera demandé.</p>`,
          valider: async (f) => {
            const objet = f.elements.objet.value, m = f.elements.motif.value.trim();
            if (m.length < 3) return 'Indiquez un motif.';
            const corps = { email: f.elements.email.value.trim(), objet, motif: m };
            if (objet === 'livre') corps.livre = f.elements.livre.value; else corps.jours = +f.elements.jours.value || 30;
            const y = await api('POST', '/api/admin/dons', corps);
            if (!y.ok) return y.d.erreur || 'Cadeau refusé.';
            toast('Cadeau offert : la personne est prévenue dans ses notifications.'); console_();
          } });
        const f = $('#dlgF');
        f.addEventListener('change', () => { const pl = f.elements.objet.value === 'plume'; f.querySelector('[data-si-livre]').hidden = pl; f.querySelector('[data-si-plume]').hidden = !pl; });
      });
      $$('[data-retdon]', el).forEach((b) => b.addEventListener('click', () => demander({ titre: 'Retirer ce cadeau ?', bouton: 'Retirer', corps: motif('Motif (inscrit au journal)'),
        valider: async (f) => { const m = f.elements.motif.value.trim(); if (m.length < 3) return 'Indiquez un motif.'; const y = await api('POST', `/api/admin/dons/${b.dataset.retdon}/retirer`, { motif: m }); if (!y.ok) return y.d.erreur; toast('Cadeau retiré.'); console_(); } })));
    },

    async livres(el) {
      const r = await api('GET', '/api/admin/livres');
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const L = r.d.livres;
      el.innerHTML = L.length ? table(['Livre', 'Auteur', 'Catégorie', 'Accès', 'Signalements', 'État', ''], L.map((b) => `<tr>
        <td><a href="../app/livre.html?id=${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">${esc(b.titre)}</a>${b.demo ? ' <small class="ash">(démo)</small>' : ''}</td><td>${esc(b.auteur)}</td><td>${esc(b.categorie)}</td><td>${esc(b.acces)}</td>
        <td>${b.signalements ? `<b class="ad-n">${b.signalements}</b>` : '0'}</td><td>${b.statut === 'retire' ? `Retiré<br><small class="ash">${esc(b.retrait_motif)}</small>` : 'En ligne'}</td>
        <td>${!peut('moderation') ? '' : b.statut === 'retire' ? `<button class="btn btn--sm btn--ghost" data-retablir="${b.id}">Rétablir</button>` : `<button class="btn btn--sm btn--ghost" data-retirer="${b.id}">Retirer</button>`}</td></tr>`)) : vide('Aucun livre.');
      $$('[data-retirer]', el).forEach((b) => b.addEventListener('click', () => demander({ titre: 'Retirer ce livre du catalogue ?', bouton: 'Retirer',
        corps: `${motif('Motif (l’auteur le verra dans son atelier)')}<p class="note">Les lecteurs qui l’ont acheté le gardent ; il disparaît du catalogue.</p>`,
        valider: async (f) => { const m = f.elements.motif.value.trim(); if (m.length < 3) return 'Indiquez un motif.'; const y = await api('POST', `/api/admin/livres/${b.dataset.retirer}/retirer`, { motif: m }); if (!y.ok) return y.d.erreur; toast('Livre retiré.'); console_(); } })));
      $$('[data-retablir]', el).forEach((b) => b.addEventListener('click', async () => { b.disabled = true; const y = await api('POST', `/api/admin/livres/${b.dataset.retablir}/retablir`); if (!y.ok) { b.disabled = false; toast(y.d.erreur); return; } toast('Livre rétabli.'); console_(); }));
    },

    /* Lot E (21/10/2026) — la communauté, sans attendre un signalement.
       Retirer cache pour tous (rien n'est détruit, l'auteur est prévenu du
       motif) ; rétablir ne rend que ce que la modération a retiré. */
    async communaute(el, plus) {
      const quoi = sessionStorage.getItem('ad-cq') || 'ecrits', retires = sessionStorage.getItem('ad-cr') === '1';
      if (!plus) el._lignes = [];
      const r = quoi === 'avis' ? await api('GET', `/api/admin/avis${retires ? '?retires=1' : ''}`)
        : await api('GET', `/api/admin/communaute?quoi=${quoi}${retires ? '&retires=1' : ''}${plus ? `&avant=${plus}` : ''}`);
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const L = el._lignes = el._lignes.concat(r.d.lignes);
      const maintenant = new Date().toISOString();
      const etatEcrit = (x) => x.retire_le ? `Retiré le ${date(x.retire_le)}<br><small class="ash">${esc(x.retrait_motif || '')}</small>` : x.corbeille_le ? 'Dans la corbeille de l’auteur' : x.publie_le > maintenant ? `Programmé (${date(x.publie_le)})` : 'En ligne';
      const lignes = quoi === 'avis' ? L.map((x) => `<tr>
          <td>${date(x.created_at)}</td><td class="ad-motif"><strong>${'★'.repeat(x.note)}</strong> ${esc((x.texte || '').slice(0, 300))}</td>
          <td><a href="../app/livre.html?id=${encodeURIComponent(x.slug)}#avis" target="_blank" rel="noopener">${esc(x.titre)}</a></td>
          <td>${esc(x.auteur)}</td><td>—</td><td>${x.retire_le ? `Retiré le ${date(x.retire_le)}` : 'Visible'}</td>
          <td>${!peut('moderation') ? '' : `<button class="btn btn--sm btn--ghost" data-cm="avis" data-id="${x.id}" data-a="${x.retire_le ? 'retablir' : 'retirer'}">${x.retire_le ? 'Rétablir' : 'Retirer'}</button>`}</td></tr>`)
        : quoi === 'ecrits' ? L.map((x) => `<tr>
          <td>${date(x.publie_le)}</td>
          <td class="ad-motif"><a href="../app/ecrit.html?id=${x.id}" target="_blank" rel="noopener"><strong>${esc(x.titre || x.nature)}</strong></a><br><small class="ash">${esc((x.extrait || '').slice(0, 200))}</small></td>
          <td>${esc(x.auteur)}</td><td>${x.commentaires}</td><td>${x.signalements ? `<b class="ad-n">${x.signalements}</b>` : '0'}</td><td>${etatEcrit(x)}</td>
          <td>${!peut('moderation') ? '' : x.retire_le ? `<button class="btn btn--sm btn--ghost" data-cm="ecrits" data-id="${x.id}" data-a="retablir">Rétablir</button>` : `<button class="btn btn--sm btn--ghost" data-cm="ecrits" data-id="${x.id}" data-a="retirer">Retirer</button>`}</td></tr>`)
        : L.map((x) => `<tr>
          <td>${date(x.created_at)}</td><td class="ad-motif">« ${esc((x.texte || '').slice(0, 300))} »</td>
          <td><a href="../app/ecrit.html?id=${x.ecrit_id}#commentaires" target="_blank" rel="noopener">${esc(x.titre || x.nature)}</a><br><small class="ash">de ${esc(x.auteur_ecrit)}</small></td>
          <td>${esc(x.auteur)}</td><td>${x.signalements ? `<b class="ad-n">${x.signalements}</b>` : '0'}</td><td>${x.retire_le ? `Retiré le ${date(x.retire_le)}` : 'Visible'}</td>
          <td>${!peut('moderation') ? '' : x.retire_le ? `<button class="btn btn--sm btn--ghost" data-cm="commentaires" data-id="${x.id}" data-a="retablir">Rétablir</button>` : `<button class="btn btn--sm btn--ghost" data-cm="commentaires" data-id="${x.id}" data-a="retirer">Retirer</button>`}</td></tr>`);
      el.innerHTML = `<div class="tbl-tools">
          <label class="ad-sel">Afficher <select id="cq"><option value="ecrits"${quoi === 'ecrits' ? ' selected' : ''}>Écrits publiés</option><option value="commentaires"${quoi === 'commentaires' ? ' selected' : ''}>Commentaires</option><option value="avis"${quoi === 'avis' ? ' selected' : ''}>Avis sur les livres</option></select></label>
          <label class="ad-sel"><select id="cr"><option value="0"${retires ? '' : ' selected'}>visibles</option><option value="1"${retires ? ' selected' : ''}>retirés par la modération</option></select></label>
        </div>
        <p class="note" style="margin:0 0 12px">Retirer cache le contenu pour tous ; rien n’est détruit et l’auteur est prévenu du motif. Seul ce que la modération a retiré peut être rétabli.${peut('moderation') ? '' : ' Agir demande le rôle « moderation ».'}</p>
        ${L.length ? table(quoi === 'avis' ? ['Le', 'Avis', 'Livre', 'Par', '', 'État', ''] : quoi === 'ecrits' ? ['Paru le', 'Écrit', 'Auteur', 'Commentaires', 'Signalements', 'État', ''] : ['Le', 'Commentaire', 'Sous l’écrit', 'Par', 'Signalements', 'État', ''], lignes) : vide(retires ? 'Rien n’a été retiré.' : 'Rien pour l’instant.')}
        ${r.d.suite ? `<div class="tbl-tools"><button class="btn btn--sm btn--ghost" type="button" id="cplus">Voir plus</button></div>` : ''}`;
      $('#cq').addEventListener('change', (e) => { sessionStorage.setItem('ad-cq', e.target.value); PANNEAUX.communaute(el); });
      $('#cr').addEventListener('change', (e) => { sessionStorage.setItem('ad-cr', e.target.value); PANNEAUX.communaute(el); });
      const pl = $('#cplus'); if (pl) pl.addEventListener('click', () => PANNEAUX.communaute(el, r.d.suite));
      $$('[data-cm]', el).forEach((b) => b.addEventListener('click', async () => {
        const url = `/api/admin/${b.dataset.cm}/${b.dataset.id}/${b.dataset.a}`, ecrit = b.dataset.cm === 'ecrits', av = b.dataset.cm === 'avis';
        if (b.dataset.a === 'retablir') {
          b.disabled = true; const y = await api('POST', url);
          if (!y.ok) { b.disabled = false; toast(y.d.erreur); return; }
          toast(ecrit ? 'Écrit rétabli : il est de nouveau visible.' : av ? 'Avis rétabli.' : 'Commentaire rétabli.'); console_(); return;
        }
        demander({ titre: ecrit ? 'Retirer cet écrit ?' : av ? 'Retirer cet avis ?' : 'Retirer ce commentaire ?', bouton: 'Retirer',
          corps: `${motif('Motif (l’auteur le verra)')}<p class="note">Exemple : « Propos blessants, contraires à la charte de la communauté. »</p>`,
          valider: async (f) => { const m = f.elements.motif.value.trim(); if (m.length < 3) return 'Indiquez un motif.'; const y = await api('POST', url, { motif: m }); if (!y.ok) return y.d.erreur; toast('Retiré : il n’est plus visible.'); console_(); } });
      }));
    },

    async signalements(el) {
      const r = await api('GET', '/api/admin/signalements');
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const S = r.d.signalements;
      el.innerHTML = S.length ? table(['Le', 'Livre', 'Par', 'Motif', 'État', ''], S.map((s) => `<tr>
        <td>${date(s.created_at)}</td><td>${esc(s.titre)}</td><td>${esc(s.par)}</td><td class="ad-motif">${esc(s.motif)}</td><td>${{ ouvert: 'Ouvert', traite: 'Traité', rejete: 'Rejeté' }[s.etat] || esc(s.etat)}</td>
        <td>${s.etat === 'ouvert' && peut('moderation') ? `<span class="row-acts"><button class="btn btn--sm" data-sig="${s.id}" data-e="traite">Traité</button><button class="btn btn--sm btn--ghost" data-sig="${s.id}" data-e="rejete">Rejeter</button></span>` : ''}</td></tr>`)) : vide('Aucun signalement.');
      $$('[data-sig]', el).forEach((b) => b.addEventListener('click', async () => { b.disabled = true; const y = await api('POST', `/api/admin/signalements/${b.dataset.sig}`, { etat: b.dataset.e }); if (!y.ok) { b.disabled = false; toast(y.d.erreur); return; } toast('Signalement clos.'); console_(); }));
      /* 21/10/2026 — écrits et commentaires signalés. « Retirer » cache l'écrit
         (ou le commentaire) pour tous, sans rien détruire ; le motif est gardé. */
      const re = await api('GET', '/api/admin/signalements-ecrits');
      const sec = document.createElement('section');
      sec.className = 'ad-sec';
      if (!re.ok) { sec.innerHTML = `<h2>Écrits et commentaires</h2><p class="warn">${esc(re.d.erreur)}</p>`; el.appendChild(sec); return; }
      const SE = re.d.signalements;
      sec.innerHTML = `<h2 style="margin-top:28px">Écrits et commentaires</h2>` + (SE.length ? table(['Le', 'Écrit signalé', 'Auteur', 'Par', 'Motif', 'État', ''], SE.map((x) => `<tr>
        <td>${date(x.created_at)}</td>
        <td class="ad-motif"><strong>${esc(x.titre || x.nature)}</strong><br><small class="ash">${x.commentaire_id ? `Commentaire : « ${esc((x.commentaire || '').slice(0, 200))} »` : esc((x.extrait || '').slice(0, 200))}</small></td>
        <td>${esc(x.auteur)}</td><td>${esc(x.par)}</td><td class="ad-motif">${esc(x.motif)}</td>
        <td>${{ ouvert: 'Ouvert', traite: 'Retiré', rejete: 'Rejeté' }[x.etat] || esc(x.etat)}</td>
        <td>${x.etat === 'ouvert' && peut('moderation') ? `<span class="row-acts"><input class="ad-motif-in" data-motif="${x.id}" placeholder="Motif du retrait" maxlength="300" aria-label="Motif du retrait"><button class="btn btn--sm" data-se="${x.id}" data-d="retirer">Retirer</button><button class="btn btn--sm btn--ghost" data-se="${x.id}" data-d="rejeter">Rejeter</button></span>` : ''}</td></tr>`)) : vide('Aucun écrit signalé.'));
      el.appendChild(sec);
      $$('[data-se]', sec).forEach((b) => b.addEventListener('click', async () => {
        const corps = { decision: b.dataset.d };
        if (b.dataset.d === 'retirer') { corps.motif = ($(`[data-motif="${b.dataset.se}"]`, sec).value || '').trim(); if (corps.motif.length < 3) { toast('Indiquez le motif du retrait (3 lettres au moins).'); return; } }
        b.disabled = true;
        const y = await api('POST', `/api/admin/signalements-ecrits/${b.dataset.se}`, corps);
        if (!y.ok) { b.disabled = false; toast(y.d.erreur); return; }
        toast(b.dataset.d === 'retirer' ? 'Retiré : il n’est plus visible.' : 'Signalement rejeté.'); console_();
      }));
    },

    async utilisateurs(el) {
      const q = sessionStorage.getItem('ad-q') || '';
      const r = await api('GET', `/api/admin/utilisateurs?q=${encodeURIComponent(q)}`);
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const U = r.d.utilisateurs;
      el.innerHTML = `<form class="tbl-tools" id="fq" role="search"><label class="ad-sel">Rechercher <input type="search" name="q" value="${esc(q)}" placeholder="Nom ou e-mail"></label><button class="btn btn--sm" type="submit">Chercher</button></form>
        ${U.length ? table(['Nom', 'E-mail', 'Rôle', 'Inscrit le', 'État', ''], U.map((u) => `<tr>
          <td>${esc(u.nom)}</td><td>${esc(u.email)}${u.email_verifie_at ? '' : ' <small class="ash">(non confirmé)</small>'}</td><td>${esc(u.role)}</td><td>${date(u.created_at)}</td><td>${u.actif ? 'Actif' : 'Désactivé'}</td>
          <td>${!peut('moderation') ? '' : `<button class="btn btn--sm btn--ghost" data-u="${u.id}" data-a="${u.actif ? 'desactiver' : 'reactiver'}">${u.actif ? 'Désactiver' : 'Réactiver'}</button>`}</td></tr>`)) : vide('Personne ne correspond.')}`;
      $('#fq').addEventListener('submit', (e) => { e.preventDefault(); sessionStorage.setItem('ad-q', e.target.elements.q.value.trim()); PANNEAUX.utilisateurs(el); });
      $$('[data-u]', el).forEach((b) => b.addEventListener('click', () => demander({ titre: b.dataset.a === 'desactiver' ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?', bouton: b.dataset.a === 'desactiver' ? 'Désactiver' : 'Réactiver',
        corps: `${motif('Motif (inscrit au journal)')}${b.dataset.a === 'desactiver' ? '<p class="note">Toutes ses sessions sont fermées immédiatement.</p>' : ''}`,
        valider: async (f) => { const m = f.elements.motif.value.trim(); if (m.length < 3) return 'Indiquez un motif.'; const y = await api('POST', `/api/admin/utilisateurs/${b.dataset.u}/${b.dataset.a}`, { motif: m }); if (!y.ok) return y.d.erreur; toast('Compte mis à jour.'); PANNEAUX.utilisateurs(el); } })));
    },

    async audit(el) {
      const r = await api('GET', '/api/admin/audit');
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      el.innerHTML = `<p class="note" style="margin:0 0 12px">Le journal est inaltérable : la base refuse toute modification ou suppression de ses lignes. 300 dernières entrées.</p>
        ${table(['Quand', 'Action', 'Ressource', 'Détail', 'Résultat', 'IP'], r.d.lignes.map((l) => `<tr class="${l.resultat === 'refus' ? 'ad-refus' : ''}"><td>${date(l.at)}</td><td class="mono">${esc(l.action)}</td><td class="mono">${esc(l.ressource || '')}</td><td>${esc(l.apres || '')}</td><td>${esc(l.resultat)}</td><td class="mono">${esc(l.ip || '')}</td></tr>`))}`;
    }
  };

  // Un lien vers une section (#paiements…) ouvre cette section, retour arrière compris
  addEventListener('hashchange', () => { const o = location.hash.slice(1); if (o && o !== onglet && ONGLETS.some(([k]) => k === o)) { onglet = o; console_(); } });
  console_();
})();
