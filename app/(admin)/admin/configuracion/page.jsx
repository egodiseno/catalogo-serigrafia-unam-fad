'use client';

/**
 * app/(admin)/admin/configuracion/page.jsx
 *
 * Configuración del sitio — Client Component.
 * Tres pestañas:
 *   1. Acerca de  — singleton configuracion_acerca (ES / EN)
 *   2. Créditos   — CRUD tabla creditos, agrupado por seccion
 *   3. Redes Sociales — CRUD tabla redes_sociales (máx 5), icono Bootstrap Icons
 *
 * Acceso: solo admin  (configuracion.ver)
 * Auth: createClient().auth.getUser() → usuarios_admin lookup (NO useAuth)
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import { Save, Trash2, Pencil, Plus, X, Check, Globe } from 'lucide-react';

/* ─── Constantes ──────────────────────────────────────────────────── */
const ACERCA_ID   = '00000000-0000-0000-0000-000000000001';
const SECCIONES   = ['unam', 'fad', 'taller', 'webmaster'];
const SECCION_LABEL = {
  unam:      'UNAM',
  fad:       'FAD',
  taller:    'Taller',
  webmaster: 'Webmaster',
};

/** Bootstrap Icons disponibles para redes sociales */
const RRSS_ICONS = [
  'globe',
  'facebook',
  'instagram',
  'twitter-x',
  'youtube',
  'tiktok',
  'linkedin',
  'pinterest',
  'whatsapp',
  'telegram',
  'envelope',
  'rss',
  'github',
  'behance',
  'vimeo',
  'snapchat',
  'threads',
  'mastodon',
  'discord',
  'twitch',
];

