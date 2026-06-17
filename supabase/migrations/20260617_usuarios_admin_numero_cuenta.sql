-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar numero_cuenta a usuarios_admin
-- Fecha: 2026-06-17
--
-- Agrega la columna numero_cuenta a usuarios_admin para identificar a
-- los alumnos activados desde registro_alumnos.
-- SAFE — usa IF NOT EXISTS (idempotente).
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios_admin
  ADD COLUMN IF NOT EXISTS numero_cuenta TEXT UNIQUE;

-- ── Verificación post-ejecución ───────────────────────────────────────────────
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'usuarios_admin'
--      AND column_name = 'numero_cuenta';
--   -- Debe retornar una fila: numero_cuenta | text | YES
