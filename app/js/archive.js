/*
  Prototipo 1 — Público esencial
  Entrega 12 — Handoff final: documentación estabilizada; sin cambios funcionales.
  Entrega 6 — Archivo por año público.
  Scope: renderiza años/generaciones desde dataset mock publicado y enlaza al catálogo general con filtro de año por URL.
  No crea páginas individuales por año, no implementa curaduría, ranking, backend ni admin.
*/

(function () {
  const app = document.querySelector('[data-archive-app]');
  if (!app) return;

  const DATASET_URL = 'data/artworks.json';

  const elements = {
    progress: app.querySelector('[data-archive-progress]'),
    loading: app.querySelector('[data-archive-loading]'),
    error: app.querySelector('[data-archive-error]'),
    errorDetail: app.querySelector('[data-archive-error-detail]'),
    empty: app.querySelector('[data-archive-empty]'),
    grid: app.querySelector('[data-archive-year-grid]')
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

  const getArtworkField = (artwork, keys, fallback = '') => {
    for (const key of keys) {
      if (artwork && artwork[key] !== undefined && artwork[key] !== null && artwork[key] !== '') {
        return artwork[key];
      }
    }
    return fallback;
  };

  const isPublished = (artwork) => {
    const status = normalizeText(getArtworkField(artwork, ['publicationStatus', 'status', 'estado'], 'published'));
    return artwork.published !== false && !['draft', 'borrador', 'unpublished', 'despublicada', 'despublicado'].includes(status);
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se encontró ${url}.`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const buildYearSummaries = (artworks) => {
    const groups = new Map();

    artworks.filter(isPublished).forEach((artwork) => {
      const year = String(getArtworkField(artwork, ['year', 'anio', 'año'], '')).trim();
      if (!year) return;

      const current = groups.get(year) || {
        year,
        count: 0,
        techniques: new Set(),
        series: new Set()
      };

      current.count += 1;
      const technique = getArtworkField(artwork, ['technique', 'tecnica', 'técnica'], '');
      const series = getArtworkField(artwork, ['series', 'serie'], '');
      if (technique) current.techniques.add(String(technique));
      if (series) current.series.add(String(series));

      groups.set(year, current);
    });

    return Array.from(groups.values()).sort((a, b) => Number(b.year) - Number(a.year));
  };

  const formatNameList = (items, fallback) => {
    const names = Array.from(items || []).filter(Boolean);
    return names.length ? names.map(escapeHtml).join(' <span aria-hidden="true">·</span> ') : escapeHtml(fallback);
  };

  const renderYearCard = ({ year, count, techniques, series }) => {
    const countLabel = count === 1 ? '1 obra publicada' : `${count} obras publicadas`;
    const techniqueCount = techniques.size;
    const seriesCount = series.size;
    const techniqueNames = formatNameList(techniques, 'Sin técnicas registradas');
    const seriesNames = formatNameList(series, 'Sin series documentadas');
    const href = `catalogo.html?year=${encodeURIComponent(year)}`;

    return `
      <article class="archive-year-card" aria-label="Archivo ${escapeHtml(year)}: ${escapeHtml(countLabel)}">
        <div class="archive-year-card-main">
          <p class="eyebrow">Año / generación</p>
          <h2>${escapeHtml(year)}</h2>
          <p>${escapeHtml(countLabel)}</p>
        </div>
        <dl class="archive-year-meta" aria-label="Resumen documental del año ${escapeHtml(year)}">
          <div>
            <dt>Obras publicadas</dt>
            <dd>${escapeHtml(count)}</dd>
          </div>
          <div>
            <dt>Técnicas presentes</dt>
            <dd>${escapeHtml(techniqueCount)}</dd>
          </div>
          <div>
            <dt>Series documentadas</dt>
            <dd>${escapeHtml(seriesCount)}</dd>
          </div>
        </dl>
        <div class="archive-year-taxonomy" aria-label="Técnicas y series presentes en ${escapeHtml(year)}">
          <section>
            <h3>Técnicas</h3>
            <p>${techniqueNames}</p>
          </section>
          <section>
            <h3>Series</h3>
            <p>${seriesNames}</p>
          </section>
        </div>
        <a class="button-secondary archive-year-link" href="${escapeHtml(href)}" aria-label="Ver catálogo filtrado por el año ${escapeHtml(year)}">
          Ver obras de ${escapeHtml(year)}
        </a>
      </article>
    `;
  };

  const initialize = async () => {
    setStatus('loading');

    try {
      const artworks = await fetchJson(DATASET_URL);
      const years = buildYearSummaries(artworks);

      if (elements.progress) {
        const totalWorks = years.reduce((sum, year) => sum + year.count, 0);
        elements.progress.textContent = years.length
          ? `${years.length} años disponibles · ${totalWorks} obras publicadas`
          : 'Sin años disponibles';
      }

      if (!years.length) {
        if (elements.grid) elements.grid.innerHTML = '';
        setStatus('empty');
        return;
      }

      if (elements.grid) {
        elements.grid.innerHTML = years.map(renderYearCard).join('');
      }

      setStatus('ready');
    } catch (error) {
      if (elements.grid) elements.grid.innerHTML = '';
      if (elements.progress) elements.progress.textContent = 'No se pudo cargar el archivo';
      if (elements.errorDetail) {
        elements.errorDetail.innerHTML = `${escapeHtml(error.message)} Verifica que <code>data/artworks.json</code> esté disponible junto al prototipo.`;
      }
      setStatus('error');
    }
  };

  initialize();
})();
