/* Thème : clair par défaut (choix du propriétaire), sombre si le lecteur l'a
   demandé. Lu dans <head> avant le premier rendu, pour éviter un éclair clair.
   Le stockage peut être bloqué (navigation privée) : tout est sous try. */
(function () {
  var t = 'light';
  try { t = localStorage.getItem('sozo-theme') || 'light'; } catch (e) {}
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  window.SozoTheme = {
    get: function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; },
    set: function (v) {
      if (v === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('sozo-theme', v); } catch (e) {}
      document.dispatchEvent(new CustomEvent('sozo:theme', { detail: v }));
    },
    toggle: function () { this.set(this.get() === 'dark' ? 'light' : 'dark'); }
  };
})();
