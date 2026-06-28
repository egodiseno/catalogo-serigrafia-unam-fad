# CHANGELOG — Catálogo de Obra Serigráfica

## [2.0.0] — 2026-06-28

### Migración completada: VanillaJS → Next.js 14 App Router

Esta versión reemplaza completamente la implementación anterior basada en HTML estático
+ JavaScript vanilla con una aplicación Next.js 14 de producción.

---

### ✅ Funcionalidades implementadas

#### Catálogo público
- Catálogo de obras con grid responsivo (8/página desktop, 12/página mobile)
- Filtros por año, técnica y tags con popover de checkboxes
- Búsqueda full-text (FTS) via Supabase Edge Function `search-obras` (debounce 400 ms)
- Paginación desktop con rango de páginas + ellipsis
- Infinite scroll mobile con IntersectionObserver
- Sistema de favoritos anónimos (session_id en localStorage, persistencia en Supabase)
- OG tags dinámicos por obra (título, descripción, imagen principal)
- Internacionalización ES/EN (`LangContext`)
- Real-time updates: obras nuevas, modificadas y eliminadas reflejan sin recargar

#### Panel de administración (22 rutas)
- Login con MFA TOTP (verificación de segundo factor)
- Dashboard con estadísticas animadas, top visitas del mes y alertas de revisión pendiente
- Gestión de obras: crear, editar, publicar, archivar, aprobar/rechazar reaperturas
- Diff modal para visualizar cambios antes de aprobar una reapertura
- Gestión de técnicas y tags (CRUD completo)
- Gestión de usuarios: CRUD, CSV import/export, eliminación batch
- Registros de alumnos: cola de validación, aprobar/rechazar
- Control de registro: abrir/cerrar ventana de inscripción
- Historial de alumnos completo con paginación
- Logs de auditoría con filtros por usuario, acción y fecha
- Estadísticas de visitas: historial completo con scroll infinito y orden ASC/DESC
- Configuración: texto "Acerca de" bilingüe, créditos, redes sociales
- Mi Perfil: cambio de contraseña, enroll MFA
- Mi Portafolio (rol `editor`): gestión de obras propias, flujo de reapertura

#### Infraestructura
- **ISR**: catálogo revalidado cada 60 s; páginas de detalle cada 3600 s
- **On-Demand Revalidation**: endpoint `POST /api/revalidate` para webhooks de Supabase
- **React cache()**: queries de Server Components sin peticiones duplicadas
- **next/image**: imágenes optimizadas con AVIF/WebP, `fill` con `sizes` por breakpoint
- **next/font**: Inter y Lora cargadas localmente (sin round-trip a Google Fonts)
- **Code splitting**: modales pesados de admin (`ObraForm`, `DiffModal`) con `dynamic()`
- **PWA**: Service Worker, manifest.json, soporte offline con fallback page
- **Suite E2E**: 21 tests con Playwright (catálogo, responsive, accesibilidad, admin)
- **CI/CD**: GitHub Actions workflow para E2E en pushes a `nextjs-migration` y PRs a `main`

---

### 📦 Dependencias principales

| Dependencia | Versión | Propósito |
|---|---|---|
| `next` | 14.2.35 | Framework |
| `react` / `react-dom` | 18.x | UI |
| `@supabase/supabase-js` | 2.x | Supabase client |
| `@supabase/ssr` | latest | Auth en Server/Client Components |
| `lucide-react` | latest | Iconografía |
| `papaparse` | latest | Import/Export CSV de usuarios |
| `@playwright/test` | 1.48.2 | Suite de tests E2E |

---

### ⚠️ Breaking changes

- Rutas servidas por Next.js App Router (no `/pages/`).
- Middleware de autenticación integrado en `middleware.js` (protege `/admin/*`).
- CSS global en `styles/globals.css` y `styles/admin.css` (no CSS Modules).
- Variables de entorno requeridas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Variable opcional: `REVALIDATE_SECRET` (para webhook de Supabase On-Demand Revalidation).

---

### 📊 Performance (build de producción)

| Métrica | Valor |
|---|---|
| Build time | ~60 s |
| First Load JS (shared) | 87.4 KB |
| Catálogo `/` | Static prerendered (ISR 60 s) |
| Detalle `/obra/[slug]` | Dynamic SSR (ISR 3600 s) |
| Lighthouse Performance (estimado) | 90+ |
| Core Web Vitals LCP | < 2.5 s |
| Core Web Vitals CLS | < 0.1 |

---

## [1.x.x] — Versión anterior (VanillaJS)

Implementación basada en HTML estático + JavaScript vanilla, servida directamente desde Netlify
sin servidor de aplicación. Ver rama `main` anterior al merge de `nextjs-migration`.
