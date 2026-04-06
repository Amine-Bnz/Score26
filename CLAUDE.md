# Score26 — Technical Core

## Stack
- **Frontend:** React, Vite, Tailwind, `vite-plugin-pwa`
- **Backend:** Node, Express, `better-sqlite3`
- **Auth:** UUID (localStorage) + optional email/password (bcrypt + JWT)
- **Services:** DiceBear (Avatar), `web-push` (VAPID), `html2canvas` (Share), `bcryptjs`, `jsonwebtoken`

## Schema (SQLite)
- **users:** `id` (UUID), `pseudo` (1-20 chars, regex alphanum), `avatar_seed`, `friend_code` (6 chars unique), `email` (optional), `password_hash` (optional, bcrypt)
- **matchs:** `id`, `equipe_a/b`, `date_coup_envoi`, `score_reel_a/b`, `phase`, `statut` (a_venir/en_cours/termine), `api_id`, `score_live_a/b`, `minute_live`
- **pronos:** `id`, `user_id`, `match_id`, `score_predit_a/b`, `points_obtenus`, `verrouille` (bool)
- **push_subs:** `user_id`, `endpoint`, `keys`
- **friendships:** `user_id`, `friend_id` (bidirectional)
- **groups_:** `id`, `name`, `invite_code`, `owner_id`
- **group_members:** `group_id`, `user_id`
- **notifs_resultats:** `user_id`, `match_id` (track sent result notifications)

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