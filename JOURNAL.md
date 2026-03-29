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

---

## 2026-03-27 — Corrections post-scan + notes lancement public

**Fait :**
- `Onboarding.jsx` : "26" en bleu (`text-blue-500`) comme dans le Header et la modale À propos
- `Profil.jsx` : `getUser()` enveloppé dans `.finally(() => setLoading(false))` + garde `if (!user)` — plus de spinner infini si l'API plante
- `Profil.jsx` : `handleShare()` enveloppé dans `try/catch/finally` — le bouton se débloque toujours même si html2canvas échoue
- `i18n.js` : doublon `'Angleterre': 'England'` supprimé (ligne 111)

**Fichiers :** `Onboarding.jsx`, `Profil.jsx`, `i18n.js`

**Checklist pré-lancement (~1 semaine avant le 11 juin 2026) :**
- [ ] Désactiver l'auto-stop Fly.io (`auto_stop_machines = 'off'`, `min_machines_running = 1`) + `flyctl deploy`
- [ ] Acheter score26.fr (~7€) et le pointer sur Vercel (DNS CNAME)
- [ ] Mettre à jour les équipes barrages UEFA dans `seed.js` (résultats connus le 31 mars 2026) + relancer le seed en prod
- [ ] Ouvrir compte Google Play Developer (25$) + soumettre via PWABuilder
- [ ] Vérifier que `CORS_ORIGIN` est à jour sur Fly.io si le domaine change

**Suivant :** Page Politique de confidentialité (obligatoire Play Store + RGPD)

---

## 2026-03-27 — Politique de confidentialité

**Fait :**
- `client/src/components/LegalModal.jsx` : modale bilingue FR/EN — données collectées, utilisation, DiceBear, droits RGPD, contact. Placeholder `contact@score26.fr` à remplacer par la vraie adresse
- `client/src/pages/Profil.jsx` : import + état `showLegal` + petit lien discret en bas de la page + rendu conditionnel de la modale

**Fichiers :** `LegalModal.jsx` (nouveau), `Profil.jsx`

**Décisions :**
- Modale plutôt que page dédiée : pas de route supplémentaire, accès discret depuis le profil
- `items-center` + `py-16` sur le backdrop : centrage vertical garanti, jamais caché par le notch (iPhone XR/11) ni par la navbar
- Contenu minimal adapté à Score26 : pas d'email, pas de paiement, juste pseudo + pronos + UUID localStorage
- Email de contact en constante `CONTACT_EMAIL` en haut du fichier → une seule ligne à changer

**TODO :** remplacer `contact@score26.fr` dans `LegalModal.jsx` ligne 5 quand l'adresse est prête

---

## 2026-03-28 — Scope v3 : Review complète & corrections

Résultat d'un audit complet du codebase (tous les fichiers frontend + backend + config). Les corrections sont regroupées par lot, à réaliser dans l'ordre.

---

### Lot 1 — Sécurité (critique)

**Étape 1 : Protéger `PATCH /api/matchs/:id`**
La route `server/routes/matchs.js` ligne 48 permet à **n'importe qui** de modifier le score réel d'un match et de recalculer les points, sans authentification. Seule `/api/admin/matchs/:id` est protégée par `checkToken`. Un attaquant peut fausser tout le scoring.
→ Ajouter un middleware `checkToken` (ou supprimer la route si `/api/admin/matchs/:id` suffit).

**Étape 2 : Vérifier l'existence du user dans `POST /api/pronos`**
`server/routes/pronos.js` ne vérifie pas que `user_id` correspond à un user réel. Le FK constraint empêche l'insertion mais retourne un crash 500 au lieu d'un 400 propre.
→ Ajouter un `SELECT id FROM users WHERE id = ?` avant l'upsert.

**Étape 3 : Rate-limit sur `POST /api/pronos`**
Aucune limitation. Un attaquant pourrait spammer des millions de requêtes.
→ Ajouter `express-rate-limit` (ex: 60 req/min par IP).

---

### Lot 2 — Robustesse API client (haute priorité)

