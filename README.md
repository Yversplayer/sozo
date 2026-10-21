# Sōzō

Plateforme de lecture et de publication page par page : livres gratuits, payants ou mixtes, parutions programmées, Bible intégrée, correcteur du français, atelier d'auteur, paiement Mobile Money vérifié par l'équipe.

> **État au 18/10/2026 : en ligne depuis le 16/10** (Cloudflare → Render → Supabase, voir `REPRISE.md` §0). Aucun agrégateur de paiement n'est branché. L'envoi d'e-mails est prêt (Gmail SMTP ou Brevo) mais reste en mode capture tant que le mot de passe d'application n'est pas saisi. La restauration de sauvegarde a été exercée (SQLite et PostgreSQL), pas encore sur la base de production.

## Lancer en local

```bash
python3 -m venv backend_venv && backend_venv/bin/pip install -r requirements.txt -r requirements-dev.txt
SOZO_MODE_TEST=1 backend_venv/bin/python backend/app.py          # http://localhost:4385
backend_venv/bin/python backend/tools/demo.py                     # catalogue d'exemple (base locale)
```

**Catalogue d'exemple** : 14 livres de foi chrétienne, auteurs et textes inventés (`backend/tools/demo_catalogue.py` → `demo.json`). Chaque livre porte l'étiquette « Exemple » et **ne se vend pas** (le serveur refuse, `test_livre_d_exemple_jamais_vendu`). Pour la base en ligne :

```bash
backend_venv/bin/python backend/tools/demo.py --en-ligne --projet dcbbvcvnpdllxjyefzln --port 6543
```

L'adresse de la base est collée au clavier (rien ne s'affiche), puis il faut taper `EXEMPLE`. Sans `--en-ligne`, une base distante est refusée.

`SOZO_MODE_TEST=1` affiche des numéros de paiement factices et active le simulateur de prestataire. Il est **refusé sur une base distante**.

## Tests

```bash
backend_venv/bin/python -m unittest discover -s backend/tests -t backend   # SQLite
backend_venv/bin/python backend/tools/pg_tests.py                          # PostgreSQL 16 réel, RLS active
```

Les deux suites doivent être vertes. Chaque garde-fou a été **vu tomber** quand on retire le code qu'il protège : un test qui n'a jamais échoué ne prouve rien.

## Architecture

| Couche | Fichiers |
|---|---|
| Pages et scripts (JS natif, sans compilation, CSP `script-src 'self'`) | `index.html` (landing), `app/` (lecteur, studio, compte), `admin/` |
| Serveur Flask | `backend/app.py` (socle, routes fermées par défaut), `comptes.py`, `catalogue.py`, `studio.py`, `argent.py`, `admin.py` |
| Règles | `acces.py` : **seule** source de vérité de l'accès à une page · `prestataires.py` : contrat des futurs agrégateurs |
| Base | `schema.sql` (SQLite et PostgreSQL), migrations additives dans `db._migrer`, RLS dans `db.RLS` |

## Garanties (chacune couverte par un test)

- **Lecture.**
  - Le texte d'une page n'est envoyé qu'après `acces.etat_page` : 402 pour une page fermée, 403 avec sa date pour une page à venir, 404 pour un brouillon ou le livre d'un autre.
  - Le catalogue ne contient jamais de texte.
  - Une page programmée est publiée par le calcul côté serveur (`statut_effectif`) : aucune tâche planifiée, aucun navigateur ouvert n'est nécessaire.
- **Isolation.**
  - Un balayage appelle chaque route paramétrée avec les identifiants d'un autre compte (`test_lecture.Balayage`). Toute nouvelle route doit y être ajoutée.
  - Sous PostgreSQL, la RLS s'ajoute à ces contrôles, avec un rôle qui ne peut pas la contourner.
- **Import.**
  - Le type de fichier est reconnu par son contenu.
  - Les archives piégées sont arrêtées, et l'analyse tourne dans un processus séparé, tué au bout de 30 s.
  - Le manuscrit reste en stockage privé et n'est jamais servi.
  - L'import ne crée que des brouillons.
