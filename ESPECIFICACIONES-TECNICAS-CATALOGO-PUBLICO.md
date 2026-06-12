# ESPECIFICACIONES TÉCNICAS — Catálogo Público + Supabase

**Documento:** Especificaciones para Claude Code  
**Preparado:** 2026-06-12  
**Para:** Next Chat — Implementación catálogo público

---

## 1. ESTRUCTURA HTML — app/index.html

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Catálogo Digital de Obra Serigráfica — UNAM / FAD">
  <title>Catálogo de Obra Serigráfica</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&display=swap" rel="stylesheet">
  
  <!-- Styles -->
  <link rel="stylesheet" href="css/styles.css">
  
  <!-- Lucide Icons CDN -->
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>

<!-- ========================
     SKIP LINK (a11y)
     ======================== -->
<a href="#contenido" class="skip-link">Saltar al contenido principal</a>

<!-- ========================
     HEADER (sticky)
     ======================== -->
<header class="site-header" data-header>
  <div class="container">
    <!-- Brand -->
    <a href="/" class="brand" aria-label="Inicio del catálogo">
      <span class="brand__logos" aria-hidden="true">
        <img src="assets/brand/UNAM.svg" alt="" class="logo-header" />
        <img src="assets/brand/FAD.svg" alt="" class="logo-header" />
      </span>
      <span class="brand__text">
        <span class="brand__title">Catálogo Digital</span>
        <span class="brand__subtitle">Obra Serigráfica</span>
      </span>
    </a>

    <!-- Main Nav (desktop only) -->
    <nav class="main-nav" aria-label="Navegación principal">
      <a href="#" class="nav-link" data-i18n data-es="Catálogo" data-en="Catalog">Catálogo</a>
      <a href="#acerca" class="nav-link" data-i18n data-es="Acerca" data-en="About">Acerca</a>
    </nav>

    <!-- Header Actions: Search + Lang Toggle -->
    <div class="header-actions">
      <div class="search-container">
        <input 
          type="search" 
          id="searchInput" 
          class="search-input" 
          placeholder="Buscar obras..."
          data-i18n-placeholder
          data-es-placeholder="Buscar obras..."
          data-en-placeholder="Search artworks..."
          aria-label="Buscar obras en el catálogo"
        />
        <i data-lucide="search" class="search-icon" aria-hidden="true"></i>
      </div>

      <div class="lang-toggle" role="group" aria-label="Cambiar idioma">
        <button 
          type="button" 
          class="lang-btn" 
          data-lang="es" 
          aria-pressed="true"
        >ES</button>
        <button 
          type="button" 
          class="lang-btn" 
          data-lang="en" 
          aria-pressed="false"
        >EN</button>
      </div>
    </div>

    <!-- Mobile Nav Toggle (hamburger) -->
    <details class="nav-mobile">
      <summary class="nav-mobile__toggle">
        <i data-lucide="menu" aria-hidden="true"></i>
      </summary>
      <div class="nav-mobile__panel">
        <a href="#" class="nav-link nav-mobile__link" data-i18n data-es="Catálogo" data-en="Catalog">Catálogo</a>
        <a href="#acerca" class="nav-link nav-mobile__link" data-i18n data-es="Acerca" data-en="About">Acerca</a>
      </div>
    </details>
  </div>
</header>

<!-- ========================
     HERO SECTION
     ======================== -->
<section class="hero">
  <div class="container">
    <p class="hero__eyebrow" data-i18n data-es="UNAM · FAD · Taller de Serigrafía" data-en="UNAM · FAD · Printmaking Workshop">UNAM · FAD · Taller de Serigrafía</p>
    <h1 class="hero__title">
      <span data-i18n data-es="Catálogo de" data-en="Catalog of">Catálogo de</span> <span class="accent" data-i18n data-es="Obra Serigráfica" data-en="Printmaking Works">Obra Serigráfica</span>
    </h1>
    <p class="hero__lead" data-i18n data-es="Explora la colección de obras del Taller de Serigrafía de la FAD. Descubre técnicas, artistas y procesos creadores." data-en="Explore the Printmaking Workshop's collection. Discover techniques, artists and creative processes.">
      Explora la colección de obras del Taller de Serigrafía de la FAD. Descubre técnicas, artistas y procesos creadores.
    </p>
  </div>
</section>

<!-- ========================
     FILTROS SECTION (sticky)
     ======================== -->
