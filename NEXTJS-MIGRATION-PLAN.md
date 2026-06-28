# PLAN DE MIGRACIÓN — Next.js
## Catálogo Digital de Obra Serigráfica UNAM/FAD

**Versión:** 2.1 (en ejecución)
**Fecha:** 26 junio 2026
**Actualizado:** 26 junio 2026
**Estado:** Fases 0, 1A, 1B y 1C completadas — catálogo público funcional en `nextjs-migration`
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

### ✅ Fase 0 — Setup

**Objetivo:** Proyecto Next.js funcional vacío en Netlify, sin tocar main.

- ✅ Crear rama `nextjs-migration` desde `main`
- ✅ Inicializar Next.js 14 con App Router
- ✅ Configurar `netlify.toml` para builds Next.js
- ✅ Conectar Supabase (client para browser + server para SSR)
- ✅ Migrar tokens CSS globales a `styles/globals.css`
- ✅ Verificar deploy vacío en Netlify desde la rama nueva
- **Main no se toca — VanillaJS sigue en producción**

**Commit:** `9908324` — `FEAT: Fase 0 — setup inicial Next.js en rama nextjs-migration`

---

### ✅ Fase 1 — Catálogo público

#### ✅ Sesión 1A
- ✅ Layout global: header, footer, i18n provider (`LangContext`)
- ✅ `app/page.jsx`: grid de obras con filtros, búsqueda, paginación desktop / infinite scroll mobile
- ✅ `components/public/ArtworkCard.jsx`
- ✅ Sistema de favoritos con Supabase (`obra_favoritos`, `session_id`)
- ✅ `FilterBar`, `ArtworkGrid`, `useFavorite` hook

**Commits:**
- `6f262e6` — `FEAT: Fase 1A — catálogo público grid, filtros y paginación`
- `dfc4dd1` — `FIX: alinear botones de filtros en misma fila que los selects`

#### ✅ Sesión 1B
- ✅ `app/obra/[slug]/page.jsx` con SSR y `generateMetadata` — OG tags dinámicos con imagen real
- ✅ `WorkGallery` (carousel, lightbox, swipe, teclado, image counter)
- ✅ `WorkShare` (WhatsApp, Email, SMS, copy link)
- ✅ `RelatedWorks` (misma técnica, prioriza tags comunes)
- ✅ `VisitRecorder` (fire-and-forget INSERT en `obra_visitas`)
- ✅ `useFavorite` hook con optimistic update

**Commits:**
- `7d74844` — `FEAT: Fase 1B — obra/[slug] con SSR y OG tags dinámicos`
- `c878351` — `FIX: eliminar page.js duplicado, corregir viewport export, limpiar caché .next`

#### ✅ Sesión 1C
- ✅ `app/tecnicas/page.jsx` (SSR) + `TechniquesClient` (selección, obras bajo demanda, cargar más)
- ✅ `app/creditos/page.jsx` (SSR) + `CreditosAcerca` (bilingüe via `useLang`)
- ✅ `app/registro/page.jsx` (Client Component, pantallas loading/cerrada/abierta, toasts, validación)
- ✅ `app/not-found.jsx` (404 personalizada con estilos en globals.css)
- ✅ `app/registro/layout.jsx` — layout standalone, oculta header/footer globales vía CSS
- ✅ CSS de registro movido a `globals.css` (sección `=== Registro público ===`)
- ✅ Singleton Supabase client (`lib/supabase/client.js`) — evita múltiples instancias `GoTrueClient`
- ✅ Patrón `mounted` en registro — elimina hydration mismatch por `new Date()` en SSR

**Commits:**
- `8b631fe` — `FEAT: Fase 1C — técnicas, créditos, registro y 404`
- `420b161` — `FIX: hydration error en registro y singleton Supabase client`
- `1c894bf` — `FIX: mover estilos de registro a globals.css — eliminar hydration error`
- `c4f3a6c` — `FIX: layout standalone para /registro sin header ni footer`
- `bc64391` — `FIX: registro pantalla completa 100vh con card centrada`

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

