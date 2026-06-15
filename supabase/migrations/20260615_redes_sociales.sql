-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Redes Sociales (configurable por ADMIN)
-- Fecha: 2026-06-15
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS redes_sociales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,
  url              text NOT NULL,
  icono            text NOT NULL DEFAULT 'globe',
  orden            integer NOT NULL DEFAULT 0,
  visible          boolean NOT NULL DEFAULT true,
  color            text NOT NULL DEFAULT '#013B75',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  actualizado_por  text
);

-- Índice para orden
CREATE INDEX IF NOT EXISTS redes_sociales_orden_idx ON redes_sociales (orden);

-- RLS
ALTER TABLE redes_sociales ENABLE ROW LEVEL SECURITY;

-- Lectura pública (footer del catálogo)
CREATE POLICY "redes_select_public"
  ON redes_sociales FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escritura solo autenticados
CREATE POLICY "redes_insert_auth"
  ON redes_sociales FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "redes_update_auth"
  ON redes_sociales FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "redes_delete_auth"
  ON redes_sociales FOR DELETE
  TO authenticated USING (true);
