# Journal de développement — Score26

## 2026-03-25 — Session 1

### Mise en place de l'environnement
- Initialisation du projet avec structure `/client` et `/server`
- Rédaction du `CLAUDE.md` (concept, stack, modèle de données, règles métier, écrans)
- `.gitignore` racine : `node_modules/`, `.env`, `*.db`, `dist/`, `.DS_Store`

### Backend — structure de base
- `server/index.js` : serveur Express (port 3000, cors, json), montage des routes `/api/`
- `server/database.js` : connexion SQLite, création des tables `users`, `matchs`, `pronos`
- `server/routes/users.js`, `matchs.js`, `pronos.js` : fichiers vides prêts à coder
- `server/.env` : `PORT=3000`
- `server/seed.js` : 3 matchs fictifs pour les tests

### Backend — routes
- `POST /api/users` — création compte (id UUID fourni par le client, pseudo unique)
- `GET /api/users/:id` — profil + stats calculées (scores exacts, bonnes issues, ratés, score total)
- `GET /api/matchs?user_id=xxx` — tous les matchs avec prono de l'user en LEFT JOIN
- `POST /api/pronos` — upsert d'un prono, bloqué si coup d'envoi passé

### Backend — scoring & verrouillage
- `server/scoring.js` : calcul des points (50/20/0) + cote cachée (1/ratio, plafond x5), en transaction SQLite
- `PATCH /api/matchs/:id` : saisie du score réel, déclenche automatiquement le scoring
- `GET /api/matchs` : verrouille automatiquement les pronos dont le coup d'envoi est passé avant de répondre
- Testé : score exact 2-1 (seul prono) → 100 pts (50 × cote 2), mauvaise issue → 0 pts

### Frontend — structure complète
- Tailwind config corrigé (content + darkMode: 'class'), proxy Vite → backend port 3000
- `api.js` : createUser, getUser, getMatchs, upsertProno
- `i18n.js` : strings FR/EN via fonction t(lang, key)
- `App.jsx` : router par état (avenir/passes/profil) + theme dark/light + langue
- `Header.jsx` : toggle langue | logo | toggle thème
- `Navbar.jsx` : 3 icônes bas de page, icône active en bleu
- `MatchCard.jsx` : MatchCardAvenir (inputs dashed, sauvegarde auto débounce 600ms) + MatchCardPasse (score réel grand, prono grisé, bordure colorée)
- `Onboarding.jsx` : plein écran, pseudo input, UUID généré côté client, appel API
- `MatchsAvenir.jsx` / `MatchsPasses.jsx` : fetch + filtrage côté client
- `Profil.jsx` : avatar DiceBear v9, stats, bouton partager (html2canvas à implémenter)
- Build Vite : ✓ 0 erreur

### Comment tester l'app en local

#### 1. Préparer la base de données
```bash
cd server
node seed.js        # insère 3 matchs fictifs (remet à zéro si relancé)
```

#### 2. Démarrer le backend (terminal 1)
```bash
cd server
npm run dev         # Express sur http://localhost:3000
```
Vérifier que le serveur répond : http://localhost:3000/api/health → `{"status":"ok"}`

#### 3. Démarrer le frontend (terminal 2)
```bash
cd client
npm run dev         # Vite sur http://localhost:5173
```
Ouvrir http://localhost:5173 dans le navigateur.

#### 4. Parcours de test complet
1. **Onboarding** : saisir un pseudo → valider → redirection automatique vers "Matchs à venir"
2. **Matchs à venir** : saisir des scores dans les inputs ronds → attendre 600ms → vérifier en BDD que le prono est sauvegardé
3. **Simuler un score réel** (depuis un terminal) :
   ```bash
   curl -X PATCH http://localhost:3000/api/matchs/ID_DU_MATCH \
     -H "Content-Type: application/json" \
     -d '{"score_reel_a": 2, "score_reel_b": 1}'
   ```
   Remplacer ID_DU_MATCH par l'id du match concerné (visible dans la BDD ou via GET /api/matchs).
4. **Matchs passés** : le match apparaît avec le score réel, la bordure colorée et les points
5. **Profil** : avatar DiceBear, score total, résumé des stats

#### 5. Inspecter la BDD directement (optionnel)
```bash
# Depuis le dossier server
node -e "const db = require('./database'); console.log(db.prepare('SELECT * FROM pronos').all())"
```

