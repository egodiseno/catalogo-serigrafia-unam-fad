# INSTRUCCIONES FINALES — Catálogo Digital de Obra Serigráfica

## 1. VISIÓN GENERAL

### Objetivo
Crear un **catálogo digital académico y cultural** para la consulta y exhibición de obra serigráfica del Taller de Serigrafía (UNAM / FAD), con:
- ✅ **Público:** catálogo navegable, filtrable, accesible
- ✅ **Admin:** sistema funcional para gestionar obras, imágenes, usuarios
- ✅ **Base de datos real:** Supabase (Postgres + Auth + Storage)
- ✅ **Diseño moderno:** colores UNAM oficiales + tipografía contemporánea

### Stack Final (Arquitectura)

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Frontend | HTML + CSS + JavaScript vanilla | ✅ En progreso |
| Diseño | Tailwind CDN + CSS custom | ✅ Mantiene (por ahora) |
| Base de datos | Supabase Postgres | ⏳ Próxima fase |
| Autenticación | Supabase Auth | ⏳ Próxima fase |
| Almacenamiento | Supabase Storage (imágenes) | ⏳ Próxima fase |
| API | Endpoints REST (Supabase) | ⏳ Próxima fase |
| Deploy | Netlify (actual) → Vercel (Next.js) | ⏳ Futuro |

### Usuarios
- **Público:** Acceso anónimo al catálogo, filtros, búsqueda, fichas de obra
- **Admin:** Login, dashboard, CRUD obras/técnicas/series/tags, upload imágenes, gestión usuarios

---

## 2. FASES DE TRABAJO (con estimaciones)

### ✅ SESIÓN 1-4: NORMALIZACIÓN (COMPLETADA)
- ✅ Auditoría completa (JS, CSS, estructura)
- ✅ Refactorización JS (shared.js, collection-view.js, archive.js)
- ✅ Tokenización CSS (colores UNAM, tipografía)
- ✅ Modernización visual (header, botones, cards, glass morphism)
- ✅ index.html renombrado (entrada directa catálogo)

**Resultado:** Base limpia, tokens centralizados, componentes modernos

---

### 🚀 FASE 0: SUPABASE SETUP (1 sesión)

**Objetivo:** Configurar base de datos real + autenticación

**Tareas:**
1. Crear cuenta Supabase (gratuita)
2. Diseñar esquema DB:
   - `obras` (id, titulo, artista, año, tecnica, descripcion, estado, created_at, updated_at)
   - `tecnicas` (id, nombre, slug, descripcion)
   - `tags` (id, nombre, slug)
   - `obra_tags` (obra_id, tag_id) — relación N:M
   - `imágenes` (id, obra_id, url_storage, principal, orden)
   - `usuarios_admin` (id, email, rol, estado, created_at)

3. Crear tablas en Postgres
4. Configurar RLS (Row Level Security):
   - Público: solo lectura (`obras`, `tecnicas`, `tags`)
   - Admin: lectura/escritura (autenticado)
5. Configurar Supabase Auth (providers: email/password)
6. Configurar Supabase Storage (carpeta `/imágenes`)
7. Documentar credenciales + conexión

**Entregable:** DB funcional, Schema SQL documentado, Auth lista

**NO tocar HTML/CSS aún. Solo infraestructura.**

---

### 🚀 FASE 1: ADMIN FUNCIONAL (6 SUBFASES / 6 CHATS)

**Objetivo general:** Sistema admin real para alimentar el catálogo

**Dependencia:** ✅ FASE 0 completada (Supabase setup con 6 tablas)

**Arquitectura admin:**
```
app/admin/
├── index.html (login + dashboard)
├── css/admin.css (estilos admin)
├── js/
│   ├── auth.js (Supabase Auth)
│   ├── dashboard.js (métricas)
│   ├── obras-list.js (tabla obras)
│   ├── obras-form.js (crear/editar)
│   └── storage.js (upload imágenes)
└── data/
    └── mock.json (datos de prueba locales)
```

