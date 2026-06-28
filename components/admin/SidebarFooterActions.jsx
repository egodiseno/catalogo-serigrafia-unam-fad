'use client';

/**
 * components/admin/SidebarFooterActions.jsx
 *
 * Botones del footer del sidebar: "Mi Perfil" (con estado activo vía usePathname)
 * y "Cerrar Sesión". Extraído de layout.jsx (Server Component) para poder usar
 * usePathname() — igual que SidebarNav.jsx usa para los ítems del nav principal.
 *
 * Active class: `.active` (verif. admin.css → #userProfileMobileBtn.active)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import LogoutButton from '@/components/admin/LogoutButton';

export default function SidebarFooterActions() {
  const pathname       = usePathname() || '';
  const isProfileActive = pathname === '/admin/mi-perfil';

  return (
    <div className="sidebar-footer-actions">
      <Link
        href="/admin/mi-perfil"
        className={`btn btn-tertiary btn-block${isProfileActive ? ' active sidebar-btn-active' : ''}`}
        id="userProfileMobileBtn"
        aria-current={isProfileActive ? 'page' : undefined}
      >
        <User size={16} aria-hidden="true" /> Mi Perfil
      </Link>
      <LogoutButton />
    </div>
  );
}
