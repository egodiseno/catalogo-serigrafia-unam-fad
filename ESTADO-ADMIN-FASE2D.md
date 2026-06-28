# ESTADO ADMIN — FASE 2D COMPLETADA

> Fecha: 2026-06-28  
> Rama: `nextjs-migration`  
> Último commit: `dc44af9` (Session 6) → revisado y extendido en esta sesión.

---

## Rutas implementadas (14 admin + 5 públicas = 19 total)

### Admin (`/admin/*`)

| Ruta | Componente | Roles con acceso | Estado |
|---|---|---|---|
| `/admin/login` | `login/page.jsx` | Todos (sin sesión) | ✅ |
| `/admin` | `page.jsx` (Dashboard) | admin, super_editor | ✅ |
| `/admin/obras` | `obras/page.jsx` | admin, super_editor | ✅ |
| `/admin/tecnicas` | `tecnicas/page.jsx` | admin, super_editor | ✅ |
| `/admin/tags` | `tags/page.jsx` | admin, super_editor | ✅ |
| `/admin/usuarios` | `usuarios/page.jsx` | admin, super_editor | ✅ |
| `/admin/registros` | `registros/page.jsx` | admin, super_editor | ✅ |
| `/admin/control-registro` | `control-registro/page.jsx` | admin | ✅ |
| `/admin/historial-alumnos` | `historial-alumnos/page.jsx` | admin, super_editor | ✅ |
| `/admin/logs` | `logs/page.jsx` | admin | ✅ |
| `/admin/estadisticas` | `estadisticas/page.jsx` | admin, super_editor | ✅ |
| `/admin/configuracion` | `configuracion/page.jsx` | admin | ✅ |
| `/admin/mi-portafolio` | `mi-portafolio/page.jsx` | editor | ✅ |
| `/admin/mi-perfil` | `mi-perfil/page.jsx` | todos los roles autenticados | ✅ |

### Públicas

| Ruta | Estado |
|---|---|
| `/` | ✅ |
| `/obra/[slug]` | ✅ |
| `/tecnicas` | ✅ |
| `/creditos` | ✅ |
| `/registro` | ✅ |

---

## Componentes admin

| Componente | Tipo | Propósito |
|---|---|---|
| `AdminHeader.jsx` | Client | Header con subtítulo dinámico por ruta (usePathname) |
| `SidebarNav.jsx` | Client | Nav del sidebar con `startsWith` para estado activo |
| `SidebarFooterActions.jsx` | Client | Botones Mi Perfil + Cerrar Sesión en footer del sidebar |
| `LogoutButton.jsx` | Client | signOut + router.push('/admin/login') + router.refresh() |
| `ObraForm.jsx` | Client | Modal crear/editar obra (imagenes, tags, estados por rol) |
| `ImageUpload.jsx` | Client | Uploader multi-imagen (convert-webp → artworks bucket) |
| `ConfirmModal.jsx` | Client | Modal de confirmación reutilizable con focus trap + Escape |
| `DiffModal.jsx` | Client | Revisión de reaperturas (diff vs snapshot_publicado) |

---

## Modales implementados

| Modal | Se abre desde | Cierra con |
|---|---|---|
| `ObraForm` (nueva obra) | Botón "Nueva Obra" en `/admin/obras`; `?nueva=1` en URL; Dashboard "Crear obra" | `onClose()` — X button o cancelar |
| `ObraForm` (editar) | Botón Editar (Pencil) en tabla de obras; botón Editar en Mi Portafolio | `onClose()` |
| `ObraForm` desde Mi Portafolio | `?nueva=1` en URL de Mi Portafolio | `onClose()` |
| `DiffModal` (reapertura) | Botón diff (MessageSquare) visible cuando `obra.motivo_reapertura IS NOT NULL && estado='En Revisión'` | `onClose()` o al aprobar/rechazar |
| `ConfirmModal` (eliminar obra) | Botón Eliminar en tabla de obras | Confirm o cancelar |
| `ConfirmModal` (eliminar técnica) | Botón Eliminar en tabla de técnicas | Confirm o cancelar |
| `ConfirmModal` (eliminar tag) | Botón Eliminar en tabla de tags | Confirm o cancelar |
| `ConfirmModal` (eliminar usuario) | Botón Eliminar individual en tabla de usuarios | Confirm o cancelar |
| `ConfirmModal` (batch delete usuarios) | Botón "Eliminar N seleccionados" | Confirm o cancelar |
| `ConfirmModal` (eliminar historial) | Botón Eliminar en historial de alumnos | Confirm o cancelar |
| Modal rechazo (inline en registros) | Botón "Rechazar" en tabla de registros pendientes | Cancelar o confirmar (motivo requerido) |
| Modal validar (inline en registros) | Botón "Validar" en tabla de registros pendientes | Cancelar o confirmar |
| `UsuarioModal` (crear/editar usuario) | Botón "Nuevo Usuario" o Editar en tabla | Cancelar o guardar |
| `CsvImportModal` (importar CSV) | Botón "Importar CSV" en usuarios | Cancelar o completar import |
| Modales técnicas/tags | Botón "Nueva Técnica/Tag" o Editar | Cancelar o guardar |

