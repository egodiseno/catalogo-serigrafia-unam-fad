/**
 * PHASE 1.A: Navigation Module
 * Maneja cambios de sección en el dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  // ============ ELEMENTOS DOM ============
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');

  // Textos de secciones — título siempre fijo, subtítulo describe la sección activa
  const sectionTitles = {
    dashboard: { title: 'Catálogo de Obra Serigráfica', subtitle: 'Resumen del catálogo' },
    obras:     { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar obras' },
    tecnicas:  { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar técnicas' },
    tags:      { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar tags' },
    usuarios:  { title: 'Catálogo de Obra Serigráfica', subtitle: 'Gestionar usuarios' },
  };

  // ============ FUNCIÓN: Mostrar sección ============
  function showSection(sectionId) {
    // Ocultar todas las secciones
    sections.forEach(section => section.classList.remove('active'));

    // Mostrar sección seleccionada
    const section = document.getElementById(`${sectionId}Section`);
    if (section) {
      section.classList.add('active');
    }

    // Actualizar título y subtitle
    if (sectionTitles[sectionId]) {
      pageTitle.textContent = sectionTitles[sectionId].title;
      pageSubtitle.textContent = sectionTitles[sectionId].subtitle;
    }

    // Actualizar estado del nav
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.section === sectionId) {
        item.classList.add('active');
      }
    });

    // Guardar en sessionStorage (para mantener sección si recarga)
    sessionStorage.setItem('currentSection', sectionId);
  }

  // ============ EVENT LISTENERS: Nav clicks ============
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      showSection(sectionId);
    });
  });

  // ============ RESTAURAR SECCIÓN ANTERIOR ============
  const savedSection = sessionStorage.getItem('currentSection') || 'dashboard';
  showSection(savedSection);

  console.log('✅ Navigation module loaded');
});
