'use client';

/**
 * components/admin/ObraForm.jsx — Modal crear / editar obra
 *
 * Port React de obras-form.js + tags-in-obra.js (VanillaJS).
 *
 * Columnas verificadas contra supabase/migrations/:
 *   obras:    id, titulo, artista, año, estado, tecnica_id (FK), descripcion,
 *             visible_publico, snapshot_publicado, editor_id, slug (trigger)
 *   imagenes: id, obra_id, url_storage, principal, orden, pendiente_borrado
 *   obra_tags:obra_id, tag_id
 *   tecnicas: id, nombre, slug   ·   tags: id, nombre, slug
 *
 * NOTA slug: la columna `slug` se genera automáticamente por el trigger
 * `obras_slug_insert/obras_slug_update` (BEFORE INSERT/UPDATE) — ver
 * 20260612000000_add_slug_trigger_to_obras.sql. El cliente NO envía slug
 * (el trigger sobreescribe NEW.slug). Se incluye generateSlug() como utilidad
 * equivalente a la transliteración usada en obras-form.js (técnica inline).
 *
 * Props: { obra: null|ObraData, onClose: fn, onSaved: fn, userRol: string, userEmail: string }
 *
 * Clases CSS: solo las verificadas en styles/admin.css (grep PASO 0).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import ImageUpload from './ImageUpload';
import ConfirmModal from './ConfirmModal';
import { X, Trash2 } from 'lucide-react';

const DESC_MAX = 600;
const MAX_TAGS = 3;
const MAX_IMAGES = 4;

const ESTADOS_EDITOR = ['Borrador', 'En Revisión'];
const ESTADOS_ADMIN = ['Borrador', 'Publicado', 'En Revisión', 'Archivado'];

/**
 * Transliterar acentos → lowercase → guiones. Equivalente a la función de
 * slug usada en obras-form.js (creación inline de técnicas). El slug real de
 * la obra lo genera el trigger de Postgres; esta utilidad queda disponible.
 */
