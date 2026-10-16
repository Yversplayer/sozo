# Sōzō

Plateforme de lecture et de publication page par page : livres gratuits, payants ou mixtes, parutions programmées, Bible intégrée, correcteur du français, atelier d'auteur, paiement Mobile Money vérifié par l'équipe.

> **État au 16/10/2026 : jamais déployé.** Aucun agrégateur de paiement n'est branché. L'e-mail est en mode capture (rien ne part). Aucune sauvegarde n'a été restaurée.

## Lancer en local

```bash
python3 -m venv backend_venv && backend_venv/bin/pip install -r requirements.txt -r requirements-dev.txt
SOZO_MODE_TEST=1 backend_venv/bin/python backend/app.py          # http://localhost:4385
backend_venv/bin/python backend/tools/demo.py                     # livres de démonstration (base locale seulement)
```

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
- **Argent.**
  - Le prix est toujours calculé par le serveur.
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
- E-mails non envoyés (mode capture).
- Aucune sauvegarde restaurée ni procédure de reprise testée.
- Réorganisation limitée aux brouillons de fin de livre : les droits d'achat sont attachés aux numéros de page, déplacer une page sortie les fausserait.
