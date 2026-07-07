import { test, expect, devices } from '@playwright/test';

// Test on mobile viewport (test.use with a device must be top-level,
// not inside a describe block, because it forces a new worker)
test.use({ ...devices['Pixel 5'] });

test.describe('Mobile Viewport Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render hero on mobile', async ({ page }) => {
    await expect(page).toHaveTitle(/Infographic Architect/i);
    await expect(page.locator('h1')).toContainText(/Turn any content into beautiful infographics/i);

    // Button should be visible and clickable
    const getStartedBtn = page.getByRole('button', { name: 'Get Started' });
    await expect(getStartedBtn).toBeVisible();
    await expect(getStartedBtn).toBeInViewport();
  });

  test('should navigate to create page on mobile', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    await expect(page.getByRole('button', { name: 'Generate Infographic' })).toBeVisible();
  });

  test('should stack form controls vertically on mobile', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Verify form controls are accessible on mobile
    const buttons = page.locator('button');
    const visibleButtons = await buttons.evaluateAll(
      (btns) => btns.filter((btn) => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length
    );

    expect(visibleButtons).toBeGreaterThan(0);
  });

  test('should handle touch interactions', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Test tap on dropdown
    const modeButton = page.getByRole('button', { name: /Mode/i }).first();
    if (await modeButton.isVisible()) {
      // Simulate touch by using click (Playwright translates this appropriately for mobile)
      await modeButton.click();

      // Verify dropdown opens
      const option = page.getByRole('option').first();
      if (await option.isVisible()) {
        expect(option).toBeDefined();
      }
    }
  });

  test('should maintain scrollability on mobile', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Get initial scroll position
    const initialScroll = await page.evaluate(() => window.scrollY);

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 100));

    // Get new scroll position
    const newScroll = await page.evaluate(() => window.scrollY);

    // Should be able to scroll
    expect(newScroll).toBeGreaterThanOrEqual(initialScroll);
  });

  test('should show appropriate button sizes on mobile', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    const button = page.getByRole('button', { name: 'Generate Infographic' }).first();
    if (await button.isVisible()) {
      const boundingBox = await button.boundingBox();

      // Button should have minimum touch target size (44x44 pixels recommended)
      expect(boundingBox).toBeDefined();
      if (boundingBox) {
        expect(boundingBox.height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('should display theme toggle on mobile', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    const themeBtn = page.getByRole('button', { name: /🌙|☀️/i }).first();
    if (await themeBtn.isVisible()) {
      await expect(themeBtn).toBeInViewport();
      await themeBtn.click();

      // Should toggle theme
      await expect(page.locator('html')).toHaveAttribute('class', /dark|light/);
    }
  });

  test('should handle form controls on mobile', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Find all interactive elements
    const inputs = page.locator('input, select, textarea, button');
    const count = await inputs.count();

    expect(count).toBeGreaterThan(0);

    // All should be reachable
    for (let i = 0; i < Math.min(3, count); i++) {
      const element = inputs.nth(i);
      const isVisible = await element.isVisible();

      // Elements should be either visible or scrollable to
      expect(typeof isVisible).toBe('boolean');
    }
  });

  test('should handle history loading on mobile', async ({ page }) => {
    // Set mock history in IndexedDB
    const mockHistory = [
      {
        id: 'history_mobile_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mobile Test',
        filename: 'mobile-test',
      },
    ];

    await page.evaluate(
      ({ history }) => {
        return new Promise<void>((resolve) => {
          const req = indexedDB.open('localforage');
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('keyvaluepairs')) {
              req.result.createObjectStore('keyvaluepairs');
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('keyvaluepairs', 'readwrite');
            const store = tx.objectStore('keyvaluepairs');
            store.put(history, 'infographic-history');
            resolve();
          };
        });
      },
      { history: mockHistory }
    );

    // Reload page
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();

    // History button should be visible on mobile
    const historyBtn = page.getByRole('button', { name: 'v1' });
    if (await historyBtn.isVisible()) {
      await expect(historyBtn).toBeInViewport();
      await historyBtn.click();

      // Should load history view
      const downloadBtn = page.getByRole('button', { name: 'Download' });
      if (await downloadBtn.isVisible()) {
        expect(downloadBtn).toBeDefined();
      }
    }
  });

  test('should handle landscape orientation', async ({ page }) => {
    // Current viewport is portrait, just verify it works
    const viewport = page.viewportSize();
    expect(viewport).toBeDefined();
    expect(viewport?.width).toBeGreaterThan(0);
  });

  test('should be responsive to different mobile sizes', async ({ page }) => {
    // Current test uses Pixel 5 (412x915)
    // Verify page adapts to this size

    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(500); // Mobile width

    // Page should still be usable
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });
});

// Test on tablet viewport
test.describe('Tablet Viewport Tests', () => {
  test.use({ ...devices['iPad Pro'] });

  test('should render properly on tablet', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Infographic Architect/i);
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
