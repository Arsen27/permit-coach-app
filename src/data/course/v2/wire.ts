// Course wire format v2: block-based lessons, embedded SVG assets, and
// per-document manifest hashes. This module is deliberately self-contained
// (zero imports, pure TS) because it is shared by three runtimes: the React
// Native app, the node-based importer (scripts/courseImportV2.ts via a
// relative .ts import), and tests. Validators here are the single source of
// truth for what a structurally valid v2 document is — the app must never
// trust a TypeScript cast where one of these functions can run instead.

export const COURSE_SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Entities

export type CourseChoiceV2 = {
  id: string;
  text: string;
  feedback: string;
};

export type CourseQuestionV2 = {
  questionId: string;
  uuid: string;
  kind: 'opening_challenge' | 'lesson_checkpoint' | 'lesson_test';
  prompt: string;
  choices: CourseChoiceV2[];
  correctAnswerId: string;
  explanation: string;
  assetId?: string;
  // Stable across state courses. It lets authoring tools compare the same
  // skill without pretending the state-specific wording is reusable.
  conceptId?: string;
  scope?: 'universal' | 'state_specific';
};

export type CourseAssetV2 = {
  assetId: string;
  uuid: string;
  type: 'svg';
  width: number;
  height: number;
  alt: string;
  sha256: string;
  svgXml: string;
};

// ---------------------------------------------------------------------------
// Slide content elements
//
// A teaching card's body is an ordered list of elements, so artwork can sit
// anywhere inside the prose instead of only ahead of the card. Blocks authored
// before this existed carry `bodyMarkdown` + `bullets` and no `content`;
// `blockElements()` presents both shapes as one list, and that is what every
// renderer reads. Authoring tools keep `bodyMarkdown` a true copy of the prose
// even when `content` is present, so an older app build still shows the text.

export type ParagraphElementV2 = { kind: 'paragraph'; text: string };

export type BulletsElementV2 = { kind: 'bullets'; items: string[] };

export type ImageElementV2 = { kind: 'image'; assetId: string };

export type KnownLessonElementV2 =
  | ParagraphElementV2
  | BulletsElementV2
  | ImageElementV2;

// Forward compatibility, on the same contract as unknown blocks: preserved
// verbatim, skipped by renderers that do not know the kind.
export type UnknownLessonElementV2 = { kind: string };

export type LessonElementV2 = KnownLessonElementV2 | UnknownLessonElementV2;

export const isParagraphElement = (
  element: LessonElementV2,
): element is ParagraphElementV2 => element.kind === 'paragraph';

export const isBulletsElement = (
  element: LessonElementV2,
): element is BulletsElementV2 => element.kind === 'bullets';

export const isImageElement = (
  element: LessonElementV2,
): element is ImageElementV2 => element.kind === 'image';

// ---------------------------------------------------------------------------
// Slide types (card styles)

export type CardToneV2 = 'accent' | 'muted' | 'trap' | 'california';

// An authored slide type: the kicker a card shows above its title. A style
// whose id matches a built-in block type overrides that family's default
// presentation; any other id is a new slide type a block opts into through its
// own `styleId`. Behaviour always stays with the block family — a style only
// decides the words, the icon and the colours.
export type CardStyleV2 = {
  styleId: string;
  label: string;
  // An icon name from the app's icon set. Validated as a plain string here
  // because this module has no imports; a name this build does not know falls
  // back to the block family's own icon rather than breaking the card.
  icon: string;
  // Explicit colours win over `tone`, which names a built-in palette slot.
  tone?: CardToneV2;
  textColor?: string;
  iconColor?: string;
};

// ---------------------------------------------------------------------------
// Lesson blocks

export type QuickChallengeBlockV2 = {
  blockId: string;
  type: 'quick_challenge';
  title: string;
  scenario: string;
  questionPreview: string;
  questionId: string;
  styleId?: string;
};

export type ImageBlockV2 = {
  blockId: string;
  type: 'image';
  assetId: string;
  styleId?: string;
};

// core_rule / visual_example / related_rule / state_specific carry an
// optional inline checkpoint question; the plain prose blocks do not.
// 'california_specific' is the CA package's original name for the same block;
// newer state packages ship the jurisdiction-neutral 'state_specific'.
export type ConceptBlockV2 = {
  blockId: string;
  type:
    | 'core_rule'
    | 'visual_example'
    | 'related_rule'
    | 'california_specific'
    | 'state_specific';
  title: string;
  bodyMarkdown: string;
  bullets?: string[];
  // Ordered body. When present it is what renderers draw, and `bodyMarkdown`
  // /`bullets` are the flattened copy kept for older builds and the diff.
  content?: LessonElementV2[];
  styleId?: string;
  conceptId?: string;
  scope?: 'universal' | 'state_specific';
  checkpointQuestionId?: string;
};

export type ProseBlockV2 = {
  blockId: string;
  type: 'why_it_matters' | 'exam_trap' | 'remember_this';
  title: string;
  bodyMarkdown: string;
  bullets?: string[];
  content?: LessonElementV2[];
  styleId?: string;
  conceptId?: string;
  scope?: 'universal' | 'state_specific';
  // Newer state packages hang a lesson checkpoint on a prose block too (the
  // CA package only ever used concept blocks for this).
  checkpointQuestionId?: string;
};

export type DriveSmarterBlockV2 = {
  blockId: string;
  type: 'drive_smarter';
  title: string;
  bodyMarkdown: string;
  bullets?: string[];
  content?: LessonElementV2[];
  styleId?: string;
  conceptId?: string;
  scope?: 'universal' | 'state_specific';
  optional: true;
};

// Recall card ("Check yourself"): the rule is shown with its key words
// blurred out; the learner reads them from memory, reveals, and self-reports.
// Unscored — either self-report advances the deck.
export type CheckYourselfBlockV2 = {
  blockId: string;
  type: 'check_yourself';
  title: string;
  // Uppercase label inside the recall card, e.g. "Recall · Yellow lines".
  context: string;
  // The rule sentence with each hidden word wrapped in [[double brackets]].
  ruleMarkdown: string;
  styleId?: string;
  conceptId?: string;
  scope?: 'universal' | 'state_specific';
};

export type KnownLessonBlockV2 =
  | QuickChallengeBlockV2
  | ImageBlockV2
  | ConceptBlockV2
  | ProseBlockV2
  | DriveSmarterBlockV2
  | CheckYourselfBlockV2;

// Future content versions may ship block types this app build does not know.
// They are preserved verbatim and rendered as a graceful fallback card.
export type UnknownLessonBlockV2 = {
  blockId: string;
  type: string;
};

export type LessonBlockV2 = KnownLessonBlockV2 | UnknownLessonBlockV2;

export type LessonIntroV2 = {
  summary: string;
  keyPoints: string[];
  theoryMinutes: number;
  testMinutes: number;
};

export const KNOWN_BLOCK_TYPES = [
  'quick_challenge',
  'why_it_matters',
  'image',
  'core_rule',
  'visual_example',
  'related_rule',
  'california_specific',
  'state_specific',
  'exam_trap',
  'drive_smarter',
  'remember_this',
  'check_yourself',
] as const;

