-- supabase/migrations/20260621_fix_obras_editor_rls_using_publicado.sql
-- Segunda corrección sobre la política obras_editor_update_own_borrador.
--
-- HISTORIAL DE CAMBIOS EN ESTA POLÍTICA:
--
--   1ª versión  (20260621_flujo_aprobacion_base.sql):
--     USING:      editor_id = auth.uid() AND estado = 'Borrador'
--     WITH CHECK: editor_id = auth.uid() AND estado = 'Borrador'   ← BUG
--     Problema: WITH CHECK con estado = 'Borrador' bloqueaba Borrador → En Revisión.
--
--   2ª versión  (20260621_fix_obras_editor_rls_with_check.sql):
--     USING:      editor_id = auth.uid() AND estado = 'Borrador'
--     WITH CHECK: editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')  ← fix
--     Problema resuelto: el editor puede enviar a revisión.
--     Problema nuevo detectado (este archivo): USING solo acepta 'Borrador' como
--     estado de partida, pero el sprint de portafolio introduce un flujo legítimo
--     donde el editor reabre una obra Publicada (Publicado → Borrador + motivo_reapertura).
--     La cláusula USING rechaza ese UPDATE porque la fila de partida no está en Borrador.
--
--   3ª versión  (este archivo):
--     USING:      editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado')  ← fix
--     WITH CHECK: editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')  (sin cambio)
--
-- PROBLEMA QUE RESUELVE:
--   USING valida la FILA ANTES del UPDATE (el estado de partida).
--   Con estado = 'Borrador' en USING, el editor no puede iniciar un UPDATE sobre
--   una obra que actualmente esté en 'Publicado', aunque el destino sea legítimo
--   (Borrador) y el editor sea el propietario de la obra.
--   El flujo "Volver a borrador" desde Mi Portafolio (portafolio.js →
--   _abrirModalReopeningPublicado) necesita exactamente ese UPDATE:
--     { estado: 'Borrador', motivo_reapertura: <motivo> }
--   sobre una obra propia en estado Publicado.
--
-- QUÉ CAMBIA:
--   Solo la cláusula USING en la rama del editor:
--     ANTES: editor_id = auth.uid() AND estado = 'Borrador'
--     AHORA: editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado')
--
-- QUÉ NO CAMBIA:
--   WITH CHECK permanece idéntico a la 2ª versión:
--     editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')
--   Esto garantiza que el RESULTADO del UPDATE solo pueda ser Borrador o En Revisión
--   para el editor — ningún otro estado final es posible, incluido Publicado.
--
-- GARANTÍAS QUE MANTIENE LA POLÍTICA CORREGIDA:
--   ✅ Editor puede guardar cambios sobre obra propia en Borrador   (Borrador → Borrador)
--   ✅ Editor puede enviar a revisión                               (Borrador → En Revisión)
--   ✅ Editor puede reabrir obra publicada propia                   (Publicado → Borrador)
--   ✗  Editor no puede forzar resultado en Publicado/Archivado     (WITH CHECK falla)
--   ✗  Editor no puede editar obra en En Revisión o Archivado      (USING: estado no incluido)
--   ✗  Editor no puede editar obra ajena                           (USING: editor_id ≠ uid)
--   ✅ Admin / super_editor: sin restricciones                      (rama EXISTS en USING y WITH CHECK)

DROP POLICY IF EXISTS "obras_editor_update_own_borrador" ON obras;

CREATE POLICY "obras_editor_update_own_borrador"
  ON obras
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    -- ¿Tiene permiso para INICIAR este UPDATE? (valida la fila ANTES del cambio)
    -- Admin/super_editor: siempre sí.
    -- Editor: solo si la obra es suya Y actualmente está en Borrador o Publicado.
    --   · Borrador  → edición normal / envío a revisión
    --   · Publicado → reapertura para editar (Publicado → Borrador + motivo_reapertura)
    (
      EXISTS (
        SELECT 1 FROM usuarios_admin
         WHERE id  = auth.uid()
           AND rol IN ('admin', 'super_editor')
      )
    )
    OR (editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado'))
  )
  WITH CHECK (
    -- ¿Es válida la FILA RESULTANTE después del UPDATE? (valida el estado destino)
    -- Admin/super_editor: cualquier resultado es válido.
    -- Editor: la obra sigue siendo suya Y el nuevo estado es Borrador o En Revisión.
    --   (Igual que en la 2ª versión — sin cambio.)
    (
      EXISTS (
        SELECT 1 FROM usuarios_admin
         WHERE id  = auth.uid()
           AND rol IN ('admin', 'super_editor')
      )
    )
    OR (editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión'))
  );
