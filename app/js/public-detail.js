// app/js/public-detail.js
// Ficha detalle de obra — carga por ?id=<uuid>, rellena DOM, galería de miniaturas

import { api } from './api-client.js';

export class PublicDetail {
  constructor() {
    // Leer ?id= de la URL
    const params = new URLSearchParams(window.location.search);
    this.workId       = params.get('id') || null;
    this.work         = null;
    this.sortedImages = [];   // imágenes ordenadas (principal→orden)
    this.currentIndex = 0;    // índice de la imagen activa
    this._lightboxEl  = null; // referencia al DOM del lightbox
    this._keyHandler  = null; // referencia al listener de teclado
  }

  // ─────────────────────────────────────────────────────────
  // init — punto de entrada principal
  // ─────────────────────────────────────────────────────────
  async init() {
    if (!this.workId) {
      console.error('❌ No se encontró ?id= en la URL');
      this.showError();
      return;
    }

    try {
      const { data, error } = await api.getWorkById(this.workId);

      if (error || !data) {
        console.error('❌ Error al cargar obra:', error);
        this.showError();
        return;
      }

      this.work = data;
      this.render(data);
      this.setupGallery(data);
      this.loadRelatedWorks();

      console.log(`✅ Obra cargada: ${data.titulo}`);
    } catch (err) {
      console.error('❌ Excepción en init:', err);
      this.showError();
    }
  }

  // ─────────────────────────────────────────────────────────
  // render — rellena todos los elementos del DOM con los datos
  // ─────────────────────────────────────────────────────────
  render(work) {
    // ── Título (page + breadcrumb + h1) ──────────────────
    const safeTitle = this.escapeHtml(work.titulo || '—');

    document.title = `${safeTitle} — Catálogo de Obra Serigráfica`;

    const breadcrumb = document.getElementById('breadcrumbTitle');
    if (breadcrumb) breadcrumb.textContent = work.titulo || '—';

    const titleEl = document.getElementById('workTitle');
    if (titleEl) titleEl.textContent = work.titulo || '—';

    // ── Campos simples ────────────────────────────────────
    this._setText('workArtist', work.artista);
    this._setText('workYear',   work.año);

    // ── Técnica (objeto o array según la query) ───────────
    const tecnica = Array.isArray(work.tecnica) ? work.tecnica[0] : work.tecnica;
    this._setText('workTechnique', tecnica?.nombre || '—');

    // ── Tags ──────────────────────────────────────────────
    const tagNames = (work.tags || [])
      .map(t => t?.tag?.nombre)
      .filter(Boolean);

    const tagsRow = document.getElementById('workTagsRow');
    const tagsEl  = document.getElementById('workTags');

    if (tagNames.length > 0 && tagsEl) {
      tagsEl.innerHTML = tagNames
        .map(n => `<span class="tag-small">${this.escapeHtml(n)}</span>`)
        .join('');
      tagsRow?.removeAttribute('hidden');
    } else {
      tagsRow?.setAttribute('hidden', '');
    }

    // ── Descripción ───────────────────────────────────────
    const descWrap = document.getElementById('workDescriptionWrap');
    const descEl   = document.getElementById('workDescription');

    if (work.descripcion && descEl) {
      descEl.textContent = work.descripcion;
      descWrap?.removeAttribute('hidden');
    } else {
      descWrap?.setAttribute('hidden', '');
    }

    // ── Imagen principal ──────────────────────────────────
    const imgs = work.imagenes || [];
    const mainImg = imgs.find(i => i.principal === true) || imgs[0] || null;

    const imgEl = document.getElementById('mainImage');
    if (imgEl && mainImg?.url_storage) {
      imgEl.src = mainImg.url_storage;
      imgEl.alt = work.titulo || '';
    } else if (imgEl) {
      // Placeholder si no hay imagen
      imgEl.closest('figure')?.classList.add('is-empty');
    }

    // ── Mostrar contenido, ocultar spinner ────────────────
    this.hideLoading();
    document.getElementById('workDetail')?.removeAttribute('hidden');

    // ── Lucide icons ──────────────────────────────────────
    if (window.lucide) window.lucide.createIcons();
  }