## Lecciones aprendidas (Fases 0 – 1C)

Errores encontrados en ejecución que el plan original no anticipaba. Registrados para no repetirlos en Fase 2.

### 1. Patrón singleton obligatorio para el cliente Supabase

`@supabase/supabase-js` y `@supabase/ssr` cada uno crean una instancia de `GoTrueClient` internamente. Si se llama a `createClient()` o `createBrowserClient()` más de una vez en el mismo proceso del browser, Next.js emite el warning `Multiple GoTrueClient instances detected` y el comportamiento de sesión se vuelve impredecible.

**Regla:** todo archivo que exporte un cliente Supabase para el browser debe usar el patrón de módulo singleton:

```js
let _client = null;
export function createClient() {
  if (!_client) _client = createBrowserClient(URL, ANON_KEY);
  return _client;
}
```

Cualquier componente que necesite el cliente lo importa de un solo lugar — nunca instancia directamente.

---

### 2. Estilos nunca inyectados con tag `<style>` en componentes

Inyectar un `<style>` dentro de un Client Component (`'use client'`) provoca hydration mismatch: el servidor emite el tag con el CSS, React intenta reconciliarlo con el DOM del cliente y falla si hay cualquier diferencia de timing o contenido.

**Regla:** todos los estilos van en `styles/globals.css` (o en un `.css` module). Los estilos específicos de una sola página se añaden al final de `globals.css` bajo una sección comentada (`/* === Nombre de página === */`). Ningún componente inyecta un `<style>` dinámico.

Excepción permitida: `<style>` en un **Server Component** (sin `'use client'`) es seguro porque el HTML se emite una sola vez desde el servidor — Next.js no necesita reconciliarlo.

---

### 3. Layouts anidados en Next.js App Router no reemplazan el root layout

Un archivo `app/ruta/layout.jsx` se renderiza **dentro** del slot `{children}` del layout raíz (`app/layout.jsx`), no en su lugar. El `<Header>` y el `<Footer>` del layout raíz siempre montan, independientemente de si la sub-ruta tiene su propio layout.

Para ocultar el header/footer en una ruta específica sin tocar `app/layout.jsx`:

```jsx
// app/registro/layout.jsx (Server Component)
export default function RegistroLayout({ children }) {
  return (
    <>
      <style>{`.site-header, .site-footer { display: none !important; }`}</style>
      {children}
    </>
  );
}
```

La alternativa limpia —y la correcta para proyectos con varias rutas standalone— son los **Route Groups** con paréntesis (`app/(main)/layout.jsx`), que permiten agrupar páginas bajo un layout compartido sin afectar la URL. Requiere mover archivos pero no toca el root layout.

---

### 4. Limpiar `.next` al cambiar de rama o después de conflictos de caché

El directorio `.next/` almacena la caché de compilación de Next.js. Cuando se cambia de rama o se modifica `next.config.js`, la caché puede tener artefactos del estado anterior que generan errores oscuros en runtime que no se reproducen en un build limpio.

**Cuando limpiar obligatoriamente:**
- Al hacer `git checkout` a otra rama con diferente configuración
- Después de resolver conflictos de merge que tocaron archivos de configuración
- Cuando aparecen errores de módulo no encontrado que contradicen lo que hay en disco
- Antes de hacer `npm run build` para un deploy final

```bash
# PowerShell
Remove-Item -Recurse -Force .next

# Bash
rm -rf .next
```

Después de limpiar, `npm run dev` o `npm run build` reconstruyen la caché desde cero.

---

**ÚLTIMA ACTUALIZACIÓN:** 26 junio 2026
**RESPONSABLE:** Emmanuel (egodiseno)
**SIGUIENTE PASO:** Fase 2A — Login + MFA + auth middleware + Dashboard admin
