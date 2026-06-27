'use client';

/**
 * app/(admin)/admin/page.jsx — /admin (Dashboard)
 *
 * Estructura HTML idéntica al VanillaJS dashboardSection:
 *
 *   .section-header
 *     div > h2 "Dashboard" + p "Resumen del catálogo"
 *     button "+ Nueva Obra"  (solo con permiso obras.crear)
 *
 *   .stats-grid
 *     .stat-card               → Obras Totales
 *     .stat-card--warning      → Pendientes de Revisión  (admin/super_editor)
 *     .stat-card               → Técnicas
 *     .stat-card               → Tags
 *     .stat-card               → Usuarios Admin
 *     .stat-card--warning      → Registros Pendientes    (admin/super_editor)
 *     .stat-card--stale        → Estancadas > 7 días     (admin/super_editor, solo si > 0)
 *
 *   .recent-section            → Últimas Obras (tabla .recent-table)
 *   .recent-section            → Top Visitas este mes    (admin/super_editor, solo si hay datos)
 *
 * Columnas verificadas contra supabase/migrations/:
 *   obras:            id, titulo, artista, año, estado, created_at, updated_at, motivo_reapertura
 *   tecnicas:         id, nombre, slug
 *   tags:             id, nombre, slug
 *   usuarios_admin:   rol, nombre, email, estado
 *   registro_alumnos: estado  ('pendiente_validacion' | 'activo' | 'rechazado')
 *   RPC:              get_top_obras_visitas_mes(p_limit) → obra_id, titulo, artista, visitas, favoritos
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermisos } from '@/hooks/usePermisos';
import { Plus, Clock, Eye, Heart, TrendingUp, BarChart2, AlertCircle } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// Mapa estado → clase badge (idéntico a dashboard.js BADGE_CLS)
const BADGE_CLS = {
  'Publicado':   'badge-publicado',
  'Borrador':    'badge-borrador',
  'En Revisión': 'badge-revision',
  'Archivado':   'badge-archivado',
};

// ── Helpers de Promise.allSettled ─────────────────────────────────────────────
// Extrae el valor de un resultado settled; null si fue rejected.
function settled(result, label) {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  console.error(`[Dashboard] Query "${label}" falló:`, result.reason);
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router  = useRouter();
  const { user, rol, email, loading: authLoading } = useAuth();
  const { tienePermiso } = usePermisos(rol);

  const [stats,       setStats]       = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError,   setDataError]   = useState(false);
  const [errorMsg,    setErrorMsg]    = useState('');
  const intervalRef                   = useRef(null);

  // ── Timeout de seguridad: si a los 8 s seguimos "Cargando…" → mostrar error ─
  // Cubre el caso donde authLoading nunca resuelve (Supabase no responde)
  // o loadStats cuelga sin lanzar excepción.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoadingData(prev => {
        if (prev) {
          console.error('[Dashboard] timeout 8s: auth o queries no resolvieron.');
          setDataError(true);
          setErrorMsg('La conexión tardó demasiado. Verifica tu red y recarga la página.');
          return false;
        }
        return prev;
      });
    }, 8_000);
    return () => clearTimeout(t);
  }, []); // solo al montar

  // ── loadStats — cada query individual en try-catch con logging ────────────
  const loadStats = useCallback(async () => {
    if (!user || !rol) return;

    const supabase = createClient();
    const esAdmin  = rol !== 'editor';
    const artista  = email; // editor filtra por artista (= email), igual que dashboard.js

    console.log(`[Dashboard] loadStats iniciado — rol: ${rol}, esAdmin: ${esAdmin}`);
    const t0 = performance.now();

    // ── Construir queries base ─────────────────────────────────────────────────
    // Columnas verificadas: obras(id,titulo,artista,año,estado,created_at,updated_at,motivo_reapertura)
    let obrasCountQ = supabase.from('obras').select('*', { count: 'exact', head: true });
    let obrasListQ  = supabase
      .from('obras')
      .select('id, titulo, artista, año, estado, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (rol === 'editor' && artista) {
      obrasCountQ = obrasCountQ.eq('artista', artista);
      obrasListQ  = obrasListQ.eq('artista', artista);
    }

    // Corte temporal para obras estancadas (> 7 días sin actividad)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ── Wrappear cada query en try-catch individual ─────────────────────────
    // Si una falla se registra el error y continúa con las demás.
    async function safeQuery(label, queryPromise) {
      try {
        const result = await queryPromise;
        if (result.error) {
          console.error(`[Dashboard] Query "${label}" devolvió error:`, result.error);
        }
        return result;
      } catch (err) {
        console.error(`[Dashboard] Query "${label}" lanzó excepción:`, err);
        return { data: null, count: null, error: err };
      }
    }

    // ── Ejecutar las 10 queries en paralelo con Promise.allSettled ────────────
    // allSettled nunca cancela las demás si una falla.
    const [
      r_obras,
      r_tecnicas,
      r_tags,
      r_usuarios,
      r_recientes,
      r_pendientes,
      r_conCambios,
      r_regPendientes,
      r_estancadas,
      r_topVisitas,
    ] = await Promise.allSettled([
      /* 1 */ safeQuery('obras count',
        obrasCountQ
      ),
      /* 2 */ safeQuery('tecnicas count',
        supabase.from('tecnicas').select('*', { count: 'exact', head: true })
      ),
      /* 3 */ safeQuery('tags count',
        supabase.from('tags').select('*', { count: 'exact', head: true })
      ),
      /* 4 */ safeQuery('usuarios_admin count',
        supabase.from('usuarios_admin').select('*', { count: 'exact', head: true })
      ),
      /* 5 */ safeQuery('obras recientes',
        obrasListQ
      ),
      /* 6 */ esAdmin
        ? safeQuery('pendientes revision',
            supabase.from('obras').select('*', { count: 'exact', head: true }).eq('estado', 'En Revisión')
          )
        : Promise.resolve({ count: 0, data: null, error: null }),
      /* 7 */ esAdmin
        ? safeQuery('con cambios (reaperturas)',
            supabase
              .from('obras')
              .select('*', { count: 'exact', head: true })
              .eq('estado', 'En Revisión')
              .not('motivo_reapertura', 'is', null)
          )
        : Promise.resolve({ count: 0, data: null, error: null }),
      /* 8 */ esAdmin
        ? safeQuery('registro_alumnos pendientes',
            supabase
              .from('registro_alumnos')
              .select('*', { count: 'exact', head: true })
              .eq('estado', 'pendiente_validacion')
          )
        : Promise.resolve({ count: 0, data: null, error: null }),
      /* 9 */ esAdmin
        ? safeQuery('obras estancadas',
            supabase
              .from('obras')
              .select('*', { count: 'exact', head: true })
              .eq('estado', 'En Revisión')
              .lt('updated_at', sevenDaysAgo)
          )
        : Promise.resolve({ count: 0, data: null, error: null }),
      /* 10 */ esAdmin
        ? safeQuery('top visitas mes',
            supabase.rpc('get_top_obras_visitas_mes', { p_limit: 10 })
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    // ── Timing warning ────────────────────────────────────────────────────────
    const elapsed = performance.now() - t0;
    if (elapsed > 3_000) {
      console.warn(`[Dashboard] loadStats tardó más de 3s (${elapsed.toFixed(0)}ms)`);
    } else {
      console.log(`[Dashboard] loadStats completado en ${elapsed.toFixed(0)}ms`);
    }

    // ── Extraer valores de los settled results ────────────────────────────────
    const v_obras        = settled(r_obras,        'obras count');
    const v_tecnicas     = settled(r_tecnicas,     'tecnicas count');
    const v_tags         = settled(r_tags,         'tags count');
    const v_usuarios     = settled(r_usuarios,     'usuarios_admin count');
    const v_recientes    = settled(r_recientes,    'obras recientes');
    const v_pendientes   = settled(r_pendientes,   'pendientes revision');
    const v_conCambios   = settled(r_conCambios,   'con cambios');
    const v_regPend      = settled(r_regPendientes,'registro_alumnos pendientes');
    const v_estancadas   = settled(r_estancadas,   'obras estancadas');
    const v_topVisitas   = settled(r_topVisitas,   'top visitas mes');

    const newStats = {
      obras:         v_obras?.count         ?? 0,
      tecnicas:      v_tecnicas?.count      ?? 0,
      tags:          v_tags?.count          ?? 0,
      usuarios:      v_usuarios?.count      ?? 0,
      recientes:     v_recientes?.data      ?? [],
      pendientes:    v_pendientes?.count    ?? 0,
      conCambios:    v_conCambios?.count    ?? 0,
      regPendientes: v_regPend?.count       ?? 0,
      estancadas:    v_estancadas?.count    ?? 0,
      topVisitas:    v_topVisitas?.data     ?? [],
      esAdmin,
    };

    // ── Warn si algún campo quedó undefined/null (query falló) ───────────────
    const camposNulos = Object.entries(newStats)
      .filter(([k, v]) => v === null || v === undefined)
      .map(([k]) => k);
    if (camposNulos.length > 0) {
      console.warn('[Dashboard] Stats incompleto — campos nulos:', camposNulos, newStats);
    }

    setStats(newStats);
    setDataError(false);
    setLoadingData(false);

  }, [user, rol, email]);

  // ── Carga inicial + auto-refresh 30 s ────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user) return;
    loadStats();
    intervalRef.current = setInterval(loadStats, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authLoading, user, loadStats]);

  // ── Render: estado de error (incluye timeout) ─────────────────────────────
  // Mostrar el error AUNQUE authLoading siga true (timeout cubrió eso)
  if (dataError) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h2>Dashboard</h2>
            <p>Resumen del catálogo</p>
          </div>
        </div>
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '16px 20px',
            color: 'var(--color-error, #EF4444)',
            marginBottom: 24,
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div>
            <strong>Error cargando estadísticas.</strong>
            <br />
            <span style={{ fontSize: 13, opacity: 0.85 }}>
              {errorMsg || 'Intenta recargar la página. Si el problema persiste, verifica tu conexión.'}
            </span>
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => {
            setDataError(false);
            setErrorMsg('');
            setLoadingData(true);
            loadStats();
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Render: cargando ──────────────────────────────────────────────────────
  if (authLoading || loadingData) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h2>Dashboard</h2>
            <p>Resumen del catálogo</p>
          </div>
        </div>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando estadísticas…</p>
      </div>
    );
  }

  if (!user) return null; // layout server-side ya redirige — fallback defensivo

  const {
    obras, tecnicas, tags, usuarios,
    recientes, pendientes, conCambios, regPendientes,
    estancadas, topVisitas, esAdmin,
  } = stats;

  return (
    <div>

      {/* ── Section header — idéntico al VanillaJS ──────────────────────── */}
      <div className="section-header">
        <div>
          <h2>Dashboard</h2>
          <p>Resumen del catálogo</p>
        </div>
        {tienePermiso('obras.crear') && (
          <button
            className="btn btn-primary"
            id="dashboardQuickNewObra"
            type="button"
            onClick={() => router.push('/admin/obras?nueva=1')}
          >
            <Plus size={16} aria-hidden="true" /> Nueva Obra
          </button>
        )}
      </div>

      {/* ── Stats Grid ───────────────────────────────────────────────────── */}
      <div className="stats-grid">

        {/* 1. Obras Totales — siempre visible */}
        <div className="stat-card">
          <div className="stat-value" id="totalObras">{obras}</div>
          <div className="stat-label">Obras Totales</div>
        </div>

        {/* 2. Pendientes de Revisión — admin/super_editor */}
        {esAdmin && (
          <div
            className="stat-card stat-card--warning"
            id="cardPendientesRevision"
            role="button"
            tabIndex={0}
            title="Ver obras pendientes de revisión"
            onClick={() => router.push('/admin/obras?estado=En+Revisi%C3%B3n')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/admin/obras?estado=En+Revisi%C3%B3n');
              }
            }}
          >
            <div className="stat-value" id="totalPendientes">{pendientes}</div>
            <div className="stat-label">Pendientes de Revisión</div>
            {conCambios > 0 && (
              <div className="stat-detail" id="pendientesConCambios">
                {conCambios} con cambios sobre obra publicada
              </div>
            )}
          </div>
        )}

        {/* 3. Técnicas — siempre visible */}
        <div className="stat-card">
          <div className="stat-value" id="totalTecnicas">{tecnicas}</div>
          <div className="stat-label">Técnicas</div>
        </div>

        {/* 4. Tags — siempre visible */}
        <div className="stat-card">
          <div className="stat-value" id="totalTags">{tags}</div>
          <div className="stat-label">Tags</div>
        </div>

        {/* 5. Usuarios Admin — siempre visible */}
        <div className="stat-card">
          <div className="stat-value" id="totalUsuarios">{usuarios}</div>
          <div className="stat-label">Usuarios Admin</div>
        </div>

        {/* 6. Registros Pendientes — admin/super_editor */}
        {esAdmin && (
          <div
            className="stat-card stat-card--warning"
            id="cardRegistrosPendientes"
            role="button"
            tabIndex={0}
            title="Ver registros pendientes de validación"
            onClick={() => router.push('/admin/registros-pendientes')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/admin/registros-pendientes');
              }
            }}
          >
            <div className="stat-value" id="totalRegistrosPendientes">{regPendientes}</div>
            <div className="stat-label">Registros Pendientes</div>
            <div className="stat-card-action">Ver registros →</div>
          </div>
        )}

        {/* 7. Obras estancadas — admin/super_editor Y solo si count > 0 */}
        {esAdmin && estancadas > 0 && (
          <div
            className="stat-card stat-card--stale"
            id="cardObrasEstancadas"
            role="button"
            tabIndex={0}
            title="Obras en revisión sin decisión por más de 7 días"
            onClick={() => router.push('/admin/obras?estado=En+Revisi%C3%B3n')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/admin/obras?estado=En+Revisi%C3%B3n');
              }
            }}
          >
            <div className="stat-card__icon" aria-hidden="true">
              <Clock size={20} />
            </div>
            <div className="stat-value" id="totalObrasEstancadas">{estancadas}</div>
            <div className="stat-label">obras llevan más de 7 días sin revisión</div>
            <div className="stat-card-action">Revisar ahora →</div>
          </div>
        )}
      </div>

      {/* ── Últimas Obras — idéntico al VanillaJS (va ANTES de top visitas) ─ */}
      <div className="recent-section">
        <h3>Últimas Obras</h3>
        <div className="table-wrapper">
          <table className="recent-table" aria-label="Tabla de últimas obras">
            <thead>
              <tr>
                <th>Título</th>
                <th>Artista</th>
                <th>Año</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody id="recentObrasList">
              {recientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No hay obras registradas aún.
                  </td>
                </tr>
              ) : (
                recientes.map(obra => (
                  <tr key={obra.id}>
                    <td>{obra.titulo || '—'}</td>
                    <td>{obra.artista || '—'}</td>
                    <td>{obra.año ?? '—'}</td>
                    <td>
                      <span className={`badge ${BADGE_CLS[obra.estado] || 'badge-borrador'}`}>
                        {obra.estado}
                      </span>
                    </td>
                    <td>{formatFecha(obra.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Top Visitas — solo admin/super_editor y solo si hay datos ─────── */}
      {esAdmin && topVisitas.length > 0 && (
        <div className="recent-section" id="topVisitasSection">
          <h3>
            <TrendingUp size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true" />
            Obras más visitadas este mes
          </h3>
          <ol className="top-visitas-list" id="topVisitasList" aria-label="Ranking de obras más visitadas del mes">
            {topVisitas.map((row, i) => (
              <li key={row.obra_id ?? i} className="top-visitas-item">
                <span className={`top-visitas-rank${i === 0 ? ' top-visitas-rank--gold' : ''}`}>
                  {i + 1}
                </span>
                <span className="top-visitas-info">
                  <span className="top-visitas-title">{escHtml(row.titulo)}</span>
                  <span className="top-visitas-artist">{escHtml(row.artista)}</span>
                </span>
                <span className="top-visitas-stats">
                  <span className="top-visitas-stat" title="Visitas este mes">
                    <Eye size={12} aria-hidden="true" />
                    {row.visitas}
                  </span>
                  <span className="top-visitas-stat top-visitas-stat--fav" title="Corazones totales">
                    <Heart size={12} aria-hidden="true" />
                    {row.favoritos ?? 0}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="top-visitas-footer">
            <a href="/admin/estadisticas" className="btn btn-secondary btn-sm">
              <BarChart2 size={14} aria-hidden="true" />
              Ver historial completo
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
