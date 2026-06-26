# PLAN DE MIGRACIÓN — Next.js
## Catálogo Digital de Obra Serigráfica UNAM/FAD

**Versión:** 2.0 (completo y ejecutable)
**Fecha:** 26 junio 2026
**Estado:** Documentado — listo para ejecutar en sesión dedicada
**Baseline:** Versión VanillaJS 100% funcional en producción (commit documentado)

---

## Por qué migrar

La razón principal es técnica y tiene impacto visual inmediato: **meta tags dinámicos para Open Graph**.

Cuando alguien comparte una obra en WhatsApp, Twitter o cualquier red social, el bot de la plataforma hace una petición HTTP al servidor **antes de que JavaScript ejecute**. Con VanillaJS los meta tags `og:image`, `og:title` y `og:description` se generan en el cliente — el bot nunca los ve. El resultado es un link compartido sin imagen ni título de la obra.

Next.js resuelve esto con SSR: cuando alguien visita `/obra/viverra`, el servidor genera el HTML completo — incluyendo los meta tags con la imagen real de esa obra — antes de enviarlo al browser o al bot de WhatsApp.

Lo demás que viene de gracia:
- URLs limpias (`/obra/viverra` en lugar de `/obra.html?slug=viverra`)
- SEO profesional completo con JSON-LD
- Optimización automática de imágenes sin Edge Functions custom
- Preparación para servidores UNAM en el futuro
- Base para TypeScript, testing E2E y PWA

---

## Lo que NO cambia

| Capa | Estado |
|------|--------|
| Supabase (DB, Auth, Storage, Edge Functions) | Sin cambios |
| GitHub (repositorio, rama main) | Sin cambios |
| Netlify (deploy automático) | Sin cambios — soporta Next.js nativamente |
| Colores y diseño UNAM | Sin cambios — mismos tokens CSS |
| Lógica de negocio (RLS, flujo de estados, roles) | Sin cambios — vive en Supabase |
| Brevo (emails transaccionales) | Sin cambios |
| Edge Functions ya desplegadas | Sin cambios |
| Bucket `artworks` y URLs de imágenes | Sin cambios |

---

## Stack Next.js propuesto

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Framework | Next.js 14+ App Router | SSR nativo, `generateMetadata` para OG tags |
| Lenguaje | JavaScript (TypeScript en fase posterior) | Agilizar migración |
| Estilos | CSS global — mismos tokens de diseño actuales | Cero re-trabajo visual |
| Base de datos | Supabase JS v2 (misma librería) | Sin cambios en queries |
| Deploy | Netlify con adaptador Next.js | Sin cambios de infraestructura |
| Iconos | Lucide React (reemplaza Lucide CDN) | Integración nativa con React |
| Imágenes | next/image | Reemplaza Edge Function convert-webp |

---

## Nuevas capacidades que VanillaJS no puede hacer

### 1. SEO profesional completo

- Meta tags dinámicos por obra (OG + Twitter Card con imagen real de esa obra)
- `sitemap.xml` generado automáticamente desde la DB — cada obra publicada aparece en Google sin intervención manual
- JSON-LD Schema.org — datos estructurados que permiten a Google mostrar la imagen, título y artista directamente en los resultados de búsqueda
- URLs canónicas automáticas
- `hreflang` para ES/EN — Google indexa las dos versiones por separado

### 2. Optimización de imágenes automática con next/image

**Importante: next/image NO impacta Supabase Storage.**
Las versiones redimensionadas se cachean en el CDN de Netlify, no en el bucket `artworks`. Los archivos originales no se duplican. Impacto en storage: cero.

Lo que hace automáticamente:
- Convierte a WebP según el browser (reemplaza la Edge Function `convert-webp`)
- Genera versiones para cada tamaño de pantalla (responsive images)
- Blur placeholder mientras la imagen carga — efecto premium muy visible
- Lazy loading nativo sin código extra

### 3. Rendering híbrido — la diferencia técnica central

| Página | Estrategia | Resultado |
|--------|-----------|-----------|
| Catálogo `/` | ISR — regenera automáticamente | Carga instantánea, siempre actualizado |
| Obra `/obra/[slug]` | SSR — genera en tiempo real | OG tags con imagen real, SEO perfecto |
| Técnicas `/tecnicas` | SSG — completamente estático | Máxima velocidad, sin query a DB |
| Admin `/admin/*` | Client-side | Sin cambios vs ahora |

