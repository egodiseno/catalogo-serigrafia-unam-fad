// app/js/public-catalog.js
// Grid catálogo dinámico + filtros real-time + infinite scroll (mobile) / paginación (desktop)

import { api } from './api-client.js';
import { i18n } from './i18n.js';

export class PublicCatalog {
  constructor() {
    this.works = [];
    this.page = 1;
    this.pageSize = 8;
    this.totalWorks = 0;
    this.isLoading = false;
    this.isDesktop = window.innerWidth >= 1200;
    this._paginationSetup = false;
    this._infiniteScrollSetup = false;

    this.filters = {
      year: '',
      technique: '',
      tags: [],
      search: ''
    };

    this.yearOptions = [];
    this.techniqueOptions = [];
    this.tagOptions = [];
  }

  async init() {
    try {
      console.log('🚀 Inicializando catálogo...');

      // Cargar opciones de filtro
      await this.loadFilterOptions();

      // Cargar primeras obras
      await this.loadWorks();

      // Attach event listeners
      this.attachEventListeners();

      // Toggle acordeón de filtros (mobile)
      this.initFilterToggle();

      // Setup scroll infinito (mobile/tablet) o paginación (desktop)
      if (this.isDesktop) {
        this._paginationSetup = true;
        this.setupPagination();
      } else {
        this._infiniteScrollSetup = true;
        this.setupInfiniteScroll();
      }
      this.setupBreakpointListener();

      // Sincronizar top de filtros con altura real del header
      this.syncFiltersTop();

      console.log('✅ Catálogo inicializado');
    } catch (error) {
      console.error('❌ Error inicializando catálogo:', error);
    }
  }

  /**
   * Mide la altura real del .site-header y escribe --filters-top en :root.
   * Un ResizeObserver garantiza que se recalcule en cualquier breakpoint.
   */
  syncFiltersTop() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const update = () => {
      const h = header.offsetHeight;
      document.documentElement.style.setProperty('--filters-top', `${h}px`);
    };

    // Medición inicial
    update();

