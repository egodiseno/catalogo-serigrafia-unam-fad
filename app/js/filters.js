/*
  Prototipo 1 — Público esencial
  Entregas 2–12 — Catálogo general con filtros, enlace controlado a ficha pública y lectura inicial de filtros por URL.
  Scope: carga del dataset mock aprobado, búsqueda, filtros, chips, imágenes locales, paginación por botón, lectura de detailUrl y aplicación de filtros year/technique desde archivo.html y vistas documentales por año, técnica y serie.
  No implementa visor, compartir, obras relacionadas, nuevas fichas ni backend.
*/

(function () {
  const app = document.querySelector('[data-catalog-app]');
  if (!app) return;

  const DATASET_URL = 'data/artworks.json';
  const AUXILIARY_URLS = {
    year: 'data/years.json',
    technique: 'data/techniques.json',
    series: 'data/series.json',
    tag: 'data/tags.json'
  };
  const PAGE_SIZE = 12;

  const elements = {
    searchInput: app.querySelector('[data-search-input]'),
    selects: document.querySelectorAll('[data-filter-select]'),
    chipList: app.querySelector('[data-filter-chips]'),
    clearButtons: document.querySelectorAll('[data-clear-filters]'),
    progress: app.querySelector('[data-progress]'),
    loading: app.querySelector('[data-catalog-loading]'),
    error: app.querySelector('[data-catalog-error]'),
    errorDetail: app.querySelector('[data-error-detail]'),
    empty: app.querySelector('[data-catalog-empty]'),
    grid: app.querySelector('[data-artwork-grid]'),
    loadMore: app.querySelector('[data-load-more]')
  };

  const state = {
    artworks: [],
    filtered: [],
    auxiliary: {
      year: [],
      technique: [],
      series: [],
      tag: []
    },
    query: '',
    filters: {
      year: '',
      technique: '',
      series: '',
      tag: ''
    },
    visibleCount: PAGE_SIZE
  };

  const labels = {
    year: 'Año',
    technique: 'Técnica',
    series: 'Serie',
    tag: 'Tag'
  };

  const emptyOptions = {
    year: 'Todos los años',
    technique: 'Todas las técnicas',
    series: 'Todas las series',
    tag: 'Todos los tags'
  };

  const getArtworkDetailHref = (artwork) => {
    if (!artwork) return '';
    return getArtworkField(artwork, ['detailUrl', 'detail_url', 'urlFicha'], '');
  };

  const normalizeText = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const escapeHtml = (value) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const unique = (items) =>
    Array.from(new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es', { numeric: true })
    );

  const toArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (!value) return [];
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const getArtworkField = (artwork, keys, fallback = '') => {
    for (const key of keys) {
      if (artwork && artwork[key] !== undefined && artwork[key] !== null && artwork[key] !== '') {
        return artwork[key];
      }
    }
    return fallback;
  };

  const mapArtwork = (artwork, index) => {
    const tags = toArray(getArtworkField(artwork, ['tags', 'etiquetas'], []));

    return {
      id: getArtworkField(artwork, ['id'], `obra-${index + 1}`),
      title: getArtworkField(artwork, ['title', 'titulo', 'título'], 'Obra sin título'),
      author: getArtworkField(artwork, ['author', 'autor', 'autora'], 'Autor/a no especificado'),
      year: String(getArtworkField(artwork, ['year', 'anio', 'año'], '')),
      technique: getArtworkField(artwork, ['technique', 'tecnica', 'técnica'], ''),
      series: getArtworkField(artwork, ['series', 'serie'], ''),
      measurements: getArtworkField(artwork, ['dimensions', 'measurements', 'medidas'], ''),
      edition: getArtworkField(artwork, ['edition', 'tiraje', 'edicion', 'edición'], ''),
      slug: getArtworkField(artwork, ['slug'], ''),
      detailUrl: getArtworkField(artwork, ['detailUrl', 'detail_url', 'urlFicha'], ''),
      image: getArtworkField(artwork, ['mainImage', 'image', 'imagen', 'imageUrl', 'image_url'], ''),
      imageAlt: getArtworkField(artwork, ['imageAlt', 'alt', 'textoAlternativo'], ''),
      tags,
      raw: artwork
    };
  };

  const isPublished = (artwork) => {
    const status = normalizeText(getArtworkField(artwork, ['publicationStatus', 'status', 'estado'], 'published'));
    return artwork.published !== false && !['draft', 'borrador', 'unpublished', 'despublicada', 'despublicado'].includes(status);
  };

  const showElement = (element, shouldShow) => {
    if (!element) return;
    element.hidden = !shouldShow;
  };

  const setStatus = (status) => {
    showElement(elements.loading, status === 'loading');
    showElement(elements.error, status === 'error');
    showElement(elements.empty, status === 'empty');
    showElement(elements.grid, status === 'ready');
  };

  const fetchJson = async (url, required = false) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      if (required) throw new Error(`No se encontró ${url}.`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const loadAuxiliaryData = async () => {
    const entries = await Promise.all(
      Object.entries(AUXILIARY_URLS).map(async ([key, url]) => [key, await fetchJson(url, false).catch(() => [])])
    );

    entries.forEach(([key, data]) => {
      state.auxiliary[key] = data.map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return String(item);
        return String(item?.label || item?.name || item?.title || item?.value || '').trim();
      }).filter(Boolean);
    });
  };

  const deriveOptions = (key) => {
    const fromAuxiliary = state.auxiliary[key] || [];
    if (fromAuxiliary.length > 0) return unique(fromAuxiliary);

    if (key === 'tag') {
      return unique(state.artworks.flatMap((artwork) => artwork.tags));
    }

    return unique(state.artworks.map((artwork) => artwork[key]));
  };

  const populateSelects = () => {
    ['year', 'technique', 'series', 'tag'].forEach((key) => {
      const options = deriveOptions(key);
      document.querySelectorAll(`[data-filter-select="${key}"]`).forEach((select) => {
        const currentValue = select.value;
        select.innerHTML = `<option value="">${emptyOptions[key]}</option>`;

        options.forEach((option) => {
          const optionNode = document.createElement('option');
          optionNode.value = option;
          optionNode.textContent = option;
          select.appendChild(optionNode);
        });

        select.value = options.includes(currentValue) ? currentValue : '';
      });
    });
  };

  const updateSyncedControls = () => {
    elements.selects.forEach((select) => {
      const key = select.dataset.filterSelect;
      if (!key) return;
      select.value = state.filters[key] || '';
    });
  };


  const applyInitialUrlFilters = () => {
    const params = new URLSearchParams(window.location.search);
    const supportedFilters = ['year', 'technique', 'series', 'tag'];

    supportedFilters.forEach((key) => {
      const value = params.get(key);
      if (!value) return;

      const options = deriveOptions(key);
      if (options.includes(value)) {
        state.filters[key] = value;
      }
    });

    const query = params.get('q') || params.get('search');
    if (query) {
      state.query = query.trim();
      if (elements.searchInput) elements.searchInput.value = state.query;
    }

    updateSyncedControls();
  };

  const matchesSearch = (artwork) => {
    if (!state.query) return true;
    const searchable = [
      artwork.title,
      artwork.author,
      artwork.year,
      artwork.technique,
      artwork.series,
      artwork.measurements,
      artwork.edition,
      artwork.tags.join(' ')
    ]
      .map(normalizeText)
      .join(' ');

    return searchable.includes(normalizeText(state.query));
  };

  const matchesFilters = (artwork) => {
    const { year, technique, series, tag } = state.filters;

    if (year && artwork.year !== year) return false;
    if (technique && artwork.technique !== technique) return false;
    if (series && artwork.series !== series) return false;
    if (tag && !artwork.tags.includes(tag)) return false;

    return true;
  };

  const filterArtworks = () => {
    state.filtered = state.artworks.filter((artwork) => matchesSearch(artwork) && matchesFilters(artwork));
  };

  const renderChips = () => {
    if (!elements.chipList) return;

    const chips = [];
    if (state.query) {
      chips.push({ key: 'query', label: 'Búsqueda', value: state.query });
    }

    Object.entries(state.filters).forEach(([key, value]) => {
      if (value) chips.push({ key, label: labels[key], value });
    });

    elements.chipList.innerHTML = '';

    if (chips.length === 0) {
      elements.chipList.innerHTML = '<span class="text-sm text-archive-muted">Sin filtros activos</span>';
    } else {
      chips.forEach((chip) => {
        const item = document.createElement('span');
        item.className = 'filter-chip';
        item.innerHTML = `
          <span>${escapeHtml(chip.label)}: ${escapeHtml(chip.value)}</span>
          <button type="button" aria-label="Quitar filtro ${escapeHtml(chip.label)}: ${escapeHtml(chip.value)}" data-remove-filter="${escapeHtml(chip.key)}">×</button>
        `;
        elements.chipList.appendChild(item);
      });
    }

    const hasActiveFilters = chips.length > 0;
    elements.clearButtons.forEach((button) => {
      button.hidden = !hasActiveFilters;
    });
  };

  const renderProgress = () => {
    if (!elements.progress) return;
    const total = state.filtered.length;
    const visible = Math.min(state.visibleCount, total);

    if (state.artworks.length === 0) {
      elements.progress.textContent = 'Sin dataset aprobado';
      return;
    }

    elements.progress.textContent = `Mostrando ${visible} de ${total} ${total === 1 ? 'obra' : 'obras'}`;
  };

  const renderArtworkCard = (artwork) => {
    const tags = artwork.tags.slice(0, 3);
    const imageAlt = artwork.imageAlt || `${artwork.title} — ${artwork.author}`;
    const detailHref = getArtworkDetailHref(artwork);

    return `
      <article class="artwork-card" aria-label="${escapeHtml(artwork.title)}">
        <div class="artwork-thumb">
          ${
            artwork.image
              ? `<img src="${escapeHtml(artwork.image)}" alt="${escapeHtml(imageAlt)}" loading="lazy" />`
              : '<span class="artwork-placeholder-mark">Imagen reservada</span>'
          }
        </div>
        <div class="artwork-card-body">
          <div>
            ${artwork.year ? `<p class="eyebrow">${escapeHtml(artwork.year)}</p>` : ''}
            <h2 class="artwork-card-title">${escapeHtml(artwork.title)}</h2>
            <p class="mt-2 text-sm leading-6 text-archive-muted">${escapeHtml(artwork.author)}</p>
          </div>
          <dl class="artwork-card-meta">
            ${artwork.technique ? `<div><dt>Técnica</dt><dd>${escapeHtml(artwork.technique)}</dd></div>` : ''}
            ${artwork.series ? `<div><dt>Serie</dt><dd>${escapeHtml(artwork.series)}</dd></div>` : ''}
          </dl>
          ${
            tags.length > 0
              ? `<div class="artwork-tag-list">${tags.map((tag) => `<span class="artwork-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
              : ''
          }
          ${
            detailHref
              ? `<a class="artwork-card-cta is-link" href="${escapeHtml(detailHref)}" aria-label="Ver ficha de obra: ${escapeHtml(artwork.title)}">Ver ficha</a>`
              : '<span class="artwork-card-cta is-reserved" aria-label="Ficha de obra reservada para una entrega posterior">Ficha reservada</span>'
          }
        </div>
      </article>
    `;
  };

  const renderGrid = () => {
    if (!elements.grid) return;

    const visibleItems = state.filtered.slice(0, state.visibleCount);
    elements.grid.innerHTML = visibleItems.map(renderArtworkCard).join('');

    if (state.filtered.length === 0 && state.artworks.length > 0) {
      setStatus('empty');
    } else if (state.artworks.length > 0) {
      setStatus('ready');
    }

    showElement(elements.loadMore, state.filtered.length > state.visibleCount);
  };

  const render = () => {
    filterArtworks();
    renderChips();
    renderProgress();
    renderGrid();
  };

  const clearFilters = () => {
    state.query = '';
    state.filters = { year: '', technique: '', series: '', tag: '' };
    state.visibleCount = PAGE_SIZE;

    if (elements.searchInput) elements.searchInput.value = '';
    updateSyncedControls();
    render();
  };

  const attachEvents = () => {
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (event) => {
        state.query = event.target.value.trim();
        state.visibleCount = PAGE_SIZE;
        render();
      });
    }

    elements.selects.forEach((select) => {
      select.addEventListener('change', (event) => {
        const target = event.target;
        const key = target.dataset.filterSelect;
        if (!key) return;

        state.filters[key] = target.value;
        state.visibleCount = PAGE_SIZE;
        updateSyncedControls();
        render();
      });
    });

    elements.clearButtons.forEach((button) => {
      button.addEventListener('click', clearFilters);
    });

    if (elements.chipList) {
      elements.chipList.addEventListener('click', (event) => {
        const button = event.target instanceof HTMLElement ? event.target.closest('[data-remove-filter]') : null;
        if (!button) return;

        const key = button.dataset.removeFilter;
        if (key === 'query') {
          state.query = '';
          if (elements.searchInput) elements.searchInput.value = '';
        } else if (key && Object.prototype.hasOwnProperty.call(state.filters, key)) {
          state.filters[key] = '';
          updateSyncedControls();
        }

        state.visibleCount = PAGE_SIZE;
        render();
      });
    }

    if (elements.loadMore) {
      elements.loadMore.addEventListener('click', () => {
        state.visibleCount += PAGE_SIZE;
        render();
      });
    }
  };

  const initialize = async () => {
    setStatus('loading');
    showElement(elements.loadMore, false);

    try {
      await loadAuxiliaryData();
      const data = await fetchJson(DATASET_URL, true);

      state.artworks = data.filter(isPublished).map(mapArtwork);
      state.visibleCount = PAGE_SIZE;

      populateSelects();
      applyInitialUrlFilters();
      attachEvents();
      render();

      if (state.artworks.length === 0) {
        setStatus('empty');
        renderProgress();
      }
    } catch (error) {
      state.artworks = [];
      state.filtered = [];
      setStatus('error');
      renderChips();
      renderProgress();
      showElement(elements.loadMore, false);

      if (elements.errorDetail) {
        elements.errorDetail.innerHTML = `${escapeHtml(error.message)} Verifica que <code>data/artworks.json</code> esté disponible junto al prototipo estático.`;
      }
    }
  };

  initialize();
})();
