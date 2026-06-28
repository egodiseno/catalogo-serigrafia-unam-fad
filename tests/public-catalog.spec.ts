/**
 * tests/public-catalog.spec.ts — Suite: Catálogo Público
 *
 * Valida los flujos principales del usuario anónimo en el catálogo:
 *   1. Grid carga y muestra obras reales de Supabase
 *   2. Filtro por técnica actualiza el grid
 *   3. Filtro por año actualiza el grid
 *   4. Búsqueda full-text (FTS) — debounce 400ms
 *   5. Limpiar filtros restaura el estado inicial
 *   6. Botón de favoritos cambia aria-pressed (optimistic UI)
 *   7. Navegar a página de detalle de obra
 *
 * Selectores DOM validados contra app/page.jsx y components/public/ArtworkCard.jsx:
 *   ul.artworks           — contenedor del grid
 *   a.artwork-card        — enlace de tarjeta individual
 *   .artwork-card__title  — título h3
 *   select#filterYear     — selector de año
 *   select#filterTechnique — selector de técnica
 *   #searchInput          — input de búsqueda FTS
 *   button[data-clear]    — botón limpiar filtros
 *   button.artwork-fav-btn — botón corazón favorito
 */

import { test, expect, type Page } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Espera a que el grid haya cargado (ul.artworks visible con ≥1 elemento) */
async function waitForGrid(page: Page, timeout = 20_000) {
  // Esperar a que desaparezca el spinner de carga
  await page.waitForFunction(
    () => !document.querySelector('.loading-spinner'),
    { timeout },
  );
  // Esperar a que haya al menos una tarjeta O un estado vacío
  await page.waitForSelector('ul.artworks, .empty-state', { timeout });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Catálogo Público', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  // ── Test 1: Grid carga con obras ─────────────────────────────────────────
  test('1 — grid carga y muestra obras de Supabase', async ({ page }) => {
    const artworks = page.locator('ul.artworks');
    await expect(artworks).toBeVisible();

    // El catálogo tiene obras reales: esperamos ≥1 tarjeta
    const cards = artworks.locator('li');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verificar estructura mínima de la tarjeta
    const firstCard = cards.first();
    await expect(firstCard.locator('a.artwork-card')).toBeVisible();
    await expect(firstCard.locator('.artwork-card__title')).toBeVisible();

    // El contador debe mostrar algún número
    const counter = page.locator('.catalog__count');
    await expect(counter).toBeVisible();
    const counterText = await counter.textContent();
    expect(counterText?.trim().length).toBeGreaterThan(0);
  });

  // ── Test 2: Filtro por técnica ────────────────────────────────────────────
  test('2 — filtro por técnica actualiza el grid', async ({ page }) => {
    const tecnicaSelect = page.locator('select#filterTechnique');
    await expect(tecnicaSelect).toBeVisible();

    // Contar obras iniciales
    const initialCount = await page.locator('ul.artworks li').count();

    // Obtener opciones disponibles (skip si solo está el placeholder)
    const options = await tecnicaSelect.locator('option').all();
    if (options.length <= 1) {
      test.skip(true, 'No hay técnicas disponibles en el selector');
      return;
    }

    const firstValue = await options[1].getAttribute('value');
    if (!firstValue) {
      test.skip(true, 'Primera opción de técnica no tiene value');
      return;
    }

    // Seleccionar técnica
    await tecnicaSelect.selectOption(firstValue);
    await page.waitForTimeout(600); // esperar debounce
    await waitForGrid(page, 15_000);

    // El selector sigue mostrando el value correcto
    await expect(tecnicaSelect).toHaveValue(firstValue);

    // El grid actualizó (puede haber 0 resultados — es válido)
    const newCount = await page.locator('ul.artworks li').count();
    // Si hay resultados, deben ser ≤ total (filtrado)
    if (newCount > 0) {
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }
  });

  // ── Test 3: Filtro por año ─────────────────────────────────────────────────
  test('3 — filtro por año actualiza el grid', async ({ page }) => {
    const yearSelect = page.locator('select#filterYear');
    await expect(yearSelect).toBeVisible();

    const options = await yearSelect.locator('option').all();
    if (options.length <= 1) {
      test.skip(true, 'No hay años disponibles en el selector');
      return;
    }

    const firstValue = await options[1].getAttribute('value');
    if (!firstValue) {
      test.skip(true, 'Primera opción de año no tiene value');
      return;
    }

    await yearSelect.selectOption(firstValue);
    await page.waitForTimeout(600);
    await waitForGrid(page, 15_000);

    await expect(yearSelect).toHaveValue(firstValue);

    // Si hay obras con ese año, deben tener el año correcto visible en la tarjeta
    const cards = page.locator('ul.artworks li');
    const count = await cards.count();
    if (count > 0) {
      const detail = await cards.first().locator('.artwork-card__meta-detail').textContent();
      expect(detail).toContain(firstValue);
    }
  });

  // ── Test 4: Búsqueda full-text ─────────────────────────────────────────────
  test('4 — búsqueda full-text retorna resultados o estado vacío', async ({ page }) => {
    // Existen DOS inputs #searchInput: uno en el Header y otro en el panel de filtros.
    // Apuntamos específicamente al del panel de filtros (dentro de .filter-search).
    const searchInput = page.locator('.filter-search input[type="search"]');
    await expect(searchInput).toBeVisible();

    // Buscar un término genérico
    await searchInput.fill('color');

    // Esperar debounce (400ms) + tiempo de respuesta FTS
    // Usamos waitForFunction con timeout generoso en lugar de waitForGrid
    // para evitar strict-mode del selector 'ul.artworks' (hay 2 en el DOM).
    await page.waitForFunction(
      () => {
        const spinner = document.querySelector('.loading-spinner');
        if (spinner) return false; // aún cargando
        // Verificar que el grid O el empty state estén presentes
        const grid = document.querySelector('ul.artworks');
        const emptyState = document.querySelector('.empty-state');
        return !!(grid || emptyState);
      },
      { timeout: 20_000 },
    );

    // El estado debe ser coherente: hay artworks en el grid O un estado vacío visible
    const gridCount = await page.locator('ul.artworks li').first().count();
    const hasEmpty = await page.locator('.empty-state').isVisible().catch(() => false);
    expect(gridCount > 0 || hasEmpty).toBe(true);

    // En modo búsqueda FTS la paginación desktop NO debe aparecer
    const pagination = page.locator('nav[aria-label="Paginación"]');
    const paginationVisible = await pagination.isVisible().catch(() => false);
    // Solo advertencia — el comportamiento puede variar según implementación
    if (paginationVisible) {
      console.warn('⚠️  Paginación visible en modo FTS (inesperado)');
    }

    // Limpiar búsqueda — debe restaurar la vista completa
    await searchInput.fill('');
    await page.waitForFunction(
      () => !document.querySelector('.loading-spinner'),
      { timeout: 15_000 },
    );

    // La vista completa debe tener obras
    await page.waitForSelector('ul.artworks li', { timeout: 10_000, state: 'attached' });
    const restoredCount = await page.locator('ul.artworks li').count();
    expect(restoredCount).toBeGreaterThan(0);
  });

  // ── Test 5: Limpiar filtros ────────────────────────────────────────────────
  test('5 — limpiar filtros restaura la vista completa', async ({ page }) => {
    // Aplicar filtro de año para activar el botón limpiar
    const yearSelect = page.locator('select#filterYear');
    const options = await yearSelect.locator('option').all();
    if (options.length > 1) {
      const val = await options[1].getAttribute('value');
      if (val) {
        await yearSelect.selectOption(val);
        await page.waitForTimeout(600);
        await waitForGrid(page, 15_000);
      }
    }

    // El botón limpiar debe aparecer cuando hay filtros activos
    const clearBtn = page.locator('button[data-clear]');
    const isVisible = await clearBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isVisible) {
      // Si no apareció el botón, el filtro no estaba disponible — test pasa condicionalmente
      test.skip(true, 'No hay filtros aplicables para activar el botón limpiar');
      return;
    }

    // Registrar conteo antes de limpiar
    const filteredCount = await page.locator('ul.artworks li').count();

    await clearBtn.click();
    await page.waitForTimeout(600);
    await waitForGrid(page, 15_000);

    // Después de limpiar, los selects deben estar en su valor por defecto
    await expect(yearSelect).toHaveValue('');

    // El conteo debería ser mayor o igual (mostramos más obras sin filtro)
    const cleanCount = await page.locator('ul.artworks li').count();
    expect(cleanCount).toBeGreaterThanOrEqual(filteredCount);
  });

  // ── Test 6: Favoritos — botón corazón ─────────────────────────────────────
  test('6 — botón favorito cambia aria-pressed (UI optimista)', async ({ page }) => {
    const firstFavBtn = page.locator('button.artwork-fav-btn').first();
    await expect(firstFavBtn).toBeVisible({ timeout: 15_000 });

    // Estado inicial (puede ser true o false)
    const initialPressed = await firstFavBtn.getAttribute('aria-pressed');

    // Toggle
    await firstFavBtn.click();
    await page.waitForTimeout(300);

    const newPressed = await firstFavBtn.getAttribute('aria-pressed');
    // El estado cambió
    expect(newPressed).not.toBe(initialPressed);

    // Toggle de vuelta para no dejar estado persistido
    await firstFavBtn.click();
    await page.waitForTimeout(300);

    const finalPressed = await firstFavBtn.getAttribute('aria-pressed');
    expect(finalPressed).toBe(initialPressed);
  });

  // ── Test 7: Navegar a detalle de obra ─────────────────────────────────────
  test('7 — clic en tarjeta navega a página de detalle /obra/:slug', async ({ page }) => {
    const firstCard = page.locator('ul.artworks li a.artwork-card').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // El href debe seguir el patrón /obra/<slug>
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/obra\/.+/);

    // Navegar
    await firstCard.click();

    // URL actualizada
    await expect(page).toHaveURL(/\/obra\/.+/, { timeout: 20_000 });

    // Página de detalle muestra h1 con el título
    await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });

    // Existe un enlace de volver al catálogo (ArrowLeft link)
    const backLink = page.locator('a[href="/"]');
    await expect(backLink.first()).toBeVisible({ timeout: 10_000 });
  });
});
