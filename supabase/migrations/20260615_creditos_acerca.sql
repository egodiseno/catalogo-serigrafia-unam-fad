-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sistema de Créditos + Acerca (configurable por ADMIN)
-- Fecha: 2026-06-15
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- TABLA 1: configuracion_acerca
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion_acerca (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL DEFAULT 'Acerca',
  contenido        text NOT NULL DEFAULT '',
  updated_at       timestamptz NOT NULL DEFAULT now(),
  actualizado_por  text
);

-- Insertar fila única (UPSERT con id fijo para garantizar row singleton)
INSERT INTO configuracion_acerca (id, titulo, contenido)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Acerca',
  'El Taller de Serigrafía de la Facultad de Artes y Diseño de la UNAM fomenta la preservación y difusión de las artes gráficas mediante el catálogo digital de obra serigráfica.'
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- TABLA 2: creditos
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creditos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seccion          text NOT NULL CHECK (seccion IN ('unam','fad','taller','webmaster')),
  nombre           text NOT NULL DEFAULT '',
  cargo            text NOT NULL DEFAULT '',
  orden            integer NOT NULL DEFAULT 0,
  visible          boolean NOT NULL DEFAULT true,
  tipo             text NOT NULL DEFAULT 'custom' CHECK (tipo IN ('fijo','default','custom')),
  editable_cargo   boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  actualizado_por  text
);

-- ─────────────────────────────────────────────────────────────────
-- DATOS INICIALES — UNAM
-- ─────────────────────────────────────────────────────────────────
INSERT INTO creditos (seccion, nombre, cargo, orden, visible, tipo, editable_cargo) VALUES
  ('unam', 'Leonardo Lomelli Vanegas',                             'Rector',                                                                             1, true,  'fijo',    false),
  ('unam', 'Patricia Dolores Dávila Aranda',                       'Secretaria General',                                                                 2, false, 'default', false),
  ('unam', 'Tomás Humberto Rubio Pérez',                          'Secretario Administrativo',                                                          3, false, 'default', false),
  ('unam', 'Diana Tamara Martínez Ruiz',                          'Secretaria de Desarrollo Institucional',                                             4, false, 'default', false),
  ('unam', 'Raúl Arcenio Aguilar Tamayo',                         'Secretario de Prevención, Atención y Seguridad Universitaria',                       5, false, 'default', false),
  ('unam', 'Hugo Alejandro Concha Cantú',                         'Abogado General',                                                                    6, false, 'default', false),
  ('unam', 'Mauricio López Velázquez',                            'Director General de Comunicación Social',                                            7, false, 'default', false);

-- ─────────────────────────────────────────────────────────────────
-- DATOS INICIALES — FAD
-- ─────────────────────────────────────────────────────────────────
INSERT INTO creditos (seccion, nombre, cargo, orden, visible, tipo, editable_cargo) VALUES
  ('fad', 'Dr. Mauricio de Jesús Juárez Servín',                  'Director',                                                                           1, true,  'fijo',    false),
  ('fad', 'Lic. Mariesel Guadalupe Martínez Fernández',           'Secretaria General',                                                                 2, true,  'default', false),
  ('fad', 'L.C. Viviana Salores Vargas',                          'Jefa Administrativa',                                                                3, true,  'default', false),
  ('fad', 'Dra. Adriana González Romo',                           'Secretaria Académica',                                                               4, true,  'default', false),
  ('fad', 'Mtro. José Luis Anaya Reyes',                          'Coordinador de Difusión Cultural',                                                   5, true,  'default', false);

-- ─────────────────────────────────────────────────────────────────
-- DATOS INICIALES — TALLER DE SERIGRAFÍA
-- ─────────────────────────────────────────────────────────────────
INSERT INTO creditos (seccion, nombre, cargo, orden, visible, tipo, editable_cargo) VALUES
  ('taller', 'Luis Arturo Sánchez Betancourt', 'Coordinador', 1, true, 'custom', true);

-- ─────────────────────────────────────────────────────────────────
-- DATOS INICIALES — WEBMASTER
-- ─────────────────────────────────────────────────────────────────
INSERT INTO creditos (seccion, nombre, cargo, orden, visible, tipo, editable_cargo) VALUES
  ('webmaster', 'Eder Godínez', 'Diseño y Desarrollo Web', 1, true, 'fijo', false);

-- ─────────────────────────────────────────────────────────────────
-- RLS — Row Level Security
-- ─────────────────────────────────────────────────────────────────

-- Activar RLS en ambas tablas
ALTER TABLE configuracion_acerca ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos              ENABLE ROW LEVEL SECURITY;

-- configuracion_acerca: lectura pública (anon), escritura solo autenticados
CREATE POLICY "acerca_select_anon"
  ON configuracion_acerca FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "acerca_update_auth"
  ON configuracion_acerca FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- creditos: lectura pública (anon + authenticated), escritura solo authenticated
CREATE POLICY "creditos_select_all"
  ON creditos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "creditos_insert_auth"
  ON creditos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "creditos_update_auth"
  ON creditos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "creditos_delete_auth"
  ON creditos FOR DELETE
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS creditos_seccion_orden_idx ON creditos (seccion, orden);
