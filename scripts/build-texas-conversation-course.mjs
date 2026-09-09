// Builds the Texas conversational course by laying a Texas overlay over the
// compiled California course. The California release is the template: its
// module and lesson skeleton, its universal cards, recall cards, challenges
// and questions carry over unchanged (ids re-prefixed), while every block or
// question the California build marked state_specific MUST be replaced from
// scripts/texas-conversation-overlay.mjs — the build refuses otherwise, so no
// California law can leak into the Texas course. Illustrations and reusable
// questions come from the Texas 1.0.0 release; facts are backed by
// scripts/texas-rule-catalog.json, verified against the Texas Transportation
// Code snapshots in the dmv-materials library.
//
// Usage: node scripts/build-texas-conversation-course.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EMOJI_PATTERN, injectEmoji } from './emoji-layer.mjs';
import {
  COURSE as TX_COURSE,
  COVERAGE_DOMAINS,
  LESSONS as OVERLAY,
  MODULES as MODULE_OVERLAY,
} from './texas-conversation-overlay.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_VERSION = '3.3.0';
const BASE_VERSION = '1.0.0';
const DELIVERY_VERSION = '2.0.0';
const SOURCE_VERSION = 'TX-2026.09.05-r01';
const RELEASE_DATE = '2026-09-05';
const MIN_APP_VERSION = '1.1.1';
const TEMPLATE = path.join(ROOT, 'server/content/ca-class-c', TEMPLATE_VERSION);
const BASE = path.join(ROOT, 'server/content/tx-class-c', BASE_VERSION);
const OUTPUT = path.join(ROOT, 'server/content/tx-class-c', DELIVERY_VERSION);
const MANIFEST = path.join(ROOT, 'server/content/tx-class-c/manifest.json');
const AUTHORING = path.join(
  ROOT,
  'courses/Texas_DMV_Course_TX2026.09.05r01_Conversation',
);
const RULE_CATALOG = path.join(ROOT, 'scripts/texas-rule-catalog.json');
const COMPETITOR_ROOT =
  process.env.DMV_COMPETITOR_ROOT || path.resolve(ROOT, '../dmv-competitors');

