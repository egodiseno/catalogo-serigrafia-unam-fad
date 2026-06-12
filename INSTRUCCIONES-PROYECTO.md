# CATÁLOGO DIGITAL DE OBRA SERIGRÁFICA — INSTRUCCIONES DE PROYECTO

**Versión:** 3.0 (2026-06-12)  
**Estado:** ✅ Admin 100% funcional | ⏳ Catálogo público en construcción  
**Proyecto:** egodiseno/catalogo-serigrafia-unam-fad (GitHub)

---

## 📋 TABLA DE CONTENIDOS

1. [Visión General](#visión-general)
2. [Stack Actual](#stack-actual)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Fases de Desarrollo](#fases-de-desarrollo)
5. [Estado Actual Detallado](#estado-actual-detallado)
6. [Cómo Trabajar en Este Proyecto](#cómo-trabajar-en-este-proyecto)
7. [Variables Globales y Helpers](#variables-globales-y-helpers)
8. [Supabase Configuración](#supabase-configuración)
9. [Testing](#testing)
10. [Flujo de Git](#flujo-de-git)

---

## 🎯 VISIÓN GENERAL

### Objetivo Principal

Crear **plataforma digital académica y cultural** para UNAM/FAD que permita:

- **Admin Panel:** Sistema robusto para gestionar obras, imágenes, usuarios, técnicas y tags
- **Catálogo Público:** Interfaz elegante para explorar, filtrar y visualizar obras serigráficas
- **Base de Datos Real:** Supabase (Postgres + Auth + Storage) con seguridad mediante RLS
- **Identidad Visual:** Colores UNAM (#013b75 azul, #d9a500 oro) + diseño moderno

### Usuarios

| Tipo | Acceso |
|------|--------|
| **Público** | Catálogo, filtros, búsqueda, fichas de obra |
| **Admin** | Login con MFA, CRUD completo, upload imágenes, gestión usuarios |

---

## 🛠️ STACK ACTUAL

| Capa | Tecnología | Estado |
|------|-----------|--------|
| **Frontend** | HTML + CSS + JS vanilla | ✅ Producción |
| **Diseño** | Tailwind CDN + CSS custom | ✅ Mantiene |
| **Iconografía** | Lucide Icons (SVG) | ✅ Producción |
| **Base de Datos** | Supabase Postgres | ✅ Producción |
| **Autenticación** | Supabase Auth + MFA (TOTP) | ✅ Producción |
| **Almacenamiento** | Supabase Storage (bucket artworks) | ✅ Producción |
| **Edge Functions** | TypeScript (create-admin-user, reset-user-password, send-welcome-email, convert-webp) | ✅ Producción |
| **Deploy** | Netlify | ✅ Producción |
| **Próximo** | Next.js (FASE 4, futuro) | ⏳ Planeado |

---

## 📁 ESTRUCTURA DEL PROYECTO

```
catalogo-serigrafia-unam-fad/
├── app/
│   ├── admin/
│   │   ├── index.html                    (login + dashboard admin)
│   │   ├── css/admin.css                 (estilos admin consolidados)
│   │   └── js/
│   │       ├── config.js                 (Supabase client setup)
│   │       ├── auth.js                   (login, MFA, password recovery)
│   │       ├── dashboard.js              (métricas, estadísticas)
│   │       ├── obras-list.js             (tabla obras + filtros)
│   │       ├── obras-form.js             (crear/editar obra modal)
│   │       ├── storage.js                (upload images, validación)
│   │       ├── multi-image-upload.js     (múltiples imágenes por obra)
│   │       ├── tags-in-obra.js           (gestión tags en modal obra)
│   │       ├── password-recovery.js      (recuperación contraseña)
│   │       ├── modals.js                 (ModalManager global)
│   │       ├── usuarios-crud.js          (CRUD usuarios admin)
│   │       ├── tecnicas-crud.js          (CRUD técnicas)
│   │       ├── tags-crud.js              (CRUD tags)
│   │       ├── navigation.js             (navegación admin)
│   │       ├── init.js                   (inicialización)
│   │       └── shared.js                 (helpers reutilizables)
│   │
│   ├── index.html                        (catálogo público - HOME)
│   ├── css/styles.css                    (estilos catálogo público)
│   ├── js/
│   │   ├── public-catalog.js             (grid + filtros) [PRÓXIMO]
│   │   ├── public-detail.js              (ficha de obra) [PRÓXIMO]
│   │   ├── gallery.js                    (carrusel imágenes) [PRÓXIMO]
│   │   └── shared.js                     (helpers reutilizables)
│   └── data/
│       └── mock.json                     (datos de prueba - EN DESUSO)
│
├── supabase/
│   ├── config.toml                       (configuración local)
│   └── functions/
│       ├── create-admin-user/
│       │   ├── index.ts                  (Edge Function v5)
│       │   └── .env.example
│       ├── reset-user-password/
│       │   └── index.ts                  (Edge Function v3)
│       ├── send-welcome-email/
│       │   └── index.ts                  (Edge Function v1)
│       └── convert-webp/
│           └── index.ts                  (Edge Function - PRÓXIMO)
│
├── .env.local                            (variables de entorno - NO COMMIT)
├── .env.example                          (template de .env)
├── .gitignore
├── README.md
├── CLAUDE_WORKFLOW.md                    (lecciones aprendidas)
├── INSTRUCCIONES-PROYECTO.md             (este archivo)
└── package.json (cuando migre a Node)

Supabase Project Ref: kfvjansfmhamkrnbxmgp
```

---

## 🔄 FASES DE DESARROLLO

### ✅ FASE 0: SUPABASE SETUP (COMPLETADA)

**Qué se hizo:**
- [x] Cuenta Supabase (FREE tier)
- [x] Esquema DB: obras, técnicas, tags, obra_tags, imágenes, usuarios_admin
- [x] RLS configurada (público READ, admin READ/WRITE)
- [x] Storage bucket "artworks" configurado
- [x] Auth con Supabase

**Resultado:** Base de datos funcional, lista para producción

---

### ✅ FASE 1: ADMIN FUNCIONAL (COMPLETADA)

**Qué se hizo:**
- [x] Setup estructura HTML/CSS
- [x] Login con MFA (TOTP)
- [x] Dashboard con métricas
- [x] CRUD obras (crear, leer, editar, eliminar)
- [x] Upload imágenes a Storage (múltiples por obra)
- [x] CRUD técnicas
- [x] CRUD tags (con gestión en modal obra)
- [x] CRUD usuarios admin (con Edge Functions)
- [x] Recuperación de contraseña
- [x] Validaciones cliente + servidor
- [x] Responsive admin (desktop, tablet, mobile)
- [x] Integración Lucide Icons

**Dependencias resueltas:**
- Edge Function `create-admin-user` (v5) → crear usuarios via admin
- Edge Function `reset-user-password` (v3) → recuperación contraseña
- Edge Function `send-welcome-email` (v1) → emails bienvenida

**Estado:** 100% funcional, testeado con datos reales

**Commits principales:**
```
FEAT: Login + MFA (Supabase Auth + TOTP)
FEAT: Dashboard con métricas desde Supabase
FEAT: CRUD obras + imágenes Storage
FEAT: CRUD técnicas, tags, usuarios
FEAT: Recuperación de contraseña
FEAT: Multi-image upload optimizado
```

---

### ⏳ FASE 2: CATÁLOGO PÚBLICO FUNCIONAL (EN CONSTRUCCIÓN)

**Objetivo:** Crear catálogo público conectado a datos reales del admin, con testing simultáneo

**Qué se debe hacer:**

1. **Definir especificaciones de imagen**
   - [ ] Grid catálogo: tamaño imagen (ej: 600×800px)
   - [ ] Ficha detalle: tamaño imagen principal (ej: 1200×1600px)
   - [ ] Galería adicional: tamaño imágenes (carrusel)
   - [ ] Formato: WebP (compresión 80%)
   - [ ] Storage budget: máx 1.5 GB (escalabilidad)

2. **Crear Edge Function convert-webp**
   - [ ] Recibir JPG/PNG/TIFF → convertir WebP
   - [ ] Redimensionar automáticamente
   - [ ] Validar: máx 10 MB, mín 400×400px
   - [ ] Retornar: URL, tamaño, % compresión

3. **Grid catálogo**
   - [ ] Conectar a Supabase (SELECT obras WHERE estado='publicado')
   - [ ] Mostrar 3-4 columnas (responsive)
   - [ ] Lazy load al scroll
   - [ ] Mostrar: imagen, título, artista, año, técnica, tags

4. **Filtros y búsqueda**
   - [ ] Filtro por año (dropdown dinámico)
   - [ ] Filtro por técnica (dropdown dinámico)
   - [ ] Filtro por tags (checkboxes dinámicos)
   - [ ] Búsqueda por título (debounce 300ms)
   - [ ] Botón "Limpiar filtros"

5. **Ficha de obra (Detail page)**
   - [ ] URL slug-based: `/obra/memoria-del-taller`
   - [ ] Imagen principal grande (1200×1600 o fullwidth)
   - [ ] Info: título, artista, año, técnica, descripción, tags
   - [ ] Galería carrusel (imágenes adicionales)
   - [ ] Link regreso al catálogo

6. **Galería imágenes**
   - [ ] Mostrar 3-4 imágenes adicionales por obra
   - [ ] Carrusel con prev/next (Lucide icons)
   - [ ] Click → lightbox fullscreen
   - [ ] Transiciones suave

7. **Testing E2E admin ↔ catálogo**
   - [ ] Admin crea obra → aparece en catálogo
   - [ ] Admin edita obra → cambios reflejados
   - [ ] Admin sube imagen → aparece en galería
   - [ ] Admin elimina obra → desaparece de catálogo
   - [ ] Filtros funcionan correctamente
   - [ ] Búsqueda funciona
   - [ ] Responsive: desktop, tablet, mobile

**Estimado:** 1 chat (2-3 horas)

**Entregables:**
- Catálogo público 100% funcional
- Edge Function convert-webp en producción
- Testing E2E completo (13+ casos)
- Commits documentados

---

### 📋 FASE 3: AUDITORÍAS Y REFINAMIENTOS (FUTURO)

**Cuándo:** Después de FASE 2 100% completa

**Qué incluye:**
- AUDIT-UX: Mejora flujos, inline creation, feedback visual
- AUDIT-CODE: Optimizaciones técnicas, refactorización
- AUDIT-DESIGN: Paleta, tipografía, microinteracciones, accesibilidad

---

### 🚀 FASE 4: MIGRACIÓN A NEXT.JS (FUTURO)

**Cuándo:** Cuando FASE 3 esté completada y validada

**Por qué:** Escalabilidad, SSR, mejor performance, TypeScript nativo

---

## 📊 ESTADO ACTUAL DETALLADO

### ✅ ADMIN — COMPLETADO 100%

**Funcionalidades operacionales:**

| Funcionalidad | Status | Notas |
|---------------|--------|-------|
| Login email+password | ✅ | Supabase Auth |
| MFA (TOTP) | ✅ | Obligatorio en flujo |
| Dashboard | ✅ | Métricas, estadísticas |
| CRUD Obras | ✅ | Create, Read, Update, Delete |
| Upload imágenes | ✅ | Múltiples por obra, Storage |
| CRUD Técnicas | ✅ | Con tabla + modal |
| CRUD Tags | ✅ | Con tabla + modal + en obra |
| CRUD Usuarios | ✅ | Edge Functions, MFA |
| Password Recovery | ✅ | Email + nuevo formulario |
| Validaciones | ✅ | Cliente + servidor (RLS) |
| Responsive | ✅ | Desktop, tablet, mobile |
| Lucide Icons | ✅ | Todos los iconos |

**Datos de prueba:**
- ~4-5 obras con imágenes en Supabase
- 2+ técnicas
- 5+ tags
- 2+ usuarios admin

**Storage:**
- Bucket: `artworks` (público lectura)
- Imágenes: ~10-15 archivos de prueba
- Tamaño: <100 MB usado

---

### ⏳ CATÁLOGO PÚBLICO — EN PLANIFICACIÓN

**Especificaciones pendientes:**
- [ ] Tamaños exactos de imagen (por definir en FASE 2)
- [ ] Tipo de galería (carrusel vs grid)
- [ ] Layout ficha (1 columna vs 2 columnas)

**Archivos a crear:**
- `app/index.html` (catálogo home)
- `app/js/public-catalog.js` (grid + filtros)
- `app/js/public-detail.js` (ficha de obra)
- `app/js/gallery.js` (carrusel)
- `supabase/functions/convert-webp/index.ts` (Edge Function)

---

### 🔧 EDGE FUNCTIONS EN PRODUCCIÓN

| Función | Versión | Status | URL |
|---------|---------|--------|-----|
| `create-admin-user` | v5 | ✅ ACTIVE | https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/create-admin-user |
| `reset-user-password` | v3 | ✅ ACTIVE | https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/reset-user-password |
| `send-welcome-email` | v1 | ✅ ACTIVE | https://kfvjansfmhamkrnbxmgp.supabase.co/functions/v1/send-welcome-email |
| `convert-webp` | - | ⏳ PENDING | - |

**Secrets configurados:**
- `SERVICE_ROLE_KEY` → Service role key de Supabase

---

## 🛠️ CÓMO TRABAJAR EN ESTE PROYECTO

### Regla 1: Un Chat por Fase

```
❌ MAL: "Admin + Catálogo en el mismo chat"
✅ BIEN: Chat 1 → Admin | Chat 2 → Catálogo | Chat 3 → Auditorías
```

Cada fase tiene su propio contexto, dependencias y testing.

---

### Regla 2: Especificaciones Claras ANTES de Code

Antes de abrir Claude Code:

1. **Leer este archivo** (5 min)
2. **Identificar FASE actual** (qué incluye, qué no)
3. **Redactar prompt** (objetivo + checklist + archivos)
4. **Pegar prompt completo** en Claude

---

### Regla 3: Testing Simultáneo admin ↔ público (FASE 2+)

```
Admin: Crea obra
  ↓
Catálogo público: Debe aparecer inmediatamente
  ↓
Admin: Edita obra
  ↓
Catálogo público: Cambios reflejados sin refresh
  ↓
Admin: Elimina obra
  ↓
Catálogo público: Obra desaparece
```

---

### Regla 4: Git Commits por Funcionalidad

```bash
# Después de cada funcionalidad completada
git add .
git commit -m "FEAT: [Descripción clara]"
git push

# Ejemplos:
FEAT: Login + MFA funcionales
FEAT: CRUD obras completo
FEAT: Grid catálogo conectado a Supabase
FEAT: Edge Function convert-webp integrada
FEAT: Testing E2E admin ↔ catálogo (completo)
```

---

### Regla 5: Documentar Decisiones

Toda decisión importante:

1. **Commit message:** Claro y descriptivo
2. **CLAUDE_WORKFLOW.md:** Lecciones aprendidas
3. **Este archivo:** Cambios en estructura/roadmap

**Ejemplo:**
```markdown
# CLAUDE_WORKFLOW.md

## Chat 5: Catálogo Público

### Decisiones
- Imagen principal 600×800px (portrait para elegancia)
- Galería: carrusel horizontal (mejor mobile)
- Edge Function convert-webp (automático, 80% compresión)

### Lecciones
- Especificar tamaños ANTES de code ahorra 30% tiempo
- Testing E2E simultáneo detecta bugs más rápido
- WebP reduce storage 85-92% (aprox)
```

---

### Regla 6: Variables Globales Reutilizables

**Globales (window.*):**
```javascript
window.supabase_client           // Cliente Supabase anon
window.supabase_admin            // Cliente Supabase admin (Edge Functions)
window.generateSlug()            // Slug generator
window.ErrorHandler              // Manejo de errores centralizado
window.ModalManager              // Modales globales
window.Validators                // Validaciones reutilizables
```

**Evitar:** Código duplicado. Si usas algo 2+ veces, crea helper en `shared.js`.

---

## 🔐 VARIABLES DE ENTORNO

**Archivo:** `.env.local` (NO commitear, agregar a .gitignore)

```
VITE_SUPABASE_URL=https://kfvjansfmhamkrnbxmgp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Archivo:** `.env.example` (compartir, templates)

```
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY]
```

---

## 🗄️ SUPABASE CONFIGURACIÓN

### Tablas Principales

```sql
obras
  ├── id (UUID, primary)
  ├── titulo (text, required)
  ├── slug (text, unique)
  ├── artista (text, required)
  ├── año (integer)
  ├── tecnica_id (FK → tecnicas)
  ├── descripcion (text)
  ├── estado (enum: borrador|publicado|archivado)
  ├── created_at (timestamp)
  └── updated_at (timestamp)

imagenes
  ├── id (UUID, primary)
  ├── obra_id (FK → obras)
  ├── url_storage (text)
  ├── tipo (enum: principal|adicional)
  ├── orden (integer)
  └── created_at (timestamp)

tecnicas
  ├── id (UUID, primary)
  ├── nombre (text, unique)
  └── slug (text, unique)

tags
  ├── id (UUID, primary)
  ├── nombre (text, unique)
  └── slug (text, unique)

obra_tags (junction table)
  ├── obra_id (FK → obras)
  └── tag_id (FK → tags)

usuarios_admin
  ├── id (UUID, primary, FK → auth.users)
  ├── email (text, unique)
  ├── rol (enum: admin|editor)
  ├── estado (enum: activo|inactivo)
  └── created_at (timestamp)
```

### Vista (para queries públicas)

```sql
obras_con_tags
  ├── id, titulo, slug, artista, año, tecnica_id, descripcion, estado
  ├── tags (JSON array)
  └── imagenes (JSON array)
```

### Storage Buckets

```
artworks/
  ├── obra_123_principal_xxx.webp
  ├── obra_123_adicional_xxx.webp
  └── [más imágenes]
```

---

## 🧪 TESTING

### Testing Manual (antes de cada commit)

**Admin:**
```
1. Login + MFA
2. Dashboard carga
3. Crear obra (CRUD completo)
4. Subir imágenes (múltiples)
5. Editar obra
6. Eliminar obra
7. CRUD técnicas
8. CRUD tags
9. CRUD usuarios
10. Password recovery
11. Logout
```

**Catálogo público (FASE 2+):**
```
1. Grid carga desde Supabase
2. Filtros funcionan (año, técnica, tags)
3. Búsqueda por título funciona
4. Click en obra → ficha
5. Galería carrusel funciona
6. Responsive: desktop, tablet, mobile
7. No hay errores en consola
```

**Testing E2E (admin ↔ catálogo):**
```
1. Admin crea obra → aparece en catálogo
2. Admin edita obra → cambios reflejados
3. Admin sube imagen → aparece en galería
4. Admin elimina obra → desaparece de catálogo
5. Admin publica obra → aparece en catálogo
6. Admin archiva obra → desaparece de catálogo
```

---

## 📤 FLUJO DE GIT

### Antes de abrir Claude

```bash
# Verificar estado actual
git status

# Si hay cambios pendientes
git add .
git commit -m "..."
git push

# Rama: siempre main (PRODUCTION)
git branch
# * main (debe estar aquí)
```

### Durante Claude Code

```bash
# Claude Code hace cambios automáticamente
# Tú verificas en navegador (F5 refresh)
```

### Después de Claude

```bash
# Verificar cambios
git status
git log --oneline -5

# Actualizar documentación
nano CLAUDE_WORKFLOW.md
nano INSTRUCCIONES-PROYECTO.md

# Commit final
git add .
git commit -m "FEAT: [Descripción]"
git push

# Verificar en GitHub
```

---

## 🔐 SEGURIDAD

### Frontend
- Validación de inputs (todos los formularios)
- Sanitización HTML (prevenir XSS)
- MFA obligatorio para admin

### Backend (Supabase RLS)
- Obras públicas: SELECT solo `estado='publicado'`
- Imágenes: SELECT público
- Usuarios: solo autenticados + admin role
- Storage: RLS por rol

### Edge Functions
- Validación de input
- Manejo de errores
- Rate limiting (futuro)

---

## 📞 REFERENCIAS

- **Repositorio:** https://github.com/egodiseno/catalogo-serigrafia-unam-fad
- **Rama:** main (PRODUCTION)
- **Deploy:** Netlify (automático en push a main)
- **Supabase:** kfvjansfmhamkrnbxmgp

---

## 📝 CHANGELOG

### v3.0 (2026-06-12)
- ✅ Admin completado al 100%
- ✅ MFA (TOTP) funcional
- ✅ Edge Functions en producción
- ⏳ Catálogo público en planificación
- 📝 Instrucciones mejoradas

### v2.1 (2026-06-07)
- ✅ Admin completado (CRUD, imágenes, usuarios)
- ✅ Recuperación de contraseña
- ✅ Edge Functions (create-admin-user, reset-user-password)

### v2.0 (2026-06-05)
- ✅ Refactorización JS completa
- ✅ Tokenización CSS
- ✅ Modernización visual

### v1.0 (2026-05-26)
- ✅ Normalización inicial

---

## ✅ CHECKLIST ANTES DE INICIAR NUEVO CHAT

- [ ] He leído este archivo completo
- [ ] He revisado CLAUDE_WORKFLOW.md (lecciones anteriores)
- [ ] Git status está limpio (sin cambios pendientes)
- [ ] He actualizado INSTRUCCIONES-PROYECTO.md con cambios
- [ ] Tengo mockup/especificaciones de la siguiente fase
- [ ] He identificado archivos que será necesario crear/modificar
- [ ] Tengo un prompt claro y estructurado

---

**ÚLTIMA ACTUALIZACIÓN:** 2026-06-12  
**RESPONSABLE:** Emmanuel (egodiseno)  
**ESTADO:** Proyecto en construcción activa ✅

---

# 📋 PROMPT PARA NUEVA FASE: CATÁLOGO PÚBLICO FUNCIONAL

## ⚠️ COPIAR Y PEGAR ESTO EN EL SIGUIENTE CHAT

```
# CATÁLOGO PÚBLICO FUNCIONAL — Integración con Admin

## CONTEXTO ACTUAL

**Estado:** Admin completamente funcional ✅
- CRUD obras (crear, editar, eliminar)
- Upload imágenes a Supabase Storage
- Tags asociados a obras
- Usuarios admin con MFA
- Base de datos real (Supabase Postgres)

**Stack:** HTML + CSS + JS vanilla + Supabase + Netlify + Lucide Icons

**Repositorio:** egodiseno/catalogo-serigrafia-unam-fad (rama main)

**Datos de prueba:** ~4-5 obras con imágenes en Supabase

---

## OBJETIVO

Crear **catálogo público funcional** que:
1. ✅ Se conecta a datos reales del admin (Supabase)
2. ✅ Muestra grid de obras con imágenes optimizadas
3. ✅ Ficha detalle por obra (slug-based)
4. ✅ Galería de imágenes (carrusel o grid)
5. ✅ Filtros funcionales (año, técnica, tags)
6. ✅ Búsqueda por título
7. ✅ Responsive (desktop, tablet, mobile)
8. ✅ Integración de formato WebP (Edge Function convert-webp)

**Requisito clave:** Cuando se crea/edita/elimina obra en admin → cambios reflejados INMEDIATAMENTE en público

---

## ESPECIFICACIONES A DEFINIR EN ESTE CHAT

### **Tamaños de Imagen**
Definir las dimensiones finales:
- [ ] Grid principal: ¿600×800px? ¿otro?
- [ ] Ficha detalle principal: ¿1200×1600px? ¿fullwidth?
- [ ] Galería adicional (carrusel): ¿800×1000px? ¿mismo que principal?
- [ ] Formato final: WebP (compresión 80%)
- [ ] Storage budget: máx 1.5 GB (para futuro crecimiento)

### **Arquitectura de Imágenes**
- [ ] ¿Carrusel horizontal o grid 2×2?
- [ ] ¿Lightbox al hacer click?
- [ ] ¿Transiciones suave?
- [ ] ¿Lazy loading en grid?

---

## ARQUITECTURA DE DATOS

\`\`\`
Supabase (origen de verdad)
├── obras (id, titulo, artista, año, tecnica_id, descripcion, estado, created_at)
├── imagenes (id, obra_id, url_storage, tipo: principal|adicional, orden)
├── tags (id, nombre, slug)
├── obra_tags (obra_id, tag_id)
└── tecnicas (id, nombre, slug)

app/index.html (catálogo público)
├── GET obras (filtradas por estado='publicado')
├── GET imagenes por obra_id
├── Renderizar grid
└── Renderizar ficha (slug-based)
\`\`\`

---

## FUNCIONALIDADES PÚBLICAS

### **Grid Catálogo**
- [ ] Mostrar obras en grid (imagen + título + artista + año + técnica + tags)
- [ ] Lazy load al scroll (cargar más obras)
- [ ] Mostrar contador: "Mostrando X de Y obras"
- [ ] Empty state si no hay resultados

### **Filtros**
- [ ] Año (dropdown dinámico desde DB)
- [ ] Técnica (dropdown dinámico desde DB)
- [ ] Tags (checkboxes dinámicos desde DB)
- [ ] Búsqueda por título (en tiempo real, debounce 300ms)
- [ ] Botón "Limpiar filtros"

### **Ficha de Obra (Detail Page)**
- [ ] URL slug-based: \`/obra/memoria-del-taller\`
- [ ] Imagen principal grande
- [ ] Información: título, artista, año, técnica, descripción, tags
- [ ] Galería imágenes adicionales (carrusel o grid)
- [ ] Link regreso al catálogo
- [ ] Breadcrumb: "Catálogo > Obra"

### **Galería Imágenes**
- [ ] Mostrar 3-4 imágenes adicionales por obra
- [ ] Carrusel horizontal con prev/next (Lucide icons)
- [ ] O grid 2×2 si hay 4+ imágenes
- [ ] Click → lightbox fullscreen

### **Responsive**
- [ ] Desktop (1440px+): grid 4 columnas
- [ ] Tablet (768px): grid 2 columnas
- [ ] Mobile (320px): grid 1 columna, stack vertical

---

## EDGE FUNCTION: convert-webp

**Crear automáticamente en este chat:**

\`\`\`typescript
Función: supabase/functions/convert-webp/index.ts

Input: { file, obra_id, type: 'principal'|'adicional' }
Output: { url, type, dimensions, sizeBefore, sizeAfter, compression }

Redimensionamiento:
- principal   → [TAMAÑO A DEFINIR]
- adicional   → [TAMAÑO A DEFINIR]

Conversión:
- JPG/PNG/TIFF → WebP (calidad 80%)
- Auto-center-crop si ratio diferente
- Validación: máx 10 MB, mín 400×400px

Storage:
- Bucket: artworks
- Nombre: obra_{id}_{type}_{timestamp}.webp
\`\`\`

---

## TESTING END-TO-END

**Plan de pruebas en este chat:**

\`\`\`
1. Catálogo público carga datos de Supabase ✅
2. Grid muestra 4-5 obras con imágenes ✅
3. Click en obra → ficha detalle ✅
4. Ficha muestra imagen principal + 3 adicionales ✅
5. Galería (carrusel) navega con prev/next ✅
6. Filtros funcionan (año, técnica, tags) ✅
7. Búsqueda por título funciona ✅
8. Responsive: desktop, tablet, mobile ✅

9. [INTEGRACIÓN] Admin crea obra nueva ✅
10. [INTEGRACIÓN] Obra aparece en catálogo público (sin refresh) ✅
11. [INTEGRACIÓN] Admin sube imagen → aparece en galería ✅
12. [INTEGRACIÓN] Admin edita obra → cambios reflejados ✅
13. [INTEGRACIÓN] Admin elimina obra → desaparece de catálogo ✅
\`\`\`

---

## ARCHIVOS A CREAR/MODIFICAR

\`\`\`
app/
├── index.html                      (catálogo principal)
├── css/styles.css                  (actualizar para ficha)
└── js/
    ├── public-catalog.js          (NUEVO - grid + filtros)
    ├── public-detail.js           (NUEVO - ficha de obra)
    ├── gallery.js                 (NUEVO - carrusel imágenes)
    └── shared.js                  (reutilizar - helpers)

supabase/
└── functions/
    └── convert-webp/              (NUEVA - convertir imágenes)
        └── index.ts
\`\`\`

---

## PALETA DE COLORES UNAM

\`\`\`
Azul institucional:   #013B75
Oro institucional:    #D9A500
Azul oscuro:          #002A55
Azul claro:           #EEF4FB
Gris texto:           #1F2937
Gris claro:           #F5F5F5
\`\`\`

---

## GIT WORKFLOW

Cada cambio significativo:
\`\`\`bash
git add .
git commit -m "FEAT: [descripción clara en imperativo]"
git push
\`\`\`

Ejemplo:
\`\`\`
FEAT: Grid catálogo conectado a Supabase
FEAT: Ficha de obra con slug dinámico
FEAT: Filtros funcionales (año, técnica, tags)
FEAT: Edge Function convert-webp integrada
FEAT: Testing E2E admin ↔ catálogo (TODOS los casos)
\`\`\`

---

## NOTAS IMPORTANTES

- **Lucide Icons:** Usar para todos los iconos (prev/next, filtros, etc)
- **Slug generation:** Reutilizar \`window.generateSlug()\` del admin
- **Caché:** Implementar caché local para filtros (técnicas, tags)
- **Real-time:** NO necesario ahora, pero preparar arquitectura para después
- **Accesibilidad:** WCAG AA (contraste, labels, navegación keyboard)

---

## CHECKLIST FINAL ANTES DE TERMINAR CHAT

- [ ] Grid catálogo funcional, conectado a Supabase
- [ ] Ficha de obra (slug-based) funcional
- [ ] Galería imágenes (carrusel) funcional
- [ ] Filtros: año, técnica, tags
- [ ] Búsqueda por título
- [ ] Edge Function convert-webp creada y testeada
- [ ] Responsive: desktop, tablet, mobile
- [ ] Testing E2E: admin → catálogo (13 casos)
- [ ] Todos los commits en GitHub
- [ ] Documentación actualizada

---

**ESTADO:** Listo para empezar
**VERSIÓN:** 1.0 (2026-06-12)
```

---

**FIN DEL DOCUMENTO**
