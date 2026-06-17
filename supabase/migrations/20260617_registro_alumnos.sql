-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Tablas de Registro de Alumnos
-- Fecha: 2026-06-17
--
-- TABLAS:
--   1. registro_alumnos  — solicitudes de acceso de alumnos
--   2. registro_config   — configuración del periodo de registro
-- ══════════════════════════════════════════════════════════════════


-- ── 1. TABLA registro_alumnos ────────────────────────────────────
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

-- ── 2. ÍNDICES registro_alumnos ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_registro_alumnos_email
  ON registro_alumnos (email);

CREATE INDEX IF NOT EXISTS idx_registro_alumnos_numero_cuenta
  ON registro_alumnos (numero_cuenta);

CREATE INDEX IF NOT EXISTS idx_registro_alumnos_estado
  ON registro_alumnos (estado);


-- ── 3. TABLA registro_config ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS registro_config (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_activo        BOOLEAN NOT NULL DEFAULT false,
  fecha_inicio           DATE,
  fecha_fin              DATE,
  mensaje_personalizado  TEXT,
  actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. REGISTRO DEFAULT ──────────────────────────────────────────
-- Solo insertar si la tabla está vacía (idempotente)
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


-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────────
-- Habilitar RLS en ambas tablas
ALTER TABLE registro_alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_config  ENABLE ROW LEVEL SECURITY;

-- registro_config: solo admins pueden leer/escribir
CREATE POLICY "registro_config_admin_only"
  ON registro_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_admin
      WHERE id = auth.uid()
        AND rol IN ('admin', 'super_editor')
    )
  );

-- registro_alumnos: admins ven todo
CREATE POLICY "registro_alumnos_admin_read"
  ON registro_alumnos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_admin
      WHERE id = auth.uid()
    )
  );

-- registro_alumnos: anon puede INSERT (formulario público de registro)
CREATE POLICY "registro_alumnos_public_insert"
  ON registro_alumnos
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- registro_alumnos: alumno puede leer su propio registro (si tiene user_id)
CREATE POLICY "registro_alumnos_self_read"
  ON registro_alumnos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────────
-- VALIDACIÓN POST-EJECUCIÓN:
--
--   -- Verificar tablas creadas:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('registro_alumnos', 'registro_config');
--
--   -- Verificar registro default:
--   SELECT * FROM registro_config;
--
--   -- Verificar índices:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'registro_alumnos';
--
--   -- Verificar constraints:
--   SELECT conname, contype FROM pg_constraint
--   WHERE conrelid = 'registro_alumnos'::regclass;
--
--   -- Test CHECK numero_cuenta (debe fallar):
--   INSERT INTO registro_alumnos (email, nombre, numero_cuenta)
--   VALUES ('x@test.com', 'Test', '12345');
--   -- → ERROR: violates check constraint "registro_alumnos_numero_cuenta_formato"
--
--   -- Test CHECK estado (debe fallar):
--   INSERT INTO registro_alumnos (email, nombre, numero_cuenta, estado)
--   VALUES ('x@test.com', 'Test', '123456789', 'otro_estado');
--   -- → ERROR: violates check constraint "registro_alumnos_estado_values"
-- ──────────────────────────────────────────────────────────────────
