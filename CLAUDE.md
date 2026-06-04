# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Catálogo Digital de Obra Serigráfica — UNAM / FAD / Taller de Serigrafía.**

Academic/cultural catalog for exhibition and research of serigraphy works. Not ecommerce, not a social platform, not a SaaS dashboard.

## Stack

- Static HTML + CSS + vanilla JS — no build step, no npm, no preprocessor.
- Tailwind via CDN (supplemented by `app/css/styles.css` for design tokens and components).
- JSON files in `app/data/` as the data source (no backend).
- Deploy: Netlify, publish directory `app`, no build command.

## Local development

Open any HTML file through a local server — **not `file://`**, because `fetch()` will fail to load the JSON files.

A simple option: `python -m http.server 8000` from the `app/` directory, then open `http://localhost:8000`.

## Repo structure

```
app/
├─ index.html                           # Home
├─ index.html                        # Catalog with search + filters
├─ archivo.html                         # Archive grouped by year
├─ obra-memoria-del-taller.html         # Only live artwork detail page
├─ tecnica-serigrafia-experimental.html # Representative technique view
├─ serie-archivo-grafico.html           # Representative series view
├─ acerca.html                          # About page
├─ 404.html                             # Error page
├─ css/styles.css                       # Design tokens + all components
├─ js/
│   ├─ main.js           # Mobile nav toggle
│   ├─ drawer.js         # Mobile filter drawer
│   ├─ filters.js        # Catalog: fetch, search, filters, chips, load-more, URL params
│   ├─ archive.js        # Archive-by-year view
│   ├─ collection-view.js # Technique/series view (parametrized by data-collection-kind)
│   ├─ shared.js         # Generic shared helpers (window.CatalogUtils)
│   ├─ image-viewer.js   # Simple image viewer on artwork detail
│   └─ share-panel.js    # Copy/share URL on artwork detail
├─ data/
│   ├─ artworks.json     # Primary dataset (24 works)
│   ├─ years.json
│   ├─ techniques.json
│   ├─ series.json
│   └─ tags.json
├─ assets/mock/artworks/ # Artwork images — filenames match mainImage field in artworks.json
└─ admin/                # Admin prototype (static HTML wireframes, no real auth)
```

## Data model (`artworks.json`)

Key fields per artwork: `id`, `title`, `slug`, `author`, `year`, `technique`, `techniqueSlug`, `series`, `seriesSlug`, `seriesLabel`, `tags[]`, `dimensions`, `edition`, `description`, `credits`, `mainImage`, `publicationStatus`, `relatedArtworkIds[]`, `detailUrl`.

`detailUrl` is only set on `obra-01` ("Memoria del taller"). All other cards show "Ficha reservada" — this is intentional. Do not add `detailUrl` values for artworks that don't have a corresponding HTML file.

`Sin serie` is a display label only, not a taxonomy or routable path.

## CSS design system (`app/css/styles.css`)

Design tokens in `:root` — key categories:

- Colors: `--color-bg`, `--color-surface`, `--color-ink`, `--color-muted`, `--color-blue`, `--color-blue-deep`, `--color-gold`
- Spacing: `--space-1` … `--space-12` (4px → 48px)
- Radius: `--radius-xs` … `--radius-sheet`
- Shadows: `--shadow-archival`, `--shadow-sheet`
- Interactive heights: `--height-input`, `--height-button`, `--height-chip` (with mobile variants)
- Focus: `--focus-ring`

Visual direction: warm light background, deep institutional blue as accent, editorial tone. UI must not compete with the artwork.

## JS architecture (`filters.js`)

`filters.js` is the most complex module. It initializes only if `[data-catalog-app]` exists on the page. All DOM references use `data-*` attributes (not IDs or classes). State (`artworks[]`, `filtered[]`, `query`, `filters{}`, `visibleCount`) is held in a module-scoped object. URL params (`?year=`, `?technique=`, `?series=`) are read on init and applied as initial filters.

## Routing

All cross-page links use `index.html?year=…`, `index.html?technique=…`, `index.html?series=…`. No client-side router.

See `app/ROUTES.md` for the full route map and which static detail/technique/series pages exist.

## Admin prototype

`app/admin/` contains static HTML wireframes for a future admin interface (artwork CRUD, image management, user management, taxonomy management). These are UI prototypes only — no real authentication or data mutation. `admin/js/admin-login.js` and `admin/js/admin-main.js` are stubs.

## Constraints (from AGENTS.md — must be respected)

- No ecommerce patterns (prices, cart, purchase buttons, ratings, download links).
- No invented data — do not add artworks, authors, or series that don't exist in the approved dataset.
- Do not recreate institutional logos if no image file exists.
- No global refactors without authorization. Make minimal, localized changes only.
- Do not migrate to Next.js, Supabase, backend, or auth without explicit instruction.
- Do not add new components if an existing one can be adjusted.

## Accessibility

WCAG 2.2 AA target throughout: sufficient contrast, visible focus (`--focus-ring`), keyboard navigation, `aria-*` labels, text alternatives for images, no color-only communication.

## Before editing

1. Read the relevant files.
2. Identify the exact fragment to change.
3. Confirm the change is minimal and localized.
4. Apply only the requested adjustment.
5. Report modified files and how to verify in the browser.
