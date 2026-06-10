/**
 * PHASE 1.I/J/K: Generic Modal Manager
 * Sistema reutilizable de modales con validación
 */

const ModalManager = (() => {
  // ========== VALIDACIÓN INICIAL ==========
  const modalContainer = document.getElementById('modalContainer');

  if (!modalContainer) {
    console.error('❌ CRÍTICO: #modalContainer no encontrado en HTML');
    console.error('   Agregar en index.html antes de </body>:');
    console.error('   <div id="modalContainer"></div>');
    
    // Devolver API que previene errores
    return {
      open: () => {
        window.ErrorHandler?.showToast('Error crítico: #modalContainer no encontrado en HTML', 'error');
        console.error('Agregar <div id="modalContainer"></div> antes de </body>');
      },
      close: () => {},
      isAvailable: () => false
    };
  }

  console.log('✅ modalContainer validado');

  // ========== MODAL MANAGER ==========
  function open(config) {
    const {
      title,
      fields = [],
      onSave,
      onCancel,
      submitText = 'Guardar',
      closeOnOverlayClick = false   // false: no cerrar al clicar fuera (evita pérdida de datos)
    } = config;

    if (!title) {
      console.error('❌ Modal: title es requerido');
      return;
    }

    if (!onSave || typeof onSave !== 'function') {
      console.error('❌ Modal: onSave debe ser una función');
      return;
    }

    const modalId = `modal-${Date.now()}`;

    const html = `
      <div class="modal-overlay" id="${modalId}">
        <div class="modal-dialog">
          <div class="modal-header">
            <h2>${sanitize(title)}</h2>
            <button type="button" class="modal-close btn btn-ghost" aria-label="Cerrar">
              <i data-lucide="x" style="width:16px;height:16px;" aria-hidden="true"></i>
            </button>
          </div>
          
          <form class="modal-form">
            <div class="modal-body">
              ${fields.map(field => createField(field)).join('')}
              <div class="modal-error" style="display: none;"></div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
              <button type="submit" class="btn btn-primary">${sanitize(submitText)}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.innerHTML = html;
    window.IconRegistry?.init();   // renderizar iconos Lucide en el modal dinámico
    const modal = document.getElementById(modalId);

    // Event listeners
    const form = modal.querySelector('.modal-form');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    const errorDiv = modal.querySelector('.modal-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      try {
        // Validar datos antes de onSave
        if (!validateFormData(data, fields)) {
          return;
        }

        await onSave(data);
        close(modalId);
      } catch (error) {
        console.error('❌ Modal error:', error);
        showError(errorDiv, error.message || 'Error desconocido');
      }
    });

    closeBtn.addEventListener('click', () => {
      if (onCancel) onCancel();
      close(modalId);
    });

    cancelBtn.addEventListener('click', () => {
      if (onCancel) onCancel();
      close(modalId);
    });

    // Cerrar con ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        close(modalId);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Cerrar al clickear fuera (solo si closeOnOverlayClick = true)
    if (closeOnOverlayClick) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          close(modalId);
          document.removeEventListener('keydown', escHandler);
        }
      });
    }

    console.log(`✅ Modal abierto: ${title}`);
    modal.style.display = 'flex';
  }

  function createField(field) {
    const { name, label, type = 'text', required = false, options = [], defaultValue = '' } = field;

    const labelHtml = `<label for="${name}">${sanitize(label)}${required ? ' *' : ''}</label>`;

    if (type === 'textarea') {
      return `
        <div class="form-group">
          ${labelHtml}
          <textarea name="${name}" id="${name}" ${required ? 'required' : ''}>${sanitize(defaultValue)}</textarea>
        </div>
      `;
    }

    if (type === 'select') {
      return `
        <div class="form-group">
          ${labelHtml}
          <select name="${name}" id="${name}" ${required ? 'required' : ''}>
            <option value="">-- Seleccionar --</option>
            ${options.map(opt => `
              <option value="${sanitize(opt.value)}"
                ${opt.value === defaultValue ? 'selected' : ''}>
                ${sanitize(opt.label)}
              </option>`).join('')}
          </select>
        </div>
      `;
    }

    return `
      <div class="form-group">
        ${labelHtml}
        <input type="${type}" name="${name}" id="${name}"
               ${required ? 'required' : ''}
               value="${sanitize(defaultValue)}" />
      </div>
    `;
  }

  function validateFormData(data, fields) {
    for (const field of fields) {
      if (field.required && !data[field.name]) {
        const errorMsg = `${field.label} es requerido`;
        console.error(`❌ Validación: ${errorMsg}`);
        return false;
      }
    }
    return true;
  }

  function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        if (modal.parentNode) {
          modal.remove();
        }
      }, 300);
    }
  }

  function showError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    console.error(`⚠️  Modal error shown: ${message}`);
  }

  // ── Modal de confirmación (CRIT-05) ───────────────────
  function openConfirm({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, onCancel } = {}) {
    const modalId = `modal-confirm-${Date.now()}`;

    const html = `
      <div class="modal-overlay" id="${modalId}" role="alertdialog" aria-modal="true">
        <div class="modal-dialog modal-dialog--sm">
          <div class="modal-header">
            <h2>${sanitize(title || '¿Confirmar acción?')}</h2>
          </div>
          <div class="modal-body">
            <p class="confirm-message">${sanitize(message || '')}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary modal-cancel">${sanitize(cancelText)}</button>
            <button type="button" class="btn btn-danger modal-confirm">${sanitize(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.innerHTML = html;
    window.IconRegistry?.init();   // renderizar iconos Lucide en el modal de confirmación
    const modal = document.getElementById(modalId);
    modal.style.display = 'flex';

    modal.querySelector('.modal-confirm').addEventListener('click', async () => {
      close(modalId);
      if (onConfirm) await onConfirm();
    });

    const cancelHandler = () => {
      close(modalId);
      if (onCancel) onCancel();
    };

    modal.querySelector('.modal-cancel').addEventListener('click', cancelHandler);
    modal.addEventListener('click', e => { if (e.target === modal) cancelHandler(); });

    const escHandler = e => {
      if (e.key === 'Escape') { cancelHandler(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    // Focus en el botón de cancelar (más seguro por defecto)
    modal.querySelector('.modal-cancel').focus();
  }

  // ── Preview de imagen en modal ────────────────────────
  /**
   * Abre el modal #imagePreviewModal con la imagen indicada.
   * Cierra con: botón X, clic en overlay, tecla Escape.
   * Fallback a window.open si el modal no existe en el DOM.
   */
  function openImagePreview(imageUrl) {
    const modal    = document.getElementById('imagePreviewModal');
    const imgEl    = document.getElementById('imagePreviewImg');
    const closeBtn = document.getElementById('imagePreviewClose');

    if (!modal || !imgEl) {
      window.open(imageUrl, '_blank');
      return;
    }

    imgEl.src = imageUrl;
    modal.style.display = 'flex';

    function closeModal() {
      modal.style.display = 'none';
      imgEl.src = '';
      closeBtn.removeEventListener('click', closeModal);
      document.removeEventListener('keydown', escHandler);
      modal.removeEventListener('click', overlayHandler);
    }

    function escHandler(e)     { if (e.key === 'Escape') closeModal(); }
    function overlayHandler(e) { if (e.target === modal)  closeModal(); }

    closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', escHandler);
    modal.addEventListener('click', overlayHandler);

    closeBtn.focus();
  }

  return {
    open,
    openConfirm,
    openImagePreview,
    close,
    isAvailable: () => !!modalContainer
  };
})();

window.ModalManager = ModalManager;
console.log('✅ ModalManager loaded and validated');
