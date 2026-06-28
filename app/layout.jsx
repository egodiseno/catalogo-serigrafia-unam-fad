// app/layout.jsx — Layout raíz definitivo
// Server Component: no usa estado ni hooks del cliente

import '../styles/globals.css';
import { LangProvider }      from '@/contexts/LangContext';
import Header                from '@/components/public/Header';
import Footer                from '@/components/public/Footer';
import OfflineIndicator      from '@/components/OfflineIndicator';

// themeColor va en viewport export separado (Next.js 14 — evita warning de metadata)
export const viewport = {
  themeColor: '#013B75',
};

export const metadata = {
  title: 'Catálogo de Obra Serigráfica | FAD-UNAM',
  description:
    'Catálogo digital de obra serigráfica de la Facultad de Artes y Diseño, UNAM. Explora la colección del Taller de Serigrafía.',
  // ── PWA ──────────────────────────────────────────────────────────────────
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Catálogo Serigrafía',
  },
  // ── Social ───────────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    siteName: 'Catálogo de Obra Serigráfica — UNAM / FAD',
    title: 'Catálogo de Obra Serigráfica — UNAM / FAD',
    description:
      'Explora la colección del Taller de Serigrafía de la Facultad de Artes y Diseño de la UNAM.',
    images: [{ url: 'https://catalogo-serigrafia-unam-fad.netlify.app/admin/assets/catalogo-fad.jpg' }],
    url: 'https://catalogo-serigrafia-unam-fad.netlify.app/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Catálogo de Obra Serigráfica — UNAM / FAD',
    description:
      'Explora la colección del Taller de Serigrafía de la Facultad de Artes y Diseño de la UNAM.',
    images: ['https://catalogo-serigrafia-unam-fad.netlify.app/admin/assets/catalogo-fad.jpg'],
  },
  icons: {
    icon: [
      { url: '/logos/cropped-icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logos/cropped-icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/logos/cropped-icon-180x180.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* Google Fonts — igual que index.html original */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Bootstrap Icons — para iconos en el footer */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
        {/* PWA — meta tags adicionales no cubiertos por la API metadata de Next.js */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {/* Skip link de accesibilidad */}
        <a href="#contenido" className="skip-link">
          Saltar al contenido principal
        </a>

        {/* LangProvider es Client Component que envuelve todo */}
        <LangProvider>
          <Header />
          {/* Indicador offline (Client Component — también registra el SW) */}
          <OfflineIndicator />
          {children}
          <Footer />
        </LangProvider>
      </body>
    </html>
  );
}
