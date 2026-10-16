/* Sōzō — service worker : reçoit les notifications d'appareil (Web Push).
   Il ne met RIEN en cache : une page protégée ne doit jamais être servie
   depuis un cache local à quelqu'un qui n'y a plus droit (compte partagé,
   remboursement). Il affiche la notification, et ouvre Sōzō au clic —
   uniquement vers une adresse de Sōzō. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Sōzō', {
    body: d.corps || '', lang: 'fr', tag: d.id ? 'sozo-' + d.id : undefined,
    icon: '/favicon.svg', badge: '/favicon.svg', data: { lien: d.lien || '/app/decouvrir.html' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.lien) || '/app/decouvrir.html', self.location.origin);
  if (url.origin !== self.location.origin) return;        // jamais vers un autre site
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if (c.url.startsWith(self.location.origin) && 'focus' in c) { c.navigate(url.href); return c.focus(); } }
    return self.clients.openWindow(url.href);
  }));
});
