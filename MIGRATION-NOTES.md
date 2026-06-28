# Notas de Migración: VanillaJS → Next.js 14

Documentación de decisiones técnicas, problemas encontrados y aprendizajes
durante la migración del catálogo de serigrafía de HTML/JS estático a Next.js 14.

---

## Decisiones arquitectónicas

### 1. App Router, no Pages Router

Se eligió el App Router de Next.js 14 por tres razones:
- Server Components por defecto → menos JavaScript enviado al cliente
- Layouts anidados nativos (admin layout independiente del público)
- `generateMetadata` por ruta → OG tags dinámicos sin librerías adicionales

El Pages Router habría requerido `getServerSideProps` / `getStaticProps` en cada ruta
y no permitiría compartir layout de forma granular.

### 2. Route Groups para separar admin del catálogo

```
app/
├── (admin)/admin/   ← layout con sidebar, autenticación
│   ├── layout.jsx
│   └── obras/page.jsx
├── page.jsx         ← layout público (header + footer)
└── layout.jsx       ← root layout (html, head, fonts)
```

`(admin)` es un Route Group: el paréntesis no aparece en la URL.
El layout de admin incluye `SidebarNav` y `AdminHeader`; el root layout los oculta
via selector CSS en `styles/admin.css` (`.admin-layout .site-header { display: none }`).

### 3. Singleton Supabase client para Client Components

Un problema crítico de SSR con Supabase Auth es la creación de múltiples instancias
de `GoTrueClient` (una advertencia visible en consola).

**Solución:** `lib/supabase/client.js` exporta una instancia única:
```js
let _client;
export function createClient() {
  if (!_client) _client = createBrowserClient(URL, KEY);
  return _client;
}
```

Todos los Client Components importan `createClient` de este módulo y comparten instancia.

### 4. Autenticación: patrón crítico `.eq('email', user.email)`

La tabla `usuarios_admin` usa `email` como clave de búsqueda, **no** `id`.
El `id` de `auth.users` no coincide con el de `usuarios_admin` para usuarios legacy.

```js
// ✅ Correcto
const { data } = await supabase
  .from('usuarios_admin')
  .select('rol, nombre')
  .eq('email', user.email)
  .single();

// ❌ Incorrecto — causa RLS violations silenciosas
.eq('id', user.id)
```

**Excepción:** `obras.editor_id` sí es FK a `auth.users.id` (siempre fue UUID del auth).

### 5. CSS global, no CSS Modules

Se optó por CSS global (`styles/globals.css`, `styles/admin.css`) para mantener:
- La misma arquitectura de tokens (`--color-*`, `--space-*`) del sitio original
- Selectores de componentes reutilizables sin generar class names hasheados
- Facilidad de hacer grep sobre selectores existentes antes de añadir estilos

El CSS global tiene ~2000 líneas pero está estructurado con comentarios de sección.

### 6. JavaScript, no TypeScript

Se mantuvo JS (`.jsx`) en lugar de TS (`.tsx`) para:
- Reducir tiempo de iteración durante sprints de migración
- Evitar errores de tipo en imports de Supabase no tipados
- Mantener compatibilidad directa con el código JS del panel original

---

## Problemas encontrados y soluciones

### P1: Múltiples instancias de GoTrueClient

**Síntoma:** Warning en consola `Multiple GoTrueClient instances detected`.
**Causa:** Cada componente que importaba `createBrowserClient()` directamente creaba
una nueva instancia del cliente de Auth.
**Solución:** Singleton en `lib/supabase/client.js` con guard `if (!_client)`.

### P2: Hydration mismatch en `/registro`

**Síntoma:** Error de React `Hydration failed` en la página de auto-registro.
**Causa:** Un `<style>` inline generado en el servidor no coincidía con el del cliente.
**Solución:** Mover todos los estilos al archivo CSS global; eliminar `<style>` inline.

### P3: Route Groups no reemplazan el root layout

**Síntoma:** El `<Header>` del sitio público aparecía dentro del panel de admin.
**Causa:** `app/(admin)/layout.jsx` es un layout anidado que no reemplaza `app/layout.jsx`.
**Solución:** En `styles/admin.css` se oculta el header/footer público cuando el body
tiene la clase `.admin-layout` (inyectada por `app/(admin)/layout.jsx`):
```css
.admin-layout .site-header,
.admin-layout .site-footer { display: none; }
```

### P4: Dashboard del editor mostraba 0 obras

