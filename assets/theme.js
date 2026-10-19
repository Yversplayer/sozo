/* Thème : CLAIR par défaut depuis le 19/10/2026 (nocturne le 17/10) ; nocturne
   si la personne l'a choisi dans Mon compte. Le choix vit sur le serveur (il
   suit la personne d'un appareil à l'autre) et en copie locale, lue ici dans
   <head> avant le premier rendu pour éviter un éclair de la mauvaise couleur.
   Le stockage peut être bloqué (navigation privée) : tout est sous try. */
(function () {
  // 19/10/2026 : le propriétaire veut le BLANC comme base (« pas le noir »)
  var t = 'clair';
  try { t = localStorage.getItem('sozo-theme') === 'nocturne' ? 'nocturne' : 'clair'; } catch (e) {}
  if (t === 'nocturne') document.documentElement.setAttribute('data-theme', 'dark');
  window.SozoTheme = {
    get: function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; },
    /* v : 'nocturne' | 'clair' */
    set: function (v) {
      var clair = v === 'clair';
      if (clair) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('sozo-theme', clair ? 'clair' : 'nocturne'); } catch (e) {}
      document.dispatchEvent(new CustomEvent('sozo:theme', { detail: clair ? 'light' : 'dark' }));
    }
  };
})();