export type KnownBlockType = (typeof KNOWN_BLOCK_TYPES)[number];

export const isKnownBlockType = (type: string): type is KnownBlockType =>
  (KNOWN_BLOCK_TYPES as readonly string[]).includes(type);

export const isQuickChallengeBlock = (
  block: LessonBlockV2,
): block is QuickChallengeBlockV2 => block.type === 'quick_challenge';

export const isImageBlock = (block: LessonBlockV2): block is ImageBlockV2 =>
  block.type === 'image';

export const isConceptBlock = (block: LessonBlockV2): block is ConceptBlockV2 =>
  block.type === 'core_rule' ||
  block.type === 'visual_example' ||
  block.type === 'related_rule' ||
  block.type === 'california_specific' ||
  block.type === 'state_specific';

// The checkpoint question a block carries, whatever family it belongs to.
export const checkpointQuestionIdOf = (
  block: LessonBlockV2,
): string | undefined =>
  isConceptBlock(block) || isProseBlock(block)
    ? block.checkpointQuestionId
    : undefined;

export const isProseBlock = (block: LessonBlockV2): block is ProseBlockV2 =>
  block.type === 'why_it_matters' ||
  block.type === 'exam_trap' ||
  block.type === 'remember_this';

export const isDriveSmarterBlock = (
  block: LessonBlockV2,
): block is DriveSmarterBlockV2 => block.type === 'drive_smarter';

export const isCheckYourselfBlock = (
  block: LessonBlockV2,
): block is CheckYourselfBlockV2 => block.type === 'check_yourself';

// ---------------------------------------------------------------------------
// Reading a block's presentation and body

// The slide type a block asks to be drawn as. A block without an explicit
// `styleId` falls back to a style named after its own type, which is how an
// author retitles or recolours a built-in card family for the whole course.
export const blockStyleId = (block: LessonBlockV2): string => {
  const styleId = (block as { styleId?: unknown }).styleId;
  return typeof styleId === 'string' && styleId.length > 0
    ? styleId
    : block.type;
};

export const paragraphsOf = (markdown: string): string[] =>
  markdown
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(part => part.length > 0);

// One reading of a teaching block's body, whichever shape it was authored in:
// the explicit `content` list, or the paragraphs and bullets of the legacy
// fields. Renderers only ever call this, so both shapes draw identically.
export const blockElements = (block: LessonBlockV2): LessonElementV2[] => {
  const content = (block as { content?: unknown }).content;
  if (Array.isArray(content) && content.length > 0) {
    return content as LessonElementV2[];
  }
  const elements: LessonElementV2[] = [];
  const bodyMarkdown = (block as { bodyMarkdown?: unknown }).bodyMarkdown;
  if (typeof bodyMarkdown === 'string') {
    for (const text of paragraphsOf(bodyMarkdown)) {
      elements.push({ kind: 'paragraph', text });
    }
  }
  const bullets = (block as { bullets?: unknown }).bullets;
  if (Array.isArray(bullets) && bullets.length > 0) {
    elements.push({ kind: 'bullets', items: bullets as string[] });
  }
  return elements;
};

// The flattened copies an element list must be written back as, so the legacy
// fields never disagree with the authored content.
// Blank lines are an editing artefact, never content: they are dropped here so
// the legacy fields, the renderers and the diff all agree on what a body says.
const isBlank = (text: string): boolean => text.trim().length === 0;

export const elementsToMarkdown = (elements: LessonElementV2[]): string =>
  elements
    .filter(isParagraphElement)
    .map(element => element.text)
    .filter(text => !isBlank(text))
    .join('\n\n');

export const elementsToBullets = (elements: LessonElementV2[]): string[] =>
  elements
    .filter(isBulletsElement)
    .flatMap(element => element.items)
    .filter(item => !isBlank(item));

// The body with every blank line taken out, which is what a renderer draws and
// what an authoring tool should store once the author stops typing. Returns the
// same array when there was nothing to drop, so callers can skip a rewrite.
export const withoutBlankElements = (
  elements: LessonElementV2[],
): LessonElementV2[] => {
  const kept: LessonElementV2[] = [];
  for (const element of elements) {
    if (isParagraphElement(element)) {
      if (!isBlank(element.text)) {
        kept.push(element);
      }
      continue;
    }
    if (isBulletsElement(element)) {
      const items = element.items.filter(item => !isBlank(item));
      if (items.length > 0) {
        kept.push(
          items.length === element.items.length
            ? element
            : { ...element, items },
        );
      }
      continue;
    }
    kept.push(element);
  }
  return kept.length === elements.length &&
    kept.every((element, index) => element === elements[index])
    ? elements
    : kept;
};

// Artwork a block pulls in on its own: an `image` block's asset plus every
// inline image element, in reading order.
export const blockAssetIds = (block: LessonBlockV2): string[] => {
  const ids = isImageBlock(block) ? [block.assetId] : [];
  for (const element of blockElements(block)) {
    if (isImageElement(element)) {
      ids.push(element.assetId);
    }
  }
  return ids;
};

// ---------------------------------------------------------------------------
// Check-yourself recall gaps

export type RecallSegment = { text: string; gap: boolean };

