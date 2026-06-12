# AUDITORÍA UX/UI/TECH — Catálogo Público Funcional
**Fecha:** 2026-06-12  
**Estado:** Admin 100% funcional ✅ | Catálogo Público por construir ⏳  
**Preparado para:** Chat de integración catálogo público + Supabase

---

## PARTE 1: ESTADO ACTUAL DEL PROYECTO

### ✅ Admin Completamente Funcional
- **Tecnología:** HTML + CSS + JS vanilla + Supabase (DB, Auth, Storage)
- **Funcionalidades implementadas:**
  - Login con MFA (TOTP)
  - Dashboard con métricas
  - CRUD obras (crear, editar, eliminar)
  - Upload múltiples imágenes a Supabase Storage
  - Gestión de técnicas (CRUD)
  - Gestión de tags (CRUD)
  - Gestión de usuarios admin
  - Recuperación de contraseña
  - Validaciones cliente + servidor (RLS en Supabase)
  - 25+ archivos JS modularizados
  - Design system UNAM (azul #013B75, oro #D9A500)

### ⏳ Catálogo Público Por Construir
- **Estado actual:** Mockup estático (mockup-catalog-v2.html) — NO conectado a datos
- **Qué falta:**
  - Conexión a Supabase (fetch de obras, técnicas, tags, imágenes)
  - Ficha detalle de obra (slug-based)
  - Galería de imágenes (carrusel)
  - Filtros funcionales (año, técnica, tags)
  - Búsqueda por título (debounce)
  - Lazy load de grid
  - Responsividad verificada
  - Edge Function convert-webp para optimizar imágenes
  - I18n completo (ES/EN)

### 📊 Estructura Actual
```
app/
├── admin/ (100% funcional)
│   ├── index.html (40KB)
│   ├── css/admin.css (248KB — consolidado)
│   ├── js/ (25+ módulos)
│   └── assets/
└── [FALTA] index.html (catálogo público)
```

---

## PARTE 2: ANÁLISIS DEL MOCKUP — FORTALEZAS Y OPORTUNIDADES

### ✅ FORTALEZAS del Mockup Actual

| Aspecto | Evaluación | Razón |
|---------|-----------|-------|
| **Paleta UNAM** | ⭐⭐⭐⭐⭐ | Azul #013B75 y oro #D9A500 bien aplicados, profesional |
| **Tipografía** | ⭐⭐⭐⭐ | Inter + Lora funciona bien, escala clara (14–36px) |
| **Grid responsivo** | ⭐⭐⭐⭐ | 1 col (mobile) → 2 (tablet) → 3 (desktop) → 4 (large) ✓ |
| **Cards artwork** | ⭐⭐⭐⭐ | Aspect ratio 4:5 portrait, hover effect suave |
| **Header** | ⭐⭐⭐⭐ | Logo UNAM/FAD, nav limpio, toggle idioma visible |
| **Filtros** | ⭐⭐⭐⭐ | Estructura clara pero estática (sin conectividad) |
| **Footer** | ⭐⭐⭐⭐ | 4 columnas + social links + branding |
| **Accesibilidad** | ⭐⭐⭐⭐ | Labels, ARIA basics, focus visible |

---

### 🔧 OPORTUNIDADES DE MEJORA UX/UI

#### 1. **HERO SECTION — Tipografía Editorial**
**Problema actual:** Hero es simple, solo texto con span gold.  
**Propuesta premium:**
- Aumentar tamaño h1 con `clamp(2.5rem, 5vw, 3.5rem)` (más impacto visual)
- Aplicar **gradient subtle** al "Obra Serigráfica": azul → oro
- Agregar línea decorativa (1px oro) encima del h1
- Lead text + eyebrow con spacing mejor
- Investigar si quieren imagen de fondo sutil (blurred, low-contrast)

**Beneficio:** Mayor presencia, más premium, guía ojo al contenido clave.

```css
/* PROPUESTA */
.hero h1 {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  background: linear-gradient(135deg, #013b75 0%, #d9a500 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}
```

---

#### 2. **FILTROS — Experiencia UX Mejorada**
**Problema actual:** 
- Filtros en sección separada (debajo del hero)
- Requieren "Aplicar" explícito (no es real-time)
- Sin estados visuales de filtros activos

**Propuestas premium:**
- **Sticky filter bar** en scroll (desktop)
  - Se queda fijo arriba del grid cuando scrolleas
  - Muy usado en catálogos premium (Behance, Dribbble, FOTOCRACY)
  - Implementación: CSS `position: sticky` + z-index control
  
- **Real-time filtering** (sin botón "Aplicar")
  - El grid se actualiza mientras el usuario selecciona
  - Mejor UX, menos clicks
  - Más "moderno"
  
- **Visualizar filtros activos** como "chips" remoción rápida
  - Ej: "Año: 2025 ✕ | Técnica: Seriografía ✕"
  - Click en X → quita ese filtro
  
- **Collapse/expand en mobile** (drawer o acordeón)
  - No ocupa 100% del viewport en móvil
  - Botón "Mostrar filtros" que abre panel lateral

**Beneficio:** UX más fluida, usuario descubre contenido más rápido, patrón moderno.

---

#### 3. **GRID + PAGINACIÓN — Optimizar Carga**
**Problema actual:** 
- Botón "Cargar más" requiere click
- Sin indicador de progreso

**Propuestas premium:**
- **Infinite scroll** (auto-cargar al llegar al bottom)
  - Más fluido que clicks
  - Agregar "Intersection Observer" para detectar bottom
  - Mostrar loading spinner + contador dinámico
  
- **O mantener "Cargar más"** pero mejorar:
  - Mostrar contador: "Mostrando 12 de 48 obras"
  - Botón desaparece cuando no hay más (mejor UX)
  - Loading state visual (disabled, spinner)

**Beneficio:** Experiencia menos friccionada, moderna.

---

#### 4. **ARTWORK CARDS — Detalles Premium**
**Problema actual:** Cards básicas con imagen + metadata.  
**Propuestas premium:**

a) **Gradiente subtle en placeholder**
```css
/* Actual */
background: linear-gradient(135deg, #eef2f7, #e0e7f0);

/* Mejora */
background: linear-gradient(135deg, #013b75 0%, #d9a500 50%, #eef4fb 100%);
opacity: 0.08;
```
Efecto: Si la imagen no carga, ve un gradiente institucional bonito.

