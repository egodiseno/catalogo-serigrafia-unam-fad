# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Catálogo Digital de Obra Serigráfica — UNAM / FAD / Taller de Serigrafía.**

Academic/cultural catalog for exhibition and research of serigraphy works. Not ecommerce, not a social platform, not a SaaS dashboard.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Static HTML + CSS + vanilla JS — no build step, no npm, no preprocessor |
| Database | Supabase PostgreSQL with Row Level Security (RLS) |
| Auth | Supabase Auth (email/password + optional TOTP MFA) |
| Storage | Supabase Storage — bucket `artworks` for obra images |
| Backend functions | Supabase Edge Functions (TypeScript, Deno runtime) |
| Deploy | Netlify — publish directory `app`, no build command |

There is no bundler, no framework, and no package.json. All CSS and JS are plain files edited directly.

---

## Repo structure

```
app/
├─ index.html               # Public catalog (search + filters + favorites)
├─ obra.html                # Artwork detail page (URL param: ?slug=<slug>)
├─ tecnicas.html            # Techniques listing
├─ creditos.html            # Institutional credits
├─ registro.html            # Student self-registration form
├─ css/
│   └─ styles.css           # Public design system (tokens + components)
├─ js/
│   ├─ api-client.js        # Supabase data fetching helpers + recordVisit()
│   ├─ i18n.js              # ES/EN string switching (static HTML + dynamic DB values)
│   ├─ public-catalog.js    # Catalog grid, filters, pagination/infinite scroll, favorites
│   ├─ public-detail.js     # Artwork detail rendering, gallery, lightbox, image counter
│   ├─ public-techniques.js # Techniques page
│   ├─ public-creditos.js   # Credits page
│   └─ public-footer.js     # Footer social links
└─ admin/
    ├─ index.html           # Single-page admin panel (all sections in one file)
    ├─ admin-components-examples.html  # UI component reference (dev only)
    ├─ css/
    │   └─ admin.css        # Admin design system (UNAM tokens + all components)
    └─ js/                  # ~34 vanilla JS modules, all loaded via <script defer>
        ├─ config.js            # Supabase client init → window.supabase_client
        ├─ auth.js              # Login, MFA enroll/verify, recovery, logout
        ├─ permisos.js          # Role-based permission checks → window.tienePermiso()
        ├─ navigation.js        # Section show/hide + sidebar
        ├─ dashboard.js         # Stats cards, recent obras, stale-review alert, top visitas
        ├─ obras-list.js        # Obra table, diff modal, approve/reject flow
        ├─ obras-form.js        # Obra create/edit modal, snapshot on publish
        ├─ portafolio.js        # Editor's own portfolio view + rejection notice
        ├─ multi-image-upload.js # Multi-image uploader (max 4, principal tracking, progress indicators)
        ├─ storage.js           # Supabase Storage wrappers (upload→WebP→bucket, delete, preview)
        ├─ tags-in-obra.js      # Tag pill selector component
        ├─ tecnicas-crud.js     # Techniques CRUD
        ├─ tags-crud.js         # Tags CRUD
        ├─ usuarios-crud.js     # User management, CSV import/export, batch delete
        ├─ registros-pendientes.js  # Pending student registration queue
        ├─ historial-alumnos.js     # Full registration history
        ├─ control-registro.js      # Open/close student registration window
        ├─ configuracion.js         # About text (ES/EN), credits, social links
        ├─ redes-sociales.js        # Social links CRUD with icon picker
        ├─ audit-logger.js          # Writes to audit_logs table
        ├─ logs.js                  # Audit log viewer with filters
        ├─ modals.js                # Image preview, generic modal helpers
        ├─ confirm-modal.js         # Reusable confirmation modal
        ├─ sort-manager.js          # Column sort state for tables
        ├─ error-handler.js         # Toast notifications + error utilities
        ├─ toast-notifications.js   # Toast UI component
        ├─ password-recovery.js     # Password reset flow (email link + new-password form)
        ├─ profile.js               # Mi Perfil section (view + change password)
        ├─ cache.js                 # Simple in-memory cache
        ├─ validators.js            # Form validation helpers
        ├─ icons.js                 # Lucide icon registry wrapper
        ├─ init.js                  # Post-login initialization
        ├─ csv-import.js            # CSV batch user import
        └─ seed.js                  # Localhost-only seed data

supabase/
├─ migrations/              # SQL migrations applied to Supabase project (run in SQL Editor)
└─ functions/               # Edge Functions (TypeScript / Deno)
    ├─ create-admin-user/       # Creates a new auth user and inserts into usuarios_admin
    ├─ delete-users-batch/      # Batch-deletes auth users (called from UI)
    ├─ reset-user-password/     # Admin-triggered password reset
    ├─ validate-registro/       # Approves a student registration → creates auth user
    ├─ reject-registro/         # Rejects a student registration
    ├─ send-welcome-email/      # Sends onboarding email after validation
    ├─ save-registro-alumno/    # Saves a new student self-registration
    ├─ convert-webp/            # Converts uploaded images to WebP (optional, graceful fallback)
    └─ notify-obra-approval/    # Emails the editor when their obra is approved or rejected
```

