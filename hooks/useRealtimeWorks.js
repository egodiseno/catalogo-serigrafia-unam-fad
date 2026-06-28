'use client';

/**
 * hooks/useRealtimeWorks.js — Suscripción Realtime a obras e imagenes
 *
 * Mantiene el catálogo público sincronizado con la base de datos sin
 * recargar la página. Se detectan tres tipos de cambio:
 *
 *   INSERT obras donde visible_publico = true  → onRefresh()
 *   UPDATE obras visible (visible_publico true/false) → onRefresh() / onDelete(id)
 *   DELETE obras que eran visibles              → onDelete(id)
 *   INSERT / UPDATE / DELETE en imagenes        → onRefresh() (debounced 500 ms)
 *
 * Prerequisitos en Supabase:
 *   - REPLICA IDENTITY FULL en obras e imagenes (migración 20260628_realtime_replica_identity.sql)
 *   - Tablas en supabase_realtime publication (misma migración)
 *   - Realtime habilitado en Dashboard → Database → Replication
 *
 * @param {() => void}   onRefresh  Callback que dispara un refetch del grid
 * @param {(id: string) => void} onDelete Callback que elimina una obra por ID
 * @returns {{ isConnected: boolean }}
 */

import { useEffect, useRef, useState } from 'react';
import { getPublicClient } from '@/lib/supabase/public-client';

export function useRealtimeWorks(onRefresh, onDelete) {
  const [isConnected, setIsConnected]   = useState(false);
  const refreshRef  = useRef(onRefresh);
  const deleteRef   = useRef(onDelete);
  const debounceRef = useRef(null);       // para el debounce de imagenes

  // Sincronizar refs cuando los callbacks cambian (evita re-suscripción)
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { deleteRef.current  = onDelete;  }, [onDelete]);

  useEffect(() => {
    const supabase = getPublicClient();
    if (!supabase) return; // SSR: no subscribir

    // ── Función auxiliar debounced para imagenes ──────────────────────────
    // Evita refetches en ráfaga cuando el admin sube múltiples imágenes
    const debouncedRefresh = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        refreshRef.current?.();
      }, 500);
    };

    // ── Canal único para obras + imagenes ─────────────────────────────────
    const channel = supabase
      .channel('catalog-works-realtime', {
        config: { broadcast: { self: false } },
      })

      // ── obras: INSERT ───────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'obras' },
        (payload) => {
          if (payload.new?.visible_publico) {
            // Nueva obra publicada → refetch para incluirla según filtros activos
            refreshRef.current?.();
          }
        }
      )

      // ── obras: UPDATE ───────────────────────────────────────────────────
      // Cubre: nueva publicación, cambio de datos, archivo/despublicación
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'obras' },
        (payload) => {
          const wasVisible = payload.old?.visible_publico; // disponible con REPLICA IDENTITY FULL
          const isVisible  = payload.new?.visible_publico;

          if (isVisible) {
            // Obra visible (fue publicada o se actualizaron sus datos) → refetch
            refreshRef.current?.();
          } else if (wasVisible) {
            // Obra dejó de ser visible (archivada / despublicada) → eliminar del grid
            deleteRef.current?.(payload.new?.id);
          }
          // Si !isVisible && !wasVisible → obra en borrador/revisión → ignorar
        }
      )

      // ── obras: DELETE ───────────────────────────────────────────────────
      // payload.old disponible porque REPLICA IDENTITY FULL
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'obras' },
        (payload) => {
          if (payload.old?.visible_publico) {
            // Era visible → eliminar del catálogo inmediatamente
            deleteRef.current?.(payload.old?.id);
          }
        }
      )

      // ── imagenes: cualquier cambio ──────────────────────────────────────
      // Actualiza thumbnails y galerías; debounced para ráfagas de upload
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'imagenes' },
        () => {
          debouncedRefresh();
        }
      )

      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.debug('[catalog/realtime] Conectado — obras + imagenes');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          if (err) console.warn('[catalog/realtime] Error:', err);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, []); // runs once — callbacks via refs

  return { isConnected };
}
