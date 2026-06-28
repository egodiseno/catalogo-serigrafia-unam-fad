'use client';
// components/public/CreditosAcerca.jsx
// Renderiza el texto "Acerca del Taller" en el idioma activo.
// Recibe ambas versiones (es + en) del Server Component para no hacer fetch
// cliente adicional. Reacciona al cambio de idioma via useLang().
//
// Selectores CSS: .creditos-acerca, .creditos-acerca h2, .empty-state

import { useLang } from '@/contexts/LangContext';

/**
 * @param {{ acercaEs: string, acercaEn: string }} props
 */
export default function CreditosAcerca({ acercaEs, acercaEn }) {
  const { lang } = useLang();
  const texto = lang === 'en' ? acercaEn : acercaEs;

  const heading = lang === 'en' ? 'About the Workshop' : 'Acerca del Taller';

  if (!texto || !texto.trim()) {
    return (
      <section className="creditos-acerca" aria-labelledby="heading-acerca">
        <h2 id="heading-acerca">{heading}</h2>
        <p className="empty-state">
          {lang === 'en' ? 'No content available.' : 'No hay contenido disponible.'}
        </p>
      </section>
    );
  }

  // Respetar saltos de línea (igual que _renderAcerca en public-creditos.js)
  const paragraphs = texto.split(/\n{2,}/).map((block) =>
    block.replace(/\n/g, '<br />')
  );

  return (
    <section className="creditos-acerca" aria-labelledby="heading-acerca">
      <h2 id="heading-acerca">{heading}</h2>
      <div>
        {paragraphs.map((html, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </div>
    </section>
  );
}
