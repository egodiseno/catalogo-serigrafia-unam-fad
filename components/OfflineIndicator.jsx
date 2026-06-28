'use client';

/**
 * components/OfflineIndicator.jsx — Banner de estado offline + registro del SW
 *
 * Responsabilidades:
 *   1. Registra el Service Worker (/sw.js) en el primer montaje (PASO 3).
 *   2. Detecta cambios de conectividad con navigator.onLine + eventos online/offline.
 *   3. Muestra un banner subtle cuando la conexión se pierde.
 *   4. Oculta el banner automáticamente al recuperar conexión.
 *
 * El banner usa role="alert" + aria-live="assertive" para anunciar el estado
 * a lectores de pantalla.
 */

import { useState, useEffect } from 'react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);  // true mientras no sabemos

  useEffect(() => {
    // ── 1. Registrar Service Worker ────────────────────────────────────────
    if ('serviceWorker' in navigator) {
      // Registrar después de 'load' para no bloquear el renderizado inicial
      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.debug('[SW] Registrado:', registration.scope);

            // Escuchar actualizaciones disponibles (nueva versión del SW)
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (!newWorker) return;
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  // Nueva versión disponible — se activará en la próxima carga
                  console.debug('[SW] Actualización disponible');
                }
              });
            });
          })
          .catch((err) => {
            console.warn('[SW] Error al registrar:', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW, { once: true });
      }
    }

    // ── 2. Estado inicial de conectividad ──────────────────────────────────
    setIsOnline(navigator.onLine);

    // ── 3. Escuchar cambios de red ─────────────────────────────────────────
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // No renderizar nada mientras hay conexión
  if (isOnline) return null;

  return (
    <div className="offline-banner" role="alert" aria-live="assertive" aria-atomic="true">
      {/* Ícono Wi-Fi offline — inline SVG para funcionar sin red */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </svg>
      <span>Sin conexión — usando datos cacheados</span>
    </div>
  );
}
