'use client';

/**
 * app/(admin)/admin/usuarios/page.jsx — /admin/usuarios (Gestión de Usuarios)
 *
 * Client Component. Auth directa con createClient() singleton — sin useAuth.
 * Port de usuarios-crud.js + csv-import.js (VanillaJS).
 *
 * Schema verificado (usuarios_admin):
 *   id (uuid = auth.users.id), email (text), nombre (text|null),
 *   rol ('admin'|'super_editor'|'editor'), estado ('activo'|'inactivo'),
 *   created_at (timestamptz)
 *
 * Edge Functions:
 *   create-admin-user  POST { email, password, nombre?, rol }
 *                      Headers: Authorization + apikey
 *                      Response: { success: true, userId, email }
 *   delete-users-batch POST { emails: string[] }
 *                      Headers: Authorization + apikey
 *                      Response: { success: true, deleted_count, ... }
 *
 * Clases CSS verificadas en styles/admin.css:
 *   .section-header / .section-header-actions / .table-wrapper / .empty-state
 *   .action-buttons / .actions-cell / .search-field / .search-field__icon
 *   .search-field__input / .badge (base) — rol/estado con inline style
 *   .btn / .btn-sm / .btn-secondary / .btn-danger / .btn--icon-only / .btn-primary
 *   .modal-overlay / .modal-dialog / .modal-dialog--lg / .modal-header / .modal-body
 *   .modal-footer / .modal-close / .form-group / .field-hint / .form-alert
 *   table.usuarios-table / .th-checkbox / .td-checkbox / .select-user / #selectAllUsers
 *   .avatar-circle (override tamaño vía inline style para tabla)
 *   .csv-preview-body / .csv-summary / .csv-badge / .csv-badge--crear
 *   .csv-badge--actualizar / .csv-badge--error / .csv-table-wrapper
 *   .csv-preview-table / .csv-empty / .csv-col-email / .csv-col-nombre
 *   .csv-col-rol / .csv-col-accion / .csv-action / .csv-action--crear
 *   .csv-action--actualizar / .csv-errors / .csv-error-list
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { Plus, Pencil, Trash2, X, Upload, Search } from 'lucide-react';

// ── Helpers de visualización ──────────────────────────────────────────────────
// Color de avatar por rol — igual que VanillaJS ROL_COLOR
const ROL_COLOR = {
  admin:        '#dc2626',
  super_editor: '#7c3aed',
  editor:       '#013B75',
};

function getRolBadgeStyle(rol) {
  switch (rol) {
    case 'admin':        return { background: '#cfe2ff', color: '#084298' };
    case 'super_editor': return { background: '#EDE9FE', color: '#4C1D95' };
    case 'editor':       return { background: '#e9ecef', color: '#495057' };
    default:             return { background: '#f3f4f6', color: '#374151' };
  }
}

function getRolLabel(rol) {
  switch (rol) {
    case 'admin':        return 'Admin';
    case 'super_editor': return 'Super Editor';
    case 'editor':       return 'Editor';
    default:             return rol ?? '—';
  }
}

function getEstadoBadgeStyle(estado) {
  return estado === 'activo'
    ? { background: '#d1e7dd', color: '#0a3622' }
    : { background: '#e9ecef', color: '#495057' };
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { rows: [], errors: [] };

  // Detectar encabezado: primera línea contiene "email" o "nombre" o "rol"
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('email') || firstLine.includes('nombre') || firstLine.includes('rol');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows   = [];
  const errors = [];
  const VALID_ROLES = ['admin', 'super_editor', 'editor'];

  dataLines.forEach((line, idx) => {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) {
      errors.push(`Fila ${idx + 1}: formato inválido (se esperan al menos 2 columnas)`);
      return;
    }

    // Detectar orden: si la primera columna contiene @ es email; si no, es nombre
    let nombre, email, rol;
    if (parts[0].includes('@')) {
      [email, nombre, rol] = parts;
    } else {
      [nombre, email, rol] = parts;
    }

    email  = (email  ?? '').trim().toLowerCase();
    nombre = (nombre ?? '').trim();
    rol    = (rol    ?? 'editor').trim().toLowerCase().replace(/\s+/g, '_');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Fila ${idx + 1}: email inválido (${email || 'vacío'})`);
      return;
    }

    if (!VALID_ROLES.includes(rol)) rol = 'editor';

    rows.push({ nombre, email, rol });
  });

  return { rows, errors };
}

// ── Edge Function call helper ─────────────────────────────────────────────────
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

// ── Modal crear / editar usuario ──────────────────────────────────────────────
function UsuarioModal({ usuario = null, onClose, onSaved }) {
  const client = createClient();
  const isEdit = !!usuario?.id;

  const [nombre,   setNombre]   = useState(usuario?.nombre ?? '');
  const [email,    setEmail]    = useState(usuario?.email  ?? '');
  const [password, setPassword] = useState('');
  const [rol,      setRol]      = useState(usuario?.rol    ?? 'editor');
  const [estado,   setEstado]   = useState(usuario?.estado ?? 'activo');
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  // Escape cierra
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave() {
    setAlert(null);
    const _email  = email.trim().toLowerCase();
    const _nombre = nombre.trim() || null;

    if (!isEdit) {
      if (!_email)
        return setAlert({ msg: 'El email es obligatorio.', type: 'error' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_email))
        return setAlert({ msg: 'Formato de email inválido.', type: 'error' });
      if (!password || password.length < 8)
        return setAlert({ msg: 'La contraseña debe tener al menos 8 caracteres.', type: 'error' });
    }

    setSaving(true);
    try {
      if (isEdit) {
        // UPDATE directo en usuarios_admin (nombre, rol, estado)
        const { error } = await client
          .from('usuarios_admin')
          .update({ nombre: _nombre, rol, estado })
          .eq('id', usuario.id);
        if (error) throw error;
      } else {
        // CREATE vía Edge Function create-admin-user
        const json = await callEdgeFunction(client, 'create-admin-user', {
          email:    _email,
          password,
          nombre:   _nombre ?? undefined,
          rol,
        });
        if (!json.success) {
          const isEmailDup = json.code === 'EMAIL_EXISTS';
          throw new Error(
            isEmailDup
              ? `El email "${_email}" ya está registrado.`
              : (json.error || 'No se pudo crear el usuario.')
          );
        }
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('[UsuarioModal] handleSave:', err);
      setAlert({ msg: err.message || 'No se pudo guardar. Inténtalo de nuevo.', type: 'error' });
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="usuarioModalTitle"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 id="usuarioModalTitle">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          {/* Email — solo en creación */}
          {!isEdit && (
            <div className="form-group">
              <label htmlFor="uEmail">
                Email <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="uEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>
          )}

          {/* Nombre */}
          <div className="form-group">
            <label htmlFor="uNombre">Nombre completo</label>
            <input
              id="uNombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus={isEdit}
              autoComplete="name"
            />
          </div>

          {/* Contraseña — solo en creación */}
          {!isEdit && (
            <div className="form-group">
              <label htmlFor="uPassword">
                Contraseña <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="uPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
              <span className="field-hint">Mínimo 8 caracteres</span>
            </div>
          )}

          {/* Rol */}
          <div className="form-group">
            <label htmlFor="uRol">
              Rol <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select id="uRol" value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="editor">Editor</option>
              <option value="super_editor">Super Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Estado — solo en edición */}
          {isEdit && (
            <div className="form-group">
              <label htmlFor="uEstado">
                Estado <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select id="uEstado" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          )}

          {alert && <div className={`form-alert ${alert.type}`}>{alert.msg}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal importar CSV ────────────────────────────────────────────────────────
function CsvImportModal({ onClose, onDone }) {
  const client     = createClient();
  const fileInputRef = useRef(null);

  const [isDragOver,      setIsDragOver]      = useState(false);
  const [file,            setFile]            = useState(null);
  const [parsed,          setParsed]          = useState(null); // { rows, errors }
  const [existingEmails,  setExistingEmails]  = useState(new Set());
  const [password,        setPassword]        = useState('');
  const [importing,       setImporting]       = useState(false);
  const [progress,        setProgress]        = useState([]); // { email, status, msg }
  const [alert,           setAlert]           = useState(null);

  const importDone = progress.length > 0 && !importing;

  // Escape cierra (solo si no está importando)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !importing) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, importing]);

  async function handleFile(f) {
    if (!f) return;
    setAlert(null);
    if (!f.name.toLowerCase().endsWith('.csv') && !f.type.includes('csv')) {
      setAlert({ msg: 'Solo se aceptan archivos .csv', type: 'error' });
      return;
    }
    const text   = await f.text();
    const result = parseCSV(text);
    setParsed(result);
    setFile(f);

    // Verificar emails que ya existen en usuarios_admin
    if (result.rows.length > 0) {
      const emails = result.rows.map(r => r.email);
      const { data } = await client
        .from('usuarios_admin')
        .select('email')
        .in('email', emails);
      setExistingEmails(new Set((data ?? []).map(u => u.email)));
    }
  }

  function handleReset() {
    setParsed(null);
    setFile(null);
    setExistingEmails(new Set());
    setProgress([]);
    setAlert(null);
    setPassword('');
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return;
    const crearRows = parsed.rows.filter(r => !existingEmails.has(r.email));
    if (crearRows.length > 0 && (!password || password.length < 8)) {
      setAlert({ msg: 'La contraseña inicial debe tener al menos 8 caracteres.', type: 'error' });
      return;
    }
    setAlert(null);
    setImporting(true);
    setProgress(parsed.rows.map(r => ({ email: r.email, status: 'pending', msg: '' })));

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const isUpdate = existingEmails.has(row.email);
      try {
        if (isUpdate) {
          // UPDATE directo en usuarios_admin
          const { error } = await client
            .from('usuarios_admin')
            .update({ nombre: row.nombre || null, rol: row.rol })
            .eq('email', row.email);
          if (error) throw error;
        } else {
          // CREATE vía Edge Function
          const json = await callEdgeFunction(client, 'create-admin-user', {
            email:    row.email,
            password,
            nombre:   row.nombre || undefined,
            rol:      row.rol,
          });
          if (!json.success) throw new Error(json.error || 'Error al crear usuario');
        }
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'ok' } : p));
      } catch (err) {
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', msg: err.message } : p));
      }
    }

    setImporting(false);
    onDone?.(); // recarga la lista en la página padre
  }

  const validRows     = parsed?.rows ?? [];
  const crearRows     = validRows.filter(r => !existingEmails.has(r.email));
  const actualizarRows = validRows.filter(r => existingEmails.has(r.email));

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csvModalTitle"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose?.(); }}
    >
      <div className="modal-dialog modal-dialog--lg">
        <div className="modal-header">
          <h3 id="csvModalTitle">Importar usuarios desde CSV</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={importing}
            aria-label="Cerrar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body csv-preview-body">
          {alert && (
            <div className={`form-alert ${alert.type}`} style={{ marginBottom: 'var(--spacing-md)' }}>
              {alert.msg}
            </div>
          )}

          {/* ── Zona drag & drop (antes de parsear) ──────────────────────── */}
          {!parsed && (
            <div
              style={{
                border:       `2px dashed ${isDragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding:      'var(--spacing-2xl)',
                textAlign:    'center',
                cursor:       'pointer',
                background:   isDragOver ? '#EBF0FA' : 'var(--color-surface-alt, #F9FAFB)',
                transition:   'border-color 0.15s, background 0.15s',
              }}
              onDragOver={(e)  => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              aria-label="Zona de carga de CSV — haz clic o arrastra un archivo"
            >
              <Upload
                size={32}
                style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-muted)' }}
                aria-hidden="true"
              />
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Arrastra un CSV aquí o <strong>haz clic para seleccionar</strong>
              </p>
              <p style={{ margin: 'var(--spacing-xs) 0 0', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                Columnas esperadas: <code>nombre, email, rol</code> — encabezado opcional
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          )}

          {/* ── Preview de filas (después de parsear, antes de importar) ──── */}
          {parsed && progress.length === 0 && (
            <>
              {/* Resumen de badges */}
              <div className="csv-summary">
                {crearRows.length > 0 && (
                  <span className="csv-badge csv-badge--crear">
                    {crearRows.length} a crear
                  </span>
                )}
                {actualizarRows.length > 0 && (
                  <span className="csv-badge csv-badge--actualizar">
                    {actualizarRows.length} a actualizar
                  </span>
                )}
                {parsed.errors.length > 0 && (
                  <span className="csv-badge csv-badge--error">
                    {parsed.errors.length} error{parsed.errors.length !== 1 ? 'es' : ''}
                  </span>
                )}
                {validRows.length === 0 && parsed.errors.length === 0 && (
                  <span className="csv-badge csv-badge--error">CSV vacío</span>
                )}
              </div>

              {/* Tabla preview */}
              {validRows.length > 0 ? (
                <div className="csv-table-wrapper">
                  <table className="csv-preview-table" aria-label="Vista previa de filas a importar">
                    <thead>
                      <tr>
                        <th className="csv-col-nombre">Nombre</th>
                        <th className="csv-col-email">Email</th>
                        <th className="csv-col-rol">Rol</th>
                        <th className="csv-col-accion">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.map((row, i) => (
                        <tr key={i}>
                          <td className="csv-col-nombre">{row.nombre || '—'}</td>
                          <td className="csv-col-email">{row.email}</td>
                          <td className="csv-col-rol">
                            <span className="badge" style={getRolBadgeStyle(row.rol)}>
                              {getRolLabel(row.rol)}
                            </span>
                          </td>
                          <td className="csv-col-accion">
                            <span className={`csv-action ${existingEmails.has(row.email) ? 'csv-action--actualizar' : 'csv-action--crear'}`}>
                              {existingEmails.has(row.email) ? 'Actualizar' : 'Crear'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="csv-empty">No hay filas válidas para importar.</p>
              )}

              {/* Errores de parseo */}
              {parsed.errors.length > 0 && (
                <details className="csv-errors" style={{ marginTop: 'var(--spacing-md)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {parsed.errors.length} fila{parsed.errors.length !== 1 ? 's' : ''} con error de formato
                  </summary>
                  <ul className="csv-error-list">
                    {parsed.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </details>
              )}

              {/* Contraseña inicial — solo si hay filas para crear */}
              {crearRows.length > 0 && (
                <div className="form-group" style={{ marginTop: 'var(--spacing-lg)' }}>
                  <label htmlFor="csvPassword">
                    Contraseña inicial <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="csvPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <span className="field-hint">
                    Se aplicará a los {crearRows.length} usuario{crearRows.length !== 1 ? 's' : ''} nuevos
                  </span>
                </div>
              )}

              {/* Botón cambiar archivo */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 'var(--spacing-sm)' }}
                onClick={handleReset}
              >
                Cambiar archivo
              </button>
            </>
          )}

          {/* ── Progreso de importación ───────────────────────────────────── */}
          {progress.length > 0 && (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--text-sm)' }}>
                {importing ? 'Importando…' : `Importación completada — ${progress.filter(p => p.status === 'ok').length} de ${progress.length} exitoso${progress.filter(p => p.status === 'ok').length !== 1 ? 's' : ''}`}
              </p>
              {progress.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:           8,
                    marginBottom:  4,
                    fontSize:      'var(--text-sm)',
                    color:         p.status === 'error' ? 'var(--color-error)' : 'inherit',
                  }}
                >
                  <span style={{ width: 18, textAlign: 'center', flexShrink: 0 }}>
                    {p.status === 'pending' ? '…' : p.status === 'ok' ? '✓' : '✗'}
                  </span>
                  <span style={{ flex: 1 }}>{p.email}</span>
                  {p.status === 'error' && p.msg && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{p.msg}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={importDone ? onClose : onClose}
            disabled={importing}
          >
            {importDone ? 'Cerrar' : 'Cancelar'}
          </button>
          {parsed && validRows.length > 0 && progress.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing}
            >
              Importar {validRows.length} usuario{validRows.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const client = createClient();
  const router = useRouter();

  const [currentUser,  setCurrentUser]  = useState(null);
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  const [usuarios,     setUsuarios]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);

  // Búsqueda con debounce
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef(null);

  // Selección múltiple: Set de IDs
  const [selected, setSelected] = useState(new Set());

  // Modals: undefined=cerrado, null=nuevo, obj=editar
  const [modalUser,    setModalUser]    = useState(undefined);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [batchDelete,  setBatchDelete]  = useState(false);

  const [deleteError,  setDeleteError]  = useState(null);

  // ── Debounce búsqueda ───────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

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
        console.error('[Usuarios] auth:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guard de permiso ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    if (!tienePermiso('usuarios.ver')) {
      router.replace('/admin');
    }
  }, [currentUser, tienePermiso, router]);

  // ── Cargar usuarios ─────────────────────────────────────────────────────────
  const loadUsuarios = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      let query = client
        .from('usuarios_admin')
        .select('id, email, nombre, numero_cuenta, rol, estado')
        .order('email', { ascending: true });

      if (debouncedSearch) {
        query = query.or(
          `email.ilike.%${debouncedSearch}%,nombre.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsuarios(data ?? []);
      setSelected(new Set()); // limpiar selección al recargar
    } catch (err) {
      console.error('[Usuarios] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser, debouncedSearch]);

  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);

  // ── Selección ───────────────────────────────────────────────────────────────
  const allSelected  = usuarios.length > 0 && selected.size === usuarios.length;
  const someSelected = selected.size > 0 && !allSelected;

  function handleSelectAll(checked) {
    setSelected(checked ? new Set(usuarios.map(u => u.id)) : new Set());
  }

  function handleSelectOne(id, checked) {
    setSelected(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  // ── Eliminar uno ────────────────────────────────────────────────────────────
  async function handleDeleteOne() {
    if (!deleteTarget) return;
    const json = await callEdgeFunction(client, 'delete-users-batch', {
      emails: [deleteTarget.email],
    });
    if (!json.success) throw new Error(json.error || 'Error al eliminar usuario.');
    setDeleteTarget(null);
    loadUsuarios();
  }

  // ── Eliminar lote ───────────────────────────────────────────────────────────
  async function handleDeleteBatch() {
    const selectedUsers = usuarios.filter(u => selected.has(u.id));
    const emails        = selectedUsers.map(u => u.email);
    if (emails.length === 0) return;

    const json = await callEdgeFunction(client, 'delete-users-batch', { emails });
    if (!json.success) throw new Error(json.error || 'Error al eliminar usuarios.');
    setBatchDelete(false);
    setSelected(new Set());
    loadUsuarios();
  }

  // ── Columnas que dependen de permisos ───────────────────────────────────────
  const showCheckbox = tienePermiso('usuarios.borrar');
  const colSpan      = showCheckbox ? 7 : 6;

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <h2>Usuarios</h2>
          <p>Gestión de cuentas del panel de administración</p>
        </div>
        <div className="section-header-actions">
          {tienePermiso('usuarios.crear') && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCsvModal(true)}
            >
              <Upload size={16} aria-hidden="true" /> Importar CSV
            </button>
          )}
          {tienePermiso('usuarios.crear') && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setDeleteError(null); setModalUser(null); }}
            >
              <Plus size={16} aria-hidden="true" /> Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      {/* ── Error de operación ──────────────────────────────────────────────── */}
      {deleteError && (
        <div
          className="form-alert error"
          role="alert"
          style={{ marginBottom: 'var(--spacing-lg)' }}
        >
          {deleteError}
          <button
            type="button"
            style={{
              marginLeft: 12, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', color: 'inherit',
            }}
            onClick={() => setDeleteError(null)}
            aria-label="Cerrar aviso"
          >✕</button>
        </div>
      )}

      {/* ── Barra búsqueda + acción batch ──────────────────────────────────── */}
      <div style={{
        display:       'flex',
        gap:           'var(--spacing-md)',
        marginBottom:  'var(--spacing-lg)',
        alignItems:    'center',
        flexWrap:      'wrap',
      }}>
        <div className="search-field" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-field__icon" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            type="search"
            className="search-field__input"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar usuarios"
          />
        </div>
        {selected.size > 0 && tienePermiso('usuarios.borrar') && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setBatchDelete(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            {' '}Eliminar {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div className="table-wrapper">
        <table className="usuarios-table" aria-label="Tabla de usuarios">
          <thead>
            <tr>
              {showCheckbox && (
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    id="selectAllUsers"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label="Seleccionar todos los usuarios"
                  />
                </th>
              )}
              <th>Email</th>
              <th>Número de cuenta</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="empty-state">Cargando…</td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={colSpan} className="empty-state">
                  Error al cargar usuarios.{' '}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={loadUsuarios}
                    style={{ marginLeft: 8 }}
                  >
                    Reintentar
                  </button>
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="empty-state">
                  {debouncedSearch
                    ? `Sin resultados para "${debouncedSearch}".`
                    : 'No hay usuarios registrados.'}
                </td>
              </tr>
            ) : (
              usuarios.map((u) => {
                const inicial = ((u.nombre || u.email || 'U').trim().charAt(0)).toUpperCase();
                return (
                  <tr key={u.id}>
                    {showCheckbox && (
                      <td className="td-checkbox">
                        <input
                          type="checkbox"
                          className="select-user"
                          checked={selected.has(u.id)}
                          onChange={(e) => handleSelectOne(u.id, e.target.checked)}
                          aria-label={`Seleccionar ${u.nombre || u.email}`}
                        />
                      </td>
                    )}
                    <td>
                      <div className="td-email-cell">
                        <span
                          className="row-avatar"
                          style={{ background: ROL_COLOR[u.rol] ?? '#6b7280' }}
                          aria-hidden="true"
                        >
                          {inicial}
                        </span>
                        <span>{u.email}</span>
                      </div>
                    </td>
                    <td className="td-cuenta">
                      {u.numero_cuenta
                        ? <code className="cuenta-code">{u.numero_cuenta}</code>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {(u.nombre && u.nombre !== '-')
                        ? u.nombre
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className="badge" style={getRolBadgeStyle(u.rol)}>
                        {getRolLabel(u.rol)}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={getEstadoBadgeStyle(u.estado)}>
                        {u.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        {tienePermiso('usuarios.editar') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary btn--icon-only"
                            onClick={() => { setDeleteError(null); setModalUser(u); }}
                            title="Editar usuario"
                            aria-label={`Editar ${u.nombre || u.email}`}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        )}
                        {tienePermiso('usuarios.borrar') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger btn--icon-only"
                            onClick={() => { setDeleteError(null); setDeleteTarget(u); }}
                            title="Eliminar usuario"
                            aria-label={`Eliminar ${u.nombre || u.email}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Contador ────────────────────────────────────────────────────────── */}
      {!loading && !loadError && (
        <p className="field-hint" style={{ marginTop: 'var(--spacing-md)', textAlign: 'right' }}>
          {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
          {debouncedSearch
            ? ` encontrado${usuarios.length !== 1 ? 's' : ''}`
            : ` registrado${usuarios.length !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* ── Modal crear/editar ───────────────────────────────────────────────── */}
      {modalUser !== undefined && (
        <UsuarioModal
          usuario={modalUser}
          onClose={() => setModalUser(undefined)}
          onSaved={() => loadUsuarios()}
        />
      )}

      {/* ── Modal importar CSV ───────────────────────────────────────────────── */}
      {showCsvModal && (
        <CsvImportModal
          onClose={() => setShowCsvModal(false)}
          onDone={() => { setShowCsvModal(false); loadUsuarios(); }}
        />
      )}

      {/* ── Confirm eliminar uno ─────────────────────────────────────────────── */}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar usuario?"
          message={`Se eliminará "${deleteTarget.nombre || deleteTarget.email}" y su acceso al panel. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          confirmVariant="danger"
          onConfirm={handleDeleteOne}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Confirm eliminar lote ────────────────────────────────────────────── */}
      {batchDelete && (
        <ConfirmModal
          title={`¿Eliminar ${selected.size} usuario${selected.size !== 1 ? 's' : ''}?`}
          message={`Se eliminarán ${selected.size} usuario${selected.size !== 1 ? 's' : ''} seleccionado${selected.size !== 1 ? 's' : ''} y su acceso al panel. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar todos"
          confirmVariant="danger"
          onConfirm={handleDeleteBatch}
          onCancel={() => setBatchDelete(false)}
        />
      )}
    </div>
  );
}
