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
  const ONGLETS = [['tableau', 'Tableau'], ['paiements', 'Paiements'], ['reversements', 'Reversements'], ['livres', 'Livres'], ['signalements', 'Signalements'], ['utilisateurs', 'Utilisateurs'], ['audit', 'Journal']];
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
      const n = { paiements: r.d.paiements_attente, reversements: r.d.reversements_attente, signalements: r.d.signalements }[k];
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
        ${[['Paiements à vérifier', d.paiements_attente, 'paiements'], ['Reversements demandés', d.reversements_attente, 'reversements'], ['Signalements ouverts', d.signalements, 'signalements']].map(([l, v, o]) => `<a class="at-card${v ? ' at-card--or' : ''}" href="#${o}" data-aller="${o}"><strong>${v}</strong><span class="at-card-l">${l}</span><small>${v ? 'À traiter' : 'Rien en attente'}</small></a>`).join('')}
        ${[['Encaissé (confirmé)', usd(d.encaisse)], ['Commission Sōzō', usd(d.commission)], ['Dû aux auteurs', usd(d.du_aux_auteurs)], ['Ventes confirmées', d.ventes], ['Utilisateurs actifs', d.utilisateurs], ['Dont auteurs', d.auteurs], ['Livres en ligne', d.livres]].map(([l, v]) => `<div class="at-card"><strong>${esc(v)}</strong><span class="at-card-l">${l}</span></div>`).join('')}
      </div>
      <p class="note">Les montants ne comptent que les paiements CONFIRMÉS. Aucun prestataire n’est branché : chaque paiement est déclaré par le lecteur et vérifié ici, à la main, sur le relevé de l’opérateur.</p>`;
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

    async signalements(el) {
      const r = await api('GET', '/api/admin/signalements');
      if (!r.ok) { el.innerHTML = `<p class="warn">${esc(r.d.erreur)}</p>`; return; }
      const S = r.d.signalements;
      el.innerHTML = S.length ? table(['Le', 'Livre', 'Par', 'Motif', 'État', ''], S.map((s) => `<tr>
        <td>${date(s.created_at)}</td><td>${esc(s.titre)}</td><td>${esc(s.par)}</td><td class="ad-motif">${esc(s.motif)}</td><td>${{ ouvert: 'Ouvert', traite: 'Traité', rejete: 'Rejeté' }[s.etat] || esc(s.etat)}</td>
        <td>${s.etat === 'ouvert' && peut('moderation') ? `<span class="row-acts"><button class="btn btn--sm" data-sig="${s.id}" data-e="traite">Traité</button><button class="btn btn--sm btn--ghost" data-sig="${s.id}" data-e="rejete">Rejeter</button></span>` : ''}</td></tr>`)) : vide('Aucun signalement.');
      $$('[data-sig]', el).forEach((b) => b.addEventListener('click', async () => { b.disabled = true; const y = await api('POST', `/api/admin/signalements/${b.dataset.sig}`, { etat: b.dataset.e }); if (!y.ok) { b.disabled = false; toast(y.d.erreur); return; } toast('Signalement clos.'); console_(); }));
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
