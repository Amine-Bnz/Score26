const crypto = require('crypto');
const logger = require('../logger');

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET est requis en production. Définir la variable d\'environnement JWT_SECRET.');
  }
  logger.warn('JWT_SECRET non défini — secret aléatoire généré (tokens invalides au redémarrage)');
}

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES = '30d';

module.exports = { JWT_SECRET, JWT_EXPIRES };
