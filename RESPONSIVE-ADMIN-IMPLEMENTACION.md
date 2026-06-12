# RESPONSIVE ADMIN — IMPLEMENTACIÓN COMPLETA
## Catálogo Digital de Obra Serigráfica · UNAM/FAD

**Fecha:** 2026-06-10  
**Estado actual analizado:** admin.css (3,078 líneas) + index.html  
**Objetivo:** Mobile-first responsive sin tocar JS, sin romper design system

---

## DIAGNÓSTICO PREVIO (qué está fallando y por qué)

### Problema 1 — Dos definiciones de layout en conflicto
El archivo `admin.css` tiene **dos bloques `.sidebar` / `.main-content` / `.admin-header`**:

- **Bloque A** (líneas ~977–1115): `position: fixed`, `left: 0`, layout tipo panel flotante. Su `@media (max-width: 768px)` hace `width: 100%; height: auto; position: relative` — rompe el layout por completo.
- **Bloque B** (líneas ~1330–1450): `dashboard-container` con flexbox, sidebar dentro del flujo. Su `@media (max-width: 768px)` convierte el nav en barra horizontal con scroll.

El resultado: en mobile el sidebar ocupa todo el ancho arriba, el contenido cae debajo, y la UI es inutilizable.

### Problema 2 — No hay hamburger ni overlay en HTML
No existe ningún botón hamburger ni overlay para el drawer. Necesitan **añadirse al HTML** (2 líneas).

### Problema 3 — Tablas sin scroll horizontal real
`table-wrapper` con `overflow-x: auto` existe en CSS pero las tablas largas en móvil siguen siendo incómodas porque no hay columnas marcadas para ocultar en mobile.

### Problema 4 — `admin-header` fijo con `left: 280px`
En el Bloque A, el header tiene `left: 280px`. En mobile esto queda fuera de rango si el sidebar colapsa diferente.

---

## ESTRATEGIA DE SOLUCIÓN

**Patrón:** Sidebar como drawer off-canvas en mobile. Se abre con hamburger, overlay cierra al tocar fuera.

- **Mobile (≤ 767px):** Sidebar oculto por defecto, slide-in desde la izquierda al abrir.
- **Tablet (768px – 1023px):** Sidebar colapsado (solo íconos, sin labels).
- **Desktop (≥ 1024px):** Sidebar completo, comportamiento actual. ✅

**Restricción:** Solo CSS + mínimo JS añadido en `navigation.js` (toggle de clase). No se toca ningún otro archivo JS.

---

## PASO 1 — CAMBIOS EN `index.html` (2 inserciones)

### 1A — Botón hamburger en el header (dentro de `.header-left`)

**Buscar en index.html:**
```html
<div class="header-left">
  <h1 id="pageTitle">Dashboard</h1>
```

**Reemplazar con:**
```html
<div class="header-left">
  <button class="hamburger-btn" id="sidebarToggle" aria-label="Abrir menú" aria-expanded="false" aria-controls="adminSidebar">
    <i data-lucide="menu" style="width:20px; height:20px;" aria-hidden="true"></i>
  </button>
  <h1 id="pageTitle">Dashboard</h1>
```

### 1B — Overlay para cerrar el sidebar (dentro de `.dashboard-container`, antes del `<aside>`)

**Buscar en index.html:**
```html
<div id="dashboardPage" class="dashboard-container" style="display: none;">
    <!-- SIDEBAR -->
    <aside class="sidebar">
```

**Reemplazar con:**
```html
<div id="dashboardPage" class="dashboard-container" style="display: none;">
    <!-- OVERLAY (mobile) -->
    <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>
    <!-- SIDEBAR -->
    <aside class="sidebar" id="adminSidebar">
```

---

## PASO 2 — CAMBIOS EN `navigation.js` (append al final)

Añadir al final del `document.addEventListener('DOMContentLoaded', ...)`:

```javascript
// ============ HAMBURGER / SIDEBAR TOGGLE (mobile) ============
const hamburgerBtn  = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const adminSidebar  = document.getElementById('adminSidebar');

function openSidebar() {
  adminSidebar?.classList.add('sidebar--open');
  sidebarOverlay?.classList.add('sidebar-overlay--visible');
  hamburgerBtn?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('sidebar-is-open');
}

function closeSidebar() {
  adminSidebar?.classList.remove('sidebar--open');
  sidebarOverlay?.classList.remove('sidebar-overlay--visible');
  hamburgerBtn?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sidebar-is-open');
}

hamburgerBtn?.addEventListener('click', () => {
  const isOpen = adminSidebar?.classList.contains('sidebar--open');
  isOpen ? closeSidebar() : openSidebar();
});

sidebarOverlay?.addEventListener('click', closeSidebar);

// Cerrar sidebar al navegar (mobile UX)
navItems.forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth < 1024) closeSidebar();
  });
});

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSidebar();
});
```

