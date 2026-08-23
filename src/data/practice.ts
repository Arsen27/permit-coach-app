import { IconName } from '@/assets/icons';

import { courseQuestionIds, findCourseQuizQuestion } from './course/learn';
import { QuizQuestion, currentUnit } from './curriculum';
import rawPractice from './practiceQuestions.json';
import {
  findSign,
  shuffle,
  signQuestion,
  signQuizQuestions,
  signs,
} from './signs';

export type TopicTint = 'warning' | 'accent' | 'done' | 'neutral' | 'error';

export type PracticeTopic = {
  id: string;
  title: string;
  icon: IconName;
  tint: TopicTint;
};

export const PRACTICE_TOPICS: PracticeTopic[] = [
  {
    id: 'road-signs',
    title: 'Road signs',
    icon: 'triangle-exclamation',
    tint: 'warning',
  },
  {
    id: 'right-of-way',
    title: 'Right of way',
    icon: 'list-check',
    tint: 'accent',
  },
  {
    id: 'speed-lanes',
    title: 'Speed & lanes',
    icon: 'book-open',
    tint: 'done',
  },
  {
    id: 'parking-stopping',
    title: 'Parking & stopping',
    icon: 'file-text',
    tint: 'neutral',
  },
  {
    id: 'alcohol-penalties',
    title: 'Alcohol & penalties',
    icon: 'circle-check',
    tint: 'error',
  },
];

const practiceBank = rawPractice as Record<string, QuizQuestion[]>;

const lessonBank = currentUnit.lessons[0].questions;

const authoredQuestions = (): QuizQuestion[] => [
  ...lessonBank,
  ...Object.values(practiceBank).flat(),
];

export const topicQuestions = (topicId: string): QuizQuestion[] => {
  if (topicId === 'road-signs') {
    return signQuizQuestions(10);
  }
  if (topicId === 'right-of-way') {
    return shuffle(lessonBank);
  }
  return shuffle(practiceBank[topicId] ?? []);
};

export const quickMixQuestions = (): QuizQuestion[] =>
  shuffle([...authoredQuestions(), ...signQuizQuestions(10)]).slice(0, 10);

// Mock DMV knowledge test: 46 questions, real exam rules. The pool mixes the
// authored bank with sign flashcards to reach exam length.
export const examQuestions = (): QuizQuestion[] => {
  const authored = shuffle(authoredQuestions());
  const fromSigns = signQuizQuestions(46 - Math.min(authored.length, 24));
  return shuffle([...authored.slice(0, 24), ...fromSigns]).slice(0, 46);
};

// Resolves persisted question ids (saved questions / mistakes) back to
// questions; `sq-*` ids are regenerated from sign data.
export const findQuestionById = (id: string): QuizQuestion | undefined => {
  if (id.startsWith('sq-')) {
    const sign = findSign(id.slice(3));
    return sign != null ? signQuestion(sign) : undefined;
  }
  return (
    authoredQuestions().find(question => question.id === id) ??
    findCourseQuizQuestion(id)
  );
};

export const resolveQuestions = (ids: string[]): QuizQuestion[] =>
  ids
    .map(findQuestionById)
    .filter((question): question is QuizQuestion => question != null);

// Every question the app can ask, as stable ids: the course bank, the
// authored practice/lesson banks, and one flashcard per sign. This is the
// universe the Practice bank map is drawn over, so it must stay in step with
// what buildQuestions() can serve. Course content is versioned, so the list
// is rebuilt on each call rather than frozen at module load.
export const questionBankIds = (): string[] => [
  ...courseQuestionIds(),
  ...authoredQuestions().map(question => question.id),
  ...signs.map(sign => `sq-${sign.id}`),
];
