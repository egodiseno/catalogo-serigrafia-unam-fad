/**
 * redes-sociales.js — Gestión de Redes Sociales (solo ADMIN)
 *
 * TAB "Redes Sociales" en la sección Configuración.
 * CRUD completo: crear, editar, eliminar, reordenar (drag-and-drop), toggle visible.
 * Vista previa en tiempo real. Validación de URL. Selector visual de ícono.
 *
 * Depende de: config.js (window.supabase_client), permisos.js, error-handler.js
 * Expone:     window.redesSocialesManager
 */

// ── Catálogo de redes soportadas ─────────────────────────────────
// icono = nombre de clase Bootstrap Icons (sin el prefijo "bi-")
const REDES_CATALOG = [
  { nombre: 'Facebook',  icono: 'facebook',   color: '#1877F2' },
  { nombre: 'Instagram', icono: 'instagram',  color: '#E1306C' },
  { nombre: 'Twitter',   icono: 'twitter-x',  color: '#000000' },
  { nombre: 'LinkedIn',  icono: 'linkedin',   color: '#0A66C2' },
  { nombre: 'YouTube',   icono: 'youtube',    color: '#FF0000' },
  { nombre: 'GitHub',    icono: 'github',     color: '#333333' },
  { nombre: 'Dribbble',  icono: 'dribbble',   color: '#EA4C89' },
  { nombre: 'Behance',   icono: 'behance',    color: '#1769FF' },
  { nombre: 'TikTok',    icono: 'tiktok',     color: '#000000' },
  { nombre: 'Snapchat',  icono: 'snapchat',   color: '#FFFD00' },
  { nombre: 'Pinterest', icono: 'pinterest',  color: '#E60023' },
  { nombre: 'Reddit',    icono: 'reddit',     color: '#FF4500' },
  { nombre: 'Twitch',    icono: 'twitch',     color: '#9146FF' },
  { nombre: 'Discord',   icono: 'discord',    color: '#5865F2' },
  { nombre: 'Mastodon',  icono: 'mastodon',   color: '#6364FF' },
];

const MAX_REDES = 5;

// ─────────────────────────────────────────────────────────────────

class RedesSocialesManager {
  constructor() {
    this._client      = null;
    this._initialized = false;
    this._redes       = [];     // caché local
    this._editingId   = null;   // null = crear, string = editar
    this._selIcono    = null;   // ícono seleccionado en modal
    this._dragSrcId   = null;   // id del card que se arrastra
    this._urlValid    = false;  // estado validación URL en tiempo real
  }

  get client() {
    if (!this._client) this._client = window.supabase_client;
    return this._client;
  }

  // ══════════════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════════════

  async inicializar() {
    if (!window.tienePermiso?.('configuracion.ver')) return;

    if (!this._initialized) {
      this._buildModalOptions();
      this._conectarModal();
      this._initialized = true;
    }

    await this.loadRedesSociales();
    console.log('[RedesSocialesManager] inicializar');
  }

  // ══════════════════════════════════════════════════════
  // Cargar y renderizar
  // ══════════════════════════════════════════════════════

  async loadRedesSociales() {
    const container = document.getElementById('redesSocialesContainer');
    if (container) container.innerHTML = '<p class="loading-cell">Cargando…</p>';

    try {
      const { data, error } = await this.client
        .from('redes_sociales')
        .select('*')
        .order('orden', { ascending: true });

      if (error) throw error;

      this._redes = data ?? [];
      this._renderCards();
      this._renderPreview();
      this._updateContador();
      this._updateAgregarBtn();

    } catch (err) {
      console.error('[RedesSocialesManager] loadRedesSociales:', err);
      if (container) container.innerHTML = '<p class="empty-cell">Error al cargar.</p>';
    }
  }

  // ── Renderizar cards ─────────────────────────────────

