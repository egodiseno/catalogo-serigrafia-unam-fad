'use client';

/**
 * app/(admin)/admin/tags/page.jsx — /admin/tags (Gestión de Tags)
 *
 * Client Component. Auth directa con createClient() singleton — sin useAuth.
 * Port de tags-crud.js (VanillaJS).
 *
 * Schema verificado del código existente:
 *   tags:      id (uuid), nombre (text), slug (text)
 *   obra_tags: obra_id (uuid FK → obras.id), tag_id (uuid FK → tags.id)
 *
 * Nota: el límite de 3 tags por obra se aplica en ObraForm.jsx al seleccionar
 * tags — NO aquí. Esta página solo gestiona el catálogo de tags disponibles.
 *
 * Clases CSS verificadas en styles/admin.css:
 *   .section-header / .table-wrapper / .empty-state / .action-buttons / .actions-cell
 *   .btn / .btn-sm / .btn-secondary / .btn-danger / .btn--icon-only / .btn-primary
 *   .modal-overlay / .modal-dialog / .modal-header / .modal-body / .modal-footer
 *   .modal-close / .form-group / .field-hint / .form-alert / .tag-badge
 *   table.tags-table
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient }  from '@/lib/supabase/client';
import { usePermisos }   from '@/hooks/usePermisos';
import ConfirmModal      from '@/components/admin/ConfirmModal';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

// ── Slug helper ───────────────────────────────────────────────────────────────
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

// ── Modal form inline (campo: nombre únicamente) ──────────────────────────────
function TagModal({ tag = null, onClose, onSaved }) {
  const client = createClient();
  const isEdit = !!tag?.id;

  const [nombre, setNombre] = useState(tag?.nombre ?? '');
  const [alert,  setAlert]  = useState(null);
  const [saving, setSaving] = useState(false);

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
    if (_nombre.length > 60)
      return setAlert({ msg: 'El nombre no puede superar 60 caracteres.', type: 'error' });

    const slug = generateSlug(_nombre);
    const payload = { nombre: _nombre, slug };

    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await client.from('tags').update(payload).eq('id', tag.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('tags').insert(payload);
        if (error) throw error;
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('[TagModal] handleSave:', err);
      const dup = err.message?.includes('unique') || err.code === '23505';
      setAlert({ msg: dup ? 'Ya existe un tag con ese nombre.' : 'No se pudo guardar. Inténtalo de nuevo.', type: 'error' });
      setSaving(false);
    }
  }

  // Confirmar con Enter en el input
  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tagModalTitle"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 id="tagModalTitle">{isEdit ? 'Editar Tag' : 'Nuevo Tag'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="tagNombre">
              Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="tagNombre"
              type="text"
              maxLength={60}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <span className="field-hint">
              {nombre.length} / 60 — El slug se genera automáticamente: <em>{generateSlug(nombre) || '—'}</em>
            </span>
          </div>
          {alert && <div className={`form-alert ${alert.type}`}>{alert.msg}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear tag'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function TagsPage() {
  const client = createClient();

  const [currentUser, setCurrentUser] = useState(null);
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  const [tags,       setTags]      = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [loadError,  setLoadError] = useState(false);

  // modal: undefined=cerrado, null=nuevo, obj=editar
  const [modalTag,     setModalTag]    = useState(undefined);
  // borrar
  const [deleteTarget, setDeleteTarget] = useState(null);
  // error al intentar borrar un tag con obras
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
        console.error('[Tags] auth:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar tags con conteo de obras que los usan ────────────────────────────
  const loadTags = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      // obra_tags tiene FK tag_id → tags.id, lo que permite el join embebido
      const { data, error } = await client
        .from('tags')
        .select('id, nombre, slug, obra_tags(obra_id)')
        .order('nombre');
      if (error) throw error;
      setTags(data ?? []);
    } catch (err) {
      console.error('[Tags] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser]);

  useEffect(() => { loadTags(); }, [loadTags]);

  // ── Intentar eliminar: verificar obras que usan el tag ─────────────────────
  async function handleDeleteIntent(tag) {
    setDeleteError(null);
    const obrasCount = tag.obra_tags?.length ?? 0;
    if (obrasCount > 0) {
      setDeleteError(`No se puede eliminar el tag "${tag.nombre}": ${obrasCount} obra${obrasCount !== 1 ? 's' : ''} lo ${obrasCount !== 1 ? 'usan' : 'usa'}. Quita este tag de esas obras primero.`);
      return;
    }
    setDeleteTarget(tag);
  }

  // ── Confirmar eliminación ───────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await client.from('tags').delete().eq('id', deleteTarget.id);
    if (error) {
      console.error('[Tags] delete:', error);
      throw error;
    }
    setDeleteTarget(null);
    loadTags();
  }

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2>Tags</h2>
          <p>Etiquetas temáticas del catálogo (máx. 3 por obra)</p>
        </div>
        {tienePermiso('tags.crear') && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalTag(null)}
          >
            <Plus size={16} aria-hidden="true" /> Nuevo Tag
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
        <table className="tags-table" aria-label="Tabla de tags">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Obras que lo usan</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="empty-state">Cargando…</td></tr>
            ) : loadError ? (
              <tr><td colSpan={4} className="empty-state">Error al cargar tags.</td></tr>
            ) : tags.length === 0 ? (
              <tr><td colSpan={4} className="empty-state">No hay tags registrados. Crea el primero.</td></tr>
            ) : (
              tags.map((tag) => {
                const obrasCount = tag.obra_tags?.length ?? 0;
                return (
                  <tr key={tag.id}>
                    <td data-label="Nombre">
                      {/* .tag-badge: pill visual verificado en styles/admin.css ln 3065 */}
                      <span className="tag-badge">{tag.nombre}</span>
                    </td>
                    <td data-label="Slug">
                      <code style={{ fontSize: '0.8em', opacity: 0.75 }}>{tag.slug}</code>
                    </td>
                    <td data-label="Obras">
                      <span>{obrasCount}</span>
                    </td>
                    <td className="actions-cell" data-label="Acciones">
                      <div className="action-buttons">
                        {tienePermiso('tags.editar') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary btn--icon-only"
                            onClick={() => { setDeleteError(null); setModalTag(tag); }}
                            title="Editar"
                            aria-label={`Editar tag ${tag.nombre}`}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        )}
                        {tienePermiso('tags.borrar') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger btn--icon-only"
                            onClick={() => handleDeleteIntent(tag)}
                            title="Eliminar"
                            aria-label={`Eliminar tag ${tag.nombre}`}
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

      {/* Contador */}
      {!loading && !loadError && tags.length > 0 && (
        <p className="field-hint" style={{ marginTop: 'var(--spacing-md)', textAlign: 'right' }}>
          {tags.length} tag{tags.length !== 1 ? 's' : ''} registrado{tags.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Modal crear/editar */}
      {modalTag !== undefined && (
        <TagModal
          tag={modalTag}
          onClose={() => setModalTag(undefined)}
          onSaved={() => loadTags()}
        />
      )}

      {/* Confirm eliminar */}
      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar tag?"
          message={`Se eliminará el tag "${deleteTarget.nombre}". Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