<section class="filters" aria-label="Filtros del catálogo" data-filters-section>
  <div class="container">
    <form class="filters__form" data-filters>
      <div class="filters__fields">
        <!-- Year Filter -->
        <div class="filter-field">
          <label for="filterYear" data-i18n data-es="Año" data-en="Year">Año</label>
          <select id="filterYear" data-filter="year" aria-label="Filtrar por año">
            <option value="">Todos</option>
            <!-- Poblado dinámicamente -->
          </select>
        </div>

        <!-- Technique Filter -->
        <div class="filter-field">
          <label for="filterTechnique" data-i18n data-es="Técnica" data-en="Technique">Técnica</label>
          <select id="filterTechnique" data-filter="technique" aria-label="Filtrar por técnica">
            <option value="">Todas</option>
            <!-- Poblado dinámicamente -->
          </select>
        </div>

        <!-- Tags Filter (checkboxes) -->
        <div class="filter-field">
          <label data-i18n data-es="Tags" data-en="Tags">Tags</label>
          <div id="tagsContainer" class="tags-checkboxes">
            <!-- Poblado dinámicamente -->
          </div>
        </div>
      </div>

      <div class="filters__actions">
        <button 
          type="button" 
          class="btn btn--ghost" 
          data-clear
          data-i18n
          data-es="Limpiar filtros"
          data-en="Clear filters"
        >Limpiar filtros</button>
      </div>
    </form>

    <!-- Active filters chips -->
    <div class="active-filters" data-active-filters hidden>
      <!-- Poblado dinámicamente -->
    </div>
  </div>
</section>

<!-- ========================
     MAIN CONTENT (Grid)
     ======================== -->
<main id="contenido" class="catalog">
  <div class="container">
    <div class="catalog__head">
      <h2 data-i18n data-es="Obras" data-en="Works">Obras</h2>
      <p class="catalog__count" data-count aria-live="polite" aria-atomic="true">
        <!-- "Mostrando X de Y obras" -->
      </p>
    </div>

    <!-- Grid de obras -->
    <ul class="artworks" data-grid aria-label="Listado de obras" role="region" aria-live="polite">
      <!-- Poblado dinámicamente por public-catalog.js -->
    </ul>

    <!-- Empty state -->
    <p class="empty-state" data-empty hidden data-i18n data-es="No encontramos obras con esos filtros." data-en="No works found with those filters.">
      No encontramos obras con esos filtros.
    </p>

    <!-- Load More Button o Infinite Scroll Trigger -->
    <div class="load-more-wrap" data-loadmore-wrap>
      <button 
        type="button" 
        class="btn btn--load" 
        data-loadmore
        data-i18n
        data-es="Cargar más"
        data-en="Load more"
      >Cargar más</button>
    </div>

    <!-- Loading spinner (hidden by default) -->
    <div class="loading-spinner" data-loading hidden>
      <div class="spinner"></div>
    </div>
  </div>
</main>

<!-- ========================
     FOOTER
     ======================== -->
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <span class="footer-logos">
          <img src="assets/brand/UNAM.svg" alt="UNAM" class="logo-footer" />
          <img src="assets/brand/FAD.svg" alt="FAD" class="logo-footer" />
        </span>
        <p class="footer-text" data-i18n data-es="Catálogo Digital de Obra Serigráfica — UNAM Facultad de Artes y Diseño" data-en="Digital Catalog of Printmaking Works — UNAM School of Arts and Design">
          Catálogo Digital de Obra Serigráfica
        </p>
      </div>

      <div class="footer-col">
        <h3 data-i18n data-es="Catálogo" data-en="Catalog">Catálogo</h3>
        <ul>
          <li><a href="#" data-i18n data-es="Todas las obras" data-en="All works">Todas las obras</a></li>
          <li><a href="#" data-i18n data-es="Por técnica" data-en="By technique">Por técnica</a></li>
          <li><a href="#" data-i18n data-es="Por año" data-en="By year">Por año</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h3 data-i18n data-es="Acerca" data-en="About">Acerca</h3>
        <ul>
          <li><a href="#" data-i18n data-es="El taller" data-en="The workshop">El taller</a></li>
          <li><a href="#" data-i18n data-es="Equipo" data-en="Team">Equipo</a></li>
          <li><a href="#" data-i18n data-es="Contacto" data-en="Contact">Contacto</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h3 data-i18n data-es="Social" data-en="Social">Social</h3>
        <div class="footer-social">
          <a href="#" aria-label="Instagram" title="Instagram">
            <i data-lucide="instagram" aria-hidden="true"></i>
          </a>
          <a href="#" aria-label="Facebook" title="Facebook">
            <i data-lucide="facebook" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p data-i18n data-es="&copy; 2026 UNAM Facultad de Artes y Diseño. Todos los derechos reservados." data-en="&copy; 2026 UNAM School of Arts and Design. All rights reserved.">
        © <span data-year>2026</span> UNAM Facultad de Artes y Diseño
      </p>
      <p>
        <a href="#" data-i18n data-es="Accesibilidad" data-en="Accessibility">Accesibilidad</a> |
        <a href="#" data-i18n data-es="Política de privacidad" data-en="Privacy policy">Política de privacidad</a> |
        <a href="#" data-i18n data-es="Términos de uso" data-en="Terms of use">Términos de uso</a>
      </p>
    </div>
  </div>
