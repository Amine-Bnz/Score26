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

### Prochaine étape v2
Card "active" frontend — affichage live (score + minute + indicateur LIVE pulsé)
