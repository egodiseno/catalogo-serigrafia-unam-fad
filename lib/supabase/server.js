/**
 * Supabase server client (SSR)
 *
 * Usa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Llamar desde Server Components, Route Handlers y Server Actions.
 * Lee / escribe cookies de Next.js para mantener la sesión del usuario.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorar si se llama desde un Server Component (sin capacidad de setear cookies).
            // El middleware se encargará de refrescar la sesión.
          }
        },
      },
    }
  );
}
