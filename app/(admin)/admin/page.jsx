'use client';

/**
 * app/(admin)/admin/page.jsx — /admin (Dashboard)
 *
 * Auth obtenida directamente con supabase.auth.getUser() dentro de loadStats()
 * — sin useAuth(), sin instancia GoTrueClient duplicada, sin estado authLoading.
 *
 * Flujo:
 *   montar → loadStats() → getUser() → usuarios_admin lookup → 10 queries
 *   Si getUser() falla → error inmediato (no espera timeout)
 *   Auto-refresh cada 30 s
 *
 * Layout (en este orden exacto, replicando VanillaJS dashboard.js):
 *   1. .section-header  → h2 "Dashboard" + p "Resumen del catálogo" + botón "+ Nueva Obra"
 *   2. .stats-grid      → 6 tarjetas: Obras Totales, Pendientes Revisión*, Técnicas,
 *                         Tags, Usuarios Admin, Registros Pendientes*   (* admin/super_editor)
 *   3. .stat-card--stale → obras sin revisión >7 días (solo admin, solo si count > 0)
 *   4. .grid.grid-2     → dos columnas: izq = Top Visitas*, der = Últimas Obras
 *                         (* si no hay top visitas data → Últimas Obras ocupa el ancho completo)
 *
 * Columnas verificadas contra supabase/migrations/:
 *   obras:            id, titulo, artista, año, estado, created_at, updated_at, motivo_reapertura
 *   tecnicas/tags:    count(*)
 *   usuarios_admin:   rol, nombre, email, estado
 *   registro_alumnos: estado ('pendiente_validacion' | 'activo' | 'rechazado')
 *   RPC:              get_top_obras_visitas_mes(p_limit INT) → obra_id, titulo, artista, visitas, favoritos
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermisos } from '@/hooks/usePermisos';
import { Plus, Clock, Eye, Heart, TrendingUp, BarChart2, AlertCircle } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const BADGE_CLS = {
  'Publicado':   'badge-publicado',
  'Borrador':    'badge-borrador',
  'En Revisión': 'badge-revision',
  'Archivado':   'badge-archivado',
};

// Extrae el valor de un settled result; null + log si fue rejected.
function settled(result, label) {
  if (result.status === 'fulfilled') return result.value;
  console.error(`[Dashboard] Query "${label}" falló:`, result.reason);
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();

  // currentUser almacena { id, email, rol, nombre } tras getUser() + lookup
  const [currentUser, setCurrentUser] = useState(null);

  // usePermisos depende de currentUser.rol; mientras null retorna false para todo
  const { tienePermiso } = usePermisos(currentUser?.rol ?? null);

  const [mounted,     setMounted]     = useState(false);
  const [stats,       setStats]       = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError,   setDataError]   = useState(false);
  const [errorMsg,    setErrorMsg]    = useState('');
  const intervalRef                   = useRef(null);

  // ── Timeout de seguridad: 8 s máximo incluyendo la llamada getUser() ────────
  // Solo necesario si loadStats() se cuelga sin lanzar excepción.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoadingData(prev => {
        if (prev) {
          console.error('[Dashboard] timeout 8s: getUser() o queries no resolvieron');
          setDataError(true);
          setErrorMsg('La conexión tardó demasiado. Verifica tu red y recarga la página.');
          return false;
        }
        return prev;
      });
    }, 8_000);
    return () => clearTimeout(t);
  }, []);

  // ── Hidratación: evitar flash de contenido parcial antes de montar ────────
  useEffect(() => { setMounted(true); }, []);

  // ── loadStats — self-contained: obtiene auth aquí mismo ──────────────────
  const loadStats = useCallback(async () => {
    const supabase = createClient();

    // ── 1. getUser() — sin sesión → error inmediato ──────────────────────────
    let authUser;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        console.error('[Dashboard] getUser() sin sesión o con error:', error);
        setDataError(true);
        setErrorMsg('No hay sesión activa. Inicia sesión nuevamente.');
        setLoadingData(false);
        return;
      }
      authUser = data.user;
    } catch (err) {
      console.error('[Dashboard] getUser() lanzó excepción:', err);
      setDataError(true);
      setErrorMsg('Error de conexión al verificar sesión. Verifica tu red.');
      setLoadingData(false);
      return;
    }

    // ── 2. Lookup en usuarios_admin → obtener rol ────────────────────────────
    let rol, editorId, esAdmin;
    try {
      const { data: adminUser, error: adminError } = await supabase
        .from('usuarios_admin')
        .select('rol, nombre, email')
        .eq('email', authUser.email)
        .single();

      if (adminError || !adminUser) {
        console.error('[Dashboard] usuarios_admin lookup falló:', adminError);
        setDataError(true);
        setErrorMsg('Usuario no encontrado en el sistema. Contacta al administrador.');
        setLoadingData(false);
        return;
      }

      rol      = adminUser.rol;
      editorId = authUser.id;  // obras.editor_id = auth.users.id (columna FK verificada en migrations)
      esAdmin  = rol !== 'editor';

      // Editor → redirigir inmediatamente a mi-portafolio (no mostrar el dashboard)
      if (rol === 'editor') {
        router.push('/admin/mi-portafolio');
        return;
      }

      // Actualizar currentUser para usePermisos (puede diferir entre refreshes si el rol cambia)
      setCurrentUser({
        id:     authUser.id,
        email:  adminUser.email,
        rol:    adminUser.rol,
        nombre: adminUser.nombre,
      });
    } catch (err) {
      console.error('[Dashboard] usuarios_admin lookup lanzó excepción:', err);
      setDataError(true);
      setErrorMsg('Error obteniendo permisos del usuario.');
      setLoadingData(false);
      return;
    }

    // ── 3. Queries de estadísticas (10 en paralelo) ──────────────────────────
    console.log(`[Dashboard] loadStats iniciado — rol: ${rol}, esAdmin: ${esAdmin}, authUser.id: ${authUser.id}`);
    const t0 = performance.now();

    // Construir queries filtradas por rol.
    // Admin/super_editor: SIN filtro → cuentan TODAS las obras (sin restricción).
    // Editor: filtrar por editor_id (UUID de auth.users — columna verificada en migrations).
    let obrasCountQ = supabase.from('obras').select('*', { count: 'exact', head: true });
    let obrasListQ  = supabase
      .from('obras')
      .select('id, titulo, artista, año, estado, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (rol === 'editor' && editorId) {
      obrasCountQ = obrasCountQ.eq('editor_id', editorId);
      obrasListQ  = obrasListQ.eq('editor_id', editorId);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Wrapper try-catch por query individual
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

    // Promise.allSettled: una falla no cancela las demás
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
      /* 1 */ safeQuery('obras count',      obrasCountQ),
      /* 2 */ safeQuery('tecnicas count',   supabase.from('tecnicas').select('*', { count: 'exact', head: true })),
      /* 3 */ safeQuery('tags count',       supabase.from('tags').select('*', { count: 'exact', head: true })),
      /* 4 */ safeQuery('usuarios count',   supabase.from('usuarios_admin').select('*', { count: 'exact', head: true })),
      /* 5 */ safeQuery('obras recientes',  obrasListQ),
      /* 6 */ esAdmin
        ? safeQuery('pendientes revision',
            supabase.from('obras').select('*', { count: 'exact', head: true }).eq('estado', 'En Revisión')
          )
        : Promise.resolve({ count: 0, data: null, error: null }),
      /* 7 */ esAdmin
        ? safeQuery('con cambios',
            supabase
              .from('obras')
              .select('*', { count: 'exact', head: true })
              .eq('estado', 'En Revisión')
              .not('motivo_reapertura', 'is', null)
          )
        : Promise.resolve({ count: 0, data: null, error: null }),
      /* 8 */ esAdmin
        ? safeQuery('registros pendientes',
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

    // ── 4. Timing ────────────────────────────────────────────────────────────
    const elapsed = performance.now() - t0;
    if (elapsed > 3_000) {
      console.warn(`[Dashboard] loadStats tardó más de 3s (${elapsed.toFixed(0)}ms)`);
    } else {
      console.log(`[Dashboard] loadStats completado en ${elapsed.toFixed(0)}ms`);
    }

    // ── 5. Extraer valores ───────────────────────────────────────────────────
    const v_obras        = settled(r_obras,        'obras count');
    const v_tecnicas     = settled(r_tecnicas,     'tecnicas count');
    const v_tags         = settled(r_tags,         'tags count');
    const v_usuarios     = settled(r_usuarios,     'usuarios count');
    const v_recientes    = settled(r_recientes,    'obras recientes');
    const v_pendientes   = settled(r_pendientes,   'pendientes revision');
    const v_conCambios   = settled(r_conCambios,   'con cambios');
    const v_regPend      = settled(r_regPendientes,'registros pendientes');
    const v_estancadas   = settled(r_estancadas,   'obras estancadas');
    const v_topVisitas   = settled(r_topVisitas,   'top visitas mes');

    // ── 6. Diagnóstico explícito de obras count (ayuda a detectar RLS silencioso) ─
    // Si count=0 sin error: puede indicar tabla vacía o RLS bloqueando SELECT sin lanzar error.
    console.log('[Dashboard] obras count resultado:', {
      count: v_obras?.count,
      error: v_obras?.error ?? null,
      rol,
      filtro: rol === 'editor' ? `editor_id=${editorId}` : 'ninguno (admin ve todo)',
    });

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

    // ── 7. Warn si algún campo quedó nulo (query fallida) ───────────────────
    const camposNulos = Object.entries(newStats)
      .filter(([, v]) => v === null || v === undefined)
      .map(([k]) => k);
    if (camposNulos.length > 0) {
      console.warn('[Dashboard] Stats incompleto — campos nulos:', camposNulos, newStats);
    }

    setStats(newStats);
    setDataError(false);
    setLoadingData(false);
  }, [router]); // router es estable en Next.js 14; se incluye por correctitud

  // ── Carga inicial + auto-refresh 30 s ─────────────────────────────────────
  useEffect(() => {
    loadStats();
    intervalRef.current = setInterval(loadStats, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadStats]);

  // ── Render: sin hidratación → mismo skeleton que loadingData ─────────────
  if (!mounted) {
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

  // ── Render: error (timeout o fallo inmediato de auth) ─────────────────────
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

  // ── Render: cargando ───────────────────────────────────────────────────────
  if (loadingData) {
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

  if (!stats) return null; // fallback defensivo (no debería ocurrir)

  const {
    obras, tecnicas, tags, usuarios,
    recientes, pendientes, conCambios, regPendientes,
    estancadas, topVisitas, esAdmin,
  } = stats;

  // Columna "Últimas Obras" — reutilizada en ambas ramas del layout
  const ultimasObrasSection = (
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
  );

  return (
    <div>

      {/* ── 1. Section header ──────────────────────────────────────────────── */}
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

      {/* ── 2. Stats Grid — 6 tarjetas en una sola fila ────────────────────── */}
      <div className="stats-grid">

        {/* 1. Obras Totales */}
        <div className="stat-card">
          <div className="stat-value" id="totalObras">{obras}</div>
          <div className="stat-label">Obras Totales</div>
        </div>

        {/* 2. Pendientes de Revisión — admin/super_editor */}
        {esAdmin && (
          <div
            className={`stat-card${pendientes > 0 ? ' stat-card--warning' : ''}`}
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

        {/* 3. Técnicas */}
        <div className="stat-card">
          <div className="stat-value" id="totalTecnicas">{tecnicas}</div>
          <div className="stat-label">Técnicas</div>
        </div>

        {/* 4. Tags */}
        <div className="stat-card">
          <div className="stat-value" id="totalTags">{tags}</div>
          <div className="stat-label">Tags</div>
        </div>

        {/* 5. Usuarios Admin */}
        <div className="stat-card">
          <div className="stat-value" id="totalUsuarios">{usuarios}</div>
          <div className="stat-label">Usuarios Admin</div>
        </div>

        {/* 6. Registros Pendientes — admin/super_editor */}
        {esAdmin && (
          <div
            className={`stat-card${regPendientes > 0 ? ' stat-card--warning' : ''}`}
            id="cardRegistrosPendientes"
            role="button"
            tabIndex={0}
            title="Ver registros pendientes de validación"
            onClick={() => router.push('/admin/registros')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/admin/registros');
              }
            }}
          >
            <div className="stat-value" id="totalRegistrosPendientes">{regPendientes}</div>
            <div className="stat-label">Registros Pendientes</div>
            <div className="stat-card-action">Ver registros →</div>
          </div>
        )}

      </div>{/* /stats-grid */}

      {/* ── 3. Obras estancadas — fuera del stats-grid, solo admin, solo si > 0 ── */}
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
          style={{ marginBottom: 'var(--spacing-xl)' }}
        >
          <div className="stat-card__icon" aria-hidden="true">
            <Clock size={20} />
          </div>
          <div className="stat-value" id="totalObrasEstancadas">{estancadas}</div>
          <div className="stat-label">obras llevan más de 7 días sin revisión</div>
          <div className="stat-card-action">Revisar ahora →</div>
        </div>
      )}

      {/* ── 4. Dos columnas side-by-side: Top Visitas (izq) + Últimas Obras (der) ─
              Si no hay datos de top visitas (o es editor), Últimas Obras va full-width. */}
      {esAdmin && topVisitas.length > 0 ? (
        <div className="grid grid-2 gap-lg" style={{ alignItems: 'flex-start' }}>

          {/* Columna izquierda: Obras más visitadas este mes */}
          <div className="recent-section" id="topVisitasSection">
            <h3>
              <TrendingUp size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} aria-hidden="true" />
              Obras más visitadas este mes
            </h3>
            <ol
              className="top-visitas-list"
              id="topVisitasList"
              aria-label="Ranking de obras más visitadas del mes"
            >
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
                    <span className="top-visitas-stat top-visitas-stat--fav" title="Favoritos">
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

          {/* Columna derecha: Últimas Obras */}
          {ultimasObrasSection}

        </div>
      ) : (
        /* Sin datos de top visitas (o rol editor): Últimas Obras ocupa el ancho completo */
        ultimasObrasSection
      )}

    </div>
  );
}