ISR (Incremental Static Regeneration): el catálogo se pre-genera como página estática — carga en milisegundos — pero se actualiza automáticamente en segundo plano cuando hay obras nuevas publicadas.

### 4. i18n con routing real

En lugar del toggle ES/EN actual (que cambia texto en el mismo URL):
- `/es/catalogo` y `/en/catalog` — URLs diferentes por idioma
- Google indexa ambas versiones por separado
- `hreflang` automático
- Estándar de cualquier sitio institucional profesional

### 5. Real-time en el admin

Supabase tiene websockets nativos. Con React:
- Badge animado en "Pendientes de Revisión" que se actualiza sin recargar
- Notificación instantánea cuando un editor sube una obra nueva
- En VanillaJS esto requeriría código complejo; en Next.js + React son ~10 líneas

### 6. Middleware de autenticación

En lugar de verificar el login en cada módulo JS del admin, Next.js protege a nivel de servidor: si no estás autenticado, el servidor devuelve redirect al login antes de que el browser cargue cualquier recurso. Más seguro y más limpio.

### 7. Búsqueda full-text

PostgreSQL ya tiene búsqueda de texto completo nativa en Supabase. Con Next.js es trivial exponerla:
- Buscar por título, artista, descripción y tags simultáneamente
- Actualmente la búsqueda solo filtra por título

### 8. PWA (Progressive Web App)

El catálogo se puede instalar en el celular como una app:
- Icono de UNAM/FAD en el home screen del visitante
- Carga offline de páginas ya visitadas
- El `manifest.json` ya existe en el proyecto — solo falta el service worker

### 9. Compartir obra nativo en iOS/Android

Con SSR y OG tags correctos, el botón nativo de "Compartir" de iOS y Android usa automáticamente la imagen y el título de la obra en la preview. Actualmente solo comparte el URL.

---

## Consideraciones de escalabilidad y storage

### Dos espacios separados (no confundir)

| Espacio | Qué guarda | Límite free tier | Estado actual |
|---------|-----------|-----------------|---------------|
| Database disk | Filas, índices, texto | 500 MB usables | ~30 MB (6%) |
| Supabase Storage | Archivos de imagen bucket `artworks` | 1 GB | Creciendo con obras |

La base de datos no es el cuello de botella — 500 MB de texto alcanza para decenas de miles de obras. El límite real es Storage.

### Capacidad estimada con 4 imágenes por obra (WebP optimizado)

| Peso promedio por imagen | Total por obra (4 imgs) | Obras en 1 GB |
|--------------------------|------------------------|---------------|
| 150 KB (WebP bien optimizado) | 600 KB/obra | ~1,700 obras |
| 250 KB (promedio realista) | 1 MB/obra | ~1,000 obras |
| 400 KB (alta resolución) | 1.6 MB/obra | ~625 obras |

**Estimado conservador: entre 700 y 1,000 obras** antes de necesitar escalar.

### Cuándo escalar

Supabase Pro: $25/mes → 100 GB Storage → capacidad para ~60,000-100,000 obras con 4 imágenes. No es urgente ahora. Cuando el proyecto migre a servidores UNAM, el storage puede moverse también.

---

## Estructura de carpetas Next.js