#### Notes
- Les deux terminaux doivent tourner en même temps
- Si le frontend affiche une erreur réseau, vérifier que le backend est bien démarré
- `node seed.js` remet les matchs à zéro mais ne touche pas aux users ni aux pronos

### Frontend — bouton Partager
- `html2canvas` installé
- Card de partage rendue hors-écran (`left: -9999px`), capturée en PNG x2 pour netteté mobile
- Avatar en PNG (pas SVG) pour html2canvas via `crossOrigin="anonymous"` + endpoint DiceBear PNG
- Téléchargement automatique : `score26-{pseudo}.png`
- Card contient : logo score26, avatar, @pseudo, score total, stats (points colorés)

### PWA
- `public/icon.svg` + `public/maskable-icon.svg` : icône "26" fond sombre, coins arrondis
- `index.html` : title, theme-color, viewport-fit, balises Apple
- `vite.config.js` : VitePWA configuré (manifest, workbox precache, registerType autoUpdate)
- Build : génère `dist/sw.js` + `dist/manifest.webmanifest`, 10 entrées en précache
- Note : pour publication, convertir les SVG en PNG 192×192 et 512×512 (meilleure compatibilité Android)

### Icônes SVG + retouches visuelles
- `Icons.jsx` : SunIcon, MoonIcon, BallIcon, WhistleIcon, UserIcon — SVG stroke inline
- Header : toggle thème en SVG, fond `slate-100` (mode clair adouci)
- Navbar : icônes SVG, indicateur ligne bleue en haut de l'onglet actif, labels traduits
- Mode clair : fond `slate-100`, cards `slate-50` (suppression du blanc pur)

---

## 2026-03-26 — Session 2

### Scope v2 défini
Voir CLAUDE.md section "Scope v2" pour le détail complet.

Résumé des 7 axes :
1. **Seed complet** — 48 matchs de poules CDM 2026 réels (phases finales en update séparée)
2. **Live scores** — API football externe, polling 60s, card "active" avec score + minute + LIVE
3. **Notifications push** — Web Push API, VAPID, notif 1h avant match sans prono
4. **Page admin** — `/admin?token=SECRET`, saisie/correction scores, fallback API live
5. **Rafraîchissement auto** — polling 60s, pull-to-refresh, mise à jour silencieuse
6. **Animations** — transitions de page, stagger cards, feedback inputs, compteur pts, pulse live
7. **Avatar perso** — 5 styles DiceBear au choix (bonus, moins prioritaire)

### v2 — Étape 1 : Seed CDM 2026 + schéma BDD
- `database.js` : nouvelles colonnes `groupe`, `statut` (a_venir/en_cours/termine), `api_match_id` + migrations try/catch pour BDD existante
- `seed.js` : 48 matchs réels — 16 groupes (A–P) × 3 équipes × 3 matchs, dates juin–juillet 2026
- `i18n.js` : dictionnaire teamNamesEN complété (48 pays, toutes confédérations)
- `.env` : placeholders `FOOTBALL_DATA_KEY`, `API_FOOTBALL_KEY`, `ADMIN_TOKEN`
- Note : équipes et calendrier approximatifs — à confirmer avec le tirage officiel

### v2 — Étape 2 : Intégration football-data.org
- `server/services/footballData.js` : module avec `syncCalendrier()` (dates officielles + api_match_id) et `syncResultats()` (scores finaux + déclenchement points). Mapping 48 équipes EN→FR+emoji.
- `server/routes/sync.js` : `POST /api/sync/calendrier`, `POST /api/sync/resultats`, `GET /api/sync/status` — tous protégés par ADMIN_TOKEN
- `server/index.js` : auto-sync résultats toutes les 10 min via setInterval (actif seulement si FOOTBALL_DATA_KEY configurée)
- Vérifié : `GET /api/sync/status` → `{"total":48,"sans_api_id":48,"termine_sans_score":0}` ✓

### v2 — Étape 3 : Live scores API-Football
- `server/database.js` : 3 nouvelles colonnes — `score_live_a`, `score_live_b`, `minute_live`
- `server/services/apiFootball.js` : `syncLive()` — poll `GET /fixtures?live=all` CDM 2026. Garde-fou : vérifie d'abord si un match est dans la fenêtre temporelle (±120 min) avant d'appeler l'API → économise les 100 req/jour
- `server/index.js` : polling live toutes les 3 min (actif si API_FOOTBALL_KEY configurée)
- `server/routes/matchs.js` : `GET /api/matchs` expose `groupe`, `statut`, `score_live_a/b`, `minute_live`

