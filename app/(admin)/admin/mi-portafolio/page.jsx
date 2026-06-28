'use client';

/**
 * app/(admin)/admin/mi-portafolio/page.jsx
 *
 * Mi Portafolio — Client Component (acceso: solo rol 'editor').
 * Muestra las obras del usuario autenticado filtradas por editor_id.
 *
 * Acciones por estado (fuente: portafolio.js VanillaJS + instrucción del usuario):
 *   - Publicado    → "Solicitar cambios" (modal de motivo → estado = 'En Revisión')
 *   - Borrador     → "Editar" (ObraForm)
 *   - En Revisión  → sin acción (en espera de revisión del admin)
 *   - Archivado    → sin acción (solo lectura)
 *
 * Columnas: Imagen / Título / Año / Técnica / Tags / Estado / Fecha / Acciones
 *
 * Auth: createClient().auth.getUser() → usuarios_admin lookup (NO useAuth)
 * CSS: únicamente selectores verificados en styles/admin.css
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import ObraForm from '@/components/admin/ObraForm';
import { Pencil, MessageSquarePlus, Search, RefreshCw, X } from 'lucide-react';

/* ─── Constantes ──────────────────────────────────────────────────── */
const OBRA_SELECT =
  'id, titulo, artista, año, estado, updated_at, motivo_reapertura, editor_id, ' +
  'tecnicas(nombre), ' +
  'imagenes(id, url_storage, principal, pendiente_borrado), ' +
  'obra_tags(tags(id, nombre))';

/* ─── Helpers ─────────────────────────────────────────────────────── */
function estadoBadgeClass(estado) {
  switch (estado) {
    case 'Publicado':   return 'badge-publicado';
    case 'Borrador':    return 'badge-borrador';
    case 'En Revisión': return 'badge-revision';
    case 'Archivado':   return 'badge-archivado';
    default:            return '';
  }
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-MX', { dateStyle: 'short' });
}

