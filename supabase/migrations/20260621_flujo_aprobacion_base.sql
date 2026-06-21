-- supabase/migrations/20260621_flujo_aprobacion_base.sql
-- Schema base para flujo de aprobación de obras
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ DIAGNÓSTICO PREVIO — ejecutar en el SQL Editor ANTES de esta migración: │
-- │                                                                          │
-- │   SELECT tablename, policyname, permissive, cmd, qual                   │
-- │     FROM pg_policies                                                     │
-- │    WHERE tablename IN ('obras', 'imagenes')                              │
-- │    ORDER BY tablename, policyname;                                       │
-- │                                                                          │
-- │ Reportar las políticas encontradas para verificar que no haya           │
-- │ conflictos con la nueva política RESTRICTIVE.                            │
-- └──────────────────────────────────────────────────────────────────────────┘

-- ─── obras: columnas para flujo de aprobación ─────────────────────────────────
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS visible_publico    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_reapertura  TEXT,
  ADD COLUMN IF NOT EXISTS motivo_rechazo     TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_publicado JSONB,
  ADD COLUMN IF NOT EXISTS editor_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── imagenes: marcado de borrado lógico para archivos publicados ─────────────
ALTER TABLE imagenes
  ADD COLUMN IF NOT EXISTS pendiente_borrado BOOLEAN DEFAULT false;

-- ─── Habilitar RLS (idempotente si ya está activo) ───────────────────────────
ALTER TABLE obras    ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagenes ENABLE ROW LEVEL SECURITY;

-- ─── Política RESTRICTIVE: editor solo puede UPDATE sus obras en Borrador ─────
--
-- AS RESTRICTIVE significa que esta política se aplica ADEMÁS de cualquier
-- política PERMISSIVE existente. Para que un UPDATE proceda, el row debe
-- pasar TANTO las políticas permissive como esta restrictiva.
--
-- Regla:
--   (a) admin / super_editor → siempre puede hacer UPDATE, O
--   (b) editor que creó la obra (editor_id = auth.uid()) → solo si estado = 'Borrador'
--
-- DROP IF EXISTS garantiza idempotencia si la migración se reejecutara.
DROP POLICY IF EXISTS "obras_editor_update_own_borrador" ON obras;

CREATE POLICY "obras_editor_update_own_borrador"
  ON obras
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM usuarios_admin
         WHERE id  = auth.uid()
           AND rol IN ('admin', 'super_editor')
      )
    )
    OR (editor_id = auth.uid() AND estado = 'Borrador')
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM usuarios_admin
         WHERE id  = auth.uid()
           AND rol IN ('admin', 'super_editor')
      )
    )
    OR (editor_id = auth.uid() AND estado = 'Borrador')
  );
