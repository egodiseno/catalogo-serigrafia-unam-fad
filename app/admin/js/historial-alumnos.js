/**
 * historial-alumnos.js — Historial completo de alumnos registrados
 * ──────────────────────────────────────────────────────────────────
 * Sección "Historial Alumnos" del panel admin.
 * Solo visible para rol admin.
 *
 * Funciones principales:
 *   inicializar()   — carga datos y conecta eventos
 *   cargar()        — recarga la tabla desde Supabase
 *
 * Depende de: config.js, error-handler.js, confirm-modal.js
 * Expone: window.HistorialAlumnos
 * ──────────────────────────────────────────────────────────────────
 */

const HistorialAlumnos = (() => {

  // ── Referencias ────────────────────────────────────────────────────────────
  const client = window.supabase_client;

  // ── Estado ─────────────────────────────────────────────────────────────────
  let _todos       = [];   // todos los registros cargados
  let _filtrado    = [];   // después de aplicar filtros
  let _initialized = false;

  // ── DOM helper ─────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Formato de fecha ────────────────────────────────────────────────────────
  function formatFecha(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-MX', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    });
  }

  // ── Escapar HTML (XSS) ─────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Badge de estado ─────────────────────────────────────────────────────────
  function estadoBadge(estado) {
    const map = {
      validado:             { cls: 'badge-publicado', label: 'Validado'  },
      pendiente_validacion: { cls: 'badge-borrador',  label: 'Pendiente' },
      rechazado:            { cls: 'badge-archivado', label: 'Rechazado' },
    };
    const info = map[estado] ?? { cls: 'badge-archivado', label: estado ?? '—' };
    return `<span class="badge ${info.cls}">${escHtml(info.label)}</span>`;
  }

  // ── Construir fila ──────────────────────────────────────────────────────────
  function _buildRow(r) {
    return `
      <tr data-ha-id="${escHtml(r.id)}">
        <td class="td-nombre">${escHtml(r.nombre ?? '—')}</td>
        <td class="td-cuenta">
          ${r.numero_cuenta
            ? `<code class="cuenta-code">${escHtml(String(r.numero_cuenta))}</code>`
            : '<span class="text-muted">—</span>'}
        </td>
        <td class="td-email">
          <a href="mailto:${escHtml(r.email)}" class="email-link">${escHtml(r.email)}</a>
        </td>
        <td class="td-telefono">
          ${r.telefono ? escHtml(r.telefono) : '<span class="text-muted">—</span>'}
        </td>
        <td class="td-estado">${estadoBadge(r.estado)}</td>
        <td class="td-fecha">${formatFecha(r.fecha_registro)}</td>
        <td class="actions-cell">
          <div class="action-buttons">
            <button class="btn btn-sm btn-danger btn--icon-only btn-ha-eliminar"
                    data-ha-id="${escHtml(r.id)}"
                    data-ha-nombre="${escHtml(r.nombre ?? '')}"
                    aria-label="Eliminar registro de ${escHtml(r.nombre ?? '')}">
              <i data-lucide="trash-2" style="width:14px;height:14px;" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }

  // ── Aplicar filtros ─────────────────────────────────────────────────────────
  function _applyFilter() {
    const q      = ($('haSearchInput')?.value ?? '').trim().toLowerCase();
    const estado = $('haFilterEstado')?.value ?? '';

    _filtrado = _todos.filter(r => {
      const matchQ = !q || [r.nombre, r.email, String(r.numero_cuenta ?? '')]
        .some(field => (field ?? '').toLowerCase().includes(q));
      const matchEstado = !estado || r.estado === estado;
      return matchQ && matchEstado;
    });

    _renderTabla();
  }

  // ── Render tabla ────────────────────────────────────────────────────────────
  function _renderTabla() {
    const tbody   = $('historialAlumnosList');
    const counter = $('historialCounter');
    const n       = _filtrado.length;

    if (counter) counter.textContent = `${n} registro${n !== 1 ? 's' : ''}`;

    if (!tbody) return;

    if (n === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i data-lucide="inbox"
               style="width:28px;height:28px;display:block;margin:0 auto 10px;
                      color:var(--color-text-muted,#64748b);"
               aria-hidden="true"></i>
            No hay registros que coincidan con los filtros
          </td>
        </tr>`;
      window.IconRegistry?.init();
      return;
    }

    tbody.innerHTML = _filtrado.map(_buildRow).join('');
    window.IconRegistry?.init();

    // Conectar botones de eliminar
    tbody.querySelectorAll('.btn-ha-eliminar').forEach(btn => {
      btn.addEventListener('click', () =>
        _confirmDelete(btn.dataset.haId, btn.dataset.haNombre)
      );
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CARGAR DATOS
  // ══════════════════════════════════════════════════════════════════════════

  async function cargar() {
    const tbody = $('historialAlumnosList');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Cargando…</td></tr>';
    }

    try {
      const { data, error } = await client
        .from('registro_alumnos')
        .select('id, email, nombre, numero_cuenta, telefono, tiene_whatsapp, fecha_registro, estado')
        .order('fecha_registro', { ascending: false });

      if (error) throw error;

      _todos    = data ?? [];
      _filtrado = [..._todos];
      _applyFilter();
      console.log(`[HistorialAlumnos] Cargados: ${_todos.length} registros`);

    } catch (err) {
      console.error('[HistorialAlumnos] Error cargando:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state" style="color:var(--color-danger,#dc2626);">
              Error al cargar el historial: ${escHtml(err.message)}
            </td>
          </tr>`;
      }
      window.ErrorHandler?.showToast('Error al cargar el historial de alumnos.', 'error');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ELIMINAR REGISTRO
  // ══════════════════════════════════════════════════════════════════════════

  function _confirmDelete(id, nombre) {
    const nombreDisplay = nombre || 'este alumno';
    window.ModalManager.openConfirm({
      title:       '¿Eliminar registro?',
      message:     `Se eliminará el registro de "${nombreDisplay}" del historial.\n\nEsta acción no puede deshacerse.`,
      confirmText: 'Eliminar',
      cancelText:  'Cancelar',
      tipo:        'danger',
      onConfirm:   () => _doDelete(id, nombreDisplay),
    });
  }

  async function _doDelete(id, nombreDisplay) {
    try {
      const { error } = await client
        .from('registro_alumnos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      window.ErrorHandler?.showToast(`Registro de "${nombreDisplay}" eliminado correctamente.`, 'success');
      await cargar();

    } catch (err) {
      console.error('[HistorialAlumnos] Error eliminando:', err);
      window.ErrorHandler?.showToast('Error al eliminar el registro. Intenta de nuevo.', 'error');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXPORTAR CSV
  // ══════════════════════════════════════════════════════════════════════════

  function exportarCSV() {
    if (_filtrado.length === 0) {
      window.ErrorHandler?.showToast('No hay registros para exportar.', 'info');
      return;
    }

    const headers = ['nombre', 'numero_cuenta', 'email', 'telefono', 'estado', 'fecha_registro', 'id'];
    const rows = _filtrado.map(r => [
      r.nombre         ?? '',
      r.numero_cuenta  ?? '',
      r.email          ?? '',
      r.telefono       ?? '',
      r.estado         ?? '',
      r.fecha_registro ? new Date(r.fecha_registro).toLocaleDateString('es-MX') : '',
      r.id             ?? '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `historial-alumnos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INICIALIZAR
  // ══════════════════════════════════════════════════════════════════════════

  function inicializar() {
    if (_initialized) {
      // Si ya está inicializado solo recargamos datos frescos
      cargar();
      return;
    }
    _initialized = true;

    // Búsqueda unificada (nombre / núm. cuenta / email)
    $('haSearchInput')?.addEventListener('input', _applyFilter);

    // Filtro por estado
    $('haFilterEstado')?.addEventListener('change', _applyFilter);

    // Limpiar filtros
    $('haBtnLimpiar')?.addEventListener('click', () => {
      const search = $('haSearchInput');
      const estado = $('haFilterEstado');
      if (search) search.value = '';
      if (estado) estado.value = '';
      _applyFilter();
    });

    // Exportar CSV
    $('haBtnExportar')?.addEventListener('click', exportarCSV);

    cargar();
  }

  // ── API pública ─────────────────────────────────────────────────────────────
  return { inicializar, cargar };

})();

window.HistorialAlumnos = HistorialAlumnos;
