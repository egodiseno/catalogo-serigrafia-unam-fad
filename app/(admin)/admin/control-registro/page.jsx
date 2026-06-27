'use client';

/**
 * app/(admin)/admin/control-registro/page.jsx — /admin/control-registro
 *
 * Client Component. Auth directa con createClient() singleton — sin useAuth.
 * Port de control-registro.js (VanillaJS).
 *
 * Schema verificado (registro_config — tabla singleton, 1 fila):
 *   id (uuid PK), registro_activo (boolean), fecha_inicio (date|null),
 *   fecha_fin (date|null), mensaje_personalizado (text|null),
 *   actualizado_en (timestamptz)
 *
 * Lógica de estado (igual que control-registro.js):
 *   - registroActivo === false                              → 'closed'
 *   - registroActivo === true AND hoy < fecha_inicio        → 'pending'
 *   - registroActivo === true AND hoy entre inicio y fin    → 'open'
 *   - registroActivo === true AND hoy > fecha_fin           → 'closed'
 *   - registroActivo === true AND sin fechas               → 'open'
 *
 * Clases CSS verificadas en styles/admin.css:
 *   .section-header / .form-group / .form-alert / .field-hint
 *   .btn / .btn-primary / .btn-secondary
 *   .cr-status-bar / .cr-status-badge / .cr-status-badge--loading
 *   .cr-status-badge--open / .cr-status-badge--closed / .cr-status-badge--pending
 *   .cr-status-text / .cr-form-card / .cr-toggle-group / .cr-toggle-label
 *   .cr-toggle-wrapper / .cr-toggle / .cr-toggle--on / .cr-toggle-thumb
 *   .cr-toggle-hint / .cr-dates-row / .cr-date-input / .cr-char-count
 *   .cr-form-actions
 *
 * Nota: .cr-toggle-group no define display:flex explícitamente en admin.css —
 * se aplica vía style={{ display:'flex' }} inline para que flex-direction:row
 * surta efecto tal como lo hace el VanillaJS original.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';

// ── Lógica de estado — replica exactamente control-registro.js ────────────────
/**
 * Computa el estado visual del período de registro.
 * @param {boolean} registroActivo
 * @param {string|null} fechaInicio — 'YYYY-MM-DD' | null
 * @param {string|null} fechaFin    — 'YYYY-MM-DD' | null
 * @returns {'open'|'closed'|'pending'}
 */
function computeStatus(registroActivo, fechaInicio, fechaFin) {
  if (!registroActivo) return 'closed';

  const now   = new Date();
  // Comparar solo fechas (sin hora) usando UTC midnight para evitar zona horaria
  const hoy   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : null;
  // Fin de día inclusive: fecha_fin cuenta como el último día abierto
  const end   = fechaFin   ? new Date(fechaFin   + 'T23:59:59') : null;

  if (start && hoy < start) return 'pending'; // configurado pero aún no empieza
  if (end   && hoy > end)   return 'closed';  // período expirado
  return 'open'; // activo dentro del rango (o sin fechas = siempre abierto)
}

const STATUS_LABELS = {
  open:    'Abierto',
  closed:  'Cerrado',
  pending: 'Programado',
};

const STATUS_BADGE_CLASSES = {
  loading: 'cr-status-badge cr-status-badge--loading',
  open:    'cr-status-badge cr-status-badge--open',
  closed:  'cr-status-badge cr-status-badge--closed',
  pending: 'cr-status-badge cr-status-badge--pending',
};

