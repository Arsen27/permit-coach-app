import {
  categoryColor,
  findCategory,
  findSign,
  signCategories,
  signs,
  signsByCategory,
  signsCatalogHash,
} from '@/data/signs';
import {
  SIGN_ART_KINDS,
  SIGN_CATEGORY_GLYPHS,
  SIGN_SYMBOLS,
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
      art: { kind: 'octagon', label: 'STOP' },
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
    expect(result.value?.signs[0].art).toEqual({
      kind: 'octagon',
      label: 'STOP',
    });
  });

  it('pins the schema version', () => {
    expect(errorsFor(doc => ((doc as any).schemaVersion = 2))).toContain(
      'schemaVersion',
    );
  });

  // The renderer draws from a closed vocabulary, so a document that names art
  // it cannot draw has to be rejected at the door rather than rendering blank.
  it('rejects art outside the vocabulary the renderer can draw', () => {
    expect(
      errorsFor(doc => ((doc.signs[0].art as any) = { kind: 'hexagon' })),
    ).toContain('unknown art kind hexagon');

    expect(
      errorsFor(
        doc =>
          ((doc.signs[0].art as any) = {
            kind: 'redRing',
            symbol: 'hovercraft',
          }),
      ),
    ).toContain('unknown sign symbol hovercraft');

    expect(
      errorsFor(doc => ((doc.signs[0].art as any) = { kind: 'redRing' })),
    ).toContain('expected a sign symbol');

    expect(
      errorsFor(
        doc =>
          ((doc.signs[0].art as any) = { kind: 'pentagon', symbol: 'deer' }),
      ),
    ).toContain('pentagon only supports pedestrian');
  });

  it('rejects art whose content would render empty', () => {
    expect(
      errorsFor(doc => ((doc.signs[0].art as any) = { kind: 'whiteRect' })),
    ).toContain('whiteRect needs lines, big or symbol');

    expect(
      errorsFor(doc => ((doc.signs[0].art as any) = { kind: 'yellowDiamond' })),
    ).toContain('needs a symbol or a label');

    expect(
      errorsFor(
        doc => ((doc.signs[0].art as any) = { kind: 'orangeRect', lines: [] }),
      ),
    ).toContain('lines');
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

  it('does not let bad art mask the rest of the record', () => {
    const errors = errorsFor(doc => {
      (doc.signs[0] as any).name = '';
      (doc.signs[0].art as any) = { kind: 'hexagon' };
    });

    expect(errors).toContain('unknown art kind hexagon');
    expect(errors).toContain('signs[0].name');
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

  it('only uses art the renderer can draw', () => {
    for (const sign of signs) {
      expect(SIGN_ART_KINDS).toContain(sign.art.kind);
      const used = (sign.art as { symbol?: string }).symbol;
      if (used !== undefined) {
        expect(SIGN_SYMBOLS).toContain(used);
      }
    }
  });
});
