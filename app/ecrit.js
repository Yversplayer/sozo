/* ═══════════════════════════════════════════════════════════
   Sōzō — un écrit, en entier, avec ses commentaires (21/10/2026).
   On l'aime, on le garde, on le partage, on le commente ; on signale ce
   qui blesse. Un commentaire se retire par celui qui l'a écrit, ou par
   l'auteur de l'écrit. Rien n'apparaît avant la réponse du serveur.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, E = window.SOZO_ECRITS, $ = (s, c = document) => c.querySelector(s);
  const API = window.SOZO_API;
  S.shell('accueil');
  const main = $('#main');
  const id = +S.q('id');
  const r = id ? await API('GET', `/api/ecrits/${id}`) : { ok: false, d: {} };
  if (!r.ok) {
    main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Écrit introuvable</strong>Il a peut-être été retiré par son auteur.<br><br><a class="btn" href="decouvrir.html">Retour à l’accueil</a></div></div>`;
    S.footer(); return;
  }
  const e = r.d.ecrit;
  let coms = r.d.commentaires;
  document.title = `${e.titre || E.NATURES[e.nature]} — ${e.auteur.nom} — Sōzō`;

  main.innerHTML = `<div class="wrap vl-lecture-ecrit">
    <a class="vl-retour" href="javascript:history.back()">${S.icon('left')} Retour</a>
    ${e.mien ? `<p class="note">${S.icon('feather')} C’est votre ${S.esc(E.NATURES[e.nature].toLowerCase())}. <a href="ecrits.html?id=${e.id}">Le modifier</a></p>` : ''}
    <div id="ecrit">${E.carte(e, { entier: true })}</div>
    <section class="vl-coms" id="commentaires" aria-labelledby="comT">
      <h2 id="comT">Commentaires <span class="ash" id="nbCom"></span></h2>
      ${e.statut === 'publie' ? `<form class="vl-com-form" id="comForm" novalidate>
        <label class="sr" for="comTexte">Votre commentaire</label>
        <textarea id="comTexte" rows="2" maxlength="1000" placeholder="Un mot pour l’auteur…"></textarea>
        <div class="vl-com-a"><small class="ash">Restez bienveillant : chaque commentaire peut être signalé.</small><button class="btn btn--sm" type="submit">Publier</button></div>
        <p class="cx-err" id="comErr" role="alert"></p>
      </form>` : '<p class="ash">Cet écrit n’est pas publié : personne d’autre ne peut le lire ni le commenter.</p>'}
      <ol class="vl-com-l" id="comL"></ol>
      ${e.statut === 'publie' && !e.mien ? `<button class="ec-lien vl-signaler" type="button" id="signaler">${S.icon('shield')} Signaler cet écrit</button>` : ''}
    </section>
  </div>`;
  E.brancher($('#ecrit'), () => e);

  /* 22/10/2026 : des fils (un commentaire et ses réponses), et la correction
     de son propre commentaire dans les 15 minutes. */
  const unCom = (c) => `<li class="vl-com${c.parent ? ' vl-com--rep' : ''}" data-com="${c.id}">${S.monogramme(c.auteur.nom, c.parent ? 26 : 32)}
      <div><p class="vl-com-h"><strong>${S.esc(c.auteur.nom)}</strong> <small class="ash">${S.esc(E.depuis(c.le))}${c.modifie ? ' · modifié' : ''}</small></p>
      <p class="vl-com-t">${S.esc(c.texte).replace(/\n/g, '<br>')}</p>
      <p class="vl-com-acts">${e.statut === 'publie' ? `<button class="ec-lien" type="button" data-repondre="${c.parent || c.id}" data-a="${S.esc(c.auteur.nom)}">Répondre</button>` : ''}${c.peut_modifier ? `<button class="ec-lien" type="button" data-modifier="${c.id}">Modifier</button>` : ''}${c.peut_retirer ? `<button class="ec-lien" type="button" data-retirer="${c.id}">Retirer</button>` : ''}${c.auteur.id !== `u${S.sess().id}` ? `<button class="ec-lien" type="button" data-signaler-com="${c.id}">Signaler</button>` : ''}</p></div></li>`;
  function peindre() {
    $('#nbCom').textContent = coms.length ? `(${coms.length})` : '';
    const tetes = coms.filter((c) => !c.parent || !coms.some((x) => x.id === c.parent));
    $('#comL').innerHTML = coms.length ? tetes.map((c) => unCom(c) + coms.filter((x) => x.parent === c.id).map(unCom).join('')).join('')
      : `<li class="ash vl-com-vide">${e.statut === 'publie' ? 'Pas encore de commentaire. Le premier peut être le vôtre.' : ''}</li>`;
  }
  peindre();
  if (location.hash === '#commentaires') setTimeout(() => $('#commentaires').scrollIntoView({ block: 'start' }), 50);

  const form = $('#comForm');
  if (form) form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const t = $('#comTexte').value.trim(), err = $('#comErr');
    if (!t) { err.textContent = 'Écrivez d’abord votre commentaire.'; return; }
    const b = form.querySelector('button'); b.disabled = true; err.textContent = '';
    const rr = await API('POST', `/api/ecrits/${e.id}/commentaires`, { texte: t });
    b.disabled = false;
    if (!rr.ok) { err.textContent = rr.d.erreur || 'Le commentaire n’a pas été publié.'; return; }
    coms.push(rr.d.commentaire); $('#comTexte').value = ''; e.commentaires = coms.length; peindre();
    const nb = $('#ecrit .vl-geste[href*="commentaires"] span'); if (nb) nb.textContent = coms.length;
  });
  $('#comL').addEventListener('click', async (ev) => {
    const rep = ev.target.closest('[data-repondre]'), mod = ev.target.closest('[data-modifier]');
    if (rep) {
      document.querySelectorAll('.vl-com-reponse').forEach((x) => x.remove());
      const li = rep.closest('li');
      li.insertAdjacentHTML('afterend', `<li class="vl-com-reponse"><form class="vl-com-form" novalidate><label class="sr" for="repTexte">Votre réponse</label>
        <textarea id="repTexte" rows="2" maxlength="1000" placeholder="Répondre à ${S.esc(rep.dataset.a)}…"></textarea>
        <div class="vl-com-a"><button class="ec-lien" type="button" data-annuler>Annuler</button><button class="btn btn--sm" type="submit">Répondre</button></div><p class="cx-err" role="alert"></p></form></li>`);
      const fr = li.nextElementSibling.querySelector('form');
      fr.querySelector('textarea').focus();
      fr.querySelector('[data-annuler]').addEventListener('click', () => fr.closest('li').remove());
      fr.addEventListener('submit', async (e2) => {
        e2.preventDefault();
        const t = fr.querySelector('textarea').value.trim(); if (!t) return;
        const bt = fr.querySelector('[type=submit]'); bt.disabled = true;
        const r = await API('POST', `/api/ecrits/${e.id}/commentaires`, { texte: t, parent: +rep.dataset.repondre });
        bt.disabled = false;
        if (!r.ok) { fr.querySelector('.cx-err').textContent = r.d.erreur || 'La réponse n’a pas été publiée.'; return; }
        coms.push(r.d.commentaire); peindre();
      });
      return;
    }
    if (mod) {
      const c = coms.find((x) => x.id === +mod.dataset.modifier), li = mod.closest('li'), zone = li.querySelector('.vl-com-t');
      zone.outerHTML = `<form class="vl-com-edit"><textarea rows="2" maxlength="1000" aria-label="Corriger votre commentaire">${S.esc(c.texte)}</textarea>
        <div class="vl-com-a"><button class="ec-lien" type="button" data-annuler>Annuler</button><button class="btn btn--sm" type="submit">Enregistrer</button></div></form>`;
      const fe = li.querySelector('.vl-com-edit');
      fe.querySelector('textarea').focus();
      fe.querySelector('[data-annuler]').addEventListener('click', peindre);
      fe.addEventListener('submit', async (e2) => {
        e2.preventDefault();
        const t = fe.querySelector('textarea').value.trim(); if (!t) return;
        const r = await API('PATCH', `/api/commentaires/${c.id}`, { texte: t });
        if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); peindre(); return; }
        c.texte = r.d.texte; c.modifie = true; peindre();
      });
      return;
    }
    const ret = ev.target.closest('[data-retirer]'), sig = ev.target.closest('[data-signaler-com]');
    if (ret) {
      S.modal({ title: 'Retirer ce commentaire ?', body: '<p>Il disparaît de la page pour tout le monde.</p>', actions: [{ label: 'Annuler' }, { label: 'Retirer', primary: true, onClick: async (close) => {
        close();
        const rr = await API('DELETE', `/api/commentaires/${ret.dataset.retirer}`);
        if (!rr.ok) { S.toast(rr.d.erreur || 'Le serveur a refusé.'); return; }
        coms = coms.filter((c) => c.id !== +ret.dataset.retirer); peindre(); S.toast('Commentaire retiré.');
      } }] });
    }
    if (sig) signaler(+sig.dataset.signalerCom);
  });
  const sg = $('#signaler');
  if (sg) sg.addEventListener('click', () => signaler(null));
  function signaler(cid) {
    const m = S.modal({ title: cid ? 'Signaler ce commentaire' : 'Signaler cet écrit', body: `<p>Dites en quelques mots ce qui ne va pas. L’équipe de modération de Sōzō lit chaque signalement.</p>
      <label class="cx-field">Motif<textarea id="sigMotif" rows="3" maxlength="1000"></textarea></label><p class="cx-err" id="sigErr" role="alert"></p>`,
      actions: [{ label: 'Annuler' }, { label: 'Envoyer le signalement', primary: true, onClick: async (close) => {
        const motif = m.el.querySelector('#sigMotif').value.trim();
        if (motif.length < 5) { m.el.querySelector('#sigErr').textContent = 'Quelques mots, au moins cinq lettres.'; return; }
        const rr = await API('POST', `/api/ecrits/${e.id}/signaler`, cid ? { motif, commentaire: cid } : { motif });
        if (!rr.ok) { m.el.querySelector('#sigErr').textContent = rr.d.erreur || 'Le signalement n’est pas parti.'; return; }
        close(); S.toast('Merci : le signalement a été transmis à la modération.');
      } }] });
    setTimeout(() => m.el.querySelector('#sigMotif').focus(), 50);
  }
  S.footer();
}).catch(window.SOZO_ERREUR);
