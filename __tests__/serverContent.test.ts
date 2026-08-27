import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { SEED_COURSE_BUNDLE, SEED_DELIVERY_VERSION } from '@/data/course';
import type {
  CourseDocV2,
  CourseManifestV2,
  LessonDocV2,
  ModuleDocV2,
} from '@/data/course/v2/wire';
import {
  validateCourseDocV2,
  validateLessonDocV2,
  validateManifestVersionV2,
  validateModuleDocV2,
} from '@/data/course/v2/wire';

// Consistency of the server content tree with its manifest and with the
// bundled seed. The server may legitimately be ahead of the seed — that is
// what over-the-air updates are — so the seed is compared against its OWN
// version directory, while the integrity checks (hashes, validators, lesson
// copies) run over both that directory and whatever is latest.

const COURSE_DIR = join(__dirname, '..', 'server', 'content', 'ca-class-c');

const describeIf = existsSync(join(COURSE_DIR, 'manifest.json'))
  ? describe
  : describe.skip;

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

describeIf('server content tree (ca-class-c)', () => {
  const manifest: CourseManifestV2 = JSON.parse(
    readFileSync(join(COURSE_DIR, 'manifest.json'), 'utf8'),
  );
  const entryOf = (version: string) =>
    manifest.versions.find(entry => entry.version === version)!;
  const readDoc = (version: string, relPath: string): string =>
    readFileSync(join(COURSE_DIR, version, relPath), 'utf8');

  // Checked versions: the one the app bundles (it must never drift from the
  // seed) and the latest (what a device downloads today). Often the same dir.
  const checked = [
    ...new Set([SEED_DELIVERY_VERSION, manifest.latestVersion]),
  ].map(version => ({ version, entry: entryOf(version) }));

  it('declares schema 2 and knows which version the app bundles', () => {
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.courseId).toBe('ca-class-c');
    expect(manifest.seedVersion).toBe(SEED_DELIVERY_VERSION);
    for (const { entry } of checked) {
      expect(entry).toBeDefined();
    }
    for (const entry of manifest.versions) {
      expect(validateManifestVersionV2(entry).ok).toBe(true);
      // Audit metadata rides along on every release; it is not a visibility
      // switch, but it must never silently flip to "authorized".
      expect(entry.status).toBe('release_candidate');
      expect(entry.publicationAuthorized).toBe(false);
    }
  });

  it.each(checked.map(item => [item.version, item] as const))(
    '%s: document hashes match the exact bytes on disk',
    (_version, { version, entry }) => {
      const courseBytes = readDoc(version, 'course.json');
      expect(sha256(courseBytes)).toBe(entry.documents.course.sha256);
      expect(Buffer.byteLength(courseBytes)).toBe(
        entry.documents.course.sizeBytes,
      );

      expect(Object.keys(entry.documents.modules)).toHaveLength(8);
      for (const [moduleId, ref] of Object.entries(entry.documents.modules)) {
        const bytes = readDoc(version, join('modules', `${moduleId}.json`));
        expect(sha256(bytes)).toBe(ref.sha256);
        expect(Buffer.byteLength(bytes)).toBe(ref.sizeBytes);
      }
      expect(Object.keys(entry.documents.lessons)).toHaveLength(32);
      for (const [lessonId, ref] of Object.entries(entry.documents.lessons)) {
        const bytes = readDoc(version, join('lessons', `${lessonId}.json`));
        expect(sha256(bytes)).toBe(ref.sha256);
        expect(Buffer.byteLength(bytes)).toBe(ref.sizeBytes);
        expect(ref.moduleId in entry.documents.modules).toBe(true);
      }
    },
  );

  it.each(checked.map(item => [item.version, item] as const))(
    '%s: docs pass the app runtime validators',
    (_version, { version, entry }) => {
      const courseDoc = JSON.parse(readDoc(version, 'course.json'));
      expect(
        validateCourseDocV2(courseDoc, { deliveryVersion: version }).ok,
      ).toBe(true);
      for (const moduleId of Object.keys(entry.documents.modules)) {
        const doc = JSON.parse(
          readDoc(version, join('modules', `${moduleId}.json`)),
        );
        const check = validateModuleDocV2(doc, { deliveryVersion: version });
        expect(check.errors).toEqual([]);
      }
      for (const lessonId of Object.keys(entry.documents.lessons)) {
        const doc = JSON.parse(
          readDoc(version, join('lessons', `${lessonId}.json`)),
        );
        const check = validateLessonDocV2(doc, { deliveryVersion: version });
        expect(check.errors).toEqual([]);
      }
    },
  );

  it('keeps the seed version data-equivalent to the bundled seed', () => {
    const version = SEED_DELIVERY_VERSION;
    const courseDoc: CourseDocV2 = JSON.parse(readDoc(version, 'course.json'));
    expect(courseDoc.course).toEqual(SEED_COURSE_BUNDLE.course);

    const moduleDocs: ModuleDocV2[] = courseDoc.course.moduleIds.map(id =>
      JSON.parse(readDoc(version, join('modules', `${id}.json`))),
    );
    expect(moduleDocs.map(doc => doc.module)).toEqual(
      SEED_COURSE_BUNDLE.modules,
    );
    expect(moduleDocs.flatMap(doc => doc.questions)).toEqual(
      SEED_COURSE_BUNDLE.questions,
    );
    expect(moduleDocs.flatMap(doc => doc.assets)).toEqual(
      SEED_COURSE_BUNDLE.assets,
    );
  });

  it.each(checked.map(item => [item.version, item] as const))(
    '%s: every lesson doc is identical to its module doc copy',
    (_version, { version, entry }) => {
      for (const [lessonId, ref] of Object.entries(entry.documents.lessons)) {
        const lessonDoc: LessonDocV2 = JSON.parse(
          readDoc(version, join('lessons', `${lessonId}.json`)),
        );
        const moduleDoc: ModuleDocV2 = JSON.parse(
          readDoc(version, join('modules', `${ref.moduleId}.json`)),
        );
        const copy = moduleDoc.module.lessons.find(
          lesson => lesson.lessonId === lessonId,
        );
        expect(copy).toEqual(lessonDoc.lesson);
        // The lesson doc is self-contained: its questions/assets are the
        // exact objects the module doc carries for this lesson.
        const moduleQuestions = new Map(
          moduleDoc.questions.map(question => [question.questionId, question]),
        );
        for (const question of lessonDoc.questions) {
          expect(moduleQuestions.get(question.questionId)).toEqual(question);
        }
        const moduleAssets = new Map(
          moduleDoc.assets.map(asset => [asset.assetId, asset]),
        );
        for (const asset of lessonDoc.assets) {
          expect(moduleAssets.get(asset.assetId)).toEqual(asset);
        }
      }
    },
  );
});
