'use client';

/**
 * app/(admin)/admin/historial-alumnos/page.jsx — /admin/historial-alumnos
 *
 * Client Component. Auth directa con createClient() singleton — sin useAuth.
 * Port de historial-alumnos.js (VanillaJS).
 *
 * Schema verificado (registro_alumnos, supabase/migrations/20260617_registro_alumnos.sql):
 *   id (uuid), email (text), nombre (text), numero_cuenta (text 9 dígitos),
 *   telefono (text|null), tiene_whatsapp (boolean), estado (text):
 *     'pendiente_validacion' | 'activo' | 'rechazado',
 *   fecha_registro (timestamptz), fecha_activacion (timestamptz|null),
 *   notas_admin (text|null), user_id (uuid|null)
 *
 * Permiso: 'historial_alumnos.ver' — agregado a usePermisos.js
 *   admin: true, super_editor: true, editor: false
 *
 * Clases CSS verificadas en styles/admin.css:
 *   .section-header / .filter-bar / .search-field / .search-field__icon
 *   .search-field__input / .table-wrapper / .empty-state
 *   .historial-table / .actions-cell / .action-buttons
 *   .btn / .btn-sm / .btn-secondary / .btn-primary
 *   .badge (base) — estado con inline style
 *   .usuarios-table-footer / .usuarios-footer__left / .usuarios-footer__center
 *   .table-counter / .table-pagination
 *   .pagination-btn / .pagination-btn--active / .pagination-btn--disabled
 *   .pagination-ellipsis
 *   .modal-overlay / .modal-dialog / .modal-header / .modal-body
 *   .modal-footer / .modal-close / .form-group / .field-hint
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { Trash2, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch { return '—'; }
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso));
  } catch { return '—'; }
}

function getEstadoBadgeStyle(estado) {
  switch (estado) {
    case 'activo':                return { background: '#d1e7dd', color: '#0a3622' };
    case 'rechazado':             return { background: '#FEE2E2', color: '#DC2626' };
    case 'pendiente_validacion':  return { background: '#FEF3C7', color: '#92400E' };
    default:                      return { background: '#e9ecef', color: '#495057' };
  }
}

function getEstadoLabel(estado) {
  switch (estado) {
    case 'activo':               return 'Validado';
    case 'rechazado':            return 'Rechazado';
    case 'pendiente_validacion': return 'Pendiente';
    default:                     return estado ?? '—';
  }
}

// ── Paginación ────────────────────────────────────────────────────────────────
function Paginacion({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  function buildPages() {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="table-pagination" role="navigation" aria-label="Paginación">
      <button
        className={`pagination-btn${page === 1 ? ' pagination-btn--disabled' : ''}`}
        onClick={() => page > 1 && onChange(page - 1)}
        disabled={page === 1}
        aria-label="Página anterior"
      >«</button>
      {buildPages().map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="pagination-ellipsis">…</span>
          : <button
              key={p}
              className={`pagination-btn${p === page ? ' pagination-btn--active' : ''}`}
              onClick={() => p !== page && onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
            >{p}</button>
      )}
      <button
        className={`pagination-btn${page === totalPages ? ' pagination-btn--disabled' : ''}`}
        onClick={() => page < totalPages && onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Página siguiente"
      >»</button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HistorialAlumnosPage() {
  const client = createClient();
  const router = useRouter();

  const [currentUser,  setCurrentUser]  = useState(null);
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  const [registros,   setRegistros]   = useState([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(false);

  // Filtros
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [estadoFiltro,    setEstadoFiltro]    = useState(''); // '' = todos
  const [page,            setPage]            = useState(1);
  const searchTimerRef = useRef(null);

  // Modal eliminar
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, nombre }
  const [deleting,     setDeleting]     = useState(false);

  const [lastRefresh, setLastRefresh] = useState(null);

  // ── Debounce búsqueda ────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  // Resetear página al cambiar estado
  useEffect(() => { setPage(1); }, [estadoFiltro]);

  // ── Auth ─────────────────────────────────────────────────────────────────────
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
        console.error('[HistorialAlumnos] auth:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guard ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    if (!tienePermiso('historial_alumnos.ver')) router.replace('/admin');
  }, [currentUser, tienePermiso, router]);

  // ── Cargar registros ─────────────────────────────────────────────────────────
  const loadRegistros = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      const offset = (page - 1) * PAGE_SIZE;

      let query = client
        .from('registro_alumnos')
        .select(
          'id, email, nombre, numero_cuenta, telefono, tiene_whatsapp, estado, fecha_registro, fecha_activacion, notas_admin',
          { count: 'exact' }
        )
        .order('fecha_registro', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (estadoFiltro) query = query.eq('estado', estadoFiltro);
      if (debouncedSearch) {
        query = query.or(`email.ilike.%${debouncedSearch}%,nombre.ilike.%${debouncedSearch}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setRegistros(data ?? []);
      setTotalCount(count ?? 0);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[HistorialAlumnos] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser, page, estadoFiltro, debouncedSearch]);

  useEffect(() => { loadRegistros(); }, [loadRegistros]);

  // ── Eliminar registro ─────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await client
        .from('registro_alumnos')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null);
      await loadRegistros();
    } catch (err) {
      console.error('[HistorialAlumnos] delete:', err);
      // ConfirmModal maneja el re-throw → muestra "Procesando…" sin cerrar
      throw err;
    } finally {
      setDeleting(false);
    }
  }

  // Auto-refresh cada 60 s
  useEffect(() => {
    if (!currentUser) return;
    const iv = setInterval(() => loadRegistros(), 60_000);
    return () => clearInterval(iv);
  }, [currentUser, loadRegistros]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to   = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <h2>Historial de Alumnos</h2>
          <p>Todas las solicitudes de registro — {!loading && <strong>{totalCount}</strong>} registros totales</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadRegistros}
          disabled={loading}
          aria-label="Actualizar"
        >
          <RefreshCw size={14} aria-hidden="true" /> Actualizar
        </button>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────────────── */}
      <div className="filter-bar" style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Búsqueda */}
        <div className="search-field" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-field__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input
            type="search"
            className="search-field__input"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar alumno"
          />
        </div>

        {/* Filtro estado */}
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          style={{ height: 40, padding: '0 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.875rem', cursor: 'pointer' }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente_validacion">Pendiente</option>
          <option value="activo">Validado</option>
          <option value="rechazado">Rechazado</option>
        </select>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {loadError && (
        <div className="form-alert error" role="alert" style={{ marginBottom: 'var(--spacing-lg)' }}>
          Error al cargar el historial.{' '}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadRegistros} style={{ marginLeft: 8 }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ── Tabla ────────────────────────────────────────────────────────────── */}
      <div className="table-wrapper">
        <table className="historial-table" aria-label="Historial de solicitudes de alumnos">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Nº Cuenta</th>
              <th>Estado</th>
              <th>Fecha solicitud</th>
              <th>Fecha resolución</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="empty-state">Cargando…</td></tr>
            ) : loadError ? null : registros.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    {debouncedSearch || estadoFiltro
                      ? 'No hay registros que coincidan con los filtros aplicados.'
                      : 'No hay registros en el historial.'}
                  </div>
                </td>
              </tr>
            ) : (
              registros.map((reg) => (
                <tr key={reg.id}>
                  <td data-label="Nombre"><strong>{reg.nombre}</strong></td>
                  <td data-label="Email">
                    <a href={`mailto:${reg.email}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.875rem' }}>
                      {reg.email}
                    </a>
                  </td>
                  <td data-label="Nº Cuenta">
                    <code style={{ fontSize: '0.85rem', background: 'var(--color-surface, #F9FAFB)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', letterSpacing: '0.05em' }}>
                      {reg.numero_cuenta}
                    </code>
                  </td>
                  <td data-label="Estado">
                    <span className="badge" style={getEstadoBadgeStyle(reg.estado)}>
                      {getEstadoLabel(reg.estado)}
                    </span>
                  </td>
                  <td data-label="Fecha solicitud" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {fmtDateShort(reg.fecha_registro)}
                  </td>
                  <td data-label="Fecha resolución" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {fmtDateShort(reg.fecha_activacion)}
                  </td>
                  <td data-label="Acciones" className="actions-cell">
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger btn--icon-only"
                        onClick={() => setDeleteTarget({ id: reg.id, nombre: reg.nombre })}
                        title="Eliminar registro"
                        aria-label={`Eliminar registro de ${reg.nombre}`}
                        disabled={deleting}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer con paginación ────────────────────────────────────────────── */}
      {!loading && !loadError && totalCount > 0 && (
        <div className="usuarios-table-footer">
          <div className="usuarios-footer__left">
            <span className="table-counter">
              {from}–{to} de {totalCount}
            </span>
          </div>
          <div className="usuarios-footer__center">
            <Paginacion page={page} totalPages={totalPages} onChange={setPage} />
          </div>
          <div className="usuarios-footer__right">
            {lastRefresh && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminación ──────────────────────────────────────── */}
      {deleteTarget && (
        <ConfirmModal
          title="Eliminar registro"
          message={`¿Eliminar el registro de ${deleteTarget.nombre}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