### v2 — Étape 4 : Card live frontend + polling

**Fait :**
- `MatchCardActive` ajouté dans `MatchCard.jsx` : badge LIVE rouge pulsé + minute, score live en grand, prono grisé en dessous, bordure bleue animée (CSS `pulse-ring`)
- `MatchsAvenir.jsx` : section "En direct" affichée en haut si `statut = 'en_cours'`, polling automatique toutes les 60s tant qu'un match est actif (arrêt automatique quand plus rien en cours)
- `MatchsPasses.jsx` : filtrage par `statut = 'termine'` (plus robuste que `score_reel_a != null`)
- `index.css` : keyframe `pulse-ring` pour la bordure bleue pulsée des cards live
- `i18n.js` : clés `liveSection` (FR: "En direct" / EN: "Live") et `myProno`

**Fichiers :** `MatchCard.jsx`, `MatchsAvenir.jsx`, `MatchsPasses.jsx`, `index.css`, `i18n.js`

**Décisions :**
- Polling 60s (pas 3min comme le backend) car le frontend lit le cache BDD, pas l'API externe — pas de coût
- `charger()` définie dans le `useEffect` pour éviter les closures stale sur `userId`
- Le polling démarre/s'arrête dynamiquement selon la présence de matchs `en_cours` (pas un interval fixe)

**Suivant :** Rafraîchissement auto général (pull-to-refresh + indicateur "dernière MAJ") — étape 5 v2

### v2 — Étape 5 : Rafraîchissement auto + pull-to-refresh

**Fait :**
- `hooks/useAutoRefresh.js` : hook réutilisable — polling silencieux toutes les 60s + handlers tactiles pull-to-refresh. `cbRef` (useRef) pointe toujours vers la dernière version du callback sans recréer l'interval
- `components/LastUpdated.jsx` : composant affichant "MAJ il y a Xs" — ticks automatiques toutes les 10s via setInterval interne
- `MatchsAvenir.jsx` : refacto — suppression de l'interval manuel conditionnel, utilisation de `useAutoRefresh`. L'indicateur pull-to-refresh (↻ animé) et le timestamp sont affichés en tête de liste
- `MatchsPasses.jsx` : même pattern — polling 60s + pull-to-refresh + LastUpdated

**Fichiers :** `hooks/useAutoRefresh.js` (nouveau), `components/LastUpdated.jsx` (nouveau), `MatchsAvenir.jsx`, `MatchsPasses.jsx`

**Décisions :**
- `callbackRef` dans le hook pour éviter les closures stale sur `onRefresh` sans remettre l'interval en place
- `markUpdated()` exposé par le hook pour que la page l'appelle après le chargement initial (sinon le timestamp reste null jusqu'au premier poll à 60s)
- Pull-to-refresh : seuil 65px, uniquement si `scrollY === 0` (pas déclenché en cours de scroll normal)

**Suivant :** Animations & transitions — étape 6 v2

### v2 — Étape 6 : Animations & transitions

**Fait :**
- **Transitions de page** : keyframe `pageEnter` (fade + translateY 8px→0, 0.22s). Chaque page est enveloppée d'un `<div className="page-enter">` dans App.jsx — il se monte/démonte avec la condition, ce qui déclenche l'animation à chaque changement d'onglet
- **Stagger cards** : keyframe `cardIn` + classe `.card-stagger`. Chaque card est enveloppée d'un `<div style={{ animationDelay: i*50ms }}>` dans les listes → apparition en cascade (50ms entre chaque)
- **Flash vert save** : dans `MatchCardAvenir`, après `upsertProno().then(...)` → état `saved` passe à true 700ms → bordure des inputs vire au vert (`border-green-400 border-solid`), transition CSS `duration-300`
- **Compteur animé** : composant `AnimatedCount` dans MatchCard.jsx — count 0→valeur en ~20 frames (interval 30ms) au montage de la card passée
- **Tap feedback Navbar** : `active:scale-90 transition-transform` sur les boutons de la navbar

