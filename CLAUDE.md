# Score26 — CDM 2026 Pronostics PWA

## Concept
Application PWA de pronostics personnels pour la Coupe du Monde 2026.
L'user prédit les scores des matchs, suit ses résultats et partage ses performances.
Pas de pari, pas de récompense réelle.

## Stack
- Frontend : React + Vite 5, TailwindCSS, vite-plugin-pwa
- Backend : Node.js + Express
- BDD : SQLite via better-sqlite3
- Avatar : DiceBear API (généré à l'inscription, permanent)
- Partage : html2canvas (card PNG téléchargeable)
- Auth : token UUID stocké en localStorage, lié au pseudo en BDD
- Langue : bilingue FR/EN (i18n)
- Thème : Dark/Light avec toggle

## Structure
- /client → frontend React
- /server → backend Express + SQLite

## Commandes
- `cd client && npm run dev` → frontend (port 5173)
- `cd server && npm run dev` → backend (port 3000)

## Conventions
- API REST préfixe : /api/
- Nommage : camelCase JS, snake_case colonnes SQLite
- Commentaires en français
- Pas de librairies d'auth (pas de JWT, pas de sessions)

## Modèle de données

### users
- id (UUID)
- pseudo (unique)
- avatar_seed (string, pour régénérer le même avatar DiceBear)
- created_at

### matchs
- id
- equipe_a, equipe_b (nom + emoji drapeau)
- date_coup_envoi (datetime, sert au verrouillage automatique)
- score_reel_a, score_reel_b (null jusqu'à la fin)
- phase (groupe pour v1)
- journee

### pronos
- id
- user_id (FK users)
- match_id (FK matchs)
- score_predit_a, score_predit_b
- points_obtenus (calculé après le match)
- verrouille (boolean, basculé automatiquement à date_coup_envoi)

## Règles métier
- Pseudo unique et définitif, pas de récupération de compte
- Token UUID en localStorage = identité de l'user
- Prono modifiable jusqu'à date_coup_envoi, verrouillage automatique
- Match bascule dans "passés" quand score_reel est renseigné
- Scoring : score exact = 50pts, bonne issue = 20pts, faux = 0
- Cote cachée : cote = 1 / ratio_users_même_prono, plafond x5, jamais affichée
- Score final = points × cote cachée
- Phases finales : hors scope v1

## Interface — description des écrans

### Header (toutes les pages)
- Gauche : toggle langue FR/EN
- Centre : logo "score26"
- Droite : toggle dark/light mode (icône soleil)

### Navbar bas (toutes les pages)
- 3 icônes : ballon (matchs à venir) | sifflet (matchs passés) | silhouette (profil)
- Icône active visuellement différenciée

### Onboarding (premier lancement uniquement)
- Plein écran, centré
- Logo score26 en haut
- Champ texte : "Choisis ton pseudo"
- Bouton valider
- À la validation : génération UUID + avatar DiceBear aléatoire lié au pseudo
- Stockage en localStorage + envoi en BDD
- Redirection automatique vers "Matchs à venir"

### Matchs à venir
- Liste de cards scrollable
- Chaque card contient :
  - Drapeau emoji + nom équipe A | à gauche
  - Drapeau emoji + nom équipe B | à droite
  - Date et heure du match centrées en haut de la card
  - Champs de saisie [ 0 ] — [ 0 ] centrés entre les deux équipes
  - Champs avec bordure fine, chiffre 0 par défaut
  - Une fois verrouillé (coup d'envoi passé) : champs grisés, non modifiables
- Sauvegarde automatique à chaque saisie, pas de bouton valider

### Matchs passés
- Liste de cards scrollable, même structure que "matchs à venir"
- Score réel affiché en grand au centre ( ex: 2 — 1 )
- Score prédit par l'user dans les mêmes champs grisés en dessous
- Bordure colorée de la card :
  - Vert : score exact
  - Bleu : bonne issue, mauvais score
  - Rouge : mauvaise issue
  - Gris/neutre : aucun prono

### Profil
- Avatar DiceBear grand format, centré en haut
- @pseudo en dessous
- Score total affiché
- Bloc résumé :
  - Nombre de scores exacts
  - Nombre de bonnes issues
  - Nombre de ratés
- Bouton "Partager" → génère une card PNG via html2canvas
  - La card contient : logo score26, avatar, pseudo, score total, résumé stats

## Ce qui est hors scope v1
- Phases finales
- Score live pendant les matchs
- Récupération de compte
- Notifications push
- Classement global des users
- Déploiement (à décider)

## Mode de travail

- Avant de coder une étape : décris ce que tu vas faire en termes simples
- Après chaque étape : explique ce que tu viens de faire en termes simples
- Une étape à la fois, jamais tout d'un coup
- Si tu crées un nouveau fichier : explique son rôle en une phrase
- Si tu utilises un concept technique : explique-le simplement

## Documentation

Maintiens un fichier JOURNAL.md à la racine du projet.
À chaque étape complétée, ajoute une entrée avec :
- Ce qui a été fait
- Les fichiers créés ou modifiés
- Les décisions techniques prises et pourquoi
- Ce qui reste à faire

Format :
### [date] — [nom de l'étape]
**Fait :** ...
**Fichiers :** ...
**Décisions :** ...
**Suivant :** ...