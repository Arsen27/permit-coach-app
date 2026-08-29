import {
  COURSE_SCHEMA_VERSION,
  MAX_ID_LENGTH,
  isCheckYourselfBlock,
  isConceptBlock,
  isImageBlock,
  isKnownBlockType,
  isProseBlock,
  isQuickChallengeBlock,
  recallGapErrors,
  svgSafetyErrors,
} from '@/data/course/v2/wire';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

import {
  FIXTURE_ASSET_BYTES,
  FIXTURE_COURSE_BUNDLE,
  FIXTURE_DELIVERY_VERSION,
} from './fixtures/courseFixture';

// Content contract for the ca-class-c course as a device downloads it (the
// latest release in server/content): the exact counts and invariants the
// importer promised. If any of these fail, the generated server tree is
// broken, not this test.

const bundle = FIXTURE_COURSE_BUNDLE;
const lessons = bundle.modules.flatMap(module => module.lessons);
const questionById = new Map(bundle.questions.map(q => [q.questionId, q]));
const assetById = new Map(bundle.assets.map(a => [a.assetId, a]));

describe('course content (ca-class-c, latest release)', () => {
  it('has the expected top-level counts', () => {
    expect(FIXTURE_DELIVERY_VERSION).toBe('3.2.11');
    expect(bundle.course.courseId).toBe('ca-class-c');
    expect(bundle.modules).toHaveLength(8);
    expect(lessons).toHaveLength(32);
    expect(bundle.questions).toHaveLength(224);
    expect(bundle.assets).toHaveLength(154);
    expect(bundle.modules.map(m => m.moduleTest)).toHaveLength(8);
  });

  it('keeps source-review metadata without authorizing publication', () => {
    expect(bundle.course.sourceVersionLabel).toBe('CA-2026.08.24-r03');
    expect(bundle.course.sourceReviewStatus).toBe(
      'draft_generated_human_review_required',
    );
    expect(bundle.course.publicationAuthorized).toBe(false);
  });

  it('gives every lesson a substantial deck, one unscored challenge and 6 test questions', () => {
    for (const lesson of lessons) {
      const teachingCards = lesson.blocks.filter(
        block =>
          !isImageBlock(block) &&
          !isQuickChallengeBlock(block) &&
          !isCheckYourselfBlock(block),
      );
      expect(teachingCards.length).toBeGreaterThanOrEqual(4);
      expect(teachingCards.length).toBeLessThanOrEqual(8);
      for (const block of teachingCards) {
        if (!isConceptBlock(block)) continue;
        const words = [
          block.title,
          block.bodyMarkdown,
          ...(block.bullets ?? []),
        ]
          .join(' ')
          .match(/[A-Za-z0-9½]+(?:['’][A-Za-z]+)?/g)?.length;
        expect(words).toBeGreaterThanOrEqual(42);
        expect(words).toBeLessThanOrEqual(135);
      }
      expect(lesson.questionIds).toHaveLength(7);
      expect(lesson.theoryQuestionIds).toHaveLength(1);
      expect(lesson.testQuestionIds).toHaveLength(6);
      expect(lesson.questionIds).toEqual([
        ...lesson.theoryQuestionIds!,
        ...lesson.testQuestionIds!,
      ]);
      expect(lesson.assetIds.length).toBeGreaterThanOrEqual(3);
      expect(lesson.intro?.keyPoints).toHaveLength(3);
    }
  });

  it('delivers theory as short chat-style lines and reserves bullets for true lists', () => {
    const trueListTitles = new Set([
      'A turn has four parts',
      'California has several BAC rules',
      'California uses age and size rules',
      'California uses separate clocks',
      'Colors support the message',
      'Curb colors control stopping',
      'Education and training are separate gates',
      'Emergency order',
      'Final exam method',
      'Guide signs help you plan',
      'Make every control smoother',
      'Match each deadline to the event',
      'Never flee',
      'Remember the 4/6/8 pattern',
      'Remember the order',
      'Remember this order',
      'Read markings in layers',
      'Read the sign as a verb',
      'Stopping takes three stages',
      'Turn checklist',
      'Use the full check',
    ]);
    const teachingCards = lessons.flatMap(lesson =>
      lesson.blocks.filter(
        block => isConceptBlock(block) || isProseBlock(block),
      ),
    );
    const listCards = teachingCards.filter(
      block => (block.bullets?.length ?? 0) > 0,
    );

    expect(
      teachingCards.filter(block => block.bodyMarkdown.includes('\n\n'))
        .length / teachingCards.length,
    ).toBeGreaterThanOrEqual(0.75);
    let singleThoughtMessages = 0;
    let pairedThoughtMessages = 0;
    let totalSentenceWords = 0;
    let totalSentences = 0;
    for (const block of teachingCards) {
      for (const paragraph of block.bodyMarkdown
        .split('\n\n')
        .filter(Boolean)) {
        const sentenceParts = paragraph
          .replace(/\b(a|p)\.m\.\s+(?=[A-Z])/g, '$1<<MERIDIEM>>|')
          .replace(/\b(a|p)\.m\./gi, '$1<<MERIDIEM>>')
          .split('|')
          .flatMap(part => part.split(/(?<=[.!?])\s+/))
          .filter(Boolean);
        // Chat rhythm: each message-line carries one thought; two sentences
        // share a line only as a question-answer pair or after a lead-in.
        expect(sentenceParts.length).toBeGreaterThanOrEqual(1);
        expect(sentenceParts.length).toBeLessThanOrEqual(2);
        if (sentenceParts.length === 1) singleThoughtMessages += 1;
        else pairedThoughtMessages += 1;
        for (const sentence of sentenceParts) {
          const words =
            sentence.match(/[A-Za-z0-9½]+(?:['’][A-Za-z]+)?/g) ?? [];
          expect(words.length).toBeLessThanOrEqual(38);
          totalSentenceWords += words.length;
          totalSentences += 1;
        }
      }
    }
    expect(singleThoughtMessages).toBeGreaterThan(pairedThoughtMessages);
    // Sentences stay laconic on average, message-style.
    expect(totalSentenceWords / totalSentences).toBeLessThanOrEqual(14);
    expect(listCards).toHaveLength(21);
    for (const block of listCards) {
      expect(trueListTitles.has(block.title)).toBe(true);
      expect(block.bullets!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives every lesson one to three well-formed check-yourself recall cards', () => {
    for (const lesson of lessons) {
      const recalls = lesson.blocks.filter(isCheckYourselfBlock);
      expect(recalls.length).toBeGreaterThanOrEqual(1);
      expect(recalls.length).toBeLessThanOrEqual(3);
      for (const block of recalls) {
        expect(block.title.length).toBeGreaterThan(0);
        expect(block.context).toMatch(/^Recall · /);
        expect(recallGapErrors(block.ruleMarkdown)).toEqual([]);
        // A recall follows the teaching card for its fact — never the lesson
        // opener and never an image.
        const index = lesson.blocks.indexOf(block);
        const previous = lesson.blocks[index - 1];
        expect(previous).toBeDefined();
        expect(isQuickChallengeBlock(previous)).toBe(false);
        expect(isImageBlock(previous)).toBe(false);
      }
    }
  });

  it('gives every module test exactly 12 refs into its own lesson bank', () => {
    for (const module of bundle.modules) {
      expect(module.moduleTest.questionIds).toHaveLength(12);
      const own = new Set(module.lessons.flatMap(l => l.questionIds));
      for (const id of module.moduleTest.questionIds) {
        expect(own.has(id)).toBe(true);
      }
    }
  });

  it('gives every question exactly 3 choices with valid answer + feedback', () => {
    for (const question of bundle.questions) {
      expect(question.choices).toHaveLength(3);
      const ids = question.choices.map(choice => choice.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids).toContain(question.correctAnswerId);
      for (const choice of question.choices) {
        expect(choice.feedback.length).toBeGreaterThan(0);
      }
      expect(['opening_challenge', 'lesson_test']).toContain(question.kind);
      expect(['universal', 'state_specific']).toContain(question.scope);
      expect(question.conceptId).toBeTruthy();
    }
  });

  it('uses stable ids: no dates, revisions or semver, ≤64 chars, kebab-case', () => {
    const allIds = [
      bundle.course.courseId,
      ...bundle.modules.map(m => m.moduleId),
      ...bundle.modules.map(m => m.moduleTest.testId),
      ...lessons.map(l => l.lessonId),
      ...lessons.flatMap(l => l.blocks.map(b => b.blockId)),
      ...bundle.questions.map(q => q.questionId),
      ...bundle.assets.map(a => a.assetId),
    ];
    for (const id of allIds) {
      expect(id.length).toBeLessThanOrEqual(MAX_ID_LENGTH);
      expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(id).not.toMatch(/\d{4}/); // no dates
      expect(id).not.toMatch(/-r\d+/); // no revision labels
      expect(id).not.toMatch(/\d+\.\d+\.\d+/); // no semver
    }
  });

  it('has globally unique ids and uuids', () => {
    const ids = [
      bundle.course.courseId,
      ...bundle.modules.map(m => m.moduleId),
      ...bundle.modules.map(m => m.moduleTest.testId),
      ...lessons.map(l => l.lessonId),
      ...bundle.questions.map(q => q.questionId),
      ...bundle.assets.map(a => a.assetId),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const uuids = [
      ...bundle.modules.map(m => m.uuid),
      ...bundle.modules.map(m => m.moduleTest.uuid),
      ...lessons.map(l => l.uuid),
      ...bundle.questions.map(q => q.uuid),
      ...bundle.assets.map(a => a.uuid),
    ];
    expect(new Set(uuids).size).toBe(uuids.length);
    for (const uuid of uuids) {
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it('resolves every reference', () => {
    expect(bundle.course.moduleIds).toEqual(
      bundle.modules.map(m => m.moduleId),
    );
    for (const lesson of lessons) {
      for (const id of lesson.questionIds) {
        expect(questionById.has(id)).toBe(true);
      }
      for (const id of lesson.assetIds) {
        expect(assetById.has(id)).toBe(true);
      }
      for (const block of lesson.blocks) {
        expect(isKnownBlockType(block.type)).toBe(true);
        if (isQuickChallengeBlock(block)) {
          expect(lesson.questionIds).toContain(block.questionId);
        }
        if (isImageBlock(block)) {
          expect(lesson.assetIds).toContain(block.assetId);
        }
        if (isConceptBlock(block) && block.checkpointQuestionId != null) {
          expect(lesson.questionIds).toContain(block.checkpointQuestionId);
        }
      }
      // Only the unscored opening interaction belongs to the theory deck.
      const inline = lesson.blocks.flatMap(block =>
        isQuickChallengeBlock(block)
          ? [block.questionId]
          : isConceptBlock(block) && block.checkpointQuestionId != null
          ? [block.checkpointQuestionId]
          : [],
      );
      expect(inline).toEqual(lesson.theoryQuestionIds);
      for (const id of lesson.testQuestionIds ?? []) {
        expect(inline).not.toContain(id);
      }
    }
    for (const question of bundle.questions) {
      if (question.assetId != null) {
        expect(assetById.has(question.assetId)).toBe(true);
      }
    }
  });

  it('numbers lessons 1…32 globally in course order', () => {
    expect(lessons.map(l => l.globalSequence)).toEqual(
      Array.from({ length: 32 }, (_, i) => i + 1),
    );
  });

  it('embeds SVG whose bytes match the recorded sha256 and pass safety checks', () => {
    for (const asset of bundle.assets) {
      expect(asset.mime).toBe('image/svg+xml');
      expect(asset.width / asset.height).toBeCloseTo(16 / 9, 2);
      expect(asset.alt.length).toBeGreaterThan(0);
      // A document only names a picture; the name is the hash of the file,
      // and the file is still markup a device will render.
      const markup = FIXTURE_ASSET_BYTES.get(asset.sha256);
      expect(markup).toBeDefined();
      expect(sha256Hex(markup!)).toBe(asset.sha256);
      expect(asset.sizeBytes).toBe(utf8ByteLength(markup!));
      expect(svgSafetyErrors(markup!)).toEqual([]);
    }
  });

  it('ships no audit-only fields in the runtime bundle', () => {
    const runtimeJson = JSON.stringify({
      ...bundle,
      assets: bundle.assets,
    });
    for (const field of [
      'primaryRuleIds',
      'reinforcementRuleIds',
      'evidenceId',
      'blueprintId',
      'relatedRuleIds',
      'rightsStatus',
      'courseVersion',
      'dependencyMap',
    ]) {
      expect(runtimeJson).not.toContain(`"${field}"`);
    }
  });

  it('contains none of the legally blocked numeric topics', () => {
    const learnerText = JSON.stringify({
      modules: bundle.modules,
      questions: bundle.questions,
      alts: bundle.assets.map(asset => asset.alt),
    });
    for (const pattern of [
      /rear-projecting.{0,160}(?:12|18)[-\s]inch/i,
      /\b(?:seven|7)[-\s]day\b/i,
      /\bone[-\s]week\b/i,
      /\beighth[-\s]calendar\b/i,
    ]) {
      expect(learnerText).not.toMatch(pattern);
    }
  });

  it('stamps every doc-level schema constant correctly', () => {
    expect(COURSE_SCHEMA_VERSION).toBe(3);
    for (const lesson of lessons) {
      expect(lesson.language).toBe('en-US');
      expect(lesson.format).toBe('intro_conversation_slides_test');
      expect(lesson.conceptId).toBeTruthy();
    }
  });
});
