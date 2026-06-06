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



# AUDITORÍA DE CÓDIGO — Admin Funcional

## Contexto
Después de completar **FASE 1 (1.A → 1.F)**, el admin será funcional pero básico.
Este documento guía la auditoría técnica para elevar a **calidad profesional**.

---

## Objetivo
Mejorar:
- ✅ Arquitectura y modularidad
- ✅ Performance y optimizaciones
- ✅ Seguridad y validaciones
- ✅ Testing y cobertura
- ✅ Documentación técnica
- ✅ Mantenibilidad

---

## Áreas a Revisar

### 1. ARQUITECTURA JS
**Pregunta:** ¿El código está bien organizado?

**Checklist:**
- [ ] ¿Hay funciones repetidas que deberían ser helpers comunes?
- [ ] ¿Los módulos (auth.js, dashboard.js, etc.) tienen responsabilidades claras?
- [ ] ¿Hay lógica de negocio mezclada con UI?
- [ ] ¿Se reutilizan funciones Supabase o hay duplicación?
- [ ] ¿Hay namespace global contamination o todo está encapsulado?

**Propuesta:** Crear `app/admin/js/utils/` con:
- `supabase.js` — Cliente Supabase centralizado
- `validators.js` — Validaciones reutilizables
- `dom.js` — Helpers DOM (querySelector, event listeners)
- `errors.js` — Manejo de errores centralizado

---

### 2. PERFORMANCE

**Pregunta:** ¿Es rápido el admin?

**Checklist:**
- [ ] ¿Las queries Supabase tienen LIMIT/OFFSET (paginación)?
- [ ] ¿Se cachea datos frecuentes (técnicas, tags)?
- [ ] ¿Hay debounce en búsqueda (no query por cada keystroke)?
- [ ] ¿Se evita re-render innecesarios?
- [ ] ¿Las imágenes se optimizan antes de upload?

**Propuestas:**
```javascript
// Debounce en búsqueda
const searchWorks = debounce((query) => {
  loadWorks(query);
}, 300);

// Caché de datos
const cache = {
  techniques: null,
  tags: null,
  lastUpdate: {}
};
```

---

### 3. SEGURIDAD

**Pregunta:** ¿Es seguro el admin?

**Checklist:**
- [ ] ¿Se valida TODOS los inputs antes de enviar a DB?
- [ ] ¿Se sanitiza HTML (prevenir XSS)?
- [ ] ¿El token Supabase está seguro en localStorage?
- [ ] ¿Se valida en cliente Y servidor (Supabase RLS)?
- [ ] ¿Las imágenes se validan (tipo, tamaño)?

**Propuestas:**
```javascript
// Validación centralizada
const validate = {
  title: (val) => val && val.trim().length > 0,
  year: (val) => val >= 1800 && val <= 2100,
  email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
  file: (file) => ['image/jpeg', 'image/png'].includes(file.type) && file.size < 5000000
};

// Sanitización
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

---

### 4. GESTIÓN DE ERRORES

**Pregunta:** ¿Qué pasa cuando falla algo?

**Checklist:**
- [ ] ¿Hay try-catch en calls a Supabase?
- [ ] ¿Se muestran mensajes de error claros al usuario?
- [ ] ¿Se registran errores (console, logs)?
- [ ] ¿Se hace cleanup después de errores (limpiar state)?
- [ ] ¿Hay timeout para requests?

**Propuesta:**
```javascript
async function saveWork(work) {
  try {
    setLoading(true);
    const { data, error } = await supabase
      .from('obras')
      .insert([work]);
    
    if (error) {
      showError(error.message);
      console.error('Save failed:', error);
      return;
    }
    
    showSuccess('Obra guardada');
    refreshWorks();
  } catch (err) {
    showError('Error desconocido');
    console.error(err);
  } finally {
    setLoading(false);
  }
}
```

---

### 5. TESTING

**Pregunta:** ¿Está probado el código?

**Checklist:**
- [ ] ¿Hay tests unitarios para funciones críticas?
- [ ] ¿Hay tests E2E para flujos principales (login → crear obra)?
- [ ] ¿Coverage mínimo es 80%?
- [ ] ¿Se prueba en navegadores reales?
- [ ] ¿Se prueban casos de error?

**Propuesta:**
```javascript
// Test: Validar obra
test('saveWork debe fallar sin título', async () => {
  const work = { titulo: '', artista: 'Test' };
  const result = await saveWork(work);
  expect(result.error).toBeTruthy();
});