/* ─── Helpers ─────────────────────────────────────────────────────── */
function formatTS(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function ConfiguracionPage() {
  const router = useRouter();

  /* ── Auth ─────────────────────────────────────────────────── */
  const [rol,       setRol]       = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const { tienePermiso } = usePermisos(rol);

  useEffect(() => {
    const client = createClient();
    (async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: admin } = await client
        .from('usuarios_admin')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (!admin) { router.replace('/login'); return; }
      setRol(admin.rol);
      setAuthReady(true);
    })();
  }, [router]);

  useEffect(() => {
    if (authReady && !tienePermiso('configuracion.ver')) {
      router.replace('/admin');
    }
  }, [authReady, tienePermiso, router]);

  /* ── Pestaña activa ───────────────────────────────────────── */
  const [tab, setTab] = useState('acerca');

  if (!authReady) {
    return (
      <div className="page-loading">
        <div className="spinner" aria-label="Cargando…" />
      </div>
    );
  }

  if (!tienePermiso('configuracion.ver')) return null;

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2>Configuración</h2>
          <p>Ajustes globales del sitio</p>
        </div>
      </div>

      {/* ── Pestañas ──────────────────────────────────────── */}
      <div className="config-tabs" role="tablist">
        {[
          { key: 'acerca',  label: 'Acerca de'     },
          { key: 'creditos', label: 'Créditos'      },
          { key: 'rrss',    label: 'Redes Sociales' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`tab-panel-${key}`}
            id={`tab-btn-${key}`}
            className={`config-tab-btn${tab === key ? ' config-tab-btn--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Paneles ───────────────────────────────────────── */}
      <TabAcerca   active={tab === 'acerca'}  />
      <TabCreditos active={tab === 'creditos'} />
      <TabRrss     active={tab === 'rrss'}    />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 1 — ACERCA DE
   ═══════════════════════════════════════════════════════════════════ */
function TabAcerca({ active }) {
  const [lang,    setLang]    = useState('es');
  const [row,     setRow]     = useState(null);
  const [es,      setEs]      = useState('');
  const [en,      setEn]      = useState('');
  const [titulo,  setTitulo]  = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    if (!active) return;
    const client = createClient();
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await client
        .from('configuracion_acerca')
        .select('*')
        .eq('id', ACERCA_ID)
        .single();

      if (err) {
        setError(err.message);
      } else if (data) {
        setRow(data);
        setTitulo(data.titulo ?? '');
        setEs(data.contenido_es ?? '');
        setEn(data.contenido_en ?? '');
      }
      setLoading(false);
    })();
  }, [active]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();

      const { error: err } = await client
        .from('configuracion_acerca')
        .update({
          titulo:       titulo,
          contenido_es: es,
          contenido_en: en,
          actualizado_por: user?.id ?? null,
        })
        .eq('id', ACERCA_ID);

      if (err) throw err;

      // Recargar timestamp
      const { data: refreshed } = await client
        .from('configuracion_acerca')
        .select('updated_at, actualizado_por')
        .eq('id', ACERCA_ID)
        .single();

      if (refreshed) setRow(prev => ({ ...prev, ...refreshed }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="tab-panel-acerca"
      role="tabpanel"
      aria-labelledby="tab-btn-acerca"
      className={`config-tab-panel${active ? ' config-tab-panel--active' : ''}`}
    >
      <div className="config-panel-inner">
        <p className="config-subtitle">
          Texto de presentación del catálogo, disponible en español e inglés.
        </p>

        {loading && (
          <div className="page-loading" style={{ minHeight: '120px' }}>
            <div className="spinner" aria-label="Cargando…" />
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Título */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="acerca-titulo">
                Título
              </label>
              <input
                id="acerca-titulo"
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Mini-tabs ES / EN */}
            <div className="acerca-lang-tabs" role="tablist" aria-label="Idioma">
              <button
                type="button"
                role="tab"
                aria-selected={lang === 'es'}
                className={`acerca-lang-btn${lang === 'es' ? ' acerca-lang-btn--active' : ''}`}
                onClick={() => setLang('es')}
              >
                Español
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lang === 'en'}
                className={`acerca-lang-btn${lang === 'en' ? ' acerca-lang-btn--active' : ''}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>

            {/* Panel ES */}
            <div
              className={`acerca-lang-panel${lang === 'es' ? ' acerca-lang-panel--active' : ''}`}
              role="tabpanel"
            >
              <textarea
                className="form-textarea"
                rows={12}
                value={es}
                onChange={e => setEs(e.target.value)}
                disabled={saving}
                placeholder="Texto en español…"
                aria-label="Contenido en español"
              />
            </div>

            {/* Panel EN */}
            <div
              className={`acerca-lang-panel${lang === 'en' ? ' acerca-lang-panel--active' : ''}`}
              role="tabpanel"
            >
              <textarea
                className="form-textarea"
                rows={12}
                value={en}
                onChange={e => setEn(e.target.value)}
                disabled={saving}
                placeholder="Content in English…"
                aria-label="Contenido en inglés"
              />
            </div>

            {/* Footer con timestamp + botón guardar */}
            <div className="config-acerca-footer">
              {row?.updated_at && (
                <span className="config-timestamp">
                  Última actualización: {formatTS(row.updated_at)}
                </span>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {saved && (
                  <span style={{ color: 'var(--color-success, #16a34a)', fontSize: '0.875rem' }}>
                    <Check size={14} aria-hidden="true" /> Guardado
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <><div className="spinner spinner--sm" aria-hidden="true" /> Guardando…</>
                    : <><Save size={15} aria-hidden="true" /> Guardar</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 2 — CRÉDITOS
   ═══════════════════════════════════════════════════════════════════ */
function TabCreditos({ active }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* Modal de edición */
  const [editTarget, setEditTarget] = useState(null);  // row | null
  const [addTarget,  setAddTarget]  = useState(null);  // { seccion } | null

  const load = useCallback(async () => {
    const client = createClient();
    setLoading(true);
    setError(null);
    const { data, error: err } = await client
      .from('creditos')
      .select('*')
      .order('seccion')
      .order('orden');

    if (err) setError(err.message);
    else setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const handleToggleVisible = async (row) => {
    const client = createClient();
    await client
      .from('creditos')
      .update({ visible: !row.visible })
      .eq('id', row.id);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este crédito?')) return;
    const client = createClient();
    await client.from('creditos').delete().eq('id', id);
    load();
  };

  const grouped = SECCIONES.map(sec => ({
    seccion: sec,
    items: rows.filter(r => r.seccion === sec),
  }));

  return (
    <div
      id="tab-panel-creditos"
      role="tabpanel"
      aria-labelledby="tab-btn-creditos"
      className={`config-tab-panel${active ? ' config-tab-panel--active' : ''}`}
    >
      <div className="config-panel-inner">
        <p className="config-subtitle">
          Personas y organismos que forman parte del catálogo.
        </p>

        {loading && (
          <div className="page-loading" style={{ minHeight: '100px' }}>
            <div className="spinner" aria-label="Cargando…" />
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && grouped.map(({ seccion, items }) => (
          <div key={seccion} className="credito-seccion">
            <div className="credito-seccion-header">
              <h3 className="credito-seccion-title">
                {SECCION_LABEL[seccion] ?? seccion}
              </h3>
              <button
                type="button"
                className="credito-add-btn"
                onClick={() => setAddTarget({ seccion })}
                aria-label={`Agregar crédito en ${SECCION_LABEL[seccion] ?? seccion}`}
              >
                <Plus size={15} aria-hidden="true" /> Agregar
              </button>
            </div>

            {items.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Sin créditos en esta sección.
              </p>
            )}

            <ul className="credito-lista">
              {items.map(row => (
                <li
                  key={row.id}
                  className={`credito-card${row.visible ? ' credito-card--visible' : ' credito-card--oculto'}`}
                >
                  {/* Visible toggle */}
                  <label className="credito-visible-label">
                    <input
                      type="checkbox"
                      className="credito-visible-cb"
                      checked={!!row.visible}
                      onChange={() => handleToggleVisible(row)}
                      aria-label={`${row.visible ? 'Ocultar' : 'Mostrar'} ${row.nombre}`}
                    />
                    <span className="credito-visible-text">
                      {row.visible ? 'Visible' : 'Oculto'}
                    </span>
                  </label>

                  {/* Info */}
                  <div className="credito-card-info">
                    <div className="credito-nombres">
                      <span className="credito-nombre">{row.nombre}</span>
                    </div>
                    <span className="credito-cargo">
                      {row.cargo || <em style={{ opacity: 0.5 }}>Sin cargo</em>}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="credito-card-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setEditTarget(row)}
                      aria-label={`Editar ${row.nombre}`}
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    {/* Solo tipo custom/default pueden borrarse */}
                    {row.tipo !== 'fijo' && (
                      <button
                        type="button"
                        className="credito-del-btn"
                        onClick={() => handleDelete(row.id)}
                        aria-label={`Eliminar ${row.nombre}`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Modal edición */}
      {(editTarget || addTarget) && (
        <CreditoModal
          row={editTarget}
          seccion={addTarget?.seccion ?? editTarget?.seccion}
          onClose={() => { setEditTarget(null); setAddTarget(null); }}
          onSaved={() => { setEditTarget(null); setAddTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function CreditoModal({ row, seccion, onClose, onSaved }) {
  const [nombre,  setNombre]  = useState(row?.nombre  ?? '');
  const [cargo,   setCargo]   = useState(row?.cargo   ?? '');
  const [visible, setVisible] = useState(row?.visible ?? true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const editableCargo = row ? (row.editable_cargo !== false) : true;
  const isNew = !row;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();

      if (isNew) {
        const { error: err } = await client.from('creditos').insert({
          seccion,
          nombre,
          cargo,
          visible,
          tipo:            'custom',
          editable_cargo:  true,
          actualizado_por: user?.id ?? null,
        });
        if (err) throw err;
      } else {
        const update = { nombre, visible, actualizado_por: user?.id ?? null };
        if (editableCargo) update.cargo = cargo;
        const { error: err } = await client
          .from('creditos')
          .update(update)
          .eq('id', row.id);
        if (err) throw err;
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={isNew ? 'Agregar crédito' : 'Editar crédito'}>
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 className="modal-title">{isNew ? 'Agregar crédito' : 'Editar crédito'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="credito-nombre">Nombre</label>
              <input
                id="credito-nombre"
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label" htmlFor="credito-cargo">Cargo</label>
              <input
                id="credito-cargo"
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={cargo}
                onChange={e => setCargo(e.target.value)}
                disabled={saving || !editableCargo}
                placeholder={!editableCargo ? 'Cargo fijo — no editable' : ''}
              />
            </div>

            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={e => setVisible(e.target.checked)}
                  disabled={saving}
                />
                <span className="form-label" style={{ margin: 0 }}>Visible en el sitio</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !nombre.trim()}>
              {saving
                ? <><div className="spinner spinner--sm" aria-hidden="true" /> Guardando…</>
                : isNew ? <><Plus size={14} aria-hidden="true" /> Agregar</> : <><Save size={14} aria-hidden="true" /> Guardar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3 — REDES SOCIALES
   ═══════════════════════════════════════════════════════════════════ */
function TabRrss({ active }) {
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [editRow,   setEditRow]   = useState(null);  // row | null
  const [showAdd,   setShowAdd]   = useState(false);

  const load = useCallback(async () => {
    const client = createClient();
    setLoading(true);
    setError(null);
    const { data, error: err } = await client
      .from('redes_sociales')
      .select('*')
      .order('orden');

    if (err) setError(err.message);
    else setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const handleToggleVisible = async (row) => {
    const client = createClient();
    await client
      .from('redes_sociales')
      .update({ visible: !row.visible })
      .eq('id', row.id);
    load();
  };

  const handleDelete = async (row) => {
    if (!confirm(`¿Eliminar "${row.nombre}"?`)) return;
    const client = createClient();
    await client.from('redes_sociales').delete().eq('id', row.id);
    load();
  };

  const maxReached = rows.length >= 5;

  return (
    <div
      id="tab-panel-rrss"
      role="tabpanel"
      aria-labelledby="tab-btn-rrss"
      className={`config-tab-panel${active ? ' config-tab-panel--active' : ''}`}
    >
      <div className="config-panel-inner">
        <div className="rrss-layout">

          {/* ── Columna izquierda: lista ─────────────────── */}
          <div>
            <div className="rrss-col-header">
              <h3 style={{ margin: 0 }}>Redes sociales</h3>
              <span className={`rrss-contador${maxReached ? ' rrss-contador--full' : ''}`}>
                {rows.length}/5
              </span>
            </div>

            {loading && (
              <div className="page-loading" style={{ minHeight: '80px' }}>
                <div className="spinner" aria-label="Cargando…" />
              </div>
            )}

            {error && (
              <div className="alert alert-error" role="alert">
                <strong>Error:</strong> {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {rows.length === 0 && (
                  <div className="rrss-empty">
                    Sin redes sociales configuradas.
                  </div>
                )}

                <ul className="rrss-cards-list">
                  {rows.map(row => (
                    <li
                      key={row.id}
                      className={`rrss-card${!row.visible ? ' rrss-card--hidden' : ''}`}
                    >
                      {/* Icono */}
                      <span
                        className="rrss-icon-bubble"
                        style={{ background: row.color ?? '#013B75' }}
                        aria-hidden="true"
                      >
                        <i className={`bi bi-${row.icono ?? 'globe'}`} />
                      </span>

                      {/* Info */}
                      <div className="rrss-info">
                        <span className="rrss-nombre">{row.nombre}</span>
                        <span className="rrss-url">{row.url}</span>
                      </div>

                      {/* Visible toggle */}
                      <button
                        type="button"
                        className="rrss-visible-toggle"
                        onClick={() => handleToggleVisible(row)}
                        aria-label={row.visible ? `Ocultar ${row.nombre}` : `Mostrar ${row.nombre}`}
                        title={row.visible ? 'Ocultar' : 'Mostrar'}
                      >
                        <i className={`bi bi-${row.visible ? 'eye' : 'eye-slash'}`} aria-hidden="true" />
                      </button>

                      {/* Acciones */}
                      <div className="rrss-card-btns">
                        <button
                          type="button"
                          className="rrss-edit-btn"
                          onClick={() => setEditRow(row)}
                          aria-label={`Editar ${row.nombre}`}
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="rrss-del-btn"
                          onClick={() => handleDelete(row)}
                          aria-label={`Eliminar ${row.nombre}`}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="btn-rrss-agregar"
                  onClick={() => setShowAdd(true)}
                  disabled={maxReached}
                  aria-disabled={maxReached}
                  title={maxReached ? 'Máximo 5 redes sociales' : 'Agregar red social'}
                >
                  <Plus size={15} aria-hidden="true" /> Agregar red social
                </button>
              </>
            )}
          </div>

          {/* ── Columna derecha: preview ──────────────────── */}
          <div>
            <div className="rrss-col-header">
              <h3 style={{ margin: 0 }}>Vista previa</h3>
            </div>
            <div className="rrss-preview-footer" aria-label="Vista previa del footer">
              {rows.filter(r => r.visible).length === 0
                ? <span className="rrss-preview-empty">Sin redes visibles</span>
                : rows
                    .filter(r => r.visible)
                    .map(row => (
                      <a
                        key={row.id}
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rrss-preview-icon"
                        style={{ background: row.color ?? '#013B75' }}
                        title={row.nombre}
                        aria-label={row.nombre}
                      >
                        <i className={`bi bi-${row.icono ?? 'globe'}`} aria-hidden="true" />
                      </a>
                    ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Modal agregar / editar */}
      {(showAdd || editRow) && (
        <RrssModal
          row={editRow}
          onClose={() => { setEditRow(null); setShowAdd(false); }}
          onSaved={() => { setEditRow(null); setShowAdd(false); load(); }}
          nextOrden={rows.length + 1}
        />
      )}
    </div>
  );
}

function RrssModal({ row, onClose, onSaved, nextOrden }) {
  const isNew = !row;

  const [nombre,  setNombre]  = useState(row?.nombre  ?? '');
  const [url,     setUrl]     = useState(row?.url     ?? '');
  const [icono,   setIcono]   = useState(row?.icono   ?? 'globe');
  const [color,   setColor]   = useState(row?.color   ?? '#013B75');
  const [visible, setVisible] = useState(row?.visible ?? true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const urlOk  = url.trim() === '' ? null : isValidUrl(url.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    if (!url.trim() || !isValidUrl(url.trim())) { setError('URL inválida.'); return; }

    setSaving(true);
    setError(null);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();

      if (isNew) {
        const { error: err } = await client.from('redes_sociales').insert({
          nombre,
          url:             url.trim(),
          icono,
          color,
          visible,
          orden:           nextOrden,
          actualizado_por: user?.id ?? null,
        });
        if (err) throw err;
      } else {
        const { error: err } = await client
          .from('redes_sociales')
          .update({
            nombre,
            url:             url.trim(),
            icono,
            color,
            visible,
            actualizado_por: user?.id ?? null,
          })
          .eq('id', row.id);
        if (err) throw err;
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={isNew ? 'Agregar red social' : 'Editar red social'}>
      <div className={`modal-dialog modal-dialog--rrss`}>
        <div className="modal-header">
          <h3 className="modal-title">
            {isNew ? 'Agregar red social' : `Editar — ${row.nombre}`}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body rrss-modal-body">

            {/* ── Columna formulario ──────────────────── */}
            <div className="rrss-modal-form-col">
              {error && (
                <div className="alert alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                  {error}
                </div>
              )}

              {/* Nombre */}
              <div className="form-group">
                <label className="form-label" htmlFor="rrss-nombre">Nombre</label>
                <input
                  id="rrss-nombre"
                  type="text"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  required
                  disabled={saving}
                  placeholder="Ej. Instagram"
                />
              </div>

              {/* URL */}
              <div className="form-group rrss-url-row" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" htmlFor="rrss-url">URL</label>
                <input
                  id="rrss-url"
                  type="url"
                  className={`search-input${urlOk === false ? ' input--invalid' : urlOk === true ? ' input--valid' : ''}`}
                  style={{ width: '100%' }}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  required
                  disabled={saving}
                  placeholder="https://…"
                />
                {urlOk === false && (
                  <span className="rrss-url-feedback rrss-url-feedback--err" aria-live="polite">
                    URL inválida
                  </span>
                )}
                {urlOk === true && (
                  <span className="rrss-url-feedback rrss-url-feedback--ok" aria-live="polite">
                    URL válida
                  </span>
                )}
              </div>

              {/* Color */}
              <div className="rrss-color-row" style={{ marginTop: '0.75rem' }}>
                <label className="rrss-color-label" htmlFor="rrss-color">Color del icono</label>
                <input
                  id="rrss-color"
                  type="color"
                  className="rrss-color-picker"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  disabled={saving}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {color}
                </span>
              </div>

              {/* Visible */}
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="rrss-visible-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={e => setVisible(e.target.checked)}
                    disabled={saving}
                  />
                  <span>Visible en el sitio</span>
                </label>
              </div>

              {/* Preview burbuja */}
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  className="rrss-icon-bubble"
                  style={{ background: color }}
                  aria-hidden="true"
                >
                  <i className={`bi bi-${icono}`} />
                </span>
                <span style={{ fontSize: '0.875rem' }}>{nombre || 'Vista previa'}</span>
              </div>
            </div>

            {/* ── Columna selector de icono ──────────── */}
            <div className="rrss-modal-icon-col">
              <p className="rrss-icon-col-title">Icono</p>
              <div
                className="rrss-icon-selector-grid"
                role="radiogroup"
                aria-label="Seleccionar icono"
              >
                {RRSS_ICONS.map(slug => (
                  <button
                    key={slug}
                    type="button"
                    className={`rrss-icon-option${icono === slug ? ' rrss-icon-option--selected' : ''}`}
                    onClick={() => setIcono(slug)}
                    disabled={saving}
                    aria-pressed={icono === slug}
                    title={slug}
                  >
                    <span className="rrss-icon-option-bubble">
                      <i className={`bi bi-${slug}`} aria-hidden="true" />
                    </span>
                    <span className="rrss-icon-option-name">{slug}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !nombre.trim() || !url.trim() || urlOk === false}
            >
              {saving
                ? <><div className="spinner spinner--sm" aria-hidden="true" /> Guardando…</>
                : isNew
                  ? <><Plus size={14} aria-hidden="true" /> Agregar</>
                  : <><Save size={14} aria-hidden="true" /> Guardar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