// Splits a check_yourself rule into plain text and [[gap]] segments. Lives
// next to the wire format because the validator, the app renderer and the
// admin preview must all read the markers identically.
export const recallSegments = (ruleMarkdown: string): RecallSegment[] => {
  const segments: RecallSegment[] = [];
  const pattern = /\[\[(.*?)\]\]/g;
  let cursor = 0;
  for (
    let match = pattern.exec(ruleMarkdown);
    match != null;
    match = pattern.exec(ruleMarkdown)
  ) {
    if (match.index > cursor) {
      segments.push({
        text: ruleMarkdown.slice(cursor, match.index),
        gap: false,
      });
    }
    segments.push({ text: match[1], gap: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < ruleMarkdown.length) {
    segments.push({ text: ruleMarkdown.slice(cursor), gap: false });
  }
  return segments;
};

export const recallGapErrors = (ruleMarkdown: string): string[] => {
  const errors: string[] = [];
  const segments = recallSegments(ruleMarkdown);
  const gaps = segments.filter(segment => segment.gap);
  if (gaps.length === 0) {
    errors.push('expected at least one [[gap]] marker');
  }
  if (gaps.some(gap => gap.text.trim().length === 0)) {
    errors.push('empty [[gap]] marker');
  }
  // Leftover brackets in any segment mean an unclosed or nested marker.
  if (segments.some(segment => /\[\[|\]\]/.test(segment.text))) {
    errors.push('unbalanced [[gap]] markers');
  }
  return errors;
};

export type CourseLessonV2 = {
  lessonId: string;
  uuid: string;
  moduleId: string;
  globalSequence: number;
  moduleSequence: number;
  title: string;
  // State-neutral topic key. State packages keep their own lessonId and copy,
  // but lessons with the same conceptId can be diffed and regenerated together.
  conceptId?: string;
  objective: string;
  intro?: LessonIntroV2;
  estimatedMinutes: string;
  format: string;
  blocks: LessonBlockV2[];
  // `questionIds` remains the complete compatibility list. New conversational
  // lessons split it into unscored theory interactions and the scored test.
  questionIds: string[];
  theoryQuestionIds?: string[];
  testQuestionIds?: string[];
  assetIds: string[];
  language: string;
};

export type CourseModuleTestV2 = {
  testId: string;
  uuid: string;
  moduleId: string;
  questionIds: string[];
};

export type CourseModuleV2 = {
  moduleId: string;
  uuid: string;
  sequence: number;
  title: string;
  outcome: string;
  lessons: CourseLessonV2[];
  moduleTest: CourseModuleTestV2;
};

export type CourseInfoV2 = {
  courseId: string;
  title: string;
  subtitle: string;
  jurisdiction: string;
  state: string;
  language: string;
  targetLicense: string;
  moduleIds: string[];
  // Authored slide types for this course. Absent means "built-in defaults
  // only", which is every package shipped before slide types were editable.
  cardStyles?: CardStyleV2[];
  sourceVersionLabel: string;
  sourceContentHash: string;
  sourceCheckedAt: string;
  sourceReviewStatus: string;
  publicationAuthorized: boolean;
};

// ---------------------------------------------------------------------------
// Documents

export type CourseDocV2 = {
  schemaVersion: typeof COURSE_SCHEMA_VERSION;
  deliveryVersion: string;
  course: CourseInfoV2;
};

export type ModuleDocV2 = {
  schemaVersion: typeof COURSE_SCHEMA_VERSION;
  deliveryVersion: string;
  module: CourseModuleV2;
  questions: CourseQuestionV2[];
  assets: CourseAssetV2[];
};

export type LessonDocV2 = {
  schemaVersion: typeof COURSE_SCHEMA_VERSION;
  deliveryVersion: string;
  lesson: CourseLessonV2;
  questions: CourseQuestionV2[];
  assets: CourseAssetV2[];
};

// App-side assembled course: the shape of the bundled seed and of the device
// snapshot after module docs are merged (questions/assets deduped course-wide
// in module order).
export type CourseBundleV2 = {
  course: CourseInfoV2;
  modules: CourseModuleV2[];
  questions: CourseQuestionV2[];
  assets: CourseAssetV2[];
};

export const bundleLessonCount = (bundle: CourseBundleV2): number =>
  bundle.modules.reduce((sum, module) => sum + module.lessons.length, 0);

// ---------------------------------------------------------------------------
// Manifest / bootstrap

export type UpdateSeverity = 'hard' | 'optional' | 'soft';

export type UpdateInstructionV2 =
  | {
      op: 'lesson-content' | 'lesson-questions';
      lessonId: string;
      severity: UpdateSeverity;
      message?: string;
    }
  | {
      op: 'question';
      questionId: string;
      lessonId?: string;
      moduleId?: string;
      severity: UpdateSeverity;
      message?: string;
    }
  | {
      op: 'module';
      moduleId: string;
      severity: UpdateSeverity;
      message?: string;
    }
  | { op: 'full'; severity: UpdateSeverity; message?: string };

export type DocumentRefV2 = {
  sha256: string;
  sizeBytes: number;
};

export type LessonDocumentRefV2 = DocumentRefV2 & {
  moduleId: string;
};

export type ManifestDocumentsV2 = {
  course: DocumentRefV2;
  modules: Record<string, DocumentRefV2>;
  lessons: Record<string, LessonDocumentRefV2>;
};

export type ManifestVersionV2 = {
  version: string;
  releasedAt: string;
  status: string;
  minAppVersion: string;
  notes?: string;
  // How clients take this version. Absent or 'auto': downloaded on the next
  // check like any release. 'opt_in': a fundamentally new course — automatic
  // updates stop below it, and the client offers it instead; accepting
  // downloads the new course and clears the learner's course progress.
  // Unknown future values are treated as opt-in (never auto-download what
  // this build does not understand).
  adoption?: string;
  sourceVersionLabel: string;
  sourceReviewStatus: string;
  publicationAuthorized: boolean;
  instructions: UpdateInstructionV2[];
  documents: ManifestDocumentsV2;
};

export type CourseManifestV2 = {
  schemaVersion: typeof COURSE_SCHEMA_VERSION;
  courseId: string;
  latestVersion: string;
  seedVersion: string;
  versions: ManifestVersionV2[];
};

export type ProgressFallbackV2 = {
  severity: UpdateSeverity;
  message?: string;
};

export type BootstrapResponseV2 = {
  app: {
    minSupportedAppVersion: string;
    latestAppVersion: string;
  };
  course: {
    courseId: string;
    schemaVersion: number;
    latestVersion: string;
    mode: 'none' | 'delta' | 'full';
    pendingVersions: ManifestVersionV2[];
    // Explicit progress policy when the server cannot diff the client's
    // version (mode 'full'); never inferred client-side.
    progressFallback?: ProgressFallbackV2;
  };
};

// ---------------------------------------------------------------------------
// Validation plumbing

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

const contentScope = (
  ctx: Ctx,
  obj: Record<string, unknown>,
): 'universal' | 'state_specific' | undefined => {
  const value = obj.scope;
  if (value === undefined) {
    return undefined;
  }
  if (value !== 'universal' && value !== 'state_specific') {
    ctx.errors.push(`${ctx.path}.scope: expected universal or state_specific`);
    return undefined;
  }
  return value;
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const optColor = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = obj[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    ctx.errors.push(`${ctx.path}.${key}: expected a #rgb or #rrggbb colour`);
    return undefined;
  }
  return value;
};

const CARD_TONES: readonly string[] = ['accent', 'muted', 'trap', 'california'];

const cardTone = (
  ctx: Ctx,
  obj: Record<string, unknown>,
): CardToneV2 | undefined => {
  const value = obj.tone;
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !CARD_TONES.includes(value)) {
    ctx.errors.push(
      `${ctx.path}.tone: expected one of ${CARD_TONES.join(', ')}`,
    );
    return undefined;
  }
  return value as CardToneV2;
};

const num = (ctx: Ctx, obj: Record<string, unknown>, key: string): number => {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    ctx.errors.push(`${ctx.path}.${key}: expected finite number`);
    return 0;
  }
  return value;
};

const bool = (ctx: Ctx, obj: Record<string, unknown>, key: string): boolean => {
  const value = obj[key];
  if (typeof value !== 'boolean') {
    ctx.errors.push(`${ctx.path}.${key}: expected boolean`);
    return false;
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
    value.some(item => typeof item !== 'string' || item.length === 0)
  ) {
    ctx.errors.push(`${ctx.path}.${key}: expected array of non-empty strings`);
    return [];
  }
  return value as string[];
};

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

const uuid = (ctx: Ctx, obj: Record<string, unknown>, key: string): string => {
  const value = str(ctx, obj, key);
  if (value && !UUID_PATTERN.test(value)) {
    ctx.errors.push(`${ctx.path}.${key}: expected lowercase UUID`);
  }
  return value;
};

// ---------------------------------------------------------------------------
// SVG safety

