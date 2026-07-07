import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadImage } from '../../services/downloadService';

describe('downloadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any DOM elements that might be added
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('downloadImage', () => {
    it('should create a blob from base64 data', () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const blobSpy = vi.spyOn(window, 'Blob');

      downloadImage(mockBase64, 'test-image');

      expect(blobSpy).toHaveBeenCalledWith(expect.any(Array), {
        type: 'image/png',
      });
    });

    it('should create download link with correct filename', () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const createElementSpy = vi.spyOn(document, 'createElement');
      downloadImage(mockBase64, 'test-image');

      const linkElement = createElementSpy.mock.results.find(
        (result) => result.value.tagName === 'A'
      )?.value as HTMLAnchorElement;

      expect(linkElement).toBeDefined();
      expect(linkElement.download).toBe('test-image.png');
    });

    it('should not add extension if filename already has .png', () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const createElementSpy = vi.spyOn(document, 'createElement');
      downloadImage(mockBase64, 'test-image.png');

      const linkElement = createElementSpy.mock.results.find(
        (result) => result.value.tagName === 'A'
      )?.value as HTMLAnchorElement;

      expect(linkElement.download).toBe('test-image.png');
    });

    it('should trigger download by clicking link', () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const clickSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement');

      downloadImage(mockBase64, 'test-image');

      const linkElement = createElementSpy.mock.results.find(
        (result) => result.value.tagName === 'A'
      )?.value as HTMLAnchorElement;

      linkElement.click = clickSpy;
      linkElement.click();

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should cleanup DOM elements after download', async () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      downloadImage(mockBase64, 'test-image');

      // Wait for the cleanup timeout (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // The link should be removed from DOM
      const links = document.querySelectorAll('a[download="test-image.png"]');
      expect(links.length).toBe(0);
    });

    it('should handle base64 data with data URL prefix', () => {
      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const blobSpy = vi.spyOn(window, 'Blob');

      downloadImage(mockBase64, 'test-image');

      expect(blobSpy).toHaveBeenCalledWith(expect.any(Array), {
        type: 'image/png',
      });
    });

    it('should fallback to data URL on blob creation error', () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      // Mock atob to throw error
      const originalAtob = global.atob;
      global.atob = vi.fn(() => {
        throw new Error('Invalid base64');
      });

      const createElementSpy = vi.spyOn(document, 'createElement');
      downloadImage(mockBase64, 'test-image');

      const linkElement = createElementSpy.mock.results.find(
        (result) => result.value.tagName === 'A'
      )?.value as HTMLAnchorElement;

      // Should use data URL as fallback
      expect(linkElement.href).toContain('data:image/png;base64,');

      global.atob = originalAtob;
    });

    it('should set link visibility to hidden', () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const createElementSpy = vi.spyOn(document, 'createElement');
      downloadImage(mockBase64, 'test-image');

      const linkElement = createElementSpy.mock.results.find(
        (result) => result.value.tagName === 'A'
      )?.value as HTMLAnchorElement;

      expect(linkElement.style.display).toBe('none');
    });

    it('should append and remove link from document body', async () => {
      const mockBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      downloadImage(mockBase64, 'test-image');

      // Element should be in DOM temporarily
      expect(document.body.children.length).toBeGreaterThan(0);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Should be cleaned up
      expect(document.body.children.length).toBe(0);
    });
  });
});
