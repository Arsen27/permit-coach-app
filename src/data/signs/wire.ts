// Signs wire format v1: the catalogue of road signs and the categories that
// group them. This module is deliberately self-contained (zero imports, pure
// TS) for the same reason as the course wire format — it is the contract
// shared by the React Native app, the content server, and the admin panel,
// each of which keeps its own copy (see __tests__/adminWireSync.test.ts for
// how that copy is kept honest). Validators here are the single source of
// truth for what a structurally valid signs document is: the app must never
// trust a TypeScript cast where one of these functions can run instead.
//
// Unlike a course, a signs document is small and indivisible — there are no
// per-entity documents to fetch, so there is one document and one hash.

export const SIGNS_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Art vocabulary
//
// Sign artwork is drawn, not photographed: `SignArt` renders these specs as
// SVG. The vocabulary is therefore closed — an author picks from it rather
// than supplying artwork, and anything outside it cannot be drawn. The
// runtime arrays exist so the admin panel can build pickers from the contract
// instead of hard-coding a second copy of the list.

export const SIGN_SYMBOLS = [
  'curveLeft',
  'curveRight',
  'winding',
  'crossroad',
  'sideRoad',
  'tIntersection',
  'merge',
  'laneEnds',
  'divided',
  'twoWay',
  'signal',
  'stopAhead',
  'yieldAhead',
  'pedestrian',
  'bicycle',
  'deer',
  'slippery',
  'hill',
  'bump',
  'dip',
  'narrowBridge',
  'softShoulder',
  'uturn',
  'turnLeft',
  'turnRight',
  'arrowUp',
  'arrowLeft',
  'arrowRight',
  'truck',
  'workers',
  'flagger',
  'gas',
  'fork',
  'roundabout',
] as const;

export type SignSymbol = (typeof SIGN_SYMBOLS)[number];

export const SIGN_ART_KINDS = [
  'octagon',
  'yield',
  'doNotEnter',
  'whiteRect',
  'redRing',
  'yellowDiamond',
  'orangeDiamond',
  'orangeRect',
  'blueRect',
  'greenRect',
  'greenExit',
  'shield',
  'pentagon',
  'yellowCircle',
  'pennant',
] as const;

export type SignArtKind = (typeof SIGN_ART_KINDS)[number];

export type SignArtSpec =
  | { kind: 'octagon'; label: string }
  | { kind: 'yield' }
  | { kind: 'doNotEnter' }
  | {
      kind: 'whiteRect';
      lines?: string[];
      big?: string;
      symbol?: SignSymbol;
      slash?: boolean;
    }
  | { kind: 'redRing'; symbol: SignSymbol }
  | { kind: 'yellowDiamond'; symbol?: SignSymbol; label?: string }
  | { kind: 'orangeDiamond'; symbol?: SignSymbol; label?: string }
  | { kind: 'orangeRect'; lines: string[] }
  | { kind: 'blueRect'; label: string; big?: string }
  | { kind: 'greenRect'; lines: string[] }
  | { kind: 'greenExit'; lines: string[] }
  | { kind: 'shield'; label: string }
  | { kind: 'pentagon'; symbol: 'pedestrian' }
  | { kind: 'yellowCircle'; label: string }
  | { kind: 'pennant'; label: string };

// The miniature silhouette drawn next to a category row on the Signs tab.
// A category carries its own glyph so that adding one is a content change
// rather than a code change.
export const SIGN_CATEGORY_GLYPHS = [
  'octagon',
  'diamond',
  'tallRect',
  'wideRect',
  'pennant',
  'circle',
] as const;

export type SignCategoryGlyph = (typeof SIGN_CATEGORY_GLYPHS)[number];

// ---------------------------------------------------------------------------
// Entities

export type SignCategory = {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  // MUTCD colour for the category, as `#RRGGBB`. Sign colours are real-world
  // semantics and are never themed, so this lives in content rather than in
  // the app theme.
  color: string;
  glyph: SignCategoryGlyph;
};

