// Signs wire format v1: the catalogue of road signs and the categories that
// group them. Every sign's artwork is an uploaded picture — there is no
// drawn-art vocabulary to keep in step between the renderer, the contract and
// the panel's pickers. This module is deliberately self-contained (zero imports, pure
// TS) for the same reason as the course wire format — it is the contract
// shared by the React Native app, the content server, and the admin panel,
// each of which keeps its own copy (see __tests__/adminWireSync.test.ts for
// how that copy is kept honest). Validators here are the single source of
// truth for what a structurally valid signs document is: the app must never
// trust a TypeScript cast where one of these functions can run instead.
//
// Unlike a course, the catalogue is not versioned: there is one live document
// and the operator publishes edits directly. Its sha256 is its identity, so
// the app updates whenever the served bytes differ from the committed ones —
// which also makes a rollback just another change.

export const SIGNS_SCHEMA_VERSION = 1;

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
// Artwork
//
// A sign's picture is an uploaded file. Two slots: the full image shown on the
// detail screen, and an optional thumbnail for the category grid and quiz
// flashcards — when the thumbnail is absent the full image is drawn at
// thumbnail size instead.
//
// Assets are content-addressed: `assetId` is the file's own sha256, so its
// URL is immutable, the platform image cache can hold it forever, and
// re-uploading the same picture cannot fork into two files.

export const SIGN_IMAGE_MIMES = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
] as const;

export type SignImageMime = (typeof SIGN_IMAGE_MIMES)[number];

export const SIGN_IMAGE_EXTENSIONS: Record<SignImageMime, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export type SignImageRef = {
  assetId: string;
  mime: SignImageMime;
  sizeBytes: number;
};

export type SignImage = {
  full: SignImageRef;
  thumb?: SignImageRef;
};

// The picture a given surface should draw: the thumbnail when one exists,
// otherwise the full image. Both sides of the wire agree through this
// function rather than repeating the fallback rule.
export const signThumbRef = (image: SignImage): SignImageRef =>
  image.thumb ?? image.full;

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
  image: SignImage;
};

export type SignsDoc = {
  schemaVersion: typeof SIGNS_SCHEMA_VERSION;
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

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
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

const validateImageRef = (
  errors: string[],
  value: unknown,
  path: string,
): SignImageRef | null => {
  if (!isRecord(value)) {
    errors.push(`${path}: expected object`);
    return null;
  }
  const ctx: Ctx = { path, errors };
  const assetId = str(ctx, value, 'assetId');
  // Content-addressed: the id must be the asset's own sha256, or the URL is
  // no longer immutable and the image cache could serve a stale picture.
  if (assetId && !SHA256_PATTERN.test(assetId)) {
    errors.push(`${path}.assetId: expected a lowercase sha256`);
  }
  const mime = str(ctx, value, 'mime');
  if (mime && !(SIGN_IMAGE_MIMES as readonly string[]).includes(mime)) {
    errors.push(
      `${path}.mime: expected one of ${SIGN_IMAGE_MIMES.join(
        ', ',
      )}, got ${mime}`,
    );
  }
  const sizeBytes = num(ctx, value, 'sizeBytes');
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    errors.push(`${path}.sizeBytes: expected a positive integer`);
  }
  return { assetId, mime: mime as SignImageMime, sizeBytes };
};

const validateImage = (
  errors: string[],
  value: unknown,
  path: string,
): SignImage | null => {
  if (!isRecord(value)) {
    errors.push(`${path}: expected object`);
    return null;
  }
  const full = validateImageRef(errors, value.full, `${path}.full`);
  if (full == null) {
    return null;
  }
  // The thumbnail is optional by design — absent means "use the full image at
  // thumbnail size" (signThumbRef), not "no picture".
  if (value.thumb === undefined) {
    return { full };
  }
  const thumb = validateImageRef(errors, value.thumb, `${path}.thumb`);
  return thumb == null ? { full } : { full, thumb };
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
  const image = validateImage(errors, value.image, `${path}.image`);
  if (image == null) {
    return null;
  }
  return { ...fields, image };
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
): ValidationResult<SignsDoc> => {
  if (!isRecord(input)) {
    return fail(['signs doc: expected object']);
  }
  const errors: string[] = [];

  if (input.schemaVersion !== SIGNS_SCHEMA_VERSION) {
    errors.push(
      `signs doc.schemaVersion: expected ${SIGNS_SCHEMA_VERSION}, got ${String(
        input.schemaVersion,
      )}`,
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
    categories: okCategories,
    signs: okSigns,
  });
};

// ---------------------------------------------------------------------------
// Transport
//
// There is one live document, so the update check is one request:
// /v1/signs/latest names the exact bytes currently published. The app holds
// the sha256 of what it committed and refetches whenever the server's differs
// — no ordering, no version arithmetic, and a rollback updates like any other
// change.

export type SignsCatalogRef = {
  sha256: string;
  sizeBytes: number;
  // Display only; the hash decides whether anything is fetched.
  updatedAt: string;
};

const num = (ctx: Ctx, obj: Record<string, unknown>, key: string): number => {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    ctx.errors.push(`${ctx.path}.${key}: expected finite number`);
    return 0;
  }
  return value;
};

export const validateSignsCatalogRef = (
  input: unknown,
): ValidationResult<SignsCatalogRef> => {
  if (!isRecord(input)) {
    return fail(['signs latest: expected object']);
  }
  const errors: string[] = [];
  const ctx: Ctx = { path: 'signs latest', errors };

  const sha256 = str(ctx, input, 'sha256');
  if (sha256 && !SHA256_PATTERN.test(sha256)) {
    errors.push('signs latest.sha256: expected lowercase sha256');
  }
  const sizeBytes = num(ctx, input, 'sizeBytes');
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    errors.push('signs latest.sizeBytes: expected a positive integer');
  }
  const updatedAt = str(ctx, input, 'updatedAt');

  if (errors.length > 0) {
    return fail(errors);
  }
  return pass({ sha256, sizeBytes, updatedAt });
};
