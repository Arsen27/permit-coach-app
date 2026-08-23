import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { SEED_COURSE_BUNDLE } from '@/data/course';
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

// Consistency of the generated server content tree with its manifest and with
// the bundled seed: same generated docs, exact-byte hashes, immutable layout.

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
  // Follow whatever the tree currently ships rather than pinning a number the
  // next import would invalidate; the seed test owns the version assertion.
  const version = manifest.latestVersion;
  const entry = manifest.versions.find(v => v.version === version)!;
  const versionDir = join(COURSE_DIR, version);
  const readDoc = (relPath: string): string =>
    readFileSync(join(versionDir, relPath), 'utf8');

  it('declares schema 2, matching latest/seed and soft per-lesson updates', () => {
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.courseId).toBe('ca-class-c');
    expect(manifest.seedVersion).toBe(version);
    expect(entry).toBeDefined();
    expect(entry.status).toBe('release_candidate');
    expect(entry.publicationAuthorized).toBe(false);
    expect(entry.sourceReviewStatus).toBe(
      'draft_generated_human_review_required',
    );
    expect(entry.instructions).toHaveLength(32);
    expect(
      entry.instructions.every(
        instruction =>
          instruction.op === 'lesson-content' &&
          instruction.severity === 'soft',
      ),
    ).toBe(true);
    expect(
      entry.instructions.map(instruction =>
        instruction.op === 'lesson-content' ? instruction.lessonId : '',
      ),
    ).toEqual(Object.keys(entry.documents.lessons));
    expect(validateManifestVersionV2(entry).ok).toBe(true);
  });

  it('lists document hashes that match the exact bytes on disk', () => {
    const courseBytes = readDoc('course.json');
    expect(sha256(courseBytes)).toBe(entry.documents.course.sha256);
    expect(Buffer.byteLength(courseBytes)).toBe(
      entry.documents.course.sizeBytes,
    );

    expect(Object.keys(entry.documents.modules)).toHaveLength(8);
    for (const [moduleId, ref] of Object.entries(entry.documents.modules)) {
      const bytes = readDoc(join('modules', `${moduleId}.json`));
      expect(sha256(bytes)).toBe(ref.sha256);
      expect(Buffer.byteLength(bytes)).toBe(ref.sizeBytes);
    }
    expect(Object.keys(entry.documents.lessons)).toHaveLength(32);
    for (const [lessonId, ref] of Object.entries(entry.documents.lessons)) {
      const bytes = readDoc(join('lessons', `${lessonId}.json`));
      expect(sha256(bytes)).toBe(ref.sha256);
      expect(Buffer.byteLength(bytes)).toBe(ref.sizeBytes);
      expect(ref.moduleId in entry.documents.modules).toBe(true);
    }
  });

  it('serves docs that pass the app runtime validators', () => {
    const courseDoc = JSON.parse(readDoc('course.json'));
    expect(
      validateCourseDocV2(courseDoc, { deliveryVersion: version }).ok,
    ).toBe(true);
    for (const moduleId of Object.keys(entry.documents.modules)) {
      const doc = JSON.parse(readDoc(join('modules', `${moduleId}.json`)));
      const check = validateModuleDocV2(doc, { deliveryVersion: version });
      expect(check.errors).toEqual([]);
    }
    for (const lessonId of Object.keys(entry.documents.lessons)) {
      const doc = JSON.parse(readDoc(join('lessons', `${lessonId}.json`)));
      const check = validateLessonDocV2(doc, { deliveryVersion: version });
      expect(check.errors).toEqual([]);
    }
  });

  it('is data-equivalent to the bundled seed (same generated docs)', () => {
    const courseDoc: CourseDocV2 = JSON.parse(readDoc('course.json'));
    expect(courseDoc.course).toEqual(SEED_COURSE_BUNDLE.course);

    const moduleDocs: ModuleDocV2[] = courseDoc.course.moduleIds.map(id =>
      JSON.parse(readDoc(join('modules', `${id}.json`))),
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

  it('keeps every lesson doc identical to its module doc copy', () => {
    for (const [lessonId, ref] of Object.entries(entry.documents.lessons)) {
      const lessonDoc: LessonDocV2 = JSON.parse(
        readDoc(join('lessons', `${lessonId}.json`)),
      );
      const moduleDoc: ModuleDocV2 = JSON.parse(
        readDoc(join('modules', `${ref.moduleId}.json`)),
      );
      const copy = moduleDoc.module.lessons.find(
        lesson => lesson.lessonId === lessonId,
      );
      expect(copy).toEqual(lessonDoc.lesson);
      // The lesson doc is self-contained: its questions/assets are the exact
      // objects the module doc carries for this lesson.
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
  });
});