</footer>

<!-- ========================
     SCRIPTS
     ======================== -->
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Core JS modules -->
<script type="module">
  import { PublicCatalog } from './js/public-catalog.js';
  import { i18n } from './js/i18n.js';

  document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n
    i18n.init();

    // Initialize catalog
    const catalog = new PublicCatalog();
    await catalog.init();
  });
</script>

</body>
</html>
```

---

## 2. CSS ESTILOS — app/css/styles.css

**Estructura:**

```css
/* ============================================================
   Tokens + Variables (From Mockup)
   ============================================================ */
:root {
  --color-blue: #013b75;
  --color-blue-deep: #002a55;
  --color-gold: #d9a500;
  --color-gold-deep: #b58700;
  --color-ink: #101b2d;
  --color-muted: #5e6878;
  --color-bg: #f7f5ef;
  --color-surface: #fffcf5;
  --color-white: #ffffff;
  --color-line: #e4ddcf;

  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: "Lora", Georgia, serif;

  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;

  --radius-ui: 4px;
  --radius-card: 8px;

  --shadow-sm: 0 2px 8px rgba(16, 27, 45, 0.08);
  --shadow-md: 0 12px 28px rgba(16, 27, 45, 0.14);

  --container: 1280px;
  --grid-gap: 1.5rem;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}

/* ============================================================
   Reset / Base
   ============================================================ */
*, *::before, *::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
}

h1, h2, h3 {
  font-family: var(--font-serif);
  color: var(--color-ink);
  margin: 0;
}

:focus-visible {
  outline: 2px solid var(--color-blue);
  outline-offset: 3px;
  border-radius: var(--radius-ui);
}

/* ============================================================
   Utilities
   ============================================================ */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-blue);
  color: white;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}

.container {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--space-2);
}

/* ============================================================
   Header (Sticky)
   ============================================================ */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--color-white);
  border-bottom: 1px solid var(--color-line);
  backdrop-filter: blur(8px);
  background-color: rgba(255, 252, 245, 0.95);
}

.site-header .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-block: var(--space-2);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  text-decoration: none;
  transition: opacity 200ms var(--ease);
}

.brand:hover {
  opacity: 0.8;
}

.brand__logos {
  display: flex;
  align-items: center;
  gap: 4px;
}

.logo-header {
  height: 32px;
  width: auto;
}

.brand__text {
  display: flex;
  flex-direction: column;
}

.brand__title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.brand__subtitle {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-blue);
}

.main-nav {
  display: none;
  gap: var(--space-4);
}

.nav-link {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-ink);
  position: relative;
  transition: color 200ms var(--ease);
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--color-gold);
  transition: width 300ms var(--ease);
  transform-origin: left;
}

.nav-link:hover::after {
  width: 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.search-container {
  position: relative;
  display: none;
}

.search-input {
  height: 44px;
  padding: 0 var(--space-2) 0 44px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-ui);
  background: var(--color-white);
  font-size: 0.9rem;
  width: 200px;
  transition: all 200ms var(--ease);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px rgba(1, 59, 117, 0.1);
}

.search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--color-muted);
  pointer-events: none;
}

.lang-toggle {
  display: flex;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-ui);
  overflow: hidden;
}

.lang-btn {
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--color-ink);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms var(--ease);
}

.lang-btn[aria-pressed="true"] {
  background: var(--color-blue);
  color: white;
}

.nav-mobile {
  display: block;
  margin-left: auto;
}

.nav-mobile__toggle {
  cursor: pointer;
  background: none;
  border: none;
  padding: var(--space-1);
  display: flex;
  align-items: center;
  width: 32px;
  height: 32px;
}

.nav-mobile__toggle i {
  width: 20px;
  height: 20px;
}

.nav-mobile__panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-white);
  border-bottom: 1px solid var(--color-line);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-mobile__link {
  padding: var(--space-1);
  display: block;
}

/* ============================================================
   Hero Section
   ============================================================ */
.hero {
  padding-block: clamp(48px, 8vw, 80px);
}

.hero__eyebrow {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: var(--space-1);
}

