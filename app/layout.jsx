// app/layout.jsx — Layout raíz definitivo
// Server Component: no usa estado ni hooks del cliente

import { Inter, Lora } from 'next/font/google';
import '../styles/globals.css';
import { LangProvider }      from '@/contexts/LangContext';
import Header                from '@/components/public/Header';
import Footer                from '@/components/public/Footer';
import OfflineIndicator      from '@/components/OfflineIndicator';

// ── Fuentes optimizadas con next/font ────────────────────────────────────────
// next/font elimina las peticiones externas a Google Fonts:
//   1. Descarga las fuentes en tiempo de build
//   2. Las sirve desde el mismo dominio (sin roundtrip a fonts.googleapis.com)
//   3. Añade font-display:swap automáticamente
//   4. Inyecta CSS variables disponibles en globals.css via var(--font-inter) / var(--font-lora)

const inter = Inter({
  subsets:  ['latin'],
  display:  'swap',
  variable: '--font-inter',
  weight:   ['400', '500', '600', '700'],
});

const lora = Lora({
  subsets:  ['latin'],
  display:  'swap',
  variable: '--font-lora',
  weight:   ['500', '600', '700'],
});

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
    // Las clases CSS de next/font inyectan las variables --font-inter y --font-lora
    // en el elemento html, disponibles globalmente para globals.css
    <html lang="es" className={`${inter.variable} ${lora.variable}`}>
      <head>
        {/* Bootstrap Icons — para iconos en el footer (no cubierto por next/font) */}
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
