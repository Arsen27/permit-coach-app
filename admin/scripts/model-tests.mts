import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCompare } from '../src/model/compare.js';
import { diffWords, runsForSide } from '../src/model/diff.js';
import type { RenderCard } from '../src/model/renderCard.js';
import { failureFor } from '../src/store/loadFailure.js';
import { originOf } from '../src/model/blockOrigin.js';

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
  assert.equal(failureFor(errors, 'draft:ca-class-c:3-3-1', null), 'outline: 500');
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
