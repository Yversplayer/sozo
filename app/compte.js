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
          <p>${S.esc(u.email)} · ${c.plume.actif ? `auteur · ${S.esc(c.plume.nom || 'Plume')}` : u.role === 'auteur' ? 'lecteur · premier livre offert' : 'lecteur'} · membre depuis le ${S.esc(S.dateLong(u.created_at).replace(/ à .*/, ''))}</p></div>
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
                  ${a.etat === 'CONFIRMED' && !a.rembourse_le && a.slug ? `<a class="btn btn--ghost btn--sm" href="livre.html?id=${encodeURIComponent(a.slug)}">Lire</a>` : ''}
                  ${a.recu ? `<a class="btn btn--ghost btn--sm" href="recu.html?id=${a.id}" target="_blank" rel="noopener">${S.icon('file')} Reçu</a>` : ''}</div>
              </div>`;
            }).join('') : `<div class="empty"><strong>Aucun achat</strong>Les livres gratuits se lisent sans rien acheter. Un achat apparaîtra ici, avec son état et son reçu.</div>`}
            <p class="note">${S.icon('shield')} Un achat « en vérification » s’ouvre dès que Sōzō a confirmé votre paiement Mobile Money. Ce que vous avez payé reste à vous, même si l’auteur modifie son livre.</p>
          </section>
          <section class="panel cp-notif" id="notifications" aria-labelledby="hNotif"><h2 id="hNotif">Notifications</h2><div id="notifIn"><p class="ash" role="status">Chargement…</p></div></section>
          <section class="panel at-plume${c.plume.actif ? ' is-on' : ''}" id="plume-section">
            <h2>Écrire des livres</h2>
            <p>${c.plume.actif ? `<strong>Votre offre ${S.esc(c.plume.nom || 'Plume')} court jusqu’au ${S.esc(S.dateLong(c.plume.fin))}.</strong>` : 'Vos écrits courts sont et resteront gratuits. Votre premier livre aussi. Plume vous ouvre davantage de livres, la vente et les outils d’auteur.'}</p>
            <button class="btn ${c.plume.actif ? 'btn--accent' : 'btn--ghost'}" type="button" id="plume" style="margin-top:14px">${S.icon('feather')} ${c.plume.actif ? 'Mon offre Plume' : 'Découvrir Plume'}</button>
          </section>
        </div>
        <div class="cp-col">
          <section class="panel" id="apparence" aria-labelledby="hTheme">
            <h2 id="hTheme">Apparence</h2>
            <div class="cp-theme" role="radiogroup" aria-labelledby="hTheme">
              ${[['clair', 'Clair', 'par défaut'], ['nocturne', 'Nocturne', 'fond sombre']].map(([v, l, s]) => `<label class="cp-theme-opt">
                <input type="radio" name="theme" value="${v}"${(u.theme === 'nocturne' ? 'nocturne' : 'clair') === v ? ' checked' : ''}>
                <span class="cp-theme-sw cp-theme-sw--${v}" aria-hidden="true"><i></i><i></i></span>
                <span><strong>${l}</strong><small>${s}</small></span></label>`).join('')}
            </div>
            <p class="cx-err" id="eTheme" role="alert"></p>
            <p class="note">${S.icon('eye')} Ce choix vous suit sur tous vos appareils, que vous lisiez ou que vous écriviez.</p>
          </section>
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
            <div class="cp-code">
              <button class="btn btn--ghost btn--sm" type="button" id="demCode">${S.icon('send')} Recevoir un code par e-mail</button>
              <p class="cx-temps" id="tCode" aria-live="polite"></p>
            </div>
            <label class="cx-field">Code reçu <small>6 chiffres, valable 15 minutes</small><input name="code" class="cx-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
            <p class="cx-err" id="eMdp" role="alert"></p>
            <button class="btn" type="submit">Changer le mot de passe</button>
            <p class="note">${S.icon('lock')} Le code prouve que c’est bien vous, même si quelqu’un a accès à cet appareil. Vos autres sessions seront fermées.</p>
          </form>
          <form class="panel at-form" id="fEmail" novalidate>
            <h2>Adresse e-mail</h2>
            <p class="ash">Actuelle : <strong>${S.esc(u.email)}</strong></p>
            <div id="emailEtape1">
              <label class="cx-field">Nouvelle adresse<input type="email" name="email" autocomplete="email" required></label>
              <label class="cx-field">Mot de passe actuel<input type="password" name="mdp" autocomplete="current-password" required></label>
              <button class="btn btn--ghost" type="button" id="emailCode">${S.icon('send')} Recevoir un code à la nouvelle adresse</button>
            </div>
            <div id="emailEtape2" hidden>
              <p class="note" id="emailEnvoi" aria-live="polite"></p>
              <label class="cx-field">Code reçu <small>6 chiffres</small><input name="code" class="cx-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"></label>
              <button class="btn" type="submit">Confirmer la nouvelle adresse</button>
            </div>
            <p class="cx-err" id="eEmail" role="alert"></p>
            <p class="note">${S.icon('shield')} Votre ancienne adresse sera prévenue, et vos autres sessions fermées.</p>
          </form>
          <section class="panel" aria-labelledby="hApp">
            <h2 id="hApp">Mes appareils</h2>
            <div id="appareils"><p class="ash" role="status">Chargement…</p></div>
            <button class="btn btn--ghost btn--sm" type="button" id="partout" style="margin-top:12px">${S.icon('lock')} Me déconnecter de tous les autres appareils</button>
          </section>
          <section class="panel" aria-labelledby="hAppli" id="appli">
            <h2 id="hAppli">L’application</h2>
            <p class="ash" id="appliTxt">${S.installer.installee() ? 'Sōzō est installé sur cet appareil.' : 'Installez Sōzō sur votre écran d’accueil : il s’ouvre comme une application, et les pages déjà lues restent lisibles sans réseau.'}</p>
            ${S.installer.installee() ? '' : `<button class="btn btn--accent btn--sm" type="button" id="installer" style="margin-top:12px">${S.icon('upload')} Installer Sōzō</button>`}
          </section>
          <section class="panel" aria-labelledby="hDon">
            <h2 id="hDon">Mes données</h2>
            <p class="ash">Tout ce que Sōzō garde de vous, en un fichier : votre profil, vos livres et leurs pages, vos écrits, vos commentaires, vos épingles, vos achats.</p>
            <a class="btn btn--ghost btn--sm" href="/api/moi/donnees" download="mes-donnees-sozo.json" style="margin-top:12px">${S.icon('upload')} Télécharger mes données</a>
          </section>
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
    lier(); lierCompte(); appareils();
  }

  /* ─── 21/10/2026 : appareils, adresse e-mail ─── */
  async function appareils() {
    const z = $('#appareils'); if (!z) return;
    const r = await window.SOZO_API('GET', '/api/moi/sessions');
    if (!r.ok) { z.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Liste indisponible.')}</span></p>`; return; }
    const nom = (ua) => (/iPhone|iPad/.test(ua) ? 'iPhone ou iPad' : /Android/.test(ua) ? 'Téléphone Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'PC Windows' : /Linux/.test(ua) ? 'Linux' : 'Appareil') + (/Edg\//.test(ua) ? ' · Edge' : /Chrome\//.test(ua) ? ' · Chrome' : /Safari\//.test(ua) ? ' · Safari' : /Firefox\//.test(ua) ? ' · Firefox' : '');
    z.innerHTML = `<ul class="cp-app">${r.d.sessions.map((x) => `<li><div><strong>${S.esc(nom(x.appareil))}</strong>${x.courante ? ' <span class="badge badge--free">cet appareil</span>' : ''}
        <br><small class="ash">depuis le ${S.esc(S.dateLong(x.depuis))}${x.vu ? ` · vu le ${S.esc(S.dateLong(x.vu))}` : ''}${x.ip ? ` · ${S.esc(x.ip)}` : ''}</small></div>
        ${x.courante ? '' : `<button class="btn btn--ghost btn--sm" type="button" data-fermer="${x.id}">Déconnecter</button>`}</li>`).join('')}</ul>`;
  }
  function lierCompte() {
    const z = $('#appareils');
    if (z) z.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-fermer]'); if (!b) return;
      b.disabled = true;
      const r = await window.SOZO_API('DELETE', `/api/moi/sessions/${b.dataset.fermer}`);
      if (!r.ok) { b.disabled = false; S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
      S.toast('Cet appareil est déconnecté.'); appareils();
    });
    const ins = $('#installer');
    if (ins) ins.addEventListener('click', () => S.installer.lancer());
    const pt = $('#partout');
    if (pt) pt.addEventListener('click', async () => {
      pt.disabled = true;
      const r = await window.SOZO_API('POST', '/api/moi/sessions/autres');
      pt.disabled = false;
      if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
      S.toast('Tous vos autres appareils sont déconnectés.'); appareils();
    });
    const fe = $('#fEmail');
    if (!fe) return;
    $('#emailCode').addEventListener('click', async () => {
      const err = $('#eEmail'); err.textContent = '';
      const email = fe.elements.email.value.trim(), mdp = fe.elements.mdp.value;
      if (!email || !mdp) { err.textContent = 'La nouvelle adresse et votre mot de passe, s’il vous plaît.'; return; }
      const b = $('#emailCode'); b.disabled = true;
      const r = await window.SOZO_API('POST', '/api/moi/email/code', { email, mot_de_passe: mdp });
      b.disabled = false;
      if (!r.ok) { err.textContent = r.d.erreur || 'Le serveur a refusé.'; return; }
      $('#emailEtape2').hidden = false;
      $('#emailEnvoi').innerHTML = r.d.email === 'capture'
        ? `${S.icon('bell')} L’envoi des e-mails n’est pas encore branché sur Sōzō : le code est préparé pour ${S.esc(r.d.envoye_a)}, mais il ne part pas encore.`
        : `${S.icon('send')} Un code vient de partir vers ${S.esc(r.d.envoye_a)}. Il est valable ${r.d.minutes} minutes.`;
      fe.elements.code.focus();
    });
    fe.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#eEmail'); err.textContent = '';
      const code = fe.elements.code.value.trim();
      if (!/^\d{6}$/.test(code)) { err.textContent = 'Saisissez le code à 6 chiffres.'; return; }
      occupe(fe, true);
      const r = await window.SOZO_API('POST', '/api/moi/email', { code });
      occupe(fe, false);
      if (!r.ok) { err.textContent = r.d.erreur || 'Le serveur a refusé.'; return; }
      try { localStorage.removeItem('sozo-moi'); } catch (er) {}
      S.toast('Votre nouvelle adresse est enregistrée.');
      setTimeout(() => location.reload(), 900);
    });
  }

  function occupe(f, on) { const b = f.querySelector('[type=submit]'); b.disabled = on; b.setAttribute('aria-busy', String(on)); }
  function lier() {
    main.querySelectorAll('[data-reprendre]').forEach((b) => b.addEventListener('click', () => {
      const a = c.achats.find((x) => x.id === +b.dataset.reprendre);
      S.buy.reprendre(a, charger);
    }));
    const pl = $('#plume'); if (pl) pl.addEventListener('click', () => S.buy.plume());

    main.querySelectorAll('input[name=theme]').forEach((r) => r.addEventListener('change', async () => {
      const avant = SozoTheme.get() === 'dark' ? 'nocturne' : 'clair';
      SozoTheme.set(r.value);                        // tout de suite : on voit l'effet en choisissant
      $('#eTheme').textContent = '';
      const q = await API('PATCH', '/api/compte', { theme: r.value });
      if (!q.ok) {                                   // refusé : on revient au thème d'avant, sans faux succès
        SozoTheme.set(avant);
        main.querySelector(`input[name=theme][value=${avant}]`).checked = true;
        $('#eTheme').textContent = q.d.erreur || 'Le thème n’a pas pu être enregistré.';
        return;
      }
      c.compte.theme = r.value;
      SozoAuth.garder(null);
      S.toast(r.value === 'clair' ? 'Thème clair enregistré.' : 'Thème nocturne enregistré.');
    }));

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
    let finCode = 0, ticCode;
    $('#demCode').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      const r = await API('POST', '/api/moi/mot-de-passe/code');
      if (!r.ok) { b.disabled = false; $('#eMdp').textContent = r.d.erreur || 'Envoi du code impossible.'; return; }
      finCode = Date.now() + (r.d.minutes || 15) * 60000;
      const t = $('#tCode');
      const maj = () => {
        if (!document.body.contains(t)) return clearInterval(ticCode);
        const reste = Math.max(0, Math.round((finCode - Date.now()) / 1000));
        t.textContent = (reste ? `Code envoyé à ${r.d.envoye_a}. Valable encore ${Math.floor(reste / 60)} min ${String(reste % 60).padStart(2, '0')} s.` : 'Le code a expiré : demandez-en un nouveau.')
          + (r.d.email === 'capture' ? ' (L’envoi d’e-mails n’est pas encore activé sur ce serveur.)' : '');
        t.classList.toggle('is-fini', !reste);
        if (reste < (r.d.minutes || 15) * 60 - 60) b.disabled = false;   // renvoi possible après une minute
      };
      clearInterval(ticCode); maj(); ticCode = setInterval(maj, 1000);
      fm.elements.code.focus();
    });
    fm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#eMdp'); err.textContent = '';
      if (fm.elements.nouveau.value.length < 8) { err.textContent = 'Le nouveau mot de passe doit faire 8 caractères au moins.'; fm.elements.nouveau.focus(); return; }
      occupe(fm, true);
      if (!/^\d{6}$/.test(fm.elements.code.value.trim())) { err.textContent = 'Saisissez le code à 6 chiffres reçu par e-mail.'; fm.elements.code.focus(); return; }
      const r = await API('POST', '/api/moi/mot-de-passe', { ancien: fm.elements.ancien.value, nouveau: fm.elements.nouveau.value, code: fm.elements.code.value.trim() });
      occupe(fm, false);
      if (!r.ok) { err.textContent = r.d.erreur || 'Changement refusé.'; return; }
      fm.reset(); clearInterval(ticCode); $('#tCode').textContent = ''; S.toast('Mot de passe changé. Vos autres sessions sont fermées.');
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

  /* ─── Notifications : appareil (Web Push), e-mail, préférences ─── */
  const b64 = (t) => { const p = '='.repeat((4 - (t.length % 4)) % 4), r = atob((t + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
  const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const iOS = /iPhone|iPad/.test(navigator.userAgent), installee = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  async function abonnementCourant() {
    if (!pushPossible()) return null;
    const reg = await navigator.serviceWorker.getRegistration('/app/');
    return reg ? reg.pushManager.getSubscription() : null;
  }
  async function notifPanneau() {
    const el = $('#notifIn'); if (!el) return;
    const r = await API('GET', '/api/notifications/preferences');
    if (!r.ok) { el.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Réglages indisponibles.')}</span></p>`; return; }
    const d = r.d, sub = await abonnementCourant().catch(() => null);
    let appareil;
    if (!d.push_actif) appareil = `<p class="ash">Les notifications sur l’appareil ne sont pas encore activées sur ce serveur.</p>`;
    else if (!pushPossible()) appareil = `<p class="ash">${iOS && !installee ? 'Sur iPhone et iPad : ajoutez d’abord Sōzō à l’écran d’accueil (bouton Partager → « Sur l’écran d’accueil »), puis ouvrez-le depuis son icône et revenez ici.' : 'Ce navigateur ne permet pas les notifications sur l’appareil.'}</p>`;
    else if (Notification.permission === 'denied') appareil = `<p class="warn">${S.icon('lock')}<span>Vous avez bloqué les notifications de Sōzō. Autorisez-les dans les réglages du navigateur (icône du cadenas, à gauche de l’adresse), puis rechargez la page.</span></p>`;
    else if (sub) appareil = `<p class="cp-ok">${S.icon('check')} Activées sur cet appareil.</p><div class="cp-acts"><button class="btn btn--sm" type="button" id="nTest">Envoyer une notification d’essai</button><button class="btn btn--ghost btn--sm" type="button" id="nOff">Désactiver ici</button></div>`;
    else appareil = `<p>Recevez les nouvelles pages, vos paiements et les alertes de sécurité directement sur ce téléphone ou cet ordinateur, même Sōzō fermé.</p><button class="btn btn--accent btn--sm" type="button" id="nOn">${S.icon('bell')} Activer sur cet appareil</button>`;
    el.innerHTML = `<div class="cp-app">${appareil}</div>
      ${d.appareils.length ? `<p class="mono ash cp-sous">Appareils inscrits</p><ul class="cp-appareils">${d.appareils.map((a) => `<li><span>${S.esc(a.libelle || 'Appareil')}<small>depuis le ${S.esc(S.dateLong(a.created_at).replace(/ à .*/, ''))}</small></span><button class="icon-btn" type="button" data-retirer="${a.id}" aria-label="Retirer ${S.esc(a.libelle || 'cet appareil')}">${S.icon('x')}</button></li>`).join('')}</ul>` : ''}
      <form id="fPrefs" class="cp-prefs"><table><thead><tr><th>Je veux être prévenu de…</th><th>Appareil</th><th>E-mail</th></tr></thead><tbody>
        ${d.ordre.map((k) => [k, d.types[k]]).map(([k, l]) => `<tr><td>${S.esc(l)}</td>
          <td><input type="checkbox" name="${k}:push" aria-label="${S.esc(l)} sur l’appareil"${d.preferences[k].push ? ' checked' : ''}></td>
          <td><input type="checkbox" name="${k}:email" aria-label="${S.esc(l)} par e-mail"${d.preferences[k].email ? ' checked' : ''}${d.toujours_email.includes(k) ? ' disabled title="Les alertes de sécurité partent toujours par e-mail"' : ''}></td></tr>`).join('')}
      </tbody></table>
      ${d.email ? '' : `<p class="note">${S.icon('lock')} L’envoi d’e-mails n’est pas encore activé sur ce serveur : vos choix seront appliqués dès qu’il le sera.</p>`}
      <p class="note">${S.icon('shield')} Les SMS et WhatsApp ne sont pas encore disponibles.</p>
      <button class="btn btn--sm" type="submit">Enregistrer mes choix</button></form>`;
    const on = $('#nOn');
    if (on) on.addEventListener('click', async () => {
      on.disabled = true;
      try {
        const reg = await navigator.serviceWorker.register('sw.js', { scope: '/app/' });
        await navigator.serviceWorker.ready;
        if (await Notification.requestPermission() !== 'granted') { notifPanneau(); return; }
        const sub2 = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(d.cle_publique) });
        const j = sub2.toJSON();
        const x = await API('POST', '/api/notifications/appareils', { endpoint: j.endpoint, keys: j.keys, libelle: S.libelleAppareil() });
        if (!x.ok) { await sub2.unsubscribe(); S.toast(x.d.erreur || 'Inscription refusée par le serveur.'); notifPanneau(); return; }
        try { localStorage.setItem('sozo-appareil-id', String(x.d.id)); } catch (e) {}
        S.toast('Notifications activées sur cet appareil.'); notifPanneau();
      } catch (e) { on.disabled = false; S.toast('Activation impossible sur ce navigateur.'); }
    });
    const off = $('#nOff');
    if (off) off.addEventListener('click', async () => {
      off.disabled = true;
      let id = null; try { id = localStorage.getItem('sozo-appareil-id'); } catch (e) {}
      if (id) await API('DELETE', `/api/notifications/appareils/${encodeURIComponent(id)}`);
      const s2 = await abonnementCourant(); if (s2) await s2.unsubscribe();
      S.toast('Notifications désactivées sur cet appareil.'); notifPanneau();
    });
    const t = $('#nTest');
    if (t) t.addEventListener('click', async () => {
      t.disabled = true;
      const x = await API('POST', '/api/notifications/test');
      S.toast(x.ok ? `Notification d’essai envoyée${x.d.appareils ? ` à ${x.d.appareils} appareil${x.d.appareils > 1 ? 's' : ''}` : ''}. Elle arrive en quelques secondes.` : (x.d.erreur || 'Essai impossible.'));
      setTimeout(() => { t.disabled = false; S.majCloche(); }, 4000);
    });
    el.querySelectorAll('[data-retirer]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const x = await API('DELETE', `/api/notifications/appareils/${b.dataset.retirer}`);
      if (!x.ok) { b.disabled = false; S.toast(x.d.erreur || 'Action impossible.'); return; }
      S.toast('Appareil retiré : il ne recevra plus rien.'); notifPanneau();
    }));
    $('#fPrefs').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget, prefs = {};
      d.ordre.forEach((k) => { prefs[k] = { push: f.elements[`${k}:push`].checked, email: f.elements[`${k}:email`].checked }; });
      const x = await API('PUT', '/api/notifications/preferences', { preferences: prefs });
      S.toast(x.ok ? 'Préférences enregistrées.' : (x.d.erreur || 'Enregistrement refusé.'));
    });
  }

  charger().then(() => { S.footer(); notifPanneau(); if (location.hash === '#notifications') setTimeout(() => $('#notifications').scrollIntoView(), 300); }).catch(window.SOZO_ERREUR);
}).catch(window.SOZO_ERREUR);
