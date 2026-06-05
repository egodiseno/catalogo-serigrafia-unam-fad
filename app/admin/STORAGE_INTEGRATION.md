# FASE 1.F: Integración de Storage en Formulario

## ¿Qué se necesita?

Para integrar upload de imágenes en el formulario crear/editar obra:

### 1. En HTML (formulario)

Agregar input de imagen ANTES del botón guardar:

```html
<div class="form-group">
  <label for="imagenInput">Imagen Principal</label>
  <input 
    type="file" 
    id="imagenInput" 
    name="imagen"
    accept="image/*"
  />
  
  <!-- Preview de imagen -->
  <div id="imagenPreview" style="margin-top: 12px; display: none;">
    <img id="previewImg" src="" alt="Preview" style="max-width: 200px; border-radius: 8px;">
    <button type="button" id="removeImageBtn" class="btn btn-danger btn-sm">
      Eliminar imagen
    </button>
  </div>
</div>
```

### 2. En JavaScript (obras-form.js)

En la función `saveObra()`, antes de guardar:

```javascript
// Si hay imagen, uploadear primero
let urlImagen = null;
const imagenInput = document.getElementById('imagenInput');

if (imagenInput && imagenInput.files.length > 0) {
  const file = imagenInput.files[0];
  
  console.log('📤 Subiendo imagen...');
  const uploadResult = await window.StorageModule.uploadImage(file, obraId);
  
  if (!uploadResult.success) {
    alert('Error al subir imagen: ' + uploadResult.error);
    return;
  }
  
  urlImagen = uploadResult.url;
  console.log('✅ Imagen subida:', urlImagen);
  
  // Guardar registro en tabla 'imagenes'
  await window.StorageModule.saveImageRecord(obraId, urlImagen, true);
}
```

### 3. Event listeners para preview

```javascript
// Preview al seleccionar imagen
const imagenInput = document.getElementById('imagenInput');
const previewContainer = document.getElementById('imagenPreview');
const previewImg = document.getElementById('previewImg');
const removeBtn = document.getElementById('removeImageBtn');

imagenInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  
  if (file) {
    // Generar preview
    const dataUrl = await window.StorageModule.generatePreview(file);
    previewImg.src = dataUrl;
    previewContainer.style.display = 'block';
  }
});

removeBtn.addEventListener('click', () => {
  imagenInput.value = '';
  previewContainer.style.display = 'none';
});
```

## Setup en Supabase

Antes de usar storage.js, necesitas:

### 1. Crear Bucket en Supabase

```sql
-- En SQL Editor de Supabase

CREATE BUCKET IF NOT EXISTS artworks;

-- Configurar RLS (Row Level Security)
CREATE POLICY "Public access" ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'artworks');

CREATE POLICY "Allow uploads" ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'artworks');

CREATE POLICY "Allow deletes for authenticated" ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'artworks');
```

O simplemente:
1. Ve a Supabase Dashboard
2. Storage → Create new bucket
3. Nombre: "artworks"
4. Público: SÍ

### 2. Verificar tabla 'imagenes'

Debe existir (creada en FASE 0):

```sql
CREATE TABLE imagenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  url_storage TEXT NOT NULL,
  principal BOOLEAN DEFAULT false,
  orden INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT now()
);
```

## Testing

### En navegador:

1. Abre: `http://localhost:8000/app/admin/`
2. Login
3. Dashboard → Obras → Nueva Obra
4. Completa formulario
5. Selecciona imagen (debe mostrar preview)
6. Guarda obra
7. Imagen se sube a Supabase Storage
8. URL se guarda en tabla 'imagenes'

### Verificar en Supabase:

1. Ve a Supabase Dashboard
2. Storage → artworks
3. Deberías ver carpetas con IDs de obras
4. Dentro: imágenes subidas (timestamp-random.jpg)

### En tabla 'imagenes':

1. Ve a SQL Editor
2. Ejecuta: `SELECT * FROM imagenes;`
3. Deberías ver registros con URLs públicas

## Troubleshooting

**"Bucket not found"**
→ Crear bucket 'artworks' en Supabase Storage

**"Upload failed"**
→ Verificar RLS policies en Storage
→ Verificar que archivo < 5MB

**"URL no se guarda"**
→ Verificar que tabla 'imagenes' existe
→ Verificar FK obra_id existe

**"Imagen no aparece en preview"**
→ Verificar que archivo es imagen válida (JPG, PNG, etc.)
→ Abrir consola: F12 → Console → buscar errores
