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
    dashboard: { title: 'Catálogo de Obra Serigráfica', subtitle: 'Resumen del catálogo' },
    obras:     { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar obras' },
    tecnicas:  { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar técnicas' },
    tags:      { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar tags' },
    usuarios:  { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar usuarios' },
  };

  // ============ FUNCIÓN: Mostrar sección ============
  function showSection(sectionId) {
    // Ocultar todas las secciones
    sections.forEach(section => section.classList.remove('active'));

    // Mostrar sección seleccionada
    const section = document.getElementById(`${sectionId}Section`);
    if (section) {
      section.classList.add('active');
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

    // Guardar en sessionStorage (para mantener sección si recarga)
    sessionStorage.setItem('currentSection', sectionId);
  }

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

  // ════ USUARIO — DESKTOP + MOBILE/TABLET ════════════════════════════════════

  const userEmailEl  = document.getElementById('userEmail');
  const userEmailVal = userEmailEl?.textContent?.trim() || 'user@example.com';
  const userInitial  = userEmailVal.charAt(0).toUpperCase();

  // ── DESKTOP: Avatar inicial + Dropdown ──────────────────────────────────
  const userAvatarBtn   = document.getElementById('userAvatarBtn');
  const userDropdown    = document.getElementById('userDropdown');
  const userInitialSpan = document.getElementById('userInitial');

  if (userAvatarBtn && userDropdown) {
    if (userInitialSpan) userInitialSpan.textContent = userInitial;

    userAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
      if (!userAvatarBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('visible');
      }
    });

    document.getElementById('logoutDropdownBtn')?.addEventListener('click', () => {
      userDropdown.classList.remove('visible');
      document.getElementById('logoutBtn')?.click();
    });
  }

  // ── MOBILE/TABLET: Inicial y email en drawer ─────────────────────────────
  const userAvatarDrawer = document.getElementById('userAvatarDrawer');
  const userEmailDrawer  = document.getElementById('userEmailDrawer');

  if (userAvatarDrawer) userAvatarDrawer.textContent = userInitial;
  if (userEmailDrawer)  userEmailDrawer.textContent  = userEmailVal;

  // ── Sincronizar cuando auth.js actualice #userEmail ──────────────────────
  if (userEmailEl) {
    const syncUserEmail = () => {
      const email   = userEmailEl.textContent.trim();
      const initial = email.charAt(0).toUpperCase();
      if (userInitialSpan)  userInitialSpan.textContent  = initial;
      if (userAvatarDrawer) userAvatarDrawer.textContent = initial;
      if (userEmailDrawer)  userEmailDrawer.textContent  = email;
    };
    const observer = new MutationObserver(syncUserEmail);
    observer.observe(userEmailEl, { childList: true, characterData: true, subtree: true });
  }

});
