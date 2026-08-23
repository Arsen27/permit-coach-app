export type QuizOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  imageUrl?: string;
  imageCaption?: string;
  imageHeight?: number;
  signId?: string;
  // Course SVG asset rendered via CourseAssetView (offline, embedded XML).
  assetId?: string;
  options: QuizOption[];
  correctId: string;
  explanation: string;
  // Per-choice feedback shown for the choice the learner picked; falls back
  // to `explanation` when absent.
  feedbackByChoiceId?: Record<string, string>;
};

export type LessonTheory = {
  minutes: number;
  heroCaption: string;
  title: string;
  lead: string;
  rulesHeading: string;
  rules: string[];
  signsHeading: string;
  signIds: string[];
  signCaptions: string[];
  diagramCaption: string;
  tip: string;
};

export type Lesson = {
  id: string;
  title: string;
  theory: LessonTheory;
  questions: QuizQuestion[];
};

export type Unit = {
  id: string;
  title: string;
  lessons: Lesson[];
};

// Legacy placeholder curriculum. The Learn tab now renders the published
// course from `@/data/course`; this unit remains only as the question source
// for the right-of-way practice topic and as a theory fallback.
const rightOfWayQuestions: QuizQuestion[] = [
  {
    id: 'row-1',
    prompt:
      'You and another car reach a four-way stop at the same time. Who goes first?',
    options: [
      { id: 'a', text: 'The driver on the right' },
      { id: 'b', text: 'The driver on the left' },
      { id: 'c', text: 'Whoever entered the intersection faster' },
      { id: 'd', text: 'The larger vehicle' },
    ],
    correctId: 'a',
    explanation:
      'Arrive at the same time? The driver on the right goes first — rule 2.',
  },
  {
    id: 'row-2',
    prompt:
      'At an uncontrolled intersection, another car arrived clearly before you. What do you do?',
    imageCaption: 'diagram — uncontrolled intersection',
    imageHeight: 166,
    options: [
      { id: 'a', text: 'Yield — whoever arrives first goes first' },
      { id: 'b', text: 'Go — you are on the through road' },
      { id: 'c', text: 'Sound your horn and proceed' },
      { id: 'd', text: 'Wave the other driver through' },
    ],
    correctId: 'a',
    explanation:
      'Whoever arrives first goes first — rule 1 applies even with no signs.',
  },
  {
    id: 'row-3',
    prompt: 'The blue car wants to turn left. Who has to yield?',
    imageCaption: 'diagram — blue car turning left',
    imageHeight: 186,
    options: [
      { id: 'a', text: 'The blue car, to all oncoming traffic' },
      { id: 'b', text: 'The white car, because it is on the left' },
      { id: 'c', text: 'Neither — they arrived at the same time' },
      { id: 'd', text: 'Whoever signals first' },
    ],
    correctId: 'a',
    explanation:
      'Turning left? You yield to everyone coming straight — rule 3.',
  },
  {
    id: 'row-4',
    prompt: 'You approach a YIELD sign and see cross traffic. You must:',
    options: [
      { id: 'a', text: 'Slow down and stop if needed to let traffic pass' },
      { id: 'b', text: 'Always come to a complete stop' },
      { id: 'c', text: 'Keep your speed — cross traffic yields to you' },
      { id: 'd', text: 'Change lanes to avoid the sign' },
    ],
    correctId: 'a',
    explanation:
      'A YIELD sign means slow down and be ready to stop, but only stop when traffic requires it.',
  },
  {
    id: 'row-5',
    prompt: 'At a STOP sign with no other traffic around, you should:',
    options: [
      { id: 'a', text: 'Come to a full stop, then go when safe' },
      { id: 'b', text: 'Slow to walking pace and roll through' },
      { id: 'c', text: 'Stop only if a camera is present' },
      { id: 'd', text: 'Treat it like a yield sign' },
    ],
    correctId: 'a',
    explanation:
      'A STOP sign always requires a complete stop — even with no one in sight.',
  },
  {
    id: 'row-6',
    prompt:
      'A pedestrian starts crossing at an unmarked crosswalk as you approach. You must:',
    options: [
      { id: 'a', text: 'Stop and let them cross' },
      { id: 'b', text: 'Slow down and drive around them' },
      { id: 'c', text: 'Honk so they hurry up' },
      { id: 'd', text: 'Continue — unmarked crossings give you priority' },
    ],
    correctId: 'a',
    explanation:
      'Pedestrians have the right-of-way at crosswalks, marked or not.',
  },
  {
    id: 'row-7',
    prompt:
      'An emergency vehicle approaches behind you with lights and siren on. You should:',
    options: [
      { id: 'a', text: 'Pull to the right edge of the road and stop' },
      { id: 'b', text: 'Speed up to clear the road ahead' },
      { id: 'c', text: 'Stop immediately where you are' },
      { id: 'd', text: 'Pull to the left shoulder' },
    ],
    correctId: 'a',
    explanation: 'Move right and stop until the emergency vehicle has passed.',
  },
  {
    id: 'row-8',
    prompt:
      'You are entering a T-intersection from the road that ends. Who has the right-of-way?',
    options: [
      { id: 'a', text: 'Traffic on the through road' },
      { id: 'b', text: 'You — you arrived at the intersection first' },
      { id: 'c', text: 'Whoever is turning right' },
      { id: 'd', text: 'The vehicle on the smaller road' },
    ],
    correctId: 'a',
    explanation:
      'At a T-intersection, drivers on the ending road yield to all traffic on the through road.',
  },
];

const rightOfWayTheory: LessonTheory = {
  minutes: 4,
  heroCaption: 'photo — four-way stop, driver POV',
  title: 'Who goes first at an intersection',
  lead: 'Right-of-way rules are not about who is allowed to go — they decide who must yield. You never hold the right of way until another driver gives it to you.',
  rulesHeading: 'The three basic rules',
  rules: [
    'Whoever arrives first goes first.',
    'Arrive at the same time? The driver on the right goes first.',
    'Turning left? Yield to everyone coming straight.',
  ],
  signsHeading: 'Signs that decide for you',
  signIds: ['stop', 'yield', 'do-not-enter'],
  signCaptions: [
    'Full stop, then yield',
    'Slow, stop if needed',
    'Do not enter',
  ],
  diagramCaption: 'diagram — uncontrolled intersection',
  tip: 'Two of the eight questions ask about left turns. Read rule 3 twice.',
};

const lesson = (id: string, title: string): Lesson => ({
  id,
  title,
  theory: rightOfWayTheory,
  questions: rightOfWayQuestions,
});

export const currentUnit: Unit = {
  id: 'road-rules-1',
  title: 'Road rules I',
  lessons: [
    lesson('right-of-way-1', 'Right of way I'),
    lesson('your-vehicle', 'Your vehicle'),
    lesson('road-markings-1', 'Road markings I'),
    lesson('right-of-way-2', 'Right of way II'),
    lesson('indicating-signaling', 'Indicating & signaling'),
    lesson('warning-signs-1', 'Warning signs I'),
    lesson('speed-limits-1', 'Speed limits I'),
  ],
};

export const nextUnitTitle = 'Road rules II';

export const findLesson = (lessonId: string): Lesson | undefined =>
  currentUnit.lessons.find(item => item.id === lessonId);

export const lessonNumber = (lessonId: string): number =>
  currentUnit.lessons.findIndex(item => item.id === lessonId) + 1;
