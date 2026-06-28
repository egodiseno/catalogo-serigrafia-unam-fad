// app/page.jsx — Server Component wrapper del catálogo público
//
// ISR: revalidate = 60 — Next.js regenera el HTML del catálogo cada 60 segundos
// en background (Incremental Static Regeneration). Los visitantes siempre ven
// el HTML cacheado; la re-generación ocurre sin bloquear las requests.
//
// Toda la lógica interactiva (filtros, grid, favoritos, paginación) vive en
// CatalogPageClient — un Client Component que se hidrata en el navegador.

// ── ISR: regenerar el catálogo cada 60 segundos ──────────────────────────────
export const revalidate = 60;

import CatalogPageClient from '@/components/public/CatalogPageClient';

export default function CatalogPage() {
  return <CatalogPageClient />;
}
