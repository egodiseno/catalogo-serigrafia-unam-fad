# IMPLEMENTACIÓN — Design System en FASE 1.A

**Documento:** Guía práctica para aplicar el Design System en la creación del admin  
**Fase:** FASE 1.A (Estructura Admin)  
**Objetivo:** Crear `app/admin/` con estructura HTML + CSS lista para las subfases 1.B → 1.F

---

## 📋 Archivos Entregables

Este diseño sistema consta de 3 archivos:

### 1. **DESIGN-SYSTEM-ADMIN.md** (Referencia)
- Documentación completa de colores, tipografía, espaciado
- Componentes y estados
- Microinteracciones
- Accesibilidad

**Uso:** Leer para entender los principios. Consultar cuando necesites confirmación de estilos.

### 2. **admin-design-tokens.css** (Base CSS)
- Variables CSS (colores, espaciado, tipografía, sombras, animaciones)
- Componentes reutilizables (botones, inputs, cards, tablas, modales, alertas)
- Reset y base
- Utilidades de espaciado

**Uso:** Importar PRIMERO en `app/admin/css/admin.css`. NO modificar para FASE 1.A.

### 3. **admin-components-examples.html** (Referencia visual)
- Ejemplos HTML de TODOS los componentes
- Cómo usar cada uno
- Estados (hover, disabled, error, success)

**Uso:** Abrir en navegador para ver cómo se ven. Copiar HTML según necesites.

---

## 🚀 Estructura que Crearás en FASE 1.A

```
app/admin/
├── index.html              ← Crear basado en estructura base
├── css/
│   ├── admin-design-tokens.css  ← Copiar archivo entregado
│   ├── admin.css            ← Crear (importa admin-design-tokens.css)
│   └── admin-layout.css     ← Crear en FASE 1.A (header, sidebar, main)
├── js/
│   ├── config.js            ← Crear en FASE 1.A
│   ├── auth.js              ← Crear en FASE 1.B
│   ├── dashboard.js         ← Crear en FASE 1.C
│   ├── obras-list.js        ← Crear en FASE 1.D
│   ├── obras-form.js        ← Crear en FASE 1.E
│   └── storage.js           ← Crear en FASE 1.F
└── data/
    └── mock.json            ← Crear en FASE 1.A (datos de prueba)
```

---

## 📝 Tareas Concretas para FASE 1.A

### Tarea 1: Copiar CSS Base

1. Copiar `admin-design-tokens.css` → `app/admin/css/admin-design-tokens.css`
2. Crear `app/admin/css/admin.css`:

```css
/* app/admin/css/admin.css */

/* 1. Importar tokens y componentes base */
@import url('admin-design-tokens.css');

/* 2. Aquí irán más importaciones en siguientes archivos */
/* @import url('admin-layout.css'); */
/* @import url('admin-pages.css'); */
```

### Tarea 2: Crear HTML Base

Crear `app/admin/index.html` con estructura base:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — Catálogo de Obra Serigráfica UNAM</title>
  
  <!-- CSS -->
  <link rel="stylesheet" href="css/admin.css">
</head>
<body>
  
  <div class="admin-layout">
    
    <!-- HEADER -->
    <header class="admin-header">
      <div class="header-logo">
        <!-- Logo UNAM aquí -->
        <h1>Catálogo Serigráfico</h1>
      </div>
      <div class="header-nav">
        <button id="logout-btn" class="btn btn-ghost">Salir</button>
      </div>
    </header>
    
    <div class="admin-container">
      
      <!-- SIDEBAR -->
      <aside class="admin-sidebar">
        <nav class="sidebar-nav">
          <ul>
            <li><a href="#dashboard" class="nav-item active">Dashboard</a></li>
            <li><a href="#obras" class="nav-item">Obras</a></li>
            <li><a href="#tecnicas" class="nav-item">Técnicas</a></li>
            <li><a href="#tags" class="nav-item">Tags</a></li>
            <li><a href="#usuarios" class="nav-item">Usuarios</a></li>
          </ul>
        </nav>
      </aside>
      
      <!-- MAIN -->
      <main class="admin-main">
        <div id="content">
          <!-- Aquí va el contenido dinámico -->
        </div>
      </main>
      
    </div>
  </div>
  
  <!-- Scripts -->
  <script src="js/config.js"></script>
  <!-- Más scripts se cargarán en siguientes fases -->
  
</body>
</html>
```

### Tarea 3: Crear Layout CSS

Crear `app/admin/css/admin-layout.css`:

```css
/* app/admin/css/admin-layout.css */

