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

  // ── Textos de secciones ───────────────────────────────────────────────────
  const sectionTitles = {
    dashboard:             { title: 'Catálogo de Obra Serigráfica', subtitle: 'Resumen del catálogo' },
    obras:                 { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar obras' },
    tecnicas:              { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar técnicas' },
    tags:                  { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar tags' },
    usuarios:              { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar usuarios' },
    logs:                  { title: 'Catálogo de Obra Serigráfica', subtitle: 'Logs de auditoría' },
    'mi-perfil':           { title: 'Catálogo de Obra Serigráfica', subtitle: 'Mi perfil' },
    'mi-portafolio':       { title: 'Catálogo de Obra Serigráfica', subtitle: 'Mi portafolio' },
    'configuracion':       { title: 'Catálogo de Obra Serigráfica', subtitle: 'Configuración' },
    'registros-pendientes':{ title: 'Catálogo de Obra Serigráfica', subtitle: 'Registros pendientes de validación' },
    'control-registro':    { title: 'Catálogo de Obra Serigráfica', subtitle: 'Control de registro de alumnos' },
    'historial-alumnos':   { title: 'Catálogo de Obra Serigráfica', subtitle: 'Historial de alumnos' },
    'estadisticas':        { title: 'Catálogo de Obra Serigráfica', subtitle: 'Estadísticas de visitas y engagement' },
  };

  // ── Matriz de visibilidad por rol ─────────────────────────────────────────
  // Fuente de verdad centralizada: qué roles pueden VER cada sección del nav.
  // Se sincroniza con los data-show-for-roles del HTML pero aquí es authoritative
  // para la lógica de redirección automática cuando se cambia de rol.
  const sectionVisibility = {
    // dashboard y obras: solo admin/super_editor
    // (editor solo tiene acceso a su portafolio propio — permisos.js: dashboard.ver=false)
    'dashboard':             ['admin', 'super_editor'],
    'obras':                 ['admin', 'super_editor'],
    'tecnicas':              ['admin', 'super_editor'],
    'tags':                  ['admin', 'super_editor'],
    'usuarios':              ['admin', 'super_editor'],
    'registros-pendientes':  ['admin', 'super_editor'],
    'historial-alumnos':     ['admin'],
    'logs':                  ['admin'],
    'estadisticas':          ['admin', 'super_editor'],
    'configuracion':         ['admin'],
    'control-registro':      ['admin', 'super_editor'],
    'mi-perfil':             ['admin', 'super_editor', 'editor'],  // siempre visible
    'mi-portafolio':         ['editor'],
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
      // Renderizar botones de acciones rápidas según rol actual
      window.renderActionsByRole?.();
    }
    if (sectionId === 'mi-portafolio') {
      window.portafolioManager?.inicializar();
    }
    if (sectionId === 'configuracion') {
      window.configuracionManager?.inicializar();
    }
    if (sectionId === 'registros-pendientes') {
      window.RegistrosPendientes?.inicializar();
    } else {
      // Detener auto-refresh al salir de la sección de registros
      window.RegistrosPendientes?.detener();
    }
    if (sectionId === 'control-registro') {
      window.controlRegistroManager?.inicializar();
    }
    if (sectionId === 'historial-alumnos') {
      window.HistorialAlumnos?.inicializar();
    }
    if (sectionId === 'estadisticas') {
      window.EstadisticasManager?.inicializar();
    }

    // Guardar en sessionStorage (para mantener sección si recarga)
    sessionStorage.setItem('currentSection', sectionId);
  }

  // ── applyNavVisibility ────────────────────────────────────────────────────
  // Muestra u oculta cada ítem del nav según la matriz sectionVisibility.
  // Llama también a la lógica de redirección si la sección activa queda oculta.
  function applyNavVisibility(rol) {
    if (!rol) return;

    navItems.forEach(item => {
      const sectionId = item.dataset.section;
      if (!sectionId) return;
      const allowed = sectionVisibility[sectionId];
      if (!allowed) return;   // sección sin regla → no tocar
      item.style.display = allowed.includes(rol) ? '' : 'none';
    });

    // Si la sección guardada ya no es visible para este rol, redirigir
    const currentSection    = sessionStorage.getItem('currentSection') || 'dashboard';
    const allowedForCurrent = sectionVisibility[currentSection];
    if (allowedForCurrent && !allowedForCurrent.includes(rol)) {
      // Buscar la primera sección "principal" (no meta-secciones) permitida para este rol.
      // Si no hay ninguna (rol editor), usar 'mi-portafolio' o 'dashboard' como último recurso.
      const mainSection = Object.keys(sectionVisibility).find(s =>
        sectionVisibility[s].includes(rol) && !['mi-perfil', 'mi-portafolio'].includes(s)
      );
      const fallback = mainSection
        ?? (sectionVisibility['mi-portafolio']?.includes(rol) ? 'mi-portafolio' : 'dashboard');
      console.log(`[Nav] "${currentSection}" no disponible para "${rol}" → redirigiendo a "${fallback}"`);
      showSection(fallback);
    }

    console.log(`[Nav] Visibilidad aplicada para rol: ${rol}`);
  }

  // ── Exponer globalmente ────────────────────────────────────────────────────
  window.showSection = showSection;
  window.Navigation  = { applyNavVisibility, showSection };

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

  const userEmailEl       = document.getElementById('userEmail');
  const userDisplayNameEl = document.getElementById('userDisplayName');
  const userAvatarDrawer  = document.getElementById('userAvatarDrawer');
  const userEmailDrawer   = document.getElementById('userEmailDrawer');

  // Función de sincronización — lee los spans ocultos y actualiza el drawer
  function _syncUserDrawer() {
    const nombre = userDisplayNameEl?.textContent?.trim() || '';
    const email  = userEmailEl?.textContent?.trim() || 'user@example.com';

    if (nombre) {
      // Mostrar "Nombre PrimerApellido" (primeras dos palabras del nombre completo)
      const partes  = nombre.split(/\s+/).filter(Boolean);
      const display = partes.slice(0, 2).join(' ');
      const initial = partes[0].charAt(0).toUpperCase();
      if (userAvatarDrawer) userAvatarDrawer.textContent = initial;
      if (userEmailDrawer)  userEmailDrawer.textContent  = display;
    } else {
      // Fallback: usar email cuando el nombre no está disponible
      const initial = email.charAt(0).toUpperCase();
      if (userAvatarDrawer) userAvatarDrawer.textContent = initial;
      if (userEmailDrawer)  userEmailDrawer.textContent  = email;
    }
  }

  // Inicializar con valor actual
  _syncUserDrawer();

  // Observar cambios de auth.js y profile.js sobre #userEmail y #userDisplayName
  const _observerTargets = [userEmailEl, userDisplayNameEl].filter(Boolean);
  if (_observerTargets.length) {
    const observer = new MutationObserver(_syncUserDrawer);
    _observerTargets.forEach(el =>
      observer.observe(el, { childList: true, characterData: true, subtree: true })
    );
  }

  // ── "Mi Perfil" en sidebar footer → navegar a la sección ─────────────────
  document.getElementById('userProfileMobileBtn')?.addEventListener('click', () => {
    showSection('mi-perfil');
    closeSidebar();
  });

});