b) **Badge de técnica en esquina**
- Fondo azul, texto blanco, esquina superior derecha
- Ej: "Serigrafía experimental"
- Comunica rápido sin leer metadata

c) **Efecto hover mejorado**
```css
.artwork-card:hover .artwork-card__media img {
  transform: scale(1.05); /* Actual es 1.03 */
}

/* NUEVO: Overlay dinámico */
.artwork-card:hover::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(1, 59, 117, 0.05);
  transition: all 0.3s var(--ease);
}
```

d) **Link "Ver obra" más explícito**
- Botón explícito tipo "Explorar" o arrow icon (Lucide)
- Hover con fondo dorado sutil

**Beneficio:** Cards más premium, información más clara, mejor CTR.

---

#### 5. **FICHA DE OBRA — Detalle Premium**
**Problema actual:** No existe aún.  
**Propuesta arquitectura:**

**Opción A: Página dedicada (tradicional)**
- URL: `/obra/memoria-del-taller`
- HTML generado dinámicamente o ruta estática para cada obra
- Imagen grande (1200px+), metadata, galería, breadcrumb

**Opción B: Modal/overlay (moderno, SPA-like)**
- Click en card → abre modal fullscreen
- Imagen expandida, galería en carrusel, cerrar con ESC o X
- Sin cambio de URL (o con history API para back)
- Menos "saltones", más fluido

**RECOMENDACIÓN:** Opción A (página dedicada)
- SEO mejor (URLs individuales indexables)
- Permalink compartible
- Performance igual
- UX más clara

