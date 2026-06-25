// app/js/public-catalog.js
// Grid catálogo dinámico + filtros real-time + infinite scroll (mobile) / paginación (desktop)

import { api } from './api-client.js';
import { i18n } from './i18n.js';

// ── Módulo de Favoritos ────────────────────────────────────────────────────
// Fuente de verdad: tabla obra_favoritos en Supabase.
// Identificador anónimo: session_id (UUID v4) persistido en localStorage bajo
// la clave 'catalogo_session_id'. Sin datos personales.
//
// Flujo:
//   init(api)  → carga los obra_id del visitante desde Supabase → llena _set
//   has(id)    → consulta _set en memoria (síncrono, O(1))
//   toggle(id) → actualiza _set en memoria inmediatamente (UI responde al instante)
//                + dispara insert/delete a Supabase en segundo plano
//                + rollback silencioso en _set si Supabase falla
const Favoritos = (() => {
  const SESSION_KEY = 'catalogo_session_id';

  // Conjunto en memoria de obra_ids favoritos del visitante actual.
  // Poblado por init() antes del primer renderizado del grid.
  let _set = new Set();

  // Referencia al objeto api (inyectada en init() para evitar dependencia circular)
  let _api = null;

  /**
   * Recupera o genera el session_id anónimo del visitante.
   * Persiste en localStorage para sobrevivir recargas de página.
   * @returns {string} UUID v4
   */
  function _getSessionId() {
    let id;
    try { id = localStorage.getItem(SESSION_KEY); } catch { id = null; }
    if (!id) {
      id = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      try { localStorage.setItem(SESSION_KEY, id); } catch { /* silencioso */ }
    }
    return id;
  }

  return {
    /**
     * Cargar favoritos desde Supabase. Llamar antes del primer renderizado.
     * @param {object} apiInstance - objeto api importado de api-client.js
     */
    async init(apiInstance) {
      _api = apiInstance;
      try {
        const ids = await _api.getFavorites(_getSessionId());
        _set = new Set(ids);
        console.log(`❤️ Favoritos cargados: ${_set.size}`);
      } catch {
        _set = new Set(); // fallback vacío — silencioso
      }
    },

    /** @param {string} id UUID de la obra */
    has(id) { return _set.has(id); },

    /**
     * Alterna el favorito con actualización optimista de UI.
     * La sincronización con Supabase ocurre en segundo plano.
     * @param {string} id - UUID de la obra
     * @returns {boolean} true si quedó marcado como favorito
     */
    toggle(id) {
      const isNowFav = !_set.has(id);
      isNowFav ? _set.add(id) : _set.delete(id);

      if (!_api) return isNowFav; // guard: api aún no inicializada

      const sessionId = _getSessionId();
      if (isNowFav) {
        _api.addFavorite(sessionId, id).then(ok => {
          if (!ok) {
            _set.delete(id); // rollback silencioso en memoria
            console.warn('⚠️ No se pudo guardar el favorito en Supabase');
          }
        });
      } else {
        _api.removeFavorite(sessionId, id).then(ok => {
          if (!ok) {
            _set.add(id); // rollback silencioso en memoria
            console.warn('⚠️ No se pudo eliminar el favorito de Supabase');
          }
        });
      }

      return isNowFav;
    },

    /** @returns {string[]} array de UUIDs */
    getAll() { return [..._set]; },
    count()  { return _set.size; },
  };
})();

export class PublicCatalog {
  constructor() {
    this.works = [];
    this.page = 1;
    this.isDesktop = window.innerWidth >= 1200;
    this.pageSize = this.isDesktop ? 8 : 12;
    this.totalWorks = 0;
    this.isLoading = false;
    this.appendMode = false;
    this._paginationSetup = false;
    this._infiniteScrollSetup = false;

    this.filters = {
      year: '',
      technique: '',
      tags: [],
      search: '',
      onlyFav: false
    };

    this.yearOptions = [];
    this.techniqueOptions = [];
    this.tagOptions = [];

    // Exponer Favoritos al nivel de instancia (útil para tests/consola)
    this.Favoritos = Favoritos;

    // ── Campos de restauración de estado de navegación ───────────────────────
    // Usados para volver al mismo punto del catálogo desde una ficha de obra.
    this._restoringState     = false; // true mientras se reconstruye el estado mobile
    this._restoreScrollY     = 0;     // scrollY guardado a restaurar
    this._restoredPagesCount = 1;     // número de páginas que estaban cargadas (mobile)
  }

