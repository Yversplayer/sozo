// Ce que vit un lecteur dans un VRAI navigateur (Chrome), selon son réseau.
//   k6 run -e PROFIL=2g -e ETQ=avant navigateur.js
// Profils : bon (pas de bridage), 3g (Fast 3G), 3g-lente (Slow 3G), 2g (EDGE).
// Mesure, pour chaque étape, le temps jusqu'au CONTENU UTILE affiché (pas
// juste « la page a répondu ») et les octets réellement téléchargés — ce que
// la personne paie sur son forfait. Deux passages : premier (cache vide), puis
// retour (cache du navigateur).
import { browser, networkProfiles } from 'k6/browser';
import { Trend } from 'k6/metrics';
import { BASE, ENV } from './commun.js';

const PROFILS = {
  bon: null,
  '3g': networkProfiles['Fast 3G'],
  '3g-lente': networkProfiles['Slow 3G'],
  '2g': { latency: 800, download: 25000, upload: 10000 },     // EDGE : ~200 kbit/s, 800 ms d'aller-retour
};
const PROFIL = __ENV.PROFIL || 'bon', ETQ = __ENV.ETQ || 'mesure';
const temps = new Trend('etape_secondes'), octets = new Trend('etape_octets');

export const options = {
  scenarios: { ui: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '20m', options: { browser: { type: 'chromium' } } } },
};

async function poids(page) {
  return page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return (n ? n.transferSize : 0) + performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0);
  });
}
async function etape(page, nom, passage, action, attendre) {
  const t0 = Date.now();
  await action();
  await page.waitForSelector(attendre, { timeout: 240000, state: 'visible' });
  const s = (Date.now() - t0) / 1000;                      // temps : jusqu'au contenu utile affiché
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch (e) { /* on relève ce qui est arrivé */ }
  const o = await poids(page);                             // données : tout ce que la page a fini par télécharger
  const reseau = await page.evaluate(() => (navigator.connection && navigator.connection.effectiveType) || '?');
  temps.add(s, { etape: nom, passage }); octets.add(o, { etape: nom, passage });
  console.log('RELEVE ' + JSON.stringify({ profil: PROFIL, etq: ETQ, reseau, passage, etape: nom, secondes: +s.toFixed(2), ko: +(o / 1024).toFixed(1) }));
}

export default async function () {
  const lecteur = ENV.lecteurs.filter((l) => l.achete)[+(__ENV.LECTEUR || 0)];
  const livre = ENV.livres.find((l) => l.slug === lecteur.achete);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    if (PROFILS[PROFIL]) await page.throttleNetwork(PROFILS[PROFIL]);
    const B = BASE;
    await etape(page, 'connexion (page)', 'premier', () => page.goto(`${B}/app/connexion.html`), '#fIn input[name="email"]');
    await page.locator('#fIn input[name="email"]').fill(lecteur.email);
    await page.locator('#fIn input[name="pw"]').fill(ENV.mdp);
    await etape(page, 'se connecter → Découvrir', 'premier', () => page.locator('#fIn .cx-submit').click(), '.bc');
    for (const passage of ['premier', 'retour']) {
      if (passage === 'retour') await etape(page, 'Découvrir', passage, () => page.goto(`${B}/app/decouvrir.html`), '.bc');
      await etape(page, 'fiche du livre', passage, () => page.goto(`${B}/app/livre.html?id=${livre.slug}`), '.price-opt, h1 .ink-c');
      await etape(page, 'lire une page', passage, () => page.goto(`${B}/app/lire.html?id=${livre.slug}&p=${livre.payantes[0]}`), '#rdTexte:not([aria-busy]) p');
      await etape(page, 'page suivante', passage, () => page.goto(`${B}/app/lire.html?id=${livre.slug}&p=${livre.payantes[1]}`), '#rdTexte:not([aria-busy]) p');
    }
  } finally {
    await page.close();
    await ctx.close();
  }
}

