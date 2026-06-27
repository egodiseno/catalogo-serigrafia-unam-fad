/**
 * Supabase browser client — singleton
 *
 * Usa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Llamar desde Client Components ("use client") o funciones de lado cliente.
 *
 * El singleton de módulo (_client) garantiza que createBrowserClient()
 * se llame UNA SOLA VEZ por proceso de browser, evitando el warning
 * "Multiple GoTrueClient instances detected".
 */
import { createBrowserClient } from "@supabase/ssr";

let _client = null;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return _client;
}
