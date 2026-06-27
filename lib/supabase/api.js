// lib/supabase/api.js
// Cliente Supabase para catálogo público — equivalente de app/js/api-client.js
//
// Tablas y columnas verificadas contra la rama main (ver api-client.js):
//   obras:       id, titulo, slug, artista, año, descripcion, estado, visible_publico
//   imagenes:    id, obra_id, url_storage, principal (boolean), orden
//   obra_tags:   obra_id, tag_id
//   tecnicas:    id, nombre, slug
//   tags:        id, nombre, slug
//   obra_visitas, obra_favoritos, redes_sociales, configuracion_acerca, creditos

import { createClient } from '@supabase/supabase-js';

// La clave anon es pública (segura para exponerse en el cliente).
// El acceso real está restringido por RLS en Supabase.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://kfvjansfmhamkrnbxmgp.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

// Singleton (browser): una sola instancia por página
let _supabase = null;
function getClient() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// Select con relaciones (igual que en api-client.js)
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

// ── Filtrar obras ──────────────────────────────────────────────────────────────
/**
 * Devuelve obras publicadas (visible_publico = true) según los filtros activos.
 * A diferencia del api-client.js original, aquí SÍ se implementa el filtro de tags.
 *
 * @param {Object} filters - { year, technique, tags[], search, onlyFav, favIds[] }
 * @param {number} page
 * @param {number} pageSize
 * @returns {Promise<{ data: Array, total: number, error: any }>}
 */
export async function filterWorks(filters = {}, page = 1, pageSize = 12) {
  const { year, technique, tags = [], search, favIds } = filters;
  const supabase = getClient();
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  try {
    // ── Resolución de IDs de tags (many-to-many) antes de la query principal ──
    let tagFilterIds = null;
    if (tags.length > 0) {
      const { data: taggedRows, error: tagErr } = await supabase
        .from('obra_tags')
        .select('obra_id')
        .in('tag_id', tags);

      if (tagErr) {
        console.error('❌ Error filtrando por tags:', tagErr);
        return { data: [], total: 0, error: tagErr };
      }

      tagFilterIds = [...new Set((taggedRows || []).map((r) => r.obra_id))];
      if (tagFilterIds.length === 0) {
        return { data: [], total: 0, error: null }; // Ninguna obra tiene esos tags
      }
    }

    // ── Query principal ────────────────────────────────────────────────────────
    let query = supabase
      .from('obras')
      .select(OBRA_SELECT, { count: 'exact' })
      .eq('visible_publico', true);

    if (year) query = query.eq('año', parseInt(year, 10));
    if (technique) query = query.eq('tecnica_id', technique);
    if (favIds && favIds.length > 0) query = query.in('id', favIds);
    if (tagFilterIds) query = query.in('id', tagFilterIds);
    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`titulo.ilike.%${s}%,artista.ilike.%${s}%`);
    }

    const { data, error, count } = await query
      .range(start, end)
      .order('año', { ascending: false })
      .order('artista', { ascending: true });

    if (error) {
      console.error('❌ Error cargando obras:', error);
      return { data: [], total: 0, error };
    }

    return { data: data ?? [], total: count ?? 0, error: null };
  } catch (err) {
    console.error('❌ Exception filterWorks:', err);
    return { data: [], total: 0, error: err };
  }
}

// ── Opciones de filtros ────────────────────────────────────────────────────────
export async function getYears() {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('obras')
      .select('año')
      .eq('visible_publico', true)
      .order('año', { ascending: false });

    if (error) return [];
    return [...new Set((data ?? []).map((d) => d.año))].sort((a, b) => b - a);
  } catch {
    return [];
  }
}

