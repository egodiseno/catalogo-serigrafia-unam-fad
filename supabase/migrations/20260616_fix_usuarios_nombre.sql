-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Arreglar columna nombre en usuarios_admin
-- Fecha: 2026-06-16
--
-- PROBLEMA:
--   La Edge Function create-admin-user no insertaba el campo `nombre`.
--   El schema tenía DEFAULT '-' (o la columna no existía), dejando
--   todos los registros con nombre = '-'.
--
-- FIXES:
--   1. Agregar columna `nombre` si no existe (TEXT, nullable)
--   2. Limpiar valores placeholder '-' dejándolos en NULL
-- ══════════════════════════════════════════════════════════════════

-- 1. Asegurar que la columna existe (nullable, sin DEFAULT '-')
ALTER TABLE usuarios_admin
  ADD COLUMN IF NOT EXISTS nombre TEXT;

-- 2. Limpiar placeholder '-' en registros existentes
--    Los admins podrán actualizar el nombre real desde el panel.
UPDATE usuarios_admin
  SET nombre = NULL
  WHERE nombre = '-'
     OR nombre = ''
     OR nombre IS NOT DISTINCT FROM '-';

-- ──────────────────────────────────────────────────────────────────
-- DESPUÉS DE EJECUTAR ESTA MIGRACIÓN:
--   1. Despliega la Edge Function create-admin-user actualizada
--      (ya incluye nombre en el INSERT)
--   2. Para usuarios con nombre NULL: usar el modal "Editar"
--      en el admin panel para asignar el nombre correcto.
-- ──────────────────────────────────────────────────────────────────