**Fichiers :** `index.css`, `App.jsx`, `Navbar.jsx`, `MatchCard.jsx`, `MatchsAvenir.jsx`, `MatchsPasses.jsx`

**Décisions :**
- `translateY` plutôt que `translateX` pour les transitions de page — plus naturel sur mobile, évite de gérer la direction gauche/droite
- `both` sur `animation-fill-mode` pour que les cards soient invisibles avant leur délai (évite le flash)
- `savedTimerRef` pour annuler le timer flash si l'user retape rapidement

**Suivant :** Notifications push (Web Push API, VAPID) — étape 7 v2

### v2 — Étape 7 : Notifications push

**Fait :**
- `server/generate-vapid.js` : script one-shot pour générer les clés VAPID → sortie console à coller dans `.env`
- `server/database.js` : deux nouvelles tables — `push_subscriptions` (endpoint, p256dh, auth, user_id) et `notifs_envoyees` (anti-doublon user_id × match_id)
- `server/routes/push.js` : 3 routes — `GET /api/push/vapid-public-key` (clé publique), `POST /subscribe`, `DELETE /unsubscribe`
- `server/services/pushNotifications.js` : `envoyerNotifAvantMatch()` — requête SQL ciblant les (user, match) sans prono dans la fenêtre [55-65min], envoi via `web-push`, suppression des subscriptions expirées (HTTP 410/404)
- `server/index.js` : route push montée + job 5min (actif si VAPID_PUBLIC_KEY configurée)
- `server/.env` : placeholders VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
- `client/public/push-sw.js` : gestionnaire `push` + `notificationclick` dans le SW (fichier public importé via `importScripts`)
- `client/vite.config.js` : `importScripts: ['/push-sw.js']` dans la config workbox
- `client/src/api.js` : fonctions `getVapidPublicKey`, `subscribePush`, `unsubscribePush`
- `client/src/pages/Profil.jsx` : état `notifStatus` (checking/default/granted/denied/unsupported/subscribing), logique subscribe/unsubscribe via `pushManager`, composant `NotifButton`

**Fichiers :** `generate-vapid.js` (nouveau), `database.js`, `routes/push.js` (nouveau), `services/pushNotifications.js` (nouveau), `index.js`, `.env`, `public/push-sw.js` (nouveau), `vite.config.js`, `api.js`, `Profil.jsx`, `i18n.js`

**Décisions :**
- `push-sw.js` dans `public/` + `importScripts` plutôt que passer en `injectManifest` : moins de changements, pas de dépendance workbox à gérer côté client
- Fenêtre [55-65min] pour les notifs : le job tourne toutes les 5min, fenêtre de 10min → chaque match est détecté 2 fois maximum. La table `notifs_envoyees` garantit qu'une seule notif est envoyée par (user, match)
- Gestion HTTP 410/404 : subscription expirée (navigateur révoqué) → supprimée proprement de la BDD
- `notif-tag: 'score26-notif'` dans le SW : les notifs consécutives du même match ne s'accumulent pas

**Pour activer :**
1. `cd server && npm install web-push`
2. `node generate-vapid.js` → coller les clés dans `.env`
3. Redémarrer le serveur

**Suivant :** Page admin — étape 8 v2

---

## 2026-03-26 — Session 3

### Seed CDM 2026 réel (72 matchs)

**Fait :**
- `server/seed.js` : réécriture complète — 12 groupes (A–L) × 6 matchs = 72 matchs. Données officielles (tirage CDM 2026), heures converties de ET vers UTC. 6 équipes encore inconnues (barrages UEFA/FIFA) représentées par des placeholders.
- `client/src/i18n.js` : ajout des traductions manquantes — Afrique du Sud, Haïti, Paraguay, Curaçao, Cap-Vert, Norvège, Jordanie + noms EN des équipes de barrage

**Décisions :**
- Placeholder "🏆 Barrage UEFA A/B/C/D" et "🏆 Barrage FIFA 1/2" pour les équipes encore inconnues au 26 mars 2026 (finales barrages UEFA le 31 mars)
- À remplacer dans le seed une fois les qualifiés connus

### v2 — Étape 8 : Page admin

