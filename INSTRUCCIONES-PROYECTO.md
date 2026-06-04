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

### 🚀 FASE 1: ADMIN FUNCIONAL (2 sesiones)

**Objetivo:** Sistema admin real para alimentar el catálogo

**Dependencia:** FASE 0 (Supabase setup)

**Tareas:**
1. **Login:** 
   - Formulario email/password
   - Supabase Auth (sign up deshabilitado)
   - Redirect a dashboard si autenticado

2. **Dashboard:** 
   - Métricas: total obras, últimas subidas, total técnicas
   - Gráfico simple (obras por técnica)

3. **Listado obras:** 
   - Tabla con: titulo, artista, año, técnica, estado
   - Filtros: año, técnica, estado
   - Búsqueda por título
   - Botones editar/eliminar por fila

4. **Crear obra:**
   - Formulario: título, artista, año, descripción, técnica, tags, estado
   - Upload imagen (Supabase Storage)
   - Preview de imagen
   - Guardar → Supabase
   - Feedback (éxito/error)

5. **Editar obra:**
   - Cargar datos existentes
   - Modificar campos
   - Cambiar imagen si aplica
   - Guardar → Supabase

6. **Eliminar obra:**
   - Confirmación modal
   - Eliminar imagen también
   - Actualizar DB

7. **Gestión técnicas** (CRUD simple):
   - Listar técnicas
   - Crear nueva
   - Editar
   - Eliminar

8. **Gestión tags** (CRUD simple):
   - Listar tags
   - Crear nuevo
   - Editar
   - Eliminar

**Patrón reutilizable:** 
```
Formulario → Validación → Supabase → Actualizar UI → Feedback
```

**No hacer:** Dashboard complejo, reportes, etc. Mínimo funcional.

**Archivo:** app/admin/index.html (nuevo inicio admin)

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
