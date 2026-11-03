/* Thème : CLAIR par défaut depuis le 19/10/2026 (nocturne le 17/10) ; nocturne
   si la personne l'a choisi dans Mon compte. Le choix vit sur le serveur (il
   suit la personne d'un appareil à l'autre) et en copie locale, lue ici dans
   <head> avant le premier rendu pour éviter un éclair de la mauvaise couleur.
   03/11/2026 — L'APPLICATION (téléphone, ≤ 899 px) s'ouvre en NOCTURNE : le
   bordeaux presque noir « à la Netflix » demandé par le propriétaire. Son choix
   est propre au téléphone (`sozo-theme-tel`) : le thème enregistré sur le
   serveur, choisi le plus souvent sur ordinateur, ne l'écrase pas.
   Le stockage peut être bloqué (navigation privée) : tout est sous try. */
(function () {
  var tel = false;
  try { tel = window.matchMedia('(max-width: 899px)').matches; } catch (e) {}
  var cle = tel ? 'sozo-theme-tel' : 'sozo-theme';
  // 19/10/2026 : le propriétaire veut le BLANC comme base sur ordinateur (« pas le noir »)
  var t = tel ? 'nocturne' : 'clair';
  try { var v = localStorage.getItem(cle); if (v === 'clair' || v === 'nocturne') t = v; } catch (e) {}
  if (t === 'nocturne') document.documentElement.setAttribute('data-theme', 'dark');
  window.SozoTheme = {
    telephone: tel,
    get: function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; },
    /* v : 'nocturne' | 'clair' ; o.serveur : la valeur vient du compte (auth.js) */
    set: function (v, o) {
      if (tel && o && o.serveur) return;             // sur téléphone, le choix du téléphone l'emporte
      var clair = v === 'clair';
      if (clair) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem(cle, clair ? 'clair' : 'nocturne'); } catch (e) {}
      document.dispatchEvent(new CustomEvent('sozo:theme', { detail: clair ? 'light' : 'dark' }));
    }
  };
})();
