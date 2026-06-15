/**
 * configuracion.js — Gestión de "Acerca" y "Créditos" (solo ADMIN)
 *
 * Depende de: config.js (window.supabase_client), permisos.js,
 *             error-handler.js, modals.js (ModalManager)
 * Expone:     window.configuracionManager
 */

class ConfiguracionManager {
  constructor() {
    this._client      = null;
    this._initialized = false;
    this._tab         = 'acerca';   // 'acerca' | 'creditos'
    this._creditos    = [];         // caché local
  }

  get client() {
    if (!this._client) this._client = window.supabase_client;
    return this._client;
  }

  // ══════════════════════════════════════════════════════
  // Init — llamado cada vez que se muestra la sección
  // ══════════════════════════════════════════════════════

  async inicializar() {
    if (!window.tienePermiso?.('configuracion.ver')) {
      console.warn('[ConfiguracionManager] Sin permiso configuracion.ver');
      return;
    }

    if (!this._initialized) {
      this._conectarTabs();
      this._conectarGuardarAcerca();
      this._initialized = true;
    }

    // Cargar el tab activo
    await this._cargarTab(this._tab);

    console.log('[ConfiguracionManager] inicializar — tab:', this._tab);
  }

  // ══════════════════════════════════════════════════════
  // Tabs
  // ══════════════════════════════════════════════════════

  _conectarTabs() {
    document.querySelectorAll('.config-tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        this._tab = btn.dataset.tab;
        // Activar botón
        document.querySelectorAll('.config-tab-btn').forEach(b => {
          b.classList.toggle('config-tab-btn--active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        // Mostrar panel
        document.querySelectorAll('.config-tab-panel').forEach(p => {
          p.classList.toggle('config-tab-panel--active', p.dataset.panel === this._tab);
        });
        await this._cargarTab(this._tab);
      });
    });
  }

  async _cargarTab(tab) {
    if (tab === 'acerca')   await this.loadAcerca();
    if (tab === 'creditos') await this.loadCreditos();
  }

  // ══════════════════════════════════════════════════════
  // TAB 1: ACERCA
  // ══════════════════════════════════════════════════════

