/* ═══════════════════════════════════════════════════════════
   Sōzō — TÉLÉCHARGER un livre pour le lire sans réseau (03/11/2026).
   Le propriétaire : « mes téléchargements », et dans les trois points d'un
   livre : partager, ajouter, télécharger (Netflix, Webtoon).

   Rien de nouveau côté sécurité : on demande simplement au serveur, une par
   une, les pages que la personne a le DROIT de lire ; le service worker
   (sw.js) les garde dans le cache À SON NOM, comme une page lue. Donc :
   · une page payante non achetée n'est jamais demandée, ni gardée ;
   · le serveur reste juge : une page refusée (401, 402, 403, 404) est
     aussitôt retirée du cache ;
   · la déconnexion, ou un autre compte sur l'appareil, vide tout — la liste
     des téléchargements vit dans ce même cache et part avec lui.
   Aucun faux succès : une page n'est comptée « téléchargée » qu'une fois
   relue dans le cache. Sans service worker (navigateur trop ancien,
   navigation privée), on le dit au lieu de prétendre.
   ═══════════════════════════════════════════════════════════ */
window.SOZO_HORS = (() => {
  const S = () => window.SOZO;
  const INDEX = '/__telechargements';
  const nomCache = () => { const m = S().sess(); return m && m.id ? `sozo-u${m.id}` : null; };
  const urlPage = (slug, n) => `/api/livres/${encodeURIComponent(slug)}/pages/${n}`;
  const possible = () => !!(window.caches && navigator.serviceWorker && navigator.serviceWorker.controller && nomCache());

  async function lireIndex(c) {
    const r = await c.match(INDEX);
    try { return r ? await r.json() : {}; } catch (e) { return {}; }
  }
  const ecrireIndex = (c, ix) => c.put(INDEX, new Response(JSON.stringify(ix), { headers: { 'Content-Type': 'application/json' } }));

  /* l'enveloppe de la liseuse (page, styles, scripts) : sans elle, rien ne s'ouvre hors ligne */
  async function enveloppe() {
    try {
      const r = await fetch('lire.html', { credentials: 'same-origin' });
      const html = await r.text();
      const liens = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?v=[\w-]+)?)"/g)].map((m) => new URL(m[1], location.href).href);
      await Promise.all(liens.map((u) => fetch(u, { credentials: 'same-origin' }).catch(() => null)));
    } catch (e) { /* hors ligne déjà : la liseuse reste celle déjà vue */ }
  }

  /* les pages que la personne peut lire — calculées par le serveur (catalogue) */
  const lisibles = (b) => S().visiblePages(b).filter((p) => S().readable(S().access(b, p.n))).map((p) => p.n);

  async function telecharger(b, progression) {
    if (!possible()) return { ok: false, erreur: 'Cet appareil ne garde pas encore les pages hors ligne. Ouvrez Sōzō depuis l’application installée, puis réessayez.' };
    const pages = lisibles(b);
    if (!pages.length) return { ok: false, erreur: 'Aucune page de ce livre n’est lisible pour vous pour l’instant.' };
    const c = await caches.open(nomCache());
    await enveloppe();
    let faites = 0;
    for (const n of pages) {
      const u = urlPage(b.id, n);
      try { await fetch(u, { credentials: 'same-origin' }); } catch (e) { /* réseau coupé : on le verra au contrôle */ }
      if (await c.match(u)) faites += 1;
      if (progression) progression(faites, pages.length);
    }
    const ix = await lireIndex(c);
    if (faites) { ix[b.id] = { titre: b.title, pages: faites, le: new Date().toISOString() }; await ecrireIndex(c, ix); }
    const payantes = S().visiblePages(b).filter((p) => S().access(b, p.n) === 'locked').length;
    return { ok: faites > 0, faites, total: pages.length, payantes, erreur: faites ? null : 'Le téléchargement n’a pas abouti. Vérifiez la connexion, puis réessayez.' };
  }

  /* la liste, relue dans le cache : seules les pages vraiment présentes comptent */
  async function liste() {
    if (!window.caches || !nomCache()) return [];
    const c = await caches.open(nomCache());
    const ix = await lireIndex(c);
    const cles = (await c.keys()).map((r) => new URL(r.url).pathname);
    return Object.entries(ix).map(([slug, x]) => ({ slug, titre: x.titre, le: x.le,
      pages: cles.filter((k) => k.startsWith(`/api/livres/${encodeURIComponent(slug)}/pages/`)).length })).filter((x) => x.pages > 0);
  }

  async function retirer(slug) {
    if (!window.caches || !nomCache()) return;
    const c = await caches.open(nomCache());
    const prefixe = `/api/livres/${encodeURIComponent(slug)}/pages/`;
    await Promise.all((await c.keys()).filter((r) => new URL(r.url).pathname.startsWith(prefixe)).map((r) => c.delete(r)));
    const ix = await lireIndex(c); delete ix[slug]; await ecrireIndex(c, ix);
  }

  const estTelecharge = async (slug) => (await liste()).some((x) => x.slug === slug);
  return { possible, telecharger, liste, retirer, estTelecharge };
})();
