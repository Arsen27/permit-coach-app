import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCompare } from '../src/model/compare.js';
import { diffWords, runsForSide } from '../src/model/diff.js';
import type { RenderCard } from '../src/model/renderCard.js';
import { failureFor } from '../src/store/loadFailure.js';
import { originOf } from '../src/model/blockOrigin.js';
import {
  anchorOfSelection,
  describeAnchor,
} from '../src/model/excerptAnchor.js';
import { buildPromptText } from '../src/model/promptText.js';

// The diff and the pairing decide what an editor believes changed, so they are
// covered directly rather than only through the UI.

const card = (partial: Partial<RenderCard> & { key: string }): RenderCard => ({
  type: 'core_rule',
  kicker: { label: 'Core rule', icon: 'book-open', tone: 'accent' },
  title: '',
  bodies: [],
  refs: {},
  ...partial,
});

const text = (runs: ReturnType<typeof diffWords>, side: 'before' | 'after') =>
  runsForSide(runs, side)
    .map(run => run.words.join(' '))
    .join(' ');

test('unchanged text produces a single kept run', () => {
  const runs = diffWords('solid means stay', 'solid means stay');
  assert.deepEqual(runs, [{ kind: 0, words: ['solid', 'means', 'stay'] }]);
});

test('a replaced word is one deletion and one insertion', () => {
  const runs = diffWords('two feet apart', 'two metres apart');
  assert.deepEqual(
    runs.map(run => [run.kind, run.words.join(' ')]),
    [
      [0, 'two'],
      [-1, 'feet'],
      [1, 'metres'],
      [0, 'apart'],
    ],
  );
  // Each pane shows its own wording and none of the other's.
  assert.equal(text(runs, 'before'), 'two feet apart');
  assert.equal(text(runs, 'after'), 'two metres apart');
});

test('appended words count as insertions only', () => {
  const runs = diffWords('pass when clear', 'pass when clear and safe');
  assert.deepEqual(
    runs.filter(run => run.kind === 1).flatMap(run => run.words),
    ['and', 'safe'],
  );
  assert.equal(runs.filter(run => run.kind === -1).length, 0);
});

test('diffing against nothing marks every word inserted', () => {
  const runs = diffWords('', 'brand new sentence');
  assert.deepEqual(runs, [{ kind: 1, words: ['brand', 'new', 'sentence'] }]);
});

test('compare pairs cards by position and totals the word changes', () => {
  const left = [
    card({ key: 'a', title: 'Solid means stay', bodies: ['No passing here'] }),
    card({ key: 'b', title: 'Second card' }),
  ];
  const right = [
    card({ key: 'a', title: 'Solid means wait', bodies: ['No passing there'] }),
    card({ key: 'b', title: 'Second card' }),
  ];

  const result = buildCompare(left, right, true);
  assert.equal(result.rows.length, 2);
  // One title word and one body word replaced.
  assert.deepEqual(result.stats, { insertions: 2, deletions: 2 });
  assert.equal(
    result.rows[1].diff?.title.every(run => run.kind === 0),
    true,
  );
});

test('cards missing on one side are reported as added or removed', () => {
  const left = [
    card({ key: 'a', title: 'Kept' }),
    card({ key: 'b', title: 'Fresh card here' }),
  ];
  const right = [card({ key: 'a', title: 'Kept' })];

  const result = buildCompare(left, right, true);
  assert.equal(result.rows[1].added, true);
  assert.equal(result.rows[1].removed, false);
  assert.equal(result.rows[1].right, undefined);
  assert.equal(result.stats.insertions, 3);

  const reversed = buildCompare(right, left, true);
  assert.equal(reversed.rows[1].removed, true);
  assert.equal(reversed.stats.deletions, 3);
});

test('answer options are diffed slot by slot', () => {
  const options = (texts: string[]) =>
    texts.map((value, index) => ({
      id: String(index),
      text: value,
      correct: index === 0,
    }));

  const result = buildCompare(
    [
      card({
        key: 'q',
        title: 'Q',
        options: options(['Stay behind', 'Pass now']),
      }),
    ],
    [
      card({
        key: 'q',
        title: 'Q',
        options: options(['Stay put', 'Pass now']),
      }),
    ],
    true,
  );

  assert.equal(result.rows[0].diff?.options.length, 2);
  assert.deepEqual(result.stats, { insertions: 1, deletions: 1 });
});

