import { SignArtSpec } from '@/components/SignArt';
import { signColors } from '@/theme';

import { QuizQuestion } from './curriculum';
// Named signsData.json (not signs.json) because Metro resolves `./signs` to a
// .json file before a .ts one — the data would shadow this module.
import rawSigns from './signsData.json';

export type SignCategory = {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
};

export type Sign = {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  description: string;
  steps: string[];
  trap: string;
  art: SignArtSpec;
};

export const signCategories = rawSigns.categories as SignCategory[];
export const signs = rawSigns.signs as Sign[];

export const categoryColor: Record<string, string> = {
  regulatory: signColors.regulatory,
  warning: signColors.warning,
  guide: signColors.guide,
  highway: signColors.highway,
  workzone: signColors.workzone,
};

export const signsByCategory = (categoryId: string): Sign[] =>
  signs.filter(sign => sign.categoryId === categoryId);

export const findSign = (signId: string): Sign | undefined =>
  signs.find(sign => sign.id === signId);

export const findCategory = (categoryId: string): SignCategory | undefined =>
  signCategories.find(category => category.id === categoryId);

export const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const OPTION_IDS = ['a', 'b', 'c', 'd'];

// Flashcard-style question generated from sign data: name the sign, three
// distractors drawn from the same category first.
export const signQuestion = (sign: Sign): QuizQuestion => {
  const sameCategory = signs.filter(
    other => other.categoryId === sign.categoryId && other.id !== sign.id,
  );
  const others = signs.filter(
    other => other.categoryId !== sign.categoryId && other.id !== sign.id,
  );
  const distractors = shuffle([
    ...shuffle(sameCategory).slice(0, 3),
    ...shuffle(others),
  ]).slice(0, 3);

  const options = shuffle([sign, ...distractors]).map((option, index) => ({
    id: OPTION_IDS[index],
    text: option.name,
    signId: option.id,
  }));

  return {
    id: `sq-${sign.id}`,
    prompt: 'What does this sign mean?',
    signId: sign.id,
    options: options.map(({ id, text }) => ({ id, text })),
    correctId: options.find(option => option.signId === sign.id)?.id ?? 'a',
    explanation: sign.description,
  };
};

export const signQuizQuestions = (
  count: number,
  categoryId?: string,
): QuizQuestion[] =>
  shuffle(categoryId != null ? signsByCategory(categoryId) : signs)
    .slice(0, count)
    .map(signQuestion);
