import { bytesToBase64 } from './base64';
import { fetchWithRetry } from './fetchWithRetry';

// The bytes of one file, as base64.
//
// React Native's fetch is an XHR polyfill: `text()` is always there, but the
// binary readers are not uniform. `arrayBuffer()` is the direct road where it
// exists; where it does not, a Blob read as a data URL is the road that has
// always worked. Both end in the same base64, and the caller hashes it before
// it is kept — so a truncated read is caught rather than stored.

const dataUrlOf = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('could not read the picture'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });

export const fetchBase64 = async (
  url: string,
  timeoutMs: number,
): Promise<{ base64: string; status: number }> => {
  const response = await fetchWithRetry(url, { timeoutMs });
  if (!response.ok) {
    return { base64: '', status: response.status };
  }
  if (typeof response.arrayBuffer === 'function') {
    try {
      const buffer = await response.arrayBuffer();
      return { base64: bytesToBase64(new Uint8Array(buffer)), status: 200 };
    } catch {
      // Fall through: some engines expose the method and then refuse it.
    }
  }
  const dataUrl = await dataUrlOf(await response.blob());
  const comma = dataUrl.indexOf(',');
  return {
    base64: comma === -1 ? '' : dataUrl.slice(comma + 1),
    status: 200,
  };
};
