// Pure library behind `npm run course:import-v2` (scripts/import-course-v2.ts)
// and the jest suite. Reads a dmv-course-package-v1 handoff snapshot (the
// 8-module scenario-first card format), verifies it, maps source ids onto the
// stable runtime id scheme, and produces the v2 wire documents plus manifest
// and audit artifacts. Never mutates the source package.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type {
  CourseAssetV2,
  CourseDocV2,
  CourseLessonV2,
  CourseModuleTestV2,
  CourseQuestionV2,
  LessonBlockV2,
  LessonDocV2,
  ManifestVersionV2,
  ModuleDocV2,
  UpdateInstructionV2,
} from '../src/data/course/v2/wire.ts';
import {
  COURSE_SCHEMA_VERSION,
  MAX_ID_LENGTH,
  svgSafetyErrors,
  validateCourseDocV2,
  validateLessonDocV2,
  validateModuleDocV2,
} from '../src/data/course/v2/wire.ts';
import { isVersionBelow } from '../src/data/course/semver.ts';

type Json = any;

// ---------------------------------------------------------------------------
// Stable identity
//
// Runtime ids must survive content regenerations, so they are curated by hand
// instead of being derived from source ids (which embed the generation date)
// or titles (which reviewers may rewrite). A new module/lesson in a future
// package MUST be added here explicitly; the importer refuses to guess.

export const STABLE_COURSE_ID = 'ca-class-c';

// UUID v5 namespace for every runtime uuid. Fixed forever: changing it would
// re-key every entity and orphan all progress.
export const STABLE_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export const MODULE_SLUGS: Record<string, string> = {
  'ca-2026-08-10-r01-m01': 'ca-read-the-road',
  'ca-2026-08-10-r01-m02': 'ca-intersections-right-of-way',
  'ca-2026-08-10-r01-m03': 'ca-lanes-passing-freeways',
  'ca-2026-08-10-r01-m04': 'ca-speed-space-parking',
  'ca-2026-08-10-r01-m05': 'ca-sharing-the-road',
  'ca-2026-08-10-r01-m06': 'ca-staying-in-control',
  'ca-2026-08-10-r01-m07': 'ca-vehicle-safety-collisions',
  'ca-2026-08-10-r01-m08': 'ca-finish-line',
};

export const LESSON_SLUGS: Record<string, string> = {
  'ca-2026-08-10-r01-m01-l01': 'ca-sign-shapes-and-colors',
  'ca-2026-08-10-r01-m01-l02': 'ca-regulatory-signs',
  'ca-2026-08-10-r01-m01-l03': 'ca-warning-and-guide-signs',
  'ca-2026-08-10-r01-m01-l04': 'ca-traffic-signals',
  'ca-2026-08-10-r01-m01-l05': 'ca-road-markings-and-curbs',
  'ca-2026-08-10-r01-m02-l01': 'ca-uncontrolled-intersections',
  'ca-2026-08-10-r01-m02-l02': 'ca-stop-yield-entering-traffic',
  'ca-2026-08-10-r01-m02-l03': 'ca-turns-and-signals',
  'ca-2026-08-10-r01-m02-l04': 'ca-u-turns-starting-backing',
  'ca-2026-08-10-r01-m02-l05': 'ca-crosswalks-and-roundabouts',
  'ca-2026-08-10-r01-m03-l01': 'ca-choosing-changing-lanes',
  'ca-2026-08-10-r01-m03-l02': 'ca-passing-rules',
  'ca-2026-08-10-r01-m03-l03': 'ca-freeway-merging',
  'ca-2026-08-10-r01-m03-l04': 'ca-special-lanes',
  'ca-2026-08-10-r01-m04-l01': 'ca-speed-laws',
  'ca-2026-08-10-r01-m04-l02': 'ca-following-distance-scanning',
  'ca-2026-08-10-r01-m04-l03': 'ca-parking-and-curbs',
  'ca-2026-08-10-r01-m05-l01': 'ca-bicycles-motorcycles',
  'ca-2026-08-10-r01-m05-l02': 'ca-trucks-buses-slow-vehicles',
  'ca-2026-08-10-r01-m05-l03': 'ca-emergency-school-work-zones',
  'ca-2026-08-10-r01-m06-l01': 'ca-night-weather-visibility',
  'ca-2026-08-10-r01-m06-l02': 'ca-skids-and-emergencies',
  'ca-2026-08-10-r01-m06-l03': 'ca-distraction-and-fatigue',
  'ca-2026-08-10-r01-m06-l04': 'ca-alcohol-drugs-dui',
  'ca-2026-08-10-r01-m07-l01': 'ca-seat-belts-child-safety',
  'ca-2026-08-10-r01-m07-l02': 'ca-equipment-loads-towing',
  'ca-2026-08-10-r01-m07-l03': 'ca-crashes-and-insurance',
  'ca-2026-08-10-r01-m08-l01': 'ca-permits-provisional-licenses',
  'ca-2026-08-10-r01-m08-l02': 'ca-licenses-and-registration',
  'ca-2026-08-10-r01-m08-l03': 'ca-penalties-and-points',
};

const ordinal = (index: number): string => String(index + 1).padStart(2, '0');

const uuidToBytes = (value: string): Buffer =>
  Buffer.from(value.replace(/-/g, ''), 'hex');

/* eslint-disable no-bitwise */

export const uuidV5 = (name: string, namespace: string): string => {
  const hash = createHash('sha1')
    .update(uuidToBytes(namespace))
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
};
/* eslint-enable no-bitwise */

export const stableUuid = (
  stableId: string,
  courseId: string = STABLE_COURSE_ID,
): string => uuidV5(`dmv-prep:${courseId}:${stableId}`, STABLE_UUID_NAMESPACE);

// ---------------------------------------------------------------------------
// Serialization / hashing

export const serializeJson = (value: unknown): string =>
  JSON.stringify(value, null, 2) + '\n';

export const sha256Hex = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');

export const utf8Size = (value: string): number =>
  Buffer.byteLength(value, 'utf8');

// ---------------------------------------------------------------------------
// Source package loading

export type SourceLesson = Json;
export type SourceModule = Json;

// 'ca-v1': the original CA handoff (dmv-course-package-v1) whose source ids
// embed the generation date and need the curated slug tables above.
// 'state-v2': the newer per-state packages (state-driver-course-version)
// whose source ids are already the stable slugs, with a whole-file manifest.
export type PackageFormat = 'ca-v1' | 'state-v2';

export type SourcePackage = {
  dir: string;
  format: PackageFormat;
  // The stable runtime course id ('ca-class-c', 'fl-class-e', 'tx-class-c').
  courseId: string;
  manifest: Json;
  course: Json;
  modules: SourceModule[];
  lessons: SourceLesson[];
  questions: Json[];
  moduleTests: Json[];
  assetsIndex: Json;
  finalValidation: Json;
};

const readJson = (path: string): Json => JSON.parse(readFileSync(path, 'utf8'));

