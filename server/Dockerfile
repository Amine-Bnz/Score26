FROM node:20-slim

# Outils nécessaires pour compiler better-sqlite3 (module natif C++)
RUN apt-get update -qq && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer les dépendances en premier (couche cachée si package.json ne change pas)
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le reste du code
COPY . .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "index.js"]
