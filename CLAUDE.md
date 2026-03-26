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

---

## Scope v2

### 1. Données matchs CDM 2026 — seed complet

Remplacer les 3 matchs fictifs par les **48 matchs de poules officiels** avec vraies dates, vraies équipes, vrais groupes.

Les phases finales (huitièmes, quarts, demies, finale, match 3e place) seront ajoutées dans une update séparée, après le dernier match de poules, une fois les qualifiés connus officiellement.

**Impact BDD — nouvelles colonnes sur `matchs` :**
- `groupe` TEXT (A–H pour la phase de groupes, NULL pour les phases finales)
- `statut` TEXT : `a_venir` | `en_cours` | `termine` (default `a_venir`)
- `api_match_id` INTEGER : identifiant du match côté API-Football (pour la synchro live)
- La colonne `phase` existante : `groupe` | `8eme` | `quart` | `demi` | `finale_3e` | `finale`

**Nouvelles variables `.env` serveur :**
- `FOOTBALL_DATA_KEY` — clé football-data.org
- `API_FOOTBALL_KEY` — clé api-football.com

---

### 2. Live scores — card "active"

Pendant un match en cours, la card bascule en mode **"active"** : score live + minute affichés en temps réel, style visuel distinct (bordure animée, indicateur LIVE).

**Fonctionnement technique :**
- Intégration d'une API football externe (voir choix ci-dessous)
- Le backend interroge l'API toutes les **60 secondes** pour les matchs `en_cours`
- Un nouveau endpoint `GET /api/matchs/live` retourne les données live
- Le frontend poll ce endpoint toutes les 60s (uniquement si un match est en cours ce jour)
- À la fin du match, le score est automatiquement persisté en base et les points calculés → **la page admin devient un fallback**, pas la source principale

**Choix API — approche hybride (zéro budget) :**
- **football-data.org** : calendrier + résultats finaux. Gratuit, sans cap journalier, 10 req/min. Clé : `FOOTBALL_DATA_KEY` dans `.env`
- **API-Football** (api-football.com) : live scores + minute. Gratuit, 100 req/jour max. Clé : `API_FOOTBALL_KEY` dans `.env`

**Stratégie pour rester dans les 100 req/jour d'API-Football :**
- Le backend ne poll QUE si un match est en cours à ce moment précis (vérification par heure avant d'appeler l'API)
- Fréquence : toutes les **3 minutes** pendant le live (pas 60s)
- Calcul : 1 match × 30 polls × 90 min = ~30 req. Max 3 matchs simultanés = ~90 req/jour → dans les clous

**Card active — interface :**
```
┌─────────────────────────────────────┐  ← bordure animée pulse bleue
│  🔴 LIVE  45+2'                     │
│  🇫🇷          2  —  1          🇧🇷  │
│  France                      Brésil │
│  [prono grisé : 2 — 1]             │
└─────────────────────────────────────┘
```

---

### 3. Notifications push

Notification envoyée **1h avant le coup d'envoi** de chaque match pour lequel l'user n'a pas encore saisi de prono (ou dont le prono est incomplet).

**Fonctionnement technique :**
- Web Push API via le service worker (déjà en place avec vite-plugin-pwa)
- Backend : génération de **clés VAPID** (`web-push` npm), stockées dans `.env`
- Nouvelle table `push_subscriptions` en BDD : `user_id`, `endpoint`, `keys`
- Nouveau endpoint `POST /api/push/subscribe`
- Job côté serveur (setInterval ou node-cron) : vérifie toutes les 5min les matchs à venir dans l'heure sans prono → envoie la notif
- L'abonnement est proposé depuis la page **Profil** (bouton "Activer les notifications")

---

### 4. Page admin

Interface web minimaliste accessible via `/admin?token=SECRET` (token défini dans `.env`).

Permet de :
- Voir tous les matchs avec leur statut
- Saisir ou corriger un score manuellement (fallback si l'API live échoue)
- Déclencher manuellement le recalcul des points d'un match
- Passer un match en statut `en_cours` / `termine`

**Sécurité :** token comparé côté serveur à chaque requête admin, aucune session.

---

### 5. Rafraîchissement automatique des données

- **Polling silencieux** toutes les 60s sur `GET /api/matchs` (uniquement si l'app est en foreground)
- Indicateur discret "dernière MAJ il y a X sec" dans le header ou sous la liste
- **Pull-to-refresh** sur mobile (swipe vers le bas) via l'API tactile
- Si un match passe de `a_venir` à `en_cours` ou `termine` pendant le poll → la liste se met à jour visuellement sans reload

---

### 6. Animations & transitions

- **Transitions de page** : fade + léger slide horizontal entre les 3 pages (via CSS transitions, pas de lib externe)
- **Cards** : apparition en stagger (chaque card fade-in avec un délai décalé au chargement)
- **Inputs score** : micro-animation de confirmation quand le prono est sauvegardé (bref flash vert sur le border)
- **Boutons** : scale down au tap (feedback tactile), transition sur hover
- **Points obtenus** : compteur animé (chiffre qui s'incrémente) quand une card passée apparaît
- **Card active** : bordure en pulse continu pendant le live

---

### 7. Avatar personnalisable (bonus, moins prioritaire)

Depuis la page Profil, l'user peut choisir parmi **5 styles DiceBear** (bottts, lorelei, thumbs, adventurer, pixel-art).

- Le style choisi est persisté dans `users.avatar_style` (nouvelle colonne)
- Le seed reste le pseudo — seul le style change
- L'avatar de la card de partage se met à jour en conséquence

---

## Ce qui reste hors scope (v2 et au-delà)
- Classement global / leaderboard
- Profil public / historique visible par d'autres users
- Récupération de compte perdu
- Déploiement (à décider séparément)

---

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