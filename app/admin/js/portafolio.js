/**
 * portafolio.js — Mi Portafolio (solo EDITOR)
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Muestra las obras del editor activo filtradas por `artista = usuario.nombre`.
 * Incluye tarjetas de estadísticas (total, publicadas, borradores, revisión)
 * y tabla con búsqueda por título.
 *
 * Depende de: config.js (window.supabase_client), permisos.js, error-handler.js
 * Expone:     window.portafolioManager
 */

class PortafolioManager {
  constructor() {
    this._client        = null;
    this._initialized   = false;
    this._filtro        = '';
    this._filtroEstado  = '';
  }

  get client() {
    if (!this._client) this._client = window.supabase_client;
    return this._client;
  }

  // ══════════════════════════════════════════════════════
  // Init — llamado cada vez que se muestra la sección
  // ══════════════════════════════════════════════════════

  async inicializar() {
    if (!window.tienePermiso?.('portafolio.ver')) {
      console.warn('[PortafolioManager] Sin permiso portafolio.ver');
      return;
    }

    if (!this._initialized) {
      this._conectarFiltros();
      this._initialized = true;
    }

    await Promise.all([
      this.cargarEstadisticas(),
      this.cargarObras(this._filtro),
    ]);
  }

  // ══════════════════════════════════════════════════════
  // Nombre del artista (filtro principal)
  // ══════════════════════════════════════════════════════

  _getNombreArtista() {
    return window.usuarioActual?.nombre?.trim() || '';
  }

  // ══════════════════════════════════════════════════════
  // Estadísticas
  // ══════════════════════════════════════════════════════

  async cargarEstadisticas() {
    const artista = this._getNombreArtista();
    if (!artista) {
      this._renderEstadisticas({ total: 0, publicadas: 0, borradores: 0, revision: 0 });
      return;
    }

    try {
      const base = () => this.client
        .from('obras')
        .select('*', { count: 'exact', head: true })
        .eq('artista', artista);

      const [
        { count: total },
        { count: publicadas },
        { count: borradores },
        { count: revision },
      ] = await Promise.all([
        base(),
        base().eq('estado', 'Publicado'),
        base().eq('estado', 'Borrador'),
        base().eq('estado', 'En Revisión'),
      ]);

      this._renderEstadisticas({ total, publicadas, borradores, revision });

    } catch (err) {
      console.error('[PortafolioManager] cargarEstadisticas:', err);
      this._renderEstadisticas({ total: '—', publicadas: '—', borradores: '—', revision: '—' });
    }
  }

  _renderEstadisticas({ total, publicadas, borradores, revision }) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? '—';
    };
    set('portafolioTotal',      total);
    set('portafolioPublicadas', publicadas);
    set('portafolioBorradores', borradores);
    set('portafolioRevision',   revision);
  }

  // ══════════════════════════════════════════════════════
  // Tabla de obras
  // ══════════════════════════════════════════════════════

  async cargarObras(filtro = '') {
    this._filtro = filtro;
    const artista      = this._getNombreArtista();
    const estadoFiltro = this._filtroEstado;

    const tbody = document.getElementById('portafolioTbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Cargando obras…</td></tr>';

    try {
      let query = this.client
        .from('obras')
        .select('id, titulo, tecnica, estado, created_at')
        .order('created_at', { ascending: false });

      // Filtrar solo propias si hay nombre de artista; si no, sin filtro
      if (artista) {
        query = query.eq('artista', artista);
      }

      if (filtro) {
        query = query.ilike('titulo', `%${filtro}%`);
      }

      if (estadoFiltro) {
        query = query.eq('estado', estadoFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;

      this._renderTablaObras(data ?? []);

    } catch (err) {
      console.error('[PortafolioManager] cargarObras:', err);
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Error al cargar obras.</td></tr>';
    }
  }

  _renderTablaObras(obras) {
    const tbody = document.getElementById('portafolioTbody');
    if (!tbody) return;

    if (!obras.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No hay obras registradas.</td></tr>';
      return;
    }

    const estadoBadge = est => {
      const map = {
        'Publicado':   'badge-publicado',
        'Borrador':    'badge-borrador',
        'En Revisión': 'badge-revision',
        'Archivado':   'badge-archivado',
      };
      const cls   = map[est] || 'badge-borrador';
      const label = est || '—';
      return `<span class="badge ${cls}">${label}</span>`;
    };

    tbody.innerHTML = obras.map(o => `
      <tr>
        <td data-label="Título">${o.titulo ?? '—'}</td>
        <td data-label="Técnica">${o.tecnica ?? '—'}</td>
        <td data-label="Estado">${estadoBadge(o.estado)}</td>
        <td data-label="Fecha">${o.created_at ? new Date(o.created_at).toLocaleDateString('es-MX') : '—'}</td>
        <td data-label="Acciones">
          <button class="btn btn-ghost btn-xs portafolio-edit-btn" data-id="${o.id}" title="Editar obra">
            <i data-lucide="pencil" style="width:14px;height:14px;" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`).join('');

    window.IconRegistry?.init();

    // Abrir modal de edición sin abandonar Mi Portafolio
    tbody.querySelectorAll('.portafolio-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.obrasForm?.open(btn.dataset.id);
      });
    });
  }

  // ══════════════════════════════════════════════════════
  // Filtros y acciones
  // ══════════════════════════════════════════════════════

  _conectarFiltros() {
    // Búsqueda por título (debounce 300 ms)
    const input = document.getElementById('portafolioFiltro');
    if (input) {
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this.cargarObras(input.value.trim()), 300);
      });
    }

    // Filtro por estado
    const estadoSel = document.getElementById('portafolioEstadoFilter');
    if (estadoSel) {
      estadoSel.addEventListener('change', () => {
        this._filtroEstado = estadoSel.value;
        this.cargarObras(this._filtro);
      });
    }

    // Botón "Nueva Obra" → abre modal sin abandonar Mi Portafolio
    document.getElementById('portafolioBtnNuevaObra')?.addEventListener('click', () => {
      window.obrasForm?.open();
    });

    // Refrescar portafolio tras guardar obra desde modal (cualquier contexto)
    document.addEventListener('obras:refresh', () => {
      this.cargarEstadisticas();
      this.cargarObras(this._filtro);
    });
  }
}

// ── Instancia global ───────────────────────────────────────
window.portafolioManager = new PortafolioManager();

console.log('🖼️  portafolio.js cargado');