const json = value => JSON.stringify(value, null, 2) + '\n';
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const writeJson = (filename, value) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, json(value));
};
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const uuidFor = value => {
  const bytes = Buffer.from(
    sha256('dmv-learning:' + value).slice(0, 32),
    'hex',
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};
const docRef = filename => {
  const data = fs.readFileSync(filename);
  return { sha256: sha256(data), sizeBytes: data.byteLength };
};
const txId = caId => caId.replace(/^ca-/, 'tx-');
const conceptId = id => id.replace(/^(ca|tx)-/, '');
const pad = index => String(index + 1).padStart(2, '0');
const CHOICE_IDS = ['A', 'B', 'C', 'D', 'E'];
// Word and sentence counting mirror the California build so the same
// thresholds (42–135 words per card, ≤38-word sentences, 285–560-word lessons)
// mean the same thing in both courses.
const wordCount = text =>
  ((text ?? '').normalize('NFKD').match(/[A-Za-z0-9½]+(?:['’][A-Za-z]+)?/g) || []).length;
const words = text => Array.from({ length: wordCount(text) });
const sentences = text =>
  (text ?? '')
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Inputs

const templateCourse = readJson(path.join(TEMPLATE, 'course.json'));
const templateModules = templateCourse.course.moduleIds.map(id =>
  readJson(path.join(TEMPLATE, 'modules', `${id}.json`)),
);
const templateLessonDoc = id =>
  readJson(path.join(TEMPLATE, 'lessons', `${id}.json`));

const baseLessonDocs = new Map(
  fs
    .readdirSync(path.join(BASE, 'lessons'))
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const doc = readJson(path.join(BASE, 'lessons', name));
      return [doc.lesson.lessonId, doc];
    }),
);
const baseAssetById = new Map(
  [...baseLessonDocs.values()]
    .flatMap(doc => doc.assets)
    .map(asset => [asset.assetId, asset]),
);
const requireBase = id => {
  const doc = baseLessonDocs.get(id);
  if (!doc) throw new Error(`Missing Texas 1.0.0 source lesson ${id}`);
  return doc;
};

const catalog = readJson(RULE_CATALOG);
const catalogRuleIds = new Set(catalog.rules.map(rule => rule.ruleId));

// ---------------------------------------------------------------------------
// Overlay application

const problems = [];
const problem = message => problems.push(message);

const withEmoji = card => {
  const usedEmoji = new Set();
  const bodyMarkdown =
    card.bodyMarkdown == null
      ? card.bodyMarkdown
      : injectEmoji(card.bodyMarkdown, { count: 3 }, usedEmoji);
  const bullets = card.bullets?.map(bullet =>
    injectEmoji(bullet, { count: 1 }, usedEmoji),
  );
  return {
    ...card,
    ...(bodyMarkdown != null && { bodyMarkdown }),
    ...(bullets != null && { bullets }),
  };
};

const choicesOf = (texts, correct, explanation) =>
  texts.map((text, index) => ({
    id: CHOICE_IDS[index],
    text,
    feedback: (index === correct ? 'Correct. ' : 'Not quite. ') + explanation,
  }));

const renameQuestion = (question, lessonId, newId, index, kind) => ({
  ...question,
  questionId: newId,
  uuid: uuidFor(newId),
  kind,
  conceptId: `${conceptId(lessonId)}.${kind === 'opening_challenge' ? 'theory' : 'test'}.${pad(index)}`,
});

const buildLesson = (caLessonDoc, moduleId, globalSequence, moduleSequence) => {
  const ca = caLessonDoc.lesson;
  const caId = ca.lessonId;
  const id = txId(caId);
  const overlay = OVERLAY[caId];
  if (!overlay) {
    problem(`${caId}: no Texas overlay entry`);
    return null;
  }
  const visuals = overlay.visuals ?? [];
  const caQuestionById = new Map(
    caLessonDoc.questions.map(question => [question.questionId, question]),
  );
  const referencedAssets = [];
  const claimAsset = assetId => {
    if (assetId == null) return null;
    if (!baseAssetById.has(assetId)) {
      problem(`${id}: unknown Texas asset ${assetId}`);
      return null;
    }
    if (!referencedAssets.includes(assetId)) referencedAssets.push(assetId);
    return assetId;
  };

  // Theory question + challenge block.
  const theoryId = `${id}-theory-q01`;
  const caTheory = caQuestionById.get(ca.theoryQuestionIds[0]);
  let theory;
  if (overlay.challenge) {
    const data = overlay.challenge;
    theory = {
      questionId: theoryId,
      uuid: uuidFor(theoryId),
      kind: 'opening_challenge',
      conceptId: `${conceptId(id)}.theory.01`,
      scope: data.scope ?? 'state_specific',
      prompt: data.prompt,
      choices: choicesOf(data.choices, data.correct, data.explanation),
      correctAnswerId: CHOICE_IDS[data.correct],
      explanation: data.explanation,
    };
  } else {
    if (caTheory.scope === 'state_specific') {
      problem(`${caId}: state-specific challenge needs a Texas overlay`);
    }
    theory = renameQuestion(caTheory, id, theoryId, 0, 'opening_challenge');
    delete theory.assetId;
  }
  const theoryAsset = claimAsset(visuals[0]);
  if (theoryAsset) theory.assetId = theoryAsset;

  // Blocks.
  let imageIndex = 0;
  const blocks = [];
  for (const caBlock of ca.blocks) {
    const blockId = txId(caBlock.blockId);
    if (caBlock.type === 'quick_challenge') {
      blocks.push({
        ...caBlock,
        blockId,
        questionId: theoryId,
        ...(overlay.challenge && {
          scenario: injectEmoji(overlay.challenge.scenario, { count: 1 }, new Set()),
          questionPreview: overlay.challenge.prompt,
        }),
      });
      continue;
    }
    if (caBlock.type === 'image') {
      imageIndex += 1;
      const assetId = claimAsset(visuals[imageIndex]);
      if (assetId) blocks.push({ blockId, type: 'image', assetId });
      continue;
    }
    if (caBlock.type === 'check_yourself') {
      const override = overlay.recalls?.[caBlock.blockId];
      if (caBlock.scope === 'state_specific' && !override) {
        problem(`${caId}: recall ${caBlock.blockId} needs a Texas overlay`);
      }
      blocks.push({
        ...caBlock,
        blockId,
        ...(override && {
          context: override.context,
          ruleMarkdown: override.rule,
        }),
      });
      continue;
    }
    // Teaching card.
    const override = overlay.cards?.[caBlock.blockId];
    if (caBlock.scope === 'state_specific' && !override) {
      problem(`${caId}: card "${caBlock.title}" (${caBlock.blockId}) needs a Texas overlay`);
    }
    if (override) {
      const card = {
        blockId,
        type: override.type ?? caBlock.type,
        title: override.title ?? caBlock.title,
        bodyMarkdown: override.body,
        ...(override.bullets && { bullets: override.bullets }),
        ...(caBlock.conceptId && { conceptId: caBlock.conceptId }),
        scope: override.scope ?? caBlock.scope ?? 'state_specific',
      };
      blocks.push(withEmoji(card));
    } else {
      blocks.push({ ...caBlock, blockId });
    }
  }

  // Test questions.
  const tests = (overlay.tests ?? []).map((entry, index) => {
    const questionId = `${id}-q${pad(index)}`;
    if (entry.ca) {
      const source = caQuestionById.get(`${caId}-${entry.ca}`);
      if (!source) {
        problem(`${caId}: no California question ${entry.ca} to reuse`);
        return null;
      }
      if (source.scope === 'state_specific') {
        problem(`${caId}: California question ${entry.ca} is state-specific and cannot be reused`);
      }
      const question = renameQuestion(source, id, questionId, index, 'lesson_test');
      delete question.assetId;
      return question;
    }
    if (entry.pick) {
      const [sourceId, sourceIndex] = entry.pick;
      const source = requireBase(sourceId).questions[sourceIndex];
      if (!source) {
        problem(`${caId}: Texas 1.0.0 lesson ${sourceId} has no question ${sourceIndex}`);
        return null;
      }
      const question = {
        ...renameQuestion(source, id, questionId, index, 'lesson_test'),
        scope: entry.scope ?? source.scope ?? 'state_specific',
      };
      if (question.assetId) {
        const assetId = claimAsset(question.assetId);
        if (assetId) question.assetId = assetId;
        else delete question.assetId;
      }
      return question;
    }
    return {
      questionId,
      uuid: uuidFor(questionId),
      kind: 'lesson_test',
      conceptId: `${conceptId(id)}.test.${pad(index)}`,
      scope: entry.scope ?? 'state_specific',
      prompt: entry.prompt,
      choices: choicesOf(entry.choices, entry.correct, entry.explanation),
      correctAnswerId: CHOICE_IDS[entry.correct],
      explanation: entry.explanation,
    };
  });
  if (tests.length !== 6 || tests.some(item => item == null)) {
    problem(`${caId}: expected exactly 6 test questions, got ${tests.length}`);
  }
  const questions = [theory, ...tests.filter(Boolean)];

  const lesson = {
    lessonId: id,
    uuid: uuidFor(id),
    moduleId,
    globalSequence,
    moduleSequence,
    title: overlay.title ?? ca.title,
    conceptId: ca.conceptId,
    objective: overlay.summary ?? ca.objective,
    intro: {
      ...ca.intro,
      summary: overlay.summary ?? ca.intro.summary,
      keyPoints: overlay.keyPoints ?? ca.intro.keyPoints,
    },
    estimatedMinutes: ca.estimatedMinutes,
    format: ca.format,
    blocks,
    questionIds: questions.map(question => question.questionId),
    theoryQuestionIds: [theoryId],
    testQuestionIds: tests.filter(Boolean).map(question => question.questionId),
    assetIds: referencedAssets,
    language: ca.language,
  };
  return { lesson, questions, assetIds: referencedAssets };
};

// ---------------------------------------------------------------------------
// Assemble the course

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.rmSync(AUTHORING, { recursive: true, force: true });
fs.mkdirSync(path.join(OUTPUT, 'modules'), { recursive: true });
fs.mkdirSync(path.join(OUTPUT, 'lessons'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'lessons'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'reports'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'rules'), { recursive: true });

const lessonDocs = [];
const lessonDocById = new Map();
const questionById = new Map();
const claimedAssetIds = new Set();
let globalSequence = 0;

const modules = templateModules.map((templateModule, moduleIndex) => {
  const caModule = templateModule.module;
  const moduleId = txId(caModule.moduleId);
  const moduleOverlay = MODULE_OVERLAY[caModule.moduleId] ?? {};
  const built = caModule.lessons.map((caLesson, lessonIndex) => {
    globalSequence += 1;
    return buildLesson(
      templateLessonDoc(caLesson.lessonId),
      moduleId,
      globalSequence,
      lessonIndex + 1,
    );
  });
  const lessons = [];
  for (const entry of built) {
    if (!entry) continue;
    // Assets: alias a Texas 1.0.0 asset the second time a lesson claims it, as
    // the California build does, so every lesson document stays self-contained.
    const assetAliases = new Map();
    const assets = entry.assetIds.map((sourceId, index) => {
      const source = baseAssetById.get(sourceId);
      const assetId = claimedAssetIds.has(sourceId)
        ? `${entry.lesson.lessonId}-shared-${pad(index)}`
        : sourceId;
      claimedAssetIds.add(assetId);
      assetAliases.set(sourceId, assetId);
      return assetId === sourceId
        ? source
        : { ...source, assetId, uuid: uuidFor(assetId) };
    });
    entry.lesson.blocks.forEach(block => {
      if (block.type === 'image') block.assetId = assetAliases.get(block.assetId);
    });
    entry.questions.forEach(question => {
      if (question.assetId) question.assetId = assetAliases.get(question.assetId);
      questionById.set(question.questionId, question);
    });
    entry.lesson.assetIds = assets.map(asset => asset.assetId);
    const doc = {
      schemaVersion: 2,
      deliveryVersion: DELIVERY_VERSION,
      lesson: entry.lesson,
      questions: entry.questions,
      assets,
    };
    lessonDocs.push(doc);
    lessonDocById.set(entry.lesson.lessonId, doc);
    lessons.push(entry.lesson);
  }
  const testQuestionIds = lessons.flatMap(lesson => lesson.testQuestionIds);
  const moduleTestIds = Array.from({ length: 12 }, (_, index) => {
    const position = Math.floor((index * testQuestionIds.length) / 12);
    return testQuestionIds[position];
  });
  const module = {
    moduleId,
    uuid: uuidFor(moduleId),
    sequence: moduleIndex + 1,
    title: moduleOverlay.title ?? caModule.title,
    outcome: moduleOverlay.outcome ?? caModule.outcome,
    lessons,
    moduleTest: {
      testId: `${moduleId}-test`,
      uuid: uuidFor(`${moduleId}-test`),
      moduleId,
      questionIds: moduleTestIds,
    },
  };
  const moduleLessonDocs = lessons.map(lesson => lessonDocById.get(lesson.lessonId));
  return {
    module,
    doc: {
      schemaVersion: 2,
      deliveryVersion: DELIVERY_VERSION,
      module,
      questions: moduleLessonDocs.flatMap(doc => doc.questions),
      assets: moduleLessonDocs.flatMap(doc => doc.assets),
    },
  };
});

const courseDoc = {
  schemaVersion: 2,
  deliveryVersion: DELIVERY_VERSION,
  course: {
    courseId: 'tx-class-c',
    title: TX_COURSE.title,
    subtitle: TX_COURSE.subtitle,
    jurisdiction: 'TX',
    state: 'TX',
    language: 'en-US',
    targetLicense: TX_COURSE.targetLicense,
    moduleIds: modules.map(entry => entry.module.moduleId),
    sourceVersionLabel: SOURCE_VERSION,
    sourceContentHash: sha256(
      JSON.stringify(lessonDocs.map(doc => [doc.lesson, doc.questions])),
    ),
    sourceCheckedAt: RELEASE_DATE,
    sourceReviewStatus: 'draft_generated_human_review_required',
    publicationAuthorized: false,
  },
};

// TX_PARTIAL=1 lets a half-written overlay build for inspection; the final
// build must have every state-specific block and question overlaid.
if (problems.length > 0) {
  console.error('Texas overlay is incomplete:\n' + problems.map(p => `  - ${p}`).join('\n'));
  if (process.env.TX_PARTIAL !== '1') process.exit(1);
}

for (const doc of lessonDocs) {
  writeJson(path.join(OUTPUT, 'lessons', `${doc.lesson.lessonId}.json`), doc);
}
for (const entry of modules) {
  writeJson(path.join(OUTPUT, 'modules', `${entry.module.moduleId}.json`), entry.doc);
}
writeJson(path.join(OUTPUT, 'course.json'), courseDoc);

// ---------------------------------------------------------------------------
// Manifest

const documents = {
  course: docRef(path.join(OUTPUT, 'course.json')),
  modules: Object.fromEntries(
    modules.map(entry => [
      entry.module.moduleId,
      docRef(path.join(OUTPUT, 'modules', `${entry.module.moduleId}.json`)),
    ]),
  ),
  lessons: Object.fromEntries(
    lessonDocs.map(doc => [
      doc.lesson.lessonId,
      {
        moduleId: doc.lesson.moduleId,
        ...docRef(path.join(OUTPUT, 'lessons', `${doc.lesson.lessonId}.json`)),
      },
    ]),
  ),
};
const manifest = readJson(MANIFEST);
manifest.latestVersion = DELIVERY_VERSION;
manifest.seedVersion = DELIVERY_VERSION;
manifest.versions = manifest.versions
  .filter(entry => entry.version !== DELIVERY_VERSION)
  .concat({
    version: DELIVERY_VERSION,
    releasedAt: RELEASE_DATE,
    status: 'release_candidate',
    minAppVersion: MIN_APP_VERSION,
    notes: TX_COURSE.releaseNotes,
    sourceVersionLabel: SOURCE_VERSION,
    sourceReviewStatus: 'draft_generated_human_review_required',
    publicationAuthorized: false,
    instructions: [
      {
        op: 'full',
        severity: 'soft',
        message:
          'The Texas course has been rebuilt from the ground up in the conversational format: 33 new lessons with scenario openers, chat-style theory, Check-yourself recall cards, and lesson tests. Lesson progress from the previous Texas course does not carry over.',
      },
    ],
    documents,
  });
writeJson(MANIFEST, manifest);

// ---------------------------------------------------------------------------
// Validation

const teachingBlocks = lessonDocs.flatMap(doc =>
  doc.lesson.blocks.filter(block => block.bodyMarkdown != null),
);
const recallBlocks = lessonDocs.flatMap(doc =>
  doc.lesson.blocks.filter(block => block.type === 'check_yourself'),
);
const questions = lessonDocs.flatMap(doc => doc.questions);
const cardText = block =>
  [block.bodyMarkdown ?? '', ...(block.bullets ?? [])].join('\n');
const cardWords = block => wordCount([block.title, cardText(block)].join(' '));
const lessonTheoryWords = doc =>
  doc.lesson.blocks
    .filter(block => block.bodyMarkdown != null)
    .reduce((sum, block) => sum + wordCount(cardText(block)), 0);
const sentenceWordCounts = lessonDocs.flatMap(doc => [
  doc.lesson.objective,
  ...doc.lesson.intro.keyPoints,
  ...doc.lesson.blocks.flatMap(block => [block.scenario, block.ruleMarkdown, block.bodyMarkdown, ...(block.bullets ?? [])]),
  ...doc.questions.filter(q => q.kind === 'opening_challenge').flatMap(q => [q.prompt, q.explanation]),
].filter(Boolean).flatMap(text => sentences(text).map(wordCount)));
const paragraphSentenceCounts = teachingBlocks.flatMap(block =>
  (block.bodyMarkdown ?? '').split(/\n\n+/).filter(Boolean).map(paragraph => sentences(paragraph).length),
);

const CALIFORNIA_TOKENS = /\bCalifornia\b|\bCVC\b|Vehicle Code|\bDMV\b|\bCaltrans\b|\bSacramento\b|\bCA\b/;
const californiaLeaks = [];
for (const doc of lessonDocs) {
  for (const block of doc.lesson.blocks) {
    const text = [block.title, block.bodyMarkdown, block.ruleMarkdown, block.context, block.scenario, ...(block.bullets ?? [])].filter(Boolean).join(' ');
    if (CALIFORNIA_TOKENS.test(text)) californiaLeaks.push(`${doc.lesson.lessonId}/${block.blockId}`);
  }
  for (const question of doc.questions) {
    const text = [question.prompt, question.explanation, ...question.choices.flatMap(c => [c.text, c.feedback])].join(' ');
    if (CALIFORNIA_TOKENS.test(text)) californiaLeaks.push(`${doc.lesson.lessonId}/${question.questionId}`);
  }
}

// Every digit-bearing number a learner reads must be a value the catalog
// backs (or an approved scenario number), as in the California build.
const catalogNumbers = new Set();
const collectNumbers = value => {
  if (typeof value === 'number') catalogNumbers.add(String(value));
  else if (typeof value === 'string') {
    for (const token of value.match(/\d[\d,.]*/g) ?? []) catalogNumbers.add(token.replace(/[,.]$/, ''));
  } else if (Array.isArray(value)) value.forEach(collectNumbers);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectNumbers);
};
catalog.rules.forEach(rule => {
  collectNumbers(rule.values);
  collectNumbers(rule.authoringRule);
  collectNumbers(rule.conditions);
  collectNumbers(rule.exceptions);
});
const APPROVED_NUMBERS = new Set(TX_COURSE.approvedScenarioNumbers ?? []);
const unresolvedNumbers = [];
for (const doc of lessonDocs) {
  const texts = [
    ...doc.lesson.blocks.map(block => [block.blockId, [block.bodyMarkdown, block.ruleMarkdown, block.scenario, ...(block.bullets ?? [])].filter(Boolean).join(' ')]),
    ...doc.questions.map(question => [question.questionId, [question.prompt, question.explanation, ...question.choices.flatMap(c => [c.text, c.feedback])].join(' ')]),
  ];
  for (const [where, text] of texts) {
    for (const token of text.match(/\d[\d,.]*/g) ?? []) {
      const clean = token.replace(/[,.]$/, '');
      if (!catalogNumbers.has(clean) && !APPROVED_NUMBERS.has(clean)) {
        unresolvedNumbers.push(`${where}: ${clean}`);
      }
    }
  }
}

const recallGapErrors = rule => {
  const errors = [];
  const gaps = rule.match(/\[\[[^\]]*\]\]/g) ?? [];
  if (gaps.length === 0) errors.push('no gap');
  if (gaps.some(gap => gap.length <= 4)) errors.push('empty gap');
  if ((rule.match(/\[\[/g) ?? []).length !== (rule.match(/\]\]/g) ?? []).length) errors.push('unbalanced');
  return errors;
};
const recallProblems = [];
for (const doc of lessonDocs) {
  const recalls = doc.lesson.blocks.filter(block => block.type === 'check_yourself');
  if (recalls.length < 1 || recalls.length > 3) recallProblems.push(`${doc.lesson.lessonId}: ${recalls.length} recall cards`);
  doc.lesson.blocks.forEach((block, index) => {
    if (block.type !== 'check_yourself') return;
    for (const error of recallGapErrors(block.ruleMarkdown)) recallProblems.push(`${block.blockId}: ${error}`);
    const previous = doc.lesson.blocks.slice(0, index).reverse().find(item => item.bodyMarkdown != null);
    if (!previous) recallProblems.push(`${block.blockId}: no teaching card before it`);
    if (EMOJI_PATTERN.test(block.ruleMarkdown)) recallProblems.push(`${block.blockId}: emoji in rule`);
  });
}

// Coverage domains: every catalog rule claimed exactly once, every lesson claimed.
const lessonIds = new Set(lessonDocs.map(doc => doc.lesson.lessonId));
const claimedRules = new Map();
const claimedLessons = new Set();
const unknownRules = [];
const unknownLessons = [];
for (const domain of COVERAGE_DOMAINS) {
  for (const ruleId of domain.ruleIds) {
    if (!catalogRuleIds.has(ruleId)) unknownRules.push(ruleId);
    claimedRules.set(ruleId, (claimedRules.get(ruleId) ?? 0) + 1);
  }
  for (const lessonId of domain.lessons) {
    if (!lessonIds.has(lessonId)) unknownLessons.push(lessonId);
    claimedLessons.add(lessonId);
  }
}
const unclaimedRules = [...catalogRuleIds].filter(id => !claimedRules.has(id));
const doubleClaimedRules = [...claimedRules].filter(([, count]) => count > 1).map(([id]) => id);
const unclaimedLessons = [...lessonIds].filter(id => !claimedLessons.has(id));

// Originality: no exact ten-word run shared with a competitor course.
const walkFiles = dir =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? walkFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
      )
    : [];
