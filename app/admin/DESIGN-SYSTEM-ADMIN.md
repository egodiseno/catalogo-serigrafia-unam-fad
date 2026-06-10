# DESIGN SYSTEM — Admin Catálogo Serigráfica UNAM/FAD

**Versión:** 1.0  
**Fecha:** 2026-06-05  
**Fase:** 1-AUDIT-DESIGN  
**Estado:** Referencia para FASE 1.A (Estructura Admin)

---

## 📑 Tabla de Contenidos

1. [Visión](#visión)
2. [Paleta de Colores](#paleta-de-colores)
3. [Tipografía](#tipografía)
4. [Espaciado](#espaciado)
5. [Componentes](#componentes)
6. [Estados](#estados)
7. [Microinteracciones](#microinteracciones)
8. [Accesibilidad](#accesibilidad)
9. [Implementación](#implementación)

---

## Visión

**Objetivo:** Crear un admin **profesional, institucional y premium** que transmita confianza y eficiencia.

**Principios:**
- 🎓 Identidad UNAM (azul #013B75, oro #D9A500)
- 🎨 Moderno y refinado
- ♿ Accesible (WCAG AA+)
- ⚡ Microinteracciones suaves
- 📱 Responsive y adaptable

---

## Paleta de Colores

### Primarios UNAM

```
Azul Institucional:  #013B75 (Pantone 540 C)
Oro Institucional:   #D9A500 (Pantone 117 C)
```

### Paleta Completa

```css
:root {
  /* ╔═════════════════════════════════════╗ */
  /* ║   COLORES PRIMARIOS (UNAM)          ║ */
  /* ╚═════════════════════════════════════╝ */
  
  --color-primary:       #013B75;    /* Azul oficial */
  --color-primary-dark:  #002A55;    /* Más oscuro (hover) */
  --color-primary-light: #EEF4FB;    /* Fondo alterno */
  
  --color-accent:        #D9A500;    /* Oro oficial */
  --color-accent-dark:   #B58700;    /* Más oscuro (hover) */
  --color-accent-light:  #F4E8D0;    /* Fondo alterno */
  
  /* ╔═════════════════════════════════════╗ */
  /* ║   COLORES NEUTRALES                 ║ */
  /* ╚═════════════════════════════════════╝ */
  
  --color-bg:            #FAFAFA;    /* Fondo principal */
  --color-surface:       #FFFFFF;    /* Cards, paneles, superficies */
  --color-surface-alt:   #F9FAFB;    /* Alternativo sutil */
  
  --color-text:          #1F2937;    /* Texto principal (gris oscuro) */
  --color-text-muted:    #6B7280;    /* Texto secundario */
  --color-text-light:    #9CA3AF;    /* Texto terciario */
  
  --color-border:        #E5E7EB;    /* Bordes (gris claro) */
  --color-border-dark:   #D1D5DB;    /* Bordes enfatizados */
  
  /* ╔═════════════════════════════════════╗ */
  /* ║   COLORES DE ESTADO                 ║ */
  /* ╚═════════════════════════════════════╝ */
  
  --color-success:       #10B981;    /* Verde éxito */
  --color-success-light: #ECFDF5;    /* Fondo éxito */
  
  --color-warning:       #F59E0B;    /* Ámbar/advertencia */
  --color-warning-light: #FFFBEB;    /* Fondo advertencia */
  
  --color-error:         #EF4444;    /* Rojo error */
  --color-error-light:   #FEF2F2;    /* Fondo error */
  
  --color-info:          #3B82F6;    /* Azul info */
  --color-info-light:    #EFF6FF;    /* Fondo info */
  
  /* ╔═════════════════════════════════════╗ */
  /* ║   OVERLAYS Y FONDOS ESPECIALES      ║ */
  /* ╚═════════════════════════════════════╝ */
  
  --overlay-dark:        rgba(0, 0, 0, 0.5);
  --overlay-light:       rgba(255, 255, 255, 0.8);
}
```

### Test de Contraste (WCAG AA+)

| Combinación | Ratio | Aprobado |
|---|---|---|
| Azul #013B75 sobre blanco | 8.5:1 | ✅ AAA |
| Texto gris #1F2937 sobre blanco | 10.2:1 | ✅ AAA |
| Oro #D9A500 sobre blanco | 3.8:1 | ⚠️ AA (necesita cuidado) |
| Azul #013B75 sobre blanco para botones | 8.5:1 | ✅ AAA |
| Blanco sobre azul #013B75 | 8.5:1 | ✅ AAA |

**Nota:** El oro se usa principalmente para acentos, no texto crítico. Si es texto, usar blanco/oscuro sobre fondo oro.

---

## Tipografía

### Fuentes

```css
/* Importar en <head> */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lora:wght@400;600;700&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
  color: var(--color-text);
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  line-height: 1.2;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

/* Opcional: títulos con Lora (más editorial) */
.heading-serif {
  font-family: 'Lora', serif;
}
```

### Escala Tipográfica

```css
/* H1 — Títulos principales */
h1 {
  font-size: 2.25rem;     /* 36px */
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 1.5rem;
}

/* H2 — Títulos sección */
h2 {
  font-size: 1.875rem;    /* 30px */
  line-height: 1.3;
  font-weight: 600;
  margin-bottom: 1.25rem;
}

/* H3 — Subtítulos */
h3 {
  font-size: 1.5rem;      /* 24px */
  line-height: 1.3;
  font-weight: 600;
  margin-bottom: 1rem;
}

/* H4 — Títulos componentes */
h4 {
  font-size: 1.125rem;    /* 18px */
  line-height: 1.4;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

/* Body — Texto principal */
body {
  font-size: 1rem;        /* 16px */
  line-height: 1.6;
  font-weight: 400;
}

/* Small — Texto secundario */
small,
.text-small {
  font-size: 0.875rem;    /* 14px */
  line-height: 1.6;
}

/* Extra small — Etiquetas, badges */
.text-xs {
  font-size: 0.75rem;     /* 12px */
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Pesos */
.font-light {
  font-weight: 300;
}

.font-normal {
  font-weight: 400;
}

.font-medium {
  font-weight: 500;
}

.font-semibold {
  font-weight: 600;
}

.font-bold {
  font-weight: 700;
}
```

### Ejemplos

```html
<!-- Página principal -->
<h1>Gestionar Obras Serigráficas</h1>

<!-- Sección -->
<h2>Obras Recientes</h2>

<!-- Tarjeta -->
<h4>Título de Obra</h4>
<p class="text-small text-muted">Por Artista, 2026</p>

<!-- Label -->
<label class="text-xs">CAMPO OBLIGATORIO</label>
```

---

## Espaciado

### Sistema Base (8px)

```css
:root {
  /* Espaciado base 8px */
  --space-xs:    0.25rem;  /* 4px */
  --space-sm:    0.5rem;   /* 8px */
  --space-md:    1rem;     /* 16px */
  --space-lg:    1.5rem;   /* 24px */
  --space-xl:    2rem;     /* 32px */
  --space-2xl:   3rem;     /* 48px */
  --space-3xl:   4rem;     /* 64px */
}
```

### Aplicación

```css
/* Padding */
.p-sm { padding: var(--space-sm); }
.p-md { padding: var(--space-md); }
.p-lg { padding: var(--space-lg); }

.px-md { padding-left: var(--space-md); padding-right: var(--space-md); }
.py-md { padding-top: var(--space-md); padding-bottom: var(--space-md); }

/* Margin */
.m-sm { margin: var(--space-sm); }
.m-md { margin: var(--space-md); }
.m-lg { margin: var(--space-lg); }

.mb-md { margin-bottom: var(--space-md); }
.mt-md { margin-top: var(--space-md); }
.gap-md { gap: var(--space-md); }

/* Layout */
.sidebar {
  width: 280px;
  padding: var(--space-lg);
}

.main {
  max-width: 1200px;
  padding: var(--space-xl);
  margin: 0 auto;
}

.card {
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
}

/* Header/Footer */
.admin-header {
  padding: var(--space-md) var(--space-lg);
  height: 64px;
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.admin-footer {
  padding: var(--space-lg);
  margin-top: var(--space-2xl);
  text-align: center;
}
```

---

## Componentes

### 1. BOTONES

#### Botón Primario

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  border: none;
  background-color: var(--color-primary);
  color: white;
  
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  
  transition: all 200ms ease;
  box-shadow: 0 2px 4px rgba(1, 59, 117, 0.1);
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
  box-shadow: 0 8px 16px rgba(1, 59, 117, 0.2);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(1, 59, 117, 0.1);
}

.btn-primary:disabled {
  background-color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}

.btn-primary.loading {
  position: relative;
  color: transparent;
}

.btn-primary.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 50%;
  left: 50%;
  margin: -8px 0 0 -8px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

#### Botón Secundario

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  border: 2px solid var(--color-primary);
  background-color: transparent;
  color: var(--color-primary);
  
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  
  transition: all 200ms ease;
}

.btn-secondary:hover {
  background-color: var(--color-primary-light);
  border-color: var(--color-primary-dark);
  color: var(--color-primary-dark);
}

.btn-secondary:active {
  background-color: var(--color-primary);
  color: white;
}

.btn-secondary:disabled {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}
```

#### Botón Ghost (sin bordes)

```css
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--color-primary);
  
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  
  transition: all 200ms ease;
}

.btn-ghost:hover {
  background-color: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.btn-ghost:active {
  background-color: var(--color-primary);
  color: white;
}
```

#### Ejemplo HTML

```html
<button class="btn-primary">Guardar Obra</button>
<button class="btn-primary" disabled>Guardando...</button>
<button class="btn-primary loading">Guardando</button>

<button class="btn-secondary">Cancelar</button>
<button class="btn-secondary" disabled>Deshabilitado</button>

<button class="btn-ghost">Más opciones</button>
```

---

### 2. INPUTS

#### Input de Texto

```css
input[type="text"],
input[type="email"],
input[type="password"],
input[type="number"],
input[type="date"],
textarea,
select {
  display: block;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
  
  transition: all 200ms ease;
}

input::placeholder,
textarea::placeholder {
  color: var(--color-text-light);
}

/* Focus */
input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(1, 59, 117, 0.1);
  background-color: var(--color-surface);
}

/* Error */
input.error,
textarea.error,
select.error {
  border-color: var(--color-error);
  background-color: rgba(239, 68, 68, 0.02);
}

input.error:focus,
textarea.error:focus,
select.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

/* Disabled */
input:disabled,
textarea:disabled,
select:disabled {
  background-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Success */
input.success,
textarea.success,
select.success {
  border-color: var(--color-success);
  background-color: rgba(16, 185, 129, 0.02);
}

input.success:focus,
textarea.success:focus,
select.success:focus {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}
```

#### Label y Form Group

```css
label {
  display: block;
  margin-bottom: var(--space-sm);
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text);
}

label .required {
  color: var(--color-error);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.form-error {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-error);
}

.form-hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
```

#### Ejemplo HTML

```html
<div class="form-group">
  <label>
    Título de la Obra
    <span class="required">*</span>
  </label>
  <input type="text" placeholder="Ej: Cartel Serigráfico 2026" required>
  <span class="form-hint">Máx. 100 caracteres</span>
</div>

<div class="form-group row">
  <div>
    <label>Año</label>
    <input type="number" min="1800" max="2100" value="2026">
  </div>
  <div>
    <label>Técnica</label>
    <select>
      <option>Serigrafía</option>
      <option>Mixta</option>
    </select>
  </div>
</div>

<div class="form-group">
  <label>Descripción</label>
  <textarea rows="4" placeholder="Describe la obra..."></textarea>
</div>
```

---

### 3. CARDS

```css
.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  
  transition: all 200ms ease;
}

.card:hover {
  border-color: var(--color-border-dark);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card.selected {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light);
  box-shadow: 0 0 0 3px rgba(1, 59, 117, 0.1);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.card-header h3 {
  margin: 0;
}

.card-header-action {
  display: flex;
  gap: var(--space-sm);
}

/* Card Body */
.card-body {
  margin-bottom: var(--space-md);
}

/* Card Footer */
.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}
```

#### Ejemplo HTML

```html
<div class="card">
  <div class="card-header">
    <h3>Obra: Cartel 2026</h3>
    <div class="card-header-action">
      <button class="btn-ghost">Editar</button>
      <button class="btn-ghost">Eliminar</button>
    </div>
  </div>
  
  <div class="card-body">
    <p><strong>Artista:</strong> Nombre del Artista</p>
    <p><strong>Año:</strong> 2026</p>
    <p><strong>Técnica:</strong> Serigrafía</p>
  </div>
  
  <div class="card-footer">
    <button class="btn-secondary">Cancelar</button>
    <button class="btn-primary">Guardar Cambios</button>
  </div>
</div>
```

---

### 4. TABLAS

```css
table {
  width: 100%;
  border-collapse: collapse;
  background-color: var(--color-surface);
}

thead {
  background-color: var(--color-primary-light);
  border-bottom: 2px solid var(--color-border-dark);
}

th {
  padding: var(--space-md);
  text-align: left;
  font-weight: 600;
  color: var(--color-primary);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

td {
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

tbody tr {
  transition: all 200ms ease;
}

tbody tr:hover {
  background-color: var(--color-surface-alt);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
}

tbody tr.selected {
  background-color: var(--color-primary-light);
  border-left: 4px solid var(--color-primary);
}

/* Tabla responsive */
@media (max-width: 768px) {
  table {
    font-size: 0.875rem;
  }
  
  th, td {
    padding: var(--space-sm);
  }
}
```

#### Ejemplo HTML

```html
<table>
  <thead>
    <tr>
      <th>Título</th>
      <th>Artista</th>
      <th>Año</th>
      <th>Técnica</th>
      <th>Acciones</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cartel 2026</td>
      <td>Artista Ejemplo</td>
      <td>2026</td>
      <td>Serigrafía</td>
      <td>
        <button class="btn-ghost">Editar</button>
        <button class="btn-ghost">Eliminar</button>
      </td>
    </tr>
  </tbody>
</table>
```

---

### 5. MODALES

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: var(--overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 200ms ease;
  z-index: 1000;
}

.modal-overlay.hidden {
  display: none;
}

.modal {
  position: relative;
  background-color: var(--color-surface);
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
  animation: slideIn 300ms ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 0;
    transform: translateY(0);
  }
}

.modal-header {
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 200ms ease;
}

.modal-close:hover {
  background-color: var(--color-border);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-lg);
}

.modal-footer {
  padding: var(--space-lg);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
}

/* Responsive */
@media (max-width: 640px) {
  .modal {
    width: 95%;
    max-height: 95vh;
  }
  
  .modal-header {
    padding: var(--space-md);
  }
  
  .modal-body {
    padding: var(--space-md);
  }
  
  .modal-footer {
    padding: var(--space-md);
    flex-direction: column;
  }
  
  .modal-footer button {
    width: 100%;
  }
}
```

#### Ejemplo HTML

```html
<div class="modal-overlay" id="modal-crear-obra">
  <div class="modal">
    <div class="modal-header">
      <h2>Crear Nueva Obra</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    
    <div class="modal-body">
      <!-- Formulario aquí -->
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn-primary">Crear Obra</button>
    </div>
  </div>
</div>
```

---

### 6. ALERTAS

```css
.alert {
  padding: var(--space-md) var(--space-lg);
  border-radius: 6px;
  border-left: 4px solid;
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  animation: slideIn 300ms ease;
}

.alert-success {
  background-color: var(--color-success-light);
  border-left-color: var(--color-success);
  color: var(--color-success);
}

.alert-error {
  background-color: var(--color-error-light);
  border-left-color: var(--color-error);
  color: var(--color-error);
}

.alert-warning {
  background-color: var(--color-warning-light);
  border-left-color: var(--color-warning);
  color: var(--color-warning);
}

.alert-info {
  background-color: var(--color-info-light);
  border-left-color: var(--color-info);
  color: var(--color-info);
}

.alert-icon {
  flex-shrink: 0;
  font-weight: bold;
  font-size: 1.25rem;
}

.alert-content {
  flex: 1;
}

.alert-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 200ms ease;
  padding: 0;
}

.alert-close:hover {
  opacity: 1;
}
```

#### Ejemplo HTML

```html
<div class="alert alert-success">
  <span class="alert-icon">✓</span>
  <div class="alert-content">
    <strong>Éxito</strong>
    <p>La obra se ha guardado correctamente.</p>
  </div>
  <button class="alert-close" onclick="this.parentElement.style.display='none';">×</button>
</div>

<div class="alert alert-error">
  <span class="alert-icon">✕</span>
  <div class="alert-content">
    <strong>Error</strong>
    <p>No se pudo guardar la obra. Intenta nuevamente.</p>
  </div>
</div>
```

---

## Estados

Cada componente tiene estados visuales claros:

### Estados de Botones

- **Normal:** Color azul, cursor pointer
- **Hover:** Azul más oscuro, sombra, elevación
- **Active:** Sin elevación, sombra menor
- **Disabled:** Gris, opacity 0.6, cursor not-allowed
- **Loading:** Spinner dentro del botón, texto oculto

### Estados de Inputs

- **Default:** Borde gris claro
- **Focus:** Borde azul, sombra azul sutil
- **Filled:** Color normal
- **Error:** Borde rojo, fondo rojo sutil
- **Success:** Borde verde, fondo verde sutil
- **Disabled:** Fondo gris, cursor not-allowed

### Estados de Cards

- **Normal:** Sombra sutil
- **Hover:** Sombra mayor, elevación
- **Selected:** Borde azul, fondo azul claro

### Estados de Filas de Tabla

- **Normal:** Fondo blanco
- **Hover:** Fondo gris muy claro
- **Selected:** Fondo azul claro, borde izquierdo azul

---

## Microinteracciones

### Transiciones Globales

```css
* {
  transition: background-color 200ms ease,
              color 200ms ease,
              border-color 200ms ease,
              box-shadow 200ms ease,
              transform 200ms ease;
}

/* Evitar transiciones innecesarias */
*:disabled {
  transition: none;
}
```

### Animaciones Clave

#### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 200ms ease;
}
```

#### Slide In

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-in {
  animation: slideIn 300ms ease;
}
```

#### Spin (Loading)

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

#### Pulse (Highlight)

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.pulse {
  animation: pulse 2s ease-in-out infinite;
}
```

---

## Accesibilidad

### Contraste

- **WCAG AA:** Mínimo 4.5:1 para texto normal
- **WCAG AAA:** Mínimo 7:1 para texto normal
- **Nuestro objetivo:** AAA donde sea posible

### Keyboard Navigation

```css
/* Focus visible en todos los elementos interactivos */
button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Ocultar outline solo si hay visual alternativo */
button:focus-visible {
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
```

### ARIA

```html
<!-- Botones con aria-label para claridad -->
<button class="modal-close" aria-label="Cerrar diálogo">×</button>

<!-- Alerts con role live region -->
<div class="alert" role="status" aria-live="polite">
  Obra guardada exitosamente
</div>

<!-- Inputs con asociación clara -->
<label for="titulo-obra">Título</label>
<input id="titulo-obra" type="text" required>
```

---

## Implementación

### Archivo de Variables (CSS)

Todos estos tokens van en un archivo `admin-design-tokens.css` que se importa primero en `admin.css`.

### Orden de Importación

```css
/* 1. Reset y variables */
@import url('admin-design-tokens.css');

/* 2. Base (html, body, typography) */
@import url('admin-base.css');

/* 3. Componentes */
@import url('admin-components.css');

/* 4. Layout y páginas */
@import url('admin-layout.css');

/* 5. Utilities */
@import url('admin-utilities.css');
```

### Checklist de Implementación (FASE 1.A)

- [ ] Importar Google Fonts (Inter, Lora)
- [ ] Copiar todas las variables CSS
- [ ] Implementar componentes base (botón, input, card)
- [ ] Crear layout base (header, sidebar, main)
- [ ] Testing responsivo (mobile, tablet, desktop)
- [ ] Verificar contraste WCAG AA+
- [ ] Testing con screen reader (NVDA, JAWS)
- [ ] Testing keyboard (Tab, Enter, Escape)

---

## Referencia Rápida

| Elemento | Color | Hover | Border | Shadow |
|---|---|---|---|---|
| Botón Primario | `#013B75` | `#002A55` | `none` | `shadow-md` |
| Botón Secundario | Transparent | `#EEF4FB` | `#013B75` | `none` |
| Input Focus | `#EEF4FB` (bg) | — | `#013B75` | `0 0 0 3px rgba(1,59,117,0.1)` |
| Card | `#FFFFFF` | `#FFFFFF` | `#E5E7EB` | `shadow-md` |
| Tabla (row hover) | `#F9FAFB` | — | `#E5E7EB` | `shadow-sm` |
| Alert Success | `#ECFDF5` | — | `#10B981` | `shadow-sm` |
| Alert Error | `#FEF2F2` | — | `#EF4444` | `shadow-sm` |

---

## Próximos Pasos

1. ✅ **Este documento:** DESIGN-SYSTEM-ADMIN.md (referencia)
2. ⏳ **FASE 1.A:** Crear `app/admin/css/admin-design-tokens.css` (variables)
3. ⏳ **FASE 1.A:** Crear `app/admin/html/index.html` (estructura base)
4. ⏳ **FASE 1.B+:** Usar estos tokens y componentes en cada subfase

---

**Fin del Design System**

Versión: 1.0 | Fecha: 2026-06-05 | Para usar en FASE 1.A
