/**
 * toast-notifications.js — Sistema de notificaciones flotantes
 * FASE 2 — Reemplaza los toasts inline de error-handler.js
 *
 * Expone: window.toast  (.success / .error / .info / .warning)
 * Depende de: DOM listo (cargado con defer)
 *
 * Integración automática: error-handler.js delega a window.toast cuando
 * este módulo está disponible — todos los CRUD heredan el nuevo UI.
 */

class ToastNotifications {
  constructor() {
    this._container = null;
    this._init();
  }

  _init() {
    // Crear contenedor fijo si no existe
    let el = document.getElementById('toastContainer');
    if (!el) {
      el = document.createElement('div');
      el.id        = 'toastContainer';
      el.className = 'toast-container';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'false');
      document.body.appendChild(el);
    }
    this._container = el;
  }

  // ── API pública ────────────────────────────────────────

  success(mensaje, duracion = 3500) { return this._show(mensaje, 'success', duracion); }
  error  (mensaje, duracion = 5000) { return this._show(mensaje, 'error',   duracion); }
  info   (mensaje, duracion = 4000) { return this._show(mensaje, 'info',    duracion); }
  warning(mensaje, duracion = 4000) { return this._show(mensaje, 'warning', duracion); }

  // ── Implementación interna ─────────────────────────────

  _show(mensaje, tipo, duracion) {
    if (!this._container) this._init();

    const iconos = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    const toast = document.createElement('div');
    toast.className           = `toast toast--${tipo}`;
    toast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

    toast.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${iconos[tipo] ?? 'ℹ️'}</span>
      <span class="toast__msg">${this._esc(mensaje)}</span>
      <button class="toast__close" aria-label="Cerrar notificación">&times;</button>
    `;

    this._container.appendChild(toast);

    // Botón cerrar
    toast.querySelector('.toast__close').addEventListener('click', () => this._cerrar(toast));

    // Entrada: añadir clase 1 frame después para que la transición CSS se dispare
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('toast--visible'));
    });

    // Auto-dismiss
    const timerId = setTimeout(() => this._cerrar(toast), duracion);
    toast._timerId = timerId;

    return toast;
  }

  _cerrar(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._timerId);
    toast.classList.remove('toast--visible');
    // Esperar la transición de salida antes de eliminar del DOM
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback por si transitionend no se dispara (ej. prefers-reduced-motion)
    setTimeout(() => toast.remove(), 350);
  }

  limpiarTodos() {
    this._container?.querySelectorAll('.toast').forEach(t => this._cerrar(t));
  }

  // ── Utilidad ───────────────────────────────────────────
  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.toast = new ToastNotifications();
console.log('🔔 toast-notifications.js cargado');
