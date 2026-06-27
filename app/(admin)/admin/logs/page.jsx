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
    ...rows.map((r) => {
      // Tolerar columna 'usuario_email' (convención ES) o 'user_email' / 'email'
      const email = r.usuario_email ?? r.user_email ?? r.email ?? '';
      return [
        `"${r.created_at ?? ''}"`,
        `"${String(email).replace(/"/g, '""')}"`,
        `"${(r.accion ?? '').replace(/"/g, '""')}"`,
        `"${(r.descripcion ?? '').replace(/"/g, '""')}"`,
        `"${(serializeDatos(r.datos_adicionales) ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(r.entidad_tipo ?? '').replace(/"/g, '""')}"`,
        `"${(r.entidad_id ?? '').replace(/"/g, '""')}"`,
      ].join(',');
    })
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

  const [logs,         setLogs]         = useState([]);
  const [totalCount,   setTotalCount]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [loadErrorMsg, setLoadErrorMsg] = useState('');

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

      // SELECT * — no migration file para audit_logs en el repo; usar * evita
      // fallo por nombres de columna incorrectos. El campo confirmado incorrecto
      // era 'user_email'; la convención del proyecto usa 'usuario_email'.
      let query = client
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (accionFiltro) query = query.eq('accion', accionFiltro);
      if (debouncedSearch) {
        // 'usuario_email' — convención española del proyecto (no 'user_email')
        query = query.or(
          `descripcion.ilike.%${debouncedSearch}%,usuario_email.ilike.%${debouncedSearch}%`
        );
      }
      if (fechaDesde) query = query.gte('created_at', `${fechaDesde}T00:00:00`);
      if (fechaHasta) query = query.lte('created_at', `${fechaHasta}T23:59:59`);

      const { data, count, error } = await query;
      if (error) throw error;

      setLogs(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      // Detalle completo para diagnosticar: nombre tabla, columnas, RLS
      console.error('[Logs] load — error completo:', err);
      console.error('[Logs] mensaje:', err?.message);
      console.error('[Logs] código Supabase:', err?.code);
      console.error('[Logs] detalles:', err?.details);
      console.error('[Logs] hint:', err?.hint);
      console.error('[Logs] statusCode:', err?.status ?? err?.statusCode);
      setLoadError(true);
      setLoadErrorMsg(err?.message ?? 'Error desconocido');
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
        .select('*')
        .order('created_at', { ascending: false });

      if (accionFiltro) query = query.eq('accion', accionFiltro);
      if (debouncedSearch) {
        query = query.or(
          `descripcion.ilike.%${debouncedSearch}%,usuario_email.ilike.%${debouncedSearch}%`
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

      {/* ── Filtros — todos en una fila horizontal ───────────────────────────── */}
      {/*
          Estructura CSS (verificada en styles/admin.css):
          .logs-filters          → display:flex; flex-wrap:wrap; align-items:flex-end
          .logs-filter-group     → flex-direction:column; gap:4px; min-width:160px
          .logs-filter-group--dates → flex:1 1 auto; min-width:260px (se usa para búsqueda y período)
          .logs-date-range       → display:flex; align-items:center; gap:var(--spacing-sm)
          .logs-date-sep         → separador "—" entre las fechas
          .logs-filter-actions   → display:flex; align-items:flex-end; gap:var(--spacing-sm)
          .search-input          → aplicado en date inputs para que reciban flex:1 1 0 de logs-date-range
      */}
      <div className="logs-filters">

        {/* Grupo 1: Búsqueda (crece con flex:1 1 auto via --dates) */}
        <div className="logs-filter-group logs-filter-group--dates">
          <label htmlFor="logsSearch">Buscar</label>
          <div className="search-field">
            <span className="search-field__icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              id="logsSearch"
              type="search"
              className="search-field__input"
              placeholder="Descripción o usuario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en logs"
            />
          </div>
        </div>

        {/* Grupo 2: Acción */}
        <div className="logs-filter-group">
          <label htmlFor="logsAccion">Acción</label>
          <select
            id="logsAccion"
            value={accionFiltro}
            onChange={(e) => setAccionFiltro(e.target.value)}
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

        {/* Grupo 3: Período (fecha desde — fecha hasta en la misma fila via logs-date-range) */}
        <div className="logs-filter-group logs-filter-group--dates">
          <label>Período</label>
          <div className="logs-date-range">
            <input
              id="logsFechaDesde"
              type="date"
              className="search-input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              max={fechaHasta || undefined}
              aria-label="Fecha desde"
            />
            <span className="logs-date-sep" aria-hidden="true">—</span>
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
          <strong>Error al cargar los logs.</strong>
          {loadErrorMsg && (
            <code style={{ display: 'block', marginTop: 4, fontSize: '0.8rem', opacity: 0.85 }}>
              {loadErrorMsg}
            </code>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadLogs} style={{ marginTop: 8 }}>
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
                    {(() => {
                      // Tolerar 'usuario_email' (ES) o fallbacks 'user_email' / 'email'
                      const ue = log.usuario_email ?? log.user_email ?? log.email ?? null;
                      return ue
                        ? <a href={`mailto:${ue}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{ue}</a>
                        : <span style={{ color: 'var(--color-text-muted)' }}>Sistema</span>;
                    })()}
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
