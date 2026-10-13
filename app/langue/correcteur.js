/* ═══════════════════════════════════════════════════════════
   Sōzō — correcteur du français (Web Worker : n'occupe jamais la page).
   Dictionnaire : lexique Grammalecte v7.7 (MPL 2.0), 476 088 formes
   fléchies avec nature, genre, nombre, temps, personne, lemme, fréquence.
   Synonymes : thésaurus myThes (LGPL), chargé à la demande.

   Messages reçus  : init {base} · check {id, text, personal[]} · word {w}
   Messages envoyés : progress · ready · result {id, issues} · wordinfo

   Chaque remarque : { s, e, type, msg, sugg[], rule }
     type : orth (orthographe) · gram (grammaire) · typo (typographie)
            · voc (vocabulaire : pléonasme, barbarisme, répétition) · info
   Les règles de grammaire ne signalent que ce qui est SÛR d'après les
   étiquettes du dictionnaire : un mot ambigu (nom ET verbe) n'est pas
   jugé. Mieux vaut une faute oubliée qu'une fausse alerte qui fait
   perdre confiance à l'auteur.
   ═══════════════════════════════════════════════════════════ */
'use strict';
let LEX = null, COMBOS = [], LEMMAS = [], BYLEMMA = null, SYN = null, BASE = '';

const b36 = (s) => parseInt(s, 36);
async function init(base) {
  BASE = base;
  postMessage({ type: 'progress', step: 'Téléchargement du dictionnaire…' });
  const txt = await (await fetch(base + 'lexique.txt')).text();
  postMessage({ type: 'progress', step: 'Préparation des 476 000 formes…' });
  let i = txt.indexOf('\n'), j = txt.indexOf('\n', i + 1);
  COMBOS = JSON.parse(txt.slice(i + 1, j)).map((c) => new Set(c.split(' ').filter(Boolean)));
  const k = txt.indexOf('\n', j + 1);
  let prev = '';
  LEMMAS = txt.slice(j + 1, k).split('\x1f').map((x) => { const p = b36(x[0]); prev = prev.slice(0, p) + x.slice(1); return prev; });
  LEX = new Map();
  prev = '';
  let pos = k + 1;
  const L = txt.length;
  while (pos < L) {
    let nl = txt.indexOf('\n', pos); if (nl < 0) nl = L;
    const line = txt.slice(pos, nl);
    const tab = line.indexOf('\t');
    const p = b36(line[0]);
    const w = prev.slice(0, p) + line.slice(1, tab);
    LEX.set(w, line.slice(tab + 1));
    prev = w; pos = nl + 1;
  }
  postMessage({ type: 'ready', forms: LEX.size });
}

/* entrée du dictionnaire → { combos:[Set], f, lemmas:[] } */
function entry(w) {
  const raw = LEX.get(w);
  if (raw == null) return null;
  const [ks, f, lem] = raw.split('\t');
  return { w, combos: ks ? ks.split(',').map((x) => COMBOS[b36(x)]) : [], f: +f || 0, lemmas: lem ? lem.split(',').map((x) => LEMMAS[b36(x)]) : [w] };
}
function lookup(w) {
  return entry(w) || entry(w.toLowerCase()) || (w === w.toUpperCase() ? entry(w[0] + w.slice(1).toLowerCase()) : null);
}
/* index inverse lemme → formes, construit une fois, à la première demande */
function forms(lemma) {
  if (!BYLEMMA) {
    BYLEMMA = new Map();
    for (const [w, raw] of LEX) {
      const t = raw.split('\t');
      const lem = t[2] ? t[2].split(',').map((x) => LEMMAS[b36(x)]) : [w];
      for (const l of lem) { let a = BYLEMMA.get(l); if (!a) BYLEMMA.set(l, a = []); a.push(w); }
    }
  }
  return BYLEMMA.get(lemma) || [];
}
const has = (e, t) => !!e && e.combos.some((c) => c.has(t));
const all = (e, f) => !!e && e.combos.length > 0 && e.combos.every(f);
const isVerbCombo = (c) => c.has('v1') || c.has('v2') || c.has('v3') || c.has('v0');
const TENSES = ['ipre', 'iimp', 'ipsi', 'ifut', 'cond', 'spre', 'simp', 'impe'];
const PERS = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];

