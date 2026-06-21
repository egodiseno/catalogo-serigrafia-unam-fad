// app/js/api-client.js
// Cliente Supabase para catálogo público
//
// Estructura real de tablas (verificada 2026-06-12):
//   obras:    id, titulo, artista, año, tecnica_id, descripcion, estado, created_at
//   imagenes: id, obra_id, url_storage, principal (boolean), orden
//   obra_tags: obra_id, tag_id
//   tecnicas: id, nombre, slug, descripcion
//   tags:     id, nombre, slug

const SUPABASE_URL = 'https://kfvjansfmhamkrnbxmgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

// Select reutilizable con la estructura real
const OBRA_SELECT = `
  id,
  titulo,
  slug,
  artista,
  año,
  descripcion,
  tecnica:tecnica_id(id, nombre, slug),
  tags:obra_tags(tag:tag_id(id, nombre, slug)),
  imagenes(id, url_storage, principal, orden)
`;

// Inicializar cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const api = {
  /**
   * Filtrar obras (carga inicial + filtros real-time)
   * Estructura real: obras.slug generado por trigger, imagenes.principal es boolean
   */
  async filterWorks(filters = {}, page = 1, pageSize = 12) {
    const { year, technique, search } = filters;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    try {
      let query = supabase
        .from('obras')
        .select(OBRA_SELECT, { count: 'exact' })
        .eq('estado', 'Publicado');

      if (year) {
        query = query.eq('año', parseInt(year));
      }

      if (technique) {
        query = query.eq('tecnica_id', technique);
      }

      if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`titulo.ilike.%${s}%,artista.ilike.%${s}%`);
      }

      const { data, error, count } = await query
        .range(start, end)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error filtering works:', error);
        return { data: [], total: 0, error };
      }

      console.log(`✅ Filtro aplicado: ${data.length} obras de ${count}`);
      return { data, total: count, error: null };
    } catch (err) {
      console.error('❌ Exception filterWorks:', err);
      return { data: [], total: 0, error: err };
    }
  },

  /**
   * Obtener obra por id (UUID)
   * @param {string} id - UUID de la obra
   * @returns {Promise} { data, error }
   */
  async getWorkById(id) {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select(OBRA_SELECT)
        .eq('id', id)
        .eq('estado', 'Publicado')
        .single();

      if (error) {
        console.error('❌ Error fetching work:', error);
        return { data: null, error };
      }

      console.log(`✅ Obra cargada: ${data.titulo}`);
      return { data, error: null };
    } catch (err) {
      console.error('❌ Exception getWorkById:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Obtener obra por slug
   * @param {string} slug - ej: "viento-azul-ana-martnez-e32f"
   * @returns {Promise} { data, error }
   */
  async getWorkBySlug(slug) {
    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return { data: null, error: new Error('slug inválido o vacío') };
    }

    try {
      const { data, error } = await supabase
        .from('obras')
        .select(OBRA_SELECT)
        .eq('slug', slug.trim())
        .eq('estado', 'Publicado')
        .single();

      if (error) {
        console.error('❌ Error fetching work by slug:', error);
        return { data: null, error };
      }

      console.log(`✅ Obra cargada: ${data.titulo}`);
      return { data, error: null };
    } catch (err) {
      console.error('❌ Exception getWorkBySlug:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Obtener años únicos de obras publicadas
   */
  async getYears() {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('año')
        .eq('estado', 'Publicado')
        .order('año', { ascending: false });

      if (error) {
        console.error('❌ Error fetching years:', error);
        return [];
      }

      const years = [...new Set(data.map(d => d.año))].sort((a, b) => b - a);
      console.log(`✅ Años cargados: ${years.join(', ')}`);
      return years;
    } catch (err) {
      console.error('❌ Exception getYears:', err);
      return [];
    }
  },

  /**
   * Obtener todas las técnicas
   */
  async getTechniques() {
    try {
      const { data, error } = await supabase
        .from('tecnicas')
        .select('id, nombre, slug')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error fetching techniques:', error);
        return [];
      }

      console.log(`✅ Técnicas cargadas: ${data.length}`);
      return data;
    } catch (err) {
      console.error('❌ Exception getTechniques:', err);
      return [];
    }
  },

  /**
   * Contar obras publicadas por técnica.
   * Devuelve un objeto { [tecnica_id]: count }
   */
  async getWorkCountsByTechnique() {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('tecnica_id')
        .eq('estado', 'Publicado');

      if (error) {
        console.error('❌ Error counting by technique:', error);
        return {};
      }

      const counts = {};
      data.forEach(obra => {
        if (obra.tecnica_id) {
          counts[obra.tecnica_id] = (counts[obra.tecnica_id] || 0) + 1;
        }
      });
      console.log('✅ Conteos por técnica:', counts);
      return counts;
    } catch (err) {
      console.error('❌ Exception getWorkCountsByTechnique:', err);
      return {};
    }
  },

  /**
   * Obtener texto "Acerca" desde configuracion_acerca
   * Selecciona la columna según el idioma activo:
   *   'es' → contenido_es  |  'en' → contenido_en
   * Requiere columnas contenido_es y contenido_en en la tabla.
   * @param {string} [lang='es'] - idioma activo ('es' | 'en')
   * @returns {Promise<string>} contenido o cadena vacía si falla
   */
  async getAcerca(lang = 'es') {
    const col = lang === 'en' ? 'contenido_en' : 'contenido_es';
    try {
      const { data, error } = await supabase
        .from('configuracion_acerca')
        .select(col)
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Error fetching acerca:', error);
        return '';
      }

      console.log(`✅ Acerca cargada (${lang})`);
      return data?.[col] ?? '';
    } catch (err) {
      console.error('❌ Exception getAcerca:', err);
      return '';
    }
  },

  /**
   * Obtener créditos visibles ordenados por sección y orden
   * @returns {Promise<Array>} array de registros { nombre, cargo, seccion, orden } o []
   */
  async getCreditos() {
    try {
      const { data, error } = await supabase
        .from('creditos')
        .select('id, nombre, cargo, seccion, orden')
        .eq('visible', true)
        .order('seccion', { ascending: true })
        .order('orden', { ascending: true });

      if (error) {
        console.error('❌ Error fetching creditos:', error);
        return [];
      }

      console.log(`✅ Créditos cargados: ${data.length}`);
      return data;
    } catch (err) {
      console.error('❌ Exception getCreditos:', err);
      return [];
    }
  },

  /**
   * Obtener redes sociales visibles ordenadas por orden
   * @returns {Promise<Array>} [{ nombre, url, icono, color }] o []
   */
  async getRedesSociales() {
    try {
      const { data, error } = await supabase
        .from('redes_sociales')
        .select('nombre, url, icono, color')
        .eq('visible', true)
        .order('orden', { ascending: true });

      if (error) {
        console.error('❌ Error fetching redes sociales:', error);
        return [];
      }

      console.log(`✅ Redes sociales cargadas: ${data.length}`);
      return data;
    } catch (err) {
      console.error('❌ Exception getRedesSociales:', err);
      return [];
    }
  },

  /**
   * Obtener todos los tags
   */
  async getTags() {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, nombre, slug')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error fetching tags:', error);
        return [];
      }

      console.log(`✅ Tags cargados: ${data.length}`);
      return data;
    } catch (err) {
      console.error('❌ Exception getTags:', err);
      return [];
    }
  }
};