- **Écriture.**
  - Chaque enregistrement crée une version, et aucune n'est effacée.
  - Une page publiée ne se corrige qu'avec Plume.
  - Deux onglets ouverts sur la même page sont détectés (`version_attendue`, réponse 409).
  - Corbeille des pages : seuls les brouillons de fin de livre y vont (une page sortie ne bouge jamais) ; toutes les versions sont gardées, la page se récupère.
  - Le texte reste du TEXTE avec quelques marques (`#`, `>`, `***`, `**gras**`, `*italique*`, `texte.py`) : aucun HTML n'est jamais enregistré ; une épingle compare le texte lu, sans les marques.
- **Écrits** (poème, récit, conte, pensée, prière — `ecrits.py`, `test_ecrits.py`).
  - Un brouillon n'existe que pour son auteur (404 pour tout autre compte, et la RLS le cache aussi).
  - L'auteur vient de la session ; un j'aime par personne ; on ne « like » qu'un écrit publié.
  - Un commentaire se retire par son auteur ou par celui de l'écrit ; il reste en base, daté.
  - Un signalement va à la modération (rôle `moderation`), qui retire sans détruire.
- **Argent.**
  - Le prix est toujours calculé par le serveur.
  - Un livre d'exemple (`books.demo = 1`) ne se vend jamais.
  - Clé d'idempotence ; confirmation atomique (droit, reçu, registre) ; une référence Mobile Money ne paie qu'un achat.
  - Une notification n'est appliquée que si le montant et la devise sont conformes.
  - Un achat jamais payé expire au bout de 48 h.
  - Un remboursement ne modifie rien : il ajoute des lignes correctrices et révoque le droit de lecture.
  - Les frais du prestataire sont pris sur la part de Sōzō.
- **Administration.**
  - Comptes séparés, créés en ligne de commande uniquement ; mot de passe et code TOTP à usage unique.
  - Rôles au moindre privilège : `lecture`, `finance`, `moderation`.
  - Un code frais (moins de 10 min) est exigé pour rembourser, verser de l'argent ou désactiver un compte.
  - Journal d'audit inaltérable.

- **Personnalisation (19/10/2026).**
  - L'apparence d'un livre est reconstruite clé par clé par le serveur : une couleur est `#RRGGBB` et rien d'autre (jamais `url(…)`).
  - Une couverture envoyée est reconnue par sa signature (JPEG, PNG, WebP ; un SVG est refusé) et n'est servie qu'à qui peut voir le livre.
- **Épingles.** Un passage n'est épinglé que s'il figure dans une page que la personne peut lire (300 signes au plus sur une page achetée).
- **Relecture par l'IA.** À la demande de l'auteur, sur une page de SON livre ; chaque proposition est vérifiée dans le texte ; plafond par jour ; rien ne part sans `ANTHROPIC_API_KEY`.

## Messages, notifications, tâches

