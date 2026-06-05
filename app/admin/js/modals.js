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
        alert('❌ Error: Modal container not found. Please add <div id="modalContainer"></div> to HTML.');
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
      submitText = 'Guardar'
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
            <button type="button" class="modal-close" aria-label="Cerrar">✕</button>
          </div>
          
          <form class="modal-form">
            ${fields.map(field => createField(field)).join('')}
            
            <div class="modal-error" style="display: none;"></div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
              <button type="submit" class="btn btn-primary">${sanitize(submitText)}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.innerHTML = html;
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

    // Cerrar al clickear fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        close(modalId);
        document.removeEventListener('keydown', escHandler);
      }
    });

    console.log(`✅ Modal abierto: ${title}`);
    modal.style.display = 'flex';
  }

  function createField(field) {
    const { name, label, type = 'text', required = false, options = [] } = field;

    const labelHtml = `<label for="${name}">${sanitize(label)}${required ? ' *' : ''}</label>`;

    if (type === 'textarea') {
      return `
        <div class="form-group">
          ${labelHtml}
          <textarea name="${name}" id="${name}" ${required ? 'required' : ''}></textarea>
        </div>
      `;
    }

    if (type === 'select') {
      return `
        <div class="form-group">
          ${labelHtml}
          <select name="${name}" id="${name}" ${required ? 'required' : ''}>
            <option value="">-- Seleccionar --</option>
            ${options.map(opt => `<option value="${sanitize(opt.value)}">${sanitize(opt.label)}</option>`).join('')}
          </select>
        </div>
      `;
    }

    return `
      <div class="form-group">
        ${labelHtml}
        <input type="${type}" name="${name}" id="${name}" ${required ? 'required' : ''} />
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

  return { 
    open, 
    close, 
    isAvailable: () => !!modalContainer
  };
})();

window.ModalManager = ModalManager;
console.log('✅ ModalManager loaded and validated');
