import { create } from 'zustand';

import { adminApi } from '@admin/api/adminApi';
import type { BankQuestion, LessonDocV2 } from '@admin/api/types';
import type {
  CourseAssetV2,
  CourseLessonV2,
  KnownBlockType,
  LessonBlockV2,
  LessonElementV2,
} from '@/data/course/v2/wire';
import {
  blockElements,
  blockStyleId,
  checkpointQuestionIdOf,
  isConceptBlock,
  isImageBlock,
  isProseBlock,
  recallSegments,
  withoutBlankElements,
} from '@/data/course/v2/wire';
import type { BodyRow, SlideKind } from '@admin/model/slides';
import type { UploadedArtwork } from '@admin/model/svg';
import {
  DEFAULT_TEACHING_TYPE,
  bodyRows,
  lessonSlides,
  moveRow,
  rowsToElements,
  newQuestion,
  nextAssetId,
  nextBlockId,
  nextQuestionId,
  newUuid,
  reconcileReferences,
  withElements,
  withSlideMoved,
} from '@admin/model/slides';

// The lesson currently being edited. Edits are held here as a working copy of
// the document and only reach the draft on save, so Discard is always exact.

type EditState = {
  editing: boolean;
  courseId: string | null;
  draftId: string | null;
  lessonId: string | null;
  versionKey: string | null;
  base: LessonDocV2 | null;
  draft: LessonDocV2 | null;
  saving: boolean;

  begin: (params: {
    courseId: string;
    draftId: string;
    versionKey: string;
    doc: LessonDocV2;
  }) => void;
  cancel: () => void;
  editBlock: (blockId: string, patch: Partial<LessonBlockV2>) => void;
  editQuestion: (questionId: string, patch: Partial<BankQuestion>) => void;
  removeImage: (blockId: string) => void;
  setAssetAlt: (assetId: string, alt: string) => void;
  replaceAsset: (assetId: string, svg: UploadedArtwork) => void;
  // Inserts a fresh image block (with its uploaded asset) before the given
  // block, or at the end of the lesson when beforeBlockId is null.
  addImage: (
    beforeBlockId: string | null,
    svg: UploadedArtwork,
    alt: string,
  ) => void;
  removeImageByAsset: (assetId: string) => void;

  // --- Slides -------------------------------------------------------------
  // A slide is one card the learner swipes to; see model/slides.ts for why
  // that is not always one block.
  moveSlide: (blockId: string, direction: -1 | 1) => void;
  removeSlide: (blockId: string) => void;
  // Inserts a new slide after the given one, or at the end when null.
  addSlide: (afterBlockId: string | null, kind: SlideKind) => void;
  // Which authored slide type draws the kicker.
  setSlideStyle: (blockId: string, styleId: string) => void;
  // Text, quiz or check-yourself. Converting mints or detaches the question
  // and the recall fields the target kind needs.
  setSlideKind: (blockId: string, kind: SlideKind) => void;
  // The block family behind a text slide, which is what a `state_specific` or
  // `drive_smarter` card still needs to be picked explicitly.
  setBlockType: (blockId: string, type: KnownBlockType) => void;
  // A text slide's follow-up checkpoint question.
  setCheckpoint: (blockId: string, on: boolean) => void;
  // The lesson-screen content: the intro copy the overview shows, and the
  // authored hero. Editing any intro field mints the whole intro from what
  // the app would otherwise derive, so the document says what the learner
  // already sees.
  editIntro: (patch: Partial<NonNullable<CourseLessonV2['intro']>>) => void;
  setHeroAsset: (art: UploadedArtwork | null, alt?: string) => void;
  // The picture one question shows. Minting a new asset id rather than
  // rewriting the old entry: a picture may be shared with a slide or another
  // question, and replacing this question's artwork must not redraw theirs.
  setQuestionPicture: (
    questionId: string,
    art: UploadedArtwork,
    alt: string,
  ) => void;
  clearQuestionPicture: (questionId: string) => void;
  // Which question from the course pool this slide asks. The question (and
  // the picture it carries) is adopted into the lesson document, because a
  // lesson is served self-contained; the one it replaces stays in the pool.
  setSlideQuestion: (
    blockId: string,
    slot: 'main' | 'checkpoint',
    question: BankQuestion,
    asset?: CourseAssetV2,
  ) => void;

  // The body of a block as editable rows. Derived, not stored.
  rowsOf: (blockId: string) => BodyRow[];

  // --- Slide body ---------------------------------------------------------
  // The body is edited a line at a time: see BodyRow in model/slides.ts for
  // why a row is not an element. Element-level access stays for the phone
  // preview, which edits in place and already knows the element it is on.
  setElements: (blockId: string, elements: LessonElementV2[]) => void;
  editElement: (
    blockId: string,
    index: number,
    element: LessonElementV2,
  ) => void;

  setRows: (blockId: string, rows: BodyRow[]) => void;
  editRow: (blockId: string, index: number, row: BodyRow) => void;
  addRow: (blockId: string, index: number, row: BodyRow) => void;
  removeRow: (blockId: string, index: number) => void;
  // `to` is the slot the row lands in, counted before the row is lifted out.
  moveRowTo: (blockId: string, from: number, to: number) => void;
  // Uploads artwork and drops it into the body as the row at `index`.
  addRowImage: (
    blockId: string,
    index: number,
    svg: UploadedArtwork,
    alt: string,
  ) => void;

  save: () => Promise<boolean>;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// A line left blank while writing is an editing artefact, not content. The
// renderers already skip it, but the document should not carry it either —
// the release validator sees exactly what is stored.
const withoutBlankLines = (doc: LessonDocV2): LessonDocV2 => {
  const next = clone(doc);
  // A key point left empty — "+ Add point" pressed and abandoned, or a line
  // cleared out — must not reach the draft: the release validator refuses
  // empty strings, and it refuses at release time, three screens later.
  if (next.lesson.intro != null) {
    const keyPoints = next.lesson.intro.keyPoints
      .map(point => point.trim())
      .filter(point => point.length > 0);
    next.lesson.intro = { ...next.lesson.intro, keyPoints };
  }
  next.lesson.blocks = next.lesson.blocks.map(block => {
    const content = (block as { content?: LessonElementV2[] }).content;
    if (!Array.isArray(content)) {
      return block;
    }
    const kept = withoutBlankElements(content);
    if (kept === content) {
      return block;
    }
    // A body emptied down to nothing still needs a line to exist as.
    return withElements(
      block,
      kept.length > 0 ? kept : [{ kind: 'paragraph', text: '' }],
    );
  });
  return next;
};

export const useEdit = create<EditState>((set, get) => ({
  editing: false,
  courseId: null,
  draftId: null,
  lessonId: null,
  versionKey: null,
  base: null,
  draft: null,
  saving: false,

  begin: ({ courseId, draftId, versionKey, doc }) =>
    set({
      editing: true,
      courseId,
      draftId,
      versionKey,
      lessonId: doc.lesson.lessonId,
      base: clone(doc),
      draft: clone(doc),
    }),

  cancel: () =>
    set({ editing: false, base: null, draft: null, lessonId: null }),

  editBlock: (blockId, patch) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.lesson.blocks = draft.lesson.blocks.map(block =>
        block.blockId === blockId
          ? ({ ...block, ...patch } as LessonBlockV2)
          : block,
      );
      return { draft };
    }),

  editQuestion: (questionId, patch) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.questions = draft.questions.map(question =>
        question.questionId === questionId
          ? { ...question, ...patch }
          : question,
      );
      return { draft };
    }),

  removeImage: blockId =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.lesson.blocks = draft.lesson.blocks.filter(
        block => block.blockId !== blockId,
      );
      reconcileReferences(draft);
      return { draft };
    }),

  setAssetAlt: (assetId, alt) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.assets = draft.assets.map(asset =>
        asset.assetId === assetId ? { ...asset, alt } : asset,
      );
      return { draft };
    }),

  replaceAsset: (assetId, svg) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.assets = draft.assets.map(asset =>
        asset.assetId === assetId
          ? {
              ...asset,
              mime: svg.mime as CourseAssetV2['mime'],
              width: svg.width,
              height: svg.height,
              sha256: svg.sha256,
              sizeBytes: svg.sizeBytes,
            }
          : asset,
      );
      return { draft };
    }),

  addImage: (beforeBlockId, svg, alt) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const assetId = nextAssetId(draft);
      const blockId = nextBlockId(draft);

      const asset: CourseAssetV2 = {
        assetId,
        uuid: newUuid(),
        mime: svg.mime as CourseAssetV2['mime'],
        width: svg.width,
        height: svg.height,
        alt,
        sha256: svg.sha256,
        sizeBytes: svg.sizeBytes,
      };

      const block = { blockId, type: 'image', assetId } as LessonBlockV2;
      const at =
        beforeBlockId == null
          ? draft.lesson.blocks.length
          : draft.lesson.blocks.findIndex(
              item => item.blockId === beforeBlockId,
            );
      draft.lesson.blocks.splice(
        at < 0 ? draft.lesson.blocks.length : at,
        0,
        block,
      );
      draft.assets = [...draft.assets, asset];
      reconcileReferences(draft);
      return { draft };
    }),

  removeImageByAsset: assetId =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.lesson.blocks = draft.lesson.blocks.filter(
        block =>
          !(
            block.type === 'image' &&
            'assetId' in block &&
            block.assetId === assetId
          ),
      );
      // Inline image elements pointing at the same artwork go with it.
      draft.lesson.blocks = draft.lesson.blocks.map(block => {
        const elements = blockElements(block);
        return elements.some(
          element => element.kind === 'image' && 'assetId' in element,
        )
          ? withElements(
              block,
              elements.filter(
                element =>
                  !(
                    element.kind === 'image' &&
                    (element as { assetId: string }).assetId === assetId
                  ),
              ),
            )
          : block;
      });
      reconcileReferences(draft);
      return { draft };
    }),

  // A mutation that can change what the document references. `mutate` gets a
  // deep copy to edit in place; references are put back in order afterwards so
  // no caller has to remember to.
  moveSlide: (blockId, direction) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.lesson.blocks = withSlideMoved(
        draft.lesson.blocks,
        blockId,
        direction,
      );
      return { draft };
    }),

  removeSlide: blockId =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const slide = lessonSlides(draft.lesson.blocks).find(
        item => item.blockId === blockId,
      );
      if (slide == null) {
        return {};
      }
      // A lesson with no blocks fails validation, and an empty editor is a
      // dead end — the last slide stays.
      if (draft.lesson.blocks.length - (slide.to - slide.from + 1) <= 0) {
        return {};
      }
      draft.lesson.blocks.splice(slide.from, slide.to - slide.from + 1);
      reconcileReferences(draft);
      return { draft };
    }),

  addSlide: (afterBlockId, kind) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const blockId = nextBlockId(draft);
      let block: LessonBlockV2;
      if (kind === 'recall') {
        block = {
          blockId,
          type: 'check_yourself',
          title: 'New recall card',
          context: 'Recall',
          ruleMarkdown: 'The rule, with the [[key words]] hidden.',
        };
      } else if (kind === 'quiz') {
        const questionId = nextQuestionId(draft);
        draft.questions = [
          ...draft.questions,
          newQuestion(questionId, 'opening_challenge', 'What should you do?'),
        ];
        block = {
          blockId,
          type: 'quick_challenge',
          title: 'New quiz slide',
          scenario: 'Set the scene for the question.',
          questionPreview: 'What should you do?',
          questionId,
        };
      } else {
        block = {
          blockId,
          type: DEFAULT_TEACHING_TYPE,
          title: 'New slide',
          bodyMarkdown: 'Write the teaching copy here.',
          content: [
            { kind: 'paragraph', text: 'Write the teaching copy here.' },
          ],
        };
      }
      const slides = lessonSlides(draft.lesson.blocks);
      const after =
        afterBlockId == null
          ? null
          : slides.find(slide => slide.blockId === afterBlockId);
      const at = after == null ? draft.lesson.blocks.length : after.to + 1;
      draft.lesson.blocks.splice(at, 0, block);
      reconcileReferences(draft);
      return { draft };
    }),

  setSlideStyle: (blockId, styleId) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.lesson.blocks = draft.lesson.blocks.map(block => {
        if (block.blockId !== blockId) {
          return block;
        }
        const next = { ...block } as Record<string, unknown>;
        // Asking for the family's own default is the same as asking for
        // nothing, and storing it would only add noise to the diff.
        if (styleId === block.type) {
          delete next.styleId;
        } else {
          next.styleId = styleId;
        }
        return next as LessonBlockV2;
      });
      return { draft };
    }),

  setBlockType: (blockId, type) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.lesson.blocks = draft.lesson.blocks.map(block => {
        if (block.blockId !== blockId) {
          return block;
        }
        const next = { ...block, type } as Record<string, unknown>;
        // `drive_smarter` is the one family with a required marker field.
        if (type === 'drive_smarter') {
          next.optional = true;
        } else {
          delete next.optional;
        }
        // A style that only existed to override the old family no longer
        // applies to the new one.
        if (next.styleId === block.type) {
          delete next.styleId;
        }
        return next as LessonBlockV2;
      });
      return { draft };
    }),

  // Converting a slide keeps the title and, where both kinds have one, the
  // body. Anything the target kind cannot hold is dropped, and the question a
  // quiz needs is minted on the way in and detached on the way out.
  setSlideKind: (blockId, kind) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const index = draft.lesson.blocks.findIndex(
        block => block.blockId === blockId,
      );
      if (index < 0) {
        return {};
      }
      const previous = draft.lesson.blocks[index];
      if (isImageBlock(previous)) {
        return {};
      }
      const title = 'title' in previous ? previous.title : 'Slide';
      const elements = blockElements(previous);
      const styleId = blockStyleId(previous);
      const keepStyle =
        styleId === previous.type ? {} : ({ styleId } as { styleId?: string });

      let next: LessonBlockV2;
      if (kind === 'recall') {
        next = {
          blockId,
          type: 'check_yourself',
          title,
          context: 'Recall',
          // Prose cannot become a recall rule on its own — the author has to
          // say which words to hide — so the first line seeds it with a hint.
          ruleMarkdown:
            'context' in previous
              ? (previous as { ruleMarkdown?: string }).ruleMarkdown ??
                'The rule, with the [[key words]] hidden.'
              : 'The rule, with the [[key words]] hidden.',
          ...keepStyle,
        };
      } else if (kind === 'quiz') {
        const existing =
          'questionId' in previous
            ? (previous as { questionId: string }).questionId
            : checkpointQuestionIdOf(previous);
        let questionId = existing;
        if (questionId == null) {
          questionId = nextQuestionId(draft);
          draft.questions = [
            ...draft.questions,
            newQuestion(questionId, 'opening_challenge', 'What should you do?'),
          ];
        }
        const question = draft.questions.find(
          item => item.questionId === questionId,
        );
        next = {
          blockId,
          type: 'quick_challenge',
          title,
          scenario:
            elements.length > 0
              ? elements
                  .filter(element => element.kind === 'paragraph')
                  .map(element => (element as { text: string }).text)
                  .join('\n\n')
              : 'Set the scene for the question.',
          questionPreview: question?.prompt ?? 'What should you do?',
          questionId,
          ...keepStyle,
        };
      } else {
        const type =
          previous.type === 'check_yourself' ||
          previous.type === 'quick_challenge'
            ? DEFAULT_TEACHING_TYPE
            : (previous.type as KnownBlockType);
        // Neither a quiz nor a recall card has an element body, but both hold
        // prose worth keeping: the scenario, and the rule with its gap markers
        // taken back out.
        const carried =
          previous.type === 'quick_challenge'
            ? (previous as { scenario: string }).scenario
            : previous.type === 'check_yourself'
            ? recallSegments(
                (previous as { ruleMarkdown: string }).ruleMarkdown,
              )
                .map(segment => segment.text)
                .join('')
            : null;
        const body =
          carried != null
            ? [{ kind: 'paragraph' as const, text: carried }]
            : elements.length > 0
            ? elements
            : [{ kind: 'paragraph' as const, text: 'Write the copy here.' }];
        next = withElements(
          {
            blockId,
            type,
            title,
            bodyMarkdown: '',
            ...(type === 'drive_smarter' && { optional: true }),
            ...keepStyle,
          } as LessonBlockV2,
          body,
        );
      }
      draft.lesson.blocks[index] = next;
      reconcileReferences(draft);
      return { draft };
    }),

  editIntro: patch =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const lesson = draft.lesson;
      // The same numbers the app derives when no intro is authored, so the
      // first edit changes one field, not four.
      const effective = lesson.intro ?? {
        summary: lesson.objective,
        keyPoints: [
          'Learn the rule behind the most common exam scenarios.',
          'See the trap that makes a plausible answer wrong.',
          'Check your understanding with a short test.',
        ],
        theoryMinutes: Math.max(
          4,
          Number.parseInt(lesson.estimatedMinutes, 10) || 6,
        ),
        testMinutes: Math.max(2, Math.ceil(lesson.questionIds.length / 2)),
      };
      lesson.intro = { ...effective, ...patch };
      return { draft };
    }),

  setHeroAsset: (art, alt) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      if (art == null) {
        // Back to the derived hero — the first picture a slide shows.
        delete draft.lesson.heroAssetId;
        reconcileReferences(draft);
        return { draft };
      }
      const assetId = `${draft.lesson.lessonId}-hero`;
      const existing = draft.assets.find(asset => asset.assetId === assetId);
      draft.assets = [
        ...draft.assets.filter(asset => asset.assetId !== assetId),
        {
          assetId,
          uuid: existing?.uuid ?? newUuid(),
          mime: art.mime as CourseAssetV2['mime'],
          width: art.width,
          height: art.height,
          alt: alt ?? existing?.alt ?? 'Lesson opening illustration',
          sha256: art.sha256,
          sizeBytes: art.sizeBytes,
        },
      ];
      draft.lesson.heroAssetId = assetId;
      reconcileReferences(draft);
      return { draft };
    }),

  setQuestionPicture: (questionId, art, alt) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const question = draft.questions.find(
        item => item.questionId === questionId,
      );
      if (question == null) {
        return {};
      }
      const sharedWithAnother =
        question.assetId != null &&
        (draft.lesson.assetIds.includes(question.assetId) ||
          draft.questions.some(
            item =>
              item.questionId !== questionId &&
              item.assetId === question.assetId,
          ));
      const assetId =
        question.assetId != null && !sharedWithAnother
          ? question.assetId
          : `${questionId}-img`;
      const existing = draft.assets.find(asset => asset.assetId === assetId);
      const next = {
        assetId,
        uuid: existing?.uuid ?? newUuid(),
        mime: art.mime as CourseAssetV2['mime'],
        width: art.width,
        height: art.height,
        alt: existing?.alt ?? alt,
        sha256: art.sha256,
        sizeBytes: art.sizeBytes,
      };
      draft.assets = [
        ...draft.assets.filter(asset => asset.assetId !== assetId),
        next,
      ];
      question.assetId = assetId;
      reconcileReferences(draft);
      return { draft };
    }),

  clearQuestionPicture: questionId =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const question = draft.questions.find(
        item => item.questionId === questionId,
      );
      if (question == null) {
        return {};
      }
      delete question.assetId;
      // reconcileReferences drops an asset nothing points at any more.
      reconcileReferences(draft);
      return { draft };
    }),

  setSlideQuestion: (blockId, slot, question, asset) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const index = draft.lesson.blocks.findIndex(
        item => item.blockId === blockId,
      );
      if (index < 0) {
        return {};
      }
      // The pool's copy wins: the same id may already be here with older
      // text. The owning lesson is a listing detail, not part of a question.
      const adopted: BankQuestion = { ...question };
      delete (adopted as Partial<BankQuestion>).lessonId;
      draft.questions = [
        ...draft.questions.filter(
          item => item.questionId !== adopted.questionId,
        ),
        adopted,
      ];
      if (
        asset != null &&
        !draft.assets.some(a => a.assetId === asset.assetId)
      ) {
        draft.assets = [...draft.assets, asset];
      }
      const block = { ...draft.lesson.blocks[index] } as Record<
        string,
        unknown
      >;
      if (slot === 'checkpoint') {
        block.checkpointQuestionId = adopted.questionId;
      } else {
        block.questionId = adopted.questionId;
        // The preview line is the question as the deck advertises it.
        block.questionPreview = adopted.prompt;
      }
      draft.lesson.blocks[index] = block as LessonBlockV2;
      reconcileReferences(draft);
      return { draft };
    }),

  setCheckpoint: (blockId, on) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const index = draft.lesson.blocks.findIndex(
        block => block.blockId === blockId,
      );
      if (index < 0) {
        return {};
      }
      const target = draft.lesson.blocks[index];
      // `checkpointQuestionIdOf` only reads concept and prose blocks; hanging
      // one anywhere else would leave a question no card ever asks.
      if (!isConceptBlock(target) && !isProseBlock(target)) {
        return {};
      }
      const block = { ...target } as Record<string, unknown>;
      if (on) {
        if (block.checkpointQuestionId != null) {
          return {};
        }
        const questionId = nextQuestionId(draft);
        draft.questions = [
          ...draft.questions,
          newQuestion(
            questionId,
            'lesson_checkpoint',
            'Check the learner understood this card.',
          ),
        ];
        block.checkpointQuestionId = questionId;
      } else {
        delete block.checkpointQuestionId;
      }
      draft.lesson.blocks[index] = block as LessonBlockV2;
      reconcileReferences(draft);
      return { draft };
    }),

  setElements: (blockId, elements) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      draft.lesson.blocks = draft.lesson.blocks.map(block =>
        block.blockId === blockId ? withElements(block, elements) : block,
      );
      reconcileReferences(draft);
      return { draft };
    }),

  editElement: (blockId, index, element) => {
    const block = get().draft?.lesson.blocks.find(
      item => item.blockId === blockId,
    );
    if (block == null) {
      return;
    }
    const elements = [...blockElements(block)];
    if (elements[index] == null) {
      return;
    }
    elements[index] = element;
    get().setElements(blockId, elements);
  },

  setRows: (blockId, rows) => get().setElements(blockId, rowsToElements(rows)),

  editRow: (blockId, index, row) => {
    const rows = get().rowsOf(blockId);
    if (rows[index] == null) {
      return;
    }
    const next = [...rows];
    next[index] = row;
    get().setRows(blockId, next);
  },

  addRow: (blockId, index, row) => {
    const rows = [...get().rowsOf(blockId)];
    rows.splice(Math.max(0, Math.min(index, rows.length)), 0, row);
    get().setRows(blockId, rows);
  },

  removeRow: (blockId, index) => {
    const rows = get().rowsOf(blockId);
    get().setRows(
      blockId,
      rows.filter((_, at) => at !== index),
    );
  },

  moveRowTo: (blockId, from, to) =>
    get().setRows(blockId, moveRow(get().rowsOf(blockId), from, to)),

  rowsOf: blockId => {
    const block = get().draft?.lesson.blocks.find(
      item => item.blockId === blockId,
    );
    return block == null ? [] : bodyRows(blockElements(block));
  },

  addRowImage: (blockId, index, svg, alt) =>
    set(state => {
      if (state.draft == null) {
        return {};
      }
      const draft = clone(state.draft);
      const block = draft.lesson.blocks.find(item => item.blockId === blockId);
      if (block == null) {
        return {};
      }
      const assetId = nextAssetId(draft);
      const asset: CourseAssetV2 = {
        assetId,
        uuid: newUuid(),
        mime: svg.mime as CourseAssetV2['mime'],
        width: svg.width,
        height: svg.height,
        alt,
        sha256: svg.sha256,
        sizeBytes: svg.sizeBytes,
      };
      draft.assets = [...draft.assets, asset];
      const rows = bodyRows(blockElements(block));
      rows.splice(Math.max(0, Math.min(index, rows.length)), 0, {
        kind: 'image',
        assetId,
      });
      const elements = rowsToElements(rows);
      draft.lesson.blocks = draft.lesson.blocks.map(item =>
        item.blockId === blockId ? withElements(item, elements) : item,
      );
      reconcileReferences(draft);
      return { draft };
    }),

  save: async () => {
    const { courseId, draftId, lessonId, draft } = get();
    if (
      courseId == null ||
      draftId == null ||
      lessonId == null ||
      draft == null
    ) {
      return false;
    }
    set({ saving: true });
    try {
      await adminApi.saveDraftLesson(
        courseId,
        draftId,
        lessonId,
        withoutBlankLines(draft),
      );
      set({ saving: false, editing: false, base: null, draft: null });
      return true;
    } catch {
      set({ saving: false });
      return false;
    }
  },
}));

