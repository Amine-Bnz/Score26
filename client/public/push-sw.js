// Gestionnaire de notifications push — importé par le service worker principal
// Ce fichier est servi tel quel depuis /push-sw.js

// Réception d'une notification push depuis le serveur
self.addEventListener('push', event => {
  if (!event.data) return

  let payload
  try { payload = event.data.json() }
  catch { payload = { title: 'Score26', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Score26', {
      body:  payload.body  ?? '',
      icon:  '/icon.svg',
      badge: '/icon.svg',
      tag:   'score26-notif',       // remplace les notifs précédentes (pas de spam)
      renotify: false,
    })
  )
})

// Clic sur la notification → ouvre ou ramène l'app au premier plan
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si une fenêtre de l'app est déjà ouverte, la focus
      if (list.length > 0) return list[0].focus()
      // Sinon, ouvrir l'app
      return clients.openWindow('/')
    })
  )
})