---

### 📋 FASE 1.A: SETUP ESTRUCTURA ADMIN (1 chat)

**Objetivo:** Crear base HTML/CSS limpia para admin

**Dependencia:** FASE 0 ✅

**Tareas:**
1. Crear carpeta `app/admin/` con estructura base
2. Crear `app/admin/index.html`:
   - Layout 2 columnas (sidebar + contenido)
   - Sidebar con navegación: Dashboard, Obras, Técnicas, Tags, Usuarios
   - Header con logo + logout button
   - Área de contenido vacía (se llena en siguientes fases)
3. Crear `app/admin/css/admin.css`:
   - Variables de diseño (colores UNAM, espaciado, tipografía)
   - Componentes base (botones, inputs, tablas, modales)
   - Layout sidebar responsivo
4. Crear `app/admin/js/config.js`:
   - Constantes Supabase (SUPABASE_URL, SUPABASE_ANON_KEY desde .env)
   - Inicializar cliente Supabase
5. Testing responsivo (desktop, tablet)

**Entregables:**
- ✅ `app/admin/index.html` (estructura limpia)
- ✅ `app/admin/css/admin.css` (tokens + componentes)
- ✅ `app/admin/js/config.js` (configuración Supabase)
- ✅ Commit a GitHub: "FASE 1.A: Setup estructura admin"

**Qué llevar al siguiente chat (1.B):**
- Estructura admin creada y testeada
- CSS listo para usar
- Configuración Supabase funcional

---

### 🔐 FASE 1.B: LOGIN (SUPABASE AUTH) (1 chat)

**Objetivo:** Implementar autenticación real con Supabase Auth

**Dependencia:** FASE 1.A ✅

**Tareas:**
1. En `app/admin/index.html`:
   - Crear página de login (formulario email/password)
   - Input email, input password, botón "Ingresar"
   - Mensaje de error dinámico
   - Link "¿Olvidaste contraseña?" (texto, no funcional aún)

2. Crear `app/admin/js/auth.js`:
   - Función `loginWithEmail(email, password)` → Supabase Auth
   - Función `logout()` → Supabase
   - Función `checkAuthStatus()` → verifica si usuario está logueado
   - Si NO logueado → mostrar login
   - Si logueado → mostrar dashboard

3. En `app/admin/index.html`:
   - Estado inicial: página de login visible
   - Después de login: dashboard/navbar visible
   - Botón logout en header

4. Validaciones básicas:
   - Email válido (regex simple)
   - Password no vacío
   - Mostrar errores de Supabase (usuario no existe, contraseña incorrecta)

5. Testing:
   - Crear usuario admin en Supabase Auth (email: admin@test.com, password: test123)
   - Verificar login funciona
   - Verificar logout funciona
   - Verificar token se guarda (localStorage)

**Entregables:**
- ✅ `app/admin/js/auth.js` (login/logout funcionales)
- ✅ `app/admin/index.html` actualizado (formulario login)
- ✅ Usuario admin creado en Supabase Auth
- ✅ Commit a GitHub: "FASE 1.B: Implementa Supabase Auth (login)"

**Qué llevar al siguiente chat (1.C):**
- Auth funcional (login/logout)
- Usuario admin creado en Supabase
- Token guardado en localStorage

---

### 📊 FASE 1.C: DASHBOARD (MÉTRICAS BÁSICAS) (1 chat)

**Objetivo:** Dashboard con estadísticas básicas de la DB

**Dependencia:** FASE 1.B ✅ (auth funcional)

**Tareas:**
1. En `app/admin/index.html`:
   - Crear sección Dashboard (después de login)
   - Grid de 4 tarjetas:
     * Total obras (número grande)
     * Total técnicas (número)
     * Total tags (número)
     * Últimas obras subidas (lista con 3-5 últimas)