.hero__title {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  margin-bottom: var(--space-2);
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.accent {
  background: linear-gradient(135deg, var(--color-blue) 0%, var(--color-gold) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero__lead {
  font-size: 1.05rem;
  color: var(--color-muted);
  max-width: 600px;
  line-height: 1.6;
}

/* ============================================================
   Filtros
   ============================================================ */
.filters {
  position: sticky;
  top: calc(var(--sticky-header-height, 60px));
  z-index: 40;
  background: var(--color-white);
  border-bottom: 1px solid var(--color-line);
  padding-block: var(--space-2);
  backdrop-filter: blur(4px);
}

.filters__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.filters__fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.filter-field label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.filter-field select,
.filter-field input {
  height: 44px;
  padding: 0 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-ui);
  background: var(--color-white);
  color: var(--color-ink);
  font-size: 0.92rem;
  font-family: inherit;
  transition: all 200ms var(--ease);
}

.filter-field select:focus,
.filter-field input:focus {
  outline: 2px solid var(--color-blue);
  outline-offset: 1px;
}

.tags-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-checkbox {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.tag-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.filters__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding-top: var(--space-1);
  border-top: 1px solid var(--color-line);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  background: rgba(1, 59, 117, 0.08);
  color: var(--color-blue);
  border-radius: 20px;
  font-size: 0.85rem;
  border: 1px solid rgba(1, 59, 117, 0.2);
}

.filter-chip button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ============================================================
   Botones
   ============================================================ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 1.3rem;
  border-radius: var(--radius-ui);
  border: 1px solid transparent;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 200ms var(--ease);
}

.btn--primary {
  background: var(--color-blue);
  color: white;
}

.btn--primary:hover {
  background: var(--color-blue-deep);
  box-shadow: var(--shadow-sm);
}

.btn--primary:active {
  transform: translateY(1px);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--ghost {
  background: transparent;
  color: var(--color-blue);
  border-color: var(--color-line);
}

.btn--ghost:hover {
  border-color: var(--color-gold);
  color: var(--color-gold-deep);
  background: rgba(217, 165, 0, 0.06);
}

.btn--load {
  width: 100%;
}

/* ============================================================
   Catálogo Grid
   ============================================================ */
.catalog {
  padding-block: clamp(32px, 5vw, 56px);
}

.catalog__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.catalog__head h2 {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  letter-spacing: -0.01em;
}

.catalog__count {
  font-size: 0.85rem;
  color: var(--color-muted);
}

.artworks {
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: 1fr;
  gap: var(--grid-gap);
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: var(--space-3);
}

.artworks > li {
  display: flex;
  height: 100%;
}

@media (min-width: 481px) {
  .artworks {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .artworks {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .main-nav {
    display: flex;
  }

  .search-container {
    display: block;
  }
}

@media (min-width: 1440px) {
  .artworks {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.artwork-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  transition: all 0.3s var(--ease);
  text-decoration: none;
  color: inherit;
}

.artwork-card:hover,
.artwork-card:focus-within {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: #cfc6b4;
}

.artwork-card__media {
  position: relative;
  aspect-ratio: 4 / 5;
  background: linear-gradient(135deg, #eef2f7, #e0e7f0);
  overflow: hidden;
}

.artwork-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s var(--ease);
  loading: lazy;
}

.artwork-card:hover .artwork-card__media img {
  transform: scale(1.03);
}

.artwork-card__badge {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  background: var(--color-blue);
  color: white;
  padding: 0.3rem 0.6rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  z-index: 1;
}

.artwork-card__media.is-empty::after {
  content: "Imagen reservada";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-muted);
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, rgba(1, 59, 117, 0.05), rgba(217, 165, 0, 0.05));
}

.artwork-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.1rem 1.15rem 1.25rem;
  flex: 1;
}

.artwork-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-ink);
  line-height: 1.3;
  margin: 0;
  font-family: var(--font-serif);
}

.artwork-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.8rem;
  color: var(--color-muted);
  margin: 0;
}

.artwork-card__meta dd {
  margin: 0;
}

.artwork-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.tag-small {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: rgba(217, 165, 0, 0.1);
  color: var(--color-gold-deep);
  border-radius: 2px;
  font-size: 0.7rem;
  font-weight: 500;
}

.artwork-card__cta {
  align-self: flex-start;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-blue);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 200ms var(--ease);
}

.artwork-card__cta:hover {
  color: var(--color-gold);
}

.artwork-card__cta i {
  width: 14px;
  height: 14px;
}

/* ============================================================
   Empty State
   ============================================================ */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: var(--space-4);
  color: var(--color-muted);
  font-size: 1rem;
}