export const loadSourcePackage = (dir: string): SourcePackage => {
  const manifest = readJson(join(dir, 'manifest.json'));
  const course = readJson(join(dir, 'course.json'));
  const format: PackageFormat =
    manifest.packageFormat === 'dmv-course-package-v1' ? 'ca-v1' : 'state-v2';
  const modules = course.modules.map((ref: Json) =>
    readJson(join(dir, ref.path)),
  );
  const lessons = modules.flatMap((module: Json) =>
    module.lessons.map((ref: Json) => readJson(join(dir, ref.path))),
  );
  return {
    dir,
    format,
    courseId: format === 'ca-v1' ? STABLE_COURSE_ID : course.courseId,
    manifest,
    course,
    modules,
    lessons,
    questions: readJson(join(dir, 'questions.json')).questions,
    moduleTests: readJson(join(dir, 'module-tests.json')).tests,
    assetsIndex: readJson(join(dir, 'assets', 'index.json')),
    finalValidation: readJson(join(dir, 'reports', 'final-validation.json')),
  };
};

// ---------------------------------------------------------------------------
// Source verification (read-only, §"Перевір source package")

export type SourceCheckResult = {
  errors: string[];
  warnings: string[];
  hashedFileCount: number;
  svgCount: number;
};

const EXPECTED_COUNTS: Record<string, number> = {
  modules: 8,
  lessons: 30,
  questions: 150,
  moduleTests: 8,
  evidenceCards: 30,
  rules: 135,
};

// Three illustrations per lesson, 30 lessons. Questions carry an assetId too:
// most reuse their lesson's illustrations, but an illustrated question owns a
// dedicated SVG on top of these — so the package total is 90 + however many
// dedicated question assets the release ships.
const EXPECTED_LESSON_ASSETS = 90;

// Asset ids owned by a question rather than shared with its lesson.
export const dedicatedQuestionAssetIds = (pkg: SourcePackage): Set<string> => {
  const lessonAssetIds = new Set<string>(
    pkg.lessons.flatMap((lesson: Json) => lesson.assetIds as string[]),
  );
  return new Set(
    pkg.questions
      .map((question: Json) => question.assetId as string | undefined)
      .filter(
        (assetId): assetId is string =>
          assetId !== undefined && !lessonAssetIds.has(assetId),
      ),
  );
};

export type VerifyOptions = {
  // The package's own QA report (reports/final-validation.json) pins the
  // contentHash it was produced from. A re-packaged delivery that regenerates
  // content without re-running QA leaves the two out of step, which means the
  // new bytes never passed the package's automated gate. That is an error by
  // default; the importer only proceeds when the operator opts in explicitly,
  // and the exception is recorded in the release audit trail.
  allowStaleValidationReport?: boolean;
};

export const verifySourcePackage = (
  pkg: SourcePackage,
  options: VerifyOptions = {},
): SourceCheckResult => {
  if (pkg.format === 'state-v2') {
    return verifyStatePackage(pkg, options);
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  const { manifest, dir } = pkg;

  if (manifest.packageFormat !== 'dmv-course-package-v1') {
    errors.push(`unexpected packageFormat: ${manifest.packageFormat}`);
  }
  if (manifest.status !== 'draft_generated_human_review_required') {
    errors.push(`unexpected manifest status: ${manifest.status}`);
  }
  if (manifest.publicationAuthorized !== false) {
    errors.push('manifest.publicationAuthorized must be false');
  }

  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (manifest.counts?.[key] !== expected) {
      errors.push(
        `manifest count ${key}: expected ${expected}, got ${manifest.counts?.[key]}`,
      );
    }
  }

  // Every hashed file must exist. The package does not document a formula to
  // recompute manifest.contentHash from delivered bytes, so integrity rests on
  // the per-file asset hashes plus cross-report consistency (checked below).
  for (const rel of manifest.hashedFiles as string[]) {
    if (!existsSync(join(dir, rel))) {
      errors.push(`missing hashedFile: ${rel}`);
    }
  }

  const finalValidation = pkg.finalValidation;
  if (finalValidation.status !== 'automated_qa_passed_human_reviews_required') {
    errors.push(`final-validation status: ${finalValidation.status}`);
  }
  if (
    (finalValidation.failures ?? []).length > 0 ||
    (finalValidation.warnings ?? []).length > 0
  ) {
    errors.push(
      `final-validation reports failures/warnings: ${JSON.stringify({
        failures: finalValidation.failures,
        warnings: finalValidation.warnings,
      })}`,
    );
  }
  if (finalValidation.contentHash !== manifest.contentHash) {
    const message =
      'final-validation contentHash differs from manifest contentHash: the QA report was produced from different bytes than this package ships, so the delivered content did not pass the package QA gate';
    if (options.allowStaleValidationReport) {
      warnings.push(
        `${message} (accepted via --allow-stale-validation-report)`,
      );
    } else {
      errors.push(message);
    }
  }

  // SVG bytes vs the documented per-file hashes. With no usable manifest
  // contentHash these per-file hashes are the integrity anchor, so the index
  // must be complete: every entry present and matching, and no stray SVG on
  // disk that the index does not describe.
  let svgCount = 0;
  for (const asset of pkg.assetsIndex.assets as Json[]) {
    const path = join(dir, asset.path);
    if (!existsSync(path)) {
      errors.push(`missing asset file: ${asset.path}`);
      continue;
    }
    const actual = sha256Hex(readFileSync(path));
    if (actual !== asset.sha256) {
      errors.push(`asset hash mismatch: ${asset.assetId}`);
    }
    svgCount += 1;
  }

  const dedicatedQuestionAssets = dedicatedQuestionAssetIds(pkg);
  const expectedAssets = EXPECTED_LESSON_ASSETS + dedicatedQuestionAssets.size;
  if (svgCount !== expectedAssets) {
    errors.push(
      `expected ${expectedAssets} assets (${EXPECTED_LESSON_ASSETS} lesson + ${dedicatedQuestionAssets.size} dedicated question), found ${svgCount}`,
    );
  }
  const indexedSvgFiles = new Set(
    (pkg.assetsIndex.assets as Json[]).map(asset => asset.path as string),
  );
  for (const file of readdirSync(join(dir, 'assets'))) {
    if (file.endsWith('.svg') && !indexedSvgFiles.has(`assets/${file}`)) {
      errors.push(`asset file not described by assets/index.json: ${file}`);
    }
  }
  // A re-packaged delivery can leave manifest.counts behind; the index is
  // authoritative because it is what the per-file hashes cover.
  if (manifest.counts?.assets !== expectedAssets) {
    warnings.push(
      `manifest count assets: says ${manifest.counts?.assets}, package ships ${expectedAssets}`,
    );
  }

  // Structural counts.
  if (pkg.modules.length !== 8) {
    errors.push(`expected 8 modules, found ${pkg.modules.length}`);
  }
  if (pkg.lessons.length !== 30) {
    errors.push(`expected 30 lessons, found ${pkg.lessons.length}`);
  }
  if (pkg.questions.length !== 150) {
    errors.push(`expected 150 questions, found ${pkg.questions.length}`);
  }
  if (pkg.moduleTests.length !== 8) {
    errors.push(`expected 8 module tests, found ${pkg.moduleTests.length}`);
  }

  const questionIds = new Set(
    pkg.questions.map((question: Json) => question.questionId),
  );
  const assetIds = new Set(
    (pkg.assetsIndex.assets as Json[]).map(asset => asset.assetId),
  );

  for (const lesson of pkg.lessons) {
    if (lesson.blocks.length !== 12) {
      errors.push(
        `${lesson.lessonId}: expected 12 blocks, got ${lesson.blocks.length}`,
      );
    }
    if (lesson.questionIds.length !== 5) {
      errors.push(
        `${lesson.lessonId}: expected 5 question refs, got ${lesson.questionIds.length}`,
      );
    }
    if (lesson.assetIds.length !== 3) {
      errors.push(
        `${lesson.lessonId}: expected 3 asset refs, got ${lesson.assetIds.length}`,
      );
    }
    for (const questionId of lesson.questionIds) {
      if (!questionIds.has(questionId)) {
        errors.push(`${lesson.lessonId}: unknown question ${questionId}`);
      }
    }
    for (const assetId of lesson.assetIds) {
      if (!assetIds.has(assetId)) {
        errors.push(`${lesson.lessonId}: unknown asset ${assetId}`);
      }
    }
  }

  for (const question of pkg.questions) {
    if (question.assetId !== undefined && !assetIds.has(question.assetId)) {
      errors.push(`${question.questionId}: unknown asset ${question.assetId}`);
    }
  }

  let testRefTotal = 0;
  for (const test of pkg.moduleTests) {
    if (test.questionIds.length !== 10) {
      errors.push(
        `${test.testId}: expected 10 question refs, got ${test.questionIds.length}`,
      );
    }
    testRefTotal += test.questionIds.length;
    for (const questionId of test.questionIds) {
      if (!questionIds.has(questionId)) {
        errors.push(`${test.testId}: unknown question ${questionId}`);
      }
    }
  }
  if (testRefTotal !== 80) {
    errors.push(`expected 80 module-test question refs, found ${testRefTotal}`);
  }

  for (const question of pkg.questions) {
    if (question.choices.length < 3 || question.choices.length > 5) {
      errors.push(`${question.questionId}: expected 3 to 5 choices`);
    }
    if (
      !question.choices.some(
        (choice: Json) => choice.id === question.correctAnswerId,
      )
    ) {
      errors.push(`${question.questionId}: correctAnswerId not among choices`);
    }
  }

  return {
    errors,
    warnings,
    hashedFileCount: (manifest.hashedFiles as string[]).length,
    svgCount,
  };
};

