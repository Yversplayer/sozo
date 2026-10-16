// Charge : PALIER utilisateurs SIMULTANÉMENT actifs (90 % de lecteurs, 10 %
// d'auteurs), avec des temps de lecture réalistes mais resserrés, plus un flux
// continu de connexions (le hachage du mot de passe est coûteux, exprès).
//   k6 run -e PALIER=100 -e DUREE=60s charge.js
import { check } from 'k6';
import exec from 'k6/execution';
import { DECALAGE, ENV, connecter, envoyer, fuites, get, hasard, ouvrir, pause } from './commun.js';

const PALIER = +(__ENV.PALIER || 50), DUREE = __ENV.DUREE || '60s';
const nLect = Math.max(1, Math.round(PALIER * 0.9)), nAut = Math.max(1, PALIER - nLect);
export const options = {
  scenarios: {
    lecteurs: { executor: 'constant-vus', vus: nLect, duration: DUREE, exec: 'lecteur', gracefulStop: '15s' },
    auteurs: { executor: 'constant-vus', vus: nAut, duration: DUREE, exec: 'auteur', gracefulStop: '15s' },
    connexions: { executor: 'constant-arrival-rate', rate: 1, timeUnit: '2s', duration: DUREE, preAllocatedVUs: 4, exec: 'arrivee' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], checks: ['rate>0.99'], erreurs_500: ['count==0'], fuites_contenu_protege: ['count==0'],
    'http_req_duration{scenario:lecteurs}': ['p(95)<1500'],
    // (seuils larges : ils servent à exporter ces mesures dans le résumé)
    'http_req_duration{name:GET /api/catalogue}': ['p(95)<60000'],
    'http_req_duration{name:GET page gratuite}': ['p(95)<60000'],
    'http_req_duration{name:POST /api/sessions}': ['p(95)<60000'],
    refus_limitation_429: ['count>=0'],
  },
  noCookiesReset: true,          // une personne garde sa session d'une visite à l'autre
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

let pret = false;
const LIBRES = ENV.livres.filter((l) => l.gratuites.length >= 3);

export function lecteur() {
  const moi = ENV.lecteurs[(exec.vu.idInTest - 1 + DECALAGE) % ENV.lecteurs.length];
  if (!pret) { pause(0, 15); pret = connecter(moi.email); if (!pret) return; }    // arrivées étalées
  ouvrir('decouvrir'); pause(2, 5);
  const achete = moi.achete && Math.random() < 0.5 ? ENV.livres.find((l) => l.slug === moi.achete) : null;
  const livre = achete || hasard(LIBRES);
  const pages = achete ? achete.payantes.concat(achete.gratuites) : livre.gratuites;
  ouvrir('livre'); pause(2, 4);
  ouvrir('lire');
  for (let i = 0; i < 3; i++) {
    const n = pages[Math.floor(Math.random() * pages.length)];
    const r = get(`/api/livres/${livre.slug}/pages/${n}`, achete ? 'GET page achetée' : 'GET page gratuite');
    check(r, { 'page lisible': (x) => x.status === 200 });
    envoyer('PUT', '/api/moi/progression', { livre: livre.slug, n }, 'PUT progression');
    pause(3, 6);
  }
  if (Math.random() < 0.2) { ouvrir('suivis'); get('/api/notifications', 'GET /api/notifications'); pause(1, 3); }
  if (Math.random() < 0.1) {                         // curiosité : une page payante non achetée
    const l = hasard(ENV.livres.filter((x) => x.payantes.length && x.slug !== moi.achete));
    const r = get(`/api/livres/${l.slug}/pages/${l.payantes[0]}`, 'GET page payante non achetée');
    check(r, { 'page payante fermée (402)': (x) => x.status === 402 });
    if (r.body && r.body.includes('Kinshasa comme une promesse')) fuites.add(1);
  }
}

export function auteur() {
  const moi = ENV.auteurs[(exec.vu.idInTest - 1) % ENV.auteurs.length];
  if (!pret) { pause(0, 15); pret = connecter(moi.email); if (!pret) return; }
  ouvrir('studio');
  const slug = hasard(moi.livres);
  check(get('/api/studio', 'GET /api/studio'), { 'atelier ouvert': (x) => x.status === 200 });
  get(`/api/studio/livres/${slug}`, 'GET /api/studio/livres/:slug');
  get('/api/studio/ventes', 'GET /api/studio/ventes');
  pause(3, 6);
  ouvrir('ecrire');
  const n = 37 + Math.floor(Math.random() * 4);    // pages programmées : modifiables
  const p = get(`/api/studio/livres/${slug}/pages/${n}`, 'GET /api/studio/.../pages/:n');
  if (p.status === 200) {
    const r = envoyer('PUT', `/api/studio/livres/${slug}/pages/${n}`, { contenu: `${p.json('contenu')}\nAjout ${Date.now()}`, version_attendue: p.json('version') }, 'PUT page (enregistrer)');
    check(r, { 'enregistrement accepté ou conflit signalé': (x) => x.status === 200 || x.status === 409 });
  }
  pause(5, 10);
}

export function arrivee() {
  connecter(hasard(ENV.lecteurs).email);
}