// Embedded SVG is rendered natively by react-native-svg, but content is still
// treated as untrusted: no scripting, no foreignObject, no external fetches.
const SVG_FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: '<script> element', pattern: /<\s*script\b/i },
  { label: '<foreignObject> element', pattern: /<\s*foreignObject\b/i },
  {
    label: 'external http(s) reference',
    pattern: /\b(?:href|src)\s*=\s*["']\s*https?:/i,
  },
  {
    label: 'external xlink reference',
    pattern: /xlink:href\s*=\s*["']\s*https?:/i,
  },
  { label: 'external url() reference', pattern: /url\(\s*["']?\s*https?:/i },
  // eslint-disable-next-line no-script-url -- detection pattern, not a URL
  { label: 'javascript: URI', pattern: /javascript\s*:/i },
  { label: 'inline event handler', pattern: /\bon[a-z]+\s*=/i },
];

export const svgSafetyErrors = (svgXml: string): string[] =>
  SVG_FORBIDDEN.filter(({ pattern }) => pattern.test(svgXml)).map(
    ({ label }) => `forbidden SVG content: ${label}`,
  );

// ---------------------------------------------------------------------------
// Entity validators

const validateChoice = (ctx: Ctx, value: unknown): CourseChoiceV2 | null => {
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

const validateQuestion = (
  ctx: Ctx,
  value: unknown,
): CourseQuestionV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected question object`);
    return null;
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
  const choices: CourseChoiceV2[] = [];
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
    questionId: id(ctx, value, 'questionId'),
    uuid: uuid(ctx, value, 'uuid'),
    kind: kindRaw as CourseQuestionV2['kind'],
    prompt: str(ctx, value, 'prompt'),
    choices,
    correctAnswerId,
    explanation: str(ctx, value, 'explanation'),
    ...(value.assetId !== undefined && { assetId: str(ctx, value, 'assetId') }),
    ...(value.conceptId !== undefined && {
      conceptId: str(ctx, value, 'conceptId'),
    }),
    ...(value.scope !== undefined && { scope: contentScope(ctx, value) }),
  };
};

const validateAsset = (ctx: Ctx, value: unknown): CourseAssetV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected asset object`);
    return null;
  }
  if (value.type !== 'svg') {
    ctx.errors.push(`${ctx.path}.type: expected 'svg'`);
  }
  const sha256 = str(ctx, value, 'sha256');
  if (sha256 && !SHA256_PATTERN.test(sha256)) {
    ctx.errors.push(`${ctx.path}.sha256: expected lowercase sha256 hex`);
  }
  const svgXml = str(ctx, value, 'svgXml');
  for (const error of svgSafetyErrors(svgXml)) {
    ctx.errors.push(`${ctx.path}.svgXml: ${error}`);
  }
  const width = num(ctx, value, 'width');
  const height = num(ctx, value, 'height');
  if (width <= 0 || height <= 0) {
    ctx.errors.push(`${ctx.path}: expected positive width/height`);
  }
  return {
    assetId: id(ctx, value, 'assetId'),
    uuid: uuid(ctx, value, 'uuid'),
    type: 'svg',
    width,
    height,
    alt: str(ctx, value, 'alt'),
    sha256,
    svgXml,
  };
};

const validateCardStyle = (ctx: Ctx, value: unknown): CardStyleV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected card style object`);
    return null;
  }
  return {
    styleId: id(ctx, value, 'styleId'),
    label: str(ctx, value, 'label'),
    icon: str(ctx, value, 'icon'),
    ...(value.tone !== undefined && { tone: cardTone(ctx, value) }),
    ...(value.textColor !== undefined && {
      textColor: optColor(ctx, value, 'textColor'),
    }),
    ...(value.iconColor !== undefined && {
      iconColor: optColor(ctx, value, 'iconColor'),
    }),
  };
};

// A body is edited line by line, so a line may legitimately be empty while it
// is being written. Renderers skip blank prose rather than drawing a gap, and
// authoring tools drop it on save; the format only has to tolerate it.
const looseStr = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): string => {
  const value = obj[key];
  if (typeof value !== 'string') {
    ctx.errors.push(`${ctx.path}.${key}: expected string`);
    return '';
  }
  return value;
};

const looseStrArray = (
  ctx: Ctx,
  obj: Record<string, unknown>,
  key: string,
): string[] => {
  const value = obj[key];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    ctx.errors.push(`${ctx.path}.${key}: expected array of strings`);
    return [];
  }
  return value as string[];
};

const validateElement = (ctx: Ctx, value: unknown): LessonElementV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected content element object`);
    return null;
  }
  const kind = str(ctx, value, 'kind');
  switch (kind) {
    case 'paragraph':
      return { kind: 'paragraph', text: looseStr(ctx, value, 'text') };
    case 'bullets': {
      const items = looseStrArray(ctx, value, 'items');
      if (items.length === 0) {
        ctx.errors.push(`${ctx.path}.items: expected at least one bullet`);
      }
      return { kind: 'bullets', items };
    }
    case 'image':
      return { kind: 'image', assetId: str(ctx, value, 'assetId') };
    default:
      // Unknown element kinds are forward-compatible, like unknown blocks.
      return { kind };
  }
};

const optElements = (
  ctx: Ctx,
  obj: Record<string, unknown>,
): LessonElementV2[] | undefined => {
  const value = obj.content;
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length === 0) {
    ctx.errors.push(`${ctx.path}.content: expected non-empty array`);
    return undefined;
  }
  const elements: LessonElementV2[] = [];
  value.forEach((element, index) => {
    const parsed = validateElement(
      { ...ctx, path: `${ctx.path}.content[${index}]` },
      element,
    );
    if (parsed) {
      elements.push(parsed);
    }
  });
  return elements;
};

// Every authored block may name a slide type; `content` only belongs to the
// families that carry prose.
const optStyleId = (
  ctx: Ctx,
  obj: Record<string, unknown>,
): { styleId?: string } =>
  obj.styleId === undefined ? {} : { styleId: id(ctx, obj, 'styleId') };

// The fields every teaching block shares. `bodyMarkdown` is the flattened
// mirror of `content`, so once a body is authored as elements it is allowed to
// be empty — a card built only from artwork flattens to no prose at all. A
// block with no `content` is still required to say something.
const teachingFields = (
  ctx: Ctx,
  value: Record<string, unknown>,
): {
  title: string;
  bodyMarkdown: string;
  bullets?: string[];
  content?: LessonElementV2[];
  styleId?: string;
  conceptId?: string;
  scope?: 'universal' | 'state_specific';
} => {
  const content =
    value.content === undefined ? undefined : optElements(ctx, value);
  const bodyRaw = value.bodyMarkdown;
  let bodyMarkdown = '';
  if (
    typeof bodyRaw !== 'string' ||
    (bodyRaw.length === 0 && content == null)
  ) {
    ctx.errors.push(`${ctx.path}.bodyMarkdown: expected non-empty string`);
  } else {
    bodyMarkdown = bodyRaw;
  }
  return {
    title: str(ctx, value, 'title'),
    bodyMarkdown,
    ...(value.bullets !== undefined && {
      bullets: optStrArray(ctx, value, 'bullets'),
    }),
    ...(content !== undefined && { content }),
    ...optStyleId(ctx, value),
    ...(value.conceptId !== undefined && {
      conceptId: str(ctx, value, 'conceptId'),
    }),
    ...(value.scope !== undefined && { scope: contentScope(ctx, value) }),
  };
};

