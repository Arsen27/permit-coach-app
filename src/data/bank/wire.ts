// Question bank wire format v1. The bank is its own entity: courses reference
// questions by id, and the bank updates the way the signs catalogue does —
// wholesale, immediately, for everyone, addressed by the sha256 of its own
// document. No versions, no ordering, no per-user ceremony.
//
// This module is deliberately self-contained (zero imports, pure TS) because
// it is shared byte-for-byte between the app and the content server — see
// __tests__/adminWireSync.test.ts.

export const BANK_SCHEMA_VERSION = 1;

export type BankChoiceV1 = {
  id: string;
  text: string;
  feedback: string;
};

export type BankQuestionV1 = {
  questionId: string;
  uuid: string;
  kind: 'opening_challenge' | 'lesson_checkpoint' | 'lesson_test';
  prompt: string;
  choices: BankChoiceV1[];
  correctAnswerId: string;
  explanation: string;
  assetId?: string;
  conceptId?: string;
  scope?: 'universal' | 'state_specific';
  // Whether the general Practice pool may draw this question. Absent means
  // yes — the pool is the default and every question extracted before this
  // field existed belongs to it. Set false for a question that only makes
  // sense where a lesson or a module test asks it by id: one that leans on
  // the slide before it, or that would give away a lesson's own answer.
  inPractice?: boolean;
};

// A picture one of these questions shows. The bytes are not here: `sha256`
// names a file the content server serves, immutably, because the name is the
// hash. The bank carries them because a question is asked wherever its id is
// referenced — a final exam draws from lessons the learner never opened, and
// a question whose picture only travelled inside a lesson document would
// have nothing to draw there.
export type BankAssetV1 = {
  assetId: string;
  mime: 'image/svg+xml' | 'image/png' | 'image/jpeg';
  sha256: string;
  sizeBytes: number;
  width: number;
  height: number;
  alt: string;
};

export type QuestionBankDocV1 = {
  schemaVersion: typeof BANK_SCHEMA_VERSION;
  courseId: string;
  questions: BankQuestionV1[];
  // Absent in a bank published before pictures travelled with it; the app
  // then falls back to the copies inside the lesson documents it holds.
  assets?: BankAssetV1[];
};

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

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const duplicates = (values: string[]): string[] => {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    (seen.has(value) ? dupes : seen).add(value);
  }
  return [...dupes];
};

const validateChoice = (ctx: Ctx, value: unknown): BankChoiceV1 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected choice object`);
    return null;
  }
  return {
    id: str(ctx, value, 'id'),
    text: str(ctx, value, 'text'),
    feedback: str(ctx, value, 'feedback'),
  };
};

export const validateBankQuestion = (
  ctx: Ctx,
  value: unknown,
): BankQuestionV1 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected question object`);
    return null;
  }
  const questionId = str(ctx, value, 'questionId');
  if (questionId && !ID_PATTERN.test(questionId)) {
    ctx.errors.push(`${ctx.path}.questionId: expected a lowercase slug`);
  }
  const uuid = str(ctx, value, 'uuid');
  if (uuid && !UUID_PATTERN.test(uuid)) {
    ctx.errors.push(`${ctx.path}.uuid: expected a uuid`);
  }
  const kindRaw = str(ctx, value, 'kind');
  if (
    kindRaw &&
    kindRaw !== 'opening_challenge' &&
    kindRaw !== 'lesson_checkpoint' &&
    kindRaw !== 'lesson_test'
  ) {
    ctx.errors.push(`${ctx.path}.kind: unknown kind ${kindRaw}`);
  }
  const choicesRaw = value.choices;
  const choices: BankChoiceV1[] = [];
  if (
    !Array.isArray(choicesRaw) ||
    choicesRaw.length < 3 ||
    choicesRaw.length > 5
  ) {
    ctx.errors.push(`${ctx.path}.choices: expected 3 to 5 choices`);
  } else {
    choicesRaw.forEach((choice, index) => {
      const parsed = validateChoice(
        { ...ctx, path: `${ctx.path}.choices[${index}]` },
        choice,
      );
      if (parsed) {
        choices.push(parsed);
      }
    });
  }
  const correctAnswerId = str(ctx, value, 'correctAnswerId');
  if (
    choices.length > 0 &&
    correctAnswerId &&
    !choices.some(choice => choice.id === correctAnswerId)
  ) {
    ctx.errors.push(`${ctx.path}.correctAnswerId: no matching choice`);
  }
  const choiceIds = choices.map(choice => choice.id);
  if (new Set(choiceIds).size !== choiceIds.length) {
    ctx.errors.push(`${ctx.path}.choices: duplicate choice ids`);
  }
  return {
    questionId,
    uuid,
    kind: kindRaw as BankQuestionV1['kind'],
    prompt: str(ctx, value, 'prompt'),
    choices,
    correctAnswerId,
    explanation: str(ctx, value, 'explanation'),
    ...(value.assetId !== undefined && { assetId: str(ctx, value, 'assetId') }),
    ...(value.conceptId !== undefined && {
      conceptId: str(ctx, value, 'conceptId'),
    }),
    ...(value.inPractice !== undefined && {
      inPractice: ((): boolean => {
        if (typeof value.inPractice !== 'boolean') {
          ctx.errors.push(`${ctx.path}.inPractice: expected a boolean`);
          return true;
        }
        return value.inPractice;
      })(),
    }),
    ...(value.scope !== undefined && {
      scope: ((): BankQuestionV1['scope'] => {
        const scope = str(ctx, value, 'scope');
        if (scope !== 'universal' && scope !== 'state_specific') {
          ctx.errors.push(`${ctx.path}.scope: unknown scope ${scope}`);
          return 'universal';
        }
        return scope;
      })(),
    }),
  };
};