- **E-mails** (`mailer.py`, `envois.py`, `gabarits.py`) :
  - le message entre dans une file **dans la transaction** de l'action qui le cause, puis il est expédié après coup ;
  - nouvelles tentatives à 1 min, 5 min, 30 min puis 2 h, abandon au 5ᵉ échec ;
  - chaque message est réservé par une seule opération avant l'envoi, pour qu'il ne parte jamais deux fois ;
  - les codes de sécurité sont effacés de la base une fois envoyés.
  - Modes `SOZO_EMAIL_MODE` : `capture` (rien ne part), `smtp` (Gmail : mot de passe d'application), `brevo`.
  - Contact et adresse de réponse : `SOZO_EMAIL_CONTACT` (mudeyimusimwa@gmail.com).
- **Mot de passe oublié ou changé** : un code à 6 chiffres envoyé par e-mail.
  - Valable 15 minutes, 5 essais au plus, à usage unique.
  - La réponse est la même que le compte existe ou non.
  - Une alerte de sécurité est envoyée par e-mail.
  - Changer de mot de passe exige le mot de passe actuel **et** le code.
- **Notifications** (`notifications.py`, `push.py`, `app/sw.js`) :
  - trois canaux : la cloche, l'appareil (Web Push chiffré RFC 8291, VAPID) et l'e-mail selon les préférences, la sécurité partant toujours par e-mail ;
  - dédoublonnées par fait ;
  - le serveur n'écrit qu'aux services de notification connus (Google, Mozilla, Apple, Microsoft) ;
  - SMS et WhatsApp : non branchés.
- **Tâches périodiques** (`taches.py`) : annoncer les parutions, rappeler la fin de Plume, expirer les achats, effacer les manuscrits échus, expédier la file.
  - Lancement : `backend/tools/taches.py` toutes les 5 minutes, ou `SOZO_TACHES_INTEGREES=1` (verrou PostgreSQL : un seul processus).
- **Manuscrits d'origine** : effacés 90 jours après l'import, ou dès la suppression du compte. Le texte reste dans les pages.

## Performance (16/10/2026)

Tests k6 : voir `tools/k6/README.md`. Après corrections :
- 95 % des requêtes en moins de 0,13 s à 25 utilisateurs simultanés, et de 0,7 s à 50 ;
- en 2G, tourner une page coûte 3,9 s et 11 Ko, contre 13 s et 232 Ko avant.

Les réponses sont compressées (gzip) et les fichiers versionnés gardés un an par le navigateur. Le catalogue public est en cache 15 s, mais les droits restent calculés à chaque requête. En connexion lente ou en économie de données, seules les photos réduites sont chargées.

## Sauvegardes

```bash
backend_venv/bin/python backend/tools/sauvegarde.py cle                  # SOZO_CLE_SAUVEGARDE (à garder aussi HORS du serveur)
backend_venv/bin/python backend/tools/sauvegarde.py exporter sozo.sauv
backend_venv/bin/python backend/tools/sauvegarde.py verifier sozo.sauv
backend_venv/bin/python backend/tools/sauvegarde.py restaurer sozo.sauv  # base cible VIDE uniquement
```

- **Contenu** : export logique de toutes les tables et des manuscrits conservés, chiffré (Fernet), avec une empreinte par table.
- **Restauration** : uniquement dans une base vide, puis vérification table par table. Un octet modifié ou une mauvaise clé fait refuser la restauration.
- **Exercice du 16/10/2026** : la base de développement (683 lignes, 24 tables) a été restaurée dans SQLite en 0,25 s et dans PostgreSQL 16 en 1,3 s, puis utilisée. Connexions, atelier, catalogue et droits sont intacts.
- **Délai de remise en service (RTO)** : celui de la mise en route d'une base vide, plus quelques secondes de restauration.
- **Perte de données maximale (RPO)** : l'écart entre deux sauvegardes. **La planification et le stockage hors site ne sont pas encore en place.**

## Administration

```bash
backend_venv/bin/python backend/tools/admin.py creer --email a@exemple.cd --nom "Nom" --roles finance,moderation
backend_venv/bin/python backend/tools/admin.py roles --email a@exemple.cd --roles lecture
backend_venv/bin/python backend/tools/admin.py reinitialiser-totp --email a@exemple.cd   # téléphone perdu
backend_venv/bin/python backend/tools/admin.py desactiver --email a@exemple.cd
```

La console est servie à `/admin/index.html`.

## Brancher un agrégateur Mobile Money

1. Écrire sa classe dans `backend/prestataires.py` en partant de **sa** documentation (signature, champs, statuts). Elle traduit sa notification au format standard.
2. Ajouter cette classe à `ADAPTATEURS`.
3. Fournir le secret dans `SOZO_WEBHOOK_SECRET_<NOM>`.

Les droits, le registre et les tests ne changent pas. Le simulateur (`POST /api/paiements/<id>/simulation`) n'existe qu'en mode test.

## Ce qui n'est pas fait

- Aucun agrégateur réel ; Plume n'est pas un abonnement récurrent (30 jours payés une fois).
- E-mails : prêts, mais en mode capture tant que `SOZO_SMTP_PASSWORD` (mot de passe d'application Gmail) n'est pas saisi.
- Sauvegardes : outil et restauration éprouvés ; planification quotidienne et stockage hors site à mettre en place au déploiement.
- SMS et WhatsApp : aucun fournisseur.
- Réorganisation limitée aux brouillons de fin de livre : les droits d'achat sont attachés aux numéros de page, déplacer une page sortie les fausserait.