const validateBlock = (ctx: Ctx, value: unknown): LessonBlockV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected block object`);
    return null;
  }
  const blockId = id(ctx, value, 'blockId');
  const type = str(ctx, value, 'type');
  if (!isKnownBlockType(type)) {
    // Unknown block types are forward-compatible: keep id+type, render fallback.
    return { blockId, type };
  }
  switch (type) {
    case 'quick_challenge':
      return {
        blockId,
        type,
        title: str(ctx, value, 'title'),
        scenario: str(ctx, value, 'scenario'),
        questionPreview: str(ctx, value, 'questionPreview'),
        questionId: str(ctx, value, 'questionId'),
        ...optStyleId(ctx, value),
      };
    case 'image':
      return {
        blockId,
        type,
        assetId: str(ctx, value, 'assetId'),
        ...optStyleId(ctx, value),
      };
    case 'core_rule':
    case 'visual_example':
    case 'related_rule':
    case 'california_specific':
    case 'state_specific':
    case 'why_it_matters':
    case 'exam_trap':
    case 'remember_this':
      return {
        blockId,
        type,
        ...teachingFields(ctx, value),
        ...(value.checkpointQuestionId !== undefined && {
          checkpointQuestionId: str(ctx, value, 'checkpointQuestionId'),
        }),
      };
    case 'check_yourself': {
      const ruleMarkdown = str(ctx, value, 'ruleMarkdown');
      for (const error of recallGapErrors(ruleMarkdown)) {
        ctx.errors.push(`${ctx.path}.ruleMarkdown: ${error}`);
      }
      return {
        blockId,
        type,
        title: str(ctx, value, 'title'),
        context: str(ctx, value, 'context'),
        ruleMarkdown,
        ...optStyleId(ctx, value),
        ...(value.conceptId !== undefined && {
          conceptId: str(ctx, value, 'conceptId'),
        }),
        ...(value.scope !== undefined && { scope: contentScope(ctx, value) }),
      };
    }
    case 'drive_smarter': {
      if (value.optional !== true) {
        ctx.errors.push(`${ctx.path}.optional: drive_smarter must be optional`);
      }
      return {
        blockId,
        type,
        ...teachingFields(ctx, value),
        optional: true,
      };
    }
  }
};

const validateLesson = (ctx: Ctx, value: unknown): CourseLessonV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected lesson object`);
    return null;
  }
  const blocksRaw = value.blocks;
  const blocks: LessonBlockV2[] = [];
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
    ctx.errors.push(`${ctx.path}.blocks: expected non-empty array`);
  } else {
    blocksRaw.forEach((block, index) => {
      const parsed = validateBlock(
        { ...ctx, path: `${ctx.path}.blocks[${index}]` },
        block,
      );
      if (parsed) {
        blocks.push(parsed);
      }
    });
  }
  let intro: LessonIntroV2 | undefined;
  if (value.intro !== undefined) {
    if (!isRecord(value.intro)) {
      ctx.errors.push(`${ctx.path}.intro: expected object`);
    } else {
      const introCtx: Ctx = { path: `${ctx.path}.intro`, errors: ctx.errors };
      intro = {
        summary: str(introCtx, value.intro, 'summary'),
        keyPoints: strArray(introCtx, value.intro, 'keyPoints'),
        theoryMinutes: num(introCtx, value.intro, 'theoryMinutes'),
        testMinutes: num(introCtx, value.intro, 'testMinutes'),
      };
      if (intro.theoryMinutes <= 0 || intro.testMinutes <= 0) {
        ctx.errors.push(`${ctx.path}.intro: minutes must be positive`);
      }
    }
  }
  return {
    lessonId: id(ctx, value, 'lessonId'),
    uuid: uuid(ctx, value, 'uuid'),
    moduleId: id(ctx, value, 'moduleId'),
    globalSequence: num(ctx, value, 'globalSequence'),
    moduleSequence: num(ctx, value, 'moduleSequence'),
    title: str(ctx, value, 'title'),
    ...(value.conceptId !== undefined && {
      conceptId: str(ctx, value, 'conceptId'),
    }),
    objective: str(ctx, value, 'objective'),
    ...(intro !== undefined && { intro }),
    estimatedMinutes: str(ctx, value, 'estimatedMinutes'),
    format: str(ctx, value, 'format'),
    blocks,
    questionIds: strArray(ctx, value, 'questionIds'),
    ...(value.theoryQuestionIds !== undefined && {
      theoryQuestionIds: strArray(ctx, value, 'theoryQuestionIds'),
    }),
    ...(value.testQuestionIds !== undefined && {
      testQuestionIds: strArray(ctx, value, 'testQuestionIds'),
    }),
    assetIds: strArray(ctx, value, 'assetIds'),
    language: str(ctx, value, 'language'),
  };
};

const validateModuleTest = (
  ctx: Ctx,
  value: unknown,
): CourseModuleTestV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected module test object`);
    return null;
  }
  return {
    testId: id(ctx, value, 'testId'),
    uuid: uuid(ctx, value, 'uuid'),
    moduleId: id(ctx, value, 'moduleId'),
    questionIds: strArray(ctx, value, 'questionIds'),
  };
};

const validateModule = (ctx: Ctx, value: unknown): CourseModuleV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected module object`);
    return null;
  }
  const lessonsRaw = value.lessons;
  const lessons: CourseLessonV2[] = [];
  if (!Array.isArray(lessonsRaw) || lessonsRaw.length === 0) {
    ctx.errors.push(`${ctx.path}.lessons: expected non-empty array`);
  } else {
    lessonsRaw.forEach((lesson, index) => {
      const parsed = validateLesson(
        { ...ctx, path: `${ctx.path}.lessons[${index}]` },
        lesson,
      );
      if (parsed) {
        lessons.push(parsed);
      }
    });
  }
  const moduleTest = validateModuleTest(
    { ...ctx, path: `${ctx.path}.moduleTest` },
    value.moduleTest,
  );
  if (!moduleTest) {
    return null;
  }
  return {
    moduleId: id(ctx, value, 'moduleId'),
    uuid: uuid(ctx, value, 'uuid'),
    sequence: num(ctx, value, 'sequence'),
    title: str(ctx, value, 'title'),
    outcome: str(ctx, value, 'outcome'),
    lessons,
    moduleTest,
  };
};

// ---------------------------------------------------------------------------
// Document validators

type DocExpectations = {
  deliveryVersion?: string;
};

const validateDocEnvelope = (
  ctx: Ctx,
  value: Record<string, unknown>,
  expected: DocExpectations,
): { schemaVersion: typeof COURSE_SCHEMA_VERSION; deliveryVersion: string } => {
  if (value.schemaVersion !== COURSE_SCHEMA_VERSION) {
    ctx.errors.push(
      `${
        ctx.path
      }.schemaVersion: expected ${COURSE_SCHEMA_VERSION}, got ${String(
        value.schemaVersion,
      )}`,
    );
  }
  const deliveryVersion = str(ctx, value, 'deliveryVersion');
  if (deliveryVersion && !SEMVER_PATTERN.test(deliveryVersion)) {
    ctx.errors.push(`${ctx.path}.deliveryVersion: expected x.y.z semver`);
  }
  if (
    expected.deliveryVersion !== undefined &&
    deliveryVersion !== expected.deliveryVersion
  ) {
    ctx.errors.push(
      `${ctx.path}.deliveryVersion: expected ${expected.deliveryVersion}, got ${deliveryVersion}`,
    );
  }
  return { schemaVersion: COURSE_SCHEMA_VERSION, deliveryVersion };
};

