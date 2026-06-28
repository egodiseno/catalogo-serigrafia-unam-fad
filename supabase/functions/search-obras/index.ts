/**
 * Edge Function: search-obras
 * ──────────────────────────────────────────────────────────────────────────────
 * Búsqueda full-text en obras del catálogo público.
 *
 * Prerequisito: columna search_vector (tsvector) + índice GIN en tabla obras.
 * Migración:    supabase/migrations/20260628_add_fulltext_obras.sql
 *
 * Endpoint: GET /functions/v1/search-obras
 *
 * Query params:
 *   q         string   Término de búsqueda (requerido; vacío → { data:[], total:0 })
 *   tecnica   UUID     Filtrar por técnica (opcional)
 *   year_min  integer  Año mínimo inclusive (opcional)
 *   year_max  integer  Año máximo inclusive (opcional)
 *   tags      UUID     ID de tag — repetir el param para múltiples tags (opcional)
 *   limit     integer  Máx resultados (default 50, tope 100)
 *
 * Respuesta 200:
 *   { data: Obra[], total: number }
 *
 *   Cada Obra incluye: id, titulo, slug, artista, año, descripcion,
 *   tecnica { id, nombre, slug }, tags [{ tag { id, nombre, slug } }],
 *   imagenes [{ id, url_storage, principal, orden }]
 *
 * Respuesta de error:
 *   { error: string }
 *
 * Notas de implementación:
 *   - verify_jwt = false → endpoint público; no requiere Bearer token.
 *   - Usa .textSearch('search_vector', q, { type: 'plain', config: 'spanish' })
 *     que emite: search_vector @@ plainto_tsquery('spanish', q)
 *     y aprovecha el índice GIN para búsqueda eficiente.
 *   - Resultados ordenados por año DESC, artista ASC.
 *     Para ranking exacto por ts_rank usar el RPC search_obras_fts directamente.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

// Misma proyección que OBRA_SELECT en api-client.js y lib/supabase/api.js
const OBRA_SELECT = `
  id, titulo, slug, artista, año, descripcion,
  tecnica:tecnica_id(id, nombre, slug),
  tags:obra_tags(tag:tag_id(id, nombre, slug)),
  imagenes(id, url_storage, principal, orden)
`;

// ── Handler ────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  try {
    const url     = new URL(req.url);
    const q       = url.searchParams.get('q')?.trim() ?? '';
    const tecnica = url.searchParams.get('tecnica') || null;
    const yearMin = url.searchParams.get('year_min') ? Number(url.searchParams.get('year_min')) : null;
    const yearMax = url.searchParams.get('year_max') ? Number(url.searchParams.get('year_max')) : null;
    const tags    = url.searchParams.getAll('tags').filter(Boolean);
    const limit   = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);

    // Término vacío → respuesta vacía sin consultar la DB
    if (!q) {
      return new Response(JSON.stringify({ data: [], total: 0 }), {
        headers: JSON_HEADERS,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    // ── Resolución previa de tags (many-to-many) ──────────────────────────────
    let tagFilterIds: string[] | null = null;
    if (tags.length > 0) {
      const { data: taggedRows, error: tagErr } = await supabase
        .from('obra_tags')
        .select('obra_id')
        .in('tag_id', tags);

      if (tagErr) throw tagErr;

      tagFilterIds = [
        ...new Set((taggedRows ?? []).map((r: { obra_id: string }) => r.obra_id)),
      ];

      // Ninguna obra tiene esos tags → resultado vacío sin más queries
      if (tagFilterIds.length === 0) {
        return new Response(JSON.stringify({ data: [], total: 0 }), {
          headers: JSON_HEADERS,
        });
      }
    }

    // ── Query principal con full-text search ──────────────────────────────────
    // .textSearch() emite: search_vector @@ plainto_tsquery('spanish', q)
    // Usa el índice GIN idx_obras_search para eficiencia.
    let query = supabase
      .from('obras')
      .select(OBRA_SELECT, { count: 'exact' })
      .eq('visible_publico', true)
      .textSearch('search_vector', q, { type: 'plain', config: 'spanish' });

    if (tecnica)      query = query.eq('tecnica_id', tecnica);
    if (yearMin)      query = query.gte('año', yearMin);
    if (yearMax)      query = query.lte('año', yearMax);
    if (tagFilterIds) query = query.in('id', tagFilterIds);

    const { data, count, error } = await query
      .order('año',     { ascending: false })
      .order('artista', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return new Response(
      JSON.stringify({ data: data ?? [], total: count ?? (data?.length ?? 0) }),
      { headers: JSON_HEADERS },
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('[search-obras]', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
