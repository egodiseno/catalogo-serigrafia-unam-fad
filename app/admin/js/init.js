/**
 * Admin Panel Initializer
 * Centraliza la inicialización de todos los módulos
 */

const AdminInit = (() => {
  const modules = [
    { name: 'Auth', key: 'Auth', required: true },
    { name: 'Navigation', key: 'Navigation', required: true },
    { name: 'Dashboard', key: 'Dashboard', required: false },
    { name: 'ObrasList', key: 'ObrasList', required: false },
    { name: 'ObrasForm', key: 'ObrasForm', required: false },
    { name: 'TecnicasCRUD', key: 'TecnicasCRUD', required: false },
    { name: 'TagsCRUD', key: 'TagsCRUD', required: false },
    { name: 'UsuariosCRUD', key: 'UsuariosCRUD', required: false },
    { name: 'RegistrosPendientes', key: 'RegistrosPendientes', required: false },
    { name: 'ControlRegistro', key: 'controlRegistroManager', required: false }
  ];

  const status = {
    initialized: false,
    modules: {}
  };

  /**
   * Inicializar todos los módulos
   */
  function init() {
    console.group('🚀 Inicializando Admin Panel...');

    let failedRequired = false;
    let successCount = 0;

    modules.forEach(({ name, key, required }) => {
      const moduleRef = window[key];

      // Verificar que módulo existe
      if (!moduleRef) {
        if (required) {
          console.error(`❌ CRÍTICO: ${name} no cargado`);
          ErrorHandler?.showToast(`${name} no disponible`, 'error');
          failedRequired = true;
        } else {
          console.warn(`⚠️  ${name} no disponible (opcional)`);
        }
        status.modules[key] = 'missing';
        return;
      }

      // Ejecutar init() si existe
      if (typeof moduleRef.init === 'function') {
        try {
          moduleRef.init();
          console.log(`✅ ${name} inicializado`);
          status.modules[key] = 'ok';
          successCount++;
        } catch (error) {
          console.error(`❌ Error inicializando ${name}:`, error);
          if (required) {
            failedRequired = true;
          }
          status.modules[key] = 'error';
        }
      } else {
        console.warn(`⚠️  ${name} no tiene función init()`);
        status.modules[key] = 'no-init';
      }
    });

    console.groupEnd();

    if (failedRequired) {
      console.error('❌ Módulos críticos fallaron. Verificar consola.');
      return false;
    }

    status.initialized = true;
    console.log(`✅ Admin Panel listo (${successCount}/${modules.length} módulos)`);
    
    // Publicar evento
    document.dispatchEvent(new CustomEvent('adminReady', { 
      detail: { status } 
    }));

    return true;
  }

  /**
   * Obtener estado actual
   */
  function getStatus() {
    return status;
  }

  /**
   * Verificar si un módulo está disponible
   */
  function isModuleLoaded(key) {
    return status.modules[key] === 'ok';
  }

  // Inicializar cuando DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  return { 
    init, 
    getStatus, 
    isModuleLoaded 
  };
})();

window.AdminInit = AdminInit;
console.log('✅ AdminInit module ready');