/* Layout principal */
.admin-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Header */
.admin-header {
  background-color: var(--color-primary);
  color: white;
  padding: var(--space-md) var(--space-lg);
  height: var(--header-height);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-md);
}

.header-logo h1 {
  margin: 0;
  font-size: var(--text-2xl);
  color: white;
}

.header-nav {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

/* Container (Sidebar + Main) */
.admin-container {
  display: flex;
  flex: 1;
}

/* Sidebar */
.admin-sidebar {
  width: var(--sidebar-width);
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: var(--space-lg);
  position: sticky;
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
  overflow-y: auto;
}

.sidebar-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  display: block;
  padding: var(--space-md) var(--space-lg);
  margin-bottom: var(--space-sm);
  color: var(--color-text);
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border-left-color: var(--color-primary);
}

.nav-item.active {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border-left-color: var(--color-primary);
  font-weight: var(--font-semibold);
}

/* Main */
.admin-main {
  flex: 1;
  padding: var(--space-xl);
  overflow-y: auto;
  background-color: var(--color-bg);
}

/* Responsive */
@media (max-width: 768px) {
  .admin-sidebar {
    position: fixed;
    left: 0;
    top: var(--header-height);
    height: auto;
    width: 100%;
    max-height: 300px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    z-index: 100;
  }
  
  .admin-container {
    flex-direction: column;
  }
  
  .sidebar-nav ul {
    display: flex;
    gap: var(--space-md);
    overflow-x: auto;
    padding: var(--space-md);
  }
  
  .nav-item {
    white-space: nowrap;
  }
  
  .admin-main {
    padding: var(--space-lg);
    margin-top: 100px;
  }
}
```

Actualizar `app/admin/css/admin.css`:

```css
/* app/admin/css/admin.css */

@import url('admin-design-tokens.css');
@import url('admin-layout.css');
```

### Tarea 4: Crear Config JS

Crear `app/admin/js/config.js`:

```javascript
// app/admin/js/config.js

/**
 * CONFIGURACIÓN — Admin Catálogo Serigráfica
 * 
 * Constantes y variables globales
 * Inicialización de cliente Supabase
 */

// ─────────────────────────────────────────────────────────────────
// CONFIGURACIÓN SUPABASE
// ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Cliente Supabase
 * Se inicializará cuando Supabase esté disponible (FASE 0)
 */
let supabaseClient = null;

function initSupabase() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    // Aquí se inicializará supabaseClient en FASE 1.B
    console.log('Supabase está configurado');
  } else {
    console.warn('Supabase no está configurado. Usa variables de entorno.');
  }
}

// ─────────────────────────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────────────────────────

const appState = {
  user: null,              // Usuario logueado
  works: [],              // Obras cargadas
  selectedWork: null,     // Obra seleccionada
  loading: false,         // Estado de carga
  error: null             // Mensaje de error
};

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────

/**
 * Mostrar mensaje de éxito
 */
function showSuccess(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success';
  alert.innerHTML = `
    <span class="alert-icon">✓</span>
    <div class="alert-content">
      <strong>Éxito</strong>
      <p>${message}</p>
    </div>
    <button class="alert-close">×</button>
  `;
  document.body.prepend(alert);
  
  alert.querySelector('.alert-close').addEventListener('click', () => alert.remove());
  setTimeout(() => alert.remove(), 5000);
}

/**
 * Mostrar mensaje de error
 */
function showError(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.innerHTML = `
    <span class="alert-icon">✕</span>
    <div class="alert-content">
      <strong>Error</strong>
      <p>${message}</p>
    </div>
    <button class="alert-close">×</button>
  `;
  document.body.prepend(alert);
  
  alert.querySelector('.alert-close').addEventListener('click', () => alert.remove());
}

/**
 * Mostrar loading spinner
 */
function showLoading() {
  appState.loading = true;
  document.body.style.cursor = 'wait';
}

/**
 * Ocultar loading spinner
 */
function hideLoading() {
  appState.loading = false;
  document.body.style.cursor = 'default';
}

// ─────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin inicializado');
  initSupabase();
  
  // Conectar eventos globales
  connectGlobalEvents();
});

/**
 * Conectar eventos globales (logout, etc)
 */
