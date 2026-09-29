import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BankQuestion, Outline } from '../src/api/types.js';
import type {
  CourseAssetV2,
  CourseQuestionV2,
  LessonBlockV2,
  LessonDocV2,
} from '../../src/data/course/v2/wire.ts';
import { buildCourseArchive, safeName } from '../src/model/courseArchive.js';
import type { ArchiveFile } from '../src/model/courseArchive.js';
import { crc32, zipArchive } from '../src/model/zip.js';

// The archive is read by people who never open the panel, so what it promises
// is checked here: a folder per module, every slide and the lesson's test on
// the lesson's page, a module test that says what it draws and where to read
// it, the pictures beside the pages that show them — and a zip that unpacks.

const asset = (assetId: string, sha: string): CourseAssetV2 => ({
  assetId,
  uuid: `uuid-${assetId}`,
  mime: 'image/svg+xml',
  width: 320,
  height: 180,
  alt: `Alt of ${assetId}`,
  sha256: sha.repeat(64),
  sizeBytes: 100,
});

const question = (
  questionId: string,
  over: Partial<CourseQuestionV2> = {},
): CourseQuestionV2 => ({
  questionId,
  uuid: `uuid-${questionId}`,
  kind: 'lesson_test',
  prompt: `Prompt of ${questionId}?`,
  choices: [
    { id: 'A', text: `Wrong ${questionId}`, feedback: '' },
    { id: 'B', text: `Right ${questionId}`, feedback: '' },
    { id: 'C', text: `Other ${questionId}`, feedback: '' },
  ],
  correctAnswerId: 'B',
  explanation: `Because of ${questionId}.`,
  ...over,
});

const lesson = (
  lessonId: string,
  moduleId: string,
  title: string,
  blocks: LessonBlockV2[],
  questions: CourseQuestionV2[],
  assets: CourseAssetV2[],
  testQuestionIds: string[],
): LessonDocV2 => ({
  schemaVersion: 3,
  deliveryVersion: '1.2.0',
  lesson: {
    lessonId,
    uuid: `uuid-${lessonId}`,
    moduleId,
    globalSequence: 1,
    moduleSequence: 1,
    title,
    objective: `Objective of ${title}`,
    estimatedMinutes: '6',
    format: 'cards',
    blocks,
    questionIds: questions.map(q => q.questionId),
    testQuestionIds,
    assetIds: assets.map(a => a.assetId),
    language: 'en',
  },
  questions,
  assets,
});

const signsLesson = lesson(
  'signs',
  'm-road',
  'Signs & Signals',
  [
    {
      blockId: 'b01',
      type: 'quick_challenge',
      title: 'Try this first',
      scenario: 'You reach a red octagon.',
      questionPreview: '',
      questionId: 'q-open',
    },
    { blockId: 'b02', type: 'image', assetId: 'a-cover' },
    {
      blockId: 'b03',
      type: 'core_rule',
      title: 'Stop means stop',
      bodyMarkdown: 'Come to a full stop.',
      content: [
        { kind: 'paragraph', text: 'Come to a <full> stop.' },
        { kind: 'image', assetId: 'a-inline' },
        { kind: 'bullets', items: ['At the line', 'Before the crosswalk'] },
      ],
      checkpointQuestionId: 'q-check',
    },
    {
      blockId: 'b04',
      type: 'check_yourself',
      title: 'Recall',
      context: 'Recall · Stops',
      ruleMarkdown: 'Stop at the [[limit line]] first.',
    },
    {
      blockId: 'b05',
      type: 'drive_smarter',
      title: 'Extra',
      bodyMarkdown: 'Look left twice.',
      optional: true,
    },
  ] as LessonBlockV2[],
  [
    question('q-open', { kind: 'opening_challenge' }),
    question('q-check', { kind: 'lesson_checkpoint' }),
    question('q-t1', { assetId: 'a-test' }),
    question('q-t2'),
  ],
  [asset('a-cover', 'a'), asset('a-inline', 'b'), asset('a-test', 'c')],
  ['q-t1', 'q-t2'],
);

const speedLesson = lesson(
  'speed',
  'm-speed',
  'Speed: Limits',
  [
    {
      blockId: 's01',
      type: 'core_rule',
      title: 'Basic speed law',
      bodyMarkdown: 'Never faster than is safe.',
    },
    // The same asset id as the first module's cover, a different picture.
    { blockId: 's02', type: 'image', assetId: 'a-cover' },
  ] as LessonBlockV2[],
  [question('q-s1')],
  [asset('a-cover', 'd')],
  ['q-s1'],
);

