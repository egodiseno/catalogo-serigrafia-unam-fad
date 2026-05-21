/*
  Prototipo 2 — Admin esencial.
  JS limitado al menú administrativo mobile. Sin Auth real, sesión persistente, fetch JSON, backend, Supabase, Storage ni lógica CRUD.
  Incluye cierre del menú con Escape/clic fuera para accesibilidad base.
*/

(function () {
  const menuToggle = document.querySelector('[data-admin-menu-toggle]');
  const mobilePanel = document.querySelector('[data-admin-mobile-panel]');

  if (!menuToggle || !mobilePanel) return;

  const setMenuState = (isOpen) => {
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    mobilePanel.hidden = !isOpen;
  };

  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    setMenuState(!isOpen);
  });

  mobilePanel.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('a')) {
      setMenuState(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuState(false);
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const clickInsideMenu = mobilePanel.contains(target);
    const clickOnToggle = menuToggle.contains(target);

    if (!clickInsideMenu && !clickOnToggle) {
      setMenuState(false);
    }
  });
})();
