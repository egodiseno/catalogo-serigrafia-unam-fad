'use client';
// components/public/TechniquesClient.jsx
// Parte interactiva de la página Técnicas.
// Recibe técnicas + countMap del Server Component (ya obtenidos en SSR).
// Maneja: selección de técnica, carga de obras, paginación "Cargar más",
//         favoritos, volver a la vista de técnicas.
//
// Selectores CSS verificados en styles/globals.css:
//   .techniques-grid, .technique-card, .technique-card.is-active,
//   .technique-card__name, .technique-card__count,
//   .techniques-works, .techniques-works__header,
//   .artworks, .artwork-fav-btn, .empty-state,
//   .load-more-wrap, .btn (btn--load), .loading-spinner, .spinner

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import ArtworkCard from '@/components/public/ArtworkCard';
import { filterWorks, getFavorites, addFavorite, removeFavorite } from '@/lib/supabase/api';
import { useLang } from '@/contexts/LangContext';

const SESSION_KEY = 'catalogo_session_id';
const PAGE_SIZE   = 12;

function getSessionId() {
  let id = null;
  try { id = localStorage.getItem(SESSION_KEY); } catch { /* */ }
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { localStorage.setItem(SESSION_KEY, id); } catch { /* */ }
  }
  return id;
}

/**
 * @param {{
 *   tecnicas: Array<{ id: string, nombre: string, slug: string }>,
 *   countMap: Record<string, number>
 * }} props
 */
export default function TechniquesClient({ tecnicas, countMap }) {
  const { lang, t } = useLang();

  // ── Técnica seleccionada ────────────────────────────────────────────────────
  const [selectedTech, setSelectedTech] = useState(null); // { id, nombre }

  // ── Obras de la técnica ─────────────────────────────────────────────────────
  const [works, setWorks]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // ── Favoritos ───────────────────────────────────────────────────────────────
  const [favSet, setFavSet] = useState(new Set());

  useEffect(() => {
    const sessionId = getSessionId();
    getFavorites(sessionId)
      .then((ids) => setFavSet(new Set(ids)))
      .catch(() => { /* silencioso */ });
  }, []);

  // ── Pre-selección por URL (?technique=slug) ─────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const slug   = params.get('technique');
    if (!slug) return;
    const tech = tecnicas.find((t) => t.slug === slug || String(t.id) === slug);
    if (tech) selectTechnique(tech.id, tech.nombre, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Seleccionar técnica ─────────────────────────────────────────────────────
  const selectTechnique = useCallback(async (techId, techName, startPage = 1) => {
    setSelectedTech({ id: techId, nombre: techName });
    setPage(startPage);
    setWorks([]);
    setIsLoading(true);

    const { data, total: t, error } = await filterWorks(
      { technique: techId },
      startPage,
      PAGE_SIZE
    );

    setIsLoading(false);
    if (!error && data) {
      setWorks(data);
      setTotal(t);
    }
  }, []);

  // ── Cargar más obras ─────────────────────────────────────────────────────────
  async function loadMore() {
    if (isLoading || !selectedTech) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setIsLoading(true);

    const { data, error } = await filterWorks(
      { technique: selectedTech.id },
      nextPage,
      PAGE_SIZE
    );

    setIsLoading(false);
    if (!error && data) setWorks((prev) => [...prev, ...data]);
  }

  // ── Favorito toggle ─────────────────────────────────────────────────────────
  function handleFav(workId) {
    const sessionId = getSessionId();
    setFavSet((prev) => {
      const next = new Set(prev);
      if (next.has(workId)) {
        next.delete(workId);
        removeFavorite(sessionId, workId).catch(() =>
          setFavSet((s) => new Set([...s, workId]))
        );
      } else {
        next.add(workId);
        addFavorite(sessionId, workId).catch(() =>
          setFavSet((s) => { const n = new Set(s); n.delete(workId); return n; })
        );
      }
      return next;
    });
  }

  const shownCount   = page * PAGE_SIZE;
  const hasMore      = shownCount < total;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Grid de técnicas ─────────────────────────────────────────────── */}
      <section aria-label={lang === 'en' ? 'Available techniques' : 'Técnicas disponibles'}>
        <div className="techniques-grid" aria-live="polite">
          {tecnicas.length === 0 ? (
            <p className="empty-state">
              {lang === 'en' ? 'No techniques available.' : 'No hay técnicas disponibles.'}
            </p>
          ) : (
            tecnicas.map((tech) => {
              const count = countMap[tech.id] || 0;
              const label = count === 1
                ? (lang === 'en' ? '1 work'   : '1 obra')
                : (lang === 'en' ? `${count} works` : `${count} obras`);
              const isActive = selectedTech?.id === tech.id;

              return (
                <button
                  key={tech.id}
                  type="button"
                  className={`technique-card${isActive ? ' is-active' : ''}`}
                  aria-pressed={isActive ? 'true' : 'false'}
                  onClick={() => selectTechnique(tech.id, tech.nombre)}
                >
                  <span className="technique-card__name">{tech.nombre}</span>
                  <span className="technique-card__count">{label}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* ── Sección de obras (visible al seleccionar) ────────────────────── */}
      {selectedTech && (
        <section
          className="techniques-works"
          aria-label={lang === 'en' ? 'Works by technique' : 'Obras de la técnica seleccionada'}
        >
          <div className="techniques-works__header">
            <h2>{selectedTech.nombre}</h2>
            <button
              type="button"
              className="btn--outline"
              onClick={() => {
                setSelectedTech(null);
                setWorks([]);
                setTotal(0);
                setPage(1);
              }}
            >
              <ArrowLeft size={16} aria-hidden />
              <span>
                {lang === 'en' ? 'View all techniques' : 'Ver todas las técnicas'}
              </span>
            </button>
          </div>

          {/* Grid de obras */}
          {works.length > 0 && (
            <ul className="artworks" aria-label={lang === 'en' ? 'Works' : 'Obras'}>
              {works.map((work) => (
                <ArtworkCard
                  key={work.id}
                  work={work}
                  isFav={favSet.has(work.id)}
                  onFav={handleFav}
                  lang={lang}
                  t={t}
                />
              ))}
            </ul>
          )}

          {/* Vacío */}
          {!isLoading && works.length === 0 && (
            <p className="empty-state">
              {lang === 'en'
                ? 'No works found for this technique.'
                : 'No encontramos obras con esta técnica.'}
            </p>
          )}

          {/* Cargar más */}
          {hasMore && !isLoading && (
            <div className="load-more-wrap">
              <button
                type="button"
                className="btn btn--load"
                onClick={loadMore}
              >
                {lang === 'en' ? 'Load more' : 'Cargar más'}
              </button>
            </div>
          )}

          {/* Spinner */}
          {isLoading && (
            <div className="loading-spinner">
              <div className="spinner" aria-label={lang === 'en' ? 'Loading…' : 'Cargando…'} />
            </div>
          )}
        </section>
      )}
    </>
  );
}
