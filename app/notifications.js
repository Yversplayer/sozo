/* ═══════════════════════════════════════════════════════════
   Sōzō — NOTIFICATIONS (03/11/2026). Le propriétaire : « pourquoi diable
   dans Bibliothèque on voit Notifications, ce n'est pas sa place : je t'ai
   déjà dit où mettre les notifs » — sous la cloche, en haut, comme Netflix.
   Repris tel quel de l'ancien onglet (suivis.js) : la liste vient du
   serveur, une notification touchée est marquée lue (keepalive : la
   requête survit au changement de page), « Tout marquer comme lu »,
   supprimer, et les prochaines parutions des livres suivis.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PRET.then(async () => {
  const S = window.SOZO, $ = (s, c = document) => c.querySelector(s);
  S.shell('notifications');
  const main = $('#main');
  const ICONES = { parution: 'book', paiement: 'tag', vente: 'star', reversement: 'send', plume: 'feather', moderation: 'shield', securite: 'lock', test: 'bell', communaute: 'bulle', abonnements: 'feather' };
  let notifs;
  const charger = async () => { const r = await window.SOZO_API('GET', '/api/notifications'); notifs = r.ok ? r.d.liste : null; };
  const ago = (iso) => { const d = -S.relDays(iso); return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`; };
  const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  /* 08/11/2026 — d'après les maquettes Stitch : le nombre de non lues, des
     pastilles pour trier (Lectures, Communauté, Paiements, Compte), les
     notifications rangées par jour, un point doré sur les nouvelles. */
  const FAMILLES = [['', 'Toutes'], ['lectures', 'Lectures'], ['communaute', 'Communauté'], ['argent', 'Paiements'], ['compte', 'Compte']];
  const famille = (t) => (['parution', 'abonnements'].includes(t) ? 'lectures' : t === 'communaute' ? 'communaute' : ['paiement', 'vente', 'reversement', 'plume'].includes(t) ? 'argent' : 'compte');
  let filtre = '';
  const groupe = (iso) => { const d = -S.relDays(iso); return d <= 0 ? "Aujourd’hui" : d < 7 ? 'Cette semaine' : 'Plus tôt'; };
  function rendre() {
    const avenir = S.follows().map((id) => S.book(id)).filter(Boolean).map((b) => ({ b, st: S.stats(b) })).filter((x) => x.st.next)
      .sort((x, y) => S.parse(x.st.next.date) - S.parse(y.st.next.date));
    const nonLues = notifs ? notifs.filter((x) => !x.lu_le).length : 0;
    const liste = notifs ? notifs.filter((x) => !filtre || famille(x.type) === filtre) : [];
    const groupes = []; liste.forEach((x) => { const g = groupe(x.created_at); let z = groupes.find((y) => y[0] === g); if (!z) groupes.push(z = [g, []]); z[1].push(x); });
    const presentes = new Set((notifs || []).map((x) => famille(x.type)));
    main.innerHTML = `<div class="nf sx-page" data-glisse-retour>
      <header class="sx-barre" id="nfBarre">
        <a class="sx-retour" href="decouvrir.html" data-retour aria-label="Retour">${S.icon('left')}</a>
        <span class="sx-barre-t">Notifications</span>
        ${nonLues ? `<button class="sx-lien" type="button" id="markAll">Tout lire</button>` : '<span class="sx-ic" aria-hidden="true"></span>'}
      </header>
      <div class="sx-ecran">
        <h1 class="sr">Notifications</h1>
        ${nonLues ? `<p class="sx-chapeau"><span class="sx-chip sx-chip--bord">${nonLues} non lue${nonLues > 1 ? 's' : ''}</span></p>` : ''}
        ${notifs && notifs.length ? `<nav class="sx-pilules" aria-label="Trier" data-sans-glisse>${FAMILLES.filter(([k]) => !k || presentes.has(k)).map(([k, l]) => `<button type="button" class="sx-pilule${filtre === k ? ' is-on' : ''}" data-famille="${k}">${l}</button>`).join('')}</nav>` : ''}
        ${notifs === null ? `<p class="warn">${S.icon('x')}<span>Notifications indisponibles pour le moment.</span></p>`
          : liste.length ? groupes.map(([g, l]) => `<section class="sx-nf-g"><span class="sx-sur">${g}</span><ul class="sx-nf">${l.map((x) => `<li class="sx-carte sx-nf-l${x.lu_le ? '' : ' is-new'}">
              <a class="sx-nf-a" href="${S.esc(x.lien || '#')}" data-nid="${x.id}">
                <span class="sx-nf-ic sx-nf-ic--${famille(x.type)}">${S.icon(ICONES[x.type] || 'bell')}</span>
                <span class="sx-nf-t"><b>${S.esc(x.titre)}</b><span>${S.esc(x.corps)}</span><time datetime="${S.esc(x.created_at)}">${ago(x.created_at)}</time></span>
                ${x.lu_le ? '' : '<i class="sx-nf-point" aria-label="Nouvelle"></i>'}
              </a>
              <button class="sx-ic sx-nf-x" type="button" data-suppr-notif="${x.id}" aria-label="Supprimer cette notification">${S.icon('x')}</button></li>`).join('')}</ul></section>`).join('')
          : `<div class="sx-vide">${S.icon('bell')}<strong>Rien de nouveau</strong><span>Parutions des livres suivis, commentaires, paiements et alertes de sécurité apparaîtront ici.</span></div>`}
        ${avenir.length ? `<section class="sx-carte sx-carte--douce"><div class="sx-h"><h2>À venir</h2></div><ul class="nf-avenir">${avenir.map(({ b, st }) => { const dt = S.parse(st.next.date); return `<li><a href="livre.html?id=${encodeURIComponent(b.id)}">
            <span class="nf-jour"><b>${dt.getDate()}</b>${MO[dt.getMonth()]}</span><span><strong>${S.esc(b.title)}</strong><small>${S.esc(S.pagesRange(st.next.pages))} · ${dt.getHours()} h</small></span></a></li>`; }).join('')}</ul></section>` : ''}
        <a class="sx-carte sx-ligne" href="compte.html#notifications"><span class="sx-ligne-ic">${S.icon('bell')}</span><span class="sx-ligne-t"><b>Les recevoir aussi ailleurs</b><small>Sur ce téléphone ou par e-mail</small></span>${S.icon('chevron')}</a>
      </div>
    </div>`;
    main.querySelectorAll('[data-famille]').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.famille; rendre(); }));
    const nb = $('#nfBarre'); addEventListener('scroll', () => nb.classList.toggle('is-defile', scrollY > 12), { passive: true });
    const m = $('#markAll');
    if (m) m.addEventListener('click', async () => { m.disabled = true; const r = await window.SOZO_API('POST', '/api/notifications/lues', {}); if (!r.ok) { m.disabled = false; S.toast(r.d.erreur || 'Action impossible.'); return; } await charger(); rendre(); S.majCloche(); });
    main.querySelectorAll('[data-nid]').forEach((a) => a.addEventListener('click', () => { window.SOZO_API('POST', '/api/notifications/lues', { ids: [+a.dataset.nid] }, { keepalive: true }); }));
    main.querySelectorAll('[data-suppr-notif]').forEach((x) => x.addEventListener('click', async () => {
      x.disabled = true;
      const r = await window.SOZO_API('DELETE', `/api/notifications/${x.dataset.supprNotif}`);
      if (!r.ok) { x.disabled = false; S.toast(r.d.erreur || 'Le serveur a refusé.'); return; }
      notifs = notifs.filter((n) => n.id !== +x.dataset.supprNotif); rendre(); S.majCloche();
    }));
  }
  await charger();
  rendre();
}).catch(window.SOZO_ERREUR);