export type Sign = {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  description: string;
  steps: string[];
  trap: string;
  art: SignArtSpec;
};

export type SignsDoc = {
  schemaVersion: typeof SIGNS_SCHEMA_VERSION;
  deliveryVersion: string;
  categories: SignCategory[];
  signs: Sign[];
};

// ---------------------------------------------------------------------------
// Validation plumbing
//
// Mirrors src/data/course/v2/wire.ts: an accumulating context collects every
// error rather than throwing on the first, so an author sees the whole list.

export type ValidationResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; value: null; errors: string[] };

const fail = <T>(errors: string[]): ValidationResult<T> => ({
  ok: false,
  value: null,
  errors,
});

const pass = <T>(value: T): ValidationResult<T> => ({
  ok: true,
  value,
  errors: [],
});

type Ctx = { path: string; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (ctx: Ctx, obj: Record<string, unknown>, key: string): string => {
  const value = obj[key];
  if (typeof value !== 'string' || value.length === 0) {
    ctx.errors.push(`${ctx.path}.${key}: expected non-empty string`);
    return '';
  }
  return value;
};

const optStr = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = obj[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0) {
    ctx.errors.push(`${ctx.path}.${key}: expected non-empty string`);
    return undefined;
  }
  return value;
};

const strArray = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): string[] => {
  const value = obj[key];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(item => typeof item !== 'string' || item.length === 0)
  ) {
    ctx.errors.push(
      `${ctx.path}.${key}: expected non-empty array of non-empty strings`,
    );
    return [];
  }
  return value as string[];
};

const optStrArray = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): string[] | undefined => {
  if (obj[key] === undefined) {
    return undefined;
  }
  return strArray(ctx, obj, key);
};

const optBool = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = obj[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    ctx.errors.push(`${ctx.path}.${key}: expected boolean`);
    return undefined;
  }
  return value;
};

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const MAX_ID_LENGTH = 64;

const id = (ctx: Ctx, obj: Record<string, unknown>, key: string): string => {
  const value = str(ctx, obj, key);
  if (value.length > MAX_ID_LENGTH) {
    ctx.errors.push(
      `${ctx.path}.${key}: id longer than ${MAX_ID_LENGTH} chars`,
    );
  }
  return value;
};

const symbol = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): SignSymbol | undefined => {
  const value = obj[key];
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== 'string' ||
    !(SIGN_SYMBOLS as readonly string[]).includes(value)
  ) {
    ctx.errors.push(`${ctx.path}.${key}: unknown sign symbol ${String(value)}`);
    return undefined;
  }
  return value as SignSymbol;
};

const requiredSymbol = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): SignSymbol => {
  if (obj[key] === undefined) {
    ctx.errors.push(`${ctx.path}.${key}: expected a sign symbol`);
    return 'arrowUp';
  }
  return symbol(ctx, obj, key) ?? 'arrowUp';
};

// ---------------------------------------------------------------------------
// Art validation
//
// Each kind is checked against exactly the fields SignArt reads for it, so a
// spec that survives this function is one the renderer can actually draw.
// Anything the renderer would silently ignore is reported rather than kept:
// a label that never appears on screen is an authoring mistake, not content.

