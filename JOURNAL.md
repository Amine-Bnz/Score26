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

### Prochaine étape
Finalisation v1 : vérifications, .gitignore, README
