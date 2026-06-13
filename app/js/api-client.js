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
   * Estructura real: sin slug, imagenes.principal es boolean
   */
  async filterWorks(filters = {}, page = 1, pageSize = 12) {
    const { year, technique, search } = filters;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    try {
      let query = supabase
        .from('obras')
        .select(OBRA_SELECT, { count: 'exact' })
        .eq('estado', 'publicado');

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
        .eq('estado', 'publicado')
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
        .eq('estado', 'publicado')
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
        .eq('estado', 'publicado')
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
