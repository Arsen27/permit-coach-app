// Which course each supported state uses. Nothing ships in the binary: the
// learner's state course is downloaded from the content server during
// onboarding (before the paywall) and on demand when the state changes in
// Settings — see ./updater.ts (installCourse) and ./store.ts for the device
// store that serves it afterwards, fully offline.
//
// There is no hardcoded "published course id": the active runtime course is
// whatever the device course store holds for the learner's state.

export const COURSE_IDS = ['ca-class-c', 'fl-class-e', 'tx-class-c'] as const;

export type CourseId = (typeof COURSE_IDS)[number];

export const DEFAULT_COURSE_ID: CourseId = 'ca-class-c';

// Exactly the states with a course are selectable in the app (see
// SUPPORTED_STATES in data/states, which must stay in step).
export const STATE_COURSE_IDS: Record<string, CourseId> = {
  CA: 'ca-class-c',
  FL: 'fl-class-e',
  TX: 'tx-class-c',
};

export const courseIdForState = (stateCode: string): CourseId =>
  STATE_COURSE_IDS[stateCode] ?? DEFAULT_COURSE_ID;
