'use client';

/**
 * components/admin/ImageUpload.jsx — Selector + subida de imágenes a Supabase Storage
 *
 * Port React de storage.js + multi-image-upload.js (VanillaJS).
 *
 * Flujo de subida por archivo (idéntico a storage.js):
 *   1. Validar tipo (JPG, PNG, WebP) y tamaño ≤ 5 MB.
 *   2. POST a Edge Function convert-webp; si falla → usar archivo original (graceful fallback).
 *   3. Upload al bucket 'artworks': path `{obraId}/{Date.now()}-{random}.{ext}`.
 *   4. INSERT en tabla imagenes: { obra_id, url_storage, principal, orden }.
 *   5. Progreso por archivo con clases .upload-progress-list / .upload-progress-item / .upload-pi__*.
 *   6. Estados: "Subiendo…" → "Procesando WebP…" → check verde / x rojo.
 *   7. Éxitos se ocultan tras 2200 ms; errores permanecen.
 *
 * El componente NO sube en cuanto se seleccionan archivos: los acumula con preview
 * (igual que el VanillaJS, que difería la subida al guardar la obra). El padre dispara
 * la subida vía ref imperativo `uploadAll(obraId)` — necesario porque una obra NUEVA
 * no tiene id hasta haber sido insertada.
 *
 * Props:
 *   obraId       — id de la obra destino (puede ser null para obra nueva; se pasa a uploadAll)
 *   maxImages    — máximo total de imágenes por obra (4)
 *   existingCount— cuántas imágenes ya guardadas (no marcadas pendiente_borrado)
 *   hasPrincipal — true si ya existe una imagen guardada marcada principal
 *   onUploaded   — fn(imageRecord) llamada por cada INSERT exitoso
 *   onCountChange— fn(nuevoConteo) cuando cambia la cantidad de archivos seleccionados
 *
 * Ref API (useImperativeHandle):
 *   count()             — número de archivos seleccionados
 *   uploadAll(obraId?)  — sube todos; devuelve { success, urls, error }
 *   reset()             — limpia la selección
 */

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useEffect,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { ImagePlus, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const BUCKET_NAME = 'artworks';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const PHASE_CFG = {
  uploading: { label: 'Subiendo…', css: 'uploading', spin: true },
  processing: { label: 'Procesando WebP…', css: 'processing', spin: true },
  done: { label: 'Lista', css: 'done', spin: false },
  error: { label: 'Error', css: 'error', spin: false },
};

function truncate(str, maxLen) {
  const s = String(str || '');
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

/**
 * Sube un solo archivo: convert-webp → bucket → URL pública.
 * Replica storage.js uploadImage. onPhase('uploading'|'processing').
 */
async function uploadOneImage(client, file, obraId, onPhase) {
  // Validaciones
  if (!ALLOWED_MIME.includes(file.type.toLowerCase())) {
    const ext = (file.name.split('.').pop() ?? file.type).toUpperCase();
    return { success: false, error: `Formato no permitido (.${ext}). Usa JPG, PNG o WebP.` };
  }
  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { success: false, error: `El archivo pesa ${mb} MB. El máximo permitido es 5 MB.` };
  }

  let uploadFile = file;
  let uploadExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';

  // Fase 1: conversión WebP en curso
  onPhase?.('uploading');

  // ── Convertir a WebP vía Edge Function (graceful fallback) ──
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/convert-webp`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('obra_id', obraId || `obra-temp-${Date.now()}`);

    const convResp = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON_KEY}` },
      body: formData,
    });

    if (convResp.ok) {
      const blob = await convResp.blob();
      const converted = convResp.headers.get('X-Converted') === 'true';
      const xFilename = convResp.headers.get('X-Filename') || file.name;
      if (converted) {
        uploadFile = new File([blob], xFilename, { type: 'image/webp' });
        uploadExt = 'webp';
      } else {
        uploadFile = new File([blob], xFilename, {
          type: convResp.headers.get('Content-Type') || file.type,
        });
      }
    } else {
      const errBody = await convResp.text().catch(() => String(convResp.status));
      console.warn('[ImageUpload] Conversión fallida — usando original:', errBody);
    }
  } catch (convErr) {
    console.warn('[ImageUpload] Edge Function inaccesible — usando original:', convErr?.message);
  }

  // Fase 2: subir al bucket
  onPhase?.('processing');

  const fileName = `${obraId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${uploadExt}`;

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(fileName, uploadFile, { cacheControl: '3600', upsert: false });

  if (error) {
    console.error('[ImageUpload] Upload error:', error);
    return { success: false, error: error.message };
  }

  const { data: urlData } = client.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return { success: true, url: urlData.publicUrl, fileName };
}

