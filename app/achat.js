/* ═══════════════════════════════════════════════════════════
   Sōzō — l'achat, de bout en bout, contre le vrai serveur.

   1. Récapitulatif : contenu, pages à paraître, PRIX — avant tout paiement
      (cahier des charges §8).
   2. Le serveur crée l'achat et RECALCULE le montant (le navigateur n'annonce
      jamais un prix). Une clé d'idempotence évite les doubles achats.
   3. Sans agrégateur : le lecteur paie par Mobile Money au numéro Sōzō, puis
      déclare la référence de sa transaction.
   4. « En attente de vérification » : l'accès s'ouvre quand Sōzō confirme.
      Rien n'est jamais présenté comme « payé » avant cette confirmation.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const S = window.SOZO, D = S.D;
  const OBJET = { page: 'page', chapter: 'chapitre', all: 'livre' };
  const cle = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `cle-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  /* Ce qu'on peut acheter autour d'une page n (affichage ; le serveur décide). */
  function options(b, n) {
    if (!b.price || b.demo) return [];   // un livre d'exemple ne se vend pas (le serveur refuse aussi)
    const etat = (k) => S.access(b, k);
    const paid = b.pages.filter((p) => p.access === 'paid');
    const out = [];
    if (n != null && b.price.page != null && etat(n) === 'locked') {
      out.push({ k: 'page', n, label: 'Cette page', detail: `Page ${n}`, pages: [n], price: b.price.page });
    }
    const ch = n != null ? S.chapterOf(b, n) : null;
    if (ch && b.price.chapter != null) {
      const cp = paid.filter((p) => p.n >= ch.from && p.n <= ch.to);
      if (cp.length && !cp.some((p) => etat(p.n) === 'owned')) {
        out.push({ k: 'chapter', n, label: `Le chapitre « ${ch.t} »`, detail: S.pagesRange(cp.map((p) => p.n)), pages: cp.map((p) => p.n), price: b.price.chapter });
      }
    }
    if (b.price.all != null && paid.length && !paid.every((p) => etat(p.n) === 'owned')) {
      const already = paid.filter((p) => etat(p.n) === 'owned').length;
      out.push({ k: 'all', label: 'Tout le livre', detail: `${paid.length} page${paid.length > 1 ? 's' : ''} payante${paid.length > 1 ? 's' : ''}, présentes et à venir${already ? `, dont ${already} déjà achetée${already > 1 ? 's' : ''}` : ''}`, pages: paid.map((p) => p.n), price: b.price.all });
    }
    return out;
  }

  function recap(b, opt) {
    const future = opt.pages.filter((k) => S.access(b, k) === 'soon');
    const body = `
      <div class="recap">
        <div><span>Livre</span><strong>${S.esc(b.title)}</strong></div>
        <div><span>Contenu</span><strong>${S.esc(opt.label)} — ${S.esc(opt.detail)}</strong></div>
        ${future.length ? `<div><span>À paraître</span><strong>${S.esc(S.pagesRange(future))} : ouvertes à leur date</strong></div>` : ''}
        <div><span>Prix</span><strong style="font-size:22px">${S.money(opt.price)}</strong></div>
      </div>
      <p class="note">${S.icon('shield')} Une fois payé, ce contenu reste à vous, même si l'auteur modifie ensuite son livre.</p>`;
    const k = cle();
    S.modal({ title: 'Récapitulatif avant paiement', body, actions: [
      { label: 'Annuler' },
      { label: `Payer ${S.money(opt.price)} par Mobile Money`, primary: true, onClick: (close) => { close(); payer({ objet: OBJET[opt.k], livre: b.id, n: opt.n }, k); } }
    ] });
  }

  /* ─── Le forfait Plume : carte de membre dorée, comparaison, paiement réel ─── */
  const PLUME_SVG = `<svg class="pl-plume" viewBox="-40 -330 1130 420" aria-hidden="true"><g transform="rotate(-24 525 -80)">
    <path class="pl-vane" d="M220,-8 C300,-60 400,-110 520,-150 L548,-128 C600,-170 690,-196 790,-200 L806,-176 C870,-196 960,-190 1050,-150 C990,-110 920,-70 850,-45 L838,-28 C760,-5 640,22 520,30 C420,36 320,28 220,-8 Z"/>
    <path class="pl-hi" d="M220,-8 C320,28 420,36 520,30 C640,22 760,-5 838,-28 L850,-45 C920,-70 990,-110 1050,-150 C900,-110 700,-70 520,-40 C380,-20 280,-10 220,-8 Z"/>
    <path class="pl-rachis" d="M0,12 C250,-4 600,-62 1046,-148"/></g></svg>`;
  function carte({ titulaire, validite, etat } = {}) {
    return `<div class="pl-scene"><div class="pl-carte" data-pl-tilt>
      <span class="pl-grain"></span><span class="pl-reflet"></span>
      <span class="pl-marque">Sōzō</span><span class="pl-puce"></span>${PLUME_SVG}
      <span class="pl-nom">PLUME</span><span class="pl-titulaire">${S.esc(titulaire || 'Votre nom')}</span>
      <span class="pl-validite">${S.esc(validite || '30 jours')}</span>
      ${'<i class="pl-eclat"></i>'.repeat(5)}
    </div>${etat ? `<span class="pl-etat">${S.esc(etat)}</span>` : ''}</div>`;
  }
  /* La carte suit doucement le pointeur (souris seulement, jamais en mouvement réduit) */
  function animerCarte(scope) {
    if (S.reduced || !matchMedia('(hover: hover)').matches) return;
    scope.querySelectorAll('[data-pl-tilt]').forEach((c) => {
      const zone = c.parentElement;
      zone.addEventListener('pointermove', (e) => {
        const r = zone.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--ry', `${((x - 0.5) * 30).toFixed(1)}deg`); c.style.setProperty('--rx', `${((0.5 - y) * 18).toFixed(1)}deg`);
        c.style.setProperty('--gx', `${Math.round(x * 100)}%`);
      });
      zone.addEventListener('pointerleave', () => { ['--rx', '--ry', '--gx'].forEach((k) => c.style.removeProperty(k)); });
    });
  }
  /* Plume — devenir auteur (22/10/2026). Trois offres, au mois ou à l'année.
     Les prix ne s'affichent QUE si la personne ouvre elle-même cette fenêtre :
     lire, aimer, commenter et publier des écrits courts restent gratuits, et
     la fenêtre le dit d'abord. Offres et prix viennent du serveur (pro.py). */
  async function plume() {
    const r = await window.SOZO_API('GET', '/api/moi/pro');
    if (!r.ok) { S.toast(r.d.erreur || 'Plume est indisponible pour le moment.'); return; }
    const v = r.d.pro;
    let duree = 'annee';
    const offre = (o) => `<div class="pl-offre${o.id === 'plume_or' ? ' is-or' : ''}${v.offre === o.id ? ' is-mien' : ''}">
        ${v.offre === o.id ? '<span class="pl-medaille">Votre offre</span>' : o.id === 'plume_or' ? '<span class="pl-medaille">Le plus choisi</span>' : ''}
        <h3>${S.esc(o.nom)}</h3><p class="pl-pour">${S.esc(o.pour)}</p>
        <p class="pl-prix" data-prix="${o.id}"></p>
        <ul><li>${o.livres ? `Jusqu’à ${o.livres} livres` : 'Livres sans limite'}</li><li>Vendre à la page, au chapitre, au livre</li>
          <li>Sōzō garde ${o.commission} % d’une vente</li><li>Corriger une page déjà publiée</li><li>Relecture par l’IA, import de manuscrits</li></ul>
        <button class="btn ${o.id === 'plume_or' ? 'btn--accent' : 'btn--ghost'} pl-choisir" type="button" data-offre="${o.id}">${v.offre === o.id ? 'Prolonger' : 'Choisir'}</button>
      </div>`;
    const m = S.modal({ title: v.pro ? `Votre offre : ${v.nom}` : 'Devenir auteur avec Plume', body: `
      <div class="pl pl--offres">
        <p class="pl-lead">Lire, aimer, commenter et partager vos écrits courts resteront toujours gratuits. Plume, c’est pour celles et ceux qui veulent écrire des livres et les faire vivre.</p>
        <div class="pl-duree" role="radiogroup" aria-label="Durée">
          <button type="button" role="radio" data-duree="mois" aria-checked="false">Au mois</button>
          <button type="button" role="radio" data-duree="annee" aria-checked="true">À l’année <small>2 mois offerts</small></button>
        </div>
        <div class="pl-offres pl-offres--3">${v.offres.map(offre).join('')}</div>
        <p class="pl-note">${S.icon('shield')} Payé par Mobile Money, vérifié par Sōzō. Rien n’est prélevé ensuite : vous prolongez si vous le voulez.${v.pro ? ` Votre offre court jusqu’au ${S.esc(S.dateShort(v.fin))}.` : ''}</p>
      </div>`, actions: [{ label: 'Plus tard' }] });
    m.el.querySelector('.md').classList.add('md--plume');
    const peindre = () => {
      m.el.querySelectorAll('[data-duree]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.duree === duree)));
      v.offres.forEach((o) => { m.el.querySelector(`[data-prix="${o.id}"]`).innerHTML = duree === 'annee' ? `${S.money(o.annee)} <small>/ an</small>` : `${S.money(o.mois)} <small>/ mois</small>`; });
    };
    m.el.querySelectorAll('[data-duree]').forEach((b) => b.addEventListener('click', () => { duree = b.dataset.duree; peindre(); }));
    m.el.querySelectorAll('[data-offre]').forEach((b) => b.addEventListener('click', () => { m.close(); payer({ objet: 'plume', offre: b.dataset.offre, duree }, cle()); }));
    peindre();
  }

  /* La petite note dans un coin (22/10/2026, demande du propriétaire) : quand
     une fonction demande Plume, pas d'écran entier — une carte discrète, qui
     explique et propose de découvrir Plume, puis s'efface d'elle-même. */
  function avisPro(message) {
    let n = document.querySelector('.pl-avis');
    if (!n) {
      n = document.createElement('aside');
      n.className = 'pl-avis'; n.setAttribute('role', 'status');
      document.body.appendChild(n);
    }
    n.innerHTML = `<span class="pl-avis-ic" aria-hidden="true">${S.icon('feather')}</span>
      <div><p>${S.esc(message || 'Cette fonction fait partie de Plume.')}</p><button type="button" class="pl-avis-lien">Découvrir Plume</button></div>
      <button type="button" class="pl-avis-x" aria-label="Fermer">${S.icon('x')}</button>`;
    requestAnimationFrame(() => n.classList.add('is-on'));
    const fermer = () => n.classList.remove('is-on');
    clearTimeout(n._t); n._t = setTimeout(fermer, 9000);
    n.querySelector('.pl-avis-x').addEventListener('click', fermer);
    n.querySelector('.pl-avis-lien').addEventListener('click', () => { fermer(); plume(); });
  }
  window.SOZO_AVIS_PRO = avisPro;

  async function payer(criteres, idempotency_key) {
    const m = await window.SOZO_API('GET', '/api/paiements/moyens');
    if (!m.ok || !m.d.ouverts) {
      S.modal({ title: 'Paiements pas encore ouverts', body: '<p>Les paiements ne sont pas encore ouverts sur Sōzō. Aucun montant ne vous a été demandé.</p>', actions: [{ label: 'Compris' }] });
      return;
    }
    const r = await window.SOZO_API('POST', '/api/paiements', { ...criteres, idempotency_key });
    if (!r.ok) {
      S.modal({ title: 'Achat impossible', body: `<p class="warn">${S.icon('x')}<span>${S.esc(r.d.erreur || 'Le serveur a refusé cet achat.')}</span></p>`, actions: [{ label: 'Fermer' }] });
      return;
    }
    const p = r.d.paiement;
    if (p.etat !== 'CREATED') { suivi(p); return; }
    declarer(p, m.d);
  }

  /* Étape 2 : payer au numéro Sōzō, puis déclarer la référence.
     Sert aussi à reprendre un achat laissé en suspens (Mon compte). */
  function declarer(p, moyens, apres) {
    const montant = S.money(p.montant / 100);
    const nums = moyens.numeros.map((x) => `<div><span>${S.esc(x.operateur)}</span><strong>${S.esc(x.numero)}</strong></div>`).join('');
    S.modal({ title: `Payer ${montant}`, body: `
      ${moyens.test ? `<p class="warn">${S.icon('lock')}<span><strong>Environnement de test.</strong> N'envoyez pas d'argent réel : les numéros ci-dessous sont factices.</span></p>` : ''}
      <p>1. Envoyez <strong>${montant}</strong> par Mobile Money à l'un de ces numéros Sōzō :</p>
      <div class="recap">${nums}</div>
      <p>2. Indiquez la référence de la transaction (reçue par SMS de votre opérateur) :</p>
      <label class="cx-field"><span>Opérateur</span><select id="payOp">${moyens.operateurs.map((o) => `<option>${S.esc(o)}</option>`).join('')}</select></label>
      <label class="cx-field"><span>Référence de la transaction</span><input id="payRef" maxlength="40" autocomplete="off" placeholder="Ex. : MP2610151234"></label>
      <p class="cx-err" id="payErr" role="alert"></p>
      <p class="note">${S.icon('clock')} Sōzō vérifie la transaction, puis ouvre votre accès. Vous suivez l'état dans « Mon compte ».</p>`,
      actions: [
        { label: 'Annuler l’achat', onClick: async (close) => { const a = await window.SOZO_API('POST', `/api/paiements/${p.id}/annulation`); close(); if (!a.ok) S.toast(a.d.erreur || 'Annulation impossible.'); if (apres) apres(); } },
        { label: 'J’ai payé : déclarer', primary: true, onClick: async (close) => {
          const reference = document.getElementById('payRef').value.trim();
          if (reference.length < 4) { document.getElementById('payErr').textContent = 'Indiquez la référence de la transaction.'; return; }
          const d = await window.SOZO_API('POST', `/api/paiements/${p.id}/declaration`, { operateur: document.getElementById('payOp').value, reference });
          if (!d.ok) { document.getElementById('payErr').textContent = d.d.erreur || 'Déclaration refusée.'; return; }
          close(); suivi(d.d.paiement); if (apres) apres();
        } }
      ] });
  }

  async function reprendre(p, apres) {
    const m = await window.SOZO_API('GET', '/api/paiements/moyens');
    if (!m.ok || !m.d.ouverts) { S.toast('Les paiements ne sont pas encore ouverts sur Sōzō.'); return; }
    declarer(p, m.d, apres);
  }

  function suivi(p) {
    const etat = { PENDING: 'En attente de vérification', CONFIRMED: 'Confirmé', FAILED: 'Refusé', CREATED: 'À payer', CANCELLED: 'Annulé', UNKNOWN: 'En cours de vérification' }[p.etat] || p.etat;
    S.modal({ title: etat, body: p.etat === 'CONFIRMED'
      ? '<p>Votre accès est ouvert. Bonne lecture !</p>'
      : `<p>Votre paiement de <strong>${S.money(p.montant / 100)}</strong> est déclaré${p.reference ? ` (référence ${S.esc(p.reference)})` : ''}. Sōzō le vérifie, puis ouvre votre accès : rien n'est débloqué avant cette confirmation.</p><p class="note">${S.icon('user')} Suivez l'état dans « Mon compte ».</p>`,
      actions: [{ label: 'Mon compte', onClick: () => { location.href = 'compte.html'; } }, { label: 'Fermer', primary: true, onClick: (close) => { close(); if (p.etat === 'CONFIRMED') location.reload(); } }] });
  }

  S.buy = { options, recap, plume, payer, reprendre, carte, animerCarte, avisPro };
})();
