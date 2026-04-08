# Stage 1 : build du client React
FROM node:20-slim AS client-build
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2 : serveur Express
FROM node:20-slim

# Outils nécessaires pour compiler better-sqlite3 (module natif C++)
RUN apt-get update -qq && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer les dépendances en premier (couche cachée si package.json ne change pas)
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copier le reste du code serveur
COPY server/ .

# Copier le build client dans public/ (servi par express.static)
COPY --from=client-build /client/dist ./public

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "index.js"]
