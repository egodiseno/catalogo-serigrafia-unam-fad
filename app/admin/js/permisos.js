/**
 * permisos.js — Sistema de permisos por rol
 * FASE 1 — Roles: ADMIN / SUPER_EDITOR / EDITOR
 *
 * Define qué puede hacer cada rol en la plataforma.
 * Expone globalmente: tienePermiso(), getRolActual(), inicializarPermisos(), renderSidebarByRole()
 *
 * Depende de: window.usuarioActual (seteado por auth.js en login / session restore)
 */

const PERMISOS = {
  admin: {
    // Dashboard
    'dashboard.ver': true,

    // Obras
    'obras.ver_todas':     true,
    'obras.crear':         true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  true,
    'obras.borrar':        true,

    // Técnicas
    'tecnicas.ver':    true,
    'tecnicas.crear':  true,
    'tecnicas.editar': true,
    'tecnicas.borrar': true,

    // Tags
    'tags.ver':    true,
    'tags.crear':  true,
    'tags.editar': true,
    'tags.borrar': true,

    // Usuarios
    'usuarios.ver':    true,
    'usuarios.crear':  true,
    'usuarios.editar': true,
    'usuarios.borrar': true,

    // Logs
    'logs.ver': true,

    // Portafolio — ADMIN no usa portafolio
    'portafolio.ver': false,

    // Especiales
    'cambiar_rol':     true,
    'ver_todos_datos': true,
  },

  super_editor: {
    // Dashboard
    'dashboard.ver': true,

    // Obras
    'obras.ver_todas':     true,
    'obras.crear':         true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  true,
    'obras.borrar':        false,

    // Técnicas
    'tecnicas.ver':    true,
    'tecnicas.crear':  true,
    'tecnicas.editar': true,
    'tecnicas.borrar': false,

    // Tags
    'tags.ver':    true,
    'tags.crear':  true,
    'tags.editar': true,
    'tags.borrar': false,

    // Usuarios — solo ADMIN gestiona usuarios
    'usuarios.ver':    false,
    'usuarios.crear':  false,
    'usuarios.editar': false,
    'usuarios.borrar': false,

    // Logs
    'logs.ver': true,

    // Portafolio — SUPER_EDITOR no usa portafolio
    'portafolio.ver': false,

    // Especiales
    'cambiar_rol':     false,
    'ver_todos_datos': true,
  },

  editor: {
    // Dashboard — sin acceso (redirige a Mi Portafolio)
    'dashboard.ver': false,

    // Obras (SOLO PROPIAS — flujo editorial: crea en "En Revisión")
    'obras.ver_todas':     false,
    'obras.ver_propias':   true,
    'obras.crear':         true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  false,
    'obras.borrar':        false,

    // Técnicas — sin acceso (nav oculto)
    'tecnicas.ver':    false,
    'tecnicas.crear':  false,
    'tecnicas.editar': false,
    'tecnicas.borrar': false,

    // Tags — sin acceso (nav oculto)
    'tags.ver':    false,
    'tags.crear':  false,
    'tags.editar': false,
    'tags.borrar': false,

    // Usuarios — sin acceso
    'usuarios.ver':    false,
    'usuarios.crear':  false,
    'usuarios.editar': false,
    'usuarios.borrar': false,

    // Logs — sin acceso
    'logs.ver': false,

    // Portafolio — EDITOR solo usa Mi Portafolio
    'portafolio.ver': true,

    // Especiales
    'cambiar_rol':     false,
    'ver_todos_datos': false,
  }
};

/**
 * Obtener rol del usuario actual.
 * @returns {string} 'admin' | 'super_editor' | 'editor'
 */
function getRolActual() {
  return window.usuarioActual?.rol || 'editor';
}

/**
 * Verificar si el usuario actual tiene un permiso.
 * @param {string} permiso — ej: 'obras.borrar'
 * @returns {boolean}
 */
function tienePermiso(permiso) {
  const rol = getRolActual();
  return PERMISOS[rol]?.[permiso] ?? false;
}

/**
 * Mostrar u ocultar TODOS los elementos que coincidan con el selector
 * según si el usuario tiene el permiso indicado.
 *
 * @param {string} selector — selector CSS (puede retornar múltiples elementos)
 * @param {string} permiso  — nombre del permiso
 */
function controlarVisibilidad(selector, permiso) {
  const elementos = document.querySelectorAll(selector);
  if (!elementos.length) return;

  const visible = tienePermiso(permiso);
  elementos.forEach(el => {
    if (visible) {
      el.style.display = '';
      el.removeAttribute('disabled');
    } else {
      el.style.display = 'none';
      el.setAttribute('disabled', 'disabled');
    }
  });
}

