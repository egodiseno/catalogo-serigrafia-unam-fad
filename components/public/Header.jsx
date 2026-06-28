'use client';
// components/public/Header.jsx
// Header público — réplica exacta del <header> de index.html

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu } from 'lucide-react';
import { useLang } from '@/contexts/LangContext';

export default function Header({ onSearch }) {
  const { lang, setLang } = useLang();
  const pathname = usePathname();
  const searchRef = useRef(null);
  const headerRef = useRef(null);

  // Determina qué página está activa
  const activePage =
    pathname === '/tecnicas' ? 'tecnicas'
    : pathname === '/creditos' ? 'creditos'
    : 'catalogo';

  // Sincronizar --filters-top con la altura real del header (igual que syncFiltersTop)
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () =>
      document.documentElement.style.setProperty('--filters-top', `${header.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // is-scrolled en body (sticky filter shadow)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          document.body.classList.toggle('is-scrolled', window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearchInput = (e) => {
    onSearch?.(e.target.value);
  };

  const navLink = (href, page, esLabel, enLabel) => {
    const isActive = activePage === page;
    return (
      <Link
        href={href}
        className={`nav-link${isActive ? ' active' : ''}`}
        {...(isActive ? { 'aria-current': 'page' } : {})}
      >
        {lang === 'en' ? enLabel : esLabel}
      </Link>
    );
  };

  return (
    <header className="site-header" ref={headerRef} data-header>
      <div className="container">
        {/* Brand */}
        <Link href="/" className="brand" aria-label="Inicio del catálogo">
          <span className="brand__logos" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/UNAM.svg" alt="" className="logo-header" fetchPriority="high" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/FAD.svg"  alt="" className="logo-header" fetchPriority="high" />
          </span>
          <span className="brand__text">
            <span className="brand__title">
              {lang === 'en' ? 'Digital Catalog' : 'Catálogo Digital'}
            </span>
            <span className="brand__subtitle">
              {lang === 'en' ? 'Printmaking' : 'Obra Serigráfica'}
            </span>
          </span>
        </Link>

        {/* Nav desktop */}
        <nav className="main-nav" aria-label="Navegación principal">
          {navLink('/', 'catalogo', 'Catálogo', 'Catalog')}
          {navLink('/tecnicas', 'tecnicas', 'Técnicas', 'Techniques')}
          {navLink('/creditos', 'creditos', 'Créditos', 'Credits')}
        </nav>

        {/* Acciones: búsqueda + idioma */}
        <div className="header-actions">
          <div className="search-container">
            <input
              ref={searchRef}
              type="search"
              id="searchInput"
              className="search-input"
              placeholder={lang === 'en' ? 'Search artworks...' : 'Buscar obras...'}
              aria-label={lang === 'en' ? 'Search artworks in catalog' : 'Buscar obras en el catálogo'}
              onChange={handleSearchInput}
            />
            <Search className="search-icon" aria-hidden="true" size={16} />
          </div>

          <div className="lang-toggle" role="group" aria-label="Cambiar idioma">
            <button
              type="button"
              className="lang-btn"
              data-lang="es"
              aria-pressed={lang === 'es' ? 'true' : 'false'}
              onClick={() => setLang('es')}
            >
              ES
            </button>
            <button
              type="button"
              className="lang-btn"
              data-lang="en"
              aria-pressed={lang === 'en' ? 'true' : 'false'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
        </div>

        {/* Nav mobile — usa <details> igual que el original */}
        <details className="nav-mobile">
          <summary className="nav-mobile__toggle">
            <Menu aria-hidden="true" size={22} />
          </summary>
          <div className="nav-mobile__panel">
            <Link href="/"         className={`nav-link nav-mobile__link${activePage === 'catalogo' ? ' active' : ''}`}>
              {lang === 'en' ? 'Catalog' : 'Catálogo'}
            </Link>
            <Link href="/tecnicas" className={`nav-link nav-mobile__link${activePage === 'tecnicas' ? ' active' : ''}`}>
              {lang === 'en' ? 'Techniques' : 'Técnicas'}
            </Link>
            <Link href="/creditos" className={`nav-link nav-mobile__link${activePage === 'creditos' ? ' active' : ''}`}>
              {lang === 'en' ? 'Credits' : 'Créditos'}
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