export async function getTechniques() {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('tecnicas')
      .select('id, nombre, slug')
      .order('nombre', { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getTags() {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('id, nombre, slug')
      .order('nombre', { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

// ── Estadísticas del hero ──────────────────────────────────────────────────────
export async function getCatalogStats() {
  const supabase = getClient();
  try {
    const [obrasRes, artistasRes, tecnicasRes] = await Promise.all([
      supabase.from('obras').select('*', { count: 'exact', head: true }).eq('visible_publico', true),
      supabase.from('obras').select('artista').eq('visible_publico', true),
      supabase.from('tecnicas').select('*', { count: 'exact', head: true }),
    ]);

    const totalObras    = obrasRes.count ?? 0;
    const totalArtistas = new Set((artistasRes.data ?? []).map((r) => r.artista).filter(Boolean)).size;
    const totalTecnicas = tecnicasRes.count ?? 0;

    return { obras: totalObras, artistas: totalArtistas, tecnicas: totalTecnicas };
  } catch {
    return { obras: 0, artistas: 0, tecnicas: 0 };
  }
}

// ── Favoritos anónimos (obra_favoritos) ───────────────────────────────────────
export async function getFavorites(sessionId) {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('obra_favoritos')
      .select('obra_id')
      .eq('session_id', sessionId);
    if (error) return [];
    return (data ?? []).map((r) => r.obra_id);
  } catch {
    return [];
  }
}

export async function addFavorite(sessionId, obraId) {
  const supabase = getClient();
  try {
    const { error } = await supabase
      .from('obra_favoritos')
      .upsert([{ session_id: sessionId, obra_id: obraId }], {
        onConflict: 'session_id,obra_id',
      });
    return !error;
  } catch {
    return false;
  }
}

export async function removeFavorite(sessionId, obraId) {
  const supabase = getClient();
  try {
    const { error } = await supabase
      .from('obra_favoritos')
      .delete()
      .eq('session_id', sessionId)
      .eq('obra_id', obraId);
    return !error;
  } catch {
    return false;
  }
}

// ── Redes sociales (footer) ───────────────────────────────────────────────────
export async function getRedesSociales() {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('redes_sociales')
      .select('nombre, url, icono, color')
      .eq('visible', true)
      .order('orden', { ascending: true });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

// ── Visita (fire-and-forget) ──────────────────────────────────────────────────
export async function recordVisit(obraId) {
  if (!obraId) return;
  const supabase = getClient();
  try {
    await supabase.from('obra_visitas').insert([{ obra_id: obraId }]);
  } catch { /* silencioso */ }
}

// ── Página Técnicas ───────────────────────────────────────────────────────────
/**
 * Devuelve un mapa { tecnica_id → count } de obras publicadas por técnica.
 * Réplica de api.getWorkCountsByTechnique() de api-client.js.
 */
export async function getWorkCountsByTechnique() {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('obras')
      .select('tecnica_id')
      .eq('visible_publico', true);

    if (error) return {};

    const counts = {};
    (data ?? []).forEach((obra) => {
      if (obra.tecnica_id) {
        counts[obra.tecnica_id] = (counts[obra.tecnica_id] || 0) + 1;
      }
    });
    return counts;
  } catch {
    return {};
  }
}

// ── Página Créditos ───────────────────────────────────────────────────────────
/**
 * Obtiene el texto "Acerca del Taller" en el idioma solicitado.
 * Tabla: configuracion_acerca  Columnas: contenido_es, contenido_en
 * @param {'es'|'en'} [lang='es']
 * @returns {Promise<string>}
 */
export async function getAcerca(lang = 'es') {
  const col = lang === 'en' ? 'contenido_en' : 'contenido_es';
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('configuracion_acerca')
      .select(col)
      .limit(1)
      .single();

    if (error) return '';
    return data?.[col] ?? '';
  } catch {
    return '';
  }
}

/**
 * Obtiene los créditos visibles, ordenados por sección y orden.
 * @returns {Promise<Array<{ id, nombre, cargo, seccion, orden }>>}
 */
export async function getCreditos() {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('creditos')
      .select('id, nombre, cargo, seccion, orden')
      .eq('visible', true)
      .order('seccion', { ascending: true })
      .order('orden', { ascending: true });

    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

// ── Página Registro ───────────────────────────────────────────────────────────
/**
 * Lee el estado del registro desde la tabla registro_config.
 * @returns {Promise<{ registro_activo: boolean, fecha_inicio: string|null, fecha_fin: string|null, mensaje_personalizado: string|null }|null>}
 */
export async function getRegistroConfig() {
  const supabase = getClient();
  try {
    const { data, error } = await supabase
      .from('registro_config')
      .select('registro_activo, fecha_inicio, fecha_fin, mensaje_personalizado')
      .limit(1)
      .single();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}
