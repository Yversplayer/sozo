/* Thème : CLAIR par défaut depuis le 19/10/2026 (nocturne le 17/10) ; nocturne
   si la personne l'a choisi dans Mon compte. Le choix vit sur le serveur (il
   suit la personne d'un appareil à l'autre) et en copie locale, lue ici dans
   <head> avant le premier rendu pour éviter un éclair de la mauvaise couleur.
   03/11/2026 — L'APPLICATION (téléphone, ≤ 899 px) s'ouvrait en NOCTURNE (le
   bordeaux presque noir « à la Netflix »).
   08/11/2026 — Le propriétaire : « la couleur par défaut du logiciel, blanc,
   pas rouge ; seul l'accueil prend la couleur du livre affiché au milieu ».
   Le téléphone s'ouvre donc en CLAIR, lui aussi (blanc pur : appli.css) ; le
   nocturne reste un choix, dans Paramètres. Ce choix reste propre au téléphone
   (`sozo-theme-tel`) : le thème enregistré sur le serveur, choisi le plus
   souvent sur ordinateur, ne l'écrase pas.
   La couleur des barres du système (meta theme-color) suit le thème : une
   barre bordeaux au-dessus d'un écran blanc faisait « site web ».
   Le stockage peut être bloqué (navigation privée) : tout est sous try. */
(function () {
  var tel = false;
  try { tel = window.matchMedia('(max-width: 899px)').matches; } catch (e) {}
  var cle = tel ? 'sozo-theme-tel' : 'sozo-theme';
  var t = 'clair';
  try { var v = localStorage.getItem(cle); if (v === 'clair' || v === 'nocturne') t = v; } catch (e) {}
  function barres(sombre) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', sombre ? '#14090C' : '#FFFFFF');
  }
  if (t === 'nocturne') document.documentElement.setAttribute('data-theme', 'dark');
  barres(t === 'nocturne');
  window.SozoTheme = {
    telephone: tel,
    get: function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; },
    /* v : 'nocturne' | 'clair' ; o.serveur : la valeur vient du compte (auth.js) */
    set: function (v, o) {
      if (tel && o && o.serveur) return;             // sur téléphone, le choix du téléphone l'emporte
      var clair = v === 'clair';
      if (clair) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', 'dark');
      barres(!clair);
      try { localStorage.setItem(cle, clair ? 'clair' : 'nocturne'); } catch (e) {}
      document.dispatchEvent(new CustomEvent('sozo:theme', { detail: clair ? 'light' : 'dark' }));
    }
  };

  /* 08/11/2026 — passer d'une page à l'autre comme dans une application : la
     page entre du bon côté (onglet suivant à droite, précédent à gauche, une
     fiche ouverte « par-dessus », un retour qui recule), la barre d'onglets ne
     bouge pas (app.css, @view-transition). Le sens se lit dans la navigation
     elle-même (navigation.activation), avant le premier rendu (pagereveal) :
     ce script est dans <head>. Sans ces API, la page s'affiche simplement. */
  var ONGLETS = ['decouvrir.html', 'explorer.html', 'studio.html', 'suivis.html?vue=notes', 'profil.html'];
  function onglet(u) {
    try {
      var x = new URL(u), p = x.pathname.split('/').pop();
      if (p === 'suivis.html') return x.searchParams.get('vue') === 'notes' ? 3 : -1;
      return ONGLETS.indexOf(p);
    } catch (e) { return -1; }
  }
  window.addEventListener('pagereveal', function (e) {
    var vt = e.viewTransition, act = window.navigation && navigation.activation;
    if (!vt) return;
    // une transition interrompue (écran tourné, clavier) n'est pas une erreur de la page
    try { vt.ready.catch(function () {}); vt.finished.catch(function () {}); vt.updateCallbackDone.catch(function () {}); } catch (x) {}
    if (!act || !act.from || !act.entry) return;
    var de = onglet(act.from.url), vers = onglet(act.entry.url), t;
    if (act.navigationType === 'reload') { vt.skipTransition(); return; }
    if (de >= 0 && vers >= 0) t = vers > de ? 'sz-avant' : 'sz-arriere';
    else if (act.navigationType === 'traverse' || vers >= 0) t = 'sz-retour';
    else t = 'sz-pousse';
    try { vt.types.add(t); } catch (x) {}
  });
})();