**Estructura recomendada:**
```
Ficha de obra:
- Breadcrumb: "Catálogo > 2024 > Serigrafía > Obra"
- Imagen principal grande (1:1 o 4:5)
- Galería adicional (carrusel horizontal, 3-4 imágenes)
- Metadata: Título, artista, año, técnica, descripción, tags
- Botón "← Volver al catálogo"
- Relacionadas: 3-4 obras del mismo artista o técnica
```

---

#### 6. **GALERÍA DE IMÁGENES — Carrusel Inteligente**
**Propuesta:**
- **Carrusel horizontal** (vs grid 2×2)
- Usar Lucide icons para prev/next (ChevronLeft, ChevronRight)
- **Keyboard navigation:** Arrow left/right
- **Touch/swipe** en mobile
- Indicadores de posición (dot pagination o contador)
- Zoom on click → lightbox (imagen grande + close)

**Librería:**
- Vanilla JS con IntersectionObserver (sin dependencias)
- O considerar Alpine.js (super ligero, directivo)

**Beneficio:** Experiencia fluida, moderna, accesible.

---

#### 7. **BÚSQUEDA — UX Mejorada**
**Problema actual:** Input simple, probablemente trigger en submit.  
**Propuestas premium:**

a) **Search real-time con debounce**
```javascript
// Debounce 300ms = no query por cada keystroke
const handleSearch = debounce((query) => {
  filterWorks(query);
}, 300);
```

b) **Autocomplete/suggestions**
- Mientras escribe, mostrar 5-10 obras coincidentes
- Click en sugerencia → va a la obra
- Patrón Google, muy premium

c) **Empty state + "sin resultados"**
- Si no hay resultados: "No encontramos obras con '...'"
- Sugerencia: "Intenta otro término" o botón "Limpiar"

d) **Buscar en título, artista, descripción**
- No solo título

**Beneficio:** Acceso rápido, menos clics.

---

#### 8. **I18N (Internacionalización ES/EN)**
**Problema actual:** Mockup tiene `data-i18n` attributes pero no funciona.  
**Propuesta:**

```html
<!-- HTML -->
<button data-i18n data-es="Aplicar" data-en="Apply">Aplicar</button>

<!-- JS -->
const i18n = {
  currentLang: localStorage.getItem('lang') || 'es',
  
  switch(lang) {
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    this.render();
  },
  
  render() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = this.currentLang === 'en' ? 'data-en' : 'data-es';
      el.textContent = el.getAttribute(key);
    });
  }
};

// Toggle button
document.querySelector('.lang-toggle').addEventListener('click', () => {
  i18n.switch(i18n.currentLang === 'es' ? 'en' : 'es');
});
```

**O usar librería ligera:** `i18next` (recomendado si crece)

**Beneficio:** Accesibilidad global, muy profesional.

---

#### 9. **HEADER — Refinamientos**
**Mejoras propuestas:**

a) **Logo clickeable → home**
```html
<a href="/" class="brand">
  <img src="unam.svg" alt="UNAM" />
</a>
```

b) **Mobile nav mejor**
- Actual usa `<details>` (nativo, bien)
- Agregar backdrop/overlay oscuro detrás del panel
- Animación suave de slide-in

c) **Búsqueda en header (visible)**
- Input search principal + glass morphism
- Puede tomar más ancho desktop

d) **Indicador de resultados filtrados**
- Ej: badge rojo con número si hay filtros activos
- "5 filtros aplicados" → clear all button

**Beneficio:** Navegación más fluida, profesional.

---

#### 10. **FOOTER — Información + Credibilidad**
**Mejoras propuestas:**

a) **Links útiles específicos:**
```
- Acerca del catálogo
- Equipo del taller
- Contacto
- Políticas de uso
- Accesibilidad
```

b) **Social links:**
- Instagram del taller (si existe)
- Facebook UNAM
- Íconos Lucide

c) **Créditos**
- "Diseño: [nombre]"
- "Desarrollo: egodiseno"
- Año actual dinámico: `© 2026 UNAM`

**Beneficio:** Mayor credibilidad, profesionalismo.

---