const validateArt = (parentCtx: Ctx, value: unknown): SignArtSpec | null => {
  const path = `${parentCtx.path}.art`;
  if (!isRecord(value)) {
    parentCtx.errors.push(`${path}: expected object`);
    return null;
  }
  const ctx: Ctx = { path, errors: parentCtx.errors };
  const kind = value.kind;
  if (
    typeof kind !== 'string' ||
    !(SIGN_ART_KINDS as readonly string[]).includes(kind)
  ) {
    ctx.errors.push(`${path}.kind: unknown art kind ${String(kind)}`);
    return null;
  }

  switch (kind as SignArtKind) {
    case 'octagon':
      return { kind: 'octagon', label: str(ctx, value, 'label') };
    case 'yield':
      return { kind: 'yield' };
    case 'doNotEnter':
      return { kind: 'doNotEnter' };
    case 'whiteRect': {
      const spec: SignArtSpec = { kind: 'whiteRect' };
      const lines = optStrArray(ctx, value, 'lines');
      const big = optStr(ctx, value, 'big');
      const sym = symbol(ctx, value, 'symbol');
      const slash = optBool(ctx, value, 'slash');
      if (lines !== undefined) spec.lines = lines;
      if (big !== undefined) spec.big = big;
      if (sym !== undefined) spec.symbol = sym;
      if (slash !== undefined) spec.slash = slash;
      if (lines === undefined && big === undefined && sym === undefined) {
        ctx.errors.push(`${path}: whiteRect needs lines, big or symbol`);
      }
      return spec;
    }
    case 'redRing':
      return { kind: 'redRing', symbol: requiredSymbol(ctx, value, 'symbol') };
    case 'yellowDiamond':
    case 'orangeDiamond': {
      const sym = symbol(ctx, value, 'symbol');
      const label = optStr(ctx, value, 'label');
      if (sym === undefined && label === undefined) {
        ctx.errors.push(`${path}: ${kind} needs a symbol or a label`);
      }
      const spec = { kind } as Extract<
        SignArtSpec,
        { kind: 'yellowDiamond' | 'orangeDiamond' }
      >;
      if (sym !== undefined) spec.symbol = sym;
      if (label !== undefined) spec.label = label;
      return spec;
    }
    case 'orangeRect':
      return { kind: 'orangeRect', lines: strArray(ctx, value, 'lines') };
    case 'greenRect':
      return { kind: 'greenRect', lines: strArray(ctx, value, 'lines') };
    case 'greenExit':
      return { kind: 'greenExit', lines: strArray(ctx, value, 'lines') };
    case 'blueRect': {
      const spec: SignArtSpec = {
        kind: 'blueRect',
        label: str(ctx, value, 'label'),
      };
      const big = optStr(ctx, value, 'big');
      if (big !== undefined) spec.big = big;
      return spec;
    }
    case 'shield':
      return { kind: 'shield', label: str(ctx, value, 'label') };
    case 'pentagon': {
      // The renderer only draws the school-crossing pentagon.
      if (value.symbol !== 'pedestrian') {
        ctx.errors.push(`${path}.symbol: pentagon only supports pedestrian`);
      }
      return { kind: 'pentagon', symbol: 'pedestrian' };
    }
    case 'yellowCircle':
      return { kind: 'yellowCircle', label: str(ctx, value, 'label') };
    case 'pennant':
      return { kind: 'pennant', label: str(ctx, value, 'label') };
  }
};

// ---------------------------------------------------------------------------
// Entity validation

const validateCategory = (
  errors: string[],
  value: unknown,
  index: number,
): SignCategory | null => {
  const path = `categories[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path}: expected object`);
    return null;
  }
  const ctx: Ctx = { path, errors };
  const color = str(ctx, value, 'color');
  if (color && !HEX_COLOR_PATTERN.test(color)) {
    errors.push(`${path}.color: expected #RRGGBB, got ${color}`);
  }
  const glyph = str(ctx, value, 'glyph');
  if (glyph && !(SIGN_CATEGORY_GLYPHS as readonly string[]).includes(glyph)) {
    errors.push(`${path}.glyph: unknown category glyph ${glyph}`);
  }
  return {
    id: id(ctx, value, 'id'),
    name: str(ctx, value, 'name'),
    subtitle: str(ctx, value, 'subtitle'),
    blurb: str(ctx, value, 'blurb'),
    color,
    glyph: glyph as SignCategoryGlyph,
  };
};

