import {
  buildCards,
  cardAssetId,
  cardMetaFor,
  checkpointMetaFor,
} from '@/components/lesson/cards';
import type { LessonCard } from '@/components/lesson/cards';
import type { CardMeta } from '@/components/lesson/types';
import type { CompetitorLesson } from '@admin/api/types';
import type {
  CardStyleV2,
  CourseAssetV2,
  CourseQuestionV2,
  LessonDocV2,
  LessonElementV2,
} from '@/data/course/v2/wire';
import {
  blockElements,
  isBulletsElement,
  isCheckYourselfBlock,
  isDriveSmarterBlock,
  isImageBlock,
  isImageElement,
  isParagraphElement,
  isQuickChallengeBlock,
} from '@/data/course/v2/wire';

// The single unit the text view, the diff and the phone simulator all consume.
// It is produced through the app's own buildCards(), so what an editor sees is
// the card sequence a learner swipes through — images folded into the card they
// introduce, checkpoints standing on their own.

export type RenderOption = {
  id: string;
  text: string;
  correct: boolean;
};

// Where a line of `bodies` came from, so an inline edit in the phone preview
// can be written back to the exact element it was flattened out of.
export type BodyRef = { elementIndex: number; itemIndex?: number };

export type RenderCard = {
  key: string;
  type: string;
  kicker: CardMeta;
  title: string;
  ask?: string;
  bodies: string[];
  // Parallel to `bodies`, for cards rendered from an element list.
  bodyRefs?: BodyRef[];
  // The authored body of a teaching card, in order. Present for our own
  // lessons only — competitor captures have no element model.
  elements?: LessonElementV2[];
  // Our own artwork is a file named by its hash; competitor captures are
  // image files with their own URL.
  image?: {
    assetId: string;
    alt: string;
    sha256?: string;
    mime?: string;
    url?: string;
  };
  // Artwork placed inside the body, in reading order. Separate from `image`
  // because that one is the card's cover, drawn above the title.
  inlineImages?: {
    assetId: string;
    alt: string;
    sha256?: string;
    mime?: string;
  }[];
  options?: RenderOption[];
  optional?: boolean;
  // Where this card came from, so an edit can be written back to the document.
  // Competitor lessons are read-only and only carry their position.
  refs: {
    blockId?: string;
    questionId?: string;
    assetId?: string;
    sectionIndex?: number;
  };
};

export type LessonCards = {
  lessonId: string;
  title: string;
  cards: RenderCard[];
  // The lesson's own card list, kept so an editor can map a card back.
  source: LessonCard[];
};

const optionsOf = (question: CourseQuestionV2): RenderOption[] =>
  question.choices.map(choice => ({
    id: choice.id,
    text: choice.text,
    correct: choice.id === question.correctAnswerId,
  }));

// Body markdown is authored as paragraphs; splitting keeps the diff aligned
// paragraph by paragraph instead of treating a lesson as one long string.
const paragraphs = (markdown: string): string[] =>
  markdown
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(part => part.length > 0);

// The plain-text reading of an authored body, for the text view, the diff and
// the similarity search. Images contribute nothing here — they are compared as
// artwork, not as prose. Each line keeps a reference back to the element it
// came from, which is what makes the flattening reversible.
export const BULLET_PREFIX = '• ';

const bodiesOf = (
  elements: LessonElementV2[],
): { bodies: string[]; bodyRefs: BodyRef[] } => {
  const bodies: string[] = [];
  const bodyRefs: BodyRef[] = [];
  elements.forEach((element, elementIndex) => {
    if (isParagraphElement(element)) {
      if (element.text.trim().length > 0) {
        bodies.push(element.text);
        bodyRefs.push({ elementIndex });
      }
      return;
    }
    if (isBulletsElement(element)) {
      element.items.forEach((item, itemIndex) => {
        if (item.trim().length > 0) {
          bodies.push(`${BULLET_PREFIX}${item}`);
          bodyRefs.push({ elementIndex, itemIndex });
        }
      });
    }
  });
  return { bodies, bodyRefs };
};

