// app/creditos/page.jsx
// Página Créditos — Server Component
// SSR: carga acerca (es + en) y créditos desde Supabase.
// El texto "Acerca" es bilingüe → delegado a CreditosAcerca (Client Component).
// Los créditos son estáticos → renderizados directamente en el servidor.
//
// Selectores CSS verificados en styles/globals.css:
//   .creditos-section, .creditos-subsection, .creditos-subsection h3,
//   .creditos-personas, .creditos-person, .creditos-person__name,
//   .creditos-person__role, .hero, .hero__eyebrow, .hero__title,
//   .hero__lead, .accent, .breadcrumb, .breadcrumb__sep

import Link from 'next/link';
import { fetchCreditosData } from '@/lib/supabase/queries';
import CreditosAcerca from '@/components/public/CreditosAcerca';

export const metadata = {
  title: 'Créditos | Catálogo de Obra Serigráfica',
  description:
    'Acerca del Catálogo Digital de Obra Serigráfica de la Facultad de Artes y Diseño de la UNAM y las personas que lo hacen posible.',
  openGraph: {
    type:        'website',
    title:       'Créditos — Catálogo UNAM / FAD',
    description: 'Acerca del Catálogo Digital de Obra Serigráfica y las personas que lo hacen posible.',
    images: [{
      url: 'https://catalogo-serigrafia-unam-fad.netlify.app/admin/assets/catalogo-fad.jpg',
    }],
    url: 'https://catalogo-serigrafia-unam-fad.netlify.app/creditos',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Créditos — Catálogo UNAM / FAD',
    description: 'Acerca del Catálogo Digital de Obra Serigráfica y las personas que lo hacen posible.',
    images: ['https://catalogo-serigrafia-unam-fad.netlify.app/admin/assets/catalogo-fad.jpg'],
  },
};

// Orden y etiquetas de las secciones (réplica de SECCION_LABELS / SECCION_ORDER)
const SECCION_LABELS = {
  unam:      'UNAM',
  fad:       'FACULTAD DE ARTES Y DISEÑO',
  taller:    'TALLER DE SERIGRAFÍA',
  webmaster: 'DESARROLLO WEB',
};
const SECCION_ORDER = ['unam', 'fad', 'taller', 'webmaster'];

export default async function CreditosPage() {
  const { acercaEs, acercaEn, creditos } = await fetchCreditosData();

  // Agrupar créditos por sección
  const grouped = {};
  creditos.forEach((p) => {
    const key = p.seccion || 'otro';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  // Ordenar secciones: conocidas primero, resto al final
  const seccionKeys = [
    ...SECCION_ORDER.filter((k) => grouped[k]),
    ...Object.keys(grouped).filter((k) => !SECCION_ORDER.includes(k)),
  ];

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <nav className="breadcrumb" aria-label="Ubicación en el sitio">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb__sep" aria-hidden="true">›</span>
            <span aria-current="page">Créditos</span>
          </nav>

          <p className="hero__eyebrow">UNAM · FAD · Taller de Serigrafía</p>

          <h1 className="hero__title">
            <span>Acerca &amp;</span>{' '}
            <span className="accent">Créditos</span>
          </h1>

          <p className="hero__lead">
            Información sobre el Taller de Serigrafía y las personas que hacen
            posible este catálogo.
          </p>
        </div>
      </section>

      {/* ── Contenido principal ──────────────────────────────────────── */}
      <main id="contenido">
        <div className="container">

          {/*
           * Sección Acerca — Client Component (bilingüe, reacciona a useLang)
           * Recibe ambas versiones para no hacer fetch adicional en cliente.
           */}
          <CreditosAcerca acercaEs={acercaEs} acercaEn={acercaEn} />

          {/* ── Sección Créditos (estática, SSR) ─────────────────────── */}
          <section className="creditos-section" aria-labelledby="heading-creditos">
            <h2 id="heading-creditos">Créditos</h2>

            {creditos.length === 0 ? (
              <p className="empty-state">No hay créditos disponibles.</p>
            ) : (
              seccionKeys.map((key) => {
                const label   = SECCION_LABELS[key] || key.toUpperCase();
                const personas = grouped[key];
                return (
                  <div key={key} className="creditos-subsection">
                    <h3>{label}</h3>
                    <div className="creditos-personas">
                      {personas.map((p) => (
                        <div key={p.id} className="creditos-person">
                          {p.nombre && (
                            <p className="creditos-person__name">{p.nombre}</p>
                          )}
                          {p.cargo && (
                            <p className="creditos-person__role">{p.cargo}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>

        </div>
      </main>
    </>
  );
}
