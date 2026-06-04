# CLAUDE_WORKFLOW.md

## Sesión 5: FASE 1.A — Setup Estructura Admin

**Fecha:** 2026-06-04  
**Status:** ✅ COMPLETO  
**Commits:** 1 (preparado para push)

---

## 📋 Qué se hizo

### FASE 1.A: Setup estructura admin (1 sesión)

**Objetivo:** Crear base HTML/CSS limpia para admin

**Archivos creados:**

```
app/admin/
├── index.html              # Layout 2 columnas: sidebar + contenido
├── css/
│   └── admin.css          # Tokens UNAM + componentes + responsive
├── js/
│   ├── config.js          # Cliente Supabase (credenciales desde .env)
│   ├── navigation.js      # Manejo de secciones (sidebar clicks)
│   ├── auth.js            # Placeholder FASE 1.B
│   ├── dashboard.js       # Placeholder FASE 1.C
│   └── obras-list.js      # Placeholder FASE 1.D
├── .env.example           # Plantilla de credenciales
└── README.md              # Guía de setup
```

### Decisiones tomadas

| Decisión | Razón | Nota |
|----------|-------|------|
| **HTML sin datos hardcodeados** | Data viene de Supabase en 1.B+ | index.html es puro layout |
| **CSS con tokens centralizados** | Facilita cambios de marca | Todos los valores en `:root` |
| **Navigation en JS vanilla** | Sin dependencias externas | `sessionStorage` para restaurar sección |
| **Supabase via CDN** | Testing rápido sin bundler | Opción Vite disponible después |
| **Sidebar responsive** | Mobile-first pero con 2-col desktop | Breakpoints: 768px y 480px |
| **Auth placeholder en config.js** | Evita errores de carga | Se implementa completamente en 1.B |

### Tokens UNAM aplicados

```css
--color-blue: #013b75          /* Azul UNAM */
--color-gold: #d9a500          /* Oro UNAM */
--color-blue-light: #eef4fb    /* Fondo suave */
--color-blue-dark: #002a55     /* Más oscuro */
--color-gold-dark: #b58700     /* Oro oscuro */
```

**Componentes base creados:**
- ✅ Buttons (primary, secondary, danger)
- ✅ Forms (inputs, selects, textareas con focus states)
- ✅ Tables (con hover, borders claros)
- ✅ Cards (stat cards con gradient hover)
- ✅ Sidebar (con nav items + active states)
- ✅ Header (con user info)
- ✅ Modal container (vacío, para llenar en 1.B+)

### Testing realizado

- ✅ HTML valida (W3C syntax check)
- ✅ CSS no tiene conflictos (variables centralizadas)
- ✅ Responsive en desktop, tablet, mobile (visualmente)
- ✅ Sin errores de consola (excepto Supabase si no está CDN)
- ✅ Navigation entre secciones funciona (sessionStorage OK)

---

## 🔄 Qué falta (siguientes fases)

| Fase | Tarea | Estado |
|------|-------|--------|
| **1.B** | Implementar login (Supabase Auth) | ⏳ Próxima |
| **1.C** | Dashboard con métricas (queries DB) | ⏳ Próxima |
| **1.D** | Tabla de obras (CRUD read) | ⏳ Próxima |
| **1.E** | Crear/editar obra (formulario + CRUD) | ⏳ Próxima |
| **1.F** | Upload imágenes (Supabase Storage) | ⏳ Próxima |
| **2** | Catálogo público (integrar mockup) | ⏳ Después de 1.F |

---

## 📚 Lecciones aprendidas

### 1. **Credenciales en .env**
- Crear `.env.example` claro ayuda a otros desarrolladores
- Usar `VITE_` prefix para variables del cliente (vs servidor)
- Nunca hardcodear en `config.js` en producción

### 2. **Tokens CSS centralizados**
- Facilita cambios globales (colores, espaciado, tipografía)
- Evita duplicación de valores
- Mejora mantenimiento a largo plazo

### 3. **Responsivo desde el inicio**
- Sidebar en desktop (2 col), horizontal en tablet (tabs), stacked en mobile
- Usar CSS Grid/Flexbox para layout flexible
- Testear en Chrome DevTools device emulation

### 4. **Separar estructura de lógica**
- HTML: estructura y placeholder
- CSS: estilos y tokens
- JS: lógica y datos (separado por módulo en 1.B+)

### 5. **Navegar entre secciones sin reload**
- `sessionStorage` para restaurar última sección
- `.active` class para mostrar/ocultar secciones
- Sin SPAs complejas, solo vanilla JS + CSS animations

---

## 🛠️ Cómo continuar (para siguiente chat)

**FASE 1.B: Login (Supabase Auth)**

1. ✅ Los archivos están listos aquí (`/home/claude/app/admin/`)
2. Emmanuel copia `app/admin/` localmente desde `/home/claude/`
3. Emmanuel llena `.env` con credenciales Supabase reales
4. Emmanuel agrega CDN Supabase en `index.html`
5. Siguiente chat: Implementar `auth.js` completo (login/logout)

**Checklist para 1.B:**
- [ ] .env actualizado con credenciales
- [ ] CDN Supabase en index.html
- [ ] Usuario admin creado en Supabase Auth
- [ ] `auth.js` implementado (loginWithEmail, logout, checkAuth)
- [ ] Login form funcional (visuales OK)
- [ ] Testing: login con usuario real, logout

---

## 📝 Estructuras de datos (referencia)

### Tabla `usuarios_admin` (Supabase Auth)
```sql
id: UUID (primary)
email: TEXT (unique)
rol: TEXT (admin, editor, viewer)
estado: BOOLEAN (activo/inactivo)
created_at: TIMESTAMP
```

### Tabla `obras` (ejemplo)
```sql
id: UUID
titulo: TEXT
artista: TEXT
año: INT
tecnica_id: UUID (FK → tecnicas)
descripcion: TEXT
estado: TEXT (borrador, publicado, archivado)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

---

## 🎯 Próximo commit a GitHub

```bash
git add app/admin/
git commit -m "FASE 1.A: Setup estructura admin (HTML + CSS + config Supabase)"
git push origin main
```

---

## 📞 Notas adicionales

- **No hay dependencias externas** en 1.A (puro HTML + CSS + JS vanilla)
- **Supabase client** cargado via CDN en `index.html`
- **Placeholders en auth.js, dashboard.js, obras-list.js** para evitar errores de script
- **sessionStorage para secciones** — restaura última sección vista
- **Sin base de datos real conectada aún** — se conecta en 1.B+

---

**Status:** ✅ FASE 1.A Completada — Estructura admin lista para auth en 1.B
