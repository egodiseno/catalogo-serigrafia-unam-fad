'use client';

/**
 * components/admin/DiffModal.jsx — Revisión de cambios de obra reaperturada
 *
 * Port React de la lógica de revisión de obras-list.js (VanillaJS):
 *   generarDiff() + ejecutarAprobacion() + ejecutarRechazo() + notificarEditor().
 *
 * Solo para admin / super_editor. Se abre cuando obra.motivo_reapertura IS NOT NULL.
 *
 * Props: { obra, onClose, onApproved, onRejected }
 *   obra debe incluir: motivo_reapertura, snapshot_publicado, titulo, artista, año,
 *   descripcion, tecnicas(nombre), obra_tags(tags(nombre)), imagenes[].
 *
 * Edge Function notify-obra-approval — contrato real (supabase/functions/
 * notify-obra-approval/index.ts): body { obraId, resultado: 'aprobado'|'rechazado', motivo }.
 *
 * Clases CSS: solo las verificadas en styles/admin.css (.diff-*, .modal-*, .btn-*).
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, ImagePlus, ImageOff } from 'lucide-react';

// ── Construir snapshot a partir de los valores actuales de la obra ──────────
function construirSnapshot(obra) {
  return {
    titulo: obra.titulo ?? '',
    artista: obra.artista ?? '',
    año: obra.año ?? null,
    tecnica: obra.tecnicas?.nombre ?? '',
    descripcion: obra.descripcion ?? '',
    tags: (obra.obra_tags ?? []).map((ot) => ot.tags?.nombre).filter(Boolean),
    imagenes: (obra.imagenes ?? [])
      .filter((img) => !img.pendiente_borrado)
      .map((img) => ({ url_storage: img.url_storage, principal: img.principal ?? false })),
  };
}

// ── Calcular campos de diff (snapshot vs actual) ────────────────────────────
function computeCampos(obra) {
  const snap = obra.snapshot_publicado;
  if (!snap) return null;
  const campos = [];

  if ((snap.titulo ?? '') !== (obra.titulo ?? ''))
    campos.push({ label: 'Título', antes: snap.titulo || '—', despues: obra.titulo || '—' });

  if (String(snap.año ?? '') !== String(obra.año ?? ''))
    campos.push({ label: 'Año', antes: snap.año ?? '—', despues: obra.año ?? '—' });

  const tecActual = obra.tecnicas?.nombre ?? '';
  const tecSnap = snap.tecnica ?? snap.tecnica_nombre ?? '';
  if (tecSnap !== tecActual)
    campos.push({ label: 'Técnica', antes: tecSnap || '—', despues: tecActual || '—' });

  const descActual = (obra.descripcion ?? '').trim();
  const descSnap = (snap.descripcion ?? '').trim();
  if (descSnap !== descActual)
    campos.push({
      label: 'Descripción',
      antes: descSnap || '—',
      despues: descActual || '—',
      multilinea: true,
    });

  const tagsActual = (obra.obra_tags ?? [])
    .map((ot) => ot.tags?.nombre)
    .filter(Boolean)
    .sort()
    .join(', ');
  const tagsSnap = (snap.tags ?? []).slice().sort().join(', ');
  if (tagsSnap !== tagsActual)
    campos.push({ label: 'Tags', antes: tagsSnap || '—', despues: tagsActual || '—' });

  return campos;
}

function computeImagenes(obra) {
  const snap = obra.snapshot_publicado ?? {};
  const snapUrls = (snap.imagenes ?? [])
    .map((si) => (typeof si === 'string' ? si : si.url_storage ?? si.url ?? ''))
    .filter(Boolean);
  const nuevas = (obra.imagenes ?? []).filter(
    (img) => img.url_storage && !snapUrls.includes(img.url_storage) && !img.pendiente_borrado
  );
  const borradas = (obra.imagenes ?? []).filter((img) => img.pendiente_borrado);
  return { nuevas, borradas };
}

export default function DiffModal({ obra, onClose, onApproved, onRejected }) {
  const client = createClient();

  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const campos = computeCampos(obra);
  const { nuevas, borradas } = computeImagenes(obra);
  const sinSnapshot = !obra.snapshot_publicado;

  // ── Notificar al editor (fire-and-forget) ────────────────────────────────
  async function notificarEditor(obraId, resultado, motivo = '') {
    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return;
      await fetch(`${SUPABASE_URL}/functions/v1/notify-obra-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ obraId, resultado, motivo }),
      });
    } catch (err) {
      console.warn('[DiffModal] notificarEditor:', err?.message ?? err);
    }
  }

  // ── Borrar imagen físicamente (Storage + DB) ─────────────────────────────
  async function borrarImagenFisicaYDB(imgId, imgUrl) {
    const { error: dbErr } = await client.from('imagenes').delete().eq('id', imgId);
    if (dbErr) throw dbErr;
    if (imgUrl) {
      const path = imgUrl.split('/artworks/')[1];
      if (path) {
        const { error: stErr } = await client.storage.from('artworks').remove([path]);
        if (stErr) console.warn('[DiffModal] No se pudo borrar de Storage:', stErr.message);
      }
    }
  }

  // ── Aprobar ──────────────────────────────────────────────────────────────
  async function handleAprobar() {
    setBusy(true);
    setError(null);
    try {
      const snap = construirSnapshot(obra);
      const imgsPendientes = (obra.imagenes ?? []).filter((img) => img.pendiente_borrado);

      const { data: filas, error: updErr } = await client
        .from('obras')
        .update({
          estado: 'Publicado',
          visible_publico: true,
          snapshot_publicado: snap,
          motivo_reapertura: null,
          motivo_rechazo: null,
        })
        .eq('id', obra.id)
        .select('id');
      if (updErr) throw updErr;
      if (!filas?.length) throw new Error('UPDATE no afectó ninguna fila — posible bloqueo RLS');

      // Borrar imágenes pendientes (Storage + DB)
      for (const img of imgsPendientes) {
        try {
          await borrarImagenFisicaYDB(img.id, img.url_storage);
        } catch (imgErr) {
          console.warn('[DiffModal] error borrando imagen:', img.id, imgErr);
        }
      }

      notificarEditor(obra.id, 'aprobado').catch(() => {});
      onApproved?.();
      onClose?.();
    } catch (err) {
      console.error('[DiffModal] handleAprobar:', err);
      setError('No se pudo aprobar la obra. Revisa la consola.');
      setBusy(false);
    }
  }

  // ── Rechazar (restaurar snapshot) ────────────────────────────────────────
  async function handleRechazar() {
    const motivo = motivoRechazo.trim();
    if (!motivo) return;

    setBusy(true);
    setError(null);
    try {
      const snap = obra.snapshot_publicado;
      if (!snap) throw new Error('No hay snapshot disponible para restaurar');

      // Lookup tecnica_id desde el nombre del snapshot
      let tecnicaId = null;
      if (snap.tecnica) {
        const { data: tecData, error: tecErr } = await client
          .from('tecnicas')
          .select('id')
          .eq('nombre', snap.tecnica)
          .maybeSingle();
        if (tecErr) throw tecErr;
        tecnicaId = tecData?.id ?? null;
      }

      const { data: filas, error: updErr } = await client
        .from('obras')
        .update({
          titulo: snap.titulo ?? obra.titulo,
          artista: snap.artista ?? obra.artista,
          año: snap.año ?? obra.año,
          descripcion: snap.descripcion || null,
          tecnica_id: tecnicaId,
          estado: 'Publicado',
          visible_publico: true,
          motivo_rechazo: motivo,
          motivo_reapertura: null,
        })
        .eq('id', obra.id)
        .select('id');
      if (updErr) throw updErr;
      if (!filas?.length) throw new Error('UPDATE no afectó ninguna fila — posible bloqueo RLS');

      // Restaurar tags desde snapshot
      await client.from('obra_tags').delete().eq('obra_id', obra.id);
      if (snap.tags && snap.tags.length > 0) {
        const { data: tagData, error: tagErr } = await client
          .from('tags')
          .select('id, nombre')
          .in('nombre', snap.tags);
        if (tagErr) throw tagErr;
        if (tagData && tagData.length > 0) {
          const { error: insErr } = await client
            .from('obra_tags')
            .insert(tagData.map((t) => ({ obra_id: obra.id, tag_id: t.id })));
          if (insErr) throw insErr;
        }
      }

      // Rollback de imágenes marcadas pendiente_borrado
      await client
        .from('imagenes')
        .update({ pendiente_borrado: false })
        .eq('obra_id', obra.id)
        .eq('pendiente_borrado', true);

      notificarEditor(obra.id, 'rechazado', motivo).catch(() => {});
      onRejected?.();
      onClose?.();
    } catch (err) {
      console.error('[DiffModal] handleRechazar:', err);
      setError('No se pudo rechazar la obra. Revisa la consola.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="diffModalTitle">
      <div className="modal-dialog modal-dialog--lg">
        <div className="modal-header">
          <h3 id="diffModalTitle">Revisar cambios — {obra.titulo}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          {/* Motivo de reapertura */}
          <div className="diff-motivo">
            <p className="diff-motivo-label">Motivo de reapertura indicado por el editor</p>
            <blockquote className="diff-motivo-texto">{obra.motivo_reapertura || '—'}</blockquote>
          </div>

          <h4 className="diff-section-title">Cambios respecto a la versión publicada</h4>

          {sinSnapshot ? (
            <p className="diff-sin-cambios">
              No hay snapshot disponible — esta obra aún no tiene una versión publicada registrada.
            </p>
          ) : (
            <>
              {campos && campos.length > 0 ? (
                <div className="diff-campos">
                  {campos.map((c) => (
                    <div className="diff-campo" key={c.label}>
                      <div className="diff-campo-label">{c.label}</div>
                      <div className="diff-valores">
                        <div className="diff-valor diff-valor--antes">
                          <span className="diff-tag diff-tag--antes">Antes</span>
                          {c.multilinea ? (
                            <pre className="diff-texto">{String(c.antes)}</pre>
                          ) : (
                            <span className="diff-texto">{String(c.antes)}</span>
                          )}
                        </div>
                        <div className="diff-valor diff-valor--despues">
                          <span className="diff-tag diff-tag--despues">Ahora</span>
                          {c.multilinea ? (
                            <pre className="diff-texto">{String(c.despues)}</pre>
                          ) : (
                            <span className="diff-texto">{String(c.despues)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Imágenes */}
              {(nuevas.length > 0 || borradas.length > 0) && (
                <div className="diff-imagenes">
                  <h4 className="diff-section-title diff-section-title--imagenes">Imágenes</h4>

                  {nuevas.length > 0 && (
                    <>
                      <p className="diff-img-label diff-img-label--nueva">
                        <ImagePlus size={14} aria-hidden="true" /> Imágenes nuevas ({nuevas.length})
                      </p>
                      <div className="diff-img-grid">
                        {nuevas.map((img) => (
                          <div className="diff-img-item diff-img-item--nueva" key={img.id ?? img.url_storage}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url_storage} alt="Nueva imagen" className="diff-img-thumb" />
                            {img.principal && <span className="diff-img-badge">Principal</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {borradas.length > 0 && (
                    <>
                      <p className="diff-img-label diff-img-label--borrar">
                        <ImageOff size={14} aria-hidden="true" /> Marcadas para eliminar ({borradas.length})
                      </p>
                      <div className="diff-img-grid">
                        {borradas.map((img) => (
                          <div className="diff-img-item diff-img-item--borrar" key={img.id ?? img.url_storage}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url_storage} alt="Imagen a eliminar" className="diff-img-thumb" />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {campos && campos.length === 0 && nuevas.length === 0 && borradas.length === 0 && (
                <p className="diff-sin-cambios">Sin cambios detectados en los campos comparados.</p>
              )}
            </>
          )}

          {/* Formulario de rechazo (fase 2) */}
          {rechazando && (
            <div className="diff-rechazo-form">
              <h4 className="diff-section-title diff-section-title--rechazar">Motivo de rechazo</h4>
              <p className="diff-rechazo-hint">
                El editor verá este motivo al revisar la obra devuelta. Sé claro y constructivo.
              </p>
              <textarea
                className="form-textarea"
                rows={3}
                maxLength={1000}
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder="Describe qué debe corregir el editor antes de que la obra pueda aprobarse…"
              />
              <div className="diff-rechazo-footer">
                <span className="field-hint">{motivoRechazo.length} / 1000</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setRechazando(false);
                    setMotivoRechazo('');
                  }}
                  disabled={busy}
                >
                  Cancelar rechazo
                </button>
              </div>
            </div>
          )}

          {error && <div className="form-alert error">{error}</div>}
        </div>

        <div className="modal-footer">
          {!rechazando ? (
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setRechazando(true)}
                disabled={busy || sinSnapshot}
              >
                Rechazar cambios
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAprobar}
                disabled={busy}
              >
                {busy ? 'Aprobando…' : 'Aprobar cambios'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleRechazar}
              disabled={busy || motivoRechazo.trim().length === 0}
            >
              {busy ? 'Rechazando…' : 'Confirmar rechazo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