test('a redrawn illustration is reported even when no word changed', () => {
  const withImage = (assetId: string, svgXml: string, alt: string) =>
    card({
      key: 'v',
      title: 'Same title',
      bodies: ['Same body'],
      image: { assetId, alt, svgXml },
    });

  const result = buildCompare(
    [withImage('a02', '<svg>new</svg>', 'Redrawn sign families diagram')],
    [withImage('a01', '<svg>old</svg>', 'Sign families diagram')],
    true,
  );

  assert.equal(result.rows[0].artworkChanged, true);
  assert.equal(result.artworkChanges, 1);
  // The alt text is authored copy, so its edit is a real word change.
  assert.ok(result.stats.insertions > 0);

  const unchanged = buildCompare(
    [withImage('a01', '<svg>same</svg>', 'Same alt')],
    [withImage('a01', '<svg>same</svg>', 'Same alt')],
    true,
  );
  assert.equal(unchanged.artworkChanges, 0);
  assert.deepEqual(unchanged.stats, { insertions: 0, deletions: 0 });
});

test('with the diff off no runs are computed and nothing is counted', () => {
  const result = buildCompare(
    [card({ key: 'a', title: 'One' })],
    [card({ key: 'a', title: 'Two' })],
    false,
  );
  assert.equal(result.rows[0].diff, undefined);
  assert.deepEqual(result.stats, { insertions: 0, deletions: 0 });
});

// A pane that stays blank explains nothing. When a lesson fails to load, the
// reason is kept so the screen can say it — the last time one of these went
// silent, the server, the database and the renderer were all searched before
// anyone found out the request had simply failed.
test('the empty pane can say why it is empty', () => {
  const errors = {
    'draft:ca-class-c:3-3-1': 'outline: 500',
    'draft:ca-class-c:3-3-1/ca-traffic-signals': 'lesson: 404',
  };

  assert.equal(
    failureFor(errors, 'draft:ca-class-c:3-3-1', 'ca-traffic-signals'),
    'lesson: 404',
  );
  // With no lesson chosen, the outline's own failure is what to say.
  assert.equal(
    failureFor(errors, 'draft:ca-class-c:3-3-1', null),
    'outline: 500',
  );
  // A lesson that loaded falls back to the outline's state, and a version
  // that never failed says nothing at all.
  assert.equal(failureFor(errors, 'draft:ca-class-c:9-9-9', null), null);
  assert.equal(failureFor(errors, null, 'ca-traffic-signals'), null);
});

// --- where a block of a state's course comes from --------------------------
// The badge on the state screen is the whole warning: a shared card edited
// there would be regenerated away. The mapping is bare-id based, the same way
// the state package and the skeleton both key their material.

test('originOf reads a block id against the skeleton and the state overrides', () => {
  const origins = {
    stateCode: 'CA',
    idPrefix: 'ca',
    sharedCards: ['traffic-signals-slide-01', 'traffic-signals-slide-02'],
    sharedQuestions: [],
    overriddenCards: ['traffic-signals-slide-02'],
    overriddenQuestions: [],
    overridableQuestions: [],
  };

  assert.deepEqual(originOf(origins, 'ca-traffic-signals-slide-01'), {
    origin: 'shared',
    bareId: 'traffic-signals-slide-01',
  });
  // An override wins: the shared text no longer reaches this state.
  assert.deepEqual(originOf(origins, 'ca-traffic-signals-slide-02'), {
    origin: 'overridden',
    bareId: 'traffic-signals-slide-02',
  });
  // A note, a state lesson, or a course nothing regenerates.
  assert.deepEqual(originOf(origins, 'ca-permit-and-knowledge-test-slide-01'), {
    origin: 'own',
    bareId: 'permit-and-knowledge-test-slide-01',
  });
  // A block id that already lacks the prefix is read as it stands.
  assert.equal(originOf(origins, 'traffic-signals-slide-01')?.origin, 'shared');
  assert.equal(originOf(null, 'ca-anything'), null);
});

// --- where an excerpt came from -------------------------------------------
// A quote alone is ambiguous: the same sentence lives in more than one slide.
// The request has to name the block and the lines, or a model will edit the
// wrong card with a clear conscience.

