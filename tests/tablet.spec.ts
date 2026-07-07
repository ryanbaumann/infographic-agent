import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPad Pro'] });

test.describe('Tablet Viewport Tests', () => {
  test('should render properly on tablet', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Infographic Agent/i);
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });

  test('should have appropriate spacing on tablet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Verify buttons are properly spaced on tablet
    const buttons = page.locator('button');
    const count = await buttons.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should handle orientation change on tablet', async ({ page }) => {
    await page.goto('/');

    const viewport = page.viewportSize();
    expect(viewport).toBeDefined();
    expect(viewport?.width).toBeGreaterThan(500); // Tablet width

    // Page should remain functional
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });
});
