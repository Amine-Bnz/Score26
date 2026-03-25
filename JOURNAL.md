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

### Prochaine étape
Test end-to-end + bouton partager (html2canvas)