```
catalogo-serigrafia-unam-fad/
├── app/
│   ├── layout.jsx                  # Layout global (header, footer, i18n provider)
│   ├── page.jsx                    # Catálogo público — grid, filtros, favoritos, paginación
│   ├── obra/
│   │   └── [slug]/
│   │       └── page.jsx            # SSR — OG tags dinámicos con imagen real de la obra
│   ├── tecnicas/
│   │   └── page.jsx
│   ├── creditos/
│   │   └── page.jsx
│   ├── registro/
│   │   └── page.jsx
│   └── admin/
│       ├── layout.jsx              # Auth guard a nivel servidor
│       ├── page.jsx                # Dashboard + login
│       ├── obras/page.jsx
│       ├── tecnicas/page.jsx
│       ├── tags/page.jsx
│       ├── usuarios/page.jsx
│       ├── estadisticas/page.jsx
│       ├── registros/page.jsx
│       └── configuracion/page.jsx
├── components/
│   ├── public/
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   ├── ArtworkCard.jsx
│   │   ├── ArtworkGrid.jsx
│   │   ├── FilterBar.jsx
│   │   ├── Gallery.jsx
│   │   └── FavButton.jsx
│   └── admin/
│       ├── Sidebar.jsx
│       ├── StatCard.jsx
│       ├── ObraForm.jsx
│       ├── ImageUpload.jsx
│       └── ConfirmModal.jsx
├── lib/
│   ├── supabase/
│   │   ├── client.js               # Cliente Supabase para el browser
│   │   └── server.js               # Cliente Supabase para SSR (cookies)
│   ├── i18n.js                     # Sistema de traducción adaptado a React context
│   └── api.js                      # Helpers de fetching (reemplaza api-client.js)
├── styles/
│   ├── globals.css                 # Mismos tokens CSS actuales
│   └── admin.css                   # Mismo admin.css actual
├── public/
│   └── og-default.png              # Imagen OG genérica (ya existe)
├── supabase/                       # Sin cambios
│   ├── config.toml
│   ├── functions/
│   └── migrations/
├── next.config.js
├── package.json
└── netlify.toml                    # Actualizado para builds Next.js
```

---

## Mapeo de módulos VanillaJS → React

| Módulo actual | Equivalente Next.js |
|--------------|---------------------|
| `public-catalog.js` | `components/public/ArtworkGrid.jsx` + `FilterBar.jsx` |
| `public-detail.js` | `app/obra/[slug]/page.jsx` (SSR) + `components/public/Gallery.jsx` |
| `public-techniques.js` | `app/tecnicas/page.jsx` |
| `public-creditos.js` | `app/creditos/page.jsx` |
| `public-footer.js` | `components/public/Footer.jsx` |
| `api-client.js` | `lib/api.js` + `lib/supabase/client.js` |
| `i18n.js` | `lib/i18n.js` con React Context |
| `auth.js` | `app/admin/layout.jsx` + Supabase Auth helpers |
| `config.js` | `lib/supabase/client.js` + `lib/supabase/server.js` |
| `dashboard.js` | `app/admin/page.jsx` + `components/admin/StatCard.jsx` |
| `obras-list.js` | `app/admin/obras/page.jsx` |
| `obras-form.js` | `components/admin/ObraForm.jsx` |
| `storage.js` + `convert-webp` Edge Function | `next/image` (reemplaza ambos) |
| `error-handler.js` + `toast-notifications.js` | Componente Toast con React state |
| `confirm-modal.js` | `components/admin/ConfirmModal.jsx` |
| `permisos.js` | Custom hook `usePermisos()` |
| `password-recovery.js` | Página dedicada + misma Edge Function (sin cambios) |

---

## Plan de ejecución por fases

### Fase 0 — Setup (1 sesión)

**Objetivo:** Proyecto Next.js funcional vacío en Netlify, sin tocar main.

- Crear rama `nextjs-migration` desde `main`
- Inicializar Next.js 14 con App Router
- Configurar `netlify.toml` para builds Next.js
- Conectar Supabase (client para browser + server para SSR)
- Migrar tokens CSS globales a `styles/globals.css`
- Verificar deploy vacío en Netlify desde la rama nueva
- **Main no se toca — VanillaJS sigue en producción**

### Fase 1 — Catálogo público (2 sesiones)

**Sesión 1A:**
- Layout global: header, footer, i18n provider
- `app/page.jsx`: grid de obras con filtros, paginación, infinite scroll
- `components/public/ArtworkCard.jsx` con `next/image`
- Sistema de favoritos (misma lógica, adaptada a React)

**Sesión 1B:**
- `app/obra/[slug]/page.jsx` con SSR y `generateMetadata` — el objetivo principal
- Gallery + lightbox + counter + swipe
- `app/tecnicas/page.jsx`
- `app/creditos/page.jsx`
- `app/registro/page.jsx`
- Verificar que OG tags dinámicos funcionan (probar con WhatsApp Web o Twitter Card Validator)

