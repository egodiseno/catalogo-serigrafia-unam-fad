// app/js/public-detail.js
// Ficha detalle de obra — carga por ?slug=<slug>, rellena DOM, galería de miniaturas

import { api } from './api-client.js';
import { i18n } from './i18n.js';

// ── Módulo de Favoritos ────────────────────────────────────────────────────
// Misma lógica y SESSION_KEY que en public-catalog.js y public-techniques.js.
// El estado de favoritos es consistente entre todas las páginas públicas.
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
        console.log(`❤️ Favoritos cargados (ficha): ${_set.size}`);
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

export class PublicDetail {
  constructor() {
    // Leer ?slug= de la URL
    const params = new URLSearchParams(window.location.search);
    this.workSlug     = params.get('slug') || null;
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
    // Parchear los links "Volver al catálogo" con ?from=obra para que el catálogo
    // sepa que debe restaurar la posición de navegación al regresar.
    // Se hace antes de cualquier carga asíncrona para que incluso el estado de
    // error tenga el link correcto.
    this._patchBackLinks();

    if (!this.workSlug || this.workSlug.trim() === '') {
      console.error('❌ No se encontró ?slug= en la URL');
      this.showError();
      return;
    }

    try {
      // Cargar obra y favoritos en paralelo para minimizar latencia
      const [{ data, error }] = await Promise.all([
        api.getWorkBySlug(this.workSlug),
        Favoritos.init(api),
      ]);

      if (error || !data) {
        console.error('❌ Error al cargar obra:', error);
        this.showError();
        return;
      }

      this.work = data;
      this.render(data);
      this.setupGallery(data);
      this.loadRelatedWorks();

      // Registrar visita (fire-and-forget — no bloquea la carga)
      api.recordVisit(data.id).catch(() => {});

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
    this._setText('workTechnique', tecnica?.nombre ? i18n.translate(tecnica.nombre) : '—');

    // ── Tags ──────────────────────────────────────────────
    const tagNames = (work.tags || [])
      .map(t => t?.tag?.nombre)
      .filter(Boolean);

    const tagsRow = document.getElementById('workTagsRow');
    const tagsEl  = document.getElementById('workTags');

    if (tagNames.length > 0 && tagsEl) {
      tagsEl.innerHTML = tagNames
        .map(n => `<span class="tag-small">${this.escapeHtml(i18n.translate(n))}</span>`)
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

    // ── Open Graph / Twitter Card ─────────────────────────
    this.updateOpenGraph(work);

    // ── Compartir ─────────────────────────────────────────
    this.setupShare();

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

    // ── Botón favorito en figura principal ────────────────
    // Se inyecta en .work-hero__figure (position:relative en CSS).
    // e.stopPropagation() evita que el clic propague al listener del lightbox.
    const figureEl = document.querySelector('.work-hero__figure');
    if (figureEl) {
      const isFav    = Favoritos.has(work.id);
      const favLabel = i18n.currentLang === 'en'
        ? (isFav ? 'Remove from favorites' : 'Add to favorites')
        : (isFav ? 'Quitar de favoritos'   : 'Agregar a favoritos');

      figureEl.querySelector('.artwork-fav-btn')?.remove(); // evitar duplicados
      const favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = `artwork-fav-btn${isFav ? ' is-fav' : ''}`;
      favBtn.dataset.favId = work.id;
      favBtn.setAttribute('aria-label', favLabel);
      favBtn.setAttribute('aria-pressed', String(isFav));
      favBtn.innerHTML = `<i data-lucide="heart" style="width:16px;height:16px;" aria-hidden="true"></i>`;
      figureEl.appendChild(favBtn);

      favBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // no abrir lightbox
        const isNowFav = Favoritos.toggle(work.id);
        const label = i18n.currentLang === 'en'
          ? (isNowFav ? 'Remove from favorites' : 'Add to favorites')
          : (isNowFav ? 'Quitar de favoritos'   : 'Agregar a favoritos');
        // Sincronizar figura + botón de metadatos en una pasada
        document.querySelectorAll(`.artwork-fav-btn[data-fav-id="${work.id}"]`)
          .forEach(btn => {
            btn.classList.toggle('is-fav', isNowFav);
            btn.setAttribute('aria-pressed', String(isNowFav));
            btn.setAttribute('aria-label', label);
          });
        if (isNowFav && navigator.vibrate) navigator.vibrate(40);
        favBtn.classList.remove('fav-pop');
        void favBtn.offsetWidth;
        favBtn.classList.add('fav-pop');
        favBtn.addEventListener('animationend', () => favBtn.classList.remove('fav-pop'), { once: true });
      });
    }

    // ── Botón favorito en panel de metadatos ──────────────────
    // #workFavBtn está en obra.html como botón estático; aquí se le asigna
    // data-fav-id, estado inicial y click handler sincronizado con el de figura.
    const metaFavBtn = document.getElementById('workFavBtn');
    if (metaFavBtn) {
      const isFavMeta = Favoritos.has(work.id);
      const metaLabel = i18n.currentLang === 'en'
        ? (isFavMeta ? 'Remove from favorites' : 'Add to favorites')
        : (isFavMeta ? 'Quitar de favoritos'   : 'Agregar a favoritos');

      metaFavBtn.dataset.favId = work.id;
      metaFavBtn.classList.toggle('is-fav', isFavMeta);
      metaFavBtn.setAttribute('aria-pressed', String(isFavMeta));
      metaFavBtn.setAttribute('aria-label', metaLabel);

      metaFavBtn.addEventListener('click', () => {
        const isNowFav = Favoritos.toggle(work.id);
        const label = i18n.currentLang === 'en'
          ? (isNowFav ? 'Remove from favorites' : 'Add to favorites')
          : (isNowFav ? 'Quitar de favoritos'   : 'Agregar a favoritos');
        // Sincronizar metadatos + botón de figura
        document.querySelectorAll(`.artwork-fav-btn[data-fav-id="${work.id}"]`)
          .forEach(btn => {
            btn.classList.toggle('is-fav', isNowFav);
            btn.setAttribute('aria-pressed', String(isNowFav));
            btn.setAttribute('aria-label', label);
          });
        if (isNowFav && navigator.vibrate) navigator.vibrate(40);
        metaFavBtn.classList.remove('fav-pop');
        void metaFavBtn.offsetWidth;
        metaFavBtn.classList.add('fav-pop');
        metaFavBtn.addEventListener('animationend', () => metaFavBtn.classList.remove('fav-pop'), { once: true });
      });
    }

    // ── Lucide icons (incluye los hearts de ambos botones favorito) ───────
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

    // ── Contador inicial (oculto si hay 1 sola imagen) ────
    this._updateCounter(0);

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
        ${hasMultiple ? `
        <span class="lightbox__counter"
              aria-live="polite" aria-atomic="true">
          ${this.currentIndex + 1} / ${this.sortedImages.length}
        </span>` : ''}
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

    // ── Swipe dentro del lightbox (área completa del overlay) ─
    let lbTouchStartX = 0;
    let lbTouchEndX   = 0;

    el.addEventListener('touchstart', (e) => {
      lbTouchStartX = e.changedTouches[0].clientX;
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      lbTouchEndX = e.changedTouches[0].clientX;
      const diff = lbTouchStartX - lbTouchEndX;

      if (diff > 50) {
        this.showImage(this.getCurrentImageIndex() + 1);
        this.updateLightboxImage();
      } else if (diff < -50) {
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
    }
  }

  // ─────────────────────────────────────────────────────────
  // showImage — cambia imagen activa en galería + lightbox
  // ─────────────────────────────────────────────────────────
  showImage(index) {
    const imgs = this.sortedImages;
    if (!imgs.length) return;

    // Clamp: no pasar del primer ni último
    const idx = Math.max(0, Math.min(index, imgs.length - 1));
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

    // Actualizar contadores (figura + lightbox)
    this._updateCounter(idx);
    if (this._lightboxEl) {
      const lbCounter = this._lightboxEl.querySelector('.lightbox__counter');
      if (lbCounter) lbCounter.textContent = `${idx + 1} / ${imgs.length}`;
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

    const THRESHOLD = 50; // px mínimo para considerar swipe
    let touchStartX = 0;
    let touchEndX   = 0;

    mainImgEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });

    mainImgEl.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) < THRESHOLD) return; // ignorar micro-gestos / clicks