/* forme d'un lemme portant certaines étiquettes (la plus fréquente) */
function formWith(lemma, want, avoid = []) {
  let best = null, bf = -1;
  for (const w of forms(lemma)) {
    const e = entry(w);
    if (!e) continue;
    if (e.combos.some((c) => want.every((t) => c.has(t)) && !avoid.some((t) => c.has(t))) && e.f > bf) { best = w; bf = e.f; }
  }
  return best;
}

/* participe passé masculin singulier — les verbes intransitifs (« marcher »)
   ont un participe étiqueté « invariable », pas « masculin singulier » */
const ppasOf = (lem) => formWith(lem, ['ppas', 'mas', 'sg']) || formWith(lem, ['ppas', 'inv']) || formWith(lem, ['ppas'], ['fem', 'pl']);

/* ─── suggestions d'orthographe : 1 puis 2 modifications ─── */
const ALPHA = 'abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ-’';
function edits1(w) {
  const out = new Set();
  for (let i = 0; i <= w.length; i++) {
    const a = w.slice(0, i), b = w.slice(i);
    if (b) out.add(a + b.slice(1));
    if (b.length > 1) out.add(a + b[1] + b[0] + b.slice(2));
    for (const c of ALPHA) { if (b) out.add(a + c + b.slice(1)); out.add(a + c + b); }
  }
  return out;
}
function suggest(word) {
  const low = word.toLowerCase();
  const cap = word[0] !== low[0];
  const score = (w) => { const e = entry(w); return e ? e.f * 10 + (e.combos.some((c) => c.has('npr') || c.has('prn')) ? 0 : 1) : -1; };
  let cand = [...edits1(low)].filter((w) => LEX.has(w));
  if (cand.length === 0 && low.length > 3 && low.length < 16) {
    const seen = new Set();
    for (const e1 of edits1(low)) for (const e2 of edits1(e1)) if (!seen.has(e2) && LEX.has(e2)) { seen.add(e2); cand.push(e2); }
  }
  cand = [...new Set(cand)].sort((a, b) => score(b) - score(a)).slice(0, 5);
  return cand.map((c) => cap ? c[0].toUpperCase() + c.slice(1) : c);
}

