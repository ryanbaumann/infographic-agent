import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock indexedDB
const idbMock = {
  open: vi.fn(() => ({
    onsuccess: null,
    onerror: null,
  })),
};

Object.defineProperty(window, 'indexedDB', {
  value: idbMock,
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock FileReader
global.FileReader = class FileReader {
  result: string | ArrayBuffer | null = null;
  error: Event | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
  onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
  onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
  readyState = 0;
  abort = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();

  readAsDataURL() {
    this.result = 'data:application/octet-stream;base64,mockbase64data';
    this.onload?.(new ProgressEvent('load'));
  }

  readAsArrayBuffer() {
    this.result = new ArrayBuffer(8);
    this.onload?.(new ProgressEvent('load'));
  }

  readAsText() {
    this.result = 'mock text content';
    this.onload?.(new ProgressEvent('load'));
  }
} as unknown as typeof FileReader;

// Mock import.meta.env
import.meta.env.VITE_GEMINI_API_KEY = '';
