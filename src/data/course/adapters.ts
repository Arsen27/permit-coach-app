// Bridges v2 course content into the shape the quiz engine consumes. Pure
// mapping only — nothing here decides visibility; the active course is
// whatever the device course store serves.

import { QuizQuestion } from '@/data/curriculum';

import type { CourseQuestionV2 } from './v2/wire';

export const toQuizQuestion = (question: CourseQuestionV2): QuizQuestion => ({
  id: question.questionId,
  prompt: question.prompt,
  options: question.choices.map(choice => ({
    id: choice.id,
    text: choice.text,
  })),
  correctId: question.correctAnswerId,
  explanation: question.explanation,
  ...(question.assetId !== undefined && { assetId: question.assetId }),
  feedbackByChoiceId: Object.fromEntries(
    question.choices.map(choice => [choice.id, choice.feedback]),
  ),
});
