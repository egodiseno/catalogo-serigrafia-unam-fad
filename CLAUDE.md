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
├─ index.html               # Public catalog (search + filters)
├─ obra.html                # Artwork detail page (URL param: ?id=...)
├─ tecnicas.html            # Techniques listing
├─ creditos.html            # Institutional credits
├─ registro.html            # Student self-registration form
├─ css/
│   └─ styles.css           # Public design system (tokens + components)
├─ js/
│   ├─ api-client.js        # Supabase data fetching helpers
│   ├─ i18n.js              # Basic ES/EN string switching
│   ├─ public-catalog.js    # Catalog search/filter/pagination
│   ├─ public-detail.js     # Artwork detail rendering
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
        ├─ dashboard.js         # Stats cards, recent obras, auto-refresh
        ├─ obras-list.js        # Obra table, diff modal, approve/reject flow
        ├─ obras-form.js        # Obra create/edit modal, snapshot on publish
        ├─ portafolio.js        # Editor's own portfolio view + rejection notice
        ├─ multi-image-upload.js # Multi-image uploader (max 4, principal tracking)
        ├─ storage.js           # Supabase Storage wrappers (upload, delete, preview)
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
├─ migrations/              # SQL migrations applied to Supabase project
└─ functions/               # Edge Functions (TypeScript / Deno)
    ├─ create-admin-user/   # Creates a new auth user and inserts into usuarios_admin
    ├─ delete-users-batch/  # Batch-deletes auth users (called from UI)
    ├─ reset-user-password/ # Admin-triggered password reset
    ├─ validate-registro/   # Approves a student registration → creates auth user
    ├─ reject-registro/     # Rejects a student registration
    ├─ send-welcome-email/  # Sends onboarding email after validation
    ├─ save-registro-alumno/ # Saves a new student self-registration
    └─ convert-webp/        # Converts uploaded images to WebP (optional pipeline)
```

---

## Database tables (main)

| Table | Purpose |
|---|---|
| `obras` | Artwork records with estado, visible_publico, snapshot_publicado, motivo_reapertura, motivo_rechazo |
| `tecnicas` | Serigraphy technique taxonomy |
| `tags` | Content tags (max 3 per obra) |
| `obra_tags` | N:M join between obras and tags |
| `imagenes` | Obra image records (url_storage, principal, pendiente_borrado) |
| `usuarios_admin` | Admin panel users — stores rol, nombre, email, estado |
| `registro_alumnos` | Student self-registration requests (pendiente_validacion → validado / rechazado) |
| `audit_logs` | Immutable log of all mutations in the panel |
| `configuracion` | Key-value store for site settings (about text, credits) |
| `creditos` | Named institutional credits shown on public page |
| `redes_sociales` | Social network links shown in public footer |

Supabase Storage bucket: `artworks` — stores obra images. Path convention: `{obraId}/{filename}`.

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
   - **Aprobar:** `estado='Publicado'`, `visible_publico=true`, updates `snapshot_publicado`, physically deletes `pendiente_borrado` images, clears `motivo_reapertura` and `motivo_rechazo`
   - **Rechazar:** restores all fields from `snapshot_publicado` (including tags and `pendiente_borrado` rollback), `estado='Publicado'`, saves `motivo_rechazo`, clears `motivo_reapertura`
6. If rejected: editor sees a red message icon in Mi Portafolio → modal shows `motivo_rechazo`. Next reopen clears `motivo_rechazo`.

**RLS policy key behavior:**
- Editor UPDATE is allowed only when `estado IN ('Borrador', 'Publicado', 'En Revisión')` in the USING clause (source state check)
- WITH CHECK restricts the resulting state to `IN ('Borrador', 'En Revisión')` — editors cannot self-publish
- Admin/super_editor branch uses `EXISTS (SELECT 1 FROM usuarios_admin WHERE rol IN ('admin','super_editor'))` with no state restriction

---

## Global JS state

| Variable | Set by | Contents |
|---|---|---|
| `window.supabase_client` | `config.js` | Initialized Supabase JS v2 client |
| `window.usuarioActual` | `auth.js` | `{ email, rol, nombre, authId }` of the logged-in user |
| `window.tienePermiso(key)` | `permisos.js` | Returns bool; keys like `'obras.crear'`, `'usuarios.borrar'` |

---

## Admin CSS design tokens (`app/admin/css/admin.css`)

Prefix: `--color-*`, `--spacing-*`, `--radius-*`, `--shadow-*`. Key tokens:
- `--color-primary: #013B75` (UNAM blue), `--color-accent: #D9A500` (UNAM gold)
- `--color-error: #EF4444`, `--color-warning: #F59E0B`, `--color-success: #10B981`
- Spacing: `--spacing-xs` … `--spacing-2xl`

---

## Public CSS design tokens (`app/css/styles.css`)

Prefix: `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`. Visual direction: warm light background, deep institutional blue, editorial tone.

---

## Conventions

- **No build step.** Edit files directly; hard-refresh the browser (Ctrl+Shift+R).
- **No inline Supabase credentials** in client-side JS — connection config is in `config.js` using the Supabase anon key (safe for public exposure; RLS enforces access control).
- **AbortController pattern** — all modals attach event listeners with `{ signal }` and call `ac.abort()` on close to prevent listener leaks.
- **Silent RLS detection** — after every UPDATE, check `!filas?.length` (using `.select('id')` on the update chain) to detect RLS-blocked updates that return `{ data: [], error: null }`.
- **`pendiente_borrado`** — images are not physically deleted when an editor removes them during a reapertura; they are marked `pendiente_borrado=true` and only deleted on approval.
- **`snapshot_publicado` JSONB** — written whenever an obra transitions to Publicado (both via form save and via the approve action). Used as the baseline for diff display and as the restore point on rejection.
- **Lucide icons** — loaded via CDN; always call `window.IconRegistry?.init()` after injecting HTML containing `data-lucide` attributes.
- **No global refactors without authorization.** Make minimal, localized changes only.
- **WCAG 2.2 AA** target: sufficient contrast, visible focus rings, keyboard navigation, `aria-*` labels.

---

## Local development

Local by Flywheel manages PHP and MySQL for other sites in this home directory, but this project does not use PHP. The admin panel is a static app that connects directly to the hosted Supabase project — no local Supabase instance is needed.

To develop: open `app/admin/index.html` via a local server (not `file://` — Supabase JS requires HTTP). A simple option: `python -m http.server 8080` from the project root, then open `http://localhost:8080/app/admin/`.
