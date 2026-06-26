# ESTADO — Versión VanillaJS Final

**Fecha de cierre:** 26 de junio de 2026
**Estado:** ✅ Baseline completo — pre-migración a Next.js

---

## Descripción

Este documento registra el estado final de la versión VanillaJS del
**Catálogo Digital de Obra Serigráfica — UNAM / FAD / Taller de Serigrafía**
antes de iniciar la migración a Next.js. Sirve como referencia de todo lo
construido, las decisiones técnicas tomadas y el punto exacto desde el cual
partirá la nueva arquitectura.

---

## Stack completo

| Capa | Tecnología |
|---|---|
| Frontend | Static HTML + CSS + Vanilla JS (sin build step, sin npm, sin framework) |
| Base de datos | Supabase PostgreSQL con Row Level Security (RLS) |
| Auth | Supabase Auth (email/password + TOTP MFA opcional) |
| Storage | Supabase Storage — bucket `artworks` para imágenes de obras |
| Backend | Supabase Edge Functions (TypeScript / Deno runtime) |
| Email | Brevo HTTP API v3 (`api.brevo.com/v3/smtp/email`) — sin TCP/SMTP |
| Deploy | Netlify — publish directory `app`, sin build command |
| Control de versiones | Git / GitHub |

---

## Funcionalidades completadas

### Sitio público

- [x] **Catálogo con búsqueda y filtros** — por año, técnica, tags (popover multi-select), texto libre (debounce 300 ms)
- [x] **Paginación desktop / infinite scroll mobile** — breakpoint 1200 px; 8 obras/página en desktop, 12 + IntersectionObserver en mobile
- [x] **Scroll al inicio del grid al cambiar de página** — `window.scrollTo` con offset del header sticky
- [x] **Favoritos anónimos con Supabase** — `obra_favoritos` tabla, `session_id` via `crypto.randomUUID()` persistido en localStorage; actualización optimista de UI + rollback silencioso
- [x] **Filtro "Mis favoritos"** — `.in('id', favIds)` query a Supabase
- [x] **Página de detalle de obra** — galería multi-imagen, lightbox, touch swipe (50 px threshold), keyboard navigation (flechas + Escape), contador "N / total"
- [x] **Obras relacionadas** — hasta 4 por misma técnica
- [x] **Registro de visitas** — INSERT fire-and-forget a `obra_visitas` sin bloquear UI
- [x] **i18n ES/EN** — `data-i18n / data-es / data-en` en HTML estático + diccionario `TRANSLATIONS` en JS para valores dinámicos de DB; `localStorage` key `lang`; `CustomEvent lang:changed`
- [x] **Traducción del brand title** — "Catálogo Digital" / "Digital Catalog" en header
- [x] **Página de técnicas** — listado con filtro inline
- [x] **Página de créditos** — carga dinámica desde Supabase (`creditos`, `configuracion_acerca`)
- [x] **Footer social** — links desde `redes_sociales` tabla
- [x] **Registro de alumnos** — formulario público con validación, ventana de tiempo (fecha_inicio / fecha_fin), toggle admin; fechas expiradas muestran aviso "próximamente" en lugar de las fechas viejas
- [x] **Botón volver arriba** — `is-visible` class + CSS transition
- [x] **404.html**, **robots.txt**, **sitemap.xml**, **manifest.json** (PWA básica)
- [x] **Preload de logos críticos** — UNAM.svg + FAD.svg con `fetchpriority="high"`

### Panel admin (SPA estática)

- [x] **Login** — email/password + TOTP MFA opcional (enroll / verify / recovery)
- [x] **Dashboard** — 7 widgets: total obras/técnicas/tags/usuarios, pendientes revisión, registros pendientes, obras estancadas (> 7 días en revisión); Top 10 obras del mes con favoritos; últimas obras
- [x] **Estadísticas** — historial todos los tiempos con scroll infinito + toggle ASC/DESC; llama `get_historial_obras_visitas` RPC
- [x] **Gestionar obras** — tabla con diff modal, flujo completo aprobar/rechazar, diff vs `snapshot_publicado`, badge dorado para reaperturas
- [x] **Formulario de obra** — crear/editar con multi-imagen (máx 4), upload progress indicators, conversión a WebP via Edge Function (graceful fallback), tags pill selector, validación
- [x] **Mi Portafolio** — vista del editor con su propio portfolio, reapertura de obras publicadas con `motivo_reapertura`, notificación de rechazo
- [x] **Técnicas CRUD** — crear/editar/eliminar técnicas
- [x] **Tags CRUD** — crear/editar/eliminar tags
- [x] **Usuarios** — tabla completa, invitar usuario (create-admin-user Edge Function), CSV import/export, batch delete
- [x] **Registros pendientes** — cola de validación / rechazo de registros de alumnos
- [x] **Historial de alumnos** — tabla con búsqueda (`.search-field` con ícono centrado)
- [x] **Control de registro** — abrir/cerrar ventana de registro con fechas
- [x] **Configuración** — texto Acerca (ES/EN), créditos institucionales
- [x] **Redes sociales** — CRUD con icon picker para el footer público
- [x] **Logs de auditoría** — visor filtrable de `audit_logs`
- [x] **Mi Perfil** — ver datos + cambiar contraseña (vía `password-recovery.js`)
- [x] **Recuperación de contraseña self-service** — token en `password_reset_tokens`, email via Brevo, expiración 30 min