// ---------------------------------------------------------------------------
// Stable id map

export type StableIdEntry = {
  entity:
    | 'course'
    | 'module'
    | 'lesson'
    | 'question'
    | 'asset'
    | 'moduleTest'
    | 'block';
  sourceId: string;
  sourceUuid?: string;
  stableId: string;
  uuid?: string;
};

export type StableIdMap = {
  courseId: string;
  uuidNamespace: string;
  entries: StableIdEntry[];
};

// The state-driver-course-version manifest hashes every delivered file, so
// integrity here is the whole-file sweep plus the same structural checks the
// CA package gets. The illustrated deliveries share the CA package's flaw:
// re-generated art without a re-run of packaging, leaving manifest.files and
// the QA report behind the bytes — gated behind the same explicit flag, with
// assets/index.json (regenerated with the art) as the per-file anchor.
const verifyStatePackage = (
  pkg: SourcePackage,
  options: VerifyOptions,
): SourceCheckResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { manifest, dir } = pkg;

  if (manifest.packageType !== 'state-driver-course-version') {
    errors.push(`unexpected packageType: ${manifest.packageType}`);
  }
  if (manifest.status !== 'draft_generated_human_review_required') {
    errors.push(`unexpected manifest status: ${manifest.status}`);
  }
  if (manifest.publicationAuthorized !== false) {
    errors.push('manifest.publicationAuthorized must be false');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(pkg.courseId)) {
    errors.push(`course id is not a usable slug: ${pkg.courseId}`);
  }

  // Whole-file manifest sweep.
  let hashedFileCount = 0;
  let staleFiles = 0;
  for (const file of manifest.files as Json[]) {
    const path = join(dir, file.path);
    if (!existsSync(path)) {
      errors.push(`missing manifest file: ${file.path}`);
      continue;
    }
    hashedFileCount += 1;
    if (sha256Hex(readFileSync(path)) !== file.sha256) {
      staleFiles += 1;
    }
  }
  if (staleFiles > 0) {
    const message = `${staleFiles} files differ from manifest.files hashes: the package was re-assembled after the manifest was written, so the delivered bytes were never covered by its integrity sweep`;
    if (options.allowStaleValidationReport) {
      warnings.push(
        `${message} (accepted via --allow-stale-validation-report)`,
      );
    } else {
      errors.push(message);
    }
  }

  const finalValidation = pkg.finalValidation;
  if (finalValidation.status !== 'passed') {
    errors.push(`final-validation status: ${finalValidation.status}`);
  }
  if (
    (finalValidation.failures ?? []).length > 0 ||
    (finalValidation.warnings ?? []).length > 0
  ) {
    errors.push(
      `final-validation reports failures/warnings: ${JSON.stringify({
        failures: finalValidation.failures,
        warnings: finalValidation.warnings,
      })}`,
    );
  }
  if (finalValidation.contentHash !== manifest.contentHash) {
    const message =
      'final-validation contentHash differs from manifest contentHash: the QA report was produced from different bytes than this package ships';
    if (options.allowStaleValidationReport) {
      warnings.push(
        `${message} (accepted via --allow-stale-validation-report)`,
      );
    } else {
      errors.push(message);
    }
  }

  // Per-file asset hashes — the regenerated index is the integrity anchor.
  let svgCount = 0;
  for (const asset of pkg.assetsIndex.assets as Json[]) {
    const path = join(dir, asset.path);
    if (!existsSync(path)) {
      errors.push(`missing asset file: ${asset.path}`);
      continue;
    }
    if (sha256Hex(readFileSync(path)) !== asset.sha256) {
      errors.push(`asset hash mismatch: ${asset.assetId}`);
    }
    svgCount += 1;
  }
  const dedicatedQuestionAssets = dedicatedQuestionAssetIds(pkg);
  const expectedAssets = EXPECTED_LESSON_ASSETS + dedicatedQuestionAssets.size;
  if (svgCount !== expectedAssets) {
    errors.push(
      `expected ${expectedAssets} assets (${EXPECTED_LESSON_ASSETS} lesson + ${dedicatedQuestionAssets.size} dedicated question), found ${svgCount}`,
    );
  }
  const indexedSvgFiles = new Set(
    (pkg.assetsIndex.assets as Json[]).map(asset => asset.path as string),
  );
  for (const file of readdirSync(join(dir, 'assets'))) {
    if (file.endsWith('.svg') && !indexedSvgFiles.has(`assets/${file}`)) {
      errors.push(`asset file not described by assets/index.json: ${file}`);
    }
  }

  // Structural counts, mirroring the CA checks.
  if (pkg.modules.length !== 8) {
    errors.push(`expected 8 modules, found ${pkg.modules.length}`);
  }
  if (pkg.lessons.length !== 30) {
    errors.push(`expected 30 lessons, found ${pkg.lessons.length}`);
  }
  if (pkg.questions.length !== 150) {
    errors.push(`expected 150 questions, found ${pkg.questions.length}`);
  }
  if (pkg.moduleTests.length !== 8) {
    errors.push(`expected 8 module tests, found ${pkg.moduleTests.length}`);
  }

  const questionIds = new Set(
    pkg.questions.map((question: Json) => question.questionId),
  );
  const assetIds = new Set(
    (pkg.assetsIndex.assets as Json[]).map(asset => asset.assetId),
  );
  for (const lesson of pkg.lessons) {
    if (lesson.blocks.length !== 12) {
      errors.push(
        `${lesson.lessonId}: expected 12 blocks, got ${lesson.blocks.length}`,
      );
    }
    if (lesson.questionIds.length !== 5) {
      errors.push(
        `${lesson.lessonId}: expected 5 question refs, got ${lesson.questionIds.length}`,
      );
    }
    if (lesson.assetIds.length !== 3) {
      errors.push(
        `${lesson.lessonId}: expected 3 asset refs, got ${lesson.assetIds.length}`,
      );
    }
    for (const questionId of lesson.questionIds) {
      if (!questionIds.has(questionId)) {
        errors.push(`${lesson.lessonId}: unknown question ${questionId}`);
      }
    }
    for (const assetId of lesson.assetIds) {
      if (!assetIds.has(assetId)) {
        errors.push(`${lesson.lessonId}: unknown asset ${assetId}`);
      }
    }
  }
  for (const question of pkg.questions) {
    if (question.assetId !== undefined && !assetIds.has(question.assetId)) {
      errors.push(`${question.questionId}: unknown asset ${question.assetId}`);
    }
  }
  const lessonQuestionIds = new Set(
    pkg.lessons.flatMap((lesson: Json) => lesson.questionIds as string[]),
  );
  for (const test of pkg.moduleTests) {
    if (test.questionIds.length !== 10) {
      errors.push(
        `${test.testId}: expected 10 question refs, got ${test.questionIds.length}`,
      );
    }
    for (const questionId of test.questionIds) {
      if (!lessonQuestionIds.has(questionId)) {
        errors.push(
          `${test.testId}: test question ${questionId} is not a lesson question`,
        );
      }
    }
  }

  return { errors, warnings, hashedFileCount, svgCount };
};

