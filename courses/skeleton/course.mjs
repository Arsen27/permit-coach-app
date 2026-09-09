// The universal course skeleton: module structure shared by every state.
// Lesson content lives in ./modules/module-0N.mjs; a module marked
// `state: true` takes its lessons from the state package instead
// (courses/states/<xx>/lessons.mjs).

export const SKELETON_VERSION = 'SK-2026.09.06-r01';

export const MODULES = [
  {
    id: 'your-first-drive',
    title: 'Your First Drive',
    outcome: 'Make the basic decisions that appear on almost every drive.',
    file: 'module-01.mjs',
  },
  {
    id: 'read-the-road',
    title: 'Read the Road',
    outcome: 'Read signs, warnings, lines, arrows, and curb controls quickly.',
    file: 'module-02.mjs',
  },
  {
    id: 'everyday-moves',
    title: 'Intersections and Everyday Moves',
    outcome: 'Handle right-of-way, people, backing, U-turns, and parking.',
    file: 'module-03.mjs',
  },
  {
    id: 'lanes-passing-freeways',
    title: 'Lanes, Passing, and Freeways',
    outcome: 'Choose lanes, pass safely, merge, and use special lanes.',
    file: 'module-04.mjs',
  },
  {
    id: 'share-the-road',
    title: 'Share the Road',
    outcome: 'Protect road users who move, stop, and see differently.',
    file: 'module-05.mjs',
  },
  {
    id: 'hard-driving',
    title: 'When Driving Gets Hard',
    outcome: 'Stay in control when visibility, traction, or the vehicle fails.',
    file: 'module-06.mjs',
  },
  {
    id: 'driver-and-vehicle',
    title: 'The Driver and the Vehicle',
    outcome: 'Manage impairment, distraction, passengers, and vehicle safety.',
    file: 'module-07.mjs',
  },
  {
    id: 'pass-the-test',
    title: 'Pass the {{state}} Test',
    outcome:
      'Understand licensing rules and finish with exam-ready judgment.',
    state: true,
  },
];

// Literal numbers a universal card may contain without a placeholder: the
// emergency number and small counts that are not legal thresholds.
export const UNIVERSAL_LITERALS = ['911'];

// Words the builder refuses in universal content (titles, lines, bullets,
// recall rules, questions, alt text). A state name or agency must be a
// placeholder — {{state}}, {{agency}} — never a literal.
export const STATE_TOKENS =
  /\bCalifornia\b|\bCalifornians?\b|\bCVC\b|Vehicle Code|\bDMV\b|\bCaltrans\b|\bSacramento\b|\bCHP\b|\bCA\b|\bTexas\b|\bTexans?\b|\bDPS\b|\bTxDOT\b|\bTxDMV\b|\bTX\b|\bFlorida\b|\bFloridians?\b|\bFLHSMV\b|\bFDOT\b|\bFL\b|\bNOTS\b|\bALR\b/;

// The module test draws these lesson-test questions from each lesson.
export const MODULE_TEST_PICKS = [0, 2, 4];
