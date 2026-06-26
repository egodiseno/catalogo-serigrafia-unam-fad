// components/public/ArtworkCard.jsx
// Tarjeta de obra individual — réplica exacta de createArtworkCard() de public-catalog.js
// Componente puro: recibe todos los datos como props, no hace fetch.

import { ArrowRight, Heart } from 'lucide-react';

/**
 * @param {object}   work     - Obra con relaciones (tecnica, tags, imagenes)
 * @param {boolean}  isFav    - Está en favoritos del visitante
 * @param {Function} onFav    - Callback al pulsar el botón de favorito
 * @param {string}   lang     - Idioma activo ('es' | 'en')
 * @param {Function} t        - Función de traducción dinámica
 */
export default function ArtworkCard({ work, isFav, onFav, lang, t }) {
  // Imagen principal (principal === true), fallback al primer elemento
  const imgs = work.imagenes || [];
  const mainImage = imgs.find((img) => img.principal === true) || imgs[0] || null;
  const imageUrl = mainImage?.url_storage || '';

  // Técnica — obra.tecnica puede ser objeto o array[0]
  const technique = Array.isArray(work.tecnica) ? work.tecnica[0] : work.tecnica;
  const techniqueName = technique?.nombre ? t(technique.nombre) : null;

  // Tags — estructura: obra_tags[].tag.nombre
  const tagItems = (work.tags || [])
    .map((t2) => t2?.tag?.nombre)
    .filter(Boolean)
    .map((n) => t(n));

  const ctaLabel  = lang === 'en' ? 'View work' : 'Ver obra';
  const favLabel  = lang === 'en'
    ? (isFav ? 'Remove from favorites' : 'Add to favorites')
    : (isFav ? 'Quitar de favoritos'   : 'Agregar a favoritos');

  const handleFav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onFav?.(work.id);
  };

  return (
    <li>
      {/* El enlace envuelve media + body */}
      <a
        href={`/obra/${work.slug || work.id}`}
        className="artwork-card"
        aria-label={`${work.titulo} — ${work.artista}`}
      >
        <div className={`artwork-card__media${!imageUrl ? ' is-empty' : ''}`}>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={work.titulo} loading="lazy" />
          )}
          {techniqueName && (
            <span className="artwork-card__badge">{techniqueName}</span>
          )}
        </div>

        <div className="artwork-card__body">
          <h3 className="artwork-card__title">{work.titulo}</h3>

          <dl className="artwork-card__meta">
            <dt hidden>Artista</dt>
            <dd className="artwork-card__meta-artist">{work.artista.toUpperCase()}</dd>
            <dt hidden>Año y técnica</dt>
            <dd className="artwork-card__meta-detail">
              {work.año}{techniqueName ? ` • ${techniqueName}` : ''}
            </dd>
          </dl>

          {tagItems.length > 0 && (
            <div className="artwork-card__tags">
              {tagItems.slice(0, 2).map((name) => (
                <span key={name} className="tag-small">{name}</span>
              ))}
            </div>
          )}

          <button type="button" className="artwork-card__cta">
            <span>{ctaLabel}</span>
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </a>

      {/* Botón de favorito — FUERA del <a> para evitar anidación de interactivos */}
      <button
        type="button"
        className={`artwork-fav-btn${isFav ? ' is-fav' : ''}`}
        data-fav-id={work.id}
        aria-label={favLabel}
        aria-pressed={isFav ? 'true' : 'false'}
        onClick={handleFav}
      >
        <Heart size={16} aria-hidden />
      </button>
    </li>
  );
}
