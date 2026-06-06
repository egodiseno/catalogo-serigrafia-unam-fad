# 🔧 ADMIN: GUÍA DE INTEGRACIÓN FINAL

Después de ejecutar los 5 scripts (1.G a 1.K), necesitas hacer **integración manual** en HTML y JavaScript.

---

## 📋 RESUMEN

| Script | Crea | Necesita |
|--------|------|----------|
| **fase1g.sh** | multi-image-upload.js | HTML + JS integración |
| **fase1h.sh** | tags-in-obra.js | HTML + JS integración |
| **fase1i-j-k.sh** | 4 archivos JS (modals, técnicas, tags, usuarios) | HTML solo (JS auto) |

---

## 1️⃣ INTEGRACIÓN FASE 1.G (Multi-Image)

### HTML (en formulario "Nueva Obra")

Agregar DESPUÉS de descripción, ANTES de "Guardar obra":

```html
<!-- MULTI-IMAGE UPLOAD -->
<div class="form-group">
  <h3>Imágenes</h3>
  <p style="font-size: 12px; color: #666; margin-bottom: 12px;">
    Primera imagen = principal. Puedes agregar más.
  </p>
  
  <div id="multiImageContainer">
    <div id="imageList"></div>
    
    <button 
      type="button" 
      id="addImageBtn" 
      class="btn btn-secondary"
      style="margin-top: 12px;"
    >
      + Agregar imagen
    </button>
  </div>
</div>
<!-- FIN MULTI-IMAGE -->
```

### JavaScript (en obras-form.js, función `saveObra()`)

**Antes de** `await client.from('obras').insert(...)`:

```javascript
// ============ SUBIR IMÁGENES ============
console.log('📤 Subiendo imágenes...');

const uploadResult = await window.MultiImageUpload.uploadAll(obraId);

if (!uploadResult.success) {
  alert('Error al subir imágenes: ' + uploadResult.error);
  return;
}

// Guardar registros en tabla 'imagenes'
if (uploadResult.urls.length > 0) {
  const saveResult = await window.MultiImageUpload.saveAllImageRecords(
    obraId, 
    uploadResult.urls
  );
  
  if (!saveResult.success) {
    alert('Error guardando imágenes: ' + saveResult.error);
    return;
  }
}

console.log('✅ Imágenes guardadas');
```

### Al final de formulario, resetear imágenes:

```javascript
// Después de guardar exitoso
window.MultiImageUpload.reset();
```

---

## 2️⃣ INTEGRACIÓN FASE 1.H (Tags)

### HTML (en formulario "Nueva Obra")

Agregar ANTES de "Guardar obra", DESPUÉS de multi-image:

```html
<!-- TAGS -->
<div class="form-group">
  <h3>Tags</h3>
  
  <div style="display: flex; gap: 12px; margin-bottom: 12px;">
    <select id="tagSelect" style="flex: 1;"></select>
    <button 
      type="button" 
      id="addTagBtn" 
      class="btn btn-secondary"
    >
      Agregar
    </button>
  </div>
  
  <div id="selectedTagsList"></div>
</div>
<!-- FIN TAGS -->
```

### JavaScript (en obras-form.js)

**En función `saveObra()`, después de guardar obra**:

```javascript
// Guardar tags
if (window.TagsInObra) {
  const tagsResult = await window.TagsInObra.saveTags(obraId);
  if (!tagsResult.success) {
    console.error('Error guardando tags:', tagsResult.error);
  }
}
```

### Agregar event listener para botón "Agregar tag":

```javascript
const tagSelect = document.getElementById('tagSelect');
const addTagBtn = document.getElementById('addTagBtn');

if (addTagBtn && tagSelect) {
  addTagBtn.addEventListener('click', () => {
    const tagId = tagSelect.value;
    const tagName = tagSelect.options[tagSelect.selectedIndex].text;
    
    if (!tagId) {
      alert('Selecciona un tag');
      return;
    }
    
    window.TagsInObra.addTag(tagId, tagName);
    tagSelect.value = '';
  });
}
```

### Resetear tags al finalizar:

```javascript
window.TagsInObra.reset();
```

---

## 3️⃣ INTEGRACIÓN FASE 1.I/J/K (Modales CRUD)

✅ **Estos NO necesitan cambios HTML manuales**

Los botones ya existen en la estructura original:
- `id="newTecnicaBtn"` → Abre modal técnicas
- `id="newTagBtn"` → Abre modal tags
- `id="newUsuarioBtn"` → Abre modal usuarios

**JavaScript ya está conectado automáticamente.**

---

## 🧪 TESTING

### 1. Ejecutar scripts

```bash
bash admin-complete.sh
```

Esto ejecuta 1.G, 1.H, 1.I/J/K automáticamente.

### 2. Editar HTML y JavaScript

Sigue pasos 1️⃣ y 2️⃣ arriba.

### 3. Probar en navegador

```bash
python -m http.server 8000
```

Ir a: `http://localhost:8000/app/admin/`

### 4. Testing checklist

```
□ Login funciona
□ Dashboard muestra datos
□ Obras → Nueva Obra abre modal
□ Formulario tiene:
  - Multi-image inputs ✅
  - Tags select ✅
  - Todos los campos ✅
□ Seleccionar imágenes → ver previews
□ Agregar tags → ver chips
□ Guardar obra → imágenes se suben
□ Guardar obra → tags se guardan
□ Nueva Técnica (botón) → abre modal ✅
□ Nueva Técnica → crear técnica → OK
□ Nuevo Tag (botón) → abre modal ✅
□ Nuevo Tag → crear tag → OK
□ Nuevo Usuario (botón) → abre modal ✅
□ Nuevo Usuario → crear usuario → OK
□ Sin errores en consola (F12)
```