function connectGlobalEvents() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      console.log('Logout'); // Se implementará en FASE 1.B
    });
  }
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    appState,
    showSuccess,
    showError,
    showLoading,
    hideLoading
  };
}
```

### Tarea 5: Crear Mock Data (Opcional)

Crear `app/admin/data/mock.json` para testing sin Supabase (FASE 0 incompleta):

```json
{
  "works": [
    {
      "id": 1,
      "titulo": "Cartel UNAM 2026",
      "artista": "Artista Ejemplo",
      "año": 2026,
      "tecnica": "Serigrafía",
      "descripcion": "Cartel institucional para evento 2026",
      "estado": "publicado",
      "created_at": "2026-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "titulo": "Poster Institucional",
      "artista": "Diseñador FAD",
      "año": 2025,
      "tecnica": "Mixta",
      "descripcion": "Poster para exposición",
      "estado": "publicado",
      "created_at": "2025-12-01T14:20:00Z"
    }
  ],
  "tecnicas": [
    { "id": 1, "nombre": "Serigrafía", "slug": "serigrafia" },
    { "id": 2, "nombre": "Mixta", "slug": "mixta" },
    { "id": 3, "nombre": "Digital", "slug": "digital" }
  ],
  "tags": [
    { "id": 1, "nombre": "UNAM", "slug": "unam" },
    { "id": 2, "nombre": "Institucional", "slug": "institucional" },
    { "id": 3, "nombre": "Evento", "slug": "evento" }
  ]
}
```

---

## ✅ Checklist FASE 1.A

- [ ] Copiar `admin-design-tokens.css` a `app/admin/css/`
- [ ] Crear `app/admin/css/admin.css` e importar tokens
- [ ] Crear `app/admin/css/admin-layout.css`
- [ ] Crear `app/admin/index.html` con estructura base
- [ ] Crear `app/admin/js/config.js`
- [ ] Crear `app/admin/data/mock.json`
- [ ] Testing responsivo:
  - [ ] Desktop (1440px)
  - [ ] Tablet (768px)
  - [ ] Mobile (375px)
- [ ] Verificar sin errores en consola
- [ ] Verificar colores UNAM (#013B75, #D9A500)
- [ ] Verificar tipografía (Inter)
- [ ] Verificar contraste WCAG AA+ en elementos clave
- [ ] Git commit: "FASE 1.A: Estructura admin, Design System, layout base"

---

## 📖 Cómo Usar los Componentes en FASE 1.B+

### Botón Primario
```html
<button class="btn btn-primary">Guardar Obra</button>
<button class="btn btn-primary" disabled>Deshabilitado</button>
<button class="btn btn-primary loading">Guardando</button>
```

### Input con Error
```html
<div class="form-group">
  <label>Email <span class="required">*</span></label>
  <input type="email" class="error">
  <span class="form-error">Email no válido</span>
</div>
```

### Card con Contenido
```html
<div class="card">
  <div class="card-header">
    <h4>Título</h4>
    <button class="btn-ghost">Editar</button>
  </div>
  <div class="card-body">
    <p>Contenido aquí</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Guardar</button>
  </div>
</div>
```

### Tabla
```html
<table>
  <thead>
    <tr>
      <th>Columna 1</th>
      <th>Columna 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Dato 1</td>
      <td>Dato 2</td>
    </tr>
  </tbody>
</table>
```

### Alert/Mensaje
```html
<div class="alert alert-success">
  <span class="alert-icon">✓</span>
  <div class="alert-content">
    <strong>Éxito</strong>
    <p>Operación completada</p>
  </div>
</div>
```

---

## 🎨 Colores Rápido

```css
--color-primary: #013B75         /* Azul UNAM */
--color-accent: #D9A500          /* Oro UNAM */
--color-success: #10B981         /* Verde */
--color-error: #EF4444           /* Rojo */
--color-warning: #F59E0B         /* Ámbar */
--color-text: #1F2937            /* Gris oscuro */
--color-border: #E5E7EB          /* Gris claro */
```

---

## 📚 Archivos de Referencia

- **DESIGN-SYSTEM-ADMIN.md** → Documentación completa
- **admin-components-examples.html** → Ejemplos visuales (abrir en navegador)
- **admin-design-tokens.css** → Variables y componentes (importar en admin.css)

---

## Próximas Fases

**FASE 1.B:** Login (Supabase Auth)
- Usar `app/admin/css/admin-design-tokens.css` para estilos
- Crear formulario con `.btn-primary`, `.form-group`, etc.

**FASE 1.C:** Dashboard
- Usar cards (`.card`), tablas (`<table>`), colores UNAM

**FASE 1.D+:** Listados y formularios
- Usar inputs, buttons, alerts, modales con clases definidas

---

**¡El Design System está listo para usar en FASE 1.A!** 🎨