// Test E2E: Login → Create Work
test('Full flow: login, create, see in table', async () => {
  await login('admin@test.com', 'test123');
  await createWork({ titulo: 'Test', artista: 'Me', año: 2026 });
  const works = await getWorksFromTable();
  expect(works).toContain('Test');
});
```

---

### 6. DOCUMENTACIÓN

**Pregunta:** ¿Se entiende el código sin leerlo?

**Checklist:**
- [ ] ¿Las funciones tienen JSDoc?
- [ ] ¿Hay README técnico (setup, arquitectura)?
- [ ] ¿Hay comentarios en lógica compleja?
- [ ] ¿Hay diagrama de flujo de datos?
- [ ] ¿Está documentado el schema Supabase?

**Propuesta:**
```javascript
/**
 * Guarda una obra nueva o actualiza existente
 * @param {Object} work - Obra a guardar
 * @param {string} work.titulo - Título requerido
 * @param {string} work.artista - Artista requerido
 * @param {number} work.año - Año 1800-2100
 * @returns {Promise<{data, error}>}
 * @throws {Error} Si Supabase falla
 */
async function saveWork(work) {
  // Implementation
}
```

---

### 7. ESTADO Y REACTIVIDAD

**Pregunta:** ¿El estado está bien manejado?

**Checklist:**
- [ ] ¿Hay una única fuente de verdad (DB o estado global)?
- [ ] ¿Se evitan state inconsistencies?
- [ ] ¿Se actualiza UI después de cambios en DB?
- [ ] ¿Se sincroniza local state con remoto?

**Propuesta:**
```javascript
// Centralizar state
const appState = {
  user: null,
  works: [],
  selectedWork: null,
  loading: false,
  error: null
};