#### 11. **ACCESIBILIDAD — WCAG AA++**
**Checklist:**

- [ ] Contraste mínimo 4.5:1 (pasas azul UNAM, pero verificar gris)
- [ ] Labels en todos los inputs (ya está)
- [ ] `aria-live` en contador dinámico (ya está)
- [ ] Keyboard nav: TAB → filtros → busca → grid → footer
- [ ] Focus visible en todos los elementos interactivos
- [ ] Error messages con `aria-describedby`
- [ ] Imágenes con alt text (importantes)
- [ ] Links con text claro (no "click aquí")
- [ ] Colores no son único diferenciador (iconos + texto)

**Herramientas:**
- axe DevTools (Chrome extension)
- WAVE (WebAIM)
- Lighthouse (Chromium)

**Beneficio:** Inclusivo, legal, mejor SEO.

---

### 📐 TAMAÑOS DE IMAGEN — Especificación

**Basado en grid 4 columnas desktop (1440px):**

```
Container: 1280px max-width
Grid gap: 1.5rem (24px)
Card width: (1280 - 72px gap) / 4 ≈ 302px

Recomendación:

1. Grid thumbnail (card):
   - Ancho: 320px (redondeado)
   - Alto: 400px (4:5 aspect ratio)
   - Formato: WebP (80% calidad)
   - Tamaño: 40–80 KB por imagen

2. Ficha principal:
   - Ancho: 1200px (fullwidth container)
   - Alto: 1500px (4:5 ratio)
   - Formato: WebP
   - Tamaño: 150–250 KB

3. Galería adicional (carrusel):
   - Ancho: 800px
   - Alto: 1000px (4:5 ratio)
   - Formato: WebP
   - Tamaño: 100–150 KB
```

**Edge Function convert-webp:**
```typescript
Input: JPG/PNG cualquier tamaño
Output:
- Redimensiona a tamaños recomendados
- Convierte a WebP (calidad 80%)
- Devuelve URL + metadata (dimensiones, peso antes/después)
- Guarda en Supabase Storage: /artworks/obra_{id}_{type}_{timestamp}.webp
```

**Estimación de almacenamiento:**
- 100 obras × 4 imágenes × 100 KB promedio = 40 MB
- Plan Supabase FREE: 1 GB (suficiente para crecer)

---

## PARTE 3: ARQUITECTURA TÉCNICA RECOMENDADA

### 📁 Estructura de Carpetas (New)

```
app/
├── index.html                    (Catálogo público - NUEVA)
├── obra-[slug].html              (Ficha individual obra - DINÁMICA)
│
├── css/
│   ├── styles.css                (Estilos públicos - NUEVA)
│   └── utilities.css             (Utilitarios)
│
├── js/
│   ├── public-catalog.js         (Grid, filtros, búsqueda - NUEVA)
│   ├── public-detail.js          (Lógica ficha individual - NUEVA)
│   ├── gallery.js                (Carrusel imágenes - NUEVA)
│   ├── i18n.js                   (Internacionalización - NUEVA)
│   ├── shared.js                 (Helpers compartidos - EXISTENTE)
│   └── api-client.js             (Wrapper Supabase fetch - NUEVA)
│
├── admin/                        (Existente, sin cambios)
│   └── [25+ archivos JS]
│
└── assets/
    ├── brand/                    (UNAM.svg, FAD.svg)
    └── icons/                    (Lucide - CDN)
```

---

### 🔄 Flujo de Datos — Admin ↔ Público

```
Admin Panel (Supabase Auth)
├── Crea Obra
├── Sube 4 imágenes (a Storage)
└── Publica (estado='publicado')
         ↓
    Supabase DB:
    - obras (estado='publicado')
    - imagenes (obra_id = referencia)
    - técnicas, tags
         ↓
    Público (sin auth):
    ├── Fetch obras públicas
    ├── Renderiza grid dinámico
    └── Click obra → ficha (slug-based)
```

**Real-time sync:** Supabase Realtime (opcional, fase 2)

---

### 🎬 Componentes JS Clave