export const buildStableIdMap = (pkg: SourcePackage): StableIdMap => {
  const errors: string[] = [];
  const entries: StableIdEntry[] = [];
  const seenStable = new Map<string, string>();

  const add = (entry: StableIdEntry): void => {
    if (entry.stableId.length > MAX_ID_LENGTH) {
      errors.push(
        `stable id longer than ${MAX_ID_LENGTH} chars: ${entry.stableId}`,
      );
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.stableId)) {
      errors.push(`stable id has invalid characters: ${entry.stableId}`);
    }
    const existing = seenStable.get(entry.stableId);
    if (existing !== undefined) {
      errors.push(
        `stable id collision: ${entry.stableId} maps from both ${existing} and ${entry.sourceId}`,
      );
    }
    seenStable.set(entry.stableId, entry.sourceId);
    entries.push(entry);
  };

  // The newer state packages already ship stable slugs as source ids, so the
  // map is the identity — but it still flows through add(), which enforces
  // slug shape, length and collision-freedom on the package's own ids.
  if (pkg.format === 'state-v2') {
    const courseId = pkg.courseId;
    const identity = (
      entity: StableIdEntry['entity'],
      sourceId: string,
      sourceUuid?: string,
    ): void =>
      add({
        entity,
        sourceId,
        sourceUuid,
        stableId: sourceId,
        uuid: stableUuid(sourceId, courseId),
      });

    identity('course', pkg.course.courseId, pkg.course.uuid);
    for (const module of pkg.modules) {
      identity('module', module.moduleId, module.uuid);
      identity('moduleTest', module.moduleTestId);
    }
    const assetUuids = new Map<string, string>(
      (pkg.assetsIndex.assets as Json[]).map(asset => [
        asset.assetId,
        asset.uuid,
      ]),
    );
    const registeredAssets = new Set<string>();
    const registerAsset = (assetId: string): void => {
      if (registeredAssets.has(assetId)) {
        return;
      }
      registeredAssets.add(assetId);
      identity('asset', assetId, assetUuids.get(assetId));
    };
    const questionsBySourceId = new Map<string, Json>(
      pkg.questions.map((question: Json) => [question.questionId, question]),
    );
    for (const lesson of pkg.lessons) {
      identity('lesson', lesson.lessonId, lesson.uuid);
      lesson.questionIds.forEach((questionId: string) => {
        identity(
          'question',
          questionId,
          questionsBySourceId.get(questionId)?.uuid,
        );
        const assetId = questionsBySourceId.get(questionId)?.assetId as
          | string
          | undefined;
        if (assetId !== undefined) {
          registerAsset(assetId);
        }
      });
      lesson.assetIds.forEach(registerAsset);
      lesson.blocks.forEach((block: Json) => {
        add({
          entity: 'block',
          sourceId: block.blockId,
          stableId: block.blockId,
        });
      });
    }

    const uuidsSeen = entries.filter(e => e.uuid).map(e => e.uuid);
    if (new Set(uuidsSeen).size !== uuidsSeen.length) {
      errors.push('uuid collision in stable id map');
    }
    if (errors.length > 0) {
      throw new Error(`stable id mapping failed:\n  ${errors.join('\n  ')}`);
    }
    return { courseId, uuidNamespace: STABLE_UUID_NAMESPACE, entries };
  }

  add({
    entity: 'course',
    sourceId: pkg.course.courseId,
    sourceUuid: pkg.course.uuid,
    stableId: STABLE_COURSE_ID,
    uuid: stableUuid(STABLE_COURSE_ID),
  });

  // Stale curated entries (mapping a source id that no longer exists) are
  // errors too: they signal the tables drifted from the package.
  const moduleIds = new Set(pkg.modules.map((module: Json) => module.moduleId));
  for (const sourceId of Object.keys(MODULE_SLUGS)) {
    if (!moduleIds.has(sourceId)) {
      errors.push(`MODULE_SLUGS maps unknown source module ${sourceId}`);
    }
  }
  const lessonIds = new Set(pkg.lessons.map((lesson: Json) => lesson.lessonId));
  for (const sourceId of Object.keys(LESSON_SLUGS)) {
    if (!lessonIds.has(sourceId)) {
      errors.push(`LESSON_SLUGS maps unknown source lesson ${sourceId}`);
    }
  }

  for (const module of pkg.modules) {
    const slug = MODULE_SLUGS[module.moduleId];
    if (slug === undefined) {
      errors.push(
        `no manual stable id mapping for module ${module.moduleId} (${module.title}); add it to MODULE_SLUGS`,
      );
      continue;
    }
    add({
      entity: 'module',
      sourceId: module.moduleId,
      sourceUuid: module.uuid,
      stableId: slug,
      uuid: stableUuid(slug),
    });
    add({
      entity: 'moduleTest',
      sourceId: module.moduleTestId,
      stableId: `${slug}-test`,
      uuid: stableUuid(`${slug}-test`),
    });
  }

  const dedicatedQuestionAssets = dedicatedQuestionAssetIds(pkg);
  const questionsBySourceId = new Map<string, Json>(
    pkg.questions.map((question: Json) => [question.questionId, question]),
  );

  for (const lesson of pkg.lessons) {
    const slug = LESSON_SLUGS[lesson.lessonId];
    if (slug === undefined) {
      errors.push(
        `no manual stable id mapping for lesson ${lesson.lessonId} (${lesson.title}); add it to LESSON_SLUGS`,
      );
      continue;
    }
    add({
      entity: 'lesson',
      sourceId: lesson.lessonId,
      sourceUuid: lesson.uuid,
      stableId: slug,
      uuid: stableUuid(slug),
    });
    lesson.questionIds.forEach((questionId: string, index: number) => {
      const sourceQuestion = questionsBySourceId.get(questionId);
      add({
        entity: 'question',
        sourceId: questionId,
        sourceUuid: sourceQuestion?.uuid,
        stableId: `${slug}-q${ordinal(index)}`,
        uuid: stableUuid(`${slug}-q${ordinal(index)}`),
      });
      // An illustrated question owns its SVG; the rest point at one of the
      // lesson assets registered below, which needs no entry of its own.
      const assetId = sourceQuestion?.assetId as string | undefined;
      if (assetId !== undefined && dedicatedQuestionAssets.has(assetId)) {
        const sourceAsset = (pkg.assetsIndex.assets as Json[]).find(
          asset => asset.assetId === assetId,
        );
        add({
          entity: 'asset',
          sourceId: assetId,
          sourceUuid: sourceAsset?.uuid,
          stableId: `${slug}-q${ordinal(index)}-a`,
          uuid: stableUuid(`${slug}-q${ordinal(index)}-a`),
        });
      }
    });
    lesson.assetIds.forEach((assetId: string, index: number) => {
      const sourceAsset = (pkg.assetsIndex.assets as Json[]).find(
        asset => asset.assetId === assetId,
      );
      add({
        entity: 'asset',
        sourceId: assetId,
        sourceUuid: sourceAsset?.uuid,
        stableId: `${slug}-a${ordinal(index)}`,
        uuid: stableUuid(`${slug}-a${ordinal(index)}`),
      });
    });
    lesson.blocks.forEach((block: Json, index: number) => {
      add({
        entity: 'block',
        sourceId: block.blockId,
        stableId: `${slug}-b${ordinal(index)}`,
      });
    });
  }

  const uuids = entries.filter(entry => entry.uuid).map(entry => entry.uuid);
  if (new Set(uuids).size !== uuids.length) {
    errors.push('uuid collision in stable id map');
  }

  if (errors.length > 0) {
    throw new Error(`stable id mapping failed:\n  ${errors.join('\n  ')}`);
  }
  return {
    courseId: STABLE_COURSE_ID,
    uuidNamespace: STABLE_UUID_NAMESPACE,
    entries,
  };
};

