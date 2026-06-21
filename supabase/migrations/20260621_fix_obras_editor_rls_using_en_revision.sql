-- supabase/migrations/20260621_fix_obras_editor_rls_using_en_revision.sql
-- Tercera corrección sobre la política obras_editor_update_own_borrador.
--
-- HISTORIAL COMPLETO DE ESTA POLÍTICA:
--
--   1ª versión  (20260621_flujo_aprobacion_base.sql):
--     USING:      editor_id = auth.uid() AND estado = 'Borrador'
--     WITH CHECK: editor_id = auth.uid() AND estado = 'Borrador'
--     Bug: WITH CHECK con estado = 'Borrador' bloqueaba Borrador → En Revisión
--          porque WITH CHECK valida la FILA RESULTANTE, no la de partida.
--
--   2ª versión  (20260621_fix_obras_editor_rls_with_check.sql):
--     USING:      editor_id = auth.uid() AND estado = 'Borrador'
--     WITH CHECK: editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')
--     Bug resuelto: editor puede enviar a revisión.
--     Bug nuevo: USING solo aceptaba 'Borrador' como estado de partida; el flujo
--                de reapertura desde Publicado (portafolio "Volver a borrador")
--                era bloqueado silenciosamente — cero filas afectadas.
--
--   3ª versión  (20260621_fix_obras_editor_rls_using_publicado.sql):
--     USING:      editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado')
--     WITH CHECK: editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')
--     Bug resuelto: editor puede reabrir obra publicada (Publicado → Borrador).
--     Bug nuevo: USING no incluía 'En Revisión' como estado de partida; el flujo
--                "Volver a borrador" desde En Revisión también era bloqueado
--                silenciosamente — Postgres no devuelve error, simplemente afecta
--                cero filas, lo que producía un falso mensaje de éxito en la UI.
--
--   4ª versión  (este archivo):
--     USING:      editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado', 'En Revisión')
--     WITH CHECK: editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')
--     Bug resuelto: editor puede retomar obra en revisión (En Revisión → Borrador).
--
-- PROBLEMA QUE RESUELVE ESTE ARCHIVO:
--   USING valida la FILA ANTES del UPDATE (el estado de partida del editor).
--   Con estado IN ('Borrador', 'Publicado'), el flujo "Volver a borrador" desde
--   portafolio.js (botón .portafolio-reabrir-revision-btn) intentaba hacer:
--     UPDATE obras SET estado = 'Borrador' WHERE id = <obraId>
--   sobre una obra cuyo estado actual era 'En Revisión'.
--   Postgres evaluaba USING → false → no actualizaba ninguna fila → devolvía
--   { data: [], error: null }, sin error explícito, lo que provocaba que la UI
--   mostrara un toast de éxito aunque la obra nunca cambiara de estado.
--
-- QUÉ CAMBIA:
--   Solo la cláusula USING en la rama del editor:
--     ANTES: editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado')
--     AHORA: editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado', 'En Revisión')
--
-- QUÉ NO CAMBIA:
--   WITH CHECK permanece idéntico a la 3ª versión:
--     editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión')
--   El resultado del UPDATE solo puede ser 'Borrador' o 'En Revisión' para el editor.
--   En concreto: el editor no puede forzar estado 'Publicado' ni 'Archivado' como
--   resultado — WITH CHECK lo bloquearía aunque USING lo permitiera como partida.
--
-- ESTADOS DE PARTIDA VÁLIDOS PARA EL EDITOR (USING):
--   · Borrador    → edición normal, envío a revisión
--   · Publicado   → reapertura para editar (requiere motivo_reapertura en payload)
--   · En Revisión → retomar para editar sin motivo (confirmación simple)
--
-- ESTADOS DE DESTINO VÁLIDOS PARA EL EDITOR (WITH CHECK):
--   · Borrador      (resultado de reabrir desde Publicado o retomar desde En Revisión)
--   · En Revisión   (resultado de enviar a revisión desde Borrador)
--
-- GARANTÍAS QUE MANTIENE LA POLÍTICA:
--   ✅ Editor puede guardar cambios sobre obra propia en Borrador   (Borrador → Borrador)
--   ✅ Editor puede enviar a revisión                               (Borrador → En Revisión)
--   ✅ Editor puede retomar obra en revisión propia                 (En Revisión → Borrador)
--   ✅ Editor puede reabrir obra publicada propia                   (Publicado → Borrador)
--   ✗  Editor no puede forzar resultado en Publicado/Archivado     (WITH CHECK falla)
--   ✗  Editor no puede editar obra en Archivado como partida       (USING: no incluido)
--   ✗  Editor no puede editar obra ajena                           (USING: editor_id ≠ uid)
--   ✅ Admin / super_editor: sin restricciones                      (rama EXISTS)

DROP POLICY IF EXISTS "obras_editor_update_own_borrador" ON obras;

CREATE POLICY "obras_editor_update_own_borrador"
  ON obras
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    -- ¿Tiene permiso para INICIAR este UPDATE? (valida la fila ANTES del cambio)
    -- Admin/super_editor: siempre sí.
    -- Editor: solo si la obra es suya Y actualmente está en uno de los tres
    --         estados de partida legítimos para el editor.
    (
      EXISTS (
        SELECT 1 FROM usuarios_admin
         WHERE id  = auth.uid()
           AND rol IN ('admin', 'super_editor')
      )
    )
    OR (editor_id = auth.uid() AND estado IN ('Borrador', 'Publicado', 'En Revisión'))
  )
  WITH CHECK (
    -- ¿Es válida la FILA RESULTANTE después del UPDATE? (valida el estado destino)
    -- Admin/super_editor: cualquier resultado es válido.
    -- Editor: la obra sigue siendo suya Y el nuevo estado es Borrador o En Revisión.
    --   (Sin cambio respecto a la 3ª versión.)
    (
      EXISTS (
        SELECT 1 FROM usuarios_admin
         WHERE id  = auth.uid()
           AND rol IN ('admin', 'super_editor')
      )
    )
    OR (editor_id = auth.uid() AND estado IN ('Borrador', 'En Revisión'))
  );
