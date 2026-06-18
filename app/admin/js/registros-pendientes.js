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
  let _rechazarId    = null;    // UUID del registro actualmente en el modal de rechazo
  let _validarId     = null;    // UUID del registro actualmente en el modal de validación
  let _validarEmail  = '';      // Email del alumno a validar

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
    _validarId    = btn.dataset.id;
    _validarEmail = btn.dataset.email ?? '';
    const nombre  = btn.dataset.nombre;

    console.log('[DEBUG-VALIDAR] btn.dataset.id:', btn.dataset.id);
    console.log('[DEBUG-VALIDAR] _validarId capturado:', _validarId);

    const modal    = $('validarRegistroModal');
    const nombreEl = $('validarModalNombre');
    const emailEl  = $('validarModalEmail');
    const confirmBtn = $('validarModalConfirmBtn');

    if (!modal) {
      // Fallback: usar confirm nativo si no existe el modal
      if (!window.confirm(`¿Validar el registro de ${nombre}?`)) return;
      _ejecutarValidar(btn, _validarId);
      return;
    }

    if (nombreEl)   nombreEl.textContent = nombre;
    if (emailEl)    emailEl.textContent  = _validarEmail;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i data-lucide="check-circle" style="width:15px;height:15px;" aria-hidden="true"></i> Validar y activar`;
    }

    // Guardar referencia al botón de la fila para restaurarlo si cancela
    modal.dataset.btnRef = btn.closest('tr')?.dataset.regId ?? '';
    modal.style.display  = 'flex';
    window.IconRegistry?.init();
  }

  function _cerrarModalValidar() {
    const modal = $('validarRegistroModal');
    if (modal) modal.style.display = 'none';
    _validarId    = null;
    _validarEmail = '';
  }

  function _confirmarValidar() {
    if (!_validarId) return;

    // Capturar id ANTES de cerrar el modal (cerrar resetea _validarId a null)
    const idToValidate = _validarId;

    console.log('[DEBUG-CONFIRMAR] _validarId antes de cerrar:', _validarId);
    console.log('[DEBUG-CONFIRMAR] idToValidate guardado:', idToValidate);

    // Buscar el botón validar de la fila correspondiente
    const row = document.querySelector(`tr[data-reg-id="${idToValidate}"]`);
    const btn = row?.querySelector('.btn-validar');

    console.log('[DEBUG-CONFIRMAR] row encontrada:', row);
    console.log('[DEBUG-CONFIRMAR] btn en row:', btn);

    _cerrarModalValidar();   // resetea _validarId → null (seguro: ya guardamos idToValidate)

    if (btn) {
      _ejecutarValidar(btn, idToValidate);
    } else {
      console.warn('[DEBUG-CONFIRMAR] btn no encontrado — idToValidate:', idToValidate);
    }
  }

  async function _ejecutarValidar(btn, id) {
    console.log('[DEBUG-EJECUTAR] id recibido:', id);
    console.log('[DEBUG-EJECUTAR] body que se enviará:', JSON.stringify({ id }));

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

      const FN_URL   = 'https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/validate-registro';
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

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

      const FN_URL   = 'https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/reject-registro';
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

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

    // Modal VALIDAR — botones
    $('validarModalCloseBtn') ?.addEventListener('click', _cerrarModalValidar);
    $('validarModalCancelBtn')?.addEventListener('click', _cerrarModalValidar);
    $('validarModalConfirmBtn')?.addEventListener('click', _confirmarValidar);
    $('validarRegistroModal')?.addEventListener('click', e => {
      if (e.target === $('validarRegistroModal')) _cerrarModalValidar();
    });

    // Modal RECHAZAR — botones
    $('rechazarModalCloseBtn') ?.addEventListener('click', _cerrarModalRechazar);
    $('rechazarModalCancelBtn')?.addEventListener('click', _cerrarModalRechazar);
    $('rechazarRegistroModal')?.addEventListener('click', e => {
      if (e.target === $('rechazarRegistroModal')) _cerrarModalRechazar();
    });
    $('rechazarModalConfirmBtn')?.addEventListener('click', _ejecutarRechazar);

    // Cerrar cualquier modal con Escape
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if ($('validarRegistroModal')?.style.display  === 'flex') _cerrarModalValidar();
      if ($('rechazarRegistroModal')?.style.display === 'flex') _cerrarModalRechazar();
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
