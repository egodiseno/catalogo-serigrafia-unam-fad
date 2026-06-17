-- ══════════════════════════════════════════════════════════════════════════════
-- SETUP COMPLETO — Ejecutar en Supabase SQL Editor
-- Fecha: 2026-06-17
--
-- Incluye TODAS las migraciones pendientes en orden correcto:
--   1. numero_cuenta en usuarios_admin    (ya puede existir — IF NOT EXISTS)
--   2. Tablas registro_alumnos y registro_config
--   3. RLS habilitado + todas las policies
--
-- 100% IDEMPOTENTE: seguro de re-ejecutar varias veces.
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1: usuarios_admin — agregar numero_cuenta
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE usuarios_admin
  ADD COLUMN IF NOT EXISTS numero_cuenta TEXT UNIQUE;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2: Tabla registro_alumnos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registro_alumnos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL UNIQUE,
  nombre           TEXT        NOT NULL,
  numero_cuenta    TEXT        NOT NULL,
  telefono         TEXT,
  tiene_whatsapp   BOOLEAN     NOT NULL DEFAULT false,
  estado           TEXT        NOT NULL DEFAULT 'pendiente_validacion',
  fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_activacion TIMESTAMPTZ,
  notas_admin      TEXT,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT registro_alumnos_estado_values
    CHECK (estado IN ('pendiente_validacion', 'activo', 'rechazado')),

  CONSTRAINT registro_alumnos_numero_cuenta_formato
    CHECK (numero_cuenta ~ '^[0-9]{9}$')
);

CREATE INDEX IF NOT EXISTS idx_registro_alumnos_email
  ON registro_alumnos (email);

CREATE INDEX IF NOT EXISTS idx_registro_alumnos_numero_cuenta
  ON registro_alumnos (numero_cuenta);

CREATE INDEX IF NOT EXISTS idx_registro_alumnos_estado
  ON registro_alumnos (estado);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3: Tabla registro_config + fila default
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registro_config (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_activo       BOOLEAN     NOT NULL DEFAULT false,
  fecha_inicio          DATE,
  fecha_fin             DATE,
  mensaje_personalizado TEXT,
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertar fila default solo si la tabla está vacía
INSERT INTO registro_config (registro_activo, fecha_inicio, fecha_fin, mensaje_personalizado)
SELECT
  false,
  '2026-07-01'::date,
  '2026-07-15'::date,
  'El registro está abierto del 1 al 15 de julio'
WHERE NOT EXISTS (SELECT 1 FROM registro_config);


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4: Habilitar RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE registro_alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_config  ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 5: Policies — registro_config
-- ─────────────────────────────────────────────────────────────────────────────

-- Solo admin y super_editor pueden leer/modificar la configuración
DROP POLICY IF EXISTS "registro_config_admin_only" ON registro_config;
CREATE POLICY "registro_config_admin_only"
  ON registro_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_admin
       WHERE id  = auth.uid()
         AND rol IN ('admin', 'super_editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_admin
       WHERE id  = auth.uid()
         AND rol IN ('admin', 'super_editor')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE 6: Policies — registro_alumnos
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin y super_editor ven y modifican TODOS los registros
-- (Las Edge Functions usan service_role y omiten RLS automáticamente)
DROP POLICY IF EXISTS "registro_alumnos_admin_read" ON registro_alumnos;
DROP POLICY IF EXISTS "registro_alumnos_admin_all"  ON registro_alumnos;
CREATE POLICY "registro_alumnos_admin_all"
  ON registro_alumnos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_admin
       WHERE id  = auth.uid()
         AND rol IN ('admin', 'super_editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_admin
       WHERE id  = auth.uid()
         AND rol IN ('admin', 'super_editor')
    )
  );

-- Anon puede INSERT (formulario público registro.html)
DROP POLICY IF EXISTS "registro_alumnos_public_insert" ON registro_alumnos;
CREATE POLICY "registro_alumnos_public_insert"
  ON registro_alumnos
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Alumno autenticado puede ver su propio registro
DROP POLICY IF EXISTS "registro_alumnos_self_read" ON registro_alumnos;
CREATE POLICY "registro_alumnos_self_read"
  ON registro_alumnos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN — Ejecutar después para confirmar
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Tablas creadas + RLS habilitado:
--    SELECT relname, relrowsecurity
--      FROM pg_class
--     WHERE relname IN ('registro_alumnos', 'registro_config', 'usuarios_admin')
--     ORDER BY relname;
--    → relrowsecurity = true en registro_alumnos y registro_config
--
-- 2. Policies creadas (esperado: 4 filas):
--    SELECT tablename, policyname, cmd, roles::text
--      FROM pg_policies
--     WHERE tablename IN ('registro_alumnos', 'registro_config')
--     ORDER BY tablename, policyname;
--    → registro_alumnos | registro_alumnos_admin_all    | ALL    | {authenticated}
--    → registro_alumnos | registro_alumnos_public_insert| INSERT | {anon}
--    → registro_alumnos | registro_alumnos_self_read    | SELECT | {authenticated}
--    → registro_config  | registro_config_admin_only    | ALL    | {authenticated}
--
-- 3. Columna numero_cuenta en usuarios_admin:
--    SELECT column_name, data_type, is_nullable
--      FROM information_schema.columns
--     WHERE table_name = 'usuarios_admin'
--       AND column_name = 'numero_cuenta';
--    → numero_cuenta | text | YES
--
-- 4. Config default en registro_config:
--    SELECT registro_activo, fecha_inicio, fecha_fin FROM registro_config;
--    → false | 2026-07-01 | 2026-07-15
