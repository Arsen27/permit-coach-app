import { base64ToBytes, bytesToBase64 } from '@/lib/base64';
import { sha256HexOfBytes } from '@/lib/sha256';

// Both directions against node's Buffer, which is the reference these have to
// agree with: a picture is stored as base64 and hash-checked as bytes, so a
// disagreement here would look like corrupted artwork.

const cases: number[][] = [
  [],
  [0],
  [255],
  [0, 1, 2],
  [1, 2, 3, 4],
  [1, 2, 3, 4, 5],
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // a PNG header
];

it('encodes exactly like Buffer', () => {
  for (const values of cases) {
    const bytes = Uint8Array.from(values);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  }
});

it('decodes exactly like Buffer, for every length', () => {
  for (let length = 0; length < 300; length += 1) {
    const bytes = Uint8Array.from(
      Array.from({ length }, (_unused, index) => (index * 37 + 11) % 256),
    );
    const encoded = Buffer.from(bytes).toString('base64');
    expect(Array.from(base64ToBytes(encoded)!)).toEqual(Array.from(bytes));
  }
});

it('refuses anything that is not base64 instead of guessing', () => {
  expect(base64ToBytes('not base64!')).toBeNull();
  expect(base64ToBytes('<svg/>')).toBeNull();
});

it('hashes bytes the way node does', () => {
  const { createHash } = require('node:crypto');
  for (const values of cases) {
    const bytes = Uint8Array.from(values);
    expect(sha256HexOfBytes(bytes)).toBe(
      createHash('sha256').update(Buffer.from(bytes)).digest('hex'),
    );
  }
});