**Étape 4 : Vérifier `res.ok` dans les fonctions API**
`client/src/api.js` : toutes les fonctions font `res.json()` sans vérifier `res.ok`. Si le serveur renvoie 404 ou 500, le client parse un objet `{ error: '...' }` et l'affiche comme des données valides (pseudo undefined, stats cassées).
→ Ajouter un check `if (!res.ok)` dans chaque fonction et retourner `{ error: ... }` proprement.

**Étape 5 : Distinguer rate-limit (429) vs pseudo pris (409) dans Onboarding**
Quand le rate-limiter bloque la création de compte, `createUser` parse la 429 et l'Onboarding affiche "Ce pseudo est déjà pris" alors que c'est un rate-limit.
→ Vérifier `res.status` côté Onboarding et afficher un message adapté.

---

### Lot 3 — Persistance préférences utilisateur (haute priorité)

**Étape 6 : Persister la langue en localStorage**
Le toggle FR/EN dans le Header remet à `'fr'` à chaque rechargement. Un anglophone doit re-switcher à chaque visite.
→ `localStorage.setItem('score26_lang', lang)` + init depuis localStorage dans `App.jsx`.

**Étape 7 : Persister le thème en localStorage**
Le thème revient à `'dark'` par défaut à chaque rechargement.
→ Même pattern que la langue.

---

### Lot 4 — Performance & qualité (moyenne priorité)

**Étape 8 : Pause du polling quand l'app est en background**
`useAutoRefresh.js` : le `setInterval` tourne même quand le tab n'est pas visible. Sur mobile, ça consomme batterie et bandwidth pour rien.
→ Ajouter un listener `visibilitychange` pour pause/resume l'interval.

**Étape 9 : Déplacer le verrouillage des pronos hors du GET**
`GET /api/matchs` exécute un `UPDATE pronos SET verrouille = 1` à **chaque** requête. Avec polling 60s × N users, ça fait beaucoup d'écritures inutiles.
→ Le déplacer dans un job périodique (setInterval toutes les 60s dans `index.js`).

**Étape 10 : Optimiser `calculerPoints` (N+1 queries)**
`scoring.js` fait un `SELECT COUNT(*)` par prono. Avec 1000 users sur un match, ça fait 1000 queries.
→ Pré-calculer les comptes par groupe `(score_predit_a, score_predit_b)` en un seul SELECT avant la boucle.

---

### Lot 5 — Cohérence & polish (basse priorité)

**Étape 11 : Remplacer les `console.log` restants par `logger`**
Fichiers concernés : `pushNotifications.js`, `routes/sync.js`, `services/footballData.js`, `services/apiFootball.js`. Incohérent avec le reste du serveur qui utilise pino.

**Étape 12 : `initWebPush()` une seule fois au démarrage**
`pushNotifications.js` appelle `webPush.setVapidDetails()` à chaque tick (toutes les 5 min). Inutile.
→ Initialiser une seule fois dans `index.js` ou via un flag `initialized`.

**Étape 13 : Limiter le stagger animation**
Avec 72 matchs, le dernier a un delay de 3.6s (`i * 50ms`). Plafonner à ~10 éléments (500ms max).

**Étape 14 : Supprimer les doublons dans i18n**
`Cameroun` et `Tunisie` apparaissent deux fois dans `teamNamesEN`. Code mort.

**Étape 15 : Notification push bilingue**
Le texte de la notif push est toujours en français. Les users anglophones ne comprendront pas.
→ Option 1 : stocker `lang` dans la table `users` (nouvelle colonne).
→ Option 2 : envoyer un texte bilingue court ("FR: coup d'envoi dans 1h / EN: kickoff in 1h").

---

### Résumé par priorité

| Lot | Nom | Étapes | Priorité |
|-----|-----|--------|----------|
| 1 | Sécurité | 1–3 | Critique — à faire en premier |
| 2 | Robustesse API client | 4–5 | Haute |
| 3 | Persistance préférences | 6–7 | Haute |
| 4 | Performance & qualité | 8–10 | Moyenne |
| 5 | Cohérence & polish | 11–15 | Basse |

**Suivant :** Lot 1 — Étape 1 : Protéger `PATCH /api/matchs/:id`

---

## 2026-03-28 — Scope v3.1 : Audit pré-Play Store & améliorations

Résultat d'un second audit complet (tous les fichiers server + client + config + PWA). Corrections, accessibilité, nouvelles features UX, optimisations techniques et ops.