const indexIdMap = (idMap: StableIdMap): Map<string, StableIdEntry> => {
  const bySource = new Map<string, StableIdEntry>();
  for (const entry of idMap.entries) {
    bySource.set(`${entry.entity}:${entry.sourceId}`, entry);
  }
  return bySource;
};

// ---------------------------------------------------------------------------
// Transformation to v2 wire documents

export type TransformOptions = {
  deliveryVersion: string;
  // Deterministic timestamp (YYYY-MM-DD) recorded as sourceCheckedAt /
  // releasedAt; defaults to the package release date so re-runs are
  // byte-stable.
  checkedAt?: string;
};

export type TransformResult = {
  courseDoc: CourseDocV2;
  moduleDocs: ModuleDocV2[];
  lessonDocs: LessonDocV2[];
  // Audit-only lesson fields stripped from the runtime docs.
  auditLessonFields: Record<string, Json>;
  // The artwork itself, keyed by the sha256 the documents reference. Documents
  // only point at pictures now, so the bytes travel beside them: the package
  // writes them out and the push uploads them before the documents that need
  // them.
  assetBytes: Map<string, { mime: string; bytes: Buffer }>;
};

const lookup = (
  bySource: Map<string, StableIdEntry>,
  entity: StableIdEntry['entity'],
  sourceId: string,
): StableIdEntry => {
  const entry = bySource.get(`${entity}:${sourceId}`);
  if (!entry) {
    throw new Error(`missing stable id mapping for ${entity} ${sourceId}`);
  }
  return entry;
};

const transformBlock = (
  block: Json,
  blockStableId: string,
  bySource: Map<string, StableIdEntry>,
): LessonBlockV2 => {
  switch (block.type) {
    case 'quick_challenge':
      return {
        blockId: blockStableId,
        type: 'quick_challenge',
        title: block.title,
        scenario: block.scenario,
        questionPreview: block.questionPreview,
        questionId: lookup(bySource, 'question', block.questionId).stableId,
      };
    case 'image':
      return {
        blockId: blockStableId,
        type: 'image',
        assetId: lookup(bySource, 'asset', block.assetId).stableId,
      };
    case 'core_rule':
    case 'visual_example':
    case 'related_rule':
    case 'california_specific':
    case 'state_specific':
      return {
        blockId: blockStableId,
        type: block.type,
        title: block.title,
        bodyMarkdown: block.bodyMarkdown,
        ...(block.checkpointQuestionId !== undefined && {
          checkpointQuestionId: lookup(
            bySource,
            'question',
            block.checkpointQuestionId,
          ).stableId,
        }),
      };
    case 'why_it_matters':
    case 'exam_trap':
    case 'remember_this':
      return {
        blockId: blockStableId,
        type: block.type,
        title: block.title,
        bodyMarkdown: block.bodyMarkdown,
        // The state packages hang checkpoints on prose blocks too.
        ...(block.checkpointQuestionId !== undefined && {
          checkpointQuestionId: lookup(
            bySource,
            'question',
            block.checkpointQuestionId,
          ).stableId,
        }),
      };
    case 'drive_smarter':
      return {
        blockId: blockStableId,
        type: 'drive_smarter',
        title: block.title,
        bodyMarkdown: block.bodyMarkdown,
        optional: true,
      };
    case 'check_yourself':
      return {
        blockId: blockStableId,
        type: 'check_yourself',
        title: block.title,
        context: block.context,
        ruleMarkdown: block.ruleMarkdown,
      };
    default:
      throw new Error(`unknown source block type: ${block.type}`);
  }
};