---

## Edge Functions llamadas

| Edge Function | Llamada desde | Parámetros | Propósito |
|---|---|---|---|
| `validate-registro` | `registros/page.jsx` | `{ id: string }` | Aprobar solicitud de registro → crear auth user |
| `reject-registro` | `registros/page.jsx` | `{ id: string, notas_admin: string }` | Rechazar solicitud de registro (motivo obligatorio) |
| `notify-obra-approval` | `DiffModal.jsx` | `{ obraId, resultado: 'aprobado'\|'rechazado', motivo }` | Email al editor al aprobar/rechazar reapertura |
| `create-admin-user` | `usuarios/page.jsx` | `{ email, password, nombre?, rol }` | Crear usuario admin + auth user |
| `delete-users-batch` | `usuarios/page.jsx` | `{ emails: string[] }` | Eliminar usuarios en lote (BD + auth) |
| `convert-webp` | `ImageUpload.jsx` | archivo binario | Convertir imagen a WebP (graceful fallback si falla) |

Todas las llamadas usan `process.env.NEXT_PUBLIC_SUPABASE_URL` + `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` + `Authorization: Bearer <access_token>`.

---

## Permisos por rol (`hooks/usePermisos.js`)

### Admin — acceso total

| Permiso | Valor |
|---|---|
| dashboard.ver | ✅ |
| obras.ver_todas / crear / editar / borrar | ✅ |
| tecnicas, tags: ver / crear / editar / borrar | ✅ |
| usuarios: ver / crear / editar / borrar | ✅ |
| registros: ver / validar / rechazar | ✅ |
| historial_alumnos.ver | ✅ |
| control_registro.ver / editar | ✅ |
| logs.ver | ✅ |
| estadisticas.ver | ✅ |
| configuracion.ver / editar | ✅ |
| portafolio.ver | ❌ (admin no usa portafolio) |

### Super Editor — admin sin control_registro / logs / configuracion

| Permiso | Valor |
|---|---|
| dashboard.ver, obras.*, tecnicas.*, tags.* | ✅ |
| usuarios: ver / crear / editar / borrar | ✅ (con restricción runtime: no puede gestionar admins) |
| registros: ver / validar / rechazar | ✅ |
| historial_alumnos.ver | ✅ |
| estadisticas.ver | ✅ |
| control_registro.ver / editar | ❌ |
| logs.ver | ❌ |
| configuracion.ver / editar | ❌ |
| portafolio.ver | ❌ |

### Editor — solo Mi Portafolio

| Permiso | Valor |
|---|---|
| portafolio.ver | ✅ |
| obras.crear / editar_propia | ✅ |
| obras.ver_propias | ✅ (filtradas por `artista = email`) |
| TODO lo demás | ❌ |

**Sidebar por rol:**
- `admin` / `super_editor`: Dashboard · Obras · Técnicas · Tags · Usuarios · Registros · (Control Registro — admin only) · Historial Alumnos · (Logs — admin only) · Estadísticas · (Configuración — admin only)
- `editor`: Mi Portafolio únicamente
- Todos: Mi Perfil + Cerrar Sesión en sidebar-footer

---

## Flujos E2E documentados (análisis de código)

### Admin

