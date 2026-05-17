/*
  Prototipo 1 — Público esencial
  Entregas 1–12 — JS mínimo compartido del prototipo público esencial.
  Scope: menú mobile público, estado aria-expanded, cierre por Escape/click en link.
*/

(function () {
  const toggle = document.querySelector('[data-menu-toggle]');
  const panel = document.querySelector('[data-mobile-panel]');

  if (!toggle || !panel) return;

  const openMenu = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar menú de navegación');
    document.documentElement.classList.add('mobile-menu-open');
  };

  const closeMenu = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú de navegación');
    document.documentElement.classList.remove('mobile-menu-open');
  };

  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    isExpanded ? closeMenu() : openMenu();
  });

  panel.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('a')) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      closeMenu();
    }
  });
})();
