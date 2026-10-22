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
  /* 22/10/2026 : une photo derrière le texte, à la manière des cartes de poèmes
     (image « Haiku » du propriétaire). Choisie dans la bibliothèque de Sōzō ;
     le serveur ne garde que ces noms-là (ecrits.apparence_propre). */
  const PHOTOS = ['foi-soleil-mer', 'foi-champ-dore', 'foi-croix-ciel', 'foi-croix-lac', 'foi-aube-bras', 'foi-priere-lumiere', 'foi-priere-bordeaux',
    'foi-bougie', 'foi-bougie-nuit', 'foi-bougies', 'foi-bougies-rang', 'foi-chapelle', 'foi-cathedrale', 'foi-porte-eglise', 'foi-bancs-rouges',
    'foi-bible-cafe', 'foi-bible-mains', 'foi-livre-nuit', 'foi-fleurs-claires', 'foi-fleurs-sechees', 'hero-crepuscule', 'couv-mer', 'couv-jardin',
    'couv-lumieres', 'couv-marais', 'trail-mer', 'trail-herbe', 'trail-parc', 'trail-fenetre', 'tasse-fenetre', 'ecriture-herbe'];
  const photo = (e) => { const k = (e.apparence || {}).image; return /^[a-z0-9-]+$/.test(k || '') ? k : null; };

  function lienAuteur(e) {
    const s = S(), id = e.auteur.id;
    const nom = s.esc(e.auteur.nom);
    return /^u\d+$/.test(id) ? `<a href="auteur.html?id=${encodeURIComponent(id)}">${nom}</a>` : `<span>${nom}</span>`;
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
    const ph = photo(e);
    return `<article class="vl-ecrit vl-fond-${fond(e)}${opts.entier ? ' vl-ecrit--entier' : ''}${ph ? ' vl-ecrit--photo' : ''}" data-ecrit="${e.id}"${ph ? ` style="--vl-photo:url('${s.esc(s.img(ph, !opts.entier))}')"` : ''}>
      <header class="vl-ecrit-h">${s.monogramme(e.auteur.nom, 36)}
        <div><strong>${lienAuteur(e)}</strong><small>${s.esc(NATURES[e.nature] || '')}${e.publie_le ? ` · ${s.esc(depuis(e.publie_le))}` : e.statut === 'brouillon' ? ' · brouillon' : ''}</small></div>
      </header>
      ${e.titre ? `<h3 class="vl-ecrit-titre">${opts.entier ? s.esc(e.titre) : `<a href="ecrit.html?id=${e.id}">${s.esc(e.titre)}</a>`}</h3>` : ''}
      ${corps(e)}
      ${e.long && !opts.entier ? `<a class="vl-suite" href="ecrit.html?id=${e.id}">Lire la suite</a>` : ''}
      ${e.themes && e.themes.length ? `<p class="vl-themes">${e.themes.map((t) => `<a href="explorer.html?vue=ecrits&theme=${encodeURIComponent(t)}">${s.esc(t)}</a>`).join('')}</p>` : ''}
      ${gestes(e)}
    </article>`;
  }

  async function partagerLien(e) {
    const s = S();
    const url = new URL(`ecrit.html?id=${e.id}`, location.href).href;
    const titre = e.titre || `${NATURES[e.nature]} de ${e.auteur.nom}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${titre} — Sōzō`, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); s.toast('Lien copié : collez-le où vous voulez le partager.'); }
    catch (er) { s.modal({ title: 'Partager', body: `<p>Copiez ce lien :</p><p><input class="vl-lien" readonly value="${s.esc(url)}" aria-label="Lien de l’écrit"></p>`, actions: [{ label: 'Fermer', primary: true }] }); }
  }

  /* ─── la carte à partager (21/10/2026) : une IMAGE velours et or, dessinée
     sur l'appareil (Canvas) — rien ne part chez un service extérieur. Pour
     WhatsApp, un statut, une impression. 1080 × 1350 (format portrait). ─── */
  const PLUME_D = 'M20.6 3.2c-6.8.4-12 4.9-13.8 11.6l-1.9 6.3 1.3.4 1.6-4.5c1.5.2 3.3-.2 5-1.3 3.5-2.3 6.4-6.7 7.8-12.5z';
  const nu = (t) => String(t || '').split('\n').map((l) => l.replace(/^(#{1,2} |> |• |\d{1,3}\. )/, '').replace(/^\s*(\*\s*){3}\s*$/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')).join('\n');
  async function dessiner(e) {
    const W = 1080, H = 1350, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    try { await Promise.all(['italic 400 60px "Cormorant Garamond"', '600 60px "Cormorant Garamond"', '500 30px Inter'].map((f) => document.fonts.load(f))); } catch (er) {}
    let g = x.createLinearGradient(0, 0, W * 0.7, H);
    g.addColorStop(0, '#5C0E1B'); g.addColorStop(0.55, '#3A0811'); g.addColorStop(1, '#23050A');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, W * 1.1);
    g.addColorStop(0, 'rgba(150, 32, 52, .55)'); g.addColorStop(1, 'rgba(150, 32, 52, 0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(212, 175, 55, .6)'; x.lineWidth = 2; x.strokeRect(54, 54, W - 108, H - 108);
    x.save(); x.translate(W / 2 - 36, 112); x.scale(3, 3); x.fillStyle = '#D4AF37'; x.fill(new Path2D(PLUME_D)); x.restore();
    x.textAlign = 'center'; x.fillStyle = '#D4AF37'; x.font = '500 28px Inter, sans-serif';
    x.fillText((e.themes && e.themes.length ? e.themes.join(' · ') : NATURES[e.nature]).toUpperCase(), W / 2, 238);
    // le texte : la plus grande taille qui tient dans le cadre
    const titre = e.titre ? nu(e.titre) : '';
    const corpsT = nu(e.texte).trim();
    const largeur = W - 240, haut = 300, bas = H - 250;
    const couper = (txt, police) => {
      x.font = police;
      const out = [];
      txt.split('\n').forEach((para) => {
        if (!para.trim()) { out.push(''); return; }
        let l = '';
        para.split(/\s+/).forEach((m) => { const essai = l ? `${l} ${m}` : m; if (x.measureText(essai).width > largeur && l) { out.push(l); l = m; } else l = essai; });
        out.push(l);
      });
      return out;
    };
    let taille = e.nature === 'pensee' ? 64 : 52, lignes, interligne;
    for (; taille >= 30; taille -= 2) {
      interligne = taille * 1.38;
      lignes = couper(corpsT, `italic 400 ${taille}px "Cormorant Garamond", Georgia, serif`);
      if ((titre ? taille * 1.6 : 0) + lignes.length * interligne <= bas - haut) break;
    }
    const max = Math.floor((bas - haut - (titre ? taille * 1.6 : 0)) / interligne);
    if (lignes.length > max) { lignes = lignes.slice(0, max); lignes[max - 1] = lignes[max - 1].replace(/\s*\S*$/, '') + ' …'; }
    let y = haut + ((bas - haut) - ((titre ? taille * 1.6 : 0) + lignes.length * interligne)) / 2 + taille;
    x.fillStyle = '#F8EEDC';
    if (titre) { x.font = `600 ${Math.round(taille * 1.1)}px "Cormorant Garamond", Georgia, serif`; x.fillText(titre, W / 2, y); y += taille * 1.6; }
    x.font = `italic 400 ${taille}px "Cormorant Garamond", Georgia, serif`;
    lignes.forEach((l) => { x.fillText(l, W / 2, y); y += interligne; });
    x.fillStyle = 'rgba(248, 238, 220, .85)'; x.font = '500 30px Inter, sans-serif';
    x.fillText(`— ${e.auteur.nom}`, W / 2, H - 170);
    x.fillStyle = '#D4AF37'; x.font = '600 44px "Cormorant Garamond", Georgia, serif';
    x.fillText('Sōzō', W / 2, H - 100);
    return c;
  }
  async function partager(e) {
    const s = S();
    const m = s.modal({ title: 'Partager', body: `<div class="vl-partage"><button type="button" class="vl-partage-o" data-p="lien">${s.icon('partager')}<span><strong>Le lien</strong><small>Pour WhatsApp, un SMS, un e-mail</small></span></button>
        <button type="button" class="vl-partage-o" data-p="image">${s.icon('image')}<span><strong>Une image</strong><small>Une carte velours et or, à poster en statut</small></span></button></div>
        <div id="vlCarte" class="vl-carte-apercu" hidden></div>`, actions: [{ label: 'Fermer', primary: true }] });
    m.el.addEventListener('click', async (ev) => {
      const o = ev.target.closest('[data-p]'); if (!o) return;
      if (o.dataset.p === 'lien') { partagerLien(e); return; }
      const zone = m.el.querySelector('#vlCarte'); zone.hidden = false;
      zone.innerHTML = `<p class="ash"><span class="spin" aria-hidden="true"></span> La carte se dessine…</p>`;
      const c = await dessiner(e);
      const url = c.toDataURL('image/png');
      zone.innerHTML = `<img src="${url}" alt="Carte de l’écrit, prête à partager"><div class="vl-carte-a">${navigator.canShare ? `<button class="btn btn--accent btn--sm" type="button" data-envoyer>${s.icon('partager')} Partager l’image</button>` : ''}<a class="btn btn--ghost btn--sm" href="${url}" download="sozo-${e.id}.png">Enregistrer l’image</a></div>`;
      const env = zone.querySelector('[data-envoyer]');
      if (env) env.addEventListener('click', () => c.toBlob(async (blob) => {
        const f = new File([blob], `sozo-${e.id}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Sōzō' }); } catch (er) {} }
        else s.toast('Ce téléphone ne partage pas les images directement : enregistrez-la, puis envoyez-la.');
      }, 'image/png'));
    });
  }

  /* 22/10/2026 — partager un PASSAGE (d'un livre ou d'un écrit), à la manière
     de Spotify : la citation devient une carte velours et or, dessinée sur
     l'appareil, prête pour WhatsApp ou un statut. Seul le texte que la
     personne a sélectionné — et qu'elle peut donc lire — y entre. */
  async function carteImage(e, titreFenetre) {
    const s = S();
    const m = s.modal({ title: titreFenetre || 'Partager ce passage', body: `<div id="vlCarte" class="vl-carte-apercu"><p class="ash"><span class="spin" aria-hidden="true"></span> La carte se dessine…</p></div>`, actions: [{ label: 'Fermer', primary: true }] });
    const zone = m.el.querySelector('#vlCarte');
    const c = await dessiner(e);
    const url = c.toDataURL('image/png');
    const nom = `sozo-${String(e.id || 'passage').replace(/[^\w-]/g, '')}.png`;
    zone.innerHTML = `<img src="${url}" alt="Carte du passage, prête à partager"><div class="vl-carte-a">${navigator.canShare ? `<button class="btn btn--accent btn--sm" type="button" data-envoyer>${s.icon('partager')} Partager l’image</button>` : ''}<a class="btn btn--ghost btn--sm" href="${url}" download="${nom}">Enregistrer l’image</a></div>`;
    const env = zone.querySelector('[data-envoyer]');
    if (env) env.addEventListener('click', () => c.toBlob(async (blob) => {
      const f = new File([blob], nom, { type: 'image/png' });
      if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Sōzō' }); } catch (er) {} }
      else s.toast('Ce téléphone ne partage pas les images directement : enregistrez-la, puis envoyez-la.');
    }, 'image/png'));
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

  return { NATURES, AIDE, PHOTOS, carte, corps, brancher, depuis, partager, dessiner, carteImage };
})();