const validateSign = (
  errors: string[],
  value: unknown,
  index: number,
): Sign | null => {
  const path = `signs[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path}: expected object`);
    return null;
  }
  const ctx: Ctx = { path, errors };
  // Every field is checked before the art is, so a bad art spec does not mask
  // the rest of the record — an author fixing one problem should not have to
  // re-run to discover the next.
  const fields = {
    id: id(ctx, value, 'id'),
    categoryId: id(ctx, value, 'categoryId'),
    name: str(ctx, value, 'name'),
    code: str(ctx, value, 'code'),
    description: str(ctx, value, 'description'),
    steps: strArray(ctx, value, 'steps'),
    trap: str(ctx, value, 'trap'),
  };
  const art = validateArt(ctx, value.art);
  if (art == null) {
    return null;
  }
  return { ...fields, art };
};

// ---------------------------------------------------------------------------
// Document validation

const duplicates = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of ids) {
    if (seen.has(value)) {
      dupes.add(value);
    }
    seen.add(value);
  }
  return [...dupes];
};

export const validateSignsDoc = (
  input: unknown,
  expected: { deliveryVersion?: string } = {},
): ValidationResult<SignsDoc> => {
  if (!isRecord(input)) {
    return fail(['signs doc: expected object']);
  }
  const errors: string[] = [];
  const ctx: Ctx = { path: 'signs doc', errors };

  if (input.schemaVersion !== SIGNS_SCHEMA_VERSION) {
    errors.push(
      `signs doc.schemaVersion: expected ${SIGNS_SCHEMA_VERSION}, got ${String(
        input.schemaVersion,
      )}`,
    );
  }
  const deliveryVersion = str(ctx, input, 'deliveryVersion');
  if (deliveryVersion && !SEMVER_PATTERN.test(deliveryVersion)) {
    errors.push(`signs doc.deliveryVersion: expected semver`);
  }
  if (
    expected.deliveryVersion !== undefined &&
    deliveryVersion !== expected.deliveryVersion
  ) {
    errors.push(
      `signs doc.deliveryVersion: expected ${expected.deliveryVersion}, got ${deliveryVersion}`,
    );
  }

  if (!Array.isArray(input.categories) || input.categories.length === 0) {
    return fail([
      ...errors,
      'signs doc.categories: expected a non-empty array',
    ]);
  }
  if (!Array.isArray(input.signs) || input.signs.length === 0) {
    return fail([...errors, 'signs doc.signs: expected a non-empty array']);
  }

  const categories = input.categories.map((value, index) =>
    validateCategory(errors, value, index),
  );
  const signs = input.signs.map((value, index) =>
    validateSign(errors, value, index),
  );
  if (categories.some(c => c == null) || signs.some(s => s == null)) {
    return fail(errors);
  }
  const okCategories = categories as SignCategory[];
  const okSigns = signs as Sign[];

  // Referential integrity. A sign pointing at a missing category would vanish
  // from the cheatsheet without ever erroring, and an empty category would
  // render a row that leads to a blank screen — both are content bugs the
  // author must see.
  for (const dupe of duplicates(okCategories.map(c => c.id))) {
    errors.push(`signs doc.categories: duplicate category id ${dupe}`);
  }
  for (const dupe of duplicates(okSigns.map(s => s.id))) {
    errors.push(`signs doc.signs: duplicate sign id ${dupe}`);
  }
  const categoryIds = new Set(okCategories.map(c => c.id));
  for (const sign of okSigns) {
    if (!categoryIds.has(sign.categoryId)) {
      errors.push(
        `signs doc.signs: ${sign.id} references unknown category ${sign.categoryId}`,
      );
    }
  }
  const populated = new Set(okSigns.map(s => s.categoryId));
  for (const category of okCategories) {
    if (!populated.has(category.id)) {
      errors.push(`signs doc.categories: ${category.id} has no signs`);
    }
  }

  if (errors.length > 0) {
    return fail(errors);
  }
  return pass({
    schemaVersion: SIGNS_SCHEMA_VERSION,
    deliveryVersion,
    categories: okCategories,
    signs: okSigns,
  });
};
