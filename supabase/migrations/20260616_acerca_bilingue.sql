-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Soporte bilingüe ES/EN para texto Acerca
-- Fecha: 2026-06-16
--
-- CAMBIOS:
--   1. Renombra columna  contenido → contenido_es
--   2. Agrega columna    contenido_en  (texto vacío por defecto)
-- ══════════════════════════════════════════════════════════════════

-- 1. Renombrar la columna existente
ALTER TABLE configuracion_acerca
  RENAME COLUMN contenido TO contenido_es;

-- 2. Agregar columna para versión en inglés
ALTER TABLE configuracion_acerca
  ADD COLUMN IF NOT EXISTS contenido_en TEXT NOT NULL DEFAULT '';
