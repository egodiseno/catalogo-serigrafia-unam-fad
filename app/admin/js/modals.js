/**
 * PHASE 1.I/J/K: Generic Modal Manager
 * Sistema reutilizable de modales
 */

const ModalManager = (() => {
  const modalContainer = document.getElementById('modalContainer');

  function open(config) {
    const {
      title,
      fields = [],
      onSave,
      onCancel,
      submitText = 'Guardar'
    } = config;

    const modalId = `modal-${Date.now()}`;

    const html = `
      <div class="modal-overlay" id="${modalId}">
        <div class="modal-dialog">
          <div class="modal-header">
            <h2>${title}</h2>
            <button type="button" class="modal-close" aria-label="Cerrar">✕</button>
          </div>
          
          <form class="modal-form">
            ${fields.map(field => createField(field)).join('')}
            
            <div class="modal-error" style="display: none;"></div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
              <button type="submit" class="btn btn-primary">${submitText}</button>
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
        await onSave(data);
        close(modalId);
      } catch (error) {
        showError(errorDiv, error.message);
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(modalId);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close(modalId);
    });

    modal.style.display = 'flex';
  }

  function createField(field) {
    const { name, label, type = 'text', required = false, options = [] } = field;

    if (type === 'textarea') {
      return `
        <div class="form-group">
          <label for="${name}">${label}${required ? ' *' : ''}</label>
          <textarea name="${name}" id="${name}" ${required ? 'required' : ''}></textarea>
        </div>
      `;
    }

    if (type === 'select') {
      return `
        <div class="form-group">
          <label for="${name}">${label}${required ? ' *' : ''}</label>
          <select name="${name}" id="${name}" ${required ? 'required' : ''}>
            <option value="">-- Seleccionar --</option>
            ${options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
        </div>
      `;
    }

    return `
      <div class="form-group">
        <label for="${name}">${label}${required ? ' *' : ''}</label>
        <input type="${type}" name="${name}" id="${name}" ${required ? 'required' : ''} />
      </div>
    `;
  }

  function close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => modal.remove(), 300);
    }
  }

  function showError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  return { open, close };
})();

window.ModalManager = ModalManager;
console.log('✅ Modal manager loaded');
