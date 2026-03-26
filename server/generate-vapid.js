// Script one-shot — génère les clés VAPID pour les notifications push
// Usage : node generate-vapid.js
// Colle ensuite les deux lignes dans server/.env

const webPush = require('web-push')
const keys = webPush.generateVAPIDKeys()

console.log('\nColle ces lignes dans server/.env :\n')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('\n⚠  Ne génère ces clés qu\'une seule fois — les subscriptions existantes deviendraient invalides.\n')
