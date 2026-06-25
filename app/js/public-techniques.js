// app/js/public-techniques.js
// Página de Técnicas — grid de técnicas + obras filtradas por técnica

import { api } from './api-client.js';
import { i18n } from './i18n.js';

// ── Módulo de Favoritos ────────────────────────────────────────────────────
// Misma lógica que en public-catalog.js. Comparte SESSION_KEY → el estado de
// favoritos es consistente entre la página de catálogo y la de técnicas.
const Favoritos = (() => {
  const SESSION_KEY = 'catalogo_session_id';
  let _set = new Set();
  let _api = null;

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
    async init(apiInstance) {
      _api = apiInstance;
      try {
        const ids = await _api.getFavorites(_getSessionId());
        _set = new Set(ids);
        console.log(`❤️ Favoritos cargados (técnicas): ${_set.size}`);
      } catch {
        _set = new Set();
      }
    },
    has(id)  { return _set.has(id); },
    toggle(id) {
      const isNowFav = !_set.has(id);
      isNowFav ? _set.add(id) : _set.delete(id);
      if (!_api) return isNowFav;
      const sessionId = _getSessionId();
      if (isNowFav) {
        _api.addFavorite(sessionId, id).then(ok => {
          if (!ok) { _set.delete(id); console.warn('⚠️ No se pudo guardar el favorito en Supabase'); }
        });
      } else {
        _api.removeFavorite(sessionId, id).then(ok => {
          if (!ok) { _set.add(id); console.warn('⚠️ No se pudo eliminar el favorito de Supabase'); }
        });
      }
      return isNowFav;
    },
    getAll() { return [..._set]; },
    count()  { return _set.size; },
  };
})();

export class PublicTechniques {
  constructor() {
    this.techniques = [];
    this.countMap = {};
    this.selectedTechniqueId = null;
    this.works = [];
    this.page = 1;
    this.pageSize = 12;
    this.totalWorks = 0;
    this.isLoading = false;
  }

  async init() {
    try {
      console.log('🚀 Inicializando Técnicas...');

      // Cargar técnicas, conteos y favoritos en paralelo
      const [techniques, counts] = await Promise.all([
        api.getTechniques(),
        api.getWorkCountsByTechnique(),
        Favoritos.init(api),
      ]);

      this.techniques = techniques;
      this.countMap = counts;

      this.renderTechniques();
      this.attachEventListeners();

      // Pre-seleccionar si viene ?technique= en la URL
      const params = new URLSearchParams(window.location.search);
      const techniqueParam = params.get('technique');
      if (techniqueParam) {
        const tech = this.techniques.find(
          t => t.slug === techniqueParam || String(t.id) === techniqueParam
        );
        if (tech) {
          this.selectTechnique(tech.id, tech.nombre);
        }
      }

      console.log('✅ Técnicas inicializadas');
    } catch (error) {
      console.error('❌ Error inicializando Técnicas:', error);
    }
  }

  /**
   * Renderizar el grid de cards de técnicas
   */
  renderTechniques() {
    const grid = document.querySelector('[data-techniques-grid]');
    if (!grid) return;

    if (!this.techniques.length) {
      grid.innerHTML = '<p class="empty-state">No hay técnicas disponibles.</p>';
      return;
    }

    grid.innerHTML = this.techniques.map(tech => {
      const count = this.countMap[tech.id] || 0;
      const label = count === 1 ? '1 obra' : `${count} obras`;
      return `
        <button
          type="button"
          class="technique-card"
          data-technique-id="${tech.id}"
          data-technique-name="${tech.nombre}"
          aria-pressed="false"
        >
          <span class="technique-card__name">${tech.nombre}</span>
          <span class="technique-card__count">${label}</span>
        </button>
      `;
    }).join('');
  }

  /**
   * Seleccionar una técnica: actualizar estado visual y cargar obras
   */
  selectTechnique(techniqueId, techniqueName) {
    this.selectedTechniqueId = techniqueId;
    this.page = 1;
    this.works = [];

    // Actualizar estado visual de cards
    document.querySelectorAll('.technique-card').forEach(card => {
      const isActive = card.dataset.techniqueId === String(techniqueId);
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-pressed', String(isActive));
    });

    // Mostrar sección de obras y actualizar heading
    const worksSection = document.querySelector('[data-works-section]');
    const worksHeading = document.querySelector('[data-works-heading]');
    if (worksHeading) worksHeading.textContent = techniqueName;
    if (worksSection) worksSection.removeAttribute('hidden');

    // Scroll suave a la sección de obras
    worksSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    this.loadWorksByTechnique(techniqueId);
  }

