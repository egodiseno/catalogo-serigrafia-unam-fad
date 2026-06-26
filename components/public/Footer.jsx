'use client';
// components/public/Footer.jsx
// Footer público — réplica exacta del <footer> de index.html
// Carga redes sociales dinámicamente desde Supabase (igual que public-footer.js)

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getRedesSociales } from '@/lib/supabase/api';
import { useLang } from '@/contexts/LangContext';

export default function Footer() {
  const { lang } = useLang();
  const [redes, setRedes] = useState([]);
  const rrssColRef = useRef(null);

  useEffect(() => {
    getRedesSociales()
      .then(setRedes)
      .catch(() => setRedes([]));
  }, []);

  // Ocultar columna si no hay redes
  const showRrss = redes.length > 0;

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">

          {/* Col 1: Brand */}
          <div className="footer-brand">
            <span className="footer-logos">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/UNAM.svg" alt="UNAM" className="logo-footer" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/FAD.svg"  alt="FAD"  className="logo-footer" />
            </span>
            <p className="footer-logo-title">
              {lang === 'en' ? 'FAD — Printmaking Workshop' : 'FAD — Taller de Serigrafía'}
            </p>
            <p className="footer-logo-desc">
              {lang === 'en'
                ? 'Academic and cultural digital catalog of printmaking works.'
                : 'Catálogo digital académico y cultural de obra serigráfica.'}
            </p>
          </div>

          {/* Col 2: Navegación */}
          <div className="footer-col">
            <h3>{lang === 'en' ? 'Navigation' : 'Navegación'}</h3>
            <ul>
              <li><Link href="/">{lang === 'en' ? 'Catalog' : 'Catálogo'}</Link></li>
              <li><Link href="/tecnicas">{lang === 'en' ? 'Techniques' : 'Técnicas'}</Link></li>
            </ul>
          </div>

          {/* Col 3: Institucional */}
          <div className="footer-col">
            <h3>{lang === 'en' ? 'Institutional' : 'Institucional'}</h3>
            <ul>
              <li>
                <a href="https://www.unam.mx" target="_blank" rel="noopener noreferrer">
                  UNAM.mx
                </a>
              </li>
              <li>
                <Link href="#">
                  {lang === 'en' ? 'Privacy notice' : 'Aviso de privacidad'}
                </Link>
              </li>
              <li>
                <Link href="/creditos">{lang === 'en' ? 'Credits' : 'Créditos'}</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Redes sociales */}
          {showRrss && (
            <div className="footer-col footer-rrss" ref={rrssColRef}>
              <h3>{lang === 'en' ? 'Follow us' : 'Síguenos'}</h3>
              <div
                className="rrss-grid"
                id="redesSocialesFooter"
                aria-label={lang === 'en' ? 'Social networks' : 'Redes sociales'}
              >
                {redes.map((red) => {
                  const bg    = red.color || '#013b75';
                  const icono = red.icono ? red.icono.toLowerCase().trim() : 'globe';
                  const nombre = red.nombre || icono;
                  return (
                    <a
                      key={red.url || icono}
                      className="rrss-icon-footer"
                      href={red.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ backgroundColor: bg }}
                      title={`${lang === 'en' ? 'Follow us on' : 'Síguenos en'} ${nombre}`}
                      aria-label={`${lang === 'en' ? 'Go to' : 'Ir a'} ${nombre}`}
                    >
                      <i className={`bi bi-${icono}`} aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        <div className="footer-bottom">
          <p>
            &copy; {new Date().getFullYear()} UNAM · Facultad de Artes y Diseño — Taller de Serigrafía
          </p>
        </div>
      </div>
    </footer>
  );
}