**Fait :**
- `server/routes/admin.js` (nouveau) : routes protégées par `ADMIN_TOKEN` — `GET /api/admin/matchs` (liste complète) et `PATCH /api/admin/matchs/:id` (statut, score réel, recalcul points). Middleware `checkToken` sur chaque route.
- `server/index.js` : montage de la route `/api/admin`
- `client/src/pages/Admin.jsx` (nouveau) : interface React — liste des 72 matchs groupés par groupe (A–L), badge statut coloré, inputs score inline, boutons "Mettre en cours" / "Terminer" / "Recalculer". Feedback visuel 2.5s après chaque action.
- `client/src/App.jsx` : détection de `window.location.pathname === '/admin'` → affiche `<Admin />` sans Header/Navbar

**Fichiers :** `routes/admin.js` (nouveau), `index.js`, `pages/Admin.jsx` (nouveau), `App.jsx`

**Décisions :**
- Token passé en query param `?token=...` (simple, pas de gestion de session) — vérifié côté serveur à chaque requête
- Le token `change_this_before_deploy` est explicitement rejeté → force à configurer `.env` avant usage
- `PATCH` avec `{ statut }` seul → change uniquement le statut (pas de recalcul)
- `PATCH` avec `{ score_reel_a, score_reel_b }` → force `statut = 'termine'` + déclenche `calculerPoints()`
- `PATCH` avec `{ recalculer: true }` → recalcul des points sans toucher au score (correction manuelle)
- Détection admin via `window.location.pathname` dans App.jsx (pas de react-router) — Vite sert `index.html` pour toutes les routes en dev

**Pour accéder :**
`http://localhost:5173/admin?token=VOTRE_ADMIN_TOKEN` (valeur dans `server/.env`)

**Suivant :** Avatar personnalisable — étape 9 v2 (bonus, moins prioritaire)

---

## 2026-03-27 — Plan pré-déploiement (v2.1)

**Décision :** Avatar personnalisable skippé (hors priorité). Plan pré-déploiement établi et validé.

