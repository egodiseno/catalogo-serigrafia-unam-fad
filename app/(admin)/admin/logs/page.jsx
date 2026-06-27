'use client';

/**
 * app/(admin)/admin/logs/page.jsx — /admin/logs
 *
 * Client Component. Auth directa con createClient() singleton — sin useAuth.
 * Port de logs.js (VanillaJS).
 *
 * Schema inferido de audit_logs (no existe migration file verificable):
 *   id (uuid PK), created_at (timestamptz), user_email (text),
 *   accion (text): 'crear'|'editar'|'borrar'|'login'|'logout'|'validar'|'rechazar'|...,
 *   descripcion (text), datos_adicionales (jsonb|text|null),
 *   entidad_tipo (text|null), entidad_id (text|null)
 *
 * Permiso: 'logs.ver' — solo admin
 *
 * Clases CSS verificadas en styles/admin.css:
 *   .section-header / .search-field / .search-field__icon / .search-field__input
 *   .table-wrapper / .empty-state
 *   .logs-table / .logs-filters / .logs-filter-group / .logs-filter-group--dates
 *   .logs-date-range / .logs-date-sep / .logs-filter-actions
 *   .badge-log / .badge-log--crear / .badge-log--editar / .badge-log--borrar
 *   .badge-log--login / .badge-log--logout
 *   .btn / .btn-sm / .btn-secondary / .btn-primary
 *   .usuarios-table-footer / .usuarios-footer__left / .usuarios-footer__center
 *   .table-counter / .table-pagination
 *   .pagination-btn / .pagination-btn--active / .pagination-btn--disabled
 *   .pagination-ellipsis / .search-input
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import { Download, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch { return '—'; }
}

/** Devuelve la clase CSS del badge según la acción. Fallback a badge-log genérico. */
function getAccionBadgeClass(accion) {
  const KNOWN = ['crear', 'editar', 'borrar', 'login', 'logout'];
  const slug = (accion ?? '').toLowerCase();
  if (KNOWN.includes(slug)) return `badge-log badge-log--${slug}`;
  return 'badge-log';
}

/** Serializa datos_adicionales a string legible, recursivo. */
function serializeDatos(datos) {
  if (datos === null || datos === undefined) return null;
  if (typeof datos === 'string') {
    // Intentar parsear si parece JSON
    try {
      const parsed = JSON.parse(datos);
      return JSON.stringify(parsed, null, 2);
    } catch { return datos; }
  }
  if (typeof datos === 'object') return JSON.stringify(datos, null, 2);
  return String(datos);
}

