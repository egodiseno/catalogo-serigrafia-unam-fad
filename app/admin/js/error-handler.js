/**
 * Error Handler Module
 * Manejo centralizado de errores con toasts y logging
 */

const ErrorHandler = (() => {
  const TOAST_DURATION = 4000;

  /**
   * Categorizar y manejar errores
   */
  function handle(error, context = 'Unknown') {
    console.error(`❌ [${context}]`, error);

    let message = error.message || 'Error desconocido';
    let type = 'error';

    // Categorizar por tipo de error
    if (error.message?.includes('JWT')) {
      message = 'Sesión expirada. Redirigiendo a login...';
      setTimeout(() => {
        window.location.href = '/app/admin/index.html';
      }, 2000);
    } else if (error.status === 409 || error.message?.includes('duplicate')) {
      message = 'Este registro ya existe';
    } else if (error.status === 400 || error.message?.includes('validation')) {
      message = 'Datos inválidos. Verifica los campos';
    } else if (error.status === 401) {
      message = 'No autorizado';
    } else if (error.status === 403) {
      message = 'Permiso denegado';
    } else if (error.status === 404) {
      message = 'Registro no encontrado';
    } else if (error.status === 500) {
      message = 'Error del servidor. Intenta más tarde';
    } else if (error.status === 503) {
      message = 'Servicio no disponible';
    }

    showToast(message, type);
    return message;
  }

  /**
   * Mostrar toast con mensaje
   * @param {string} message  - Texto del mensaje
   * @param {string} type     - 'error' | 'success' | 'warning'
   * @param {string} [icon]   - Nombre de ícono Lucide (ej: 'mail-check', 'check-circle')
   *                            Si se omite, se muestra solo el texto.
   */
  function showToast(message, type = 'error', icon = null) {
    // ── Delegar al sistema de toasts premium (FASE 2) ───
    if (window.toast) {
      const method = type === 'success' ? 'success'
                   : type === 'warning' ? 'warning'
                   : type === 'info'    ? 'info'
                   :                      'error';
      window.toast[method]?.(message);
      return;
    }

    const toast = document.createElement('div');
    const bgColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#f59e0b';
    const textColor = '#ffffff';

    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: ${bgColor};
      color: ${textColor};
      padding: 16px 24px;
      border-radius: 8px;
      border-left: 4px solid rgba(0,0,0,0.2);
      z-index: 9999;
      box-shadow: 0 10px 15px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 400px;
      animation: slideInUp 300ms ease;
    `;

    if (icon) {
      // Layout flex: ícono Lucide + texto (cada uno en su propio nodo DOM)
      toast.style.display    = 'flex';
      toast.style.alignItems = 'center';
      toast.style.gap        = '8px';

      const iconEl = document.createElement('span');
      iconEl.style.cssText  = 'display:flex;align-items:center;flex-shrink:0;';
      iconEl.innerHTML      = `<i data-lucide="${icon}" style="width:16px;height:16px;" aria-hidden="true"></i>`;
      toast.appendChild(iconEl);

      const textEl = document.createElement('span');
      textEl.textContent = message;
      toast.appendChild(textEl);
    } else {
      toast.textContent = message;
    }

    document.body.appendChild(toast);

    // Renderizar el ícono Lucide si fue inyectado
    if (icon) window.IconRegistry?.init();

    // Auto-remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 300ms ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, TOAST_DURATION);

    // Log toast
    console.log(`🔔 Toast [${type}]: ${message}`);
  }

  /**
   * Validar respuesta de Supabase
   */
  function validateResponse(data, error, context = 'API Call') {
    if (error) {
      handle(error, context);
      return false;
    }
    return true;
  }

  return { 
    handle, 
    showToast, 
    validateResponse 
  };
})();

window.ErrorHandler = ErrorHandler;
console.log('✅ ErrorHandler loaded');
