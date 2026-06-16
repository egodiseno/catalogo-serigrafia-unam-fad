// app/js/public-creditos.js
// Página de Créditos — carga Acerca + Créditos desde Supabase

import { api } from './api-client.js';
import { i18n } from './i18n.js';

/** Mapeo slug de sección → etiqueta de display */
const SECCION_LABELS = {
  unam:       'UNAM',
  fad:        'FACULTAD DE ARTES Y DISEÑO',
  taller:     'TALLER DE SERIGRAFÍA',
  webmaster:  'DESARROLLO WEB',
};

/** Orden preferido de secciones */
const SECCION_ORDER = ['unam', 'fad', 'taller', 'webmaster'];

export class PublicCreditos {
  constructor() {
    this.acercaEl      = document.getElementById('acercaContenido');
    this.creditosEl    = document.getElementById('seccionCreditos');
    this.spinnerAcerca = document.querySelector('[data-loading-acerca]');
    this.spinnerCred   = document.querySelector('[data-loading-creditos]');
  }

  async init() {
    console.log('🚀 Inicializando Créditos...');

    await this._fetch();

    // Recargar contenido al cambiar idioma
    document.addEventListener('lang:changed', async (e) => {
      const lang = e.detail?.lang;
      console.log(`🌐 Créditos: recargando para idioma "${lang}"`);
      this._showSpinners();
      await this._fetch();
      // Volver a aplicar traducciones estáticas del DOM
      i18n.updateLanguage(lang);
    });

    console.log('✅ Créditos inicializados');
  }

  /** Carga y renderiza acerca + créditos en paralelo */
  async _fetch() {
    const [acerca, creditos] = await Promise.all([
      this._loadAcerca(),
      this._loadCreditos(),
    ]);
    this._renderAcerca(acerca);
    this._renderCreditos(creditos);
  }

  /* ── Carga de datos ──────────────────────────────────────── */

  async _loadAcerca() {
    try {
      return await api.getAcerca(i18n.currentLang);
    } catch (err) {
      console.error('❌ loadAcerca:', err);
      return '';
    }
  }

  async _loadCreditos() {
    try {
      return await api.getCreditos();
    } catch (err) {
      console.error('❌ loadCreditos:', err);
      return [];
    }
  }

  /* ── Helpers de UI ───────────────────────────────────────── */

  _showSpinners() {
    if (this.spinnerAcerca) this.spinnerAcerca.style.display = '';
    if (this.spinnerCred)   this.spinnerCred.style.display   = '';
  }

  _hideSpinner(el) {
    if (el) el.style.display = 'none';
  }

  /* ── Renderizado ─────────────────────────────────────────── */

  _renderAcerca(texto) {
    this._hideSpinner(this.spinnerAcerca);
    if (!this.acercaEl) return;

    if (!texto || !texto.trim()) {
      this.acercaEl.innerHTML =
        '<p class="empty-state">No hay contenido disponible.</p>';
      return;
    }

    // Escapar HTML y respetar saltos de línea
    const safe = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    this.acercaEl.innerHTML =
      `<p>${safe.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  }

  _renderCreditos(personas) {
    this._hideSpinner(this.spinnerCred);
    if (!this.creditosEl) return;

    if (!personas.length) {
      this.creditosEl.innerHTML =
        '<p class="empty-state">No hay créditos disponibles.</p>';
      return;
    }

    // Agrupar por sección
    const grouped = {};
    personas.forEach(p => {
      const key = p.seccion || 'otro';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    // Ordenar secciones: primero las conocidas en SECCION_ORDER, luego el resto
    const seccionKeys = [
      ...SECCION_ORDER.filter(k => grouped[k]),
      ...Object.keys(grouped).filter(k => !SECCION_ORDER.includes(k)),
    ];

    const html = seccionKeys.map(key => {
      const label    = SECCION_LABELS[key] || key.toUpperCase();
      const gente    = grouped[key];
      const personas = gente.map(p => this._renderPersona(p)).join('');
      return `
        <div class="creditos-subsection">
          <h3>${label}</h3>
          <div class="creditos-personas">${personas}</div>
        </div>
      `;
    }).join('');

    this.creditosEl.innerHTML = html;
  }

  _renderPersona(p) {
    const nombre = p.nombre ? `<p class="creditos-person__name">${p.nombre}</p>` : '';
    const cargo  = p.cargo  ? `<p class="creditos-person__role">${p.cargo}</p>`  : '';
    return `<div class="creditos-person">${nombre}${cargo}</div>`;
  }
}
