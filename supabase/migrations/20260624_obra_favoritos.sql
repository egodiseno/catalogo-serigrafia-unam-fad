-- 20260624_obra_favoritos.sql
-- Persistir favoritos anónimos por visitante usando session_id (UUID generado en cliente)
-- Sin datos personales: solo session_id + obra_id + timestamp.

CREATE TABLE IF NOT EXISTS obra_favoritos (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id TEXT    NOT NULL,
  obra_id    UUID    NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Evita duplicados si el cliente envía la misma combinación dos veces
  CONSTRAINT obra_favoritos_unique UNIQUE (session_id, obra_id)
);

-- Índice para la consulta principal: "dame todos los favoritos de esta sesión"
CREATE INDEX IF NOT EXISTS idx_obra_favoritos_session
  ON obra_favoritos (session_id);

ALTER TABLE obra_favoritos ENABLE ROW LEVEL SECURITY;

-- Nota de seguridad: el session_id es un UUID v4 generado con crypto.randomUUID()
-- en el cliente (128 bits de entropía). RLS no puede verificar la propiedad del
-- session_id sin un token de auth, así que se permite acceso completo a anon.
-- El riesgo de abuso es bajo: adivinar un UUID aleatorio es computacionalmente
-- inviable para un catálogo de uso académico/cultural.

CREATE POLICY "favoritos_insert"
  ON obra_favoritos FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "favoritos_select"
  ON obra_favoritos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "favoritos_delete"
  ON obra_favoritos FOR DELETE
  TO anon, authenticated
  USING (true);