---

## Database tables (main)

| Table | Purpose |
|---|---|
| `obras` | Artwork records with estado, visible_publico, snapshot_publicado, motivo_reapertura, motivo_rechazo |
| `tecnicas` | Serigraphy technique taxonomy |
| `tags` | Content tags (max 3 per obra) |
| `obra_tags` | N:M join between obras and tags |
| `imagenes` | Obra image records (url_storage, principal, orden, pendiente_borrado) |
| `usuarios_admin` | Admin panel users — stores rol, nombre, email, estado |
| `registro_alumnos` | Student self-registration requests (pendiente_validacion → validado / rechazado) |
| `audit_logs` | Immutable log of all mutations in the panel |
| `configuracion` | Key-value store for site settings |
| `configuracion_acerca` | Bilingual about text (contenido_es, contenido_en) |
| `creditos` | Named institutional credits shown on public page |
| `redes_sociales` | Social network links shown in public footer |
| `obra_visitas` | Visit log — one row per artwork page view (obra_id UUID, fecha TIMESTAMPTZ). No personal data, no IP. |

Supabase Storage bucket: `artworks` — stores obra images. Path convention: `{obraId}/{timestamp}-{random}.{ext}`.

### `obra_visitas` — RLS policies

| Policy | Role | Action |
|---|---|---|
| `visitas_insert_public` | `anon`, `authenticated` | INSERT (no restriction) |
| `visitas_select_authenticated` | `authenticated` | SELECT |

### `obra_visitas` — RPC function

```sql
get_top_obras_visitas_mes(p_limit INT DEFAULT 5)
-- Returns: obra_id, titulo, artista, visitas (BIGINT)
-- Groups by obra in the current calendar month, ordered by visit count DESC
```

Called from dashboard.js via `client.rpc('get_top_obras_visitas_mes', { p_limit: 5 })`.

---

## User roles

All authenticated users are rows in `usuarios_admin` with a `rol` column. The panel reads `window.usuarioActual` (set by `auth.js` after login).

| Role | Capabilities |
|---|---|
| `admin` | Full access: all CRUD, user management, approve/reject obras, view audit logs, site configuration, registration control |
| `super_editor` | Same as admin except: cannot manage other users, cannot view audit logs, cannot access site configuration |
| `editor` | Can only create and edit **their own** obras (Borrador / En Revisión states only). Sees "Mi Portafolio" instead of the full Obras section. Cannot access any other admin sections. |

RLS policies enforce role separation at the database level — frontend role checks are defense-in-depth only.

---

## Obra state flow

```
Borrador ──► En Revisión ──► Publicado
   ▲               │              │
   │    (reject)   ▼              │
   │         Borrador             │ (reopen by editor)
   │                              ▼
   └──────────────────────── Borrador
                                  │
                              En Revisión
                                  │
                        (approve / reject)
                         ▼              ▼
                     Publicado       Publicado
                   (updated)       (restored to
                                    snapshot)
```

**State definitions:**
- `Borrador` — draft; editor can edit freely via the obra form
- `En Revisión` — submitted; editor cannot modify; admin/super_editor can approve or reject
  - **First submission:** `motivo_reapertura IS NULL` — new obra entering review for the first time
  - **Reapertura:** `motivo_reapertura IS NOT NULL` — editor reopened a published obra to submit changes
- `Publicado` — approved; `visible_publico = true`; a `snapshot_publicado` JSONB stores the published field values (titulo, artista, año, tecnica, descripcion, tags[], imagenes[])
- `Archivado` — retired; not visible publicly; no editor actions available

**Reapertura flow (editor reopens a published obra):**
1. Editor clicks "Volver a borrador" in Mi Portafolio → must write a `motivo_reapertura`
2. UPDATE: `estado='Borrador'`, `motivo_reapertura=texto`, `motivo_rechazo=null`
3. Editor edits the obra; can mark existing images `pendiente_borrado=true` (deferred deletion)
4. Editor submits → `estado='En Revisión'`
5. Admin/super_editor sees the reapertura diff modal in Gestionar Obras (gold badge on row):
   - Displays `motivo_reapertura` + field-by-field diff vs `snapshot_publicado` + image changes
   - **Aprobar:** `estado='Publicado'`, `visible_publico=true`, updates `snapshot_publicado`, physically deletes `pendiente_borrado` images from Storage + DB, clears `motivo_reapertura` and `motivo_rechazo`
   - **Rechazar:** restores all fields from `snapshot_publicado` (including tags and `pendiente_borrado` rollback), `estado='Publicado'`, saves `motivo_rechazo`, clears `motivo_reapertura`
