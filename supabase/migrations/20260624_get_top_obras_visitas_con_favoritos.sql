-- 20260624_get_top_obras_visitas_con_favoritos.sql
-- Reemplaza get_top_obras_visitas_mes para incluir corazones totales acumulados.
-- Cambios respecto a la versión original:
--   • Nuevo parámetro por defecto: p_limit = 10 (antes 5)
--   • Nueva columna de retorno: favoritos BIGINT (total acumulado sin filtro de fecha)
--   • Subquery correlacionada en obra_favoritos para evitar multiplicación de filas
--     que ocurriría con LEFT JOIN + GROUP BY

CREATE OR REPLACE FUNCTION get_top_obras_visitas_mes(p_limit INT DEFAULT 10)
RETURNS TABLE(
  obra_id   UUID,
  titulo    TEXT,
  artista   TEXT,
  visitas   BIGINT,
  favoritos BIGINT
)
LANGUAGE sql STABLE AS $$
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
  WHERE v.fecha >= date_trunc('month', now())
  GROUP BY v.obra_id, o.titulo, o.artista
  ORDER BY visitas DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_obras_visitas_mes TO authenticated;