const outline: Outline = {
  courseId: 'ca-class-c',
  version: '1.2.0',
  format: 'cards',
  title: 'California Class C',
  state: 'California',
  cardStyles: [],
  modules: [
    {
      moduleId: 'm-road',
      title: 'Read the Road',
      sequence: 1,
      moduleTestQuestionCount: 3,
      moduleTestQuestionIds: ['q-t2', 'pool-merge', 'q-gone'],
      lessons: [
        {
          lessonId: 'signs',
          title: 'Signs & Signals',
          estimatedMinutes: '6',
          cardCount: 6,
          questionCount: 4,
        },
      ],
    },
    {
      moduleId: 'm-speed',
      title: 'Speed / Space',
      sequence: 2,
      moduleTestQuestionCount: 1,
      moduleTestQuestionIds: ['q-s1'],
      lessons: [
        {
          lessonId: 'speed',
          title: 'Speed: Limits',
          estimatedMinutes: '6',
          cardCount: 2,
          questionCount: 1,
        },
      ],
    },
  ],
};

const bankOf = (
  docs: LessonDocV2[],
  pool: CourseQuestionV2[],
): BankQuestion[] => [
  ...docs.flatMap(doc =>
    doc.questions.map(q => ({ ...q, lessonId: doc.lesson.lessonId })),
  ),
  ...pool.map(q => ({ ...q, lessonId: null })),
];

const build = (over: { bank?: BankQuestion[] } = {}) =>
  buildCourseArchive({
    outline,
    lessons: new Map([
      ['signs', signsLesson],
      ['speed', speedLesson],
    ]),
    bank: {
      questions:
        over.bank ??
        bankOf(
          [signsLesson, speedLesson],
          [question('pool-merge', { kind: 'pool', assetId: 'a-pool' })],
        ),
      assets: [asset('a-pool', 'e')],
    },
    draft: false,
    generatedAt: new Date('2026-09-27T10:00:00Z'),
  });

const pageAt = (files: ArchiveFile[], path: string): string => {
  const file = files.find(entry => entry.path === path);
  assert.ok(file != null && file.kind === 'page', `missing page ${path}`);
  return file.html;
};

test('everything unpacks into one folder, a folder per module', () => {
  const { root, files } = build();
  assert.equal(root, 'ca-class-c v1.2.0');
  assert.deepEqual(files.map(file => file.path).sort(), [
    'ca-class-c v1.2.0/01 Read the Road/01 Signs & Signals.html',
    'ca-class-c v1.2.0/01 Read the Road/Module test.html',
    'ca-class-c v1.2.0/01 Read the Road/images/a-cover.svg',
    'ca-class-c v1.2.0/01 Read the Road/images/a-inline.svg',
    'ca-class-c v1.2.0/01 Read the Road/images/a-pool.svg',
    'ca-class-c v1.2.0/01 Read the Road/images/a-test.svg',
    // A title's slash and colon cannot be part of a file name.
    'ca-class-c v1.2.0/02 Speed Space/02 Speed Limits.html',
    'ca-class-c v1.2.0/02 Speed Space/Module test.html',
    'ca-class-c v1.2.0/02 Speed Space/images/a-cover.svg',
    'ca-class-c v1.2.0/index.html',
  ]);
  // Each module's folder holds its own copy, even under a shared id.
  const covers = files.filter(
    file => file.kind === 'asset' && file.asset.assetId === 'a-cover',
  );
  assert.deepEqual(
    covers.map(file => (file.kind === 'asset' ? file.asset.sha256[0] : '')),
    ['a', 'd'],
  );
});

test('a lesson page carries every slide and the lesson test, answers marked', () => {
  const html = pageAt(
    build().files,
    'ca-class-c v1.2.0/01 Read the Road/01 Signs & Signals.html',
  );
  // Slides, in the learner's order.
  const order = [
    'Try this first',
    'Stop means stop',
    'Checkpoint',
    'Recall · Stops',
    'Drive smarter',
    'Lesson test · 2 questions',
  ].map(needle => html.indexOf(needle));
  assert.ok(
    order.every(
      (at, index) => at > 0 && (index === 0 || at > order[index - 1]),
    ),
    `out of order: ${order.join(',')}`,
  );
  // Authored text is escaped, not interpreted.
  assert.ok(html.includes('Come to a &lt;full&gt; stop.'));
  assert.ok(html.includes('<li>Before the crosswalk</li>'));
  // The folded image, the inline one and the test's picture, beside the page.
  assert.ok(html.includes('src="images/a-cover.svg"'));
  assert.ok(html.includes('src="images/a-inline.svg"'));
  assert.ok(html.includes('src="images/a-test.svg"'));
  // Hidden recall words are shown, marked.
  assert.ok(html.includes('<span class="gap">limit line</span>'));
  // Every question shows its correct choice and its explanation.
  for (const id of ['q-open', 'q-check', 'q-t1', 'q-t2']) {
    assert.ok(
      html.includes(
        `<li class="correct"><span class="letter">B</span><span>Right ${id} ✓`,
      ),
      `${id} correct answer`,
    );
    assert.ok(html.includes(`Because of ${id}.`), `${id} explanation`);
  }
  // Test questions carry the anchors a module test links to.
  assert.ok(html.includes('id="q-q-t2"'));
  // The last lesson of a module leads on to the module's test.
  assert.ok(html.includes('href="Module%20test.html"'));
});

