import { ImageSourcePropType } from 'react-native';

import { IconName } from '@/assets/icons';

// Copy and option sets for the onboarding flow (design: "DMV Prep —
// Onboarding" board). Icon tints reuse the app's soft-tile palette.

export type OptionTint = 'accent' | 'done' | 'warning' | 'error' | 'neutral';

export type QuestionOption = {
  id: string;
  label: string;
  // Second line under the label (the "how prepared" question uses it).
  sublabel?: string;
  icon?: IconName;
  tint?: OptionTint;
  // 1–4 filled bars drawn instead of an icon tile, for ranked answers.
  level?: number;
};

export type QuestionId =
  | 'reason'
  | 'permitStatus'
  | 'testHistory'
  | 'level'
  | 'ageBand';

export type OnboardingQuestion = {
  id: QuestionId;
  kicker: string;
  title: string;
  hint?: string;
  multi: boolean;
  options: QuestionOption[];
};

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'reason',
    kicker: 'About you · Question 1 of 6',
    title: 'What brings you to the DMV?',
    hint: 'This sets which rules we put first',
    multi: false,
    options: [
      {
        id: 'first-license',
        label: 'Getting my first license',
        icon: 'book-open',
        tint: 'accent',
      },
      {
        id: 'moved-to-us',
        label: 'I moved to the US',
        icon: 'arrow-up-right',
        tint: 'warning',
      },
      {
        id: 'moved-state',
        label: 'Moving from another state',
        icon: 'file-text',
        tint: 'done',
      },
      {
        id: 'renewing',
        label: 'Renewing my license',
        icon: 'circle-check',
        tint: 'accent',
      },
      {
        id: 'other',
        label: 'Something else',
        icon: 'person',
        tint: 'neutral',
      },
    ],
  },
  {
    id: 'permitStatus',
    kicker: 'About you · Question 2 of 6',
    title: 'Where are you on the road to a license?',
    multi: false,
    options: [
      {
        id: 'studying',
        label: "Studying for my learner's permit",
        icon: 'book-open',
        tint: 'accent',
      },
      {
        id: 'have-permit',
        label: 'I already have my permit',
        icon: 'check',
        tint: 'done',
      },
      {
        id: 'full-license',
        label: 'I have a full license already',
        icon: 'file-text',
        tint: 'warning',
      },
      {
        id: 'not-sure',
        label: 'Not sure yet',
        icon: 'person',
        tint: 'neutral',
      },
    ],
  },
  {
    id: 'testHistory',
    kicker: 'About you · Question 3 of 6',
    title: 'Have you taken the permit test before?',
    hint: 'No judgment — most people need more than one try',
    multi: false,
    options: [
      {
        id: 'first-attempt',
        label: 'No, this will be my first attempt',
        icon: 'book-open',
        tint: 'accent',
      },
      {
        id: 'failed-once',
        label: 'Yes, and I failed once',
        icon: 'xmark',
        tint: 'error',
      },
      {
        id: 'failed-twice-plus',
        label: 'Yes, and I failed more than once',
        icon: 'triangle-exclamation',
        tint: 'warning',
      },
      {
        id: 'passed',
        label: 'Yes, I passed it before',
        icon: 'check',
        tint: 'done',
      },
    ],
  },
  {
    id: 'level',
    kicker: 'About you · Question 4 of 6',
    title: 'How prepared do you feel right now?',
    hint: 'Your honest guess — we adjust after your first quiz anyway',
    multi: false,
    options: [
      {
        id: 'zero',
        label: 'Starting from zero',
        sublabel: 'I have not opened the handbook yet',
        level: 1,
      },
      {
        id: 'basics',
        label: 'I know the basics',
        sublabel: 'Signs and simple rules, but gaps elsewhere',
        level: 2,
      },
      {
        id: 'confident',
        label: 'Fairly confident',
        sublabel: 'I could pass most practice questions',
        level: 3,
      },
      {
        id: 'final-check',
        label: 'Just need a final check',
        sublabel: 'Only brushing up before test day',
        level: 4,
      },
    ],
  },
  {
    id: 'ageBand',
    kicker: 'About you · Question 6 of 6',
    title: 'How old are you?',
    hint: 'Requirements differ by age in every state',
    multi: false,
    options: [
      // The youngest band starts at 13 — PermitCoach is a 13+ app, so no
      // option may include under-13s.
      { id: '13-17', label: '13 – 17' },
      { id: '18-24', label: '18 – 24' },
      { id: '25-34', label: '25 – 34' },
      { id: '35-44', label: '35 – 44' },
      { id: '45-54', label: '45 – 54' },
      { id: '55-plus', label: '55 and older' },
    ],
  },
];

