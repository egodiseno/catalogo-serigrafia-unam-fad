/**
 * middleware.js — Inyecta x-pathname en cada request.
 *
 * El Admin Layout (Server Component) lee este header para saber si
 * la ruta actual es /admin/login y aplicar la lógica de redirección
 * sin necesidad de usePathname (que es solo client-side).
 *
 * No bloquea ni redirige — eso lo hace el layout con supabase.auth.getUser().
 */
import { NextResponse } from 'next/server';

export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Excluir assets estáticos y rutas internas de Next.js
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/|og-default\\.png).*)'],
};