/** Genera y descarga CSV de los logs recibidos */
function exportarCSV(rows) {
  const header = ['Fecha/Hora', 'Usuario', 'Acción', 'Descripción', 'Datos adicionales', 'Entidad', 'ID Entidad'];
  const lines = [
    header.join(','),
    ...rows.map((r) => [
      `"${r.created_at ?? ''}"`,
      `"${(r.user_email ?? '').replace(/"/g, '""')}"`,
      `"${(r.accion ?? '').replace(/"/g, '""')}"`,
      `"${(r.descripcion ?? '').replace(/"/g, '""')}"`,
      `"${(serializeDatos(r.datos_adicionales) ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(r.entidad_tipo ?? '').replace(/"/g, '""')}"`,
      `"${(r.entidad_id ?? '').replace(/"/g, '""')}"`,
    ].join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Fila de datos_adicionales colapsable ──────────────────────────────────────
function DatosAdicionalesCell({ datos }) {
  const [expanded, setExpanded] = useState(false);
  const serialized = serializeDatos(datos);

  if (!serialized) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>;

  const preview = serialized.length > 80 ? serialized.slice(0, 80) + '…' : serialized;

  return (
    <div>
      <code style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.4, display: 'block' }}>
        {expanded ? serialized : preview}
      </code>
      {serialized.length > 80 && (
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
          aria-expanded={expanded}
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
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
    <div className="table-pagination" role="navigation" aria-label="Paginación de logs">
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
export default function LogsPage() {
  const client = createClient();
  const router = useRouter();

  const [currentUser,  setCurrentUser]  = useState(null);
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  const [logs,        setLogs]        = useState([]);
  const [totalCount,  setTotalCount]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(false);

  // Filtros
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [accionFiltro,    setAccionFiltro]    = useState(''); // '' = todos
  const [fechaDesde,      setFechaDesde]      = useState('');
  const [fechaHasta,      setFechaHasta]      = useState('');
  const [page,            setPage]            = useState(1);
  const searchTimerRef = useRef(null);

  // ── Debounce búsqueda ────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  // Reset de página al cambiar filtros
  useEffect(() => { setPage(1); }, [accionFiltro, fechaDesde, fechaHasta]);

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
        console.error('[Logs] auth:', err);
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guard ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    if (!tienePermiso('logs.ver')) router.replace('/admin');
  }, [currentUser, tienePermiso, router]);

  // ── Cargar logs ──────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(false);
    try {
      const offset = (page - 1) * PAGE_SIZE;

      let query = client
        .from('audit_logs')
        .select(
          'id, created_at, user_email, accion, descripcion, datos_adicionales, entidad_tipo, entidad_id',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (accionFiltro) query = query.eq('accion', accionFiltro);
      if (debouncedSearch) {
        query = query.or(
          `descripcion.ilike.%${debouncedSearch}%,user_email.ilike.%${debouncedSearch}%`
        );
      }
      if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`);
      if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);

      const { data, count, error } = await query;
      if (error) throw error;

      setLogs(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('[Logs] load:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, currentUser, page, accionFiltro, debouncedSearch, fechaDesde, fechaHasta]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Exportar CSV (datos ya cargados en la página actual) ─────────────────────
  async function handleExportCSV() {
    // Para exportar TODOS los registros filtrados (no solo la página actual),
    // hacemos una consulta sin paginación.
    try {
      let query = client
        .from('audit_logs')
        .select('id, created_at, user_email, accion, descripcion, datos_adicionales, entidad_tipo, entidad_id')
        .order('created_at', { ascending: false });

      if (accionFiltro) query = query.eq('accion', accionFiltro);
      if (debouncedSearch) {
        query = query.or(
          `descripcion.ilike.%${debouncedSearch}%,user_email.ilike.%${debouncedSearch}%`
        );
      }
      if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`);
      if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      exportarCSV(data ?? []);
    } catch (err) {
      console.error('[Logs] exportCSV:', err);
    }
  }

  // ── Limpiar filtros ──────────────────────────────────────────────────────────
  function handleClearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setAccionFiltro('');
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
  }

  const hasFilters = debouncedSearch || accionFiltro || fechaDesde || fechaHasta;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to   = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <h2>Logs de Auditoría</h2>
          <p>Registro completo de actividad del sistema</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadLogs}
            disabled={loading}
            aria-label="Actualizar logs"
          >
            <RefreshCw size={14} aria-hidden="true" /> Actualizar
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            disabled={loading || totalCount === 0}
            aria-label="Exportar CSV"
          >
            <Download size={14} aria-hidden="true" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────────────── */}
      <div className="logs-filters">
        {/* Fila 1: búsqueda + acción */}
        <div className="logs-filter-group">
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
              placeholder="Buscar por descripción o usuario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en logs"
            />
          </div>

          {/* Acción */}
          <select
            value={accionFiltro}
            onChange={(e) => setAccionFiltro(e.target.value)}
            style={{ height: 40, padding: '0 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.875rem', cursor: 'pointer', minWidth: 160 }}
            aria-label="Filtrar por acción"
          >
            <option value="">Todas las acciones</option>
            <option value="crear">Crear</option>
            <option value="editar">Editar</option>
            <option value="borrar">Borrar</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="validar">Validar</option>
            <option value="rechazar">Rechazar</option>
          </select>
        </div>

        {/* Fila 2: rango de fechas */}
        <div className="logs-filter-group logs-filter-group--dates">
          <div className="logs-date-range">
            <label htmlFor="logsFechaDesde" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Desde</label>
            <input
              id="logsFechaDesde"
              type="date"
              className="search-input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              max={fechaHasta || undefined}
              aria-label="Fecha desde"
            />
          </div>
          <span className="logs-date-sep" aria-hidden="true">—</span>
          <div className="logs-date-range">
            <label htmlFor="logsFechaHasta" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Hasta</label>
            <input
              id="logsFechaHasta"
              type="date"
              className="search-input"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              min={fechaDesde || undefined}
              aria-label="Fecha hasta"
            />
          </div>
        </div>

        {/* Limpiar filtros */}
        {hasFilters && (
          <div className="logs-filter-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearFilters}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {loadError && (
        <div className="form-alert error" role="alert" style={{ marginBottom: 'var(--spacing-lg)' }}>
          Error al cargar los logs.{' '}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadLogs} style={{ marginLeft: 8 }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ── Tabla ────────────────────────────────────────────────────────────── */}
      <div className="table-wrapper">
        <table className="logs-table" aria-label="Logs de auditoría">
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Descripción</th>
              <th>Datos adicionales</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="empty-state">Cargando…</td></tr>
            ) : loadError ? null : logs.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    {hasFilters
                      ? 'No hay logs que coincidan con los filtros aplicados.'
                      : 'No hay logs de auditoría registrados.'}
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Fecha/Hora" style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                    {fmtDateTime(log.created_at)}
                  </td>
                  <td data-label="Usuario" style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.user_email
                      ? <a href={`mailto:${log.user_email}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{log.user_email}</a>
                      : <span style={{ color: 'var(--color-text-muted)' }}>Sistema</span>
                    }
                  </td>
                  <td data-label="Acción">
                    <span className={getAccionBadgeClass(log.accion)}>
                      {log.accion ?? '—'}
                    </span>
                  </td>
                  <td data-label="Descripción" style={{ fontSize: '0.875rem' }}>
                    {log.descripcion ?? '—'}
                    {log.entidad_tipo && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {log.entidad_tipo}{log.entidad_id ? `: ${log.entidad_id}` : ''}
                      </div>
                    )}
                  </td>
                  <td data-label="Datos adicionales" style={{ minWidth: 180, maxWidth: 320 }}>
                    <DatosAdicionalesCell datos={log.datos_adicionales} />
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
        </div>
      )}
    </div>
  );
}