/* ============================================================
   Loading State
   ============================================================ */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-line);
  border-top-color: var(--color-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-spinner {
  text-align: center;
  padding: var(--space-3);
  display: flex;
  justify-content: center;
  align-items: center;
}

/* ============================================================
   Load More Wrap
   ============================================================ */
.load-more-wrap {
  margin-top: var(--space-3);
  text-align: center;
}

/* ============================================================
   Footer
   ============================================================ */
.site-footer {
  background: var(--color-blue);
  color: var(--color-surface);
  padding-block: var(--space-4);
  margin-top: clamp(48px, 8vw, 80px);
}

.footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

@media (min-width: 768px) {
  .footer-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .footer-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.footer-brand {
  grid-column: 1 / -1;
}

.footer-logos {
  display: flex;
  gap: 0.5rem;
}

.logo-footer {
  height: 40px;
  width: auto;
  filter: brightness(0) invert(1);
}

.footer-text {
  margin-top: var(--space-1);
  font-size: 0.9rem;
  line-height: 1.5;
}

.footer-col h3 {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: var(--space-1);
  color: var(--color-gold);
  font-family: var(--font-sans);
}

.footer-col ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.footer-col a {
  font-size: 0.9rem;
  opacity: 0.9;
  transition: opacity 200ms var(--ease);
}

.footer-col a:hover {
  opacity: 1;
}

.footer-social {
  display: flex;
  gap: 0.8rem;
}

.footer-social a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-gold);
  border-radius: 50%;
  transition: all 200ms var(--ease);
}

.footer-social a:hover {
  background: var(--color-gold);
  color: var(--color-blue);
}

.footer-social i {
  width: 16px;
  height: 16px;
}

.footer-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: var(--space-3);
  text-align: center;
  font-size: 0.85rem;
  opacity: 0.9;
}

.footer-bottom p {
  margin: 0.3rem 0;
}

.footer-bottom a {
  opacity: 0.85;
  transition: opacity 200ms var(--ease);
}

.footer-bottom a:hover {
  opacity: 1;
}

/* ============================================================
   Responsive: Tablet +
   ============================================================ */
@media (min-width: 768px) {
  .filters__form {
    flex-direction: row;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .filters__fields {
    flex-direction: row;
    flex-wrap: wrap;
    flex: 1;
  }

  .filter-field {
    flex: 1;
    min-width: 160px;
  }

  .filters__actions {
    flex: none;
  }

  .nav-mobile {
    display: none;
  }
}

/* ============================================================
   Dark mode (opcional - futuro)
   ============================================================ */
@media (prefers-color-scheme: dark) {
  /* Implementar si es necesario */
}
```

---

## 3. MÓDULO: api-client.js

```javascript
// app/js/api-client.js

// Inicializar cliente Supabase
const SUPABASE_URL = 'https://kfvjansfmhamkrnbxmgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...'; // Desde .env

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const api = {
  /**
   * Obtener obras publicadas (paginadas)
   */
  async getPublishedWorks(page = 1, pageSize = 12) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const { data, error, count } = await supabase
      .from('obras')
      .select(`
        id,
        titulo,
        slug,
        artista,
        año,
        descripcion,
        tecnica:tecnica_id(id, nombre, slug),
        tags:obra_tags(tag:tag_id(id, nombre, slug)),
        imagenes(id, url_storage, tipo, orden)
      `, { count: 'exact' })
      .eq('estado', 'publicado')
      .range(start, end)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching works:', error);
      return { data: [], total: 0, error };
    }

    return { data, total: count, error: null };
  },

  /**
   * Obtener obra por slug
   */
  async getWorkBySlug(slug) {
    const { data, error } = await supabase
      .from('obras')
      .select(`
        id,
        titulo,
        slug,
        artista,
        año,
        descripcion,
        tecnica:tecnica_id(id, nombre, slug),
        tags:obra_tags(tag:tag_id(id, nombre, slug)),
        imagenes(id, url_storage, tipo, orden)
      `)
      .eq('slug', slug)
      .eq('estado', 'publicado')
      .single();

    if (error) {
      console.error('Error fetching work:', error);
      return { data: null, error };
    }

    return { data, error: null };
  },

  /**
   * Obtener años únicos de obras publicadas
   */
  async getYears() {
    const { data, error } = await supabase
      .from('obras')
      .select('año')
      .eq('estado', 'publicado')
      .order('año', { ascending: false });

    if (error) {
      console.error('Error fetching years:', error);
      return [];
    }

    // Deduplicar y retornar
    const years = [...new Set(data.map(d => d.año))];
    return years;
  },

  /**
   * Obtener todas las técnicas
   */
  async getTechniques() {
    const { data, error } = await supabase
      .from('tecnicas')
      .select('id, nombre, slug')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error fetching techniques:', error);
      return [];
    }

    return data;
  },

  /**
   * Obtener todos los tags
   */
  async getTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('id, nombre, slug')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error fetching tags:', error);
      return [];
    }

    return data;
  },

  /**
   * Buscar obras por término (título, artista, descripción)
   */
  async searchWorks(query, pageSize = 12) {
    if (!query || query.trim().length === 0) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('obras')
      .select(`
        id,
        titulo,
        slug,
        artista,
        año,
        descripcion,
        tecnica:tecnica_id(id, nombre, slug),
        tags:obra_tags(tag:tag_id(id, nombre, slug)),
        imagenes(id, url_storage, tipo, orden)
      `)
      .eq('estado', 'publicado')
      .or(
        `titulo.ilike.%${query}%,artista.ilike.%${query}%,descripcion.ilike.%${query}%`
      )
      .limit(pageSize);

    if (error) {
      console.error('Error searching works:', error);
      return { data: [], error };
    }

    return { data, error: null };
  },

  /**
   * Filtrar obras por criterios
   */
  async filterWorks(filters = {}, page = 1, pageSize = 12) {
    const { year, technique, tags, search } = filters;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase
      .from('obras')
      .select(`
        id,
        titulo,
        slug,
        artista,
        año,
        descripcion,
        tecnica:tecnica_id(id, nombre, slug),
        tags:obra_tags(tag:tag_id(id, nombre, slug)),
        imagenes(id, url_storage, tipo, orden)
      `, { count: 'exact' })
      .eq('estado', 'publicado');

    if (year) {
      query = query.eq('año', year);
    }

    if (technique) {
      query = query.eq('tecnica_id', technique);
    }

    if (search && search.trim()) {
      query = query.or(
        `titulo.ilike.%${search}%,artista.ilike.%${search}%`
      );
    }

    // Filtrar por tags (más complejo, puede requerir join)
    // Por ahora simplificar

    const { data, error, count } = await query
      .range(start, end)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error filtering works:', error);
      return { data: [], total: 0, error };
    }

    return { data, total: count, error: null };
  }
};
```

---

## 4. MÓDULO: public-catalog.js

```javascript
// app/js/public-catalog.js

