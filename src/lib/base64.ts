// Base64 for the bytes of a picture. React Native has no Buffer and its
// global atob/btoa are not guaranteed across engines, so the two directions
// are here, small and tested against node's Buffer.

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const VALUES = (() => {
  const values = new Uint8Array(128);
  values.fill(255);
  for (let index = 0; index < ALPHABET.length; index += 1) {
    values[ALPHABET.charCodeAt(index)] = index;
  }
  return values;
})();

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const remaining = bytes.length - i;
    const chunk =
      (bytes[i] << 16) |
      ((remaining > 1 ? bytes[i + 1] : 0) << 8) |
      (remaining > 2 ? bytes[i + 2] : 0);
    out += ALPHABET[(chunk >> 18) & 63];
    out += ALPHABET[(chunk >> 12) & 63];
    out += remaining > 1 ? ALPHABET[(chunk >> 6) & 63] : '=';
    out += remaining > 2 ? ALPHABET[chunk & 63] : '=';
  }
  return out;
};

// Returns null rather than guessing at anything that is not base64: the
// bytes are about to be hash-checked, and a silent misread would fail that
// check with a misleading reason.
export const base64ToBytes = (text: string): Uint8Array | null => {
  const clean = text.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) {
    return null;
  }
  const length = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(length);
  let out = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunkLength = Math.min(4, clean.length - i);
    let chunk = 0;
    for (let j = 0; j < 4; j += 1) {
      chunk =
        (chunk << 6) |
        (j < chunkLength ? VALUES[clean.charCodeAt(i + j)] & 63 : 0);
    }
    if (out < length) bytes[out++] = (chunk >> 16) & 255;
    if (out < length) bytes[out++] = (chunk >> 8) & 255;
    if (out < length) bytes[out++] = chunk & 255;
  }
  return bytes;
};
