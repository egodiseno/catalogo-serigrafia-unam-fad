/**
 * confirm-modal.js — Modal de confirmación premium
 * FASE 2 — Reemplaza los confirm() inline
 *
 * Expone: window.confirmModal  (.abrir)
 * Depende de: DOM listo (cargado con defer)
 *
 * Integración automática: modals.js delega a window.confirmModal cuando
 * este módulo está disponible — todos los deletes heredan el nuevo UI.
 */

class ConfirmModal {
  constructor() {
    this._overlay        = null;
    this._overlayHandler = null;   // ref para poder remover el listener
    this._escHandler     = null;
    this._init();
  }

  _init() {
    let el = document.getElementById('confirmModalOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id        = 'confirmModalOverlay';
      el.className = 'confirm-overlay';
      el.setAttribute('role',       'alertdialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'confirmModalTitle');
      document.body.appendChild(el);
    }
    this._overlay = el;
  }

  // ── API pública ────────────────────────────────────────

  abrir({
    title       = '¿Confirmar acción?',
    message     = '',
    confirmText = 'Confirmar',
    cancelText  = 'Cancelar',
    onConfirm,
    onCancel,
    tipo        = 'danger'       // 'danger' | 'warning' | 'info'
  } = {}) {
    if (!this._overlay) this._init();

    // Limpiar listener de overlay previo si quedó colgado
    if (this._overlayHandler) {
      this._overlay.removeEventListener('click', this._overlayHandler);
      this._overlayHandler = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    const iconos = { danger: '🗑️', warning: '⚠️', info: 'ℹ️' };
    const icon   = iconos[tipo] ?? iconos.danger;

    this._overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon confirm-icon--${tipo}" aria-hidden="true">${icon}</div>
        <div class="confirm-content">
          <h3 id="confirmModalTitle">${this._esc(title)}</h3>
          ${message ? `<p>${this._esc(message)}</p>` : ''}
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn btn-secondary" id="confirmCancelBtn">
            ${this._esc(cancelText)}
          </button>
          <button type="button" class="btn btn-danger" id="confirmOkBtn">
            ${this._esc(confirmText)}
          </button>
        </div>
      </div>
    `;

    // Mostrar con transición CSS
    this._overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this._overlay.classList.add('confirm--visible'));
    });

    const cancelBtn  = this._overlay.querySelector('#confirmCancelBtn');
    const confirmBtn = this._overlay.querySelector('#confirmOkBtn');

    // Foco en cancelar (más seguro por defecto)
    cancelBtn.focus();

    // ── Cerrar ────────────────────────────────────────────
    let _done = false;

    const cerrar = (confirmed) => {
      if (_done) return;
      _done = true;

      this._overlay.classList.remove('confirm--visible');

      if (this._overlayHandler) {
        this._overlay.removeEventListener('click', this._overlayHandler);
        this._overlayHandler = null;
      }
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }

      const cleanup = () => {
        this._overlay.style.display = 'none';
        this._overlay.innerHTML     = '';
      };

      // Salida: esperar transición CSS o fallback
      this._overlay.addEventListener('transitionend', cleanup, { once: true });
      setTimeout(cleanup, 280);   // fallback prefers-reduced-motion / navegadores lentos

      // Ejecutar callback después del cierre
      if (confirmed && onConfirm) {
        Promise.resolve(onConfirm()).catch(e => console.error('[ConfirmModal] onConfirm:', e));
      } else if (!confirmed && onCancel) {
        onCancel();
      }
    };

    confirmBtn.addEventListener('click', () => cerrar(true));
    cancelBtn.addEventListener('click',  () => cerrar(false));

    // Clic en overlay (fuera del diálogo)
    this._overlayHandler = (e) => { if (e.target === this._overlay) cerrar(false); };
    this._overlay.addEventListener('click', this._overlayHandler);

    // Escape
    this._escHandler = (e) => { if (e.key === 'Escape') cerrar(false); };
    document.addEventListener('keydown', this._escHandler);
  }

  // ── Utilidad ───────────────────────────────────────────
  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.confirmModal = new ConfirmModal();
console.log('🗑️ confirm-modal.js cargado');
