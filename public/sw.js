/**
 * sw.js — Service Worker del Catálogo Digital de Obra Serigráfica UNAM/FAD
 *
 * Estrategias de caché:
 *   Cache First   — /_next/static/* y /logos/* (assets con hash o estáticos)
 *   Network First — páginas HTML (fallback a caché, luego a /offline)
 *   Network First — /_next/* (RSC data, image optim. excluida)
 *   Network Only  — Supabase API, Edge Functions, rutas /admin (cross-origin o auth)
 *
 * Precache durante install:
 *   Páginas públicas: /, /tecnicas, /creditos, /registro, /offline
 *   Assets:           /manifest.json, /logos/*.{svg,png}
 *
 * NOTA: archivos JS de Next.js tienen hashes en nombre → son inmutables
 *       y seguros para Cache First indefinido. Se cachean en runtime la primera visita.
 */

'use strict';

const SW_VERSION    = '1.0.0';
const CACHE_STATIC  = `catalog-static-${SW_VERSION}`;
const CACHE_PAGES   = `catalog-pages-${SW_VERSION}`;
const CACHE_FONTS   = `catalog-fonts-${SW_VERSION}`;

const ALL_CACHES = [CACHE_STATIC, CACHE_PAGES, CACHE_FONTS];

// ── Assets pre-cacheados durante INSTALL ──────────────────────────────────────
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/logos/UNAM.svg',
  '/logos/FAD.svg',
  '/logos/cropped-icon-192x192.png',
  '/logos/cropped-icon-180x180.png',
  '/logos/cropped-icon-32x32.png',
];

// Páginas pre-cacheadas (incluye /offline como fallback garantizado)
const PRECACHE_PAGES = [
  '/',
  '/tecnicas',
  '/creditos',
  '/registro',
  '/offline',
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pre-cachear assets y páginas principales
// Promise.allSettled → si una URL falla, no bloquea el install completo
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log(`[SW] Instalando v${SW_VERSION}`);

  event.waitUntil(
    Promise.allSettled([
      caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE_ASSETS)),
      caches.open(CACHE_PAGES).then((cache) =>
        // addAll en paralelo con manejo individual de errores
        Promise.allSettled(
          PRECACHE_PAGES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] No se pudo pre-cachear ${url}:`, err.message);
            })
          )
        )
      ),
    ]).then(() => {
      console.log(`[SW] Pre-caché completo v${SW_VERSION}`);
      // Activa inmediatamente sin esperar que se cierren otras pestañas
      return self.skipWaiting();
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — limpiar versiones antiguas de caché
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activando v${SW_VERSION}`);

  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => {
              console.log(`[SW] Eliminando caché obsoleto: ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        // Tomar control de todas las pestañas abiertas sin refresh
        return self.clients.claim();
      })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — interceptar y enrutar requests según estrategia
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ── Solo interceptar mismo origen ────────────────────────────────────────
  // Excluye llamadas a Supabase (*.supabase.co), Google Fonts, CDNs, etc.
  if (url.origin !== self.location.origin) return;

  // ── Excluir rutas admin (auth dinámica — no cachear nunca) ───────────────
  if (url.pathname.startsWith('/admin')) return;

  // ── Excluir optimización de imágenes de Next.js (siempre dynamic) ────────
  if (url.pathname.startsWith('/_next/image')) return;

  // ── Next.js static chunks — Cache First ──────────────────────────────────
  // Nombres con hash de contenido → inmutables, seguros para caché indefinida
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // ── Next.js internals (RSC data, etc.) — Network First ───────────────────
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(networkFirst(request, CACHE_PAGES));
    return;
  }

  // ── Assets estáticos (logos, icons, manifest) — Cache First ──────────────
  if (
    url.pathname.startsWith('/logos/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webp')
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // ── Páginas HTML — Network First con fallback a caché y /offline ─────────
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  if (acceptsHtml) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // ── Todo lo demás: solo red (no cachear) ─────────────────────────────────
});

// ─────────────────────────────────────────────────────────────────────────────
// Estrategias de caché
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache First — devuelve de caché si existe; si no, fetch + guarda en caché.
 * Ideal para assets con hash (inmutables).
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst fetch error:', err.message);
    throw err;
  }
}

/**
 * Network First — intenta red; si falla, devuelve de caché.
 * Para recursos dinámicos que mejoran con datos frescos.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Sin red y sin caché');
  }
}

/**
 * Network First para páginas HTML.
 * Si red y caché fallan → devuelve la página /offline (pre-cacheada en install).
 */
async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_PAGES);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Intentar caché exacto de la URL
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback a página offline pre-cacheada
    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;

    // Último recurso: respuesta HTML mínima
    return new Response(
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Sin conexión</title></head>' +
      '<body style="font-family:sans-serif;text-align:center;padding:3rem">' +
      '<h1>Sin conexión</h1><p>Esta página no está disponible sin conexión.</p>' +
      '<a href="/">Ir al catálogo</a></body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensaje de actualización disponible
// Cuando hay una nueva versión del SW, notificar a todos los clientes.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