#### 1. **public-catalog.js** (Grid principal)
```javascript
export class PublicCatalog {
  constructor() {
    this.works = [];
    this.filtered = [];
    this.page = 1;
    this.pageSize = 12;
    this.filters = {
      year: null,
      technique: null,
      tags: [],
      search: ''
    };
  }

  async init() {
    await this.loadWorks();
    await this.loadFilterOptions();
    this.renderGrid();
    this.attachEventListeners();
  }

  async loadWorks() {
    // SELECT * FROM obras WHERE estado='publicado'
    // + JOIN imagenes, técnicas, tags
  }

  async loadFilterOptions() {
    // SELECT DISTINCT año FROM obras
    // SELECT * FROM técnicas
    // SELECT * FROM tags
  }

  applyFilters() {
    // Filter this.works por criteria
    // Renderiza grid actualizado
    // Real-time (sin botón "Aplicar")
  }

  renderGrid() {
    // Mapea this.filtered → HTML cards
    // Aplica lazy loading con Intersection Observer
  }

  setupInfiniteScroll() {
    // O botón "Cargar más"
    // Cuando usuario llega al bottom → fetch siguiente página
  }
}
```

#### 2. **public-detail.js** (Ficha obra)
```javascript
export class WorkDetail {
  constructor(slug) {
    this.slug = slug;
    this.work = null;
  }

  async init() {
    this.work = await this.fetchWorkBySlug(this.slug);
    if (!this.work) return this.show404();
    
    this.renderDetail();
    this.loadGallery();
  }

  async fetchWorkBySlug(slug) {
    // SELECT * FROM obras WHERE slug = ?
  }

  renderDetail() {
    // Breadcrumb
    // Imagen principal
    // Metadata (título, artista, año, técnica, descripción)
    // Tags como chips
    // Botón "← Volver"
  }

  loadGallery() {
    // Cargar imagenes adicionales
    // Instanciar Gallery component
  }
}
```

#### 3. **gallery.js** (Carrusel)
```javascript
export class Gallery {
  constructor(container, images) {
    this.container = container;
    this.images = images;
    this.current = 0;
  }

  init() {
    this.render();
    this.attachControls();
    this.attachKeyboard();
  }

  next() { /* slide siguiente */ }
  prev() { /* slide anterior */ }
  goTo(index) { /* ir a índice */ }
  
  attachControls() {
    // Prev/next buttons
    // Dot pagination
  }

  attachKeyboard() {
    // ArrowLeft, ArrowRight
  }

  setupLightbox() {
    // Click imagen → fullscreen
    // ESC → cerrar
  }
}
```

#### 4. **api-client.js** (Cliente Supabase)
```javascript
export const api = {
  async getPublishedWorks(page = 1, pageSize = 12) {
    const { data, error } = await supabase
      .from('obras')
      .select(`
        id, titulo, slug, artista, año, descripcion,
        tecnica:tecnica_id(id, nombre, slug),
        tags:obra_tags(tag_id(id, nombre, slug)),
        imagenes!inner(url_storage, tipo, orden)
      `)
      .eq('estado', 'publicado')
      .range((page - 1) * pageSize, page * pageSize - 1)
      .order('created_at', { ascending: false });
    
    return data;
  },

  async getWorkBySlug(slug) {
    const { data } = await supabase
      .from('obras')
      .select(`...`)
      .eq('slug', slug)
      .single();
    return data;
  },

  async getFilterOptions() {
    // Años, técnicas, tags distintos
  }
};
```

---

### 🚀 Performance Optimizations

1. **Lazy loading imágenes**
   ```html
   <img src="..." loading="lazy" alt="..." />
   ```

2. **WebP + fallback**
   ```html
   <picture>
     <source srcset="image.webp" type="image/webp" />
     <source srcset="image.jpg" type="image/jpeg" />
     <img src="image.jpg" alt="..." />
   </picture>
   ```

3. **Caché de filtros (localStorage)**
   ```javascript
   // Guarda técnicas, tags, años en localStorage
   // No los fetcha de nuevo en cada reload
   ```

