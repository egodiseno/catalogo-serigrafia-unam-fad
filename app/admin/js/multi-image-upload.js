/**
 * PHASE 1.G: Multi-Image Upload Module
 * Maneja múltiples imágenes: 1 principal + N complementarias
 */

const MultiImageUpload = (() => {
  let images = []; // Array de imágenes seleccionadas
  let existingCount = 0; // Imágenes ya guardadas en DB (al editar obra)
  let hasPrincipal  = false; // true si ya hay una imagen guardada marcada como principal
  const MAX_IMAGES = 4;

  /**
   * Inicializar UI para multi-imagen
   */
  // ── Actualizar contador e indicador visual ─────────────
  function updateCounter() {
    const newCount  = images.filter(img => img.file !== null).length;
    const total     = newCount + existingCount;          // combinado: guardadas + nuevas
    const remaining = MAX_IMAGES - existingCount;        // slots nuevos disponibles
    const atLimit   = images.length >= remaining;        // no caben más slots nuevos

    const counter = document.getElementById('imageCounter');
    const addBtn  = document.getElementById('addImageBtn');

    if (counter) {
      counter.textContent = `${total} de ${MAX_IMAGES} imágenes`;
      counter.classList.toggle('at-limit', total >= MAX_IMAGES);
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
        if (images.length >= MAX_IMAGES - existingCount) {
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
    const remaining = MAX_IMAGES - existingCount;
    if (images.length >= remaining) return; // guard defensivo
    const index      = images.length;
    const labelNum   = existingCount + index + 1; // posición real (guardadas + nuevas)

    const html = `
      <div class="image-input-group" data-index="${index}">
        <div class="image-input-row">
          <label>Imagen ${labelNum}</label>
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
                ${!hasPrincipal && index === 0 ? 'checked' : ''}
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

    images[index] = { file: null, principal: !hasPrincipal && index === 0 };
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

  // ── Helpers de progreso por imagen ────────────────────────────────────
  /** Configuración visual de cada estado */
  const _PHASE_CFG = {
    uploading:  { icon: 'loader',       spin: true,  label: 'Subiendo…',        css: 'uploading'  },
    processing: { icon: 'loader',       spin: true,  label: 'Procesando WebP…', css: 'processing' },
    done:       { icon: 'check-circle', spin: false, label: 'Lista',            css: 'done'       },
    error:      { icon: 'alert-circle', spin: false, label: 'Error',            css: 'error'      },
  };

  /**
   * Actualiza el HTML de un elemento .upload-progress-item.
   * @param {HTMLElement} el       - elemento contenedor del ítem
   * @param {string}      filename - nombre del archivo (para el label)
   * @param {string}      state    - 'uploading' | 'processing' | 'done' | 'error'
   * @param {string}      [errMsg] - mensaje breve de error (solo para state='error')
   */
  function _setItemStatus(el, filename, state, errMsg) {
    if (!el) return;
    const cfg = _PHASE_CFG[state] || _PHASE_CFG.error;

    el.className = `upload-progress-item upload-progress-item--${cfg.css}`;
    el.innerHTML = `
      <i data-lucide="${cfg.icon}"
         class="upload-pi__icon${cfg.spin ? ' spin-anim' : ''}"
         aria-hidden="true"></i>
      <span class="upload-pi__filename"></span>
      <span class="upload-pi__state">${state === 'error' && errMsg ? _truncate(errMsg, 40) : cfg.label}</span>
    `;
    // Usar textContent para el nombre (evita XSS y problemas de encoding)
    el.querySelector('.upload-pi__filename').textContent = _truncate(filename, 35);

    // Re-renderizar ícono Lucide en el elemento actualizado
    if (window.lucide) window.lucide.createIcons();
  }

  /** Trunca una cadena añadiendo '…' si excede maxLen */
  function _truncate(str, maxLen) {
    const s = String(str || '');
    return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
  }

  /**
   * Subir todas las imágenes a Storage.
   * Muestra un indicador de estado por archivo en #uploadProgressList.
   * @param {string} obraId - ID de la obra
   * @returns {Promise} { success, urls: [{ url, principal, orden }], error }
   */
  async function uploadAll(obraId) {
    const progressList = document.getElementById('uploadProgressList');

    try {
      const imagesToUpload = getImages();

      if (imagesToUpload.length === 0) {
        return { success: true, urls: [], message: 'Sin imágenes' };
      }

      // ── Inicializar lista de progreso ─────────────────────────
      if (progressList) {
        progressList.innerHTML = '';
        progressList.removeAttribute('hidden');
      }

      // Crear un ítem de progreso por cada imagen (estado inicial: uploading)
      const progressItems = imagesToUpload.map(img => {
        const el = document.createElement('div');
        progressList?.appendChild(el);
        _setItemStatus(el, img.file.name, 'uploading');
        return el;
      });

      const results = [];

      for (let i = 0; i < imagesToUpload.length; i++) {
        const img   = imagesToUpload[i];
        const itemEl = progressItems[i];
        const label  = `${i + 1}/${imagesToUpload.length}`;

        console.log(`📤 Subiendo imagen ${label}…`);

        // Pasar callback de fase a StorageModule
        const uploadResult = await window.StorageModule.uploadImage(
          img.file,
          obraId,
          (phase) => _setItemStatus(itemEl, img.file.name, phase)
        );

        if (uploadResult.success) {
          _setItemStatus(itemEl, img.file.name, 'done');
          results.push({
            url:       uploadResult.url,
            principal: img.principal,
            orden:     i + 1,
          });
          console.log(`✅ Imagen ${label} subida`);
        } else {
          _setItemStatus(itemEl, img.file.name, 'error', uploadResult.error);
          throw new Error(`Error en imagen ${label}: ${uploadResult.error}`);
        }
      }

      console.log(`✅ Todas las imágenes subidas (${results.length})`);

      // Ocultar la lista de progreso tras un breve delay (permite ver los checkmarks)
      setTimeout(() => {
        if (progressList) progressList.setAttribute('hidden', '');
      }, 2200);

      return { success: true, urls: results };
    } catch (error) {
      console.error('❌ Error uploading images:', error);
      // No ocultar la lista: el estado de error queda visible para el usuario
      return { success: false, error: error.message };
    }
  }

  /**
   * Guardar todos los registros en tabla imagenes.
   * Comprueba el valor de retorno de cada saveImageRecord (no lanza excepción, devuelve { success }).
   * Si alguno falla, devuelve { success: false, error, isPrincipalConflict }.
   * isPrincipalConflict = true cuando el fallo se debe a una restricción UNIQUE sobre principal=true.
   */
  async function saveAllImageRecords(obraId, urls) {
    for (let i = 0; i < urls.length; i++) {
      const img = urls[i];
      const result = await window.StorageModule.saveImageRecord(obraId, img.url, img.principal);

      if (result && result.success === false) {
        console.error(`❌ Error al guardar registro de imagen ${i + 1}/${urls.length}:`, result.error);

        // Detectar conflicto de clave única sobre la columna principal
        // (el índice parcial impide dos filas con principal=true para la misma obra)
        const errStr = String(result.error ?? '').toLowerCase();
        const isPrincipalConflict =
          img.principal === true &&
          (errStr.includes('unique') || errStr.includes('duplicate') || errStr.includes('principal'));

        return {
          success: false,
          error:   result.error ?? 'Error desconocido al guardar la imagen',
          isPrincipalConflict,
          imageIndex: i + 1,
        };
      }
    }

    console.log(`✅ ${urls.length} registros guardados en tabla imagenes`);
    return { success: true };
  }

  /**
   * Resetear formulario
   */
  function reset() {
    images       = [];
    existingCount = 0;
    hasPrincipal  = false;
    const imageList = document.getElementById('imageList');
    if (imageList) imageList.innerHTML = '';
    // Limpiar y ocultar indicadores de progreso de subida anterior
    const progressList = document.getElementById('uploadProgressList');
    if (progressList) { progressList.innerHTML = ''; progressList.setAttribute('hidden', ''); }
    addImageInput();
    updateCounter();
  }

  /**
   * Informar al componente si ya existe una imagen guardada marcada como principal.
   * Cuando val = true, ningún slot nuevo aparecerá marcado por defecto.
   * Además, desmarca los slots nuevos que pudieran haber quedado marcados.
   * Debe llamarse después de setExistingCount, desde obras-form tras cargar las imágenes.
   * @param {boolean} val
   */
  function setHasPrincipal(val) {
    hasPrincipal = Boolean(val);

    if (hasPrincipal) {
      // Desmarcar cualquier checkbox de slot nuevo que ya esté visible
      document.querySelectorAll('.imagePrincipal').forEach((cb, i) => {
        cb.checked = false;
        if (images[i]) images[i].principal = false;
      });
    }
  }

  /**
   * Informar al componente cuántas imágenes ya están guardadas en DB.
   * Debe llamarse tras cargar las imágenes existentes en modo edición.
   * Ajusta el límite de slots nuevos y el contador combinado.
   * @param {number} n - Cantidad de imágenes guardadas para la obra actual
   */
  function setExistingCount(n) {
    existingCount = Math.max(0, parseInt(n, 10) || 0);
    const remaining = MAX_IMAGES - existingCount;

    // Recortar slots nuevos si exceden el espacio disponible
    const imageList = document.getElementById('imageList');
    if (imageList && images.length > remaining) {
      const wrappers = Array.from(imageList.children);
      for (let i = wrappers.length - 1; i >= remaining; i--) {
        wrappers[i]?.remove();
      }
      images.splice(remaining);
    }

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

    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const imageFiles = Array.from(files).filter(f => ALLOWED.includes(f.type.toLowerCase()));
    if (imageFiles.length === 0) {
      window.ErrorHandler?.showToast('Solo se aceptan JPG, PNG o WebP.', 'warning');
      return;
    }

    const remaining = MAX_IMAGES - existingCount; // slots nuevos disponibles
    let added = 0;
    for (const file of imageFiles) {
      // Buscar un slot vacío existente
      const emptyIndex = images.findIndex(img => img.file === null);

      if (emptyIndex >= 0) {
        // Rellenar slot vacío
        images[emptyIndex] = { file, principal: !hasPrincipal && emptyIndex === 0 };
        const wrapper = imageList.children[emptyIndex];
        try { if (wrapper) await showPreview(wrapper, file); } catch (_) { /* preview opcional */ }
        added++;
      } else if (images.length < remaining) {
        // Crear slot nuevo y rellenarlo
        addImageInput();
        const newIndex = images.length - 1;
        images[newIndex] = { file, principal: !hasPrincipal && newIndex === 0 };
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
    setExistingCount,     // llamado desde obras-form al cargar imágenes existentes
    setHasPrincipal,      // llamado desde obras-form cuando ya hay imagen principal guardada
  };
})();

window.MultiImageUpload = MultiImageUpload;
console.log('✅ Multi-image module ready');