test('a module test lists its picks and where each is read', () => {
  const html = pageAt(
    build().files,
    'ca-class-c v1.2.0/01 Read the Road/Module test.html',
  );
  assert.ok(html.includes('3 questions'));
  // A lesson's question links to its place in the lesson's test.
  assert.ok(
    html.includes(
      'href="../01%20Read%20the%20Road/01%20Signs%20%26%20Signals.html#q-q-t2"',
    ),
  );
  // A pool question has no lesson, so it is shown here in full.
  assert.ok(html.includes('Pool question (below)'));
  assert.ok(html.includes('Right pool-merge ✓'));
  assert.ok(html.includes('src="images/a-pool.svg"'));
  // A pick the bank does not hold is called out rather than dropped.
  assert.ok(html.includes('q-gone'));
  assert.ok(html.includes('not in this version’s bank'));
  // The lesson's own test questions are not repeated here in full.
  assert.equal(html.includes('Because of q-t2.'), false);
});

test('the bank wins over a lesson document’s own copy of a question', () => {
  const bank = bankOf([signsLesson, speedLesson], []).map(q =>
    q.questionId === 'q-t1' ? { ...q, prompt: 'Fixed prompt?' } : q,
  );
  const html = pageAt(
    build({ bank }).files,
    'ca-class-c v1.2.0/01 Read the Road/01 Signs & Signals.html',
  );
  assert.ok(html.includes('Fixed prompt?'));
  assert.equal(html.includes('Prompt of q-t1?'), false);
});

test('the contents page lists modules, lessons and module tests', () => {
  const html = pageAt(build().files, 'ca-class-c v1.2.0/index.html');
  assert.ok(html.includes('Module 1 · Read the Road'));
  assert.ok(
    html.includes(
      'href="01%20Read%20the%20Road/01%20Signs%20%26%20Signals.html"',
    ),
  );
  assert.ok(html.includes('href="02%20Speed%20Space/Module%20test.html"'));
  assert.ok(html.includes('5 slides · 2 test questions'));
});

test('a file name drops what a desktop refuses', () => {
  assert.equal(safeName('Speed: limits / space?', 'x'), 'Speed limits space');
  assert.equal(safeName('Ends with dots...', 'x'), 'Ends with dots');
  assert.equal(safeName(' / ', 'fallback'), 'fallback');
  // Plain ASCII, so no unzip can mangle it.
  assert.equal(safeName('Pass—or Wait', 'x'), 'Pass - or Wait');
  assert.equal(safeName('Driver’s Café “rules”', 'x'), "Driver's Cafe rules");
});

// ---------------------------------------------------------------------------
// The zip

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('a zip lists every entry with its size and checksum', () => {
  const picture = new Uint8Array([1, 2, 3, 4, 5]);
  const zip = zipArchive(
    [
      { path: 'root/index.html', data: '<p>héllo</p>' },
      { path: 'root/01 Módulo/images/a.png', data: picture },
    ],
    new Date(2026, 8, 27, 12, 30, 10),
  );
  const view = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const seen: [string, number, number][] = [];
  for (let index = 0; index < 2; index += 1) {
    assert.equal(view.getUint32(cursor, true), 0x02014b50);
    const nameLength = view.getUint16(cursor + 28, true);
    const name = decoder.decode(
      zip.slice(cursor + 46, cursor + 46 + nameLength),
    );
    const size = view.getUint32(cursor + 24, true);
    const local = view.getUint32(cursor + 42, true);
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const localName = view.getUint16(local + 26, true);
    const data = zip.slice(
      local + 30 + localName,
      local + 30 + localName + size,
    );
    assert.equal(crc32(data), view.getUint32(cursor + 16, true));
    seen.push([name, size, data[0]]);
    cursor += 46 + nameLength;
  }
  assert.deepEqual(seen, [
    ['root/index.html', 13, '<'.charCodeAt(0)],
    ['root/01 Módulo/images/a.png', 5, 1],
  ]);
});
