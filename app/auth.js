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
    try { if (m) sessionStorage.setItem(CACHE, JSON.stringify(m)); else sessionStorage.removeItem(CACHE); } catch (e) {}
  }
  function csrf() { var m = document.cookie.match(/(?:^|; )sozo_csrf=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }
  function versConnexion() { location.replace('connexion.html?suite=' + encodeURIComponent(page + location.search + location.hash)); }
  var moi = lire();
  if (moi) moi.name = moi.nom;

  window.SozoAuth = {
    session: moi,
    csrf: csrf,
    garder: garder,
    close: function () {
      fetch('/api/sessions/courante', { method: 'DELETE', headers: { 'X-CSRF-Token': csrf() }, credentials: 'same-origin' })
        .catch(function () {})
        .then(function () { garder(null); location.href = 'connexion.html'; });
    }
  };
  if (page === 'connexion.html') return;

  // Sans profil connu, on n'affiche rien avant la réponse du serveur.
  if (!moi) document.documentElement.style.visibility = 'hidden';
  fetch('/api/moi', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) {
      if (r.status === 401) { garder(null); versConnexion(); return null; }
      if (!r.ok) throw new Error('serveur');
      return r.json();
    })
    .then(function (d) {
      if (!d) return;
      var avant = !!moi;
      garder(d.moi);
      if (!avant) location.reload();          // première visite de l'onglet : on affiche avec le profil
    })
    .catch(function () { if (!moi) versConnexion(); });
})();
