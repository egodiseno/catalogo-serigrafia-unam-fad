/**
 * logs.js — Pantalla de Auditoría / Logs
 * FASE 1 — Solo ADMIN y SUPER_EDITOR
 *
 * Carga registros de `audit_logs` con filtros y paginación client-side.
 * Depende de: config.js, permisos.js (tienePermiso), error-handler.js
 * Expone: window.logsManager
 */

class LogsManager {
  constructor() {
    this._client       = null;
    this._initialized  = false;   // listeners conectados
    this.pageSize      = 10;
    this.currentPage   = 0;       // 0-based; Ver más incrementa
    this.logsActuales  = [];
    this.filtros = {
      usuario:    '',
      accion:     '',
      objeto:     '',
      fechaDesde: '',
      fechaHasta: ''
    };
  }

  get client() {
    if (!this._client) this._client = window.supabase_client;
    return this._client;
  }

  // ── Inicializar listeners (una sola vez) ───────────────
  inicializar() {
    if (!this._initialized) {
      document.getElementById('btnAplicarFiltros')
        ?.addEventListener('click', () => this.aplicarFiltros());
      document.getElementById('btnLimpiarFiltros')
        ?.addEventListener('click', () => this.limpiarFiltros());
      document.getElementById('btnVerMasLogs')
        ?.addEventListener('click', () => this.verMas());
      this._initialized = true;
    }
    // Cargar siempre que se abre la sección
    this.cargarLogs();
  }

  // ── Cargar logs desde Supabase ─────────────────────────
  async cargarLogs() {
    if (!tienePermiso('logs.ver')) {
      console.warn('[LogsManager] Sin permiso para ver logs.');
      return;
    }

    const tbody = document.getElementById('logsList');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Cargando logs…</td></tr>`;
    }

    try {
      let query = this.client
        .from('audit_logs')
        .select('*')
        .order('fecha_hora', { ascending: false });

      if (this.filtros.usuario) {
        query = query.eq('usuario_email', this.filtros.usuario);
      }
      if (this.filtros.accion) {
        query = query.eq('accion', this.filtros.accion);
      }
      if (this.filtros.objeto) {
        query = query.eq('objeto_tipo', this.filtros.objeto);
      }
      if (this.filtros.fechaDesde) {
        query = query.gte('fecha_hora', this.filtros.fechaDesde + 'T00:00:00');
      }
      if (this.filtros.fechaHasta) {
        query = query.lte('fecha_hora', this.filtros.fechaHasta + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;

      this.logsActuales = data ?? [];
      this.currentPage  = 0;
      this._actualizarDropdownUsuarios();
      this.renderLogs();

    } catch (err) {
      console.error('[LogsManager] cargarLogs:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:var(--color-danger)">Error al cargar logs: ${escHtml(err.message)}</td></tr>`;
      }
    }
  }

  // ── Renderizar tabla ───────────────────────────────────
  renderLogs() {
    const tbody = document.getElementById('logsList');
    if (!tbody) return;

    const hasta = (this.currentPage + 1) * this.pageSize;
    const visibles = this.logsActuales.slice(0, hasta);

    if (visibles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Sin logs registrados${this._hayFiltros() ? ' con ese criterio' : ''}.</td></tr>`;
    } else {
      tbody.innerHTML = visibles.map(log => {
        const fecha = new Date(log.fecha_hora)
          .toLocaleString('es-MX', {
            day:    '2-digit', month: '2-digit', year: 'numeric',
            hour:   '2-digit', minute: '2-digit'
          });

        return `
          <tr>
            <td data-label="Usuario">${escHtml(log.usuario_email)}</td>
            <td data-label="Acción"><span class="badge badge-log badge-log--${escHtml(log.accion)}">${escHtml(log.accion)}</span></td>
            <td data-label="Objeto">${escHtml(log.objeto_tipo)}</td>
            <td data-label="Nombre">${escHtml(log.objeto_nombre || '—')}</td>
            <td data-label="Fecha/Hora">${fecha}</td>
          </tr>`;
      }).join('');
    }

    // Botón "Ver más"
    const btnContainer = document.getElementById('logsVerMasContainer');
    if (btnContainer) {
      btnContainer.style.display = hasta < this.logsActuales.length ? '' : 'none';
    }

    console.log(`[LogsManager] Mostrando ${Math.min(hasta, this.logsActuales.length)} de ${this.logsActuales.length} logs`);
  }

  // ── Ver más (paginación incremental) ──────────────────
  verMas() {
    this.currentPage++;
    this.renderLogs();
  }

  // ── Poblar dropdown de usuarios ────────────────────────
  _actualizarDropdownUsuarios() {
    const select = document.getElementById('filterLogUsuario');
    if (!select) return;

    const emails = [...new Set(this.logsActuales.map(l => l.usuario_email))].sort();
    const valorActual = select.value;

    select.innerHTML =
      '<option value="">— Todos —</option>' +
      emails.map(e => `<option value="${escHtml(e)}"${e === valorActual ? ' selected' : ''}>${escHtml(e)}</option>`).join('');
  }

  // ── Aplicar filtros ────────────────────────────────────
  aplicarFiltros() {
    this.filtros = {
      usuario:    document.getElementById('filterLogUsuario')?.value  || '',
      accion:     document.getElementById('filterLogAccion')?.value   || '',
      objeto:     document.getElementById('filterLogObjeto')?.value   || '',
      fechaDesde: document.getElementById('filterLogFechaDesde')?.value || '',
      fechaHasta: document.getElementById('filterLogFechaHasta')?.value || ''
    };
    this.cargarLogs();
  }

  // ── Limpiar filtros ────────────────────────────────────
  limpiarFiltros() {
    ['filterLogUsuario','filterLogAccion','filterLogObjeto',
     'filterLogFechaDesde','filterLogFechaHasta'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.filtros = { usuario:'', accion:'', objeto:'', fechaDesde:'', fechaHasta:'' };
    this.cargarLogs();
  }

  // ── Utilidad interna ───────────────────────────────────
  _hayFiltros() {
    return Object.values(this.filtros).some(Boolean);
  }
}

// ── Escapa HTML (igual que otros CRUD) ─────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Instancia global ───────────────────────────────────────
window.logsManager = new LogsManager();

// ── Init: conectar nav-click ───────────────────────────────
function _initLogs() {
  document.querySelectorAll('[data-section="logs"]').forEach(navBtn => {
    navBtn.addEventListener('click', () => {
      setTimeout(() => window.logsManager?.inicializar(), 60);
    });
  });
  console.log('📋 logs.js listo');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initLogs);
} else {
  _initLogs();
}