export function generateSlug(titulo) {
  return String(titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remover diacríticos
    .replace(/[^a-z0-9\s-]/g, '') // remover caracteres especiales
    .trim()
    .replace(/\s+/g, '-') // espacios → guiones
    .replace(/-+/g, '-'); // colapsar guiones
}

export default function ObraForm({ obra = null, onClose, onSaved, userRol, userEmail }) {
  const client = createClient();
  const imageUploadRef = useRef(null);

  const isEdit = !!obra?.id;
  const esEditor = userRol === 'editor';
  const estadosDisponibles = esEditor ? ESTADOS_EDITOR : ESTADOS_ADMIN;

  // Una obra publicada difiere el borrado de imágenes (pendiente_borrado)
  const esPublicada = obra?.estado === 'Publicado' || obra?.visible_publico === true;

  // ── Estado del formulario ───────────────────────────────────────────────
  const [titulo, setTitulo] = useState(obra?.titulo ?? '');
  const [artista, setArtista] = useState(
    obra?.artista ?? (esEditor ? userEmail ?? '' : '')
  );
  const [ano, setAno] = useState(obra?.año != null ? String(obra.año) : '');
  const [tecnicaId, setTecnicaId] = useState(obra?.tecnica_id ?? '');
  const [descripcion, setDescripcion] = useState(obra?.descripcion ?? '');
  const [estado, setEstado] = useState(obra?.estado ?? 'Borrador');

  const [tecnicas, setTecnicas] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]); // [{ id, nombre }]
  const [existingImages, setExistingImages] = useState([]); // imagenes guardadas
  const [pendingCount, setPendingCount] = useState(0); // imágenes nuevas en ImageUpload

  const [alert, setAlert] = useState(null); // { msg, type }
  const [saving, setSaving] = useState(false);
  const [imgToDelete, setImgToDelete] = useState(null);

  // ── Carga inicial: técnicas, tags, (si edición) tags e imágenes ─────────
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [tecRes, tagsRes] = await Promise.all([
        client.from('tecnicas').select('id, nombre').order('nombre'),
        client.from('tags').select('id, nombre').order('nombre'),
      ]);
      if (cancel) return;
      if (!tecRes.error) setTecnicas(tecRes.data ?? []);
      if (!tagsRes.error) setAllTags(tagsRes.data ?? []);

      if (isEdit) {
        const [otRes, imgRes] = await Promise.all([
          client.from('obra_tags').select('tag_id, tags(id, nombre)').eq('obra_id', obra.id),
          client
            .from('imagenes')
            .select('id, url_storage, principal, orden, pendiente_borrado')
            .eq('obra_id', obra.id)
            .order('orden', { ascending: true, nullsFirst: false }),
        ]);
        if (cancel) return;
        if (!otRes.error) {
          const tags = (otRes.data ?? [])
            .map((r) => r.tags)
            .filter(Boolean)
            .map((t) => ({ id: t.id, nombre: t.nombre }));
          setSelectedTags(tags);
        }
        if (!imgRes.error) setExistingImages(imgRes.data ?? []);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cierra el modal (salvo que un submodal esté abierto)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !imgToDelete) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imgToDelete, onClose]);

  // ── Imágenes existentes visibles para el conteo (excluye pendiente_borrado) ──
  const visibleExisting = existingImages.filter((i) => !i.pendiente_borrado);
  const existingHasPrincipal = visibleExisting.some((i) => i.principal);
  const totalImages = visibleExisting.length + pendingCount;

  // ── Tags ────────────────────────────────────────────────────────────────
  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const exists = prev.find((t) => t.id === tag.id);
      if (exists) return prev.filter((t) => t.id !== tag.id);
      if (prev.length >= MAX_TAGS) return prev; // límite
      return [...prev, { id: tag.id, nombre: tag.nombre }];
    });
  };

  // ── Eliminar imagen existente (replica deleteObraImage) ─────────────────
  const confirmDeleteImage = useCallback(
    async (img) => {
      try {
        if (esPublicada) {
          // Obra publicada: marcar pendiente_borrado, no tocar Storage
          const { error } = await client
            .from('imagenes')
            .update({ pendiente_borrado: true })
            .eq('id', img.id);
          if (error) throw error;
          setExistingImages((prev) =>
            prev.map((i) => (i.id === img.id ? { ...i, pendiente_borrado: true } : i))
          );
        } else {
          // Borrador / En Revisión: borrado inmediato (DB + Storage)
          const { error } = await client.from('imagenes').delete().eq('id', img.id);
          if (error) throw error;
          if (img.url_storage) {
            const path = img.url_storage.split('/artworks/')[1];
            if (path) {
              const { error: stErr } = await client.storage.from('artworks').remove([path]);
              if (stErr) console.warn('[ObraForm] No se pudo borrar de Storage:', stErr.message);
            }
          }
          setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
        }
      } catch (err) {
        console.error('[ObraForm] confirmDeleteImage:', err);
        setAlert({ msg: 'Error al eliminar la imagen.', type: 'error' });
      } finally {
        setImgToDelete(null);
      }
    },
    [client, esPublicada]
  );

  // ── Guardar snapshot_publicado ──────────────────────────────────────────
  async function guardarSnapshot(obraId, payload) {
    try {
      const tecnicaNombre = tecnicas.find((t) => String(t.id) === String(payload.tecnica_id))?.nombre ?? '';
      const { data: imgs } = await client
        .from('imagenes')
        .select('url_storage, principal, pendiente_borrado')
        .eq('obra_id', obraId);

      const snap = {
        titulo: payload.titulo ?? '',
        artista: payload.artista ?? '',
        año: payload.año ?? null,
        tecnica: tecnicaNombre,
        descripcion: payload.descripcion ?? '',
        tags: selectedTags.map((t) => t.nombre),
        imagenes: (imgs ?? [])
          .filter((i) => !i.pendiente_borrado)
          .map((i) => ({ url_storage: i.url_storage, principal: i.principal ?? false })),
      };

      const { error } = await client
        .from('obras')
        .update({ snapshot_publicado: snap, visible_publico: true })
        .eq('id', obraId);
      if (error) throw error;
    } catch (err) {
      console.error('[ObraForm] guardarSnapshot:', err);
    }
  }

  // ── Guardar obra ────────────────────────────────────────────────────────
  async function handleSave() {
    setAlert(null);

    const _titulo = titulo.trim();
    const _artista = artista.trim();
    const _ano = ano ? parseInt(ano, 10) : null;
    const _desc = descripcion.trim();

    // Validaciones (replican obras-form.js)
    if (!_titulo) return setAlert({ msg: 'El título es obligatorio.', type: 'error' });
    if (!_artista) return setAlert({ msg: 'El artista es obligatorio.', type: 'error' });
    if (_ano === null || Number.isNaN(_ano))
      return setAlert({ msg: 'El año es obligatorio.', type: 'error' });
    if (_ano < 1800 || _ano > 2100)
      return setAlert({ msg: 'El año debe estar entre 1800 y 2100.', type: 'error' });
    if (!tecnicaId) return setAlert({ msg: 'La técnica es obligatoria.', type: 'error' });
    if (_desc.length === 0)
      return setAlert({ msg: 'La descripción es obligatoria.', type: 'error' });
    if (_desc.length > DESC_MAX)
      return setAlert({
        msg: `La descripción excede el límite de ${DESC_MAX} caracteres (${_desc.length}).`,
        type: 'error',
      });
    if (selectedTags.length === 0)
      return setAlert({ msg: 'Debes seleccionar al menos 1 tag.', type: 'error' });
    if (selectedTags.length > MAX_TAGS)
      return setAlert({ msg: `Máximo ${MAX_TAGS} tags por obra.`, type: 'error' });
    if (totalImages === 0)
      return setAlert({ msg: 'Debes subir al menos 1 imagen.', type: 'error' });
    if (totalImages > MAX_IMAGES)
      return setAlert({
        msg: `Máximo ${MAX_IMAGES} imágenes por obra. Tienes ${totalImages}.`,
        type: 'error',
      });

    // Estado: editor solo puede Borrador / En Revisión
    const estadoFinal = esEditor
      ? ESTADOS_EDITOR.includes(estado)
        ? estado
        : 'En Revisión'
      : estado;

    const payload = {
      titulo: _titulo,
      artista: _artista,
      año: _ano,
      estado: estadoFinal,
      tecnica_id: tecnicaId || null,
      descripcion: _desc || null,
    };
    if (estadoFinal === 'Publicado') payload.visible_publico = true;

    setSaving(true);
    try {
      let obraId = obra?.id;

      if (isEdit) {
        const { error } = await client.from('obras').update(payload).eq('id', obraId);
        if (error) throw error;
      } else {
        // editor_id solo para obras NUEVAS creadas por un editor
        if (esEditor) {
          const { data: { user } } = await client.auth.getUser();
          if (user?.id) payload.editor_id = user.id;
        }
        const { data, error } = await client
          .from('obras')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        obraId = data.id;
      }

      // Subir imágenes nuevas (diferido — necesita obraId)
      if (imageUploadRef.current && imageUploadRef.current.count() > 0) {
        const up = await imageUploadRef.current.uploadAll(obraId);
        if (!up.success) {
          setAlert({ msg: `Obra guardada, pero las imágenes fallaron: ${up.error}`, type: 'error' });
          setSaving(false);
          return;
        }
      }

      // Tags N:M: DELETE todos + INSERT seleccionados
      await client.from('obra_tags').delete().eq('obra_id', obraId);
      if (selectedTags.length > 0) {
        const rows = selectedTags.map((t) => ({ obra_id: obraId, tag_id: t.id }));
        const { error: tagErr } = await client.from('obra_tags').insert(rows);
        if (tagErr) throw tagErr;
      }

      // Snapshot si quedó Publicado
      if (estadoFinal === 'Publicado') {
        await guardarSnapshot(obraId, payload);
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('[ObraForm] handleSave:', err);
      const msg = err.message?.includes('violates')
        ? 'Error de validación en la base de datos.'
        : 'No se pudo guardar la obra. Inténtalo de nuevo.';
      setAlert({ msg, type: 'error' });
      setSaving(false);
    }
  }

  const tagsAtLimit = selectedTags.length >= MAX_TAGS;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="obraFormTitle"
    >
      <div className="modal-dialog modal-dialog--lg">
        {/* Header */}
        <div className="modal-header">
          <h3 id="obraFormTitle">{isEdit ? 'Editar Obra' : 'Nueva Obra'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Título */}
          <div className="form-group">
            <label htmlFor="fTitulo">
              Título <span className="required">*</span>
            </label>
            <input
              id="fTitulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Artista + Año */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fArtista">
                Artista <span className="required">*</span>
              </label>
              <input
                id="fArtista"
                type="text"
                value={artista}
                onChange={(e) => setArtista(e.target.value)}
                readOnly={esEditor}
                className={esEditor ? 'field--readonly' : undefined}
                title={esEditor ? 'El artista se asigna automáticamente' : undefined}
              />
            </div>
            <div className="form-group">
              <label htmlFor="fAno">
                Año <span className="required">*</span>
              </label>
              <input
                id="fAno"
                type="number"
                min={1800}
                max={2100}
                value={ano}
                onChange={(e) => setAno(e.target.value)}
              />
            </div>
          </div>

          {/* Técnica + Estado */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fTecnica">
                Técnica <span className="required">*</span>
              </label>
              <select id="fTecnica" value={tecnicaId} onChange={(e) => setTecnicaId(e.target.value)}>
                <option value="">— Sin técnica —</option>
                {tecnicas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="fEstado">Estado</label>
              <select id="fEstado" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {estadosDisponibles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div className="form-group">
            <label htmlFor="fDescripcion">
              Descripción <span className="required">*</span>
            </label>
            <textarea
              id="fDescripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={DESC_MAX}
              rows={4}
            />
            <span className={`field-hint${descripcion.length >= DESC_MAX - 50 ? ' at-limit' : ''}`}>
              {descripcion.length} / {DESC_MAX}
            </span>
          </div>

          {/* Tags (pills, máx 3) */}
          <div className="form-group">
            <label>
              Tags <span className="required">*</span> (máx. {MAX_TAGS})
            </label>
            <div className="tag-pills-container">
              {allTags.length === 0 ? (
                <span className="field-hint">No hay tags disponibles.</span>
              ) : (
                allTags.map((tag) => {
                  const sel = !!selectedTags.find((t) => t.id === tag.id);
                  const disabled = !sel && tagsAtLimit;
                  return (
                    <label
                      key={tag.id}
                      className={`tag-pill-label${sel ? ' tag-pill--selected' : ''}${
                        disabled ? ' tag-pill--disabled' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="tag-pill-checkbox sr-only"
                        checked={sel}
                        disabled={disabled}
                        onChange={() => toggleTag(tag)}
                      />
                      <span className="tag-pill-text">{tag.nombre}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="tag-pills-footer">
              <span className={`tag-counter${tagsAtLimit ? ' at-limit' : ''}`}>
                {selectedTags.length} de {MAX_TAGS}
              </span>
            </div>
          </div>

          <hr className="form-divider" />

          {/* Imágenes existentes (edición) */}
          {isEdit && existingImages.length > 0 && (
            <div className="form-group">
              <label>Imágenes guardadas</label>
              <div className="existing-images-list">
                {existingImages.map((img) => {
                  const tachada = img.pendiente_borrado && esEditor;
                  return (
                    <div
                      key={img.id}
                      className="existing-image-item"
                      style={tachada ? { opacity: 0.5 } : undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url_storage}
                        alt="Imagen de la obra"
                        className="existing-thumb"
                        style={
                          tachada
                            ? { filter: 'grayscale(1)', outline: '2px solid var(--color-error)' }
                            : undefined
                        }
                      />
                      {img.principal && <span className="badge-principal">Principal</span>}
                      {img.pendiente_borrado ? (
                        <span className="field-hint">Pendiente de borrado</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-del-img image-item-delete"
                          onClick={() => setImgToDelete(img)}
                          aria-label="Eliminar imagen"
                        >
                          <Trash2 size={13} aria-hidden="true" /> Eliminar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agregar imágenes nuevas */}
          <div className="form-group">
            <label>
              Agregar imágenes <span className="required">*</span> (máx. {MAX_IMAGES} en total)
            </label>
            <ImageUpload
              ref={imageUploadRef}
              obraId={obra?.id ?? null}
              maxImages={MAX_IMAGES}
              existingCount={visibleExisting.length}
              hasPrincipal={existingHasPrincipal}
              onCountChange={setPendingCount}
            />
          </div>

          {/* Alerta del formulario */}
          {alert && <div className={`form-alert ${alert.type}`}>{alert.msg}</div>}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar obra'}
          </button>
        </div>
      </div>

      {/* Confirmación de borrado de imagen existente */}
      {imgToDelete && (
        <ConfirmModal
          title="¿Eliminar imagen?"
          message={
            esPublicada
              ? 'La imagen quedará eliminada cuando se aprueben los cambios.'
              : 'La imagen se eliminará del catálogo. Esta acción no se puede deshacer.'
          }
          confirmLabel="Eliminar"
          onConfirm={() => confirmDeleteImage(imgToDelete)}
          onCancel={() => setImgToDelete(null)}
        />
      )}
    </div>
  );
}