    // Re-medir automáticamente al cambiar el tamaño del header (breakpoints, resize, etc.)
    const ro = new ResizeObserver(update);
    ro.observe(header);
  }

  /**
   * Toggle acordeón de filtros para mobile (< 768px).
   * En tablet/desktop el panel es siempre visible vía CSS.
   */
  initFilterToggle() {
    const toggle = document.querySelector('[data-filter-toggle]');
    const panel  = document.getElementById('filterPanel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));

      const label = toggle.querySelector('.filter-toggle__label');
      if (label) {
        label.textContent = isOpen ? 'Ocultar filtros' : 'Mostrar filtros';
      }
    });
  }

  /**
   * Cargar opciones de filtro (años, técnicas, tags)
   */
  async loadFilterOptions() {
    console.log('📥 Cargando opciones de filtro...');

    const [years, techniques, tags] = await Promise.all([
      api.getYears(),
      api.getTechniques(),
      api.getTags()
    ]);

    this.yearOptions = years;
    this.techniqueOptions = techniques;
    this.tagOptions = tags;

    this.populateFilterOptions();
  }

  /**
   * Llenar dropdowns y checkboxes con opciones
   */
  populateFilterOptions() {
    // Años
    const yearSelect = document.querySelector('[data-filter="year"]');
    if (yearSelect) {
      this.yearOptions.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
      });
      console.log(`✅ ${this.yearOptions.length} años cargados`);
    }

    // Técnicas
    const techniqueSelect = document.querySelector('[data-filter="technique"]');
    if (techniqueSelect) {
      this.techniqueOptions.forEach(tech => {
        const option = document.createElement('option');
        option.value = tech.id;
        option.textContent = tech.nombre;
        techniqueSelect.appendChild(option);
      });
      console.log(`✅ ${this.techniqueOptions.length} técnicas cargadas`);
    }

    // Tags popover
    const tagsGrid = document.getElementById('tagsGrid');
    console.log('DEBUG populateFilterOptions — tagsGrid:', !!tagsGrid, '| tagOptions:', this.tagOptions.length);
    if (tagsGrid) {
      this.tagOptions.forEach(tag => {
        console.log('  - tag:', tag.id, tag.nombre);
        const label = document.createElement('label');
        label.className = 'tag-checkbox-label';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = tag.id;
        input.setAttribute('data-tag-id', tag.id);

        const span = document.createElement('span');
        span.textContent = tag.nombre;

        label.appendChild(input);
        label.appendChild(span);
        tagsGrid.appendChild(label);
      });
      console.log(`✅ ${this.tagOptions.length} tags cargados`);
    }
  }

  /**
   * Attach event listeners a filtros, búsqueda, etc.
   */
  attachEventListeners() {
    // Popover tags
    const tagsPopoverBtn = document.getElementById('tagsPopoverBtn');
    const tagsPopover = document.getElementById('tagsPopover');
    const tagsGrid = document.getElementById('tagsGrid');

    if (tagsPopoverBtn && tagsPopover) {
      tagsPopoverBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = tagsPopover.hasAttribute('hidden');
        if (isHidden) {
          tagsPopover.removeAttribute('hidden');
          tagsPopoverBtn.setAttribute('aria-expanded', 'true');
        } else {
          tagsPopover.setAttribute('hidden', '');
          tagsPopoverBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Cerrar al hacer click fuera
      document.addEventListener('click', (e) => {
        if (!tagsPopoverBtn.contains(e.target) && !tagsPopover.contains(e.target)) {
          tagsPopover.setAttribute('hidden', '');
          tagsPopoverBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Checkboxes dentro del popover
      if (tagsGrid) {
        tagsGrid.addEventListener('change', () => {
          this.handleFilterChange();
        });
      }
    }

    // Botón limpiar todos los tags (footer del popover)
    const tagsRemoveBtn = document.getElementById('tagsRemoveBtn');
    if (tagsRemoveBtn) {
      tagsRemoveBtn.addEventListener('click', () => {
        document.querySelectorAll('[data-tag-id]').forEach(cb => { cb.checked = false; });
        this.handleFilterChange();
      });
    }

    // Debug logs popover
    console.log('🔍 Tags popover debug:');
    console.log('  - tagsPopoverBtn existe:', !!tagsPopoverBtn);
    console.log('  - tagsPopover existe:', !!tagsPopover);
    console.log('  - tagsGrid existe:', !!tagsGrid);
    console.log('  - Checkboxes en grid:', tagsGrid?.querySelectorAll('input').length ?? 0);
    console.log('  - tagsRemoveBtn existe:', !!document.getElementById('tagsRemoveBtn'));
    console.log('  - tagsChipsContainer existe:', !!document.getElementById('tagsChipsContainer'));

    // Filtros (cambio real-time)
    const filterForm = document.querySelector('[data-filters]');
    if (filterForm) {
      const inputs = filterForm.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.addEventListener('change', () => this.handleFilterChange());
      });
    }

    // Botón limpiar filtros
    const clearBtn = document.querySelector('[data-clear]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFilters());
    }

    // Botón cargar más
    const loadMoreBtn = document.querySelector('[data-loadmore]');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadMore());
    }

    // Búsqueda (debounced)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce((e) => {
        this.filters.search = e.target.value;
        this.page = 1;
        this.loadWorks();
      }, 300));
    }

    console.log('✅ Event listeners attached');
  }

  /**
   * Manejar cambios en filtros (real-time)
   */
  async handleFilterChange() {
    const yearSelect = document.querySelector('[data-filter="year"]');
    const techniqueSelect = document.querySelector('[data-filter="technique"]');
    const tagCheckboxes = document.querySelectorAll('[data-tag-id]');
    const selectedTags = Array.from(tagCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    this.filters.year = yearSelect?.value || '';
    this.filters.technique = techniqueSelect?.value || '';
    this.filters.tags = selectedTags;

    this.page = 1;
    await this.loadWorks();
    this.updateActiveFilterChips();
  }

  /**
   * Cargar obras desde Supabase
   */
  async loadWorks() {
    this.isLoading = true;
    this.showLoadingSpinner();

    try {
      const { data, total, error } = await api.filterWorks(
        this.filters,
        this.page,
        this.pageSize
      );

      if (error) {
        console.error('❌ Error cargando obras:', error);
        this.showEmptyState();
        return;
      }

      if (data.length === 0 && this.page === 1) {
        this.showEmptyState();
        return;
      } else if (data.length === 0 && this.page > 1) {
        this.hideLoadingSpinner();
        this.page--;
        return;
      }

      this.works = data;
      this.totalWorks = total;
      this.renderGrid();
    } catch (error) {
      console.error('❌ Error:', error);
      this.showEmptyState();
    } finally {
      this.isLoading = false;
      this.hideLoadingSpinner();
    }
  }

  /**
   * Renderizar grid dinámico
   */
  renderGrid() {
    const grid = document.querySelector('[data-grid]');
    if (!grid) return;

    grid.innerHTML = this.works
      .map(work => this.createArtworkCard(work))
      .join('');

    // Actualizar Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Actualizar contador
    this.updateCounter();

    // Actualizar controles de navegación según modo de viewport
    if (this.isDesktop) {
      const loadMoreWrap = document.querySelector('[data-loadmore-wrap]');
      if (loadMoreWrap) loadMoreWrap.setAttribute('hidden', '');
      this.renderPagination();
    } else {
      const paginationNav = document.querySelector('[data-pagination]');
      if (paginationNav) { paginationNav.setAttribute('hidden', ''); paginationNav.innerHTML = ''; }
      this.updateLoadMoreButton();
    }

    console.log(`✅ Grid renderizado: ${this.works.length} obras`);
  }

  /**
   * Crear HTML de una card de obra
   */
  createArtworkCard(work) {
    // imagenes.principal es boolean (true = imagen principal)
    const imgs = work.imagenes || [];
    const mainImage = imgs.find(img => img.principal === true) || imgs[0] || null;
    const imageUrl = mainImage?.url_storage || '';
    const technique = Array.isArray(work.tecnica) ? work.tecnica[0] : work.tecnica;
    const hasTechnique = technique?.nombre || null;

    // tags: obra_tags[].tag.nombre  (puede ser array de {tag:{id,nombre,slug}})
    const tagItems = (work.tags || [])
      .map(t => t?.tag?.nombre)
      .filter(Boolean);

    return `
      <li>
        <a href="obra.html?slug=${work.slug || work.id}" class="artwork-card" aria-label="${work.titulo} — ${work.artista}">
          <div class="artwork-card__media ${!imageUrl ? 'is-empty' : ''}">
            ${imageUrl ? `<img src="${imageUrl}" alt="${work.titulo}" loading="lazy" />` : ''}
            ${hasTechnique ? `<span class="artwork-card__badge">${hasTechnique}</span>` : ''}
          </div>
          <div class="artwork-card__body">
            <h3 class="artwork-card__title">${work.titulo}</h3>
            <dl class="artwork-card__meta">
              <dt hidden>Artista</dt>
              <dd class="artwork-card__meta-artist">${work.artista.toUpperCase()}</dd>
              <dt hidden>Año y técnica</dt>
              <dd class="artwork-card__meta-detail">${work.año}${hasTechnique ? ` • ${hasTechnique}` : ''}</dd>
            </dl>
            ${tagItems.length > 0 ? `
              <div class="artwork-card__tags">
                ${tagItems.slice(0, 2).map(n => `<span class="tag-small">${n}</span>`).join('')}
              </div>
            ` : ''}
            <button type="button" class="artwork-card__cta">
              <span data-i18n data-es="Ver obra" data-en="View work">Ver obra</span>
              <i data-lucide="arrow-right"></i>
            </button>
          </div>
        </a>
      </li>
    `;
  }

  /**
   * Actualizar contador de obras
   */
  updateCounter() {
    const counter = document.querySelector('[data-count]');
    if (counter) {
      const shown = this.page * this.pageSize;
      const total = this.totalWorks;
      const displayShown = Math.min(shown, total);

      const text = i18n.currentLang === 'es'
        ? `Mostrando ${displayShown} de ${total}`
        : `Showing ${displayShown} of ${total}`;

      counter.textContent = text;
      counter.setAttribute('aria-label', text);
    }
  }

  /**
   * Actualizar estado del botón "Cargar más"
   */
  updateLoadMoreButton() {
    const loadMoreWrap = document.querySelector('[data-loadmore-wrap]');
    const loadMoreBtn = document.querySelector('[data-loadmore]');

    if (!loadMoreBtn) return;

    const shown = this.page * this.pageSize;
    const hasMore = shown < this.totalWorks;

    if (hasMore) {
      loadMoreWrap?.removeAttribute('hidden');
      loadMoreBtn?.removeAttribute('disabled');
    } else {
      loadMoreWrap?.setAttribute('hidden', '');
      loadMoreBtn?.setAttribute('disabled', '');
      this.hideLoadingSpinner();
    }
  }

  /**
   * Mostrar empty state
   */
  showEmptyState() {
    const emptyState = document.querySelector('[data-empty]');
    const grid = document.querySelector('[data-grid]');

    if (emptyState) {
      emptyState.removeAttribute('hidden');
    }
    if (grid) {
      grid.innerHTML = '';
    }
  }

  /**
   * Mostrar/ocultar loading spinner
   */
  showLoadingSpinner() {
    const spinner = document.querySelector('[data-loading]');
    if (spinner) {
      spinner.removeAttribute('hidden');
    }
  }

  hideLoadingSpinner() {
    const spinner = document.querySelector('[data-loading]');
    if (spinner) {
      spinner.setAttribute('hidden', '');
    }
  }

  /**
   * Actualizar chips de filtros activos (año, técnica) y chips inline de tags
   */
  updateActiveFilterChips() {
    // ── 1. Chips de año y técnica en la barra [data-active-filters] ──────────
    const container = document.querySelector('[data-active-filters]');
    if (container) {
      const chips = [];

      if (this.filters.year) {
        chips.push({ label: `Año: ${this.filters.year}`, type: 'year' });
      }

      if (this.filters.technique) {
        const tech = this.techniqueOptions.find(t => String(t.id) === String(this.filters.technique));
        if (tech) {
          chips.push({ label: `Técnica: ${tech.nombre}`, type: 'technique' });
        }
      }

      if (chips.length === 0) {
        container.setAttribute('hidden', '');
        container.innerHTML = '';
      } else {
        container.removeAttribute('hidden');
        container.innerHTML = chips
          .map(
            chip => `
              <div class="filter-chip">
                ${chip.label}
                <button type="button" data-remove="${chip.type}" aria-label="Quitar ${chip.label}">
                  <i data-lucide="x" style="width:13px;height:13px;"></i>
                </button>
              </div>
            `
          )
          .join('');

        container.querySelectorAll('[data-remove]').forEach(btn => {
          btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-remove');
            if (type === 'year') {
              document.querySelector('[data-filter="year"]').value = '';
            } else if (type === 'technique') {
              document.querySelector('[data-filter="technique"]').value = '';
            }
            this.handleFilterChange();
          });
        });

        if (window.lucide) window.lucide.createIcons();
      }
    }

    // ── 2. Chips individuales de tags inline bajo el botón ───────────────────
    const tagsChipsContainer = document.getElementById('tagsChipsContainer');
    if (!tagsChipsContainer) return;

    const selectedTags = this.filters.tags || [];

    // Mostrar/ocultar footer del popover ("Limpiar selección")
    const tagsPopoverFooter = document.getElementById('tagsPopoverFooter');
    if (tagsPopoverFooter) {
      if (selectedTags.length > 0) {
        tagsPopoverFooter.removeAttribute('hidden');
      } else {
        tagsPopoverFooter.setAttribute('hidden', '');
      }
    }

    if (selectedTags.length === 0) {
      tagsChipsContainer.innerHTML = '';
      return;
    }

    tagsChipsContainer.innerHTML = selectedTags
      .map(tagId => {
        const tagOption = this.tagOptions.find(t => String(t.id) === String(tagId));
        const tagName = tagOption?.nombre || tagId;
        return `
          <span class="tag-chip">
            ${tagName}
            <button type="button" aria-label="Quitar tag ${tagName}" data-remove-tag="${tagId}">
              <i data-lucide="x" style="width:11px;height:11px;"></i>
            </button>
          </span>
        `;
      })
      .join('');

    // Listeners para quitar un tag individual
    tagsChipsContainer.querySelectorAll('[data-remove-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tagId = btn.getAttribute('data-remove-tag');
        const checkbox = document.querySelector(`[data-tag-id="${tagId}"]`);
        if (checkbox) checkbox.checked = false;
        this.handleFilterChange();
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Cargar más obras (infinite scroll o botón)
   */
  async loadMore() {
    if (this.page * this.pageSize >= this.totalWorks) {
      this.hideLoadingSpinner();
      return;
    }
    this.page++;
    await this.loadWorks();
    // Auto-scroll a nuevos items
    window.scrollBy({ top: 400, behavior: 'smooth' });
  }

  /**
   * Limpiar filtros
   */
  clearFilters() {
    this.filters = {
      year: '',
      technique: '',
      tags: [],
      search: ''
    };

    // Reset form
    document.querySelector('[data-filter="year"]').value = '';
    document.querySelector('[data-filter="technique"]').value = '';
    document.querySelectorAll('[data-tag-id]').forEach(cb => { cb.checked = false; });
    document.getElementById('searchInput').value = '';

    this.page = 1;
    this.loadWorks();
    this.updateActiveFilterChips();
  }

  /**
   * Setup paginación para desktop (≥ 1200px)
   * Delegación de eventos en el nav [data-pagination]
   */
  setupPagination() {
    const nav = document.querySelector('[data-pagination]');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;

      const target = btn.getAttribute('data-page');
      const totalPages = Math.ceil(this.totalWorks / this.pageSize);

      if (target === 'prev') {
        if (this.page > 1) { this.page--; this.loadWorks(); }
      } else if (target === 'next') {
        if (this.page < totalPages) { this.page++; this.loadWorks(); }
      } else {
        const p = parseInt(target, 10);
        if (!isNaN(p) && p !== this.page) { this.page = p; this.loadWorks(); }
      }
    });
  }

  /**
   * Renderizar controles de paginación dentro de [data-pagination]
   */
  renderPagination() {
    const nav = document.querySelector('[data-pagination]');
    if (!nav) return;

    const totalPages = Math.ceil(this.totalWorks / this.pageSize);

    if (totalPages <= 1) {
      nav.setAttribute('hidden', '');
      nav.innerHTML = '';
      return;
    }

    nav.removeAttribute('hidden');

    const pages = this.getPaginationRange(this.page, totalPages);
    const prevDisabled = this.page === 1;
    const nextDisabled = this.page === totalPages;

    const pageBtn = (p) => {
      const isActive = p === this.page;
      const cls = ['pagination-btn', isActive ? 'pagination-btn--active' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-page="${p}"
        ${isActive ? 'aria-current="page" disabled' : ''}
        aria-label="Página ${p}">${p}</button>`;
    };

    nav.innerHTML = `
      <button type="button"
        class="pagination-btn pagination-btn--nav${prevDisabled ? ' pagination-btn--disabled' : ''}"
        data-page="prev" ${prevDisabled ? 'disabled' : ''}
        aria-label="Página anterior">‹</button>
      ${pages.map(p => p === '…'
        ? '<span class="pagination-ellipsis">…</span>'
        : pageBtn(p)
      ).join('')}
      <button type="button"
        class="pagination-btn pagination-btn--nav${nextDisabled ? ' pagination-btn--disabled' : ''}"
        data-page="next" ${nextDisabled ? 'disabled' : ''}
        aria-label="Página siguiente">›</button>
    `;
  }

  /**
   * Calcula el rango de páginas visibles (máx. 5 números + ellipsis)
   */
  getPaginationRange(current, total) {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const left  = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);
    const range = [1];

    if (left > 2)          range.push('…');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < total - 1) range.push('…');
    range.push(total);

    return range;
  }

  /**
   * Detecta cruce del breakpoint 1200px y cambia entre modos sin recargar
   */
  setupBreakpointListener() {
    let prevDesktop = this.isDesktop;

    const onResize = this.debounce(() => {
      const nowDesktop = window.innerWidth >= 1200;
      if (nowDesktop === prevDesktop) return;

      prevDesktop = nowDesktop;
      this.isDesktop = nowDesktop;

      if (nowDesktop && !this._paginationSetup) {
        this._paginationSetup = true;
        this.setupPagination();
      } else if (!nowDesktop && !this._infiniteScrollSetup) {
        this._infiniteScrollSetup = true;
        this.setupInfiniteScroll();
      }

      this.page = 1;
      this.loadWorks();
    }, 200);

    window.addEventListener('resize', onResize);
  }

  /**
   * Setup infinite scroll con Intersection Observer
   */
  setupInfiniteScroll() {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !this.isLoading) {
          const loadMoreBtn = document.querySelector('[data-loadmore]');
          const hasMore = this.totalWorks > 0 && this.page * this.pageSize < this.totalWorks;
          if (loadMoreBtn && !loadMoreBtn.disabled && hasMore) {
            this.loadMore();
          } else {
            this.hideLoadingSpinner();
          }
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = document.querySelector('[data-loadmore-wrap]');
    if (sentinel) {
      observer.observe(sentinel);
    }
  }

  /**
   * Debounce helper
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}
