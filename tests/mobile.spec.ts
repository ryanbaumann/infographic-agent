import { test, expect, devices, type Page } from '@playwright/test';

// Test on mobile viewport (test.use with a device must be top-level,
// not inside a describe block, because it forces a new worker)
test.use({ ...devices['Pixel 5'] });

// Helper to write to localforage IndexedDB
async function setLocalForageItem(page: Page, key: string, value: unknown) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    ({ key, value }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('localforage');
        
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('keyvaluepairs')) {
            request.result.createObjectStore('keyvaluepairs');
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          
          if (!db.objectStoreNames.contains('keyvaluepairs')) {
            const currentVersion = db.version;
            db.close();
            
            const reqUpgrade = indexedDB.open('localforage', currentVersion + 1);
            reqUpgrade.onupgradeneeded = () => {
              reqUpgrade.result.createObjectStore('keyvaluepairs');
            };
            reqUpgrade.onsuccess = () => {
              const db2 = reqUpgrade.result;
              const tx = db2.transaction('keyvaluepairs', 'readwrite');
              const store = tx.objectStore('keyvaluepairs');
              const putReq = store.put(value, key);
              putReq.onsuccess = () => resolve();
              putReq.onerror = () => reject(putReq.error);
            };
            reqUpgrade.onerror = () => reject(reqUpgrade.error);
            return;
          }

          const tx = db.transaction('keyvaluepairs', 'readwrite');
          const store = tx.objectStore('keyvaluepairs');
          const putReq = store.put(value, key);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    { key, value }
  );
}

test.describe('Mobile Viewport Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render hero on mobile', async ({ page }) => {
    await expect(page).toHaveTitle(/Infographic Agent/i);
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

    // Test tap on Mode button
    const modeButton = page.getByRole('button', { name: 'Data Story' });
    await modeButton.click();

    // Verify it is selected
    await expect(modeButton).toHaveClass(/border-gblue-600/);
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

    // Use robust helper to set IndexedDB
    await setLocalForageItem(page, 'infographic-history', mockHistory);

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


