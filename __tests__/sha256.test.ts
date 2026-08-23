import { createHash } from 'crypto';

import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

// The pure-JS implementation guards every downloaded course document, so it
// must agree with node's reference implementation on every input shape.

const reference = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

const CASES = [
  '',
  'abc',
  'The quick brown fox jumps over the lazy dog',
  'a'.repeat(55), // one byte below the single-block padding boundary
  'a'.repeat(56), // forces a second block
  'a'.repeat(64),
  'a'.repeat(1000),
  'умови руху та знаки', // 2-byte UTF-8 sequences
  '道路標識テスト', // 3-byte sequences
  'emoji 🚗🛑 and pair 👨‍👩‍👧', // surrogate pairs / 4-byte sequences
  JSON.stringify({
    nested: ['json', 42, true],
    svg: '<svg viewBox="0 0 1 1"/>',
  }),
];

describe('sha256Hex', () => {
  it.each(CASES.map(text => [text.slice(0, 24), text]))(
    'matches node:crypto for %j…',
    (_label, text) => {
      expect(sha256Hex(text)).toBe(reference(text));
    },
  );

  it('matches node:crypto on a large document-sized payload', () => {
    const big = JSON.stringify({ data: 'x'.repeat(200_000), tail: 'кінець' });
    expect(sha256Hex(big)).toBe(reference(big));
  });
});

describe('utf8ByteLength', () => {
  it.each(CASES.map(text => [text.slice(0, 24), text]))(
    'matches Buffer.byteLength for %j…',
    (_label, text) => {
      expect(utf8ByteLength(text)).toBe(Buffer.byteLength(text, 'utf8'));
    },
  );
});