4. **Debounce en búsqueda**
   ```javascript
   const searchDebounced = debounce(handleSearch, 300);
   ```

5. **Intersection Observer para infinite scroll**
   ```javascript
   const observer = new IntersectionObserver((entries) => {
     if (entries[0].isIntersecting) {
       loadMoreWorks();
     }
   });
   observer.observe(lastCard);
   ```

---

## PARTE 4: CHECKLIST DE IMPLEMENTACIÓN

### Phase 1: Setup Base (1 chat)
- [ ] Crear `app/index.html` (estructura base del mockup)
- [ ] Crear `app/css/styles.css` (estilos consolidados)
- [ ] Crear `app/js/api-client.js` (conexión Supabase)
- [ ] Verificar permisos RLS en Supabase (SELECT público)

### Phase 2: Grid Dinámico (1 chat)
- [ ] `public-catalog.js` — fetch obras, renderizar grid
- [ ] Lazy loading imágenes
- [ ] Paginación o infinite scroll
- [ ] Contador dinámico

### Phase 3: Filtros + Búsqueda (1 chat)
- [ ] Dropdown año, técnica, tags dinámicos
- [ ] Real-time filtering (sin botón "Aplicar")
- [ ] Search con debounce
- [ ] Visualizar filtros activos

### Phase 4: Ficha Detalle (1 chat)
- [ ] `obra-[slug].html` (generado dinámicamente)
- [ ] Imagen principal grande
- [ ] Metadata completa
- [ ] Breadcrumb

### Phase 5: Galería + Mejoras (1 chat)
- [ ] `gallery.js` — carrusel imágenes
- [ ] Lightbox
- [ ] I18n completo (ES/EN)
- [ ] Edge Function convert-webp

### Phase 6: Pulido Final (1 chat)
- [ ] Testing responsive (320px, 768px, 1440px)
- [ ] Testing E2E (admin crea → aparece en público)
- [ ] Auditoría accesibilidad (axe DevTools)
- [ ] Optimizaciones performance
- [ ] Commit final a GitHub

---

## PARTE 5: DECISIONES CLAVE A TOMAR AHORA

### 1. **¿Filtros sticky o tradicionales?**
- Sticky = más moderno, mejor UX (pero requiere JS)
- Tradicional = simple, pasado de moda (pero funciona bien)
- **RECOMENDACIÓN:** Sticky (pequeño esfuerzo, gran impacto)

### 2. **¿Infinite scroll o botón "Cargar más"?**
- Infinite = moderno, menos clicks (Dribbble, Behance)
- Botón = transparente, usuario controla (Flickr, 500px)
- **RECOMENDACIÓN:** Infinite scroll + contador visible

### 3. **¿Ficha en página o modal?**
- Página = SEO, URLs compartibles, tradicional
- Modal = SPA-like, fluido, moderno
- **RECOMENDACIÓN:** Página (mejor SEO, links compartibles)

### 4. **¿Galería horizontal o grid?**
- Horizontal carrusel = limpio, espacial
- Grid 2×2 = muestra todo, sin navegar
- **RECOMENDACIÓN:** Horizontal carrusel (actual mockup sugiere esto)

### 5. **¿Cuántas imágenes por obra?**
- Actual: 1 principal + 3-4 adicionales
- **RECOMENDACIÓN:** Mantener esto (es equilibrado)

### 6. **¿Cuántas obras por página?**
- 12 (grid 4 col × 3 rows desktop)
- **RECOMENDACIÓN:** 12 (buen balance load time vs opciones)

---

## PARTE 6: ESTIMACIÓN DE ESFUERZO