---

### Lot 1 — Sécurité & robustesse (critique)

**Étape 1 : Guard token par défaut dans sync.js**
`server/routes/sync.js` — le middleware `adminOnly` ne vérifie pas si `ADMIN_TOKEN` vaut le placeholder `change_this_before_deploy`. Contrairement à `admin.js` qui bloque ce cas, `sync.js` accepte n'importe quel token si la variable env n'est pas changée.
→ Ajouter la même vérification que dans `admin.js` : refuser si `!expected || expected === 'change_this_before_deploy'`.

**Étape 2 : Timeout sur les fetch() vers APIs externes**
`server/services/footballData.js` et `apiFootball.js` — les appels `fetch()` n'ont aucun timeout. Si l'API externe ne répond pas, le thread reste bloqué indéfiniment.
→ Ajouter `AbortSignal.timeout(30_000)` sur chaque fetch.

**Étape 3 : Validation scores dans admin PATCH**
`server/routes/admin.js` — `score_reel_a` et `score_reel_b` ne sont pas validés. Accepte négatifs, flottants, valeurs >99.
→ Ajouter la même validation que dans `pronos.js` : entiers 0-99.

**Étape 4 : Fix memory leak MatchCard**
`client/src/components/MatchCard.jsx` — les timers `debounceRef` et `savedTimerRef` ne sont pas nettoyés au unmount. Si l'user change d'onglet pendant le debounce, `setState` tourne sur un composant démonté.
→ Ajouter un `useEffect` cleanup qui `clearTimeout` les deux refs.

**Étape 5 : Try-catch localStorage**
`client/src/App.jsx` — `localStorage.getItem()` est appelé directement dans les initialiseurs de `useState`. En navigation privée (Safari), ça peut throw.
→ Wrapper dans un try-catch avec fallback sur les valeurs par défaut.

---

### Lot 2 — Accessibilité (haute priorité)

**Étape 6 : Focus styles sur inputs et boutons**
Plusieurs composants utilisent `focus:outline-none` sans alternative. Les utilisateurs clavier ne voient pas quel élément est sélectionné.
→ Remplacer par `focus:outline-none focus:ring-2 focus:ring-blue-500` sur les inputs score, boutons du header, navbar, et modales.

**Étape 7 : Focus trap + aria sur les modales**
`AboutModal` (Header.jsx) et `LegalModal.jsx` — pas de `role="dialog"`, pas de `aria-modal="true"`, pas de focus trap. Le tab peut sortir de la modale ouverte.
→ Ajouter les attributs ARIA + focus trap au clavier (écouter Tab et piéger dans la modale).

**Étape 8 : Indicateurs non-couleur pour les résultats**
`MatchCardPasse` utilise uniquement la couleur de bordure (vert/bleu/rouge) pour indiquer le résultat. Les daltoniens ne distinguent pas.
→ Ajouter une icône ou un label texte dans le badge points : ✓ exact, ≈ bonne issue, ✗ raté.

---

### Lot 3 — Nouvelles features UX (moyenne priorité)

**Étape 9 : Prono du jour mis en avant**
Dans la liste "À venir", mettre en évidence le prochain match sans prono de l'user (le plus proche dans le temps). Badge "Prochain !" / "Next!" sur la card + léger surlignage.
→ Filtrer côté client le premier match `a_venir` sans `score_predit_a` et ajouter une prop `highlight` à la card.

**Étape 10 : Countdown dynamique sur les cards à venir**
Quand un match est à moins de 24h, remplacer la date statique ("15 JUN · 21:00") par un compte à rebours ("dans 2h30" / "in 2h30"). Crée de l'urgence naturelle.
→ Timer `setInterval(60_000)` dans `MatchCardAvenir` + logique conditionnelle < 24h.

**Étape 11 : Transition fluide entre onglets**
Actuellement fade simple entre les pages. Passer à un slide horizontal (gauche/droite selon la direction de navigation) pour un feeling plus natif.
→ CSS transform + transition sur le conteneur, direction passée via l'état `page` dans `App.jsx`.