function contarPorEstado(obras) {
  return obras.reduce((acc, o) => {
    const k = o.estado ?? 'Otro';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL — Solicitar cambios (Publicado → En Revisión)
   ═══════════════════════════════════════════════════════════════════ */
function SolicitarCambiosModal({ obra, onClose, onSaved }) {
  const [motivo,  setMotivo]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) { setError('Describe el motivo del cambio.'); return; }

    setSaving(true);
    setError(null);
    try {
      const client = createClient();
      const { error: err } = await client
        .from('obras')
        .update({
          estado:            'En Revisión',
          motivo_reapertura: motivo.trim(),
        })
        .eq('id', obra.id);

      if (err) throw err;
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Solicitar cambios">
      <div className="modal-dialog" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Solicitar cambios</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--color-text-muted)' }}>
              La obra <strong>"{obra.titulo}"</strong> pasará a estado <strong>En Revisión</strong>.
              El administrador recibirá tu solicitud.
            </p>

            {error && (
              <div className="alert alert-error" role="alert" style={{ marginBottom: '0.75rem' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="motivo-reapertura">
                Motivo del cambio
              </label>
              <textarea
                id="motivo-reapertura"
                className="form-textarea"
                rows={4}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                disabled={saving}
                placeholder="Describe qué deseas modificar…"
                maxLength={500}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'right', display: 'block' }}>
                {motivo.length}/500
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !motivo.trim()}
            >
              {saving
                ? <><div className="spinner spinner--sm" aria-hidden="true" /> Enviando…</>
                : <><MessageSquarePlus size={14} aria-hidden="true" /> Solicitar cambios</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function MiPortafolioPage() {
  const router = useRouter();

  /* ── Auth ─────────────────────────────────────────────── */
  const [currentUser, setCurrentUser] = useState(null);
  const [rol,         setRol]         = useState(null);
  const [authReady,   setAuthReady]   = useState(false);
  const { tienePermiso } = usePermisos(rol);

  useEffect(() => {
    const client = createClient();
    (async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: admin } = await client
        .from('usuarios_admin')
        .select('id, nombre, email, rol')
        .eq('id', user.id)
        .single();

      if (!admin) { router.replace('/login'); return; }
      setCurrentUser({ ...admin, authId: user.id });
      setRol(admin.rol);
      setAuthReady(true);
    })();
  }, [router]);

  useEffect(() => {
    if (authReady && !tienePermiso('portafolio.ver')) {
      router.replace('/admin');
    }
  }, [authReady, tienePermiso, router]);

  /* ── Datos ────────────────────────────────────────────── */
  const [obras,   setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* Filtros */
  const [search,       setSearch]       = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const loadObras = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const client = createClient();
      const { data, error: err } = await client
        .from('obras')
        .select(OBRA_SELECT)
        .eq('editor_id', currentUser.authId)
        .order('updated_at', { ascending: false });

      if (err) throw err;
      setObras(data ?? []);
    } catch (err) {
      console.error('[mi-portafolio] loadObras:', err?.message, err);
      setError(err?.message ?? 'Error al cargar las obras.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (authReady && tienePermiso('portafolio.ver')) loadObras();
  }, [authReady, loadObras, tienePermiso]);

  /* ── Modales ──────────────────────────────────────────── */
  const [editObra,   setEditObra]   = useState(null);   // obra | null
  const [reapertura, setReapertura] = useState(null);   // obra | null

  /* ── Filtro local ─────────────────────────────────────── */
  const obrasFiltradas = obras.filter(o => {
    const matchSearch = !search.trim() ||
      o.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      o.artista?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filtroEstado || o.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const stats = contarPorEstado(obras);

  /* ── Render ───────────────────────────────────────────── */
  if (!authReady) {
    return (
      <div className="page-loading">
        <div className="spinner" aria-label="Cargando…" />
      </div>
    );
  }

  if (!tienePermiso('portafolio.ver')) return null;

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2>Mi Portafolio</h2>
          <p>Tus obras en el catálogo</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadObras}
          disabled={loading}
          aria-label="Recargar"
          title="Recargar"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Recargar
        </button>
      </div>

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="portafolio-stats">
        <div className="portafolio-stat-card">
          <span className="portafolio-stat-number">{obras.length}</span>
          <span className="portafolio-stat-label">Total de Obras</span>
        </div>
        <div className="portafolio-stat-card portafolio-stat-card--publicado">
          <span className="portafolio-stat-number">{stats['Publicado']   ?? 0}</span>
          <span className="portafolio-stat-label">Publicadas</span>
        </div>
        <div className="portafolio-stat-card portafolio-stat-card--borrador">
          <span className="portafolio-stat-number">{stats['Borrador']    ?? 0}</span>
          <span className="portafolio-stat-label">Borradores</span>
        </div>
        <div className="portafolio-stat-card portafolio-stat-card--revision">
          <span className="portafolio-stat-number">{stats['En Revisión'] ?? 0}</span>
          <span className="portafolio-stat-label">En Revisión</span>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={loadObras}
            style={{ marginLeft: '1rem' }}
          >
            <RefreshCw size={13} aria-hidden="true" /> Reintentar
          </button>
        </div>
      )}

      {/* ── Toolbar (búsqueda + filtro estado) ───────────── */}
      <div className="portafolio-toolbar">
        {/* Búsqueda por título/artista */}
        <div className="portafolio-search search-field">
          <span className="search-field__icon" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            type="search"
            className="search-field__input"
            placeholder="Buscar por título o artista…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar obras"
          />
        </div>

        {/* Filtro por estado */}
        <select
          className="sort-select"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          aria-label="Filtrar por estado"
          style={{ maxWidth: '180px' }}
        >
          <option value="">Todos los estados</option>
          <option value="Borrador">Borrador</option>
          <option value="En Revisión">En Revisión</option>
          <option value="Publicado">Publicado</option>
          <option value="Archivado">Archivado</option>
        </select>
      </div>

      {/* ── Tabla ─────────────────────────────────────────── */}
      {loading ? (
        <div className="page-loading" style={{ minHeight: '200px' }}>
          <div className="spinner" aria-label="Cargando obras…" />
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="portafolio-table">
            <thead>
              <tr>
                <th scope="col">Imagen</th>
                <th scope="col">Título</th>
                <th scope="col">Año</th>
                <th scope="col">Técnica</th>
                <th scope="col">Tags</th>
                <th scope="col">Estado</th>
                <th scope="col">Fecha</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {obrasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    {search || filtroEstado
                      ? 'Sin resultados para los filtros aplicados.'
                      : 'Aún no tienes obras registradas.'}
                  </td>
                </tr>
              ) : obrasFiltradas.map(obra => {
                const thumb =
                  obra.imagenes?.find(i => i.principal && !i.pendiente_borrado)?.url_storage ??
                  obra.imagenes?.find(i => !i.pendiente_borrado)?.url_storage ??
                  null;

                const tagNames = (obra.obra_tags ?? [])
                  .map(ot => ot.tags?.nombre)
                  .filter(Boolean);

                return (
                  <tr key={obra.id}>
                    {/* Miniatura */}
                    <td style={{ width: '64px' }}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={obra.titulo ?? 'Obra'}
                          className="obra-thumb"
                          style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '56px', height: '56px', borderRadius: '4px',
                            background: 'var(--color-surface-alt, #F4F7FC)',
                            border: '1px solid var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', color: 'var(--color-text-muted)', textAlign: 'center'
                          }}
                        >
                          Sin imagen
                        </div>
                      )}
                    </td>

                    {/* Título */}
                    <td>
                      <span style={{ fontWeight: 600 }}>{obra.titulo || '—'}</span>
                      {obra.artista && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {obra.artista}
                        </span>
                      )}
                    </td>

                    {/* Año */}
                    <td>{obra.año ?? '—'}</td>

                    {/* Técnica */}
                    <td>{obra.tecnicas?.nombre ?? '—'}</td>

                    {/* Tags */}
                    <td>
                      {tagNames.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {tagNames.map(n => (
                            <span key={n} className="tag-badge">{n}</span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td>
                      <span className={`badge ${estadoBadgeClass(obra.estado)}`}>
                        {obra.estado ?? '—'}
                      </span>
                    </td>

                    {/* Fecha */}
                    <td>{formatDate(obra.updated_at)}</td>

                    {/* Acciones */}
                    <td>
                      <div className="action-buttons">
                        {/* Publicado → Solicitar cambios */}
                        {obra.estado === 'Publicado' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setReapertura(obra)}
                            title="Solicitar cambios al administrador"
                          >
                            <MessageSquarePlus size={13} aria-hidden="true" />
                            Solicitar cambios
                          </button>
                        )}

                        {/* Borrador → Editar */}
                        {obra.estado === 'Borrador' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setEditObra(obra)}
                            title="Editar obra"
                          >
                            <Pencil size={13} aria-hidden="true" />
                            Editar
                          </button>
                        )}

                        {/* En Revisión → sin acción (esperando revisión del admin) */}
                        {obra.estado === 'En Revisión' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            En revisión
                          </span>
                        )}

                        {/* Archivado → sin acción */}
                        {obra.estado === 'Archivado' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            Solo lectura
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ObraForm (Editar Borrador) ─────────────────────── */}
      {editObra && (
        <ObraForm
          obra={editObra}
          onClose={() => setEditObra(null)}
          onSaved={() => { setEditObra(null); loadObras(); }}
          userRol={currentUser?.rol}
          userEmail={currentUser?.email}
        />
      )}

      {/* ── Modal Solicitar cambios (Publicado → En Revisión) ─ */}
      {reapertura && (
        <SolicitarCambiosModal
          obra={reapertura}
          onClose={() => setReapertura(null)}
          onSaved={() => { setReapertura(null); loadObras(); }}
        />
      )}
    </div>
  );
}
