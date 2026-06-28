'use client';

/**
 * hooks/useRealtimeTecnicas.js — Suscripción Realtime a la tabla tecnicas
 *
 * Mantiene el dropdown de técnicas en el catálogo público sincronizado
 * cuando el admin agrega o elimina técnicas, sin recargar la página.
 *
 * Prerequisitos en Supabase:
 *   - REPLICA IDENTITY FULL en tecnicas (migración 20260628_realtime_replica_identity.sql)
 *   - Tabla en supabase_realtime publication (misma migración)
 *
 * Comparte el cliente Supabase con useRealtimeWorks (singleton en
 * lib/supabase/public-client.js) → una sola conexión WebSocket.
 *
 * @param {() => void} onRefresh  Callback que dispara un refetch de las técnicas
 */

import { useEffect, useRef } from 'react';
import { getPublicClient } from '@/lib/supabase/public-client';

export function useRealtimeTecnicas(onRefresh) {
  const refreshRef = useRef(onRefresh);

  // Sincronizar ref cuando el callback cambia
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const supabase = getPublicClient();
    if (!supabase) return; // SSR: no subscribir

    const channel = supabase
      .channel('catalog-tecnicas-realtime', {
        config: { broadcast: { self: false } },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tecnicas' },
        (payload) => {
          // INSERT, UPDATE o DELETE en tecnicas → refetch del listado
          console.debug('[catalog/realtime] Cambio en tecnicas:', payload.eventType);
          refreshRef.current?.();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[catalog/realtime] Conectado — tecnicas');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // runs once — callback via ref
}
