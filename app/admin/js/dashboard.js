/**
 * dashboard.js — Métricas en tiempo real desde Supabase
 * Fase 1.C
 *
 * Depende de: config.js (window.supabase_client)
 * IDs DOM: totalObras, totalTecnicas, totalTags, totalUsuarios, recentObrasList
 */

document.addEventListener('DOMContentLoaded', () => {
  const client = window.supabase_client;

  // ── Referencias DOM ───────────────────────────────────
  const elObras     = document.getElementById('totalObras');
  const elTecnicas  = document.getElementById('totalTecnicas');
  const elTags      = document.getElementById('totalTags');
  const elUsuarios  = document.getElementById('totalUsuarios');
  const elRecientes = document.getElementById('recentObrasList');

  // Card Registros Pendientes (solo admin/super_editor)
  const cardRegPendientes = document.getElementById('cardRegistrosPendientes');
  const elRegPendientes   = document.getElementById('totalRegistrosPendientes');

  // Card Obras Estancadas — "En Revisión" sin actividad > 7 días (solo admin/super_editor)
  const cardEstancadas = document.getElementById('cardObrasEstancadas');
  const elEstancadas   = document.getElementById('totalObrasEstancadas');

  // Sección "Obras más visitadas este mes" (solo admin/super_editor)
  const topVisitasSection = document.getElementById('topVisitasSection');
  const topVisitasList    = document.getElementById('topVisitasList');

  // ── Carga de estadísticas ─────────────────────────────
  async function loadStats() {
    setLoading(true);

    try {
      // ── FILTRO POR ROL ──────────────────────────────────
      const rolActual   = window.usuarioActual?.rol || 'editor';
      const emailActual = window.usuarioActual?.email;

      let obrasCountQ = client.from('obras').select('*', { count: 'exact', head: true });
      let obrasListQ  = client.from('obras')
            .select('id, titulo, artista, año, estado, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

      if (rolActual === 'editor' && emailActual) {
        // EDITOR: solo ve sus propias obras (artista = su email)
        obrasCountQ = obrasCountQ.eq('artista', emailActual);
        obrasListQ  = obrasListQ.eq('artista', emailActual);
        console.log(`[Dashboard] EDITOR ${emailActual} — filtrando por artista`);
      }
      // ADMIN / SUPER_EDITOR: sin filtro adicional

      // Queries solo para ADMIN/SUPER_EDITOR
      const esAdmin     = rolActual !== 'editor';
      const pendientesQ = esAdmin
        ? client.from('obras').select('*', { count: 'exact', head: true }).eq('estado', 'En Revisión')
        : Promise.resolve({ count: 0 });
      // Desglose: cuántas de las obras En Revisión son reaperturas (tienen motivo_reapertura)
      const conCambiosQ = esAdmin
        ? client.from('obras')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'En Revisión')
            .not('motivo_reapertura', 'is', null)
        : Promise.resolve({ count: 0 });
      const regPendientesQ = esAdmin
        ? client.from('registro_alumnos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente_validacion')
        : Promise.resolve({ count: 0 });

      // Obras "En Revisión" con updated_at > 7 días atrás (sin actividad reciente)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const estancadasQ = esAdmin
        ? client.from('obras')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'En Revisión')
            .lt('updated_at', sevenDaysAgo)
        : Promise.resolve({ count: 0 });

      // Top 5 obras más visitadas del mes actual (solo admin/super_editor)
      const topVisitasQ = esAdmin
        ? client.rpc('get_top_obras_visitas_mes', { p_limit: 5 })
        : Promise.resolve({ data: [] });

      const [
        { count: obras         },
        { count: tecnicas      },
        { count: tags          },
        { count: usuarios      },
        { data: recientes      },
        { count: pendientes    },
        { count: conCambios    },
        { count: regPendientes },
        { count: estancadas    },
        { data: topVisitas     },
      ] = await Promise.all([
        obrasCountQ,
        client.from('tecnicas').select('*',        { count: 'exact', head: true }),
        client.from('tags').select('*',            { count: 'exact', head: true }),
        client.from('usuarios_admin').select('*',  { count: 'exact', head: true }),
        obrasListQ,
        pendientesQ,
        conCambiosQ,
        regPendientesQ,
        estancadasQ,
        topVisitasQ,
      ]);

      // Stat cards base
      elObras.textContent    = obras    ?? 0;
      elTecnicas.textContent = tecnicas ?? 0;
      elTags.textContent     = tags     ?? 0;
      elUsuarios.textContent = usuarios ?? 0;

      // Widget "Pendientes de Revisión" (obras) — solo ADMIN / SUPER_EDITOR
      if (esAdmin && cardPendientes) {
        cardPendientes.style.display = '';
        if (elPendientes) elPendientes.textContent = pendientes ?? 0;

        // Desglose: cuántas son reaperturas de obras ya publicadas
        const elDetalle = document.getElementById('pendientesConCambios');
        if (elDetalle) {
          const n = conCambios ?? 0;
          if (n > 0) {
            elDetalle.textContent = `${n} con cambios sobre obra publicada`;
            elDetalle.style.display = '';
          } else {
            elDetalle.style.display = 'none';
          }
        }
      } else if (cardPendientes) {
        cardPendientes.style.display = 'none';
      }

      // Widget "Registros Pendientes" (alumnos) — solo ADMIN / SUPER_EDITOR
      if (esAdmin && cardRegPendientes) {
        cardRegPendientes.style.display = '';
        if (elRegPendientes) elRegPendientes.textContent = regPendientes ?? 0;
      } else if (cardRegPendientes) {
        cardRegPendientes.style.display = 'none';
      }

      // Widget "Obras estancadas" — solo ADMIN / SUPER_EDITOR y solo si count > 0
      if (esAdmin && cardEstancadas) {
        const n = estancadas ?? 0;
        if (n > 0) {
          if (elEstancadas) elEstancadas.textContent = n;
          cardEstancadas.style.display = '';
        } else {
          cardEstancadas.style.display = 'none';
        }
      } else if (cardEstancadas) {
        cardEstancadas.style.display = 'none';
      }

      // Tabla de últimas obras
      renderRecientes(recientes ?? []);

      // Top 5 obras más visitadas — solo admin/super_editor
      if (esAdmin && topVisitasSection) {
        const tv = topVisitas ?? [];
        if (tv.length > 0) {
          topVisitasSection.style.display = '';
          renderTopVisitas(tv);
        } else {
          topVisitasSection.style.display = 'none';
        }
      } else if (topVisitasSection) {
        topVisitasSection.style.display = 'none';
      }

    } catch (err) {
      console.error('dashboard loadStats:', err);
      renderError();
    } finally {
      setLoading(false);
    }
  }

  // Mapa estado (Title Case desde Supabase) → clase CSS badge
  const BADGE_CLS = {
    'Publicado':   'badge-publicado',
    'Borrador':    'badge-borrador',
    'En Revisión': 'badge-revision',
    'Archivado':   'badge-archivado',
  };

  // ── Widget "Pendientes de Revisión" (obras) ──────────
  const cardPendientes  = document.getElementById('cardPendientesRevision');
  const elPendientes    = document.getElementById('totalPendientes');

  // Click → navegar a Obras y filtrar por "En Revisión"
  if (cardPendientes) {
    cardPendientes.addEventListener('click', () => {
      window.showSection?.('obras');
      setTimeout(() => {
        const filterEstado = document.getElementById('filterEstado');
        if (filterEstado) {
          filterEstado.value = 'En Revisión';
          filterEstado.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 300);
    });
    cardPendientes.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardPendientes.click(); }
    });
  }

  // ── Widget "Registros Pendientes" (alumnos) ───────────
  if (cardRegPendientes) {
    cardRegPendientes.addEventListener('click', () => {
      window.showSection?.('registros-pendientes');
    });
    cardRegPendientes.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardRegPendientes.click(); }
    });
  }

  // ── Widget "Obras estancadas" ──────────────────────────
  // Clic → sección Obras + filtro "En Revisión" (igual que cardPendientesRevision)
  if (cardEstancadas) {
    cardEstancadas.addEventListener('click', () => {
      window.showSection?.('obras');
      setTimeout(() => {
        const filterEstado = document.getElementById('filterEstado');
        if (filterEstado) {
          filterEstado.value = 'En Revisión';
          filterEstado.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 300);
    });
    cardEstancadas.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardEstancadas.click(); }
    });
  }

  // ── Render tabla ──────────────────────────────────────
  function renderRecientes(obras) {
    if (!elRecientes) return;

    if (obras.length === 0) {
      elRecientes.innerHTML =
        '<tr><td colspan="5" class="empty-state">No hay obras registradas aún.</td></tr>';
      return;
    }

    elRecientes.innerHTML = obras.map(obra => {
      const fecha = obra.created_at
        ? new Date(obra.created_at).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric'
          })
        : '—';
      const badgeCls = BADGE_CLS[obra.estado] || 'badge-borrador';

      return `
        <tr>
          <td>${escHtml(obra.titulo)}</td>
          <td>${escHtml(obra.artista)}</td>
          <td>${obra.año ?? '—'}</td>
          <td><span class="badge ${badgeCls}">${escHtml(obra.estado)}</span></td>
          <td>${fecha}</td>
        </tr>`;
    }).join('');
  }

  function renderTopVisitas(rows) {
    if (!topVisitasList) return;
    topVisitasList.innerHTML = rows.map((row, i) => `
      <li class="top-visitas-item">
        <span class="top-visitas-rank">${i + 1}</span>
        <span class="top-visitas-info">
          <span class="top-visitas-title">${escHtml(row.titulo)}</span>
          <span class="top-visitas-artist">${escHtml(row.artista)}</span>
        </span>
        <span class="top-visitas-count">${row.visitas} visita${row.visitas !== 1 ? 's' : ''}</span>
      </li>`).join('');
  }

  function renderError() {
    if (elRecientes) {
      elRecientes.innerHTML =
        '<tr><td colspan="5" class="empty-state">Error al cargar datos.</td></tr>';
    }
    [elObras, elTecnicas, elTags, elUsuarios].forEach(el => {
      if (el) el.textContent = '—';
    });
  }

  function setLoading(on) {
    if (!elRecientes) return;
    if (on) {
      elRecientes.innerHTML =
        '<tr><td colspan="5" class="empty-state">Cargando…</td></tr>';
    }
  }

  /** Escapa HTML para evitar XSS en datos del servidor */
  function escHtml(str) {
    if (!str) return '—';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── NTH-04: Botón "Nueva Obra" de acceso rápido ───────
  const quickNewObraBtn = document.getElementById('dashboardQuickNewObra');
  if (quickNewObraBtn) {
    quickNewObraBtn.addEventListener('click', () => {
      // Navegar a la sección Obras
      const obrasTab = document.querySelector('[data-section="obras"]');
      if (obrasTab) obrasTab.click();
      // Abrir el formulario de nueva obra (espera a que la sección sea visible)
      setTimeout(() => window.obrasForm?.open?.(), 200);
    });
  }

  // ── Carga inicial ─────────────────────────────────────
  loadStats();

  // ── Auto-refresh 30 s — solo cuando el dashboard está visible ─
  let _dashboardRefreshId = null;

  function _iniciarRefresh() {
    if (_dashboardRefreshId) return;
    _dashboardRefreshId = setInterval(() => {
      const dashSection = document.getElementById('dashboardSection');
      if (dashSection && !dashSection.classList.contains('hidden') &&
          dashSection.style.display !== 'none') {
        loadStats();
      }
    }, 30_000);
  }

  _iniciarRefresh();

  // Reiniciar el intervalo al navegar al dashboard
  const dashboardNavBtn = document.querySelector('[data-section="dashboard"]');
  if (dashboardNavBtn) {
    dashboardNavBtn.addEventListener('click', loadStats);
  }

  // ── Exponer API para recarga desde auth.js tras login/logout ──
  window.dashboardManager = {
    loadStats,
    limpiar() {
      if (elRecientes) {
        elRecientes.innerHTML =
          '<tr><td colspan="5" class="empty-state">—</td></tr>';
      }
      [elObras, elTecnicas, elTags, elUsuarios].forEach(el => {
        if (el) el.textContent = '—';
      });
    }
  };

  console.log('📊 dashboard.js cargado');
});
