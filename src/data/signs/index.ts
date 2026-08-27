import { QuizQuestion } from '../curriculum';
// Named signsData.json (not signs.json) because Metro resolves `./signs` to a
// .json file before a .ts one — the data would shadow this module.
import rawSigns from './signsData.json';
import { Sign, SignCategory, validateSignsDoc } from './wire';

export type {
  Sign,
  SignArtSpec,
  SignCategory,
  SignCategoryGlyph,
  SignSymbol,
} from './wire';

// The bundled catalogue goes through the same validator an authored document
// would: the seed is content like any other, and a cast here is exactly the
// kind of unchecked trust the wire format exists to remove. A broken seed is
// a build-time mistake, so it throws rather than degrading — there is no
// earlier version to fall back to.
const seed = validateSignsDoc(rawSigns);

if (!seed.ok) {
  throw new Error(
    `bundled signs catalogue is invalid: ${seed.errors.join('; ')}`,
  );
}

export const signsDeliveryVersion = seed.value.deliveryVersion;
export const signCategories: SignCategory[] = seed.value.categories;
export const signs: Sign[] = seed.value.signs;

const categoriesById = new Map(signCategories.map(c => [c.id, c]));
const signsById = new Map(signs.map(s => [s.id, s]));

// Category colour is content, not theme: it must read as real-world signage.
export const categoryColor: Record<string, string> = Object.fromEntries(
  signCategories.map(category => [category.id, category.color]),
);

export const signsByCategory = (categoryId: string): Sign[] =>
  signs.filter(sign => sign.categoryId === categoryId);

export const findSign = (signId: string): Sign | undefined =>
  signsById.get(signId);

export const findCategory = (categoryId: string): SignCategory | undefined =>
  categoriesById.get(categoryId);

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
