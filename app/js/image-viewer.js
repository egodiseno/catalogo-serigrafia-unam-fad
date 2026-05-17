/*
  Prototipo 1 — Público esencial
  Entrega 12 — Handoff final: documentación estabilizada; sin cambios funcionales.
  Entrega 4 — Visor de imagen público simple para ficha de obra.
  Scope: abrir/cerrar visor, teclado, foco accesible y regreso contextual a la ficha.
*/

(() => {
  const viewer = document.querySelector('[data-image-viewer]');
  const triggers = Array.from(document.querySelectorAll('[data-image-viewer-open]'));

  if (!viewer || triggers.length === 0) return;

  const viewerImage = viewer.querySelector('[data-image-viewer-image]');
  const closeControls = Array.from(viewer.querySelectorAll('[data-image-viewer-close]'));
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  let previousFocus = null;

  const getFocusableElements = () =>
    Array.from(viewer.querySelectorAll(focusableSelector)).filter((element) => {
      const isHidden = element.closest('[hidden]') || element.getAttribute('aria-hidden') === 'true';
      return !isHidden && element.offsetParent !== null;
    });

  const openViewer = (trigger) => {
    if (!trigger || !viewerImage) return;

    const imageSrc = trigger.getAttribute('data-image-viewer-src') || '';
    const imageAlt = trigger.getAttribute('data-image-viewer-alt') || 'Imagen ampliada de la obra';

    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    viewerImage.setAttribute('src', imageSrc);
    viewerImage.setAttribute('alt', imageAlt);
    viewer.hidden = false;
    document.body.classList.add('has-image-viewer-open');

    const focusableElements = getFocusableElements();
    const firstFocusable = focusableElements[0];
    if (firstFocusable) firstFocusable.focus({ preventScroll: true });
  };

  const closeViewer = () => {
    if (viewer.hidden) return;

    viewer.hidden = true;
    document.body.classList.remove('has-image-viewer-open');

    if (viewerImage) {
      viewerImage.removeAttribute('src');
      viewerImage.setAttribute('alt', '');
    }

    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus({ preventScroll: true });
    }
  };

  const trapFocus = (event) => {
    if (viewer.hidden || event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openViewer(trigger));
  });

  closeControls.forEach((control) => {
    control.addEventListener('click', closeViewer);
  });

  document.addEventListener('keydown', (event) => {
    if (viewer.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
      return;
    }

    trapFocus(event);
  });
})();
