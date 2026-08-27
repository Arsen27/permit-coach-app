import {
  categoryColor,
  findCategory,
  findSign,
  signCategories,
  signs,
  signsByCategory,
  signsCatalogHash,
} from '@/data/signs';
import { SEED_SIGN_SVGS } from '@/data/signs/seedAssets';
import { sha256Hex } from '@/lib/sha256';
import {
  SIGN_CATEGORY_GLYPHS,
  SIGN_IMAGE_MIMES,
  validateSignsDoc,
} from '@/data/signs/wire';

// A minimal document that passes, so each case below can break exactly one
// rule and assert the error it produces.
const validDoc = () => ({
  schemaVersion: 1,
  categories: [
    {
      id: 'regulatory',
      name: 'Regulatory',
      subtitle: 'rules you must obey',
      blurb: 'White and red signs state traffic laws.',
      color: '#C8102E',
      glyph: 'octagon',
    },
  ],
  signs: [
    {
      id: 'stop',
      categoryId: 'regulatory',
      name: 'Stop',
      code: 'R1-1',
      description: 'The only eight-sided sign on the road.',
      steps: ['Stop fully before the limit line'],
      trap: 'Rolling through slowly is still a violation.',
      image: {
        full: {
          assetId: 'a'.repeat(64),
          mime: 'image/svg+xml',
          sizeBytes: 512,
        },
      },
    },
  ],
});

const errorsFor = (mutate: (doc: ReturnType<typeof validDoc>) => void) => {
  const doc = validDoc();
  mutate(doc);
  const result = validateSignsDoc(doc);
  expect(result.ok).toBe(false);
  return result.errors.join('\n');
};

describe('signs wire contract', () => {
  it('accepts a well-formed document', () => {
    const result = validateSignsDoc(validDoc());

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.value?.signs[0].image.full.mime).toBe('image/svg+xml');
  });

  it('pins the schema version', () => {
    expect(errorsFor(doc => ((doc as any).schemaVersion = 2))).toContain(
      'schemaVersion',
    );
  });

  it('enforces the category presentation fields', () => {
    expect(errorsFor(doc => (doc.categories[0].color = 'red'))).toContain(
      'expected #RRGGBB',
    );
    expect(errorsFor(doc => (doc.categories[0].glyph = 'blob'))).toContain(
      'unknown category glyph blob',
    );
  });

  // Both directions of the category<->sign relationship, because either one
  // breaks the cheatsheet silently rather than loudly.
  it('enforces referential integrity between signs and categories', () => {
    expect(errorsFor(doc => (doc.signs[0].categoryId = 'nope'))).toContain(
      'references unknown category nope',
    );

    expect(
      errorsFor(doc =>
        doc.categories.push({ ...doc.categories[0], id: 'empty' }),
      ),
    ).toContain('empty has no signs');
  });

  it('rejects duplicate ids', () => {
    expect(errorsFor(doc => doc.signs.push({ ...doc.signs[0] }))).toContain(
      'duplicate sign id stop',
    );

    expect(
      errorsFor(doc => {
        doc.categories.push({ ...doc.categories[0] });
        doc.signs.push({ ...doc.signs[0], id: 'stop-2' });
      }),
    ).toContain('duplicate category id regulatory');
  });

  it('reports every problem at once rather than the first', () => {
    const doc = validDoc();
    doc.categories[0].color = 'red';
    doc.categories[0].glyph = 'blob';
    const result = validateSignsDoc(doc);

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('enforces the artwork every sign must carry', () => {
    expect(errorsFor(doc => delete (doc.signs[0] as any).image)).toContain(
      'signs[0].image',
    );

    expect(
      errorsFor(doc => ((doc.signs[0].image.full as any).mime = 'image/gif')),
    ).toContain('image/gif');

    // Content-addressed, or the immutable asset URL stops being immutable.
    expect(
      errorsFor(doc => ((doc.signs[0].image.full as any).assetId = 'nope')),
    ).toContain('expected a lowercase sha256');

    expect(
      errorsFor(doc => ((doc.signs[0].image.full as any).sizeBytes = 0)),
    ).toContain('positive integer');
  });

  it('rejects non-documents without throwing', () => {
    expect(validateSignsDoc(null).ok).toBe(false);
    expect(validateSignsDoc([]).ok).toBe(false);
    expect(validateSignsDoc({ schemaVersion: 1 }).ok).toBe(false);
  });
});

describe('bundled signs catalogue', () => {
  // Importing @/data/signs throws if the seed fails validation, so simply
  // getting here proves the shipped catalogue satisfies every rule above.
  it('is a valid signs document', () => {
    // Its own sha256 is its identity now that nothing is versioned.
    expect(signsCatalogHash).toMatch(/^[0-9a-f]{64}$/);
    expect(signCategories.length).toBeGreaterThan(0);
    expect(signs.length).toBeGreaterThan(0);
  });

  it('exposes every category through the lookups the screens use', () => {
    for (const category of signCategories) {
      expect(findCategory(category.id)).toBe(category);
      expect(categoryColor[category.id]).toBe(category.color);
      expect(signsByCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it('exposes every sign through findSign', () => {
    for (const sign of signs) {
      expect(findSign(sign.id)).toBe(sign);
    }
  });

  // Guards the seam that made this catalogue editable: the screens read
  // colour and glyph off the record instead of switching on a known id, so a
  // category added from the admin panel renders without a code change.
  it('carries presentation on every category record', () => {
    for (const category of signCategories) {
      expect(category.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(SIGN_CATEGORY_GLYPHS).toContain(category.glyph);
    }
  });

  // The app ships fully offline, so every bundled sign's artwork must ship
  // with it — otherwise a fresh install with no network is 71 placeholders.
  it('bundles the artwork every seed sign points at', () => {
    for (const sign of signs) {
      const svg = SEED_SIGN_SVGS[sign.image.full.assetId];
      expect(svg).toBeDefined();
      // Content-addressed: the bundled markup must be what the id names, or
      // the app and the server would disagree about the same asset.
      expect(sha256Hex(svg)).toBe(sign.image.full.assetId);
      expect(svg).toContain('<svg');
    }
  });

  it('bundles nothing the catalogue does not reference', () => {
    const referenced = new Set(signs.map(sign => sign.image.full.assetId));
    expect(Object.keys(SEED_SIGN_SVGS).sort()).toEqual([...referenced].sort());
  });

  // The same rules the server enforces on upload: this markup renders on a
  // device, so nothing active may ride along.
  it('bundles only inert artwork', () => {
    for (const svg of Object.values(SEED_SIGN_SVGS)) {
      expect(svg).not.toMatch(/<script|<foreignObject|<image[\s>]/i);
      expect(svg).not.toMatch(/\son\w+\s*=|javascript:/i);
      expect(svg).not.toMatch(/(?:href|src)\s*=\s*["']https?:/i);
    }
  });

  it('gives every sign its own artwork', () => {
    for (const sign of signs) {
      expect(SIGN_IMAGE_MIMES).toContain(sign.image.full.mime);
      expect(sign.image.full.assetId).toMatch(/^[0-9a-f]{64}$/);
      expect(sign.image.full.sizeBytes).toBeGreaterThan(0);
    }
    // Each sign is its own picture — no two share one file.
    const ids = signs.map(sign => sign.image.full.assetId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