| Tarea | Complejidad | Tiempo | Chat |
|-------|------------|--------|------|
| Setup base | ⭐ | 30 min | 1 |
| Grid dinámico | ⭐⭐ | 1h | 1 |
| Filtros reales | ⭐⭐⭐ | 1.5h | 1 |
| Búsqueda + debounce | ⭐⭐ | 45 min | 1 |
| Ficha detalle | ⭐⭐⭐ | 1.5h | 1 |
| Galería carrusel | ⭐⭐ | 1h | 1 |
| I18n (ES/EN) | ⭐⭐ | 45 min | 1 |
| Edge Function WebP | ⭐⭐⭐ | 1h | 1 |
| Testing + E2E | ⭐⭐ | 1h | 1 |
| Pulido final | ⭐ | 30 min | 1 |
| **TOTAL** | | **10h** | **1 chat optimizado** |

**Alternativa: 2 chats**
- Chat 1: Grid + Filtros + Búsqueda (3h)
- Chat 2: Ficha + Galería + I18n + Edge Function + Testing (7h)

---

## PARTE 7: RECOMENDACIONES FINALES UX/UI

### ✨ TOP 3 MEJORAS POR IMPACTO

1. **Header sticky + Search visible**
   - Impacto: ⭐⭐⭐⭐⭐ (Usabilidad)
   - Esfuerzo: 30 min
   - ROI: Enorme

2. **Real-time filtering (sin botón "Aplicar")**
   - Impacto: ⭐⭐⭐⭐ (UX fluida)
   - Esfuerzo: 45 min
   - ROI: Alto

3. **Infinite scroll + Contador**
   - Impacto: ⭐⭐⭐⭐ (Exploración)
   - Esfuerzo: 45 min
   - ROI: Alto

### 🎯 QUICK WINS (Fáciles, Alto Impacto)

- [ ] Agregar badge de técnica en corner de cards
- [ ] Mejorar hover effect (overlay + color)
- [ ] Hero gradient en "Obra Serigráfica"
- [ ] Link "Ver obra" más explícito (botón o arrow)
- [ ] Breadcrumb en ficha

---

## PARTE 8: PRÓXIMO CHAT — PROMPT RECOMENDADO

Usar este template:

```markdown
# CATÁLOGO PÚBLICO FUNCIONAL v1 — Integración Supabase

## ESTADO
- Admin ✅ completamente funcional
- Mockup estático ⏳ listo para conectar

## OBJETIVO
Crear catálogo público dinámico que:
1. Se conecta a Supabase real
2. Muestra grid desde DB
3. Filtros reales (año, técnica, tags)
4. Búsqueda con debounce
5. Ficha detalle por obra
6. Galería imágenes (carrusel)
7. I18n (ES/EN)
8. Edge Function convert-webp

## PRIORIDADES UX/UI RECOMENDADAS
1. Real-time filtering (sin botón "Aplicar")
2. Sticky header + busca visible
3. Infinite scroll + contador
4. Breadcrumb en ficha
5. Galería carrusel horizontal

## ARCHIVOS A CREAR
- app/index.html (grid público)
- app/css/styles.css (estilos consolidados)
- app/js/public-catalog.js
- app/js/public-detail.js
- app/js/gallery.js
- app/js/i18n.js
- app/js/api-client.js

## TESTING E2E
- Admin crea obra → aparece en catálogo inmediatamente
- Filtros funcionan (año, técnica, tags)
- Búsqueda por título funciona
- Click obra → ficha detalle carga
- Responsive: 320px, 768px, 1440px
```

---

## CONCLUSIÓN

Tu proyecto está en **excelente estado**:
✅ Admin 100% funcional + Supabase integrado  
✅ Mockup de catálogo bien diseñado  
✅ Base sólida para construir

**Próximos pasos:**
1. Decidir sobre los 5 puntos clave (sticky, real-time, infinite, etc.)
2. Abrir nuevo chat con prompt template arriba
3. Implementar en 1-2 chats (10h total)
4. Hacer testing E2E
5. Deploy a Netlify

**Diferencial premium:**
- Real-time filtering (vs botón)
- Sticky header (vs scroll)
- Infinite scroll (vs paginas)
- I18n nativo (vs hardcoded)

Esto te posicionaría en nivel **Behance / Dribbble** en UX, no "catálogo básico".

---

**Preparado por:** Claude  
**Para:** Emmanuel (egodiseno)  
**Fecha:** 2026-06-12