function updateState(key, value) {
  appState[key] = value;
  render(); // Re-render si aplica
}
```

---

### 8. ACCESIBILIDAD (CÓDIGO)

**Pregunta:** ¿Es accesible el código?

**Checklist:**
- [ ] ¿Los inputs tienen labels asociados?
- [ ] ¿Hay ARIA en elementos dinámicos?
- [ ] ¿El keyboard navigation funciona?
- [ ] ¿El foco se maneja correctamente?
- [ ] ¿Los errores se anuncian (aria-live)?

---

## Entregables de Auditoría

1. **Documento:** `ARQUITECTURA-ADMIN.md`
   - Diagrama de carpetas
   - Flujo de datos
   - Patrones usados

2. **Código:** Ejemplos refactorizados
   - Antes/después de 3-5 funciones
   - Archivo utils/ nuevo

3. **Testing:** Plan de pruebas
   - Unit tests template
   - E2E tests checklist

4. **Commit:** `AUDIT-CODE: Refactorización, mejoras técnicas, seguridad`

---

## Priorización

**CRÍTICO (hacer primero):**
- Validaciones + sanitización
- Gestión de errores
- Caché de datos

**IMPORTANTE:**
- Modularidad (utils/)
- Testing básico
- Documentación

**NICE-TO-HAVE:**
- Performance avanzada
- Logs centralizados
- Monitoreo




# AUDITORÍA DE DISEÑO GRÁFICO — Admin Funcional

## Contexto
Después de completar **FASE 1 (1.A → 1.F)**, el admin será funcional pero visual básico.
Este documento guía la auditoría de diseño para elevar a **nivel PREMIUM**.

---

## Objetivo
Elevar visual a:
- ✅ Profesionalismo institucional (UNAM)
- ✅ UI/UX coherente y refinado
- ✅ Identidad visual fuerte
- ✅ Microinteracciones suave
- ✅ Accesibilidad visual (WCAG AA+)
- ✅ Experiencia premium

---

## Áreas a Revisar

### 1. PALETA DE COLORES

**Pregunta:** ¿Los colores son profesionales y coherentes?

**Colores UNAM aprobados:**
```
Azul oficial:  #013B75 (Pantone 540)
Oro oficial:   #D9A500 (Pantone 117)
```

**Checklist:**
- [ ] ¿Se usan SOLO azul #013B75 y oro #D9A500 como primarios?
- [ ] ¿Hay variaciones (más oscuro, más claro) del azul?
- [ ] ¿El fondo es blanco/crema/gris muy claro?
- [ ] ¿El texto es azul oscuro/gris oscuro (no negro puro)?
- [ ] ¿Hay suficiente contraste (WCAG AA: 4.5:1)?

**Propuesta:**
```css
:root {
  /* Primarios UNAM */
  --color-primary: #013B75;        /* Azul institucional */
  --color-accent: #D9A500;         /* Oro institucional */
  
  /* Variaciones */
  --color-primary-dark: #002A55;   /* Más oscuro para texto/borders */
  --color-primary-light: #EEF4FB;  /* Fondo alternativo */
  --color-accent-dark: #B58700;    /* Hover del oro */
  
  /* Neutrales */
  --color-bg: #FAFAFA;             /* Fondo principal */
  --color-surface: #FFFFFF;        /* Cards, paneles */
  --color-text: #1F2937;           /* Texto principal (gris oscuro) */
  --color-text-muted: #6B7280;     /* Texto secundario */
  --color-border: #E5E7EB;         /* Bordes sutiles */
  
  /* Estados */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
}
```

**Test contraste:**
- [ ] Azul sobre blanco: ✅ (ratio 8:1+)
- [ ] Texto gris oscuro sobre blanco: ✅ (ratio 7:1+)
- [ ] Oro sobre blanco: ⚠️ (revisar, puede ser bajo)

---

### 2. TIPOGRAFÍA

**Pregunta:** ¿La tipografía es moderna y profesional?

**Fuentes aprobadas:**
```
Sans: Inter     (body, UI, labels) — clara, moderna
Serif: Lora     (títulos h1, h2) — editorial, elegante (opcional)
```

**Checklist:**
- [ ] ¿Se usa Inter para todo el body/UI?
- [ ] ¿Las fuentes están importadas (Google Fonts o local)?
- [ ] ¿Hay una escala clara (12px, 14px, 16px, 18px, 22px, 28px, 36px)?
- [ ] ¿El line-height es 1.5+ (legibilidad)?
- [ ] ¿El font-weight es claro (400 normal, 600 bold, 700 extra)?

**Propuesta:**
```css
/* Escala tipográfica */
h1 { font-size: 2.25rem; line-height: 1.2; font-weight: 700; } /* 36px */
h2 { font-size: 1.875rem; line-height: 1.3; font-weight: 600; } /* 30px */
h3 { font-size: 1.5rem; line-height: 1.3; font-weight: 600; } /* 24px */
h4 { font-size: 1.125rem; line-height: 1.4; font-weight: 600; } /* 18px */
body { font-size: 1rem; line-height: 1.5; font-weight: 400; } /* 16px */
small { font-size: 0.875rem; line-height: 1.6; } /* 14px */

