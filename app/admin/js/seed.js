/**
 * seed.js — Datos iniciales para desarrollo / testing
 * NTH-01: Solo corre en localhost; se salta si ya hay datos
 *
 * Depende de: config.js (window.supabase_client), error-handler.js
 */

const Seed = (() => {
  const client = window.supabase_client;

  async function init() {
    // Solo en entorno local
    if (!window.location.hostname.match(/localhost|127\.0\.0\.1/)) {
      console.log('ℹ️  Seed deshabilitado fuera de localhost');
      return;
    }

    console.log('🌱 Verificando seed data…');

    try {
      // Si ya hay técnicas, asumir que el seed ya corrió
      const { count } = await client
        .from('tecnicas')
        .select('*', { count: 'exact', head: true });

      if (count && count > 0) {
        console.log(`✅ Seed omitido (${count} técnicas ya existen)`);
        return;
      }

      console.log('📝 Insertando seed data…');

      // ── Técnicas ──────────────────────────────────────────
      const { error: errTec } = await client.from('tecnicas').insert([
        { nombre: 'Serigrafía manual',   slug: 'serigrafia-manual',   descripcion: 'Técnica tradicional de impresión manual con bastidor y rasqueta' },
        { nombre: 'Serigrafía digital',  slug: 'serigrafia-digital',  descripcion: 'Proceso de separación de colores asistido por software' },
        { nombre: 'Litografía',          slug: 'litografia',          descripcion: 'Impresión planográfica sobre piedra o plancha metálica' },
      ]);
      if (errTec) throw errTec;
      console.log('   ✅ Técnicas insertadas');

      // ── Tags ───────────────────────────────────────────────
      const { error: errTag } = await client.from('tags').insert([
        { nombre: 'Abstracto',      slug: 'abstracto'      },
        { nombre: 'Figurativo',     slug: 'figurativo'     },
        { nombre: 'Experimental',   slug: 'experimental'   },
        { nombre: 'Vintage',        slug: 'vintage'        },
        { nombre: 'Contemporáneo',  slug: 'contemporaneo'  },
      ]);
      if (errTag) throw errTag;
      console.log('   ✅ Tags insertados');

      window.ErrorHandler?.showToast('🌱 Seed data insertado', 'success');

      // Notificar a los módulos que refresquen sus cachés
      document.dispatchEvent(new CustomEvent('tecnicas:updated'));
      document.dispatchEvent(new CustomEvent('tags:updated'));

    } catch (err) {
      // No crítico: solo log, sin toast de error al usuario
      console.warn('⚠️  Seed (non-fatal):', err.message ?? err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 600));
  } else {
    setTimeout(init, 600);
  }

  return { init };
})();

window.Seed = Seed;
console.log('🌱 seed.js cargado');
