/*
  Prototipo 1 — Público esencial
  Entrega 12 — Handoff final: documentación estabilizada; sin cambios funcionales.
  Entrega 8 — Vista por serie pública.
  Scope: renderiza una vista representativa para Archivo gráfico a partir del dataset mock aprobado, incluyendo resumen documental, técnicas presentes y tags frecuentes.
  No implementa nuevas fichas, visor adicional, compartir, vistas por técnica adicionales, backend, admin ni ecommerce.
*/

(function () {
  const app = document.querySelector('[data-series-app]');
  if (!app) return;

  const DATASET_URL = 'data/artworks.json';
  const seriesSlug = app.dataset.seriesSlug || '';
  const seriesName = app.dataset.seriesName || 'Serie seleccionada';

  const elements = {
    count: app.querySelector('[data-series-count]'),
    years: app.querySelector('[data-series-years]'),
    techniques: app.querySelector('[data-series-techniques]'),
    tags: app.querySelector('[data-series-tags]'),
    progress: app.querySelector('[data-series-progress]'),
    loading: app.querySelector('[data-series-loading]'),
    error: app.querySelector('[data-series-error]'),
    errorDetail: app.querySelector('[data-series-error-detail]'),
    empty: app.querySelector('[data-series-empty]'),
    grid: app.querySelector('[data-series-grid]')
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

  const unique = (items) =>
    Array.from(new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es', { numeric: true })
    );

  const getFrequentTags = (artworks, limit = 6) => {
    const counts = new Map();

    artworks.forEach((artwork) => {
      artwork.tags.forEach((tag) => {
        const normalized = normalizeText(tag);
        if (!normalized) return;

        const current = counts.get(normalized) || { label: tag, count: 0 };
        current.count += 1;
        counts.set(normalized, current);
      });
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es', { numeric: true }))
      .slice(0, limit)
      .map((item) => item.label);
  };

  const isPublished = (artwork) => {
    const status = normalizeText(getArtworkField(artwork, ['publicationStatus', 'status', 'estado'], 'published'));
    return artwork.published !== false && !['draft', 'borrador', 'unpublished', 'despublicada', 'despublicado'].includes(status);
  };

  const mapArtwork = (artwork, index) => ({
    id: getArtworkField(artwork, ['id'], `obra-${index + 1}`),
    title: getArtworkField(artwork, ['title', 'titulo', 'título'], 'Obra sin título'),
    author: getArtworkField(artwork, ['author', 'autor', 'autora'], 'Autor/a no especificado'),
    year: String(getArtworkField(artwork, ['year', 'anio', 'año'], '')),
    technique: getArtworkField(artwork, ['technique', 'tecnica', 'técnica'], ''),
    series: getArtworkField(artwork, ['seriesLabel', 'series', 'serie'], ''),
    seriesSlug: getArtworkField(artwork, ['seriesSlug', 'series_slug', 'slugSerie'], ''),
    detailUrl: getArtworkField(artwork, ['detailUrl', 'detail_url', 'urlFicha'], ''),
    image: getArtworkField(artwork, ['mainImage', 'image', 'imagen', 'imageUrl', 'image_url'], ''),
    imageAlt: getArtworkField(artwork, ['imageAlt', 'alt', 'textoAlternativo'], ''),
    tags: toArray(getArtworkField(artwork, ['tags', 'etiquetas'], []))
  });

  const matchesSeries = (artwork) => {
    if (seriesSlug && artwork.seriesSlug === seriesSlug) return true;
    return normalizeText(artwork.series) === normalizeText(seriesName);
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

  const renderArtworkCard = (artwork) => {
    const tags = artwork.tags.slice(0, 3);
    const imageAlt = artwork.imageAlt || `${artwork.title} — ${artwork.author}`;

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
            artwork.detailUrl
              ? `<a class="artwork-card-cta is-link" href="${escapeHtml(artwork.detailUrl)}" aria-label="Ver ficha de obra: ${escapeHtml(artwork.title)}">Ver ficha</a>`
              : '<span class="artwork-card-cta is-reserved" aria-label="Ficha de obra reservada para una entrega posterior">Ficha reservada</span>'
          }
        </div>
      </article>
    `;
  };

  const updateSummary = (artworks) => {
    const years = unique(artworks.map((artwork) => artwork.year));
    const techniques = unique(artworks.map((artwork) => artwork.technique));
    const frequentTags = getFrequentTags(artworks);

    if (elements.count) elements.count.textContent = `${artworks.length} ${artworks.length === 1 ? 'obra' : 'obras'}`;
    if (elements.years) elements.years.textContent = years.length > 0 ? years.join(' · ') : 'Sin años registrados';
    if (elements.techniques) elements.techniques.textContent = techniques.length > 0 ? techniques.join(' · ') : 'Sin técnicas registradas';
    if (elements.tags) elements.tags.textContent = frequentTags.length > 0 ? frequentTags.join(' · ') : 'Sin tags registrados';
    if (elements.progress) {
      elements.progress.textContent = `${artworks.length} ${artworks.length === 1 ? 'obra asociada' : 'obras asociadas'} a la serie ${seriesName}`;
    }
  };

  const initialize = async () => {
    setStatus('loading');

    try {
      const response = await fetch(DATASET_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`No se encontró ${DATASET_URL}.`);

      const data = await response.json();
      const artworks = Array.isArray(data) ? data.filter(isPublished).map(mapArtwork).filter(matchesSeries) : [];

      updateSummary(artworks);

      if (artworks.length === 0) {
        setStatus('empty');
        return;
      }

      if (elements.grid) elements.grid.innerHTML = artworks.map(renderArtworkCard).join('');
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      if (elements.progress) elements.progress.textContent = 'No se pudo preparar la vista por serie';
      if (elements.errorDetail) {
        elements.errorDetail.innerHTML = `${escapeHtml(error.message)} Verifica que <code>data/artworks.json</code> esté disponible junto al prototipo estático.`;
      }
    }
  };

  initialize();
})();
