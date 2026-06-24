-- 20260623_obra_visitas.sql
-- Tabla para registrar visitas a fichas de obras (fire-and-forget, sin datos personales)

CREATE TABLE IF NOT EXISTS obra_visitas (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  obra_id  UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  fecha    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_visitas_obra_fecha
  ON obra_visitas (obra_id, fecha);

ALTER TABLE obra_visitas ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (anon o autenticado) puede insertar una visita
CREATE POLICY "visitas_insert_public"
  ON obra_visitas FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Solo usuarios autenticados pueden consultar visitas (para el dashboard admin)
CREATE POLICY "visitas_select_authenticated"
  ON obra_visitas FOR SELECT
  TO authenticated
  USING (true);

-- Función RPC: top N obras más visitadas en el mes actual
CREATE OR REPLACE FUNCTION get_top_obras_visitas_mes(p_limit INT DEFAULT 5)
RETURNS TABLE(obra_id UUID, titulo TEXT, artista TEXT, visitas BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT
    v.obra_id,
    o.titulo,
    o.artista,
    COUNT(*) AS visitas
  FROM obra_visitas v
  JOIN obras o ON o.id = v.obra_id
  WHERE v.fecha >= date_trunc('month', now())
  GROUP BY v.obra_id, o.titulo, o.artista
  ORDER BY visitas DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_obras_visitas_mes TO authenticated;