**Étape 12 : Haptic feedback**
Ajouter `navigator.vibrate(10)` sur les taps importants : boutons navbar, validation score, toggle langue/thème. Feedback physique satisfaisant sur mobile, ignoré silencieusement sur desktop.
→ Helper `vibrate()` avec guard `navigator.vibrate?.()`.

---

### Lot 4 — Performance technique (moyenne priorité)

**Étape 13 : Optimistic UI pour les pronos**
Actuellement le score est envoyé au serveur puis on attend la réponse. L'user ne voit rien pendant 200-600ms.
→ Afficher immédiatement la valeur saisie dans l'UI, envoyer en background, rollback si erreur. L'app semble instantanée.

**Étape 14 : Cache DiceBear dans le Service Worker**
Les avatars DiceBear sont re-téléchargés à chaque rendu du profil ou de la card de partage. Si l'API DiceBear est down, pas d'avatar.
→ Ajouter une règle Workbox `CacheFirst` pour `api.dicebear.com` avec TTL 30 jours.

**Étape 15 : Backoff exponentiel sur APIs externes**
Si football-data.org ou API-Football retourne une erreur, le polling continue au même rythme (3-10 min). Peut se faire rate-limit.
→ Compteur d'échecs consécutifs, backoff ×2 à chaque erreur (max 30 min), reset au premier succès.

**Étape 16 : Optimiser requête push notifications**
`pushNotifications.js` — le `CROSS JOIN` entre `matchs` et `push_subscriptions` crée un produit cartésien N×M. Avec 72 matchs et 1000 users ça fait 72000 lignes scannées.
→ Filtrer d'abord les matchs dans la fenêtre horaire (sous-requête), puis joindre les subscriptions. Résultat identique, scan réduit.

---

### Lot 5 — Ops & finitions (basse priorité)

**Étape 17 : Logging admin actions**
`server/routes/admin.js` — les actions admin (modification score, recalcul, reset) ne sont pas loggées. Pas de trace d'audit.
→ Ajouter `logger.info()` après chaque opération PATCH avec l'action, le match_id et l'IP.

**Étape 18 : Auto-backup SQLite**
Aucun backup automatique de la base de données. Si le volume Fly.io est corrompu, tout est perdu.
→ Script `server/backup.js` qui fait un `.backup()` SQLite vers un fichier horodaté. Déclenché via `fly ssh console -C "node backup.js"` ou cron Fly.io.

**Étape 19 : CORS fail-safe en prod**
`server/index.js` — si `CORS_ORIGIN` n'est pas configuré, CORS est ouvert à `*`. Pas de garde en production.
→ Si `NODE_ENV=production` et `CORS_ORIGIN` absent/vide, logger un warning et refuser les requêtes cross-origin.

**Étape 20 : Mettre à jour l'email de contact**
`client/src/components/LegalModal.jsx` ligne 5 — placeholder `contact@score26.fr` toujours en place.
→ Remplacer par l'adresse réelle une fois le domaine acheté.

---

### Résumé par priorité

| Lot | Nom | Étapes | Priorité |
|-----|-----|--------|----------|
| 1 | Sécurité & robustesse | 1–5 | Critique — avant le Play Store |
| 2 | Accessibilité | 6–8 | Haute — exigence Play Store |
| 3 | Nouvelles features UX | 9–12 | Moyenne — différenciation |
| 4 | Performance technique | 13–16 | Moyenne — qualité perçue |
| 5 | Ops & finitions | 17–20 | Basse — confort ops |

**Suivant :** Lot 1 — Étape 1 : Guard token sync.js

---

## 2026-03-28 — v3.1 Lot 1 : Sécurité & robustesse (étapes 1–5)

**Fait :**
- **Étape 1** : Guard token par défaut dans `sync.js` — aligné sur `admin.js` : refuse si `ADMIN_TOKEN` vaut `change_this_before_deploy` ou est absent. Log warn avec IP.
- **Étape 2** : Timeout 30s sur les `fetch()` vers football-data.org et API-Football via `AbortSignal.timeout(30_000)`.
- **Étape 3** : Validation scores admin PATCH — entiers 0-99 obligatoires, statut limité à `a_venir`/`en_cours`/`termine`. Utilise les valeurs parsées (pas les brutes du body).
- **Étape 4** : Fix memory leak MatchCard — `useEffect` cleanup qui `clearTimeout` les `debounceRef` et `savedTimerRef` au démontage.
- **Étape 5** : Helpers `lsGet`/`lsSet` avec try-catch dans `App.jsx` — protège contre le throw en navigation privée Safari.

