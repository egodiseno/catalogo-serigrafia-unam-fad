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

    // Configuración — solo ADMIN
    'configuracion.ver':    true,
    'configuracion.editar': true,

    // Portafolio — ADMIN no usa portafolio
    'portafolio.ver': false,

    // Especiales
    'cambiar_rol':     true,
    'ver_todos_datos': true,
  },

  super_editor: {
    // Dashboard
    'dashboard.ver': true,

    // Obras — puede crear, editar y eliminar cualquier obra
    'obras.ver_todas':     true,
    'obras.crear':         true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  true,
    'obras.borrar':        true,

    // Técnicas — control total (sin borrar el catálogo base)
    'tecnicas.ver':    true,
    'tecnicas.crear':  true,
    'tecnicas.editar': true,
    'tecnicas.borrar': true,

    // Tags — control total
    'tags.ver':    true,
    'tags.crear':  true,
    'tags.editar': true,
    'tags.borrar': true,

    // Usuarios — puede gestionar usuarios NO-admin; restricciones en runtime
    // (no puede eliminar admins ni su propia cuenta — guard en usuarios-crud.js)
    'usuarios.ver':    true,
    'usuarios.crear':  true,
    'usuarios.editar': true,
    'usuarios.borrar': true,

    // Logs — solo ADMIN
    'logs.ver': false,

    // Configuración — solo ADMIN
    'configuracion.ver':    false,
    'configuracion.editar': false,

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

    // Configuración — sin acceso
    'configuracion.ver':    false,
    'configuracion.editar': false,

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
 * Muestra/oculta elementos según data-show-for-roles y rol actual.
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
 * Muestra/oculta botones de Acciones Rápidas según data-action-for-roles.
 * Uso en HTML: <button data-action-for-roles="admin,super_editor">
 * Se llama desde inicializarPermisos() y también puede invocarse manualmente
 * cuando se muestra #miPerfilSection.
 */
function renderActionsByRole() {
  const rol = getRolActual();
  document.querySelectorAll('[data-action-for-roles]').forEach(el => {
    const roles = el.dataset.actionForRoles.split(',').map(r => r.trim());
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

  // ── 1. Nav sidebar + Acciones Rápidas de Mi Perfil ─────────────
  renderSidebarByRole();
  renderActionsByRole();

  // ── 2. Botones CRUD (data-permiso) ─────────────────────
  controlarVisibilidad('[data-permiso="obras.crear"]',     'obras.crear');
  controlarVisibilidad('[data-permiso="obras.borrar"]',    'obras.borrar');
  controlarVisibilidad('[data-permiso="tecnicas.crear"]',  'tecnicas.crear');
  controlarVisibilidad('[data-permiso="tecnicas.borrar"]', 'tecnicas.borrar');
  controlarVisibilidad('[data-permiso="tags.crear"]',      'tags.crear');
  controlarVisibilidad('[data-permiso="tags.borrar"]',     'tags.borrar');
  controlarVisibilidad('[data-permiso="usuarios.crear"]',  'usuarios.crear');
  controlarVisibilidad('[data-permiso="usuarios.borrar"]', 'usuarios.borrar');

  // ── 3. Contenido de secciones — ocultar si sin permiso ─
  const usuariosSection   = document.getElementById('usuariosSection');
  const portafolioSection = document.getElementById('miPortafolioSection');
  if (usuariosSection)   usuariosSection.style.display   = tienePermiso('usuarios.ver')   ? '' : 'none';
  if (portafolioSection) portafolioSection.style.display = tienePermiso('portafolio.ver') ? '' : 'none';

  // ── 4. FALLBACK: sección activa oculta → redirigir ─────
  const seccionActiva = sessionStorage.getItem('currentSection') || 'dashboard';
  const navActivo     = document.querySelector(`[data-section="${seccionActiva}"]`);
  if (navActivo && navActivo.style.display === 'none') {
    const destino = tienePermiso('portafolio.ver') ? 'mi-portafolio' : 'obras';
    console.log(`[Permisos] "${seccionActiva}" oculta para "${rol}" → redirigiendo a ${destino}`);
    window.showSection?.(destino);
  }

  // ── Sección Mi Portafolio en sidebar ───────────────────
  if (!tienePermiso('portafolio.ver')) {
    document.querySelectorAll('[data-section="mi-portafolio"]').forEach(el => {
      el.style.display = 'none';
    });
    const portafolioSection = document.getElementById('miPortafolioSection');
    if (portafolioSection) portafolioSection.style.display = 'none';
  } else {
    document.querySelectorAll('[data-section="mi-portafolio"]').forEach(el => {
      el.style.display = '';
    });
  }
}

// ── Exponer globalmente ────────────────────────────────────
window.tienePermiso        = tienePermiso;
window.getRolActual        = getRolActual;
window.inicializarPermisos = inicializarPermisos;
window.renderSidebarByRole = renderSidebarByRole;
window.renderActionsByRole = renderActionsByRole;

console.log('🔒 permisos.js cargado');