export const transformPackage = (
  pkg: SourcePackage,
  idMap: StableIdMap,
  options: TransformOptions,
): TransformResult => {
  // The artwork the documents reference, carried out beside them: a document
  // points at a picture now, so the bytes have to reach the server too.
  const assetBytes = new Map<string, { mime: string; bytes: Buffer }>();
  const bySource = indexIdMap(idMap);
  const checkedAt =
    options.checkedAt ?? pkg.manifest.releaseDate ?? pkg.course.releaseDate;
  const questionsById = new Map<string, Json>(
    pkg.questions.map((question: Json) => [question.questionId, question]),
  );
  const assetsBySourceId = new Map<string, Json>(
    (pkg.assetsIndex.assets as Json[]).map(asset => [asset.assetId, asset]),
  );

  const toQuestion = (sourceQuestionId: string): CourseQuestionV2 => {
    const source = questionsById.get(sourceQuestionId);
    if (!source) {
      throw new Error(`unknown source question ${sourceQuestionId}`);
    }
    const entry = lookup(bySource, 'question', sourceQuestionId);
    return {
      questionId: entry.stableId,
      uuid: entry.uuid!,
      kind: source.kind,
      prompt: source.prompt,
      choices: source.choices.map((choice: Json) => ({
        id: choice.id,
        text: choice.text,
        feedback: choice.feedback,
      })),
      correctAnswerId: source.correctAnswerId,
      explanation: source.explanation,
      ...(source.assetId !== undefined && {
        assetId: lookup(bySource, 'asset', source.assetId).stableId,
      }),
    };
  };

  const toAsset = (sourceAssetId: string): CourseAssetV2 => {
    const source = assetsBySourceId.get(sourceAssetId);
    if (!source) {
      throw new Error(`unknown source asset ${sourceAssetId}`);
    }
    const entry = lookup(bySource, 'asset', sourceAssetId);
    const fileBytes = readFileSync(join(pkg.dir, source.path));
    const svgXml = fileBytes.toString('utf8');
    const actualHash = sha256Hex(fileBytes);
    if (actualHash !== source.sha256) {
      throw new Error(
        `asset ${sourceAssetId}: sha256 mismatch while embedding`,
      );
    }
    const safety = svgSafetyErrors(svgXml);
    if (safety.length > 0) {
      throw new Error(`asset ${sourceAssetId}: ${safety.join('; ')}`);
    }
    // The document keeps a reference; the bytes go out beside it.
    assetBytes.set(actualHash, { mime: 'image/svg+xml', bytes: fileBytes });
    return {
      assetId: entry.stableId,
      uuid: entry.uuid!,
      mime: 'image/svg+xml',
      width: source.width,
      height: source.height,
      alt: source.alt,
      sha256: actualHash,
      sizeBytes: fileBytes.byteLength,
    };
  };

  const lessonsBySourceId = new Map<string, Json>(
    pkg.lessons.map((lesson: Json) => [lesson.lessonId, lesson]),
  );
  const testsBySourceModuleId = new Map<string, Json>(
    pkg.moduleTests.map((test: Json) => [test.moduleId, test]),
  );

  const auditLessonFields: Record<string, Json> = {};
  const moduleDocs: ModuleDocV2[] = [];
  const lessonDocs: LessonDocV2[] = [];

  const sortedModules = [...pkg.modules].sort(
    (a: Json, b: Json) => a.sequence - b.sequence,
  );

  for (const sourceModule of sortedModules) {
    const moduleEntry = lookup(bySource, 'module', sourceModule.moduleId);
    const lessons: CourseLessonV2[] = [];
    const moduleQuestions: CourseQuestionV2[] = [];
    const moduleAssets: CourseAssetV2[] = [];

    const sortedLessonRefs = [...sourceModule.lessons].sort(
      (a: Json, b: Json) => a.sequence - b.sequence,
    );
    for (const lessonRef of sortedLessonRefs) {
      const sourceLesson = lessonsBySourceId.get(lessonRef.lessonId);
      if (!sourceLesson) {
        throw new Error(
          `module references unknown lesson ${lessonRef.lessonId}`,
        );
      }
      const lessonEntry = lookup(bySource, 'lesson', sourceLesson.lessonId);
      const lesson: CourseLessonV2 = {
        lessonId: lessonEntry.stableId,
        uuid: lessonEntry.uuid!,
        moduleId: moduleEntry.stableId,
        globalSequence: sourceLesson.globalSequence,
        moduleSequence: sourceLesson.moduleSequence,
        title: sourceLesson.title,
        objective: sourceLesson.objective,
        estimatedMinutes: sourceLesson.estimatedMinutes,
        format: sourceLesson.format,
        blocks: sourceLesson.blocks.map((block: Json) =>
          transformBlock(
            block,
            lookup(bySource, 'block', block.blockId).stableId,
            bySource,
          ),
        ),
        questionIds: sourceLesson.questionIds.map(
          (questionId: string) =>
            lookup(bySource, 'question', questionId).stableId,
        ),
        assetIds: sourceLesson.assetIds.map(
          (assetId: string) => lookup(bySource, 'asset', assetId).stableId,
        ),
        language: sourceLesson.language,
      };
      lessons.push(lesson);
      auditLessonFields[lesson.lessonId] = {
        sourceLessonId: sourceLesson.lessonId,
        blueprintId: sourceLesson.blueprintId,
        primaryRuleIds: sourceLesson.primaryRuleIds,
        reinforcementRuleIds: sourceLesson.reinforcementRuleIds,
        evidenceId: sourceLesson.evidenceId,
        estimatedVisibleWordCount: sourceLesson.estimatedVisibleWordCount,
        status: sourceLesson.status,
      };

      const lessonQuestions = sourceLesson.questionIds.map(toQuestion);
      // Lesson illustrations first, then any SVG owned by one of its
      // questions. Deduped because most questions reuse a lesson asset, and
      // a doc carrying the same asset twice fails validation.
      const lessonAssetIds: string[] = [...sourceLesson.assetIds];
      for (const questionId of sourceLesson.questionIds) {
        const assetId = questionsById.get(questionId)?.assetId as
          | string
          | undefined;
        if (assetId !== undefined && !lessonAssetIds.includes(assetId)) {
          lessonAssetIds.push(assetId);
        }
      }
      const lessonAssets = lessonAssetIds.map(toAsset);
      moduleQuestions.push(...lessonQuestions);
      moduleAssets.push(...lessonAssets);
      lessonDocs.push({
        schemaVersion: COURSE_SCHEMA_VERSION,
        deliveryVersion: options.deliveryVersion,
        lesson,
        questions: lessonQuestions,
        assets: lessonAssets,
      });
    }

    const sourceTest = testsBySourceModuleId.get(sourceModule.moduleId);
    if (!sourceTest) {
      throw new Error(`no module test for ${sourceModule.moduleId}`);
    }
    const testEntry = lookup(bySource, 'moduleTest', sourceTest.testId);
    const moduleTest: CourseModuleTestV2 = {
      testId: testEntry.stableId,
      uuid: testEntry.uuid!,
      moduleId: moduleEntry.stableId,
      questionIds: sourceTest.questionIds.map(
        (questionId: string) =>
          lookup(bySource, 'question', questionId).stableId,
      ),
    };

    moduleDocs.push({
      schemaVersion: COURSE_SCHEMA_VERSION,
      deliveryVersion: options.deliveryVersion,
      module: {
        moduleId: moduleEntry.stableId,
        uuid: moduleEntry.uuid!,
        sequence: sourceModule.sequence,
        title: sourceModule.title,
        outcome: sourceModule.outcome,
        lessons,
        moduleTest,
      },
      questions: moduleQuestions,
      assets: moduleAssets,
    });
  }

  const courseDoc: CourseDocV2 = {
    schemaVersion: COURSE_SCHEMA_VERSION,
    deliveryVersion: options.deliveryVersion,
    course: {
      courseId: idMap.courseId,
      title: pkg.course.title,
      subtitle: pkg.course.subtitle,
      jurisdiction: pkg.course.jurisdiction,
      state: pkg.course.state,
      language: pkg.course.language,
      targetLicense: pkg.course.targetLicense,
      moduleIds: moduleDocs.map(doc => doc.module.moduleId),
      sourceVersionLabel: pkg.manifest.versionLabel,
      sourceContentHash: pkg.manifest.contentHash,
      sourceCheckedAt: checkedAt,
      sourceReviewStatus: pkg.manifest.status,
      publicationAuthorized: pkg.manifest.publicationAuthorized,
    },
  };

  return { courseDoc, moduleDocs, lessonDocs, auditLessonFields, assetBytes };
};