  async loadAcerca() {
    const textarea = document.getElementById('configuracionAcercaTexto');
    const ts       = document.getElementById('acercaTimestamp');
    if (!textarea) return;

    textarea.disabled    = true;
    textarea.placeholder = 'Cargando…';

    try {
      const { data, error } = await this.client
        .from('configuracion_acerca')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      textarea.value       = data?.contenido ?? '';
      textarea.disabled    = false;
      textarea.placeholder = 'Escribe la descripción del catálogo…';

      if (ts) {
        if (data?.updated_at) {
          const fecha = new Date(data.updated_at).toLocaleString('es-MX', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
          ts.textContent = `Última actualización: ${fecha}${data.actualizado_por ? ` · ${data.actualizado_por}` : ''}`;
        } else {
          ts.textContent = '';
        }
      }

    } catch (err) {
      console.error('[ConfiguracionManager] loadAcerca:', err);
      textarea.disabled    = false;
      textarea.placeholder = 'Error al cargar. Intenta de nuevo.';
      window.ErrorHandler?.showToast('Error al cargar Acerca', 'error');
    }
  }

  _conectarGuardarAcerca() {
    document.getElementById('btnGuardarAcerca')?.addEventListener('click', () => this.saveAcerca());
  }

  async saveAcerca() {
    const textarea = document.getElementById('configuracionAcercaTexto');
    const btn      = document.getElementById('btnGuardarAcerca');
    const ts       = document.getElementById('acercaTimestamp');
    if (!textarea) return;

    const contenido = textarea.value.trim();

    if (!contenido) {
      window.ErrorHandler?.showToast('El contenido no puede estar vacío', 'error');
      textarea.focus();
      return;
    }
    if (contenido.length < 10) {
      window.ErrorHandler?.showToast('Escribe al menos 10 caracteres', 'error');
      textarea.focus();
      return;
    }

    const email = window.usuarioActual?.email ?? '';

    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    try {
      const { error } = await this.client
        .from('configuracion_acerca')
        .update({
          contenido,
          updated_at:      new Date().toISOString(),
          actualizado_por: email,
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;

      window.ErrorHandler?.showToast('✅ Acerca guardado', 'success');

      if (ts) {
        const fecha = new Date().toLocaleString('es-MX', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        ts.textContent = `Última actualización: ${fecha}${email ? ` · ${email}` : ''}`;
      }

    } catch (err) {
      console.error('[ConfiguracionManager] saveAcerca:', err);
      window.ErrorHandler?.showToast('Error al guardar', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    }
  }

  // ══════════════════════════════════════════════════════
  // TAB 2: CRÉDITOS
  // ══════════════════════════════════════════════════════

  async loadCreditos() {
    const container = document.getElementById('creditosContainer');
    if (!container) return;

    container.innerHTML = '<p class="loading-cell">Cargando créditos…</p>';

    try {
      const { data, error } = await this.client
        .from('creditos')
        .select('*')
        .order('orden', { ascending: true });

      if (error) throw error;

      this._creditos = data ?? [];
      this._renderCreditos();

    } catch (err) {
      console.error('[ConfiguracionManager] loadCreditos:', err);
      container.innerHTML = '<p class="empty-cell">Error al cargar créditos.</p>';
    }
  }

  _renderCreditos() {
    const container = document.getElementById('creditosContainer');
    if (!container) return;

    const SECCIONES = [
      { key: 'unam',      label: 'UNAM',                 addLabel: '+ Agregar cargo' },
      { key: 'fad',       label: 'FAD',                  addLabel: '+ Agregar cargo' },
      { key: 'taller',    label: 'Taller de Serigrafía', addLabel: '+ Agregar profesor' },
      { key: 'webmaster', label: 'Webmaster',            addLabel: '+ Agregar' },
    ];

    container.innerHTML = SECCIONES.map(sec => {
      const items = this._creditos.filter(c => c.seccion === sec.key);
      return `
        <div class="credito-seccion" data-seccion="${sec.key}">
          <div class="credito-seccion-header">
            <h3 class="credito-seccion-title">${esc(sec.label)}</h3>
          </div>
          <div class="credito-lista" data-lista="${sec.key}">
            ${items.length
              ? items.map(c => this._renderCreditoCard(c)).join('')
              : '<p class="field-hint">Sin registros en esta sección.</p>'}
          </div>
          <button type="button"
                  class="btn btn-ghost btn-sm credito-add-btn"
                  data-seccion="${sec.key}">
            <i data-lucide="plus" style="width:13px;height:13px;" aria-hidden="true"></i>
            ${esc(sec.addLabel)}
          </button>
        </div>`;
    }).join('');

    // Conectar eventos
    this._conectarCreditosEventos(container);
    window.IconRegistry?.init();
  }

  _renderCreditoCard(c) {
    const esEliminable = c.tipo !== 'fijo';
    const claseVis     = c.visible ? 'credito-card--visible' : 'credito-card--oculto';

    return `
      <div class="credito-card ${claseVis}" data-credito-id="${esc(c.id)}">
        <div class="credito-card-info">
          <label class="credito-visible-label"
                 title="${c.visible ? 'Visible en página pública' : 'Oculto en página pública'}">
            <input type="checkbox"
                   class="credito-visible-cb"
                   data-id="${esc(c.id)}"
                   ${c.visible ? 'checked' : ''}>
            <span class="credito-visible-text">Visible</span>
          </label>
          <div class="credito-nombres">
            <span class="credito-nombre">${esc(c.nombre) || '<em>Sin nombre</em>'}</span>
            <span class="credito-cargo">${esc(c.cargo)  || '<em>Sin cargo</em>'}</span>
          </div>
        </div>
        <div class="credito-card-actions">
          <button type="button"
                  class="btn btn-ghost btn-xs credito-up-btn"
                  data-id="${esc(c.id)}" title="Subir">
            <i data-lucide="chevron-up" style="width:14px;height:14px;" aria-hidden="true"></i>
          </button>
          <button type="button"
                  class="btn btn-ghost btn-xs credito-down-btn"
                  data-id="${esc(c.id)}" title="Bajar">
            <i data-lucide="chevron-down" style="width:14px;height:14px;" aria-hidden="true"></i>
          </button>
          <button type="button"
                  class="btn btn-secondary btn-xs credito-edit-btn"
                  data-id="${esc(c.id)}" title="Editar">
            <i data-lucide="pen" style="width:13px;height:13px;" aria-hidden="true"></i>
            Editar
          </button>
          ${esEliminable
            ? `<button type="button"
                       class="btn btn-danger btn-xs credito-del-btn"
                       data-id="${esc(c.id)}"
                       data-nombre="${esc(c.nombre)}"
                       title="Eliminar">
                 <i data-lucide="trash-2" style="width:13px;height:13px;" aria-hidden="true"></i>
               </button>`
            : ''}
        </div>
      </div>`;
  }

  _conectarCreditosEventos(container) {
    // Toggle visible
    container.querySelectorAll('.credito-visible-cb').forEach(cb => {
      cb.addEventListener('change', () => this.toggleVisible(cb.dataset.id, cb.checked));
    });

    // Reordenar
    container.querySelectorAll('.credito-up-btn').forEach(btn => {
      btn.addEventListener('click', () => this.reordenar(btn.dataset.id, 'up'));
    });
    container.querySelectorAll('.credito-down-btn').forEach(btn => {
      btn.addEventListener('click', () => this.reordenar(btn.dataset.id, 'down'));
    });

    // Editar
    container.querySelectorAll('.credito-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.dataset.id));
    });

    // Eliminar
    container.querySelectorAll('.credito-del-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCredito(btn.dataset.id, btn.dataset.nombre));
    });

    // Agregar nuevo
    container.querySelectorAll('.credito-add-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openCreateModal(btn.dataset.seccion));
    });
  }

  // ══════════════════════════════════════════════════════
  // toggleVisible — cambio inmediato sin botón guardar
  // ══════════════════════════════════════════════════════

  async toggleVisible(id, visible) {
    // Optimistic UI
    const item = this._creditos.find(c => c.id === id);
    if (item) item.visible = visible;
    this._renderCreditos();

    try {
      const { error } = await this.client
        .from('creditos')
        .update({
          visible,
          updated_at:      new Date().toISOString(),
          actualizado_por: window.usuarioActual?.email ?? '',
        })
        .eq('id', id);

      if (error) throw error;

      window.ErrorHandler?.showToast(visible ? 'Visible en página' : 'Oculto en página', 'success');

    } catch (err) {
      console.error('[ConfiguracionManager] toggleVisible:', err);
      // Revertir
      if (item) item.visible = !visible;
      this._renderCreditos();
      window.ErrorHandler?.showToast('Error al actualizar visibilidad', 'error');
    }
  }

  // ══════════════════════════════════════════════════════
  // reordenar — ↑↓ dentro de la misma sección
  // ══════════════════════════════════════════════════════

  async reordenar(id, direccion) {
    const item = this._creditos.find(c => c.id === id);
    if (!item) return;

    const peers = this._creditos
      .filter(c => c.seccion === item.seccion)
      .sort((a, b) => a.orden - b.orden);

    const idx     = peers.findIndex(c => c.id === id);
    const swapIdx = direccion === 'up' ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= peers.length) return;

    const swapItem = peers[swapIdx];
    const oldOrden = item.orden;
    const newOrden = swapItem.orden;

    // Swap en caché
    item.orden     = newOrden;
    swapItem.orden = oldOrden;
    this._renderCreditos();

    try {
      await Promise.all([
        this.client.from('creditos').update({ orden: newOrden }).eq('id', item.id),
        this.client.from('creditos').update({ orden: oldOrden }).eq('id', swapItem.id),
      ]);
    } catch (err) {
      console.error('[ConfiguracionManager] reordenar:', err);
      // Revertir
      item.orden     = oldOrden;
      swapItem.orden = newOrden;
      this._renderCreditos();
      window.ErrorHandler?.showToast('Error al reordenar', 'error');
    }
  }

  // ══════════════════════════════════════════════════════
  // openEditModal — usa ModalManager con API de name/defaultValue
  // ══════════════════════════════════════════════════════

  openEditModal(id) {
    const credito = this._creditos.find(c => c.id === id);
    if (!credito) return;

    const cargoEditable = credito.editable_cargo;

    // Construir campos según editabilidad
    const fields = [
      {
        name:         'nombre',
        type:         'text',
        label:        'Nombre',
        defaultValue: credito.nombre,
        required:     true,
      },
    ];

    if (cargoEditable) {
      fields.push({
        name:         'cargo',
        type:         'text',
        label:        'Cargo',
        defaultValue: credito.cargo,
        required:     true,
      });
    } else {
      // Cargo fijo — mostrarlo como info, no editable
      fields.push({
        name:         'cargo_info',
        type:         'text',
        label:        `Cargo (fijo: "${credito.cargo}")`,
        defaultValue: credito.cargo,
        required:     false,
      });
    }

    window.ModalManager?.open({
      title:      'Editar crédito',
      submitText: 'Guardar',
      fields,
      onSave: async (values) => {
        const nombre = values.nombre?.trim();
        const cargo  = cargoEditable
          ? (values.cargo?.trim() || credito.cargo)
          : credito.cargo;

        if (!nombre) {
          window.ErrorHandler?.showToast('El nombre es obligatorio', 'error');
          return false;   // mantiene el modal abierto
        }

        try {
          const { error } = await this.client
            .from('creditos')
            .update({
              nombre,
              cargo,
              updated_at:      new Date().toISOString(),
              actualizado_por: window.usuarioActual?.email ?? '',
            })
            .eq('id', id);

          if (error) throw error;

          const item = this._creditos.find(c => c.id === id);
          if (item) { item.nombre = nombre; item.cargo = cargo; }

          this._renderCreditos();
          window.ErrorHandler?.showToast('Crédito actualizado', 'success');

        } catch (err) {
          console.error('[ConfiguracionManager] editarCredito:', err);
          window.ErrorHandler?.showToast('Error al guardar', 'error');
          return false;
        }
      },
    });
  }

  // ══════════════════════════════════════════════════════
  // openCreateModal
  // ══════════════════════════════════════════════════════

  openCreateModal(seccion) {
    const labels = {
      unam:      'Agregar cargo UNAM',
      fad:       'Agregar cargo FAD',
      taller:    'Agregar profesor al Taller',
      webmaster: 'Agregar Webmaster',
    };

    const maxOrden = this._creditos
      .filter(c => c.seccion === seccion)
      .reduce((max, c) => Math.max(max, c.orden), 0);

    window.ModalManager?.open({
      title:      labels[seccion] ?? 'Agregar crédito',
      submitText: 'Agregar',
      fields: [
        {
          name:         'nombre',
          type:         'text',
          label:        'Nombre',
          required:     true,
          defaultValue: '',
        },
        {
          name:         'cargo',
          type:         'text',
          label:        'Cargo',
          required:     true,
          defaultValue: '',
        },
        {
          name:         'visible',
          type:         'select',
          label:        'Visible en página pública',
          defaultValue: 'si',
          options: [
            { value: 'si', label: 'Sí — mostrar en página' },
            { value: 'no', label: 'No — ocultar por ahora' },
          ],
        },
      ],
      onSave: async (values) => {
        const nombre  = values.nombre?.trim();
        const cargo   = values.cargo?.trim();
        const visible = values.visible !== 'no';

        if (!nombre) {
          window.ErrorHandler?.showToast('El nombre es obligatorio', 'error');
          return false;
        }
        if (!cargo) {
          window.ErrorHandler?.showToast('El cargo es obligatorio', 'error');
          return false;
        }

        try {
          const { data, error } = await this.client
            .from('creditos')
            .insert({
              seccion,
              nombre,
              cargo,
              visible,
              tipo:            'custom',
              editable_cargo:  true,
              orden:           maxOrden + 1,
              actualizado_por: window.usuarioActual?.email ?? '',
            })
            .select('*')
            .single();

          if (error) throw error;

          this._creditos.push(data);
          this._renderCreditos();
          window.ErrorHandler?.showToast('Crédito agregado', 'success');

        } catch (err) {
          console.error('[ConfiguracionManager] agregarCredito:', err);
          window.ErrorHandler?.showToast('Error al agregar', 'error');
          return false;
        }
      },
    });
  }

  // ══════════════════════════════════════════════════════
  // deleteCredito
  // ══════════════════════════════════════════════════════

  deleteCredito(id, nombre) {
    const credito = this._creditos.find(c => c.id === id);

    if (!credito || credito.tipo === 'fijo') {
      window.ErrorHandler?.showToast('Este crédito no se puede eliminar', 'error');
      return;
    }

    window.ModalManager?.openConfirm({
      title:       '¿Eliminar crédito?',
      message:     `"${nombre}" será eliminado de los créditos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText:  'Cancelar',
      onConfirm:   async () => {
        try {
          const { error } = await this.client
            .from('creditos')
            .delete()
            .eq('id', id);

          if (error) throw error;

          this._creditos = this._creditos.filter(c => c.id !== id);
          this._renderCreditos();
          window.ErrorHandler?.showToast('Crédito eliminado', 'success');

        } catch (err) {
          console.error('[ConfiguracionManager] deleteCredito:', err);
          window.ErrorHandler?.showToast('Error al eliminar', 'error');
        }
      },
    });
  }
}

// ── Instancia global ──────────────────────────────────────────────
window.configuracionManager = new ConfiguracionManager();

// ── Helper escaping (local) ───────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

console.log('⚙️  configuracion.js cargado');