**Fichiers :** `routes/sync.js`, `services/footballData.js`, `services/apiFootball.js`, `routes/admin.js`, `MatchCard.jsx`, `App.jsx`

**Résultat :** 29/29 tests backend, build frontend clean.

---

## 2026-03-28 — v3.1 Lot 2 : Accessibilité (étapes 6–8)

**Fait :**
- **Étape 6** : `focus-visible:ring-2 ring-blue-500` sur tous les boutons (Header, Navbar, Profil, Onboarding, LegalModal) et inputs score. `focus-visible` au lieu de `focus` pour ne pas gêner les taps mobile.
- **Étape 7** : Hook `useFocusTrap` partagé (Header.jsx) + focus trap inline (LegalModal.jsx). `role="dialog"`, `aria-modal="true"`, `aria-label` bilingue. Fermeture Escape, Tab piégé dans la modale.
- **Étape 8** : Icônes dans le badge résultat : 🎯 (exact), ✅ (bonne issue), ❌ (raté), — (neutre). Les daltoniens distinguent le résultat sans la couleur.

**Fichiers :** `Header.jsx`, `Navbar.jsx`, `MatchCard.jsx`, `Profil.jsx`, `Onboarding.jsx`, `LegalModal.jsx`

**Résultat :** Build frontend clean.

---

## 2026-03-28 — v3.1 Lot 3 : Nouvelles features UX (étapes 9–12)

**Fait :**
- **Étape 9** : Prono du jour — le premier match `a_venir` sans prono (trié par date) reçoit un `ring-2 ring-blue-500/50` + badge "Prochain"/"Next". Calcul côté client dans `MatchsAvenir.jsx`.
- **Étape 10** : Countdown dynamique — composant `DateOrCountdown` : si match à <24h, affiche "dans 2h30"/"in 2h30" avec refresh `setInterval(60_000)`. Sinon date statique classique.
- **Étape 11** : Slide horizontal entre onglets — `slideFromLeft`/`slideFromRight` CSS. Direction calculée via ordre des pages (avenir=0, passes=1, profil=2). `overflow-hidden` sur le main.
- **Étape 12** : Haptic feedback — `navigator.vibrate?.(10)` sur navbar, toggles langue/thème, bouton info, confirmation sauvegarde prono. Ignoré silencieusement sur desktop.

**Fichiers :** `MatchsAvenir.jsx`, `MatchCard.jsx`, `index.css`, `App.jsx`, `Navbar.jsx`, `Header.jsx`

**Résultat :** 29/29 tests, build clean.

---

## 2026-03-29 — v3.1 Lot 4 : Performance technique (étapes 13–16)

**Fait :**
- **Étape 13** : Optimistic UI — 3 états visuels (saving=bleu, ok=vert, error=rouge). Flash "saving" dès l'envoi, rollback aux valeurs précédentes (`prevScoreRef`) si erreur API. Détecte aussi les erreurs retournées par `handleResponse`.
- **Étape 14** : Cache DiceBear — règle Workbox `CacheFirst` pour `api.dicebear.com`, cache `dicebear-avatars`, TTL 30 jours, max 200 entrées. Avatars fonctionnent offline.
- **Étape 15** : Backoff exponentiel — `pollWithBackoff()` remplace les `setInterval` pour sync résultats, sync live et push. Délai ×2 à chaque erreur consécutive (max 30min), reset au succès. Log `nextRetryMs`.
- **Étape 16** : Requête push optimisée — sous-requête filtre les matchs dans la fenêtre 55-65min d'abord (0-3 matchs), puis `JOIN` subscriptions. Plus de produit cartésien 72×N.

**Fichiers :** `MatchCard.jsx`, `vite.config.js`, `index.js`, `pushNotifications.js`

**Résultat :** 29/29 tests, build clean.

---

## 2026-03-29 — v3.1 Lot 5 : Ops & finitions (étapes 17–20)

