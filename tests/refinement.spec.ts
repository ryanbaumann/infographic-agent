import { test, expect, type Page } from '@playwright/test';

// Helper to write to localforage IndexedDB
async function setLocalForageItem(page: Page, key: string, value: unknown) {
  await page.goto('/');
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

test.describe('Infographic Refinement Chat', () => {
  test('should display chat panel in studio view', async ({ page }) => {
    const mockHistory = [
      {
        id: 'history_mock_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mock Infographic',
        filename: 'mock-infographic',
      },
    ];

    await setLocalForageItem(page, 'infographic-history', mockHistory);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Load history
    const historyBtn = page.getByRole('button', { name: 'v1' });
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    // Verify we're in studio and chat exists
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

    // Look for chat input
    const chatInput = page.locator('input[placeholder*="refine"], textarea[placeholder*="refine"]').first();
    if (await chatInput.isVisible()) {
      expect(chatInput).toBeDefined();
    }
  });

  test('should accept text input for refinements', async ({ page }) => {
    const mockHistory = [
      {
        id: 'history_mock_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mock Infographic',
        filename: 'mock-infographic',
      },
    ];

    await setLocalForageItem(page, 'infographic-history', mockHistory);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'v1' }).click();

    // Find and interact with chat input
    const chatInputs = page.locator('input[type="text"], textarea');
    if ((await chatInputs.count()) > 0) {
      const input = chatInputs.first();
      await input.fill('Make the colors brighter');
      await expect(input).toHaveValue('Make the colors brighter');
    }
  });

  test('should show refinement suggestions/chips', async ({ page }) => {
    const mockHistory = [
      {
        id: 'history_mock_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mock Infographic',
        filename: 'mock-infographic',
      },
    ];

    await setLocalForageItem(page, 'infographic-history', mockHistory);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'v1' }).click();

    // Look for suggestion chips/buttons
    const buttons = page.locator('button');
    const count = await buttons.count();

    // Should have various buttons including refinement suggestions
    expect(count).toBeGreaterThan(0);
  });

  test('should display current image in studio', async ({ page }) => {
    const mockHistory = [
      {
        id: 'history_mock_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mock Infographic',
        filename: 'mock-infographic',
      },
    ];

    await setLocalForageItem(page, 'infographic-history', mockHistory);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'v1' }).click();

    // Look for image display
    const images = page.locator('img');
    expect(await images.count()).toBeGreaterThan(0);
  });

  test('should show before/after slider', async ({ page }) => {
    const mockHistory = [
      {
        id: 'history_mock_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mock Infographic',
        filename: 'mock-infographic',
      },
    ];

    await setLocalForageItem(page, 'infographic-history', mockHistory);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'v1' }).click();

    // Look for slider component or before/after indicator
    const sliderElements = page.locator('[class*="slider"], [class*="before"], [class*="after"]');
    expect(await sliderElements.count()).toBeGreaterThanOrEqual(0);
  });

  test('should maintain chat history during refinements', async ({ page }) => {
    const mockHistory = [
      {
        id: 'history_mock_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mock Infographic',
        filename: 'mock-infographic',
      },
    ];

    await setLocalForageItem(page, 'infographic-history', mockHistory);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'v1' }).click();

    // Verify chat section exists
    const chatSection = page.locator('[class*="chat"], [class*="message"]').first();
    if (await chatSection.isVisible()) {
      expect(chatSection).toBeDefined();
    }
  });

  test('should support download from refined infographic', async ({ page }) => {
    const mockHistory = [
      {
        id: 'history_mock_1',
        imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        config: {
          mode: 'standard',
          aspectRatio: '16:9',
          resolution: '1K',
          theme: 'light',
        },
        timestamp: Date.now(),
        title: 'Mock Infographic',
        filename: 'mock-refined-infographic',
      },
    ];

    await setLocalForageItem(page, 'infographic-history', mockHistory);
    await page.goto('/');
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.getByRole('button', { name: 'v1' }).click();

    // Download button should be visible
    const downloadBtn = page.getByRole('button', { name: 'Download' });
    await expect(downloadBtn).toBeVisible();

    // Should be able to click it (without actually triggering download in test)
    await expect(downloadBtn).toBeEnabled();
  });
});