### Base de datos / Edge Functions

- [x] **RLS en todas las tablas** — roles `admin`, `super_editor`, `editor`, `anon`
- [x] **9 Edge Functions** desplegadas: create-admin-user, delete-users-batch, reset-user-password (verify_jwt=false), validate-registro, reject-registro, send-welcome-email, save-registro-alumno, convert-webp, notify-obra-approval
- [x] **3 RPCs PostgreSQL**: `get_top_obras_visitas_mes`, `get_historial_obras_visitas`, más la original del mes
- [x] **Slug automático** — trigger en `obras` genera slug único al publicar
- [x] **`snapshot_publicado` JSONB** — baseline para diffs y rollback en reaperturas
- [x] **`pendiente_borrado`** — borrado diferido de imágenes hasta aprobación

---

## Decisiones técnicas

| Decisión | Alternativa considerada | Razón de la elección |
|---|---|---|
| Vanilla JS sin framework | React, Vue, Svelte | Proyecto académico/cultural sin CI, sin npm; deploy Netlify sin build; menor complejidad de onboarding |
| Supabase como BaaS | Pocketbase, Firebase, backend propio | Auth + DB + Storage + Edge Functions en una plataforma; RLS enforces security at DB level |
| Brevo HTTP API v3 para email | Nodemailer, Resend, SendGrid | Deno Deploy no soporta TCP/SMTP; Brevo tiene tier gratuito suficiente |
| `obra_favoritos` en Supabase | localStorage puro | Persistencia cross-device; sin cuenta requerida gracias al session_id anónimo |
| `password_reset_tokens` tabla custom | Supabase magic links | Control total sobre la UI del flow, link apunta directamente al panel admin |
| SPA estática en admin/index.html | Múltiples páginas admin | Un solo HTML simplifica el deploy y evita routing del servidor |
| `AbortController` en modales | `removeEventListener` manual | Limpieza de listeners en un solo `ac.abort()` — evita memory leaks |
| `snapshot_publicado` JSONB | Tabla de versiones separada | Suficiente para el caso de uso; diff directo en JS sin JOIN adicional |
| `verify_jwt = false` en reset-user-password | JWT obligatorio | El token de reset es la credencial; no hay sesión de usuario al momento de solicitar el reset |

---

## Archivos clave

```
app/
├─ index.html, obra.html, tecnicas.html, creditos.html, registro.html
├─ 404.html, manifest.json, robots.txt, sitemap.xml
├─ css/styles.css              ← diseño público completo
├─ js/
│   ├─ public-catalog.js       ← grid + filtros + paginación + favoritos
│   ├─ public-detail.js        ← galería + lightbox + visitas
│   ├─ i18n.js                 ← motor ES/EN
│   └─ api-client.js           ← helpers Supabase públicos
└─ admin/
    ├─ index.html              ← SPA admin completa
    ├─ css/admin.css           ← diseño admin UNAM
    └─ js/ (35 módulos)

supabase/
├─ migrations/ (20 archivos SQL)
└─ functions/ (9 Edge Functions TypeScript/Deno)
```

---

## Métricas del proyecto

| Métrica | Valor |
|---|---|
| Módulos JS admin | 35 archivos |
| Edge Functions | 9 funciones desplegadas |
| Migraciones SQL | 20 archivos |
| Tablas DB | ~14 tablas (obras, técnicas, tags, obra_tags, imagenes, usuarios_admin, registro_alumnos, audit_logs, configuracion, configuracion_acerca, creditos, redes_sociales, obra_visitas, obra_favoritos, password_reset_tokens) |
| RPCs PostgreSQL | 3 funciones |
| Tiempo de desarrollo | ~2 semanas (jun 2026) |

---

## Nota de migración

Esta versión es el **baseline oficial** antes de migrar a **Next.js**.

Lo que se mantiene en la migración:
- Supabase como backend (mismas tablas, RLS, Edge Functions)
- Brevo para emails transaccionales
- Netlify como deploy target
- Lógica de negocio (flujo de obras, roles, reaperturas, favoritos)

Lo que cambia en Next.js:
- Routing: App Router con Server Components
- Build step: `next build`
- CSS: Tailwind CSS (propuesto) o CSS Modules
- Estado: React hooks / Server Actions para mutaciones
- i18n: `next-intl` o similar
- Admin SPA → rutas protegidas con middleware de auth

**Rama de referencia:** `main` al commit del 26 jun 2026.
