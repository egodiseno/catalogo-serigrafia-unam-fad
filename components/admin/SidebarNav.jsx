'use client';

/**
 * components/admin/SidebarNav.jsx — Navegación del sidebar admin (Client Component)
 *
 * Extraído de layout.jsx (Server Component) para poder usar usePathname() y <Link>
 * de Next.js (navegación SPA sin recarga completa).
 *
 * Los NAV_ITEMS viven aquí (no en el layout) porque los componentes de iconos no
 * pueden cruzar el límite Server → Client como props. El layout solo pasa `rol`.
 *
 * La clase activa es `nav-item active` (verificada en styles/admin.css: `.nav-item` + `active`).
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
  UserCircle2,
} from 'lucide-react';

// Orden exacto del HTML original. href = ruta Next.js de la sección.
const NAV_ITEMS = [
  { section: 'dashboard', label: 'Dashboard', href: '/admin', Icon: LayoutDashboard, roles: ['admin', 'super_editor', 'editor'] },
  { section: 'obras', label: 'Obras', href: '/admin/obras', Icon: ImageIcon, roles: ['admin', 'super_editor', 'editor'] },
  { section: 'tecnicas', label: 'Técnicas', href: '/admin/tecnicas', Icon: Brush, roles: ['admin', 'super_editor'] },
  { section: 'tags', label: 'Tags', href: '/admin/tags', Icon: Tag, roles: ['admin', 'super_editor'] },
  { section: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', Icon: Users, roles: ['admin', 'super_editor'] },
  { section: 'registros-pendientes', label: 'Registros', href: '/admin/registros', Icon: UserCheck, roles: ['admin', 'super_editor'] },
  { section: 'control-registro', label: 'Control Registro', href: '/admin/control-registro', Icon: ToggleRight, roles: ['admin'] },
  { section: 'historial-alumnos', label: 'Historial Alumnos', href: '/admin/historial-alumnos', Icon: Archive, roles: ['admin', 'super_editor'] },
  { section: 'logs', label: 'Logs', href: '/admin/logs', Icon: Activity, roles: ['admin'] },
  { section: 'estadisticas', label: 'Estadísticas', href: '/admin/estadisticas', Icon: BarChart2, roles: ['admin', 'super_editor'] },
  { section: 'configuracion', label: 'Configuración', href: '/admin/configuracion', Icon: Settings2, roles: ['admin'] },
  { section: 'mi-portafolio', label: 'Mi Portafolio', href: '/admin/mi-portafolio', Icon: LayoutGrid, roles: ['editor'] },
  { section: 'mi-perfil', label: 'Mi Perfil', href: '/admin/mi-perfil', Icon: UserCircle2, roles: ['admin', 'super_editor', 'editor'] },
];

export default function SidebarNav({ rol }) {
  const pathname = usePathname() || '';

  return (
    <nav className="sidebar-nav" aria-label="Secciones del admin">
      {NAV_ITEMS.map(({ section, label, href, Icon, roles }) => {
        if (!roles.includes(rol)) return null;
        const isActive =
          pathname === href || (section === 'dashboard' && pathname === '/admin');
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
