// app/obra/[slug]/page.jsx
// Página de detalle de obra — Server Component con ISR y OG tags dinámicos
//
// ISR: revalidate = 3600 (1 hora) — el HTML se regenera en background.
// dynamicParams = true — slugs no generados en build se renderizan on-demand y se cachean.
//
// Flujo SSR/ISR:
//   1. generateMetadata  → consulta Supabase (fetchWorkBySlug cacheada con React cache())
//                          → retorna title / description / openGraph / twitter
//   2. ObraPage          → llama fetchWorkBySlug(slug) nuevamente — devuelve el resultado
//                          en caché, sin segunda petición a Supabase
//   3. Renderiza el HTML estático (breadcrumb, metadatos, descripción)
//   4. Delega partes interactivas a Client Components:
//        WorkGallery   — carrusel + lightbox + fav
//        WorkShare     — copiar / WhatsApp / Email / SMS
//        RelatedWorks  — obras relacionadas (carga propia en cliente)
//        VisitRecorder — fire-and-forget INSERT en obra_visitas

// ── ISR: regenerar páginas de detalle cada hora ───────────────────────────────
export const revalidate = 3600;

// ── Slugs desconocidos: renderizar on-demand y cachear ───────────────────────
export const dynamicParams = true;

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { fetchWorkBySlug } from '@/lib/supabase/queries';
import WorkGallery    from '@/components/public/WorkGallery';
import WorkShare      from '@/components/public/WorkShare';
import RelatedWorks   from '@/components/public/RelatedWorks';
import VisitRecorder  from '@/components/public/VisitRecorder';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://catalogo-serigrafia-unam-fad.netlify.app';

// ── generateMetadata ─────────────────────────────────────────────────────────
// Usa fetchWorkBySlug (React cache) → mismo resultado que ObraPage, sin petición extra.
export async function generateMetadata({ params }) {
  const obra = await fetchWorkBySlug(params.slug);

  if (!obra) {
    return { title: 'Obra no encontrada | Catálogo FAD-UNAM' };
  }

  const tecnica = Array.isArray(obra.tecnica) ? obra.tecnica[0] : obra.tecnica;

  // "ARTISTA — AÑO — Técnica" (partes presentes)
  const description = [obra.artista, obra.año, tecnica?.nombre]
    .filter(Boolean)
    .join(' — ');

  // Imagen principal para OG
  const mainImg =
    obra.imagenes?.find((i) => i.principal) || obra.imagenes?.[0] || null;
  const imageUrl = mainImg?.url_storage || null;

  const canonicalUrl = `${SITE_URL}/obra/${obra.slug}`;

  return {
    title: `${obra.titulo} | Catálogo de Obra Serigráfica`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type:        'article',
      title:       obra.titulo,
      description,
      url:         canonicalUrl,
      siteName:    'Catálogo de Obra Serigráfica — UNAM / FAD',
      images:      imageUrl
        ? [{ url: imageUrl, alt: obra.titulo }]
        : [],
    },
    twitter: {
      card:        'summary_large_image',
      title:       obra.titulo,
      description,
      images:      imageUrl ? [imageUrl] : [],
    },
  };
}

// ── Página ───────────────────────────────────────────────────────────────────
export default async function ObraPage({ params }) {
  const obra = await fetchWorkBySlug(params.slug);
  if (!obra) notFound();

  // Ordenar imágenes: principal primero, luego por orden ASC
  const sortedImages = [...(obra.imagenes || [])].sort((a, b) => {
    if (a.principal && !b.principal) return -1;
    if (!a.principal && b.principal) return 1;
    return (a.orden ?? 99) - (b.orden ?? 99);
  });

  // Desempaquetar relaciones (Supabase devuelve .tecnica como objeto o array[0])
  const tecnica = Array.isArray(obra.tecnica) ? obra.tecnica[0] : obra.tecnica;
  const tags    = (obra.tags || []).map((t) => t?.tag).filter(Boolean);
  const tagIds  = tags.map((tag) => tag.id).filter(Boolean);

  return (
    <main id="contenido" className="work-page">
      <div className="container">

        {/* ── Miga de pan ─────────────────────────────────────────────────── */}
        <nav className="work-breadcrumb" aria-label="Miga de pan">
          <Link
            href="/"
            className="work-back-btn"
            aria-label="Volver al catálogo"
          >
            <ArrowLeft size={16} aria-hidden />
            <span>Catálogo</span>
          </Link>
          <span className="work-breadcrumb__sep" aria-hidden="true">›</span>
          <span className="work-breadcrumb__current" aria-current="page">
            {obra.titulo}
          </span>
        </nav>

        {/* ── Grid principal (work-detail: hero izq + meta der en desktop) ── */}
        <article className="work-detail">

          {/*
           * Galería — Client Component
           * Maneja: carrusel, miniaturas, contador, lightbox, swipe, teclado, fav
           */}
          <WorkGallery
            images={sortedImages}
            title={obra.titulo}
            workId={obra.id}
          />

          {/* ── Metadatos (SSR estático) ─────────────────────────────────── */}
          <section className="work-meta">
            <h1 className="work-meta__title">{obra.titulo}</h1>

            <dl className="work-meta__dl">

              {/* Artista */}
              <div className="work-meta__row">
                <dt>Artista</dt>
                <dd>{obra.artista}</dd>
              </div>

              {/* Año */}
              {obra.año && (
                <div className="work-meta__row">
                  <dt>Año</dt>
                  <dd>{obra.año}</dd>
                </div>
              )}

              {/* Técnica */}
              {tecnica?.nombre && (
                <div className="work-meta__row">
                  <dt>Técnica</dt>
                  <dd>{tecnica.nombre}</dd>
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="work-meta__row">
                  <dt>Temas</dt>
                  <dd>
                    <ul className="work-meta__tags">
                      {tags.map((tag) => (
                        <li key={tag.id}>
                          <Link
                            href={`/?topic=${tag.slug}`}
                            className="tag-small"
                          >
                            {tag.nombre}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}

            </dl>

            {/* Descripción (condicional) */}
            {obra.descripcion && (
              <div className="work-meta__description">
                <h2 className="work-meta__desc-heading">Descripción</h2>
                <p>{obra.descripcion}</p>
              </div>
            )}

            {/*
             * Compartir — Client Component
             * Lee window.location.href en el cliente (no disponible en SSR)
             */}
            <WorkShare
              titulo={obra.titulo}
              artista={obra.artista}
              descripcion={obra.descripcion}
            />

          </section>
        </article>

        {/*
         * Obras relacionadas — Client Component
         * Carga sus propios datos desde el cliente (misma técnica, shuffle → 4 obras)
         */}
        <RelatedWorks
          currentWorkId={obra.id}
          tecnicaId={tecnica?.id || null}
          tagIds={tagIds}
        />

        {/*
         * Registro de visita — Client Component
         * Fire-and-forget INSERT en obra_visitas (igual que en public-detail.js)
         */}
        <VisitRecorder workId={obra.id} />

      </div>
    </main>
  );
}
