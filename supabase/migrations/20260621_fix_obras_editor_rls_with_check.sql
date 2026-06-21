-- supabase/migrations/20260621_fix_obras_editor_rls_with_check.sql
-- Corrige la política obras_editor_update_own_borrador: error de diseño en WITH CHECK.
--
-- PROBLEMA:
--   La migración 20260621_flujo_aprobacion_base.sql creó esta política con:
--
--     WITH CHECK (
--       (EXISTS (...admin/super_editor...))
--       OR (editor_id = auth.uid() AND estado = 'Borrador')   ← BUG
--     )
--
--   La cláusula WITH CHECK valida la FILA RESULTANTE (después del UPDATE).
--   Con estado = 'Borrador' en WITH CHECK, cualquier intento de cambiar el
--   estado de Borrador → En Revisión falla con:
--   "new row violates row-level security policy"
--   aunque es una operación legítima del editor.
--
-- SOLUCIÓN:
--   Mantener USING sin cambios (estado = 'Borrador' es correcto ahí — verifica
--   que la fila ANTES del cambio esté en Borrador).
--   Cambiar WITH CHECK para el branch del editor a:
--     editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')
--   Esto permite Borrador → Borrador y Borrador → En Revisión, pero NO
--   permite que el resultado quede en 'Publicado', 'Archivado' u otro estado.
--
-- GARANTÍAS que mantiene la política corregida:
--   ✅ Editor puede guardar cambios sin cambiar el estado (Borrador → Borrador)
--   ✅ Editor puede enviar a revisión              (Borrador → En Revisión)
--   ✗  Editor no puede forzar Publicado/Archivado  (WITH CHECK falla)
--   ✗  Editor no puede editar obra ajena           (USING: editor_id ≠ auth.uid())
--   ✗  Editor no puede editar obra en En Revisión  (USING: estado ≠ 'Borrador')
--   ✅ Admin / super_editor: sin restricciones      (rama EXISTS en USING y WITH CHECK)

DROP POLICY IF EXISTS "obras_editor_update_own_borrador" ON obras;

CREATE POLICY "obras_editor_update_own_borrador"
  ON obras
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    -- ¿Tiene permiso para INICIAR este UPDATE?
    -- Admin/super_editor: siempre sí.
    -- Editor: solo si la obra es suya Y está actualmente en Borrador.
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
    -- ¿Es válida la FILA RESULTANTE después del UPDATE?
    -- Admin/super_editor: cualquier resultado es válido.
    -- Editor: la obra sigue siendo suya Y el nuevo estado es Borrador o En Revisión.
    (
      EXISTS (
        SELECT 1 FROM usuarios_admin
         WHERE id  = auth.uid()
           AND rol IN ('admin', 'super_editor')
      )
    )
    OR (editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión'))
  );
