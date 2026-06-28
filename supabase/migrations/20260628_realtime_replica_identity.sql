-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 20260628_realtime_replica_identity
-- Habilitar Supabase Realtime para tablas del catálogo público
--
-- Dos pasos requeridos para Realtime:
--   1. REPLICA IDENTITY FULL — permite que eventos DELETE incluyan la fila
--      completa (old.*) y que los filtros funcionen en eventos UPDATE.
--   2. ALTER PUBLICATION supabase_realtime ADD TABLE — añade la tabla a la
--      publicación de Realtime de Supabase (creada automáticamente en el setup).
--
-- Sin paso 1:  DELETE events solo incluyen la PK en payload.old.
-- Sin paso 2:  Supabase Realtime no emite eventos para la tabla.
--
-- Cómo aplicar: Ejecutar en el SQL Editor del proyecto Supabase hospedado.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. REPLICA IDENTITY FULL en las cuatro tablas del catálogo
ALTER TABLE obras      REPLICA IDENTITY FULL;
ALTER TABLE tecnicas   REPLICA IDENTITY FULL;
ALTER TABLE tags       REPLICA IDENTITY FULL;
ALTER TABLE imagenes   REPLICA IDENTITY FULL;

-- 2. Añadir tablas a la publicación supabase_realtime
--    (La publicación ya existe; solo se agregan las tablas si no están en ella)
ALTER PUBLICATION supabase_realtime
  ADD TABLE obras, tecnicas, tags, imagenes;
