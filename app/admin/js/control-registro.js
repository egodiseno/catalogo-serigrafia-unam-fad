/**
 * control-registro.js — Gestión del período de registro público de alumnos
 * ──────────────────────────────────────────────────────────────────────────
 * Sección "Control de Registro" del panel admin.
 *
 * Lee y escribe en la tabla `registro_config` (única fila).
 * Roles con acceso: admin, super_editor (RLS + nav visibility).
 *
 * Depende de: config.js (window.supabase_client), error-handler.js
 * Expone: window.controlRegistroManager
 * ──────────────────────────────────────────────────────────────────────────
 */

const controlRegistroManager = (() => {

  // ── Cliente ─────────────────────────────────────────────────────────────
  const client = window.supabase_client;

  // ── Estado ───────────────────────────────────────────────────────────────
  let _configId     = null;   // UUID de la fila en registro_config
  let _initialized  = false;
  let _dirty        = false;  // hay cambios sin guardar

  // Snapshot de los valores cargados (para "Descartar cambios")
  let _snapshot = {
    registro_activo:       false,
    fecha_inicio:          '',
    fecha_fin:             '',
    mensaje_personalizado: '',
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Helpers de fecha ─────────────────────────────────────────────────────
  function formatFechaLarga(isoDate) {
    if (!isoDate) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      day:   'numeric',
      month: 'long',
      year:  'numeric',
    });
  }

  // Hoy en YYYY-MM-DD (local)
  function hoyISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  // ── Actualizar barra de estado ────────────────────────────────────────────
  function _renderStatus(activo, fechaInicio, fechaFin) {
    const badge = $('crStatusBadge');
    const text  = $('crStatusText');
    if (!badge || !text) return;

    const hoy = hoyISO();

    // Remover clases previas
    badge.className = 'cr-status-badge';

    if (!activo) {
      badge.classList.add('cr-status-badge--closed');
      badge.innerHTML = '<i data-lucide="x-circle" style="width:13px;height:13px;" aria-hidden="true"></i> Cerrado';
      text.textContent = fechaInicio && fechaInicio > hoy
        ? `El registro se abrirá el ${formatFechaLarga(fechaInicio)}.`
        : 'El registro de alumnos está desactivado.';
    } else if (fechaInicio && hoy < fechaInicio) {
      badge.classList.add('cr-status-badge--pending');
      badge.innerHTML = '<i data-lucide="clock" style="width:13px;height:13px;" aria-hidden="true"></i> Próximamente';
      text.textContent = `El registro se abrirá el ${formatFechaLarga(fechaInicio)}.`;
    } else if (fechaFin && hoy > fechaFin) {
      badge.classList.add('cr-status-badge--closed');
      badge.innerHTML = '<i data-lucide="x-circle" style="width:13px;height:13px;" aria-hidden="true"></i> Cerrado';
      text.textContent = `El período de registro cerró el ${formatFechaLarga(fechaFin)}.`;
    } else {
      badge.classList.add('cr-status-badge--open');
      badge.innerHTML = '<i data-lucide="check-circle-2" style="width:13px;height:13px;" aria-hidden="true"></i> Abierto';
      text.textContent = fechaFin
        ? `Registro abierto hasta el ${formatFechaLarga(fechaFin)}.`
        : 'Registro abierto sin fecha límite.';
    }

    window.IconRegistry?.init();
  }

  // ── Llenar formulario ─────────────────────────────────────────────────────
  function _fillForm(config) {
    const toggle     = $('crRegistroActivoToggle');
    const hint       = $('crToggleHint');
    const fechaIni   = $('crFechaInicio');
    const fechaFin   = $('crFechaFin');
    const mensaje    = $('crMensaje');

    if (!toggle) return;

    // Toggle ON/OFF
    const activo = !!config.registro_activo;
    toggle.setAttribute('aria-checked', String(activo));
    toggle.classList.toggle('cr-toggle--on', activo);
    if (hint) hint.textContent = activo ? 'Registro activo' : 'Registro cerrado';

    // Fechas (formato YYYY-MM-DD para inputs date)
    if (fechaIni) fechaIni.value = config.fecha_inicio    ?? '';
    if (fechaFin) fechaFin.value = config.fecha_fin       ?? '';
    if (mensaje)  mensaje.value  = config.mensaje_personalizado ?? '';

    // Contador de caracteres
    _updateCharCount(config.mensaje_personalizado?.length ?? 0);

    // Renderizar estado
    _renderStatus(activo, config.fecha_inicio, config.fecha_fin);
  }

  // ── Contador de caracteres ────────────────────────────────────────────────
  function _updateCharCount(n) {
    const el = $('crCharCount');
    if (el) el.textContent = `${n} / 400`;
  }

  // ── Leer valores actuales del formulario ──────────────────────────────────
  function _readForm() {
    const toggle   = $('crRegistroActivoToggle');
    const activo   = toggle?.getAttribute('aria-checked') === 'true';
    const inicio   = $('crFechaInicio')?.value.trim() || null;
    const fin      = $('crFechaFin')?.value.trim()    || null;
    const mensaje  = $('crMensaje')?.value.trim()     || null;
    return { registro_activo: activo, fecha_inicio: inicio, fecha_fin: fin, mensaje_personalizado: mensaje };
  }

  // ── Validar formulario ────────────────────────────────────────────────────
  function _validate(valores) {
    const errorEl = $('crFormError');
    if (!errorEl) return true;

    const { fecha_inicio, fecha_fin } = valores;

    if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
      errorEl.textContent = 'La fecha de fin no puede ser anterior a la fecha de inicio.';
      errorEl.style.display = '';
      return false;
    }

    errorEl.style.display = 'none';
    errorEl.textContent   = '';
    return true;
  }

  // ── Cargar config de Supabase ─────────────────────────────────────────────
  async function cargar() {
    const badge = $('crStatusBadge');
    const text  = $('crStatusText');
    if (badge) {
      badge.className  = 'cr-status-badge cr-status-badge--loading';
      badge.innerHTML  = '<i data-lucide="loader" style="width:13px;height:13px;" aria-hidden="true"></i> Cargando…';
      window.IconRegistry?.init();
    }
    if (text) text.textContent = '';

    try {
      const { data, error } = await client
        .from('registro_config')
        .select('id, registro_activo, fecha_inicio, fecha_fin, mensaje_personalizado')
        .limit(1)
        .single();

      if (error) throw error;

      _configId  = data.id;
      _snapshot  = {
        registro_activo:       !!data.registro_activo,
        fecha_inicio:          data.fecha_inicio          ?? '',
        fecha_fin:             data.fecha_fin             ?? '',
        mensaje_personalizado: data.mensaje_personalizado ?? '',
      };
      _dirty = false;

      _fillForm(data);
      console.log('[ControlRegistro] Config cargada:', data);

    } catch (err) {
      console.error('[ControlRegistro] Error cargando config:', err);
      if (badge) {
        badge.className = 'cr-status-badge cr-status-badge--closed';
        badge.innerHTML = '<i data-lucide="alert-circle" style="width:13px;height:13px;" aria-hidden="true"></i> Error';
        window.IconRegistry?.init();
      }
      if (text) text.textContent = 'No se pudo cargar la configuración del registro.';
      window.ErrorHandler?.showToast('Error al cargar la configuración del registro.', 'error');
    }
  }

  // ── Guardar cambios ───────────────────────────────────────────────────────
  async function guardar() {
    if (!_configId) {
      window.ErrorHandler?.showToast('No hay configuración cargada. Recarga la página.', 'warning');
      return;
    }

    const valores = _readForm();
    if (!_validate(valores)) return;

    const saveBtn = $('crSaveBtn');
    const origLabel = saveBtn?.innerHTML;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Guardando…';
    }

    try {
      const { error } = await client
        .from('registro_config')
        .update({
          registro_activo:       valores.registro_activo,
          fecha_inicio:          valores.fecha_inicio    || null,
          fecha_fin:             valores.fecha_fin       || null,
          mensaje_personalizado: valores.mensaje_personalizado || null,
          actualizado_en:        new Date().toISOString(),
        })
        .eq('id', _configId);

      if (error) throw error;

      // Actualizar snapshot y estado
      _snapshot = {
        registro_activo:       valores.registro_activo,
        fecha_inicio:          valores.fecha_inicio          ?? '',
        fecha_fin:             valores.fecha_fin             ?? '',
        mensaje_personalizado: valores.mensaje_personalizado ?? '',
      };
      _dirty = false;

      _renderStatus(valores.registro_activo, valores.fecha_inicio, valores.fecha_fin);
      window.ErrorHandler?.showToast('Configuración guardada correctamente.', 'success');
      console.log('[ControlRegistro] Config guardada:', valores);

    } catch (err) {
      console.error('[ControlRegistro] Error guardando config:', err);
      window.ErrorHandler?.showToast(`Error al guardar: ${err.message}`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origLabel;
        window.IconRegistry?.init();
      }
    }
  }

  // ── Descartar cambios ─────────────────────────────────────────────────────
  function descartar() {
    _fillForm({
      registro_activo:       _snapshot.registro_activo,
      fecha_inicio:          _snapshot.fecha_inicio   || null,
      fecha_fin:             _snapshot.fecha_fin      || null,
      mensaje_personalizado: _snapshot.mensaje_personalizado || null,
    });
    $('crFormError').style.display = 'none';
    _dirty = false;
  }

  // ── Listeners del formulario ──────────────────────────────────────────────
  function _bindEvents() {
    // Toggle ON/OFF
    $('crRegistroActivoToggle')?.addEventListener('click', () => {
      const toggle = $('crRegistroActivoToggle');
      const hint   = $('crToggleHint');
      const currentlyOn = toggle.getAttribute('aria-checked') === 'true';
      const newState    = !currentlyOn;
      toggle.setAttribute('aria-checked', String(newState));
      toggle.classList.toggle('cr-toggle--on', newState);
      if (hint) hint.textContent = newState ? 'Registro activo' : 'Registro cerrado';

      // Actualizar estado visual en tiempo real
      const inicio = $('crFechaInicio')?.value || null;
      const fin    = $('crFechaFin')?.value    || null;
      _renderStatus(newState, inicio, fin);
      _dirty = true;
    });

    // Fechas → actualizar estado en tiempo real
    ['crFechaInicio', 'crFechaFin'].forEach(id => {
      $(id)?.addEventListener('change', () => {
        const activo = $('crRegistroActivoToggle')?.getAttribute('aria-checked') === 'true';
        const inicio = $('crFechaInicio')?.value || null;
        const fin    = $('crFechaFin')?.value    || null;
        _renderStatus(activo, inicio, fin);
        _dirty = true;
      });
    });

    // Mensaje → contador de chars
    $('crMensaje')?.addEventListener('input', e => {
      _updateCharCount(e.target.value.length);
      _dirty = true;
    });

    // Guardar
    $('crSaveBtn')?.addEventListener('click', guardar);

    // Descartar
    $('crResetBtn')?.addEventListener('click', descartar);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    if (_initialized) return;
    _initialized = true;
    _bindEvents();
    console.log('✅ ControlRegistro module inicializado');
  }

  // ── Llamado por navigation.js cuando se activa la sección ─────────────────
  function inicializar() {
    init();
    cargar();
  }

  // ── API pública ───────────────────────────────────────────────────────────
  return { init, inicializar, cargar, guardar };

})();

window.controlRegistroManager = controlRegistroManager;
console.log('🔧 ControlRegistro module listo');
