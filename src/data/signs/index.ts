import { QuizQuestion } from '../curriculum';
import { SignsCatalog, signsStore } from './store';
import { Sign, SignCategory } from './wire';

export type {
  Sign,
  SignArtSpec,
  SignCategory,
  SignCategoryGlyph,
  SignSymbol,
} from './wire';

// The catalogue lives in signsStore (seed until a downloaded version has been
// committed — see store.ts). These exports are live bindings kept in step
// with the store, so every consumer — the screens, the quiz generator, the
// practice bank — reads the committed catalogue without knowing the store
// exists. Functions read at call time; the arrays are rebound on commit.

let catalog: SignsCatalog = signsStore.getSnapshot();

export let signsDeliveryVersion = catalog.deliveryVersion;
export let signCategories: SignCategory[] = catalog.categories;
export let signs: Sign[] = catalog.signs;

// Category colour is content, not theme: it must read as real-world signage.
export let categoryColor: Record<string, string> = Object.fromEntries(
  catalog.categories.map(category => [category.id, category.color]),
);

signsStore.subscribe(() => {
  catalog = signsStore.getSnapshot();
  signsDeliveryVersion = catalog.deliveryVersion;
  signCategories = catalog.categories;
  signs = catalog.signs;
  categoryColor = Object.fromEntries(
    catalog.categories.map(category => [category.id, category.color]),
  );
});

export const signsByCategory = (categoryId: string): Sign[] =>
  signsStore.getSnapshot().signsByCategoryId.get(categoryId) ?? [];

export const findSign = (signId: string): Sign | undefined =>
  signsStore.getSnapshot().signsById.get(signId);

export const findCategory = (categoryId: string): SignCategory | undefined =>
  signsStore.getSnapshot().categoriesById.get(categoryId);

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
