// app/not-found.jsx
// Réplica exacta de 404.html
// Next.js muestra este componente cuando se llama notFound() o la ruta no existe.
// El layout raíz (Header + Footer) se aplica automáticamente.

import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';

export const metadata = {
  title: '404 — Página no encontrada · Catálogo de Obra Serigráfica',
  description: 'Página no encontrada — Catálogo Digital de Obra Serigráfica — UNAM / FAD',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main id="contenido">
      <div className="error-page">
        <div className="error-page__inner">
          <p className="error-page__code" aria-hidden="true">404</p>

          <h1 className="error-page__title">Página no encontrada</h1>

          <p className="error-page__lead">
            La dirección que buscas no existe o fue movida.<br />
            Puedes volver al catálogo o explorar las técnicas del taller.
          </p>

          <div className="error-page__actions">
            <Link href="/" className="btn-primary">
              <ArrowLeft width={16} height={16} aria-hidden />
              Volver al catálogo
            </Link>
            <Link href="/tecnicas" className="btn-secondary">
              <Layers width={16} height={16} aria-hidden />
              Ver técnicas
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