  /**
   * Cargar obras de la técnica seleccionada
   */
  async loadWorksByTechnique(techniqueId) {
    this.isLoading = true;
    this.showSpinner();
    this.hideEmpty();

    const { data, total, error } = await api.filterWorks(
      { technique: techniqueId },
      this.page,
      this.pageSize
    );

    this.isLoading = false;
    this.hideSpinner();

    if (error || !data.length) {
      this.showEmpty();
      return;
    }

    this.works = this.page === 1 ? data : [...this.works, ...data];
    this.totalWorks = total;
    this.renderWorks();
    this.updateLoadMore();
  }

  /**
   * Renderizar el grid de obras (misma estructura que catálogo)
   */
  renderWorks() {
    const grid = document.querySelector('[data-works-grid]');
    if (!grid) return;

    const html = this.works.map(work => {
      const imgs = work.imagenes || [];
      const mainImage = imgs.find(i => i.principal === true) || imgs[0] || null;
      const imageUrl = mainImage?.url_storage || '';
      const technique = Array.isArray(work.tecnica) ? work.tecnica[0] : work.tecnica;
      const hasTechnique = technique?.nombre || null;
      const tagItems = (work.tags || [])
        .map(t => t?.tag?.nombre)
        .filter(Boolean);

      const isFav    = Favoritos.has(work.id);
      const favLabel = i18n.currentLang === 'en'
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
                <span data-i18n data-es="Ver obra" data-en="View work">Ver obra</span>
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
    }).join('');

    grid.innerHTML = html;

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Event listeners: cards de técnica + "Ver todas" + "Cargar más"
   */
  attachEventListeners() {
    // Click en card de técnica (delegado al grid)
    const techGrid = document.querySelector('[data-techniques-grid]');
    if (techGrid) {
      techGrid.addEventListener('click', e => {
        const card = e.target.closest('.technique-card');
        if (!card) return;
        this.selectTechnique(card.dataset.techniqueId, card.dataset.techniqueName);
      });
    }

    // Botón "Ver todas las técnicas"
    document.querySelector('[data-back-techniques]')?.addEventListener('click', () => {
      this.selectedTechniqueId = null;
      this.works = [];

      document.querySelectorAll('.technique-card').forEach(c => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });

      const worksSection = document.querySelector('[data-works-section]');
      if (worksSection) worksSection.setAttribute('hidden', '');

      const grid = document.querySelector('[data-works-grid]');
      if (grid) grid.innerHTML = '';
    });

    // ── Delegación de click para botones de favorito ───────────────────────
    // Único listener en el grid — persiste entre re-renderizados del innerHTML.
    const worksGrid = document.querySelector('[data-works-grid]');
    if (worksGrid) {
      worksGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.artwork-fav-btn');
        if (!btn) return;

        const id = btn.dataset.favId;
        const isNowFav = Favoritos.toggle(id);

        // Actualizar estado visual
        btn.classList.toggle('is-fav', isNowFav);
        btn.setAttribute('aria-pressed', String(isNowFav));
        btn.setAttribute('aria-label',
          i18n.currentLang === 'en'
            ? (isNowFav ? 'Remove from favorites' : 'Add to favorites')
            : (isNowFav ? 'Quitar de favoritos'   : 'Agregar a favoritos')
        );

        // Vibración táctil al activar
        if (isNowFav && navigator.vibrate) navigator.vibrate(40);

        // Animación pop (re-trigger forzando reflow)
        btn.classList.remove('fav-pop');
        void btn.offsetWidth;
        btn.classList.add('fav-pop');
        btn.addEventListener('animationend', () => btn.classList.remove('fav-pop'), { once: true });
      });
    }

    // Botón "Cargar más"
    document.querySelector('[data-loadmore]')?.addEventListener('click', async () => {
      if (this.isLoading || !this.selectedTechniqueId) return;
      this.page++;
      await this.loadWorksByTechnique(this.selectedTechniqueId);
    });
  }

  /* ── Helpers de UI ────────────────────────────────────────── */

  showSpinner() {
    document.querySelector('[data-loading]')?.removeAttribute('hidden');
  }

  hideSpinner() {
    document.querySelector('[data-loading]')?.setAttribute('hidden', '');
  }

  showEmpty() {
    document.querySelector('[data-empty]')?.removeAttribute('hidden');
    const grid = document.querySelector('[data-works-grid]');
    if (grid) grid.innerHTML = '';
  }

  hideEmpty() {
    document.querySelector('[data-empty]')?.setAttribute('hidden', '');
  }

  updateLoadMore() {
    const wrap = document.querySelector('[data-loadmore-wrap]');
    if (!wrap) return;
    const shown = this.page * this.pageSize;
    if (shown < this.totalWorks) {
      wrap.removeAttribute('hidden');
    } else {
      wrap.setAttribute('hidden', '');
    }
  }
}
