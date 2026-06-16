-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Arreglar CHECK constraints en usuarios_admin
-- Fecha: 2026-06-16
--
-- PROBLEMA:
--   El frontend usa los roles: 'admin', 'super_editor', 'editor'
--   Pero el CHECK constraint original decía: ('admin', 'editor', 'viewer')
--   RESULTADO: INSERT/UPDATE con rol = 'super_editor' fallaba con
--   violación de constraint — el usuario no se guardaba.
-- ══════════════════════════════════════════════════════════════════


-- ── 1. Eliminar constraint viejo (intentar nombres comunes) ──────
ALTER TABLE usuarios_admin
  DROP CONSTRAINT IF EXISTS usuarios_admin_rol_values;

ALTER TABLE usuarios_admin
  DROP CONSTRAINT IF EXISTS usuarios_admin_rol_check;

ALTER TABLE usuarios_admin
  DROP CONSTRAINT IF EXISTS check_rol;


-- ── 2. Agregar constraint correcto con los tres roles del sistema ─
ALTER TABLE usuarios_admin
  ADD CONSTRAINT usuarios_admin_rol_values
  CHECK (rol IN ('admin', 'super_editor', 'editor'));


-- ── 3. Normalizar rol 'viewer' heredado → 'editor' ───────────────
--   Por si existe algún registro anterior con rol='viewer'
UPDATE usuarios_admin
  SET rol = 'editor'
  WHERE rol = 'viewer';


-- ──────────────────────────────────────────────────────────────────
-- VALIDACIÓN POST-EJECUCIÓN (ejecutar por separado para confirmar):
--
--   Query 1 — Roles presentes en la tabla:
--     SELECT DISTINCT rol FROM usuarios_admin ORDER BY rol;
--     → Esperado: admin | editor | super_editor
--
--   Query 2 — Probar inserción directa con super_editor:
--     INSERT INTO usuarios_admin (id, email, rol, estado)
--     VALUES (gen_random_uuid(), 'constraint-test@test.com', 'super_editor', true)
--     ON CONFLICT DO NOTHING;
--     → Debe ejecutarse SIN error de constraint
--     → Borrar después: DELETE FROM usuarios_admin WHERE email = 'constraint-test@test.com';
-- ──────────────────────────────────────────────────────────────────
