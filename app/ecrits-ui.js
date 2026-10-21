/* ═══════════════════════════════════════════════════════════
   Sōzō — les ÉCRITS à l'écran (21/10/2026) : la carte d'un poème, d'une
   pensée, d'une prière, d'un récit ou d'un conte, et ses gestes (j'aime,
   commenter, garder, partager). Partagé par l'accueil, Explorer, la
   bibliothèque, « Mes écrits » et la page d'un écrit.

   Règles de l'écran :
   * aucun faux succès : un cœur ne se remplit qu'après la réponse du serveur,
     et le nombre affiché est celui que le serveur renvoie ;
   * tout texte venu d'une personne passe par S.esc() (titres, noms,
     commentaires) ou par S.mise.paragraphes(), qui échappe avant de poser
     ses propres balises.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_ECRITS = (() => {
  const S = () => window.SOZO;
  const API = (...a) => window.SOZO_API(...a);
  const NATURES = { pensee: 'Pensée', poeme: 'Poème', priere: 'Prière', recit: 'Récit', conte: 'Conte' };
  const AIDE = {
    pensee: 'Une phrase, un verset qui vous habite',
    poeme: 'Des vers, une louange',
    priere: 'Une prière à partager',
    recit: 'Une histoire vraie, un témoignage',
    conte: 'Un conte, une parabole'
  };

  function depuis(iso) {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'à l’instant';
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 7 * 86400) { const j = Math.floor(s / 86400); return `il y a ${j} jour${j > 1 ? 's' : ''}`; }
    return S().dateLong(iso);
  }

  /* Le corps d'un écrit : police, alignement, fond choisis par l'auteur
     (liste fermée, revérifiée ici avant d'entrer dans un attribut). */
  const POL = ['cormorant', 'inter', 'georgia', 'didone', 'moderne', 'machine', 'manuscrite'];
  function corps(e) {
    const a = e.apparence || {}, s = S();
    const police = POL.includes(a.police) ? a.police : (e.nature === 'pensee' || e.nature === 'poeme' ? 'cormorant' : 'georgia');
    const al = ['gauche', 'centre', 'justifie'].includes(a.alignement) ? a.alignement : (e.nature === 'poeme' || e.nature === 'pensee' ? 'centre' : 'gauche');
    return `<div class="vl-texte vl-al-${al}${a.taille === 'grande' ? ' vl-grand' : ''}${e.nature === 'pensee' ? ' vl-texte--pensee' : ''}" style="--pg-police:${s.POLICES[police]}">${s.mise.paragraphes(e.texte, {}, (t) => s.esc(t) || '&nbsp;')}</div>`;
  }
  const fond = (e) => (['ivoire', 'velours', 'nuit', 'parchemin'].includes((e.apparence || {}).fond) ? e.apparence.fond : 'ivoire');

  function lienAuteur(e) {
    const s = S(), id = e.auteur.id;
    const nom = s.esc(e.auteur.nom);
    return s.D.authors && s.D.authors[id] ? `<a href="auteur.html?id=${encodeURIComponent(id)}">${nom}</a>` : `<span>${nom}</span>`;
  }

  function gestes(e) {
    const s = S();
    if (e.statut !== 'publie' || e.corbeille_le || e.retire) return '';
    return `<footer class="vl-gestes" aria-label="Réagir">
      <button type="button" class="vl-geste" data-geste="jaime" aria-pressed="${e.moi.jaime}" aria-label="J’aime${e.jaime ? ` (${e.jaime})` : ''}">${s.icon('heart')}<span data-n>${e.jaime || ''}</span></button>
      <a class="vl-geste" href="ecrit.html?id=${e.id}#commentaires" aria-label="Commentaires${e.commentaires ? ` (${e.commentaires})` : ''}">${s.icon('bulle')}<span>${e.commentaires || ''}</span></a>
      <button type="button" class="vl-geste" data-geste="garde" aria-pressed="${e.moi.garde}" aria-label="${e.moi.garde ? 'Gardé dans ma bibliothèque' : 'Garder dans ma bibliothèque'}">${s.icon('garder')}<span class="vl-geste-l">${e.moi.garde ? 'Gardé' : 'Garder'}</span></button>
      <button type="button" class="vl-geste" data-geste="partager" aria-label="Partager">${s.icon('partager')}<span class="vl-geste-l">Partager</span></button>
    </footer>`;
  }

  function carte(e, opts = {}) {
    const s = S();
    return `<article class="vl-ecrit vl-fond-${fond(e)}${opts.entier ? ' vl-ecrit--entier' : ''}" data-ecrit="${e.id}">
      <header class="vl-ecrit-h">${s.monogramme(e.auteur.nom, 36)}
        <div><strong>${lienAuteur(e)}</strong><small>${s.esc(NATURES[e.nature] || '')}${e.publie_le ? ` · ${s.esc(depuis(e.publie_le))}` : e.statut === 'brouillon' ? ' · brouillon' : ''}</small></div>
      </header>
      ${e.titre ? `<h3 class="vl-ecrit-titre">${opts.entier ? s.esc(e.titre) : `<a href="ecrit.html?id=${e.id}">${s.esc(e.titre)}</a>`}</h3>` : ''}
      ${corps(e)}
      ${e.long && !opts.entier ? `<a class="vl-suite" href="ecrit.html?id=${e.id}">Lire la suite</a>` : ''}
      ${gestes(e)}
    </article>`;
  }

  async function partager(e) {
    const s = S();
    const url = new URL(`ecrit.html?id=${e.id}`, location.href).href;
    const titre = e.titre || `${NATURES[e.nature]} de ${e.auteur.nom}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${titre} — Sōzō`, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); s.toast('Lien copié : collez-le où vous voulez le partager.'); }
    catch (er) { s.modal({ title: 'Partager', body: `<p>Copiez ce lien :</p><p><input class="vl-lien" readonly value="${s.esc(url)}" aria-label="Lien de l’écrit"></p>`, actions: [{ label: 'Fermer', primary: true }] }); }
  }

  /* Branche les gestes de toutes les cartes d'un conteneur. `liste` donne
     l'écrit d'après son identifiant (pour partager, mettre à jour). */
  function brancher(conteneur, trouver) {
    conteneur.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-geste]');
      if (!b) return;
      const art = b.closest('[data-ecrit]'), id = +art.dataset.ecrit, e = trouver(id);
      if (!e) return;
      const k = b.dataset.geste;
      if (k === 'partager') { partager(e); return; }
      const oui = b.getAttribute('aria-pressed') !== 'true';
      b.disabled = true;
      const r = await API(oui ? 'POST' : 'DELETE', `/api/ecrits/${id}/${k}`);
      b.disabled = false;
      if (!r.ok) { S().toast(r.d.erreur || 'Le serveur n’a pas enregistré ce geste. Réessayez.'); return; }
      // l'état affiché est celui que le serveur confirme
      e.moi[k] = r.d.actif;
      b.setAttribute('aria-pressed', String(r.d.actif));
      if (k === 'jaime') {
        e.jaime = r.d.total; b.querySelector('[data-n]').textContent = r.d.total || '';
        b.setAttribute('aria-label', `J’aime${r.d.total ? ` (${r.d.total})` : ''}`);
      } else {
        b.querySelector('.vl-geste-l').textContent = r.d.actif ? 'Gardé' : 'Garder';
        b.setAttribute('aria-label', r.d.actif ? 'Gardé dans ma bibliothèque' : 'Garder dans ma bibliothèque');
        S().toast(r.d.actif ? 'Gardé dans votre bibliothèque.' : 'Retiré de votre bibliothèque.');
      }
    });
  }

  return { NATURES, AIDE, carte, corps, brancher, depuis, partager };
})();