  _renderCards() {
    const container = document.getElementById('redesSocialesContainer');
    if (!container) return;

    if (!this._redes.length) {
      container.innerHTML = `
        <div class="rrss-empty">
          <p>Sin redes sociales configuradas.</p>
          <p class="field-hint">Agrega la primera con el botón de abajo.</p>
        </div>`;
      return;
    }

    container.innerHTML = this._redes.map(r => this._renderCard(r)).join('');

    // Conectar drag & drop y botones
    container.querySelectorAll('.rrss-card').forEach(card => {
      this._conectarDragCard(card);
    });
    container.querySelectorAll('.rrss-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.dataset.id));
    });
    container.querySelectorAll('.rrss-del-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteRedSocial(btn.dataset.id, btn.dataset.nombre));
    });
    container.querySelectorAll('.rrss-visible-cb').forEach(cb => {
      cb.addEventListener('change', () => this._toggleVisible(cb.dataset.id, cb.checked));
    });

    window.IconRegistry?.init();
  }

  _renderCard(r) {
    const cat        = REDES_CATALOG.find(c => c.nombre === r.nombre) ?? {};
    const color      = r.color || cat.color || '#013B75';
    const icono      = r.icono || cat.icono || 'globe';
    const soloUna    = this._redes.length <= 1;
    const delTitle   = soloUna ? 'Mínimo 1 red social requerida' : 'Eliminar';
    const urlCorta   = r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

    return `
      <div class="rrss-card${!r.visible ? ' rrss-card--hidden' : ''}"
           data-id="${_esc(r.id)}"
           draggable="true">

        <div class="rrss-drag-handle" title="Arrastrar para reordenar" aria-hidden="true">
          <i data-lucide="grip-vertical" style="width:16px;height:16px;" aria-hidden="true"></i>
        </div>

        <div class="rrss-icon-bubble" style="background:${_esc(color)};">
          <i class="bi bi-${_esc(icono)}" style="font-size:22px;color:#fff;" aria-hidden="true"></i>
        </div>

        <div class="rrss-info">
          <span class="rrss-nombre">${_esc(r.nombre)}</span>
          <span class="rrss-url" title="${_esc(r.url)}">${_esc(urlCorta)}</span>
        </div>

        <label class="rrss-visible-toggle" title="${r.visible ? 'Visible' : 'Oculto'}">
          <input type="checkbox"
                 class="rrss-visible-cb"
                 data-id="${_esc(r.id)}"
                 ${r.visible ? 'checked' : ''}>
          <span class="rrss-visible-indicator"></span>
        </label>

        <div class="rrss-card-btns">
          <button type="button"
                  class="btn btn-secondary btn-xs rrss-edit-btn"
                  data-id="${_esc(r.id)}"
                  title="Editar">
            <i data-lucide="pen" style="width:13px;height:13px;" aria-hidden="true"></i>
          </button>
          <button type="button"
                  class="btn btn-danger btn-xs rrss-del-btn"
                  data-id="${_esc(r.id)}"
                  data-nombre="${_esc(r.nombre)}"
                  title="${_esc(delTitle)}"
                  ${soloUna ? 'disabled' : ''}>
            <i data-lucide="trash-2" style="width:13px;height:13px;" aria-hidden="true"></i>
          </button>
        </div>
      </div>`;
  }

  // ── Renderizar preview footer ─────────────────────────

  _renderPreview() {
    const el = document.getElementById('rrssPreviewFooter');
    if (!el) return;

    const visibles = this._redes.filter(r => r.visible);

    if (!visibles.length) {
      el.innerHTML = '<span class="rrss-preview-empty">Sin redes visibles</span>';
      return;
    }

    el.innerHTML = visibles.map(r => {
      const cat   = REDES_CATALOG.find(c => c.nombre === r.nombre) ?? {};
      const color = r.color || cat.color || '#013B75';
      const icono = r.icono || cat.icono || 'globe';
      return `
        <a href="${_esc(r.url)}"
           target="_blank" rel="noopener"
           class="rrss-preview-icon"
           style="background:${_esc(color)};"
           title="${_esc(r.nombre)}">
          <i class="bi bi-${_esc(icono)}" style="font-size:20px;color:#fff;" aria-hidden="true"></i>
        </a>`;
    }).join('');
  }

  // ── Contador ─────────────────────────────────────────

  _updateContador() {
    const el = document.getElementById('rrssContador');
    if (!el) return;
    const n = this._redes.length;
    el.textContent = `Tienes ${n} de ${MAX_REDES} redes sociales`;
    el.classList.toggle('rrss-contador--full', n >= MAX_REDES);
  }

  _updateAgregarBtn() {
    const btn = document.getElementById('btnAgregarRed');
    if (!btn) return;
    const full   = this._redes.length >= MAX_REDES;
    btn.disabled = full;
    btn.title    = full ? `Máximo ${MAX_REDES} redes sociales` : '';
  }

  // ══════════════════════════════════════════════════════
  // Toggle visible
  // ══════════════════════════════════════════════════════

  async _toggleVisible(id, visible) {
    const item = this._redes.find(r => r.id === id);
    if (item) item.visible = visible;
    this._renderPreview();

    try {
      await this.client.from('redes_sociales')
        .update({ visible, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      if (item) item.visible = !visible;
      this._renderCards();
      this._renderPreview();
      window.ErrorHandler?.showToast('Error al actualizar visibilidad', 'error');
    }
  }

  // ══════════════════════════════════════════════════════
  // Drag & Drop (HTML5 nativo)
  // ══════════════════════════════════════════════════════

  _conectarDragCard(card) {
    card.addEventListener('dragstart', (e) => {
      this._dragSrcId = card.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);
      setTimeout(() => card.classList.add('rrss-card--dragging'), 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('rrss-card--dragging');
      document.querySelectorAll('.rrss-card--over').forEach(c => c.classList.remove('rrss-card--over'));
      this._dragSrcId = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (card.dataset.id !== this._dragSrcId) {
        card.classList.add('rrss-card--over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('rrss-card--over');
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('rrss-card--over');
      const srcId = this._dragSrcId;
      const dstId = card.dataset.id;
      if (!srcId || srcId === dstId) return;
      await this._reordenarDrop(srcId, dstId);
    });
  }

  async _reordenarDrop(srcId, dstId) {
    const src = this._redes.find(r => r.id === srcId);
    const dst = this._redes.find(r => r.id === dstId);
    if (!src || !dst) return;

    // Encontrar posiciones en array y reordenar
    const srcIdx = this._redes.indexOf(src);
    const dstIdx = this._redes.indexOf(dst);

    // Mover src a la posición de dst
    this._redes.splice(srcIdx, 1);
    this._redes.splice(dstIdx, 0, src);

    // Reasignar orden secuencial
    this._redes.forEach((r, i) => { r.orden = i + 1; });

    this._renderCards();
    this._renderPreview();

    // Persistir nuevos ordenes en BD
    try {
      await Promise.all(
        this._redes.map(r =>
          this.client.from('redes_sociales').update({ orden: r.orden }).eq('id', r.id)
        )
      );
    } catch (err) {
      console.error('[RedesSocialesManager] reordenar:', err);
      window.ErrorHandler?.showToast('Error al guardar el nuevo orden', 'error');
    }
  }

  // ══════════════════════════════════════════════════════
  // MODAL — Inicializar selectores y opciones
  // ══════════════════════════════════════════════════════

  _buildModalOptions() {
    // Dropdown de nombres
    const sel = document.getElementById('rrssNombreSelect');
    if (sel) {
      sel.innerHTML = '<option value="">— Selecciona red social —</option>' +
        REDES_CATALOG.map(c =>
          `<option value="${_esc(c.nombre)}" data-color="${_esc(c.color)}" data-icono="${_esc(c.icono)}">${_esc(c.nombre)}</option>`
        ).join('');
    }

    // Grid de iconos
    const grid = document.getElementById('rrssIconGrid');
    if (grid) {
      grid.innerHTML = REDES_CATALOG.map(c => `
        <button type="button"
                class="rrss-icon-option"
                data-icono="${_esc(c.icono)}"
                data-nombre="${_esc(c.nombre)}"
                data-color="${_esc(c.color)}"
                title="${_esc(c.nombre)}">
          <div class="rrss-icon-option-bubble" style="background:${_esc(c.color)};">
            <i class="bi bi-${_esc(c.icono)}" style="font-size:20px;color:#fff;" aria-hidden="true"></i>
          </div>
          <span class="rrss-icon-option-name">${_esc(c.nombre)}</span>
        </button>
      `).join('');
    }
  }

  // ── Conectar eventos del modal ────────────────────────

  _conectarModal() {
    // Botón Agregar
    document.getElementById('btnAgregarRed')?.addEventListener('click', () => this.openCreateModal());

    // Cerrar modal
    document.getElementById('redesModalCloseBtn')?.addEventListener('click', () => this._closeModal());
    document.getElementById('rrssModalCancelBtn')?.addEventListener('click', () => this._closeModal());
    document.getElementById('redesModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('redesModal')) this._closeModal();
    });

    // Guardar
    document.getElementById('rrssModalSaveBtn')?.addEventListener('click', () => this._saveFromModal());

    // Nombre → auto-fill color + selección de ícono
    document.getElementById('rrssNombreSelect')?.addEventListener('change', (e) => {
      const opt = e.target.options[e.target.selectedIndex];
      if (opt?.dataset.color) this._setColor(opt.dataset.color);
      if (opt?.dataset.icono) this._selectIcono(opt.dataset.icono);
    });

    // Validación URL en tiempo real
    document.getElementById('rrssUrlInput')?.addEventListener('input', (e) => {
      this._validateUrl(e.target.value.trim());
    });

    // Probar enlace
    document.getElementById('rrssProbarEnlaceBtn')?.addEventListener('click', () => {
      const url = document.getElementById('rrssUrlInput')?.value.trim();
      if (url) window.open(url, '_blank', 'noopener');
    });

    // Color picker → actualizar label
    document.getElementById('rrssColorInput')?.addEventListener('input', (e) => {
      this._updateColorLabel(e.target.value);
    });

    // Click en opción de ícono
    document.getElementById('rrssIconGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.rrss-icon-option');
      if (!btn) return;
      this._selectIcono(btn.dataset.icono);
    });

    // Escape cierra modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('redesModal');
        if (modal?.style.display !== 'none') this._closeModal();
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // Modal — Abrir / Cerrar
  // ══════════════════════════════════════════════════════

  openCreateModal() {
    if (this._redes.length >= MAX_REDES) {
      window.ErrorHandler?.showToast(`Máximo ${MAX_REDES} redes sociales`, 'warning');
      return;
    }
    this._editingId = null;
    this._selIcono  = null;
    this._resetModalForm();
    document.getElementById('redesModalTitle').textContent = 'Agregar red social';
    document.getElementById('rrssModalSaveBtn').textContent = 'Agregar';
    this._openModal();
  }

  openEditModal(id) {
    const red = this._redes.find(r => r.id === id);
    if (!red) return;

    this._editingId = id;
    this._selIcono  = red.icono;

    // Pre-llenar formulario
    const nombSel = document.getElementById('rrssNombreSelect');
    if (nombSel) nombSel.value = red.nombre;

    const urlInput = document.getElementById('rrssUrlInput');
    if (urlInput) urlInput.value = red.url;

    this._setColor(red.color);
    this._selectIcono(red.icono);
    this._validateUrl(red.url);

    const visCb = document.getElementById('rrssVisibleCb');
    if (visCb) visCb.checked = red.visible;

    document.getElementById('redesModalTitle').textContent = 'Editar red social';
    document.getElementById('rrssModalSaveBtn').textContent = 'Guardar';
    this._openModal();
  }

  _openModal() {
    const modal = document.getElementById('redesModal');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('rrssNombreSelect')?.focus();
    }
  }

  _closeModal() {
    const modal = document.getElementById('redesModal');
    if (modal) modal.style.display = 'none';
    this._resetModalForm();
  }

  _resetModalForm() {
    const nombSel  = document.getElementById('rrssNombreSelect');
    const urlInput = document.getElementById('rrssUrlInput');
    const visCb    = document.getElementById('rrssVisibleCb');
    if (nombSel)  nombSel.value  = '';
    if (urlInput) urlInput.value = '';
    if (visCb)    visCb.checked  = true;
    this._setColor('#013B75');
    this._validateUrl('');
    this._clearIconoSelection();
    this._selIcono = null;
    this._editingId = null;
  }

  // ── Helpers de modal ─────────────────────────────────

  _setColor(hex) {
    const picker = document.getElementById('rrssColorInput');
    if (picker) picker.value = hex;
    this._updateColorLabel(hex);
  }

  _updateColorLabel(hex) {
    const label = document.getElementById('rrssColorLabel');
    if (label) {
      label.textContent = hex;
      label.style.background = hex;
      label.style.color = _contrastColor(hex);
    }
  }

  _selectIcono(icono) {
    this._selIcono = icono;
    // Actualizar selección visual en grid
    document.querySelectorAll('.rrss-icon-option').forEach(btn => {
      btn.classList.toggle('rrss-icon-option--selected', btn.dataset.icono === icono);
    });
    // Si el icono coincide con una red, auto-seleccionar en grid
  }

  _clearIconoSelection() {
    document.querySelectorAll('.rrss-icon-option').forEach(btn => {
      btn.classList.remove('rrss-icon-option--selected');
    });
  }

  _validateUrl(url) {
    const input    = document.getElementById('rrssUrlInput');
    const feedback = document.getElementById('rrssUrlFeedback');
    const saveBtn  = document.getElementById('rrssModalSaveBtn');

    const valid = /^https?:\/\/.+\..+/.test(url);
    this._urlValid = valid || url === '';   // vacío → no bloquear (required lo valida al guardar)

    if (!url) {
      input?.classList.remove('input--valid', 'input--invalid');
      if (feedback) feedback.textContent = '';
      if (saveBtn)  saveBtn.disabled = false;
      return;
    }

    if (valid) {
      input?.classList.remove('input--invalid');
      input?.classList.add('input--valid');
      if (feedback) { feedback.textContent = '✓ URL válida'; feedback.className = 'rrss-url-feedback rrss-url-feedback--ok'; }
      if (saveBtn)  saveBtn.disabled = false;
    } else {
      input?.classList.remove('input--valid');
      input?.classList.add('input--invalid');
      if (feedback) { feedback.textContent = '✗ Debe comenzar con https://…'; feedback.className = 'rrss-url-feedback rrss-url-feedback--err'; }
      if (saveBtn)  saveBtn.disabled = true;
    }
  }

  // ══════════════════════════════════════════════════════
  // Guardar (INSERT o UPDATE)
  // ══════════════════════════════════════════════════════

  async _saveFromModal() {
    const nombre   = document.getElementById('rrssNombreSelect')?.value.trim();
    const url      = document.getElementById('rrssUrlInput')?.value.trim();
    const color    = document.getElementById('rrssColorInput')?.value || '#013B75';
    const visible  = document.getElementById('rrssVisibleCb')?.checked ?? true;

    // Validaciones
    if (!nombre) {
      window.ErrorHandler?.showToast('Selecciona una red social', 'error');
      return;
    }
    if (!url) {
      window.ErrorHandler?.showToast('La URL es obligatoria', 'error');
      document.getElementById('rrssUrlInput')?.focus();
      return;
    }
    if (!/^https?:\/\/.+\..+/.test(url)) {
      window.ErrorHandler?.showToast('URL inválida — debe comenzar con https://', 'error');
      document.getElementById('rrssUrlInput')?.focus();
      return;
    }

    // Duplicado de nombre (solo al crear)
    if (!this._editingId) {
      const existe = this._redes.some(r => r.nombre.toLowerCase() === nombre.toLowerCase());
      if (existe) {
        window.ErrorHandler?.showToast(`"${nombre}" ya existe en tu lista`, 'error');
        return;
      }
    }

    // Ícono seleccionado (fallback al catálogo si no eligió explícitamente)
    const cat    = REDES_CATALOG.find(c => c.nombre === nombre);
    const icono  = this._selIcono || cat?.icono || 'globe';
    const email  = window.usuarioActual?.email ?? '';
    const btn    = document.getElementById('rrssModalSaveBtn');

    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
      if (this._editingId) {
        // UPDATE
        const { error } = await this.client.from('redes_sociales')
          .update({ nombre, url, icono, color, visible, updated_at: new Date().toISOString(), actualizado_por: email })
          .eq('id', this._editingId);
        if (error) throw error;
        window.ErrorHandler?.showToast(`✅ ${nombre} actualizado`, 'success');
      } else {
        // INSERT
        const maxOrden = this._redes.reduce((m, r) => Math.max(m, r.orden), 0);
        const { error } = await this.client.from('redes_sociales')
          .insert({ nombre, url, icono, color, visible, orden: maxOrden + 1, actualizado_por: email });
        if (error) throw error;
        window.ErrorHandler?.showToast(`✅ ${nombre} agregado`, 'success');
      }

      this._closeModal();
      await this.loadRedesSociales();

    } catch (err) {
      console.error('[RedesSocialesManager] save:', err);
      window.ErrorHandler?.showToast('Error al guardar', 'error');
      if (btn) { btn.disabled = false; btn.textContent = this._editingId ? 'Guardar' : 'Agregar'; }
    }
  }

  // ══════════════════════════════════════════════════════
  // Eliminar
  // ══════════════════════════════════════════════════════

  deleteRedSocial(id, nombre) {
    if (this._redes.length <= 1) {
      window.ErrorHandler?.showToast('Mínimo 1 red social es requerida', 'warning');
      return;
    }

    window.ModalManager?.openConfirm({
      title:       '¿Eliminar red social?',
      message:     `"${nombre}" se eliminará del footer. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText:  'Cancelar',
      onConfirm:   async () => {
        try {
          const { error } = await this.client.from('redes_sociales').delete().eq('id', id);
          if (error) throw error;

          this._redes = this._redes.filter(r => r.id !== id);
          this._renderCards();
          this._renderPreview();
          this._updateContador();
          this._updateAgregarBtn();
          window.ErrorHandler?.showToast('Red social eliminada', 'success');
        } catch (err) {
          console.error('[RedesSocialesManager] delete:', err);
          window.ErrorHandler?.showToast('Error al eliminar', 'error');
        }
      },
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Calcula color de texto (blanco o negro) para contrastar con un hex de fondo */
function _contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ── Instancia global ───────────────────────────────────────────────
window.redesSocialesManager = new RedesSocialesManager();

console.log('📱 redes-sociales.js cargado');
