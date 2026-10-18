"""Écrit `demo.json` : le catalogue d'EXEMPLE de Sōzō (12 auteurs, 14 livres).

    python3 backend/tools/demo_catalogue.py

Demande du propriétaire (18/10/2026) : des livres de foi chrétienne —
religion, inspiration, Dieu, la foi. Auteurs, livres et textes sont INVENTÉS ;
aucun ne représente une personne réelle (Nawezi N., auteur réel, n'y figure
plus : il publie ses vrais livres lui-même). Chaque livre porte l'étiquette
« Exemple » dans l'application (books.demo = 1).

Les versets ne sont JAMAIS recopiés à la main : `V()` les lit dans la Bible
Louis Segond 1910 intégrée (app/bible/NN.json), pour qu'une citation fausse
ne puisse pas entrer dans le catalogue.
"""
import json
import os
from datetime import datetime, timedelta

ICI = os.path.dirname(os.path.abspath(__file__))
BIBLE = os.path.join(ICI, "..", "..", "app", "bible")
AUJOURDHUI = datetime(2026, 10, 18, 12, 0)   # ce qui est après est « à venir »


def V(livre, chap, de, a=None, ref=None):
    with open(os.path.join(BIBLE, f"{livre:02d}.json"), encoding="utf-8") as f:
        ch = json.load(f)[chap - 1]
    texte = " ".join(ch[de - 1:(a or de)]).strip()
    return f"« {texte} » — {ref}"


