'use client';

/**
 * app/(admin)/admin/tecnicas/page.jsx — /admin/tecnicas (Gestión de Técnicas)
 *
 * Client Component. Auth directa con createClient() singleton — sin useAuth.
 * Port de tecnicas-crud.js (VanillaJS).
 *
 * Schema verificado del código existente:
 *   tecnicas: id (uuid), nombre (text), slug (text), descripcion (text|null)
 *   obras:    tecnica_id (uuid FK → tecnicas.id)
 *
 * Clases CSS verificadas en styles/admin.css:
 *   .section-header / .table-wrapper / .empty-state / .action-buttons / .actions-cell
 *   .btn / .btn-sm / .btn-secondary / .btn-danger / .btn--icon-only / .btn-primary
 *   .modal-overlay / .modal-dialog / .modal-dialog--lg / .modal-header / .modal-body
 *   .modal-footer / .modal-close / .form-group / .field-hint / .form-alert
 *   table.tecnicas-table
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient }  from '@/lib/supabase/client';
import { usePermisos }   from '@/hooks/usePermisos';
import ConfirmModal      from '@/components/admin/ConfirmModal';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

// ── Slug helper — transliterar acentos → lowercase → guiones ─────────────────
function generateSlug(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Modal form inline ─────────────────────────────────────────────────────────
function TecnicaModal({ tecnica = null, onClose, onSaved }) {
  const client  = createClient();
  const isEdit  = !!tecnica?.id;

  const [nombre,      setNombre]     = useState(tecnica?.nombre      ?? '');
  const [descripcion, setDescripcion] = useState(tecnica?.descripcion ?? '');
  const [alert,       setAlert]      = useState(null);
  const [saving,      setSaving]     = useState(false);

  // Escape cierra
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave() {
    setAlert(null);
    const _nombre = nombre.trim();
    if (!_nombre) return setAlert({ msg: 'El nombre es obligatorio.', type: 'error' });

    const slug = generateSlug(_nombre);
    const payload = { nombre: _nombre, slug, descripcion: descripcion.trim() || null };

    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await client
          .from('tecnicas')
          .update(payload)
          .eq('id', tecnica.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('tecnicas').insert(payload);
        if (error) throw error;
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('[TecnicaModal] handleSave:', err);
      const dup = err.message?.includes('unique') || err.code === '23505';
      setAlert({ msg: dup ? 'Ya existe una técnica con ese nombre o slug.' : 'No se pudo guardar. Inténtalo de nuevo.', type: 'error' });
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tecnicaModalTitle"
      style={{ display: 'flex' }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 id="tecnicaModalTitle">{isEdit ? 'Editar Técnica' : 'Nueva Técnica'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="tecNombre">Nombre <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input
              id="tecNombre"
              type="text"
              maxLength={120}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="tecDesc">Descripción</label>
            <textarea
              id="tecDesc"
              rows={3}
              maxLength={400}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <span className="field-hint">{descripcion.length} / 400</span>
          </div>
          {alert && <div className={`form-alert ${alert.type}`}>{alert.msg}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear técnica'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function TecnicasPage() {
  const client = createClient();

  const [currentUser, setCurrentUser] = useState(null);
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  const [tecnicas,   setTecnicas]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(false);

  // modal: undefined=cerrado, null=nueva, obj=editar
  const [modalTecnica, setModalTecnica] = useState(undefined);
  // borrar: null=ninguno, { id, nombre, obrasCount }
  const [deleteTarget, setDeleteTarget] = useState(null);
  // error al intentar borrar una técnica con obras
  const [deleteError,  setDeleteError]  = useState(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await client.auth.getUser();
        if (error || !data?.user) { setLoadError(true); setLoading(false); return; }

        const { data: adminUser, error: adminErr } = await client
          .from('usuarios_admin')
          .select('rol, email')
          .eq('email', data.user.email)
          .single();
        if (adminErr || !adminUser) { setLoadError(true); setLoading(false); return; }

        setCurrentUser({ email: adminUser.email, rol: adminUser.rol });
      } catch (err) {
        console.error('[Tecnicas] auth:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar técnicas con conteo de obras ─────────────────────────────────────
  const loadTecnicas = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      // Traer tecnicas con sus obras para contar (relación tecnica_id → tecnicas.id)
      const { data, error } = await client
        .from('tecnicas')
        .select('id, nombre, slug, descripcion, obras(id)')
        .order('nombre');
      if (error) throw error;
      setTecnicas(data ?? []);
    } catch (err) {
      console.error('[Tecnicas] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser]);

  useEffect(() => { loadTecnicas(); }, [loadTecnicas]);

  // ── Intentar eliminar: verificar obras asociadas antes del confirm ──────────
  async function handleDeleteIntent(tecnica) {
    setDeleteError(null);
    const obrasCount = tecnica.obras?.length ?? 0;
    if (obrasCount > 0) {
      setDeleteError(`No se puede eliminar "${tecnica.nombre}": tiene ${obrasCount} obra${obrasCount !== 1 ? 's' : ''} asociada${obrasCount !== 1 ? 's' : ''}. Cambia la técnica de esas obras primero.`);
      return;
    }
    setDeleteTarget(tecnica);
  }

  // ── Confirmar eliminación ───────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await client.from('tecnicas').delete().eq('id', deleteTarget.id);
    if (error) {
      console.error('[Tecnicas] delete:', error);
      throw error;
    }
    setDeleteTarget(null);
    loadTecnicas();
  }

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2>Técnicas</h2>
          <p>Taxonomía de técnicas de serigrafía</p>
        </div>
        {tienePermiso('tecnicas.crear') && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalTecnica(null)}
          >
            <Plus size={16} aria-hidden="true" /> Nueva Técnica
          </button>
        )}
      </div>

      {/* Error de borrado (obra asociada) */}
      {deleteError && (
        <div
          className="form-alert error"
          role="alert"
          style={{ marginBottom: 'var(--spacing-lg)' }}
        >
          {deleteError}
          <button
            type="button"
            style={{ marginLeft: 12, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }}
            onClick={() => setDeleteError(null)}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="table-wrapper">
        <table className="tecnicas-table" aria-label="Tabla de técnicas">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Obras</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="empty-state">Cargando…</td></tr>
            ) : loadError ? (
              <tr><td colSpan={5} className="empty-state">Error al cargar técnicas.</td></tr>
            ) : tecnicas.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No hay técnicas registradas. Crea la primera.</td></tr>
            ) : (
              tecnicas.map((t) => (
                <tr key={t.id}>
                  <td data-label="Nombre"><strong>{t.nombre}</strong></td>
                  <td data-label="Slug">
                    <code style={{ fontSize: '0.8em', opacity: 0.75 }}>{t.slug}</code>
                  </td>
                  <td data-label="Obras">{t.obras?.length ?? 0}</td>
                  <td style={{ maxWidth: 260 }} data-label="Descripción">
                    {t.descripcion
                      ? <span title={t.descripcion}>{t.descripcion.length > 80 ? t.descripcion.slice(0, 80) + '…' : t.descripcion}</span>
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    }
                  </td>
                  <td className="actions-cell" data-label="Acciones">
                    <div className="action-buttons">
                      {tienePermiso('tecnicas.editar') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary btn--icon-only"
                          onClick={() => { setDeleteError(null); setModalTecnica(t); }}
                          title="Editar"
                          aria-label={`Editar técnica ${t.nombre}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      )}
                      {tienePermiso('tecnicas.borrar') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger btn--icon-only"
                          onClick={() => handleDeleteIntent(t)}
                          title="Eliminar"
                          aria-label={`Eliminar técnica ${t.nombre}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
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

      {/* Modal crear/editar */}
      {modalTecnica !== undefined && (
        <TecnicaModal
          tecnica={modalTecnica}
          onClose={() => setModalTecnica(undefined)}
          onSaved={() => loadTecnicas()}
        />
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar técnica?"
          message={`Se eliminará "${deleteTarget.nombre}". Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