// ---------------------------------------------------------------------------
// Emitted-content safety checks

// Topics deliberately excluded from the package pending legal review; if any
// of these patterns matches emitted learner text the import must fail rather
// than ship reconstructed values.
export const BLOCKED_TOPIC_PATTERNS: { topic: string; pattern: RegExp }[] = [
  { topic: 'projecting-load flag dimensions', pattern: /\bflags?\b/i },
  {
    topic: 'minor knowledge-test retest interval',
    pattern: /\b(?:retest|re-?take)\b/i,
  },
  {
    topic: 'minor knowledge-test retest interval',
    pattern: /\b(?:seven|7)[-\s]day\b/i,
  },
  {
    topic: 'minor knowledge-test retest interval',
    pattern: /\bone[-\s]week\b/i,
  },
  {
    topic: 'minor knowledge-test retest interval',
    pattern: /\beighth[-\s]calendar\b/i,
  },
];

const INTERNAL_RULE_CODE = /\b(?:CA|FL|TX)_[A-Z0-9_]+\b/g;

export const checkEmittedContent = (
  result: TransformResult,
  // The blocked-topic list encodes CA legal-review holds; other jurisdictions
  // use the same words legitimately (FL teaches flagger signals), so the
  // screen only arms for the package the holds were written against.
  jurisdiction: string = 'CA',
): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Learner-visible text only: docs minus SVG XML (diagram ids/colors would
  // false-positive) — but SVG *text* is learner-visible, so scan text nodes.
  const learnerText = JSON.stringify({
    modules: result.moduleDocs.map(doc => ({
      module: { ...doc.module },
      questions: doc.questions,
      assets: doc.assets.map(asset => ({
        alt: asset.alt,
        text: (
          (
            result.assetBytes.get(asset.sha256)?.bytes.toString('utf8') ?? ''
          ).match(/>([^<>]+)</g) ?? []
        ).join(' '),
      })),
    })),
  });
  for (const { topic, pattern } of jurisdiction === 'CA'
    ? BLOCKED_TOPIC_PATTERNS
    : []) {
    const match = learnerText.match(pattern);
    if (match) {
      errors.push(
        `blocked topic "${topic}" matched emitted content: "${match[0]}"`,
      );
    }
  }
  const ruleCodes = learnerText.match(INTERNAL_RULE_CODE);
  if (ruleCodes && ruleCodes.length > 0) {
    warnings.push(
      `internal rule codes appear in emitted content (${ruleCodes.length} mentions)`,
    );
  }
  return { errors, warnings };
};

// ---------------------------------------------------------------------------
// Post-transform integrity: run the same runtime validators the app uses.

export const validateTransformResult = (result: TransformResult): string[] => {
  const errors: string[] = [];
  const expected = { deliveryVersion: result.courseDoc.deliveryVersion };

  const courseCheck = validateCourseDocV2(result.courseDoc, expected);
  if (!courseCheck.ok) {
    errors.push(...courseCheck.errors);
  }
  for (const doc of result.moduleDocs) {
    const check = validateModuleDocV2(doc, expected);
    if (!check.ok) {
      errors.push(
        ...check.errors.map(error => `${doc.module.moduleId}: ${error}`),
      );
    }
  }
  for (const doc of result.lessonDocs) {
    const check = validateLessonDocV2(doc, expected);
    if (!check.ok) {
      errors.push(
        ...check.errors.map(error => `${doc.lesson.lessonId}: ${error}`),
      );
    }
  }

  // Cross-document identity checks.
  const allIds = new Set<string>();
  const allUuids = new Set<string>();
  const registerId = (value: string, uuid?: string): void => {
    if (allIds.has(value)) {
      errors.push(`duplicate id across documents: ${value}`);
    }
    allIds.add(value);
    if (uuid !== undefined) {
      if (allUuids.has(uuid)) {
        errors.push(`duplicate uuid across documents: ${uuid}`);
      }
      allUuids.add(uuid);
    }
  };
  registerId(result.courseDoc.course.courseId);
  for (const doc of result.moduleDocs) {
    registerId(doc.module.moduleId, doc.module.uuid);
    registerId(doc.module.moduleTest.testId, doc.module.moduleTest.uuid);
    for (const lesson of doc.module.lessons) {
      registerId(lesson.lessonId, lesson.uuid);
    }
    for (const question of doc.questions) {
      registerId(question.questionId, question.uuid);
    }
    for (const asset of doc.assets) {
      registerId(asset.assetId, asset.uuid);
    }
  }

  // Module membership must match the course doc.
  const moduleIds = result.moduleDocs.map(doc => doc.module.moduleId);
  if (
    JSON.stringify(moduleIds) !==
    JSON.stringify(result.courseDoc.course.moduleIds)
  ) {
    errors.push('course.moduleIds does not match module doc order');
  }

  // Every lesson doc must be byte-identical to its module doc copy.
  const lessonDocsById = new Map(
    result.lessonDocs.map(doc => [doc.lesson.lessonId, doc]),
  );
  for (const moduleDoc of result.moduleDocs) {
    for (const lesson of moduleDoc.module.lessons) {
      const lessonDoc = lessonDocsById.get(lesson.lessonId);
      if (!lessonDoc) {
        errors.push(`no lesson doc for ${lesson.lessonId}`);
        continue;
      }
      if (JSON.stringify(lessonDoc.lesson) !== JSON.stringify(lesson)) {
        errors.push(
          `lesson doc diverges from module doc copy: ${lesson.lessonId}`,
        );
      }
    }
    // Module test questions must belong to the module's lessons.
    const moduleQuestionIds = new Set(
      moduleDoc.module.lessons.flatMap(lesson => lesson.questionIds),
    );
    for (const questionId of moduleDoc.module.moduleTest.questionIds) {
      if (!moduleQuestionIds.has(questionId)) {
        errors.push(
          `${moduleDoc.module.moduleTest.testId}: question ${questionId} is outside the module question bank`,
        );
      }
    }
  }

  // Audit-only fields must not leak into runtime docs.
  const runtimeJson = JSON.stringify({
    course: result.courseDoc,
    modules: result.moduleDocs.map(doc => ({
      ...doc,
      assets: doc.assets.map(a => ({ ...a, svgXml: '' })),
    })),
  });
  for (const field of [
    'primaryRuleIds',
    'reinforcementRuleIds',
    'evidenceId',
    'blueprintId',
    'rightsStatus',
    'courseVersion',
    'relatedRuleIds',
  ]) {
    if (runtimeJson.includes(`"${field}"`)) {
      errors.push(`audit-only field leaked into runtime docs: ${field}`);
    }
  }

  return errors;
};

// ---------------------------------------------------------------------------
// Manifest building + release verification

export type BuiltDocuments = {
  // Relative server paths → exact file bytes.
  files: Map<string, string>;
  manifestVersion: ManifestVersionV2;
};

export type ManifestBuildOptions = {
  deliveryVersion: string;
  releasedAt: string;
  status: string;
  minAppVersion: string;
  notes: string;
  instructions: UpdateInstructionV2[];
};

