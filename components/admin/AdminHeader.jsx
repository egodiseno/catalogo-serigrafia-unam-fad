'use client';

/**
 * components/admin/AdminHeader.jsx — Header dinámico del admin (Client Component)
 *
 * Extrae el título fijo "Catálogo de Obra Serigráfica" + subtítulo dinámico según
 * la ruta actual, replicando el objeto `sectionTitles` de navigation.js del VanillaJS.
 *
 * Reemplaza el bloque <header className="admin-header"> estático de layout.jsx
 * para poder usar usePathname() — que requiere un Client Component.
 *
 * El botón hamburger (#sidebarToggle) sigue siendo accionado por el script inline
 * en layout.jsx (addEventListener sobre el ID). Funciona correctamente porque Next.js
 * incluye el HTML del Client Component en el HTML inicial (SSR) antes de hidratar.
 */

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

// Mapa ruta → subtítulo. Fuente de verdad: sectionTitles de navigation.js VanillaJS.
// Nota: el título h1 es siempre "Catálogo de Obra Serigráfica" (igual que el VanillaJS).
const ROUTE_SUBTITLES = {
  '/admin':                    'Resumen del catálogo',
  '/admin/obras':              'Gestionar obras',
  '/admin/tecnicas':           'Gestionar técnicas',
  '/admin/tags':               'Gestionar tags',
  '/admin/usuarios':           'Gestionar usuarios',
  '/admin/logs':               'Logs de auditoría',
  '/admin/mi-perfil':          'Mi perfil',
  '/admin/mi-portafolio':      'Mi portafolio',
  '/admin/configuracion':      'Configuración',
  '/admin/registros':          'Registros pendientes de validación',
  '/admin/control-registro':   'Control de registro de alumnos',
  '/admin/historial-alumnos':  'Historial de alumnos',
  '/admin/estadisticas':       'Estadísticas de visitas y engagement',
};

/** Resuelve el subtítulo para la ruta actual.
 *  Usa coincidencia exacta primero; luego busca el prefijo más largo (para sub-rutas). */
function resolveSubtitle(pathname) {
  if (ROUTE_SUBTITLES[pathname]) return ROUTE_SUBTITLES[pathname];
  // Sub-ruta: buscar el prefijo más largo que no sea la raíz '/admin'
  const matched = Object.keys(ROUTE_SUBTITLES)
    .filter(k => k !== '/admin' && pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return matched ? ROUTE_SUBTITLES[matched] : 'Panel de administración';
}

export default function AdminHeader() {
  const pathname = usePathname() || '/admin';
  const subtitle = resolveSubtitle(pathname);

  return (
    <header className="admin-header">
      {/* Logos mobile/tablet — CSS oculta en desktop (display:none en ≥1024px) */}
      <div className="header-logos" aria-hidden="true">
        <img src="/logos/UNAM.svg" alt="UNAM" className="header-logo--unam" />
        <img src="/logos/FAD.svg"  alt="FAD"  className="header-logo--fad"  />
      </div>

      {/* Título fijo + subtítulo dinámico por ruta */}
      <div className="header-left">
        <h1 id="pageTitle">Catálogo de Obra Serigráfica</h1>
        <p id="pageSubtitle">{subtitle}</p>
      </div>

      {/* Spacer empuja el hamburger a la derecha */}
      <div className="header-spacer" aria-hidden="true" />

      {/* Hamburger — CSS lo muestra solo en ≤ 1023px.
          id="sidebarToggle" referenciado por el script inline de layout.jsx */}
      <button
        className="hamburger-btn"
        id="sidebarToggle"
        aria-label="Abrir menú"
        aria-expanded="false"
        aria-controls="adminSidebar"
        type="button"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
    </header>
  );
}