6. If rejected: editor sees a red message icon in Mi Portafolio → modal shows `motivo_rechazo`. Next reopen clears `motivo_rechazo`.
7. On approve/reject, `notify-obra-approval` Edge Function sends an email to the editor.

**RLS policy key behavior:**
- Editor UPDATE is allowed only when `estado IN ('Borrador', 'Publicado', 'En Revisión')` in the USING clause (source state check)
- WITH CHECK restricts the resulting state to `IN ('Borrador', 'En Revisión')` — editors cannot self-publish
- Admin/super_editor branch uses `EXISTS (SELECT 1 FROM usuarios_admin WHERE rol IN ('admin','super_editor'))` with no state restriction

---

## `deleteObraImage` flow (`obras-form.js`)

The behavior differs by obra state:

| Obra state | Action |
|---|---|
| `Borrador` or `En Revisión` | Immediate: deletes record from `imagenes` table **and** file from Supabase Storage |
| `Publicado` (or `visible_publico = true`) | Deferred: sets `pendiente_borrado = true` on the `imagenes` row. File in Storage is **not** touched. Actual deletion happens only when admin **approves** the reapertura changes. |

On **reject**, images marked `pendiente_borrado` are rolled back (cleared) — the obra returns to its published snapshot intact.

The form UI excludes images with `pendiente_borrado = true` from the visible list and from the 4-image count limit, so the editor doesn't see them but they still exist in DB/Storage until the review resolves.

---

## Image upload pipeline (`storage.js`)

1. Client validates file type (JPG, PNG, WebP only) and size (≤ 5 MB).
2. File is sent to the `convert-webp` Edge Function, which converts it to WebP using WASM.
3. If the Edge Function succeeds, the converted `.webp` blob is used for upload; if it fails (network error, WASM unavailable), the original file is used — **graceful fallback, never blocks the upload**.
4. The resulting file is uploaded to the `artworks` bucket as `{obraId}/{timestamp}-{random}.{ext}`.
5. A public URL is returned via `getPublicUrl()`.

`uploadImage(file, obraId, onPhase?)` accepts an optional third argument `onPhase` — a callback invoked with `'uploading'` (before WebP conversion) and `'processing'` (before Storage upload). Existing callers that pass only 2 args are unaffected.

### Upload progress indicators (`multi-image-upload.js`)

When `uploadAll(obraId)` runs, each file gets a live status row in `#uploadProgressList`:

| Phase | Icon | Label |
|---|---|---|
| `uploading` | spinner | "Subiendo…" |
| `processing` | spinner | "Procesando WebP…" |
| `done` | check | filename |
| `error` | x-circle | error message |

Successful rows auto-hide after 2 200 ms. Error rows remain visible. The list is cleared and hidden on `reset()`.

---

## Public catalog — breakpoints and layout (`public-catalog.js`)

| Breakpoint | Threshold | Behavior |
|---|---|---|
| Desktop | `window.innerWidth >= 1200` | **8 obras per page**, discrete **pagination** buttons, filters shown as persistent CSS Grid (no accordion) |
| Tablet / Mobile | `window.innerWidth < 1200` | **12 obras per page**, **infinite scroll** (IntersectionObserver appends next page), filters collapsed in an accordion |

CSS mirrors this at `@media (min-width: 1200px)` for the filter panel and `@media (max-width: 1199px)` to hide lightbox prev/next arrows (touch swipe used instead).

---

## Public catalog — favorites (`public-catalog.js`)

Implemented as a self-contained IIFE module `Favoritos` inside `public-catalog.js`:

- **Storage:** `localStorage` key `catalogo_favoritos` — JSON array of UUID strings.
- **No account or login required** — purely browser-local.
- **API:** `has(id)`, `add(id)`, `remove(id)`, `toggle(id) → bool`, `getAll() → string[]`, `count() → number`.
- Each artwork card gets a `<button class="artwork-fav-btn">` rendered as a sibling to the `<a>` card link (not nested inside it — invalid HTML). Positioned absolute via `position: relative` on the `<li>`.
- Heart button uses `@keyframes fav-pop` scale animation on toggle.
- `#favFilterBtn` in the filter bar toggles `filters.onlyFav`. When active, `filterWorks()` is called with `favIds: Favoritos.getAll()`, which passes an `.in('id', favIds)` filter to Supabase.
- Clearing filters resets `onlyFav` and un-presses the button.

