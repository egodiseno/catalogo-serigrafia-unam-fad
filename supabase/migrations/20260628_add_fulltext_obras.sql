-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 20260628_add_fulltext_obras
-- Full-text search en tabla obras
--
-- Agrega columna search_vector (tsvector) con índice GIN y trigger de
-- actualización automática en INSERT / UPDATE de campos clave.
--
-- Diccionario: 'spanish' — normaliza lemas, acentos y stopwords en español.
--
-- Pesos:
--   A — titulo       (mayor relevancia)
--   B — artista      (alta relevancia)
--   C — descripcion  (relevancia normal)
--
-- Cómo aplicar: Ejecutar en el SQL Editor del proyecto Supabase hospedado.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Columna search_vector (idempotente con IF NOT EXISTS)
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Poblar filas existentes con pesos ponderados
UPDATE obras
  SET search_vector =
    setweight(to_tsvector('spanish', coalesce(titulo, '')),       'A') ||
    setweight(to_tsvector('spanish', coalesce(artista, '')),      'B') ||
    setweight(to_tsvector('spanish', coalesce(descripcion, '')),  'C');

-- 3. Índice GIN para búsqueda @@ eficiente (sub-ms en tablas de hasta ~1M filas)
CREATE INDEX IF NOT EXISTS idx_obras_search
  ON obras USING gin(search_vector);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Función trigger para mantener search_vector actualizado automáticamente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION obras_search_vector_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.titulo, '')),       'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.artista, '')),      'B') ||
    setweight(to_tsvector('spanish', coalesce(NEW.descripcion, '')),  'C');
  RETURN NEW;
END;
$$;

-- 5. Trigger (BEFORE INSERT OR UPDATE — solo re-calcula si cambiaron los campos)
DROP TRIGGER IF EXISTS trg_obras_search_vector ON obras;
CREATE TRIGGER trg_obras_search_vector
  BEFORE INSERT OR UPDATE OF titulo, artista, descripcion
  ON obras
  FOR EACH ROW
  EXECUTE FUNCTION obras_search_vector_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC search_obras_fts — búsqueda con ranking por ts_rank
--
--    Retorna IDs de obras ordenados por relevancia descendente.
--    Admite filtros opcionales: técnica, año, tags.
--
--    Uso desde cliente:
--      supabase.rpc('search_obras_fts', { p_query: 'serigrafía', p_limit: 50 })
--
--    También usada internamente por el Edge Function search-obras cuando
--    se requiere ordering por ts_rank en lugar de año/artista.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_obras_fts(
  p_query    TEXT,
  p_tecnica  UUID    DEFAULT NULL,
  p_year_min INTEGER DEFAULT NULL,
  p_year_max INTEGER DEFAULT NULL,
  p_tags     UUID[]  DEFAULT NULL,
  p_limit    INTEGER DEFAULT 50
)
RETURNS TABLE (id UUID, rank REAL)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    o.id,
    ts_rank(o.search_vector, plainto_tsquery('spanish', p_query))::real AS rank
  FROM obras o
  WHERE
    o.visible_publico = true
    AND o.search_vector @@ plainto_tsquery('spanish', p_query)
    AND (p_tecnica  IS NULL OR o.tecnica_id = p_tecnica)
    AND (p_year_min IS NULL OR o.año >= p_year_min)
    AND (p_year_max IS NULL OR o.año <= p_year_max)
    AND (p_tags IS NULL OR EXISTS (
          SELECT 1 FROM obra_tags ot
          WHERE ot.obra_id = o.id AND ot.tag_id = ANY(p_tags)
        ))
  ORDER BY rank DESC, o.año DESC
  LIMIT p_limit;
$$;

-- Acceso público (catálogo es público)
GRANT EXECUTE ON FUNCTION search_obras_fts TO anon, authenticated;
