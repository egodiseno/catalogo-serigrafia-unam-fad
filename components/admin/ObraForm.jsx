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
 * Sección de imágenes: drag & drop con id="multiImageContainer" → activa el CSS
 *   #multiImageContainer.drag-over (border azul + fondo) de styles/admin.css.
 *
 * Layout dos columnas:   .form-row → grid 1fr 1fr (verificado en styles/admin.css ln 2242).
 * Drop zone classes:     id=multiImageContainer (ln 2909) + .drop-hint (ln 2922)
 *                        .image-input-group (ln 2295) para aspecto dashed-border.
 * Preview dropped files: .image-grid / .image-item / .image-item-badge / .image-item-delete
 *
 * Props: { obra: null|ObraData, onClose: fn, onSaved: fn, userRol: string, userEmail: string }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import ImageUpload from './ImageUpload';
import ConfirmModal from './ConfirmModal';
import { X, Trash2 } from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const DESC_MAX   = 600;
const MAX_TAGS   = 3;
const MAX_IMAGES = 4;

const ESTADOS_EDITOR = ['Borrador', 'En Revisión'];
const ESTADOS_ADMIN  = ['Borrador', 'Publicado', 'En Revisión', 'Archivado'];

// Para subida inline de archivos arrastrados (replica storage.js)
const BUCKET_NAME    = 'artworks';
const MAX_FILE_SIZE  = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME   = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * generateSlug — transliterar acentos → lowercase → guiones.
 * Equivalente a la función de slug de obras-form.js.
 * (El slug real de la obra lo genera el trigger de Postgres; esta utilidad queda disponible.)
 */
