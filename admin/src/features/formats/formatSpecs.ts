import { CARD_META } from '@/components/lesson/cards';
import type { KnownBlockType } from '@/data/course/v2/wire';

// What each card type is for. The labels, icons and colours come from the same
// table the app renders with, so this screen can never describe a card the
// player draws differently.

export type FormatSpec = {
  type: KnownBlockType | 'checkpoint' | 'section' | 'quiz';
  label: string;
  tone: string;
  who: string;
  fields: string;
  rules: string;
  api: string;
};

const meta = (type: KnownBlockType) => CARD_META[type];

export const CARD_FORMATS: FormatSpec[] = [
  {
    type: 'quick_challenge',
    label: meta('quick_challenge').label,
    tone: meta('quick_challenge').tone,
    who: 'Opens the lesson with a road situation the learner answers before any theory. A wrong answer costs nothing — the point is curiosity.',
    fields: 'blockId, title, scenario, questionPreview, questionId',
    rules:
      'Always the first card · its question is the lesson’s opening_challenge',
    api: '"type":"quick_challenge"',
  },
  {
    type: 'why_it_matters',
    label: meta('why_it_matters').label,
    tone: meta('why_it_matters').tone,
    who: 'Why the topic matters on the exam and on the road. Motivation only, no rules yet.',
    fields: 'blockId, title, bodyMarkdown',
    rules: 'No question · usually the second card',
    api: '"type":"why_it_matters"',
  },
  {
    type: 'image',
    label: meta('image').label,
    tone: meta('image').tone,
    who: 'A diagram on its own. The player folds it into the card that follows, so it illustrates that card rather than standing alone.',
    fields: 'blockId, assetId',
    rules:
      'Folded into the next card unless it is last · SVG is embedded in the lesson',
    api: '"type":"image"',
  },
  {
    type: 'core_rule',
    label: meta('core_rule').label,
    tone: meta('core_rule').tone,
    who: 'The rule of the lesson in the plainest words available. The one card a learner must remember.',
    fields: 'blockId, title, bodyMarkdown, checkpointQuestionId?',
    rules:
      'At least one per lesson · a checkpoint becomes its own card after it',
    api: '"type":"core_rule"',
  },
  {
    type: 'visual_example',
    label: meta('visual_example').label,
    tone: meta('visual_example').tone,
    who: 'The rule applied to one concrete situation, usually with the diagram that precedes it.',
    fields: 'blockId, title, bodyMarkdown, checkpointQuestionId?',
    rules:
      'Pairs with an image block · keep the text under two short paragraphs',
    api: '"type":"visual_example"',
  },
  {
    type: 'related_rule',
    label: meta('related_rule').label,
    tone: meta('related_rule').tone,
    who: 'A neighbouring rule or the exception that most often trips people up.',
    fields: 'blockId, title, bodyMarkdown, checkpointQuestionId?',
    rules: 'One per lesson · never contradicts the core rule',
    api: '"type":"related_rule"',
  },
  {
    type: 'state_specific',
    label: 'State specific',
    tone: meta('state_specific').tone,
    who: 'The numbers and exceptions of one state. Each state is its own course, so this card carries that state’s values and the kicker names it.',
    fields: 'blockId, title, bodyMarkdown, checkpointQuestionId?',
    rules:
      'California’s course still uses the older california_specific key · both render identically',
    api: '"type":"state_specific" | "california_specific"',
  },
  {
    type: 'exam_trap',
    label: meta('exam_trap').label,
    tone: meta('exam_trap').tone,
    who: 'The tempting wrong belief the exam exploits, then the correction.',
    fields: 'blockId, title, bodyMarkdown',
    rules: 'Amber styling · at most one per lesson',
    api: '"type":"exam_trap"',
  },
  {
    type: 'drive_smarter',
    label: meta('drive_smarter').label,
    tone: meta('drive_smarter').tone,
    who: 'Real-world habit beyond the exam. The player offers a Skip, so it must never carry a testable fact.',
    fields: 'blockId, title, bodyMarkdown, optional: true',
    rules: 'Marked optional · skippable in the player',
    api: '"type":"drive_smarter"',
  },
  {
    type: 'remember_this',
    label: meta('remember_this').label,
    tone: meta('remember_this').tone,
    who: 'The lesson in one breath, drawn as a recap card the learner should be able to recite.',
    fields: 'blockId, title, bodyMarkdown',
    rules: 'Always the last card · introduces nothing new',
    api: '"type":"remember_this"',
  },
  {
    type: 'checkpoint',
    label: 'Checkpoint',
    tone: 'accent',
    who: 'A scored question that belongs to the card before it. The player splits it out so the answer feedback can own the footer.',
    fields:
      'questionId, prompt, choices[] (id, text, feedback), correctAnswerId, explanation, assetId?',
    rules:
      'Not a block — comes from checkpointQuestionId · four per lesson · counts toward the lesson score',
    api: '"kind":"lesson_checkpoint"',
  },
];

export const COMPETITOR_FORMATS: FormatSpec[] = [
  {
    type: 'section',
    label: 'Article section',
    tone: 'muted',
    who: 'A continuous prose section of an article-format lesson, the way Zutobi presents its course.',
    fields: 'heading, paragraphs[], images[], bullets[]',
    rules: 'Competitor courses only · read-only in this panel',
    api: '"type":"section"',
  },
  {
    type: 'quiz',
    label: 'Quiz question',
    tone: 'accent',
    who: 'An end-of-lesson question from a competitor capture, with its options as they were shown.',
    fields: 'prompt, options[] (letter, text), correctLetter',
    rules:
      'Competitor courses only · the answer is taken from the capture, never inferred',
    api: '"type":"quiz"',
  },
];

export const LESSON_CONSTRAINTS =
  'Every lesson is 12 blocks that the player turns into 13 cards: three images fold into the cards they introduce, and four checkpoints become cards of their own. One opening challenge plus four checkpoints make five questions per lesson. A lesson always ends with Remember this and always carries at least one Core rule; a block type the app does not know renders as a plain fallback card rather than breaking the deck.';

// What the table above cannot say: the families are fixed, but their look and
// their bodies are not.
export const AUTHORING_NOTES =
  'The table is the built-in set. A course may retitle, re-icon and recolour any of these families, or define slide types of its own for a block to opt into — the family still decides what the card does, the type only decides how its kicker reads. A teaching body is an ordered list of paragraphs, bullet lists and illustrations, so artwork can sit anywhere in the prose rather than only above the title. Blocks authored before that carry plain markdown and are read as the same list.';
