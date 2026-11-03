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

  function rendre() {
    const avenir = S.follows().map((id) => S.book(id)).filter(Boolean).map((b) => ({ b, st: S.stats(b) })).filter((x) => x.st.next)
      .sort((x, y) => S.parse(x.st.next.date) - S.parse(y.st.next.date));
    const nonLues = notifs ? notifs.filter((x) => !x.lu_le).length : 0;
    main.innerHTML = `<div class="nf wrap" data-glisse-retour>
      <header class="nf-tete">
        <button class="ap-ic nf-retour" type="button" id="nfRetour" aria-label="Retour">${S.icon('left')}</button>
        <h1>Notifications</h1>
        ${nonLues ? `<button class="ap-lien" type="button" id="markAll">Tout marquer comme lu</button>` : ''}
      </header>
      ${notifs === null ? `<p class="warn">${S.icon('x')}<span>Notifications indisponibles pour le moment.</span></p>`
        : notifs.length ? `<ul class="nf-liste">${notifs.map((x) => `<li class="nf-l${x.lu_le ? '' : ' is-new'}">
            <a class="nf-a" href="${S.esc(x.lien || '#')}" data-nid="${x.id}">
              <span class="nf-ic">${S.icon(ICONES[x.type] || 'bell')}</span>
              <span class="nf-t"><strong>${S.esc(x.titre)}</strong><span>${S.esc(x.corps)}</span><time datetime="${S.esc(x.created_at)}">${x.lu_le ? '' : '<b>Nouveau · </b>'}${ago(x.created_at)}</time></span>
            </a>
            <button class="ap-ic nf-x" type="button" data-suppr-notif="${x.id}" aria-label="Supprimer cette notification">${S.icon('x')}</button></li>`).join('')}</ul>`
        : `<div class="pf-vide"><strong>Rien de nouveau</strong><p>Parutions des livres suivis, paiements, ventes et alertes de sécurité apparaîtront ici.</p></div>`}
      ${avenir.length ? `<h2 class="pf-h">À venir dans vos abonnements</h2><ul class="nf-avenir">${avenir.map(({ b, st }) => { const dt = S.parse(st.next.date); return `<li><a href="livre.html?id=${encodeURIComponent(b.id)}">
          <span class="nf-jour"><b>${dt.getDate()}</b>${MO[dt.getMonth()]}</span><span><strong>${S.esc(b.title)}</strong><small>${S.esc(S.pagesRange(st.next.pages))} · ${dt.getHours()} h</small></span></a></li>`; }).join('')}</ul>` : ''}
      <p class="nf-regler"><a href="compte.html#notifications">${S.icon('bell')} Les recevoir aussi sur ce téléphone ou par e-mail</a></p>
    </div>`;
    $('#nfRetour').addEventListener('click', () => { if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back(); else location.href = 'decouvrir.html'; });
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
  S.footer();
}).catch(window.SOZO_ERREUR);
