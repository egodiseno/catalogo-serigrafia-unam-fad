/**
 * registros-pendientes.js — Gestión de solicitudes de registro de alumnos
 * ──────────────────────────────────────────────────────────────────────────
 * Sección "Registros Pendientes" del panel admin.
 *
 * Funciones principales:
 *   inicializar()       — carga datos e inicia auto-refresh
 *   detener()           — detiene auto-refresh (al salir de la sección)
 *   cargar()            — recarga la tabla desde Supabase
 *   validarRegistro(id) — llama a Edge Function validate-registro
 *   rechazarRegistro()  — llama a Edge Function reject-registro (usa modal)
 *
 * Depende de: config.js, error-handler.js, toast-notifications.js
 * Expone: window.RegistrosPendientes
 *
 * Edge Functions requeridas (sprint posterior):
 *   POST /functions/v1/validate-registro  → { success: true, user_id }
 *   POST /functions/v1/reject-registro    → { success: true }
 * ──────────────────────────────────────────────────────────────────────────
 */

const RegistrosPendientes = (() => {

  // ── Referencias ────────────────────────────────────────────────────────────
  const client = window.supabase_client;

  // ── Estado ─────────────────────────────────────────────────────────────────
  let _registros     = [];
  let _autoRefreshId = null;
  let _initialized   = false;
  let _rechazarId    = null;    // UUID del registro actualmente en el modal

  const AUTO_REFRESH_MS = 30_000;   // 30 segundos

  // ── DOM helper ─────────────────────────────────────────────────────────────
  const $  = id  => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  // ── Formato de fecha legible ────────────────────────────────────────────────
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

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER TABLA
  // ══════════════════════════════════════════════════════════════════════════

  function renderTabla(registros) {
    const tbody   = $('registrosPendientesList');
    const badge   = $('registrosBadgeCount');
    const sub     = $('registrosPendientesSubtitle');
    const n       = registros.length;

    // Actualizar contador
    if (badge) badge.textContent = `${n} pendiente${n !== 1 ? 's' : ''}`;
    if (sub)   sub.textContent   = `${n} alumno${n !== 1 ? 's' : ''} esperando validación de acceso`;

    if (!tbody) return;

    if (n === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state registros-empty-state">
            <i data-lucide="check-circle-2"
               style="width:28px;height:28px;display:block;margin:0 auto 10px;
                      color:var(--color-success,#16a34a);"
               aria-hidden="true"></i>
            No hay registros pendientes de validación
          </td>
        </tr>`;
      window.IconRegistry?.init();
      return;
    }

    const rows = registros.map(r => `
      <tr data-reg-id="${escHtml(r.id)}">
        <td class="td-cuenta"><code class="cuenta-code">${escHtml(r.numero_cuenta)}</code></td>
        <td class="td-nombre">${escHtml(r.nombre)}</td>
        <td class="td-email">
          <a href="mailto:${escHtml(r.email)}" class="email-link">${escHtml(r.email)}</a>
        </td>
        <td class="td-telefono">
          ${r.telefono
            ? escHtml(r.telefono)
            : '<span class="text-muted">—</span>'}
        </td>
        <td class="td-whatsapp" style="text-align:center;">
          ${r.tiene_whatsapp
            ? '<span class="badge badge-registros-wa"><i data-lucide="message-circle" style="width:12px;height:12px;" aria-hidden="true"></i> Sí</span>'
            : '<span class="text-muted">No</span>'}
        </td>
        <td class="td-fecha">${formatFecha(r.fecha_registro)}</td>
        <td class="td-acciones registros-acciones">
          <button class="btn btn-sm btn-primary btn-validar"
                  data-id="${escHtml(r.id)}"
                  data-nombre="${escHtml(r.nombre)}"
                  data-email="${escHtml(r.email)}"
                  aria-label="Validar registro de ${escHtml(r.nombre)}">
            <i data-lucide="check" style="width:14px;height:14px;" aria-hidden="true"></i>
            Validar
          </button>
          <button class="btn btn-sm btn-danger btn-rechazar"
                  data-id="${escHtml(r.id)}"
                  data-nombre="${escHtml(r.nombre)}"
                  aria-label="Rechazar registro de ${escHtml(r.nombre)}">
            <i data-lucide="x" style="width:14px;height:14px;" aria-hidden="true"></i>
            Rechazar
          </button>
        </td>
      </tr>`).join('');

    tbody.innerHTML = rows;
    window.IconRegistry?.init();

    // Eventos de botones
    tbody.querySelectorAll('.btn-validar').forEach(btn => {
      btn.addEventListener('click', () => _onValidarClick(btn));
    });
    tbody.querySelectorAll('.btn-rechazar').forEach(btn => {
      btn.addEventListener('click', () => _onRechazarClick(btn));
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CARGAR DATOS
  // ══════════════════════════════════════════════════════════════════════════

  async function cargar() {
    const tbody = $('registrosPendientesList');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Cargando…</td></tr>';
    }

    try {
      const { data, error } = await client
        .from('registro_alumnos')
        .select('id, email, nombre, numero_cuenta, telefono, tiene_whatsapp, fecha_registro')
        .eq('estado', 'pendiente_validacion')
        .order('fecha_registro', { ascending: true });

      if (error) throw error;

      _registros = data ?? [];
      renderTabla(_registros);
      console.log(`[RegistrosPendientes] Cargados: ${_registros.length} registros`);

    } catch (err) {
      console.error('[RegistrosPendientes] Error cargando:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state" style="color:var(--color-danger,#dc2626);">
              Error al cargar registros: ${escHtml(err.message)}
            </td>
          </tr>`;
      }
      window.ErrorHandler?.showToast('Error al cargar los registros pendientes.', 'error');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VALIDAR REGISTRO
  // ══════════════════════════════════════════════════════════════════════════

  function _onValidarClick(btn) {
    const id     = btn.dataset.id;
    const nombre = btn.dataset.nombre;

    // Confirmación nativa (se puede mejorar con ModalManager en sprint futuro)
    const ok = window.confirm(
      `¿Validar el registro de ${nombre}?\n\nSe creará su cuenta de acceso y recibirá un email de bienvenida.`
    );
    if (!ok) return;

    _ejecutarValidar(btn, id);
  }

  async function _ejecutarValidar(btn, id) {
    const row       = btn.closest('tr');
    const rechazBtn = row?.querySelector('.btn-rechazar');

    // UI: estado de carga
    btn.disabled            = true;
    if (rechazBtn) rechazBtn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Validando…';

    try {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');

      const SUPABASE_URL = window.supabaseConfig?.url     ?? 'https://kfvjansfmhamkrnbxmgp.supabase.co';
      const ANON_KEY     = window.supabaseConfig?.anonKey ?? '';
      const FN_URL       = `${SUPABASE_URL}/functions/v1/validate-registro`;

      console.log('[RegistrosPendientes] Llamando validate-registro para id:', id);

      const res = await fetch(FN_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey':        ANON_KEY,
        },
        body: JSON.stringify({ id }),
      });

      let result;
      try   { result = await res.json(); }
      catch { throw new Error(`Respuesta inválida del servidor (HTTP ${res.status})`); }

      if (!res.ok || !result.success) {
        throw new Error(result.error ?? `Error ${res.status}`);
      }

      console.log('[RegistrosPendientes] Registro validado:', id);
      window.ErrorHandler?.showToast(
        'Registro validado. El alumno recibirá un email de bienvenida.',
        'success'
      );

      await cargar();   // Recargar tabla completa

    } catch (err) {
      console.error('[RegistrosPendientes] Error al validar:', err);
      window.ErrorHandler?.showToast(`Error al validar: ${err.message}`, 'error');

      // Restaurar botones
      btn.disabled            = false;
      if (rechazBtn) rechazBtn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" style="width:14px;height:14px;" aria-hidden="true"></i> Validar`;
      window.IconRegistry?.init();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RECHAZAR REGISTRO — MODAL
  // ══════════════════════════════════════════════════════════════════════════

  function _onRechazarClick(btn) {
    _rechazarId = btn.dataset.id;
    const nombre = btn.dataset.nombre;

    const modal    = $('rechazarRegistroModal');
    const nombreEl = $('rechazarModalNombre');
    const notasEl  = $('rechazarNotasInput');
    const confirmBtn = $('rechazarModalConfirmBtn');

    if (!modal) {
      console.warn('[RegistrosPendientes] Modal rechazar no encontrado en el DOM');
      return;
    }

    if (nombreEl)    nombreEl.textContent = nombre;
    if (notasEl)     notasEl.value        = '';
    if (confirmBtn)  {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i data-lucide="x-circle" style="width:15px;height:15px;" aria-hidden="true"></i> Rechazar registro`;
    }

    modal.style.display = 'flex';
    window.IconRegistry?.init();

    // Focus en textarea
    setTimeout(() => notasEl?.focus(), 120);
  }

  function _cerrarModalRechazar() {
    const modal = $('rechazarRegistroModal');
    if (modal) modal.style.display = 'none';
    _rechazarId = null;
  }

  async function _ejecutarRechazar() {
    if (!_rechazarId) return;

    const id          = _rechazarId;
    const notas       = ($('rechazarNotasInput')?.value ?? '').trim();
    const confirmBtn  = $('rechazarModalConfirmBtn');
    const origLabel   = confirmBtn?.innerHTML;

    // UI: estado de carga
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Rechazando…';
    }

    try {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');

      const SUPABASE_URL = window.supabaseConfig?.url     ?? 'https://kfvjansfmhamkrnbxmgp.supabase.co';
      const ANON_KEY     = window.supabaseConfig?.anonKey ?? '';
      const FN_URL       = `${SUPABASE_URL}/functions/v1/reject-registro`;

      console.log('[RegistrosPendientes] Llamando reject-registro para id:', id);

      const res = await fetch(FN_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey':        ANON_KEY,
        },
        body: JSON.stringify({ id, notas }),
      });

      let result;
      try   { result = await res.json(); }
      catch { throw new Error(`Respuesta inválida del servidor (HTTP ${res.status})`); }

      if (!res.ok || !result.success) {
        throw new Error(result.error ?? `Error ${res.status}`);
      }

      console.log('[RegistrosPendientes] Registro rechazado:', id);
      _cerrarModalRechazar();
      window.ErrorHandler?.showToast('Registro rechazado correctamente.', 'success');
      await cargar();

    } catch (err) {
      console.error('[RegistrosPendientes] Error al rechazar:', err);
      window.ErrorHandler?.showToast(`Error al rechazar: ${err.message}`, 'error');

      // Restaurar botón
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = origLabel;
        window.IconRegistry?.init();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-REFRESH
  // ══════════════════════════════════════════════════════════════════════════

  function _iniciarAutoRefresh() {
    _detenerAutoRefresh();
    _autoRefreshId = setInterval(cargar, AUTO_REFRESH_MS);
    console.log('[RegistrosPendientes] Auto-refresh activo (cada 30 s)');
  }

  function detener() {
    _detenerAutoRefresh();
  }

  function _detenerAutoRefresh() {
    if (_autoRefreshId !== null) {
      clearInterval(_autoRefreshId);
      _autoRefreshId = null;
      console.log('[RegistrosPendientes] Auto-refresh detenido');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INIT — una sola vez al cargar el módulo
  // ══════════════════════════════════════════════════════════════════════════

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Botón "Actualizar"
    $('btnRefreshRegistros')?.addEventListener('click', cargar);

    // Modal rechazar — cerrar
    $('rechazarModalCloseBtn') ?.addEventListener('click', _cerrarModalRechazar);
    $('rechazarModalCancelBtn')?.addEventListener('click', _cerrarModalRechazar);

    // Cerrar al hacer clic en el overlay
    $('rechazarRegistroModal')?.addEventListener('click', e => {
      if (e.target === $('rechazarRegistroModal')) _cerrarModalRechazar();
    });

    // Modal rechazar — confirmar
    $('rechazarModalConfirmBtn')?.addEventListener('click', _ejecutarRechazar);

    // Cerrar modal con Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('rechazarRegistroModal')?.style.display === 'flex') {
        _cerrarModalRechazar();
      }
    });

    console.log('✅ RegistrosPendientes module inicializado');
  }

  // ── Llamado por navigation.js cuando se activa la sección ──────────────────
  function inicializar() {
    init();
    cargar();
    _iniciarAutoRefresh();
  }

  // ── API pública ─────────────────────────────────────────────────────────────
  return { init, inicializar, detener, cargar };

})();

window.RegistrosPendientes = RegistrosPendientes;
console.log('📋 RegistrosPendientes module listo');
