'use client';

/**
 * components/admin/SidebarNav.jsx — Navegación del sidebar admin (Client Component)
 *
 * Extraído de layout.jsx (Server Component) para poder usar usePathname() y <Link>
 * de Next.js (navegación SPA sin recarga completa).
 *
 * Visibilidad por rol (fuente de verdad: navigation.js del VanillaJS):
 *   admin/super_editor : dashboard, obras, técnicas, tags, usuarios, registros,
 *                        control-registro, historial-alumnos, logs, estadísticas, configuración
 *   editor             : mi-portafolio ÚNICAMENTE
 *
 * "Mi Perfil" y "Cerrar Sesión" viven en .sidebar-footer del layout (NO aquí) para
 * todos los roles — replicando exactamente la estructura del VanillaJS.
 *
 * Props: { rol: string }
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ImageIcon,
  Brush,
  Tag,
  Users,
  UserCheck,
  ToggleRight,
  Archive,
  Activity,
  BarChart2,
  Settings2,
  LayoutGrid,
} from 'lucide-react';

// Orden exacto del HTML original. href = ruta Next.js de la sección.
// Nota: 'mi-perfil' NO está aquí — vive en .sidebar-footer del layout.jsx
const NAV_ITEMS = [
  { section: 'dashboard',            label: 'Dashboard',          href: '/admin',                   Icon: LayoutDashboard, roles: ['admin', 'super_editor'] },
  { section: 'obras',                label: 'Obras',              href: '/admin/obras',              Icon: ImageIcon,       roles: ['admin', 'super_editor'] },
  { section: 'tecnicas',             label: 'Técnicas',           href: '/admin/tecnicas',           Icon: Brush,           roles: ['admin', 'super_editor'] },
  { section: 'tags',                 label: 'Tags',               href: '/admin/tags',               Icon: Tag,             roles: ['admin', 'super_editor'] },
  { section: 'usuarios',             label: 'Usuarios',           href: '/admin/usuarios',           Icon: Users,           roles: ['admin', 'super_editor'] },
  { section: 'registros-pendientes', label: 'Registros',          href: '/admin/registros',          Icon: UserCheck,       roles: ['admin', 'super_editor'] },
  { section: 'control-registro',     label: 'Control Registro',   href: '/admin/control-registro',   Icon: ToggleRight,     roles: ['admin'] },
  { section: 'historial-alumnos',    label: 'Historial Alumnos',  href: '/admin/historial-alumnos',  Icon: Archive,         roles: ['admin', 'super_editor'] },
  { section: 'logs',                 label: 'Logs',               href: '/admin/logs',               Icon: Activity,        roles: ['admin'] },
  { section: 'estadisticas',         label: 'Estadísticas',       href: '/admin/estadisticas',       Icon: BarChart2,       roles: ['admin', 'super_editor'] },
  { section: 'configuracion',        label: 'Configuración',      href: '/admin/configuracion',      Icon: Settings2,       roles: ['admin'] },
  { section: 'mi-portafolio',        label: 'Mi Portafolio',      href: '/admin/mi-portafolio',      Icon: LayoutGrid,      roles: ['editor'] },
];

export default function SidebarNav({ rol }) {
  const pathname = usePathname() || '';

  return (
    <nav className="sidebar-nav" aria-label="Secciones del admin">
      {NAV_ITEMS.map(({ section, label, href, Icon, roles }) => {
        if (!roles.includes(rol)) return null;
        // Dashboard: coincidencia exacta '/admin' para no marcar todo como activo.
        // Resto: pathname.startsWith(href) detecta sub-rutas (/admin/obras/123, etc.).
        const isActive =
          section === 'dashboard'
            ? pathname === '/admin'
            : pathname.startsWith(href);
        return (
          <Link
            key={section}
            href={href}
            className={`nav-item${isActive ? ' active' : ''}`}
            data-section={section}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