  // ─────────────────────────────────────────────────────────
  // setupGallery — miniaturas + lightbox + teclado + swipe
  // ─────────────────────────────────────────────────────────
  setupGallery(work) {
    const imgs = work.imagenes || [];

    // Ordenar: principal primero, luego por campo `orden`
    this.sortedImages = [...imgs].sort((a, b) => {
      if (a.principal && !b.principal) return -1;
      if (!a.principal && b.principal) return 1;
      return (a.orden ?? 99) - (b.orden ?? 99);
    });

    // ── Click en imagen principal → lightbox ──────────────
    const mainImgEl = document.getElementById('mainImage');
    if (mainImgEl) {
      mainImgEl.style.cursor = 'zoom-in';
      mainImgEl.addEventListener('click', () =>
        this.openLightbox(mainImgEl.src, work.titulo));
    }

    // ── Teclado (siempre, incluso con 1 imagen para Escape/lightbox) ──
    this.setupKeyboardNavigation();

    if (this.sortedImages.length <= 1) return; // sin thumbs si hay 1 sola imagen

    const galleryEl = document.getElementById('gallery');
    if (!galleryEl) return;

    galleryEl.innerHTML = this.sortedImages
      .map((img, idx) => `
        <button
          type="button"
          class="gallery-thumb ${idx === 0 ? 'is-active' : ''}"
          data-url="${this.escapeHtml(img.url_storage || '')}"
          data-index="${idx}"
          role="listitem"
          aria-label="Ver imagen ${idx + 1}"
          aria-pressed="${idx === 0 ? 'true' : 'false'}"
        >
          <img
            src="${this.escapeHtml(img.url_storage || '')}"
            alt="Miniatura ${idx + 1}"
            loading="lazy"
          />
        </button>
      `)
      .join('');

    galleryEl.removeAttribute('hidden');

    // ── Evento click: navegar vía showImage() ─────────────
    galleryEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.gallery-thumb');
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      if (!isNaN(idx)) this.showImage(idx);
    });

    // ── Swipe en imagen principal (solo con múltiples imgs) ──
    this.setupTouchSwipe();
  }

  // ─────────────────────────────────────────────────────────
  // openLightbox — overlay fullscreen con navegación
  // ─────────────────────────────────────────────────────────
  openLightbox(imageUrl, title) {
    if (this._lightboxEl) return; // ya hay uno abierto

    const hasMultiple = this.sortedImages.length > 1;

    const el = document.createElement('div');
    el.className = 'lightbox';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', title || 'Imagen ampliada');

    el.innerHTML = `
      <div class="lightbox__backdrop"></div>
      <div class="lightbox__content">
        <img
          class="lightbox__image"
          src="${this.escapeHtml(imageUrl)}"
          alt="${this.escapeHtml(title || '')}"
        />
        <button type="button" class="lightbox__close" aria-label="Cerrar imagen">
          <i data-lucide="x"></i>
        </button>
        <button type="button" class="lightbox__prev" aria-label="Imagen anterior"
          ${!hasMultiple ? 'hidden' : ''}>
          <i data-lucide="chevron-left"></i>
        </button>
        <button type="button" class="lightbox__next" aria-label="Imagen siguiente"
          ${!hasMultiple ? 'hidden' : ''}>
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
    `;

    document.body.appendChild(el);
    this._lightboxEl = el;
    document.body.style.overflow = 'hidden';

    if (window.lucide) window.lucide.createIcons();

    // ── Cerrar ────────────────────────────────────────────
    el.querySelector('.lightbox__close')
      .addEventListener('click', () => this.closeLightbox());
    el.querySelector('.lightbox__backdrop')
      .addEventListener('click', () => this.closeLightbox());

    // ── Prev / Next ───────────────────────────────────────
    el.querySelector('.lightbox__prev')
      ?.addEventListener('click', () => this.showImage(this.currentIndex - 1));
    el.querySelector('.lightbox__next')
      ?.addEventListener('click', () => this.showImage(this.currentIndex + 1));

    // ── Swipe dentro del lightbox ─────────────────────────
    const lightboxImg = el.querySelector('.lightbox__image');
    let lbTouchStartX = 0;
    let lbTouchEndX   = 0;

    lightboxImg.addEventListener('touchstart', (e) => {
      lbTouchStartX = e.changedTouches[0].clientX;
      console.log('🟢 LIGHTBOX TOUCH START:', lbTouchStartX);
    }, { passive: true });

    lightboxImg.addEventListener('touchend', (e) => {
      lbTouchEndX = e.changedTouches[0].clientX;
      const diff = lbTouchStartX - lbTouchEndX;
      console.log('🔴 LIGHTBOX TOUCH END:', lbTouchEndX, '| Diff:', diff);

      if (diff > 50) {
        console.log('➡️ Swipe LEFT en lightbox');
        this.showImage(this.getCurrentImageIndex() + 1);
        this.updateLightboxImage();
      } else if (diff < -50) {
        console.log('⬅️ Swipe RIGHT en lightbox');
        this.showImage(this.getCurrentImageIndex() - 1);
        this.updateLightboxImage();
      }
    }, { passive: true });

    // Foco inicial
    requestAnimationFrame(() => el.querySelector('.lightbox__close')?.focus());
  }

  // ─────────────────────────────────────────────────────────
  // closeLightbox — elimina el overlay y restaura scroll
  // ─────────────────────────────────────────────────────────
  closeLightbox() {
    if (!this._lightboxEl) return;
    this._lightboxEl.remove();
    this._lightboxEl = null;
    document.body.style.overflow = '';
    document.getElementById('mainImage')?.focus();
  }

  // ─────────────────────────────────────────────────────────
  // getCurrentImageIndex — índice de la imagen visible en #mainImage
  // ─────────────────────────────────────────────────────────
  getCurrentImageIndex() {
    const mainImgEl = document.getElementById('mainImage');
    if (!mainImgEl) return this.currentIndex;

    const idx = this.sortedImages.findIndex(
      img => img.url_storage === mainImgEl.src
    );
    return idx >= 0 ? idx : this.currentIndex;
  }

  // ─────────────────────────────────────────────────────────
  // updateLightboxImage — sincroniza src del lightbox con #mainImage
  // ─────────────────────────────────────────────────────────
  updateLightboxImage() {
    if (!this._lightboxEl) return;

    const mainImgEl = document.getElementById('mainImage');
    const lbImg = this._lightboxEl.querySelector('.lightbox__image');

    if (lbImg && mainImgEl) {
      lbImg.src = mainImgEl.src;
      console.log('🔄 Lightbox imagen actualizada');
    }
  }

  // ─────────────────────────────────────────────────────────
  // showImage — cambia imagen activa en galería + lightbox
  // ─────────────────────────────────────────────────────────
  showImage(index) {
    console.log('🖼️ showImage() llamado con index:', index);

    const imgs = this.sortedImages;
    if (!imgs.length) {
      console.log('⚠️ Index fuera de rango:', index, '— sortedImages vacío');
      return;
    }

    // Clamp: no pasar del primer ni último
    const idx = Math.max(0, Math.min(index, imgs.length - 1));
    if (idx !== index) {
      console.log('⚠️ Index fuera de rango:', index, '→ clampeado a', idx);
    }
    this.currentIndex = idx;

    const img = imgs[idx];
    if (!img?.url_storage) return;

    // Actualizar imagen principal en la ficha
    const mainImgEl = document.getElementById('mainImage');
    if (mainImgEl) {
      mainImgEl.src = img.url_storage;
      mainImgEl.alt = this.work?.titulo || '';
    }

    // Actualizar thumb activo en la galería
    document.getElementById('gallery')
      ?.querySelectorAll('.gallery-thumb')
      .forEach(btn => {
        const active = parseInt(btn.dataset.index, 10) === idx;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });

    // Sincronizar imagen en el lightbox si está abierto
    if (this._lightboxEl) {
      const lbImg = this._lightboxEl.querySelector('.lightbox__image');
      if (lbImg) lbImg.src = img.url_storage;
    }
  }

  // ─────────────────────────────────────────────────────────
  // setupKeyboardNavigation — flechas + Escape
  // ─────────────────────────────────────────────────────────
  setupKeyboardNavigation() {
    // Limpiar listener previo para evitar duplicados
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);

    this._keyHandler = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.showImage(this.currentIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.showImage(this.currentIndex + 1);
          break;
        case 'Escape':
          if (this._lightboxEl) this.closeLightbox();
          break;
      }
    };

    document.addEventListener('keydown', this._keyHandler);
  }

  // ─────────────────────────────────────────────────────────
  // setupTouchSwipe — swipe left/right en imagen principal
  // ─────────────────────────────────────────────────────────
  setupTouchSwipe() {
    const mainImgEl = document.getElementById('mainImage');
    if (!mainImgEl) return;

    console.log('🔍 setupTouchSwipe() inicializado en #mainImage');

    const THRESHOLD = 50; // px mínimo para considerar swipe
    let touchStartX = 0;
    let touchEndX   = 0;

    mainImgEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
      console.log('🟢 TOUCH START:', touchStartX);
    }, { passive: true });

    mainImgEl.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      console.log('🔴 TOUCH END:', touchEndX);
      console.log('📏 Diferencia:', touchEndX - touchStartX);
      console.log('📍 Imagen actual (src):', document.getElementById('mainImage').src.slice(-20));

      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) < THRESHOLD) return; // ignorar micro-gestos / clicks

      // Índice actual por src — más robusto que this.currentIndex en edge cases
      const foundIdx = this.sortedImages.findIndex(
        img => img.url_storage === mainImgEl.src
      );
      const currentIndex = foundIdx >= 0 ? foundIdx : this.currentIndex;

      if (diff > 0) {
        // Swipe left → siguiente imagen
        console.log('➡️ Swipe LEFT (siguiente imagen):', currentIndex + 1);
        this.showImage(currentIndex + 1);
      } else {
        // Swipe right → imagen anterior
        console.log('⬅️ Swipe RIGHT (imagen anterior):', currentIndex - 1);
        this.showImage(currentIndex - 1);
      }
    }, { passive: true });
  }

  // ─────────────────────────────────────────────────────────
  // loadRelatedWorks — carga obras relacionadas por técnica o tag
  // ─────────────────────────────────────────────────────────
  async loadRelatedWorks() {
    const sectionEl = document.getElementById('relatedWorks');
    const gridEl    = document.getElementById('relatedGrid');
    if (!sectionEl || !gridEl || !this.work) return;

    try {
      // Obtener hasta 20 obras publicadas (sin filtros de fecha/técnica para máxima relevancia)
      const { data, error } = await api.filterWorks({}, 1, 20);

      if (error || !data?.length) {
        sectionEl.setAttribute('hidden', '');
        return;
      }

      // IDs de técnica y tags de la obra actual
      const currentTecnicaId = this.work.tecnica?.id
        ?? (Array.isArray(this.work.tecnica) ? this.work.tecnica[0]?.id : null);

      const currentTagIds = new Set(
        (this.work.tags || []).map(t => t?.tag?.id).filter(Boolean)
      );

      // Filtrar: misma técnica OR al menos 1 tag en común, excluyendo obra actual
      const related = data.filter(obra => {
        if (obra.id === this.work.id) return false;

        const sameTecnica = obra.tecnica?.id === currentTecnicaId;

        const sharedTag = (obra.tags || []).some(
          t => currentTagIds.has(t?.tag?.id)
        );

        return sameTecnica || sharedTag;
      });

      if (related.length === 0) {
        sectionEl.setAttribute('hidden', '');
        return;
      }

      // Máximo 4 obras aleatorias
      const shuffled = related.sort(() => Math.random() - 0.5).slice(0, 4);

      // Renderizar cards
      gridEl.innerHTML = shuffled.map(obra => this._renderRelatedCard(obra)).join('');

      sectionEl.removeAttribute('hidden');

      // Activar Lucide icons en las nuevas cards
      if (window.lucide) window.lucide.createIcons();

      console.log(`✅ Obras relacionadas: ${shuffled.length} de ${related.length} encontradas`);

    } catch (err) {
      console.warn('⚠️ loadRelatedWorks falló:', err.message);
      sectionEl.setAttribute('hidden', '');
    }
  }

  // ─────────────────────────────────────────────────────────
  // _renderRelatedCard — HTML de una card de obra relacionada
  // (misma estructura que public-catalog.js para coherencia visual)
  // ─────────────────────────────────────────────────────────
  _renderRelatedCard(obra) {
    const imgs     = obra.imagenes || [];
    const mainImg  = imgs.find(i => i.principal === true) || imgs[0] || null;
    const imageUrl = mainImg?.url_storage || '';

    const tecnicaNombre = obra.tecnica?.nombre
      ?? (Array.isArray(obra.tecnica) ? obra.tecnica[0]?.nombre : null)
      ?? '';

    const tagItems = (obra.tags || [])
      .map(t => t?.tag?.nombre)
      .filter(Boolean)
      .slice(0, 2);

    return `
      <li>
        <a href="obra.html?id=${this.escapeHtml(obra.id)}"
           class="artwork-card"
           aria-label="${this.escapeHtml(obra.titulo)} — ${this.escapeHtml(obra.artista)}">

          <div class="artwork-card__media ${!imageUrl ? 'is-empty' : ''}">
            ${imageUrl
              ? `<img src="${this.escapeHtml(imageUrl)}"
                      alt="${this.escapeHtml(obra.titulo)}"
                      loading="lazy" />`
              : ''}
            ${tecnicaNombre
              ? `<span class="artwork-card__badge">${this.escapeHtml(tecnicaNombre)}</span>`
              : ''}
          </div>

          <div class="artwork-card__body">
            <h3 class="artwork-card__title">${this.escapeHtml(obra.titulo)}</h3>
            <dl class="artwork-card__meta">
              <dt hidden>Artista</dt>
              <dd>${this.escapeHtml(obra.artista || '—')}</dd>
              <dt hidden>Año</dt>
              <dd>${this.escapeHtml(String(obra.año || '—'))}</dd>
            </dl>
            ${tagItems.length > 0
              ? `<div class="artwork-card__tags">
                  ${tagItems.map(n => `<span class="tag-small">${this.escapeHtml(n)}</span>`).join('')}
                 </div>`
              : ''}
            <button type="button" class="artwork-card__cta">
              <span>Ver obra</span>
              <i data-lucide="arrow-right"></i>
            </button>
          </div>

        </a>
      </li>`;
  }

  // ─────────────────────────────────────────────────────────
  // showError — muestra bloque de error, oculta spinner
  // ─────────────────────────────────────────────────────────
  showError() {
    document.getElementById('workLoading')?.setAttribute('hidden', '');
    document.getElementById('workDetail')?.setAttribute('hidden', '');
    const errorEl = document.getElementById('workError');
    if (errorEl) errorEl.removeAttribute('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // ─────────────────────────────────────────────────────────
  // hideLoading — oculta spinner de carga
  // ─────────────────────────────────────────────────────────
  hideLoading() {
    document.getElementById('workLoading')?.setAttribute('hidden', '');
  }

  // ─────────────────────────────────────────────────────────
  // escapeHtml — sanitiza texto antes de insertar en HTML
  // ─────────────────────────────────────────────────────────
  escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  }

  // ─────────────────────────────────────────────────────────
  // _setText — helper: set textContent con fallback '—'
  // ─────────────────────────────────────────────────────────
  _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  }
}
