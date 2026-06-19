-- ─────────────────────────────────────────────────────────────────────────
-- Migration: fix_obras_estado_constraint
-- Fecha:     2026-06-19
-- Motivo:    El CHECK constraint `obras_estado_values` no incluía 'En Revisión',
--            lo que causaba error code 23514 al guardar obras como editor
--            (el rol editor envía estado = 'En Revisión' por defecto).
-- ─────────────────────────────────────────────────────────────────────────

-- Paso 1: Verificar constraint actual antes de modificar (solo lectura)
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'obras_estado_values';

-- Paso 2: Eliminar constraint antigua
ALTER TABLE obras DROP CONSTRAINT IF EXISTS obras_estado_values;

-- Paso 3: Recrear con los cuatro valores válidos
ALTER TABLE obras
  ADD CONSTRAINT obras_estado_values
  CHECK (estado IN ('Borrador', 'Publicado', 'En Revisión', 'Archivado'));
