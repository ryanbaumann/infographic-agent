import { test, expect, type Page } from '@playwright/test';

// Helper to write to localforage IndexedDB
async function setLocalForageItem(page: Page, key: string, value: unknown) {
  await page.goto('/'); // Navigate first to ensure IndexedDB is allowed
  await page.evaluate(
    ({ key, value }) => {
      return new Promise<void>((resolve, reject) => {
        // Open without specifying version to avoid VersionError if it already exists with a higher version
        const request = indexedDB.open('localforage');
        
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('keyvaluepairs')) {
            request.result.createObjectStore('keyvaluepairs');
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          
          // If objectStore doesn't exist, we must upgrade database to create it
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

test('has expected title and renders hero', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Infographic Architect/i);

  // Expect the page to render the main hero component.
  await expect(page.locator('h1')).toContainText(/Turn any content into beautiful infographics/i);

  // Click the "Get Started" button
  await page.getByRole('button', { name: 'Get Started' }).click();

  // Wait for the next view to load (studio mode/create mode)
  await expect(page.getByRole('button', { name: 'Generate Infographic' })).toBeVisible();
});

test('downloads infographic image with generated filename', async ({ page }) => {
  const mockHistory = [
    {
      id: 'history_mock_1',
      // A valid 1x1 pixel transparent PNG base64
      imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      config: {
        mode: 'standard',
        aspectRatio: '16:9',
        resolution: '1K',
        theme: 'light',
      },
      timestamp: Date.now(),
      title: 'Mock Infographic',
      filename: 'mock-infographic-filename'
    }
  ];

  // Set mock history in IndexedDB
  await setLocalForageItem(page, 'infographic-history', mockHistory);

  // Reload the page to load history
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();

  // Wait for the history button (labeled v1) to be visible and click it
  const historyBtn = page.getByRole('button', { name: 'v1' });
  await expect(historyBtn).toBeVisible();
  await historyBtn.click();

  // Verify we are now in the Studio view (Download button should be visible)
  const downloadBtn = page.getByRole('button', { name: 'Download' });
  await expect(downloadBtn).toBeVisible();

  // Intercept the download
  const downloadPromise = page.waitForEvent('download');
  await downloadBtn.click();
  const download = await downloadPromise;

  // Assert correct filename is used
  expect(download.suggestedFilename()).toBe('mock-infographic-filename.png');

  // Verify it is a valid downloaded file
  const path = await download.path();
  expect(path).toBeTruthy();
});
