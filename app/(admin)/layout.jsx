/**
 * app/(admin)/layout.jsx — Admin Layout (Route Group)
 *
 * Server Component. Aplica a /admin y /admin/login (Route Group sin URL prefix).
 * - Importa styles/admin.css solo aquí (no en root layout).
 * - Verifica sesión con Supabase server-side.
 * - Oculta header/footer del sitio público.
 * - Renderiza sidebar + header del admin cuando hay sesión activa.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import '../../styles/admin.css';
import LogoutButton from '@/components/admin/LogoutButton';
import {
  LayoutDashboard, Image, Brush, Tag, Users, UserCheck,
  ToggleRight, Archive, Activity, BarChart2, Settings2,
  LayoutGrid, User,
} from 'lucide-react';

// Visibilidad del sidebar por rol — idéntica a navigation.js sectionVisibility
const SECTION_VISIBILITY = {
  'dashboard':             ['admin', 'super_editor'],
  'obras':                 ['admin', 'super_editor'],
  'tecnicas':             ['admin', 'super_editor'],
  'tags':                  ['admin', 'super_editor'],
  'usuarios':              ['admin', 'super_editor'],
  'registros-pendientes':  ['admin', 'super_editor'],
  'control-registro':      ['admin', 'super_editor'],
  'historial-alumnos':     ['admin'],
  'logs':                  ['admin'],
  'estadisticas':          ['admin', 'super_editor'],
  'configuracion':         ['admin'],
  'mi-portafolio':         ['editor'],
  // mi-perfil: siempre visible, se renderiza en sidebar-footer
};

// Items del sidebar en el orden exacto del HTML original (navigation.js)
const NAV_ITEMS = [
  { section: 'dashboard',            label: 'Dashboard',        Icon: LayoutDashboard, roles: ['admin', 'super_editor'] },
  { section: 'obras',                label: 'Obras',            Icon: Image,           roles: ['admin', 'super_editor'] },
  { section: 'tecnicas',            label: 'Técnicas',         Icon: Brush,           roles: ['admin', 'super_editor'] },
  { section: 'tags',                 label: 'Tags',             Icon: Tag,             roles: ['admin', 'super_editor'] },
  { section: 'usuarios',             label: 'Usuarios',         Icon: Users,           roles: ['admin', 'super_editor'] },
  { section: 'registros-pendientes', label: 'Registros',        Icon: UserCheck,       roles: ['admin', 'super_editor'] },
  { section: 'control-registro',     label: 'Control Registro', Icon: ToggleRight,     roles: ['admin', 'super_editor'] },
  { section: 'historial-alumnos',    label: 'Historial Alumnos',Icon: Archive,         roles: ['admin'] },
  { section: 'logs',                 label: 'Logs',             Icon: Activity,        roles: ['admin'] },
  { section: 'estadisticas',         label: 'Estadísticas',     Icon: BarChart2,       roles: ['admin', 'super_editor'] },
  { section: 'configuracion',        label: 'Configuración',    Icon: Settings2,       roles: ['admin'] },
  { section: 'mi-portafolio',        label: 'Mi Portafolio',    Icon: LayoutGrid,      roles: ['editor'] },
];

// Rutas de Next.js para cada sección del admin
const SECTION_ROUTES = {
  'dashboard':            '/admin',
  'obras':                '/admin/obras',
  'tecnicas':            '/admin/tecnicas',
  'tags':                 '/admin/tags',
  'usuarios':             '/admin/usuarios',
  'registros-pendientes': '/admin/registros-pendientes',
  'control-registro':     '/admin/control-registro',
  'historial-alumnos':    '/admin/historial-alumnos',
  'logs':                 '/admin/logs',
  'estadisticas':         '/admin/estadisticas',
  'configuracion':        '/admin/configuracion',
  'mi-portafolio':        '/admin/portafolio',
  'mi-perfil':            '/admin/perfil',
};

export default async function AdminLayout({ children }) {
  // Leer pathname inyectado por middleware.js (x-pathname header)
  const headersList = headers();
  const pathname = headersList.get('x-pathname') || '';
  const isLoginPage = pathname === '/admin/login';

  // ── Auth check ──────────────────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Sin sesión → redirigir a login (excepto si ya estamos en login)
  if (!user && !isLoginPage) {
    redirect('/admin/login');
  }

  // Con sesión en la página de login → redirigir al dashboard
  if (user && isLoginPage) {
    redirect('/admin');
  }

  // Si no hay sesión (y estamos en login), renderizar solo el children (formulario)
  if (!user) {
    return (
      <>
        <style>{`.site-header, .site-footer { display: none !important; }`}</style>
        {children}
      </>
    );
  }

  // ── Usuario en usuarios_admin ────────────────────────────────────────────────
  const { data: adminUser, error: adminUserError } = await supabase
    .from('usuarios_admin')
    .select('nombre, rol, email, estado')
    .eq('email', user.email)
    .single();

  // Si no existe en usuarios_admin o está inactivo → signOut + redirect login
  if (!adminUser || adminUser.estado !== 'activo') {
    await supabase.auth.signOut();
    redirect('/admin/login');
  }

  const { nombre, rol } = adminUser;

  // Inicial para el avatar del sidebar
  const inicial = nombre ? nombre.trim().charAt(0).toUpperCase() : (user.email?.charAt(0).toUpperCase() ?? 'U');
  // Nombre abreviado (primeras dos palabras)
  const nombreCorto = nombre
    ? nombre.split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
    : user.email;

  return (
    <>
      {/* Ocultar header/footer del sitio público */}
      <style>{`.site-header, .site-footer { display: none !important; }`}</style>

      {/* ── Shell del admin ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', minHeight: '100vh' }}>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="sidebar" id="adminSidebar" aria-label="Navegación del panel admin">

          {/* Logos UNAM / FAD */}
          <div className="sidebar-header">
            <div className="sidebar-logos">
              <img
                src="/logos/UNAM.svg"
                alt="UNAM"
                className="sidebar-logo--unam"
                width="60"
                height="40"
              />
              <div className="sidebar-logos-sep" aria-hidden="true" />
              <img
                src="/logos/FAD.svg"
                alt="FAD"
                className="sidebar-logo--fad"
                width="80"
                height="40"
              />
            </div>
          </div>

          {/* Nav principal */}
          <nav className="sidebar-nav" aria-label="Secciones del admin">
            {NAV_ITEMS.map(({ section, label, Icon, roles }) => {
              if (!roles.includes(rol)) return null;
              const href = SECTION_ROUTES[section] || '/admin';
              const isActive = pathname === href || (section === 'dashboard' && pathname === '/admin');
              return (
                <a
                  key={section}
                  href={href}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  data-section={section}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="nav-label">{label}</span>
                </a>
              );
            })}
          </nav>

          {/* Footer del sidebar: avatar + acciones */}
          <div className="sidebar-footer">
            <div className="sidebar-footer-actions">
              <a href="/admin/perfil" className="btn btn-secondary btn-sm">
                <User size={16} aria-hidden="true" /> Mi Perfil
              </a>
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* Overlay mobile */}
        <div className="sidebar-overlay" id="sidebarOverlay" aria-hidden="true" />

        {/* ── Área de contenido principal ─────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Header superior */}
          <header className="admin-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Hamburger mobile (manejado por JS en client component futuro) */}
              <button
                id="sidebarToggle"
                className="btn btn-secondary btn-sm"
                aria-label="Abrir menú"
                aria-expanded="false"
                aria-controls="adminSidebar"
                style={{ display: 'none' }}  /* visible desde CSS a < 1024px */
              >
                ☰
              </button>
              <div>
                <span id="pageTitle" style={{ fontWeight: 600 }}>
                  Catálogo de Obra Serigráfica
                </span>
              </div>
            </div>

            {/* Info del usuario */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--color-accent)',
                  color: '#fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: 14,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {inicial}
              </span>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{nombreCorto}</span>
              <LogoutButton />
            </div>
          </header>

          {/* Contenido de la página */}
          <main id="contenido" style={{ flex: 1, overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