      // Índice actual por src — más robusto que this.currentIndex en edge cases
      const foundIdx = this.sortedImages.findIndex(
        img => img.url_storage === mainImgEl.src
      );
      const currentIndex = foundIdx >= 0 ? foundIdx : this.currentIndex;

      if (diff > 0) {
        this.showImage(currentIndex + 1);
      } else {
        this.showImage(currentIndex - 1);
      }
    }, { passive: true });
  }

  // ─────────────────────────────────────────────────────────
  // updateOpenGraph — actualiza meta OG/Twitter con datos de la obra
  // ─────────────────────────────────────────────────────────
  updateOpenGraph(work) {
    const imgs     = work.imagenes || [];
    const mainImg  = imgs.find(i => i.principal === true) || imgs[0] || null;
    const imageUrl = mainImg?.url_storage || '';

    const ogTitle = `${work.titulo || ''}${work.artista ? ' — ' + work.artista : ''}`;
    const ogDesc  = (work.descripcion || 'Obra serigráfica del Catálogo Digital UNAM / FAD')
      .slice(0, 160);
    const ogUrl   = window.location.href;

    const setMeta = (id, value) => {
      const el = document.getElementById(id);
      if (el && value) el.setAttribute('content', value);
    };

    setMeta('ogTitle',       ogTitle);
    setMeta('ogDescription', ogDesc);
    setMeta('ogImage',       imageUrl);
    setMeta('ogUrl',         ogUrl);
    setMeta('twTitle',       ogTitle);
    setMeta('twDescription', ogDesc);
    setMeta('twImage',       imageUrl);
  }

  // ─────────────────────────────────────────────────────────
  // setupShare — rellena #shareUrl y conecta botones de compartir
  // ─────────────────────────────────────────────────────────
  setupShare() {
    const shareUrlEl  = document.getElementById('shareUrl');
    const copyBtn     = document.getElementById('copyBtn');
    const shareWA     = document.getElementById('shareWA');
    const shareEmail  = document.getElementById('shareEmail');
    const shareSMS    = document.getElementById('shareSMS');

    if (!shareUrlEl) return; // sección no presente en el DOM

    // ── Rellenar input con URL actual ─────────────────────
    const currentUrl = window.location.href;
    shareUrlEl.value = currentUrl;

    // ── Copiar enlace ─────────────────────────────────────
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(currentUrl);
        } catch {
          // Fallback si Clipboard API no está disponible
          shareUrlEl.select();
          document.execCommand('copy');
        }

        // Feedback visual
        const spanEl = copyBtn.querySelector('span');
        const originalText = spanEl?.textContent || 'Copiar enlace';
        if (spanEl) spanEl.textContent = '✓ Copiado';
        copyBtn.classList.add('copied');

        setTimeout(() => {
          if (spanEl) spanEl.textContent = originalText;
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    }

    // ── WhatsApp ──────────────────────────────────────────
    // Solo la URL — WhatsApp genera preview automático via og: tags
    if (shareWA) {
      shareWA.addEventListener('click', () => {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(currentUrl)}`,
          '_blank', 'noopener,noreferrer'
        );
      });
    }

    // ── Email ─────────────────────────────────────────────
    if (shareEmail) {
      shareEmail.addEventListener('click', () => {
        const lang    = this._getCurrentLang();
        const titulo  = this.work?.titulo  || '';
        const artista = this.work?.artista || '';
        const año     = this.work?.año     || '';
        const desc    = (this.work?.descripcion || '').slice(0, 160);

        const subject = lang === 'en'
          ? `Printmaking work: ${titulo} — ${artista}`
          : `Obra serigráfica: ${titulo} — ${artista}`;

        const body = lang === 'en'
          ? `${titulo}\n${artista}${año ? ', ' + año : ''}\n${desc ? desc + '\n' : ''}\nView full work:\n${currentUrl}`
          : `${titulo}\n${artista}${año ? ', ' + año : ''}\n${desc ? desc + '\n' : ''}\nVer obra completa:\n${currentUrl}`;

        window.location.href =
          `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      });
    }

    // ── SMS (solo mobile — el CSS lo oculta en desktop) ───
    if (shareSMS) {
      shareSMS.addEventListener('click', () => {
        const msg = this.getShareMessage(true); // versión corta
        window.location.href = `sms:?body=${encodeURIComponent(msg)}`;
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // getShareMessage — mensaje de compartir según idioma
  // @param {boolean} short — versión corta para SMS
  // ─────────────────────────────────────────────────────────
  getShareMessage(short = false) {
    const lang    = this._getCurrentLang();
    const titulo  = this.work?.titulo  || '';
    const artista = this.work?.artista || '';
    const url     = window.location.href;

    if (short) {
      // SMS: mensaje compacto
      return lang === 'en'
        ? `${titulo} by ${artista} — ${url}`
        : `${titulo} de ${artista} — ${url}`;
    }

    return lang === 'en'
      ? `Check out this printmaking work: *${titulo}* by *${artista}*\n${url}`
      : `Mira esta obra serigráfica: *${titulo}* de *${artista}*\n${url}`;
  }

  // ─────────────────────────────────────────────────────────
  // _getCurrentLang — idioma activo desde i18n o DOM
  // ─────────────────────────────────────────────────────────
  _getCurrentLang() {
    // Intentar vía objeto i18n global (importado en obra.html)
    if (window._i18nInstance?.currentLang) return window._i18nInstance.currentLang;
    // Fallback: leer del atributo lang del HTML
    return document.documentElement.lang || 'es';
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

      // ── Delegación de click para favoritos en obras relacionadas ──────
      gridEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.artwork-fav-btn');
        if (!btn) return;
        const id = btn.dataset.favId;
        const isNowFav = Favoritos.toggle(id);
        btn.classList.toggle('is-fav', isNowFav);
        btn.setAttribute('aria-pressed', String(isNowFav));
        btn.setAttribute('aria-label',
          i18n.currentLang === 'en'
            ? (isNowFav ? 'Remove from favorites' : 'Add to favorites')
            : (isNowFav ? 'Quitar de favoritos'   : 'Agregar a favoritos')
        );
        if (isNowFav && navigator.vibrate) navigator.vibrate(40);
        btn.classList.remove('fav-pop');
        void btn.offsetWidth;
        btn.classList.add('fav-pop');
        btn.addEventListener('animationend', () => btn.classList.remove('fav-pop'), { once: true });
      });

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

    const tecnicaNombre = i18n.translate(
      obra.tecnica?.nombre
      ?? (Array.isArray(obra.tecnica) ? obra.tecnica[0]?.nombre : null)
      ?? ''
    );

    const tagItems = (obra.tags || [])
      .map(t => t?.tag?.nombre)
      .filter(Boolean)
      .slice(0, 2)
      .map(n => i18n.translate(n));

    const isFav    = Favoritos.has(obra.id);
    const favLabel = i18n.currentLang === 'en'
      ? (isFav ? 'Remove from favorites' : 'Add to favorites')
      : (isFav ? 'Quitar de favoritos'   : 'Agregar a favoritos');

    return `
      <li>
        <a href="obra.html?slug=${this.escapeHtml(obra.slug || obra.id)}"
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
              <span>${i18n.currentLang === 'en' ? 'View work' : 'Ver obra'}</span>
              <i data-lucide="arrow-right"></i>
            </button>
          </div>

        </a>
        <button type="button"
                class="artwork-fav-btn${isFav ? ' is-fav' : ''}"
                data-fav-id="${this.escapeHtml(obra.id)}"
                aria-label="${this.escapeHtml(favLabel)}"
                aria-pressed="${isFav}">
          <i data-lucide="heart" style="width:16px;height:16px;" aria-hidden="true"></i>
        </button>
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
  // _updateCounter — actualiza el contador "N / total" en la figura.
  // Lo oculta si la obra tiene una sola imagen (no hay nada que contar).
  // @param {number} idx — índice 0-based de la imagen activa
  // ─────────────────────────────────────────────────────────
  _updateCounter(idx) {
    const el    = document.getElementById('imageCounter');
    const total = this.sortedImages.length;
    if (!el) return;

    if (total <= 1) {
      el.setAttribute('hidden', '');
      return;
    }

    el.removeAttribute('hidden');
    el.textContent = `${idx + 1} / ${total}`;
  }

  // ─────────────────────────────────────────────────────────
  // _patchBackLinks — agrega ?from=obra a los links de regreso al catálogo
  // ─────────────────────────────────────────────────────────
  /**
   * Busca todos los links explícitos "Volver al catálogo" en la página
   * (breadcrumb, estado de error) y les añade ?from=obra para que
   * public-catalog.js pueda detectar que el usuario viene de una ficha
   * y restaurar su posición de scroll / página.
   *
   * NO modifica los links de navegación global (nav, brand) porque esos son
   * "ir al catálogo" intencional, no "volver" — deben arrancar desde página 1.
   */
  _patchBackLinks() {
    document.querySelectorAll('.work-back-btn').forEach(a => {
      try {
        const url = new URL(a.href, window.location.href);
        url.searchParams.set('from', 'obra');
        a.href = url.toString();
      } catch { /* silencioso si href no es parseable */ }
    });
  }

  // ─────────────────────────────────────────────────────────
  // _setText — helper: set textContent con fallback '—'
  // ─────────────────────────────────────────────────────────
  _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  }
}
