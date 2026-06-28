'use client';
// components/public/WorkGallery.jsx
// Galería interactiva de la ficha de obra — réplica exacta de public-detail.js
//
// Incluye:
//   - Carrusel de imagen principal con miniaturas (.gallery-thumb / .gallery-thumb.is-active)
//   - Contador "N / total" (.image-counter) — oculto si solo hay 1 imagen
//   - Swipe táctil (umbral 50 px) en la imagen principal y dentro del lightbox
//   - Navegación por teclado (← → Escape) cuando el lightbox está abierto
//   - Lightbox con backdrop, prev/next, counter (.lightbox, .lightbox__*)
//   - Botón de favorito (.artwork-fav-btn) con animación is-fav
//   - Bloqueo de scroll (body overflow hidden) mientras el lightbox está abierto
//
// Selectores CSS usados (verificados en styles/globals.css):
//   .work-hero, .work-hero__figure, .work-hero__img, .work-gallery,
//   .gallery-thumb, .gallery-thumb.is-active, .image-counter, .artwork-fav-btn,
//   .lightbox, .lightbox__content, .lightbox__backdrop, .lightbox__image,
//   .lightbox__close, .lightbox__prev, .lightbox__next, .lightbox__counter

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Heart, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFavorite } from '@/hooks/useFavorite';

/**
 * @param {{
 *   images: Array<{ id: string, url_storage: string, principal: boolean, orden: number }>,
 *   title:  string,
 *   workId: string
 * }} props
 */
export default function WorkGallery({ images, title, workId }) {
  const [currentIdx, setCurrentIdx]     = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted]           = useState(false); // evita hydration mismatch con createPortal

  const { isFav, toggle: toggleFav } = useFavorite(workId);

  // Refs para swipe
  const heroTouchX     = useRef(null);
  const lightboxTouchX = useRef(null);

  const count       = images.length;
  const hasMultiple = count > 1;
  const mainImg     = images[currentIdx] || null;

  // Portal requiere el DOM disponible
  useEffect(() => { setMounted(true); }, []);

  // ── Bloqueo de scroll mientras el lightbox está abierto ─────────────────────
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  // ── Teclado (←, →, Escape) — solo activo cuando el lightbox está abierto ──
  useEffect(() => {
    if (!lightboxOpen) return;

    function handleKey(e) {
      if (e.key === 'ArrowLeft')  navigate(-1);
      else if (e.key === 'ArrowRight') navigate(+1);
      else if (e.key === 'Escape')     setLightboxOpen(false);
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, currentIdx]);

  // ── Helpers de navegación ───────────────────────────────────────────────────
  const navigate = useCallback(
    (delta) => {
      setCurrentIdx((prev) => ((prev + delta + count) % count));
    },
    [count]
  );

  function openLightbox() {
    if (hasMultiple || mainImg) setLightboxOpen(true);
  }

  // ── Swipe en la figura principal ────────────────────────────────────────────
  function onHeroTouchStart(e) {
    heroTouchX.current = e.touches[0].clientX;
  }
  function onHeroTouchEnd(e) {
    if (heroTouchX.current === null || !hasMultiple) return;
    const diff = heroTouchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) >= 50) navigate(diff > 0 ? +1 : -1);
    heroTouchX.current = null;
  }

  // ── Swipe dentro del lightbox ────────────────────────────────────────────────
  function onLightboxTouchStart(e) {
    lightboxTouchX.current = e.touches[0].clientX;
  }
  function onLightboxTouchEnd(e) {
    if (lightboxTouchX.current === null || !hasMultiple) return;
    const diff = lightboxTouchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) >= 50) navigate(diff > 0 ? +1 : -1);
    lightboxTouchX.current = null;
  }

  // ── Lightbox JSX (se monta en document.body via portal) ─────────────────────
  const lightboxEl = lightboxOpen && mainImg ? (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onTouchStart={onLightboxTouchStart}
      onTouchEnd={onLightboxTouchEnd}
    >
      {/* Backdrop — click cierra el lightbox */}
      <div
        className="lightbox__backdrop"
        onClick={() => setLightboxOpen(false)}
        aria-hidden="true"
      />

      <div className="lightbox__content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="lightbox__image"
          src={mainImg.url_storage}
          alt={`${title} — imagen ${currentIdx + 1} de ${count}`}
        />

        {/* Cerrar */}
        <button
          type="button"
          className="lightbox__close"
          aria-label="Cerrar visor"
          onClick={() => setLightboxOpen(false)}
        >
          <X size={24} aria-hidden />
        </button>

        {/* Prev / Next — solo si hay más de 1 imagen */}
        {hasMultiple && (
          <>
            <button
              type="button"
              className="lightbox__prev"
              aria-label="Imagen anterior"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={32} aria-hidden />
            </button>
            <button
              type="button"
              className="lightbox__next"
              aria-label="Imagen siguiente"
              onClick={() => navigate(+1)}
            >
              <ChevronRight size={32} aria-hidden />
            </button>

            {/* Contador dentro del lightbox */}
            <span className="lightbox__counter" aria-live="polite" aria-atomic="true">
              {currentIdx + 1} / {count}
            </span>
          </>
        )}
      </div>
    </div>
  ) : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="work-hero">

      {/* Imagen principal */}
      <figure
        className={`work-hero__figure${!mainImg ? ' is-empty' : ''}`}
        onTouchStart={onHeroTouchStart}
        onTouchEnd={onHeroTouchEnd}
      >
        {mainImg && (
          // .work-hero__figure ya tiene position:relative + aspect-ratio:3/4 + overflow:hidden en CSS
          // priority=true porque es la imagen principal de la página (LCP candidate)
          <Image
            className="work-hero__img"
            src={mainImg.url_storage}
            alt={title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            quality={85}
            priority
            onClick={openLightbox}
            style={{ cursor: 'zoom-in', objectFit: 'contain' }}
          />
        )}

        {/* Contador "N / total" — solo si hay más de 1 imagen */}
        {hasMultiple && (
          <span
            className="image-counter"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentIdx + 1} / {count}
          </span>
        )}

        {/* Botón de favorito */}
        <button
          type="button"
          className={`artwork-fav-btn${isFav ? ' is-fav' : ''}`}
          aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          aria-pressed={isFav ? 'true' : 'false'}
          onClick={toggleFav}
        >
          <Heart size={18} aria-hidden />
        </button>
      </figure>

      {/* Miniaturas — solo si hay más de 1 imagen */}
      {hasMultiple && (
        <div
          className="work-gallery"
          role="list"
          aria-label={`Galería de ${count} imágenes`}
        >
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              className={`gallery-thumb${idx === currentIdx ? ' is-active' : ''}`}
              aria-label={`Ver imagen ${idx + 1}`}
              aria-current={idx === currentIdx ? 'true' : undefined}
              role="listitem"
              onClick={() => setCurrentIdx(idx)}
              style={{ position: 'relative' }}
            >
              {/* .gallery-thumb tiene aspect-ratio:1/1 + overflow:hidden en CSS pero no position:relative */}
              <Image
                src={img.url_storage}
                alt={`${title}, miniatura ${idx + 1}`}
                fill
                sizes="80px"
                quality={60}
                style={{ objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox montado en document.body via portal (evita problemas de z-index/overflow) */}
      {mounted && createPortal(lightboxEl, document.body)}
    </section>
  );
}
