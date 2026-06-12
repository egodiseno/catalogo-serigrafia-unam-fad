/**
 * sort-manager.js — Gestor de ordenamiento para tablas
 * FASE 2 — Dropdown ordenable visible en mobile/tablet
 *
 * Expone: window.sortManager  (.registerTable / .getSort / .setSort / .mountDropdown)
 * Depende de: DOM listo (cargado con defer)
 *
 * Visibilidad del dropdown: 100% CSS — display:none por defecto,
 * display:flex en @media (max-width:1023px). No requiere resize listener.
 */

class SortManager {
  constructor() {
    this._tables = {};   // { tableId: { options[], current: {field, direction} } }
  }

  // ── API pública ────────────────────────────────────────

  /**
   * Registrar opciones de ordenamiento para una tabla.
   * Debe llamarse antes de la primera carga de datos.
   *
   * @param {string} tableId    — clase CSS del <table> (e.g. 'obras-table')
   * @param {Array}  options    — [{label, field}]
   * @param {Object} [defaults] — {field, direction}; por defecto: options[0].field, 'desc'
   */
  registerTable(tableId, options, defaults = {}) {
    this._tables[tableId] = {
      options,
      current: {
        field:     defaults.field     ?? options[0]?.field ?? 'created_at',
        direction: defaults.direction ?? 'desc',
      },
    };
    console.log(`[SortManager] ✔ ${tableId} registrada`);
  }

  /** Devuelve { field, direction } del estado actual. */
  getSort(tableId) {
    return this._tables[tableId]?.current ?? { field: 'created_at', direction: 'desc' };
  }

  /**
   * Cambiar campo/dirección:
   *   - mismo campo        → invierte dirección
   *   - campo nuevo        → usa 'desc' como default
   *   - direction explícita → aplica directamente
   */
  setSort(tableId, field, direction = null) {
    const entry = this._tables[tableId];
    if (!entry) return null;

    if (direction !== null) {
      entry.current.field     = field;
      entry.current.direction = direction;
    } else if (entry.current.field === field) {
      entry.current.direction = entry.current.direction === 'asc' ? 'desc' : 'asc';
    } else {
      entry.current.field     = field;
      entry.current.direction = 'desc';
    }

    return { ...entry.current };
  }

  /**
   * Crear e inyectar el dropdown antes de la <table>.
   * La visibilidad se gestiona solo con CSS (media query ≤1023px).
   *
   * @param {string}   tableId  — clase CSS del <table>
   * @param {Function} onSort   — callback({field, direction}) tras cambio de sort
   */
  mountDropdown(tableId, onSort) {
    const entry = this._tables[tableId];
    if (!entry) {
      console.warn(`[SortManager] tabla "${tableId}" no registrada — llama registerTable() primero`);
      return;
    }

    const table = document.querySelector(`table.${tableId}`);
    if (!table) {
      console.warn(`[SortManager] <table class="${tableId}"> no encontrada en el DOM`);
      return;
    }

    // Eliminar dropdown anterior si ya existe
    document.getElementById(`sort-dropdown-${tableId}`)?.remove();

    const { current, options } = entry;
    const selectId = `sort-select-${tableId}`;

    const wrapper = document.createElement('div');
    wrapper.id        = `sort-dropdown-${tableId}`;
    wrapper.className = 'sort-dropdown-wrapper';
    wrapper.setAttribute('aria-label', 'Ordenar resultados');

    wrapper.innerHTML = `
      <span class="sort-label" aria-hidden="true">Ordenar por:</span>
      <select id="${selectId}"
              class="sort-select"
              aria-label="Campo de ordenamiento">
        ${options.map(opt => `
          <option value="${opt.field}"${current.field === opt.field ? ' selected' : ''}>
            ${opt.label}
          </option>`).join('')}
      </select>
      <button type="button"
              class="sort-toggle"
              aria-label="${current.direction === 'asc' ? 'Ascendente, clic para invertir' : 'Descendente, clic para invertir'}">
        <i data-lucide="${current.direction === 'asc' ? 'arrow-up' : 'arrow-down'}"
           style="width:16px;height:16px;" aria-hidden="true"></i>
      </button>
    `;

    // Insertar justo antes de la <table> (dentro del .table-wrapper)
    table.parentElement.insertBefore(wrapper, table);
    window.IconRegistry?.init();

    // ── Listeners ─────────────────────────────────────────
    const select    = wrapper.querySelector('select');
    const toggleBtn = wrapper.querySelector('.sort-toggle');

    select.addEventListener('change', () => {
      const newSort = this.setSort(tableId, select.value);
      this._updateToggleIcon(toggleBtn, newSort.direction);
      onSort?.(newSort);
    });

    toggleBtn.addEventListener('click', () => {
      const newSort = this.setSort(tableId, entry.current.field);
      this._updateToggleIcon(toggleBtn, newSort.direction);
      onSort?.(newSort);
    });
  }

  // ── Privado ────────────────────────────────────────────

  _updateToggleIcon(btn, direction) {
    const iconName = direction === 'asc' ? 'arrow-up' : 'arrow-down';
    const ariaLabel = direction === 'asc'
      ? 'Ascendente, clic para invertir'
      : 'Descendente, clic para invertir';

    btn.setAttribute('aria-label', ariaLabel);

    const i = btn.querySelector('i[data-lucide]');
    if (i) {
      i.setAttribute('data-lucide', iconName);
      window.IconRegistry?.init();
    }
  }
}

window.sortManager = new SortManager();
console.log('⬆️ sort-manager.js cargado');
