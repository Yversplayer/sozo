/* Sōzō — connexion et création de compte (démonstration : aucun serveur). */
(() => {
  const S = window.SOZO, $ = (s, c = document) => c.querySelector(s);
  const suite = (() => {
    const v = S.q('suite') || 'decouvrir.html';
    // on ne revient que vers une page du logiciel (jamais une adresse extérieure)
    return /^[a-z-]+\.html(\?[^#]*)?(#.*)?$/i.test(v) && !v.startsWith('connexion') ? v : 'decouvrir.html';
  })();
  if (window.SozoAuth && SozoAuth.session) { location.replace(suite); return; }
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

        <p class="warn cx-demo">${S.icon('lock')}<span><strong>Démonstration, sans serveur.</strong> Aucun compte n’est créé en ligne : votre nom, votre e-mail et votre rôle restent sur cet appareil. Le mot de passe n’est ni envoyé, ni enregistré.</span></p>
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
  $('#forgot').addEventListener('click', (e) => { e.preventDefault(); S.modal({ title: 'Mot de passe oublié', body: '<p>Dans le vrai logiciel, un lien de réinitialisation vous sera envoyé par e-mail.</p><p class="warn">Aucun e-mail ne part dans cette démonstration : il n’y a ni serveur, ni compte en ligne.</p>', actions: [{ label: 'Compris' }] }); });

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function fail(form, msg, field) { form.querySelector('.cx-err').textContent = msg; if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); } }
  function enter(data) {
    if (!SozoAuth.open({ ...data, since: new Date().toISOString().slice(0, 10) })) {
      S.modal({ title: 'Connexion impossible', body: '<p>Ce navigateur bloque l’enregistrement local (navigation privée ?). Ouvrez Sōzō dans une fenêtre normale.</p>', actions: [{ label: 'Compris' }] });
      return;
    }
    location.replace(suite);
  }
  $('#fIn').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target; f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const email = f.email.value.trim(), p = f.pw.value;
    if (!EMAIL.test(email)) return fail(f, 'Cette adresse e-mail ne semble pas valide.', f.email);
    if (p.length < 8) return fail(f, 'Le mot de passe compte au moins 8 caractères.', f.pw);
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    enter({ name, email, role: 'lecteur' });
  });
  $('#fUp').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target; f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const name = f.name.value.trim(), email = f.email.value.trim(), p = f.pw.value;
    if (name.length < 2) return fail(f, 'Indiquez votre nom ou un pseudonyme (2 caractères au moins).', f.name);
    if (!EMAIL.test(email)) return fail(f, 'Cette adresse e-mail ne semble pas valide.', f.email);
    if (p.length < 8) return fail(f, 'Choisissez un mot de passe d’au moins 8 caractères.', f.pw);
    if (!f.cgu.checked) return fail(f, 'Merci d’accepter les conditions pour créer votre compte.', f.cgu);
    enter({ name, email, role: f.role.value });
  });
  show(mode0);
})();