1. **Login** → `POST supabase.auth.signInWithPassword` → layout.jsx redirige a `/admin`
2. **Dashboard** → stats con 6 tarjetas (Obras/Pendientes/Técnicas/Tags/Usuarios/Registros) + Top Visitas (RPC) + Últimas Obras; auto-refresh 30s
3. **Crear técnica** → `/admin/tecnicas` → modal "Nueva Técnica" (nombre + descripción) → INSERT + `tecnicas:updated` event
4. **Crear obra** → `/admin/obras` → ObraForm → campos + ImageUpload (convert-webp → artworks) + tags (máx 3) → INSERT obras + imagenes + obra_tags
5. **Subir imágenes** → ImageUpload (drag & drop o selector) → convert-webp Edge Function → Supabase Storage bucket `artworks`
6. **Editar obra** → Pencil button → ObraForm pre-relleno → PATCH obras
7. **En Revisión** → estado dropdown en ObraForm → editor ve "Borrador/En Revisión"; admin ve todos los estados
8. **Registros pendientes** → `/admin/registros` → tabla con Validar/Rechazar (motivo obligatorio al rechazar)
9. **Configuración** → `/admin/configuracion` → tabs: Acerca (ES+EN) / Créditos (↑↓ reordenar) / Redes Sociales (drag)
10. **Mi Perfil** → `/admin/mi-perfil` → ver datos + cambiar contraseña (supabase.auth.updateUser)
11. **Logout** → LogoutButton → signOut + router.push('/admin/login') + router.refresh()

### Editor

1. **Login** → redirige a `/admin/mi-portafolio` (no tiene `dashboard.ver`)
2. **Mi Portafolio** → obras filtradas por `editor_id = auth.users.id`; estados: Borrador · En Revisión · Publicado · Archivado
3. **Crear obra** → ObraForm (estados: Borrador / En Revisión) → obras.editor_id = user.id
4. **Solicitar cambios en obra publicada** → botón "Volver a Borrador" → `motivo_reapertura` obligatorio → UPDATE obras
5. **Mi Perfil** → `/admin/mi-perfil`
6. **Logout** → mismo flujo

### Super Editor

Igual que Admin excepto: no accede a `/admin/control-registro`, `/admin/logs`, `/admin/configuracion`. Si intenta navegar directamente → `router.replace('/admin')`.

---

## Bugs encontrados y corregidos (en esta sesión)

| # | Archivo | Bug | Fix |
|---|---|---|---|
| 1 | `dashboard/page.jsx` (L513, L517) | `router.push('/admin/registros-pendientes')` — ruta inexistente | → `/admin/registros` |
| 2 | `AdminHeader.jsx` (L32) | Entrada `/admin/registros-pendientes` en ROUTE_SUBTITLES — ruta inexistente | Eliminada (solo `/admin/registros`) |
| 3 | `mi-portafolio/page.jsx` (L175, L183) | `router.replace('/login')` — ruta inexistente | → `/admin/login` |
| 4 | `mi-portafolio/page.jsx` (L180) | `.eq('id', user.id)` para lookup en `usuarios_admin` | → `.eq('email', user.email)` |
| 5 | `mi-perfil/page.jsx` (L157, L165) | `router.replace('/login')` — ruta inexistente | → `/admin/login` |
| 6 | `mi-perfil/page.jsx` (L162) | `.eq('id', user.id)` para lookup en `usuarios_admin` | → `.eq('email', user.email)` |
| 7 | `configuracion/page.jsx` (L96, L104) | `router.replace('/login')` + `.eq('id', user.id)` | → `/admin/login` + `.eq('email', user.email)` |
| 8 | `historial-alumnos/page.jsx` | `getEstadoBadgeStyle` con key `'activo'` — DB usa `'validado'` | Cambiado a `ESTADO_BADGE_CLS` con CSS classes |

(Bugs 1-2 corregidos en esta sesión. Bugs 3-8 descubiertos y corregidos también en esta sesión.)

---

## Notas técnicas

### Auth pattern — `usuarios_admin` lookup
**Siempre** `.eq('email', user.email)`, nunca `.eq('id', user.id)`.  
Razón: `usuarios_admin.id` es un UUID propio de la tabla (no necesariamente igual a `auth.users.id`). La columna `email` es la FK real entre auth.users y usuarios_admin.  
Excepción segura: `obras.editor_id` sí referencia `auth.users.id` directamente (FK de BD).

### Server Component vs Client Component
- `layout.jsx` → **Server** (usa `createClient` de `@/lib/supabase/server`, `headers()`, `redirect`)
- Todas las `page.jsx` del admin → **Client** (`'use client'`, usan `createClient` de `@/lib/supabase/client`)
- `AdminHeader.jsx`, `SidebarNav.jsx`, `SidebarFooterActions.jsx` → **Client** (necesitan `usePathname`)

### Sidebar toggle mobile
Script inline `<script dangerouslySetInnerHTML>` en `layout.jsx` — seguro en Server Component. Actúa sobre `#sidebarToggle`, `#adminSidebar`, `#sidebarOverlay` vía IDs estáticos.

