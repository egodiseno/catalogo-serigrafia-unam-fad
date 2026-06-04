# Admin Panel - FASE 1.A Setup

## 📋 Contenido

Estructura creada en FASE 1.A:

```
app/admin/
├── index.html              # Layout principal (sidebar + contenido)
├── css/
│   └── admin.css          # Tokens UNAM + componentes + layout responsive
├── js/
│   ├── config.js          # Cliente Supabase (necesita credenciales)
│   ├── navigation.js      # Manejo de secciones (sidebar clicks)
│   ├── auth.js            # Placeholder (se implementa en 1.B)
│   ├── dashboard.js       # Placeholder (se implementa en 1.C)
│   └── obras-list.js      # Placeholder (se implementa en 1.D)
└── README.md              # Este archivo
```

## 🚀 Cómo usar

### 1. Obtener credenciales Supabase

En tu proyecto Supabase:
1. Ve a **Settings → API**
2. Copia:
   - **URL:** `https://[project-id].supabase.co`
   - **Anon Key:** (visible en la página)

### 2. Configurar `.env`

En la raíz del proyecto (`catalogo-obra-serigrafica/`), edita `.env`:

```env
# Supabase
VITE_SUPABASE_URL=https://[tu-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Actualizar `config.js`

Opción A (Recomendado con Vite):
- El archivo ya usa `import.meta.env` → automático si tienes Vite

Opción B (Testing local sin bundler):
- Descomentar las líneas en `config.js`:
  ```javascript
  // const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
  // const SUPABASE_ANON_KEY = 'eyJhbGc...';
  ```

### 4. Cargar Supabase via CDN

En `index.html`, agregar ANTES de `<script src="js/config.js">`:

```html
<!-- Supabase JS Client (v2) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 5. Probar en navegador

```bash
# En la raíz del proyecto
python -m http.server 8000

# Luego visita:
# http://localhost:8000/app/admin/
```

Deberías ver:
- ✅ Página de login (si Supabase está correctamente configurado)
- ✅ Sidebar con navegación
- ✅ Sin errores en consola

## 📐 Tokens UNAM (en `admin.css`)

| Variable | Valor | Uso |
|----------|-------|-----|
| `--color-blue` | `#013b75` | Botones primary, headers, sidebar |
| `--color-gold` | `#d9a500` | Acentos, nav activo |
| `--color-blue-light` | `#eef4fb` | Backgrounds, hovers |
| `--color-surface` | `#ffffff` | Fondo cards, inputs |
| `--color-text` | `#212529` | Texto principal |

Todos los tokens están centralizados en `:root` de `admin.css`.

## 🎨 Componentes listos

### Buttons
```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-danger">Delete</button>
```

### Forms
```html
<div class="form-group">
  <label for="email">Email</label>
  <input type="email" id="email" />
</div>
```

### Tables
```html
<table>
  <thead>
    <tr><th>Título</th></tr>
  </thead>
  <tbody>
    <tr><td>Obra 1</td></tr>
  </tbody>
</table>
```

### Cards
```html
<div class="stat-card">
  <div class="stat-value">42</div>
  <div class="stat-label">Obras</div>
</div>
```

## ✅ Responsive

- **Desktop:** 2 columnas (sidebar + main)
- **Tablet (768px):** Sidebar horizontal, main en columna
- **Mobile (480px):** Stacked, sidebar horizontal como tabs

## 📝 Próximas fases

- **1.B:** Implementar login (auth.js)
- **1.C:** Dashboard con métricas (dashboard.js)
- **1.D:** Tabla de obras (obras-list.js)
- **1.E:** Crear/editar obras (obras-form.js)
- **1.F:** Upload de imágenes (storage.js)

## 🐛 Solución de problemas

**Error: "Supabase JS client no está cargado"**
→ Agregar CDN en `index.html` (línea anterior a scripts)

**Error: "Credenciales no configuradas"**
→ Llenar `.env` con credenciales reales de Supabase

**Sidebar no se ve en móvil**
→ Normal (FASE 1.A), se ajusta en 1.B cuando agreguemos responsive

## 📞 Git

Commit para esta fase:
```bash
git add app/admin/
git commit -m "FASE 1.A: Setup estructura admin (HTML + CSS + config)"
git push
```

---

**Status:** ✅ FASE 1.A Complete — Estructura lista para 1.B (Login)
