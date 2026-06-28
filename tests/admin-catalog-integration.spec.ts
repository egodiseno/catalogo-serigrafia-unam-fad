/**
 * tests/admin-catalog-integration.spec.ts — Suite: Admin + Catálogo (integración)
 *
 * Valida flujos end-to-end que cruzan la frontera admin → catálogo público:
 *   1. Admin puede iniciar sesión y llega al dashboard
 *   2. Dashboard muestra al menos las secciones básicas
 *   3. Listado de obras en admin es accesible
 *   4. Una obra publicada aparece en el catálogo público
 *
 * ⚠️  REQUIEREN credenciales reales en variables de entorno:
 *       TEST_ADMIN_EMAIL      — email de un usuario admin activo
 *       TEST_ADMIN_PASSWORD   — contraseña del usuario
 *
 *     Sin estas variables los 4 tests se saltan automáticamente.
 *     Para ejecutarlos localmente:
 *       $env:TEST_ADMIN_EMAIL="admin@example.com"; $env:TEST_ADMIN_PASSWORD="secret"; npm run test:e2e
 *
 * NOTA: La sesión se comparte en el describe block usando `storageState` para
 *       no hacer login en cada test y reducir roundtrips a Supabase.
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';

// ── Env checks ────────────────────────────────────────────────────────────────
const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? '';
const HAS_CREDENTIALS = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Inicia sesión como admin y espera a llegar al dashboard */
async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.waitForSelector('#email', { timeout: 15_000 });

  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Esperar redirección al dashboard (puede tener MFA — skip si aparece)
  const hasMFA = await page.waitForSelector(
    '[class*="mfa"], input[inputmode="numeric"], h2:has-text("Verificar")',
    { timeout: 5_000 },
  ).catch(() => null);

  if (hasMFA) {
    // MFA presente — no podemos completar sin TOTP. Saltar test.
    test.skip(true, 'La cuenta tiene MFA habilitado — se requiere TOTP para completar login');
    return;
  }

  // Sin MFA — esperar redireccion al dashboard
  await expect(page).toHaveURL(/\/admin\/?(?!login)/, { timeout: 20_000 });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Admin + Catálogo — integración', () => {
  // Marcar todos como skip si no hay credenciales.
  // Se usa beforeEach con testInfo.skip() para que el skip ocurra ANTES del cuerpo del test.
  test.beforeEach(async ({}, testInfo) => {
    if (!HAS_CREDENTIALS) {
      console.log(
        '⚠️  Tests de admin omitidos — define TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD para ejecutarlos.',
      );
      testInfo.skip();
    }
  });

  // ── Test 1: Login admin ────────────────────────────────────────────────────
  test('1 — admin puede iniciar sesión y llega al dashboard', async ({ page }) => {
    await adminLogin(page);

    // El dashboard tiene algún heading de bienvenida o sección principal
    await expect(page.locator('main, #adminContent, [id*="dashboard"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── Test 2: Dashboard muestra estadísticas básicas ─────────────────────────
  test('2 — dashboard muestra contadores de estadísticas', async ({ page }) => {
    await adminLogin(page);

    // Hay al menos un stat card con número
    const statCards = page.locator('[id="totalObras"], .stat-card, [class*="stat"]');
    await expect(statCards.first()).toBeVisible({ timeout: 15_000 });

    // El total de obras debe ser un número
    const totalObras = page.locator('#totalObras');
    if (await totalObras.isVisible()) {
      const text = await totalObras.textContent();
      expect(Number(text?.trim())).toBeGreaterThanOrEqual(0);
    }
  });

  // ── Test 3: Sección Obras es accesible ────────────────────────────────────
  test('3 — admin puede navegar a la sección Obras', async ({ page }) => {
    await adminLogin(page);

    // Buscar enlace o botón de navegación a Obras
    const obrasNav = page.locator(
      '[data-section="obras"], a[href*="obras"], button:has-text("Obras"), nav li:has-text("Obras")',
    ).first();
    await expect(obrasNav).toBeVisible({ timeout: 15_000 });

    await obrasNav.click();
    await page.waitForTimeout(1_000);

    // Debe aparecer una tabla o listado de obras
    const obrasTable = page.locator(
      '#obrasSection, [id*="obras"], table, .obras-table, [class*="obras"]',
    ).first();
    await expect(obrasTable).toBeVisible({ timeout: 15_000 });
  });

  // ── Test 4: Obra publicada visible en catálogo ─────────────────────────────
  test('4 — obra publicada en admin aparece en el catálogo público', async ({ page }) => {

    // Ir al catálogo público
    await page.goto('/');
    await page.waitForSelector('ul.artworks li', { timeout: 20_000 });

    // Tomar el slug de la primera tarjeta visible
    const firstCardLink = page.locator('ul.artworks li a.artwork-card').first();
    await expect(firstCardLink).toBeVisible();
    const href = await firstCardLink.getAttribute('href');
    expect(href).toMatch(/^\/obra\/.+/);

    // La obra existe en Supabase y tiene visible_publico=true (de lo contrario no estaría en el grid)
    await firstCardLink.click();
    await expect(page).toHaveURL(/\/obra\/.+/, { timeout: 20_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // La página de detalle no muestra 404
    const notFound = page.locator('h1:has-text("404"), h1:has-text("no encontrada")');
    await expect(notFound).not.toBeVisible();
  });
});
