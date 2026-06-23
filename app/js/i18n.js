// app/js/i18n.js
// Internacionalización ES/EN

// Diccionario de valores dinámicos (técnicas y tags) que vienen de DB
const TRANSLATIONS = {
  // ── Técnicas ──────────────────────────────────────────────
  'Serigrafía manual':  { en: 'Manual Printmaking' },
  'Serigrafía digital': { en: 'Digital Printmaking' },
  'Litografía':         { en: 'Lithography' },
  'Xilografía':         { en: 'Woodcut' },
  'Aguafuerte':         { en: 'Etching' },
  'Aguatinta':          { en: 'Aquatint' },
  'Linografía':         { en: 'Linocut' },
  'Monotipo':           { en: 'Monotype' },
  'Fotograbado':        { en: 'Photogravure' },
  // ── Tags ──────────────────────────────────────────────────
  'Abstracto':          { en: 'Abstract' },
  'Figurativo':         { en: 'Figurative' },
  'Vintage':            { en: 'Vintage' },
  'Paisaje':            { en: 'Landscape' },
  'Retrato':            { en: 'Portrait' },
  'Geométrico':         { en: 'Geometric' },
  'Urbano':             { en: 'Urban' },
  'Naturaleza':         { en: 'Nature' },
  'Expresionista':      { en: 'Expressionist' },
  'Pop Art':            { en: 'Pop Art' },
  'Minimalista':        { en: 'Minimalist' },
  'Experimental':       { en: 'Experimental' },
  'Color':              { en: 'Color' },
};

export const i18n = {
  currentLang: localStorage.getItem('lang') || 'es',

  /**
   * Traduce un texto dinámico (técnica, tag) según el idioma actual.
   * Si no hay traducción registrada, devuelve el texto original.
   */
  translate(text) {
    if (!text) return text;
    if (this.currentLang === 'es') return text;
    return TRANSLATIONS[text]?.en ?? text;
  },

  init() {
    // Aplicar idioma inicial
    this.updateLanguage(this.currentLang);

    // Setup toggle buttons
    document.querySelectorAll('.lang-toggle .lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        this.switchLanguage(lang);
      });
    });

    // Set year dinámico
    document.querySelectorAll('[data-year]').forEach(el => {
      el.textContent = new Date().getFullYear();
    });
  },

  switchLanguage(lang) {
    if (lang === this.currentLang) return;

    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    this.updateLanguage(lang);

    // Notificar a módulos que escuchen cambios de idioma
    document.dispatchEvent(new CustomEvent('lang:changed', { detail: { lang } }));
  },

  updateLanguage(lang) {
    // Update text elements (data-i18n)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = lang === 'en' ? 'data-en' : 'data-es';
      const text = el.getAttribute(key);
      if (text) {
        el.textContent = text;
      }
    });

    // Update placeholders (data-i18n-placeholder)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = lang === 'en' ? 'data-en-placeholder' : 'data-es-placeholder';
      const placeholder = el.getAttribute(key);
      if (placeholder) {
        el.placeholder = placeholder;
      }
    });

    // Update lang button states
    document.querySelectorAll('.lang-toggle .lang-btn').forEach(btn => {
      const btnLang = btn.getAttribute('data-lang');
      btn.setAttribute('aria-pressed', btnLang === lang ? 'true' : 'false');
    });

    // Update document lang
    document.documentElement.lang = lang;

    console.log(`✅ Idioma cambiado a: ${lang}`);
  }
};
