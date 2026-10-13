/* ═══════════════════════════════════════════════════════════
   Sōzō — données de DÉMONSTRATION (toutes fictives)
   Livres, auteurs, prix, dates et achats sont inventés. Les photos sont
   des images libres (CC0) qui illustrent, elles ne désignent personne.

   Dans le vrai logiciel, c'est le SERVEUR qui décide de ce qu'un lecteur
   peut lire (cahier des charges §15) : il ne transmet jamais le texte
   d'une page payante non achetée ni d'une page programmée. Ici, pas de
   serveur : le texte vit dans ce fichier, mais l'interface ne l'affiche
   QUE si la règle d'accès (SOZO.access, ui.js) l'autorise.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_DATA = (() => {
  const authors = {
    'nawezi-n':        { name: 'Nawezi N.', photo: 'foi-porte-eglise', city: 'Kinshasa', since: '2026', bio: 'Des mots entre foi, douleur et espérance, pour celles et ceux qui cherchent encore la lumière.', followers: 1200 },
    'ines-kanza':      { name: 'Inès Kanza', photo: 'portrait-sourire', city: 'Lyon', since: '2025', bio: "Écrit le jeudi soir, publie quand la page est prête. Romans au bord de l'eau, poèmes courts.", followers: 412 },
    'theo-marchetti':  { name: 'Théo Marchetti', photo: 'portrait-jeune-homme', city: 'Turin', since: '2024', bio: 'Fantasy lente, forêts qui parlent. Publie ses livres en entier, d’un seul coup.', followers: 1280 },
    'hugo-lindqvist':  { name: 'Hugo Lindqvist', photo: 'portrait-couloir', city: 'Göteborg', since: '2025', bio: 'Polars de quartier. Une page, un indice, jamais deux.', followers: 865 },
    'awa-diop':        { name: 'Awa Diop', photo: 'portrait-boucles', city: 'Dakar', since: '2026', bio: 'Un poème par semaine, le jeudi à 20 h. Gratuit, toujours.', followers: 2034 },
    'mireille-okafor': { name: 'Mireille Okafor', photo: 'autrice-ordinateur', city: 'Lagos', since: '2026', bio: 'Roman graphique sur les archives d’une ville. Dessine la nuit, publie à la quinzaine.', followers: 318 },
    'lina-petrova':    { name: 'Lina Petrova', photo: 'portrait-ville', city: 'Sofia', since: '2025', bio: 'Manga en photo-roman, noir et blanc. Un chapitre par mois.', followers: 977 },
    'kofi-mensah':     { name: 'Kofi Mensah', photo: 'portrait-bureau', city: 'Accra', since: '2024', bio: 'Histoires à lire à voix haute, pour les enfants et ceux qui les couchent.', followers: 1540 },
    'sofia-herrera':   { name: 'Sofia Herrera', photo: 'lectrice-echarpe', city: 'Valparaíso', since: '2025', bio: 'Nouvelles de cafés fermés tard. Alterne pages offertes et pages payantes.', followers: 640 },
    'jun-takeda':      { name: 'Jun Takeda', photo: 'lecteur-livre-rouge', city: 'Osaka', since: '2026', bio: 'Essais courts sur la lenteur. Vend le livre entier, rien à l’unité.', followers: 233 },
    'rafael-costa':    { name: 'Rafael Costa', photo: 'lecteur-banc', city: 'Porto', since: '2024', bio: 'Histoire des bibliothèques, chapitre par chapitre.', followers: 502 },
    'nadia-belkacem':  { name: 'Nadia Belkacem', photo: 'lectrice-canape', city: 'Marseille', since: '2023', bio: 'Premier roman, offert en entier. Le second s’écrit.', followers: 1890 }
  };

  /* Construit les pages d'un livre à partir de plages.
     access : 'free' | 'paid' ; status : 'published' | 'scheduled' | 'draft'
     date : ISO local (publication passée ou programmée) ; source : 'pdf' | 'editor' */
  function pages(ranges) {
    const out = [];
    ranges.forEach((r) => {
      for (let n = r.from; n <= r.to; n++) {
        const date = Array.isArray(r.dates) ? r.dates[n - r.from] : r.date;
        out.push({ n, access: r.access, status: r.status, date: date || null, source: r.source || 'pdf' });
      }
    });
    return out;
  }

  const books = [
    {
      /* livre des maquettes du propriétaire : titres et premières lignes repris d'elles */
      id: 'croix-de-bois', title: 'Croix de bois, Actes de foi', author: 'nawezi-n', cat: 'Foi',
      cover: { img: 'foi-croix-ciel', style: 'a' }, mode: 'progressive', access: 'mixed', file: 'croix-de-bois.pdf',
      desc: 'Un recueil entre foi, douleur et espérance. Des mots pour celles et ceux qui cherchent la lumière.',
      price: { page: 2.00, chapter: 5.00, all: 9.90 },
      chapters: [{ t: 'Ouverture', from: 1, to: 1 }, { t: 'I. Le commencement', from: 2, to: 2 }, { t: 'II. Entre la douleur et l’espérance', from: 3, to: 3 }, { t: 'III. Ce qui reste', from: 4, to: 8 }, { t: 'IV. Actes de foi', from: 9, to: 14 }, { t: 'V. Le chemin', from: 15, to: 20 }],
      pages: pages([
        { from: 1, to: 3, access: 'free', status: 'published', date: '2026-09-20T18:00' },
        { from: 4, to: 5, access: 'paid', status: 'published', date: '2026-09-27T18:00' },
        { from: 6, to: 8, access: 'paid', status: 'published', date: '2026-10-04T18:00' },
        { from: 9, to: 10, access: 'paid', status: 'scheduled', date: '2026-10-18T18:00' },
        { from: 11, to: 14, access: 'paid', status: 'scheduled', date: '2026-11-01T18:00' },
        { from: 15, to: 18, access: 'paid', status: 'draft' },
        { from: 19, to: 20, access: 'paid', status: 'draft', source: 'editor' }
      ])
    },
    {
      id: 'heures-salees', title: 'Les Heures salées', author: 'ines-kanza', cat: 'Roman',
      cover: { img: 'couv-mer', style: 'a' }, mode: 'progressive', access: 'mixed', file: 'les-heures-salees.pdf',
      desc: "À marée basse, Nour trouve sur le sable des lettres posées comme des coquillages. Quelqu'un écrit avec la mer — et c'est son prénom qui revient.",
      price: { page: 0.10, chapter: 0.35, all: 1.49 },
      chapters: [{ t: 'La marée du soir', from: 1, to: 5 }, { t: 'Les lettres', from: 6, to: 9 }, { t: 'Le port', from: 10, to: 14 }, { t: 'Les volets', from: 15, to: 19 }, { t: 'Ce que la mer garde', from: 20, to: 24 }],
      pages: pages([
        { from: 1, to: 3, access: 'free', status: 'published', date: '2026-08-29T18:00' },
        { from: 4, to: 4, access: 'free', status: 'published', date: '2026-08-30T18:00' },
        { from: 5, to: 5, access: 'free', status: 'published', date: '2026-09-13T18:00' },
        { from: 6, to: 8, access: 'paid', status: 'published', date: '2026-09-27T18:00' },
        { from: 9, to: 9, access: 'paid', status: 'published', date: '2026-10-01T20:00' },
        { from: 10, to: 12, access: 'paid', status: 'published', date: '2026-10-08T20:00' },
        { from: 13, to: 14, access: 'paid', status: 'scheduled', date: '2026-10-15T20:00' },
        { from: 15, to: 15, access: 'paid', status: 'scheduled', date: '2026-10-29T20:00' },
        { from: 16, to: 18, access: 'paid', status: 'scheduled', date: '2026-11-15T20:00' },
        { from: 19, to: 20, access: 'paid', status: 'draft' },
        { from: 21, to: 24, access: 'paid', status: 'draft', source: 'editor' }
      ])
    },
    {
      id: 'jardin-nuit', title: 'Le Jardin de nuit', author: 'theo-marchetti', cat: 'Fantasy',
      cover: { img: 'couv-jardin', style: 'b' }, mode: 'integral', access: 'paid',
      desc: "Chaque nuit, le jardin du vieux Sandro change d'allées. Celui qui s'y perd ressort avec un souvenir qui n'est pas le sien.",
      price: { page: 0.15, chapter: 0.50, all: 2.99 },
      chapters: [{ t: 'Les allées', from: 1, to: 10 }, { t: 'Le souvenir', from: 11, to: 20 }, { t: 'Sandro', from: 21, to: 30 }],
      pages: pages([{ from: 1, to: 30, access: 'paid', status: 'published', date: '2026-09-02T09:00' }])
    },
    {
      id: 'fenetre-rouge', title: 'La Fenêtre rouge', author: 'hugo-lindqvist', cat: 'Polar',
      cover: { img: 'couv-fenetre-rouge', style: 'c' }, mode: 'progressive', access: 'mixed',
      desc: 'Rue Fiskar, une fenêtre reste allumée en rouge toute la nuit. Le lendemain, quelqu’un manque à l’appel.',
      price: { page: 0.10, chapter: 0.40, all: 1.79 },
      chapters: [{ t: 'La rue Fiskar', from: 1, to: 5 }, { t: 'L’appel', from: 6, to: 10 }, { t: 'Le gardien', from: 11, to: 15 }, { t: 'Rouge', from: 16, to: 20 }],
      pages: pages([
        { from: 1, to: 3, access: 'free', status: 'published', date: '2026-09-05T19:00' },
        { from: 4, to: 7, access: 'paid', status: 'published', dates: ['2026-09-12T19:00', '2026-09-19T19:00', '2026-09-26T19:00', '2026-10-03T19:00'] },
        { from: 8, to: 9, access: 'paid', status: 'published', date: '2026-10-10T19:00' },
        { from: 10, to: 11, access: 'paid', status: 'scheduled', date: '2026-10-17T19:00' },
        { from: 12, to: 14, access: 'paid', status: 'scheduled', date: '2026-10-31T19:00' },
        { from: 15, to: 20, access: 'paid', status: 'draft' }
      ])
    },
    {
      id: 'petites-lumieres', title: 'Petites lumières', author: 'awa-diop', cat: 'Poésie',
      cover: { img: 'couv-lumieres', style: 'd' }, mode: 'progressive', access: 'free',
      desc: 'Un poème chaque jeudi à 20 h. Des lumières de cuisine, de bus, de téléphone — celles qu’on ne regarde jamais.',
      price: null,
      chapters: [{ t: 'Septembre', from: 1, to: 5 }, { t: 'Octobre', from: 6, to: 10 }, { t: 'Novembre', from: 11, to: 14 }],
      pages: pages([
        { from: 1, to: 10, access: 'free', status: 'published', dates: ['2026-08-06T20:00', '2026-08-13T20:00', '2026-08-20T20:00', '2026-08-27T20:00', '2026-09-03T20:00', '2026-09-10T20:00', '2026-09-17T20:00', '2026-09-24T20:00', '2026-10-01T20:00', '2026-10-08T20:00'] },
        { from: 11, to: 14, access: 'free', status: 'scheduled', dates: ['2026-10-15T20:00', '2026-10-22T20:00', '2026-10-29T20:00', '2026-11-05T20:00'] }
      ])
    },
    {
      id: 'spirale', title: 'La Spirale des archives', author: 'mireille-okafor', cat: 'Roman graphique', format: 'planche',
      cover: { img: 'couv-spirale', style: 'a' }, mode: 'progressive', access: 'mixed',
      desc: 'Dans une bibliothèque en spirale, une archiviste recopie chaque nuit une ville qui disparaît le jour.',
      price: { page: 0.20, chapter: 0.70, all: 2.49 },
      chapters: [{ t: 'L’escalier', from: 1, to: 4 }, { t: 'Les fiches', from: 5, to: 8 }, { t: 'La ville', from: 9, to: 16 }],
      pages: pages([
        { from: 1, to: 4, access: 'free', status: 'published', date: '2026-09-15T21:00' },
        { from: 5, to: 8, access: 'paid', status: 'published', date: '2026-10-01T21:00' },
        { from: 9, to: 14, access: 'paid', status: 'scheduled', date: '2026-11-01T21:00' },
        { from: 15, to: 15, access: 'paid', status: 'scheduled', date: '2026-11-15T21:00' },
        { from: 16, to: 16, access: 'paid', status: 'draft' }
      ])
    },
    {
      id: 'capuche', title: 'Sous la capuche', author: 'lina-petrova', cat: 'Manga', format: 'planche',
      cover: { img: 'couv-capuche', style: 'c' }, mode: 'progressive', access: 'mixed',
      desc: 'Mila ne retire jamais sa capuche. Le jour où le vent s’en charge, toute la ville la reconnaît.',
      price: { page: null, chapter: 0.49, all: 1.99 },
      chapters: [{ t: 'Chapitre 1', from: 1, to: 4 }, { t: 'Chapitre 2', from: 5, to: 8 }, { t: 'Chapitre 3', from: 9, to: 12 }, { t: 'Chapitre 4', from: 13, to: 16 }],
      pages: pages([
        { from: 1, to: 4, access: 'free', status: 'published', date: '2026-07-20T12:00' },
        { from: 5, to: 8, access: 'paid', status: 'published', date: '2026-08-20T12:00' },
        { from: 9, to: 12, access: 'paid', status: 'published', date: '2026-09-20T12:00' },
        { from: 13, to: 16, access: 'paid', status: 'scheduled', date: '2026-10-20T12:00' }
      ])
    },
    {
      id: 'marais', title: 'L’Enfant du marais', author: 'kofi-mensah', cat: 'Jeunesse',
      cover: { img: 'couv-marais', style: 'd' }, mode: 'integral', access: 'free',
      desc: 'Ato parle aux grenouilles. Un matin, elles lui répondent — et lui demandent de sauver le marais.',
      price: null,
      chapters: [{ t: 'Les grenouilles', from: 1, to: 9 }, { t: 'Le marais', from: 10, to: 18 }],
      pages: pages([{ from: 1, to: 18, access: 'free', status: 'published', date: '2026-06-01T10:00' }])
    },
    {
      id: 'cafe-nuit', title: 'Café de nuit', author: 'sofia-herrera', cat: 'Nouvelles',
      cover: { img: 'couv-cafe-nuit', style: 'b' }, mode: 'progressive', access: 'mixed',
      desc: 'Quinze nouvelles, un seul café, ouvert jusqu’à quatre heures. Chaque client y laisse une histoire en paiement.',
      price: { page: 0.10, chapter: 0.30, all: 0.99 },
      chapters: [{ t: 'Le comptoir', from: 1, to: 3 }, { t: 'La pluie', from: 4, to: 6 }, { t: 'Les habitués', from: 7, to: 8 }, { t: 'Quatre heures', from: 9, to: 15 }],
      pages: pages([
        { from: 1, to: 3, access: 'free', status: 'published', date: '2026-09-10T22:00' },
        { from: 4, to: 6, access: 'paid', status: 'published', date: '2026-09-24T22:00' },
        { from: 7, to: 8, access: 'free', status: 'published', date: '2026-10-08T22:00' },
        { from: 9, to: 9, access: 'paid', status: 'scheduled', date: '2026-10-15T20:00' },
        { from: 10, to: 15, access: 'paid', status: 'scheduled', date: '2026-12-01T20:00' }
      ])
    },
    {
      id: 'eventail', title: 'L’Éventail', author: 'jun-takeda', cat: 'Essai',
      cover: { img: 'couv-eventail', style: 'd' }, mode: 'integral', access: 'paid',
      desc: 'Neuf essais sur le geste de tourner une page, et sur tout ce qu’on décide pendant ce temps-là.',
      price: { page: null, chapter: null, all: 1.49 },
      chapters: [{ t: 'Essais', from: 1, to: 22 }],
      pages: pages([{ from: 1, to: 22, access: 'paid', status: 'published', date: '2026-09-28T08:00' }])
    },
    {
      id: 'silhouettes', title: 'Silhouettes au couchant', author: 'ines-kanza', cat: 'Poésie',
      cover: { img: 'couv-silhouette', style: 'b' }, mode: 'integral', access: 'mixed',
      desc: 'Vingt poèmes écrits face à l’ouest. Les cinq premiers sont offerts.',
      price: { page: 0.05, chapter: null, all: 0.79 },
      chapters: [{ t: 'Poèmes', from: 1, to: 20 }],
      pages: pages([{ from: 1, to: 5, access: 'free', status: 'published', date: '2026-07-14T19:00', source: 'editor' }, { from: 6, to: 20, access: 'paid', status: 'published', date: '2026-07-14T19:00', source: 'editor' }])
    },
    {
      id: 'plafond', title: 'Le Plafond des lecteurs', author: 'rafael-costa', cat: 'Histoire',
      cover: { img: 'couv-plafond', style: 'a' }, mode: 'progressive', access: 'paid',
      desc: 'Une histoire des grandes salles de lecture, racontée par ceux qui levaient les yeux.',
      price: { page: null, chapter: 0.60, all: 2.20 },
      chapters: [{ t: 'Les dômes', from: 1, to: 8 }, { t: 'Les lampes vertes', from: 9, to: 16 }, { t: 'Les catalogues', from: 17, to: 24 }],
      pages: pages([
        { from: 1, to: 8, access: 'paid', status: 'published', date: '2026-08-10T09:00' },
        { from: 9, to: 16, access: 'paid', status: 'published', date: '2026-09-10T09:00' },
        { from: 17, to: 24, access: 'paid', status: 'scheduled', date: '2026-11-10T09:00' }
      ])
    },
    {
      id: 'vitrine', title: 'La Vitrine', author: 'nadia-belkacem', cat: 'Roman',
      cover: { img: 'couv-vitrine', style: 'c' }, mode: 'integral', access: 'free',
      desc: 'Une libraire décide de ne plus rien vendre et de tout prêter. Le quartier ne s’en remet pas.',
      price: null,
      chapters: [{ t: 'Première partie', from: 1, to: 14 }, { t: 'Seconde partie', from: 15, to: 28 }],
      pages: pages([{ from: 1, to: 28, access: 'free', status: 'published', date: '2026-03-21T10:00' }])
    }
  ];

  /* Le lecteur de démonstration : ses achats sont FIXÉS ici. Cliquer
     « Acheter » dans la démo n'en ajoute aucun — le paiement n'est pas branché. */
  const reader = {
    name: 'Lecteur de démonstration',
    purchases: {
      'heures-salees': { pages: [6, 7, 8, 9], date: '2026-10-02' },
      'fenetre-rouge': { pages: [4, 5, 6, 7], date: '2026-10-04' },
      'jardin-nuit':   { pages: Array.from({ length: 30 }, (_, i) => i + 1), date: '2026-09-20' }
    },
    follows: ['croix-de-bois', 'heures-salees', 'fenetre-rouge', 'petites-lumieres', 'cafe-nuit', 'spirale'],
    progress: { 'croix-de-bois': 3, 'heures-salees': 9, 'fenetre-rouge': 7, 'petites-lumieres': 10, 'cafe-nuit': 3, 'spirale': 2, 'jardin-nuit': 12 }
  };

  /* Textes : quelques pages écrites pour la démo, puis une suite neutre. */
  const texts = {
    'croix-de-bois': [
      ['Il y a des chemins qui ne se voient pas,', 'mais qui nous trouvent quand même.', '', 'Confiez-vous en l’Éternel à perpétuité — Ésaïe 26:4.'],
      ['Tout a commencé par un silence. Un silence plus fort que toutes les voix que j’avais connues.', 'Un silence qui ne faisait pas peur, mais qui appelait.'],
      ['Entre la douleur et l’espérance, il n’y a parfois qu’une nuit.', '« Quand je marche dans la vallée de l’ombre de la mort, je ne crains aucun mal » — Psaume 23:4.', 'Cette page raconte cette nuit-là, et le matin qui l’a suivie (Lamentations 3:22-23).'],
      ['Il reste cette foi, même quand tout vacille. Il reste cette lumière, même dans les nuits les plus longues.', 'Il reste un nom, au-dessus de tous les noms.'],
      ['Chaque pas est un acte de foi.', 'Chaque page en est un aussi.']
    ],
    'heures-salees': [
      ["La mer montait toujours à l'heure où sa grand-mère fermait les volets. Ce soir-là, Nour resta dehors.", "Elle voulait voir ce que la marée emportait quand personne ne regardait : les seaux oubliés, les traces de pas, les promesses faites trop fort."],
      ["Sur le sable, il y avait des lettres. Pas des mots : des lettres seules, posées comme des coquillages — un A, un R, un M renversé.", "Quelqu'un écrivait avec la mer, et la mer ne savait pas encore lire."],
      ["Nour les compta deux fois. Onze. Elle les recopia dans le carnet bleu, celui des listes de courses, entre « pain » et « allumettes ».", "Quand elle releva la tête, la vague avait déjà avalé le premier A."],
      ["Le lendemain, les lettres avaient changé de place. Elles ne formaient plus une ligne mais un cercle, autour d'un seul galet noir.", "Sa grand-mère, sans quitter la fenêtre, dit seulement : « Ne réponds pas tout de suite. »"],
      ["Répondre à qui ? Il n'y avait personne sur la plage, à part le chien du pêcheur et le vent qui remettait ses cheveux devant ses yeux.", "Nour posa pourtant un caillou à côté du galet noir. Un seul. Juste pour voir."],
      ["Au matin, le caillou de Nour avait disparu. À sa place, deux lettres : un N et un O.", "Elle sentit son cœur cogner, comme quand on entend son prénom dans une foule et qu'on ne sait pas encore qui l'a dit."]
    ],
    'petites-lumieres': [["La lampe du frigo, à trois heures,", "éclaire un pot de confiture entamé", "et ma main qui hésite.", "", "Je referme doucement :", "il y a des lumières", "qu'on ne réveille pas."]],
    'fenetre-rouge': [["Rue Fiskar, tout le monde connaît la fenêtre du troisième. Elle s'allume en rouge vers minuit et ne s'éteint qu'au matin.", "Ce mardi-là, elle resta allumée jusqu'à midi. Et Mme Berg ne descendit pas chercher son pain."]],
    'cafe-nuit': [["Le café s'appelle Ouvert. C'est écrit sur la porte, en lettres collées une à une, et c'est vrai jusqu'à quatre heures.", "Pilar, derrière le comptoir, ne fait pas payer le café. Elle demande une histoire. Courte, si possible."]],
    'marais': [["Ato parlait aux grenouilles depuis qu'il savait parler. Les grenouilles, elles, ne répondaient jamais.", "Jusqu'à ce matin de pluie où la plus petite, toute verte et toute ronde, lui dit : « Enfin. On t'attendait. »"]],
    'vitrine': [["Le lundi, Mme Aït posa une pancarte dans la vitrine : « Plus rien à vendre. Tout à prêter. »", "Le mardi, il y avait la queue jusqu'au boulanger."]],
    'jardin-nuit': [["Le jardin du vieux Sandro n'avait pas de plan. Il avait des humeurs.", "Certaines nuits, l'allée des tilleuls menait au puits ; d'autres, elle ne menait qu'à elle-même, et l'on tournait en rond jusqu'au chant du coq."]],
    'eventail': [["Tourner une page prend moins d'une seconde. C'est pourtant le seul moment où le lecteur est tout à fait libre :", "il n'est plus dans la page d'avant, pas encore dans la suivante. Cet essai parle de cette seconde-là."]],
    'silhouettes': [["Face à l'ouest", "tout devient contour —", "le phare, la grue, ton épaule.", "", "On ne voit plus les couleurs,", "on voit enfin les formes."]],
    'plafond': [["Les premières grandes salles de lecture ont été pensées pour lever les yeux. Le plafond était le premier livre qu'on y lisait.", "Ce chapitre raconte les dômes, et ceux qui les ont regardés plus que leurs pages."]]
  };
  const filler = ["La suite de cette page existe dans le manuscrit de l'auteur.", "Ce brouillon de démonstration n'en montre que l'ouverture : le texte réel sera servi page par page par le serveur, jamais en fichier téléchargeable."];

  /* Planches (photo-roman) pour les livres au format « planche ». */
  const panels = ['couv-capuche', 'trail-fenetre', 'lecteur-penombre', 'couv-cafe-nuit', 'livres-fenetre', 'couv-fenetre', 'couv-spirale', 'lib-vieux-livres', 'couv-plafond'];
  const bubbles = ['— Tu l’as vue ?', '— Personne ne la reconnaît.', 'Le vent se lève.', '— Ne te retourne pas.', 'Trois étages plus bas…', '— C’est elle.', 'La nuit recopie la ville.', '— Encore une fiche.', 'Silence.'];

  return { authors, books, reader, texts, filler, panels, bubbles };
})();
