import type { UploadedFile, FileCategory } from '../types';

// Security: Whitelist of allowed MIME types
const MIME_TO_CATEGORY: Record<string, FileCategory> = {
  'application/pdf': 'document',
  'text/plain': 'text',
  'text/markdown': 'text',
  'text/csv': 'spreadsheet',
  'text/tab-separated-values': 'spreadsheet',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
};

// Magic byte signatures for file type validation
const MAGIC_BYTES: Record<string, Uint8Array> = {
  'application/pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
  'image/png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]), // PNG header
  'image/jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]), // JPEG header
  'image/webp': new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF (WebP container)
};

// File size limits (in bytes) — keep in sync with MAX_FILE_SIZE_MB in types.ts
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file

/**
 * Validates file magic bytes against expected signature
 * @security This prevents malicious file uploads disguised with wrong extensions
 */
function validateMagicBytes(data: Uint8Array, mimeType: string): boolean {
  const magic = MAGIC_BYTES[mimeType];
  if (!magic) {
    // No magic bytes defined for this type - allow (e.g., text files)
    return true;
  }

  if (data.length < magic.length) {
    return false;
  }

  // For WebP, check for RIFF and WEBP format
  if (mimeType === 'image/webp') {
    const isRiff = data[0] === magic[0] && data[1] === magic[1] &&
                   data[2] === magic[2] && data[3] === magic[3];
    if (!isRiff) return false;
    // Check for WEBP signature at bytes 8-11
    return data.length >= 12 &&
           data[8] === 0x57 && data[9] === 0x45 &&
           data[10] === 0x42 && data[11] === 0x50;
  }

  // Standard magic byte comparison
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic[i]) {
      return false;
    }
  }
  return true;
}

export function categorizeFile(mimeType: string): FileCategory {
  return MIME_TO_CATEGORY[mimeType] || 'document';
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function processFile(file: File): Promise<UploadedFile> {
  // Security: Validate file size before processing
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB: ${file.name}`);
  }

  // Security: Validate MIME type is in whitelist
  const mimeType = file.type || 'application/octet-stream';
  if (!isValidFileType(mimeType)) {
    throw new Error(`File type not allowed: ${mimeType}. Supported types: PDF, images (PNG/JPEG/WebP), text, CSV, Excel.`);
  }

  // Security: Read first chunk to validate magic bytes before full base64 decode
  const headerChunk = await readFileHeader(file);
  if (!validateMagicBytes(headerChunk, mimeType)) {
    throw new Error(`File content does not match declared type (${mimeType}). The file may be corrupted or malicious.`);
  }

  const base64 = await readFileAsBase64(file);
  const category = categorizeFile(mimeType);

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    base64,
    mimeType,
    category,
    size: file.size,
  };
}

/**
 * Reads the first 512 bytes of a file for magic byte validation
 * @security Prevents DoS from processing huge files before validation
 */
function readFileHeader(file: File, headerSize: number = 512): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const blob = file.slice(0, Math.min(headerSize, file.size));

    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isValidFileType(mimeType: string): boolean {
  return mimeType in MIME_TO_CATEGORY;
}