/* Weights */
.font-light { font-weight: 300; }
.font-normal { font-weight: 400; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
```

---

### 3. ESPACIADO Y LAYOUT

**Pregunta:** ¿El layout es eficiente y profesional?

**Checklist:**
- [ ] ¿Hay un espaciado base consistente (4px, 8px, 16px, 24px, 32px)?
- [ ] ¿El sidebar tiene ancho óptimo (260-320px)?
- [ ] ¿El contenido principal tiene max-width (1200px)?
- [ ] ¿Hay breathing room alrededor de elementos?
- [ ] ¿Las tablas tienen padding/margin adecuado?

**Propuesta:**
```css
:root {
  /* Espaciado base 8px */
  --space-xs: 0.25rem;    /* 4px */
  --space-sm: 0.5rem;     /* 8px */
  --space-md: 1rem;       /* 16px */
  --space-lg: 1.5rem;     /* 24px */
  --space-xl: 2rem;       /* 32px */
  --space-2xl: 3rem;      /* 48px */
}

/* Aplicar */
.sidebar { width: 280px; padding: var(--space-lg); }
.main { max-width: 1200px; padding: var(--space-xl); }
.card { padding: var(--space-lg); margin-bottom: var(--space-md); }
```

---

### 4. COMPONENTES Y ESTADOS

**Pregunta:** ¿Los componentes tienen estados visuales claros?

**Componentes clave:**
- [ ] **Botones:** normal, hover, active, disabled, loading
- [ ] **Inputs:** default, focus, error, disabled
- [ ] **Tablas:** row normal, row hover, row selected
- [ ] **Cards:** default, hover, selected
- [ ] **Modales:** overlay, animación entrada
- [ ] **Alerts:** success, error, warning, info

**Propuesta — BOTÓN:**
```css
.btn {
  padding: var(--space-sm) var(--space-md);
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 200ms ease;
  font-weight: 600;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  box-shadow: 0 4px 12px rgba(1, 59, 117, 0.15);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(1, 59, 117, 0.1);
}

.btn-primary:disabled {
  background: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-primary.loading::after {
  content: '';
  animation: spin 1s infinite;
}
```

**Propuesta — INPUT:**
```css
input, textarea, select {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 1rem;
  transition: all 200ms ease;
}

input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(1, 59, 117, 0.1);
}

input.error {
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.05);
}

input:disabled {
  background: var(--color-border);
  cursor: not-allowed;
  opacity: 0.6;
}
```

---

### 5. MICROINTERACCIONES

**Pregunta:** ¿La UI responde de forma suave y refinada?

**Checklist:**
- [ ] ¿Hay transiciones en hover (200-300ms)?
- [ ] ¿Los loading spinners son suaves (no saltos)?
- [ ] ¿Los modales tienen fade-in?
- [ ] ¿Los toasts (mensajes) tienen slide-in + auto-dismiss?
- [ ] ¿El feedback es inmediato (button press responde al toque)?

**Propuesta:**
```css
/* Transiciones globales */
* {
  transition: background-color 200ms ease,
              color 200ms ease,
              border-color 200ms ease,
              box-shadow 200ms ease;
}

