/* ═══════════════════════════════════════════════════════════
   Sōzō — LA PLUME, le mini-Word (21/10/2026).

   « J'aimerais vraiment un mini Word, adapté au logiciel, avec plein de
   petits gadgets pour modifier, améliorer et laisser libre cours à son
   inspiration » (le propriétaire). Un seul composant, deux usages : les
   pages d'un livre (plusieurs feuilles qui défilent de haut en bas, toutes
   modifiables sur place) et les écrits (une feuille).

   CE QUI EST ENREGISTRÉ RESTE DU TEXTE. La feuille est éditable (gras,
   italique, titres, citations), mais elle est convertie en lignes avec des
   marques simples — « # », « > », « *** », **gras**, *italique* — que la
   liseuse traduit (ui.js, mise.paragraphes) et que le serveur sait lire sans
   la cuisine (backend/texte.py). Jamais de HTML enregistré : un texte vient
   de n'importe qui, et du HTML stocké rouvrirait la porte aux scripts.

   Toutes les modifications passent par document.execCommand : l'annulation
   (⌘Z / Ctrl Z) reste celle du navigateur, comme dans un vrai traitement de
   texte. Les fautes sont soulignées avec l'API Highlight de CSS : le texte
   n'est jamais réécrit pour poser un soulignement.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_PLUME = (() => {
  const S = () => window.SOZO;
  const esc = (t) => S().esc(t);

  /* ─── texte ⇄ feuille ─── */
  const emphase = (h) => h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  function enBlocs(texte) {
    const lignes = String(texte || '').split('\n');
    // 21/10/2026 : « • » et « 1. » en tête de ligne = une liste (lignes consécutives regroupées)
    const html = lignes.map((t) => {
      let l = /^• (.*)$/.exec(t);
      if (l) return `\u0001ul<li>${emphase(esc(l[1])) || '<br>'}</li>`;
      l = /^\d{1,3}\. (.*)$/.exec(t);
      if (l) return `\u0001ol<li>${emphase(esc(l[1])) || '<br>'}</li>`;
      if (/^\s*(\*\s*){3}\s*$/.test(t)) return '<hr class="pl-sep">';
      let m = /^(#{1,2}) (.*)$/.exec(t);
      if (m) return `<${m[1].length === 2 ? 'h4' : 'h3'}>${emphase(esc(m[2])) || '<br>'}</${m[1].length === 2 ? 'h4' : 'h3'}>`;
      m = /^> (.*)$/.exec(t);
      if (m) return `<blockquote><p>${emphase(esc(m[1])) || '<br>'}</p></blockquote>`;
      return `<p>${emphase(esc(t)) || '<br>'}</p>`;
    }).reduce((acc, h) => {
      const m = /^\u0001(ul|ol)(.*)$/.exec(h);
      if (!m) return acc + h;
      const fin = `</${m[1]}>`;
      return acc.endsWith(fin) ? acc.slice(0, -fin.length) + m[2] + fin : acc + `<${m[1]}>${m[2]}${fin}`;
    }, '');
    return html || '<p><br></p>';
  }
  // Une espace insécable que la feuille pose toute seule (fin de ligne, double espace) redevient une espace
  const nettoyer = (t) => t.replace(/ (?= |$)|(?<= ) /g, ' ').replace(/​/g, '');
  function enLigne(n) {
    let out = '';
    n.childNodes.forEach((c) => {
      if (c.nodeType === 3) { out += c.nodeValue; return; }
      if (c.nodeType !== 1) return;
      const t = c.tagName;
      if (t === 'BR') { out += '\n'; return; }
      const dedans = enLigne(c);
      if ((t === 'B' || t === 'STRONG' || (t === 'SPAN' && +getComputedStyle(c).fontWeight >= 600)) && dedans.trim()) out += `**${dedans}**`;
      else if ((t === 'I' || t === 'EM') && dedans.trim()) out += `*${dedans}*`;
      else out += dedans;
    });
    return out;
  }
  function versTexte(feuille) {
    const lignes = [];
    const pousser = (prefixe, txt) => nettoyer(txt).split('\n').forEach((l, i) => lignes.push((i === 0 || prefixe === '> ' ? prefixe : '') + l));
    feuille.childNodes.forEach((b) => {
      if (b.nodeType === 3) { if (b.nodeValue.trim()) pousser('', b.nodeValue); return; }
      if (b.nodeType !== 1) return;
      const t = b.tagName;
      if (t === 'HR') lignes.push('***');
      else if (t === 'H1' || t === 'H2' || t === 'H3') pousser('# ', enLigne(b));
      else if (t === 'H4' || t === 'H5' || t === 'H6') pousser('## ', enLigne(b));
      else if (t === 'BLOCKQUOTE') {
        const ps = [...b.children].filter((c) => /^(P|DIV)$/.test(c.tagName));
        (ps.length ? ps : [b]).forEach((p) => pousser('> ', enLigne(p)));
      } else if (t === 'UL' || t === 'OL') [...b.children].forEach((li, i) => pousser(t === 'UL' ? '• ' : `${i + 1}. `, enLigne(li)));
      else pousser('', enLigne(b));
    });
    // une ligne « > » vide ou un titre vide redeviennent des lignes vides
    return lignes.map((l) => (/^(# |## |> |• |\d{1,3}\. )\s*$/.test(l) ? '' : l)).join('\n').replace(/\n+$/, '');
  }

  /* ─── le texte tel que l'œil le lit, et sa carte vers la feuille ───
     Pour le correcteur et la relecture : chaque ligne de la feuille, sans
     les marques. La carte relie chaque position à son nœud de texte. */
  function plat(feuille) {
    let texte = '';
    const segs = [];
    const blocs = [...feuille.children];
    blocs.forEach((b, i) => {
      if (i) texte += '\n';
      if (b.tagName === 'HR') return;
      let premierP = true;
      const marcher = (n) => n.childNodes.forEach((c) => {
        if (c.nodeType === 3) { segs.push({ n: c, d: texte.length }); texte += c.nodeValue; return; }
        if (c.nodeType !== 1) return;
        if (c.tagName === 'BR') { texte += '\n'; return; }
        if (c.tagName === 'P' && b.tagName === 'BLOCKQUOTE') { if (!premierP) texte += '\n'; premierP = false; }
        marcher(c);
      });
      marcher(b);
    });
    return { texte, segs };
  }
  function point(carte, pos) {
    for (let i = carte.segs.length - 1; i >= 0; i--) {
      const s = carte.segs[i];
      if (pos >= s.d) return { n: s.n, o: Math.min(pos - s.d, s.n.nodeValue.length) };
    }
    return null;
  }
  function plage(feuille, debut, fin, carte) {
    carte = carte || plat(feuille);
    const a = point(carte, debut), z = point(carte, fin);
    if (!a || !z) return null;
    const r = document.createRange();
    try { r.setStart(a.n, a.o); r.setEnd(z.n, z.o); } catch (e) { return null; }
    return r;
  }
  function decalage(feuille, noeud, o) {
    const carte = plat(feuille);
    const s = carte.segs.find((x) => x.n === noeud);
    return s ? s.d + o : null;
  }

  /* ─── idées pour écrire (gadget « Inspiration ») ─── */
  const IDEES = [
    'Écrivez la prière que vous n’osez pas dire à voix haute.',
    'Racontez un matin où vous avez senti Dieu tout proche.',
    'Un psaume en cinq lignes, sur la gratitude.',
    'Une lettre à la personne que vous étiez il y a dix ans.',
    'Décrivez une main qui vous a relevé.',
    'Ce que la pluie vous apprend sur la patience.',
    'Une parabole d’aujourd’hui, dans votre quartier.',
    'Le silence d’une église vide : écrivez ce qu’il dit.',
    'Une bénédiction pour quelqu’un que vous aimez.',
    'Le pardon que vous avez reçu, ou celui que vous attendez encore.',
    'Votre ville au lever du jour, comme un cantique.',
    'Une phrase que votre mère répétait, et ce qu’elle voulait dire.',
    'Ce que vous diriez à un enfant qui a peur du noir.',
    'Une nuit de doute, puis la première lumière.',
    'Le chemin de la maison, comme un pèlerinage.',
    'Écrivez un merci, sans dire à qui.',
    'Un poème où chaque vers commence par « Tu ».',
    'Le visage de l’espérance, si elle s’asseyait à votre table.',
    'Une prière pour le pays, en trois phrases.',
    'Ce que la foi change dans un jour ordinaire.'
  ];
  const VERSETS = ['Psaumes 23:1', 'Ésaïe 40:31', 'Jean 14:27', 'Philippiens 4:13', 'Psaumes 46:2', 'Romains 8:28', 'Lamentations 3:22-23', 'Matthieu 11:28',
    'Psaumes 121:1-2', 'Jérémie 29:11', '1 Corinthiens 13:4', 'Psaumes 37:5', 'Ésaïe 41:10', 'Jean 1:5', 'Psaumes 139:14', 'Michée 6:8'];
  const PAPIERS = { ivoire: 'Ivoire', blanc: 'Blanc', sepia: 'Sépia', nuit: 'Nuit' };
  const SPECIAUX = [['« ', 'Guillemet ouvrant'], [' »', 'Guillemet fermant'], ['“', 'Guillemet anglais ouvrant'], ['”', 'Guillemet anglais fermant'], ['—', 'Tiret cadratin'], ['–', 'Tiret demi-cadratin'],
    ['…', 'Points de suspension'], ['’', 'Apostrophe'], ['✝', 'Croix'], ['❦', 'Fleuron'], ['⁂', 'Astérisme'], ['·', 'Point médian']];
  const garde = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const poser = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  /* ═══ l'éditeur ═══
     opts : barre, doc (éléments) ; reglages { police, alignement } ;
     surReglage(cle, valeur) ; surSaisie(feuille) ; surFocus(feuille) ;
     mots(feuilles) pour le pied ; enregistrer() pour ⌘S. */
  function editeur(opts) {
    const s = S(), ic = (n) => s.icon(n);
    const doc = opts.doc, barre = opts.barre;
    const feuilles = [];
    let active = null, carteActive = null, taille = +garde('sozo-pl-taille', '19'), papier = garde('sozo-pl-papier', 'ivoire');
    let machine = garde('sozo-pl-machine', '0') === '1', concentration = garde('sozo-pl-concentration', '0') === '1';
    const reglages = { police: 'cormorant', alignement: 'gauche', ...(opts.reglages || {}) };
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}

    doc.classList.add('pl-doc');
    const peindreDoc = () => {
      doc.style.setProperty('--pl-police', s.POLICES[reglages.police] || s.POLICES.cormorant);
      doc.style.setProperty('--pl-taille', taille + 'px');
      doc.dataset.align = reglages.alignement;
      doc.dataset.papier = papier;
      doc.classList.toggle('pl-concentration', concentration);
    };
    peindreDoc();

    barre.classList.add('pl-barre');
    barre.setAttribute('role', 'toolbar');
    barre.setAttribute('aria-label', 'Mise en forme');
    const bouton = (k, icone, label, raccourci) => `<button type="button" class="pl-b" data-pl="${k}" title="${esc(label)}${raccourci ? ` (${raccourci})` : ''}" aria-label="${esc(label)}">${ic(icone)}</button>`;
    const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const cmd = (l) => (MAC ? '⌘' : 'Ctrl ') + l;
    barre.innerHTML = `
      <div class="pl-g">${bouton('undo', 'annuler', 'Annuler', cmd('Z'))}${bouton('redo', 'refaire', 'Rétablir', MAC ? '⇧⌘Z' : 'Ctrl Y')}</div>
      <div class="pl-g"><label class="sr" for="plStyle">Style du paragraphe</label>
        <select class="pl-sel" id="plStyle" data-pl-style><option value="p">Paragraphe</option><option value="h3">Titre</option><option value="h4">Sous-titre</option><option value="blockquote">Citation</option></select>
        ${bouton('bold', 'gras', 'Gras', cmd('B'))}${bouton('italic', 'italique', 'Italique', cmd('I'))}${bouton('puces', 'puces', 'Liste à puces')}${bouton('numeros', 'numeros', 'Liste numérotée')}</div>
      <div class="pl-g">${bouton('sep', 'separateur', 'Séparateur')}${bouton('verset', 'croix', 'Insérer un verset')}
        <div class="pl-menu"><button type="button" class="pl-b pl-b--t" data-pl-menu="car" aria-expanded="false" aria-haspopup="true" title="Caractères spéciaux">« »</button>
          <div class="pl-pop" data-pop="car" hidden>${SPECIAUX.map(([c, l]) => `<button type="button" class="pl-car" data-car="${esc(c)}" title="${esc(l)}">${esc(c.trim())}</button>`).join('')}</div></div></div>
      <div class="pl-g pl-g--page"><label class="sr" for="plPolice">Police</label>
        <select class="pl-sel" id="plPolice" data-pl-police>${Object.entries(s.NOMS_POLICES).map(([k, l]) => `<option value="${k}"${reglages.police === k ? ' selected' : ''}>${esc(l.replace(/ \(.*\)/, ''))}</option>`).join('')}</select>
        ${['gauche', 'centre', 'justifie'].map((a) => `<button type="button" class="pl-b" data-pl-align="${a}" aria-pressed="${reglages.alignement === a}" title="${{ gauche: 'Aligner à gauche', centre: 'Centrer', justifie: 'Justifier' }[a]}" aria-label="${{ gauche: 'Aligner à gauche', centre: 'Centrer', justifie: 'Justifier' }[a]}">${ic(a)}</button>`).join('')}
        <button type="button" class="pl-b pl-b--t" data-pl="moins" title="Texte plus petit à l’écran" aria-label="Texte plus petit à l’écran">A−</button><button type="button" class="pl-b pl-b--t" data-pl="plus" title="Texte plus grand à l’écran" aria-label="Texte plus grand à l’écran">A+</button></div>
      <div class="pl-g pl-g--outils">
        ${bouton('chercher', 'loupe', 'Rechercher et remplacer', cmd('F'))}${bouton('idee', 'lampe', 'Inspiration')}
        <div class="pl-menu"><button type="button" class="pl-b" data-pl-menu="plus" aria-expanded="false" aria-haspopup="true" title="Plus d’outils" aria-label="Plus d’outils">${ic('dots')}</button>
          <div class="pl-pop pl-pop--d" data-pop="plus" hidden>
            <button type="button" data-pl="machine" role="menuitemcheckbox" aria-checked="${machine}">${ic('machine')} Machine à écrire <small>la ligne écrite reste au milieu</small></button>
            <button type="button" data-pl="concentration" role="menuitemcheckbox" aria-checked="${concentration}">${ic('cible')} Concentration <small>seul le paragraphe en cours reste net</small></button>
            <button type="button" data-pl="objectif">${ic('star')} Objectif de mots</button>
            <button type="button" data-pl="maj">${ic('type')} MAJUSCULES / minuscules</button>
            <button type="button" data-pl="plein">${ic('plein')} Plein écran</button>
            <p class="pl-pop-l">Papier</p>
            <div class="pl-papiers">${Object.entries(PAPIERS).map(([k, l]) => `<button type="button" class="pl-papier pl-papier--${k}" data-papier="${k}" aria-pressed="${papier === k}">${l}</button>`).join('')}</div>
          </div></div></div>`;
    const btn = (k) => barre.querySelector(`[data-pl="${k}"]`);

    /* ─── feuilles ─── */
    function ajouter({ cle, texte, verrou, entete, avant }) {
      const bloc = document.createElement('section');
      bloc.className = 'pl-page';
      bloc.dataset.cle = cle;
      bloc.innerHTML = `${entete ? `<header class="pl-page-h">${entete}</header>` : ''}<div class="pl-feuille" contenteditable="${verrou ? 'false' : 'true'}" spellcheck="false" lang="fr" role="textbox" aria-multiline="true"></div>`;
      const el = bloc.querySelector('.pl-feuille');
      el.innerHTML = enBlocs(texte);
      if (opts.etiquette) el.setAttribute('aria-label', opts.etiquette(cle));
      const f = { cle, bloc, el, verrou: !!verrou, initial: versTexte(el) };
      if (avant) doc.insertBefore(bloc, avant.bloc); else doc.appendChild(bloc);
      feuilles.push(f);
      feuilles.sort((a, b) => (a.bloc.compareDocumentPosition(b.bloc) & 4 ? -1 : 1));
      el.addEventListener('focus', () => { active = f; carteActive = null; if (opts.surFocus) opts.surFocus(f); etatBarre(); });
      el.addEventListener('input', () => {
        if (!el.firstElementChild) el.innerHTML = '<p><br></p>';
        carteActive = null;
        if (opts.surSaisie) opts.surSaisie(f);
        if (machine) centrer();
      });
      el.addEventListener('paste', (e) => {
        // Coller du texte, jamais de HTML venu d'ailleurs : seules nos marques font la mise en forme
        e.preventDefault();
        const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r\n?/g, '\n');
        document.execCommand('insertText', false, t);
      });
      el.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.types.includes('text/html')) { e.preventDefault(); const t = e.dataTransfer.getData('text/plain'); if (t) document.execCommand('insertText', false, t); } });
      el.addEventListener('click', (e) => { if (opts.surClic) opts.surClic(f, e); });
      return f;
    }
    function retirer(f) { f.bloc.remove(); feuilles.splice(feuilles.indexOf(f), 1); if (active === f) active = null; }
    const texte = (f) => versTexte(f.el);
    function remplacerTout(f, t) { f.el.innerHTML = enBlocs(t); carteActive = null; }

    /* ─── la barre suit la sélection ─── */
    function blocCourant() {
      const sel = getSelection();
      if (!sel.rangeCount || !active) return null;
      let n = sel.anchorNode;
      while (n && n.parentNode !== active.el) n = n.parentNode;
      return n && n.nodeType === 1 ? n : null;
    }
    function etatBarre() {
      try {
        btn('bold').setAttribute('aria-pressed', String(document.queryCommandState('bold')));
        btn('italic').setAttribute('aria-pressed', String(document.queryCommandState('italic')));
      } catch (e) {}
      const b = blocCourant();
      const st = b ? ({ H3: 'h3', H1: 'h3', H2: 'h3', H4: 'h4', BLOCKQUOTE: 'blockquote' }[b.tagName] || 'p') : 'p';
      barre.querySelector('[data-pl-style]').value = st;
      doc.querySelectorAll('.pl-ici').forEach((x) => x !== b && x.classList.remove('pl-ici'));
      if (b && concentration) b.classList.add('pl-ici');
    }
    document.addEventListener('selectionchange', () => {
      if (!active || !active.el.contains(getSelection().anchorNode)) return;
      etatBarre();
      if (machine) centrer();
    });
    function centrer() {
      const sel = getSelection();
      if (!sel.rangeCount) return;
      const r = sel.getRangeAt(0).cloneRange();
      let rect = r.getClientRects()[0];
      if (!rect) { const b = blocCourant(); rect = b && b.getBoundingClientRect(); }
      if (!rect) return;
      const cible = innerHeight * 0.42;
      if (Math.abs(rect.top - cible) > 24) scrollBy({ top: rect.top - cible, behavior: s.reduced ? 'auto' : 'smooth' });
    }

    /* ─── commandes ─── */
    let selGardee = null;
    const garderSel = () => { const sel = getSelection(); selGardee = sel.rangeCount && active && active.el.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null; };
    const rendreSel = () => {
      if (!active) return false;
      active.el.focus({ preventScroll: true });
      if (selGardee) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(selGardee); }
      return true;
    };
    const exiger = () => {
      if (!active || active.verrou) { s.toast(active && active.verrou ? 'Cette feuille est en lecture seule.' : 'Cliquez d’abord dans le texte.'); return false; }
      return true;
    };
    function exec(c, v) { document.execCommand(c, false, v); carteActive = null; if (opts.surSaisie && active) opts.surSaisie(active); etatBarre(); }
    function style(tag) {
      if (!exiger()) return;
      rendreSel();
      const b = blocCourant();
      const deja = b && (b.tagName === tag.toUpperCase());
      exec('formatBlock', `<${deja ? 'p' : tag}>`);
    }
    barre.addEventListener('mousedown', (e) => { if (e.target.closest('.pl-b, .pl-car, .pl-pop button')) { garderSel(); e.preventDefault(); } });
    barre.addEventListener('click', (e) => {
      const m = e.target.closest('[data-pl-menu]');
      if (m) { basculerMenu(m.dataset.plMenu); return; }
      const car = e.target.closest('[data-car]');
      if (car) { if (!exiger()) return; rendreSel(); exec('insertText', car.dataset.car); fermerMenus(); return; }
      const al = e.target.closest('[data-pl-align]');
      if (al) { regler('alignement', al.dataset.plAlign); return; }
      const pa = e.target.closest('[data-papier]');
      if (pa) { papier = pa.dataset.papier; poser('sozo-pl-papier', papier); barre.querySelectorAll('[data-papier]').forEach((x) => x.setAttribute('aria-pressed', String(x === pa))); peindreDoc(); return; }
      const b = e.target.closest('[data-pl]');
      if (!b) return;
      const k = b.dataset.pl;
      if (k === 'undo' || k === 'redo') { if (!active) return; rendreSel(); exec(k); return; }
      if (k === 'bold' || k === 'italic') { if (!exiger()) return; rendreSel(); exec(k); return; }
      if (k === 'puces' || k === 'numeros') { if (!exiger()) return; rendreSel(); exec(k === 'puces' ? 'insertUnorderedList' : 'insertOrderedList'); return; }
      if (k === 'sep') { if (!exiger()) return; rendreSel(); exec('insertHTML', '<hr class="pl-sep"><p><br></p>'); return; }
      if (k === 'verset') { if (!exiger()) return; verset(); return; }
      if (k === 'moins' || k === 'plus') { taille = Math.max(15, Math.min(28, taille + (k === 'plus' ? 1 : -1))); poser('sozo-pl-taille', String(taille)); peindreDoc(); return; }
      if (k === 'chercher') { chercher(); return; }
      if (k === 'idee') { inspiration(); return; }
      if (k === 'machine') { machine = !machine; poser('sozo-pl-machine', machine ? '1' : '0'); b.setAttribute('aria-checked', String(machine)); s.toast(machine ? 'Machine à écrire : la ligne que vous écrivez reste au milieu de l’écran.' : 'Machine à écrire désactivée.'); return; }
      if (k === 'concentration') { concentration = !concentration; poser('sozo-pl-concentration', concentration ? '1' : '0'); b.setAttribute('aria-checked', String(concentration)); peindreDoc(); etatBarre(); return; }
      if (k === 'objectif') { objectif(); fermerMenus(); return; }
      if (k === 'maj') { casse(); fermerMenus(); return; }
      if (k === 'plein') { fermerMenus(); if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => s.toast('Le plein écran n’est pas disponible ici.')); return; }
    });
    barre.querySelector('[data-pl-style]').addEventListener('change', (e) => { style(e.target.value); });
    barre.querySelector('[data-pl-style]').addEventListener('mousedown', garderSel);
    barre.querySelector('[data-pl-police]').addEventListener('change', (e) => regler('police', e.target.value));
    function regler(k, v) {
      reglages[k] = v;
      if (k === 'alignement') barre.querySelectorAll('[data-pl-align]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.plAlign === v)));
      peindreDoc();
      if (opts.surReglage) opts.surReglage(k, v);
    }
    function basculerMenu(k) {
      const pop = barre.querySelector(`[data-pop="${k}"]`), b = barre.querySelector(`[data-pl-menu="${k}"]`);
      const ouvrir = pop.hidden;
      fermerMenus();
      pop.hidden = !ouvrir; b.setAttribute('aria-expanded', String(ouvrir));
    }
    function fermerMenus() { barre.querySelectorAll('.pl-pop').forEach((p) => { p.hidden = true; }); barre.querySelectorAll('[data-pl-menu]').forEach((b) => b.setAttribute('aria-expanded', 'false')); }
    document.addEventListener('click', (e) => { if (!e.target.closest('.pl-menu')) fermerMenus(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fermerMenus();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'f' && active) { e.preventDefault(); chercher(); }
    });

    /* ─── gadgets ─── */
    function verset() {
      garderSel();
      const B = s.bible;
      if (!B) { s.toast('La Bible intégrée n’est pas chargée sur cette page.'); return; }
      let trouve = null;
      const m = s.modal({ title: 'Insérer un verset', body: `<form class="pl-form" id="plVerset"><label class="cx-field">Référence<input id="plRef" placeholder="Ex. : Jean 3:16, Ps 23:1-4" autocomplete="off"></label>
        <div class="pl-apercu" id="plVApercu" aria-live="polite"><p class="ash">Louis Segond 1910. Le texte est lu dans la Bible intégrée, jamais recopié à la main.</p></div></form>`,
        actions: [{ label: 'Annuler' }, { label: 'Insérer', primary: true, onClick: (close) => {
          if (!trouve) { m.el.querySelector('#plVApercu').innerHTML = '<p class="cx-err">Tapez une référence reconnue, par exemple « Psaumes 23:1 ».</p>'; return; }
          close(); rendreSel();
          const b = blocCourant();
          if (b && b.textContent.trim()) exec('insertParagraph');
          exec('insertText', `« ${trouve.t} » (${trouve.label})`);
          exec('formatBlock', '<blockquote>');
          s.toast('Verset inséré en citation. Les lecteurs pourront l’ouvrir dans la Bible.');
        } }] });
      const champ = m.el.querySelector('#plRef'), ap = m.el.querySelector('#plVApercu');
      let t;
      champ.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(async () => {
          const r = B.parse(champ.value.trim());
          if (!r) { trouve = null; ap.innerHTML = champ.value.trim() ? '<p class="ash">Référence non reconnue pour l’instant…</p>' : ''; return; }
          ap.innerHTML = '<p class="ash"><span class="spin" aria-hidden="true"></span> Lecture du verset…</p>';
          try {
            const vs = await B.verses(r);
            if (!vs.length) { trouve = null; ap.innerHTML = '<p class="cx-err">Ce passage n’existe pas dans cette traduction.</p>'; return; }
            trouve = { t: vs.map((v) => v.t).join(' '), label: r.label };
            ap.innerHTML = `<blockquote class="pl-vapercu">${vs.slice(0, 6).map((v) => `<sup>${v.n}</sup> ${esc(v.t)}`).join(' ')}</blockquote><p class="ash">${esc(r.label)}</p>`;
          } catch (er) { trouve = null; ap.innerHTML = '<p class="cx-err">Le verset n’a pas pu être chargé (connexion ?).</p>'; }
        }, 280);
      });
      m.el.querySelector('#plVerset').addEventListener('submit', (e) => e.preventDefault());
      setTimeout(() => champ.focus(), 50);
    }

    function inspiration() {
      garderSel();
      let i = Math.floor(Math.random() * IDEES.length), v = Math.floor(Math.random() * VERSETS.length), lu = null;
      const m = s.modal({ title: 'Inspiration', body: `<div class="pl-idee"><p class="pl-idee-t" id="plIdee"></p><div class="pl-idee-v" id="plIdeeV" aria-live="polite"></div></div>`,
        actions: [{ label: 'Une autre idée', onClick: () => { i = (i + 1 + Math.floor(Math.random() * (IDEES.length - 1))) % IDEES.length; v = (v + 1) % VERSETS.length; peindre(); } },
          { label: 'Insérer le verset', onClick: (close) => {
            if (!lu || !exiger()) return;
            close(); rendreSel();
            const b = blocCourant(); if (b && b.textContent.trim()) exec('insertParagraph');
            exec('insertText', `« ${lu.t} » (${lu.label})`); exec('formatBlock', '<blockquote>');
          } },
          { label: 'Écrire', primary: true, onClick: (close) => { close(); rendreSel(); } }] });
      async function peindre() {
        m.el.querySelector('#plIdee').textContent = IDEES[i];
        const zone = m.el.querySelector('#plIdeeV');
        lu = null;
        if (!s.bible) { zone.innerHTML = ''; return; }
        const r = s.bible.parse(VERSETS[v]);
        zone.innerHTML = '<p class="ash"><span class="spin" aria-hidden="true"></span></p>';
        try {
          const vs = await s.bible.verses(r);
          lu = { t: vs.map((x) => x.t).join(' '), label: r.label };
          zone.innerHTML = `<blockquote>${esc(lu.t)}</blockquote><p class="ash">${esc(r.label)}</p>`;
        } catch (e) { zone.innerHTML = ''; }
      }
      peindre();
    }

    function objectif() {
      const actuel = +garde('sozo-pl-objectif', '0') || '';
      const m = s.modal({ title: 'Objectif de mots', body: `<p>Combien de mots voulez-vous écrire pendant cette séance ? Le compteur du bas suit votre avancée.</p>
        <label class="cx-field">Mots<input id="plObj" type="number" min="10" max="20000" step="10" value="${actuel}" placeholder="300"></label>`,
        actions: [{ label: 'Sans objectif', onClick: (close) => { poser('sozo-pl-objectif', '0'); close(); if (opts.surObjectif) opts.surObjectif(); } },
          { label: 'Fixer', primary: true, onClick: (close) => { const n = Math.max(10, Math.min(20000, +m.el.querySelector('#plObj').value || 300)); poser('sozo-pl-objectif', String(n)); close(); if (opts.surObjectif) opts.surObjectif(); } }] });
      setTimeout(() => m.el.querySelector('#plObj').focus(), 50);
    }

    function casse() {
      if (!exiger()) return;
      rendreSel();
      const sel = getSelection(), t = sel.toString();
      if (!t) { s.toast('Sélectionnez d’abord les mots à transformer.'); return; }
      if (t.includes('\n')) { s.toast('Une ligne à la fois, s’il vous plaît.'); return; }
      const suivant = t === t.toUpperCase() ? t.toLowerCase() : t === t.toLowerCase() ? t.replace(/(^|\s)(\p{L})/gu, (a, b, c) => b + c.toUpperCase()) : t.toUpperCase();
      exec('insertText', suivant);
      const r = getSelection().getRangeAt(0);
      try { r.setStart(r.endContainer, Math.max(0, r.endOffset - suivant.length)); getSelection().removeAllRanges(); getSelection().addRange(r); } catch (e) {}
    }

    /* Rechercher / remplacer, dans TOUTES les feuilles chargées */
    let panneauR = null;
    function chercher() {
      if (panneauR) { panneauR.querySelector('#plQ').focus(); return; }
      const sel = getSelection().toString();
      panneauR = document.createElement('div');
      panneauR.className = 'pl-chercher';
      panneauR.setAttribute('role', 'search');
      panneauR.innerHTML = `<div class="pl-chercher-l"><label class="sr" for="plQ">Rechercher</label><input id="plQ" placeholder="Rechercher" value="${esc(sel.length < 60 ? sel : '')}">
          <span class="pl-chercher-n" id="plN" aria-live="polite"></span>
          <button type="button" class="pl-b" data-r="prec" aria-label="Précédent" title="Précédent">${ic('left')}</button><button type="button" class="pl-b" data-r="suiv" aria-label="Suivant" title="Suivant">${ic('right')}</button>
          <button type="button" class="pl-b" data-r="fermer" aria-label="Fermer la recherche" title="Fermer">${ic('x')}</button></div>
        <div class="pl-chercher-l"><label class="sr" for="plR">Remplacer par</label><input id="plR" placeholder="Remplacer par">
          <button type="button" class="btn btn--ghost btn--sm" data-r="un">Remplacer</button><button type="button" class="btn btn--sm" data-r="tout">Tout remplacer</button>
          <label class="pl-coche"><input type="checkbox" id="plCasse"> Respecter la casse</label></div>`;
      barre.appendChild(panneauR);     // une ligne de la barre : elle reste visible en défilant, sans rien recouvrir
      const q = panneauR.querySelector('#plQ'), rp = panneauR.querySelector('#plR'), cs = panneauR.querySelector('#plCasse');
      let res = [], i = -1;
      const trouver = () => {
        res = [];
        const aiguille = q.value;
        if (aiguille) {
          feuilles.forEach((f) => {
            const c = plat(f.el), meule = cs.checked ? c.texte : c.texte.toLowerCase(), a = cs.checked ? aiguille : aiguille.toLowerCase();
            let k = meule.indexOf(a);
            while (k >= 0) { res.push({ f, s: k, e: k + aiguille.length }); k = meule.indexOf(a, k + Math.max(1, a.length)); }
          });
        }
        panneauR.querySelector('#plN').textContent = aiguille ? (res.length ? (i >= 0 ? `${i + 1} sur ${res.length}` : `${res.length} résultat${res.length > 1 ? 's' : ''}`) : 'aucun résultat') : '';
        if (window.CSS && CSS.highlights) {
          const h = new Highlight(); res.forEach((x) => { const r = plage(x.f.el, x.s, x.e); if (r) h.add(r); });
          CSS.highlights.set('pl-trouve', h);
        }
      };
      const aller = (d) => {
        trouver();
        if (!res.length) return;
        i = (i + d + res.length) % res.length;
        const x = res[i], r = plage(x.f.el, x.s, x.e);
        if (!r) return;
        x.f.el.focus({ preventScroll: true });
        const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
        const rect = r.getBoundingClientRect();
        scrollBy({ top: rect.top - innerHeight * 0.4, behavior: s.reduced ? 'auto' : 'smooth' });
        panneauR.querySelector('#plN').textContent = `${i + 1} sur ${res.length}`;
      };
      q.addEventListener('input', () => { i = -1; trouver(); });
      cs.addEventListener('change', () => { i = -1; trouver(); });
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aller(e.shiftKey ? -1 : 1); } });
      panneauR.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]'); if (!b) return;
        const k = b.dataset.r;
        if (k === 'fermer') { panneauR.remove(); panneauR = null; if (window.CSS && CSS.highlights) CSS.highlights.delete('pl-trouve'); return; }
        if (k === 'suiv' || k === 'prec') { aller(k === 'suiv' ? 1 : -1); return; }
        if (k === 'un') {
          if (i < 0 || !res[i]) { aller(1); return; }
          const x = res[i];
          if (x.f.verrou) { s.toast('Cette feuille est en lecture seule.'); return; }
          const r = plage(x.f.el, x.s, x.e); if (!r) return;
          x.f.el.focus({ preventScroll: true }); active = x.f;
          const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
          exec('insertText', rp.value);
          i -= 1; aller(1);
          return;
        }
        if (k === 'tout') {
          trouver();
          const parFeuille = new Map();
          res.forEach((x) => { if (!x.f.verrou) { if (!parFeuille.has(x.f)) parFeuille.set(x.f, []); parFeuille.get(x.f).push(x); } });
          let n = 0;
          parFeuille.forEach((liste, f) => {
            f.el.focus({ preventScroll: true }); active = f;
            liste.sort((a, z) => z.s - a.s).forEach((x) => {
              const r = plage(f.el, x.s, x.e); if (!r) return;
              const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
              document.execCommand('insertText', false, rp.value); n++;
            });
            if (opts.surSaisie) opts.surSaisie(f);
          });
          i = -1; trouver();
          s.toast(n ? `${n} remplacement${n > 1 ? 's' : ''}. ${MAC ? '⌘' : 'Ctrl '}Z pour annuler, feuille par feuille.` : 'Rien à remplacer.');
        }
      });
      trouver();
      q.focus(); q.select();
    }

    /* ─── soulignés du correcteur (API Highlight : le texte n'est pas touché) ─── */
    const TYPES_SOUL = ['orth', 'gram', 'typo', 'voc'];
    function souligner(f, remarques) {
      if (!(window.CSS && CSS.highlights)) return;
      const carte = plat(f.el);
      const groupes = Object.fromEntries(TYPES_SOUL.map((t) => [t, new Highlight()]));
      (remarques || []).forEach((x) => { const r = plage(f.el, x.s, x.e, carte); if (r && groupes[x.type]) groupes[x.type].add(r); });
      TYPES_SOUL.forEach((t) => CSS.highlights.set(`pl-${t}`, groupes[t]));
    }
    function remplacer(f, debut, fin, par) {
      if (f.verrou) return false;
      const r = plage(f.el, debut, fin);
      if (!r) return false;
      f.el.focus({ preventScroll: true }); active = f;
      const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
      exec('insertText', par);
      return true;
    }
    function selectionner(f, debut, fin) {
      const r = plage(f.el, debut, fin); if (!r) return;
      f.el.focus({ preventScroll: true });
      const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
      const rect = r.getBoundingClientRect();
      scrollBy({ top: rect.top - innerHeight / 3, behavior: s.reduced ? 'auto' : 'smooth' });
    }
    function curseur(f) {
      const sl = getSelection();
      if (!sl.rangeCount || !f.el.contains(sl.anchorNode)) return null;
      const n = sl.anchorNode;
      if (n.nodeType !== 3) return null;
      return decalage(f.el, n, sl.anchorOffset);
    }
    const plain = (f) => { if (f === active && carteActive) return carteActive; const c = plat(f.el); if (f === active) carteActive = c; return c; };

    return {
      feuilles, ajouter, retirer, texte, remplacerTout, souligner, remplacer, selectionner, curseur,
      plat: (f) => plain(f).texte, get active() { return active; }, set active(f) { active = f; },
      reglages, regler, mots: (t) => (String(t).match(/[\p{L}\d’'-]+/gu) || []).length, objectif: () => +garde('sozo-pl-objectif', '0')
    };
  }

  return { editeur, enBlocs, versTexte, plat };
})();
