/* Sōzō — service worker : notifications d'appareil (Web Push) et, depuis le
   21/10/2026 (lot D), l'application installable qui s'ouvre et se lit HORS LIGNE.

   La règle d'avant tient toujours : une page protégée ne doit jamais être
   servie depuis un cache à quelqu'un qui n'y a plus droit (appareil partagé,
   remboursement). La lecture hors ligne est donc bornée :
   · l'enveloppe de l'application (pages, styles, scripts, polices, Bible) est
     publique : elle se met en cache comme n'importe quel site ;
   · les données personnelles (« qui suis-je », le catalogue, le texte d'une
     page lue) ne sont gardées QUE pour le compte qui les a lues, dans un cache
     à son nom (`sozo-u<id>`), et servies SEULEMENT quand le réseau manque —
     en ligne, c'est toujours le serveur qui répond (et décide) ;
   · une page que le serveur refuse (401, 402, 403, 404) est aussitôt retirée ;
   · la déconnexion, ou l'arrivée d'un autre compte, vide les caches personnels.
   Rien d'autre (paiements, studio, administration) n'est jamais mis en cache. */
const VERSION = 'sozo-v1';
const ENVELOPPE = `${VERSION}-enveloppe`;
let compte = null;                                   // annoncé par la page : « je suis u12 »

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(ENVELOPPE).then((c) => c.addAll(['/app/hors-ligne.html', '/favicon.svg']).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('sozo-v') && !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

// Le navigateur endort le service worker : le compte annoncé est gardé dans le cache
const ETAT = `${VERSION}-etat`;
const poserCompte = async (id) => { const c = await caches.open(ETAT); if (id) await c.put('/__compte', new Response(id)); else await c.delete('/__compte'); };
const lireCompte = async () => { if (compte) return compte; const r = await (await caches.open(ETAT)).match('/__compte'); compte = r ? await r.text() : null; return compte; };
const viderPersonnels = (sauf) => caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('sozo-u') && k !== sauf).map((k) => caches.delete(k))));
self.addEventListener('message', (e) => {
  if (e.origin && e.origin !== self.location.origin) return;
  const d = e.data || {};
  if (d.type === 'compte' && /^u\d+$/.test(d.id || '')) { compte = d.id; e.waitUntil(Promise.all([poserCompte(compte), viderPersonnels(`sozo-${compte}`)])); }
  if (d.type === 'deconnexion') { compte = null; e.waitUntil(Promise.all([poserCompte(null), viderPersonnels(null)])); }
});

const PERSONNEL = [/^\/api\/moi$/, /^\/api\/catalogue$/, /^\/api\/livres\/[^/]+\/pages\/\d+$/];
const STATIQUE = /\.(?:css|js|woff2|svg|png|json|txt|html)$/;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // données personnelles : le réseau d'abord ; le cache du compte seulement hors ligne
  if (PERSONNEL.some((r) => r.test(url.pathname))) {
    e.respondWith(lireCompte().then((id) => (id ? personnel(req, `sozo-${id}`) : fetch(req))));
    return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;     // jamais en cache
  // l'enveloppe : le réseau d'abord (les mises à jour arrivent), la copie hors ligne sinon
  if (url.pathname.startsWith('/app/') || url.pathname.startsWith('/assets/') || STATIQUE.test(url.pathname)) {
    e.respondWith(fetch(req).then(async (rep) => {
      if (rep.ok && rep.type === 'basic') (await caches.open(ENVELOPPE)).put(req, rep.clone());
      return rep;
    }).catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' ? caches.match('/app/hors-ligne.html') : Response.error())));
  }
});
function personnel(req, nom) {
  return fetch(req).then(async (rep) => {
      const c = await caches.open(nom);
      if (rep.ok) await c.put(req, rep.clone());
      else if ([401, 402, 403, 404].includes(rep.status)) await c.delete(req);
      return rep;
  }).catch(async () => (await (await caches.open(nom)).match(req)) || new Response(JSON.stringify({ erreur: 'Hors ligne : cette page n’a pas encore été lue sur cet appareil.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Sōzō', {
    body: d.corps || '', lang: 'fr', tag: d.id ? 'sozo-' + d.id : undefined,
    icon: '/assets/icone-192.png', badge: '/assets/icone-192.png', data: { lien: d.lien || '/app/decouvrir.html' }
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
