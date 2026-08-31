import { readFileSync } from 'fs';
import { join } from 'path';

import { primeVectorsForTests } from '@/data/assets/store';
import { primeLazyCourseForTests } from '@/data/course/lazy';
import { courseStore } from '@/data/course/store';
import { sha256Hex } from '@/lib/sha256';

import { convertTreeDoc } from '../support/treeContent';
import type {
  CourseBundleV2,
  CourseDocV2,
  CourseManifestV2,
  ModuleDocV2,
} from '@/data/course/v2/wire';

// The real California course, read from the committed content tree at its
// latest release and converted the way the server converts it on import —
// artwork lifted out of the documents into files, which is what a device
// downloads today. The app bundles no course any more, so tests that render
// course content commit this into the device store first
// (commitFixtureCourse), and the artwork bytes are published here so a test
// can still reason about the pictures themselves.

const COURSE_DIR = join(
  __dirname,
  '..',
  '..',
  'server',
  'content',
  'ca-class-c',
);

const manifest: CourseManifestV2 = JSON.parse(
  readFileSync(join(COURSE_DIR, 'manifest.json'), 'utf8'),
);

export const FIXTURE_COURSE_ID = 'ca-class-c';
export const FIXTURE_DELIVERY_VERSION = manifest.latestVersion;

// sha256 → the SVG markup the tree carried inline, so tests can check the
// artwork itself even though documents only reference it now.
export const FIXTURE_ASSET_BYTES = new Map<string, string>();

const readDoc = (relPath: string): string => {
  const raw = readFileSync(
    join(COURSE_DIR, FIXTURE_DELIVERY_VERSION, relPath),
    'utf8',
  );
  const doc = JSON.parse(raw) as {
    schemaVersion: number;
    assets?: { svgXml?: string }[];
  };
  for (const asset of doc.assets ?? []) {
    if (typeof asset.svgXml === 'string') {
      FIXTURE_ASSET_BYTES.set(sha256Hex(asset.svgXml), asset.svgXml);
    }
  }
  return convertTreeDoc(raw).body;
};

export const FIXTURE_COURSE_DOC: CourseDocV2 = JSON.parse(
  readDoc('course.json'),
);

export const FIXTURE_MODULE_DOCS: ModuleDocV2[] =
  FIXTURE_COURSE_DOC.course.moduleIds.map(id =>
    JSON.parse(readDoc(join('modules', `${id}.json`))),
  );

// The bundle shape the screens read, assembled the way the lazy store does:
// module order from the course doc, questions and assets deduped in module
// order.
const assembleFixtureBundle = (): CourseBundleV2 => {
  const seenQuestions = new Set<string>();
  const seenAssets = new Set<string>();
  return {
    course: FIXTURE_COURSE_DOC.course,
    modules: FIXTURE_MODULE_DOCS.map(doc => doc.module),
    questions: FIXTURE_MODULE_DOCS.flatMap(doc =>
      doc.questions.filter(question => {
        if (seenQuestions.has(question.questionId)) {
          return false;
        }
        seenQuestions.add(question.questionId);
        return true;
      }),
    ),
    assets: FIXTURE_MODULE_DOCS.flatMap(doc =>
      doc.assets.filter(asset => {
        if (seenAssets.has(asset.assetId)) {
          return false;
        }
        seenAssets.add(asset.assetId);
        return true;
      }),
    ),
  };
};

export const FIXTURE_COURSE_BUNDLE: CourseBundleV2 = assembleFixtureBundle();

export const commitFixtureCourse = async (): Promise<void> => {
  primeLazyCourseForTests(
    FIXTURE_COURSE_ID,
    FIXTURE_COURSE_DOC.course.title,
    FIXTURE_MODULE_DOCS,
    FIXTURE_DELIVERY_VERSION,
  );
  courseStore.setActiveCourse(FIXTURE_COURSE_ID);
  // A course on the device draws its pictures from the device, so the
  // renderer finds them the way it would after a real download.
  await primeVectorsForTests(FIXTURE_ASSET_BYTES);
};
