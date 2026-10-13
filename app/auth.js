/* ═══════════════════════════════════════════════════════════
   Sōzō — accès au logiciel réservé aux personnes connectées.
   Chargé dans <head> de chaque page de app/ : sans session, on part vers
   la page de connexion AVANT d'afficher quoi que ce soit, et on revient
   ensuite sur la page demandée (?suite=…). La landing reste publique :
   ses livres servent de vitrine.

   DÉMONSTRATION : il n'y a pas de serveur. La « session » n'est qu'un nom,
   un e-mail et un rôle gardés sur CET appareil ; aucun mot de passe n'est
   jamais enregistré ni envoyé. Dans le vrai logiciel, la session sera un
   cookie sécurisé délivré par le serveur après vérification du mot de passe.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'sozo-session';
  function read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  var page = location.pathname.split('/').pop() || '';
  var s = read();
  window.SozoAuth = {
    session: s,
    open: function (data) { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } },
    close: function () { try { localStorage.removeItem(KEY); } catch (e) {} location.href = 'connexion.html'; }
  };
  if (!s && page !== 'connexion.html') {
    location.replace('connexion.html?suite=' + encodeURIComponent(page + location.search + location.hash));
  }
})();