---

## PASO 3 — BLOQUE CSS RESPONSIVO (añadir al FINAL de `admin.css`)

Añadir este bloque completo al final del archivo, después de la última regla existente:

```css
/* ══════════════════════════════════════════════════════════════════════
   RESPONSIVE SYSTEM — Mobile-first drawer sidebar
   Añadido: 2026-06-10
   Breakpoints: mobile < 768px | tablet 768–1023px | desktop ≥ 1024px
   ══════════════════════════════════════════════════════════════════════ */

/* ── HAMBURGER BUTTON ──────────────────────────────────────────── */
.hamburger-btn {
  display:          none;            /* oculto en desktop */
  align-items:      center;
  justify-content:  center;
  width:            40px;
  height:           40px;
  background:       none;
  border:           none;
  border-radius:    var(--radius-sm, 4px);
  color:            var(--color-blue, #013B75);
  cursor:           pointer;
  flex-shrink:      0;
  transition:       background-color 150ms ease;
}

.hamburger-btn:hover {
  background-color: var(--color-primary-light, #EEF4FB);
}

/* ── OVERLAY ───────────────────────────────────────────────────── */
.sidebar-overlay {
  display:          none;
  position:         fixed;
  inset:            0;
  background:       rgba(0, 0, 0, 0.45);
  z-index:          199;             /* debajo del sidebar (200) */
  backdrop-filter:  blur(2px);
  opacity:          0;
  transition:       opacity 250ms ease;
}

.sidebar-overlay.sidebar-overlay--visible {
  opacity: 1;
}

/* ── MOBILE (< 768px) ──────────────────────────────────────────── */
@media (max-width: 767px) {

  /* Mostrar hamburger */
  .hamburger-btn {
    display: flex;
  }

  /* Mostrar overlay (gestión por JS vía clase) */
  .sidebar-overlay {
    display: block;
  }

  /* SIDEBAR: drawer off-canvas */
  .sidebar {
    position:   fixed !important;
    top:        0 !important;
    left:       0 !important;
    height:     100vh !important;
    width:      280px !important;
    z-index:    200;
    transform:  translateX(-100%);
    transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
  }

  /* Sidebar abierto */
  .sidebar.sidebar--open {
    transform: translateX(0);
  }

  /* Evitar scroll del body cuando el drawer está abierto */
  body.sidebar-is-open {
    overflow: hidden;
  }

  /* HEADER: ocupa todo el ancho (no sidebar offset) */
  .admin-header {
    left:   0 !important;
    right:  0 !important;
    width:  100% !important;
    height: auto !important;
    min-height: 56px;
    padding: var(--spacing-md, 0.75rem) var(--spacing-lg, 1.25rem) !important;
    flex-wrap: wrap;
    gap: var(--spacing-sm, 0.5rem);
  }

  .header-left {
    flex: 1;
    min-width: 0;
    gap: var(--spacing-sm, 0.5rem);
  }

  .header-left h1 {
    font-size: var(--text-base, 1rem) !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Subtitle del header: ocultar en mobile para ahorrar espacio */
  .header-left p,
  #pageSubtitle {
    display: none;
  }

  /* MAIN CONTENT: sin offset de sidebar */
  .main-content {
    margin-left:  0 !important;
    margin-top:   56px !important;   /* altura del header mobile */
    padding:      var(--spacing-lg, 1.25rem) var(--spacing-md, 0.75rem) !important;
    width:        100% !important;
    overflow-x:   hidden;
  }

  /* DASHBOARD CONTAINER: ya no es flex row */
  .dashboard-container {
    flex-direction: column !important;
  }

  /* SECTION HEADER: stack vertical */
  .section-header {
    flex-direction: column !important;
    align-items:    flex-start !important;
    gap:            var(--spacing-md, 0.75rem) !important;
  }

  .section-header h2 {
    font-size: var(--text-xl, 1.25rem);
  }

  /* STATS GRID: 2 columnas en mobile grande, 1 en muy pequeño */
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md, 0.75rem);
  }

  /* FILTER BAR: columna vertical */
  .filter-bar {
    flex-direction: column !important;
    align-items:    stretch !important;
    gap:            var(--spacing-md, 0.75rem) !important;
  }

  .filter-bar input,
  .filter-bar select,
  .search-input,
  .select-input {
    width:     100% !important;
    max-width: none !important;
    min-width: 0 !important;
  }

  /* TABLAS: scroll horizontal */
  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 0 calc(-1 * var(--spacing-md, 0.75rem));
    padding: 0 var(--spacing-md, 0.75rem);
    width: calc(100% + 2 * var(--spacing-md, 0.75rem));
  }

  /* Tamaño de fuente en tablas */
  table {
    font-size: var(--text-xs, 0.8125rem);
    min-width: 500px;         /* fuerza scroll antes de colapsar */
  }

  table th,
  table td {
    padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 0.75rem);
    white-space: nowrap;
  }

  /* ACCIONES: botones pegados */
  .actions-cell {
    gap: var(--spacing-xs, 0.375rem);
    flex-wrap: nowrap;
  }

  /* CONTENT AREA padding reducido */
  .content-area {
    padding: var(--spacing-md, 0.75rem) !important;
  }

  /* FORM ROW: una columna */
  .form-row {
    grid-template-columns: 1fr !important;
  }

  /* MODAL: casi full-screen */
  .modal-overlay {
    padding: var(--spacing-sm, 0.5rem) !important;
    align-items: flex-end !important;   /* sheet desde abajo en mobile */
  }

  .modal-dialog,
  .modal {
    max-width:    100% !important;
    width:        100% !important;
    max-height:   92vh !important;
    border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0 !important;
    margin:       0 !important;
  }

  /* MODAL FOOTER: botones full-width apilados */
  .modal-footer {
    flex-direction: column-reverse !important;
    gap: var(--spacing-sm, 0.5rem) !important;
  }

  .modal-footer .btn {
    width: 100% !important;
    min-height: 48px !important;
  }

  /* PRIMARY ACTION arriba (column-reverse lo pone primero visualmente abajo) */

  /* BTN touch targets */
  .btn {
    min-height: 44px;
  }

  /* NUEVA OBRA botón: full-width en mobile */
  #newObraBtn,
  #dashboardQuickNewObra {
    width: 100%;
    justify-content: center;
  }

  /* BADGES en tabla: más compactos */
  .badge {
    font-size: 0.7rem;
    padding: 2px 6px;
  }

  /* PAGINACIÓN: stack */
  .pagination {
    flex-direction: column;
    align-items:    stretch;
    gap:            var(--spacing-md, 0.75rem);
  }

  .pagination .btn {
    width: 100%;
    justify-content: center;
  }

  /* GRID IMÁGENES: 2 columnas en mobile */
  .image-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  /* USER INFO: truncar email largo */
  #userEmail {
    max-width: 120px;
    overflow:  hidden;
    text-overflow: ellipsis;
    white-space:   nowrap;
    font-size: var(--text-xs, 0.8125rem);
  }
}

/* ── MOBILE MUY PEQUEÑO (< 400px) ─────────────────────────────── */
@media (max-width: 399px) {

  .stats-grid {
    grid-template-columns: 1fr;
  }

  /* Ocultar avatar de usuario, solo email */
  .user-avatar {
    display: none;
  }

  .image-grid {
    grid-template-columns: 1fr !important;
  }
}

/* ── TABLET (768px – 1023px) ──────────────────────────────────── */
@media (min-width: 768px) and (max-width: 1023px) {

  /* Mostrar hamburger en tablet también */
  .hamburger-btn {
    display: flex;
  }

  /* Sidebar: drawer igual que mobile */
  .sidebar {
    position:   fixed !important;
    top:        0 !important;
    left:       0 !important;
    height:     100vh !important;
    width:      280px !important;
    z-index:    200;
    transform:  translateX(-100%);
    transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar.sidebar--open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: block;
  }

  body.sidebar-is-open {
    overflow: hidden;
  }

  /* HEADER: sin offset de sidebar */
  .admin-header {
    left:   0 !important;
    right:  0 !important;
    width:  100% !important;
  }

  /* MAIN CONTENT: sin offset, padding moderado */
  .main-content {
    margin-left: 0 !important;
    padding: var(--spacing-xl, 2rem) var(--spacing-lg, 1.25rem) !important;
  }

  /* STATS GRID: 2 columnas en tablet */
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* FILTER BAR: fila pero wrap si es necesario */
  .filter-bar {
    flex-wrap: wrap;
  }

  /* FORM ROW: mantener 2 columnas en tablet */
  .form-row {
    grid-template-columns: 1fr 1fr;
  }

  /* MODAL: tamaño razonable */
  .modal-dialog,
  .modal {
    max-width: 600px !important;
    max-height: 90vh !important;
  }

  /* BTN touch targets */
  .btn {
    min-height: 44px;
  }

  /* IMAGEN GRID: 3 columnas */
  .image-grid {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}

/* ── DESKTOP (≥ 1024px) — restaurar comportamiento base ───────── */
@media (min-width: 1024px) {

  /* Hamburger oculto */
  .hamburger-btn {
    display: none !important;
  }

  /* Overlay nunca visible en desktop */
  .sidebar-overlay {
    display: none !important;
  }

  /* Sidebar siempre visible, posición fija */
  .sidebar {
    position:  fixed !important;
    top:       0 !important;
    left:      0 !important;
    height:    100vh !important;
    width:     var(--sidebar-width, 280px) !important;
    transform: translateX(0) !important;
    transition: none !important;
  }

  /* Header con offset del sidebar */
  .admin-header {
    left:  var(--sidebar-width, 280px) !important;
    right: 0 !important;
  }

  /* Main content con offset del sidebar */
  .main-content {
    margin-left: var(--sidebar-width, 280px) !important;
    margin-top:  var(--header-height, 64px) !important;
    padding:     var(--spacing-2xl, 2.5rem) !important;
  }

  /* Imagen grid: 4 columnas en desktop */
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)) !important;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   FIN RESPONSIVE SYSTEM
   ══════════════════════════════════════════════════════════════════════ */
```

