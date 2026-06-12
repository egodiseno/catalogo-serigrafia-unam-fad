# PLAN DE CONTINUIDAD — Catálogo Público (2 Chats)
**Emmanuel's Decisiones Confirmadas:**
- Real-time filtering ✅
- Infinite scroll ✅
- Ficha en página ✅
- Galería carrusel ✅
- 2 chats con continuidad total ✅

---

## 🎯 CHAT 1: GRID + FILTROS + BÚSQUEDA (3 horas)

### Objetivo
Crear base funcional del catálogo público:
- Grid dinámico desde Supabase ✅
- Filtros real-time (año, técnica, tags) ✅
- Búsqueda con debounce ✅
- Infinite scroll + contador ✅
- I18n (ES/EN) en grid ✅

### No tocar en Chat 1
- ❌ Ficha detalle (obra-[slug].html) → Chat 2
- ❌ Galería carrusel → Chat 2
- ❌ Edge Function convert-webp → Chat 2
- ❌ Detalles visuales (badges, gradients hero) → Chat 2

### Archivos a crear en Chat 1

```
app/
├── index.html                         (NUEVA - grid público)
├── css/styles.css                     (NUEVA - consolidado)
├── js/
│   ├── api-client.js                  (NUEVA - Supabase client)
│   ├── public-catalog.js              (NUEVA - grid logic)
│   └── i18n.js                        (NUEVA - ES/EN)
└── .env                               (ACTUALIZAR - credenciales)
```

### Checklist Chat 1 — Antes de terminar

#### Setup Base
- [ ] `app/index.html` creado con estructura del mockup
- [ ] `app/css/styles.css` copiado de mockup + ajustes
- [ ] Lucide Icons CDN funcional
- [ ] `.env` con credenciales Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

#### API Client (`api-client.js`)
- [ ] Función `getPublishedWorks(page, pageSize)` — funciona
- [ ] Función `getYears()` — retorna años únicos
- [ ] Función `getTechniques()` — retorna técnicas
- [ ] Función `getTags()` — retorna tags
- [ ] Función `filterWorks(filters, page, pageSize)` — funciona
- [ ] Función `searchWorks(query, pageSize)` — funciona
- [ ] Error handling en todas las funciones

#### Public Catalog (`public-catalog.js`)
- [ ] Constructor + propiedades (works, filtered, page, filters, etc.)
- [ ] `init()` — carga opciones de filtro + primeras obras
- [ ] `loadFilterOptions()` — Supabase queries de años/técnicas/tags
- [ ] `populateFilterOptions()` — llena dropdowns/checkboxes dinámicamente
- [ ] `attachEventListeners()` — filtros, search, load more
- [ ] `handleFilterChange()` — real-time sin botón "Aplicar"
- [ ] `loadWorks()` — fetch filtered works
- [ ] `renderGrid()` — mapea works a HTML cards
- [ ] `updateCounter()` — "Mostrando X de Y obras"
- [ ] `showEmptyState()` — cuando no hay resultados
- [ ] `showLoadingSpinner()` / `hideLoadingSpinner()` — estados
- [ ] `updateActiveFilterChips()` — visualiza filtros activos
- [ ] `loadMore()` — infinite scroll trigger
- [ ] `clearFilters()` — reset todo
- [ ] `setupInfiniteScroll()` — IntersectionObserver

#### I18n (`i18n.js`)
- [ ] `init()` — setup toggle buttons
- [ ] `switchLanguage(lang)` — cambia idioma
- [ ] `updateLanguage(lang)` — actualiza DOM (data-i18n, data-i18n-placeholder)
- [ ] Toggle buttons (ES/EN) funcional
- [ ] localStorage persiste idioma elegido
- [ ] Año dinámico (data-year) actualizado

#### HTML Index
- [ ] Header sticky con logo UNAM/FAD ✅
- [ ] Nav principal (desktop) ✅
- [ ] Search input en header ✅
- [ ] Lang toggle (ES/EN) ✅
- [ ] Mobile nav (hamburger) ✅
- [ ] Hero section con eyebrow + título + lead ✅
- [ ] Filtros section (sticky) con fields año/técnica/tags ✅
- [ ] "Limpiar filtros" botón ✅
- [ ] Active filter chips (dinámicos) ✅
- [ ] Main grid (ul[data-grid]) vacío (poblado por JS) ✅
- [ ] Empty state (oculto, muestra si no hay) ✅
- [ ] Load more wrap + button ✅
- [ ] Loading spinner (oculto, muestra si cargar) ✅
- [ ] Footer 4 columnas + social ✅