**Étapes retenues (dans l'ordre) :**

1. **Polish interface**
   - Séparateurs de groupe dans "Matchs à venir"
   - Tri matchs passés : plus récent → plus ancien
   - Messages état vide (liste vide)
   - Score total à 0 dans le profil

2. **Robustesse — validation pseudo**
   - Max 20 caractères, regex `/^[a-zA-Z0-9_-]+$/`
   - Côté serveur (source de vérité) + côté client (feedback immédiat)

3. **Robustesse — rate limiting**
   - `express-rate-limit` sur POST /api/users et POST /api/push/subscribe
   - 5 req/15min et 10 req/15min par IP

4. **PWA — vérification offline**
   - Exclure `/api/*` du cache Workbox si nécessaire

5. **Sécurité**
   - Helmet.js (headers HTTP)
   - CORS restreint en prod
   - Sanitisation serveur (trim, types, bornes)
   - Vérification .gitignore

6. **Modale "À propos"**
   - Icône ℹ️ dans le header → modale légère
   - Concept + règles scoring + mention cote cachée

**Suivant :** Étape 1 — Polish interface

---

## 2026-03-27 — Plan v2.5

**Décision :** Après les vérifications pré-déploiement (v2.1), le scope v2.5 est établi et priorisé. Il couvre UX, qualité, infrastructure et une nouvelle feature majeure.

**Ordre de priorité retenu :**

| # | Feature | Effort | Urgence |
|---|---|---|---|
| 1 | Icônes PWA PNG | Faible | Avant déploiement |
| 2 | Page 404 | Faible | Avant déploiement |
| 3 | Feedback notif bloquées | Faible | UX |
| 4 | Gestion perte connexion | Moyen | UX mobile |
| 5 | Logs serveur (pino) | Moyen | Infrastructure |
| 6 | Phases finales (seed + UI) | Moyen | Data-dépendant (post 26/06) |
| 7 | Tests automatisés | Moyen | Qualité |
| 8 | Déploiement | Fort | Objectif final |
| 9 | Classement global | Fort | Feature engagement |

**Rationale :**
- Items 1–4 : quick wins UX, à faire avant le déploiement
- Item 5 : nécessaire dès qu'on est en prod
- Item 6 : bloqué par les résultats sportifs (barrages UEFA le 31/03, qualifiés groupes le 26/06)
- Item 7 : tests sur code critique (scoring), pas de lib externe (Node test runner)
- Item 8 : Fly.io (backend SQLite) + Vercel (frontend statique)
- Item 9 : classement calculé à la volée, 4e onglet Navbar

**Détail complet dans CLAUDE.md — section "Scope v2.5"**

**Suivant :** Icônes PWA PNG (étape 1 v2.5)

---

## 2026-03-27 — v2.5 Étape 1 : Icônes PWA PNG

**Fait :**
- `client/generate-icons.mjs` : script Node (ESM) utilisant `sharp` pour générer les 4 PNG depuis les SVG sources
- `client/public/icon-192.png` : 192×192, icône Android écran d'accueil
- `client/public/icon-512.png` : 512×512, splash screen Android
- `client/public/maskable-icon-512.png` : 512×512 depuis `maskable-icon.svg`, icône adaptative Android
- `client/public/apple-touch-icon.png` : 180×180, icône iOS
- `client/vite.config.js` : manifest mis à jour — PNG explicites (192, 512, maskable 512) + SVG en bonus pour desktop
- `client/index.html` : `apple-touch-icon` corrigé (pointait sur le SVG, iOS ne supporte pas SVG ici)

**Fichiers :** `generate-icons.mjs` (nouveau), `icon-192.png`, `icon-512.png`, `maskable-icon-512.png`, `apple-touch-icon.png` (nouveaux), `vite.config.js`, `index.html`

**Décisions :**
- Script placé dans `/client` pour que Node trouve `sharp` dans le `node_modules` local
- SVG conservé dans le manifest en dernier (navigateurs desktop qui le supportent)
- `generate-icons.mjs` à relancer si les SVG sources changent

**Suivant :** Page 404 (étape 2 v2.5)

---

## 2026-03-27 — v2.5 Étape 2 : Page 404

**Fait :**
- `client/src/pages/NotFound.jsx` : composant simple — "404" en bleu, message, bouton retour vers `/`
- `client/src/main.jsx` : routing URL explicite — `/` → App, `/admin` → Admin, tout le reste → NotFound

**Fichiers :** `NotFound.jsx` (nouveau), `main.jsx`

**Décisions :**
- `window.location.replace('/')` plutôt que `href` : ne laisse pas l'URL 404 dans l'historique du navigateur
- Routing dans `main.jsx` (pas dans `App.jsx`) : cohérent avec la détection `/admin` déjà en place

**Suivant :** Feedback notifications bloquées (étape 3 v2.5)

---

## 2026-03-27 — v2.5 Étape 3 : Feedback notifications bloquées

**Fait :**
- `i18n.js` : nouvelles clés `notifsBlocked` (titre) et `notifsBlockedHint` (instructions cadenas) en FR et EN
- `Profil.jsx` — `NotifButton` : quand statut `denied`, affichage d'un bloc ambré avec icône 🔕, titre et instructions pour réactiver via le cadenas du navigateur

**Fichiers :** `i18n.js`, `Profil.jsx`

**Décisions :**
- Bloc ambré (warning) plutôt que rouge : ce n'est pas une erreur, c'est un état réversible par l'utilisateur
- Instructions génériques "cadenas dans la barre d'adresse" : fonctionne sur Chrome, Edge, Firefox et Safari sans detection d'user-agent
- Le bloc remplace le bouton (pas de bouton cliquable quand `denied` car `requestPermission()` est silencieusement ignoré par le navigateur)

**Suivant :** Gestion perte de connexion (étape 4 v2.5)

---

## 2026-03-27 — v2.5 Étape 4 : Gestion perte de connexion

**Fait :**
- `hooks/useOnlineStatus.js` : hook qui écoute les événements `online`/`offline` du navigateur, retourne un booléen `isOnline`
- `components/OfflineBanner.jsx` : bandeau fixe en haut de l'écran (point rouge pulsé + message), affiché uniquement quand offline
- `i18n.js` : clé `offline` ajoutée en FR et EN
- `App.jsx` : importe `useOnlineStatus` + affiche `OfflineBanner` si `!isOnline` + passe `isOnline` à `MatchsAvenir`
- `MatchsAvenir.jsx` : reçoit `isOnline` (défaut `true`) et le transmet à `MatchCardAvenir`
- `MatchCard.jsx` — `MatchCardAvenir` : skip l'appel `upsertProno` si `!isOnline` (les inputs restent actifs, mais la sauvegarde n'est pas tentée)