const BANK_ASSET_MIMES = ['image/svg+xml', 'image/png', 'image/jpeg'];

export const validateBankAsset = (
  ctx: Ctx,
  value: unknown,
): BankAssetV1 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected asset object`);
    return null;
  }
  const mime = str(ctx, value, 'mime');
  if (mime && !BANK_ASSET_MIMES.includes(mime)) {
    ctx.errors.push(`${ctx.path}.mime: unsupported ${mime}`);
  }
  const sha256 = str(ctx, value, 'sha256');
  if (sha256 && !/^[0-9a-f]{64}$/.test(sha256)) {
    ctx.errors.push(`${ctx.path}.sha256: expected lowercase sha256 hex`);
  }
  const sizeBytes = value.sizeBytes;
  const width = value.width;
  const height = value.height;
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
    ctx.errors.push(`${ctx.path}.sizeBytes: expected a positive size`);
  }
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width <= 0 ||
    height <= 0
  ) {
    ctx.errors.push(`${ctx.path}: expected positive width/height`);
  }
  return {
    assetId: str(ctx, value, 'assetId'),
    mime: mime as BankAssetV1['mime'],
    sha256,
    sizeBytes: typeof sizeBytes === 'number' ? sizeBytes : 0,
    width: typeof width === 'number' ? width : 0,
    height: typeof height === 'number' ? height : 0,
    alt: str(ctx, value, 'alt'),
  };
};

export const validateQuestionBankDoc = (
  input: unknown,
): ValidationResult<QuestionBankDocV1> => {
  if (!isRecord(input)) {
    return fail(['bank doc: expected object']);
  }
  const errors: string[] = [];
  if (input.schemaVersion !== BANK_SCHEMA_VERSION) {
    errors.push(
      `bank doc.schemaVersion: expected ${BANK_SCHEMA_VERSION}, got ${String(
        input.schemaVersion,
      )}`,
    );
  }
  const ctx: Ctx = { path: 'bank doc', errors };
  const courseId = str(ctx, input, 'courseId');
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    return fail([...errors, 'bank doc.questions: expected a non-empty array']);
  }
  const questions = input.questions.map((value, index) =>
    validateBankQuestion(
      { path: `bank doc.questions[${index}]`, errors },
      value,
    ),
  );
  if (questions.some(question => question == null)) {
    return fail(errors);
  }
  const okQuestions = questions as BankQuestionV1[];
  for (const dupe of duplicates(okQuestions.map(q => q.questionId))) {
    errors.push(`bank doc.questions: duplicate question id ${dupe}`);
  }
  let assets: BankAssetV1[] | null = null;
  if (input.assets !== undefined) {
    if (!Array.isArray(input.assets)) {
      errors.push('bank doc.assets: expected an array');
    } else {
      const parsed = input.assets.map((value, index) =>
        validateBankAsset(
          { path: `bank doc.assets[${index}]`, errors },
          value,
        ),
      );
      if (!parsed.some(asset => asset == null)) {
        assets = parsed as BankAssetV1[];
        for (const dupe of duplicates(assets.map(asset => asset.assetId))) {
          errors.push(`bank doc.assets: duplicate asset id ${dupe}`);
        }
        // A picture nothing asks for is an authoring mistake, not a
        // harmless extra: it would be downloaded by every device forever.
        const asked = new Set(
          okQuestions.flatMap(question =>
            question.assetId != null ? [question.assetId] : [],
          ),
        );
        for (const asset of assets) {
          if (!asked.has(asset.assetId)) {
            errors.push(
              `bank doc.assets: no question asks for ${asset.assetId}`,
            );
          }
        }
      }
    }
  }
  if (errors.length > 0) {
    return fail(errors);
  }
  return pass({
    schemaVersion: BANK_SCHEMA_VERSION,
    courseId,
    questions: okQuestions,
    ...(assets != null && { assets }),
  });
};

// ---------------------------------------------------------------------------
// Transport: one live document per course, so the update check is one
// request. /v1/bank/:courseId/latest names the exact bytes each channel
// serves; the app refetches whenever the sha differs from what it holds.

export type BankRef = {
  sha256: string;
  sizeBytes: number;
  // Display only; the hash decides whether anything is fetched.
  updatedAt: string;
};

export const validateBankRef = (input: unknown): ValidationResult<BankRef> => {
  if (!isRecord(input)) {
    return fail(['bank latest: expected object']);
  }
  const errors: string[] = [];
  const ctx: Ctx = { path: 'bank latest', errors };
  const sha256 = str(ctx, input, 'sha256');
  if (sha256 && !SHA256_PATTERN.test(sha256)) {
    errors.push('bank latest.sha256: expected lowercase sha256');
  }
  const sizeBytes = input.sizeBytes;
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes)) {
    errors.push('bank latest.sizeBytes: expected a positive integer');
  }
  const updatedAt = str(ctx, input, 'updatedAt');
  if (errors.length > 0) {
    return fail(errors);
  }
  return pass({ sha256, sizeBytes: sizeBytes as number, updatedAt });
};
