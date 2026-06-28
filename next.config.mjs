/** @type {import('next').NextConfig} */
const nextConfig = {
  // swcMinify está habilitado por defecto en Next.js 14+ (no requiere configuración explícita).
  // La opción fue deprecada en Next.js 15. No se incluye para evitar el warning de deprecación.

  async headers() {
    return [
      {
        // El SW debe revalidarse en cada carga para detectar actualizaciones.
        // Cache-Control: no-cache + ETag permiten 304 Not Modified si no cambió.
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          // Permite que el SW controle rutas desde la raíz aunque resida en /
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        // manifest.json: cache moderado (1 hora), revalidación ante cambios
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