**Síntoma:** Editor con obras propias veía contador "0 obras".
**Causa:** La query filtraba por `artista` (nombre) pero la columna correcta es `editor_id`
(UUID de auth.users) para identificar al autor.
**Solución:** `obras.eq('editor_id', authUser.id)` en el dashboard del editor.

### P5: `export const revalidate` en Client Component

**Síntoma:** Warning de Next.js — `revalidate` no tiene efecto en Client Components.
**Causa:** `app/page.jsx` tenía `'use client'` al inicio, lo que impide exportar `revalidate`.
**Solución (Sprint 5):** Extraer toda la lógica interactiva a `CatalogPageClient.jsx`
y convertir `app/page.jsx` en un Server Component que solo renderiza el client:
```js
export const revalidate = 60; // funciona en Server Component
export default function CatalogPage() {
  return <CatalogPageClient />;
}
```

### P6: Playwright con AV en Windows

**Síntoma:** Playwright descargaba Chromium al 100% pero la extracción de `chrome.dll`
(240 MB) se quedaba colgada indefinidamente.
**Causa:** AVG Antivirus escaneaba el archivo en tiempo real durante la extracción.
**Solución:** Usar Microsoft Edge del sistema con `executablePath` en `playwright.config.ts`:
```ts
executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
```

### P7: IDs duplicados `#searchInput`

**Síntoma:** Tests de Playwright fallaban con `strict mode violation` — 2 elementos.
**Causa:** Tanto `Header.jsx` como `CatalogPageClient.jsx` usaban `id="searchInput"`.
**Solución:** En los tests, usar selector más específico:
```ts
page.locator('.filter-search input[type="search"]')
```

---

## Componentes reutilizables creados

| Componente | Ubicación | Descripción |
|---|---|---|
| `ObraForm` | `components/admin/ObraForm.jsx` | Modal crear/editar obras con upload de imágenes |
| `ImageUpload` | `components/admin/ImageUpload.jsx` | Uploader multi-imagen con convert-webp y progress |
| `DiffModal` | `components/admin/DiffModal.jsx` | Diff viewer para revisión de reaperturas |
| `ConfirmModal` | `components/admin/ConfirmModal.jsx` | Modal de confirmación reutilizable |
| `SidebarNav` | `components/admin/SidebarNav.jsx` | Navegación lateral dinámica según rol |
| `AdminHeader` | `components/admin/AdminHeader.jsx` | Header admin con breadcrumb dinámico |
| `ArtworkCard` | `components/public/ArtworkCard.jsx` | Tarjeta de obra para el grid del catálogo |
| `WorkGallery` | `components/public/WorkGallery.jsx` | Galería con lightbox, swipe y favorito |
| `CatalogPageClient` | `components/public/CatalogPageClient.jsx` | Lógica completa del catálogo (filtros, grid, paginación) |

---

## Hooks personalizados

| Hook | Propósito |
|---|---|
| `useRealtimeWorks` | Suscripción Supabase Realtime a cambios en `obras` |
| `useRealtimeTecnicas` | Suscripción Realtime a cambios en `tecnicas` |
| `useFavorite` | Toggle de favorito para una obra específica |
| `usePermisos` | Verifica permisos del usuario actual según su rol |

---

## Aprendizajes clave del proceso de migración

1. **Sprints pequeños funcionan mejor** — prompts de 2000+ líneas generaban más errores
   y contexto difícil de rastrear. Sprints de ~200 líneas permitieron verificación incremental.

2. **Grep de CSS antes de añadir clases** — añadir clases CSS sin verificar que existen
   causaba componentes sin estilo. Protocolo: `grep -n "clase" styles/globals.css` antes.

3. **Server Components reducen hydration issues** — componentes que no necesitan estado
   o efectos del cliente se benefician del render en servidor; el HTML inicial es más estable.

4. **React cache() es transparente** — llamar la misma función cacheada en `generateMetadata`
   y en el componente de página no hace dos peticiones a Supabase; la segunda devuelve el
   resultado en memoria de la misma request.

5. **`dynamicParams = true` es necesario para ISR de detalle** — sin él, los slugs no
   pre-generados en build devolverían 404 en lugar de renderizarse on-demand.

---

## Configuración de entorno requerida

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # solo en SSR/API routes

# PWA
NEXT_PUBLIC_SITE_URL=https://<dominio>

# On-Demand Revalidation (opcional pero recomendado)
REVALIDATE_SECRET=<secreto-random>
```
