/* ═══════════════════════════════════════════════════════════
   Sōzō — « Écrire » : mes écrits et la plume (21/10/2026).

   ecrits.html            la liste, comme des notes : brouillons, publiés, corbeille
   ecrits.html?nouveau=k  une page blanche (k : pensee, poeme, priere, recit, conte)
   ecrits.html?id=12      reprendre un écrit

   Un écrit s'enregistre seul, quelques secondes après la dernière frappe
   (il n'a pas d'historique de versions, contrairement à une page de livre).
   « Enregistré » et « Publié » n'apparaissent qu'après la réponse du serveur ;
   une copie de secours reste sur l'appareil tant que rien n'est confirmé.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, E = window.SOZO_ECRITS, $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const main = $('#main');
  const API = window.SOZO_API;
  const nouveau = S.q('nouveau'), idOuvert = +S.q('id') || null;
  const LIMITE = { pensee: 600, priere: 4000, poeme: 8000, recit: 30000, conte: 30000 };
  const FONDS = { ivoire: 'Ivoire', velours: 'Velours', nuit: 'Nuit', parchemin: 'Parchemin' };

  if (nouveau || idOuvert) return composer();
  S.shell('ecrits');
  return liste();

  /* ═══ la liste ═══ */
  async function liste() {
    main.innerHTML = `<div class="wrap vl-ecrits">
      <header class="vl-ecrits-h"><h1>Écrire</h1><p>Une phrase, un poème, une prière : commencez, Sōzō garde tout.</p>
        <div class="vl-serie" id="serie" aria-live="polite"></div></header>
      <section class="vl-plume-carte vl-velours" aria-label="Commencer un écrit">
        <div class="vl-natures">${Object.entries(E.NATURES).map(([k, l]) => `<a class="vl-nature" href="ecrits.html?nouveau=${k}"><strong>${S.esc(l)}</strong><small>${S.esc(E.AIDE[k])}</small></a>`).join('')}
          <a class="vl-nature vl-nature--livre" href="studio.html"><strong>Un livre</strong><small>Mes livres, page après page</small></a></div>
      </section>
      <div class="vl-onglets" role="tablist" aria-label="Mes écrits">
        <button role="tab" type="button" data-vue="brouillon" aria-selected="true">Brouillons <span data-n="brouillon"></span></button>
        <button role="tab" type="button" data-vue="publie" aria-selected="false">Publiés <span data-n="publie"></span></button>
        <button role="tab" type="button" data-vue="corbeille" aria-selected="false">Corbeille <span data-n="corbeille"></span></button>
      </div>
      <div class="vl-notes-outils">
        <button class="btn btn--ghost btn--sm" type="button" id="recueil">${S.icon('book')} Faire un recueil</button>
        <a class="btn btn--ghost btn--sm" href="/api/mes-ecrits/export.docx" download>${S.icon('file')} Exporter en Word</a>
      </div>
      <div class="vl-recueil-barre" id="recueilBarre" hidden><span id="recueilN">0 écrit choisi</span>
        <button class="btn btn--accent btn--sm" type="button" id="recueilOk" disabled>Créer le recueil</button><button class="btn btn--ghost btn--sm" type="button" id="recueilX">Annuler</button></div>
      <div class="vl-notes" id="notes" aria-busy="true"><p class="ash"><span class="spin" aria-hidden="true"></span> Chargement…</p></div>
    </div>`;
    serie();
    const r = await API('GET', '/api/mes-ecrits');
    const zone = $('#notes');
    zone.removeAttribute('aria-busy');
    if (!r.ok) { zone.innerHTML = `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Vos écrits n’ont pas pu se charger.')}</span></p>`; return; }
    const tous = r.d.ecrits;
    const groupe = (e) => (e.corbeille_le ? 'corbeille' : e.statut === 'publie' ? 'publie' : 'brouillon');
    ['brouillon', 'publie', 'corbeille'].forEach((k) => { const n = tous.filter((e) => groupe(e) === k).length; $(`[data-n="${k}"]`).textContent = n || ''; });
    let vue = tous.some((e) => groupe(e) === 'brouillon') || !tous.some((e) => groupe(e) === 'publie') ? 'brouillon' : 'publie';
    const premiere = (e) => (e.titre || e.texte.split('\n').find((l) => l.trim()) || '').replace(/^(#{1,2} |> )/, '').replace(/\*+/g, '');
    const peindre = () => {
      $$('[data-vue]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vue === vue)));
      const l = tous.filter((e) => groupe(e) === vue);
      zone.innerHTML = l.length ? `<ul class="vl-notes-l">${l.map((e) => `<li>${choix && vue !== 'corbeille' ? `<label class="vl-choix"><input type="checkbox" data-choix="${e.id}"${choisis.includes(e.id) ? ' checked' : ''} aria-label="Ajouter au recueil"><span>${choisis.includes(e.id) ? choisis.indexOf(e.id) + 1 : ''}</span></label>` : ''}<a class="vl-note" href="ecrits.html?id=${e.id}">
          <span class="vl-note-n">${S.esc(E.NATURES[e.nature])}</span>
          <strong>${S.esc(premiere(e).slice(0, 90)) || '(sans texte)'}</strong>
          <small>${e.retire ? 'Retiré par la modération · ' : ''}${e.programme ? `Programmé pour le ${S.esc(S.dateLong(e.publie_le))} · ` : ''}${S.esc(E.depuis(e.maj))}${e.statut === 'publie' && !e.corbeille_le ? ` · ${e.jaime} j’aime · ${e.commentaires} commentaire${e.commentaires > 1 ? 's' : ''}` : ''}</small>
        </a>${vue === 'corbeille' ? `<span class="row-acts"><button class="btn btn--ghost btn--sm" type="button" data-restaurer="${e.id}">${S.icon('restaurer')} Récupérer</button><button class="btn btn--ghost btn--sm" type="button" data-effacer="${e.id}">Supprimer définitivement</button></span>` : ''}</li>`).join('')}</ul>`
        : `<div class="empty"><strong>${{ brouillon: 'Aucun brouillon', publie: 'Rien de publié pour l’instant', corbeille: 'La corbeille est vide' }[vue]}</strong>${vue === 'corbeille' ? 'Un écrit jeté arrive ici ; il se récupère quand vous voulez.' : 'Choisissez ci-dessus ce que vous voulez écrire.'}</div>`;
    };
    /* Recueil (22/10/2026) : cocher des écrits, dans l'ordre voulu, puis en faire un livre */
    let choix = false, choisis = [];
    const majChoix = () => { $('#recueilN').textContent = `${choisis.length} écrit${choisis.length > 1 ? 's' : ''} choisi${choisis.length > 1 ? 's' : ''}, dans l’ordre des numéros`; $('#recueilOk').disabled = !choisis.length; };
    $('#recueil').addEventListener('click', () => { choix = true; choisis = []; $('#recueilBarre').hidden = false; if (vue === 'corbeille') vue = 'brouillon'; majChoix(); peindre(); });
    $('#recueilX').addEventListener('click', () => { choix = false; choisis = []; $('#recueilBarre').hidden = true; peindre(); });
    zone.addEventListener('change', (e) => {
      const c = e.target.closest('[data-choix]'); if (!c) return;
      const id = +c.dataset.choix;
      choisis = c.checked ? [...choisis, id] : choisis.filter((x) => x !== id);
      majChoix(); peindre();
    });
    $('#recueilOk').addEventListener('click', async () => {
      const st = await API('GET', '/api/studio');
      const cats = st.ok && st.d.categories ? st.d.categories : ['Poésie'];
      const m = S.modal({ title: 'Un recueil', body: `<p>Chaque écrit devient une page, dans l’ordre choisi. Le livre naît en brouillons : rien ne paraît avant que vous le décidiez.</p>
        <label class="cx-field">Titre du recueil<input id="rcTitre" maxlength="120"></label>
        <label class="cx-field">Genre<select id="rcCat">${cats.map((c) => `<option${c === 'Poésie' ? ' selected' : ''}>${S.esc(c)}</option>`).join('')}</select></label><p class="cx-err" id="rcErr" role="alert"></p>`,
        actions: [{ label: 'Annuler' }, { label: 'Créer le recueil', primary: true, onClick: async () => {
          const titre = m.el.querySelector('#rcTitre').value.trim(), err = m.el.querySelector('#rcErr');
          if (!titre) { err.textContent = 'Donnez un titre au recueil.'; return; }
          let r = await API('POST', '/api/studio/recueils', { titre, categorie: m.el.querySelector('#rcCat').value, ecrits: choisis });
          if (r.status === 403 && r.d.code === 'pas_auteur') {
            const d = await API('POST', '/api/compte/devenir-auteur');
            if (d.ok) r = await API('POST', '/api/studio/recueils', { titre, categorie: m.el.querySelector('#rcCat').value, ecrits: choisis });
          }
          if (!r.ok) { err.textContent = r.d.erreur || 'Le recueil n’a pas pu être créé.'; return; }
          location.href = `studio.html?id=${encodeURIComponent(r.d.livre.id)}&tab=pages`;
        } }] });
      setTimeout(() => m.el.querySelector('#rcTitre').focus(), 50);
    });
    peindre();
    $$('[data-vue]').forEach((b) => b.addEventListener('click', () => { vue = b.dataset.vue; peindre(); }));
    zone.addEventListener('click', async (e) => {
      const ef = e.target.closest('[data-effacer]');
      if (ef) {
        if (ef.dataset.sur !== '1') { ef.dataset.sur = '1'; ef.textContent = 'Confirmer : effacer pour toujours'; return; }   // deux temps
        ef.disabled = true;
        const rr = await API('DELETE', `/api/ecrits/${ef.dataset.effacer}/definitif`);
        if (!rr.ok) { ef.disabled = false; S.toast(rr.d.erreur || 'Le serveur a refusé.'); return; }
        const i = tous.findIndex((x) => x.id === +ef.dataset.effacer); tous.splice(i, 1);
        ['brouillon', 'publie', 'corbeille'].forEach((k) => { const n = tous.filter((x) => groupe(x) === k).length; $(`[data-n="${k}"]`).textContent = n || ''; });
        peindre(); S.toast('Effacé pour de bon.');
        return;
      }
      const b = e.target.closest('[data-restaurer]'); if (!b) return;
      b.disabled = true;
      const rr = await API('POST', `/api/ecrits/${b.dataset.restaurer}/restaurer`);
      if (!rr.ok) { b.disabled = false; S.toast(rr.d.erreur || 'Le serveur a refusé.'); return; }
      const i = tous.findIndex((x) => x.id === rr.d.ecrit.id); tous[i] = rr.d.ecrit;
      ['brouillon', 'publie', 'corbeille'].forEach((k) => { const n = tous.filter((x) => groupe(x) === k).length; $(`[data-n="${k}"]`).textContent = n || ''; });
      peindre(); S.toast('Récupéré.');
    });
    S.footer();
  }

  /* La série d'écriture : discrète, jamais une obligation */
  async function serie() {
    const r = await API('GET', '/api/moi/serie');
    const z = $('#serie'); if (!r.ok || !z) return;
    const J = ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'];
    z.innerHTML = `<span class="vl-serie-n">${r.d.serie ? `${S.icon('feather')} ${r.d.serie} jour${r.d.serie > 1 ? 's' : ''} d’écriture d’affilée` : 'Écrivez aujourd’hui pour commencer une série'}</span>
      <span class="vl-serie-j" aria-label="Vos sept derniers jours">${r.d.semaine.map((j) => `<i class="${j.ecrit ? 'is-on' : ''}" title="${S.esc(S.dateLong(j.jour + 'T12:00:00Z').replace(/ à .*/, ''))}${j.ecrit ? ' : vous avez écrit' : ''}">${J[new Date(j.jour + 'T12:00:00Z').getUTCDay()]}</i>`).join('')}</span>`;
  }

  /* ═══ la plume : écrire un écrit ═══ */
  async function composer() {
    document.body.classList.add('ecriture', 'vl-composer');
    let ecrit = null;
    if (idOuvert) {
      const r = await API('GET', `/api/ecrits/${idOuvert}`);
      if (!r.ok || !r.d.ecrit.mien) {
        main.innerHTML = `<div class="wrap sec"><div class="empty"><strong>Écrit introuvable</strong>Il n’existe pas, ou il n’est pas le vôtre.<br><br><a class="btn" href="ecrits.html">Mes écrits</a></div></div>`;
        return;
      }
      ecrit = r.d.ecrit;
    }
    const etat = {
      nature: ecrit ? ecrit.nature : (E.NATURES[nouveau] ? nouveau : 'pensee'),
      titre: ecrit ? ecrit.titre : '',
      apparence: ecrit ? { ...ecrit.apparence } : {},
      themes: ecrit ? [...(ecrit.themes || [])] : [],
    };
    const CLE = `sozo-ecrit:${ecrit ? ecrit.id : 'nouveau'}`;
    let secours = null;
    try { secours = JSON.parse(localStorage.getItem(CLE)); } catch (e) {}
    const lectureSeule = ecrit && (ecrit.retire || ecrit.corbeille_le);

    main.innerHTML = `
    <header class="ec-barre">
      <a class="icon-btn" href="ecrits.html" aria-label="Mes écrits">${S.icon('left')}</a>
      <div class="ec-titre"><strong id="cTitreBarre"></strong><span id="cEtat" role="status" aria-live="polite"></span></div>
      <div class="ec-outils">
        ${ecrit && ecrit.statut === 'publie' && !lectureSeule ? `<a class="btn btn--ghost btn--sm" href="ecrit.html?id=${ecrit.id}">${S.icon('eye')} <span class="ec-l">Voir</span></a>` : ''}
        ${ecrit && !lectureSeule ? `<button class="icon-btn" type="button" id="cJeter" aria-label="Mettre à la corbeille" title="Mettre à la corbeille">${S.icon('corbeille')}</button>` : ''}
        ${lectureSeule ? '' : `<button class="btn btn--ghost btn--sm" type="button" id="cProgrammer">${S.icon('clock')} <span class="ec-l">Programmer</span></button><button class="btn btn--sm" type="button" id="cPublier"></button>`}
      </div>
    </header>
    <div class="ec vl-compo">
      ${ecrit && ecrit.retire ? `<p class="warn ec-msg">${S.icon('shield')}<span>Cet écrit a été retiré par la modération : il ne se modifie plus et n’est plus visible.</span></p>` : ''}
      ${ecrit && ecrit.corbeille_le ? `<p class="warn ec-msg">${S.icon('corbeille')}<span>Cet écrit est dans la corbeille. <button class="btn btn--sm" type="button" id="cRestaurer">Le récupérer</button></span></p>` : ''}
      ${secours && !lectureSeule && (secours.texte !== (ecrit ? ecrit.texte : '') || secours.titre !== etat.titre) ? `<p class="warn ec-msg" id="cSecours">${S.icon('clock')}<span>Une copie plus récente est restée sur cet appareil. <button class="btn btn--sm" type="button" id="cReprendre">La reprendre</button> <button class="btn btn--ghost btn--sm" type="button" id="cOublier">L’oublier</button></span></p>` : ''}
      <div class="vl-compo-natures" role="radiogroup" aria-label="Ce que vous écrivez">${Object.entries(E.NATURES).map(([k, l]) => `<button type="button" role="radio" class="chip" data-nature="${k}" aria-checked="${etat.nature === k}" aria-pressed="${etat.nature === k}"${lectureSeule ? ' disabled' : ''}>${S.esc(l)}</button>`).join('')}</div>
      <div class="vl-compo-themes" role="group" aria-label="Thèmes (trois au plus)"><span class="ash">Thèmes</span>${['Espérance', 'Foi', 'Louange', 'Gratitude', 'Pardon', 'Paix', 'Amour', 'Famille', 'Courage', 'Épreuve', 'Deuil', 'Guérison'].map((t) => `<button type="button" class="chip chip--sm" data-theme="${S.esc(t)}" aria-pressed="${etat.themes.includes(t)}"${lectureSeule ? ' disabled' : ''}>${S.esc(t)}</button>`).join('')}</div>
      <label class="sr" for="cTitre">Titre</label>
      <input class="vl-compo-titre" id="cTitre" maxlength="120" placeholder="Titre (facultatif)" value="${S.esc(etat.titre)}"${lectureSeule ? ' readonly' : ''}>
      <div id="barre"></div>
      <div id="doc" aria-label="Votre texte"></div>
      <section class="vl-compo-fond" aria-label="Apparence">
        <p class="kicker">Le fond de votre écrit</p>
        <div class="vl-fonds" role="radiogroup" aria-label="Fond">${Object.entries(FONDS).map(([k, l]) => `<button type="button" role="radio" class="vl-fond vl-fond-${k}" data-fond="${k}" aria-checked="${(etat.apparence.fond || 'ivoire') === k}"${lectureSeule ? ' disabled' : ''}><span>Aa</span>${l}</button>`).join('')}</div>
        <label class="pl-coche"><input type="checkbox" id="cGrand"${etat.apparence.taille === 'grande' ? ' checked' : ''}${lectureSeule ? ' disabled' : ''}> Texte en grand</label>
        <p class="kicker" style="margin-top:18px">Aperçu, tel que les lecteurs le verront</p>
        <div id="apercu"></div>
      </section>
      <footer class="ec-pied"><span id="count"></span></footer>
    </div>`;

    const ed = window.SOZO_PLUME.editeur({
      barre: $('#barre'), doc: $('#doc'),
      reglages: { police: etat.apparence.police || (['recit', 'conte'].includes(etat.nature) ? 'georgia' : 'cormorant'), alignement: etat.apparence.alignement || (['poeme', 'pensee', 'priere'].includes(etat.nature) ? 'centre' : 'gauche') },
      etiquette: () => 'Votre texte',
      surReglage: (k, v) => { etat.apparence[k] = v; change(); },
      surSaisie: () => change()
    });
    const f = ed.ajouter({ cle: 'texte', texte: ecrit ? ecrit.texte : '', verrou: lectureSeule });
    f.el.dataset.placeholder = { pensee: 'Une phrase qui vous habite…', poeme: 'Le premier vers…', priere: 'Seigneur,…', recit: 'Il était une fois, ou un matin comme les autres…', conte: 'Il était une fois…' }[etat.nature];
    let enregistre = ecrit ? JSON.stringify([ecrit.nature, ecrit.titre, ecrit.texte, ecrit.apparence, ecrit.themes || []]) : JSON.stringify([etat.nature, '', '', {}, []]);
    const courant = () => JSON.stringify([etat.nature, $('#cTitre').value.trim(), ed.texte(f), nettoyerApp(), etat.themes]);
    const nettoyerApp = () => { const a = {}; ['police', 'alignement', 'fond', 'taille'].forEach((k) => { if (etat.apparence[k]) a[k] = etat.apparence[k]; }); return a; };
    let envoi = null, tAuto = null;
    const marque = (t) => { $('#cEtat').textContent = t; };

    function peindreEtat() {
      const pub = ecrit && ecrit.statut === 'publie';
      $('#cTitreBarre').textContent = `${E.NATURES[etat.nature]}${pub ? ' publié' + (etat.nature === 'pensee' || etat.nature === 'priere' ? 'e' : '') : ''}`;
      const pg = $('#cProgrammer');
      if (pg) pg.hidden = !!(pub && !(ecrit && ecrit.programme));
      const b = $('#cPublier');
      if (b && ecrit && ecrit.programme) { b.textContent = 'Publier maintenant'; b.setAttribute('aria-label', 'Publier maintenant, sans attendre la date prévue'); b.className = 'btn btn--accent btn--sm'; }
      else if (b) { b.textContent = pub ? 'Dépublier' : 'Publier'; b.setAttribute('aria-label', pub ? 'Retirer de la publication (il redevient un brouillon)' : 'Publier'); b.className = pub ? 'btn btn--ghost btn--sm' : 'btn btn--accent btn--sm'; }
      $$('[data-nature]').forEach((x) => { x.setAttribute('aria-checked', String(x.dataset.nature === etat.nature)); x.setAttribute('aria-pressed', String(x.dataset.nature === etat.nature)); });
      $$('[data-fond]').forEach((x) => x.setAttribute('aria-checked', String((etat.apparence.fond || 'ivoire') === x.dataset.fond)));
    }
    function apercu() {
      const e = { id: 0, nature: etat.nature, titre: $('#cTitre').value.trim(), texte: ed.texte(f) || ' ', apparence: nettoyerApp(), themes: etat.themes, statut: 'brouillon', auteur: { id: S.sess().id ? `u${S.sess().id}` : '', nom: S.sess().name || 'Vous' }, moi: {}, jaime: 0, commentaires: 0 };
      $('#apercu').innerHTML = E.carte(e, { entier: true });
    }
    function compter() {
      const t = ed.plat(f), n = ed.mots(t), lim = LIMITE[etat.nature];
      const trop = ed.texte(f).length > lim;
      $('#count').innerHTML = `${n} mot${n > 1 ? 's' : ''} · ${ed.texte(f).length.toLocaleString('fr-FR')} / ${lim.toLocaleString('fr-FR')} signes${trop ? ` · <strong class="vl-trop">trop long pour ${E.NATURES[etat.nature].toLowerCase() === 'pensée' ? 'une pensée' : 'ce format'}</strong>` : ''}`;
      return !trop;
    }
    function change() {
      if (lectureSeule) return;
      compter(); apercu();
      const sale = courant() !== enregistre;
      if (sale) {
        marque('modifié');
        try { localStorage.setItem(CLE, JSON.stringify({ titre: $('#cTitre').value.trim(), texte: ed.texte(f) })); } catch (e) {}
        clearTimeout(tAuto); tAuto = setTimeout(() => enregistrer(), 3000);
      }
    }
    async function enregistrer() {
      if (lectureSeule) return true;
      if (courant() === enregistre) return true;
      if (envoi) return envoi;
      const texte = ed.texte(f);
      if (!texte.trim()) { marque(ecrit ? 'le texte est vide : rien n’est enregistré' : ''); return false; }
      if (!compter()) { marque('trop long : rien n’est enregistré'); return false; }
      const corps = { nature: etat.nature, titre: $('#cTitre').value.trim(), texte, apparence: nettoyerApp(), themes: etat.themes };
      const instantane = courant();
      marque('enregistrement…');
      envoi = (ecrit ? API('PATCH', `/api/ecrits/${ecrit.id}`, corps) : API('POST', '/api/ecrits', corps)).then((r) => {
        envoi = null;
        if (!r.ok) { marque(r.status === 0 ? 'hors ligne · copie gardée sur cet appareil' : 'non enregistré'); S.toast(r.d.erreur || 'Le serveur a refusé.'); return false; }
        const premier = !ecrit;
        ecrit = r.d.ecrit; enregistre = instantane;
        try { localStorage.removeItem(CLE); if (premier) localStorage.removeItem('sozo-ecrit:nouveau'); } catch (e) {}
        if (premier) history.replaceState(null, '', `ecrits.html?id=${ecrit.id}`);
        marque(`enregistré ${ecrit.statut === 'publie' ? '· publié' : '· brouillon visible par vous seul'}`);
        peindreEtat();
        if (courant() !== enregistre) change();
        return true;
      });
      return envoi;
    }

    $('#cTitre').addEventListener('input', change);
    $$('.vl-compo-themes [data-theme]').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.theme;
      if (etat.themes.includes(t)) etat.themes = etat.themes.filter((x) => x !== t);
      else if (etat.themes.length >= 3) { S.toast('Trois thèmes au plus.'); return; }
      else etat.themes = [...etat.themes, t];
      $$('.vl-compo-themes [data-theme]').forEach((x) => x.setAttribute('aria-pressed', String(etat.themes.includes(x.dataset.theme))));
      change();
    }));
    $$('[data-nature]').forEach((b) => b.addEventListener('click', () => { etat.nature = b.dataset.nature; peindreEtat(); change(); }));
    $$('[data-fond]').forEach((b) => b.addEventListener('click', () => { etat.apparence.fond = b.dataset.fond === 'ivoire' ? undefined : b.dataset.fond; peindreEtat(); change(); }));
    $('#cGrand').addEventListener('change', (e) => { etat.apparence.taille = e.target.checked ? 'grande' : undefined; change(); });
    const pub = $('#cPublier');
    if (pub) pub.addEventListener('click', async () => {
      pub.disabled = true;
      const ok = await enregistrer();
      if (!ok || !ecrit) { pub.disabled = false; if (!ed.texte(f).trim()) S.toast('Écrivez d’abord quelque chose.'); return; }
      const vers = ecrit.programme ? 'publier' : ecrit.statut === 'publie' ? 'depublier' : 'publier';   // un écrit programmé se publie tout de suite
      const r = await API('POST', `/api/ecrits/${ecrit.id}/${vers}`);
      pub.disabled = false;
      if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
      ecrit = r.d.ecrit; peindreEtat();
      marque(vers === 'publier' ? 'publié' : 'retiré de la publication · brouillon');
      if (vers === 'publier') {
        S.modal({ title: 'C’est publié', body: `<p>Votre ${E.NATURES[ecrit.nature].toLowerCase()} est maintenant lisible par tous les membres de Sōzō, qui peuvent l’aimer, le garder et le commenter.</p>`,
          actions: [{ label: 'Continuer d’écrire' }, { label: 'Partager', onClick: (close) => { close(); E.partager(ecrit); } }, { label: 'Le voir', primary: true, onClick: () => { location.href = `ecrit.html?id=${ecrit.id}`; } }] });
      }
    });
    /* Programmer la parution (22/10/2026) : l'heure choisie est celle de
       l'appareil ; elle part au serveur en temps universel. */
    const prog = $('#cProgrammer');
    if (prog) prog.addEventListener('click', async () => {
      const ok = await enregistrer();
      if (!ok || !ecrit) { if (!ed.texte(f).trim()) S.toast('Écrivez d’abord quelque chose.'); return; }
      const demain = new Date(Date.now() + 864e5); demain.setMinutes(0, 0, 0);
      const val = new Date(demain - demain.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
      const m = S.modal({ title: 'Programmer la parution', body: `<p>Votre ${E.NATURES[ecrit.nature].toLowerCase()} restera invisible jusqu’à la date choisie, puis paraîtra tout seul.</p>
        <label class="cx-field">Date et heure<input type="datetime-local" id="cDate" value="${val}"></label><p class="cx-err" id="cDateErr" role="alert"></p>`,
        actions: [{ label: 'Annuler' }, { label: 'Programmer', primary: true, onClick: async (close) => {
          const v = m.el.querySelector('#cDate').value, d = v ? new Date(v) : null;
          if (!d || isNaN(d) || d <= new Date()) { m.el.querySelector('#cDateErr').textContent = 'Choisissez une date à venir.'; return; }
          const r = await API('POST', `/api/ecrits/${ecrit.id}/publier`, { date: d.toISOString().slice(0, 19) + 'Z' });
          if (!r.ok) { m.el.querySelector('#cDateErr').textContent = r.d.erreur || 'Le serveur a refusé.'; return; }
          close(); ecrit = r.d.ecrit; peindreEtat();
          marque(`programmé pour le ${S.dateLong(ecrit.publie_le)}`);
        } }] });
    });
    const jeter = $('#cJeter');
    if (jeter) jeter.addEventListener('click', () => S.modal({ title: 'Mettre à la corbeille ?', body: '<p>L’écrit quitte la publication et vos brouillons. Il reste dans la corbeille : vous pourrez le récupérer.</p>',
      actions: [{ label: 'Annuler' }, { label: 'Mettre à la corbeille', primary: true, onClick: async (close) => {
        await enregistrer();
        const r = await API('DELETE', `/api/ecrits/${ecrit.id}`);
        close();
        if (!r.ok) { S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
        location.href = 'ecrits.html';
      } }] }));
    const rest = $('#cRestaurer');
    if (rest) rest.addEventListener('click', async () => { const r = await API('POST', `/api/ecrits/${ecrit.id}/restaurer`); if (r.ok) location.reload(); else S.toast(r.d.erreur || 'Le serveur a refusé.'); });
    const rep = $('#cReprendre');
    if (rep) {
      rep.addEventListener('click', () => { $('#cTitre').value = secours.titre || ''; ed.remplacerTout(f, secours.texte || ''); $('#cSecours').remove(); change(); });
      $('#cOublier').addEventListener('click', () => { try { localStorage.removeItem(CLE); } catch (e) {} $('#cSecours').remove(); });
    }
    document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); } });
    addEventListener('beforeunload', (e) => { if (!lectureSeule && courant() !== enregistre && ed.texte(f).trim()) { e.preventDefault(); e.returnValue = ''; } });

    peindreEtat(); compter(); apercu();
    marque(ecrit ? (ecrit.programme ? `programmé pour le ${S.dateLong(ecrit.publie_le)}` : ecrit.statut === 'publie' ? 'publié' : 'brouillon visible par vous seul') : 'nouveau · rien n’est publié sans vous');
    if (!lectureSeule) setTimeout(() => f.el.focus(), 60);
  }
}).catch(window.SOZO_ERREUR);