### Permisos — doble capa
1. **Frontend** — `usePermisos(rol).tienePermiso(key)` oculta/muestra UI
2. **Backend** — RLS en Supabase (SELECT/INSERT/UPDATE/DELETE por rol)  
Frontend es "defense-in-depth", RLS es la fuente de verdad real.

### `editor_id` vs `artista` para filtrar obras del editor
- **Mi Portafolio** filtra por `editor_id = currentUser.authId` (auth.users.id — correcto para el portafolio personal)
- **Obras** filtra por `artista = currentUser.email` (columna texto — como hace VanillaJS)
- Ambos filtros coexisten sin conflicto

### Imagen: borrado diferido (`pendiente_borrado`)
Obras Publicadas: imágenes marcadas `pendiente_borrado=true` no se borran inmediatamente. Solo se borran al aprobar una reapertura en DiffModal. Si se rechaza, se revierten.

### Paginación
- Obras, Usuarios: paginación server-side (Supabase `.range()`)
- Historial Alumnos: paginación con estado local
- Estadísticas: scroll infinito (IntersectionObserver + offset)
- Técnicas, Tags, Logs: carga completa + filtro local

---

## Checklist de testing completado (análisis de código)

### Flujos E2E
- [x] Flujo Admin (Login → Dashboard → Crear → Editar → Publicar → Logout)
- [x] Flujo Editor (Login → Mi Portafolio → Crear obra → Solicitar cambios)
- [x] Flujo Super Editor (igual que Admin sin acceso a control/logs/config)

### Modales
- [x] ObraForm — abre/cierra desde obras y mi-portafolio
- [x] ObraForm — `?nueva=1` en obras y mi-portafolio
- [x] ConfirmModal — obras, técnicas, tags, usuarios, historial
- [x] DiffModal — reaperturas (estado 'En Revisión' + motivo_reapertura)
- [x] Modal rechazo registros — motivo obligatorio

### Edge Functions
- [x] `validate-registro` — registros/page.jsx
- [x] `reject-registro` — registros/page.jsx (con `notas_admin`)
- [x] `notify-obra-approval` — DiffModal.jsx (aprobación y rechazo)
- [x] `create-admin-user` — usuarios/page.jsx (form + CSV import)
- [x] `delete-users-batch` — usuarios/page.jsx (individual + batch)
- [x] `convert-webp` — ImageUpload.jsx (graceful fallback)

### Permisos
- [x] Editor ve solo Mi Portafolio en sidebar
- [x] Admin ve todos los ítems del sidebar
- [x] Super Editor no ve control-registro / logs / configuracion
- [x] Acceso directo a ruta sin permiso → `router.replace('/admin')`
- [x] Sin sesión → `layout.jsx` redirige a `/admin/login`

### Visual
- [x] Logos `/logos/UNAM.svg` + `/logos/FAD.svg` — existen en `public/logos/`
- [x] Avatares de usuario con inicial y `ROL_COLOR` por rol
- [x] Thumbnails de obras con `.obra-thumb` (`.td-thumb`)
- [x] Badges de estado: `badge-publicado / badge-borrador / badge-revision / badge-archivado`
- [x] Badges de rol: inline styles (clases CSS `badge-admin/super_editor/editor` no existen en admin.css)
- [x] Input placeholder visible — CSS styles/admin.css tiene estilos de placeholder
- [x] Responsividad mobile — sidebar `.sidebar--open` con script inline

### Consistencia con VanillaJS
- [x] Dashboard: layout igual (stats-grid → stale → two-col top-visitas + últimas obras)
- [x] Obras: columnas Imagen|Título|Artista|Técnica|Tags|Estado|Acciones
- [x] Usuarios: columnas Email|Nº cuenta|Nombre|Rol|Estado|Acciones + ROL_COLOR avatares
- [x] Registros: columnas Nº Cuenta|Nombre|Email|Teléfono|WhatsApp|Fecha|Acciones
- [x] Historial: columnas Nombre|Nº Cuenta|Email|Estado|Fecha solicitud|Fecha resolución|Acciones
- [x] Estadísticas: RPC `get_historial_obras_visitas(p_ascending, p_limit, p_offset)` ✓
- [x] Configuración: tabs Acerca (ES+EN) / Créditos (reordenar ↑↓) / Redes (drag-handle)
- [x] Control Registro: `registro_config` con `registro_activo / fecha_inicio / fecha_fin / mensaje_personalizado`

### Bugs conocidos al cierre
Ninguno conocido. Todos los bugs encontrados durante la revisión fueron corregidos en esta sesión.