// How many authored fields differ from what the draft held when editing began.
export const changedFieldCount = (state: EditState): number => {
  if (state.base == null || state.draft == null) {
    return 0;
  }
  let changed = 0;

  const baseBlocks = new Map(
    state.base.lesson.blocks.map(block => [block.blockId, block]),
  );
  for (const block of state.draft.lesson.blocks) {
    const before = baseBlocks.get(block.blockId) as Record<string, unknown>;
    const after = block as Record<string, unknown>;
    if (before == null) {
      changed += 1;
      continue;
    }
    for (const key of [
      'title',
      'bodyMarkdown',
      'scenario',
      'questionPreview',
      'context',
      'ruleMarkdown',
      'type',
      'styleId',
      'checkpointQuestionId',
    ]) {
      if (before[key] !== after[key]) {
        changed += 1;
      }
    }
    // The authored body is a list, and each element is a field of its own —
    // editing two paragraphs of one slide has to read as two changes.
    const beforeElements = blockElements(before as LessonBlockV2);
    const afterElements = blockElements(after as LessonBlockV2);
    for (
      let index = 0;
      index < Math.max(beforeElements.length, afterElements.length);
      index += 1
    ) {
      if (
        JSON.stringify(beforeElements[index] ?? null) !==
        JSON.stringify(afterElements[index] ?? null)
      ) {
        changed += 1;
      }
    }
  }
  if (state.draft.lesson.blocks.length !== state.base.lesson.blocks.length) {
    changed += Math.abs(
      state.draft.lesson.blocks.length - state.base.lesson.blocks.length,
    );
  } else if (
    state.draft.lesson.blocks.some(
      (block, index) =>
        block.blockId !== state.base!.lesson.blocks[index]?.blockId,
    )
  ) {
    // Same slides, different order: one change, not one per slide.
    changed += 1;
  }

  const baseAssets = new Map(
    state.base.assets.map(asset => [asset.assetId, asset]),
  );
  for (const asset of state.draft.assets) {
    const before = baseAssets.get(asset.assetId);
    if (before == null) {
      changed += 1;
      continue;
    }
    if (before.alt !== asset.alt) {
      changed += 1;
    }
    if (before.sha256 !== asset.sha256) {
      changed += 1;
    }
  }

  const baseQuestions = new Map(
    state.base.questions.map(question => [question.questionId, question]),
  );
  for (const question of state.draft.questions) {
    const before = baseQuestions.get(question.questionId);
    if (before == null) {
      changed += 1;
      continue;
    }
    if (before.prompt !== question.prompt) {
      changed += 1;
    }
    if (before.correctAnswerId !== question.correctAnswerId) {
      changed += 1;
    }
    question.choices.forEach(choice => {
      const previous = before.choices.find(item => item.id === choice.id);
      if (previous == null || previous.text !== choice.text) {
        changed += 1;
      }
    });
    if (before.choices.length > question.choices.length) {
      changed += before.choices.length - question.choices.length;
    }
  }

  return changed;
};
