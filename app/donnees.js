/* ═══════════════════════════════════════════════════════════
   Sōzō — les données de l'application viennent du SERVEUR.
   Un seul appel (/api/catalogue) apporte tout ce que la personne peut voir :
   livres, état de chaque page POUR ELLE (calculé par le serveur), auteurs,
   suivis, progression, achats. Le texte des pages, lui, n'arrive qu'une page
   à la fois, et seulement si le serveur l'autorise (liseuse).

   Les écrans attendent `SOZO_PRET` avant de se construire.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var D = window.SOZO_DATA = {
    authors: {}, books: [], reader: { purchases: {}, follows: [], progress: {} }, texts: {},
    filler: ["La suite de cette page existe dans le manuscrit de l'auteur."],
    panels: ['couv-capuche', 'trail-fenetre', 'lecteur-penombre', 'couv-cafe-nuit', 'livres-fenetre', 'couv-fenetre', 'couv-spirale', 'lib-vieux-livres', 'couv-plafond'],
    bubbles: ['— Tu l’as vue ?', '— Personne ne la reconnaît.', 'Le vent se lève.', '— Ne te retourne pas.', 'Trois étages plus bas…', '— C’est elle.', 'La nuit recopie la ville.', '— Encore une fiche.', 'Silence.']
  };

  function csrf() { var m = document.cookie.match(/(?:^|; )sozo_csrf=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }

  /* Appel d'API : JSON, jeton CSRF sur toute mutation. Rend {ok, status, d}.
     Une coupure réseau rend une erreur lisible, jamais un faux succès. */
  window.SOZO_API = function (methode, url, corps, options) {
    var o = { method: methode, credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf() } };
    // keepalive : la requête part même si la page change aussitôt (clic sur un lien)
    if (options && options.keepalive) o.keepalive = true;
    // Toute mutation porte un corps JSON (exigé par le serveur, défense CSRF) : {} à défaut
    if (corps === undefined && methode !== 'GET') corps = {};
    if (corps instanceof FormData) o.body = corps;
    else if (corps !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(corps); }
    return fetch(url, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
    }).then(function (res) {
      // Lot E : publier ou commenter sans la charte → la montrer, puis rejouer
      // la demande UNE fois si elle est acceptée (le serveur reste seul juge).
      if (res.status === 403 && res.d && res.d.code === 'charte' && window.SOZO_CHARTE && !(options && options.sansCharte)) {
        return window.SOZO_CHARTE(res.d.version).then(function (ok) {
          return ok ? window.SOZO_API(methode, url, corps, Object.assign({}, options, { sansCharte: true })) : res;
        });
      }
      return res;
    }).catch(function () { return { ok: false, status: 0, d: { erreur: 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.' } }; });
  };

  window.SOZO_ERREUR = function (e) {
    var m = document.getElementById('main');
    if (m) m.innerHTML = '<div class="wrap sec"><div class="empty"><strong>Sōzō n’a pas pu se charger</strong>' +
      'Le serveur ne répond pas ou la connexion est coupée.<br><br><a class="btn" href="">Réessayer</a></div></div>';
    if (window.console) console.error(e);
  };

  var page = location.pathname.split('/').pop();
  /* Le serveur gratuit s'endort après 15 min : sa première réponse peut
     tarder ou échouer (502/503/504, coupure). On réessaie pendant ~70 s en
     le DISANT (« Sōzō se réveille… »), au lieu d'afficher une panne. */
  function catalogue(essai) {
    return fetch('/api/catalogue', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (r.status === 401) { return new Promise(function () {}); }   // auth.js part vers la connexion
      if ([502, 503, 504].indexOf(r.status) >= 0) throw { reveil: true, status: r.status };
      if (!r.ok) throw new Error('catalogue ' + r.status);
      return r.json();
    }).catch(function (e) {
      if (!(e && (e.reveil || e instanceof TypeError)) || essai >= 7) throw e;
      var m = document.getElementById('main');
      if (m && !m.querySelector('.sz-reveil')) m.innerHTML = '<div class="wrap sec"><div class="empty sz-reveil" role="status"><strong>Sōzō se réveille…</strong>' +
        'Le serveur était en veille. Encore quelques secondes, la page se charge toute seule.</div></div>';
      return new Promise(function (ok) { setTimeout(ok, 10000); }).then(function () { return catalogue(essai + 1); });
    });
  }
  window.SOZO_PRET = page === 'connexion.html' ? Promise.resolve() :
    catalogue(0).then(function (d) {
      D.authors = d.authors; D.books = d.books; D.reader = d.reader;
    });
})();