export const validateCourseDocV2 = (
  input: unknown,
  expected: DocExpectations = {},
): ValidationResult<CourseDocV2> => {
  if (!isRecord(input)) {
    return fail(['course doc: expected object']);
  }
  const ctx: Ctx = { path: 'courseDoc', errors: [] };
  const envelope = validateDocEnvelope(ctx, input, expected);
  const courseRaw = input.course;
  if (!isRecord(courseRaw)) {
    ctx.errors.push('courseDoc.course: expected object');
    return fail(ctx.errors);
  }
  const courseCtx: Ctx = { path: 'courseDoc.course', errors: ctx.errors };
  let cardStyles: CardStyleV2[] | undefined;
  if (courseRaw.cardStyles !== undefined) {
    if (!Array.isArray(courseRaw.cardStyles)) {
      ctx.errors.push('courseDoc.course.cardStyles: expected array');
    } else {
      cardStyles = [];
      courseRaw.cardStyles.forEach((style, index) => {
        const parsed = validateCardStyle(
          { path: `courseDoc.course.cardStyles[${index}]`, errors: ctx.errors },
          style,
        );
        if (parsed) {
          cardStyles!.push(parsed);
        }
      });
      const styleIds = cardStyles.map(style => style.styleId);
      if (new Set(styleIds).size !== styleIds.length) {
        ctx.errors.push('courseDoc.course.cardStyles: duplicate style ids');
      }
    }
  }
  const course: CourseInfoV2 = {
    courseId: id(courseCtx, courseRaw, 'courseId'),
    title: str(courseCtx, courseRaw, 'title'),
    subtitle: str(courseCtx, courseRaw, 'subtitle'),
    jurisdiction: str(courseCtx, courseRaw, 'jurisdiction'),
    state: str(courseCtx, courseRaw, 'state'),
    language: str(courseCtx, courseRaw, 'language'),
    targetLicense: str(courseCtx, courseRaw, 'targetLicense'),
    moduleIds: strArray(courseCtx, courseRaw, 'moduleIds'),
    ...(cardStyles !== undefined && { cardStyles }),
    sourceVersionLabel: str(courseCtx, courseRaw, 'sourceVersionLabel'),
    sourceContentHash: str(courseCtx, courseRaw, 'sourceContentHash'),
    sourceCheckedAt: str(courseCtx, courseRaw, 'sourceCheckedAt'),
    sourceReviewStatus: str(courseCtx, courseRaw, 'sourceReviewStatus'),
    publicationAuthorized: bool(courseCtx, courseRaw, 'publicationAuthorized'),
  };
  if (new Set(course.moduleIds).size !== course.moduleIds.length) {
    ctx.errors.push('courseDoc.course.moduleIds: duplicate module ids');
  }
  if (ctx.errors.length > 0) {
    return fail(ctx.errors);
  }
  return pass({ ...envelope, course });
};

// Integrity rules shared by module and lesson docs: every reference resolves
// inside the doc, and the doc carries nothing that is not referenced.
const checkDocQuestionAssetIntegrity = (
  ctx: Ctx,
  options: {
    lessons: CourseLessonV2[];
    extraQuestionIds?: string[];
    questions: CourseQuestionV2[];
    assets: CourseAssetV2[];
  },
): void => {
  const questionsById = new Map(
    options.questions.map(question => [question.questionId, question]),
  );
  const assetsById = new Map(
    options.assets.map(asset => [asset.assetId, asset]),
  );
  if (questionsById.size !== options.questions.length) {
    ctx.errors.push(`${ctx.path}.questions: duplicate question ids`);
  }
  if (assetsById.size !== options.assets.length) {
    ctx.errors.push(`${ctx.path}.assets: duplicate asset ids`);
  }
  const referencedQuestions = new Set<string>();
  const referencedAssets = new Set<string>();
  for (const lesson of options.lessons) {
    for (const questionId of lesson.questionIds) {
      referencedQuestions.add(questionId);
      if (!questionsById.has(questionId)) {
        ctx.errors.push(
          `${ctx.path}: lesson ${lesson.lessonId} references missing question ${questionId}`,
        );
      }
    }
    for (const assetId of lesson.assetIds) {
      referencedAssets.add(assetId);
      if (!assetsById.has(assetId)) {
        ctx.errors.push(
          `${ctx.path}: lesson ${lesson.lessonId} references missing asset ${assetId}`,
        );
      }
    }
    for (const block of lesson.blocks) {
      if (isQuickChallengeBlock(block)) {
        if (!lesson.questionIds.includes(block.questionId)) {
          ctx.errors.push(
            `${ctx.path}: block ${block.blockId} references question ${block.questionId} outside lesson.questionIds`,
          );
        }
      } else if (!isImageBlock(block)) {
        const checkpointId = checkpointQuestionIdOf(block);
        if (
          checkpointId != null &&
          !lesson.questionIds.includes(checkpointId)
        ) {
          ctx.errors.push(
            `${ctx.path}: block ${block.blockId} references question ${checkpointId} outside lesson.questionIds`,
          );
        }
      }
      // An `image` block's asset and every inline image element alike.
      for (const assetId of blockAssetIds(block)) {
        if (!lesson.assetIds.includes(assetId)) {
          ctx.errors.push(
            `${ctx.path}: block ${block.blockId} references asset ${assetId} outside lesson.assetIds`,
          );
        }
      }
    }
    const inlineQuestionIds = lesson.blocks.flatMap(block => {
      if (isQuickChallengeBlock(block)) {
        return [block.questionId];
      }
      const checkpointId = checkpointQuestionIdOf(block);
      return checkpointId != null ? [checkpointId] : [];
    });
    for (const theoryQuestionId of lesson.theoryQuestionIds ?? []) {
      if (!lesson.questionIds.includes(theoryQuestionId)) {
        ctx.errors.push(
          `${ctx.path}: theory question ${theoryQuestionId} is outside lesson.questionIds`,
        );
      }
      if (!inlineQuestionIds.includes(theoryQuestionId)) {
        ctx.errors.push(
          `${ctx.path}: theory question ${theoryQuestionId} is not referenced by a theory block`,
        );
      }
    }
    for (const testQuestionId of lesson.testQuestionIds ?? []) {
      if (!lesson.questionIds.includes(testQuestionId)) {
        ctx.errors.push(
          `${ctx.path}: test question ${testQuestionId} is outside lesson.questionIds`,
        );
      }
      if ((lesson.theoryQuestionIds ?? []).includes(testQuestionId)) {
        ctx.errors.push(
          `${ctx.path}: question ${testQuestionId} cannot be both theory and test`,
        );
      }
    }
    for (const questionId of lesson.questionIds) {
      if (
        lesson.testQuestionIds == null &&
        lesson.format !== 'intro_slides_test' &&
        !inlineQuestionIds.includes(questionId)
      ) {
        ctx.errors.push(
          `${ctx.path}: lesson ${lesson.lessonId} question ${questionId} is not referenced by any block`,
        );
      }
    }
  }
  for (const questionId of options.extraQuestionIds ?? []) {
    referencedQuestions.add(questionId);
    if (!questionsById.has(questionId)) {
      ctx.errors.push(
        `${ctx.path}: module test references missing question ${questionId}`,
      );
    }
  }
  for (const question of options.questions) {
    if (!referencedQuestions.has(question.questionId)) {
      ctx.errors.push(
        `${ctx.path}.questions: unreferenced question ${question.questionId}`,
      );
    }
    if (question.assetId !== undefined && !assetsById.has(question.assetId)) {
      ctx.errors.push(
        `${ctx.path}: question ${question.questionId} references missing asset ${question.assetId}`,
      );
    }
    if (question.assetId !== undefined) {
      referencedAssets.add(question.assetId);
    }
  }
  for (const asset of options.assets) {
    if (!referencedAssets.has(asset.assetId)) {
      ctx.errors.push(
        `${ctx.path}.assets: unreferenced asset ${asset.assetId}`,
      );
    }
  }
};

