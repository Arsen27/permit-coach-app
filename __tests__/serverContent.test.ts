import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { convertTreeDoc } from './support/treeContent';

import { assembleBundle } from '@/data/course/store';
import { moduleDocFromBundle } from '@/data/course/updater';
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

// Consistency of the server content tree with its manifest: the latest
// release is what every device downloads (the app bundles no course), so its
// hashes, validators and lesson copies are checked here.

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
  // The bytes on disk, which the manifest describes.
  const readRaw = (version: string, relPath: string): string =>
    readFileSync(join(COURSE_DIR, version, relPath), 'utf8');

  // The committed tree predates artwork-as-a-file; the server converts it on
  // import, and so does this, so what the validators see is what a release
  // actually holds.
  const readDoc = (version: string, relPath: string): string =>
    convertTreeDoc(readRaw(version, relPath)).body;

  // The latest release: what a device downloads today.
  const checked = [manifest.latestVersion].map(version => ({
    version,
    entry: entryOf(version),
  }));

  it('declares schema 2 and a latest release the manifest describes', () => {
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.courseId).toBe('ca-class-c');
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
      const courseBytes = readRaw(version, 'course.json');
      expect(sha256(courseBytes)).toBe(entry.documents.course.sha256);
      expect(Buffer.byteLength(courseBytes)).toBe(
        entry.documents.course.sizeBytes,
      );

      expect(Object.keys(entry.documents.modules)).toHaveLength(8);
      for (const [moduleId, ref] of Object.entries(entry.documents.modules)) {
        const bytes = readRaw(version, join('modules', `${moduleId}.json`));
        expect(sha256(bytes)).toBe(ref.sha256);
        expect(Buffer.byteLength(bytes)).toBe(ref.sizeBytes);
      }
      expect(Object.keys(entry.documents.lessons)).toHaveLength(32);
      for (const [lessonId, ref] of Object.entries(entry.documents.lessons)) {
        const bytes = readRaw(version, join('lessons', `${lessonId}.json`));
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

  // The updater carries untouched modules forward instead of downloading
  // them, and checks the result against the manifest before committing. That
  // check is only useful while a rebuilt module is byte-identical to the one
  // the server serves — if the two ever drifted, every delta update would
  // quietly turn into a full download.
  it('rebuilds a served module document byte for byte from the bundle', () => {
    const version = manifest.latestVersion;
    const entry = entryOf(version);
    const courseDoc: CourseDocV2 = JSON.parse(readDoc(version, 'course.json'));
    const moduleDocs: ModuleDocV2[] = courseDoc.course.moduleIds.map(id =>
      JSON.parse(readDoc(version, join('modules', `${id}.json`))),
    );
    const bundle = assembleBundle(courseDoc, moduleDocs);

    for (const moduleId of courseDoc.course.moduleIds) {
      const rebuilt = moduleDocFromBundle(bundle, moduleId, version);
      expect(rebuilt).not.toBeNull();
      const body = `${JSON.stringify(rebuilt, null, 2)}\n`;
      // Against the document the server would serve, byte for byte.
      expect({ moduleId, body }).toEqual({
        moduleId,
        body: readDoc(version, join('modules', `${moduleId}.json`)),
      });
    }
  });
});