2. Crear `app/admin/js/dashboard.js`:
   - Función `loadDashboardStats()`:
     * SELECT COUNT(*) FROM obras
     * SELECT COUNT(*) FROM tecnicas
     * SELECT COUNT(*) FROM tags
     * SELECT * FROM obras ORDER BY created_at DESC LIMIT 5
   - Actualizar DOM con datos

3. Estilos:
   - Tarjetas con color azul UNAM (#013b75)
   - Números grandes y legibles
   - Tabla de últimas obras simple

4. Testing:
   - Insertar datos de prueba en Supabase (SQL o manualmente)
   - Verificar que dashboard muestra números correctos
   - Verificar que tabla de últimas obras es correcta

**Entregables:**
- ✅ `app/admin/js/dashboard.js` (queries a DB)
- ✅ `app/admin/index.html` actualizado (sección dashboard)
- ✅ Datos de prueba en Supabase
- ✅ Commit a GitHub: "FASE 1.C: Crea Dashboard con métricas"

**Qué llevar al siguiente chat (1.D):**
- Dashboard funcional
- Queries a Supabase funcionando
- Datos de prueba en DB

---

### 📋 FASE 1.D: LISTADO OBRAS (TABLA DESDE DB) (1 chat)

**Objetivo:** Tabla dinámica de obras desde Supabase con filtros básicos

**Dependencia:** FASE 1.C ✅ (queries funcionales)

**Tareas:**
1. En `app/admin/index.html`:
   - Crear sección "Obras" (en navbar)
   - Tabla con columnas:
     * Título
     * Artista
     * Año
     * Técnica
     * Estado (borrador/publicado/archivado)
     * Acciones (editar, eliminar)

2. Crear `app/admin/js/obras-list.js`:
   - Función `loadObrasList()`:
     * SELECT * FROM obras ORDER BY created_at DESC
     * Renderizar tabla dinámicamente
   - Función `deleteObra(id)`:
     * DELETE FROM obras WHERE id = ?
     * Mostrar confirmación antes
     * Actualizar tabla

3. Filtros simples (en tabla):
   - Búsqueda por título (en tiempo real)
   - Dropdown: filtrar por estado (todos, borrador, publicado, archivado)
   - Botón "Cargar más" (lazy load, 10 obras por página)

4. Paginación:
   - Mostrar contador: "Mostrando X de Y obras"
   - Botón "Cargar más" para siguiente página

5. Testing:
   - Verificar tabla carga obras de DB
   - Verificar búsqueda funciona
   - Verificar filtro de estado funciona
   - Verificar delete funciona (con confirmación)

**Entregables:**
- ✅ `app/admin/js/obras-list.js` (tabla + filtros)
- ✅ `app/admin/index.html` actualizado (sección obras)
- ✅ Tabla funcional, filtros, paginación, delete
- ✅ Commit a GitHub: "FASE 1.D: Implementa tabla de Obras"

**Qué llevar al siguiente chat (1.E):**
- Tabla de obras funcional
- Filtros y búsqueda funcionales
- Delete funcional

---

### ✏️ FASE 1.E: CREAR/EDITAR OBRA (FORMULARIO) (1 chat)

**Objetivo:** Formulario para crear/editar obras en Supabase

**Dependencia:** FASE 1.D ✅ (listado funcional)

**Tareas:**
1. En `app/admin/index.html`:
   - Crear modal/página de formulario "Crear Obra"
   - Botón "Nueva Obra" en sección obras abre modal
   - Botón "Editar" en tabla abre modal con datos precargados

2. Crear `app/admin/js/obras-form.js`:
   - Formulario con campos:
     * Título (text, required)
     * Artista (text, required)
     * Año (number, 1800-2100)
     * Técnica (dropdown desde tecnicas)
     * Descripción (textarea)
     * Estado (radio: borrador/publicado/archivado)
   - Validaciones:
     * Título y artista no vacíos
     * Año válido
   - Funciones:
     * `saveObra(obra)` → INSERT/UPDATE en DB
     * `loadTecnicas()` → SELECT FROM tecnicas (dropdown)
     * `loadObraToEdit(id)` → cargar datos para editar

3. Modal/formulario UI:
   - Botones: Guardar, Cancelar
   - Mostrar mensajes de éxito/error
   - Cerrar modal después de guardar
   - Actualizar tabla de obras

4. Testing:
   - Crear obra nueva (verificar en DB)
   - Editar obra existente (verificar cambios en DB)
   - Validaciones funcionan (sin título, año inválido)
   - Dropdown técnicas carga dinámicamente

**Entregables:**
- ✅ `app/admin/js/obras-form.js` (formulario CRUD)
- ✅ `app/admin/index.html` actualizado (modal formulario)
- ✅ CREATE + UPDATE funcionando en DB
- ✅ Validaciones básicas
- ✅ Commit a GitHub: "FASE 1.E: Formulario crear/editar Obras"

**Qué llevar al siguiente chat (1.F):**
- Formulario funcional (create/update)
- Validaciones funcionando
- Dropdown técnicas dinámico

---

### 📸 FASE 1.F: UPLOAD IMÁGENES (SUPABASE STORAGE) (1 chat)

**Objetivo:** Upload de imágenes a Supabase Storage y asociar a obras

**Dependencia:** FASE 1.E ✅ (formulario obra funcional)

**Tareas:**
1. En Supabase:
   - Crear bucket "artworks" en Storage (acceso público para lectura)
   - Configurar permisos RLS (anon: upload, authenticated: all)

2. En `app/admin/index.html`:
   - Agregar input file en formulario obra
   - Preview de imagen antes de guardar
   - Mostrar URL de imagen después de upload

3. Crear `app/admin/js/storage.js`:
   - Función `uploadImage(file)`:
     * Upload a Supabase Storage /artworks/
     * Retorna URL pública
     * Genera nombre único (timestamp + hash)
   - Función `deleteImage(url)`:
     * Elimina archivo de Storage
   - Manejo de errores (archivo muy grande, formato inválido)

4. En `obras-form.js`:
   - Integrar upload en guardar obra
   - Asociar imagen URL a tabla imagenes
   - Marcar como principal si es la primera

5. Testing:
   - Upload imagen JPG/PNG
   - Verificar archivo en Supabase Storage
   - Verificar URL en tabla imagenes
   - Verificar preview funciona
   - Verificar delete imagen funciona

**Entregables:**
- ✅ `app/admin/js/storage.js` (upload/delete imágenes)
- ✅ `app/admin/index.html` actualizado (input file + preview)
- ✅ Upload a Supabase Storage funcional
- ✅ Imágenes asociadas a obras en DB
- ✅ Bucket "artworks" configurado en Supabase
- ✅ Commit a GitHub: "FASE 1.F: Upload de imágenes a Supabase Storage"

**Qué llevar al siguiente chat (FASE 2):**
- Admin completo y funcional
- Upload de imágenes funcional
- CRUD obras 100% operacional

---

### ✅ FASE 1 COMPLETADA CUANDO:

- ✅ 1.A: Estructura admin creada
- ✅ 1.B: Login funcional (usuario logueado/deslogueado)
- ✅ 1.C: Dashboard muestra estadísticas reales
- ✅ 1.D: Tabla de obras con filtros y delete
- ✅ 1.E: Crear y editar obras en DB
- ✅ 1.F: Upload de imágenes a Storage
- ✅ Testing E2E: crear obra → upload imagen → aparecer en tabla
- ✅ 6 commits a GitHub (uno por subfase)
- ✅ Documentación en CLAUDE_WORKFLOW.md

**Total estimado:** 6 chats (1-2 horas cada uno)

---

### 🚀 FASE 2: CATÁLOGO PÚBLICO (1 sesión)

**Objetivo:** Integrar mockup-v2 + conectar a datos reales de Supabase

**Dependencia:** FASE 0 (DB) + FASE 1 (datos listos)

**Tareas:**
1. Copiar mockup-catalog-v2.html → app/index.html (reemplazar)
2. Adaptar estructura HTML al nuevo mockup
3. Integrar estilos finales:
   - Colores UNAM (#013b75 azul, #d9a500 oro)
   - Glass morphism en header
   - Estados hover/active en cards
4. Conectar a API Supabase:
   - GET /obras (con filtros)
   - Cargar dinámicamente en grid
   - Remover datos hardcodeados

5. Implementar filtros funcionales:
   - Año (dropdown dinámico desde DB)
   - Técnica (dropdown dinámico desde DB)
   - Tags (checkboxes dinámicos desde DB)
   - Búsqueda por título (en tiempo real)
   - Botón "Limpiar filtros"

6. Paginación:
   - Botón "Cargar más obras" (lazy load)
   - Mostrar contador "Mostrando X de Y obras"

7. Cards dinámicas:
   - Imagen desde Supabase Storage
   - Título, artista, año, técnica, tags desde DB
   - Link "Ver ficha" → obra-*.html (o crear ficha dinámica)

8. Testing responsivo (desktop, tablet, mobile)

**Archivo:** app/index.html (reemplazado)

**No tocar aún:**
- tecnica-*.html
- serie-*.html
- archivo.html

---

### 🚀 FASE 3: REFINAMIENTO (1 sesión)

**Objetivo:** Pulir UI/UX, decidir series, testing E2E

**Tareas:**
1. **Decisión Series:**
   - ¿Agregar gestión de series en admin?
   - ¿Mostrar en filtros del catálogo?
   - (Deferida hasta aquí porque no es prioritaria)

2. **Ficha de obra (detail page):**
   - Crear obra-*.html dinámico (o con datos de query param)
   - Mostrar: imagen principal, título, artista, año, descripción, técnica, tags, serie (si aplica)
   - Gallery de imágenes (si hay múltiples)
   - Link de regreso al catálogo

3. **Testing E2E:**
   - Admin: crear obra → aparece en catálogo
   - Admin: editar obra → cambios reflejados
   - Admin: eliminar obra → desaparece del catálogo
   - Catálogo: filtros funcionan correctamente
   - Catálogo: búsqueda funciona
   - Catálogo: paginación funciona
   - Catálogo: responsivo en todos los breakpoints
   - Accesibilidad: WCAG AA (contraste, labels, navegación)

4. **Polish UI/UX:**
   - Microinteracciones (loading states, transiciones suaves)
   - Mensajes de error claros
   - Empty states atractivos ("No hay obras con ese filtro")
   - Loading spinners

5. **Documentación:**
   - README.md actualizado (cómo usar, deploy, credenciales)
   - CLAUDE_WORKFLOW.md con lecciones
   - Comentarios en código complejo
   - API documentation (endpoints + parámetros)

6. **Commit final a GitHub**

---

### ⏳ FASE 4: MIGRACIÓN A NEXT.JS (FUTURO)

**Objetivo:** Migrar a Next.js + Supabase integrado

**Cuándo:** Cuando FASE 3 esté 100% completa y validada

**No tocar ahora.**

---

## 3. NORMAS PARA CADA CHAT (PARA NO PERDERSE)

### Regla 1: Una tarea clara por chat
```
❌ NO: "Moderniza header + crea admin + arregla filtros"
✅ SÍ: "Integra mockup-catalog-v2.html con estilos finales"
```

### Regla 2: [VERIFICADO] antes de cambios CSS
```
[VERIFICADO]
- Selectores reales: grep en styles.css ✓
- Clases HTML/JS: grep en HTML + shared.js ✓
- Tokens existentes: grep :root ✓

Si no ves esto, DETENTE y pide verificación.
```

### Regla 3: Memoria de Claude (reutilizar decisiones)
- Una vez aprobada la paleta → usarla en todo
- Una vez diseñado un componente → reutilizarlo
- Referencia: "Según lo que audité en sesión 4..."

### Regla 4: Commit a GitHub después de cada fase
```
git add .
git commit -m "FASE X: [descripción clara]"
git push
```

### Regla 5: Documentación viva
- README.md actualizado
- CLAUDE_WORKFLOW.md con lecciones
- Comentarios en código complejo
- Este archivo actualizado

### Regla 6: Testing antes de commit
- Abrir en navegador (python -m http.server)
- Verificar responsivo
- Confirmar sin errores en consola

---

## 4. DECISIONES CRÍTICAS (NO CAMBIAR)

| Decisión | Razón | Estado |
|----------|-------|--------|
| index.html = catálogo (sin landing) | UX directo, entrada rápida | ✅ Aprobada |
| Tailwind mantiene (por ahora) | Eliminar sería 2-3 sesiones, bajo ROI | ✅ Aprobada |
| Mockup-catalog-v2 para estructura | UI/UX validado, no hardcodear más | ✅ Aprobada |
| Admin REAL (no mockup) | Funcionalidad > 82 pantallas mock | ✅ Aprobada |
| Supabase para DB+Auth+Storage | Rápido, escalable, integrado, gratuito | ✅ Aprobada |
| Admin ↔ Catálogo interdependientes | No secuencial: Supabase → Admin → Catálogo | ✅ Aprobada |
| Series: decidir en FASE 3 | No es prioritario, puede esperar | ✅ Aprobada |
| Datos dinámicos siempre | Nunca más hardcodear works. Siempre de DB | ✅ Aprobada |
| Colores UNAM #013b75 + #d9a500 | Identidad institucional | ✅ Aprobada |
| Validación interna, cliente después | Nosotros probamos → cliente feedback final | ✅ Aprobada |

---

## 5. ESTRUCTURA DEL PROYECTO (QUÉ MANTENER, QUÉ CAMBIAR)

### ✅ MANTENER INTACTO

```
app/
├── js/
│   ├── shared.js (✅ consolidado)
│   ├── filters.js (✅ refactorizado)
│   ├── collection-view.js (✅ parametrizado)
│   ├── archive.js (✅ migrado)
│   └── main.js (base)
├── css/
│   ├── styles.css (✅ tokenizado)
│   └── utilities.css (creado, no usado aún)
└── data/ (JSON mock)
```

### 🔄 REEMPLAZAR

```
app/
├── index.html ← mockup-catalog-v2.html (esta sesión)
├── catalogo.html ← ELIMINAR (renombrado a index)
├── tecnica-*.html ← Actualizaciones menores
├── serie-*.html ← Actualizaciones menores
├── archivo.html ← Actualizaciones menores
└── obra-*.html ← Actualizaciones menores
```

### ⏳ CREAR (FASES FUTURAS)

```
app/
├── api/ (endpoints REST cuando Supabase)
├── admin/ (rediseño cuando sea real)
└── data/schema.sql (DB schema)
```

---

## 6. CÓMO NO PERDERSE EN EL CAMINO

### A. Antes de cada chat
1. Lee este archivo (5 min)
2. Identifica la FASE actual
3. ¿Qué entra en esta sesión? ¿Qué no?
4. Confirma [VERIFICADO] antes de cambios código

### B. Durante cada chat
1. Una tarea a la vez
2. Prueba en navegador después de cada paso
3. Documenta decisiones
4. Si algo falla, analiza, no adivines

### C. Después de cada chat
1. Actualiza CLAUDE_WORKFLOW.md (lecciones)
2. Commit a GitHub
3. Actualiza este archivo si hay cambios

### D. Si te pierdes
1. Vuelve a leer FASES DE TRABAJO
2. Pregunta: "¿En qué fase estamos?"
3. Pregunta: "¿Cuál es la tarea clara?"
4. Pide [VERIFICADO] antes de código

### E. Usa memoria de Claude
```
claude --memory-add "Estamos en FASE 1: Catálogo público limpio"
```

---

## 7. DEFINICIONES CLAVE

| Término | Qué es | Ejemplo |
|---------|--------|---------|
| **Mockup** | Visualización estática sin funcionalidad | mockup-catalog-v2.html |
| **Prototipo** | HTML + CSS funcional, datos hardcodeados | index.html actual |
| **Sistema real** | HTML + CSS + JS + API + DB funcionales | Fase 5 |
| **[VERIFICADO]** | Confirmación: selectores/tokens/estructura OK | [VERIFICADO] ✓ |
| **Commit** | Guardar cambios en GitHub | `git commit -m "..."`|
| **Fase** | Conjunto de tareas relacionadas (1-2 sesiones) | FASE 1: Catálogo |
| **RLS** | Row Level Security (Supabase) | Quién ve qué datos |

---

## 8. PREGUNTAS FRECUENTES (ANTES DE EMPEZAR)

### P: ¿Por qué no hacemos todo en HTML desde cero?
**R:** Porque ya tenemos base sólida (JS normalizado, tokens OK). Reutilizar es más rápido.

### P: ¿Cuándo migrar a Next.js?
**R:** Cuando FASE 5 esté 100% completa. No antes. Next.js es infraestructura, no diseño.

### P: ¿Por qué Supabase y no otra BD?
**R:** Postgres real + Auth nativo + Storage + RLS. Rápido, seguro, escalable, sin backend custom.

### P: ¿Qué pasa con las 82 pantallas del mockup admin?
**R:** Son confirmaciones + CRUD repetido. 7-8 pantallas funcionales cubren todo. Mockup descartado.

### P: ¿Tailwind se queda para siempre?
**R:** No. Cuando migres a Next.js, Tailwind será nativo. Eliminar ahora = desperdicio.

### P: ¿Cómo sé si terminé una fase?
**R:** Cuando el checklist de la fase esté 100% completo + GitHub commit + testing OK.

---

## 9. CHECKLIST FINAL (ANTES DE EMPEZAR FASE 0)

- [ ] Leído este archivo completo
- [ ] Entiendo las 4 fases nuevas
- [ ] Entiendo que Admin ↔ Catálogo son interdependientes
- [ ] Tengo mockup-catalog-v2.html descargado
- [ ] Sé dónde está app/index.html actual
- [ ] Sé dónde está app/admin/ (será creado)
- [ ] Git está funcionando en el proyecto
- [ ] Python server funciona (python -m http.server 8000)
- [ ] Claude tiene memoria actualizada
- [ ] Comprendo que Supabase es gratuito para este proyecto
- [ ] Listo para FASE 0 (Supabase Setup)

---

## 10. CONTACTO Y REFERENCIAS

**Repositorio:** https://github.com/egodiseno/catalogo-serigrafia-unam-fad.git

**Archivos clave:**
- README.md (inicio rápido)
- CLAUDE_WORKFLOW.md (lecciones)
- Este archivo (instrucciones)

**Decisiones documentadas en memoria Claude:**
1. Selectores reales CSS
2. Estructura HTML
3. Tokens
4. Decisiones estratégicas

---

## VERSIÓN
- **v2.0** — 2026-05-26 (sesión 5 — nueva ruta con Supabase primero)
- **Anterior:** v1.0 (sesión 4 — normalización)
- **Siguiente actualización:** Después de FASE 0

---

**ÚLTIMA LÍNEA: No eres nuevo en esto. Ya completaste normalización + diseño. Ahora ejecuta limpiamente. Una fase a la vez. Sin distracciones. ¡Vamos! 🚀**