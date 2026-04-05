# Score26 — Technical Core

## Stack
- **Frontend:** React, Vite, Tailwind, `vite-plugin-pwa`
- **Backend:** Node, Express, `better-sqlite3`
- **Auth:** UUID (localStorage) lié au Pseudo (Unique)
- **Services:** DiceBear (Avatar), `web-push` (VAPID), `html2canvas` (Share)

## Schema (SQLite)
- **users:** `id` (UUID), `pseudo` (3-20 chars, regex alphanum), `avatar_seed`, `avatar_style`
- **matchs:** `id`, `equipe_a/b`, `date_coup_envoi`, `score_reel_a/b`, `phase`, `statut` (a_venir/en_cours/termine), `api_id`
- **pronos:** `id`, `user_id`, `match_id`, `score_predit_a/b`, `points_obtenus`, `verrouille` (bool)
- **push_subs:** `user_id`, `endpoint`, `keys`

## Business Rules
- **Scoring:** Exact=50pts | Issue=20pts | Faux=0. Total = points × (1 / ratio_users_meme_prono)
- **Verrouillage:** Automatique au coup d'envoi
- **Live:** Poll API toutes les 3 min si match `en_cours`
- **Admin:** `/admin?token=SECRET` pour gestion manuelle
- **Ranking:** Top 100 par score total

## Constraints
- **Offline:** Banner "Offline", bloquer saves, `NetworkOnly` pour `/api/`
- **PWA:** Icônes PNG obligatoires (192/512 + Maskable)
- **Security:** `helmet`, `rate-limit` (5/15min sur /users), `pino` logs
- **Tests:** Node runner natif sur scoring/routes (DB in-memory)