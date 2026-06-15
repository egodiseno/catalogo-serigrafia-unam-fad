/**
 * PHASE 1.G: Multi-Image Upload Module
 * Maneja múltiples imágenes: 1 principal + N complementarias
 */

const MultiImageUpload = (() => {
  let images = []; // Array de imágenes seleccionadas
  const MAX_IMAGES = 4;

  /**
   * Inicializar UI para multi-imagen
   */
  // ── Actualizar contador e indicador visual ─────────────
  function updateCounter() {
    const count    = images.filter(img => img.file !== null).length;
    const counter  = document.getElementById('imageCounter');
    const addBtn   = document.getElementById('addImageBtn');
    const atLimit  = images.length >= MAX_IMAGES;

    if (counter) {
      counter.textContent = `${count} de ${MAX_IMAGES} imágenes`;
      counter.classList.toggle('at-limit', atLimit);
    }
    if (addBtn) {
      addBtn.disabled = atLimit;
      addBtn.title    = atLimit ? `Máximo ${MAX_IMAGES} imágenes por obra` : '';
    }
  }

  function init() {
    console.log('📸 Multi-image module loaded');

    const imageContainer = document.getElementById('multiImageContainer');
    const addImageBtn = document.getElementById('addImageBtn');
    const imageList = document.getElementById('imageList');

    if (!imageContainer) {
      console.warn('⚠️  multiImageContainer no encontrado en HTML');
      return;
    }

    if (addImageBtn) {
      addImageBtn.addEventListener('click', () => {
        if (images.length >= MAX_IMAGES) {
          window.ErrorHandler?.showToast(`Máximo ${MAX_IMAGES} imágenes por obra`, 'warning');
          return;
        }
        addImageInput();
      });
    }

    // Agregar primer input automáticamente
    if (!imageList || imageList.children.length === 0) {
      addImageInput();
    }

    setupDragDrop();
    updateCounter();
  }

  /**
   * Agregar nuevo input de imagen
   */
  function addImageInput() {
    const imageList = document.getElementById('imageList');
    const index = images.length;

    const html = `
      <div class="image-input-group" data-index="${index}">
        <div class="image-input-row">
          <label>Imagen ${index + 1}</label>
          <div class="image-input-controls">
            <input 
              type="file" 
              class="imageInput" 
              data-index="${index}"
              accept="image/*"
            />
            <label class="checkbox-principal">
              <input 
                type="checkbox" 
                class="imagePrincipal" 
                data-index="${index}"
                ${index === 0 ? 'checked' : ''}
              />
              Principal
            </label>
            ${index > 0 ? `<button type="button" class="btn btn-danger btn-sm removeImage" data-index="${index}">Eliminar</button>` : ''}
          </div>
        </div>
        
        <div class="image-preview-container" style="display: none;">
          <img class="image-preview" src="" alt="Preview" style="max-width: 150px; border-radius: 8px; margin-top: 8px;">
          <span class="file-name" style="display: block; font-size: 12px; margin-top: 4px; color: #666;"></span>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    imageList.appendChild(div);

    // Event listeners
    const input = div.querySelector('.imageInput');
    const checkbox = div.querySelector('.imagePrincipal');
    const removeBtn = div.querySelector('.removeImage');

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        images[index] = { file, principal: checkbox.checked };
        await showPreview(div, file);
        updateCounter();
      }
    });

    checkbox.addEventListener('change', () => {
      // Desmarcar otros checkboxes
      document.querySelectorAll('.imagePrincipal').forEach((cb, i) => {
        if (i !== index) cb.checked = false;
      });
      if (images[index]) {
        images[index].principal = checkbox.checked;
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        images.splice(index, 1);
        div.remove();
        // Renumerar
        document.querySelectorAll('.image-input-group').forEach((el, i) => {
          el.setAttribute('data-index', i);
          el.querySelector('label').textContent = `Imagen ${i + 1}`;
        });
        updateCounter();
      });
    }

    images[index] = { file: null, principal: index === 0 };
    updateCounter();
  }

  /**
   * Mostrar preview de imagen
   */
  async function showPreview(element, file) {
    const previewContainer = element.querySelector('.image-preview-container');
    const previewImg = element.querySelector('.image-preview');
    const fileName = element.querySelector('.file-name');

    const dataUrl = await window.StorageModule.generatePreview(file);
    previewImg.src = dataUrl;
    fileName.textContent = file.name;
    previewContainer.style.display = 'block';
  }

  /**
   * Obtener imágenes para guardar
   * @returns {Array} [{ file, principal, fileName }]
   */
  function getImages() {
    return images.filter(img => img.file !== null);
  }

  /**
   * Subir todas las imágenes a Storage
   * @param {string} obraId - ID de la obra
   * @returns {Promise} { success, urls: [{ url, principal }], error }
   */
  async function uploadAll(obraId) {
    try {
      const imagesToUpload = getImages();

      if (imagesToUpload.length === 0) {
        return { success: true, urls: [], message: 'Sin imágenes' };
      }

      const results = [];

      for (let i = 0; i < imagesToUpload.length; i++) {
        const img = imagesToUpload[i];
        const label = `${i + 1}/${imagesToUpload.length}`;
        console.log(`📤 Subiendo imagen ${label}…`);

        // Feedback de progreso al usuario
        if (imagesToUpload.length > 1) {
          window.ErrorHandler?.showToast(`Subiendo imagen ${label}…`, 'info');
        }

        const uploadResult = await window.StorageModule.uploadImage(img.file, obraId);

        if (uploadResult.success) {
          results.push({
            url: uploadResult.url,
            principal: img.principal,
            orden: i + 1,
          });
          console.log(`✅ Imagen ${label} subida`);
        } else {
          throw new Error(`Error en imagen ${label}: ${uploadResult.error}`);
        }
      }

      console.log(`✅ Todas las imágenes subidas (${results.length})`);

      return { success: true, urls: results };
    } catch (error) {
      console.error('❌ Error uploading images:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Guardar todos los registros en tabla imagenes
   */
  async function saveAllImageRecords(obraId, urls) {
    try {
      const client = window.supabase_client;

      for (const img of urls) {
        await window.StorageModule.saveImageRecord(obraId, img.url, img.principal);
      }

      console.log(`✅ ${urls.length} registros guardados en tabla imagenes`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving records:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resetear formulario
   */
  function reset() {
    images = [];
    const imageList = document.getElementById('imageList');
    if (imageList) imageList.innerHTML = '';
    addImageInput();
    updateCounter();
  }

  // ── Drag-drop sobre #multiImageContainer ──────────────
  /**
   * Procesa archivos soltados en la zona de imágenes.
   * Reutiliza los slots vacíos existentes; crea nuevos si es necesario.
   */
  async function handleDroppedFiles(files) {
    const imageList = document.getElementById('imageList');
    if (!imageList) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      window.ErrorHandler?.showToast('Solo se aceptan imágenes (JPG, PNG, WebP)', 'warning');
      return;
    }

    let added = 0;
    for (const file of imageFiles) {
      // Buscar un slot vacío existente
      const emptyIndex = images.findIndex(img => img.file === null);

      if (emptyIndex >= 0) {
        // Rellenar slot vacío
        images[emptyIndex] = { file, principal: emptyIndex === 0 };
        const wrapper = imageList.children[emptyIndex];
        try { if (wrapper) await showPreview(wrapper, file); } catch (_) { /* preview opcional */ }
        added++;
      } else if (images.length < MAX_IMAGES) {
        // Crear slot nuevo y rellenarlo
        addImageInput();
        const newIndex = images.length - 1;
        images[newIndex] = { file, principal: newIndex === 0 };
        const wrapper = imageList.children[newIndex];
        try { if (wrapper) await showPreview(wrapper, file); } catch (_) { /* preview opcional */ }
        added++;
      } else {
        window.ErrorHandler?.showToast(`Máximo ${MAX_IMAGES} imágenes permitidas`, 'warning');
        break;
      }
    }

    if (added > 0) {
      window.ErrorHandler?.showToast(
        `${added} imagen${added > 1 ? 'es agregadas' : ' agregada'}`,
        'success'
      );
    }
  }

  /**
   * Conecta drag-and-drop al contenedor #multiImageContainer.
   * Llamado al final de init().
   */
  function setupDragDrop() {
    const container = document.getElementById('multiImageContainer');
    if (!container) return;

    // Prevenir comportamiento default del browser en todos los eventos
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
      container.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
    );

    // Resaltar zona al arrastrar encima
    container.addEventListener('dragenter', () => container.classList.add('drag-over'));

    // Quitar resaltado solo al salir del contenedor (no de sus hijos)
    container.addEventListener('dragleave', e => {
      if (!container.contains(e.relatedTarget)) {
        container.classList.remove('drag-over');
      }
    });

    // Procesar archivos soltados
    container.addEventListener('drop', async e => {
      container.classList.remove('drag-over');
      await handleDroppedFiles(e.dataTransfer.files);
    });

    console.log('🖼️  Drag-drop conectado a #multiImageContainer');
  }

  // Inicializar
  let initalized = false;
document.addEventListener('DOMContentLoaded', () => {
  if (!initalized) {
    initalized = true;
    init();
  }
});

  return {
    addImageInput,
    getImages,
    uploadAll,
    saveAllImageRecords,
    reset,
    handleDroppedFiles,   // expuesto para testing
  };
})();

window.MultiImageUpload = MultiImageUpload;
console.log('✅ Multi-image module ready');
