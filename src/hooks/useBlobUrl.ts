import { useState, useEffect } from 'react';

export function useBlobUrl(base64: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();

  // This effect syncs React state with an external resource (object URLs whose
  // lifecycle must be managed manually), so the setState calls are intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!base64) {
      // Clear the URL immediately if base64 is empty
      setUrl(undefined);
      return;
    }

    // Set to undefined initially to clear any old image while fetching
    setUrl(undefined);

    let isActive = true;
    let objectUrl = '';

    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    const blob = new Blob(byteArrays, { type: 'image/png' });

    if (isActive) {
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [base64]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return url;
}