---

## Artwork detail page (`public-detail.js`)

URL: `obra.html?slug=<slug>` — the `?id=` parameter is **not used**; the slug is generated automatically by a Supabase trigger on the `obras` table.

### Image gallery

- Images are sorted: principal first, then by `orden` field.
- Thumbnails appear in `#gallery` when there are ≥ 2 images; hidden for single-image artworks.
- **Touch swipe** is set up on the main image and inside the lightbox (threshold: 50 px diff).
- **Keyboard navigation**: Arrow keys change image when lightbox is open; Escape closes it.

### Image position counter (`#imageCounter`)

- `<span id="imageCounter" class="image-counter">` in `obra.html` inside `<figure class="work-hero__figure">`.
- Hidden (`hidden` attribute) when there is only 1 image or no images.
- Shows "N / total" (e.g. "2 / 3"). Updated by `_updateCounter(idx)` on thumb click, swipe, keyboard navigation, and inside the lightbox (`.lightbox__counter` pill at bottom-center).
- `_updateCounter(0)` is called **before** the early-return guard for single images, so the counter is always initialized.

### Visit recording

After a successful obra load, `api.recordVisit(data.id).catch(() => {})` fires a fire-and-forget INSERT into `obra_visitas`. No await — does not block the UI.

### Related works

`loadRelatedWorks()` fetches up to 4 obras with the same technique (excluding the current one) and renders them as cards at the bottom of the page.

---

## Internationalization (i18n)

**Scope:** Public site only. The admin panel is Spanish-only.

**Two-layer approach:**

| Layer | Mechanism | What it covers |
|---|---|---|
| Static HTML strings | `data-i18n` attribute + `data-es` / `data-en` values, toggled by `i18n.updateLanguage()` | Nav links, filter labels, section headers, CTA text, aria-labels, form placeholders |
| Dynamic DB values | `i18n.translate(text)` → looks up `TRANSLATIONS` dictionary in `i18n.js` | Técnica names and tag names fetched from Supabase |

**What is NOT translated:**
- Artwork metadata: `titulo`, `artista`, `descripcion`, `año` — displayed as-is from the DB.
- Admin panel — all strings are Spanish only.
- Error messages and console logs.

**Language persistence:** stored in `localStorage` under the key `lang` (`'es'` or `'en'`). Default is `'es'`. A `lang:changed` CustomEvent is dispatched on switch so modules can react.

**Placeholders:** `data-i18n-placeholder` + `data-es-placeholder` / `data-en-placeholder` for `<input>` elements.

---

## Dashboard admin — stat cards and widgets

All widgets refresh on load and auto-refresh every 30 s (only when the dashboard section is visible).

| Widget | ID | Visibility |
|---|---|---|
| Total Obras | `totalObras` | All roles (editors see count of their own obras only) |
| Total Técnicas | `totalTecnicas` | All roles |
| Total Tags | `totalTags` | All roles |
| Total Usuarios | `totalUsuarios` | All roles |
| Pendientes de Revisión | `cardPendientesRevision` | admin / super_editor only |
| Registros Pendientes | `cardRegistrosPendientes` | admin / super_editor only |
| Obras estancadas en revisión | `cardObrasEstancadas` | admin / super_editor only; **only shown when count > 0** |
| Últimas Obras | `recentObrasList` | All roles (editors see only their own) |
| Obras más visitadas este mes | `topVisitasSection` | admin / super_editor only; **only shown when there is data** |

**Stale review alert (`cardObrasEstancadas`):** Queries obras with `estado='En Revisión'` AND `updated_at < now() - 7 days`. Uses the `trg_obras_updated_at` trigger (auto-updates `updated_at` on every row change) as the activity clock. Clicking the card navigates to the Obras section with the "En Revisión" filter pre-applied.