// ── Página principal ──────────────────────────────────────────────────────────
export default function ControlRegistroPage() {
  const client = createClient();
  const router = useRouter();

  const [currentUser,  setCurrentUser]  = useState(null);
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  // Estado del formulario
  const [registroActivo, setRegistroActivo] = useState(false);
  const [fechaInicio,    setFechaInicio]    = useState('');
  const [fechaFin,       setFechaFin]       = useState('');
  const [mensaje,        setMensaje]        = useState('');

  // Snapshot "original" para detectar cambios
  const [original, setOriginal] = useState(null); // { registroActivo, fechaInicio, fechaFin, mensaje }
  const [configId, setConfigId] = useState(null); // UUID de la fila singleton

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveAlert, setSaveAlert] = useState(null); // { msg, type }

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await client.auth.getUser();
        if (error || !data?.user) { setLoadError(true); setLoading(false); return; }

        const { data: adminUser, error: adminErr } = await client
          .from('usuarios_admin')
          .select('rol, email, nombre')
          .eq('email', data.user.email)
          .single();
        if (adminErr || !adminUser) { setLoadError(true); setLoading(false); return; }

        setCurrentUser({ email: adminUser.email, rol: adminUser.rol, nombre: adminUser.nombre });
      } catch (err) {
        console.error('[ControlRegistro] auth:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guard de permiso ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    if (!tienePermiso('control_registro.ver')) {
      router.replace('/admin');
    }
  }, [currentUser, tienePermiso, router]);

  // ── Cargar configuración ────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await client
        .from('registro_config')
        .select('id, registro_activo, fecha_inicio, fecha_fin, mensaje_personalizado')
        .single(); // tabla singleton con 1 fila
      if (error) throw error;

      const snap = {
        registroActivo: data.registro_activo ?? false,
        fechaInicio:    data.fecha_inicio    ?? '',
        fechaFin:       data.fecha_fin       ?? '',
        mensaje:        data.mensaje_personalizado ?? '',
      };

      setConfigId(data.id);
      setRegistroActivo(snap.registroActivo);
      setFechaInicio(snap.fechaInicio);
      setFechaFin(snap.fechaFin);
      setMensaje(snap.mensaje);
      setOriginal(snap);
    } catch (err) {
      console.error('[ControlRegistro] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Detectar cambios reales ─────────────────────────────────────────────────
  const isDirty = original !== null && (
    registroActivo !== original.registroActivo ||
    fechaInicio    !== (original.fechaInicio ?? '') ||
    fechaFin       !== (original.fechaFin    ?? '') ||
    mensaje        !== (original.mensaje     ?? '')
  );

  // ── Status para el badge ────────────────────────────────────────────────────
  const status = loading ? 'loading' : computeStatus(registroActivo, fechaInicio || null, fechaFin || null);

  // ── Descartar cambios ───────────────────────────────────────────────────────
  function handleDiscard() {
    if (!original) return;
    setRegistroActivo(original.registroActivo);
    setFechaInicio(original.fechaInicio ?? '');
    setFechaFin(original.fechaFin    ?? '');
    setMensaje(original.mensaje     ?? '');
    setSaveAlert(null);
  }

  // ── Guardar cambios ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!isDirty || !configId) return;

    // Validación básica de fechas
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setSaveAlert({ msg: 'La fecha de inicio no puede ser posterior a la fecha de fin.', type: 'error' });
      return;
    }

    setSaving(true);
    setSaveAlert(null);
    try {
      const { error } = await client
        .from('registro_config')
        .update({
          registro_activo:       registroActivo,
          fecha_inicio:          fechaInicio || null,
          fecha_fin:             fechaFin    || null,
          mensaje_personalizado: mensaje.trim() || null,
          actualizado_en:        new Date().toISOString(),
        })
        .eq('id', configId);

      if (error) throw error;

      // Actualizar snapshot para nueva referencia de dirty
      const newSnap = {
        registroActivo,
        fechaInicio: fechaInicio || '',
        fechaFin:    fechaFin    || '',
        mensaje:     mensaje.trim(),
      };
      setOriginal(newSnap);
      setMensaje(mensaje.trim()); // normalizar
      setSaveAlert({ msg: 'Configuración guardada correctamente.', type: 'success' });
    } catch (err) {
      console.error('[ControlRegistro] save:', err);
      setSaveAlert({ msg: err.message || 'No se pudo guardar. Inténtalo de nuevo.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <h2>Control de Registro</h2>
          <p>Configura el período en que los alumnos pueden enviar solicitudes de acceso</p>
        </div>
      </div>

      {/* ── Barra de estado ─────────────────────────────────────────────────── */}
      <div className="cr-status-bar">
        <span className={STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.closed}>
          {loading ? 'Cargando…' : STATUS_LABELS[status]}
        </span>
        {!loading && status === 'open' && (
          <span className="cr-status-text">
            El período de registro está activo — los alumnos pueden enviar solicitudes.
          </span>
        )}
        {!loading && status === 'closed' && (
          <span className="cr-status-text">
            El período de registro está cerrado — no se aceptan nuevas solicitudes.
          </span>
        )}
        {!loading && status === 'pending' && (
          <span className="cr-status-text">
            El período de registro comenzará el {fechaInicio || '—'}.
          </span>
        )}
      </div>

      {/* ── Error de carga ──────────────────────────────────────────────────── */}
      {loadError && (
        <div className="form-alert error" role="alert" style={{ marginBottom: 'var(--spacing-lg)' }}>
          Error al cargar la configuración.{' '}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadConfig} style={{ marginLeft: 8 }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ── Formulario ──────────────────────────────────────────────────────── */}
      {!loadError && (
        <div className="cr-form-card">

          {/* Toggle activar / desactivar */}
          {/* .cr-toggle-group define flex-direction:row sin display:flex explícito
              → se requiere style={{ display:'flex' }} para que el layout funcione */}
          <div
            className="cr-toggle-group"
            style={{ display: 'flex' }}
          >
            <p className="cr-toggle-label">
              {registroActivo ? 'Registro activo' : 'Registro cerrado'}
            </p>
            <div className="cr-toggle-wrapper">
              <button
                type="button"
                role="switch"
                aria-checked={registroActivo}
                className={`cr-toggle${registroActivo ? ' cr-toggle--on' : ''}`}
                onClick={() => { setRegistroActivo(prev => !prev); setSaveAlert(null); }}
                disabled={loading || saving}
                aria-label={registroActivo ? 'Desactivar período de registro' : 'Activar período de registro'}
              >
                <span className="cr-toggle-thumb" aria-hidden="true" />
              </button>
              <span className="cr-toggle-hint">
                {registroActivo ? 'Activo' : 'Cerrado'}
              </span>
            </div>
          </div>

          {/* Fechas de inicio y fin */}
          <div className="cr-dates-row">
            <div className="form-group">
              <label htmlFor="crFechaInicio">Fecha de inicio</label>
              <input
                id="crFechaInicio"
                type="date"
                className="cr-date-input"
                value={fechaInicio}
                onChange={(e) => { setFechaInicio(e.target.value); setSaveAlert(null); }}
                disabled={loading || saving}
                aria-describedby="crFechaInicioHint"
              />
              <span id="crFechaInicioHint" className="field-hint">
                Dejar vacío para sin restricción de inicio
              </span>
            </div>
            <div className="form-group">
              <label htmlFor="crFechaFin">Fecha de fin</label>
              <input
                id="crFechaFin"
                type="date"
                className="cr-date-input"
                value={fechaFin}
                onChange={(e) => { setFechaFin(e.target.value); setSaveAlert(null); }}
                disabled={loading || saving}
                min={fechaInicio || undefined}
                aria-describedby="crFechaFinHint"
              />
              <span id="crFechaFinHint" className="field-hint">
                Dejar vacío para sin restricción de fin
              </span>
            </div>
          </div>

          {/* Mensaje personalizado */}
          <div className="form-group">
            <label htmlFor="crMensaje">Mensaje personalizado (opcional)</label>
            <textarea
              id="crMensaje"
              rows={4}
              maxLength={500}
              value={mensaje}
              onChange={(e) => { setMensaje(e.target.value); setSaveAlert(null); }}
              disabled={loading || saving}
              placeholder="Mensaje que verán los alumnos en la página de registro pública…"
              aria-describedby="crMensajeCount"
            />
            <span id="crMensajeCount" className="cr-char-count">
              {mensaje.length} / 500
            </span>
          </div>

          {/* Alerta de guardado */}
          {saveAlert && (
            <div
              className={`form-alert ${saveAlert.type}`}
              role="alert"
              style={{ marginBottom: 'var(--spacing-md)' }}
            >
              {saveAlert.msg}
            </div>
          )}

          {/* Acciones */}
          <div className="cr-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDiscard}
              disabled={!isDirty || loading || saving}
            >
              Descartar cambios
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!isDirty || loading || saving}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