#### CSS Styles
- [ ] Variables CSS (colores UNAM, espaciado, sombras) ✅
- [ ] Reset/base (html, body, img, a, button) ✅
- [ ] Header sticky + nav + search ✅
- [ ] Hero section (eyebrow, título, lead) ✅
- [ ] Filtros sticky (form, fields, buttons) ✅
- [ ] Grid responsive (1 col mobile, 2 tablet, 3 desktop, 4 large) ✅
- [ ] Artwork cards (media, body, metadata) ✅
- [ ] Botón load more ✅
- [ ] Empty state styling ✅
- [ ] Loading spinner animation ✅
- [ ] Footer 4 col + social ✅
- [ ] Responsive breakpoints (481px, 768px, 1440px) ✅

#### Testing Chat 1
- [ ] Grid carga 12 primeras obras desde Supabase ✅
- [ ] Dropdown año muestra todos los años únicos ✅
- [ ] Dropdown técnica muestra todas las técnicas ✅
- [ ] Checkboxes tags funcionales ✅
- [ ] Cambiar año → grid actualiza inmediatamente (real-time) ✅
- [ ] Cambiar técnica → grid actualiza ✅
- [ ] Seleccionar tags → grid actualiza ✅
- [ ] Limpiar filtros → todo vuelve a estado inicial ✅
- [ ] Search por título → filtra obras ✅
- [ ] Scroll abajo → infinite load más obras ✅
- [ ] Contador actualiza dinámicamente ✅
- [ ] "Mostrando X de Y" es correcto ✅
- [ ] Cuando no hay más obras → load more button desaparece ✅
- [ ] Empty state visible si filtros sin resultados ✅
- [ ] Toggle idioma ES/EN funciona ✅
- [ ] Sticky header + sticky filtros funcionan en scroll ✅
- [ ] Responsive: 320px (1 col), 768px (2 col), 1440px (4 col) ✅

#### Commits Chat 1
```bash
FEAT: Grid catálogo dinámico desde Supabase
FEAT: Filtros real-time (año, técnica, tags)
FEAT: Búsqueda con debounce
FEAT: Infinite scroll + contador
FEAT: I18n (ES/EN) funcional
```

#### Documentación Chat 1
- [ ] Actualizar README.md (añadir instrucciones catálogo público)
- [ ] Actualizar CLAUDE_WORKFLOW.md con lecciones Chat 1
- [ ] Dejar comments en código complejo

---

### 📋 HANDOFF Chat 1 → Chat 2

**Qué entregar al Chat 2:**

1. **Proyecto limpio y funcional**
   ```bash
   git status        # Debe estar limpio
   git log --oneline # Últimos commits visibles
   ```

2. **Estado del grid**
   - Grid funciona 100% ✅
   - Filtros funcionan ✅
   - Infinite scroll funciona ✅
   - I18n funciona ✅

3. **Qué falta (para Chat 2)**
   - `app/obra-[slug].html` — ficha detalle
   - `app/js/public-detail.js` — lógica ficha
   - `app/js/gallery.js` — carrusel imágenes
   - Edge Function convert-webp
   - Mejoras visuales (badges, gradients, etc.)

4. **Credenciales/Config**
   - `.env` con SUPABASE_URL + ANON_KEY ✅
   - Verificar RLS en Supabase (SELECT público OK) ✅

5. **Prompt para Chat 2** (ver abajo)

---

## 🎯 CHAT 2: FICHA + GALERÍA + POLISH (7 horas)

### Objetivo
Completar catálogo público con detalles refinados:
- Ficha individual (obra-[slug].html) ✅
- Galería carrusel (gallery.js) ✅
- Edge Function convert-webp ✅
- Mejoras visuales (badges, hero gradient) ✅
- Testing E2E completo ✅

### No tocar en Chat 2
- ✅ Grid ya funciona → solo mantener, no refactorizar
- ✅ I18n ya funciona → solo añadir nuevas strings
- ✅ Filtros ya funciona → NO cambiar lógica

### Archivos a crear/modificar en Chat 2

```
app/
├── index.html                         (ACTUALIZAR - badges, gradient hero)
├── obra-[slug].html                   (NUEVA - ficha detalle)
├── css/styles.css                     (ACTUALIZAR - galería, ficha)
├── js/
│   ├── public-detail.js               (NUEVA - lógica ficha)
│   ├── gallery.js                     (NUEVA - carrusel)
│   └── i18n.js                        (ACTUALIZAR - nuevas strings)
│
└── supabase/functions/convert-webp/
    └── index.ts                       (NUEVA - Edge Function)
```

### Checklist Chat 2 — Antes de terminar