const ImageUpload = forwardRef(function ImageUpload(
  {
    obraId = null,
    maxImages = 4,
    existingCount = 0,
    hasPrincipal = false,
    onUploaded,
    onCountChange,
  },
  ref
) {
  const client = createClient();
  const fileInputRef = useRef(null);

  // files: [{ id, file, previewUrl, principal }]
  const [files, setFiles] = useState([]);
  // progress: [{ key, name, state, errMsg }]
  const [progress, setProgress] = useState([]);
  const [progressVisible, setProgressVisible] = useState(false);

  const remaining = Math.max(0, maxImages - existingCount);
  const total = existingCount + files.length;
  const atLimit = files.length >= remaining;

  useEffect(() => {
    onCountChange?.(files.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  // Liberar object URLs al desmontar
  useEffect(() => {
    return () => files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => ALLOWED_MIME.includes(f.type.toLowerCase()));
    if (incoming.length === 0) return;

    setFiles((prev) => {
      const space = remaining - prev.length;
      const accepted = incoming.slice(0, Math.max(0, space));
      const noPrincipalYet = !hasPrincipal && prev.every((f) => !f.principal);
      const mapped = accepted.map((file, i) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        // Primera imagen marcada principal solo si no hay ninguna principal aún
        principal: noPrincipalYet && prev.length === 0 && i === 0,
      }));
      return [...prev, ...mapped];
    });
  }

  function handleInputChange(e) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = ''; // permite volver a elegir el mismo archivo
  }

  function removeFile(id) {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  function setPrincipal(id) {
    setFiles((prev) => prev.map((f) => ({ ...f, principal: f.id === id })));
  }

  // Drag & drop
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }

  function setProgressItem(key, name, state, errMsg) {
    setProgress((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => p.key === key);
      const item = { key, name, state, errMsg };
      if (idx >= 0) next[idx] = item;
      else next.push(item);
      return next;
    });
  }

  useImperativeHandle(ref, () => ({
    count: () => files.length,
    reset: () => {
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      setFiles([]);
      setProgress([]);
      setProgressVisible(false);
    },
    /**
     * Sube todos los archivos seleccionados a la obra indicada.
     * @param {string} targetObraId — id de la obra (override del prop obraId)
     * @returns {{ success, urls, error }}
     */
    uploadAll: async (targetObraId) => {
      const oid = targetObraId || obraId;
      if (!oid) return { success: false, error: 'Falta el id de la obra' };
      if (files.length === 0) return { success: true, urls: [] };

      setProgress([]);
      setProgressVisible(true);

      const results = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const key = f.id;
        setProgressItem(key, f.file.name, 'uploading');

        const res = await uploadOneImage(client, f.file, oid, (phase) =>
          setProgressItem(key, f.file.name, phase)
        );

        if (!res.success) {
          setProgressItem(key, f.file.name, 'error', res.error);
          return { success: false, error: `Error en imagen ${i + 1}: ${res.error}`, urls: results };
        }

        // INSERT en tabla imagenes
        const principal = f.principal && !hasPrincipal;
        const orden = existingCount + i + 1;
        const { data: rec, error: insErr } = await client
          .from('imagenes')
          .insert({ obra_id: oid, url_storage: res.url, principal, orden })
          .select('id, obra_id, url_storage, principal, orden')
          .single();

        if (insErr) {
          setProgressItem(key, f.file.name, 'error', insErr.message);
          return {
            success: false,
            error: `La imagen ${i + 1} se subió pero falló su registro: ${insErr.message}`,
            urls: results,
          };
        }

        setProgressItem(key, f.file.name, 'done');
        results.push({ url: res.url, principal, orden });
        onUploaded?.(rec);
      }

      // Limpiar archivos pendientes ya subidos y auto-ocultar progreso
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      setFiles([]);
      setTimeout(() => setProgressVisible(false), 2200);

      return { success: true, urls: results };
    },
  }));

  return (
    <div>
      {/* Lista de progreso por archivo */}
      {progressVisible && progress.length > 0 && (
        <div className="upload-progress-list">
          {progress.map((p) => {
            const cfg = PHASE_CFG[p.state] || PHASE_CFG.error;
            const Icon =
              p.state === 'done' ? CheckCircle : p.state === 'error' ? AlertCircle : Loader2;
            return (
              <div key={p.key} className={`upload-progress-item upload-progress-item--${cfg.css}`}>
                <Icon
                  className={`upload-pi__icon${cfg.spin ? ' spin-anim' : ''}`}
                  size={16}
                  aria-hidden="true"
                />
                <span className="upload-pi__filename">{truncate(p.name, 35)}</span>
                <span className="upload-pi__state">
                  {p.state === 'error' && p.errMsg ? truncate(p.errMsg, 40) : cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Previews de archivos seleccionados (pendientes de subir) */}
      {files.length > 0 && (
        <div className="image-grid">
          {files.map((f) => (
            <div key={f.id} className="image-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.previewUrl} alt={f.file.name} />
              {f.principal && <span className="image-item-badge">Principal</span>}
              <button
                type="button"
                className="image-item-delete"
                onClick={() => removeFile(f.id)}
                aria-label="Quitar imagen"
              >
                <Trash2 size={13} aria-hidden="true" /> Quitar
              </button>
              {!hasPrincipal && (
                <label className="checkbox-principal" style={{ padding: '4px' }}>
                  <input
                    type="radio"
                    name="nueva-principal"
                    checked={!!f.principal}
                    onChange={() => setPrincipal(f.id)}
                  />
                  Principal
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controles de subida */}
      <div className="image-upload-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={atLimit}
          title={atLimit ? `Máximo ${maxImages} imágenes por obra` : ''}
        >
          <ImagePlus size={14} aria-hidden="true" /> Agregar imágenes
        </button>
        <span className={`image-counter${total >= maxImages ? ' at-limit' : ''}`}>
          {total} de {maxImages} imágenes
        </span>
      </div>

      {/* Zona de drag & drop */}
      <div
        className="image-input-group"
        style={{ textAlign: 'center', cursor: 'pointer', marginTop: 'var(--spacing-md)' }}
        onClick={() => !atLimit && fileInputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('drag-over');
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
          }
        }}
        onDrop={handleDrop}
      >
        <span className="field-hint">
          {atLimit
            ? `Has alcanzado el máximo de ${maxImages} imágenes.`
            : 'Arrastra imágenes aquí o haz clic para seleccionar (JPG, PNG, WebP · máx. 5 MB)'}
        </span>
      </div>
    </div>
  );
});

export default ImageUpload;
