// Sōzō — le Worker Cloudflare : les pages ici, l'API relayée vers Render.
//
// ORIGINE UNIQUE. Les pages appellent `/api` sur leur propre domaine et la CSP
// dit `connect-src 'self'`. Le Worker garde cette règle : le navigateur ne voit
// qu'un domaine ; ni CORS, ni adresse d'API à maintenir dans les pages.
//
//   /api/*        → relayé tel quel vers SOZO_API_ORIGIN (Render) ;
//   /             → index.html ;
//   tout le reste → les fichiers de `dist/` (liste blanche, construire.sh).
//
// Les pages restent servies même quand le serveur gratuit de Render dort : la
// vitrine s'affiche aussitôt, seule la première requête d'API attend le réveil.
// Les en-têtes reprennent EXACTEMENT ceux de Flask (backend/app.py, entetes()).

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const ENTETES_SECURITE = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

// En-têtes qu'un navigateur ne doit jamais pouvoir poser lui-même : ils
// portent l'adresse du visiteur et la preuve que la requête vient du relais.
const ENTETES_DU_RELAIS = ["x-sozo-client-ip", "x-sozo-proxy"];

async function relayerApi(requete, env, url) {
  if (!env.SOZO_API_ORIGIN) {
    return Response.json({ erreur: "Le serveur Sōzō n'est pas encore configuré." }, { status: 503 });
  }
  const cible = new URL(url.pathname + url.search, env.SOZO_API_ORIGIN);
  const entetes = new Headers(requete.headers);
  for (const nom of ENTETES_DU_RELAIS) entetes.delete(nom);
  // Le serveur voit l'adresse du relais, pas celle du visiteur : on la
  // transmet avec le secret partagé (backend/app.py, ip_client). Sans le
  // secret, le serveur ignore l'en-tête — n'importe qui pourrait l'écrire en
  // appelant Render directement.
  const ip = requete.headers.get("CF-Connecting-IP");
  if (ip && env.SOZO_SECRET_PROXY) {
    entetes.set("X-Sozo-Client-IP", ip);
    entetes.set("X-Sozo-Proxy", env.SOZO_SECRET_PROXY);
  }
  return fetch(cible, {
    method: requete.method,
    headers: entetes,
    body: requete.method === "GET" || requete.method === "HEAD" ? undefined : requete.body,
    redirect: "manual",
  });
}

const DUREE_7_JOURS = /\.(jpe?g|png|webp|woff2|ico|svg)$/i;

async function servirFichier(requete, env, url) {
  let demande = requete;
  // Un dossier (« /admin/ ») sert son index.html, comme on l'attend en tapant l'adresse.
  if (url.pathname.endsWith("/")) demande = new Request(new URL(url.pathname + "index.html", url), requete);
  const reponse = await env.ASSETS.fetch(demande);
  const finale = new Response(reponse.body, reponse);
  for (const [nom, valeur] of Object.entries(ENTETES_SECURITE)) finale.headers.set(nom, valeur);
  if (reponse.status === 200) {
    // Même règle que Flask : HTML et service worker toujours revérifiés ;
    // fichier versionné (?v=) un an ; images, polices, Bible, dictionnaire
    // 7 jours ; le reste revérifié.
    const type = reponse.headers.get("Content-Type") || "";
    let cache = "no-cache";
    if (type.startsWith("text/html") || url.pathname === "/app/sw.js") cache = "no-cache";
    else if (url.searchParams.get("v")) cache = "public, max-age=31536000, immutable";
    else if (DUREE_7_JOURS.test(url.pathname) || url.pathname.startsWith("/app/bible/") || url.pathname.startsWith("/app/langue/")) cache = "public, max-age=604800";
    finale.headers.set("Cache-Control", cache);
  }
  return finale;
}

// HTTPS OBLIGATOIRE (leçon de Klassio, 06/10/2026 : la page de connexion
// répondait en HTTP). Une page demandée en HTTP est renvoyée vers HTTPS ; une
// écriture n'est pas redirigée mais refusée : ses données ont déjà voyagé en
// clair une fois, la rediriger apprendrait au navigateur à les renvoyer.
function exigerHttps(requete, url) {
  if (url.protocol !== "http:") return null;
  if (requete.method === "GET" || requete.method === "HEAD") {
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return Response.json({ erreur: "Sōzō n'accepte que HTTPS." }, { status: 403 });
}

// 30/10/2026 — l'application Android (paquet PWABuilder, Trusted Web Activity).
// Android lit ce fichier pour vérifier que l'application et le site ont le même
// propriétaire ; sans lui, l'application s'ouvre avec une barre d'adresse.
// Ce n'est que l'empreinte PUBLIQUE de la clé de signature : rien de secret.
// Une nouvelle clé (Play Store, autre identifiant) = une entrée de plus ici.
const ASSETLINKS = [{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {
    namespace: "android_app",
    package_name: "dev.workers.mudeyimusimwa.sozo.twa",
    sha256_cert_fingerprints: ["2B:49:AE:06:2B:EC:88:09:0D:F1:CC:6E:F7:E9:79:A7:CA:5A:87:CA:2B:76:48:4F:FE:31:0D:54:F4:48:4C:FB"],
  },
}];

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    const refus = exigerHttps(requete, url);
    if (refus) return refus;
    if (url.pathname === "/.well-known/assetlinks.json") {
      return Response.json(ASSETLINKS, { headers: { ...ENTETES_SECURITE, "Cache-Control": "public, max-age=3600" } });
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return relayerApi(requete, env, url);
    return servirFichier(requete, env, url);
  },
};
