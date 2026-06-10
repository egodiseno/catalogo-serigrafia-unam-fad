/**
 * icons.js — ICON REGISTRY
 * Sistema centralizado de iconos: Lucide (CDN) + Custom SVG
 *
 * Depende de: window.lucide (cargado antes desde CDN en <head>)
 * Expone:     window.IconRegistry, window.insertIcon
 *
 * API principal:
 *   IconRegistry.lucide('pen', 'sm')     → '<i data-lucide="pen" ...>'
 *   IconRegistry.buttonEdit()            → icono + texto "Editar"
 *   IconRegistry.buttonDelete()          → icono trash-2
 *   IconRegistry.getIcon('edit')         → alias por nombre semántico
 *   IconRegistry.addCustom('name', svg)  → registrar SVG custom
 *   IconRegistry.init()                  → lucide.createIcons()
 *
 * Después de inyectar data-lucide en el DOM dinámicamente,
 * siempre llamar: window.IconRegistry?.init()
 */

const IconRegistry = {

  /* ─── Presets de tamaño ─────────────────────────────────── */
  sizes: {
    xs: '14px',
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '32px',
  },

  /* ─── Mapa semántico → nombre Lucide oficial ─────────────── */
  _map: {
    edit:        'pen',
    delete:      'trash-2',
    save:        'save',
    cancel:      'x',
    add:         'plus',
    check:       'check',
    search:      'search',
    filter:      'filter',
    sort:        'arrow-up-down',
    user:        'user',
    users:       'users',
    logout:      'log-out',
    eye:         'eye',
    eyeOff:      'eye-off',
    upload:      'upload',
    download:    'download',
    image:       'image',
    imagePlus:   'image-plus',
    info:        'info',
    warning:     'alert-circle',
    success:     'check-circle',
    error:       'x-circle',
    chevronDown: 'chevron-down',
    tag:         'tag',
    wrench:      'wrench',
    dashboard:   'layout-dashboard',
  },

  /* ─── Custom SVGs UNAM / Serigrafía ──────────────────────── */
  custom: {
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="24" height="24" aria-hidden="true">
  <circle cx="50" cy="50" r="45" fill="#D9A500" stroke="#013B75" stroke-width="2"/>
  <text x="50" y="60" text-anchor="middle" font-size="40" font-weight="bold"
        font-family="sans-serif" fill="#013B75">AC</text>
</svg>`,
    serigrafía: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="24" height="24" aria-hidden="true">
  <rect x="10" y="20" width="80" height="60" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
  <line x1="30" y1="20" x2="30" y2="80" stroke="currentColor" stroke-width="1.5"/>
  <line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" stroke-width="1.5"/>
  <line x1="70" y1="20" x2="70" y2="80" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="50" cy="50" r="6" fill="currentColor"/>
</svg>`,
    galleryView: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="24" height="24" aria-hidden="true">
  <rect x="10" y="10" width="35" height="35" fill="none" stroke="currentColor" stroke-width="2"/>
  <rect x="55" y="10" width="35" height="35" fill="none" stroke="currentColor" stroke-width="2"/>
  <rect x="10" y="55" width="35" height="35" fill="none" stroke="currentColor" stroke-width="2"/>
  <rect x="55" y="55" width="35" height="35" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`,
  },

  /* ─── API: Lucide ────────────────────────────────────────── */

  /**
   * Generar HTML <i data-lucide="..."> listo para innerHTML
   * @param {string} name - nombre oficial Lucide (ej: 'pen', 'trash-2')
   * @param {'xs'|'sm'|'md'|'lg'|'xl'|string} size - preset o valor px
   * @returns {string}
   */
  lucide(name, size = 'sm') {
    const px = this.sizes[size] ?? size;
    return `<i data-lucide="${name}" style="width:${px};height:${px};display:inline-block;vertical-align:middle;" aria-hidden="true"></i>`;
  },

  /**
   * Botón Editar — icono + texto
   * @param {'xs'|'sm'|'md'} size
   */
  buttonEdit(size = 'sm') {
    return this.lucide('pen', size) + ' Editar';
  },

  /**
   * Botón Eliminar — solo icono trash
   * @param {'xs'|'sm'|'md'} size
   */
  buttonDelete(size = 'sm') {
    return this.lucide('trash-2', size);
  },

  /* ─── API: alias semántico ───────────────────────────────── */

  /**
   * Obtener HTML de icono por nombre semántico o nombre Lucide directo
   * @param {string} name  - alias semántico (ej: 'edit') o nombre Lucide (ej: 'pen')
   * @param {'lucide'|'custom'} type
   * @param {string|number} size
   * @param {string} color
   */
  getIcon(name, type = 'lucide', size = 24, color = 'currentColor') {
    if (type === 'lucide') {
      const resolved = this._map[name] ?? name; // acepta alias O nombre directo
      return `<i data-lucide="${resolved}" style="width:${size}px;height:${size}px;color:${color};display:inline-block;vertical-align:middle;" aria-hidden="true"></i>`;
    }
    if (type === 'custom') {
      const svg = this.custom[name];
      if (!svg) { console.warn(`[IconRegistry] Custom "${name}" no encontrado.`); return ''; }
      return svg.replace(/width="24" height="24"/, `width="${size}" height="${size}"`);
    }
    return '';
  },

  /* ─── API: custom SVG ────────────────────────────────────── */

  /**
   * Registrar nuevo custom SVG en runtime
   * @param {string} name
   * @param {string} svgCode
   */
  addCustom(name, svgCode) {
    this.custom[name] = svgCode;
    console.log(`[IconRegistry] ✓ Custom icon "${name}" registrado.`);
  },

  /* ─── Init ───────────────────────────────────────────────── */

  /**
   * Llamar lucide.createIcons() para renderizar todos los <i data-lucide>
   * Llamar después de cada inyección dinámica de HTML.
   */
  init() {
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    } else {
      console.warn('[IconRegistry] window.lucide no disponible. ¿Cargó el CDN?');
    }
  },

  // Alias para compatibilidad
  initialize() { this.init(); },
};

/* ─── Helper: prepend icon en elemento DOM ───────────────── */
function insertIcon(element, iconName, type = 'lucide', size = 16) {
  if (!element) return;
  const html = IconRegistry.getIcon(iconName, type, size);
  if (!html) return;
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = html;
  element.insertBefore(span, element.firstChild);
  IconRegistry.init();
}

/* ─── Exports globales ───────────────────────────────────── */
window.IconRegistry = IconRegistry;
window.insertIcon   = insertIcon;

/* ─── Auto-init al cargar DOM ────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => IconRegistry.init());
} else {
  IconRegistry.init();
}

console.log('🎨 IconRegistry listo (Lucide + Custom SVG)');
