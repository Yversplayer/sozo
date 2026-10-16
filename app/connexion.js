/* Sōzō — connexion et création de compte (démonstration : aucun serveur). */
(() => {
  const S = window.SOZO, $ = (s, c = document) => c.querySelector(s);
  const suite = (() => {
    const v = S.q('suite') || 'decouvrir.html';
    // on ne revient que vers une page du logiciel (jamais une adresse extérieure)
    return /^[a-z-]+\.html(\?[^#]*)?(#.*)?$/i.test(v) && !v.startsWith('connexion') ? v : 'decouvrir.html';
  })();
  /* Déjà connecté ? C'est le serveur qui le dit (cookie HttpOnly). */
  fetch('/api/moi', { credentials: 'same-origin', cache: 'no-store' }).then((r) => r.ok ? r.json() : null)
    .then((d) => { if (d && !S.q('verifier')) { SozoAuth.garder(d.moi); location.replace(suite); } }).catch(() => {});
  const api = (methode, url, corps) => fetch(url, {
    method: methode, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': SozoAuth.csrf() },
    body: corps ? JSON.stringify(corps) : undefined
  }).then((r) => r.json().catch(() => ({})).then((d) => ({ ok: r.ok, status: r.status, d })))
    .catch(() => ({ ok: false, status: 0, d: { erreur: 'Le serveur ne répond pas. Vérifiez la connexion et réessayez.' } }));
  document.body.classList.add('cx-body');
  const mode0 = S.q('mode') === 'inscription' ? 'up' : 'in';

  document.getElementById('main').innerHTML = `
  <div class="cx">
    <aside class="cx-brand" aria-label="Sōzō">
      <img class="cx-photo" src="${S.img('foi-priere-lumiere')}" alt="">
      <div class="cx-brand-in">
        <a class="cx-logo" href="../index.html" aria-label="Sōzō — retour au site">${window.SOZO_LOGO || 'Sōzō'}</a>
        <p class="cx-tag">Heal your heart<br>Grown your faith<br>Glow your spirit</p>
        <span class="cx-rule" aria-hidden="true"></span>
        <p class="cx-motto">Plus qu’une application, un chemin.</p>
      </div>
    </aside>
    <main class="cx-main">
      <div class="cx-card">
        <a class="cx-back mono" href="../index.html">${S.icon('left')} Retour au site</a>
        <h1 id="cxTitle"></h1>
        <p class="cx-lead" id="cxLead"></p>
        <div class="cx-tabs" role="tablist" aria-label="Connexion ou inscription">
          <button type="button" role="tab" id="tabIn" aria-controls="fIn">Se connecter</button>
          <button type="button" role="tab" id="tabUp" aria-controls="fUp">Créer un compte</button>
        </div>

        <form class="cx-form" id="fIn" role="tabpanel" aria-labelledby="tabIn" novalidate>
          <label class="cx-field"><span>Adresse e-mail</span><input type="email" name="email" autocomplete="email" required></label>
          <label class="cx-field"><span>Mot de passe</span><span class="cx-pw"><input type="password" name="pw" autocomplete="current-password" required minlength="8"><button type="button" class="cx-eye" aria-label="Afficher le mot de passe" aria-pressed="false">${S.icon('eye')}</button></span></label>
          <p class="cx-row"><a href="#" id="forgot">Mot de passe oublié ?</a></p>
          <p class="cx-err" role="alert"></p>
          <button class="btn btn--accent cx-submit" type="submit">Se connecter ${S.icon('right')}</button>
        </form>

        <form class="cx-form" id="fUp" role="tabpanel" aria-labelledby="tabUp" novalidate hidden>
          <label class="cx-field"><span>Nom ou pseudonyme</span><input type="text" name="name" autocomplete="name" required minlength="2" maxlength="60"></label>
          <label class="cx-field"><span>Adresse e-mail</span><input type="email" name="email" autocomplete="email" required></label>
          <label class="cx-field"><span>Mot de passe <small>8 caractères au moins</small></span><span class="cx-pw"><input type="password" name="pw" autocomplete="new-password" required minlength="8"><button type="button" class="cx-eye" aria-label="Afficher le mot de passe" aria-pressed="false">${S.icon('eye')}</button></span>
            <span class="cx-meter" aria-hidden="true"><i></i></span></label>
          <fieldset class="cx-role"><legend>Je viens sur Sōzō pour…</legend>
            <label><input type="radio" name="role" value="lecteur" checked><span>${S.icon('book')}<b>Lire</b><small>Découvrir, suivre, acheter des pages</small></span></label>
            <label><input type="radio" name="role" value="auteur"><span>${S.icon('feather')}<b>Lire et publier</b><small>Ouvrir mon studio d’auteur</small></span></label>
          </fieldset>
          <label class="cx-check"><input type="checkbox" name="cgu" required><span>J’accepte les conditions d’utilisation et la politique de confidentialité <small>(textes à rédiger avant le lancement)</small>.</span></label>
          <p class="cx-err" role="alert"></p>
          <button class="btn btn--accent cx-submit" type="submit">Créer mon compte ${S.icon('right')}</button>
        </form>

        <p class="warn cx-demo" id="cxCapture" hidden>${S.icon('lock')}<span><strong>Envoi d’e-mails inactif sur ce serveur.</strong> Les comptes sont réels (mot de passe chiffré, session sécurisée), mais les e-mails de vérification et les codes sont préparés <strong>sans être envoyés</strong>.</span></p>
        <div class="cx-notice" id="notice" role="status" hidden></div>
      </div>
    </main>
  </div>`;

  const T = { in: ['Bon retour', 'Connectez-vous pour retrouver vos lectures, vos suivis et votre studio.'], up: ['Bienvenue sur [[Sōzō]]', 'Un compte suffit pour lire, suivre les auteurs et publier vos propres pages.'] };
  function show(m) {
    $('#fIn').hidden = m !== 'in'; $('#fUp').hidden = m !== 'up';
    $('#tabIn').setAttribute('aria-selected', String(m === 'in')); $('#tabUp').setAttribute('aria-selected', String(m === 'up'));
    S.ink($('#cxTitle'), T[m][0]); $('#cxLead').textContent = T[m][1];
    history.replaceState(null, '', `connexion.html?${m === 'up' ? 'mode=inscription&' : ''}suite=${encodeURIComponent(suite)}`);
  }
  $('#tabIn').addEventListener('click', () => show('in'));
  $('#tabUp').addEventListener('click', () => show('up'));
  document.querySelectorAll('.cx-eye').forEach((b) => b.addEventListener('click', () => {
    const i = b.previousElementSibling, on = i.type === 'password';
    i.type = on ? 'text' : 'password'; b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Masquer le mot de passe' : 'Afficher le mot de passe'); b.innerHTML = S.icon(on ? 'eyeOff' : 'eye');
  }));
  const pw = $('#fUp [name="pw"]');
  pw.addEventListener('input', () => {
    const v = pw.value; let sc = 0;
    if (v.length >= 8) sc++; if (v.length >= 12) sc++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) sc++; if (/\d/.test(v)) sc++; if (/[^\w\s]/.test(v)) sc++;
    const m = $('.cx-meter i'); m.style.width = (sc / 5 * 100) + '%'; m.dataset.level = sc < 2 ? 'faible' : sc < 4 ? 'moyen' : 'fort';
  });
  /* Mot de passe oublié : un CODE à 6 chiffres, reçu par e-mail, valable
     15 minutes. Le compte à rebours n'est qu'une indication : c'est le
     serveur qui décide si le code vaut encore. */
  async function demanderCode(email) {
    const r = await api('POST', '/api/comptes/reinitialisation', { email });
    return r;
  }
  $('#forgot').addEventListener('click', (e) => {
    e.preventDefault();
    S.modal({ title: 'Mot de passe oublié', body: `<p>Indiquez l’adresse de votre compte : nous y enverrons un <strong>code à 6 chiffres</strong>, valable 15 minutes.</p>
      <label class="cx-field"><span>Adresse e-mail</span><input type="email" id="fgMail" autocomplete="email" value="${S.esc($('#fIn').email.value)}"></label><p class="cx-err" id="fgErr" role="alert"></p>`,
      actions: [{ label: 'Annuler' }, { label: 'Recevoir un code', primary: true, onClick: async (close) => {
        const email = document.getElementById('fgMail').value.trim();
        if (!EMAIL.test(email)) { document.getElementById('fgErr').textContent = 'Cette adresse e-mail ne semble pas valide.'; return; }
        const r = await demanderCode(email);
        if (!r.ok) { document.getElementById('fgErr').textContent = r.d.erreur || 'La demande a échoué.'; return; }
        close(); saisirCode(email, r.d);
      } }] });
  });
  function saisirCode(email, d) {
    let fin = Date.now() + (d.minutes || 15) * 60000, renvoiDes = Date.now() + 60000, tic;
    const m = S.modal({ title: 'Saisissez votre code', body: `
      <p>Si un compte existe pour <strong>${S.esc(email)}</strong>, un code vient d’y être envoyé.${d.email === 'capture' ? ' <span class="cx-capture">L’envoi d’e-mails n’est pas encore activé sur ce serveur : le message est préparé mais ne part pas.</span>' : ''}</p>
      <label class="cx-field"><span>Code à 6 chiffres</span><input id="rzCode" class="cx-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" aria-describedby="rzTemps"></label>
      <p class="cx-temps" id="rzTemps" aria-live="polite"></p>
      <label class="cx-field"><span>Nouveau mot de passe <small>8 caractères au moins</small></span><input type="password" id="rzPw" autocomplete="new-password" minlength="8"></label>
      <p class="cx-err" id="rzErr" role="alert"></p>
      <button type="button" class="cx-renvoi" id="rzRenvoi" disabled>Renvoyer un code</button>`,
      actions: [{ label: 'Annuler', onClick: (close) => { clearInterval(tic); close(); } }, { label: 'Changer le mot de passe', primary: true, onClick: async (close) => {
        const code = document.getElementById('rzCode').value.replace(/\s/g, ''), nouveau = document.getElementById('rzPw').value, err = document.getElementById('rzErr');
        if (!/^\d{6}$/.test(code)) { err.textContent = 'Le code compte 6 chiffres.'; document.getElementById('rzCode').focus(); return; }
        if (nouveau.length < 8) { err.textContent = 'Le nouveau mot de passe doit faire au moins 8 caractères.'; document.getElementById('rzPw').focus(); return; }
        const r = await api('POST', '/api/comptes/reinitialisation/confirmer', { email, code, nouveau });
        if (!r.ok) { err.textContent = r.d.erreur || 'Échec.'; return; }
        clearInterval(tic); close();
        notice('Mot de passe changé. Toutes vos anciennes sessions sont fermées : connectez-vous avec le nouveau.');
        $('#fIn').email.value = email; $('#fIn').pw.focus();
      } }] });
    const temps = document.getElementById('rzTemps'), renvoi = document.getElementById('rzRenvoi');
    const maj = () => {
      const reste = Math.max(0, Math.round((fin - Date.now()) / 1000));
      temps.textContent = reste ? `Code valable encore ${Math.floor(reste / 60)} min ${String(reste % 60).padStart(2, '0')} s.` : 'Ce code a expiré : demandez-en un nouveau.';
      temps.classList.toggle('is-fini', !reste);
      renvoi.disabled = Date.now() < renvoiDes;
      if (!document.body.contains(temps)) clearInterval(tic);
    };
    renvoi.addEventListener('click', async () => {
      renvoi.disabled = true;
      const r = await demanderCode(email);
      if (!r.ok) { document.getElementById('rzErr').textContent = r.d.erreur || 'La demande a échoué.'; return; }
      fin = Date.now() + (r.d.minutes || 15) * 60000; renvoiDes = Date.now() + 60000;
      S.toast('Nouveau code demandé : l’ancien ne vaut plus.'); maj();
    });
    maj(); tic = setInterval(maj, 1000);
    setTimeout(() => document.getElementById('rzCode') && document.getElementById('rzCode').focus(), 80);
    return m;
  }
  function notice(html) { const n = $('#notice'); n.innerHTML = html; n.hidden = false; }

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function fail(form, msg, field) { form.querySelector('.cx-err').textContent = msg; if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); } }
  async function envoyer(f, url, corps) {
    const b = f.querySelector('.cx-submit'), txt = b.innerHTML;
    b.disabled = true; b.innerHTML = '<span class="spin" aria-hidden="true"></span> Un instant…';
    const r = await api('POST', url, corps);
    b.disabled = false; b.innerHTML = txt;
    if (!r.ok) {
      const champ = r.d.champ && f.querySelector(`[name="${{ mot_de_passe: 'pw', nom: 'name' }[r.d.champ] || r.d.champ}"]`);
      return fail(f, r.d.erreur || 'La demande a échoué.', champ);
    }
    SozoAuth.garder(r.d.moi);
    location.replace(suite);
  }
  $('#fIn').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target; f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const email = f.email.value.trim(), p = f.pw.value;
    if (!EMAIL.test(email)) return fail(f, 'Cette adresse e-mail ne semble pas valide.', f.email);
    if (!p) return fail(f, 'Indiquez votre mot de passe.', f.pw);
    envoyer(f, '/api/sessions', { email, mot_de_passe: p });
  });
  $('#fUp').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target; f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const nom = f.name.value.trim(), email = f.email.value.trim(), p = f.pw.value;
    if (nom.length < 2) return fail(f, 'Indiquez votre nom ou un pseudonyme (2 caractères au moins).', f.name);
    if (!EMAIL.test(email)) return fail(f, 'Cette adresse e-mail ne semble pas valide.', f.email);
    if (p.length < 8) return fail(f, 'Choisissez un mot de passe d’au moins 8 caractères.', f.pw);
    if (!f.cgu.checked) return fail(f, 'Merci d’accepter les conditions pour créer votre compte.', f.cgu);
    envoyer(f, '/api/comptes', { nom, email, mot_de_passe: p, role: f.role.value, cgu: true });
  });

  /* liens reçus par e-mail : vérification et réinitialisation */
  const jetonV = S.q('verifier');
  if (jetonV) {
    api('POST', '/api/comptes/verification', { jeton: jetonV }).then((r) => notice(r.ok ? 'Adresse e-mail confirmée. Merci !' : S.esc(r.d.erreur || 'Lien invalide.')));
  }
  // Le bandeau ne s'affiche que si le serveur dit lui-même que rien ne part
  fetch('/api/etat', { credentials: 'same-origin' }).then((r) => r.json()).then((d) => { const n = document.getElementById('cxCapture'); if (n) n.hidden = d.email !== 'capture'; }).catch(() => {});
  show(mode0);
})();