### Fase 2 — Admin panel (4 sesiones)

**Sesión 2A:** Login + MFA + auth middleware + Dashboard
**Sesión 2B:** Gestión de obras — tabla, form, upload imágenes, diff modal, aprobación
**Sesión 2C:** Técnicas, Tags, Usuarios, Registros pendientes, Historial alumnos
**Sesión 2D:** Estadísticas, Logs de auditoría, Configuración, Redes sociales, Control de registro, Mi Perfil, Mi Portafolio (rol editor)

### Fase 3 — Features premium (2 sesiones)

**Sesión 3A:**
- Búsqueda full-text (título + artista + descripción + tags)
- Real-time en admin (badges de pendientes en vivo)
- i18n con routing `/es/` y `/en/`

**Sesión 3B:**
- PWA: service worker + instalación en móvil
- Playwright E2E: 10-15 pruebas sobre flujos críticos
- Lighthouse audit: ajustes para 95+ en performance

### Fase 4 — Testing y migración a main (1 sesión)

- Testing E2E completo (admin crea → catálogo refleja en tiempo real)
- Configurar redirects en Netlify: `/obra.html?slug=X` → `/obra/X` (preservar SEO)
- Merge `nextjs-migration` → `main`
- Verificar deploy final
- Actualizar documentación y `CLAUDE.md`

---

## Valor para portafolio

Lo que diferencia este proyecto a ojos de un entrevistador técnico:

| Elemento | Por qué importa |
|----------|----------------|
| SSR con `generateMetadata` | Demuestra comprensión de rendering strategies — no solo CRUD |
| Arquitectura documentada en `CLAUDE.md` | Un developer nuevo puede entrar al repo y entender todo en 30 min — rarísimo en proyectos personales |
| TypeScript (fase posterior) | Señal de madurez técnica inmediatamente visible |
| Playwright E2E | 10 tests sobre flujos críticos valen más que 100 unit tests de utils |
| Lighthouse 95+ | Métrica medible y mostrable — captura de pantalla en el README |
| Real-time con Supabase Realtime | El "wow técnico" más visible durante una demo |
| PWA instalable | Impacto institucional — el logo UNAM/FAD en el home screen |
| Multi-rol con RLS | Demuestra comprensión de seguridad a nivel de base de datos, no solo frontend |

---

## Prerrequisitos antes de iniciar Fase 0

- [ ] Versión VanillaJS documentada y commitada (`ESTADO-VANILLA-JS-FINAL.md`)
- [ ] Node.js instalado localmente — verificar con `node --version` en terminal (necesario v18+)
- [ ] Confirmar que Netlify del proyecto permite builds con comando (actualmente está sin build command — necesitará `next build`)
- [ ] Abrir la migración en sesión dedicada — no mezclar con fixes del VanillaJS
- [ ] Tener el plan presente al inicio de esa sesión

---

## Estimación total

| Fase | Sesiones | Contenido |
|------|----------|-----------|
| 0 — Setup | 1 | Proyecto vacío funcional en Netlify |
| 1 — Catálogo público | 2 | Grid, obra SSR, técnicas, registro |
| 2 — Admin panel | 4 | Login, obras, usuarios, config |
| 3 — Features premium | 2 | PWA, E2E, búsqueda full-text, real-time |
| 4 — Testing y merge | 1 | Deploy final, redirects, documentación |
| **Total** | **~10 sesiones** | |

---

## Nota sobre migración futura a servidores UNAM

Next.js es portable. Cuando el proyecto migre a infraestructura UNAM:
- Se despliega como contenedor Docker con `next build` + `next start`
- Supabase puede seguir siendo el backend, o migrar a PostgreSQL propio de la UNAM
- Los datos no se tocan — la migración de infraestructura es completamente independiente del frontend
- Netlify puede coexistir como CDN mientras se configura el servidor UNAM, permitiendo una transición sin downtime

---

**ÚLTIMA ACTUALIZACIÓN:** 26 junio 2026
**RESPONSABLE:** Emmanuel (egodiseno)
**SIGUIENTE PASO:** Ejecutar Fase 0 en sesión nueva dedicada — confirmar Node.js instalado primero
