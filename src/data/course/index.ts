import { courseIdForStateCode } from '@/data/states';

// Which course each state studies. The mapping lives in the server's
// catalogue now — adding a state is a row there, not a release in the App
// Store — and this is the app's view of it, with the three states the binary
// shipped with as the floor for a first launch with no network.
//
// There is no hardcoded "published course id": the active runtime course is
// whatever the device course store holds for the learner's state.

// A course id is a server-side identifier now, not a closed set the binary
// knows: a state added while this build was in the store carries one this
// build has never seen, and must still work.
export type CourseId = string;

export const DEFAULT_COURSE_ID: CourseId = 'ca-class-c';

export const courseIdForState = (stateCode: string): CourseId =>
  courseIdForStateCode(stateCode);