export function generateSlug(titulo) {
  return String(titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remover diacríticos
    .replace(/[^a-z0-9\s-]/g, '')   // remover caracteres especiales
    .trim()
    .replace(/\s+/g, '-')           // espacios → guiones
    .replace(/-+/g, '-');           // colapsar guiones
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function ObraForm({ obra = null, onClose, onSaved, userRol, userEmail }) {
  const client = createClient();
  const imageUploadRef = useRef(null);

  const isEdit      = !!obra?.id;
  const esEditor    = userRol === 'editor';
  const estadosDisponibles = esEditor ? ESTADOS_EDITOR : ESTADOS_ADMIN;

  // Una obra publicada difiere el borrado de imágenes (pendiente_borrado)
  const esPublicada = obra?.estado === 'Publicado' || obra?.visible_publico === true;

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [titulo,      setTitulo]     = useState(obra?.titulo ?? '');
  const [artista,     setArtista]    = useState(
    obra?.artista ?? (esEditor ? userEmail ?? '' : '')
  );
  const [ano,         setAno]        = useState(obra?.año != null ? String(obra.año) : '');
  const [tecnicaId,   setTecnicaId]  = useState(obra?.tecnica_id ?? '');
  const [descripcion, setDescripcion] = useState(obra?.descripcion ?? '');
  const [estado,      setEstado]     = useState(obra?.estado ?? 'Borrador');

  const [tecnicas,        setTecnicas]        = useState([]);
  const [allTags,         setAllTags]         = useState([]);
  const [selectedTags,    setSelectedTags]    = useState([]); // [{ id, nombre }]
  const [existingImages,  setExistingImages]  = useState([]); // imagenes guardadas
  const [pendingCount,    setPendingCount]    = useState(0);  // archivos en ImageUpload

  // ── Drag & drop state ─────────────────────────────────────────────────────
  // dropFiles = archivos arrastrados sobre la zona de ObraForm (se suben en handleSave)
  const [dropFiles,   setDropFiles]  = useState([]); // [{ id, file, previewUrl }]
  const [isDragOver,  setIsDragOver] = useState(false);

  const [alert,       setAlert]      = useState(null); // { msg, type }
  const [saving,      setSaving]     = useState(false);
  const [imgToDelete, setImgToDelete] = useState(null);

  // ── Carga inicial: técnicas, tags, (si edición) tags e imágenes ───────────
  useEffect(() => {
    let cancel = false;
    (async () => {
      const [tecRes, tagsRes] = await Promise.all([
        client.from('tecnicas').select('id, nombre').order('nombre'),
        client.from('tags').select('id, nombre').order('nombre'),
      ]);
      if (cancel) return;
      if (!tecRes.error)  setTecnicas(tecRes.data  ?? []);
      if (!tagsRes.error) setAllTags(tagsRes.data  ?? []);

      if (isEdit) {
        const [otRes, imgRes] = await Promise.all([
          client.from('obra_tags')
            .select('tag_id, tags(id, nombre)')
            .eq('obra_id', obra.id),
          client.from('imagenes')
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
    return () => { cancel = true; };
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

  // Liberar object URLs al desmontar
  useEffect(() => {
    return () => dropFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Conteos de imágenes ────────────────────────────────────────────────────
  const visibleExisting     = existingImages.filter((i) => !i.pendiente_borrado);
  const existingHasPrincipal = visibleExisting.some((i) => i.principal);
  // Total: existentes visibles + seleccionadas en ImageUpload + arrastradas en la zona
  const totalImages = visibleExisting.length + pendingCount + dropFiles.length;

  // ── Tags ───────────────────────────────────────────────────────────────────
  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const exists = prev.find((t) => t.id === tag.id);
      if (exists) return prev.filter((t) => t.id !== tag.id);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, { id: tag.id, nombre: tag.nombre }];
    });
  };

  // ── Eliminar imagen existente (replica deleteObraImage de obras-form.js) ──
  const confirmDeleteImage = useCallback(
    async (img) => {
      try {
        if (esPublicada) {
          // Obra publicada → marcar pendiente_borrado, no tocar Storage
          const { error } = await client
            .from('imagenes')
            .update({ pendiente_borrado: true })
            .eq('id', img.id);
          if (error) throw error;
          setExistingImages((prev) =>
            prev.map((i) => (i.id === img.id ? { ...i, pendiente_borrado: true } : i))
          );
        } else {
          // Borrador / En Revisión → borrado inmediato DB + Storage
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

  // ── Drag & drop handlers ───────────────────────────────────────────────────
  function validarYAgregarArchivos(fileList) {
    const incoming = Array.from(fileList);
    const validos = [];
    const errores = [];

    for (const f of incoming) {
      if (!ALLOWED_MIME.includes(f.type.toLowerCase())) {
        errores.push(`"${f.name}": formato no permitido (usa JPG, PNG o WebP).`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        errores.push(`"${f.name}": supera 5 MB.`);
        continue;
      }
      validos.push(f);
    }

    if (errores.length > 0) {
      setAlert({ msg: errores.join(' '), type: 'error' });
    }

    if (validos.length === 0) return;

    setDropFiles((prev) => {
      const space = MAX_IMAGES - visibleExisting.length - pendingCount - prev.length;
      const accepted = validos.slice(0, Math.max(0, space));
      if (accepted.length < validos.length) {
        setAlert({ msg: `Solo se agregaron ${accepted.length} imagen(es): el límite es ${MAX_IMAGES}.`, type: 'error' });
      }
      return [
        ...prev,
        ...accepted.map((file) => ({
          id:         `drop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    // Solo quitar el estado si el cursor sale realmente del contenedor
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) {
      validarYAgregarArchivos(e.dataTransfer.files);
    }
  }

  function removeDropFile(id) {
    setDropFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  // ── Subida inline de archivos arrastrados (replica uploadImage de storage.js) ─
  async function subirDropFiles(obraId) {
    if (dropFiles.length === 0) return { success: true };
    let principalSet = existingHasPrincipal || pendingCount > 0;

    for (let i = 0; i < dropFiles.length; i++) {
      const { file } = dropFiles[i];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${obraId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await client.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (upErr) {
        console.error('[ObraForm] subirDropFiles upload:', upErr);
        return { success: false, error: `Error subiendo "${file.name}": ${upErr.message}` };
      }

      const { data: urlData } = client.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      const principal = !principalSet; // primera sin principal existente → principal
      principalSet = true;
      const orden = visibleExisting.length + i + 1;

      const { error: insErr } = await client
        .from('imagenes')
        .insert({ obra_id: obraId, url_storage: urlData.publicUrl, principal, orden });

      if (insErr) {
        console.error('[ObraForm] subirDropFiles insert imagenes:', insErr);
        return { success: false, error: `Imagen subida pero no registrada: ${insErr.message}` };
      }
    }

    return { success: true };
  }

  // ── Guardar snapshot_publicado ─────────────────────────────────────────────
  async function guardarSnapshot(obraId, payload) {
    try {
      const tecnicaNombre = tecnicas
        .find((t) => String(t.id) === String(payload.tecnica_id))?.nombre ?? '';
      const { data: imgs } = await client
        .from('imagenes')
        .select('url_storage, principal, pendiente_borrado')
        .eq('obra_id', obraId);

      const snap = {
        titulo:      payload.titulo      ?? '',
        artista:     payload.artista     ?? '',
        año:         payload.año         ?? null,
        tecnica:     tecnicaNombre,
        descripcion: payload.descripcion ?? '',
        tags:        selectedTags.map((t) => t.nombre),
        imagenes:    (imgs ?? [])
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

  // ── Guardar obra ───────────────────────────────────────────────────────────
  async function handleSave() {
    setAlert(null);

    const _titulo   = titulo.trim();
    const _artista  = artista.trim();
    const _ano      = ano ? parseInt(ano, 10) : null;
    const _desc     = descripcion.trim();

    // Validaciones (replican obras-form.js)
    if (!_titulo)
      return setAlert({ msg: 'El título es obligatorio.', type: 'error' });
    if (!_artista)
      return setAlert({ msg: 'El artista es obligatorio.', type: 'error' });
    if (_ano === null || Number.isNaN(_ano))
      return setAlert({ msg: 'El año es obligatorio.', type: 'error' });
    if (_ano < 1800 || _ano > 2100)
      return setAlert({ msg: 'El año debe estar entre 1800 y 2100.', type: 'error' });
    if (!tecnicaId)
      return setAlert({ msg: 'La técnica es obligatoria.', type: 'error' });
    if (_desc.length === 0)
      return setAlert({ msg: 'La descripción es obligatoria.', type: 'error' });
    if (_desc.length > DESC_MAX)
      return setAlert({ msg: `La descripción excede ${DESC_MAX} caracteres (${_desc.length}).`, type: 'error' });
    if (selectedTags.length === 0)
      return setAlert({ msg: 'Debes seleccionar al menos 1 tag.', type: 'error' });
    if (selectedTags.length > MAX_TAGS)
      return setAlert({ msg: `Máximo ${MAX_TAGS} tags por obra.`, type: 'error' });
    if (totalImages === 0)
      return setAlert({ msg: 'Debes subir al menos 1 imagen.', type: 'error' });
    if (totalImages > MAX_IMAGES)
      return setAlert({ msg: `Máximo ${MAX_IMAGES} imágenes. Tienes ${totalImages}.`, type: 'error' });

    // Estado: editor solo puede Borrador / En Revisión
    const estadoFinal = esEditor
      ? ESTADOS_EDITOR.includes(estado) ? estado : 'En Revisión'
      : estado;

    const payload = {
      titulo:      _titulo,
      artista:     _artista,
      año:         _ano,
      estado:      estadoFinal,
      tecnica_id:  tecnicaId || null,
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

      // 1. Subir archivos arrastrados (drop zone de ObraForm)
      if (dropFiles.length > 0) {
        const res = await subirDropFiles(obraId);
        if (!res.success) {
          setAlert({ msg: res.error ?? 'Error subiendo imágenes arrastradas.', type: 'error' });
          setSaving(false);
          return;
        }
      }

      // 2. Subir archivos seleccionados vía ImageUpload
      if (imageUploadRef.current && imageUploadRef.current.count() > 0) {
        const up = await imageUploadRef.current.uploadAll(obraId);
        if (!up.success) {
          setAlert({ msg: `Obra guardada, pero algunas imágenes fallaron: ${up.error}`, type: 'error' });
          setSaving(false);
          return;
        }
      }

      // 3. Tags N:M: DELETE todos + INSERT seleccionados
      await client.from('obra_tags').delete().eq('obra_id', obraId);
      if (selectedTags.length > 0) {
        const rows = selectedTags.map((t) => ({ obra_id: obraId, tag_id: t.id }));
        const { error: tagErr } = await client.from('obra_tags').insert(rows);
        if (tagErr) throw tagErr;
      }

      // 4. Snapshot si quedó Publicado
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body — orden exacto: Título → Artista+Año → Técnica+Estado → Desc → Tags → Imgs */}
        <div className="modal-body">

          {/* ── 1. Título ──────────────────────────────────────────────────── */}
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

          {/* ── 2. Artista + Año — dos columnas (form-row: grid 1fr 1fr) ─── */}
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

          {/* ── 3. Técnica + Estado — dos columnas (form-row: grid 1fr 1fr) ─ */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fTecnica">
                Técnica <span className="required">*</span>
              </label>
              <select
                id="fTecnica"
                value={tecnicaId}
                onChange={(e) => setTecnicaId(e.target.value)}
              >
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
              <select
                id="fEstado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                {estadosDisponibles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── 4. Descripción ────────────────────────────────────────────── */}
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
            <span
              className={`field-hint${descripcion.length >= DESC_MAX - 50 ? ' desc-char-count at-limit' : ''}`}
            >
              {descripcion.length} / {DESC_MAX}
            </span>
          </div>

          {/* ── 5. Tags (pills, máx 3) ────────────────────────────────────── */}
          <div className="form-group">
            <label>
              Tags <span className="required">*</span> (máx. {MAX_TAGS})
            </label>
            <div className="tag-pills-container">
              {allTags.length === 0 ? (
                <span className="field-hint">No hay tags disponibles.</span>
              ) : (
                allTags.map((tag) => {
                  const sel      = !!selectedTags.find((t) => t.id === tag.id);
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

          {/* ── 6. Imágenes guardadas (solo en edición) ───────────────────── */}
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
                      {img.principal && (
                        <span className="badge-principal">Principal</span>
                      )}
                      {img.pendiente_borrado ? (
                        <span className="field-hint">Pendiente de borrado</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger btn-del-img"
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

          {/* ── 7. Agregar imágenes — zona drag & drop ───────────────────── */}
          <div className="form-group">
            <label>
              Agregar imágenes {!isEdit && <span className="required">*</span>}{' '}
              <span className="field-hint" style={{ fontWeight: 'normal' }}>
                (máx. {MAX_IMAGES} en total)
              </span>
            </label>

            {/*
              id="multiImageContainer" activa el CSS de styles/admin.css:
                #multiImageContainer           → border 2px dashed transparent + transition
                #multiImageContainer.drag-over → border azul UNAM + fondo tenue
              className="image-input-group"    → border 1px dashed + padding + bg surface-alt
            */}
            <div
              id="multiImageContainer"
              className={`image-input-group${isDragOver ? ' drag-over' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Selector de archivos vía botón */}
              <ImageUpload
                ref={imageUploadRef}
                obraId={obra?.id ?? null}
                maxImages={MAX_IMAGES}
                existingCount={visibleExisting.length + dropFiles.length}
                hasPrincipal={existingHasPrincipal || dropFiles.length > 0}
                onCountChange={setPendingCount}
              />

              {/* Previews de archivos arrastrados (pendientes de subir en save) */}
              {dropFiles.length > 0 && (
                <div className="image-grid" style={{ marginTop: 'var(--spacing-md)' }}>
                  {dropFiles.map((f, i) => (
                    <div key={f.id} className="image-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.previewUrl} alt={f.file.name} />
                      {i === 0 && !existingHasPrincipal && (
                        <span className="image-item-badge">Principal</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger image-item-delete"
                        onClick={() => removeDropFile(f.id)}
                        aria-label="Quitar imagen arrastrada"
                      >
                        <Trash2 size={13} aria-hidden="true" /> Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Instrucción de drag — siempre visible */}
              <span className="drop-hint">
                {isDragOver
                  ? '¡Suelta las imágenes aquí!'
                  : 'Arrastra imágenes aquí (JPG, PNG, WebP · máx. 5 MB cada una)'}
              </span>
            </div>
          </div>

          {/* Alerta del formulario */}
          {alert && (
            <div className={`form-alert ${alert.type}`}>{alert.msg}</div>
          )}
        </div>

        {/* Footer */}
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
            onClick={handleSave}
            disabled={saving}
          >
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