import { api } from './api-client.js';
import { i18n } from './i18n.js';

export class PublicCatalog {
  constructor() {
    this.works = [];
    this.filtered = [];
    this.page = 1;
    this.pageSize = 12;
    this.totalWorks = 0;
    this.isLoading = false;

    this.filters = {
      year: '',
      technique: '',
      tags: [],
      search: ''
    };

    this.yearOptions = [];
    this.techniqueOptions = [];
    this.tagOptions = [];
  }

  async init() {
    try {
      // Load filter options
      await this.loadFilterOptions();

      // Initial load
      await this.loadWorks();

      // Attach event listeners
      this.attachEventListeners();

      // Setup infinite scroll observer
      this.setupInfiniteScroll();
    } catch (error) {
      console.error('Error initializing catalog:', error);
    }
  }

  async loadFilterOptions() {
    const [years, techniques, tags] = await Promise.all([
      api.getYears(),
      api.getTechniques(),
      api.getTags()
    ]);

    this.yearOptions = years;
    this.techniqueOptions = techniques;
    this.tagOptions = tags;

    this.populateFilterOptions();
  }

  populateFilterOptions() {
    // Years
    const yearSelect = document.querySelector('[data-filter="year"]');
    if (yearSelect) {
      this.yearOptions.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
      });
    }

    // Techniques
    const techniqueSelect = document.querySelector('[data-filter="technique"]');
    if (techniqueSelect) {
      this.techniqueOptions.forEach(tech => {
        const option = document.createElement('option');
        option.value = tech.id;
        option.textContent = tech.nombre;
        techniqueSelect.appendChild(option);
      });
    }

    // Tags
    const tagsContainer = document.getElementById('tagsContainer');
    if (tagsContainer) {
      this.tagOptions.forEach(tag => {
        const label = document.createElement('label');
        label.className = 'tag-checkbox';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = tag.id;
        input.setAttribute('data-tag-id', tag.id);
        
        const text = document.createElement('span');
        text.textContent = tag.nombre;
        
        label.appendChild(input);
        label.appendChild(text);
        tagsContainer.appendChild(label);
      });
    }
  }

  attachEventListeners() {
    // Filter changes (real-time)
    const filterForm = document.querySelector('[data-filters]');
    if (filterForm) {
      const inputs = filterForm.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.addEventListener('change', () => this.handleFilterChange());
      });
    }

    // Clear filters button
    const clearBtn = document.querySelector('[data-clear]');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFilters());
    }

    // Load more button
    const loadMoreBtn = document.querySelector('[data-loadmore]');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadMore());
    }

    // Search input (debounced)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce((e) => {
        this.filters.search = e.target.value;
        this.page = 1;
        this.renderGrid();
      }, 300));
    }
  }

  async handleFilterChange() {
    const yearSelect = document.querySelector('[data-filter="year"]');
    const techniqueSelect = document.querySelector('[data-filter="technique"]');
    const tagCheckboxes = document.querySelectorAll('[data-tag-id]');

    this.filters.year = yearSelect?.value || '';
    this.filters.technique = techniqueSelect?.value || '';
    this.filters.tags = Array.from(tagCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute('data-tag-id'));

    this.page = 1;
    await this.loadWorks();
    this.updateActiveFilterChips();
  }

  async loadWorks() {
    this.isLoading = true;
    this.showLoadingSpinner();

    try {
      const { data, total, error } = await api.filterWorks(
        this.filters,
        this.page,
        this.pageSize
      );

      if (error) {
        console.error('Error loading works:', error);
        this.showEmptyState();
        return;
      }

      this.works = data;
      this.totalWorks = total;
      this.renderGrid();
    } catch (error) {
      console.error('Error loading works:', error);
      this.showEmptyState();
    } finally {
      this.isLoading = false;
      this.hideLoadingSpinner();
    }
  }

  renderGrid() {
    const grid = document.querySelector('[data-grid]');
    if (!grid) return;

    if (this.works.length === 0) {
      this.showEmptyState();
      return;
    }

    grid.innerHTML = this.works
      .map(work => this.createArtworkCard(work))
      .join('');

    // Update Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Update counter
    this.updateCounter();

    // Hide/show load more button
    this.updateLoadMoreButton();
  }

  createArtworkCard(work) {
    const mainImage = work.imagenes?.find(img => img.tipo === 'principal');
    const imageUrl = mainImage?.url_storage || '';
    const hasBadge = work.tecnica?.nombre;

    return `
      <li>
        <a href="/obra/${work.slug}" class="artwork-card" aria-label="${work.titulo} by ${work.artista}">
          <div class="artwork-card__media ${!imageUrl ? 'is-empty' : ''}">
            ${imageUrl ? `<img src="${imageUrl}" alt="${work.titulo}" loading="lazy" />` : ''}
            ${hasBadge ? `<span class="artwork-card__badge">${work.tecnica.nombre}</span>` : ''}
          </div>
          <div class="artwork-card__body">
            <h3 class="artwork-card__title">${work.titulo}</h3>
            <dl class="artwork-card__meta">
              <dt hidden>Artista</dt>
              <dd>${work.artista}</dd>
              <dt hidden>Año</dt>
              <dd>${work.año}</dd>
            </dl>
            ${work.tags?.length > 0 ? `
              <div class="artwork-card__tags">
                ${work.tags.slice(0, 2).map(t => `<span class="tag-small">${t.tag.nombre}</span>`).join('')}
              </div>
            ` : ''}
            <button type="button" class="artwork-card__cta">
              <span data-i18n data-es="Ver obra" data-en="View work">Ver obra</span>
              <i data-lucide="arrow-right"></i>
            </button>
          </div>
        </a>
      </li>
    `;
  }

  updateCounter() {
    const counter = document.querySelector('[data-count]');
    if (counter) {
      const shown = this.page * this.pageSize;
      const total = this.totalWorks;
      const displayShown = Math.min(shown, total);

      counter.textContent = `${i18n.currentLang === 'es' ? 'Mostrando' : 'Showing'} ${displayShown} de ${total}`;
      counter.setAttribute('aria-label', counter.textContent);
    }
  }

  updateLoadMoreButton() {
    const loadMoreWrap = document.querySelector('[data-loadmore-wrap]');
    const loadMoreBtn = document.querySelector('[data-loadmore]');

    if (!loadMoreBtn) return;

    const shown = this.page * this.pageSize;
    const hasMore = shown < this.totalWorks;

    if (hasMore) {
      loadMoreWrap?.removeAttribute('hidden');
      loadMoreBtn?.removeAttribute('disabled');
    } else {
      loadMoreWrap?.setAttribute('hidden', '');
      loadMoreBtn?.setAttribute('disabled', '');
    }
  }

  showEmptyState() {
    const emptyState = document.querySelector('[data-empty]');
    const grid = document.querySelector('[data-grid]');

    if (emptyState) {
      emptyState.removeAttribute('hidden');
    }
    if (grid) {
      grid.innerHTML = '';
    }
  }

  showLoadingSpinner() {
    const spinner = document.querySelector('[data-loading]');
    if (spinner) {
      spinner.removeAttribute('hidden');
    }
  }

  hideLoadingSpinner() {
    const spinner = document.querySelector('[data-loading]');
    if (spinner) {
      spinner.setAttribute('hidden', '');
    }
  }

  updateActiveFilterChips() {
    const container = document.querySelector('[data-active-filters]');
    if (!container) return;

    const chips = [];

    if (this.filters.year) {
      chips.push({ label: `Año: ${this.filters.year}`, type: 'year' });
    }

    if (this.filters.technique) {
      const tech = this.techniqueOptions.find(t => t.id === this.filters.technique);
      if (tech) {
        chips.push({ label: `Técnica: ${tech.nombre}`, type: 'technique' });
      }
    }

    if (chips.length === 0) {
      container.setAttribute('hidden', '');
    } else {
      container.removeAttribute('hidden');
      container.innerHTML = chips
        .map(
          chip => `
            <div class="filter-chip">
              ${chip.label}
              <button type="button" data-remove="${chip.type}" aria-label="Quitar ${chip.label}">
                <i data-lucide="x" style="width:14px;height:14px;"></i>
              </button>
            </div>
          `
        )
        .join('');

      // Attach remove listeners
      container.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-remove');
          if (type === 'year') {
            document.querySelector('[data-filter="year"]').value = '';
          } else if (type === 'technique') {
            document.querySelector('[data-filter="technique"]').value = '';
          }
          this.handleFilterChange();
        });
      });

      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  async loadMore() {
    this.page++;
    await this.loadWorks();
    // Auto-scroll to new items
    window.scrollBy({ top: 400, behavior: 'smooth' });
  }

  clearFilters() {
    this.filters = {
      year: '',
      technique: '',
      tags: [],
      search: ''
    };

    // Reset form
    document.querySelector('[data-filter="year"]').value = '';
    document.querySelector('[data-filter="technique"]').value = '';
    document.querySelectorAll('[data-tag-id]').forEach(cb => {
      cb.checked = false;
    });
    document.getElementById('searchInput').value = '';

    this.page = 1;
    this.loadWorks();
    this.updateActiveFilterChips();
  }

  setupInfiniteScroll() {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !this.isLoading) {
          const loadMoreBtn = document.querySelector('[data-loadmore]');
          if (loadMoreBtn && !loadMoreBtn.disabled) {
            this.loadMore();
          }
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = document.querySelector('[data-loadmore-wrap]');
    if (sentinel) {
      observer.observe(sentinel);
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}
```

---

## 5. MÓDULO: i18n.js (Internacionalización)

```javascript
// app/js/i18n.js

export const i18n = {
  currentLang: localStorage.getItem('lang') || 'es',

  init() {
    // Set initial state
    this.updateLanguage(this.currentLang);

    // Setup toggle buttons
    document.querySelectorAll('.lang-toggle .lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        this.switchLanguage(lang);
      });
    });

    // Set year
    document.querySelectorAll('[data-year]').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  },

  switchLanguage(lang) {
    if (lang === this.currentLang) return;

    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    this.updateLanguage(lang);
  },

  updateLanguage(lang) {
    // Update all i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = lang === 'en' ? 'data-en' : 'data-es';
      const text = el.getAttribute(key);
      if (text) {
        el.textContent = text;
      }
    });

    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = lang === 'en' ? 'data-en-placeholder' : 'data-es-placeholder';
      const placeholder = el.getAttribute(key);
      if (placeholder) {
        el.placeholder = placeholder;
      }
    });

    // Update lang toggle button states
    document.querySelectorAll('.lang-toggle .lang-btn').forEach(btn => {
      const btnLang = btn.getAttribute('data-lang');
      if (btnLang === lang) {
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Update document lang
    document.documentElement.lang = lang;
  }
};
```

---

## 6. VARIABLES DE ENTORNO — .env

```
# Supabase
VITE_SUPABASE_URL=https://kfvjansfmhamkrnbxmgp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Para Edge Functions (no necesario en cliente)
# SERVICE_ROLE_KEY=eyJhbGc...
```

---

## PRÓXIMOS PASOS

1. **Decidir decisiones clave** (Ver auditoría parte 5)
2. **Abrir nuevo chat** con estas especificaciones
3. **Implementar en 1-2 chats** según complejidad
4. **Testing E2E** antes de push

---

**Documento preparado por:** Claude  
**Para:** Emmanuel (egodiseno)  
**Fecha:** 2026-06-12