/* ─── découpage ─── */
const ELIDE = ['jusqu’', 'lorsqu’', 'puisqu’', 'quoiqu’', 'presqu’', 'quelqu’', 'qu’', 'l’', 'd’', 'j’', 'm’', 't’', 's’', 'n’', 'c’'];
function tokenize(text) {
  const toks = [];
  const rx = /[\p{L}\p{M}][\p{L}\p{M}’'\-]*|\d+(?:[.,]\d+)?|[^\s\p{L}\p{M}\d]/gu;
  let m;
  while ((m = rx.exec(text))) {
    let w = m[0], s = m.index;
    const norm = w.replace(/'/g, '’');
    if (/[\p{L}]/u.test(w)) {
      const low = norm.toLowerCase();
      const el = ELIDE.find((x) => low.startsWith(x) && low.length > x.length);
      if (el && !LEX.has(norm) && !LEX.has(low)) {
        toks.push({ w: w.slice(0, el.length), s, e: s + el.length, word: true, elided: true });
        w = w.slice(el.length); s += el.length;
      }
      // « dit-il », « peut-on » : on sépare le pronom si le mot entier n'existe pas
      const hy = w.match(/^(.+?)(-(?:t-)?(?:je|tu|il|elle|on|nous|vous|ils|elles|ce|le|la|les|lui|leur|moi|toi|y|en|là|ci))$/i);
      if (hy && !LEX.has(w) && !LEX.has(w.toLowerCase())) {
        toks.push({ w: hy[1], s, e: s + hy[1].length, word: true });
        toks.push({ w: hy[2], s: s + hy[1].length, e: s + w.length, word: false, clitic: true });
        continue;
      }
      toks.push({ w, s, e: s + w.length, word: true });
    } else toks.push({ w, s, e: s + w.length, word: /\d/.test(w) ? 'num' : false });
  }
  return toks;
}

/* ─── listes de vocabulaire ─── */
const PLEO = [
  ['monter en haut', 'monter'], ['descendre en bas', 'descendre'], ['sortir dehors', 'sortir'], ['entrer dedans', 'entrer'],
  ['prévoir à l’avance', 'prévoir'], ['prévoir d’avance', 'prévoir'], ['au jour d’aujourd’hui', 'aujourd’hui'], ['se réunir ensemble', 'se réunir'],
  ['collaborer ensemble', 'collaborer'], ['puis ensuite', 'puis'], ['et puis ensuite', 'et puis'], ['voire même', 'voire'], ['ajouter en plus', 'ajouter'],
  ['comme par exemple', 'par exemple'], ['reculer en arrière', 'reculer'], ['s’entraider mutuellement', 's’entraider'], ['panacée universelle', 'panacée'],
  ['marcher à pied', 'marcher'], ['opposer son veto', 'opposer son veto'], ['préparer d’avance', 'préparer'], ['tous unanimes', 'unanimes'],
  ['hasard imprévu', 'hasard'], ['petite maisonnette', 'maisonnette'], ['dune de sable', 'dune'], ['saupoudrer de sucre', 'sucrer'],
  ['secousse sismique', 'séisme'], ['tri sélectif', 'tri'], ['répéter à nouveau', 'répéter'], ['recommencer à nouveau', 'recommencer'],
  ['continuer encore', 'continuer'], ['finalement en conclusion', 'en conclusion'], ['car en effet', 'car'], ['mais cependant', 'mais'], ['mais pourtant', 'pourtant']
].filter(([a, b]) => a !== b);
const BARBA = [
  [/\bmalgré qu(?:e|’)/gi, 'bien que', 'Barbarisme : « malgré que » s’emploie surtout avec « en avoir ». Écrivez « bien que » (+ subjonctif).'],
  [/\bpallier à\b/gi, 'pallier', '« Pallier » est transitif direct : on pallie un manque.'],
  [/\bse rappeler de\b/gi, 'se rappeler', 'On se rappelle quelque chose (sans « de »), mais on se souvient de quelque chose.'],
  [/\bsolutionner\b/gi, 'résoudre', 'Préférez « résoudre » à « solutionner ».'],
  [/\bau final\b/gi, 'finalement', 'Tournure familière : « finalement », « en fin de compte ».'],
  [/\bfaire sens\b/gi, 'avoir du sens', 'Anglicisme (« to make sense ») : « avoir du sens ».'],
  [/\bdéfinitivement\b(?= (?:oui|d’accord|vrai|mieux|plus))/gi, 'assurément', 'Anglicisme (« definitely ») : « assurément », « sans aucun doute ».'],
  [/\bimpacter\b/gi, 'avoir des conséquences sur', 'Anglicisme : « avoir des conséquences sur », « toucher », « influer sur ».'],
  [/\bsuite à\b/gi, 'à la suite de', 'Tournure administrative : « à la suite de », « après ».'],
  [/\bpar contre\b/gi, 'en revanche', 'Admis, mais « en revanche » est plus soutenu.'],
  [/\bde manière à ce que\b/gi, 'de manière que', '« de manière que » suffit.'],
  [/\bsi j’aurais\b/gi, 'si j’avais', 'Après « si » de condition, pas de conditionnel : « si j’avais ».'],
  [/\bsi tu aurais\b/gi, 'si tu avais', 'Après « si » de condition, pas de conditionnel.'],
  [/\bsi il\b/gi, 's’il', 'Élision obligatoire : « s’il ».'],
  [/\bquoique ça soit\b/gi, 'quoi que ce soit', '« Quoi que ce soit » (en deux mots).'],
  [/\bc’est de valeur\b/gi, 'c’est dommage', 'Régionalisme : « c’est dommage ».']
];
const STOP = new Set('être avoir faire dire aller voir pouvoir vouloir devoir savoir venir prendre mettre donner falloir chose temps monde jour fois vie homme femme peu plus tout tous toute toutes même autre aussi bien très encore alors comme quand'.split(' '));

const AVOIR = new Set('ai as a avons avez ont avais avait avions aviez avaient eus eut eûmes eûtes eurent aurai auras aura aurons aurez auront aurais aurait aurions auriez auraient aie aies ait ayons ayez aient'.split(' '));
const ETRE = new Set('suis es est sommes êtes sont étais était étions étiez étaient fus fut fûmes fûtes furent serai seras sera serons serez seront serais serait serions seriez seraient sois soit soyons soyez soient'.split(' '));
const ADVS = new Set('pas plus jamais bien déjà toujours trop beaucoup tout encore souvent vite mal guère point rien enfin aussi même presque'.split(' '));
const NEGW = new Set('pas plus jamais rien guère point personne aucun aucune que qu’ ni nul nulle nullement goutte mie brin'.split(' '));
const SUBJ = { je: '1sg', 'j’': '1sg', tu: '2sg', il: '3sg', elle: '3sg', on: '3sg', nous: '1pl', vous: '2pl', ils: '3pl', elles: '3pl' };
const CLAUSE = new Set(['et', 'mais', 'ou', 'donc', 'car', 'que', 'qu’', 'quand', 'si', 'lorsque', 'lorsqu’', 'puis', 'comme', 'puisque', 'parce']);
const OBJ = new Set(['ne', 'n’', 'me', 'm’', 'te', 't’', 'se', 's’', 'le', 'la', 'l’', 'les', 'lui', 'leur', 'y', 'en', 'nous', 'vous']);
const DET_SG = new Set(['le', 'la', 'un', 'une', 'ce', 'cet', 'cette', 'mon', 'ma', 'ton', 'ta', 'son', 'sa', 'notre', 'votre', 'chaque', 'quel', 'quelle']);
const DET_PL = new Set(['les', 'des', 'ces', 'mes', 'tes', 'ses', 'nos', 'vos', 'quelques', 'plusieurs', 'quels', 'quelles', 'aux']);
const DET_FEM = { une: 'un', la: 'le', cette: 'ce' }, DET_MAS = { un: 'une', le: 'la', ce: 'cette', cet: 'cette' };
const PRONOUN_DET = new Set(['le', 'la', 'les']);   // aussi pronoms devant un verbe

function check(text, personal = []) {
  const issues = [];
  const add = (s, e, type, msg, sugg = [], rule = '') => issues.push({ s, e, type, msg, sugg: sugg.filter((x) => x != null), rule });
  const own = new Set(personal.map((x) => x.toLowerCase()));
  const toks = tokenize(text);
  const words = toks.filter((t) => t.word === true);
  for (const t of words) { t.lw = t.w.replace(/'/g, '’').toLowerCase(); t.ent = lookup(t.w.replace(/'/g, '’')); }

  /* — orthographe — */
  const atStart = (t) => { const i = toks.indexOf(t); for (let k = i - 1; k >= 0; k--) { if (toks[k].word) return false; if (/[.!?…«“]/.test(toks[k].w)) return true; } return true; };
  for (const t of words) {
    if (t.ent || t.elided || own.has(t.lw) || t.w.length < 2) continue;
    if (/^[A-ZÀ-Ý]/.test(t.w) && !atStart(t)) continue;                       // nom propre probable
    if (t.w.includes('-') && t.w.split('-').every((p) => !p || lookup(p))) continue;
    add(t.s, t.e, 'orth', `« ${t.w} » est inconnu du dictionnaire.`, suggest(t.w), 'orth');
  }

  /* — grammaire — */
  for (let i = 0; i < words.length; i++) {
    const t = words[i], n = words[i + 1], n2 = words[i + 2], p = words[i - 1];
    const gap = (a, b) => text.slice(a.e, b.s);
    const adjacent = (a, b) => a && b && /^[\s ]*$/.test(gap(a, b));
    if (!n) break;

    // mot répété : « le le »
    if (t.lw === n.lw && adjacent(t, n) && !['nous', 'vous', 'que', 'tout'].includes(t.lw))
      add(t.s, n.e, 'gram', `Mot répété : « ${t.w} ${n.w} ».`, [t.w], 'repet');

    // élision : « le arbre » → « l’arbre »
    const EL = { le: 'l’', la: 'l’', de: 'd’', je: 'j’', me: 'm’', te: 't’', se: 's’', ne: 'n’', que: 'qu’', ce: 'c’' };
    if (EL[t.lw] && adjacent(t, n) && /^[aeiouyàâéèêëîïôûœ]/i.test(n.w) && !['onze', 'oui', 'ouate', 'yacht', 'yaourt', 'un', 'une'].includes(n.lw)
        && !(t.lw === 'ce' && !['est', 'était', 'en'].includes(n.lw)) && !(['la', 'le'].includes(t.lw) && n.lw === 'une'))
      add(t.s, n.e, 'gram', `Élision obligatoire devant une voyelle.`, [EL[t.lw] + n.w], 'elision');

    // « n’en n’avait » → « n’en avait »
    if (t.lw === 'n’' && n.lw === 'en' && n2 && n2.lw === 'n’')
      add(n2.s, n2.e, 'gram', 'Double négation : un seul « ne » suffit (« je n’en avais »).', [''], 'neg2');

    // négation incomplète : « ne » sans « pas, plus, jamais… »
    if ((t.lw === 'ne' || t.lw === 'n’') && !(n.lw === 'importe')) {
      let ok = false;
      for (let k = toks.indexOf(t) + 1; k < toks.length && k < toks.indexOf(t) + 14; k++) {
        const x = toks[k];
        if (!x.word && /[.;:!?…]/.test(x.w)) break;
        if (x.word && NEGW.has(x.w.replace(/'/g, '’').toLowerCase())) { ok = true; break; }
      }
      if (!ok) add(t.s, t.e, 'gram', 'Négation incomplète : « ne » attend « pas », « plus », « jamais »… (tournure littéraire admise avec « savoir », « pouvoir », « oser », « cesser »).', [], 'neg');
    }

    // accord déterminant – nom en nombre
    if ((DET_SG.has(t.lw) || DET_PL.has(t.lw)) && adjacent(t, n) && n.ent && all(n.ent, (c) => c.has('nom') || c.has('adj'))
        && !(PRONOUN_DET.has(t.lw) && has(n.ent, 'v1'))) {
      const pl = DET_PL.has(t.lw);
      const fits = n.ent.combos.some((c) => c.has('inv') || (pl ? c.has('pl') : c.has('sg')) || (!c.has('sg') && !c.has('pl')));
      if (!fits) {
        const c0 = n.ent.combos.find((c) => c.has('nom')) || n.ent.combos[0];
        const g = c0.has('fem') ? 'fem' : c0.has('mas') ? 'mas' : null;
        const s = formWith(n.ent.lemmas[0], [c0.has('nom') ? 'nom' : 'adj', pl ? 'pl' : 'sg'].concat(g ? [] : []));
        add(t.s, n.e, 'gram', `Accord : « ${t.w} » est ${pl ? 'pluriel' : 'singulier'}, « ${n.w} » ne l’est pas.`, s ? [`${t.w} ${s}`] : [], 'accord-nb');
      }
    }
    // accord déterminant – nom en genre (un/une, le/la, ce/cette)
    if ((DET_FEM[t.lw] || DET_MAS[t.lw]) && adjacent(t, n) && n.ent && all(n.ent, (c) => c.has('nom')) && !(PRONOUN_DET.has(t.lw) && has(n.ent, 'v1'))) {
      const fem = !!DET_FEM[t.lw];
      const fits = n.ent.combos.some((c) => c.has('epi') || c.has(fem ? 'fem' : 'mas') || (!c.has('mas') && !c.has('fem')));
      if (!fits) {
        let other = fem ? DET_FEM[t.lw] : DET_MAS[t.lw];
        if (other === 'ce' && /^[aeiouyhàâéèêîôû]/i.test(n.w)) other = 'cet';
        add(t.s, t.e, 'gram', `Accord : « ${n.w} » est ${fem ? 'masculin' : 'féminin'}.`, [t.w[0] === t.w[0].toUpperCase() ? other[0].toUpperCase() + other.slice(1) : other], 'accord-genre');
      }
    }

    // auxiliaire + infinitif : « il a manger » → « il a mangé »
    if ((AVOIR.has(t.lw) || ETRE.has(t.lw)) && p && (SUBJ[p.lw] || p.lw === 'qui' || has(p.ent, 'nom') || has(p.ent, 'npr') || OBJ.has(p.lw))) {
      let v = n, k = i + 1;
      while (v && ADVS.has(v.lw) && k < i + 3) v = words[++k];
      if (v && v.ent && v.lw.endsWith('er') && v.ent.combos.some((c) => c.has('infi') && c.has('v1')) && !(t.lw === 'a' && p.lw === 'y') && !(n2 && v === n && ['de', 'du', 'des'].includes(n2.lw) && has(v.ent, 'nom'))) {
        const pp = ppasOf(v.ent.lemmas[0]);
        add(v.s, v.e, 'gram', `Après l’auxiliaire « ${t.w} », on attend un participe passé, pas un infinitif.`, pp ? [pp] : [], 'aux-infi');
      }
    }
    // « j’ai du partir » → « dû »
    if (AVOIR.has(t.lw) && n.lw === 'du' && (!n2 || !n2.ent || has(n2.ent, 'infi'))) add(n.s, n.e, 'gram', '« dû » (participe de « devoir ») prend un accent circonflexe.', ['dû'], 'du');

    // verbe de mouvement / modal ou « pour, sans » + participe : « pour mangé » → « pour manger »
    const MODAL = ['aller', 'devoir', 'pouvoir', 'vouloir', 'falloir', 'savoir', 'faire', 'laisser', 'oser', 'sembler'];
    const trig = ['pour', 'sans'].includes(t.lw) || (t.ent && t.ent.combos.some((c) => isVerbCombo(c) && TENSES.some((x) => c.has(x))) && MODAL.includes(t.ent.lemmas[0]) && !AVOIR.has(t.lw) && !ETRE.has(t.lw));
    if (trig && n.ent && adjacent(t, n) && /é(e?s?)$/.test(n.lw) && n.ent.combos.some((c) => c.has('ppas') && c.has('v1')) && all(n.ent, (c) => c.has('ppas') || c.has('adj') || c.has('nom'))) {
      const inf = n.ent.lemmas.find((l) => l.endsWith('er'));
      if (inf && !(t.lw === 'faire' && false)) add(n.s, n.e, 'gram', `Après « ${t.w} », on attend un infinitif.`, [inf], 'infi');
    }

    // homophones après un sujet
    if (['il', 'elle', 'on', 'qui'].includes(t.lw) && n.lw === 'à' && adjacent(t, n)) add(n.s, n.e, 'gram', '« a » (verbe avoir) et non « à » (préposition).', ['a'], 'a-à');
    if (['ils', 'elles'].includes(t.lw) && adjacent(t, n)) {
      if (n.lw === 'on') add(n.s, n.e, 'gram', '« ont » (verbe avoir) et non « on ».', ['ont'], 'on-ont');
      if (n.lw === 'son') add(n.s, n.e, 'gram', '« sont » (verbe être) et non « son ».', ['sont'], 'son-sont');
    }
    if (['il', 'elle', 'on', 'ce', 'c’', 'qui'].includes(t.lw) && n.lw === 'et' && n2 && n2.ent && !has(n2.ent, 'propersuj') && !SUBJ[n2.lw]
        && n2.ent.combos.some((c) => c.has('adj') || c.has('ppas') || c.has('det')))
      add(n.s, n.e, 'gram', '« est » (verbe être) et non « et » (conjonction).', ['est'], 'et-est');

    // accord sujet – verbe : « nous mange » → « nous mangeons »
    if (SUBJ[t.lw] && (!['nous', 'vous', 'elle', 'elles'].includes(t.lw) || !p || CLAUSE.has(p.lw) || /[.,;:!?«—–]/.test(text.slice(p.e, t.s)))) {
      let v = n, k = i + 1;
      while (v && OBJ.has(v.lw) && k < i + 4) v = words[++k];
      if (v && v.ent && all(v.ent, (c) => isVerbCombo(c) && TENSES.some((x) => c.has(x)))) {
        const want = SUBJ[t.lw];
        if (!v.ent.combos.some((c) => c.has(want) && !c.has('impe'))) {   // un impératif n'a pas de sujet : « tu mange » est fautif
          const c0 = v.ent.combos.find((c) => !c.has('impe')) || v.ent.combos[0], tense = TENSES.find((x) => c0.has(x));
          const s = formWith(v.ent.lemmas[0], [tense, want]);
          add(v.s, v.e, 'gram', `Accord avec « ${t.w} » : le verbe doit être à la ${want[0] === '1' ? '1re' : want[0] + 'e'} personne du ${want.endsWith('sg') ? 'singulier' : 'pluriel'}.`, s ? [s] : [], 'sujet-verbe');
        }
      }
    }
  }

  /* — typographie française — */
  let m;
  const rxp = (rx, f) => { rx.lastIndex = 0; while ((m = rx.exec(text))) f(m); };
  rxp(/(\S)([;:!?»])/g, (mm) => { if (mm[1] === ' ' || mm[1] === ' ' || /[;:!?\d]/.test(mm[1]) || (mm[2] === ':' && /\d/.test(text[mm.index + 2] || ''))) return; if (/https?$/.test(text.slice(Math.max(0, mm.index - 5), mm.index + 1))) return; add(mm.index + 1, mm.index + 2, 'typo', `Une espace fine insécable se place avant « ${mm[2]} ».`, [' ' + mm[2]], 'esp-avant'); });
  rxp(/«(\S)/g, (mm) => add(mm.index, mm.index + 1, 'typo', 'Une espace insécable suit le guillemet ouvrant « « ».', ['« '], 'esp-guil'));
  rxp(/ +([,.])/g, (mm) => add(mm.index, mm.index + mm[0].length, 'typo', `Pas d’espace avant « ${mm[1]} ».`, [mm[1]], 'esp-virg'));
  rxp(/([,;])(?=[\p{L}])/gu, (mm) => add(mm.index, mm.index + 1, 'typo', `Une espace suit « ${mm[1]} ».`, [mm[1] + ' '], 'esp-apres'));
  rxp(/([.!?])([A-ZÀ-Ý])/g, (mm) => { if (/\b[A-Z]\.$/.test(text.slice(mm.index - 2, mm.index + 1))) return; add(mm.index, mm.index + 1, 'typo', 'Une espace suit la fin de phrase.', [mm[1] + ' '], 'esp-phrase'); });
  rxp(/ {2,}/g, (mm) => add(mm.index, mm.index + mm[0].length, 'typo', 'Espaces multiples.', [' '], 'esp-double'));
  rxp(/\.\.\./g, (mm) => add(mm.index, mm.index + 3, 'typo', 'Points de suspension : un seul caractère « … ».', ['…'], 'susp'));
  rxp(/(\p{L})'(\p{L})/gu, (mm) => add(mm.index + 1, mm.index + 2, 'typo', 'Apostrophe typographique « ’ ».', ['’'], 'apos'));
  rxp(/(^|[.!?…]\s+)(\p{Ll})/gu, (mm) => { const at = mm.index + mm[1].length; if (/\b(etc|cf|p|ex|av|apr|env|chap|vol)\.\s+$/i.test(text.slice(Math.max(0, at - 8), at))) return; add(at, at + 1, 'typo', 'Majuscule en début de phrase.', [mm[2].toUpperCase()], 'maj'); });

  /* — vocabulaire : pléonasmes, barbarismes, répétitions — */
  const lowText = text.replace(/'/g, '’').toLowerCase();
  for (const [p, r] of PLEO) {
    let at = -1;
    while ((at = lowText.indexOf(p, at + 1)) >= 0) {
      if (/[\p{L}]/u.test(lowText[at - 1] || '') || /[\p{L}]/u.test(lowText[at + p.length] || '')) continue;
      add(at, at + p.length, 'voc', `Pléonasme : « ${p} » dit deux fois la même chose.`, [r], 'pleo');
    }
  }
  /* \b ne connaît que l'ASCII : « malgré » finirait sur une « non-lettre ».
     On le remplace par des bornes Unicode. */
  const ub = (rx) => new RegExp(rx.source.replace(/^\\b/, '(?<![\\p{L}\\p{M}’])').replace(/\\b(?=[^\\\\]*$)/, '(?![\\p{L}\\p{M}])'), 'giu');
  for (const [rx, r, msg] of BARBA) rxp(ub(rx), (mm) => add(mm.index, mm.index + mm[0].length, 'voc', msg, [r], 'barba'));
  const seen = new Map();
  words.forEach((t, k) => {
    if (!t.ent || t.w.length < 5) return;
    if (!t.ent.combos.some((c) => c.has('nom') || c.has('adj')) || t.ent.combos.some(isVerbCombo)) return;   // les verbes reviennent naturellement
    const lem = t.ent.lemmas[0];
    if (STOP.has(lem) || t.ent.f >= 9) return;
    const prev = seen.get(lem);
    if (prev != null && k - prev.k <= 30) add(t.s, t.e, 'voc', `Répétition : « ${lem} » revient ${k - prev.k} mots plus loin.`, [], 'repetition:' + lem);
    seen.set(lem, { k });
  });

  // une remarque par endroit : la grammaire passe avant l'orthographe… sauf si le mot est inconnu
  issues.sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  for (const x of issues) { if (!out.some((y) => y.s === x.s && y.e === x.e && y.type === x.type)) out.push(x); }
  return out;
}

/* ─── fiche d'un mot : nature, lemme, formes, synonymes ─── */
const NAT = { nom: 'nom', adj: 'adjectif', v1: 'verbe (1er groupe)', v2: 'verbe (2e groupe)', v3: 'verbe (3e groupe)', v0: 'auxiliaire', adv: 'adverbe', prep: 'préposition', det: 'déterminant', detpos: 'déterminant possessif', detdem: 'déterminant démonstratif', detind: 'déterminant indéfini', cjco: 'conjonction de coordination', cjsub: 'conjonction de subordination', interj: 'interjection', npr: 'nom propre', prn: 'prénom', patr: 'patronyme', propersuj: 'pronom personnel sujet', properobj: 'pronom personnel complément', prorel: 'pronom relatif', proint: 'pronom interrogatif', proind: 'pronom indéfini', prodem: 'pronom démonstratif' };
const TAGTXT = { mas: 'masculin', fem: 'féminin', epi: 'masculin et féminin', sg: 'singulier', pl: 'pluriel', inv: 'invariable', infi: 'infinitif', ppas: 'participe passé', ppre: 'participe présent', ipre: 'présent', iimp: 'imparfait', ipsi: 'passé simple', ifut: 'futur', cond: 'conditionnel', spre: 'subjonctif présent', simp: 'subjonctif imparfait', impe: 'impératif' };
async function wordinfo(w) {
  const e = lookup(w.replace(/'/g, '’'));
  if (!SYN) {
    try {
      const txt = await (await fetch(BASE + 'synonymes.txt')).text();
      SYN = new Map(txt.split('\n').slice(1).map((l) => { const i = l.indexOf('\t'); return [l.slice(0, i), l.slice(i + 1).split('|')]; }));
    } catch (err) { SYN = new Map(); }
  }
  if (!e) return { w, known: false, sugg: suggest(w) };
  const desc = e.combos.map((c) => [...c].map((t) => NAT[t] || TAGTXT[t] || (PERS.includes(t) ? t.replace('sg', 'e pers. sing.').replace('pl', 'e pers. plur.') : '')).filter(Boolean).join(', ')).filter(Boolean);
  const lem = e.lemmas[0];
  const syn = SYN.get(w.toLowerCase()) || SYN.get(lem) || [];
  let conj = null;
  if (e.combos.some(isVerbCombo)) {
    const row = (tense) => PERS.map((pp) => formWith(lem, [tense, pp]) || '—');
    conj = { ipre: row('ipre'), iimp: row('iimp'), ifut: row('ifut'), ppas: ppasOf(lem) };
  }
  return { w, known: true, lemma: lem, desc: [...new Set(desc)].slice(0, 6), freq: e.f, syn: syn.slice(0, 14), conj };
}

onmessage = async (ev) => {
  const d = ev.data;
  try {
    if (d.type === 'init') await init(d.base);
    else if (d.type === 'check') postMessage({ type: 'result', id: d.id, issues: check(d.text, d.personal || []) });
    else if (d.type === 'word') postMessage({ type: 'wordinfo', info: await wordinfo(d.w) });
  } catch (err) {
    postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};
