-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN COMPLETA E IDEMPOTENTE: Registro de Alumnos + RLS
-- Fecha: 2026-06-17  (sustituye / complementa 20260617_registro_alumnos.sql)
--
-- SEGURO DE RE-EJECUTAR: usa IF NOT EXISTS y DROP IF EXISTS.
-- Ejecutar en Supabase SQL Editor como superuser (rol postgres).
-- ══════════════════════════════════════════════════════════════════════════


-- ── 1. TABLA registro_alumnos ─────────────────────────────────────────────────
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

-- ── 2. ÍNDICES registro_alumnos ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_registro_alumnos_email
  ON registro_alumnos (email);

CREATE INDEX IF NOT EXISTS idx_registro_alumnos_numero_cuenta
  ON registro_alumnos (numero_cuenta);

CREATE INDEX IF NOT EXISTS idx_registro_alumnos_estado
  ON registro_alumnos (estado);


-- ── 3. TABLA registro_config ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registro_config (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_activo       BOOLEAN     NOT NULL DEFAULT false,
  fecha_inicio          DATE,
  fecha_fin             DATE,
  mensaje_personalizado TEXT,
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. FILA DEFAULT en registro_config ───────────────────────────────────────
-- Solo inserta si la tabla está vacía (idempotente)
INSERT INTO registro_config (
  registro_activo,
  fecha_inicio,
  fecha_fin,
  mensaje_personalizado
)
SELECT
  false,
  '2026-07-01'::date,
  '2026-07-15'::date,
  'El registro está abierto del 1 al 15 de julio'
WHERE NOT EXISTS (SELECT 1 FROM registro_config);


-- ── 5. HABILITAR RLS ──────────────────────────────────────────────────────────
ALTER TABLE registro_alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_config  ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════════
-- 6. POLÍTICAS RLS — registro_config
--    Solo admin / super_editor pueden leer y modificar la configuración.
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- 7. POLÍTICAS RLS — registro_alumnos
-- ══════════════════════════════════════════════════════════════════════════

-- ── 7-A. Admins y super_editors leen y modifican TODOS los registros ──────────
--         (las Edge Functions usan service_role y omiten RLS automáticamente)
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

-- ── 7-B. Anon puede INSERT (formulario público registro.html) ─────────────────
--         La Edge Function save-registro-alumno usa service_role, pero la
--         política también protege acceso directo desde el cliente.
DROP POLICY IF EXISTS "registro_alumnos_public_insert" ON registro_alumnos;
CREATE POLICY "registro_alumnos_public_insert"
  ON registro_alumnos
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ── 7-C. Alumno autenticado puede ver su propio registro ──────────────────────
DROP POLICY IF EXISTS "registro_alumnos_self_read" ON registro_alumnos;
CREATE POLICY "registro_alumnos_self_read"
  ON registro_alumnos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════
-- 8. VERIFICACIÓN POST-EJECUCIÓN
--    Ejecuta este bloque por separado para confirmar el resultado:
--
--   SELECT tablename, policyname, cmd, roles::text
--     FROM pg_policies
--    WHERE tablename IN ('registro_alumnos', 'registro_config')
--    ORDER BY tablename, policyname;
--
--   -- Resultado esperado:
--   -- registro_alumnos | registro_alumnos_admin_all    | ALL    | {authenticated}
--   -- registro_alumnos | registro_alumnos_public_insert| INSERT | {anon}
--   -- registro_alumnos | registro_alumnos_self_read    | SELECT | {authenticated}
--   -- registro_config  | registro_config_admin_only    | ALL    | {authenticated}
--
--   -- Verificar RLS habilitado:
--   SELECT relname, relrowsecurity
--     FROM pg_class
--    WHERE relname IN ('registro_alumnos', 'registro_config');
--   -- relrowsecurity debe ser true en ambas.
--
--   -- Test anon INSERT (debe funcionar):
--   INSERT INTO registro_alumnos (email, nombre, numero_cuenta)
--   VALUES ('test@test.com', 'Test User', '123456789');
--   -- Luego limpiar:
--   DELETE FROM registro_alumnos WHERE email = 'test@test.com';
-- ══════════════════════════════════════════════════════════════════════════
