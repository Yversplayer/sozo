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
      // une écriture réussie : la copie du catalogue n'est plus sûre (voir plus bas)
      if (res.ok && methode !== 'GET' && window.SOZO_CATALOGUE_PERIME) window.SOZO_CATALOGUE_PERIME();
      // Lot E : publier ou commenter sans la charte → la montrer, puis rejouer
      // la demande UNE fois si elle est acceptée (le serveur reste seul juge).
      // 22/10/2026 : une fonction réservée à Plume — une petite note dans un coin,
      // jamais un écran entier ; la réponse suit son cours chez l'appelant.
      if (res.status === 403 && res.d && (res.d.code === 'pro_requis' || res.d.code === 'plume_requis') && window.SOZO_AVIS_PRO) {
        window.SOZO_AVIS_PRO(res.d.erreur);
        res.d.avisPro = true;
      }
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
     le DISANT (« Sōzō se réveille… »), au lieu d'afficher une panne.
     08/11/2026 : le plus souvent, au réveil, Render ne renvoie AUCUNE erreur ;
     il garde la demande ~50 s. Le message n'apparaissait donc jamais : il est
     aussi montré après 3 s d'attente, et retiré dès la réponse. */
  function reveil() {
    var m = document.getElementById('main');
    if (m && !m.querySelector('.sz-reveil')) m.innerHTML = '<div class="wrap sec"><div class="empty sz-reveil" role="status"><strong>Sōzō se réveille…</strong>' +
      'Encore quelques secondes : la page s’ouvre toute seule dès que le serveur répond.</div></div>';
  }
  function catalogue(essai) {
    return fetch('/api/catalogue', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (r.status === 401) { return new Promise(function () {}); }   // auth.js part vers la connexion
      if ([502, 503, 504].indexOf(r.status) >= 0) throw { reveil: true, status: r.status };
      if (!r.ok) throw new Error('catalogue ' + r.status);
      return r.json();
    }).catch(function (e) {
      if (!(e && (e.reveil || e instanceof TypeError)) || essai >= 7) throw e;
      reveil();
      return new Promise(function (ok) { setTimeout(ok, 10000); }).then(function () { return catalogue(essai + 1); });
    });
  }
  var minuterie = page === 'connexion.html' ? null : setTimeout(function () {
    var m = document.getElementById('main');
    if (m && !m.firstElementChild) reveil();             // jamais par-dessus un écran déjà construit
  }, 3000);
  function sansReveil() {
    clearTimeout(minuterie);
    var r = document.querySelector('#main .sz-reveil');
    if (r) (r.closest('.wrap') || r).remove();
  }
  /* 08/11/2026 — « une application, pas un site » : changer d'onglet ne doit
     plus montrer un écran vide le temps que /api/catalogue revienne (~2 s
     depuis Kinshasa). Le dernier catalogue reçu est gardé pour l'ONGLET
     (sessionStorage : il disparaît avec lui), au nom du compte qui l'a reçu.
     L'écran se construit aussitôt avec lui, puis le serveur est interrogé en
     arrière-plan et sa réponse remplace la copie.
     Ce que la copie ne décide jamais : le texte d'une page reste servi page par
     page par le serveur, qui vérifie le droit de la lire à chaque fois. Toute
     écriture réussie (SOZO_API, autre que GET) périme la copie : l'écran
     suivant repart du serveur. La déconnexion l'efface (auth.js). */
  var CLE = 'sozo-catalogue', FRAICHEUR = 30 * 60000;
  function compte() { var s = window.SozoAuth && SozoAuth.session; return s && s.id != null ? String(s.id) : null; }
  function lireCopie() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CLE) || 'null');
      if (c && c.u && c.u === compte() && Date.now() - c.t < FRAICHEUR && c.d && c.d.books) return c.d;
    } catch (e) {}
    return null;
  }
  function garderCopie(d) { try { if (compte()) sessionStorage.setItem(CLE, JSON.stringify({ u: compte(), t: Date.now(), d: d })); } catch (e) {} }
  function poser(d) { D.authors = d.authors; D.books = d.books; D.reader = d.reader; }
  var enCours = null;
  function rafraichir() {
    if (enCours) return enCours;
    enCours = catalogue(7).then(function (d) {             // 7 : pas de nouvel essai, c'est un fond de tâche
      garderCopie(d); poser(d);
      document.dispatchEvent(new CustomEvent('sozo:catalogue'));
    }).catch(function () {}).then(function () { enCours = null; });
    return enCours;
  }
  window.SOZO_CATALOGUE_PERIME = function () {
    try { sessionStorage.removeItem(CLE); } catch (e) {}
    try { localStorage.setItem('sozo-ecrit', String(Date.now())); } catch (e) {}   // les onglets préparés d'avance se rechargeront (ui.js)
    if (page !== 'connexion.html') rafraichir();
  };
  var copie = page === 'connexion.html' ? null : lireCopie();
  if (copie) {
    clearTimeout(minuterie);
    poser(copie);
    window.SOZO_PRET = Promise.resolve();
    // en arrière-plan ; une page « prérendue » (onglet préparé d'avance) attend d'être montrée
    if (document.prerendering) document.addEventListener('prerenderingchange', rafraichir, { once: true });
    else rafraichir();
  } else {
    window.SOZO_PRET = page === 'connexion.html' ? Promise.resolve() :
      catalogue(0).then(function (d) {
        sansReveil();
        garderCopie(d); poser(d);
      }, function (e) { clearTimeout(minuterie); throw e; });
  }
})();
