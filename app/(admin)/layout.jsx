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
import SidebarNav from '@/components/admin/SidebarNav';
import SidebarFooterActions from '@/components/admin/SidebarFooterActions';
import { Menu } from 'lucide-react';

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

          {/* Nav principal — Client Component (usePathname + <Link> SPA) */}
          <SidebarNav rol={rol} />

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

            {/* Botones: Mi Perfil y Cerrar Sesión (Client Component — usa usePathname para .active) */}
            <SidebarFooterActions />
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

      {/* ── Sidebar toggle (mobile/tablet ≤ 1023px) ──────────────────────────
          Script inline — seguro en Server Component. Añade/quita .sidebar--open
          en #adminSidebar y body.sidebar-is-open según CSS de styles/admin.css. */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function () {
          var btn     = document.getElementById('sidebarToggle');
          var sidebar = document.getElementById('adminSidebar');
          var overlay = document.getElementById('sidebarOverlay');
          if (!btn || !sidebar) return;

          function openSidebar() {
            sidebar.classList.add('sidebar--open');
            document.body.classList.add('sidebar-is-open');
            btn.setAttribute('aria-expanded', 'true');
            if (overlay) overlay.style.display = 'block';
          }
          function closeSidebar() {
            sidebar.classList.remove('sidebar--open');
            document.body.classList.remove('sidebar-is-open');
            btn.setAttribute('aria-expanded', 'false');
            if (overlay) overlay.style.display = '';
          }

          btn.addEventListener('click', function () {
            sidebar.classList.contains('sidebar--open') ? closeSidebar() : openSidebar();
          });
          if (overlay) overlay.addEventListener('click', closeSidebar);
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeSidebar();
          });
        })();
      `}} />
    </>
  );
}
