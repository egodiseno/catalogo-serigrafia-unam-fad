'use client';
// app/page.jsx — Catálogo público principal
// Equivalente funcional de public-catalog.js + index.html
// Replica: hero con stats, filtros (año/técnica/tags/búsqueda), grid, favoritos,
//          paginación desktop (8/pág) e infinite scroll mobile (12/pág).

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image as ImageIcon, Users, Layers,
  Heart, X, ArrowUp, ChevronDown,
} from 'lucide-react';
import { useLang } from '@/contexts/LangContext';
import ArtworkCard from '@/components/public/ArtworkCard';
import * as api from '@/lib/supabase/api';

// ── Módulo de Favoritos (misma lógica que el IIFE en public-catalog.js) ────────
const SESSION_KEY = 'catalogo_session_id';

function getSessionId() {
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

// ── Utilidad debounce ──────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Animación de contador numérico (ease-out cúbico) ─────────────────────────
function animateCounter(el, target) {
  if (!el || target === 0) { if (el) el.textContent = '0'; return; }
  const DURATION = 900;
  const startTs = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTs) / DURATION, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Rango de páginas para paginación (máx 5 números + ellipsis) ───────────────
function getPaginationRange(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const left  = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const range = [1];
  if (left > 2)          range.push('…');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push('…');
  range.push(total);
  return range;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function CatalogPage() {
  const { lang, t } = useLang();

  // ── Layout / breakpoint ──────────────────────────────────────────────────
  const [isDesktop, setIsDesktop] = useState(false);
  const isDesktopRef = useRef(false);

  // ── Obras y paginación ───────────────────────────────────────────────────
  const [works, setWorks]           = useState([]);
  const [totalWorks, setTotalWorks] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading]   = useState(true);

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    year: '', technique: '', tags: [], search: '', onlyFav: false,
  });
  const [yearOptions, setYearOptions]           = useState([]);
  const [techniqueOptions, setTechniqueOptions] = useState([]);
  const [tagOptions, setTagOptions]             = useState([]);

  // ── Stats del hero ───────────────────────────────────────────────────────
  const [stats, setStats] = useState({ obras: null, artistas: null, tecnicas: null });

  // ── Favoritos ────────────────────────────────────────────────────────────
  const [favSet, setFavSet] = useState(new Set()); // Set<string> de obra IDs

  // ── UI ───────────────────────────────────────────────────────────────────
  const [tagsPopoverOpen, setTagsPopoverOpen]   = useState(false);
  const [filterPanelOpen, setFilterPanelOpen]   = useState(false);
  const [showBackToTop, setShowBackToTop]        = useState(false);

  // Refs
  const sentinelRef   = useRef(null);   // div sentinel para IntersectionObserver
  const searchRef     = useRef(null);
  const tagsPopoverRef = useRef(null);
  const loadedRef     = useRef(false);  // guard: init ejecutado solo una vez

  // ── Refs para closures estables ──────────────────────────────────────────
  const isLoadingRef  = useRef(false);
  const worksRef      = useRef([]);
  const totalRef      = useRef(0);
  const pageRef       = useRef(1);
  const filtersRef    = useRef(filters);
  const favSetRef     = useRef(favSet);

  // Sincronizar refs cuando cambia el state
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { favSetRef.current  = favSet;  }, [favSet]);
  useEffect(() => { worksRef.current   = works;   }, [works]);
  useEffect(() => { totalRef.current   = totalWorks; }, [totalWorks]);

  // ── Detectar breakpoint 1200px (igual que isDesktop en public-catalog.js) ─
  useEffect(() => {
    const check = () => {
      const d = window.innerWidth >= 1200;
      setIsDesktop(d);
      isDesktopRef.current = d;
    };
    check();
    const debouncedCheck = debounce(check, 200);
    window.addEventListener('resize', debouncedCheck);
    return () => window.removeEventListener('resize', debouncedCheck);
  }, []);

  // ── Botón volver arriba ───────────────────────────────────────────────────
  useEffect(() => {
    const THRESHOLD = 400;
    const onScroll = debounce(() => {
      setShowBackToTop(window.scrollY > THRESHOLD);
    }, 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Cerrar popover de tags al hacer click fuera ───────────────────────────
  useEffect(() => {
    const close = (e) => {
      if (tagsPopoverRef.current && !tagsPopoverRef.current.contains(e.target)) {
        setTagsPopoverOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Cargar obras desde Supabase ───────────────────────────────────────────
  const loadWorks = useCallback(async ({
    page       = pageRef.current,
    currFilters = filtersRef.current,
    append     = false,
    desktop    = isDesktopRef.current,
  } = {}) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);

    const pageSize = desktop ? 8 : 12;

    // Modo favoritos sin favoritos → mostrar vacío sin query
    if (currFilters.onlyFav) {
      const favIds = [...favSetRef.current];
      if (favIds.length === 0) {
        setWorks([]);
        setTotalWorks(0);
        isLoadingRef.current = false;
        setIsLoading(false);
        return;
      }
      currFilters = { ...currFilters, favIds };
    }

    try {
      const { data, total, error } = await api.filterWorks(currFilters, page, pageSize);
      if (error) throw error;
      if (data.length === 0 && page > 1) {
        // No hay más obras — revertir página
        pageRef.current = page - 1;
        setCurrentPage(page - 1);
        return;
      }
      const nextWorks = append ? [...worksRef.current, ...data] : data;
      setWorks(nextWorks);
      worksRef.current   = nextWorks;
      setTotalWorks(total);
      totalRef.current   = total;
    } catch (err) {
      console.error('❌ Error cargando obras:', err);
      if (!append) { setWorks([]); setTotalWorks(0); }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []); // sin deps — usa refs para acceder a valores frescos

  // ── Init: opciones de filtro + stats + favoritos ──────────────────────────
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      // Cargar todo en paralelo
      const [years, techniques, tags, catalogStats, favIds] = await Promise.all([
        api.getYears(),
        api.getTechniques(),
        api.getTags(),
        api.getCatalogStats(),
        api.getFavorites(getSessionId()),
      ]);

      setYearOptions(years);
      setTechniqueOptions(techniques);
      setTagOptions(tags);
      setStats(catalogStats);
      setFavSet(new Set(favIds));
      favSetRef.current = new Set(favIds);

      // Leer ?q= de URL y pre-aplicar búsqueda
      const urlParams = new URLSearchParams(window.location.search);
      const qParam    = urlParams.get('q');
      let initialFilters = filtersRef.current;
      if (qParam) {
        initialFilters = { ...initialFilters, search: qParam.trim() };
        setFilters(initialFilters);
        filtersRef.current = initialFilters;
        if (searchRef.current) searchRef.current.value = qParam.trim();
      }

      await loadWorks({ page: 1, currFilters: initialFilters, append: false });
    })();
  }, [loadWorks]);

  // ── Animar contadores del hero cuando llegan los stats ────────────────────
  useEffect(() => {
    if (stats.obras    !== null) animateCounter(document.getElementById('statObras'),    stats.obras);
    if (stats.artistas !== null) animateCounter(document.getElementById('statArtistas'), stats.artistas);
    if (stats.tecnicas !== null) animateCounter(document.getElementById('statTecnicas'), stats.tecnicas);
  }, [stats]);

  // ── Infinite scroll (mobile) ──────────────────────────────────────────────
  useEffect(() => {
    if (isDesktop || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || isLoadingRef.current) return;
        const pageSize  = 12;
        const hasMore   = totalRef.current > 0 && pageRef.current * pageSize < totalRef.current;
        if (!hasMore) return;
        pageRef.current += 1;
        setCurrentPage(pageRef.current);
        loadWorks({ page: pageRef.current, append: true, desktop: false });
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isDesktop, loadWorks]);

  // ── Cambio de filtros ─────────────────────────────────────────────────────
  const applyFilters = useCallback((newFilters) => {
    pageRef.current = 1;
    setCurrentPage(1);
    setFilters(newFilters);
    filtersRef.current = newFilters;
    // En mobile, resetear el array acumulado
    worksRef.current = [];
    setWorks([]);
    loadWorks({ page: 1, currFilters: newFilters, append: false, desktop: isDesktopRef.current });
  }, [loadWorks]);

  // ── Búsqueda debounced ────────────────────────────────────────────────────
  const debouncedSearch = useCallback(
    debounce((value) => {
      const newFilters = { ...filtersRef.current, search: value };
      applyFilters(newFilters);
    }, 300),
    [applyFilters]
  );

  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };

  // ── Cambios en selects de año y técnica ──────────────────────────────────
  const handleYearChange = (e) => {
    applyFilters({ ...filtersRef.current, year: e.target.value });
  };

  const handleTechniqueChange = (e) => {
    applyFilters({ ...filtersRef.current, technique: e.target.value });
  };

  // ── Cambios en checkboxes de tags ─────────────────────────────────────────
  const [checkedTags, setCheckedTags] = useState([]); // IDs de tags seleccionados

  const handleTagChange = (tagId, checked) => {
    const next = checked
      ? [...checkedTags, tagId]
      : checkedTags.filter((id) => id !== tagId);
    setCheckedTags(next);
    applyFilters({ ...filtersRef.current, tags: next });
  };

  const clearTags = () => {
    setCheckedTags([]);
    applyFilters({ ...filtersRef.current, tags: [] });
  };

  // ── Limpiar todos los filtros ─────────────────────────────────────────────
  const clearFilters = () => {
    setCheckedTags([]);
    if (searchRef.current) searchRef.current.value = '';
    const clean = { year: '', technique: '', tags: [], search: '', onlyFav: false };
    applyFilters(clean);
  };

  // ── Toggle favoritos del catálogo ─────────────────────────────────────────
  const toggleOnlyFav = () => {
    const next = { ...filtersRef.current, onlyFav: !filtersRef.current.onlyFav };
    applyFilters(next);
  };

  // ── Toggle favorito de una obra (optimista) ───────────────────────────────
  const handleFavToggle = useCallback((obraId) => {
    const isNowFav = !favSetRef.current.has(obraId);
    const nextSet  = new Set(favSetRef.current);
    isNowFav ? nextSet.add(obraId) : nextSet.delete(obraId);
    setFavSet(nextSet);
    favSetRef.current = nextSet;

    // Vibración táctil al activar
    if (isNowFav && navigator.vibrate) navigator.vibrate(40);

    // Sincronización background con Supabase
    const sessionId = getSessionId();
    if (isNowFav) {
      api.addFavorite(sessionId, obraId).then((ok) => {
        if (!ok) {
          // Rollback silencioso
          const rollback = new Set(favSetRef.current);
          rollback.delete(obraId);
          setFavSet(rollback);
          favSetRef.current = rollback;
        }
      });
    } else {
      api.removeFavorite(sessionId, obraId).then((ok) => {
        if (!ok) {
          const rollback = new Set(favSetRef.current);
          rollback.add(obraId);
          setFavSet(rollback);
          favSetRef.current = rollback;
        }
      });
      // Si estamos en modo favoritos, recargar sin la obra desmarcada
      if (filtersRef.current.onlyFav) {
        loadWorks({ page: 1, append: false, desktop: isDesktopRef.current });
      }
    }
  }, [loadWorks]);

  // ── Cargar más (botón en mobile) ──────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    const pageSize = 12;
    if (isLoadingRef.current) return;
    if (pageRef.current * pageSize >= totalRef.current) return;
    pageRef.current += 1;
    setCurrentPage(pageRef.current);
    loadWorks({ page: pageRef.current, append: true, desktop: false });
  }, [loadWorks]);

  // ── Paginación desktop ────────────────────────────────────────────────────
  const handlePageChange = useCallback((newPage) => {
    if (newPage === currentPage) return;
    pageRef.current = newPage;
    setCurrentPage(newPage);
    loadWorks({ page: newPage, append: false, desktop: true });

    // Scroll suave al encabezado del catálogo (igual que setupPagination)
    setTimeout(() => {
      const head     = document.querySelector('.catalog__head');
      if (!head) return;
      const headerEl = document.querySelector('.site-header');
      const headerH  = headerEl ? headerEl.offsetHeight : 80;
      const top      = head.getBoundingClientRect().top + window.scrollY - headerH - 80;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 50);
  }, [currentPage, loadWorks]);

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const pageSize    = isDesktop ? 8 : 12;
  const totalPages  = Math.ceil(totalWorks / pageSize);
  const shownCount  = isDesktop ? Math.min(currentPage * pageSize, totalWorks) : works.length;
  const hasMore     = isDesktop
    ? currentPage < totalPages
    : works.length < totalWorks;

  const noResults = !isLoading && works.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <p className="hero__eyebrow">
            {lang === 'en' ? 'UNAM · FAD · Printmaking Workshop' : 'UNAM · FAD · Taller de Serigrafía'}
          </p>
          <h1 className="hero__title">
            <span className="title-black">
              {lang === 'en' ? 'Catalog of' : 'Catálogo de'}
            </span>{' '}
            <span className="title-blue">
              {lang === 'en' ? 'Printmaking Works' : 'Obra Serigráfica'}
            </span>
          </h1>
          <p className="hero__lead">
            {lang === 'en'
              ? "Explore the Printmaking Workshop's collection."
              : 'Explora la colección de obras del Taller de Serigrafía de la FAD.'}
          </p>

          {/* Estadísticas — animadas por animateCounter en useEffect */}
          <div className="hero-stats" id="heroStats" aria-label={lang === 'en' ? 'Catalog statistics' : 'Estadísticas del catálogo'}>
            <div className="hero-stats__card">
              <span className="hero-stats__icon" aria-hidden="true">
                <ImageIcon size={24} />
              </span>
              <strong className="hero-stats__number" id="statObras">—</strong>
              <span className="hero-stats__label">
                {lang === 'en' ? 'works in catalog' : 'obras en el catálogo'}
              </span>
            </div>
            <div className="hero-stats__card">
              <span className="hero-stats__icon" aria-hidden="true">
                <Users size={24} />
              </span>
              <strong className="hero-stats__number" id="statArtistas">—</strong>
              <span className="hero-stats__label">
                {lang === 'en' ? 'artists' : 'artistas'}
              </span>
            </div>
            <div className="hero-stats__card">
              <span className="hero-stats__icon" aria-hidden="true">
                <Layers size={24} />
              </span>
              <strong className="hero-stats__number" id="statTecnicas">—</strong>
              <span className="hero-stats__label">
                {lang === 'en' ? 'available techniques' : 'técnicas disponibles'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTROS ───────────────────────────────────────────────────── */}
      <section className="filters" aria-label={lang === 'en' ? 'Catalog filters' : 'Filtros del catálogo'}>
        <div className="container">

          {/* Toggle acordeón — visible solo en mobile (< 1200px) */}
          <button
            type="button"
            className="filter-toggle"
            aria-expanded={filterPanelOpen ? 'true' : 'false'}
            aria-controls="filterPanel"
            onClick={() => setFilterPanelOpen((o) => !o)}
          >
            <span className="filter-toggle__label">
              {filterPanelOpen
                ? (lang === 'en' ? 'Hide filters' : 'Ocultar filtros')
                : (lang === 'en' ? 'Show filters'  : 'Mostrar filtros')}
            </span>
            <ChevronDown
              className="filter-toggle__chevron"
              size={16}
              aria-hidden="true"
              style={{ transform: filterPanelOpen ? 'rotate(180deg)' : undefined }}
            />
          </button>

          {/* Panel de filtros */}
          <div
            id="filterPanel"
            className={`filter-panel${filterPanelOpen ? ' is-open' : ''}`}
          >
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="filter-grid">

                {/* AÑO */}
                <div className="filter-field">
                  <label htmlFor="filterYear">
                    {lang === 'en' ? 'YEAR' : 'AÑO'}
                  </label>
                  <select
                    id="filterYear"
                    value={filters.year}
                    onChange={handleYearChange}
                    aria-label={lang === 'en' ? 'Filter by year' : 'Filtrar por año'}
                  >
                    <option value="">{lang === 'en' ? 'All' : 'Todos'}</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* TÉCNICA */}
                <div className="filter-field">
                  <label htmlFor="filterTechnique">
                    {lang === 'en' ? 'TECHNIQUE' : 'TÉCNICA'}
                  </label>
                  <select
                    id="filterTechnique"
                    value={filters.technique}
                    onChange={handleTechniqueChange}
                    aria-label={lang === 'en' ? 'Filter by technique' : 'Filtrar por técnica'}
                  >
                    <option value="">{lang === 'en' ? 'All' : 'Todas'}</option>
                    {techniqueOptions.map((tech) => (
                      <option key={tech.id} value={tech.id}>{t(tech.nombre)}</option>
                    ))}
                  </select>
                </div>

                {/* TAGS — popover con checkboxes */}
                <div className="filter-field">
                  <label>TAGS</label>
                  <div className="tags-popover-container" ref={tagsPopoverRef}>
                    <button
                      type="button"
                      id="tagsPopoverBtn"
                      className="btn-popover"
                      aria-expanded={tagsPopoverOpen ? 'true' : 'false'}
                      aria-haspopup="true"
                      aria-label={lang === 'en' ? 'Open tags filter' : 'Abrir filtro de tags'}
                      onClick={(e) => { e.stopPropagation(); setTagsPopoverOpen((o) => !o); }}
                    >
                      {lang === 'en' ? 'Filter Tags' : 'Filtrar Tags'}
                    </button>

                    {/* Chips de tags seleccionados */}
                    {checkedTags.length > 0 && (
                      <div className="tags-chips-container" aria-live="polite">
                        {checkedTags.map((tagId) => {
                          const tag = tagOptions.find((t2) => String(t2.id) === String(tagId));
                          return tag ? (
                            <span key={tagId} className="tag-chip">
                              {tag.nombre}
                              <button
                                type="button"
                                aria-label={`Quitar tag ${tag.nombre}`}
                                onClick={() => handleTagChange(tagId, false)}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Popover */}
                    {tagsPopoverOpen && (
                      <div id="tagsPopover" className="tags-popover">
                        <div className="tags-grid">
                          {tagOptions.map((tag) => (
                            <label key={tag.id} className="tag-checkbox-label">
                              <input
                                type="checkbox"
                                value={tag.id}
                                checked={checkedTags.includes(String(tag.id))}
                                onChange={(e) => handleTagChange(String(tag.id), e.target.checked)}
                              />
                              <span>{tag.nombre}</span>
                            </label>
                          ))}
                        </div>
                        {checkedTags.length > 0 && (
                          <div className="tags-popover-footer">
                            <button type="button" className="btn-clear-tags" onClick={clearTags}>
                              {lang === 'en' ? 'Clear selection' : 'Limpiar selección'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>{/* /.filter-grid */}

              {/* Acciones del filtro: favoritos + limpiar */}
              <div className="filter-actions">
                <button
                  type="button"
                  className={`btn-fav-filter${filters.onlyFav ? ' is-active' : ''}`}
                  aria-pressed={filters.onlyFav ? 'true' : 'false'}
                  onClick={toggleOnlyFav}
                >
                  <Heart size={15} aria-hidden="true" />
                  <span>{lang === 'en' ? 'My favorites' : 'Mis favoritos'}</span>
                </button>
                <button type="button" onClick={clearFilters}>
                  {lang === 'en' ? 'Clear filters' : 'Limpiar filtros'}
                </button>
              </div>
            </form>

            {/* Chips de filtros activos (año, técnica, favoritos) */}
            {(filters.year || filters.technique || filters.onlyFav) && (
              <div className="active-filters">
                {filters.year && (
                  <div className="filter-chip">
                    {lang === 'en' ? `Year: ${filters.year}` : `Año: ${filters.year}`}
                    <button
                      type="button"
                      aria-label={`Quitar filtro año ${filters.year}`}
                      onClick={() => applyFilters({ ...filtersRef.current, year: '' })}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                {filters.technique && (
                  <div className="filter-chip">
                    {`${lang === 'en' ? 'Technique' : 'Técnica'}: ${
                      t(techniqueOptions.find((t2) => String(t2.id) === String(filters.technique))?.nombre || '')
                    }`}
                    <button
                      type="button"
                      aria-label="Quitar filtro de técnica"
                      onClick={() => applyFilters({ ...filtersRef.current, technique: '' })}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                {filters.onlyFav && (
                  <div className="filter-chip">
                    {lang === 'en' ? 'My favorites' : 'Mis favoritos'}
                    <button
                      type="button"
                      aria-label="Quitar filtro de favoritos"
                      onClick={() => applyFilters({ ...filtersRef.current, onlyFav: false })}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>{/* /#filterPanel */}

        </div>
      </section>

      {/* ── CATÁLOGO ──────────────────────────────────────────────────── */}
      <main id="contenido" className="catalog">
        <div className="container">
          <div className="catalog__head">
            <h2>{lang === 'en' ? 'Works' : 'Obras'}</h2>
            <p
              className="catalog__count"
              aria-live="polite"
              aria-atomic="true"
            >
              {totalWorks > 0 && (
                lang === 'en'
                  ? `Showing ${shownCount} of ${totalWorks}`
                  : `Mostrando ${shownCount} de ${totalWorks}`
              )}
            </p>
          </div>

          {/* Grid de obras */}
          <ul className="artworks" aria-label={lang === 'en' ? 'Works list' : 'Listado de obras'} role="region" aria-live="polite">
            {works.map((work) => (
              <ArtworkCard
                key={work.id}
                work={work}
                isFav={favSet.has(work.id)}
                onFav={handleFavToggle}
                lang={lang}
                t={t}
              />
            ))}
          </ul>

          {/* Estado vacío */}
          {noResults && (
            <p className="empty-state">
              {filters.onlyFav
                ? (lang === 'en' ? "You haven't saved any favorites yet." : 'Aún no tienes obras guardadas como favoritas.')
                : (lang === 'en' ? 'No works found with those filters.' : 'No encontramos obras con esos filtros.')}
            </p>
          )}

          {/* Spinner de carga */}
          {isLoading && (
            <div className="loading-spinner">
              <div className="spinner" />
            </div>
          )}

          {/* ── Mobile: botón "Cargar más" + sentinel para IntersectionObserver */}
          {!isDesktop && (
            <div className="load-more-wrap" ref={sentinelRef} hidden={!hasMore || undefined}>
              <button
                type="button"
                className="btn btn--load"
                onClick={handleLoadMore}
                disabled={isLoading || !hasMore}
              >
                {lang === 'en' ? 'Load more' : 'Cargar más'}
              </button>
            </div>
          )}

          {/* ── Desktop: paginación ───────────────────────────────────── */}
          {isDesktop && totalPages > 1 && (
            <nav aria-label={lang === 'en' ? 'Pagination' : 'Paginación'} className="pagination-nav">
              {/* Anterior */}
              <button
                type="button"
                className={`pagination-btn pagination-btn--nav${currentPage === 1 ? ' pagination-btn--disabled' : ''}`}
                disabled={currentPage === 1}
                aria-label={lang === 'en' ? 'Previous page' : 'Página anterior'}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                ‹
              </button>

              {/* Números de página */}
              {getPaginationRange(currentPage, totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`pagination-btn${p === currentPage ? ' pagination-btn--active' : ''}`}
                    aria-label={`${lang === 'en' ? 'Page' : 'Página'} ${p}`}
                    aria-current={p === currentPage ? 'page' : undefined}
                    disabled={p === currentPage}
                    onClick={() => handlePageChange(p)}
                  >
                    {p}
                  </button>
                )
              )}

              {/* Siguiente */}
              <button
                type="button"
                className={`pagination-btn pagination-btn--nav${currentPage === totalPages ? ' pagination-btn--disabled' : ''}`}
                disabled={currentPage === totalPages}
                aria-label={lang === 'en' ? 'Next page' : 'Página siguiente'}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                ›
              </button>
            </nav>
          )}

        </div>
      </main>

      {/* ── Botón volver arriba ───────────────────────────────────────── */}
      <button
        type="button"
        id="backToTopBtn"
        className={`btn-back-top${showBackToTop ? ' is-visible' : ''}`}
        aria-label={lang === 'en' ? 'Back to top' : 'Volver al inicio de la página'}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp aria-hidden size={18} />
      </button>
    </>
  );
}
