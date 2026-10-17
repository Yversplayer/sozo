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
  demander(0)
    .then(function (r) {
      if (r.status === 401) { garder(null); versConnexion(); return null; }
      if (!r.ok) throw new Error('serveur');
      return r.json();
    })
    .then(function (d) {
      if (!d) return;
      var avant = !!moi;
      garder(d.moi);
      // Le thème choisi dans Mon compte suit la personne d'un appareil à l'autre
      if (window.SozoTheme && d.moi && d.moi.theme) SozoTheme.set(d.moi.theme);
      if (!avant) location.reload();          // première visite de l'onglet : on affiche avec le profil
    })
    .catch(function () { if (!moi) versConnexion(); });
})();
