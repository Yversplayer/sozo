/* ═══════════════════════════════════════════════════════════
   Sōzō — accès au logiciel réservé aux personnes connectées.
   Chargé dans <head> de chaque page de app/.

   La VRAIE décision est prise par le serveur : la session est un cookie
   HttpOnly que ce script ne peut même pas lire. Ici, on demande seulement
   au serveur « qui suis-je ? » (/api/moi) :
     · 401 → page de connexion, puis retour sur la page demandée ;
     · 200 → on garde le profil (nom, e-mail, rôle — rien de secret) le temps
       de l'onglet, pour afficher la page sans attendre la prochaine fois.
   Chaque appel d'API qui modifie quelque chose porte le jeton CSRF, lu dans
   le cookie prévu à cet effet.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var CACHE = 'sozo-moi';
  var page = location.pathname.split('/').pop() || '';
  function lire() { try { return JSON.parse(sessionStorage.getItem(CACHE)); } catch (e) { return null; } }
  function garder(m) {
    try { if (m) sessionStorage.setItem(CACHE, JSON.stringify(m)); else { sessionStorage.removeItem(CACHE); sessionStorage.removeItem('sozo-catalogue'); } } catch (e) {}
  }
  function csrf() { var m = document.cookie.match(/(?:^|; )sozo_csrf=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }
  function versConnexion() { location.replace('connexion.html?suite=' + encodeURIComponent(page + location.search + location.hash)); }
  var moi = lire();
  if (moi) moi.name = moi.nom;

  /* Application installable, lecture hors ligne (21/10/2026) : le service worker
     garde les données du compte À SON NOM ; on lui dit qui est connecté, et on
     vide ces caches à la déconnexion ou quand la session n'est plus valable. */
  function annoncer(m) {
    if (!m || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js', { scope: '/app/' })
      .then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) { if (reg && reg.active) reg.active.postMessage({ type: 'compte', id: 'u' + m.id }); })
      .catch(function () {});
  }
  function oublierCaches() {
    try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'deconnexion' }); } catch (e) {}
    if (!window.caches) return Promise.resolve();
    return caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('sozo-u') === 0 || /-etat$/.test(k); }).map(function (k) { return caches.delete(k); }));
    }).catch(function () {});
  }

  window.SozoAuth = {
    session: moi,
    csrf: csrf,
    garder: garder,
    close: function () {
      fetch('/api/sessions/courante', { method: 'DELETE', headers: { 'X-CSRF-Token': csrf() }, credentials: 'same-origin' })
        .catch(function () {})
        .then(oublierCaches)
        .then(function () { garder(null); location.href = 'connexion.html'; });
    }
  };
  if (page === 'connexion.html') return;
  annoncer(moi);

  // Sans profil connu, on n'affiche rien avant la réponse du serveur.
  if (!moi) document.documentElement.style.visibility = 'hidden';
  /* 08/11/2026 — « ça ne s'ouvrait pas ». Le serveur gratuit (Render) s'endort
     après 15 min ; à son réveil il ne renvoie PAS d'erreur : il garde la
     demande ~50 s. La page restant cachée, l'application paraissait morte, et
     le message de donnees.js, caché lui aussi, ne se voyait pas. Après 3 s
     d'attente, on montre donc « Sōzō se réveille… », seul élément visible de
     la page cachée ; il reste jusqu'au rechargement ou à la page de connexion. */
  var reveil = null, reveilFini = false, reveilMinuterie = null;
  function montrerReveil() {
    if (reveil || reveilFini) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', montrerReveil); return; }
    reveil = document.createElement('div');
    reveil.className = 'sz-reveil-ecran';
    reveil.setAttribute('role', 'status');
    reveil.innerHTML = '<span class="spin" aria-hidden="true"></span><strong>Sōzō se réveille…</strong>' +
      '<span>Encore quelques secondes : l’application s’ouvre toute seule dès que le serveur répond.</span>';
    document.body.appendChild(reveil);
  }
  // la réponse est là : l'écran ne doit plus apparaître (celui déjà montré reste jusqu'à la navigation)
  function reveilInutile() { reveilFini = true; clearTimeout(reveilMinuterie); }
  if (!moi) reveilMinuterie = setTimeout(montrerReveil, 3000);
  // Serveur en veille (offre gratuite) : 502/503/504 ou coupure → on réessaie
  // ~70 s au lieu d'envoyer la personne, connectée, vers la page de connexion.
  function demander(essai) {
    return fetch('/api/moi', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        if ([502, 503, 504].indexOf(r.status) >= 0) throw new TypeError('reveil');
        return r;
      })
      .catch(function (e) {
        if (!(e instanceof TypeError) || essai >= 7) throw e;
        return new Promise(function (ok) { setTimeout(ok, 10000); }).then(function () { return demander(essai + 1); });
      });
  }
  /* 08/11/2026 : une page préparée d'avance (onglet voisin) avec un profil
     connu ne redemande « qui suis-je ? » qu'au moment d'être montrée. */
  function verifier() { return demander(0)
    .then(function (r) {
      reveilInutile();
      if (r.status === 401) { garder(null); oublierCaches().then(versConnexion); return null; }
      if (!r.ok) throw new Error('serveur');
      return r.json();
    })
    .then(function (d) {
      if (!d) return;
      var avant = !!moi;
      garder(d.moi);
      annoncer(d.moi);
      // Le thème choisi dans Mon compte suit la personne d'un appareil à l'autre
      if (window.SozoTheme && d.moi && d.moi.theme) SozoTheme.set(d.moi.theme, { serveur: true });
      if (!avant) location.reload();          // première visite de l'onglet : on affiche avec le profil
    })
    .catch(function () { reveilInutile(); if (!moi) versConnexion(); }); }
  if (moi && document.prerendering) document.addEventListener('prerenderingchange', verifier, { once: true });
  else verifier();
})();
