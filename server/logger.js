const pino = require('pino')

// En dev : sortie lisible et colorée via pino-pretty
// En prod : JSON brut (géré par la plateforme de déploiement)
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
})

module.exports = logger