  async init() {
    try {
      // Activar íconos Lucide de los elementos estáticos del hero (stats, etc.)
      if (window.lucide) window.lucide.createIcons();

      // Cargar opciones de filtro + estadísticas del hero + favoritos en paralelo
      await Promise.all([
        this.loadFilterOptions(),
        this.loadStats(),
        Favoritos.init(api), // carga obra_ids desde Supabase antes del primer render
      ]);

      // PASO 2 — Leer ?q= de la URL y pre-aplicar como filtro de búsqueda inicial
      const _urlParams = new URLSearchParams(window.location.search);
      const _qParam    = _urlParams.get('q');
      if (_qParam) {
        this.filters.search = _qParam.trim();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = _qParam.trim();
      }

      // ── Restaurar estado de navegación al regresar de una ficha de obra ──────
      // Condición: URL tiene ?from=obra (link explícito) O referrer es obra.html
      //   (botón Atrás del navegador). Si hay ?q= el usuario llegó por búsqueda
      //   y se arranca desde cero.
      const _fromObra   = _urlParams.get('from') === 'obra'
                       || document.referrer.includes('obra.html');
      const _savedState = this._loadState();

      if (_fromObra && _savedState && !_qParam) {
        if (this.isDesktop) {
          // Desktop: saltar directamente a la página guardada
          this.page = Math.max(1, _savedState.page || 1);
        } else {
          // Mobile: ampliar pageSize para cargar todas las páginas acumuladas
          // en una sola query, luego restaurar el scroll.
          this._restoringState     = true;
          this._restoreScrollY     = _savedState.scrollY || 0;
          this._restoredPagesCount = Math.max(1, _savedState.page || 1);
          this.pageSize            = this._restoredPagesCount * this.pageSize; // e.g. 3×12=36
        }
      } else if (!_fromObra) {
        // Llegada desde cualquier otro origen (header, URL directa, footer) → limpiar
        this._clearState();
      }
      // Si _fromObra && !_savedState: no hay nada que restaurar, carga normal desde pág. 1

      // Cargar primeras obras (con el estado ya configurado)
      await this.loadWorks();

      // ── Finalizar restauración mobile ──────────────────────────────────────────
      // Restablece page y pageSize a valores normales, luego salta al scroll guardado.
      if (this._restoringState) {
        this.page     = this._restoredPagesCount;
        this.pageSize = 12;               // volver al pageSize normal de mobile
        this.updateLoadMoreButton();      // recalcular botón con page/pageSize correctos
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (this._restoreScrollY > 0) {
            window.scrollTo({ top: this._restoreScrollY, behavior: 'instant' });
          }
          this._restoringState = false;
          this._saveState();              // persistir estado correcto tras la restauración
        }));
      }

      // Attach event listeners
      this.attachEventListeners();

      // Botón volver arriba
      this.initBackToTop();

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

      // Guardar scrollY actualizado al scrollear (debounced 250 ms)
      window.addEventListener('scroll', this.debounce(() => this._saveState(), 250), { passive: true });

      // Re-renderizar grid al cambiar idioma (técnicas, tags y CTA se traducen)
      document.addEventListener('lang:changed', () => {
        if (this.works.length > 0) this.renderGrid();
      });

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
   * Botón "Volver arriba" — aparece cuando el usuario scrollea más de 400px.
   * Visibilidad controlada exclusivamente con la clase CSS .is-visible (no hidden)
   * para que las transiciones de opacidad funcionen sin interrupciones.
   */
  initBackToTop() {
    const btn = document.getElementById('backToTopBtn');
    if (!btn) return;

    const THRESHOLD = 400;

    // Scroll listener con debounce de 80ms (suficiente para scroll fluido)
    const onScroll = this.debounce(() => {
      btn.classList.toggle('is-visible', window.scrollY > THRESHOLD);
    }, 80);

    window.addEventListener('scroll', onScroll, { passive: true });

    // Clic → scroll suave al top
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /**
   * Cargar opciones de filtro (años, técnicas, tags)
   */
  async loadFilterOptions() {
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
    }

    // Tags popover
    const tagsGrid = document.getElementById('tagsGrid');
    if (tagsGrid) {
      this.tagOptions.forEach(tag => {
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

    // ── Delegación de eventos para botones de favorito ───────────────────────
    // Único listener en el grid persiste entre re-renderizados del innerHTML.
    const grid = document.querySelector('[data-grid]');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.artwork-fav-btn');
        if (!btn) return;
        // No llamar e.preventDefault() aquí: el botón es hermano del <a> (no está
        // dentro de él), así que no hay riesgo de navegar. En mobile, preventDefault
        // en el listener de click puede suprimir el segundo toque sintético e impedir
        // que el toggle funcione correctamente en el segundo clic.

        const id = btn.dataset.favId;
        const isNowFav = Favoritos.toggle(id);

        // Actualizar estado visual del botón
        btn.classList.toggle('is-fav', isNowFav);
        btn.setAttribute('aria-pressed', String(isNowFav));
        btn.setAttribute('aria-label',
          i18n.currentLang === 'en'
            ? (isNowFav ? 'Remove from favorites' : 'Add to favorites')
            : (isNowFav ? 'Quitar de favoritos'   : 'Agregar a favoritos')
        );

        // Vibración táctil al ACTIVAR (solo en dispositivos que soporten el API)
        if (isNowFav && navigator.vibrate) {
          navigator.vibrate(40);
        }

        // Animación pop (re-trigger forzando reflow)
        btn.classList.remove('fav-pop');
        void btn.offsetWidth;
        btn.classList.add('fav-pop');
        btn.addEventListener('animationend', () => btn.classList.remove('fav-pop'), { once: true });

        // Si estamos viendo solo favoritos y se desmarca uno → recargar sin él
        if (this.filters.onlyFav && !isNowFav) {
          this.page = 1;
          this.appendMode = false;
          this.loadWorks();
        }
      });
    }

    // ── Filtro de favoritos ──────────────────────────────────────────────────
    const favFilterBtn = document.getElementById('favFilterBtn');
    if (favFilterBtn) {
      favFilterBtn.addEventListener('click', () => {
        this.filters.onlyFav = !this.filters.onlyFav;
        favFilterBtn.setAttribute('aria-pressed', String(this.filters.onlyFav));
        favFilterBtn.classList.toggle('is-active', this.filters.onlyFav);
        this.page = 1;
        this.appendMode = false;
        this.loadWorks();
        this.updateActiveFilterChips();
      });
    }

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
    this.appendMode = false;
    await this.loadWorks();
    this.updateActiveFilterChips();
  }

  /**
   * Cargar obras desde Supabase.
   * Si onlyFav=true, pasa los UUIDs de favoritos como filtro.
   */
  async loadWorks() {
    this.isLoading = true;
    this.showLoadingSpinner();

    // En modo favoritos, si no hay ninguno guardado, mostrar estado vacío
    // sin hacer ninguna query.
    if (this.filters.onlyFav) {
      const favIds = Favoritos.getAll();
      if (favIds.length === 0) {
        this.isLoading = false;
        this.hideLoadingSpinner();
        this.showEmptyState(true);
        return;
      }
    }

    try {
      // Construir parámetros: si onlyFav, añadir favIds
      const filterParams = { ...this.filters };
      if (filterParams.onlyFav) {
        filterParams.favIds = Favoritos.getAll();
      }

      const { data, total, error } = await api.filterWorks(
        filterParams,
        this.page,
        this.pageSize
      );

      if (error) {
        console.error('❌ Error cargando obras:', error);
        this.showEmptyState(this.filters.onlyFav);
        return;
      }

      if (data.length === 0 && this.page === 1) {
        this.showEmptyState(this.filters.onlyFav);
        return;
      } else if (data.length === 0 && this.page > 1) {
        this.hideLoadingSpinner();
        this.page--;
        return;
      }

      this.works = this.appendMode ? [...this.works, ...data] : data;
      this.totalWorks = total;
      this.renderGrid();
    } catch (error) {
      console.error('❌ Error:', error);
      this.showEmptyState(this.filters.onlyFav);
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

    // Ocultar el empty state cuando hay resultados
    const emptyState = document.querySelector('[data-empty]');
    if (emptyState) emptyState.setAttribute('hidden', '');

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

    // Persistir estado de navegación tras cada renderizado del grid
    this._saveState();
  }

  /**
   * Crear HTML de una card de obra.
   * El botón de corazón se coloca como hermano del <a> dentro de <li>
   * para evitar anidar un <button> interactivo dentro de otro elemento
   * interactivo (el enlace).
   */
  createArtworkCard(work) {
    // imagenes.principal es boolean (true = imagen principal)
    const imgs = work.imagenes || [];
    const mainImage = imgs.find(img => img.principal === true) || imgs[0] || null;
    const imageUrl = mainImage?.url_storage || '';
    const technique = Array.isArray(work.tecnica) ? work.tecnica[0] : work.tecnica;
    const hasTechnique = technique?.nombre ? i18n.translate(technique.nombre) : null;

    // tags: obra_tags[].tag.nombre  (puede ser array de {tag:{id,nombre,slug}})
    const tagItems = (work.tags || [])
      .map(t => t?.tag?.nombre)
      .filter(Boolean)
      .map(n => i18n.translate(n));

    const ctaLabel = i18n.currentLang === 'en' ? 'View work' : 'Ver obra';

    const isFav       = Favoritos.has(work.id);
    const favLabel    = i18n.currentLang === 'en'
      ? (isFav ? 'Remove from favorites' : 'Add to favorites')
      : (isFav ? 'Quitar de favoritos'   : 'Agregar a favoritos');

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
              <span>${ctaLabel}</span>
              <i data-lucide="arrow-right"></i>
            </button>
          </div>
        </a>
        <button type="button"
                class="artwork-fav-btn${isFav ? ' is-fav' : ''}"
                data-fav-id="${work.id}"
                aria-label="${favLabel}"
                aria-pressed="${isFav}">
          <i data-lucide="heart" style="width:16px;height:16px;" aria-hidden="true"></i>
        </button>
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
   * Mostrar empty state con mensaje contextual.
   * @param {boolean} [isFavMode=false] - true cuando el modo "Solo favoritos" está activo
   */
  showEmptyState(isFavMode = false) {
    const emptyState = document.querySelector('[data-empty]');
    const grid = document.querySelector('[data-grid]');

    if (emptyState) {
      // Actualizar texto e i18n attrs según contexto
      if (isFavMode) {
        const esMsg = 'Aún no tienes obras guardadas como favoritas.';
        const enMsg = "You haven't saved any favorites yet.";
        emptyState.setAttribute('data-es', esMsg);
        emptyState.setAttribute('data-en', enMsg);
        emptyState.textContent = i18n.currentLang === 'en' ? enMsg : esMsg;
      } else {
        const esMsg = 'No encontramos obras con esos filtros.';
        const enMsg = 'No works found with those filters.';
        emptyState.setAttribute('data-es', esMsg);
        emptyState.setAttribute('data-en', enMsg);
        emptyState.textContent = i18n.currentLang === 'en' ? enMsg : esMsg;
      }
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
   * Actualizar chips de filtros activos (año, técnica, favoritos) y chips inline de tags
   */
  updateActiveFilterChips() {
    // ── 1. Chips de año, técnica y favoritos en [data-active-filters] ─────────
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

      if (this.filters.onlyFav) {
        chips.push({
          label: i18n.currentLang === 'en' ? 'My favorites' : 'Mis favoritos',
          type: 'fav'
        });
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
              this.handleFilterChange();
            } else if (type === 'technique') {
              document.querySelector('[data-filter="technique"]').value = '';
              this.handleFilterChange();
            } else if (type === 'fav') {
              this.filters.onlyFav = false;
              const favBtn = document.getElementById('favFilterBtn');
              if (favBtn) {
                favBtn.setAttribute('aria-pressed', 'false');
                favBtn.classList.remove('is-active');
              }
              this.page = 1;
              this.appendMode = false;
              this.loadWorks();
              this.updateActiveFilterChips();
            }
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
    this.appendMode = true;
    await this.loadWorks();
    this.appendMode = false;
    // Auto-scroll a nuevos items
    window.scrollBy({ top: 400, behavior: 'smooth' });
  }

  /**
   * Limpiar todos los filtros (incluyendo favoritos)
   */
  clearFilters() {
    this.filters = {
      year: '',
      technique: '',
      tags: [],
      search: '',
      onlyFav: false
    };

    // Reset form
    document.querySelector('[data-filter="year"]').value = '';
    document.querySelector('[data-filter="technique"]').value = '';
    document.querySelectorAll('[data-tag-id]').forEach(cb => { cb.checked = false; });
    document.getElementById('searchInput').value = '';

    // Reset botón de favoritos
    const favFilterBtn = document.getElementById('favFilterBtn');
    if (favFilterBtn) {
      favFilterBtn.setAttribute('aria-pressed', 'false');
      favFilterBtn.classList.remove('is-active');
    }

    this.page = 1;
    this.appendMode = false;
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

    nav.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;

      const target = btn.getAttribute('data-page');
      const totalPages = Math.ceil(this.totalWorks / this.pageSize);

      let changed = false;
      if (target === 'prev') {
        if (this.page > 1) { this.page--; changed = true; }
      } else if (target === 'next') {
        if (this.page < totalPages) { this.page++; changed = true; }
      } else {
        const p = parseInt(target, 10);
        if (!isNaN(p) && p !== this.page) { this.page = p; changed = true; }
      }

      if (changed) {
        await this.loadWorks();
        const grid = document.querySelector('[data-grid]');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      this.pageSize = nowDesktop ? 8 : 12;
      this.appendMode = false;

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
   * Cargar estadísticas del catálogo y llenar las tarjetas del hero.
   * Animación de contador numérico (ease-out) para efecto premium.
   */
  async loadStats() {
    try {
      const stats = await api.getCatalogStats();

      const elObras    = document.getElementById('statObras');
      const elArtistas = document.getElementById('statArtistas');
      const elTecnicas = document.getElementById('statTecnicas');

      if (elObras)    this._animateCounter(elObras,    stats.obras);
      if (elArtistas) this._animateCounter(elArtistas, stats.artistas);
      if (elTecnicas) this._animateCounter(elTecnicas, stats.tecnicas);

    } catch (err) {
      // Silencioso: las tarjetas mantienen el guión '—' como fallback
      console.warn('⚠️ No se cargaron las estadísticas del hero:', err);
    }
  }

  /**
   * Anima un elemento de texto desde 0 hasta `target` con ease-out cúbico.
   * Duración fija de 900ms. Si target = 0 escribe "0" sin animar.
   * @param {HTMLElement} el     - elemento cuyo textContent se actualiza
   * @param {number}      target - valor final
   */
  _animateCounter(el, target) {
    if (target === 0) {
      el.textContent = '0';
      return;
    }

    const DURATION = 900;   // ms
    const startTs  = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTs) / DURATION, 1);
      // Ease-out cúbico: progresa rápido al inicio, frena al final
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
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

  // ── Persistencia de estado de navegación ─────────────────────────────────
  // Clave sessionStorage: 'catalogo_estado'  { page, scrollY }
  // • 'page'    → número de página activa (desktop) o de páginas cargadas (mobile)
  // • 'scrollY' → posición vertical al momento de navegar a la ficha
  // El ámbito de sessionStorage es la pestaña actual; se borra al cerrar el tab.

  /**
   * Persiste { page, scrollY } en sessionStorage.
   * No-op mientras _restoringState = true para no sobrescribir el estado cargado.
   */
  _saveState() {
    if (this._restoringState) return;
    try {
      sessionStorage.setItem('catalogo_estado', JSON.stringify({
        page:    this.page,
        scrollY: window.scrollY,
      }));
    } catch { /* quota exceeded — silencioso */ }
  }

  /**
   * Lee el estado guardado. Devuelve null si no existe o el JSON es inválido.
   * @returns {{ page: number, scrollY: number } | null}
   */
  _loadState() {
    try {
      const raw = sessionStorage.getItem('catalogo_estado');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /**
   * Elimina el estado guardado (el usuario llegó desde un origen distinto a una ficha).
   */
  _clearState() {
    try { sessionStorage.removeItem('catalogo_estado'); } catch { }
  }
}
