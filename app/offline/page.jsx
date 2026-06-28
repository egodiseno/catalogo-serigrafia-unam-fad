/**
 * app/offline/page.jsx — Página de fallback sin conexión
 *
 * Servida por el Service Worker cuando el usuario intenta navegar a una
 * ruta no disponible en caché mientras está offline.
 *
 * Pre-cacheada durante el INSTALL del SW (sw.js → PRECACHE_PAGES).
 * No usa datos dinámicos de Supabase — solo HTML estático.
 */

export const metadata = {
  title: 'Sin conexión | Catálogo de Obra Serigráfica',
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="offline-page" id="contenido">
      <div className="container">
        <div className="offline-page__box">

          {/* Ícono: señal Wi-Fi tachada — SVG inline para funcionar offline */}
          <svg
            className="offline-page__icon"
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Señal cortada */}
            <line x1="1" y1="1" x2="23" y2="23" />
            {/* Arcos de señal Wi-Fi */}
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            {/* Punto central */}
            <circle cx="12" cy="20" r="1" fill="currentColor" />
          </svg>

          <h1 className="offline-page__title">Sin conexión</h1>

          <p className="offline-page__lead">
            Esta página no está disponible sin conexión.
            Por favor, intenta con otra página o espera a tener conexión nuevamente.
          </p>

          <p className="offline-page__hint">
            Las páginas que ya visitaste pueden estar disponibles desde el caché.
          </p>

          <div className="offline-page__actions">
            <a href="/" className="offline-page__link">
              ← Volver al catálogo
            </a>
          </div>

        </div>
      </div>
    </main>
  );
}
