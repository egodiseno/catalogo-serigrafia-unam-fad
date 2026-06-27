'use client';

/**
 * LogoutButton — Client Component
 *
 * Llama a supabase.auth.signOut() y redirige a /admin/login.
 * Se usa en el Admin Layout (Server Component) como isla client-side.
 */
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    // Forzar recarga completa para limpiar cualquier estado del Server Component
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="btn btn-secondary btn-sm"
      title="Cerrar sesión"
      type="button"
    >
      <LogOut size={16} aria-hidden="true" />
      Cerrar Sesión
    </button>
  );
}
