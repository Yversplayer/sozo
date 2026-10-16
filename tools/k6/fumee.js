// Fumée : chaque parcours critique renvoie les BONNES données, pas juste un 200.
// À passer avant toute montée en charge : sinon on mesure la vitesse d'une panne.
import { check } from 'k6';
import { ENV, connecter, envoyer, fuites, get, ouvrir } from './commun.js';

export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1.00'], erreurs_500: ['count==0'], fuites_contenu_protege: ['count==0'] } };

export default function () {
  const lecteur = ENV.lecteurs.find((l) => l.achete);
  check(null, { 'un lecteur a acheté un livre (jeu de données)': () => !!lecteur });
  connecter(lecteur.email);
  const cat = ouvrir('decouvrir');
  const libre = ENV.livres.find((l) => l.gratuites.length && l.payantes.length && l.slug !== lecteur.achete);
  // page gratuite : lisible, avec son texte
  const g = get(`/api/livres/${libre.slug}/pages/${libre.gratuites[0]}`, 'GET page gratuite');
  check(g, { 'page gratuite : 200 et texte': (r) => r.status === 200 && r.json('contenu').length > 50 });
  // page payante non achetée : 402, et AUCUN texte dans la réponse
  const p = get(`/api/livres/${libre.slug}/pages/${libre.payantes[0]}`, 'GET page payante non achetée');
  check(p, { 'page payante non achetée : 402': (r) => r.status === 402 });
  if (p.body && p.body.includes('Kinshasa comme une promesse')) fuites.add(1);
  // page d'un livre acheté : 200, filigrane nominatif
  const achete = ENV.livres.find((l) => l.slug === lecteur.achete);
  const a = get(`/api/livres/${achete.slug}/pages/${achete.payantes[0]}`, 'GET page achetée');
  check(a, { 'page achetée : 200 et filigrane': (r) => r.status === 200 && /Exemplaire/.test(r.json('filigrane') || '') });
  // page programmée (pas encore parue) : 403, sans texte
  const derniere = Math.max(...achete.gratuites.concat(achete.payantes)) + 2;
  const s = get(`/api/livres/${achete.slug}/pages/${derniere}`, 'GET page à venir');
  check(s, { 'page à venir : 403': (r) => r.status === 403 });
  if (s.body && s.body.includes('Kinshasa comme une promesse')) fuites.add(1);
  // le catalogue ne contient aucun texte de page
  check(cat, { 'catalogue sans texte de page': (c) => !JSON.stringify(c).includes('Kinshasa comme une promesse') });
  check(envoyer('PUT', '/api/moi/progression', { livre: libre.slug, n: libre.gratuites[0] }, 'PUT progression'), { 'progression enregistrée': (r) => r.status === 200 });
  check(get('/api/notifications', 'GET /api/notifications'), { 'notifications lisibles': (r) => r.status === 200 });
  // auteur : son atelier, et pas celui d'un autre
  const auteur = ENV.auteurs[0];
  connecter(auteur.email);
  check(get('/api/studio', 'GET /api/studio'), { 'atelier : ses livres': (r) => r.status === 200 && r.json('livres').length === auteur.livres.length });
  check(get(`/api/studio/livres/${ENV.auteurs[1].livres[0]}`, 'GET studio livre d’autrui'), { 'livre d’un autre auteur : 404': (r) => r.status === 404 });
  const pg = get(`/api/studio/livres/${auteur.livres[0]}/pages/40`, 'GET studio page');
  check(pg, { 'brouillon de l’auteur lisible': (r) => r.status === 200 });
}
