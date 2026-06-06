# 📋 ADMIN PENDIENTES — Plan completo FASE 1.G-1.K

Estado actual: **FASE 1.F completada**  
Pendiente: **5 tareas críticas para terminar admin 100%**

---

## 📝 TAREAS PENDIENTES

### 1️⃣ FASE 1.G: Multi-Image Upload (Principal + Complementarias)

**Problema actual:** Solo permite 1 imagen

**Solución necesaria:**
```
- Input principal (checkbox "principal")
- Inputs complementarios (agregar/eliminar dinámicamente)
- Preview de todas las imágenes
- Al guardar: todas se suben a Storage
- Se guardan en tabla imagenes con orden
```

**Archivos a crear/actualizar:**
- `multi-image-upload.js` (nuevo)
- `obras-form.js` (actualizar)
- `index.html` (agregar inputs)
- `admin.css` (estilos para galería)

**Estimado:** 45 min

---

### 2️⃣ FASE 1.H: Tags en Formulario Obra

**Problema actual:** No hay campo para agregar tags al crear obra

**Solución necesaria:**
```
- Select/checkboxes con tags existentes
- Opción "Nuevo tag" inline
- Al guardar obra: guardar en tabla obra_tags (N:M)
- Mostrar tags agregados
```

**Archivos a crear/actualizar:**
- `obras-form.js` (agregar lógica tags)
- `index.html` (agregar select tags)
- `admin.css` (estilos tags)

**Estimado:** 30 min

---

### 3️⃣ FASE 1.I: Modal Técnicas (CRUD)

**Problema actual:** Botón "Nueva técnica" no abre modal

**Solución necesaria:**
```
- Modal genérico reutilizable
- Formulario: nombre, descripción
- CRUD: Crear, leer, editar, eliminar
- Al crear: actualiza dropdown en obras-form
```

**Archivos a crear/actualizar:**
- `modals.js` (nuevo - gestor de modales)
- `tecnicas-crud.js` (nuevo)
- `index.html` (agregar modal genérico)
- `admin.css` (estilos modal)

**Estimado:** 40 min

---

### 4️⃣ FASE 1.J: Modal Tags (CRUD)

**Problema actual:** Botón "Nuevo tag" no abre modal

**Solución necesaria:**
```
- Modal genérico reutilizable
- Formulario: nombre, slug
- CRUD: Crear, leer, editar, eliminar
- Al crear: actualiza tabla tags
```

**Archivos a crear/actualizar:**
- `tags-crud.js` (nuevo)
- `index.html` (actualizar modal genérico)
- `admin.css` (reutilizar estilos)

**Estimado:** 40 min

---

### 5️⃣ FASE 1.K: Modal Usuarios (CRUD)

**Problema actual:** Botón "Nuevo usuario" no abre modal

**Solución necesaria:**
```
- Modal genérico reutilizable
- Formulario: email, rol, estado
- CRUD: Crear, leer, editar, eliminar
- Usa Supabase Auth para usuarios
```

**Archivos a crear/actualizar:**
- `usuarios-crud.js` (nuevo)
- `index.html` (actualizar modal genérico)
- `admin.css` (reutilizar estilos)

**Estimado:** 40 min

---

## 📊 RESUMEN

| Fase | Tarea | Prioridad | Estimado | Estado |
|------|-------|-----------|----------|--------|
| 1.G | Multi-image upload | 🔴 CRÍTICA | 45 min | ⏳ Pendiente |
| 1.H | Tags en obra | 🔴 CRÍTICA | 30 min | ⏳ Pendiente |
| 1.I | Modal técnicas | 🟡 ALTA | 40 min | ⏳ Pendiente |
| 1.J | Modal tags | 🟡 ALTA | 40 min | ⏳ Pendiente |
| 1.K | Modal usuarios | 🟡 MEDIA | 40 min | ⏳ Pendiente |

**Total estimado:** ~195 minutos = **3.5 horas** (automatizado en scripts)

---

## 🎯 EJECUCIÓN PROPUESTA

### Orden de implementación:

```
1. FASE 1.G: Multi-image (base para todo)
2. FASE 1.H: Tags (relación N:M)
3. FASE 1.I: Técnicas (CRUD modal)
4. FASE 1.J: Tags CRUD (igual que técnicas)
5. FASE 1.K: Usuarios CRUD (igual que técnicas)
```

### Scripts a crear:

```bash
fase1g.sh          # Multi-image
fase1h.sh          # Tags en obra
fase1i.sh          # Técnicas CRUD
fase1j.sh          # Tags CRUD
fase1k.sh          # Usuarios CRUD
admin-complete.sh  # Menú final (todas las fases)
```

---

## 💡 ARQUITECTURA MODAL GENÉRICA

Para FASES 1.I, 1.J, 1.K usaremos **mismo modal reutilizable**:

```javascript
// modals.js
const ModalManager = {
  open(title, fields, onSave),
  close(),
  showError(msg),
  showSuccess(msg)
}

// Uso en tecnicas-crud.js
ModalManager.open('Nueva Técnica', [
  { name: 'nombre', label: 'Nombre', type: 'text' },
  { name: 'descripcion', label: 'Descripción', type: 'textarea' }
], async (data) => {
  // Guardar en DB
  await client.from('tecnicas').insert(data);
});
```

---

## ✅ CHECKLIST

```
ANTES DE EMPEZAR:

□ Entendiste el plan (5 fases)
□ Decidiste orden de ejecución
□ Tienes `repo/` local actualizado
□ Estás en rama main
□ Git status limpio

DURANTE EJECUCIÓN:

□ Ejecutar fase1g.sh (multi-image)
□ Ejecutar fase1h.sh (tags en obra)
□ Ejecutar fase1i.sh (técnicas)
□ Ejecutar fase1j.sh (tags)
□ Ejecutar fase1k.sh (usuarios)
□ Probar cada fase en navegador
□ Git commits después de cada fase

AL FINALIZAR:

□ Admin 100% funcional
□ Todos los CRUD funcionan
□ Modales abren/cierran
□ No hay errores en consola
□ Git push final
□ Documentación actualizada
```

---

## 🚀 ¿EMPEZAMOS?

¿Quieres que cree los **5 scripts** ahora?

```bash
bash fase1g.sh  # Multi-image
bash fase1h.sh  # Tags
bash fase1i.sh  # Técnicas
bash fase1j.sh  # Tags CRUD
bash fase1k.sh  # Usuarios
```

O preferirías que haga todo en **un script maestro**?

```bash
bash admin-complete.sh  # Ejecuta todas las fases
```

---

**Decide:** ¿Los 5 scripts por separado o 1 maestro? 🚀