---

## 📝 CÓDIGO COMPLETO REFERENCIA

Si necesitas copiar/pegar completo, aquí va:

### HTML (formulario "Nueva Obra")

```html
<form id="newObraForm" class="form-modal">
  <!-- Título -->
  <div class="form-group">
    <label for="obraTitle">Título *</label>
    <input type="text" id="obraTitle" required />
  </div>

  <!-- Artista -->
  <div class="form-group">
    <label for="obraArtist">Artista *</label>
    <input type="text" id="obraArtist" required />
  </div>

  <!-- Año -->
  <div class="form-group">
    <label for="obraYear">Año *</label>
    <input type="number" id="obraYear" value="2024" required />
  </div>

  <!-- Técnica -->
  <div class="form-group">
    <label for="obraTecnica">Técnica</label>
    <select id="obraTecnica"></select>
  </div>

  <!-- Descripción -->
  <div class="form-group">
    <label for="obraDescription">Descripción</label>
    <textarea id="obraDescription"></textarea>
  </div>

  <!-- Estado -->
  <div class="form-group">
    <label for="obraStatus">Estado</label>
    <select id="obraStatus">
      <option value="borrador">Borrador</option>
      <option value="publicado">Publicado</option>
      <option value="archivado">Archivado</option>
    </select>
  </div>

  <!-- MULTI-IMAGE -->
  <div class="form-group">
    <h3>Imágenes</h3>
    <p style="font-size: 12px; color: #666; margin-bottom: 12px;">
      Primera imagen = principal
    </p>
    
    <div id="multiImageContainer">
      <div id="imageList"></div>
      <button type="button" id="addImageBtn" class="btn btn-secondary" style="margin-top: 12px;">
        + Agregar imagen
      </button>
    </div>
  </div>

  <!-- TAGS -->
  <div class="form-group">
    <h3>Tags</h3>
    
    <div style="display: flex; gap: 12px; margin-bottom: 12px;">
      <select id="tagSelect" style="flex: 1;"></select>
      <button type="button" id="addTagBtn" class="btn btn-secondary">
        Agregar
      </button>
    </div>
    
    <div id="selectedTagsList"></div>
  </div>

  <!-- BOTONES -->
  <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
    <button type="button" class="btn btn-secondary" id="cancelNewObra">
      Cancelar
    </button>
    <button type="submit" class="btn btn-primary">
      Guardar obra
    </button>
  </div>
</form>
```

### JavaScript (obras-form.js, función saveObra())

```javascript
async function saveObra(e) {
  if (e) e.preventDefault();

  const obraId = 'uuid-nuevo-o-existente'; // Tu lógica

  // Validaciones básicas
  const title = document.getElementById('obraTitle')?.value;
  if (!title) {
    alert('Título requerido');
    return;
  }

  try {
    // 1. Subir imágenes
    const uploadResult = await window.MultiImageUpload.uploadAll(obraId);
    if (!uploadResult.success) {
      alert('Error imágenes: ' + uploadResult.error);
      return;
    }

    // 2. Guardar registros imágenes
    if (uploadResult.urls.length > 0) {
      await window.MultiImageUpload.saveAllImageRecords(obraId, uploadResult.urls);
    }

    // 3. Guardar datos obra en DB
    const { error } = await window.supabase_client
      .from('obras')
      .insert([{
        id: obraId,
        titulo: title,
        artista: document.getElementById('obraArtist')?.value,
        año: parseInt(document.getElementById('obraYear')?.value || 2024),
        tecnica_id: document.getElementById('obraTecnica')?.value || null,
        descripcion: document.getElementById('obraDescription')?.value,
        estado: document.getElementById('obraStatus')?.value || 'borrador'
      }]);

    if (error) throw error;

    // 4. Guardar tags
    if (window.TagsInObra) {
      await window.TagsInObra.saveTags(obraId);
    }

    // 5. Resetear y cerrar
    alert('✅ Obra guardada exitosamente');
    window.MultiImageUpload.reset();
    window.TagsInObra?.reset();
    closeNewObraModal();
    
  } catch (error) {
    alert('❌ Error: ' + error.message);
    console.error(error);
  }
}
```

---

## ⚠️ COMMON ISSUES

**"MultiImageUpload is not defined"**
→ Verificar que multi-image-upload.js está en HTML

**"TagsInObra is not defined"**
→ Verificar que tags-in-obra.js está en HTML

**"Modal no abre"**
→ Verificar que modals.js, tecnicas-crud.js, etc. están en HTML

**"Tags no se guardan"**
→ Verificar que tabla obra_tags existe en Supabase

**"Imágenes no se suben"**
→ Verificar que bucket 'artworks' existe
→ Verificar credenciales .env correctas

---

## 🚀 QUICK START

```bash
# 1. Ejecutar scripts
bash admin-complete.sh

# 2. Editar archivos
# Sigue pasos en 1️⃣ 2️⃣ arriba

# 3. Probar
python -m http.server 8000
# http://localhost:8000/app/admin/

# 4. Git
git add .
git commit -m "Admin completo: FASE 1.G-1.K"
git push
```

---

**Status:** Scripts listos + Guía integración completa 🎉
