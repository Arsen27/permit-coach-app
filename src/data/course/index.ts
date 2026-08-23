// Bundled offline seeds, one per supported state course. Generated JSON under
// ./<courseId>-v2/ is produced by `npm run course:import-v2` — never edit it
// by hand; re-run the importer against a new package version instead.
//
// There is no hardcoded "published course id" anymore: the active runtime
// course is whatever the device course store serves (the seed for the
// learner's state until a server version has been committed). Source-review
// status rides inside the course doc itself and is audit metadata, not a
// visibility switch.

import caCourseDoc from './ca-class-c-v2/course.json';
import caModules from './ca-class-c-v2/modules.json';
import caQuestions from './ca-class-c-v2/questions.json';
import caAssets from './ca-class-c-v2/assets.json';
import flCourseDoc from './fl-class-e-v2/course.json';
import flModules from './fl-class-e-v2/modules.json';
import flQuestions from './fl-class-e-v2/questions.json';
import flAssets from './fl-class-e-v2/assets.json';
import txCourseDoc from './tx-class-c-v2/course.json';
import txModules from './tx-class-c-v2/modules.json';
import txQuestions from './tx-class-c-v2/questions.json';
import txAssets from './tx-class-c-v2/assets.json';
import type {
  CourseAssetV2,
  CourseBundleV2,
  CourseDocV2,
  CourseModuleV2,
  CourseQuestionV2,
} from './v2/wire';

type SeedParts = {
  doc: CourseDocV2;
  modules: unknown;
  questions: unknown;
  assets: unknown;
};

const seed = ({ doc, modules, questions, assets }: SeedParts) => ({
  deliveryVersion: doc.deliveryVersion,
  bundle: {
    course: doc.course,
    modules: modules as CourseModuleV2[],
    questions: questions as CourseQuestionV2[],
    assets: assets as CourseAssetV2[],
  } satisfies CourseBundleV2,
});

export const COURSE_SEEDS = {
  'ca-class-c': seed({
    doc: caCourseDoc as CourseDocV2,
    modules: caModules,
    questions: caQuestions,
    assets: caAssets,
  }),
  'fl-class-e': seed({
    doc: flCourseDoc as CourseDocV2,
    modules: flModules,
    questions: flQuestions,
    assets: flAssets,
  }),
  'tx-class-c': seed({
    doc: txCourseDoc as CourseDocV2,
    modules: txModules,
    questions: txQuestions,
    assets: txAssets,
  }),
} as const;

export type SeedCourseId = keyof typeof COURSE_SEEDS;

export const DEFAULT_COURSE_ID: SeedCourseId = 'ca-class-c';

// Which course a US state uses. Exactly the states with a course are
// selectable in the app (see SUPPORTED_STATES in data/states).
export const STATE_COURSE_IDS: Record<string, SeedCourseId> = {
  CA: 'ca-class-c',
  FL: 'fl-class-e',
  TX: 'tx-class-c',
};

export const courseIdForState = (stateCode: string): SeedCourseId =>
  STATE_COURSE_IDS[stateCode] ?? DEFAULT_COURSE_ID;

// The CA seed doubles as the pre-hydration default and the test fixture.
export const SEED_DELIVERY_VERSION =
  COURSE_SEEDS[DEFAULT_COURSE_ID].deliveryVersion;

export const SEED_COURSE_BUNDLE: CourseBundleV2 =
  COURSE_SEEDS[DEFAULT_COURSE_ID].bundle;
