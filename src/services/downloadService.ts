/**
 * Trigger a download of the base64 PNG data.
 */
export function downloadImage(base64Data: string, filename: string): void {
  // Clean base64 string by removing any data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  try {
    const byteCharacters = atob(cleanBase64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'image/png' });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const safeFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = blobUrl;
    link.download = safeFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup with a delay to ensure the browser has started the download.
    // Use link.remove() (no-op if already detached) to avoid throwing.
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(blobUrl);
    }, 2000);
  } catch (error) {
    console.error('Failed to download image:', error);
    // Fallback: try raw data URL if decoding fails
    const link = document.createElement('a');
    const safeFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = `data:image/png;base64,${cleanBase64}`;
    link.download = safeFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
    }, 2000);
  }
}