const normalize = text => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const shingles = tokens => {
  const set = new Set();
  for (let i = 0; i + 10 <= tokens.length; i += 1) set.add(tokens.slice(i, i + 10).join(' '));
  return set;
};
const competitorShingles = new Set();
for (const file of walkFiles(COMPETITOR_ROOT).filter(name => /\.(json|md|txt|html)$/i.test(name))) {
  for (const shingle of shingles(normalize(fs.readFileSync(file, 'utf8')))) competitorShingles.add(shingle);
}
const ourText = lessonDocs
  .flatMap(doc => [
    ...doc.lesson.blocks.map(block => [block.title, block.bodyMarkdown, block.ruleMarkdown, block.scenario, ...(block.bullets ?? [])].filter(Boolean).join(' ')),
    ...doc.questions.map(question => [question.prompt, question.explanation, ...question.choices.map(c => c.text)].join(' ')),
  ])
  .join('\n');
const competitorOverlaps = [...shingles(normalize(ourText))].filter(shingle => competitorShingles.has(shingle));
const overlapCount = competitorOverlaps.length;

const ids = new Set();
const duplicateIds = [];
const claimId = id => {
  if (ids.has(id)) duplicateIds.push(id);
  ids.add(id);
};
const uuids = new Set();
const duplicateUuids = [];
const claimUuid = uuid => {
  if (uuids.has(uuid)) duplicateUuids.push(uuid);
  uuids.add(uuid);
};
for (const entry of modules) {
  claimId(entry.module.moduleId);
  claimUuid(entry.module.uuid);
  claimId(entry.module.moduleTest.testId);
  claimUuid(entry.module.moduleTest.uuid);
}
for (const doc of lessonDocs) {
  claimId(doc.lesson.lessonId);
  claimUuid(doc.lesson.uuid);
  doc.lesson.blocks.forEach(block => claimId(block.blockId));
  doc.questions.forEach(question => {
    claimId(question.questionId);
    claimUuid(question.uuid);
  });
  doc.assets.forEach(asset => {
    claimId(asset.assetId);
    claimUuid(asset.uuid);
  });
}
const unresolvedRefs = [];
for (const doc of lessonDocs) {
  const assetIds = new Set(doc.assets.map(asset => asset.assetId));
  const questionIds = new Set(doc.questions.map(question => question.questionId));
  doc.lesson.blocks.forEach(block => {
    if (block.type === 'image' && !assetIds.has(block.assetId)) unresolvedRefs.push(block.blockId);
    if (block.type === 'quick_challenge' && !questionIds.has(block.questionId)) unresolvedRefs.push(block.blockId);
  });
  doc.questions.forEach(question => {
    if (question.assetId && !assetIds.has(question.assetId)) unresolvedRefs.push(question.questionId);
  });
}
for (const entry of modules) {
  entry.module.moduleTest.questionIds.forEach(id => {
    if (!questionById.has(id)) unresolvedRefs.push(`${entry.module.moduleId}-test:${id}`);
  });
}