export const renderCardsFromLessonDoc = (
  doc: LessonDocV2,
  stateLabel: string,
  cardStyles?: CardStyleV2[],
): LessonCards => {
  const questions = new Map(doc.questions.map(q => [q.questionId, q]));
  const assets = new Map(doc.assets.map(a => [a.assetId, a]));
  const source = buildCards(doc.lesson);

  const cards = source.map((card): RenderCard => {
    const { block } = card;
    const question =
      card.questionId != null ? questions.get(card.questionId) : undefined;
    const assetId = cardAssetId(card, question?.assetId);
    const asset: CourseAssetV2 | undefined =
      assetId != null ? assets.get(assetId) : undefined;
    const image =
      asset == null
        ? undefined
        : {
            assetId: asset.assetId,
            alt: asset.alt,
            sha256: asset.sha256,
            mime: asset.mime,
          };
    const refs = {
      blockId: block.blockId,
      questionId: card.questionId,
      assetId,
    };

    if (card.checkpoint && question != null) {
      return {
        key: card.key,
        type: 'checkpoint',
        kicker: {
          ...checkpointMetaFor(cardStyles),
          label: 'Checkpoint',
        },
        title: question.prompt,
        bodies: [],
        options: optionsOf(question),
        refs,
      };
    }

    const kicker = cardMetaFor(block, stateLabel, cardStyles);
    const elements = blockElements(block);
    const flattened = bodiesOf(elements);
    const inlineImages = elements.filter(isImageElement).map(element => {
      const inline = assets.get(element.assetId);
      return {
        assetId: element.assetId,
        alt: inline?.alt ?? '',
        ...(inline != null && { sha256: inline.sha256, mime: inline.mime }),
      };
    });

    if (isQuickChallengeBlock(block)) {
      return {
        key: card.key,
        type: block.type,
        kicker,
        title: block.title,
        ask: question?.prompt,
        bodies: paragraphs(block.scenario),
        image,
        options: question == null ? undefined : optionsOf(question),
        refs,
      };
    }

    if (isImageBlock(block)) {
      return {
        key: card.key,
        type: block.type,
        kicker,
        title: asset?.alt ?? '',
        bodies: [],
        image,
        refs,
      };
    }

    if (isCheckYourselfBlock(block)) {
      return {
        key: card.key,
        type: block.type,
        kicker,
        title: block.title,
        // The rule keeps its [[markers]] so the text view and the diff show
        // exactly which words the phone hides.
        bodies: [block.context, block.ruleMarkdown],
        image,
        refs,
      };
    }

    return {
      key: card.key,
      type: block.type,
      kicker,
      title: 'title' in block ? block.title : '',
      bodies: flattened.bodies,
      bodyRefs: flattened.bodyRefs,
      elements,
      inlineImages,
      image,
      optional: isDriveSmarterBlock(block) ? true : undefined,
      refs,
    };
  });

  return {
    lessonId: doc.lesson.lessonId,
    title: doc.lesson.title,
    cards,
    source,
  };
};

// Competitor lessons carry prose sections and a quiz rather than typed cards.
// Mapping them onto the same RenderCard keeps the text view, the diff and the
// prompt builder working across courses without special cases.
export const renderCardsFromCompetitor = (
  lesson: CompetitorLesson,
): LessonCards => {
  const cards: RenderCard[] = lesson.sections.map((section, index) => {
    const image = section.images[0];
    const bodies = [
      ...section.paragraphs,
      ...section.bullets.map(bullet => `• ${bullet}`),
      ...section.stateNotes,
      ...section.takeaways,
    ];
    return {
      key: `section-${index}`,
      type: 'section',
      kicker: {
        label: section.californiaSpecific
          ? 'California specific'
          : section.stateNotes.length > 0
          ? 'State notes'
          : index === 0
          ? 'Lesson opening'
          : 'Article section',
        icon: 'file-text',
        tone: section.californiaSpecific ? 'california' : 'muted',
      },
      title: section.heading ?? (index === 0 ? lesson.title : ''),
      bodies,
      image:
        image == null
          ? undefined
          : {
              assetId: image.src,
              alt: image.description ?? image.alt,
              url: image.src,
            },
      refs: { sectionIndex: index },
    };
  });

  const questions = (lesson.test?.questions ?? []).map(
    (question, index): RenderCard => ({
      key: `question-${question.number}`,
      type: 'quiz',
      kicker: { label: 'Quiz question', icon: 'list-check', tone: 'accent' },
      title: question.prompt,
      bodies: [],
      image:
        question.image == null
          ? undefined
          : {
              assetId: question.image.src,
              alt: question.image.description ?? question.image.alt,
              url: question.image.src,
            },
      options: question.options.map(option => ({
        id: option.letter,
        text: option.text,
        correct: option.letter === question.correctLetter,
      })),
      refs: { sectionIndex: lesson.sections.length + index },
    }),
  );

  return {
    lessonId: lesson.lessonId,
    title: lesson.title,
    cards: [...cards, ...questions],
    source: [],
  };
};

// Plain text of a card, for the prompt builder and the similarity search.
export const cardText = (card: RenderCard): string =>
  [
    card.title,
    card.ask,
    ...card.bodies,
    ...(card.options ?? []).map(o => o.text),
  ]
    .filter((part): part is string => part != null && part.length > 0)
    .join(' ');

export const cardWordCount = (card: RenderCard): number =>
  cardText(card).split(/\s+/).filter(Boolean).length;
