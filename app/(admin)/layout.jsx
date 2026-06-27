/**
 * app/(admin)/layout.jsx — Admin Layout (Route Group)
 *
 * Server Component. Aplica a /admin y /admin/login.
 * Estructura HTML idéntica al VanillaJS index.html:
 *
 *   .dashboard-container
 *   ├── .sidebar-overlay
 *   ├── aside.sidebar
 *   │   ├── .sidebar-header (.sidebar-logos)
 *   │   ├── nav.sidebar-nav  (.nav-item × N)
 *   │   └── .sidebar-footer
 *   │       ├── .user-info-drawer  (.user-avatar-drawer + .user-email-drawer)
 *   │       └── .sidebar-footer-actions  (Mi Perfil + Cerrar Sesión)
 *   └── main.main-content
 *       ├── header.admin-header
 *       │   ├── .header-logos   (mobile only — CSS oculta en desktop)
 *       │   ├── .header-left    (h1#pageTitle + p#pageSubtitle)
 *       │   ├── .header-spacer
 *       │   └── .hamburger-btn  (mobile only)
 *       └── .content-area       (scrollable — contiene {children})
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import '../../styles/admin.css';
import LogoutButton from '@/components/admin/LogoutButton';
import {
  LayoutDashboard, ImageIcon, Brush, Tag, Users, UserCheck,
  ToggleRight, Archive, Activity, BarChart2, Settings2,
  LayoutGrid, User, Menu,
} from 'lucide-react';

// ── Nav items — orden exacto del HTML original ──────────────────────────────
const NAV_ITEMS = [
  { section: 'dashboard',            label: 'Dashboard',         Icon: LayoutDashboard, roles: ['admin', 'super_editor'] },
  { section: 'obras',                label: 'Obras',             Icon: ImageIcon,        roles: ['admin', 'super_editor'] },
  { section: 'tecnicas',             label: 'Técnicas',          Icon: Brush,            roles: ['admin', 'super_editor'] },
  { section: 'tags',                 label: 'Tags',              Icon: Tag,              roles: ['admin', 'super_editor'] },
  { section: 'usuarios',             label: 'Usuarios',          Icon: Users,            roles: ['admin', 'super_editor'] },
  { section: 'registros-pendientes', label: 'Registros',         Icon: UserCheck,        roles: ['admin', 'super_editor'] },
  { section: 'control-registro',     label: 'Control Registro',  Icon: ToggleRight,      roles: ['admin', 'super_editor'] },
  { section: 'historial-alumnos',    label: 'Historial Alumnos', Icon: Archive,          roles: ['admin'] },
  { section: 'logs',                 label: 'Logs',              Icon: Activity,         roles: ['admin'] },
  { section: 'estadisticas',         label: 'Estadísticas',      Icon: BarChart2,        roles: ['admin', 'super_editor'] },
  { section: 'configuracion',        label: 'Configuración',     Icon: Settings2,        roles: ['admin'] },
  { section: 'mi-portafolio',        label: 'Mi Portafolio',     Icon: LayoutGrid,       roles: ['editor'] },
];

// ── Rutas Next.js por sección ────────────────────────────────────────────────
const SECTION_ROUTES = {
  'dashboard':            '/admin',
  'obras':                '/admin/obras',
  'tecnicas':             '/admin/tecnicas',
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
  // Pathname inyectado por middleware.js → distingue /admin/login del resto
  const headersList = headers();
  const pathname = headersList.get('x-pathname') || '';
  const isLoginPage = pathname === '/admin/login';

  // ── Auth check ──────────────────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isLoginPage) redirect('/admin/login');
  if (user && isLoginPage)   redirect('/admin');

  // Sin sesión → solo render del formulario de login (sin shell admin)
  if (!user) {
    return (
      <>
        <style>{`.site-header, .site-footer { display: none !important; }`}</style>
        {children}
      </>
    );
  }

  // ── Verificar usuarios_admin ─────────────────────────────────────────────────
  const { data: adminUser } = await supabase
    .from('usuarios_admin')
    .select('nombre, rol, email, estado')
    .eq('email', user.email)
    .single();

  if (!adminUser || adminUser.estado !== 'activo') {
    await supabase.auth.signOut();
    redirect('/admin/login');
  }

  const { nombre, rol } = adminUser;

  // Avatar: inicial del primer nombre
  const inicial     = nombre ? nombre.trim().charAt(0).toUpperCase() : (user.email?.charAt(0).toUpperCase() ?? 'U');
  // Nombre corto: primeras dos palabras
  const nombreCorto = nombre
    ? nombre.split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
    : user.email;

  return (
    <>
      {/* Ocultar header/footer del sitio público */}
      <style>{`.site-header, .site-footer { display: none !important; }`}</style>

      {/* ── Shell del admin — idéntico a VanillaJS index.html ─────────────── */}
      <div className="dashboard-container">

        {/* Overlay mobile (cierra sidebar al tocar fuera) */}
        <div className="sidebar-overlay" id="sidebarOverlay" aria-hidden="true" />

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
                alt="Facultad de Artes y Diseño"
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
              const href     = SECTION_ROUTES[section] || '/admin';
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

          {/* Footer del sidebar: avatar + acciones — idéntico a VanillaJS */}
          <div className="sidebar-footer">
            {/* Info del usuario (drawer) */}
            <div className="user-info-drawer">
              <div className="user-avatar-drawer" id="userAvatarDrawer" aria-hidden="true">
                {inicial}
              </div>
              <span className="user-email-drawer" id="userEmailDrawer">
                {nombreCorto}
              </span>
            </div>

            {/* Botones: Mi Perfil y Cerrar Sesión */}
            <div className="sidebar-footer-actions">
              <a
                href="/admin/perfil"
                className="btn btn-tertiary btn-block"
                id="userProfileMobileBtn"
              >
                <User size={16} aria-hidden="true" /> Mi Perfil
              </a>
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* ── Área principal (header + contenido) ─────────────────────────── */}
        <main className="main-content">

          {/* Header superior — sin info de usuario (vive en sidebar-footer) */}
          <header className="admin-header">
            {/* Logos mobile/tablet — CSS oculta en desktop (display:none por defecto) */}
            <div className="header-logos" aria-hidden="true">
              <img src="/logos/UNAM.svg" alt="UNAM" className="header-logo--unam" />
              <img src="/logos/FAD.svg"  alt="FAD"  className="header-logo--fad"  />
            </div>

            {/* Título de la sección */}
            <div className="header-left">
              <h1 id="pageTitle">Catálogo de Obra Serigráfica</h1>
              <p id="pageSubtitle">Panel de administración</p>
            </div>

            {/* Spacer empuja el hamburger a la derecha */}
            <div className="header-spacer" aria-hidden="true" />

            {/* Hamburger — CSS lo muestra solo en ≤ 1023px */}
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

          {/* Área de contenido scrollable */}
          <div className="content-area" id="contenido">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