**Fichiers :** `useOnlineStatus.js` (nouveau), `OfflineBanner.jsx` (nouveau), `i18n.js`, `App.jsx`, `MatchsAvenir.jsx`, `MatchCard.jsx`

**Décisions :**
- Inputs laissés actifs en offline : l'user peut pré-saisir ses scores, ils seront sauvegardés dès que la connexion revient (au prochain changement de valeur)
- `pointer-events-none` sur le bandeau : ne bloque pas les interactions derrière
- Pas de toast ou modal : le bandeau persistant suffit, il disparaît automatiquement au retour de la connexion

**Suivant :** Logs serveur avec pino (étape 5 v2.5)

---

## 2026-03-27 — v2.5 Étape 5 : Logs serveur (pino)

**Fait :**
- `npm install pino` + `npm install --save-dev pino-pretty`
- `server/logger.js` : instance pino partagée — pino-pretty en dev (coloré, heure lisible), JSON brut en prod (`NODE_ENV=production`)
- `server/index.js` : import logger, remplacement de tous les `console.*`, ajout d'un middleware d'erreur Express qui log les erreurs non gérées
- `server/routes/admin.js` : import logger, remplacement des `console.warn/log` dans `checkToken`
- `server/.env` : ajout de `LOG_LEVEL=info` (configurable : debug | info | warn | error)

**Fichiers :** `logger.js` (nouveau), `index.js`, `routes/admin.js`, `.env`

**Décisions :**
- Pas de log HTTP par requête (trop de bruit avec le polling 60s) — uniquement les erreurs, les events serveur et les accès admin
- `pino-pretty` en devDependency uniquement : pas embarqué en prod
- Structured logging (objets JSON) : `logger.error({ err: e }, 'message')` — exploitable par les outils de monitoring en prod (Fly.io logs, Papertrail, etc.)

**Suivant :** Phases finales — seed + UI (étape 6 v2.5, data-dépendant)

---

## 2026-03-27 — v2.5 Étape 7 : Tests automatisés

**Fait :**
- `server/scoring.js` : export de `calculerPointsBase` ajouté — seul changement en code de prod, non-cassant (`calculerPoints` reste exporté aussi)
- `npm install --save-dev supertest` dans `/server` — seule dépendance de test ajoutée
- `server/tests/helpers/db.js` : crée une BDD SQLite `:memory:` avec le schéma complet (users, matchs, pronos), réinitialisée à chaque suite de tests. Aucune interaction avec `score26.db`
- `server/tests/scoring.test.js` : 11 cas — 6 tests sur la logique pure (`calculerPointsBase`, sans BDD), 5 tests sur la cote cachée (`calculerPoints` avec insertions en BDD in-memory : seul prono ×1, 1/2 pronos ×2, cote plafonnée ×5, mauvaise issue 0 pt, aucun prono sans plantage)
- `server/tests/users.test.js` : 10 cas — POST création valide, pseudo doublon (409), pseudo invalide (vide / trop long / espace / accent / @) (400), champs manquants (400), GET user existant (200+stats), GET user inexistant (404)
- `server/tests/pronos.test.js` : 8 cas — prono valide (201), upsert sur même user+match (201 nouvelles valeurs), score négatif / >99 / non-entier (400), match verrouillé (403), match inexistant (404), champs manquants (400)
- `server/package.json` : script `"test": "node --test tests/scoring.test.js tests/users.test.js tests/pronos.test.js"`

**Résultat :** `29 tests / 29 pass / 0 fail` — premier lancement

**Fichiers :** `scoring.js`, `tests/helpers/db.js` (nouveau), `tests/scoring.test.js` (nouveau), `tests/users.test.js` (nouveau), `tests/pronos.test.js` (nouveau), `package.json`

**Décisions :**
- `node:test` + `node:assert` natifs (Node 24) : zéro dépendance de framework
- `require.cache` override pour injecter la BDD in-memory dans les modules qui font `require('../database')` — évite toute modification des routes de prod
- Le rate-limiter de `POST /api/users` (`express-rate-limit`) est remplacé par un middleware passthrough dans les tests (même technique) : 8 POST dans un test dépasseraient la limite de 5 req/15min
- `describe({ concurrency: false })` dans chaque fichier : garantit l'exécution séquentielle des tests, évite les conflits d'état SQLite
- Chaque suite pre-seed ses propres données dans `before()` → les tests sont indépendants entre eux, aucune dépendance d'ordre
- Pas de test sur `admin.js`, `sync.js`, `push.js` : CRUD simple, APIs externes, ou dépendances VAPID trop coûteuses à mocker pour la valeur apportée