---

## PASO 4 — NEUTRALIZAR CONFLICTOS EN CSS EXISTENTE

Los dos bloques `@media (max-width: 768px)` en el CSS base (líneas ~1099 y ~1682) entran en conflicto con el nuevo sistema. Como el nuevo bloque se añade al **final** del archivo, sobreescribe gracias a la cascada. No requieren borrado inmediato.

**Sin embargo**, para evitar futura confusión, en Claude Code se puede añadir un comentario encima de cada uno:

**Línea ~1099 (primer `@media (max-width: 768px)` del layout):**
```css
/* DEPRECATED: reemplazado por responsive system al final del archivo (2026-06-10) */
```

**Línea ~1682 (segundo `@media (max-width: 768px)`):**
```css
/* DEPRECATED: reemplazado por responsive system al final del archivo (2026-06-10) */
```

---

## RESUMEN DE CAMBIOS

| Archivo | Tipo de cambio | Líneas afectadas |
|---------|---------------|-----------------|
| `index.html` | Añadir botón hamburger en `.header-left` | +4 líneas |
| `index.html` | Añadir overlay div antes de `<aside>` | +2 líneas |
| `index.html` | Añadir `id="adminSidebar"` al `<aside>` | 1 atributo |
| `js/navigation.js` | Añadir lógica hamburger al final | +40 líneas |
| `css/admin.css` | Añadir bloque responsive al final | +~200 líneas |
| `css/admin.css` | Comentar 2 bloques @media deprecados | 2 comentarios |