const validation = {
  generatedAt: new Date().toISOString(),
  deliveryVersion: DELIVERY_VERSION,
  sourceVersion: SOURCE_VERSION,
  templateVersion: `ca-class-c ${TEMPLATE_VERSION}`,
  status: 'pass_structural_human_review_required',
  counts: {
    modules: modules.length,
    lessons: lessonDocs.length,
    totalQuestions: questions.length,
    lessonTestQuestions: lessonDocs.flatMap(doc => doc.lesson.testQuestionIds).length,
    moduleTestQuestionRefs: modules.reduce((sum, entry) => sum + entry.module.moduleTest.questionIds.length, 0),
    uniqueAssets: lessonDocs.reduce((sum, doc) => sum + doc.assets.length, 0),
    teachingCards: teachingBlocks.length,
    stateSpecificTeachingCards: teachingBlocks.filter(block => block.scope === 'state_specific').length,
    recallCards: recallBlocks.length,
    catalogRules: catalog.rules.length,
    coverageDomains: COVERAGE_DOMAINS.length,
    minimumTeachingCardWords: Math.min(...teachingBlocks.map(cardWords)),
    maximumTeachingCardWords: Math.max(...teachingBlocks.map(cardWords)),
    maximumSentenceWords: Math.max(...sentenceWordCounts),
    averageSentenceWords: Number((sentenceWordCounts.reduce((sum, count) => sum + count, 0) / sentenceWordCounts.length).toFixed(1)),
    maximumSentencesPerParagraph: Math.max(...paragraphSentenceCounts),
    minimumLessonTheoryWords: Math.min(...lessonDocs.map(lessonTheoryWords)),
    maximumLessonTheoryWords: Math.max(...lessonDocs.map(lessonTheoryWords)),
    emojiTeachingCards: teachingBlocks.filter(block => EMOJI_PATTERN.test(cardText(block))).length,
    californiaLeaks: californiaLeaks.length,
    unresolvedLearnerNumberCount: unresolvedNumbers.length,
    competitorTenWordOverlaps: overlapCount,
  },
  details: {
    californiaLeaks,
    unresolvedNumbers: unresolvedNumbers.slice(0, 40),
    competitorOverlaps: competitorOverlaps.slice(0, 20),
    recallProblems,
    unknownRules,
    unknownLessons,
    unclaimedRules,
    doubleClaimedRules,
    unclaimedLessons,
    duplicateIds,
    duplicateUuids,
    unresolvedRefs,
  },
  checks: {
    eightModules: modules.length === 8,
    thirtyThreeLessons: lessonDocs.length === 33,
    exactly198LessonTestQuestions: lessonDocs.flatMap(doc => doc.lesson.testQuestionIds).length === 198,
    exactly231QuestionsTotal: questions.length === 231,
    ninetySixModuleTestRefs: modules.every(entry => entry.module.moduleTest.questionIds.length === 12),
    everyLessonStartsInteractive: lessonDocs.every(doc => doc.lesson.blocks[0]?.type === 'quick_challenge'),
    atLeastFourTeachingCards: lessonDocs.every(doc => doc.lesson.blocks.filter(b => b.bodyMarkdown != null).length >= 4),
    minimumCardAtLeast42Words: teachingBlocks.every(block => cardWords(block) >= 42),
    maximumCardAtMost135Words: teachingBlocks.every(block => cardWords(block) <= 135),
    maximumSentenceAtMost38Words: Math.max(...sentenceWordCounts) <= 38,
    sentencesStayLaconicOnAverage: sentenceWordCounts.reduce((sum, count) => sum + count, 0) / sentenceWordCounts.length <= 14,
    everyMessageStaysOneThought: Math.max(...paragraphSentenceCounts) <= 2,
    lessonTheoryBetween285And560Words: lessonDocs.every(doc => lessonTheoryWords(doc) >= 285 && lessonTheoryWords(doc) <= 560),
    everyQuestionHasThreeChoicesAndAnswer: questions.every(q => q.choices.length === 3 && q.choices.some(c => c.id === q.correctAnswerId)),
    questionsAndRecallRulesStayEmojiFree:
      !questions.some(q => EMOJI_PATTERN.test([q.prompt, q.explanation, ...q.choices.flatMap(c => [c.text, c.feedback])].join(' '))) &&
      !recallBlocks.some(block => EMOJI_PATTERN.test(block.ruleMarkdown)),
    emojiStaysSparse: teachingBlocks.every(block => [...(block.bodyMarkdown ?? '').split('\n\n'), ...(block.bullets ?? [])].every(line => [...line].filter(ch => EMOJI_PATTERN.test(ch)).length <= 2)),
    recallCardsWellFormedAndPlaced: recallProblems.length === 0,
    noCaliforniaReferences: californiaLeaks.length === 0,
    everyLearnerNumberBackedByCatalog: unresolvedNumbers.length === 0,
    everyCatalogRuleClaimedByExactlyOneDomain: unclaimedRules.length === 0 && doubleClaimedRules.length === 0 && unknownRules.length === 0,
    everyLessonClaimedByACoverageDomain: unclaimedLessons.length === 0 && unknownLessons.length === 0,
    idsAndUuidsUnique: duplicateIds.length === 0 && duplicateUuids.length === 0,
    idsShort: [...ids].every(id => id.length <= 64 && /^[a-z0-9-]+$/.test(id)),
    referencesResolve: unresolvedRefs.length === 0,
    noExactTenWordCompetitorOverlap: overlapCount === 0,
    publicationStillBlocked: courseDoc.course.publicationAuthorized === false,
  },
};

