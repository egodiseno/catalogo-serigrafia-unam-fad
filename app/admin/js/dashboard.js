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

      const [
        { count: obras     },
        { count: tecnicas  },
        { count: tags      },
        { count: usuarios  },
        { data: recientes  },
      ] = await Promise.all([
        obrasCountQ,
        client.from('tecnicas').select('*',        { count: 'exact', head: true }),
        client.from('tags').select('*',            { count: 'exact', head: true }),
        client.from('usuarios_admin').select('*',  { count: 'exact', head: true }),
        obrasListQ,
      ]);

      // Stat cards
      elObras.textContent    = obras    ?? 0;
      elTecnicas.textContent = tecnicas ?? 0;
      elTags.textContent     = tags     ?? 0;
      elUsuarios.textContent = usuarios ?? 0;

      // Tabla de últimas obras
      renderRecientes(recientes ?? []);

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

  // ── Recarga al volver al Dashboard desde otra sección ─
  const dashboardNavBtn = document.querySelector('[data-section="dashboard"]');
  if (dashboardNavBtn) {
    dashboardNavBtn.addEventListener('click', loadStats);
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
