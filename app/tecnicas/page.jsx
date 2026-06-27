// app/tecnicas/page.jsx
// Página Técnicas — Server Component
// SSR: obtiene técnicas + conteo de obras publicadas por técnica en paralelo.
// La parte interactiva (selección de técnica, carga de obras) va en TechniquesClient.
//
// Selectores HTML verificados contra tecnicas.html:
//   .hero, .hero__eyebrow, .hero__title, .accent, .hero__lead,
//   .catalog, .breadcrumb, .breadcrumb__sep

import Link from 'next/link';
import { fetchTecnicasData } from '@/lib/supabase/queries';
import TechniquesClient from '@/components/public/TechniquesClient';

export const metadata = {
  title: 'Técnicas | Catálogo de Obra Serigráfica',
  description:
    'Conoce las técnicas del Taller de Serigrafía de la FAD-UNAM: serigrafía manual y digital, litografía, xilografía, aguafuerte y más.',
  openGraph: {
    type:        'website',
    title:       'Técnicas Serigráficas — Catálogo UNAM / FAD',
    description: 'Explora las obras del Taller de Serigrafía organizadas por técnica.',
    images: [{
      url: 'https://catalogo-serigrafia-unam-fad.netlify.app/admin/assets/catalogo-fad.jpg',
    }],
    url: 'https://catalogo-serigrafia-unam-fad.netlify.app/tecnicas',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Técnicas Serigráficas — Catálogo UNAM / FAD',
    description: 'Explora las obras del Taller de Serigrafía organizadas por técnica.',
    images: ['https://catalogo-serigrafia-unam-fad.netlify.app/admin/assets/catalogo-fad.jpg'],
  },
};

export default async function TecnicasPage() {
  // Obtener técnicas + conteos en paralelo (SSR)
  const { tecnicas, countMap } = await fetchTecnicasData();

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <nav className="breadcrumb" aria-label="Ubicación en el sitio">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb__sep" aria-hidden="true">›</span>
            <span aria-current="page">Técnicas</span>
          </nav>

          <p className="hero__eyebrow">UNAM · FAD · Taller de Serigrafía</p>

          <h1 className="hero__title">
            <span>Técnicas</span>{' '}
            <span className="accent">Serigráficas</span>
          </h1>

          <p className="hero__lead">
            Explora las obras del Taller de Serigrafía organizadas por técnica.
          </p>
        </div>
      </section>

      {/* ── Contenido principal ──────────────────────────────────────── */}
      <main id="contenido" className="catalog">
        <div className="container">
          {/*
           * TechniquesClient recibe los datos ya obtenidos en SSR.
           * Gestiona: selección, obras bajo demanda, cargar más, favoritos.
           */}
          <TechniquesClient tecnicas={tecnicas} countMap={countMap} />
        </div>
      </main>
    </>
  );
}