// Authoring package.
writeJson(path.join(AUTHORING, 'course.json'), { course: courseDoc.course, counts: validation.counts });
for (const doc of lessonDocs) writeJson(path.join(AUTHORING, 'lessons', `${doc.lesson.lessonId}.json`), doc);
writeJson(path.join(AUTHORING, 'rules/rule-catalog.json'), catalog);
writeJson(path.join(AUTHORING, 'reports/validation-report.json'), validation);
writeJson(path.join(AUTHORING, 'reports/coverage-domains.json'), COVERAGE_DOMAINS);
fs.writeFileSync(
  path.join(AUTHORING, 'README.md'),
  [
    `# Texas conversational course — ${SOURCE_VERSION}`,
    '',
    `Delivery version ${DELIVERY_VERSION}, built from the California ${TEMPLATE_VERSION} skeleton with a Texas overlay. Universal cards, recall cards, challenges and questions are shared with California; every state-specific block and question is Texas-authored and backed by \`rules/rule-catalog.json\`, whose sources cite the Texas Transportation Code, Penal Code, Alcoholic Beverage Code and Texas MUTCD snapshots in the dmv-materials library.`,
    '',
    'Status: release_candidate, publicationAuthorized: false — human legal and content review required before production.',
    '',
  ].join('\n'),
);

console.log(json(validation));
if (Object.values(validation.checks).some(value => value !== true)) {
  console.error('Validation failed');
  process.exit(1);
}
