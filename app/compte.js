/* ═══════════════════════════════════════════════════════════
   Sōzō — Mon compte : profil, achats et reçus, sécurité, suppression.
   Tout vient du serveur (/api/compte) ; rien ne change à l'écran avant
   sa réponse. Un achat « en attente » le reste tant que Sōzō n'a pas
   vérifié le paiement : l'écran ne le présente jamais comme payé.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(() => {
  const S = window.SOZO, $ = (s, c = document) => c.querySelector(s);
  S.shell('compte');
  const main = $('#main');
  const API = window.SOZO_API;
  const ETATS = {
    CREATED: ['À payer', 'draft'], PENDING: ['En vérification', 'soon'], UNKNOWN: ['En vérification', 'soon'],
    CONFIRMED: ['Confirmé', 'owned'], FAILED: ['Refusé', 'locked'], CANCELLED: ['Annulé', 'draft'], EXPIRED: ['Expiré', 'draft']
  };
  const quoi = (a) => a.objet === 'plume' ? 'Abonnement Plume (30 jours)'
    : a.objet === 'livre' ? `${a.titre || 'Livre'} — tout le livre`
    : `${a.titre || 'Livre'} — ${a.page_de === a.page_a ? `page ${a.page_de}` : `pages ${a.page_de} à ${a.page_a}`}`;
  let c = null;

  async function charger() {
    const r = await API('GET', '/api/compte');
    if (!r.ok) throw new Error('compte ' + r.status);
    c = r.d;
    rendre();
  }

  function rendre() {
    const u = c.compte;
    const ini = ((u.nom || '?').trim().split(/\s+/).map((x) => x[0]).join('').slice(0, 2) || '?').toUpperCase();
    main.innerHTML = `<div class="wrap">
      <div class="cp-head">
        <span class="cp-av" aria-hidden="true">${S.esc(ini)}</span>
        <div><p class="kicker">Mon compte</p><h1>${S.esc(u.nom)}</h1>
          <p>${S.esc(u.email)} · ${u.role === 'auteur' ? 'lecteur et auteur' : 'lecteur'} · membre depuis le ${S.esc(S.dateLong(u.created_at).replace(/ à .*/, ''))}</p></div>
      </div>
      ${u.email_verifie_at ? '' : `<p class="warn" style="margin-bottom:18px">${S.icon('bell')}<span><strong>Adresse e-mail à confirmer.</strong> L’envoi des e-mails n’est pas encore branché sur Sōzō : le lien de confirmation est préparé mais ne part pas. Rien ne vous est bloqué en attendant.</span></p>`}
      <div class="cp-grid">
        <div class="cp-col">
          <section class="panel" aria-labelledby="hAchats">
            <h2 id="hAchats">Mes achats</h2>
            ${c.achats.length ? c.achats.map((a) => {
              const e = a.rembourse_le ? ['Remboursé', 'draft'] : (ETATS[a.etat] || [a.etat, 'draft']);
              return `<div class="cp-pay">
                <div><strong>${S.esc(quoi(a))}</strong><br><small>${S.esc(S.dateLong(a.created_at))}${a.reference ? ` · réf. ${S.esc(a.reference)}` : ''}${a.recu ? ` · reçu ${S.esc(a.recu)}` : ''}</small>
                  ${a.etat === 'FAILED' && a.motif_refus ? `<br><small>Motif : ${S.esc(a.motif_refus)}</small>` : ''}${a.rembourse_le ? `<br><small>Remboursé le ${S.esc(S.dateLong(a.rembourse_le))} : ${S.esc(a.motif_remboursement)}. L’accès a été retiré.</small>` : ''}</div>
                <div class="cp-pay-r"><strong>${S.money(a.montant / 100)}</strong><span class="badge badge--${e[1]}">${e[0]}</span>
                  ${a.etat === 'CREATED' ? `<button class="btn btn--sm" type="button" data-reprendre="${a.id}">Payer et déclarer</button>` : ''}
                  ${a.etat === 'CONFIRMED' && !a.rembourse_le && a.slug ? `<a class="btn btn--ghost btn--sm" href="livre.html?id=${encodeURIComponent(a.slug)}">Lire</a>` : ''}</div>
              </div>`;
            }).join('') : `<div class="empty"><strong>Aucun achat</strong>Les livres gratuits se lisent sans rien acheter. Un achat apparaîtra ici, avec son état et son reçu.</div>`}
            <p class="note">${S.icon('shield')} Un achat « en vérification » s’ouvre dès que Sōzō a confirmé votre paiement Mobile Money. Ce que vous avez payé reste à vous, même si l’auteur modifie son livre.</p>
          </section>
          ${u.role === 'auteur' ? `<section class="panel at-plume${c.plume.actif ? ' is-on' : ''}">
            <p class="mono">Plume · ${S.money(c.plume.prix)} pour 30 jours</p>
            <p>${c.plume.actif ? `<strong>Active jusqu’au ${S.esc(S.dateLong(c.plume.fin))}.</strong>` : 'Corrigez vos pages publiées en nouvelle version, avec historique, et payez moins de commission.'}</p>
            <button class="btn btn--accent" type="button" id="plume" style="margin-top:14px">${c.plume.actif ? 'Prolonger de 30 jours' : 'Passer à Plume'}</button>
          </section>` : `<section class="panel"><h2>Écrire sur Sōzō</h2><p class="ash">Publiez vos textes page par page, gratuitement ou contre paiement. Vous restez lecteur.</p><a class="btn btn--accent" href="studio.html" style="margin-top:14px">${S.icon('feather')} Ouvrir mon atelier</a></section>`}
        </div>
        <div class="cp-col">
          <form class="panel at-form" id="fProfil" novalidate>
            <h2>Mon profil</h2>
            <label class="cx-field">Nom affiché<input name="nom" maxlength="60" required value="${S.esc(u.nom)}" autocomplete="name"></label>
            <label class="cx-field">Ville <small>facultatif</small><input name="ville" maxlength="60" value="${S.esc(u.ville || '')}" autocomplete="address-level2"></label>
            ${u.role === 'auteur' ? `<label class="cx-field">Présentation d’auteur <small>visible par les lecteurs</small><textarea name="bio" maxlength="600" rows="4">${S.esc(u.bio || '')}</textarea></label>` : ''}
            <p class="cx-err" id="eProfil" role="alert"></p>
            <button class="btn btn--accent" type="submit">Enregistrer</button>
          </form>
          <form class="panel at-form" id="fMdp" novalidate>
            <h2>Mot de passe</h2>
            <label class="cx-field">Mot de passe actuel<input type="password" name="ancien" autocomplete="current-password" required></label>
            <label class="cx-field">Nouveau mot de passe <small>8 caractères au moins</small><input type="password" name="nouveau" autocomplete="new-password" minlength="8" required></label>
            <p class="cx-err" id="eMdp" role="alert"></p>
            <button class="btn" type="submit">Changer le mot de passe</button>
            <p class="note">${S.icon('lock')} Vos autres sessions (autres appareils) seront fermées.</p>
          </form>
          <form class="panel at-form cp-danger" id="fSuppr" novalidate>
            <h2>Supprimer mon compte</h2>
            <p class="ash">Votre nom, votre adresse, vos suivis et votre progression sont effacés, et vous êtes déconnecté. Les paiements restent enregistrés, sans votre nom (obligation comptable).</p>
            <label class="cx-field">Confirmez avec votre mot de passe<input type="password" name="mdp" autocomplete="current-password" required></label>
            <p class="cx-err" id="eSuppr" role="alert"></p>
            <button class="btn" type="submit">Supprimer définitivement</button>
          </form>
        </div>
      </div>
    </div>`;
    lier();
  }

  function occupe(f, on) { const b = f.querySelector('[type=submit]'); b.disabled = on; b.setAttribute('aria-busy', String(on)); }
  function lier() {
    main.querySelectorAll('[data-reprendre]').forEach((b) => b.addEventListener('click', () => {
      const a = c.achats.find((x) => x.id === +b.dataset.reprendre);
      S.buy.reprendre(a, charger);
    }));
    const pl = $('#plume'); if (pl) pl.addEventListener('click', () => S.buy.plume(c.plume.prix));

    const fp = $('#fProfil');
    fp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const corps = { nom: fp.elements.nom.value.trim(), ville: fp.elements.ville.value.trim() || null };
      if (fp.elements.bio) corps.bio = fp.elements.bio.value.trim() || null;
      occupe(fp, true);
      const r = await API('PATCH', '/api/compte', corps);
      occupe(fp, false);
      if (!r.ok) { $('#eProfil').textContent = r.d.erreur || 'Modification refusée.'; return; }
      SozoAuth.garder(null);                         // le nom affiché dans la barre a changé
      S.toast('Profil enregistré.');
      await charger();
    });

    const fm = $('#fMdp');
    fm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#eMdp'); err.textContent = '';
      if (fm.elements.nouveau.value.length < 8) { err.textContent = 'Le nouveau mot de passe doit faire 8 caractères au moins.'; fm.elements.nouveau.focus(); return; }
      occupe(fm, true);
      const r = await API('POST', '/api/moi/mot-de-passe', { ancien: fm.elements.ancien.value, nouveau: fm.elements.nouveau.value });
      occupe(fm, false);
      if (!r.ok) { err.textContent = r.d.erreur || 'Changement refusé.'; return; }
      fm.reset(); S.toast('Mot de passe changé. Vos autres sessions sont fermées.');
    });

    const fs = $('#fSuppr');
    fs.addEventListener('submit', (e) => {
      e.preventDefault();
      const mdp = fs.elements.mdp.value;
      if (!mdp) { $('#eSuppr').textContent = 'Indiquez votre mot de passe.'; return; }
      S.modal({ title: 'Supprimer votre compte ?', body: '<p>Cette action est définitive : votre compte ne pourra pas être rétabli.</p>',
        actions: [{ label: 'Garder mon compte' }, { label: 'Supprimer', primary: true, onClick: async (close) => {
          const r = await API('DELETE', '/api/compte', { mot_de_passe: mdp });
          close();
          if (!r.ok) { $('#eSuppr').textContent = r.d.erreur || 'Suppression refusée.'; return; }
          SozoAuth.garder(null);
          location.href = 'connexion.html';
        } }] });
    });
  }

  charger().then(() => S.footer()).catch(window.SOZO_ERREUR);
}).catch(window.SOZO_ERREUR);
