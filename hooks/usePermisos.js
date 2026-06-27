'use client';

/**
 * hooks/usePermisos.js — Matriz de permisos por rol
 *
 * Replica EXACTAMENTE la constante PERMISOS de permisos.js (VanillaJS).
 * Retorna: tienePermiso(key) → boolean
 *
 * Uso:
 *   const { tienePermiso } = usePermisos(rol);
 *   if (tienePermiso('obras.crear')) { ... }
 */

import { useMemo } from 'react';

// ── Matriz de permisos — fuente de verdad idéntica a permisos.js ─────────────
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

    // Registros pendientes — admin + super_editor
    'registros.ver':      true,
    'registros.validar':  true,
    'registros.rechazar': true,

    // Historial de alumnos — admin + super_editor
    'historial_alumnos.ver': true,

    // Control de registro — solo ADMIN
    'control_registro.ver':    true,
    'control_registro.editar': true,

    // Logs
    'logs.ver': true,

    // Estadísticas — admin + super_editor
    'estadisticas.ver': true,

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

    // Usuarios — puede gestionar usuarios NO-admin (restricciones en runtime)
    'usuarios.ver':    true,
    'usuarios.crear':  true,
    'usuarios.editar': true,
    'usuarios.borrar': true,

    // Registros pendientes — admin + super_editor
    'registros.ver':      true,
    'registros.validar':  true,
    'registros.rechazar': true,

    // Historial de alumnos — admin + super_editor
    'historial_alumnos.ver': true,

    // Control de registro — solo ADMIN
    'control_registro.ver':    false,
    'control_registro.editar': false,

    // Logs — solo ADMIN
    'logs.ver': false,

    // Estadísticas — admin + super_editor
    'estadisticas.ver': true,

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

    // Obras (SOLO PROPIAS)
    'obras.ver_todas':     false,
    'obras.ver_propias':   true,
    'obras.crear':         true,
    'obras.editar_propia': true,
    'obras.editar_ajena':  false,
    'obras.borrar':        false,

    // Técnicas — sin acceso
    'tecnicas.ver':    false,
    'tecnicas.crear':  false,
    'tecnicas.editar': false,
    'tecnicas.borrar': false,

    // Tags — sin acceso
    'tags.ver':    false,
    'tags.crear':  false,
    'tags.editar': false,
    'tags.borrar': false,

    // Usuarios — sin acceso
    'usuarios.ver':    false,
    'usuarios.crear':  false,
    'usuarios.editar': false,
    'usuarios.borrar': false,

    // Registros — sin acceso
    'registros.ver':      false,
    'registros.validar':  false,
    'registros.rechazar': false,

    // Historial de alumnos — sin acceso
    'historial_alumnos.ver': false,

    // Control de registro — sin acceso
    'control_registro.ver':    false,
    'control_registro.editar': false,

    // Logs — sin acceso
    'logs.ver': false,

    // Estadísticas — sin acceso
    'estadisticas.ver': false,

    // Configuración — sin acceso
    'configuracion.ver':    false,
    'configuracion.editar': false,

    // Portafolio — EDITOR solo usa Mi Portafolio
    'portafolio.ver': true,

    // Especiales
    'cambiar_rol':     false,
    'ver_todos_datos': false,
  },
};

/**
 * @param {string|null} rol — 'admin' | 'super_editor' | 'editor' | null
 * @returns {{ tienePermiso: (key: string) => boolean }}
 */
export function usePermisos(rol) {
  const tienePermiso = useMemo(() => {
    return (key) => {
      if (!rol) return false;
      return PERMISOS[rol]?.[key] ?? false;
    };
  }, [rol]);

  return { tienePermiso };
}