**Fait :**
- **Étape 17** : Logging admin actions — `logger.info()` après chaque opération PATCH (statut, score, recalcul, reset) avec IP, match_id et action. Trace d'audit complète.
- **Étape 18** : Script `server/backup.js` — utilise `db.backup()` de better-sqlite3 pour copier atomiquement la base vers un fichier horodaté (`score26-backup-2026-03-29T14-30-00.db`). Usage : `fly ssh console -C "node backup.js"`.
- **Étape 19** : CORS fail-safe — en production (`NODE_ENV=production`) sans `CORS_ORIGIN` configuré, les requêtes cross-origin sont refusées (`origin: false`) + warning loggé. En dev, toujours ouvert (`*`).
- **Étape 20** : Email de contact mis à jour — `score26officiel@gmail.com` dans `LegalModal.jsx` (remplace le placeholder) et dans le fallback VAPID de `pushNotifications.js`.

**Fichiers :** `routes/admin.js`, `backup.js` (nouveau), `index.js`, `LegalModal.jsx`, `pushNotifications.js`

**Résultat :** 29/29 tests, build clean.

**v3.1 complète — 20 étapes, 5 lots terminés.**

---

## 2026-03-29 — Scope v3.2 : Polish final & résilience

Dernières améliorations avant le lancement. Focus sur la robustesse, l'expérience utilisateur et la performance réseau.

---

### Lot 1 — Robustesse technique (haute priorité)

**Étape 1 : Error boundary React**
Si un composant crash (erreur JS inattendue), toute l'app devient un écran blanc. L'user ne peut rien faire à part recharger manuellement — et il ne sait même pas qu'il doit le faire.
→ Créer un composant `ErrorBoundary` (class component, seul moyen en React) qui catch les erreurs de rendu et affiche un fallback "Oups, quelque chose s'est mal passé" avec un bouton "Recharger". Wrapper l'app dans `main.jsx`.

**Étape 2 : Compression réponses API**
Les réponses JSON du serveur ne sont pas compressées. Sur mobile 3G, la liste des 72 matchs (avec pronos) peut peser lourd.
→ `npm install compression` + `app.use(compression())` dans `index.js`, avant les routes. Réduit la taille des réponses de ~60% (gzip automatique).

**Étape 3 : Tests admin et sync**
Les routes `/api/admin` et `/api/sync` ne sont pas couvertes par les tests. Pas de filet de sécurité si on modifie le scoring admin ou la validation.
→ `tests/admin.test.js` : PATCH score valide, PATCH score invalide (>99, négatif), PATCH statut invalide, token manquant → 401, reset match, recalcul.
→ `tests/sync.test.js` : token manquant → 401, token par défaut refusé, GET status retourne les compteurs.

---

### Lot 2 — UX & engagement (moyenne priorité)

**Étape 4 : Confetti score exact (au tap)**
Quand un match passé a un score exact (50 pts), l'user peut taper sur la card pour déclencher une micro-animation confetti. Pas automatique au chargement de la page (sinon ça spamme à chaque visite).
→ `npm install canvas-confetti` (~3KB gzip). Au tap sur une `MatchCardPasse` avec `resultat === 'exact'`, déclencher `confetti()` depuis le point de clic. Un seul tir par card par session (flag `useRef`).

**Étape 5 : Onboarding guidé**
Les nouveaux users ne comprennent pas immédiatement les inputs dashed "0 — 0" sur les cards. Ils tapent partout sauf au bon endroit.
→ Au premier lancement (flag `score26_onboarded` dans localStorage), afficher un overlay semi-transparent avec une flèche pointant sur le premier input score et un texte "Tape ton score ici" / "Enter your score here". Disparaît au premier tap n'importe où. Pas de librairie externe, juste un composant `OnboardingTip.jsx` conditionnel.

---

### Lot 3 — Performance & résilience (basse priorité)

**Étape 6 : Prefetch intelligent**
Quand l'user est sur "À venir", les données "Passés" ne sont pas encore chargées. Le changement d'onglet montre un spinner.
→ Prefetch silencieux des données `getMatchs()` au montage de l'app (une seule fois), stocker dans un state partagé via `App.jsx`. Les pages enfants consomment les données déjà chargées au lieu de refaire un fetch.

