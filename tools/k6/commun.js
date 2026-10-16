// Sōzō — socle commun des scénarios k6.
// Chaque utilisateur virtuel a SA propre adresse IP (en-tête CF-Connecting-IP,
// accepté seulement avec le secret du proxy — comme derrière Cloudflare) :
// sans cela, 400 personnes partageraient l'IP de la machine de test et la
// limitation anti-abus les bloquerait toutes, ce qui ne mesurerait rien.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

export const ENV = JSON.parse(open('./env.json'));
export const BASE = __ENV.BASE || ENV.base;
const SECRET = __ENV.PROXY || 'charge-proxy-secret';
export const erreurs500 = new Counter('erreurs_500');
export const fuites = new Counter('fuites_contenu_protege');
export const refus429 = new Counter('refus_limitation_429');
export const DECALAGE = +(__ENV.DECALAGE || 0);   // comptes différents d'un palier à l'autre

// IP stable par personne ; le flux « connexions » (nouvelles arrivées) prend une IP par arrivée
export const ip = () => (__ENV.K6_SCENARIO_NOM === 'connexions' || exec.scenario.name === 'connexions')
  ? `10.${200 + ((__ITER >> 8) & 31)}.${__ITER & 255}.${__VU & 255}`
  : `10.${(__VU >> 8) & 255}.${__VU & 255}.7`;
const ent = (x) => Object.assign({ 'X-Sozo-Proxy': SECRET, 'CF-Connecting-IP': ip(), 'Accept-Encoding': 'gzip, br' }, x || {});
const suivre = (r) => { if (r.status >= 500) erreurs500.add(1); if (r.status === 429) refus429.add(1); return r; };

export function csrf() {
  const c = http.cookieJar().cookiesForURL(BASE).sozo_csrf;
  return c ? c[0] : '';
}
export const get = (url, nom) => suivre(http.get(BASE + url, { headers: ent(), tags: { name: nom || url } }));
export const envoyer = (meth, url, corps, nom) => suivre(http.request(meth, BASE + url, JSON.stringify(corps || {}),
  { headers: ent({ 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() }), tags: { name: nom || `${meth} ${url}` } }));

export function connecter(email) {
  http.cookieJar().clear(BASE);            // une personne à la fois sur ce « navigateur »
  const r = suivre(http.post(BASE + '/api/sessions', JSON.stringify({ email, mot_de_passe: ENV.mdp }),
    { headers: ent({ 'Content-Type': 'application/json' }), tags: { name: 'POST /api/sessions' } }));
  check(r, { 'connexion acceptée': (x) => x.status === 200 });
  return r.status === 200;
}

// Ce que le navigateur charge pour ouvrir une page de l'application :
// la page, puis « qui suis-je », le catalogue et le compteur de notifications.
export function ouvrir(page) {
  const h = get(`/app/${page}.html`, `GET /app/${page}.html`);
  const moi = get('/api/moi', 'GET /api/moi');
  const cat = get('/api/catalogue', 'GET /api/catalogue');
  get('/api/notifications?compte=1', 'GET /api/notifications?compte=1');
  check(h, { 'page servie': (x) => x.status === 200 });
  check(moi, { 'session valide': (x) => x.status === 200 });
  const ok = check(cat, { 'catalogue rempli': (x) => x.status === 200 && x.json('books').length > 10 });
  return ok ? cat.json() : null;
}

export const pause = (a, b) => sleep(a + Math.random() * (b - a));
export const hasard = (t) => t[Math.floor(Math.random() * t.length)];