/**
 * Muestra/oculta elementos del sidebar según data-show-for-roles y rol actual.
 * Uso en HTML: <button data-show-for-roles="admin,super_editor">
 * Si el rol actual no está en la lista, el elemento se oculta.
 */
function renderSidebarByRole() {
  const rol = getRolActual();
  document.querySelectorAll('[data-show-for-roles]').forEach(el => {
    const roles = el.dataset.showForRoles.split(',').map(r => r.trim());
    el.style.display = roles.includes(rol) ? '' : 'none';
  });
}

/**
 * Aplicar todos los controles de visibilidad en la página actual.
 * Llamar: (1) tras login/checkAuth, (2) tras renderizar cada tabla dinámica.
 */
function inicializarPermisos() {
  const rol = getRolActual();
  console.log(`🔒 Permisos inicializados — rol: ${rol}`);

  // ── Sidebar: visibilidad por rol (data-show-for-roles) ─
  renderSidebarByRole();

  // ── Botones CRUD con data-permiso ──────────────────────
  controlarVisibilidad('[data-permiso="obras.crear"]',    'obras.crear');
  controlarVisibilidad('[data-permiso="obras.borrar"]',   'obras.borrar');
  controlarVisibilidad('[data-permiso="tecnicas.crear"]', 'tecnicas.crear');
  controlarVisibilidad('[data-permiso="tecnicas.borrar"]','tecnicas.borrar');
  controlarVisibilidad('[data-permiso="tags.crear"]',     'tags.crear');
  controlarVisibilidad('[data-permiso="tags.borrar"]',    'tags.borrar');
  controlarVisibilidad('[data-permiso="usuarios.crear"]', 'usuarios.crear');
  controlarVisibilidad('[data-permiso="usuarios.borrar"]','usuarios.borrar');

  // ── Nav sidebar: secciones sin data-show-for-roles ─────

  // Dashboard — solo ADMIN / SUPER_EDITOR
  _navSiPermiso('dashboard', 'dashboard.ver');

  // Técnicas — solo ADMIN / SUPER_EDITOR
  _navSiPermiso('tecnicas', 'tecnicas.ver');

  // Tags — solo ADMIN / SUPER_EDITOR
  _navSiPermiso('tags', 'tags.ver');

  // Usuarios — solo ADMIN (+ ocultar sección)
  _navSiPermiso('usuarios', 'usuarios.ver', 'usuariosSection');

  // Logs — solo ADMIN / SUPER_EDITOR
  _navSiPermiso('logs', 'logs.ver');

  // ── Sección Mi Portafolio (content) ────────────────────
  // El nav-item usa data-show-for-roles → ya controlado por renderSidebarByRole()
  // Aquí solo controlamos si la sección puede mostrarse
  const portafolioSection = document.getElementById('miPortafolioSection');
  if (portafolioSection) {
    portafolioSection.style.display = tienePermiso('portafolio.ver') ? '' : 'none';
  }

  // ── FALLBACK: si la sección activa quedó oculta → ir a portafolio o obras
  const seccionActiva = sessionStorage.getItem('currentSection') || 'dashboard';
  const navActivo = document.querySelector(`[data-section="${seccionActiva}"]`);
  if (navActivo && navActivo.style.display === 'none') {
    const destino = tienePermiso('portafolio.ver') ? 'mi-portafolio' : 'obras';
    console.log(`[Permisos] "${seccionActiva}" oculta para rol "${rol}" → redirigiendo a ${destino}`);
    window.showSection?.(destino);
  }
}

/**
 * Muestra/oculta nav-item(s) con data-section=seccion según permiso.
 * Omite los que ya tienen data-show-for-roles (manejados por renderSidebarByRole).
 * @param {string} seccion     — valor de data-section
 * @param {string} permiso     — clave de permiso
 * @param {string} [sectionId] — ID del elemento de sección (sin #)
 */
function _navSiPermiso(seccion, permiso, sectionId) {
  const visible = tienePermiso(permiso);
  document.querySelectorAll(`[data-section="${seccion}"]`).forEach(el => {
    if (!el.dataset.showForRoles) {
      el.style.display = visible ? '' : 'none';
    }
  });
  if (sectionId) {
    const secEl = document.getElementById(sectionId);
    if (secEl) secEl.style.display = visible ? '' : 'none';
  }
}

// ── Exponer globalmente ────────────────────────────────────
window.tienePermiso        = tienePermiso;
window.getRolActual        = getRolActual;
window.inicializarPermisos = inicializarPermisos;
window.renderSidebarByRole = renderSidebarByRole;

console.log('🔒 permisos.js cargado');
