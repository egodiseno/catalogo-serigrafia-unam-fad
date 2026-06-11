/**
 * audit-logger.js — Sistema de logging / auditoría
 * FASE 1 — Log general de acciones admin
 *
 * Registra en `audit_logs` TODAS las mutaciones realizadas por usuarios admin.
 * Depende de: config.js (window.supabase_client), permisos.js (window.usuarioActual)
 * Expone: window.auditLogger
 */

class AuditLogger {
  constructor() {
    // Se resuelve late-binding para evitar race al cargar scripts
    this._client = null;
  }

  get client() {
    if (!this._client) this._client = window.supabase_client;
    return this._client;
  }

  /**
   * Registrar una acción en audit_logs.
   *
   * @param {string} accion       'crear' | 'editar' | 'borrar' | 'login' | 'logout'
   * @param {string} objetoTipo   'obra' | 'tecnica' | 'tag' | 'usuario'
   * @param {object} opciones     { objeto_id?, objeto_nombre?, detalles? }
   * @returns {Promise<boolean>}
   */
  async registrar(accion, objetoTipo, opciones = {}) {
    if (!window.usuarioActual) {
      console.warn('[AuditLogger] Sin usuario activo — log omitido.');
      return false;
    }

    const {
      objeto_id    = null,
      objeto_nombre = '',
      detalles      = {}
    } = opciones;

    try {
      const { error } = await this.client
        .from('audit_logs')
        .insert([{
          usuario_email: window.usuarioActual.email,
          usuario_rol:   window.usuarioActual.rol,
          accion,
          objeto_tipo:   objetoTipo,
          objeto_id,
          objeto_nombre,
          detalles,
          ip_address:    'client'   // En producción: obtener IP real vía Edge Function
        }]);

      if (error) {
        console.error('[AuditLogger] Error al registrar log:', error);
        return false;
      }

      console.log(`[AuditLogger] ${accion} ${objetoTipo} — ${objeto_nombre || objeto_id}`);
      return true;

    } catch (err) {
      // El logging nunca debe romper el flujo principal
      console.error('[AuditLogger] Error inesperado:', err);
      return false;
    }
  }

  // ── Obras ──────────────────────────────────────────────

  crearObra(obraId, titulo) {
    return this.registrar('crear', 'obra', { objeto_id: obraId, objeto_nombre: titulo });
  }

  editarObra(obraId, titulo) {
    return this.registrar('editar', 'obra', { objeto_id: obraId, objeto_nombre: titulo });
  }

  borrarObra(obraId, titulo) {
    return this.registrar('borrar', 'obra', { objeto_id: obraId, objeto_nombre: titulo });
  }

  // ── Técnicas ───────────────────────────────────────────

  crearTecnica(tecnicaId, nombre) {
    return this.registrar('crear', 'tecnica', { objeto_id: tecnicaId, objeto_nombre: nombre });
  }

  editarTecnica(tecnicaId, nombre) {
    return this.registrar('editar', 'tecnica', { objeto_id: tecnicaId, objeto_nombre: nombre });
  }

  borrarTecnica(tecnicaId, nombre) {
    return this.registrar('borrar', 'tecnica', { objeto_id: tecnicaId, objeto_nombre: nombre });
  }

  // ── Tags ───────────────────────────────────────────────

  crearTag(tagId, nombre) {
    return this.registrar('crear', 'tag', { objeto_id: tagId, objeto_nombre: nombre });
  }

  editarTag(tagId, nombre) {
    return this.registrar('editar', 'tag', { objeto_id: tagId, objeto_nombre: nombre });
  }

  borrarTag(tagId, nombre) {
    return this.registrar('borrar', 'tag', { objeto_id: tagId, objeto_nombre: nombre });
  }

  // ── Usuarios ───────────────────────────────────────────

  crearUsuario(email) {
    return this.registrar('crear', 'usuario', { objeto_nombre: email });
  }

  editarUsuario(email) {
    return this.registrar('editar', 'usuario', { objeto_nombre: email });
  }

  borrarUsuario(email) {
    return this.registrar('borrar', 'usuario', { objeto_nombre: email });
  }

  // ── Sesión ─────────────────────────────────────────────

  login(email) {
    return this.registrar('login', 'usuario', { objeto_nombre: email });
  }

  logout(email) {
    return this.registrar('logout', 'usuario', { objeto_nombre: email });
  }
}

// ── Instancia global ───────────────────────────────────────
window.auditLogger = new AuditLogger();

console.log('📋 audit-logger.js cargado');
