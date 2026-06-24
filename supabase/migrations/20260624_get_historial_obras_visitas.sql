-- 20260624_get_historial_obras_visitas.sql
-- RPC para historial completo de visitas (todos los tiempos) con paginación.
-- Agrupa obra_visitas por obra_id sin filtro de fecha.
-- Incluye corazones totales via subquery correlacionada (evita multiplicación de filas).
--
-- Parámetros:
--   p_ascending BOOLEAN DEFAULT false  → false = DESC (mayor a menor), true = ASC
--   p_limit     INT     DEFAULT 20     → rows por página
--   p_offset    INT     DEFAULT 0      → offset para paginación
--
-- Columnas devueltas:
--   obra_id, titulo, artista, visitas BIGINT, favoritos BIGINT

CREATE OR REPLACE FUNCTION get_historial_obras_visitas(
  p_ascending BOOLEAN DEFAULT false,
  p_limit     INT     DEFAULT 20,
  p_offset    INT     DEFAULT 0
)
RETURNS TABLE(
  obra_id   UUID,
  titulo    TEXT,
  artista   TEXT,
  visitas   BIGINT,
  favoritos BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT *
  FROM (
    SELECT
      v.obra_id,
      o.titulo,
      o.artista,
      COUNT(*)  AS visitas,
      -- Corazones TOTALES acumulados (sin restricción de fecha)
      (SELECT COUNT(*)
         FROM obra_favoritos f
        WHERE f.obra_id = v.obra_id) AS favoritos
    FROM obra_visitas v
    JOIN obras o ON o.id = v.obra_id
    GROUP BY v.obra_id, o.titulo, o.artista
  ) sub
  -- Truco CASE WHEN para orden condicional sin PL/pgSQL:
  -- Cuando NOT p_ascending (DESC): la primera expresión devuelve visitas,
  --   la segunda devuelve NULL → sin efecto secundario.
  -- Cuando p_ascending (ASC): la primera devuelve NULL → sin efecto,
  --   la segunda devuelve visitas, ordenada ASC.
  ORDER BY
    CASE WHEN NOT p_ascending THEN visitas END DESC NULLS LAST,
    CASE WHEN     p_ascending THEN visitas END ASC  NULLS LAST
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_historial_obras_visitas TO authenticated;
