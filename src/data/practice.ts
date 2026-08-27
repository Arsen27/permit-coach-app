// How a session's questions get chosen.
//
// Four pools feed everything below: the course bank (state-specific,
// versioned, updated over the air), the authored practice bank
// (practiceQuestions.json), the authored right-of-way lesson (curriculum.ts),
// and one generated flashcard per road sign. "Authored" here means the last
// two together — the seed content that predates the course pipeline.
//
// Every draw is uniform random over its pool: `shuffle()` is Fisher-Yates on
// Math.random(), unseeded, so a retake is always a fresh paper and no past
// sitting can be reproduced. The two exams differ only in which pool they
// draw from and in what order they walk it — see examQuestions() and
// finalExamQuestions() below.
//
// Nothing here reads state/questionStats.ts. That per-question history
// (seen / correct / lastCorrect, and the mastery label derived from it) is
// display-only: the Practice bank map, the per-topic accuracy row, and an
// analytics property. There is no spaced repetition and no weighting toward
// weak or unseen material; the only history-driven session is `mistakes`,
// which the learner starts by hand.

import { IconName } from '@/assets/icons';

import {
  courseModules,
  courseQuestionIds,
  findCourseQuizQuestion,
} from './course/learn';
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

// Every question that belongs to a topic, as stable ids: the whole pool
// rather than the shuffled draw `topicQuestions` serves. This is what lets a
// topic be scored from the answer history alone, so a category still reports
// a standing when its own topic test was never taken.
export const topicQuestionIds = (topicId: string): string[] => {
  if (topicId === 'road-signs') {
    return signs.map(sign => `sq-${sign.id}`);
  }
  if (topicId === 'right-of-way') {
    return lessonBank.map(question => question.id);
  }
  return (practiceBank[topicId] ?? []).map(question => question.id);
};

export const quickMixQuestions = (): QuizQuestion[] =>
  shuffle([...authoredQuestions(), ...signQuizQuestions(10)]).slice(0, 10);

// Mock DMV knowledge test: 46 questions, real exam rules. The pool mixes the
// authored bank with sign flashcards to reach exam length.
//
// The mix is effectively fixed: the authored bank holds 32 questions, so this
// always takes 24 of them plus 22 signs. Two things follow, both open product
// questions rather than accidents of this code:
//   - the course bank never appears here, so the 200-odd state-specific
//     questions we ship and update are absent from the marquee exam;
//   - drawing 24 of 32 means two sittings overlap by ~18 questions, and
//     roughly half the paper is sign identification.
// Widening the pool is a content decision — see PC-13.
export const examQuestions = (): QuizQuestion[] => {
  const authored = shuffle(authoredQuestions());
  const fromSigns = signQuizQuestions(46 - Math.min(authored.length, 24));
  return shuffle([...authored.slice(0, 24), ...fromSigns]).slice(0, 46);
};

// Exam length and pass mark, shared by the Practice mock exam and the ladder's
// final exam. CA (and every state we ship) asks 46 questions and passes at 83%.
export const EXAM_LENGTH = 46;
export const EXAM_PASS_PERCENT = 83;

// The ladder's final exam: drawn from the course the learner just finished,
// never from the authored practice bank or the sign flashcards, so passing it
// means "I know this course".
//
// Questions are taken round-robin across modules rather than by a flat
// shuffle: a flat draw over a course whose modules differ in size can leave a
// whole unit unexamined, and this is the one test that claims to cover
// everything. Within a module the order is random, so a retake is a different
// paper.
export const finalExamQuestions = (
  length: number = EXAM_LENGTH,
): QuizQuestion[] => {
  const pools = courseModules().map(module =>
    shuffle([
      ...module.lessons.flatMap(
        lesson => lesson.testQuestionIds ?? lesson.questionIds,
      ),
      ...module.moduleTest.questionIds,
    ]),
  );

  const picked: string[] = [];
  const seen = new Set<string>();
  const deepest = pools.reduce((max, pool) => Math.max(max, pool.length), 0);
  for (let round = 0; round < deepest && picked.length < length; round += 1) {
    for (const pool of pools) {
      if (picked.length >= length) {
        break;
      }
      const id = pool[round];
      // A question referenced by both a lesson test and its module test must
      // not be asked twice in the same sitting.
      if (id != null && !seen.has(id)) {
        seen.add(id);
        picked.push(id);
      }
    }
  }

  // Shuffled again so the paper does not walk the course module by module.
  return shuffle(picked).flatMap(id => {
    const question = findCourseQuizQuestion(id);
    return question ? [question] : [];
  });
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