/* Loading spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

/* Modal fade-in */
.modal {
  animation: fadeIn 200ms ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Toast slide-in */
.toast {
  animation: slideIn 300ms ease;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

---

### 6. SOMBRAS Y PROFUNDIDAD

**Pregunta:** ¿Hay profundidad visual (jerarquía)?

**Checklist:**
- [ ] ¿Las cards tienen sombra sutil?
- [ ] ¿El sidebar tiene sombra derecha?
- [ ] ¿Los botones tienen sombra en hover?
- [ ] ¿Las sombras son consistentes?

**Propuesta:**
```css
:root {
  /* Sombras por nivel */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.card { box-shadow: var(--shadow-md); }
.card:hover { box-shadow: var(--shadow-lg); }
.btn:hover { box-shadow: var(--shadow-md); }
```

---

### 7. IDENTIDAD VISUAL

**Pregunta:** ¿Se transmite identidad UNAM?

**Checklist:**
- [ ] ¿Logo UNAM está en header?
- [ ] ¿Hay tagline institucional ("Catálogo de Obra Serigráfica")?
- [ ] ¿Footer tiene info institucional?
- [ ] ¿Colores UNAM son dominantes?
- [ ] ¿El tono es sobrio y académico?

**Propuesta:**
```html
<header class="admin-header">
  <img src="/assets/unam-logo.svg" alt="UNAM" class="logo">
  <h1>Catálogo de Obra Serigráfica</h1>
  <p class="tagline">FAD · Taller de Serigrafía</p>
</header>

<footer class="admin-footer">
  <p>&copy; 2026 UNAM · Facultad de Artes y Diseño</p>
  <p>Taller de Serigrafía</p>
</footer>
```

---

### 8. ACCESIBILIDAD VISUAL

**Pregunta:** ¿Es accesible visualmente?

**Checklist:**
- [ ] ¿Contraste mínimo WCAG AA (4.5:1)?
- [ ] ¿Hay iconografía clara (no solo colores)?
- [ ] ¿El foco es visible (outline azul)?
- [ ] ¿Los colores no son el único diferenciador?
- [ ] ¿El tamaño mínimo de texto es 14px?

---

### 9. RESPONSIVIDAD

**Pregunta:** ¿Funciona bien en mobile/tablet?

**Checklist:**
- [ ] ¿Sidebar se colapsa en mobile (hamburger menu)?
- [ ] ¿Las tablas se adaptan (overflow scroll)?
- [ ] ¿Los modales son full-width en mobile?
- [ ] ¿El padding se ajusta por breakpoint?
- [ ] ¿Se prueba en 320px, 768px, 1024px, 1440px?

---

## Entregables de Auditoría

1. **Documento:** `DESIGN-SYSTEM-ADMIN.md`
   - Paleta completa
   - Escala tipográfica
   - Componentes con estados
   - Guías de espaciado

2. **CSS:** Refactorizado
   - Variables centralizadas
   - Componentes reutilizables
   - Transiciones suaves
   - Responsive refinado

3. **Mockups/Screenshots:**
   - Antes/después de 3-5 componentes
   - Paleta aplicada
   - Microinteracciones

4. **Commit:** `AUDIT-DESIGN: Paleta UNAM, componentes premium, microinteracciones`

---

## Priorización

**CRÍTICO (hacer primero):**
- Paleta UNAM (#013B75, #D9A500)
- Escala tipográfica clara
- Estados de componentes (hover, focus, active)

**IMPORTANTE:**
- Espaciado consistente
- Sombras y profundidad
- Transiciones suaves
- Identidad visual UNAM

**NICE-TO-HAVE:**
- Dark mode
- Animaciones complejas
- Temas personalizables

---

## Resultado Esperado

Un admin que sea:
- ✅ Profesional e institucional
- ✅ Moderno y refinado
- ✅ Accesible y usable
- ✅ Coherente visualmente
- ✅ Premium y de confianza



# AUDITORÍA UX — Admin Funcional

## Contexto
Después de completar **FASE 1 (1.A → 1.F)**, el admin será funcional pero puede tener **fricciones en la experiencia de usuario**.
Este documento guía la auditoría de UX para optimizar **usabilidad, flujos y satisfacción**.

---

## Objetivo
Mejorar:
- ✅ Flujos de usuario (reducir pasos)
- ✅ Mental models (mentalidad del usuario)
- ✅ Discoverability (encontrar funciones)
- ✅ Feedback (saber qué está pasando)
- ✅ Accesibilidad funcional (a11y)
- ✅ Eficiencia (tareas rápidas)

---

## Áreas a Revisar

### 1. FLUJOS DE USUARIO (USER FLOWS)

**Pregunta:** ¿El usuario puede lograr sus objetivos con mínimos pasos?

**Caso actual PROBLEMÁTICO:**
```
Objetivo: Crear una obra con nueva técnica y nuevas tags

Flujo ACTUAL (4 pasos):
1. Admin → Sección Técnicas → Crear nueva técnica
2. Volver → Sección Tags → Crear nuevo tag(s)
3. Volver → Sección Obras → Crear obra
4. Seleccionar técnica y tags creadas

❌ Problema: El usuario salta entre secciones. Contexto perdido.
❌ Problema: Si olvida crear técnica, tiene que empezar de nuevo.
```

**Flujo IDEAL (1 paso):**
```
Objetivo: Crear una obra con nueva técnica y nuevas tags

Flujo NUEVO:
1. Sección Obras → Crear obra
   ├─ Campos básicos (título, artista, año, descripción)
   ├─ Técnica:
   │  ├─ Selector (técnicas existentes)
   │  └─ Opción "Crear nueva técnica" (inline)
   │     └─ Modal pequeño: nombre, descripción
   ├─ Tags:
   │  ├─ Selector multiselect (tags existentes)
   │  └─ Opción "Agregar nuevo tag" (inline)
   │     └─ Tags nuevos se crean al guardar
   └─ Botón "Guardar obra"

✅ Usuario NO salta entre secciones.
✅ Usuario todo en un lugar.
✅ Técnicas/tags se crean "in-the-moment".
```

**Checklist:**
- [ ] ¿El usuario salta entre muchas secciones?
- [ ] ¿Hay pasos que podrían combinarse?
- [ ] ¿El flujo es lineal o tiene "saltos"?
- [ ] ¿El usuario entiende el orden de pasos?
- [ ] ¿Hay un "happy path" claro?

**Propuesta de mejora:**
1. **Técnicas inline:** Dropdown + botón "Crear nueva" que abre modal pequeño
2. **Tags inline:** Selector multiselect + agregar tags nuevas al escribir (tag creation on-the-fly)
3. **Validación progresiva:** Advertencia si técnica no existe, NO bloquear

---

### 2. MENTAL MODELS

**Pregunta:** ¿El usuario entiende cómo funcionan las cosas?

**Caso actual:**
```
Usuario nuevo piensa:
"¿Por qué tengo que ir a otra sección para crear técnica?"
"¿Puedo crear técnica MIENTRAS creo obra?"
"¿Qué pasa si selecciono técnica que no existe?"
```

**Mejora:**
```
✅ "Crear obra" es la sección principal
✅ Técnicas/tags se crean "on-the-fly" dentro del formulario
✅ Usuario NUNCA salta de sección
✅ Mentalidad: "1 acción = crear 1 cosa (obra)"
```

**Checklist:**
- [ ] ¿El usuario sabe dónde ir para [crear obra]?
- [ ] ¿El usuario sabe qué es técnica, tag, obra?
- [ ] ¿Hay consistencia en dónde se crean cosas?
- [ ] ¿Hay conflictos mentales (ej: ¿dónde creo esto?)?

---

### 3. DISCOVERABILITY (ENCONTRAR FUNCIONES)

**Pregunta:** ¿El usuario descubre fácilmente qué puede hacer?

**Checklist:**
- [ ] ¿El botón "Crear obra" es obvio?
- [ ] ¿Están visibles las opciones "Crear técnica", "Crear tag"?
- [ ] ¿Hay un "+" al lado del selector (técnicas)?
- [ ] ¿El usuario sabe que puede crear mientras crea?
- [ ] ¿Hay tooltips o hints?

**Propuesta:**
```html
<!-- Técnica con opción inline -->
<div class="form-group">
  <label>Técnica *</label>
  <div class="technique-input">
    <select id="technique" required>
      <option value="">Selecciona técnica</option>
      <option value="serigrafia">Serigrafía</option>
      <option value="litografia">Litografía</option>
    </select>
    <button type="button" class="btn-inline" title="Crear nueva técnica">
      <span class="icon">+</span> Nueva
    </button>
  </div>
  <small>O selecciona una existente</small>
</div>

<!-- Tags con agregar inline -->
<div class="form-group">
  <label>Tags</label>
  <div class="tags-input">
    <input type="text" id="tag-input" placeholder="Busca o crea tag (Enter)">
    <div class="tags-list">
      <!-- Tags seleccionados aparecen aquí -->
    </div>
  </div>
  <small>Escribe y presiona Enter para agregar tag nuevo</small>
</div>
```

---

### 4. FEEDBACK (SABER QUÉ ESTÁ PASANDO)

**Pregunta:** ¿El usuario sabe qué está pasando?

**Checklist:**
- [ ] ¿Hay spinner cuando se carga?
- [ ] ¿Hay mensaje "Obra guardada" después de crear?
- [ ] ¿Hay mensaje error si algo falla?
- [ ] ¿Se muestra qué técnica/tags se crearon?
- [ ] ¿El usuario sabe si su acción fue exitosa?

**Propuesta:**
```javascript
// Feedback en tiempo real
async function saveWork(work) {
  showLoading(true, "Guardando obra...");
  
  try {
    // Crear técnica si es nueva
    if (work.techniqueIsNew) {
      showProgress("Creando técnica...");
      work.techniqueId = await createTechnique(work.techniqueNew);
    }
    
    // Crear tags si son nuevos
    if (work.tagsNew.length > 0) {
      showProgress("Creando tags...");
      work.tagIds = await createTags(work.tagsNew);
    }
    
    // Crear obra
    showProgress("Guardando obra...");
    const result = await createWork(work);
    
    showSuccess(
      `✅ Obra "${work.titulo}" creada${
        work.tagsNew.length ? ` con ${work.tagsNew.length} nuevas tags` : ''
      }`
    );
    
  } catch (error) {
    showError(`❌ Error: ${error.message}`);
  } finally {
    showLoading(false);
  }
}
```

---

### 5. ACCESIBILIDAD FUNCIONAL (A11Y)

**Pregunta:** ¿Pueden usar el admin personas con discapacidades?

**Checklist:**
- [ ] ¿Los labels están asociados a inputs (for/id)?
- [ ] ¿Se puede navegar con teclado (Tab)?
- [ ] ¿El foco es visible?
- [ ] ¿Los errores se anuncian (aria-live)?
- [ ] ¿Las imágenes tienen alt text?

**Propuesta:**
```html
<!-- Accesible -->
<label for="technique">Técnica *</label>
<select id="technique" aria-required="true" aria-label="Selecciona técnica">
  ...
</select>

<!-- Mensajes de error accesibles -->
<div class="error-message" role="alert" aria-live="polite">
  Por favor selecciona una técnica
</div>
```

---

### 6. EFICIENCIA (TAREAS RÁPIDAS)

**Pregunta:** ¿El usuario puede hacer tareas rápido?

**Caso actual:**
```
Crear obra: ~5 minutos (saltar secciones, esperar)
❌ Demasiado lento
```

**Objetivo:**
```
Crear obra: ~1-2 minutos (todo en un lugar)
✅ Rápido y fluido
```

**Propuesta:**
- ✅ Autocompletado en técnicas/tags
- ✅ Drag-drop de imágenes
- ✅ Guardar con Ctrl+S
- ✅ Draft automático cada 30s
- ✅ Atajos de teclado

---

### 7. ONBOARDING Y HELP

**Pregunta:** ¿El usuario nuevo sabe cómo usar el admin?

**Checklist:**
- [ ] ¿Hay una sección "Guía" o "Ayuda"?
- [ ] ¿Hay tooltips en elementos complejos?
- [ ] ¿Hay un "tour" guiado para usuarios nuevos?
- [ ] ¿Hay ejemplos de cómo llenar formularios?

**Propuesta:**
```html
<!-- Tooltip -->
<button class="btn" title="Crear nueva técnica aquí">
  <span class="icon-help">?</span>
</button>

<!-- Help modal -->
<div class="help-modal" style="display:none">
  <h2>¿Cómo crear una obra?</h2>
  <ol>
    <li>Llena título, artista, año</li>
    <li>Selecciona técnica (o crea una nueva)</li>
    <li>Agrega tags (o crea nuevas)</li>
    <li>Sube imágenes</li>
    <li>Guarda</li>
  </ol>
</div>
```

---

### 8. ERRORES Y PREVENCIÓN

**Pregunta:** ¿Qué pasa cuando el usuario comete errores?

**Checklist:**
- [ ] ¿Los campos requeridos están claros?
- [ ] ¿Se previenen errores o se muestran?
- [ ] ¿El usuario puede deshacer (undo)?
- [ ] ¿Hay confirmación antes de borrar?

**Propuesta:**
```javascript
// Prevenir errores
if (!work.titulo || !work.artista) {
  showWarning("Título y artista son requeridos");
  return;
}

// Confirmación antes de borrar
if (confirm("¿Seguro que quieres borrar esta obra?")) {
  deleteWork(work.id);
}
```

---

### 9. NOTIFICACIONES Y ALERTAS

**Pregunta:** ¿Las notificaciones ayudan o molestan?

**Checklist:**
- [ ] ¿Hay demasiadas notificaciones?
- [ ] ¿Las notificaciones son claras?
- [ ] ¿Se cierran automáticamente?
- [ ] ¿El usuario sabe si es error, warning o success?

**Propuesta:**
```javascript
// Toast notifications (no molestar)
showToast('Obra guardada', 'success', 3000); // Auto-cierra en 3s
showToast('Archivo muy grande', 'warning', 5000);
showToast('Error al guardar', 'error', 0); // No cierra hasta hacer click
```

---

### 10. SEARCH Y FILTROS

**Pregunta:** ¿El usuario encuentra rápido lo que busca?

**Checklist:**
- [ ] ¿Hay búsqueda por título?
- [ ] ¿Hay filtros por técnica, año, estado?
- [ ] ¿La búsqueda es rápida (no lag)?
- [ ] ¿Se guardan filtros (persistencia)?

**Propuesta:**
```javascript
// Búsqueda inteligente
const searchWorks = debounce((query) => {
  const results = works.filter(w =>
    w.titulo.toLowerCase().includes(query) ||
    w.artista.toLowerCase().includes(query)
  );
  renderTable(results);
}, 300);
```

---

## PROBLEMAS ESPECÍFICOS A REVISAR

**Del proyecto actual:**

1. **Creación de técnicas/tags separada** ⚠️
   - Propuesta: Inline creation en formulario obra
   - Impacto: Flujo 5x más eficiente

2. **¿Hay búsqueda rápida de obras?** ⚠️
   - Propuesta: Campo búsqueda en header

3. **¿El usuario sabe qué pasa al crear imagen?** ⚠️
   - Propuesta: Progress bar visual

4. **¿Se puede editar obra existente?** ⚠️
   - Propuesta: Botón "Editar" en tabla → abre modal

5. **¿Hay validación antes de guardar?** ⚠️
   - Propuesta: Hints en tiempo real (rojo si vacío)

---

## Entregables de Auditoría

1. **Documento:** `UX-IMPROVEMENTS.md`
   - Lista de 10-15 mejoras priorizadas
   - Antes/después de flujos
   - Mockups de nuevos flujos

2. **Diseño:** Nuevos flujos
   - Formulario obra CON técnicas/tags inline
   - Búsqueda en header
   - Feedback visual mejorado

3. **Propuestas de código:**
   - Inline técnica/tags
   - Búsqueda debounced
   - Toast notifications mejoradas

4. **Commit:** `AUDIT-UX: Mejora flujos, inline creation, feedback visual`

---

## Priorización

**CRÍTICO (hacer primero):**
- ✅ Crear técnicas/tags inline en formulario obra
- ✅ Búsqueda rápida en header
- ✅ Feedback visual mejorado (loading, success)

**IMPORTANTE:**
- Confirmación antes de borrar
- Validación en tiempo real (hints)
- Tooltips en elementos complejos

**NICE-TO-HAVE:**
- Undo/redo
- Draft automático
- Atajos de teclado
- Tour guiado

---

## Resultado Esperado

Un admin que sea:
- ✅ Intuitivo (usuario sabe qué hacer)
- ✅ Eficiente (pocas clics para lograr objetivo)
- ✅ Seguro (previene errores)
- ✅ Accesible (anyone can use)
- ✅ Responsive (feedback inmediato)
