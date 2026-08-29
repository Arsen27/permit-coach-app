import { readFileSync } from 'fs';
import { join } from 'path';

import { assembleBundle, courseStore } from '@/data/course/store';
import type {
  CourseBundleV2,
  CourseDocV2,
  CourseManifestV2,
  ModuleDocV2,
} from '@/data/course/v2/wire';

// The real California course, read from the server content tree at its
// latest release — the exact documents a device downloads today. The app
// bundles no course any more, so tests that render course content commit
// this into the device store first (commitFixtureCourse).

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

const readDoc = (relPath: string): string =>
  readFileSync(join(COURSE_DIR, FIXTURE_DELIVERY_VERSION, relPath), 'utf8');

export const FIXTURE_COURSE_DOC: CourseDocV2 = JSON.parse(
  readDoc('course.json'),
);

export const FIXTURE_MODULE_DOCS: ModuleDocV2[] =
  FIXTURE_COURSE_DOC.course.moduleIds.map(id =>
    JSON.parse(readDoc(join('modules', `${id}.json`))),
  );

export const FIXTURE_COURSE_BUNDLE: CourseBundleV2 = assembleBundle(
  FIXTURE_COURSE_DOC,
  FIXTURE_MODULE_DOCS,
);

export const commitFixtureCourse = (): Promise<void> =>
  courseStore.commit(
    FIXTURE_DELIVERY_VERSION,
    FIXTURE_COURSE_DOC,
    FIXTURE_MODULE_DOCS,
  );
