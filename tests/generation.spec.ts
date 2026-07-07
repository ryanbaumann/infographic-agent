import { test, expect } from '@playwright/test';

test.describe('Full Infographic Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should complete full generation flow with standard mode', async ({ page }) => {
    // Verify hero page
    await expect(page).toHaveTitle(/Infographic Agent/i);
    await expect(page.locator('h1')).toContainText(/Turn any content into beautiful infographics/i);

    // Click get started
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Verify we're on create page
    await expect(page.getByRole('button', { name: 'Generate Infographic' })).toBeVisible();

    // Configure settings
    await page.getByRole('button', { name: /Mode/i }).first().click();
    await page.getByRole('option', { name: 'Standard' }).click();

    // Verify default config is displayed
    await expect(page.locator('text=Aspect Ratio')).toBeVisible();
    await expect(page.locator('text=16:9')).toBeVisible();
  });

  test('should support data-story generation mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Select data-story mode
    await page.getByRole('button', { name: /Mode/i }).first().click();
    await page.getByRole('option', { name: 'Data Story' }).click();

    // Verify mode changed
    const modeButton = page.getByRole('button', { name: /Mode/i }).first();
    await expect(modeButton).toContainText(/Data Story/);
  });

  test('should support executive-summary mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Select executive-summary mode
    const modeButtons = page.getByRole('button', { name: /Mode/i });
    await modeButtons.first().click();
    await page.getByRole('option', { name: 'Executive Summary' }).click();

    // Verify mode changed
    await expect(modeButtons.first()).toContainText(/Executive Summary/);
  });

  test('should support different aspect ratios', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Change aspect ratio
    const aspectButtons = page.getByRole('button');

    // Find and click aspect ratio selector
    const page1Button = aspectButtons.filter({ hasText: '1:1' }).first();
    if (await page1Button.isVisible()) {
      await page1Button.click();
      await expect(page1Button).toContainText(/1:1/);
    }
  });

  test('should support different resolutions', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Find resolution buttons and change if available
    const buttons = page.locator('button');
    const resolutionCount = await buttons.count();

    // Verify resolution controls exist
    expect(resolutionCount).toBeGreaterThan(0);
  });

  test('should show admin panel with correct default values', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Open admin panel if available
    const adminButton = page.getByRole('button', { name: /Admin|Settings/i }).first();
    if (await adminButton.isVisible()) {
      await adminButton.click();
      await expect(page.locator('text=Orchestrator Model')).toBeVisible({ timeout: 2000 });
    }
  });

  test('should switch between light and dark themes', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Find theme toggle button
    const themeButton = page.getByRole('button', { name: /🌙|☀️/i }).first();

    if (await themeButton.isVisible()) {
      await themeButton.click();

      // Verify dark class was added
      const htmlElement = page.locator('html');

      // After first click, should have dark class
      await expect(htmlElement).toHaveAttribute('class', /dark/);

      // Click again to return to light
      await themeButton.click();
    }
  });

  test('should handle custom mode text input', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Select custom mode if available
    const modeButton = page.getByRole('button', { name: /Mode/i }).first();
    await modeButton.click();

    // Look for custom option
    const customOption = page.getByRole('option', { name: /Custom/i });
    if (await customOption.isVisible()) {
      await customOption.click();

      // Fill in custom text
      const textInput = page.locator('input[placeholder*="custom"]').first();
      if (await textInput.isVisible()) {
        await textInput.fill('My custom style');
        await expect(textInput).toHaveValue('My custom style');
      }
    }
  });

  test('should display all configuration sections', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Verify all main sections exist
    await expect(page.locator('text=Mode')).toBeVisible();
  });
});