export const validateModuleDocV2 = (
  input: unknown,
  expected: DocExpectations = {},
): ValidationResult<ModuleDocV2> => {
  if (!isRecord(input)) {
    return fail(['module doc: expected object']);
  }
  const ctx: Ctx = { path: 'moduleDoc', errors: [] };
  const envelope = validateDocEnvelope(ctx, input, expected);
  const module = validateModule(
    { ...ctx, path: 'moduleDoc.module' },
    input.module,
  );
  const questionsRaw = input.questions;
  const assetsRaw = input.assets;
  const questions: CourseQuestionV2[] = [];
  const assets: CourseAssetV2[] = [];
  if (!Array.isArray(questionsRaw)) {
    ctx.errors.push('moduleDoc.questions: expected array');
  } else {
    questionsRaw.forEach((question, index) => {
      const parsed = validateQuestion(
        { ...ctx, path: `moduleDoc.questions[${index}]` },
        question,
      );
      if (parsed) {
        questions.push(parsed);
      }
    });
  }
  if (!Array.isArray(assetsRaw)) {
    ctx.errors.push('moduleDoc.assets: expected array');
  } else {
    assetsRaw.forEach((asset, index) => {
      const parsed = validateAsset(
        { ...ctx, path: `moduleDoc.assets[${index}]` },
        asset,
      );
      if (parsed) {
        assets.push(parsed);
      }
    });
  }
  if (!module) {
    return fail(ctx.errors);
  }
  for (const lesson of module.lessons) {
    if (lesson.moduleId !== module.moduleId) {
      ctx.errors.push(
        `moduleDoc: lesson ${lesson.lessonId} belongs to ${lesson.moduleId}, not ${module.moduleId}`,
      );
    }
  }
  const lessonIds = module.lessons.map(lesson => lesson.lessonId);
  if (new Set(lessonIds).size !== lessonIds.length) {
    ctx.errors.push('moduleDoc: duplicate lesson ids');
  }
  if (module.moduleTest.moduleId !== module.moduleId) {
    ctx.errors.push('moduleDoc: moduleTest.moduleId mismatch');
  }
  checkDocQuestionAssetIntegrity(ctx, {
    lessons: module.lessons,
    extraQuestionIds: module.moduleTest.questionIds,
    questions,
    assets,
  });
  if (ctx.errors.length > 0) {
    return fail(ctx.errors);
  }
  return pass({ ...envelope, module, questions, assets });
};

export const validateLessonDocV2 = (
  input: unknown,
  expected: DocExpectations = {},
): ValidationResult<LessonDocV2> => {
  if (!isRecord(input)) {
    return fail(['lesson doc: expected object']);
  }
  const ctx: Ctx = { path: 'lessonDoc', errors: [] };
  const envelope = validateDocEnvelope(ctx, input, expected);
  const lesson = validateLesson(
    { ...ctx, path: 'lessonDoc.lesson' },
    input.lesson,
  );
  const questions: CourseQuestionV2[] = [];
  const assets: CourseAssetV2[] = [];
  if (!Array.isArray(input.questions)) {
    ctx.errors.push('lessonDoc.questions: expected array');
  } else {
    input.questions.forEach((question, index) => {
      const parsed = validateQuestion(
        { ...ctx, path: `lessonDoc.questions[${index}]` },
        question,
      );
      if (parsed) {
        questions.push(parsed);
      }
    });
  }
  if (!Array.isArray(input.assets)) {
    ctx.errors.push('lessonDoc.assets: expected array');
  } else {
    input.assets.forEach((asset, index) => {
      const parsed = validateAsset(
        { ...ctx, path: `lessonDoc.assets[${index}]` },
        asset,
      );
      if (parsed) {
        assets.push(parsed);
      }
    });
  }
  if (!lesson) {
    return fail(ctx.errors);
  }
  checkDocQuestionAssetIntegrity(ctx, {
    lessons: [lesson],
    questions,
    assets,
  });
  if (ctx.errors.length > 0) {
    return fail(ctx.errors);
  }
  return pass({ ...envelope, lesson, questions, assets });
};

// ---------------------------------------------------------------------------
// Manifest validators (used by the client on bootstrap payloads)

