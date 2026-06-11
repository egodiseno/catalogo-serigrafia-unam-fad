/**
 * permisos.js — Sistema de permisos por rol
 * FASE 1 — Roles: ADMIN / SUPER_EDITOR / EDITOR
 *
 * Define qué puede hacer cada rol en la plataforma.
 * Expone globalmente: tienePermiso(), getRolActual(), inicializarPermisos()
 *
 * Depende de: window.usuarioActual (seteado por auth.js en login / session restore)
 */

const PERMISOS = {
  admin: {
    // Obras
    'obras.ver_todas':   true,
    'obras.crear':       true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  true,
    'obras.borrar':      true,

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

    // Especiales
    'cambiar_rol':    true,
    'ver_todos_datos': true,
  },

  super_editor: {
    // Obras
    'obras.ver_todas':   true,
    'obras.crear':       true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  true,
    'obras.borrar':      false,

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

    // Usuarios
    'usuarios.ver':    true,
    'usuarios.crear':  true,
    'usuarios.editar': false,
    'usuarios.borrar': true,

    // Logs
    'logs.ver': true,

    // Especiales
    'cambiar_rol':    false,
    'ver_todos_datos': true,
  },

  editor: {
    // Obras (SOLO PROPIAS)
    'obras.ver_todas':   false,
    'obras.ver_propias': true,
    'obras.crear':       true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  false,
    'obras.borrar':      false,

    // Técnicas (solo lectura)
    'tecnicas.ver':    true,
    'tecnicas.crear':  false,
    'tecnicas.editar': false,
    'tecnicas.borrar': false,

    // Tags (solo lectura)
    'tags.ver':    true,
    'tags.crear':  false,
    'tags.editar': false,
    'tags.borrar': false,

    // Usuarios (sin acceso)
    'usuarios.ver':    false,
    'usuarios.crear':  false,
    'usuarios.editar': false,
    'usuarios.borrar': false,

    // Logs (sin acceso)
    'logs.ver': false,

    // Especiales
    'cambiar_rol':    false,
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
 * Aplicar todos los controles de visibilidad en la página actual.
 * Llamar: (1) al mostrar el dashboard, (2) tras renderizar cada tabla dinámica.
 */
function inicializarPermisos() {
  const rol = getRolActual();
  console.log(`🔒 Permisos inicializados — rol: ${rol}`);

  // ── Obras ──────────────────────────────────────────────
  controlarVisibilidad('[data-permiso="obras.crear"]',  'obras.crear');
  controlarVisibilidad('[data-permiso="obras.borrar"]', 'obras.borrar');

  // ── Técnicas ───────────────────────────────────────────
  controlarVisibilidad('[data-permiso="tecnicas.crear"]',  'tecnicas.crear');
  controlarVisibilidad('[data-permiso="tecnicas.borrar"]', 'tecnicas.borrar');

  // ── Tags ───────────────────────────────────────────────
  controlarVisibilidad('[data-permiso="tags.crear"]',  'tags.crear');
  controlarVisibilidad('[data-permiso="tags.borrar"]', 'tags.borrar');

  // ── Usuarios ───────────────────────────────────────────
  controlarVisibilidad('[data-permiso="usuarios.crear"]',  'usuarios.crear');
  controlarVisibilidad('[data-permiso="usuarios.borrar"]', 'usuarios.borrar');

  // ── Sección Usuarios en sidebar ────────────────────────
  // Oculta el nav-item Y la sección completa si no tiene permiso
  if (!tienePermiso('usuarios.ver')) {
    document.querySelectorAll('[data-section="usuarios"]').forEach(el => {
      el.style.display = 'none';
    });
    const usuariosSection = document.getElementById('usuariosSection');
    if (usuariosSection) usuariosSection.style.display = 'none';
  } else {
    document.querySelectorAll('[data-section="usuarios"]').forEach(el => {
      el.style.display = '';
    });
  }

  // ── Sección Logs en sidebar ────────────────────────────
  if (!tienePermiso('logs.ver')) {
    document.querySelectorAll('[data-section="logs"]').forEach(el => {
      el.style.display = 'none';
    });
  }
}

// ── Exponer globalmente ────────────────────────────────────
window.tienePermiso       = tienePermiso;
window.getRolActual       = getRolActual;
window.inicializarPermisos = inicializarPermisos;

console.log('🔒 permisos.js cargado');