**Top visitas del mes (`topVisitasSection`):** Calls `get_top_obras_visitas_mes(p_limit: 5)` RPC. Shows a ranked list with position badge (gold for #1, UNAM blue for others), obra title, artist name, and visit count. Hidden when the table has no data yet for the current month.

---

## Global JS state

| Variable | Set by | Contents |
|---|---|---|
| `window.supabase_client` | `config.js` | Initialized Supabase JS v2 client |
| `window.usuarioActual` | `auth.js` | `{ email, rol, nombre, authId }` of the logged-in user |
| `window.tienePermiso(key)` | `permisos.js` | Returns bool; keys like `'obras.crear'`, `'usuarios.borrar'` |
| `window.dashboardManager` | `dashboard.js` | `{ loadStats(), limpiar() }` — called by auth.js on login/logout |
| `window.obrasForm` | `obras-form.js` | `{ open() }` — used by dashboard quick-action button |

---

## Admin CSS design tokens (`app/admin/css/admin.css`)

Prefix: `--color-*`, `--spacing-*`, `--radius-*`, `--shadow-*`. Key tokens:
- `--color-primary: #013B75` (UNAM blue), `--color-accent: #D9A500` (UNAM gold)
- `--color-error: #EF4444`, `--color-warning: #F59E0B`, `--color-success: #10B981`
- Spacing: `--spacing-xs` … `--spacing-2xl`

Notable component classes added in Jun-2026:
- `.stat-card--stale` — amber border + `#FFFBEB` background for the stale-review alert card
- `.upload-progress-list / .upload-progress-item / .upload-pi__*` — per-file upload progress rows
- `.spin-anim` — reuses existing `@keyframes spin` for the upload loader icon
- `.top-visitas-list / .top-visitas-item / .top-visitas-rank / .top-visitas-info / .top-visitas-title / .top-visitas-artist / .top-visitas-count` — ranked visit list in dashboard

---

## Public CSS design tokens (`app/css/styles.css`)

Prefix: `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`. Visual direction: warm light background, deep institutional blue, editorial tone.

Notable classes added in Jun-2026:
- `.artwork-fav-btn` — absolute heart button on artwork cards; `.is-fav` state shows gold fill
- `.btn-fav-filter` — favorites filter button in the filter bar; `.is-active` state
- `.btn-back-top` — fixed back-to-top button; `.is-visible` state (uses `opacity` not `display:none` for CSS transitions)
- `.image-counter` — absolute pill overlay on `work-hero__figure` showing "N / total"
- `.lightbox__counter` — pill at bottom-center of lightbox, same content

---

## Conventions

- **No build step.** Edit files directly; hard-refresh the browser (Ctrl+Shift+R).
- **No inline Supabase credentials** in client-side JS — connection config is in `config.js` using the Supabase anon key (safe for public exposure; RLS enforces access control). Exception: `storage.js` duplicates the anon key for the Edge Function call — acceptable since it's the public anon key.
- **AbortController pattern** — all modals attach event listeners with `{ signal }` and call `ac.abort()` on close to prevent listener leaks.
- **Silent RLS detection** — after every UPDATE, check `!filas?.length` (using `.select('id')` on the update chain) to detect RLS-blocked updates that return `{ data: [], error: null }`.
- **`pendiente_borrado`** — images are not physically deleted when an editor removes them during a reapertura; they are marked `pendiente_borrado=true` and only deleted on approval.
- **`snapshot_publicado` JSONB** — written whenever an obra transitions to Publicado (both via form save and via the approve action). Used as the baseline for diff display and as the restore point on rejection.
- **Lucide icons** — loaded via CDN; always call `window.lucide?.createIcons()` (public) or `window.IconRegistry?.init()` (admin) after injecting HTML containing `data-lucide` attributes.
- **Fire-and-forget pattern** — non-critical side effects (visit recording, email notifications) use `.catch(() => {})` and no `await` so they never block the UI or user flow.
- **Event delegation** — click handlers for dynamically-rendered elements (artwork cards, fav buttons, gallery thumbs) are attached to a stable parent container, not to each element.
- **`is-visible` / `is-active` class pattern** — for CSS-transitioned visibility (e.g. back-to-top button), never use `display:none` or the `hidden` attribute as the hidden state — use `opacity: 0; pointer-events: none` as default and add `.is-visible` to show. This allows CSS transitions to work.
- **No global refactors without authorization.** Make minimal, localized changes only.
- **WCAG 2.2 AA** target: sufficient contrast, visible focus rings, keyboard navigation, `aria-*` labels. `aria-pressed` on toggle buttons (favorites, language), `aria-live` on counters and live regions.

---

## Local development

Local by Flywheel manages PHP and MySQL for other sites in this home directory, but this project does not use PHP. The admin panel is a static app that connects directly to the hosted Supabase project — no local Supabase instance is needed.

To develop: open `app/admin/index.html` via a local server (not `file://` — Supabase JS requires HTTP). A simple option: `python -m http.server 8080` from the project root, then open `http://localhost:8080/app/admin/`.

**SQL migrations:** Files in `supabase/migrations/` are reference copies only — they must be manually executed in the Supabase SQL Editor for the hosted project. There is no `supabase` CLI linked to this project.