export const STATE_SELECT_STEP = {
  kicker: 'About you',
  title: 'Where will you take your test?',
  hint: 'Your course is built for that state\u2019s rules and exam',
} as const;

export const TEST_DATE_STEP = {
  kicker: 'About you · Question 5 of 6',
  title: 'When is your test booked?',
  hint: 'We pace your lessons to that date',
  unscheduledLabel: "My test isn't scheduled yet",
} as const;

export type ShowcaseSlide = {
  // A bundled illustration, or — while one is not drawn yet — the
  // placeholder caption naming the asset to produce.
  image?: ImageSourcePropType;
  placeholder?: string;
  title: string;
  body: string;
};

// Written without a lesson count on purpose: the course is downloaded after
// the showcases, and the number lives in the release, not in the app.
export const makeShowcaseSlides = (stateName: string): ShowcaseSlide[] => [
  {
    image: require('@/assets/images/showcase-lesson-ladder.png'),
    title: 'One clear path to your permit',
    body: 'Your course is one step-by-step ladder — lessons unlock in order, so you always know exactly what to study next.',
  },
  {
    image: require('@/assets/images/showcase-lesson-card.png'),
    title: 'Everything you need, cut down to what matters',
    body: `Every ${stateName} rule you are tested on, rewritten into bite-size lessons of a few minutes each. Every lesson ends with a short quiz.`,
  },
  {
    image: require('@/assets/images/showcase-practice.png'),
    title: 'Mistakes come back until they stick',
    body: "Anything you miss returns for review at the right moment — and a 46-question exam simulator shows you're ready before the real test.",
  },
];

// The whole pre-paywall flow in order. Questions, the date step and the
// showcases share one ladder-node strip, so a step's position in this list is
// both its ladder index and where "what comes next" is read from — no screen
// hard-codes its successor.
export type FlowStep =
  | { route: 'StateSelect' }
  | { route: 'Question'; index: number }
  | { route: 'TestDate' }
  | { route: 'Showcase'; index: number };

export const ONBOARDING_FLOW: FlowStep[] = [
  { route: 'StateSelect' },
  { route: 'Question', index: 0 },
  { route: 'Question', index: 1 },
  { route: 'Question', index: 2 },
  { route: 'Question', index: 3 },
  { route: 'TestDate' },
  // Age is asked after the date, per the board's question numbering.
  { route: 'Question', index: 4 },
  { route: 'Showcase', index: 0 },
  { route: 'Showcase', index: 1 },
  { route: 'Showcase', index: 2 },
];

export const LADDER_STEP_COUNT = ONBOARDING_FLOW.length;

export const questionLadderIndex = (index: number): number =>
  ONBOARDING_FLOW.findIndex(
    step => step.route === 'Question' && step.index === index,
  );

export const showcaseLadderIndex = (index: number): number =>
  ONBOARDING_FLOW.findIndex(
    step => step.route === 'Showcase' && step.index === index,
  );

export const TEST_DATE_LADDER_INDEX = ONBOARDING_FLOW.findIndex(
  step => step.route === 'TestDate',
);

// The step after `position`, or null at the end of the ladder (the caller
// then leaves for the Building loader).
export const stepAfter = (position: number): FlowStep | null =>
  ONBOARDING_FLOW[position + 1] ?? null;