#### Ficha Detalle (`public-detail.js`)
- [ ] Constructor con `slug` parameter
- [ ] `init()` — fetch obra por slug
- [ ] `fetchWorkBySlug(slug)` — GET desde api-client
- [ ] `show404()` si obra no existe
- [ ] `renderDetail()` — renderiza ficha completa
  - [ ] Breadcrumb (Catálogo > Año > Técnica > Obra)
  - [ ] Imagen principal grande (1200px+)
  - [ ] Metadata: título, artista, año, técnica, descripción
  - [ ] Tags como chips/pills
  - [ ] Botón "← Volver al catálogo"
  - [ ] Sección "Obras relacionadas" (3-4 del mismo artista)
- [ ] `loadGallery()` — instancia Gallery con imagenes adicionales
- [ ] Detectar URL slug y cargar obra automáticamente

#### Galería (`gallery.js`)
- [ ] Constructor con `container` + `images`
- [ ] `init()` — render + attach controls
- [ ] `next()` — slide siguiente
- [ ] `prev()` — slide anterior
- [ ] `goTo(index)` — ir a índice específico
- [ ] Prev/next buttons (Lucide ChevronLeft/Right)
- [ ] Keyboard navigation (ArrowLeft/Right)
- [ ] Touch/swipe (mobile)
- [ ] Dot pagination o contador (3/4)
- [ ] Click imagen → lightbox fullscreen
- [ ] Lightbox: ESC o click X → cerrar
- [ ] Transiciones suaves

#### Edge Function convert-webp
- [ ] Ubicación: `supabase/functions/convert-webp/index.ts`
- [ ] Input: file + obra_id + type (principal|adicional)
- [ ] Redimensiona a tamaños recomendados
  - [ ] principal: 1200×1500px
  - [ ] adicional: 800×1000px
- [ ] Convierte a WebP (calidad 80%)
- [ ] Guarda en Storage: `/artworks/obra_{id}_{type}_{timestamp}.webp`
- [ ] Retorna: { url, type, dimensions, sizeBefore, sizeAfter, compression }
- [ ] Error handling (archivo grande, formato inválido)
- [ ] Deploy a Supabase

#### Mejoras Visuales — index.html
- [ ] Badge "Técnica" en esquina cards (en grid) ✨
- [ ] Overlay sutil en hover cards ✨
- [ ] Hero h1 con gradient (azul → oro) ✨
- [ ] Link "Ver obra" más explícito (botón + arrow icon) ✨
- [ ] Línea decorativa encima hero title ✨

#### CSS Styles (actualizar)
- [ ] Estilos ficha detalle
  - [ ] Breadcrumb styling
  - [ ] Imagen principal (responsive)
  - [ ] Metadata layout (grid o flex)
  - [ ] Tags como chips
  - [ ] Botón "Volver"
  - [ ] Obras relacionadas grid
- [ ] Estilos galería carrusel
  - [ ] Container + slides
  - [ ] Prev/next buttons styling
  - [ ] Dot pagination
  - [ ] Keyboard focus states
- [ ] Lightbox styling
  - [ ] Overlay oscuro
  - [ ] Imagen centrada
  - [ ] Close button (X)
- [ ] Mejoras visuales
  - [ ] Hero gradient en h1
  - [ ] Badge técnica cards
  - [ ] Overlay hover mejorado

#### I18n (actualizar `i18n.js`)
- [ ] Nuevas strings en ficha detalle
  - [ ] "Volver al catálogo"
  - [ ] "Obras relacionadas"
  - [ ] "Artista:", "Año:", "Técnica:"
  - [ ] Breadcrumb labels
- [ ] Nuevas strings galería
  - [ ] "Anterior", "Siguiente" (si hay botones con texto)
- [ ] Nuevo HTML en ficha si lleva i18n

#### Testing Chat 2

**Testing Funcional Ficha:**
- [ ] URL `/obra/memoria-del-taller` carga obra ✅
- [ ] Metadata correcta (título, artista, año, técnica) ✅
- [ ] Imagen principal carga ✅
- [ ] Tags muestran correcto ✅
- [ ] Breadcrumb es correcto ✅
- [ ] Botón "Volver" vuelve a grid ✅
- [ ] Si URL slug inválido → mostrar 404 o redirigir ✅

**Testing Funcional Galería:**
- [ ] Galería carga imagenes adicionales ✅
- [ ] Prev/next buttons funcionan ✅
- [ ] Dot pagination actualiza ✅
- [ ] Keyboard arrows (izq/der) funcionan ✅
- [ ] Touch swipe funciona (mobile) ✅
- [ ] Click imagen → lightbox abre ✅
- [ ] Lightbox: ESC cierra ✅
- [ ] Lightbox: click X cierra ✅
- [ ] Transiciones suaves ✅