test('the prompt names the block and the lines an excerpt came from', () => {
  const anchor = {
    lessonId: 'ca-traffic-signals',
    blockId: 'ca-traffic-signals-slide-02',
    cardIndex: 3,
    cardCount: 14,
    kicker: 'Core rule',
    fromLine: 2,
    toLine: 3,
    lineTexts: [
      'Someone may still be in the intersection.',
      'Let pedestrians, cyclists, and vehicles clear your path.',
    ],
  };
  const text = buildPromptText(
    [
      {
        id: 'c1',
        text: 'clear your path',
        source: 'v1.0.1 · STOP, YIELD, or Keep Going?',
        note: 'Say who yields first.',
        anchor,
      },
    ],
    '',
    { courseTitle: 'California', usState: 'CA', versionLabel: 'v1.0.1' },
  );

  assert.match(text, /Lesson: `ca-traffic-signals`/);
  assert.match(text, /Block: `ca-traffic-signals-slide-02`/);
  assert.match(text, /Core rule · card 3 of 14 · lines 2–3/);
  // The lines are quoted whole and numbered from the card's own count, so the
  // fragment can be located inside them.
  assert.match(text, /^2\. Someone may still be in the intersection\.$/m);
  assert.match(
    text,
    /^3\. Let pedestrians, cyclists, and vehicles clear your path\.$/m,
  );
  assert.match(text, /> clear your path/);
  assert.match(text, /Requested change: Say who yields first\./);
  // And the numbering is explained rather than left to be guessed at.
  assert.match(text, /Line 1 of a card is its/);
});

test('an excerpt with no place claims none', () => {
  const text = buildPromptText(
    [{ id: 'c1', text: 'a quote', source: 'v1 · lesson', note: '' }],
    '',
    { courseTitle: 'California', usState: 'CA', versionLabel: 'v1' },
  );
  assert.doesNotMatch(text, /Block:/);
  assert.doesNotMatch(text, /Line 1 of a card/);
  assert.match(text, /> a quote/);
});

test('one line reads as one line, not a range', () => {
  assert.equal(
    describeAnchor({
      lessonId: 'l',
      blockId: 'b',
      cardIndex: 1,
      cardCount: 9,
      kicker: 'Exam trap',
      fromLine: 4,
      toLine: 4,
      lineTexts: ['x'],
    }),
    'Exam trap · card 1 of 9 · line 4',
  );
});

test('a whole-card selection still reports a place', async () => {
  // The card's number and kicker are chrome, not lines: a drag that starts on
  // them used to yield no anchor at all, which is exactly the gesture an
  // operator makes to quote a card whole. Needs a real DOM, so jsdom stands in
  // for the browser the panel actually runs in.
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>');
  const { document } = dom.window;
  const previousNode = (globalThis as { Node?: unknown }).Node;
  (globalThis as { Node?: unknown }).Node = dom.window.Node;

  const card = document.createElement('article');
  Object.assign(card.dataset, {
    blockId: 'ca-traffic-signals-slide-06',
    cardIndex: '6',
    cardCount: '14',
    kicker: 'California specific',
    lessonId: 'ca-traffic-signals',
  });
  const badge = document.createElement('span');
  badge.textContent = '06';
  card.appendChild(badge);
  for (const [n, value] of [
    [1, 'Red arrows and limit lines in California'],
    [2, 'A red arrow means no turn at all.'],
  ] as [number, string][]) {
    const line = document.createElement('p');
    line.dataset.line = String(n);
    line.textContent = value;
    card.appendChild(line);
  }
  document.body.appendChild(card);

  const anchor = anchorOfSelection({
    rangeCount: 1,
    anchorNode: badge.firstChild,
    focusNode: badge.firstChild,
    toString: () => '06 Red arrows',
  } as unknown as Selection);

  assert.notEqual(anchor, null);
  assert.equal(anchor!.blockId, 'ca-traffic-signals-slide-06');
  assert.equal(anchor!.lessonId, 'ca-traffic-signals');
  assert.equal(anchor!.fromLine, 1);
  assert.equal(anchor!.toLine, 2);
  assert.equal(anchor!.lineTexts.length, 2);
  assert.equal(
    describeAnchor(anchor!),
    'California specific · card 6 of 14 · lines 1–2',
  );

  // And a drag that does start inside a line still reports just that line.
  const one = anchorOfSelection({
    rangeCount: 1,
    anchorNode: card.querySelectorAll('[data-line]')[1].firstChild,
    focusNode: card.querySelectorAll('[data-line]')[1].firstChild,
    toString: () => 'no turn at all',
  } as unknown as Selection);
  assert.equal(one!.fromLine, 2);
  assert.equal(one!.toLine, 2);
  assert.deepEqual(one!.lineTexts, ['A red arrow means no turn at all.']);

  (globalThis as { Node?: unknown }).Node = previousNode;
});