**Pour lancer :**
```bash
cd server && npm test
```

**Suivant :** Déploiement (étape 8 v2.5) ou Classement global (étape 9 v2.5)

---

## 2026-03-27 — v2.5 Étape 8 : Préparation au déploiement

**Fait :**
- `client/src/api.js` : `BASE` utilise désormais `import.meta.env.VITE_API_URL` — en dev la variable est vide et le proxy Vite prend le relais, en prod elle pointe sur l'URL Fly.io
- `client/src/pages/Admin.jsx` : même correction — ajout de `API_BASE` calculée depuis `VITE_API_URL`, les deux `fetch` admin utilisent cette constante
- `server/database.js` : chemin SQLite configurable via `process.env.DATABASE_PATH` — en dev fichier local `server/score26.db`, en prod `/data/score26.db` (volume persistant Fly.io)
- `client/vite.config.js` : urlPattern Workbox passé de regex `/^\/api\//` à fonction `({ url }) => url.pathname.startsWith('/api/')` — fonctionne sur URLs relatives (dev) et absolues cross-origin (prod)
- `server/.env.example` : fichier de référence documentant toutes les variables d'environnement nécessaires en prod (CORS_ORIGIN, DATABASE_PATH, ADMIN_TOKEN, clés API, VAPID)

**Fichiers :** `api.js`, `Admin.jsx`, `database.js`, `vite.config.js`, `.env.example` (nouveau)

**Décisions :**
- `VITE_API_URL` vide en dev = comportement identique à avant (proxy Vite transparent)
- `DATABASE_PATH` optionnel en dev : si absent, SQLite reste dans `server/` comme avant
- `.env.example` commité dans le repo (contrairement à `.env`) : sert de documentation pour configurer Fly.io et pour les futurs contributeurs
- Workbox pattern en fonction plutôt qu'en regex : plus robuste face aux URLs absolues cross-origin vers Fly.io

**Suivant :** Installer flyctl, créer compte Fly.io, lancer `fly launch` dans `/server`

---

## 2026-03-27 — v2.5 Étape 8 : Déploiement (Fly.io + Vercel)

**Fait :**
- `server/Dockerfile` : image `node:20-slim` + outils de compilation pour `better-sqlite3` (module natif C++), `npm ci --omit=dev`, `NODE_ENV=production`
- `server/.dockerignore` : exclut `node_modules`, `*.db`, `.env`, `tests/`, `generate-vapid.js`
- `server/fly.toml` : config Fly.io — app `score26`, région `cdg` (Paris), volume `score26_data` monté sur `/data`, 256 MB RAM, auto-stop activé (tier gratuit)
- App Fly.io créée : `score26`
- Volume persistant créé : `score26_data` (1 Go, région cdg, chiffré, snapshots automatiques)
- Secrets Fly.io configurés : `ADMIN_TOKEN`, `CORS_ORIGIN=https://score26.vercel.app`
- Seed lancé en prod via `flyctl ssh console -C "node seed.js"` → 72 matchs insérés
- Frontend déployé sur Vercel — Root Directory `client`, `VITE_API_URL=https://score26.fly.dev`
- **App en production et fonctionnelle** ✓

**URLs de production :**
- Frontend : https://score26.vercel.app
- Backend : https://score26.fly.dev

**Fichiers :** `Dockerfile` (nouveau), `.dockerignore` (nouveau), `fly.toml` (nouveau)

**Décisions :**
- `node:20-slim` + install des outils build : image plus légère que `node:20` full tout en supportant les modules natifs C++
- Auto-stop activé : la machine s'endort sans trafic et redémarre en ~1s — acceptable pour ce use case, économise le quota gratuit Fly.io
- CORS_ORIGIN configuré comme secret Fly (pas dans fly.toml) : évite d'exposer l'URL en clair dans le repo
- `flyctl ssh console -C "node seed.js"` : seed lancé directement sur la machine prod, sans exposer de route HTTP dédiée

**Suivant :** Classement global (étape 9 v2.5)