**Testing E2E Admin ↔ Público:**
- [ ] Admin crea obra "Test Obra" ✅
- [ ] Admin sube 3 imágenes (1 principal, 2 adicionales) ✅
- [ ] Admin publica (estado='publicado') ✅
- [ ] Catálogo público (sin refresh): ¿aparece en grid? ✅
- [ ] Click en grid → carga ficha detalle ✅
- [ ] Ficha muestra imagen principal ✅
- [ ] Galería muestra 2 imágenes adicionales ✅
- [ ] Admin edita título → ficha pública refleja cambio ✅
- [ ] Admin elimina obra → desaparece de catálogo ✅

**Testing Responsivo (Ficha):**
- [ ] Mobile 320px: layout stack vertical ✅
- [ ] Tablet 768px: layout 2-col (imagen izq, metadata der) ✅
- [ ] Desktop 1440px: layout limpio ✅
- [ ] Galería responsive en todos los tamaños ✅

**Testing Accesibilidad:**
- [ ] Breadcrumb tiene aria-label ✅
- [ ] Imagen principal tiene alt text ✅
- [ ] Links tienen text claro (no "click aquí") ✅
- [ ] Keyboard navigation completa ✅
- [ ] Focus visible en botones ✅
- [ ] Contraste >= 4.5:1 ✅

**Testing WebP:**
- [ ] Edge Function convierte JPG → WebP ✅
- [ ] Redimensiona correcto (1200×1500) ✅
- [ ] Compresión 80% funciona ✅
- [ ] Fallback JPG visible si WebP no soportado ✅

#### Commits Chat 2
```bash
FEAT: Ficha detalle de obra (slug-based)
FEAT: Galería carrusel imágenes
FEAT: Edge Function convert-webp integrada
FEAT: Mejoras visuales (badges, gradients, etc.)
FEAT: Testing E2E completo admin ↔ público
```

#### Documentación Chat 2
- [ ] Actualizar README.md (instrucciones completas catálogo)
- [ ] Actualizar CLAUDE_WORKFLOW.md con lecciones Chat 2
- [ ] Dejar comments en gallery.js + public-detail.js
- [ ] Documentar Edge Function usage

---

## 🔄 CONTINUIDAD — Conexión Entre Chats

### Cómo evitar perder el hilo:

#### **Al Final de Chat 1:**

1. **Documentar estado en archivo ESTADO-CHAT1.md**
   ```markdown
   # Estado después de Chat 1

   ✅ COMPLETADO:
   - Grid dinámico funcional
   - Filtros real-time (año, técnica, tags)
   - Búsqueda con debounce
   - Infinite scroll + contador
   - I18n (ES/EN)

   ⏳ PENDIENTE para Chat 2:
   - Ficha detalle obra-[slug].html
   - Galería carrusel
   - Edge Function convert-webp
   - Mejoras visuales (badges, gradients)

   📍 UBICACIÓN ACTUAL:
   - Repo limpio, git push completo
   - .env con credenciales OK
   - No hay TODOs o console.logs

   🔗 CONEXIÓN CHAT 2:
   - Reutilizar api-client.js
   - Reutilizar i18n.js (añadir strings nuevas)
   - NO tocar public-catalog.js
   ```

2. **Dejar CHECKLIST-CONTINUIDAD.md**
   ```markdown
   # Checklist Continuidad Chat 1 → Chat 2

   ANTES DE EMPEZAR CHAT 2, VERIFICAR:

   - [ ] Repo está en main branch
   - [ ] git status limpio (no hay cambios uncommitted)
   - [ ] Grid carga obras desde Supabase
   - [ ] Filtros funcionan (prueba cada uno)
   - [ ] Infinite scroll funciona
   - [ ] I18n (ES/EN) funciona
   - [ ] .env tiene credenciales válidas

   SI ALGO FALLA: Hacer debug en Chat 2 primero (15 min max)
   ```

3. **Git commit final**
   ```bash
   git add .
   git commit -m "CHAT1 FINAL: Grid catálogo funcional + filtros + i18n"
   git push
   ```

#### **Al Iniciar Chat 2:**

1. **Pasos iniciales:**
   ```bash
   git pull origin main
   git status  # Debe estar limpio
   python3 -m http.server 8000
   # Verificar en navegador: grid + filtros funcionan
   ```

2. **Si algo falla:** Debug 15 min, si no resuelve avisar a Emmanuel

