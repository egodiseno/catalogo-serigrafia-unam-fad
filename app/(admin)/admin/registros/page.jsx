'use client';

/**
 * app/(admin)/admin/registros/page.jsx — /admin/registros (Registros Pendientes)
 *
 * Client Component. Auth directa con createClient() singleton — sin useAuth.
 * Port de registros-pendientes.js (VanillaJS).
 *
 * Schema verificado (registro_alumnos):
 *   id (uuid PK), email (text), nombre (text), numero_cuenta (text 9 dígitos),
 *   telefono (text|null), tiene_whatsapp (boolean), estado (text),
 *   fecha_registro (timestamptz), fecha_activacion (timestamptz|null),
 *   notas_admin (text|null), user_id (uuid|null)
 *   — NO hay columnas carrera/semestre.
 *
 * Edge Functions:
 *   validate-registro POST { id: string, password?: string }
 *     → crea auth user + inserta usuarios_admin + envía bienvenida
 *   reject-registro   POST { id: string, notas_admin: string }
 *     → estado='rechazado', guarda notas_admin
 *
 * Clases CSS verificadas en styles/admin.css:
 *   .section-header / .table-wrapper / .form-group / .form-alert / .field-hint
 *   .btn / .btn-sm / .btn-secondary / .btn-danger / .btn-primary / .btn-spinner
 *   .modal-overlay / .modal-dialog / .modal-header / .modal-body / .modal-footer
 *   .modal-close
 *   .registros-counter-bar / .registros-badge / .registros-auto-refresh-hint
 *   .registros-table / .registros-acciones / .registros-empty-state
 *   .cuenta-code / .email-link / .badge-registros-wa
 *   .validar-modal-info / .rechazar-modal-alumno
 *   td classes: .td-telefono / .td-whatsapp / .td-fecha / .td-acciones
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import { X, RefreshCw } from 'lucide-react';

// ── Helper fecha ──────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch { return '—'; }
}

// ── Edge Function helper ──────────────────────────────────────────────────────
async function callEdgeFunction(client, path, body) {
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey':        ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Modal Validar ─────────────────────────────────────────────────────────────
function ValidarModal({ registro, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false);
  const [alert,  setAlert]  = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleConfirm() {
    setSaving(true);
    setAlert(null);
    try {
      await onConfirm();
      onClose?.();
    } catch (err) {
      console.error('[ValidarModal]', err);
      setAlert(err.message || 'No se pudo validar el registro.');
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="validarModalTitle"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 id="validarModalTitle">¿Validar registro?</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          {/* Caja de información del alumno */}
          <div className="validar-modal-info">
            <p>
              <strong>Nombre:</strong> {registro.nombre}
            </p>
            <p>
              <strong>Email:</strong> {registro.email}
            </p>
            <p>
              <strong>Nº Cuenta:</strong> {registro.numero_cuenta}
            </p>
            {registro.telefono && (
              <p>
                <strong>Teléfono:</strong> {registro.telefono}
                {registro.tiene_whatsapp && ' (WhatsApp)'}
              </p>
            )}
            <p>
              <strong>Fecha de solicitud:</strong> {fmtDate(registro.fecha_registro)}
            </p>
          </div>

          <p style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Se creará una cuenta de acceso con rol <strong>editor</strong> para este alumno y
            se le enviará un email de bienvenida con sus credenciales.
          </p>

          {alert && (
            <div className="form-alert error" style={{ marginTop: 'var(--spacing-md)' }}>
              {alert}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving
              ? <><span className="btn-spinner" aria-hidden="true" /> Validando…</>
              : 'Confirmar validación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Rechazar ────────────────────────────────────────────────────────────
function RechazarModal({ registro, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [alert,  setAlert]  = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  async function handleConfirm() {
    const _motivo = motivo.trim();
    if (!_motivo) {
      setAlert('El motivo de rechazo es obligatorio.');
      return;
    }
    setSaving(true);
    setAlert(null);
    try {
      await onConfirm(_motivo);
      onClose?.();
    } catch (err) {
      console.error('[RechazarModal]', err);
      setAlert(err.message || 'No se pudo rechazar el registro.');
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rechazarModalTitle"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 id="rechazarModalTitle">Rechazar registro</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          <p className="rechazar-modal-alumno">
            Estás rechazando la solicitud de <strong>{registro.nombre}</strong>{' '}
            ({registro.email}).
          </p>

          <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
            <label htmlFor="rechazarMotivo">
              Motivo del rechazo <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              id="rechazarMotivo"
              rows={4}
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setAlert(null); }}
              placeholder="Escribe el motivo del rechazo (se guardará como nota interna)…"
              autoFocus
              maxLength={500}
            />
            <span className="field-hint">{motivo.length} / 500</span>
          </div>

          {alert && (
            <div className="form-alert error">
              {alert}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={saving || !motivo.trim()}
          >
            {saving
              ? <><span className="btn-spinner" aria-hidden="true" /> Rechazando…</>
              : 'Confirmar rechazo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RegistrosPendientesPage() {
  const client = createClient();
  const router = useRouter();

  const [currentUser,  setCurrentUser]  = useState(null);
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  const [registros,    setRegistros]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState(null);

  // Modales
  const [validarTarget,  setValidarTarget]  = useState(null);
  const [rechazarTarget, setRechazarTarget] = useState(null);

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
        console.error('[Registros] auth:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guard de permiso ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    if (!tienePermiso('registros.ver')) {
      router.replace('/admin');
    }
  }, [currentUser, tienePermiso, router]);

  // ── Cargar registros pendientes ─────────────────────────────────────────────
  const loadRegistros = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await client
        .from('registro_alumnos')
        .select('id, email, nombre, numero_cuenta, telefono, tiene_whatsapp, fecha_registro')
        .eq('estado', 'pendiente_validacion')
        .order('fecha_registro', { ascending: true }); // más antiguos primero
      if (error) throw error;
      setRegistros(data ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[Registros] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser]);

  useEffect(() => { loadRegistros(); }, [loadRegistros]);

  // Auto-refresh cada 60 segundos
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => { loadRegistros(); }, 60_000);
    return () => clearInterval(interval);
  }, [currentUser, loadRegistros]);

  // ── Validar ─────────────────────────────────────────────────────────────────
  async function handleValidar(registroId) {
    const json = await callEdgeFunction(client, 'validate-registro', { id: registroId });
    if (!json.success) {
      const msgs = {
        YA_VALIDADO:          'Este registro ya fue validado anteriormente.',
        EMAIL_EXISTS_IN_AUTH: 'El email de este alumno ya tiene una cuenta en el sistema.',
        RECORD_NOT_FOUND:     'No se encontró el registro.',
      };
      throw new Error(msgs[json.code] || json.error || 'Error al validar el registro.');
    }
    loadRegistros();
  }

  // ── Rechazar ────────────────────────────────────────────────────────────────
  async function handleRechazar(registroId, notas_admin) {
    const json = await callEdgeFunction(client, 'reject-registro', { id: registroId, notas_admin });
    if (!json.success) {
      const msgs = {
        YA_PROCESADO:     'Este registro ya fue procesado anteriormente.',
        RECORD_NOT_FOUND: 'No se encontró el registro.',
      };
      throw new Error(msgs[json.code] || json.error || 'Error al rechazar el registro.');
    }
    loadRegistros();
  }

  const canValidar  = tienePermiso('registros.validar');
  const canRechazar = tienePermiso('registros.rechazar');

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <h2>Registros Pendientes</h2>
          <p>Solicitudes de acceso de alumnos en espera de validación</p>
        </div>
      </div>

      {/* ── Barra de contador + auto-refresh ───────────────────────────────── */}
      <div className="registros-counter-bar">
        {!loading && !loadError && (
          <>
            <span className="registros-badge">
              {registros.length} pendiente{registros.length !== 1 ? 's' : ''}
            </span>
            {lastRefresh && (
              <span className="registros-auto-refresh-hint">
                <RefreshCw size={12} aria-hidden="true" />
                Actualizado a las {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {' '}· Auto-refresh cada 60 s
              </span>
            )}
          </>
        )}
        {loading && (
          <span className="registros-auto-refresh-hint">
            <span className="btn-spinner" style={{ borderColor: 'rgba(107,114,128,0.4)', borderTopColor: '#6B7280' }} aria-hidden="true" />
            Cargando…
          </span>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadRegistros}
          disabled={loading}
          style={{ marginLeft: 'auto' }}
          aria-label="Actualizar lista de registros"
        >
          <RefreshCw size={14} aria-hidden="true" /> Actualizar
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {loadError && (
        <div className="form-alert error" role="alert" style={{ marginBottom: 'var(--spacing-lg)' }}>
          Error al cargar los registros.{' '}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadRegistros}
            style={{ marginLeft: 8 }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      {!loadError && (
        <div className="table-wrapper">
          <table className="registros-table" aria-label="Solicitudes de registro pendientes">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Nº Cuenta</th>
                <th>Teléfono</th>
                <th>WhatsApp</th>
                <th>Fecha de solicitud</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="registros-empty-state">
                    <span className="btn-spinner" style={{ borderColor: 'rgba(107,114,128,0.4)', borderTopColor: '#6B7280', width: 16, height: 16, marginRight: 8 }} aria-hidden="true" />
                    Cargando registros…
                  </td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="registros-empty-state" role="status" aria-live="polite">
                      <p style={{ margin: 0, fontWeight: 600 }}>No hay solicitudes pendientes</p>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
                        Todas las solicitudes han sido procesadas. La lista se actualiza automáticamente cada minuto.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                registros.map((reg) => (
                  <tr key={reg.id}>
                    {/* Nombre */}
                    <td data-label="Nombre">
                      <strong>{reg.nombre}</strong>
                    </td>

                    {/* Email */}
                    <td data-label="Email">
                      <a
                        className="email-link"
                        href={`mailto:${reg.email}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {reg.email}
                      </a>
                    </td>

                    {/* Nº Cuenta */}
                    <td data-label="Nº Cuenta">
                      <span className="cuenta-code">{reg.numero_cuenta}</span>
                    </td>

                    {/* Teléfono — oculto en ≤ 900px vía CSS */}
                    <td data-label="Teléfono" className="td-telefono">
                      {reg.telefono || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>

                    {/* WhatsApp — oculto en ≤ 900px vía CSS */}
                    <td data-label="WhatsApp" className="td-whatsapp">
                      {reg.tiene_whatsapp ? (
                        <span className="badge-registros-wa" aria-label="Tiene WhatsApp">
                          {/* Ícono WA inline SVG */}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Sí
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No</span>
                      )}
                    </td>

                    {/* Fecha — oculta en ≤ 640px vía CSS */}
                    <td data-label="Fecha de solicitud" className="td-fecha">
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(reg.fecha_registro)}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td data-label="Acciones" className="td-acciones">
                      <div className="registros-acciones">
                        {canValidar && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setValidarTarget(reg)}
                            aria-label={`Validar registro de ${reg.nombre}`}
                          >
                            Validar
                          </button>
                        )}
                        {canRechazar && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => setRechazarTarget(reg)}
                            aria-label={`Rechazar registro de ${reg.nombre}`}
                          >
                            Rechazar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal validar ───────────────────────────────────────────────────── */}
      {validarTarget && (
        <ValidarModal
          registro={validarTarget}
          onClose={() => setValidarTarget(null)}
          onConfirm={() => handleValidar(validarTarget.id)}
        />
      )}

      {/* ── Modal rechazar ──────────────────────────────────────────────────── */}
      {rechazarTarget && (
        <RechazarModal
          registro={rechazarTarget}
          onClose={() => setRechazarTarget(null)}
          onConfirm={(motivo) => handleRechazar(rechazarTarget.id, motivo)}
        />
      )}
    </div>
  );
}
