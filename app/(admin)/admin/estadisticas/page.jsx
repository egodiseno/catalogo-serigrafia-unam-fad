'use client';

/**
 * app/(admin)/admin/estadisticas/page.jsx
 *
 * Historial de visitas — Client Component.
 * - Usa RPC get_historial_obras_visitas(p_ascending, p_limit, p_offset)
 * - Scroll infinito via IntersectionObserver en .est-sentinel
 * - Toggle ASC/DESC con .sort-toggle
 * - Acceso: admin + super_editor  (estadisticas.ver)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import { Eye, Heart, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 20;

export default function EstadisticasPage() {
  const router = useRouter();

  /* ── Auth ─────────────────────────────────────────────────── */
  const [rol, setRol]       = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const { tienePermiso }    = usePermisos(rol);

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

  /* ── Permiso ──────────────────────────────────────────────── */
  useEffect(() => {
    if (authReady && !tienePermiso('estadisticas.ver')) {
      router.replace('/admin');
    }
  }, [authReady, tienePermiso, router]);

  /* ── Estado historial ─────────────────────────────────────── */
  const [items,     setItems]     = useState([]);
  const [ascending, setAscending] = useState(false);   // false = DESC (más visitas primero)
  const [offset,    setOffset]    = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [hasMore,   setHasMore]   = useState(true);
  const [error,     setError]     = useState(null);
  const [totalRows, setTotalRows] = useState(null);

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  /* ── Carga de página ─────────────────────────────────────── */
  const loadPage = useCallback(async (asc, off, reset = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const client = createClient();
      const { data, error: rpcErr } = await client
        .rpc('get_historial_obras_visitas', {
          p_ascending: asc,
          p_limit:     PAGE_SIZE,
          p_offset:    off,
        });

      if (rpcErr) throw rpcErr;

      const rows = data ?? [];
      if (reset) {
        setItems(rows);
      } else {
        setItems(prev => [...prev, ...rows]);
      }
      setOffset(off + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      console.error('[estadisticas] Error RPC:', err?.message, err);
      setError(err?.message ?? 'Error al cargar estadísticas.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  /* ── Carga inicial / cuando cambia sort ──────────────────── */
  useEffect(() => {
    if (!authReady || !tienePermiso('estadisticas.ver')) return;
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
    loadPage(ascending, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, ascending]);

  /* ── IntersectionObserver: sentinel → loadPage ───────────── */
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          loadPage(ascending, offset, false);
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, ascending, offset, loadPage]);

  /* ── Toggle orden ─────────────────────────────────────────── */
  const handleToggleSort = () => setAscending(prev => !prev);

  /* ── Render ───────────────────────────────────────────────── */
  if (!authReady) {
    return (
      <div className="page-loading">
        <div className="spinner" aria-label="Cargando…" />
      </div>
    );
  }

  if (!tienePermiso('estadisticas.ver')) return null;

  return (
    <div className="page-content">

      {/* ── Cabecera ─────────────────────────────────────── */}
      <div className="section-header">
        <div>
          <h2>Estadísticas</h2>
          <p>Historial de visitas por obra — todos los tiempos</p>
        </div>

        {/* Toggle ASC / DESC */}
        <div className="sort-dropdown-wrapper" style={{ display: 'flex' }}>
          <span className="sort-label">Orden:</span>
          <button
            type="button"
            className="sort-toggle"
            onClick={handleToggleSort}
            title={ascending ? 'Ordenar: más visitas primero' : 'Ordenar: menos visitas primero'}
            aria-label={ascending ? 'Orden ascendente — click para invertir' : 'Orden descendente — click para invertir'}
          >
            {ascending
              ? <ArrowUp  size={16} aria-hidden="true" />
              : <ArrowDown size={16} aria-hidden="true" />}
          </button>
          <span className="sort-label">
            {ascending ? 'Menos visitas primero' : 'Más visitas primero'}
          </span>
        </div>
      </div>

      {/* ── Error global ─────────────────────────────────── */}
      {error && (
        <div className="alert alert-error" role="alert">
          <strong>Error:</strong> {error}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ marginLeft: '1rem' }}
            onClick={() => {
              setItems([]);
              setOffset(0);
              setHasMore(true);
              setError(null);
              loadPage(ascending, 0, true);
            }}
          >
            <RefreshCw size={14} aria-hidden="true" /> Reintentar
          </button>
        </div>
      )}

      {/* ── Panel historial ──────────────────────────────── */}
      <div className="est-hist-panel">
        <div className="est-panel-header">
          <h3 className="est-panel-h3">Historial de visitas</h3>
        </div>

        <ol className="est-hist-list" aria-label="Historial de visitas por obra">

          {/* Estado vacío inicial */}
          {!loading && items.length === 0 && !error && (
            <li className="est-state-row">Sin datos de visitas registrados.</li>
          )}

          {/* Filas de datos */}
          {items.map((item, idx) => (
            <li
              key={item.obra_id ?? idx}
              className="est-hist-item"
            >
              {/* Posición */}
              <span
                className={`est-hist-pos${idx === 0 ? ' top-visitas-rank--gold' : ''}`}
                aria-label={`Posición ${idx + 1}`}
              >
                {idx + 1}
              </span>

              {/* Info obra */}
              <div className="top-visitas-info">
                <span className="top-visitas-title" title={item.titulo}>
                  {item.titulo ?? '—'}
                </span>
                <span className="top-visitas-artist" title={item.artista}>
                  {item.artista ?? '—'}
                </span>
              </div>

              {/* Stats: visitas + favoritos */}
              <div className="top-visitas-stats">
                <span className="top-visitas-stat" title="Visitas">
                  <Eye size={13} aria-hidden="true" />
                  {Number(item.visitas ?? 0).toLocaleString('es-MX')}
                </span>
                <span className="top-visitas-stat top-visitas-stat--fav" title="Favoritos">
                  <Heart size={13} aria-hidden="true" />
                  {Number(item.favoritos ?? 0).toLocaleString('es-MX')}
                </span>
              </div>
            </li>
          ))}

          {/* "Cargando más…" */}
          {loading && (
            <li className="est-loading-row" aria-live="polite">
              <div className="spinner spinner--sm" aria-label="Cargando más…" />
              Cargando más…
            </li>
          )}

          {/* Fin de lista */}
          {!hasMore && items.length > 0 && (
            <li className="est-state-row" aria-live="polite">
              {items.length} obra{items.length !== 1 ? 's' : ''} en total.
            </li>
          )}
        </ol>

        {/* Sentinel IntersectionObserver */}
        <div
          ref={sentinelRef}
          className="est-sentinel"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