3. **Comenzar con Checklist Chat 2**

---

## 📋 PROMPTS LISTOS PARA COPIAR

### PROMPT CHAT 1 (Copiar completo a nuevo chat)

```markdown
# CATÁLOGO PÚBLICO FUNCIONAL — Chat 1/2 (Grid + Filtros + I18n)

## ESTADO ACTUAL
- Admin 100% funcional ✅
- Mockup estático listo ✅
- Decisiones confirmadas ✅

## OBJETIVO CHAT 1 (3 horas)
Crear base funcional del catálogo público:
1. Grid dinámico desde Supabase
2. Filtros real-time (año, técnica, tags)
3. Búsqueda con debounce + infinite scroll
4. I18n completo (ES/EN)
5. NO tocar: ficha detalle, galería (Chat 2)

## ARCHIVOS A CREAR
- app/index.html (grid principal)
- app/css/styles.css (consolidado del mockup)
- app/js/api-client.js (Supabase client)
- app/js/public-catalog.js (grid logic)
- app/js/i18n.js (ES/EN)

## ESPECIFICACIONES
[Copiar contenido de ESPECIFICACIONES-TECNICAS-CATALOGO-PUBLICO.md — secciones 1-5]

## CHECKLIST FINAL CHAT 1
[Copiar sección "Checklist Chat 1" de arriba]

## TESTING ANTES DE TERMINAR
[Copiar sección "Testing Chat 1" de arriba]

## HANDOFF A CHAT 2
- git status limpio
- grid funciona 100%
- dejar ESTADO-CHAT1.md documentando qué falta
```

### PROMPT CHAT 2 (Copiar cuando Chat 1 termine)

```markdown
# CATÁLOGO PÚBLICO FUNCIONAL — Chat 2/2 (Ficha + Galería + Edge Function)

## ESTADO INICIAL (Verificar)
- Grid Chat 1 funciona ✅
- Filtros funcionan ✅
- I18n funciona ✅

## OBJETIVO CHAT 2 (7 horas)
Completar catálogo con:
1. Ficha detalle obra-[slug].html
2. Galería carrusel imágenes
3. Edge Function convert-webp
4. Mejoras visuales (badges, gradients)
5. Testing E2E completo

## NO TOCAR
- api-client.js (reutilizar)
- public-catalog.js (NO CAMBIAR)
- i18n.js (solo añadir strings nuevas)

## ARCHIVOS A CREAR
- app/obra-[slug].html (ficha detalle)
- app/js/public-detail.js (ficha logic)
- app/js/gallery.js (carrusel)
- supabase/functions/convert-webp/index.ts
- [Actualizar index.html + styles.css + i18n.js]

## ESPECIFICACIONES
[Copiar resto de ESPECIFICACIONES-TECNICAS-CATALOGO-PUBLICO.md]

## CHECKLIST FINAL CHAT 2
[Copiar sección "Checklist Chat 2" de arriba]

## TESTING E2E
[Copiar sección "Testing Chat 2"]

## POST-CHAT 2
- Catálogo 100% funcional
- Admin ↔ Público sincronizado
- Todo commiteado a GitHub
- Listo para auditorías (FASE 3)
```

---

## ⚠️ CRITICAL PATH — No Perder

**Si solo se hace 1 cosa en cada chat:**

**Chat 1:** `public-catalog.js` funcione 100%
- Si esto falla, Chat 2 no puede empezar

**Chat 2:** `public-detail.js` + `gallery.js` funcionan 100%
- Si esto falla, catálogo incompleto

---

## 📞 CONTACTO ENTRE CHATS

Si algo no funciona entre chats:

1. Verificar git (¿cambios se guardaron?)
2. Verificar .env (¿credenciales OK?)
3. Verificar RLS Supabase (¿SELECT público funciona?)
4. Si persiste: Abrir nuevo chat con descripción del error

---

## 🎯 RESULTADO FINAL (Después de Chat 2)

```
✅ Catálogo público 100% funcional
✅ Grid dinámico + filtros real-time
✅ Ficha detalle por obra
✅ Galería carrusel + lightbox
✅ I18n (ES/EN) completo
✅ WebP optimizado (Edge Function)
✅ Testing E2E admin ↔ público completo
✅ Responsive (320px → 1440px)
✅ Accesibilidad WCAG AA
✅ Todo en GitHub, listo para deploy

SIGUIENTE: FASE 3 (Auditorías + Refinamientos)
```

---

**Documento preparado por:** Claude  
**Fecha:** 2026-06-12  
**Destinatario:** Emmanuel (egodiseno)