**Total:** ~250 líneas nuevas, cero líneas borradas.

---

## COMPORTAMIENTO ESPERADO POR BREAKPOINT

### Mobile (320px – 767px)
- Sidebar: oculto por defecto, aparece como drawer desde la izquierda al presionar ☰
- Header: ocupa 100% del ancho, hamburger visible, subtitle oculto
- Tablas: scroll horizontal, fuente reducida
- Modales: sheet desde abajo, full-width, botones apilados
- Formularios: una columna
- Stats: 2 columnas (1 columna en <400px)

### Tablet (768px – 1023px)
- Sidebar: drawer igual que mobile (hamburger visible)
- Header: 100% ancho, hamburger visible
- Tablas: scroll horizontal, legibles
- Modales: max-width 600px centrado
- Formularios: 2 columnas
- Stats: 2 columnas

### Desktop (≥ 1024px)
- Sidebar: fijo 280px a la izquierda, siempre visible ✅
- Header: offset de 280px ✅
- Tablas: completas ✅
- Modales: max-width 560px centrado ✅
- Formularios: 2 columnas ✅

---

## INSTRUCCIONES PARA CLAUDE CODE

Ejecutar en este orden:

```
1. Abrir app/admin/index.html
   - Añadir <div class="sidebar-overlay" id="sidebarOverlay"></div> 
     ANTES de <aside class="sidebar">
   - Añadir id="adminSidebar" a <aside class="sidebar">
   - Añadir botón hamburger en <div class="header-left"> antes de <h1>

2. Abrir app/admin/js/navigation.js
   - Añadir el bloque "HAMBURGER / SIDEBAR TOGGLE" al final del 
     DOMContentLoaded listener

3. Abrir app/admin/css/admin.css
   - Añadir el bloque RESPONSIVE SYSTEM completo al final del archivo
   - Añadir comentarios DEPRECATED en los dos @media (max-width: 768px) 
     de las líneas ~1099 y ~1682

4. Verificar en Chrome DevTools con los breakpoints:
   - 375px (iPhone SE) ← prioritario
   - 430px (iPhone 14 Pro Max)
   - 820px (iPad Air)
   - 1280px (desktop estándar)

5. Commit: "RESPONSIVE: Sidebar drawer, mobile layout, tablet breakpoints"
```

---

*Documento generado para implementación directa en Claude Code terminal.*
*No requiere contexto adicional de esta sesión.*
