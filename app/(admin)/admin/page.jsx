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
 * Clases — SOLO selectores reales encontrados en styles/admin.css:
 *   .section-header, .stats-grid, .stat-card, .stat-card--warning, .stat-card--stale,
 *   .stat-card__icon, .stat-card-action, .stat-value, .stat-label, .stat-detail,
 *   .recent-section, .table-wrapper, table.recent-table,
 *   .top-visitas-list, .top-visitas-item, .top-visitas-rank, .top-visitas-rank--gold,
 *   .top-visitas-info, .top-visitas-title, .top-visitas-artist,
 *   .top-visitas-stats, .top-visitas-stat, .top-visitas-stat--fav, .top-visitas-footer
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermisos } from '@/hooks/usePermisos';
import { Plus, Clock, Eye, Heart, TrendingUp, BarChart2 } from 'lucide-react';

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

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user, rol, email, loading: authLoading } = useAuth();
  const { tienePermiso } = usePermisos(rol);

  const [stats, setStats]           = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError]   = useState(false);
  const intervalRef                 = useRef(null);

  // ── Carga de datos — replica exactamente loadStats() de dashboard.js ────────
  const loadStats = useCallback(async () => {
    if (!user || !rol) return;

    const supabase = createClient();
    const esAdmin  = rol !== 'editor';
    // Editor filtra por artista (campo email, idéntico a dashboard.js)
    const artista  = email;

    try {
      // Queries base — filtro por rol idéntico a dashboard.js
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

      // Fecha de corte: 7 días atrás (para obras estancadas)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Queries exclusivas de admin/super_editor
      const pendientesQ = esAdmin
        ? supabase.from('obras').select('*', { count: 'exact', head: true }).eq('estado', 'En Revisión')
        : Promise.resolve({ count: 0 });

      const conCambiosQ = esAdmin
        ? supabase
            .from('obras')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'En Revisión')
            .not('motivo_reapertura', 'is', null)
        : Promise.resolve({ count: 0 });

      const regPendientesQ = esAdmin
        ? supabase.from('registro_alumnos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente_validacion')
        : Promise.resolve({ count: 0 });

      const estancadasQ = esAdmin
        ? supabase
            .from('obras')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'En Revisión')
            .lt('updated_at', sevenDaysAgo)
        : Promise.resolve({ count: 0 });

      // Top 10 obras más visitadas del mes (solo admin/super_editor)
      const topVisitasQ = esAdmin
        ? supabase.rpc('get_top_obras_visitas_mes', { p_limit: 10 })
        : Promise.resolve({ data: [] });

      const [
        { count: obras         },
        { count: tecnicas      },
        { count: tags          },
        { count: usuarios      },
        { data:  recientes     },
        { count: pendientes    },
        { count: conCambios    },
        { count: regPendientes },
        { count: estancadas    },
        { data:  topVisitas    },
      ] = await Promise.all([
        obrasCountQ,
        supabase.from('tecnicas').select('*',       { count: 'exact', head: true }),
        supabase.from('tags').select('*',           { count: 'exact', head: true }),
        supabase.from('usuarios_admin').select('*', { count: 'exact', head: true }),
        obrasListQ,
        pendientesQ,
        conCambiosQ,
        regPendientesQ,
        estancadasQ,
        topVisitasQ,
      ]);

      setStats({
        obras:         obras         ?? 0,
        tecnicas:      tecnicas      ?? 0,
        tags:          tags          ?? 0,
        usuarios:      usuarios      ?? 0,
        recientes:     recientes     ?? [],
        pendientes:    pendientes    ?? 0,
        conCambios:    conCambios    ?? 0,
        regPendientes: regPendientes ?? 0,
        estancadas:    estancadas    ?? 0,
        topVisitas:    topVisitas    ?? [],
        esAdmin,
      });
      setDataError(false);
    } catch (err) {
      console.error('[Dashboard] loadStats error:', err);
      setDataError(true);
    } finally {
      setLoadingData(false);
    }
  }, [user, rol, email]);

  // ── Carga inicial + auto-refresh 30 s — replica _iniciarRefresh() de dashboard.js
  useEffect(() => {
    if (authLoading || !user) return;
    loadStats();
    intervalRef.current = setInterval(loadStats, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authLoading, user, loadStats]);

  // ── Render: estados de carga / error ─────────────────────────────────────
  if (authLoading || loadingData) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h2>Dashboard</h2>
            <p>Resumen del catálogo</p>
          </div>
        </div>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando…</p>
      </div>
    );
  }

  if (!user) return null; // layout redirige

  if (dataError) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h2>Dashboard</h2>
            <p>Resumen del catálogo</p>
          </div>
        </div>
        <p style={{ color: 'var(--color-error)' }}>Error al cargar datos del dashboard.</p>
        <button className="btn btn-secondary btn-sm" onClick={loadStats} type="button">
          Reintentar
        </button>
      </div>
    );
  }

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

      {/* ── Stats Grid — display: grid; repeat(auto-fit, minmax(200px,1fr)) ─ */}
      <div className="stats-grid">

        {/* 1. Obras Totales — siempre visible */}
        <div className="stat-card">
          <div className="stat-value" id="totalObras">{obras}</div>
          <div className="stat-label">Obras Totales</div>
        </div>

        {/* 2. Pendientes de Revisión — solo admin/super_editor */}
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
            {/* Desglose — solo si > 0 (replica pendientesConCambios de dashboard.js) */}
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

        {/* 6. Registros Pendientes — solo admin/super_editor */}
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

        {/* 7. Obras estancadas — admin/super_editor y SOLO si count > 0 */}
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

      {/* ── Últimas Obras PRIMERO (orden idéntico al VanillaJS) ─────────── */}
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

      {/* ── Top Visitas DESPUÉS — solo admin/super_editor y solo si hay datos ── */}
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
