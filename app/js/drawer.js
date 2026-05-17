/*
  Prototipo 1 — Público esencial
  Entregas 2–12 — Drawer mobile de filtros.
  Scope: apertura/cierre accesible del panel de filtros mobile. No backend, no datos.
*/

(function () {
  const shell = document.querySelector('[data-filter-drawer]');
  const panel = document.getElementById('filter-drawer');
  const openButtons = document.querySelectorAll('[data-filter-drawer-open]');
  const closeButtons = document.querySelectorAll('[data-filter-drawer-close]');

  if (!shell || !panel || openButtons.length === 0) return;

  let lastActiveElement = null;

  const getFocusableElements = () =>
    Array.from(
      panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element instanceof HTMLElement && !element.hidden);

  const setExpanded = (value) => {
    openButtons.forEach((button) => {
      button.setAttribute('aria-expanded', String(value));
    });
  };

  const openDrawer = () => {
    lastActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    shell.hidden = false;
    document.documentElement.classList.add('filter-drawer-open');
    setExpanded(true);

    window.requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      (focusable[0] || panel).focus();
    });
  };

  const closeDrawer = () => {
    shell.hidden = true;
    document.documentElement.classList.remove('filter-drawer-open');
    setExpanded(false);

    if (lastActiveElement) {
      lastActiveElement.focus();
    }
  };

  openButtons.forEach((button) => {
    button.addEventListener('click', openDrawer);
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeDrawer);
  });

  document.addEventListener('keydown', (event) => {
    if (shell.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 1024px)').matches && !shell.hidden) {
      closeDrawer();
    }
  });
})();
