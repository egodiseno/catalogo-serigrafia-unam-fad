'use client';

/**
 * app/(admin)/admin/page.jsx — /admin (Dashboard)
 *
 * Client Component. Replica exactamente dashboard.js del VanillaJS:
 * - Carga datos en paralelo con Promise.all
 * - Visibilidad condicional por rol (editores no ven pendientes, top visitas, estancadas)
 * - Auto-refresh cada 30 segundos
 * - La tarjeta de obras estancadas solo aparece cuando count > 0
 * - Clic en estancadas navega a /admin/obras?estado=En+Revisión
 *
 * Clases usadas — SOLO selectores reales de styles/admin.css:
 *   .dashboard-container, .stat-card, .stat-card--warning, .stat-card--stale,
 *   .stat-card-action, .stat-value, .stat-label, .stat-detail,
 *   .recent-section, table.recent-table,
 *   .top-visitas-list, .top-visitas-item, .top-visitas-rank, .top-visitas-rank--gold,
 *   .top-visitas-info, .top-visitas-title, .top-visitas-artist,
 *   .top-visitas-stats, .top-visitas-stat, .top-visitas-stat--fav, .top-visitas-footer
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Image, Brush, Tag, Users, Clock, UserCheck,
  AlertTriangle, Eye, Heart, TrendingUp,
} from 'lucide-react';

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

// Mapa estado → clase badge (igual que en dashboard.js)
const BADGE_CLS = {
  'Publicado':   'badge-publicado',
  'Borrador':    'badge-borrador',
  'En Revisión': 'badge-revision',
  'Archivado':   'badge-archivado',
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user, rol, email, authId, loading: authLoading } = useAuth();

  const [stats, setStats] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState(false);

  const intervalRef = useRef(null);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!user || !rol) return;

    const supabase = createClient();
    const esAdmin  = rol !== 'editor';
    // Editor filtra por artista (campo email, igual que dashboard.js)
    const artista  = email;

    try {
      // Queries base
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

      // Fecha hace 7 días (para obras estancadas)
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
        { count: obras        },
        { count: tecnicas     },
        { count: tags         },
        { count: usuarios     },
        { data:  recientes    },
        { count: pendientes   },
        { count: conCambios   },
        { count: regPendientes},
        { count: estancadas   },
        { data:  topVisitas   },
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
        obras:        obras        ?? 0,
        tecnicas:     tecnicas     ?? 0,
        tags:         tags         ?? 0,
        usuarios:     usuarios     ?? 0,
        recientes:    recientes    ?? [],
        pendientes:   pendientes   ?? 0,
        conCambios:   conCambios   ?? 0,
        regPendientes:regPendientes?? 0,
        estancadas:   estancadas   ?? 0,
        topVisitas:   topVisitas   ?? [],
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

  // Carga inicial + auto-refresh 30s (replica el setInterval de dashboard.js)
  useEffect(() => {
    if (authLoading || !user) return;
    loadStats();

    intervalRef.current = setInterval(loadStats, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authLoading, user, loadStats]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading || loadingData) {
    return (
      <div className="dashboard-container" style={{ padding: 32 }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando…</p>
      </div>
    );
  }

  if (!user) return null; // layout redirige si no hay sesión

  if (dataError) {
    return (
      <div className="dashboard-container" style={{ padding: 32 }}>
        <p style={{ color: 'var(--color-error)' }}>Error al cargar datos del dashboard.</p>
        <button className="btn btn-secondary btn-sm" onClick={loadStats}>
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
    <div className="dashboard-container">

      {/* ── Tarjetas de estadísticas base ───────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Obras */}
        <div className="stat-card" role="region" aria-label="Total de obras">
          <div className="stat-card__icon"><Image size={22} aria-hidden="true" /></div>
          <div className="stat-value" id="totalObras">{obras}</div>
          <div className="stat-label">{rol === 'editor' ? 'Mis Obras' : 'Total Obras'}</div>
        </div>

        {/* Total Técnicas */}
        <div className="stat-card" role="region" aria-label="Total de técnicas">
          <div className="stat-card__icon"><Brush size={22} aria-hidden="true" /></div>
          <div className="stat-value" id="totalTecnicas">{tecnicas}</div>
          <div className="stat-label">Técnicas</div>
        </div>

        {/* Total Tags */}
        <div className="stat-card" role="region" aria-label="Total de tags">
          <div className="stat-card__icon"><Tag size={22} aria-hidden="true" /></div>
          <div className="stat-value" id="totalTags">{tags}</div>
          <div className="stat-label">Tags</div>
        </div>

        {/* Total Usuarios */}
        <div className="stat-card" role="region" aria-label="Total de usuarios">
          <div className="stat-card__icon"><Users size={22} aria-hidden="true" /></div>
          <div className="stat-value" id="totalUsuarios">{usuarios}</div>
          <div className="stat-label">Usuarios</div>
        </div>

        {/* Pendientes de Revisión — solo admin/super_editor */}
        {esAdmin && (
          <div
            id="cardPendientesRevision"
            className="stat-card stat-card--warning"
            role="button"
            tabIndex={0}
            aria-label={`${pendientes} obras pendientes de revisión`}
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/admin/obras?estado=En+Revisi%C3%B3n')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/admin/obras?estado=En+Revisi%C3%B3n'); } }}
          >
            <div className="stat-card__icon"><Clock size={22} aria-hidden="true" /></div>
            <div className="stat-value" id="totalPendientes">{pendientes}</div>
            <div className="stat-label">Pendientes de Revisión</div>
            {conCambios > 0 && (
              <div className="stat-detail" id="pendientesConCambios" style={{ display: '' }}>
                {conCambios} con cambios sobre obra publicada
              </div>
            )}
            <div className="stat-card-action">Ver obras →</div>
          </div>
        )}

        {/* Registros Pendientes — solo admin/super_editor */}
        {esAdmin && (
          <div
            id="cardRegistrosPendientes"
            className="stat-card stat-card--warning"
            role="button"
            tabIndex={0}
            aria-label={`${regPendientes} registros pendientes de validación`}
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/admin/registros-pendientes')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/admin/registros-pendientes'); } }}
          >
            <div className="stat-card__icon"><UserCheck size={22} aria-hidden="true" /></div>
            <div className="stat-value" id="totalRegistrosPendientes">{regPendientes}</div>
            <div className="stat-label">Registros Pendientes</div>
            <div className="stat-card-action">Validar →</div>
          </div>
        )}

        {/* Obras Estancadas — solo admin/super_editor Y solo cuando count > 0 */}
        {esAdmin && estancadas > 0 && (
          <div
            id="cardObrasEstancadas"
            className="stat-card stat-card--stale"
            role="button"
            tabIndex={0}
            aria-label={`${estancadas} obras estancadas en revisión`}
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/admin/obras?estado=En+Revisi%C3%B3n')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/admin/obras?estado=En+Revisi%C3%B3n'); } }}
          >
            <div className="stat-card__icon"><AlertTriangle size={22} aria-hidden="true" /></div>
            <div className="stat-value" id="totalObrasEstancadas">{estancadas}</div>
            <div className="stat-label">En Revisión &gt; 7 días</div>
            <div className="stat-card-action">Revisar →</div>
          </div>
        )}
      </div>

      {/* ── Obras más visitadas del mes — solo admin/super_editor ─────────── */}
      {esAdmin && topVisitas.length > 0 && (
        <section
          id="topVisitasSection"
          className="recent-section"
          aria-label="Obras más visitadas este mes"
          style={{ marginBottom: 24 }}
        >
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} aria-hidden="true" />
            Obras más visitadas este mes
          </h3>
          <ol className="top-visitas-list" id="topVisitasList">
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
              <TrendingUp size={14} aria-hidden="true" />
              Ver historial completo
            </a>
          </div>
        </section>
      )}

      {/* ── Últimas obras ────────────────────────────────────────────────── */}
      <section
        className="recent-section"
        aria-label={rol === 'editor' ? 'Mis últimas obras' : 'Últimas obras registradas'}
      >
        <h3>{rol === 'editor' ? 'Mis últimas obras' : 'Últimas obras'}</h3>
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
      </section>
    </div>
  );
}
