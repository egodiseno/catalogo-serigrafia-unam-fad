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

    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Cargando obras…</td></tr>';

    try {
      let query = this.client
        .from('obras')
        .select('id, titulo, año, tecnica_id, tecnicas(nombre), imagenes(url_storage, principal), obra_tags(tags(id, nombre)), estado, created_at')
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
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Error al cargar obras.</td></tr>';
    }
  }

  // ── Helpers de escape (mismos que obras-list.js) ──────
  _escHtml(str) {
    if (!str) return '—';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _escAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  _renderTablaObras(obras) {
    const tbody = document.getElementById('portafolioTbody');
    if (!tbody) return;

    if (!obras.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No hay obras registradas aún.</td></tr>';
      return;
    }

    const estadoBadge = est => {
      const map = {
        'Publicado':   'badge-publicado',
        'Borrador':    'badge-borrador',
        'En Revisión': 'badge-revision',
        'Archivado':   'badge-archivado',
      };
      const cls = map[est] || 'badge-borrador';
      return `<span class="badge ${cls}">${est || '—'}</span>`;
    };

    // ── Botón de acción según estado ─────────────────────────────────────────
    // Borrador    → lápiz editar
    // En Revisión → "Volver a borrador" (confirmación simple)
    // Publicado   → "Volver a borrador" (modal con motivo obligatorio)
    // Archivado   → sin botón
    const _accionBtn = (o) => {
      switch (o.estado) {
        case 'Borrador':
          return `<button class="btn btn-ghost btn-xs portafolio-edit-btn"
                          data-id="${o.id}" title="Editar obra">
            <i data-lucide="pencil" style="width:14px;height:14px;" aria-hidden="true"></i>
          </button>`;
        case 'En Revisión':
          return `<button class="btn btn-secondary btn-xs portafolio-reabrir-revision-btn"
                          data-id="${o.id}" title="Retomar para editar">
            Volver a borrador
          </button>`;
        case 'Publicado':
          return `<button class="btn btn-secondary btn-xs portafolio-reabrir-publicado-btn"
                          data-id="${o.id}" title="Reabrir para editar">
            Volver a borrador
          </button>`;
        default: // Archivado u otro: sin acción disponible
          return '';
      }
    };

    tbody.innerHTML = obras.map(o => {
      // Miniatura — imagen principal; si no, la primera disponible
      const imgUrl = o.imagenes?.find(i => i.principal)?.url_storage
                  ?? o.imagenes?.[0]?.url_storage;
      const thumb = imgUrl
        ? `<img src="${this._escAttr(imgUrl)}" alt="thumb" class="obra-thumb"
               data-src="${this._escAttr(imgUrl)}" title="Ver imagen">`
        : '<span class="no-thumb">—</span>';

      // Tags N:M via obra_tags
      const tagNames = (o.obra_tags ?? [])
        .map(ot => ot.tags?.nombre)
        .filter(Boolean);
      const tagsHtml = tagNames.length
        ? tagNames.map(n => `<span class="tag-badge">${this._escHtml(n)}</span>`).join('')
        : '<span class="text-muted">—</span>';

      return `
        <tr data-id="${o.id}">
          <td class="td-thumb" data-label="Imagen">${thumb}</td>
          <td data-label="Título">${this._escHtml(o.titulo)}</td>
          <td data-label="Año">${o.año ?? '—'}</td>
          <td data-label="Técnica">${this._escHtml(o.tecnicas?.nombre)}</td>
          <td class="tags-cell" data-label="Tags">${tagsHtml}</td>
          <td data-label="Estado">${estadoBadge(o.estado)}</td>
          <td data-label="Fecha">${o.created_at ? new Date(o.created_at).toLocaleDateString('es-MX') : '—'}</td>
          <td data-label="Acciones">${_accionBtn(o)}</td>
        </tr>`;
    }).join('');

    window.IconRegistry?.init();

    // Miniatura → modal de vista previa (mismo patrón que obras-list.js)
    tbody.querySelectorAll('.obra-thumb').forEach(img => {
      img.addEventListener('click', () =>
        window.ModalManager?.openImagePreview(img.dataset.src)
      );
    });

    // Abrir modal de edición
    tbody.querySelectorAll('.portafolio-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => window.obrasForm?.open(btn.dataset.id));
    });

    // "Volver a borrador" desde En Revisión — confirmación simple sin campos
    tbody.querySelectorAll('.portafolio-reabrir-revision-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const obraId = btn.dataset.id;
        window.ModalManager?.openConfirm({
          title:       '¿Retomar esta obra?',
          message:     'La obra volverá a estado Borrador y podrás seguir editándola.',
          confirmText: 'Sí, retomar',
          cancelText:  'Cancelar',
          tipo:        'info',
          onConfirm:   async () => {
            try {
              const { data: filas, error } = await this.client
                .from('obras')
                .update({ estado: 'Borrador' })
                .eq('id', obraId)
                .select('id');
              if (error) throw error;
              // UPDATE silenciado por RLS → cero filas afectadas, sin error explícito
              if (!filas?.length) throw new Error('UPDATE no afectó ninguna fila — posible bloqueo de política RLS');
              window.ErrorHandler?.showToast('Obra retomada — ahora está en Borrador.', 'success');
              await Promise.all([
                this.cargarEstadisticas(),
                this.cargarObras(this._filtro),
              ]);
            } catch (err) {
              console.error('[PortafolioManager] reabrir revisión:', err);
              window.ErrorHandler?.showToast('No se pudo retomar la obra.', 'error');
            }
          },
        });
      });
    });

    // "Volver a borrador" desde Publicado — modal con motivo obligatorio
    tbody.querySelectorAll('.portafolio-reabrir-publicado-btn').forEach(btn => {
      btn.addEventListener('click', () => this._abrirModalReopeningPublicado(btn.dataset.id));
    });
  }

  // ══════════════════════════════════════════════════════
  // Modal: Reabrir obra publicada (requiere motivo)
  // ══════════════════════════════════════════════════════

  /**
   * Abre el modal #reabrirPublicadoModal para la obra indicada.
   * El editor debe escribir un motivo (mín. 1 carácter, máx. 1000).
   * Al confirmar: estado → 'Borrador', motivo_reapertura = texto.
   * visible_publico NO se modifica — la obra sigue visible en el catálogo.
   * Usa AbortController para limpiar todos los listeners al cerrar.
   *
   * @param {string} obraId — UUID de la obra en estado Publicado
   */
  _abrirModalReopeningPublicado(obraId) {
    const modal      = document.getElementById('reabrirPublicadoModal');
    const textarea   = document.getElementById('reabrirMotivoInput');
    const charCount  = document.getElementById('reabrirMotivoCharCount');
    const confirmBtn = document.getElementById('reabrirPublicadoModalConfirmBtn');
    const cancelBtn  = document.getElementById('reabrirPublicadoModalCancelBtn');
    const closeBtn   = document.getElementById('reabrirPublicadoModalCloseBtn');

    if (!modal || !textarea || !confirmBtn) {
      console.error('[PortafolioManager] #reabrirPublicadoModal no encontrado en el DOM');
      return;
    }

    // ── Reset estado ──────────────────────────────────────
    textarea.value         = '';
    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Reabrir para editar';
    if (charCount) charCount.textContent = '0 / 1000';

    // AbortController — limpia todos los listeners al cerrar
    const ac     = new AbortController();
    const signal = ac.signal;

    const _close = () => {
      modal.style.display = 'none';
      ac.abort();
    };

    // Contador de chars (mismo patrón que control-registro.js) + habilitar confirm
    textarea.addEventListener('input', () => {
      const n = textarea.value.length;
      if (charCount) charCount.textContent = `${n} / 1000`;
      confirmBtn.disabled = n === 0;
    }, { signal });

    closeBtn?.addEventListener('click',  _close, { signal });
    cancelBtn?.addEventListener('click', _close, { signal });

    // Cerrar al hacer clic en el overlay
    modal.addEventListener('click', e => {
      if (e.target === modal) _close();
    }, { signal });

    // Cerrar con Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') _close();
    }, { signal });

    // Confirmar — guarda estado = 'Borrador' + motivo_reapertura
    // visible_publico queda intacto (no se incluye en el UPDATE)
    confirmBtn.addEventListener('click', async () => {
      const motivo = textarea.value.trim();
      if (!motivo) return;

      confirmBtn.disabled    = true;
      confirmBtn.textContent = 'Reabriendo…';

      try {
        const { data: filas, error } = await this.client
          .from('obras')
          .update({ estado: 'Borrador', motivo_reapertura: motivo })
          .eq('id', obraId)
          .select('id');

        if (error) throw error;
        // UPDATE silenciado por RLS → cero filas afectadas, sin error explícito
        if (!filas?.length) throw new Error('UPDATE no afectó ninguna fila — posible bloqueo de política RLS');

        _close();
        window.ErrorHandler?.showToast('Obra reabierta — ahora está en Borrador.', 'success');
        await Promise.all([
          this.cargarEstadisticas(),
          this.cargarObras(this._filtro),
        ]);
      } catch (err) {
        console.error('[PortafolioManager] reabrir publicado:', err);
        window.ErrorHandler?.showToast('No se pudo reabrir la obra.', 'error');
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Reabrir para editar';
      }
    }, { signal });

    // Mostrar modal
    modal.style.display = 'flex';
    window.IconRegistry?.init();
    textarea.focus();
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