**Étape 7 : Fallback avatar DiceBear**
Si le CDN DiceBear est down et que le cache SW est vide (nouvel user, cache purgé), l'avatar affiche une image cassée.
→ Ajouter `onError` sur le `<img>` du profil et de la card de partage : remplacer par un cercle coloré avec les initiales du pseudo (2 premières lettres). Couleur dérivée du hash du pseudo.

**Étape 8 : Métriques basiques dans les logs**
Aucune visibilité sur l'activité de l'app : combien d'users, combien de pronos par jour, combien de push envoyées.
→ Job périodique (toutes les heures) dans `index.js` qui log un résumé : `{ users: 142, pronos_today: 87, matchs_en_cours: 1, push_subs: 98 }`. Visible dans `fly logs` sans outil externe.

---

### Résumé par priorité

| Lot | Nom | Étapes | Priorité |
|-----|-----|--------|----------|
| 1 | Robustesse technique | 1–3 | Haute — filet de sécurité |
| 2 | UX & engagement | 4–5 | Moyenne — différenciation |
| 3 | Performance & résilience | 6–8 | Basse — confort & visibilité |

**Suivant :** Lot 1 — Étape 1 : Error boundary React

---

## 2026-03-28 — v3.2 Lot 1 : Robustesse technique (étapes 1–3)

### Étape 1 : Error boundary React
**Fait :** Création d'un composant `ErrorBoundary` (class component, seul moyen de capter `componentDidCatch`). Attrape toute erreur React non gérée et affiche un écran de fallback bilingue FR/EN avec bouton "Recharger". Intégré dans `main.jsx` autour de `<App />` et `<Admin />`.
**Fichiers :** `client/src/components/ErrorBoundary.jsx` (créé), `client/src/main.jsx` (modifié)
**Décisions :** Pas de librairie (react-error-boundary), le composant natif suffit. La page 404 (`NotFound`) reste hors ErrorBoundary car elle ne peut pas planter.

### Étape 2 : Compression réponses API
**Fait :** Ajout du middleware `compression` (gzip/brotli) sur le serveur Express. Toutes les réponses JSON sont compressées automatiquement, réduisant la taille des payloads réseau (~70% de réduction sur les réponses matchs).
**Fichiers :** `server/index.js` (ajout `require('compression')` + `app.use(compression())`)
**Décisions :** Placé après `helmet()` et avant CORS/routes pour couvrir toutes les réponses.

### Étape 3 : Tests admin et sync
**Fait :** 19 nouveaux tests couvrant les routes `/api/admin/*` et `/api/sync/*` :
- **admin (13 tests)** : middleware checkToken (sans token, mauvais token, token par défaut, bon token query/header), validation PATCH (scores lettres/négatifs/>99, statut invalide, match 404), opérations PATCH (changement statut, saisie score + calcul points, reset)
- **sync (6 tests)** : middleware adminOnly (même pattern), GET /status (compteurs), POST /calendrier et /resultats (appels mockés)
- Total suite de tests : 48 tests, 0 fail
**Fichiers :** `server/tests/admin.test.js` (créé), `server/tests/sync.test.js` (créé), `server/package.json` (script test mis à jour)
**Décisions :** Mock du logger (silencieux) et de footballData (évite les appels réseau). Même pattern que les tests existants (BDD in-memory, injection via require.cache).

---

## 2026-03-28 — v3.2 Lot 2 : UX & engagement (étapes 4–5)

### Étape 4 : Confetti score exact (au tap)
**Fait :** Au tap sur une card "match passé" avec score exact (🎯 50 pts), un tir de confetti explose depuis le point de clic. Un seul tir par card par session (flag `useRef`). Respecte `disableForReducedMotion` pour l'accessibilité. Haptic feedback (`navigator.vibrate(15)`).
**Fichiers :** `client/src/components/MatchCard.jsx` (ajout import `canvas-confetti`, logique `handleClick` + `firedRef` dans `MatchCardPasse`)
**Décisions :** `canvas-confetti` (~3KB gzip), pas de lib plus lourde. Déclenché au tap (pas au chargement de page) pour éviter le spam à chaque visite sur "matchs passés". Cursor pointer uniquement sur les cards exact.

