/**
 * PHASE 1.A: Navigation Module
 * Maneja cambios de sección en el dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  // ============ ELEMENTOS DOM ============
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');

  // Textos de secciones — título siempre fijo, subtítulo describe la sección activa
  const sectionTitles = {
    dashboard:      { title: 'Catálogo de Obra Serigráfica', subtitle: 'Resumen del catálogo' },
    obras:          { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar obras' },
    tecnicas:       { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar técnicas' },
    tags:           { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar tags' },
    usuarios:       { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar usuarios' },
    logs:           { title: 'Catálogo de Obra Serigráfica', subtitle: 'Logs de auditoría' },
    'mi-perfil':    { title: 'Catálogo de Obra Serigráfica', subtitle: 'Mi perfil' },
    'mi-portafolio':{ title: 'Catálogo de Obra Serigráfica', subtitle: 'Mi portafolio' },
  };

  // ============ FUNCIÓN: Mostrar sección ============
  // kebab-case → camelCase: 'mi-perfil' → 'miPerfil'
  function toElementId(sectionId) {
    return sectionId.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Section';
  }

  function showSection(sectionId) {
    const elementId = toElementId(sectionId);   // 'mi-perfil' → 'miPerfilSection'
    console.log('[Nav] showSection():', sectionId, '→ buscando #' + elementId);
    // Ocultar todas las secciones
    sections.forEach(section => section.classList.remove('active'));

    // Mostrar sección seleccionada
    const section = document.getElementById(elementId);
    console.log('[Nav] Elemento encontrado:', section);
    if (section) {
      section.classList.add('active');
      section.style.display = '';   // Limpia cualquier inline display:none
    }

    // Actualizar título y subtitle
    if (sectionTitles[sectionId]) {
      pageTitle.textContent = sectionTitles[sectionId].title;
      pageSubtitle.textContent = sectionTitles[sectionId].subtitle;
    }

    // Actualizar estado del nav
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.section === sectionId) {
        item.classList.add('active');
      }
    });

    // ── Botones "Mi Perfil" — estado activo amarillo ────────────────────────
    const profileBtns = [
      document.getElementById('userProfileBtn'),
      document.getElementById('userProfileMobileBtn'),
    ];
    profileBtns.forEach(btn => {
      if (!btn) return;
      if (sectionId === 'mi-perfil') {
        btn.classList.add('active', 'sidebar-btn-active');
      } else {
        btn.classList.remove('active', 'sidebar-btn-active');
      }
    });

    // Callbacks por sección
    if (sectionId === 'mi-perfil') {
      console.log('[Nav] Mostrando sección: mi-perfil — profileManager:', !!window.profileManager);
      window.profileManager?.inicializar();
    }
    if (sectionId === 'mi-portafolio') {
      window.portafolioManager?.inicializar();
    }

    // Guardar en sessionStorage (para mantener sección si recarga)
    sessionStorage.setItem('currentSection', sectionId);
  }

  // ── Exponer globalmente (otros módulos llaman window.showSection) ──────────
  window.showSection = showSection;

  // ============ EVENT LISTENERS: Nav clicks ============
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      showSection(sectionId);
    });
  });

  // ============ RESTAURAR SECCIÓN ANTERIOR ============
  const savedSection = sessionStorage.getItem('currentSection') || 'dashboard';
  showSection(savedSection);

  console.log('✅ Navigation module loaded');

  // ============ HAMBURGER / SIDEBAR TOGGLE (mobile) ============
  const hamburgerBtn   = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const adminSidebar   = document.getElementById('adminSidebar');

  function openSidebar() {
    adminSidebar?.classList.add('sidebar--open');
    sidebarOverlay?.classList.add('sidebar-overlay--visible');
    hamburgerBtn?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sidebar-is-open');
  }

  function closeSidebar() {
    adminSidebar?.classList.remove('sidebar--open');
    sidebarOverlay?.classList.remove('sidebar-overlay--visible');
    hamburgerBtn?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-is-open');
  }

  hamburgerBtn?.addEventListener('click', () => {
    const isOpen = adminSidebar?.classList.contains('sidebar--open');
    isOpen ? closeSidebar() : openSidebar();
  });

  sidebarOverlay?.addEventListener('click', closeSidebar);

  // Cerrar sidebar al navegar (mobile UX)
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 1024) closeSidebar();
    });
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // ════ USUARIO — Drawer sidebar (toda resolución) ═══════════════════════════
  // El user-info ya NO está en el header (eliminado). Solo vive en sidebar-footer.
  // #userEmail es un span oculto en el header que auth.js actualiza para sincronizar.

  const userEmailEl      = document.getElementById('userEmail');
  const userAvatarDrawer = document.getElementById('userAvatarDrawer');
  const userEmailDrawer  = document.getElementById('userEmailDrawer');

  // Función de sincronización — lee el span oculto y actualiza el drawer
  function _syncUserDrawer() {
    const email   = userEmailEl?.textContent?.trim() || 'user@example.com';
    const initial = email.charAt(0).toUpperCase();
    if (userAvatarDrawer) userAvatarDrawer.textContent = initial;
    if (userEmailDrawer)  userEmailDrawer.textContent  = email;
  }

  // Inicializar con valor actual
  _syncUserDrawer();

  // Observar cambios de auth.js sobre #userEmail
  if (userEmailEl) {
    const observer = new MutationObserver(_syncUserDrawer);
    observer.observe(userEmailEl, { childList: true, characterData: true, subtree: true });
  }

  // ── "Mi Perfil" en sidebar footer → navegar a la sección ─────────────────
  document.getElementById('userProfileMobileBtn')?.addEventListener('click', () => {
    showSection('mi-perfil');
    closeSidebar();
  });

});
