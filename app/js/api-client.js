// app/js/api-client.js
// Cliente Supabase para catálogo público
//
// Estructura real de tablas (verificada 2026-06-21):
//   obras:    id, titulo, artista, año, tecnica_id, descripcion, estado, visible_publico, created_at
//   visible_publico (boolean) es la única fuente de verdad para el catálogo público.
//   estado refleja el flujo interno (Borrador / En Revisión / Publicado / Archivado)
//   y NO se usa como filtro aquí — una obra reabierta para edición mantiene visible_publico=true.
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
        .eq('visible_publico', true);

      if (year) {
        query = query.eq('año', parseInt(year));
      }

      if (technique) {
        query = query.eq('tecnica_id', technique);
      }

      // Filtro por IDs de favoritos guardados en localStorage
      if (filters.favIds && filters.favIds.length > 0) {
        query = query.in('id', filters.favIds);
      }

      if (search && search.trim()) {
        const s = search.trim();
        query = query.or(`titulo.ilike.%${s}%,artista.ilike.%${s}%`);
      }

      const { data, error, count } = await query
        .range(start, end)
        .order('año', { ascending: false })
        .order('artista', { ascending: true });

      if (error) {
        console.error('❌ Error filtering works:', error);
        return { data: [], total: 0, error };
      }

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
        .eq('visible_publico', true)
        .single();

      if (error) {
        console.error('❌ Error fetching work:', error);
        return { data: null, error };
      }

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
        .eq('visible_publico', true)
        .single();

      if (error) {
        console.error('❌ Error fetching work by slug:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('❌ Exception getWorkBySlug:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Obtener años únicos de obras visibles al público (visible_publico = true)
   */
  async getYears() {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('año')
        .eq('visible_publico', true)
        .order('año', { ascending: false });

      if (error) {
        console.error('❌ Error fetching years:', error);
        return [];
      }

      const years = [...new Set(data.map(d => d.año))].sort((a, b) => b - a);
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

      return data;
    } catch (err) {
      console.error('❌ Exception getTechniques:', err);
      return [];
    }
  },

  /**
   * Contar obras visibles al público (visible_publico = true) por técnica.
   * Devuelve un objeto { [tecnica_id]: count }
   */
  async getWorkCountsByTechnique() {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('tecnica_id')
        .eq('visible_publico', true);

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

      return data;
    } catch (err) {
      console.error('❌ Exception getRedesSociales:', err);
      return [];
    }
  },

  /**
   * Estadísticas del catálogo — para el bloque hero del home.
   * Tres queries en paralelo:
   *   obras    → COUNT(*) FROM obras WHERE visible_publico = true
   *   artistas → COUNT(DISTINCT artista) — calculado en JS desde la columna artista
   *   tecnicas → COUNT(*) FROM tecnicas
   * @returns {Promise<{obras: number, artistas: number, tecnicas: number}>}
   */
  async getCatalogStats() {
    try {
      const [obrasRes, artistasRes, tecnicasRes] = await Promise.all([
        // Total obras públicas — head:true evita traer filas, solo el count
        supabase
          .from('obras')
          .select('*', { count: 'exact', head: true })
          .eq('visible_publico', true),
        // Artistas distintos — fetch solo la columna artista, deduplicar en JS
        supabase
          .from('obras')
          .select('artista')
          .eq('visible_publico', true),
        // Total técnicas
        supabase
          .from('tecnicas')
          .select('*', { count: 'exact', head: true }),
      ]);

      const totalObras    = obrasRes.count ?? 0;
      const totalArtistas = new Set((artistasRes.data ?? []).map(r => r.artista).filter(Boolean)).size;
      const totalTecnicas = tecnicasRes.count ?? 0;

      return { obras: totalObras, artistas: totalArtistas, tecnicas: totalTecnicas };
    } catch (err) {
      console.error('❌ Exception getCatalogStats:', err);
      return { obras: 0, artistas: 0, tecnicas: 0 };
    }
  },

  /**
   * Registrar visita a una obra (fire-and-forget, sin datos personales)
   * Inserta en obra_visitas con la fecha actual. No espera respuesta — la UI no debe
   * depender de este resultado. Llamar con .catch(() => {}) en el punto de uso.
   * @param {string} obraId - UUID de la obra
   */
  async recordVisit(obraId) {
    if (!obraId) return;
    try {
      await supabase.from('obra_visitas').insert([{ obra_id: obraId }]);
    } catch { /* silencioso — no bloquea la UI */ }
  },

  // ── Favoritos anónimos (tabla obra_favoritos) ────────────────────────────

  /**
   * Cargar todos los obra_id marcados como favorito para un session_id.
   * @param {string} sessionId - UUID del visitante anónimo
   * @returns {Promise<string[]>} array de UUIDs de obras
   */
  async getFavorites(sessionId) {
    try {
      const { data, error } = await supabase
        .from('obra_favoritos')
        .select('obra_id')
        .eq('session_id', sessionId);

      if (error) {
        console.error('❌ Error fetching favorites:', error);
        return [];
      }

      return (data ?? []).map(r => r.obra_id);
    } catch (err) {
      console.error('❌ Exception getFavorites:', err);
      return [];
    }
  },

  /**
   * Agregar un favorito. Usa upsert para tolerar dobles clics rápidos.
   * @param {string} sessionId
   * @param {string} obraId
   * @returns {Promise<boolean>} true si la operación tuvo éxito
   */
  async addFavorite(sessionId, obraId) {
    try {
      const { error } = await supabase
        .from('obra_favoritos')
        .upsert([{ session_id: sessionId, obra_id: obraId }], {
          onConflict: 'session_id,obra_id',
        });

      if (error) {
        console.error('❌ Error adding favorite:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Exception addFavorite:', err);
      return false;
    }
  },

  /**
   * Eliminar un favorito.
   * @param {string} sessionId
   * @param {string} obraId
   * @returns {Promise<boolean>} true si la operación tuvo éxito
   */
  async removeFavorite(sessionId, obraId) {
    try {
      const { error } = await supabase
        .from('obra_favoritos')
        .delete()
        .eq('session_id', sessionId)
        .eq('obra_id', obraId);

      if (error) {
        console.error('❌ Error removing favorite:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Exception removeFavorite:', err);
      return false;
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

      return data;
    } catch (err) {
      console.error('❌ Exception getTags:', err);
      return [];
    }
  }
};