### Étape 5 : Onboarding guidé
**Fait :** Overlay semi-transparent au premier lancement avec flèche animée pointant sur les inputs score + faux inputs pour montrer le geste. Bilingue FR/EN. Disparaît au premier tap n'importe où. Flag `score26_onboarded` dans localStorage pour ne l'afficher qu'une seule fois.
**Fichiers :** `client/src/components/OnboardingTip.jsx` (créé), `client/src/pages/MatchsAvenir.jsx` (intégration), `client/src/index.css` (animation `animate-fade-in`)
**Décisions :** Pas de librairie externe (pas de react-joyride). SafeStorage avec try-catch (Safari private browsing). Overlay positionné au centre de l'écran (pas ancré sur un input spécifique) pour rester simple et fiable.

---

## 2026-03-28 — v3.2 Lot 3 : Performance & résilience (étapes 6–8)

### Étape 6 : Prefetch intelligent
**Fait :** Au montage de `App.jsx`, un appel `getMatchs(userId)` prefetch toutes les données matchs et les stocke dans `prefetchedMatchs`. Les pages `MatchsAvenir` et `MatchsPasses` reçoivent ces données en `initialData` et les utilisent pour le premier rendu (pas de spinner). Les refreshes suivants (polling, pull-to-refresh) continuent de fetcher normalement.
**Fichiers :** `client/src/App.jsx` (ajout prefetch + prop `initialData`), `client/src/pages/MatchsAvenir.jsx` (accepte `initialData`, logique `applyData` extraite), `client/src/pages/MatchsPasses.jsx` (même pattern)
**Décisions :** Un seul appel API au montage, partagé entre les deux pages. Pas de cache complexe, juste un state dans App. Le prefetch ne bloque pas — si la réponse arrive après le changement d'onglet, la page fait son propre fetch.

### Étape 7 : Fallback avatar DiceBear
**Fait :** Composant `AvatarFallback` : affiche l'image DiceBear normalement, et si le CDN est down (`onError`), bascule vers un cercle coloré avec les 2 premières lettres du pseudo. Couleur déterministe via un hash du pseudo (même pseudo = même couleur, toujours).
**Fichiers :** `client/src/components/AvatarFallback.jsx` (créé), `client/src/pages/Profil.jsx` (remplace `<img>` par `<AvatarFallback>`)
**Décisions :** La ShareCard (html2canvas) garde un `<img>` brut car le fallback React ne fonctionne pas dans le contexte de capture canvas. Le fallback utilise 10 couleurs vives pour une bonne lisibilité dark/light.

### Étape 8 : Métriques basiques dans les logs
**Fait :** Job `setInterval` toutes les heures dans `lancerPolling()` qui log un résumé structuré : nombre d'users, total de pronos, matchs en cours, matchs terminés, abonnements push. Visible dans `fly logs` sans outil externe.
**Fichiers :** `server/index.js` (ajout bloc `[metrics]` dans `lancerPolling`)
**Décisions :** Compteurs simples via `COUNT(*)` SQLite. Pas de colonne `created_at` sur pronos → on log le total plutôt que "pronos des 24h". 5 requêtes légères, exécutées une fois par heure → impact négligeable.

**v3.2 terminée.** 48 tests backend, 0 fail. Build frontend OK.

---

## 2026-03-29 — Préparation Play Store

### Page Politique de confidentialité (URL directe)
**Fait :** Page HTML statique bilingue FR/EN créée dans `client/public/privacy.html`. Accessible directement à `score26.vercel.app/privacy.html` sans passer par React. Contenu identique à la modale `LegalModal.jsx`. Les deux versions (FR + EN) sont sur la même page avec liens d'ancrage pour naviguer entre elles.
**Fichiers :** `client/public/privacy.html` (créé)
**Décisions :**
- Fichier HTML statique plutôt que route React : pas d'interférence avec le SPA, chargement instantané, pas de dépendance JS
- Style dark sobre inline (pas de Tailwind) : la page doit fonctionner indépendamment du build React
- Pas de lien vers cette page dans l'app (demande user) : accessible uniquement via URL directe, destinée au champ "Privacy Policy URL" du Play Store
- La modale in-app `LegalModal.jsx` reste en place pour les users qui y accèdent depuis le profil

**Suivant :** assetlinks.json, config Bubblewrap/TWA, feature graphic Play Store