def pages(total, debut, gratuites=None, pas=0, par=1, source="pdf"):
    """gratuites : None = tout gratuit, 0 = tout payant, n = les n premières."""
    t0 = datetime.fromisoformat(debut)
    res = []
    for n in range(1, total + 1):
        d = t0 + timedelta(days=((n - 1) // par) * pas)
        libre = gratuites is None or n <= gratuites
        res.append({"n": n, "access": "free" if libre else "paid",
                    "status": "scheduled" if d > AUJOURDHUI else "published",
                    "date": d.strftime("%Y-%m-%dT%H:%M"), "source": source})
    return res


def ch(*spec):
    return [{"t": t, "from": a, "to": b} for t, a, b in spec]


AUTEURS = {
    "elie-mbuyi": {"name": "Élie Mbuyi", "photo": "portrait-bureau", "city": "Kinshasa", "since": "2024",
                   "bio": "Pasteur de quartier. Écrit avant l'aube une méditation courte, pour ceux qui partent tôt."},
    "ruth-kabasele": {"name": "Ruth Kabasele", "photo": "portrait-boucles", "city": "Lubumbashi", "since": "2025",
                      "bio": "Poèmes de louange, un chaque jeudi à 20 h. La terre rouge, la pluie, et Celui qui les fait."},
    "samuel-ndombe": {"name": "Samuel Ndombe", "photo": "portrait-jeune-homme", "city": "Kisangani", "since": "2026",
                      "bio": "Romancier. Raconte des retours : vers une maison, vers une ville, vers Dieu."},
    "esther-mukendi": {"name": "Esther Mukendi", "photo": "autrice-ordinateur", "city": "Bruxelles", "since": "2025",
                       "bio": "Lit les femmes de la Bible avec les yeux des femmes d'aujourd'hui."},
    "josue-kalala": {"name": "Josué Kalala", "photo": "portrait-couloir", "city": "Goma", "since": "2025",
                     "bio": "Accompagne des jeunes dans les épreuves. Écrit pour ceux qui tiennent debout à peine."},
    "grace-nzuzi": {"name": "Grâce Nzuzi", "photo": "portrait-sourire", "city": "Kinshasa", "since": "2026",
                    "bio": "Monitrice d'école du dimanche. Des prières à lire à voix haute, avec les enfants."},
    "daniel-obi": {"name": "Daniel Obi", "photo": "portrait-ville", "city": "Lagos", "since": "2024",
                   "bio": "Lit les épîtres lentement, verset par verset, et note ce qui reste."},
    "marthe-lukusa": {"name": "Marthe Lukusa", "photo": "lectrice-echarpe", "city": "Lyon", "since": "2025",
                      "bio": "Nouvelles d'une nuit de prière. Une page offerte, puis on veille ensemble."},
    "pierre-andre-lemaire": {"name": "Pierre-André Lemaire", "photo": "lecteur-livre-rouge", "city": "Genève", "since": "2023",
                             "bio": "Raconte les apôtres à partir des Actes et des lettres, sans rien inventer de plus."},
    "naomi-tshala": {"name": "Naomi Tshala", "photo": "lectrice-canape", "city": "Kananga", "since": "2026",
                     "bio": "Premier roman, offert en entier. Une fille qui part, un père qui attend."},
    "jean-baptiste-ilunga": {"name": "Jean-Baptiste Ilunga", "photo": "lecteur-banc", "city": "Mbuji-Mayi", "since": "2024",
                             "bio": "Méditations pour la Semaine sainte. Sept paroles, sept soirs."},
    "lea-bisimwa": {"name": "Léa Bisimwa", "photo": "lectrice-bibliotheque", "city": "Bukavu", "since": "2026",
                    "bio": "Quarante jours pour apprendre à dire merci, même les jours sans."},
}

LIVRES = [
    {"id": "pain-du-matin", "title": "Le Pain du matin", "author": "elie-mbuyi", "cat": "Spiritualité",
     "cover": {"img": "foi-soleil-mer", "style": "a"}, "mode": "progressive", "access": "free",
     "desc": "Une méditation courte tous les deux jours, à lire avant de sortir. Un verset, une pensée, une prière.",
     "price": None, "pages": pages(30, "2026-09-20T06:00", None, pas=2),
     "chapters": ch(("Se lever", 1, 10), ("Marcher", 11, 20), ("Se reposer", 21, 30))},
    {"id": "prier-sans-mots", "title": "Prier quand les mots manquent", "author": "elie-mbuyi", "cat": "Foi",
     "cover": {"img": "foi-priere-lumiere", "style": "c"}, "mode": "integral", "access": "mixed",
     "desc": "Pour les jours où l'on ouvre la bouche et où rien ne vient. Ce que l'Écriture dit des soupirs, du silence et de la confiance.",
     "price": {"page": 0.10, "chapter": 0.40, "all": 1.99}, "pages": pages(18, "2026-08-15T09:00", 3),
     "chapters": ch(("Le silence", 1, 6), ("Les soupirs", 7, 12), ("La confiance", 13, 18))},
    {"id": "psaumes-terre-rouge", "title": "Psaumes de la terre rouge", "author": "ruth-kabasele", "cat": "Poésie",
     "cover": {"img": "foi-champ-dore", "style": "d"}, "mode": "progressive", "access": "free",
     "desc": "Un poème de louange chaque jeudi à 20 h. La latérite, les pluies de novembre, et Celui qui fait lever le grain.",
     "price": None, "pages": pages(16, "2026-08-27T20:00", None, pas=7, source="editor"),
     "chapters": ch(("Les champs", 1, 8), ("Les pluies", 9, 16))},
    {"id": "cantique-ville", "title": "Cantique pour une ville qui dort", "author": "ruth-kabasele", "cat": "Poésie",
     "cover": {"img": "foi-bougie-nuit", "style": "b"}, "mode": "integral", "access": "mixed",
     "desc": "Vingt prières en vers pour une ville la nuit : les gardiens, les malades, les mères qui veillent. Les cinq premières sont offertes.",
     "price": {"page": 0.05, "chapter": None, "all": 0.79}, "pages": pages(20, "2026-07-14T21:00", 5, source="editor"),
     "chapters": ch(("Cantiques", 1, 20))},
    {"id": "fleuve-prie", "title": "Quand le fleuve prie", "author": "samuel-ndombe", "cat": "Roman",
     "cover": {"img": "foi-croix-lac", "style": "a"}, "mode": "progressive", "access": "mixed",
     "desc": "Jonas Bokele descend le fleuve pour enterrer sa mère, qu'il n'a pas revue depuis dix ans. Sur le bateau, une vieille femme chante les cantiques qu'elle lui chantait.",
     "price": {"page": 0.10, "chapter": 0.35, "all": 1.49}, "pages": pages(24, "2026-08-29T18:00", 5, pas=7, par=2),
     "chapters": ch(("Le départ", 1, 6), ("Le bateau", 7, 12), ("Les rives", 13, 18), ("Le retour", 19, 24))},
    {"id": "femmes-bible", "title": "Femmes de la Bible, femmes d'aujourd'hui", "author": "esther-mukendi", "cat": "Essai",
     "cover": {"img": "foi-fleurs-claires", "style": "d"}, "mode": "integral", "access": "mixed",
     "desc": "Ruth, Anne, Marthe, Marie, Lydie : quatre portraits lus de près, et ce qu'ils disent aux femmes qui travaillent, prient et attendent aujourd'hui.",
     "price": {"page": None, "chapter": 0.50, "all": 2.49}, "pages": pages(24, "2026-09-28T08:00", 2),
     "chapters": ch(("Ruth, la fidèle", 1, 6), ("Anne, la femme qui priait", 7, 12), ("Marthe et Marie", 13, 18), ("Lydie, la marchande", 19, 24))},
    {"id": "debout-tempete", "title": "Debout dans la tempête", "author": "josue-kalala", "cat": "Développement personnel",
     "cover": {"img": "foi-aube-bras", "style": "c"}, "mode": "progressive", "access": "mixed",
     "desc": "Perdre un emploi, un proche, une certitude. Un chemin en vingt étapes, de la barque qui prend l'eau au grand calme.",
     "price": {"page": 0.10, "chapter": 0.40, "all": 1.79}, "pages": pages(20, "2026-09-05T19:00", 4, pas=7, par=2),
     "chapters": ch(("Le vent se lève", 1, 5), ("La barque", 6, 10), ("Silence, tais-toi", 11, 15), ("Le grand calme", 16, 20))},
    {"id": "petites-prieres", "title": "Petites prières pour grands enfants", "author": "grace-nzuzi", "cat": "Jeunesse",
     "cover": {"img": "foi-bougies", "style": "d"}, "mode": "integral", "access": "free",
     "desc": "Seize prières courtes à lire avec un enfant : pour le matin, pour l'école, pour les jours de peur, pour le soir.",
     "price": None, "pages": pages(16, "2026-06-01T10:00", None, source="editor"),
     "chapters": ch(("Le matin", 1, 8), ("Le soir", 9, 16))},
    {"id": "lettres-timothee", "title": "Lettres à Timothée, lues lentement", "author": "daniel-obi", "cat": "Spiritualité",
     "cover": {"img": "foi-bible-mains", "style": "b"}, "mode": "progressive", "access": "paid",
     "desc": "Les deux lettres de Paul à son jeune disciple, lues un passage à la fois. Un chapitre par mois, vendu au chapitre.",
     "price": {"page": None, "chapter": 0.60, "all": 1.50}, "pages": pages(18, "2026-09-01T08:00", 0, pas=30, par=6),
     "chapters": ch(("Première lettre, chapitres 1 à 3", 1, 6), ("Première lettre, chapitres 4 à 6", 7, 12), ("Seconde lettre", 13, 18))},
    {"id": "veillee", "title": "La Veillée", "author": "marthe-lukusa", "cat": "Nouvelles",
     "cover": {"img": "foi-bougies-rang", "style": "a"}, "mode": "progressive", "access": "mixed",
     "desc": "Une nuit de prière dans une paroisse de quartier, de 22 h à l'aube. Quinze nouvelles, quinze personnes venues avec ce qu'elles portent.",
     "price": {"page": 0.10, "chapter": 0.30, "all": 0.99}, "pages": pages(15, "2026-09-10T22:00", 3, pas=7, par=2),
     "chapters": ch(("Vingt-deux heures", 1, 3), ("Minuit", 4, 8), ("Trois heures", 9, 12), ("L'aube", 13, 15))},
    {"id": "paul-en-chemin", "title": "Paul, l'apôtre en chemin", "author": "pierre-andre-lemaire", "cat": "Biographie",
     "cover": {"img": "foi-chapelle", "style": "c"}, "mode": "integral", "access": "paid",
     "desc": "De Tarse à Rome : la vie de l'apôtre Paul racontée à partir des Actes et de ses lettres, avec chaque référence à portée de main.",
     "price": {"page": None, "chapter": 0.60, "all": 2.20}, "pages": pages(24, "2026-08-10T09:00", 0),
     "chapters": ch(("Saul de Tarse", 1, 6), ("Le chemin de Damas", 7, 12), ("Les voyages", 13, 18), ("Les lettres", 19, 24))},
    {"id": "fille-prodigue", "title": "La Fille prodigue", "author": "naomi-tshala", "cat": "Roman",
     "cover": {"img": "foi-porte-eglise", "style": "b"}, "mode": "integral", "access": "free",
     "desc": "Bijou quitte Kananga avec l'argent de son père et la certitude d'avoir raison. Quatre ans plus tard, elle reprend la route du retour. Roman offert en entier.",
     "price": None, "pages": pages(28, "2026-03-21T10:00", None),
     "chapters": ch(("Partir", 1, 14), ("Revenir", 15, 28))},
    {"id": "sept-paroles", "title": "Sept paroles sur la croix", "author": "jean-baptiste-ilunga", "cat": "Foi",
     "cover": {"img": "foi-croix-ciel", "style": "a"}, "mode": "integral", "access": "mixed",
     "desc": "Les sept paroles de Jésus sur la croix, méditées une par soir. L'ouverture est offerte.",
     "price": {"page": 0.20, "chapter": None, "all": 0.99}, "pages": pages(8, "2026-04-01T19:00", 1),
     "chapters": ch(("Ouverture", 1, 1), ("Les sept paroles", 2, 8))},
    {"id": "quarante-jours", "title": "Quarante jours de gratitude", "author": "lea-bisimwa", "cat": "Développement personnel",
     "cover": {"img": "foi-fleurs-sechees", "style": "d"}, "mode": "progressive", "access": "free",
     "desc": "Une page par jour pendant quarante jours : un merci à écrire, un verset à garder, une personne à qui le dire.",
     "price": None, "pages": pages(40, "2026-09-20T07:00", None, pas=1, source="editor"),
     "chapters": ch(("Pour le pain", 1, 10), ("Pour les visages", 11, 20), ("Pour les épreuves", 21, 30), ("Pour demain", 31, 40))},
]

# Textes : une liste de paragraphes (ou de vers) par page, à partir de la page 1.
# Les pages sans texte reçoivent la présentation du livre et une mention honnête.
TEXTES = {
    "pain-du-matin": [
        ["Premier matin.",
         V(25, 3, 22, 23, "Lamentations 3:22-23"),
         "Il y a des matins où l'on se lève avec la fatigue d'hier encore sur les épaules. On n'a pas fini la nuit, et déjà le jour réclame.",
         "Ce verset a été écrit au milieu des ruines. Jérusalem était tombée. L'homme qui écrit n'a rien de neuf à raconter, sauf ceci : chaque matin, la bonté de Dieu recommence.",
         "Avant de sortir aujourd'hui, ne demandez pas encore de force pour toute la semaine. Demandez celle de ce matin. Elle suffira.",
         "Prière : Seigneur, je ne te demande pas demain. Donne-moi ce matin, et ta fidélité dedans. Amen."],
        ["Deuxième matin.",
         V(19, 23, 1, ref="Psaume 23:1"),
         "Un berger ne promet pas qu'il n'y aura pas de chemin difficile. Il promet d'y être.",
         "« Je ne manquerai de rien » ne veut pas dire : j'aurai tout ce que je veux. Cela veut dire : ce dont j'ai besoin pour la route me sera donné sur la route.",
         "Regardez aujourd'hui ce qui ne vous a pas manqué hier. Le compte est souvent plus long qu'on ne le croit.",
         "Prière : Berger, marche devant moi aujourd'hui. Là où je ne vois pas, fais-moi entendre ta voix."],
        ["Troisième matin.",
         V(19, 119, 105, ref="Psaume 119:105"),
         "Une lampe à mes pieds, pas un projecteur sur tout le chemin. Elle éclaire le pas suivant, rarement le suivant d'après.",
         "Nous voudrions voir la fin avant de commencer. Dieu nous donne souvent juste assez de lumière pour un pas.",
         "Quel est le pas d'aujourd'hui ? Un appel à passer, une excuse à présenter, une porte à ouvrir. Faites celui-là.",
         "Prière : Que ta parole éclaire mes pieds aujourd'hui, et que je m'en contente."],
    ],
    "prier-sans-mots": [
        ["Avant-propos",
         "Ce livre est né d'une question qu'on m'a posée à la sortie d'un culte : « Pasteur, comment on prie quand on n'a plus rien à dire ? »",
         "La femme qui me la posait venait de perdre son mari. Elle avait prié des mois pour sa guérison. Maintenant, elle ne savait plus quoi demander.",
         "Je n'avais pas de réponse ce jour-là. J'en ai une un peu meilleure aujourd'hui, et elle ne vient pas de moi :",
         V(45, 8, 26, ref="Romains 8:26"),
         "Ce livre parle de ces soupirs-là."],
        ["Le silence n'est pas l'absence",
         "Nous avons appris que prier, c'est parler. On ferme les yeux, on joint les mains, et les phrases viennent.",
         "Mais il y a des saisons où les phrases ne viennent pas. Où l'on s'assied au bord du lit et où l'on reste là.",
         "Ce silence-là n'est pas un échec. Élie, sur la montagne, n'a pas trouvé Dieu dans le vent fort, ni dans le tremblement de terre, ni dans le feu. Il l'a trouvé dans « un murmure doux et léger » (1 Rois 19:12).",
         "Asseyez-vous. Ne dites rien. Restez. C'est déjà une prière."],
        ["Un seul mot suffit",
         "Le publicain de la parabole ne fait pas un long discours. Il se tient à distance, il n'ose pas lever les yeux, et il dit une phrase : « Ô Dieu, sois apaisé envers moi, qui suis un pécheur. » (Luc 18:13)",
         "Jésus dit qu'il rentra chez lui justifié.",
         "Si aujourd'hui vous n'avez qu'un mot, dites-le : « Aide. » « Merci. » « Pardon. » « Reste. »",
         "Dieu n'a jamais compté les mots."],
    ],
    "psaumes-terre-rouge": [
        ["I. Louange du premier jour",
         "", "Toi qui fais lever la terre rouge", "comme une pâte sous la main,", "toi qui mets la pluie dans les nuages",
         "et le grain dans le creux du matin,", "", "je te loue pour la poussière", "qui colle encore à mes pieds :",
         "c'est la preuve que j'ai marché", "et que tu ne m'as pas laissée.", "",
         V(19, 24, 1, ref="Psaume 24:1")],
        ["II. Psaume du marché",
         "", "Au marché de la Kenya, à sept heures,", "les mamans déplient les pagnes,", "comptent les tomates par trois,",
         "et chantent sans y penser.", "", "Seigneur, entends-tu leurs cantiques", "entre deux prix et deux rires ?",
         "Ce sont des psaumes sans livre,", "des louanges qui ont les mains sales.", "", "Reçois-les comme l'encens."],
        ["III. Pour la pluie de novembre",
         "", "Elle arrive d'un coup, la pluie,", "elle ne frappe pas avant d'entrer.", "Les enfants courent sous les tôles,",
         "les chèvres se serrent au mur.", "", "Toi aussi tu viens d'un coup", "dans les vies qui ne t'attendaient plus,",
         "et l'on ne sait plus si l'on pleure", "ou si c'est le ciel sur nos joues.", "",
         V(23, 55, 10, ref="Ésaïe 55:10")],
        ["IV. Psaume pour celle qui n'a pas dormi",
         "", "Elle a veillé l'enfant fiévreux", "jusqu'à l'heure où chante le coq.", "Elle n'a pas prié avec des mots,",
         "elle a prié avec un linge mouillé.", "", "Seigneur, compte cela comme prière.", "Compte la nuit, compte le linge,",
         "compte les mains qui tremblent.", "Tu l'as dit : tu ne dors pas.", "",
         V(19, 121, 4, ref="Psaume 121:4")],
    ],
    "cantique-ville": [
        ["Cantique du gardien",
         "", "Il est assis devant la grille", "avec sa lampe et son sifflet.", "Toute la rue dort sur son dos,",
         "et lui, il ne dort jamais.", "", "Garde le gardien, Seigneur,", "toi qui gardes Israël.",
         "Que sa lampe tienne jusqu'au jour", "et que son cœur ne soit pas seul."],
        ["Cantique de l'hôpital",
         "", "Dans la salle commune, au deuxième,", "une mère dort sur une chaise.", "Son fils respire mal, mais il respire.",
         "C'est déjà ça. C'est déjà toi.", "", "Passe dans le couloir, Seigneur,", "comme tu passais à Capernaüm.",
         "Touche celui que tu veux toucher,", "et pour les autres, reste un peu."],
        ["Cantique du dernier bus",
         "", "Le dernier bus est plein de gens", "qui rentrent trop tard pour souper.", "Ils ont vendu, porté, nettoyé,",
         "ils ont les yeux qui se ferment.", "", "Toi qui as dit : venez à moi,", "toi qui connais le poids des jours,",
         "", V(40, 11, 28, ref="Matthieu 11:28")],
        ["Cantique de la mère qui attend",
         "", "Elle laisse la porte entrouverte.", "Son fils n'est pas rentré ce soir.", "Elle a mis l'assiette sous un linge,",
         "elle a mis son cœur sous la lampe.", "", "Seigneur, toi qui attendais aussi", "au bout du chemin, le fils parti,",
         "assieds-toi près d'elle un moment.", "Vous attendrez mieux à deux."],
        ["Cantique avant l'aube",
         "", "Quatre heures. Le muezzin du quartier,", "le coq de la voisine, la première moto.", "La ville se retourne dans son lit.",
         "", "Toi qui étais là avant la ville,", "toi qui seras là après,", "bénis ce jour qui ne sait pas encore",
         "ce qu'il va porter.", "", V(19, 118, 24, ref="Psaume 118:24")],
    ],
    "fleuve-prie": [
        ["Chapitre premier",
         "Le message était arrivé un mardi, à six heures du soir, entre deux réunions : « Maman est partie ce matin. Viens. »",
         "Jonas Bokele avait relu la phrase plusieurs fois sur l'écran de son téléphone. Il n'avait pas remis les pieds à Bumba depuis dix ans. Il n'avait pas appelé non plus. Il envoyait de l'argent, au début de chaque mois, et il croyait que cela suffisait.",
         "Il n'y avait pas d'avion pour Bumba avant deux semaines. Il restait le bateau.",
         "Le jeudi, à l'aube, il était sur le port de Kinshasa, avec un sac trop petit et une valise trop neuve, au milieu des sacs de manioc et des cages de poules, à regarder la baleinière qu'on chargeait comme si elle ne devait jamais partir."],
        ["Chapitre premier (suite)",
         "Une vieille femme s'assit à côté de lui sur un bidon retourné. Elle portait un foulard bleu et une Bible enveloppée dans un sachet plastique.",
         "« Tu vas loin, mon fils ?",
         "— À Bumba.",
         "— Alors nous allons passer du temps ensemble. »",
         "Elle sourit, sortit un éventail de raphia, et se mit à fredonner. Jonas reconnut l'air au bout de trois notes. Sa mère le chantait en pilant le foufou : « Quel ami fidèle et tendre nous avons en Jésus-Christ… »",
         "Il se leva brusquement et alla s'accouder au bastingage. Le fleuve était large comme une mer, brun et lent. Il ne voulait pas que la vieille femme le voie pleurer."],
        ["Chapitre premier (fin)",
         "Le bateau partit à midi, avec six heures de retard. Personne ne s'en étonna.",
         "Le soir, quand le soleil tomba derrière la forêt, les passagers sortirent des lampes, des marmites, des radios. Sur le pont arrière, quelqu'un entonna un cantique, puis un autre. La vieille femme au foulard bleu chantait plus fort que tout le monde.",
         "Jonas resta assis sur son sac. Il ne chantait pas. Il n'avait plus chanté depuis le jour où il avait quitté Bumba en se jurant de ne plus jamais remettre les pieds dans une église.",
         "Mais il écoutait. Et pour la première fois depuis dix ans, il eut l'impression que quelqu'un, quelque part, l'écoutait aussi."],
        ["Chapitre 2",
         "Elle s'appelait Mama Bolumbu. Elle allait à Lisala, chez sa fille, qui venait d'accoucher de son septième enfant.",
         "« Sept, dit-elle en levant les doigts. Comme les jours de la création. Dieu a travaillé six jours, ma fille aussi. Maintenant, elle va se reposer, et c'est moi qui vais travailler. »",
         "Elle riait de ses propres plaisanteries avant de les avoir finies. Jonas se surprit à rire avec elle.",
         "Le troisième jour, elle lui demanda pourquoi il allait à Bumba. Il le lui dit. Elle ne dit rien pendant un long moment. Puis elle posa sa main sèche sur la sienne.",
         V(19, 34, 19, ref="Psaume 34:19")],
        ["Chapitre 2 (suite)",
         "« Tu lui en veux encore ? » demanda Mama Bolumbu.",
         "Jonas fit semblant de ne pas comprendre. Puis il haussa les épaules.",
         "« Elle priait pour moi tous les soirs. À voix haute. Devant tout le monde. Elle disait : Seigneur, ramène Jonas. Je n'étais même pas parti. J'étais dans la pièce à côté. »",
         "La vieille femme hocha la tête.",
         "« Elle voyait que tu étais déjà parti, dit-elle. Les mères voient ça avant les fils. »",
         "Le fleuve faisait un grand coude. Sur la rive, un village entier était descendu au bord de l'eau pour vendre du poisson fumé au bateau qui passait."],
    ],
    "femmes-bible": [
        ["Avant-propos",
         "Pendant longtemps, j'ai lu les femmes de la Bible comme on regarde des vitraux : de loin, avec respect, sans penser qu'elles avaient eu faim, sommeil ou peur.",
         "Puis j'ai relu le livre de Ruth un soir de décembre, dans un train entre Bruxelles et Liège, après une journée où j'avais été la seule femme noire de toutes les réunions. Et j'ai vu une étrangère qui glanait dans le champ d'un autre, en espérant qu'on la laisse faire.",
         "Ce livre est né ce soir-là. Il ne prétend pas tout dire de ces femmes. Il les regarde de près, avec les questions d'aujourd'hui : le travail, l'exil, la stérilité, la fatigue, l'argent, la prière.",
         "Chaque chapitre part du texte biblique, que vous pourrez ouvrir d'un geste. Puis il s'approche."],
        ["Ruth, la fidèle — I",
         "Le livre de Ruth commence par trois enterrements. Élimélec meurt en terre de Moab, puis ses deux fils. Il reste trois veuves, sans terre, sans fils, sans avenir.",
         "Naomi, la belle-mère, décide de rentrer à Bethléhem. Elle dit à ses deux belles-filles de retourner chez leur mère. Orpa l'embrasse et s'en va. Personne ne le lui reproche, et le texte non plus.",
         "Ruth reste. Et elle prononce l'une des phrases les plus fortes de toute l'Écriture :",
         V(8, 1, 16, ref="Ruth 1:16"),
         "Ce n'est pas une déclaration d'amour romantique. C'est une femme qui choisit une autre femme, plus âgée, plus pauvre, plus amère qu'elle — et qui choisit son Dieu avec elle."],
    ],
    "debout-tempete": [
        ["Étape 1 — Nommer le vent",
         "Le jour où j'ai perdu mon travail, j'ai dit à tout le monde que ça allait. À ma femme, à mes amis, au pasteur. Je l'ai dit si souvent que j'ai fini par m'étonner de ne pas y croire.",
         "La première étape pour traverser une tempête, c'est d'admettre qu'il y en a une.",
         "Les disciples, dans la barque, n'ont pas fait semblant. Ils ont réveillé Jésus en criant : « Maître, ne t'inquiètes-tu pas de ce que nous périssons ? » (Marc 4:38)",
         "Ce n'est pas une prière très polie. Mais elle est vraie. Et Jésus y a répondu.",
         "Exercice : écrivez en une phrase ce qui vous arrive. Sans l'arranger. « J'ai peur de ne pas retrouver de travail. » « Je n'arrive pas à pardonner. » « Je suis fatigué de croire. »"],
        ["Étape 2 — Ne pas rester seul dans la barque",
         "Remarquez une chose : dans l'histoire de la tempête, les disciples ne sont pas seuls. Ils sont plusieurs, et Jésus est avec eux.",
         "La tempête nous isole. On se retire, on répond moins, on ne va plus aux réunions. On croit protéger les autres de notre poids. En réalité, on se prive de ceux qui pourraient ramer avec nous.",
         V(21, 4, 9, 10, "Ecclésiaste 4:9-10"),
         "Exercice : nommez une personne à qui vous direz cette semaine la phrase écrite à l'étape 1."],
        ["Étape 3 — Il dort, mais il est là",
         "Ce qui a le plus effrayé les disciples, je crois, ce n'est pas le vent. C'est que Jésus dormait.",
         "Il y a des saisons où Dieu semble dormir. On prie, et le ciel ne répond pas. On lit, et les mots restent sur la page.",
         "Mais il dormait dans la barque. Pas sur le rivage. Pas dans une autre ville. Dans la même barque, sous la même pluie.",
         V(19, 46, 2, ref="Psaume 46:2"),
         "Exercice : écrivez une chose qui, hier, vous a montré que vous n'étiez pas seul. Même petite."],
        ["Étape 4 — Ce que la tempête ne prend pas",
         "Faites la liste. Pas de ce que vous avez perdu — vous la connaissez par cœur. La liste de ce qui reste.",
         "Quand Job a tout perdu, il lui restait une chose qu'on oublie : sa capacité à parler à Dieu, même pour se plaindre. Il ne l'a jamais perdue.",
         V(45, 8, 38, 39, "Romains 8:38-39"),
         "Exercice : trois choses que la tempête ne vous a pas prises."],
    ],
    "petites-prieres": [
        ["Prière pour se réveiller",
         "", "Bonjour, Seigneur !", "J'ouvre les yeux, tu étais déjà là.", "Tu as gardé la maison toute la nuit,",
         "et maman, et papa, et le petit chat.", "", "Aujourd'hui, aide-moi à être gentil,", "même avec celui qui me pousse dans la cour.",
         "", "Merci pour le pain, merci pour le jour.", "Amen !"],
        ["Prière pour aller à l'école",
         "", "Seigneur, je mets mon sac sur le dos.", "Dedans il y a mes cahiers,", "et peut-être un peu de peur.",
         "", "Viens avec moi sur le chemin.", "Assieds-toi à côté de moi en classe.", "Quand je ne comprends pas,",
         "aide-moi à lever la main.", "", "Et si je me trompe, rappelle-moi", "que tu m'aimes quand même.", "Amen !"],
        ["Prière pour un jour de peur",
         "", "Seigneur, aujourd'hui j'ai peur.", "Je ne sais pas toujours de quoi.", "Mon ventre est serré comme un poing.",
         "", "Tu as dit : n'aie pas peur.", "Tu l'as dit à beaucoup de gens dans la Bible,", "alors je crois que tu le dis à moi aussi.",
         "", V(23, 41, 10, ref="Ésaïe 41:10"), "", "Prends ma main. Amen."],
        ["Prière pour les copains",
         "", "Seigneur, je te présente mes amis :", "Benjamin qui court plus vite que moi,", "Divine qui partage son goûter,",
         "et le nouveau qui ne parle à personne.", "", "Bénis-les tous les trois,", "et aide-moi à parler au nouveau demain.",
         "", V(40, 19, 14, ref="Matthieu 19:14"), "Amen !"],
    ],
    "lettres-timothee": [
        ["Première lettre, 1:1-2 — Un père et un fils",
         "La lettre s'ouvre comme toutes les lettres de l'Antiquité : celui qui écrit, celui qui reçoit, une salutation.",
         "Mais regardez comment Paul désigne Timothée : « mon enfant légitime en la foi ». Timothée n'est pas son fils. Son père était grec, sa mère juive, sa grand-mère s'appelait Loïs. Paul l'a rencontré à Lystre, jeune homme.",
         "Il y a dans l'Église des pères et des mères que l'on n'a pas choisis par le sang. Qui sont les vôtres ? À qui êtes-vous, sans l'avoir décidé, un père ou une mère dans la foi ?"],
    ],
    "veillee": [
        ["Vingt-deux heures — Mama Kapinga",
         "Elle arrive toujours la première. Elle a la clé de la petite porte, celle qui donne sur la cour, parce qu'elle balaie l'église depuis vingt-trois ans et que personne n'a jamais pensé à la lui reprendre.",
         "Ce vendredi, elle balaie comme les autres vendredis. Elle range les chaises en plastique en rangées de huit, elle allume les deux ampoules du fond, elle pose une Bible sur le pupitre.",
         "Puis elle s'assied au premier rang et elle attend. Elle ne prie pas encore. Elle écoute la rue : les motos, le générateur du voisin, un enfant qui pleure deux parcelles plus loin.",
         "« Tu entends tout ça, toi aussi », dit-elle à voix basse. Ce n'est pas une question."],
        ["Vingt-deux heures — Mama Kapinga (suite)",
         "Les premiers arrivent vers vingt-deux heures trente. Le diacre Mutombo et sa femme, avec un thermos de thé. Trois jeunes de la chorale, qui rient trop fort dans la cour et se taisent en entrant. Une femme que Mama Kapinga ne connaît pas, avec un bébé endormi dans le dos.",
         "La femme au bébé s'assied tout au fond, près de la porte, comme quelqu'un qui veut pouvoir partir vite.",
         "Mama Kapinga la regarde un moment. Puis elle se lève, prend le thermos du diacre sans lui demander, verse une tasse et va la porter au fond.",
         "« Tu es venue pour quelque chose de lourd, dit-elle. Alors bois d'abord. On a toute la nuit. »"],
        ["Vingt-deux heures — Le diacre Mutombo",
         "Le diacre Mutombo ouvre la veillée comme il l'ouvre depuis douze ans : par le Psaume 134.",
         V(19, 134, 1, 2, "Psaume 134:1-2"),
         "Il le lit d'une voix qui tremble un peu, et personne ne sait que c'est la dernière fois. Le lundi suivant, il partira pour Lubumbashi rejoindre son fils. Il ne l'a dit qu'à sa femme.",
         "Il lève les mains, comme le psaume le demande. Derrière lui, les chaises grincent : tout le monde se lève."],
    ],
    "fille-prodigue": [
        ["Partir — 1",
         "Bijou avait dix-neuf ans le jour où elle demanda sa part.",
         "Son père vendait des pièces de vélo sur l'avenue Lumumba, à Kananga. Il avait un petit dépôt, deux apprentis, un compte à la coopérative, et la réputation d'un homme qui ne mentait jamais sur le prix d'une chaîne.",
         "« Ta part de quoi ? » demanda-t-il sans lever les yeux de son cahier.",
         "« De ce que tu me donneras quand tu seras mort. Je la veux maintenant. »",
         "Il leva les yeux, alors. Il la regarda longtemps. Elle soutint son regard. Elle avait préparé cette phrase pendant des semaines, elle n'allait pas baisser les yeux maintenant."],
        ["Partir — 2",
         "Il ne cria pas. C'est ce qui la troubla le plus, plus tard, quand elle repensait à cette soirée.",
         "Il ferma son cahier, se leva, alla dans la chambre. Elle l'entendit ouvrir la vieille valise sous le lit, celle où il gardait les papiers de la parcelle et l'argent qu'il ne mettait pas à la coopérative.",
         "Il revint avec une enveloppe. Il la posa sur la table entre eux.",
         "« Ta mère aurait su quoi te dire, dit-il. Moi, je ne sais pas. Alors je fais ce que tu demandes. »",
         "Bijou prit l'enveloppe. Elle était plus épaisse qu'elle ne l'aurait cru."],
        ["Partir — 3",
         "Elle partit le jeudi, par le bus de Kinshasa. Elle n'avait dit au revoir qu'à sa petite sœur, Grâce, qui pleurait sur le pas de la porte en tenant un ballon dégonflé.",
         "Son père n'était pas là. Il était au dépôt, comme tous les jeudis. Elle s'en était voulu de penser qu'il aurait pu, au moins ce jour-là, fermer la boutique.",
         "Elle ne sut que quatre ans plus tard qu'il avait fermé la boutique ce jour-là. Qu'il avait regardé le bus partir depuis le carrefour, caché derrière le kiosque de la vendeuse de crédit. Et qu'il y était retourné, ensuite, presque chaque jeudi.",
         V(42, 15, 20, ref="Luc 15:20")],
    ],
    "sept-paroles": [
        ["Ouverture",
         "Jésus a parlé peu sur la croix. Les quatre évangiles, ensemble, rapportent sept phrases. Aucun évangile ne les donne toutes.",
         "Pendant longtemps, nos Églises les ont méditées le Vendredi saint, une par une, entre midi et trois heures, à l'heure où « il y eut des ténèbres sur toute la terre » (Luc 23:44).",
         "Ce petit livre vous propose de les reprendre une par soir, pendant une semaine. Chaque méditation commence par la parole elle-même, que vous pourrez ouvrir dans la Bible intégrée. Puis elle s'arrête sur un mot, un seul.",
         "Il ne faut pas lire vite. Sept paroles, sept soirs.",
         "Première parole :",
         V(42, 23, 34, ref="Luc 23:34")],
    ],
    "quarante-jours": [
        ["Jour 1 — Pour le pain",
         V(52, 5, 18, ref="1 Thessaloniciens 5:18"),
         "« En toutes choses », pas « pour toutes choses ». Paul ne demande pas de remercier pour la maladie ou le deuil. Il demande de trouver, au milieu de tout, quelque chose à remercier.",
         "Aujourd'hui, commencez petit : le pain. Celui que vous avez mangé ce matin, ou celui que vous mangerez ce soir. Qui l'a semé, cuit, porté, vendu ?",
         "Écrivez : « Merci pour… » et terminez la phrase.",
         "À qui le dire : à la personne qui vous a servi à manger."],
        ["Jour 2 — Pour l'eau",
         "À Bukavu, on a le lac sous les yeux et, certains jours, rien au robinet. On apprend vite à ne pas tenir l'eau pour acquise.",
         V(43, 4, 14, ref="Jean 4:14"),
         "Aujourd'hui, chaque fois que vous boirez, dites merci intérieurement. Comptez le soir combien de fois vous l'avez fait.",
         "À qui le dire : à celle ou celui qui va chercher l'eau dans votre maison."],
        ["Jour 3 — Pour le toit",
         "Un toit, même qui fuit, même qui n'est pas à nous. Un endroit où l'on peut fermer les yeux.",
         "Jésus a dit que « le Fils de l’homme n’a pas où reposer sa tête » (Matthieu 8:20). Il savait ce que c'est que de dormir dehors.",
         "Écrivez : merci pour le lieu où je dormirai ce soir.",
         "À qui le dire : à quelqu'un qui vous a un jour ouvert sa porte."],
    ],
}


def main():
    for b in LIVRES:
        assert b["author"] in AUTEURS, b["id"]
        assert all(1 <= c["from"] <= c["to"] <= len(b["pages"]) for c in b["chapters"]), b["id"]
        assert len(TEXTES.get(b["id"], [])) <= len(b["pages"]), b["id"]
    D = {"authors": AUTEURS, "books": LIVRES, "texts": TEXTES}
    with open(os.path.join(ICI, "demo.json"), "w", encoding="utf-8") as f:
        json.dump(D, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"demo.json : {len(AUTEURS)} auteurs, {len(LIVRES)} livres.")


if __name__ == "__main__":
    main()
