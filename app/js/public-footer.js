// app/js/public-footer.js
// Footer compartido — carga redes sociales dinámicamente desde Supabase

import { api } from './api-client.js';

export class PublicFooter {
  constructor() {
    this.redesEl = document.getElementById('redesSocialesFooter');
  }

  async init() {
    // Silencioso: si no hay container, no hay nada que hacer
    if (!this.redesEl) return;

    try {
      const redes = await api.getRedesSociales();
      this._renderRedes(redes);
    } catch (err) {
      console.warn('⚠️ Footer: redes sociales no disponibles', err);
    }
  }

  _renderRedes(redes) {
    if (!this.redesEl) return;

    if (!redes.length) {
      // Ocultar toda la columna si no hay redes configuradas
      this.redesEl.closest('.footer-rrss')?.setAttribute('hidden', '');
      return;
    }

    this.redesEl.innerHTML = redes.map(red => {
      const bg    = red.color ? red.color : '#013b75';
      const icono = red.icono ? red.icono.toLowerCase().trim() : 'globe';
      const nombre = red.nombre || icono;
      return `<a
        class="rrss-icon-footer"
        href="${red.url}"
        target="_blank"
        rel="noopener noreferrer"
        style="background-color: ${bg};"
        title="Síguenos en ${nombre}"
        aria-label="Ir a ${nombre}"
      ><i class="bi bi-${icono}" aria-hidden="true"></i></a>`;
    }).join('');
  }
}