export const buildVersionDocuments = (
  result: TransformResult,
  options: ManifestBuildOptions,
): BuiltDocuments => {
  const files = new Map<string, string>();
  const courseBytes = serializeJson(result.courseDoc);
  files.set('course.json', courseBytes);

  const modules: Record<string, { sha256: string; sizeBytes: number }> = {};
  const lessons: Record<
    string,
    { moduleId: string; sha256: string; sizeBytes: number }
  > = {};

  for (const doc of result.moduleDocs) {
    const bytes = serializeJson(doc);
    files.set(`modules/${doc.module.moduleId}.json`, bytes);
    modules[doc.module.moduleId] = {
      sha256: sha256Hex(bytes),
      sizeBytes: utf8Size(bytes),
    };
  }
  for (const doc of result.lessonDocs) {
    const bytes = serializeJson(doc);
    files.set(`lessons/${doc.lesson.lessonId}.json`, bytes);
    lessons[doc.lesson.lessonId] = {
      moduleId: doc.lesson.moduleId,
      sha256: sha256Hex(bytes),
      sizeBytes: utf8Size(bytes),
    };
  }

  const manifestVersion: ManifestVersionV2 = {
    version: options.deliveryVersion,
    releasedAt: options.releasedAt,
    status: options.status,
    minAppVersion: options.minAppVersion,
    notes: options.notes,
    sourceVersionLabel: result.courseDoc.course.sourceVersionLabel,
    sourceReviewStatus: result.courseDoc.course.sourceReviewStatus,
    publicationAuthorized: result.courseDoc.course.publicationAuthorized,
    instructions: options.instructions,
    documents: {
      course: {
        sha256: sha256Hex(courseBytes),
        sizeBytes: utf8Size(courseBytes),
      },
      modules,
      lessons,
    },
  };

  return { files, manifestVersion };
};

// Release rules (§manifest): structural violations are errors, not warnings.
export const verifyManifestRelease = (
  entry: ManifestVersionV2,
  previous: ManifestVersionV2 | null,
  readVersionFile: (relPath: string) => string | null,
): string[] => {
  const errors: string[] = [];

  const hasOp = (op: UpdateInstructionV2['op']): boolean =>
    entry.instructions.some(instruction => instruction.op === op);

  if (previous !== null) {
    if (!isVersionBelow(previous.version, entry.version)) {
      errors.push(
        `release version ${entry.version} is not above previous ${previous.version}`,
      );
    }
    const [prevMajor, prevMinor] = previous.version.split('.').map(Number);
    const [major, minor] = entry.version.split('.').map(Number);
    const kind =
      major !== prevMajor ? 'major' : minor !== prevMinor ? 'minor' : 'patch';
    if (kind === 'patch' && (hasOp('module') || hasOp('full'))) {
      errors.push('patch release must not contain module or full instructions');
    }
    if (kind === 'minor' && hasOp('full')) {
      errors.push('minor release must not contain full instructions');
    }

    // Coverage: every changed document must be reachable through instructions,
    // and every targeted document must actually have changed.
    if (!hasOp('full')) {
      const coveredLessons = new Set<string>();
      const coveredModules = new Set<string>();
      for (const instruction of entry.instructions) {
        if (
          instruction.op === 'lesson-content' ||
          instruction.op === 'lesson-questions'
        ) {
          coveredLessons.add(instruction.lessonId);
        } else if (instruction.op === 'question') {
          if (instruction.moduleId !== undefined) {
            coveredModules.add(instruction.moduleId);
          } else if (instruction.lessonId !== undefined) {
            coveredLessons.add(instruction.lessonId);
          } else {
            errors.push('question instruction needs lessonId or moduleId');
          }
        } else if (instruction.op === 'module') {
          coveredModules.add(instruction.moduleId);
        }
      }
      for (const [lessonId, ref] of Object.entries(entry.documents.lessons)) {
        const prevRef = previous.documents.lessons[lessonId];
        const changed = !prevRef || prevRef.sha256 !== ref.sha256;
        const covered =
          coveredLessons.has(lessonId) || coveredModules.has(ref.moduleId);
        if (changed && !covered) {
          errors.push(
            `changed lesson ${lessonId} is not covered by instructions`,
          );
        }
        if (!changed && coveredLessons.has(lessonId)) {
          errors.push(`instruction targets unchanged lesson ${lessonId}`);
        }
      }
      for (const [moduleId, ref] of Object.entries(entry.documents.modules)) {
        const prevRef = previous.documents.modules[moduleId];
        const changed = !prevRef || prevRef.sha256 !== ref.sha256;
        if (!changed && coveredModules.has(moduleId)) {
          errors.push(`instruction targets unchanged module ${moduleId}`);
        }
        if (changed && !coveredModules.has(moduleId)) {
          // A module doc may change solely because its lessons changed; every
          // changed lesson inside it must then be covered.
          const lessonsInModule = Object.entries(
            entry.documents.lessons,
          ).filter(([, lessonRef]) => lessonRef.moduleId === moduleId);
          const uncovered = lessonsInModule.filter(([lessonId, lessonRef]) => {
            const prevLesson = previous.documents.lessons[lessonId];
            const lessonChanged =
              !prevLesson || prevLesson.sha256 !== lessonRef.sha256;
            return lessonChanged && !coveredLessons.has(lessonId);
          });
          if (uncovered.length > 0) {
            errors.push(
              `changed module ${moduleId} is not covered by instructions`,
            );
          }
        }
      }
    }
  }

  // Instruction targets must exist in the target version.
  for (const instruction of entry.instructions) {
    if (
      instruction.op === 'lesson-content' ||
      instruction.op === 'lesson-questions'
    ) {
      if (!(instruction.lessonId in entry.documents.lessons)) {
        errors.push(
          `instruction targets unknown lesson ${instruction.lessonId}`,
        );
      }
    } else if (instruction.op === 'module') {
      if (!(instruction.moduleId in entry.documents.modules)) {
        errors.push(
          `instruction targets unknown module ${instruction.moduleId}`,
        );
      }
    } else if (instruction.op === 'question') {
      if (
        instruction.lessonId !== undefined &&
        !(instruction.lessonId in entry.documents.lessons)
      ) {
        errors.push(
          `instruction targets unknown lesson ${instruction.lessonId}`,
        );
      }
      if (
        instruction.moduleId !== undefined &&
        !(instruction.moduleId in entry.documents.modules)
      ) {
        errors.push(
          `instruction targets unknown module ${instruction.moduleId}`,
        );
      }
    }
  }

  // Hashes must match the exact bytes on disk.
  const checkFile = (
    relPath: string,
    expected: { sha256: string; sizeBytes: number },
  ): void => {
    const bytes = readVersionFile(relPath);
    if (bytes === null) {
      errors.push(`missing version file ${relPath}`);
      return;
    }
    if (sha256Hex(bytes) !== expected.sha256) {
      errors.push(`hash mismatch for ${relPath}`);
    }
    if (utf8Size(bytes) !== expected.sizeBytes) {
      errors.push(`size mismatch for ${relPath}`);
    }
  };
  checkFile('course.json', entry.documents.course);
  for (const [moduleId, ref] of Object.entries(entry.documents.modules)) {
    checkFile(`modules/${moduleId}.json`, ref);
  }
  for (const [lessonId, ref] of Object.entries(entry.documents.lessons)) {
    checkFile(`lessons/${lessonId}.json`, ref);
  }

  return errors;
};
