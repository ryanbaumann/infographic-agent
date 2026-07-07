import type { UploadedFile, InfographicConfig, AdminConfig, GenerationResult, PrepareResult } from '../../types';

// Mock files
export const mockPdfFile: UploadedFile = {
  id: 'file_test_001',
  name: 'test-document.pdf',
  base64: 'JVBERi0xLjQKJeLjz9MNCiAxIDAgb2JqDTw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqDTIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iag0zIDAgb2JqDTw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSAzIDAg', // truncated for brevity
  mimeType: 'application/pdf',
  category: 'document',
  size: 1024,
};

export const mockImageFile: UploadedFile = {
  id: 'file_test_002',
  name: 'test-image.png',
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  mimeType: 'image/png',
  category: 'image',
  size: 68,
};

export const mockTextFile: UploadedFile = {
  id: 'file_test_003',
  name: 'test-content.txt',
  base64: 'VGhpcyBpcyBhIHRlc3QgZmlsZSBjb250ZW50IQ==',
  mimeType: 'text/plain',
  category: 'text',
  size: 32,
};

export const mockSpreadsheetFile: UploadedFile = {
  id: 'file_test_004',
  name: 'test-data.csv',
  base64: 'Q2F0ZWdvcnksVmFsdWUKQSw1MApCLDMwCkMsMjA=',
  mimeType: 'text/csv',
  category: 'spreadsheet',
  size: 35,
};

// Mock configs
export const mockInfographicConfig: InfographicConfig = {
  mode: 'standard',
  aspectRatio: '16:9',
  resolution: '1K',
  theme: 'light',
  colorScheme: 'auto',
  customColors: undefined,
  customModeText: undefined,
  specificInstructions: undefined,
};

export const mockAdminConfig: AdminConfig = {
  geminiApiKey: 'test-api-key',
  orchestratorModel: 'gemini-3.5-flash',
  imageGenModel: 'gemini-3.1-flash-lite-image',
  thinkingLevel: 'HIGH',
  timeoutSeconds: 180,
};

// Mock API responses
export const mockPrepareResult: PrepareResult = {
  analysis: {
    title: 'Test Infographic',
    subtitle: 'A test infographic',
    sectionsCount: 3,
    dataPointsCount: 5,
    brandColors: ['#FF6B6B', '#4ECDC4', '#FFE66D'],
    sourceAttribution: 'Test Source',
  },
  prompt: 'Generate a professional infographic about test data',
  allTextStrings: ['Title', 'Section 1', 'Section 2', 'Section 3', 'Footer'],
};

export const mockGenerationResult: GenerationResult = {
  imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  description: 'Generated test infographic',
  prompt: 'Test prompt for generation',
};

// Mock error responses
export const mockApiErrors = {
  rateLimited: {
    status: 429,
    message: 'Rate limit exceeded',
  },
  unauthorized: {
    status: 401,
    message: 'Invalid API key',
  },
  badRequest: {
    status: 400,
    message: 'Bad request',
  },
  serverError: {
    status: 500,
    message: 'Internal server error',
  },
  timeout: {
    status: 408,
    message: 'Request timeout',
  },
};

// Mock history entries
export const mockHistoryEntry = {
  id: 'history_test_001',
  imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  config: mockInfographicConfig,
  timestamp: Date.now(),
  title: 'Test Infographic History',
  filename: 'test-infographic',
};
