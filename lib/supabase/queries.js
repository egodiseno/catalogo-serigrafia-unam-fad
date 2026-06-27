// lib/supabase/queries.js
// Queries Supabase seguras para Server Components de Next.js.
// Usa React cache() para deduplicar dentro del mismo render pass,
// lo que permite llamar fetchWorkBySlug desde generateMetadata Y desde
// el componente de página sin ejecutar dos veces la query a Supabase.

import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://kfvjansfmhamkrnbxmgp.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE';

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

/**
 * Obtiene una obra por slug (visible_publico = true).
 * Cacheada con React cache(): si generateMetadata y la página la llaman en el
 * mismo request, Supabase recibe una sola petición.
 *
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export const fetchWorkBySlug = cache(async (slug) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from('obras')
    .select(OBRA_SELECT)
    .eq('slug', slug)
    .eq('visible_publico', true)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      // PGRST116 = no rows — se maneja con notFound()
      console.error('[SSR] fetchWorkBySlug:', error.message);
    }
    return null;
  }

  return data;
});
