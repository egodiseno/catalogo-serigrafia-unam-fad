/**
 * playwright.config.ts — Configuración E2E con Playwright
 *
 * Catálogo de Obra Serigráfica — FAD / UNAM
 *
 * Suites:
 *   tests/public-catalog.spec.ts          — Catálogo público (7 tests)
 *   tests/admin-catalog-integration.spec.ts — Admin + Catálogo (4 tests, requieren env vars)
 *   tests/responsive.spec.ts              — Viewports desktop / tablet / móvil (3 tests)
 *   tests/a11y.spec.ts                    — Accesibilidad WCAG 2.2 AA (6 tests)
 *
 * El servidor Next.js se levanta automáticamente en localhost:3001 con `next start -p 3001`.
 * Requiere que el build esté al día (`npm run build`).
 * Con CI=true, el servidor no se reutiliza (siempre se levanta desde cero).
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Tiempo máximo por test (ms)
  timeout: 30_000,

  // 1 reintento en CI; 0 en local
  retries: process.env.CI ? 1 : 0,

  // 2 workers paralelos (suficiente para chromium + evitar hammering a Supabase)
  workers: 2,

  // Reportes: lista en consola + HTML para revisión posterior
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  // Configuración compartida por todos los tests
  use: {
    baseURL: 'http://localhost:3001',

    // Capturar evidencia solo en fallo
    // video deshabilitado: requiere ffmpeg (incluido en `npx playwright install chromium`)
    // Habilitar en CI tras `npx playwright install chromium --with-deps`
    screenshot: 'only-on-failure',
    video: 'off',

    // Esperar a que la red esté quieta antes de pasar acciones
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      // Usar Microsoft Edge del sistema (Windows 11, ruta estándar).
      // Evita descargar Chromium (~140 MB) — Edge es Chromium-based y 100% compatible.
      // Para CI (GitHub Actions / Ubuntu), usar `channel: 'chromium'` y ejecutar
      // `npx playwright install chromium --with-deps` como paso previo en el workflow.
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        executablePath:
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      },
    },
  ],

  // Levanta el servidor Next.js antes de ejecutar los tests.
  // `reuseExistingServer: true` en local evita reiniciar si ya está corriendo.
  webServer: {
    command: 'npm run start:3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