const validateInstruction = (
  ctx: Ctx,
  value: unknown,
): UpdateInstructionV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected instruction object`);
    return null;
  }
  const severity = str(ctx, value, 'severity');
  if (severity !== 'hard' && severity !== 'optional' && severity !== 'soft') {
    ctx.errors.push(`${ctx.path}.severity: unknown severity ${severity}`);
    return null;
  }
  const message = optStr(ctx, value, 'message');
  const op = str(ctx, value, 'op');
  switch (op) {
    case 'lesson-content':
    case 'lesson-questions':
      return {
        op,
        lessonId: str(ctx, value, 'lessonId'),
        severity,
        ...(message !== undefined && { message }),
      };
    case 'question':
      return {
        op,
        questionId: str(ctx, value, 'questionId'),
        ...(value.lessonId !== undefined && {
          lessonId: str(ctx, value, 'lessonId'),
        }),
        ...(value.moduleId !== undefined && {
          moduleId: str(ctx, value, 'moduleId'),
        }),
        severity,
        ...(message !== undefined && { message }),
      };
    case 'module':
      return {
        op,
        moduleId: str(ctx, value, 'moduleId'),
        severity,
        ...(message !== undefined && { message }),
      };
    case 'full':
      return { op, severity, ...(message !== undefined && { message }) };
    default:
      ctx.errors.push(`${ctx.path}.op: unknown op ${op}`);
      return null;
  }
};

const validateDocumentRef = (
  ctx: Ctx,
  value: unknown,
): DocumentRefV2 | null => {
  if (!isRecord(value)) {
    ctx.errors.push(`${ctx.path}: expected document ref`);
    return null;
  }
  const sha256 = str(ctx, value, 'sha256');
  if (sha256 && !SHA256_PATTERN.test(sha256)) {
    ctx.errors.push(`${ctx.path}.sha256: expected lowercase sha256 hex`);
  }
  const sizeBytes = num(ctx, value, 'sizeBytes');
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    ctx.errors.push(`${ctx.path}.sizeBytes: expected positive integer`);
  }
  return { sha256, sizeBytes };
};

export const validateManifestVersionV2 = (
  input: unknown,
): ValidationResult<ManifestVersionV2> => {
  if (!isRecord(input)) {
    return fail(['manifest version: expected object']);
  }
  const ctx: Ctx = { path: 'manifestVersion', errors: [] };
  const version = str(ctx, input, 'version');
  if (version && !SEMVER_PATTERN.test(version)) {
    ctx.errors.push('manifestVersion.version: expected x.y.z semver');
  }
  const minAppVersion = str(ctx, input, 'minAppVersion');
  if (minAppVersion && !SEMVER_PATTERN.test(minAppVersion)) {
    ctx.errors.push('manifestVersion.minAppVersion: expected x.y.z semver');
  }
  const instructions: UpdateInstructionV2[] = [];
  if (!Array.isArray(input.instructions)) {
    ctx.errors.push('manifestVersion.instructions: expected array');
  } else {
    input.instructions.forEach((instruction, index) => {
      const parsed = validateInstruction(
        { ...ctx, path: `manifestVersion.instructions[${index}]` },
        instruction,
      );
      if (parsed) {
        instructions.push(parsed);
      }
    });
  }
  const documentsRaw = input.documents;
  if (!isRecord(documentsRaw)) {
    ctx.errors.push('manifestVersion.documents: expected object');
    return fail(ctx.errors);
  }
  const course = validateDocumentRef(
    { ...ctx, path: 'manifestVersion.documents.course' },
    documentsRaw.course,
  );
  const modules: Record<string, DocumentRefV2> = {};
  const lessons: Record<string, LessonDocumentRefV2> = {};
  if (!isRecord(documentsRaw.modules)) {
    ctx.errors.push('manifestVersion.documents.modules: expected object');
  } else {
    for (const [moduleId, ref] of Object.entries(documentsRaw.modules)) {
      const parsed = validateDocumentRef(
        { ...ctx, path: `manifestVersion.documents.modules.${moduleId}` },
        ref,
      );
      if (parsed) {
        modules[moduleId] = parsed;
      }
    }
  }
  if (!isRecord(documentsRaw.lessons)) {
    ctx.errors.push('manifestVersion.documents.lessons: expected object');
  } else {
    for (const [lessonId, refRaw] of Object.entries(documentsRaw.lessons)) {
      const refCtx: Ctx = {
        ...ctx,
        path: `manifestVersion.documents.lessons.${lessonId}`,
      };
      const parsed = validateDocumentRef(refCtx, refRaw);
      if (parsed && isRecord(refRaw)) {
        const moduleId = str(refCtx, refRaw, 'moduleId');
        if (moduleId && !(moduleId in modules)) {
          ctx.errors.push(
            `manifestVersion.documents.lessons.${lessonId}: unknown moduleId ${moduleId}`,
          );
        }
        lessons[lessonId] = { ...parsed, moduleId };
      }
    }
  }
  if (!course || ctx.errors.length > 0) {
    return fail(ctx.errors);
  }
  return pass({
    version,
    releasedAt: str(ctx, input, 'releasedAt'),
    status: str(ctx, input, 'status'),
    minAppVersion,
    ...(input.notes !== undefined && { notes: str(ctx, input, 'notes') }),
    ...(input.adoption !== undefined && {
      adoption: str(ctx, input, 'adoption'),
    }),
    sourceVersionLabel: str(ctx, input, 'sourceVersionLabel'),
    sourceReviewStatus: str(ctx, input, 'sourceReviewStatus'),
    publicationAuthorized: bool(ctx, input, 'publicationAuthorized'),
    instructions,
    documents: { course, modules, lessons },
  });
};

export const validateBootstrapResponseV2 = (
  input: unknown,
): ValidationResult<BootstrapResponseV2> => {
  if (!isRecord(input)) {
    return fail(['bootstrap: expected object']);
  }
  const ctx: Ctx = { path: 'bootstrap', errors: [] };
  const appRaw = input.app;
  const courseRaw = input.course;
  if (!isRecord(appRaw) || !isRecord(courseRaw)) {
    return fail(['bootstrap: expected app and course objects']);
  }
  const appCtx: Ctx = { path: 'bootstrap.app', errors: ctx.errors };
  const app = {
    minSupportedAppVersion: str(appCtx, appRaw, 'minSupportedAppVersion'),
    latestAppVersion: str(appCtx, appRaw, 'latestAppVersion'),
  };
  const courseCtx: Ctx = { path: 'bootstrap.course', errors: ctx.errors };
  const mode = str(courseCtx, courseRaw, 'mode');
  if (mode !== 'none' && mode !== 'delta' && mode !== 'full') {
    ctx.errors.push(`bootstrap.course.mode: unknown mode ${mode}`);
  }
  const pendingVersions: ManifestVersionV2[] = [];
  if (!Array.isArray(courseRaw.pendingVersions)) {
    ctx.errors.push('bootstrap.course.pendingVersions: expected array');
  } else {
    courseRaw.pendingVersions.forEach((entry, index) => {
      const parsed = validateManifestVersionV2(entry);
      if (parsed.ok) {
        pendingVersions.push(parsed.value);
      } else {
        ctx.errors.push(
          ...parsed.errors.map(
            error => `bootstrap.course.pendingVersions[${index}]: ${error}`,
          ),
        );
      }
    });
  }
  let progressFallback: ProgressFallbackV2 | undefined;
  if (courseRaw.progressFallback !== undefined) {
    if (!isRecord(courseRaw.progressFallback)) {
      ctx.errors.push('bootstrap.course.progressFallback: expected object');
    } else {
      const fallbackCtx: Ctx = {
        path: 'bootstrap.course.progressFallback',
        errors: ctx.errors,
      };
      const severity = str(fallbackCtx, courseRaw.progressFallback, 'severity');
      if (
        severity !== 'hard' &&
        severity !== 'optional' &&
        severity !== 'soft'
      ) {
        ctx.errors.push(
          `bootstrap.course.progressFallback.severity: unknown severity ${severity}`,
        );
      } else {
        const message = optStr(
          fallbackCtx,
          courseRaw.progressFallback,
          'message',
        );
        progressFallback = {
          severity,
          ...(message !== undefined && { message }),
        };
      }
    }
  }
  if (mode === 'full' && progressFallback === undefined) {
    ctx.errors.push(
      'bootstrap.course: mode full requires an explicit progressFallback',
    );
  }
  if (ctx.errors.length > 0) {
    return fail(ctx.errors);
  }
  return pass({
    app,
    course: {
      courseId: str(courseCtx, courseRaw, 'courseId'),
      schemaVersion: num(courseCtx, courseRaw, 'schemaVersion'),
      latestVersion: str(courseCtx, courseRaw, 'latestVersion'),
      mode: mode as 'none' | 'delta' | 'full',
      pendingVersions,
      ...(progressFallback !== undefined && { progressFallback }),
    },
  });
};
