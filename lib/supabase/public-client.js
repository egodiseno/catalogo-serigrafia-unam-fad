/**
 * lib/supabase/public-client.js — Cliente Supabase singleton para el catálogo público
 *
 * Distinto del cliente admin (lib/supabase/client.js que usa @supabase/ssr).
 * Usa @supabase/supabase-js directamente; no gestiona sesión de usuario.
 *
 * Compartido entre:
 *   - hooks/useRealtimeWorks.js
 *   - hooks/useRealtimeTecnicas.js
 *
 * El singleton garantiza UNA SOLA conexión WebSocket para todos los canales
 * Realtime que se suscriban desde el catálogo público.
 *
 * Retorna null en entornos sin window (SSR) — los hooks lo manejan en useEffect.
 */

import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getPublicClient() {
  if (typeof window === 'undefined') return null; // SSR safety
  if (_client) return _client;

  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://kfvjansfmhamkrnbxmgp.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdmphbnNmbWhhbWtybmJ4bWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzU3MzgsImV4cCI6MjA5NTQxMTczOH0.yesPqr7JhxniQxMa_fVPvwhBg2o98J2UB67G7u7fFsE',
    {
      realtime: {
        // Configuración de reconexión automática
        reconnectAfterMs: (tries) => Math.min(tries * 1000, 10000),
      },
    }
  );

  return _client;
}
