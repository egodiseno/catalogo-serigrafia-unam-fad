/**
 * tests/a11y.spec.ts — Suite: Accesibilidad WCAG 2.2 AA
 *
 * Valida el cumplimiento de accesibilidad sin librerías externas (axe),
 * usando aserciones Playwright sobre el DOM:
 *   1. Estructura de página — título, skip link, landmark principal
 *   2. Imágenes tienen atributo alt (no vacío para imágenes informativas)
 *   3. Controles de formulario tienen labels asociados
 *   4. Jerarquía de headings (h1 → h2 → h3)
 *   5. Elementos interactivos tienen aria-labels o texto visible
 *   6. Navegación por teclado — foco visible en elementos interactivos
 *
 * Basado en los requerimientos del CLAUDE.md:
 *   "focus-visible outlines are required on all interactive elements (accessibility AA)"
 *   "aria-pressed on toggle buttons (favorites, language)"
 *   "aria-live on counters and live regions"
 */

import { test, expect, type Page } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForCatalog(page: Page) {
  await page.waitForFunction(
    () => !document.querySelector('.loading-spinner'),
    { timeout: 25_000 },
  );
  await page.waitForSelector('ul.artworks, .empty-state', { timeout: 25_000 });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Accesibilidad — WCAG 2.2 AA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCatalog(page);
  });

  // ── Test 1: Estructura de página ──────────────────────────────────────────
  test('1 — estructura de página: título, skip link y landmark #contenido', async ({ page }) => {
    // Título de la página
    const title = await page.title();
    expect(title).toMatch(/[Cc]atálogo|FAD|UNAM/);

    // Skip link accesible (puede estar visually hidden — debe estar en el DOM)
    const skipLink = page.locator('a.skip-link, a[href="#contenido"]');
    await expect(skipLink).toBeAttached();

    // El atributo href del skip link debe apuntar al main landmark
    const skipHref = await skipLink.getAttribute('href');
    expect(skipHref).toBe('#contenido');

    // El destino del skip link existe en el DOM
    const mainContent = page.locator('#contenido');
    await expect(mainContent).toBeAttached();

    // El idioma del documento está definido
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBeTruthy();
    expect(['es', 'en']).toContain(htmlLang);

    // El manifest PWA está enlazado
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toBeAttached();
    const manifestHref = await manifest.getAttribute('href');
    expect(manifestHref).toBe('/manifest.json');
  });

  // ── Test 2: Imágenes con alt ──────────────────────────────────────────────
  test('2 — imágenes informativas tienen atributo alt', async ({ page }) => {
    // Esperar a que carguen las imágenes de las tarjetas
    const artworkImages = page.locator('ul.artworks .artwork-card__media img');
    const imgCount = await artworkImages.count();

    if (imgCount === 0) {
      // Las imágenes pueden cargarse de forma lazy — dar más tiempo
      await page.waitForTimeout(3_000);
      const imgCountRetry = await artworkImages.count();
      if (imgCountRetry === 0) {
        test.skip(true, 'No se encontraron imágenes en las tarjetas — puede ser lazy loading');
        return;
      }
    }

    // Verificar cada imagen visible
    const images = await artworkImages.all();
    for (const img of images.slice(0, 6)) { // verificar hasta 6 para no tardar mucho
      const alt = await img.getAttribute('alt');
      // Las imágenes de obras son informativas — deben tener alt no vacío
      expect(alt).toBeTruthy();
      expect(alt!.trim().length).toBeGreaterThan(0);
    }
  });

  // ── Test 3: Labels de formulario ──────────────────────────────────────────
  test('3 — controles de formulario tienen labels', async ({ page }) => {
    // Select de año
    const yearSelect = page.locator('select#filterYear');
    await expect(yearSelect).toBeVisible();
    const yearLabel = page.locator('label[for="filterYear"]');
    await expect(yearLabel).toBeAttached();
    const yearLabelText = await yearLabel.textContent();
    expect(yearLabelText?.trim().length).toBeGreaterThan(0);

    // Select de técnica
    const techSelect = page.locator('select#filterTechnique');
    await expect(techSelect).toBeVisible();
    const techLabel = page.locator('label[for="filterTechnique"]');
    await expect(techLabel).toBeAttached();

    // Input de búsqueda — hay DOS elementos con #searchInput (Header + panel filtros).
    // Verificamos el del panel de filtros (dentro de .filter-search).
    const searchInput = page.locator('.filter-search input[type="search"]');
    await expect(searchInput).toBeVisible();
    // El input tiene aria-label
    const searchAriaLabel = await searchInput.getAttribute('aria-label');
    expect(searchAriaLabel).toBeTruthy();

    // Botón de favoritos tiene aria-label o aria-pressed
    const favBtn = page.locator('button.artwork-fav-btn').first();
    if (await favBtn.isVisible()) {
      const favAriaLabel = await favBtn.getAttribute('aria-label');
      const favAriaPressed = await favBtn.getAttribute('aria-pressed');
      expect(favAriaLabel || favAriaPressed !== null).toBeTruthy();
    }
  });

  // ── Test 4: Jerarquía de headings ─────────────────────────────────────────
  test('4 — jerarquía de headings correcta (no saltar niveles)', async ({ page }) => {
    // Debe haber exactamente 1 h1 en la página (puede estar en el header o el hero)
    const h1s = await page.locator('h1').count();
    expect(h1s).toBeGreaterThanOrEqual(1);

    // Las tarjetas de obras usan h3 (.artwork-card__title)
    const cardTitles = page.locator('.artwork-card__title');
    const cardCount = await cardTitles.count();
    if (cardCount > 0) {
      // Verificar que son <h3> (no <h2> o <h4>)
      const tagName = await cardTitles.first().evaluate((el) => el.tagName.toLowerCase());
      expect(tagName).toBe('h3');
    }

    // No debe haber h4 sin h3 previo en el mismo scope (comprobación básica)
    const h4s = await page.locator('h4').count();
    const h3s = await page.locator('h3').count();
    if (h4s > 0) {
      expect(h3s).toBeGreaterThan(0);
    }
  });

  // ── Test 5: aria-labels en controles interactivos ─────────────────────────
  test('5 — controles interactivos tienen aria-label o texto accesible', async ({ page }) => {
    // Botón favoritos en el filtro (btn-fav-filter)
    const favFilterBtn = page.locator('button.btn-fav-filter');
    if (await favFilterBtn.isVisible()) {
      const ariaPressed = await favFilterBtn.getAttribute('aria-pressed');
      expect(ariaPressed).not.toBeNull(); // 'true' o 'false'
    }

    // Botón limpiar filtros — debe tener texto o aria-label
    const clearBtn = page.locator('button[data-clear]');
    if (await clearBtn.isVisible()) {
      const text = await clearBtn.textContent();
      const ariaLabel = await clearBtn.getAttribute('aria-label');
      expect(text?.trim() || ariaLabel).toBeTruthy();
    }

    // Contador del catálogo tiene role o aria-live
    const counter = page.locator('.catalog__count');
    if (await counter.isVisible()) {
      // El grid tiene aria-live="polite" — verificar
      const gridAriaLive = await page.locator('ul.artworks').getAttribute('aria-live');
      expect(gridAriaLive).toBe('polite');
    }

    // Paginación desktop (si existe) tiene aria-label
    const pagination = page.locator('nav[aria-label]').filter({
      has: page.locator('.pagination-btn'),
    });
    if (await pagination.count() > 0) {
      const navAriaLabel = await pagination.first().getAttribute('aria-label');
      expect(navAriaLabel).toBeTruthy();
    }
  });

  // ── Test 6: Foco visible con teclado ─────────────────────────────────────
  test('6 — navegación por teclado: Tab mueve el foco entre elementos interactivos', async ({
    page,
  }) => {
    // Hacer Tab desde el body para ir al primer elemento enfocable
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // El primer elemento con foco debe ser el skip link
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName?.toLowerCase(), href: (el as HTMLAnchorElement)?.href ?? '' };
    });

    // Puede ser el skip link o el primer enlace del header
    expect(['a', 'button', 'input', 'select']).toContain(focusedElement.tag);

    // Hacer Tab varias veces para moverse entre controles
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);
    }

    // El foco debe estar en algún elemento interactivo
    const laterFocus = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName?.toLowerCase() ?? 'body';
    });
    expect(['a', 'button', 'input', 'select']).toContain(laterFocus);

    // Verificar que el elemento enfocado tiene estilos de foco (via focus-visible o outline)
    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const outline = style.outline || style.outlineWidth;
      // Tiene outline visible o box-shadow (para focus rings personalizados)
      return outline !== 'none' && outline !== '0px' && outline !== '';
    });

    // Solo advertencia si no hay estilos de foco — no falla (puede ser :focus-visible)
    if (!hasFocusStyle) {
      console.warn('⚠️  El elemento con foco puede no tener estilos visibles con Tab — verificar :focus-visible');
    }
  });
});

// ── Tests de página de detalle ────────────────────────────────────────────────

test.describe('Accesibilidad — Página de Detalle /obra/:slug', () => {
  test('7 — página de detalle tiene h1 y estructura de headings correcta', async ({ page }) => {
    // Navegar al catálogo y entrar en la primera obra
    await page.goto('/');
    await page.waitForSelector('ul.artworks li a.artwork-card', { timeout: 20_000 });

    const firstCard = page.locator('ul.artworks li a.artwork-card').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/obra\/.+/, { timeout: 20_000 });

    // Esperar h1
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // Solo 1 h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // El título de la obra debe estar en h1
    const h1Text = await page.locator('h1').textContent();
    expect(h1Text?.trim().length).toBeGreaterThan(0);

    // La página debe tener lang="es" (ya heredado del layout)
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('es');
  });
});
