import assert from 'node:assert/strict';
import { test } from 'node:test';

import './browserEnv.mts';

// The prompt builder keeps its boards apart and loses none of them.
//
// Both of these are promises to whoever spends an hour picking excerpts out of
// a course: a request about wording, one about artwork and one about schemas
// never bleed into one another, and nothing collected goes away because a page
// reloaded or the panel was redeployed under it. The store is the only thing
// that can keep either promise, so it is tested directly rather than through
// the panel.
//
// Every test walks PROMPT_BOARDS rather than naming two or three boards, so a
// board added later is covered the day it is added.

const KEY = 'permitcoach.prompt';

// A fresh module registry, so the store reads storage again exactly as it does
// on a page load. `?fresh=` is what makes the import a different specifier.
let load = 0;
const reload = async () => {
  load += 1;
  return (await import(
    `../src/store/promptStore.js?fresh=${load}`
  )) as typeof import('../src/store/promptStore.js');
};

const excerpt = (text: string) => ({
  text,
  source: 'CA 1.0.6 · Traffic signals',
  note: '',
  anchor: null,
});

test('the boards do not see each other', async () => {
  localStorage.clear();
  const { usePrompt, PROMPT_BOARDS } = await reload();
  const it = usePrompt.getState;

  assert.ok(PROMPT_BOARDS.length >= 3, 'text, images and schemas at least');

  // One excerpt and one instruction on each, all of them different.
  for (const board of PROMPT_BOARDS) {
    it().setBoard(board);
    assert.equal(it().board, board);
    it().add(excerpt(`An excerpt for ${board}.`));
    it().setOverallNote(`Instructions for ${board}.`);
  }

  // Each board kept its own, and only its own.
  for (const board of PROMPT_BOARDS) {
    assert.equal(it().boards[board].chunks.length, 1, board);
    assert.equal(it().boards[board].chunks[0].text, `An excerpt for ${board}.`);
    assert.equal(it().boards[board].overallNote, `Instructions for ${board}.`);
  }

  // Editing one leaves every other exactly where it was.
  const [first, ...rest] = PROMPT_BOARDS;
  it().setBoard(first);
  it().setNote(it().boards[first].chunks[0].id, 'Shorter.');
  assert.equal(it().boards[first].chunks[0].note, 'Shorter.');
  for (const board of rest) {
    assert.equal(it().boards[board].chunks[0].note, '', board);
  }
});

test('clearing empties the board being looked at, and only it', async () => {
  localStorage.clear();
  const { usePrompt, PROMPT_BOARDS } = await reload();
  const it = usePrompt.getState;

  for (const board of PROMPT_BOARDS) {
    it().setBoard(board);
    it().add(excerpt(`An excerpt for ${board}.`));
    it().setOverallNote(`Instructions for ${board}.`);
  }

  // Emptied one at a time, each leaves the ones still to come untouched: the
  // other boards are somebody's unfinished work as far as this button knows.
  for (const [index, board] of PROMPT_BOARDS.entries()) {
    it().setBoard(board);
    it().clear();
    assert.deepEqual(it().boards[board].chunks, [], board);
    assert.equal(it().boards[board].overallNote, '', board);
    for (const untouched of PROMPT_BOARDS.slice(index + 1)) {
      assert.equal(it().boards[untouched].chunks.length, 1, untouched);
      assert.equal(
        it().boards[untouched].overallNote,
        `Instructions for ${untouched}.`,
      );
    }
  }
});

test('what was collected is still there after a reload', async () => {
  localStorage.clear();
  const first = await reload();
  first.usePrompt.getState().add(excerpt('A yellow light.'));
  first.usePrompt.getState().setNote(
    first.usePrompt.getState().boards.text.chunks[0].id,
    'Make this shorter.',
  );
  first.usePrompt.getState().setOverallNote('Eighth-grade reading level.');
  first.usePrompt.getState().setBoard('images');
  first.usePrompt.getState().add(excerpt('The roundabout diagram.'));
  first.usePrompt.getState().setBoard('schemas');
  first.usePrompt.getState().add(excerpt('The right-of-way schema.'));
  first.usePrompt.getState().setBoard('images');

  // A reload is a new module instance reading the same storage.
  const second = await reload();
  const state = second.usePrompt.getState();
  assert.equal(state.board, 'images', 'it reopens on the board last used');
  assert.equal(state.boards.text.chunks.length, 1);
  assert.equal(state.boards.text.chunks[0].text, 'A yellow light.');
  assert.equal(state.boards.text.chunks[0].note, 'Make this shorter.');
  assert.equal(state.boards.text.overallNote, 'Eighth-grade reading level.');
  assert.equal(state.boards.images.chunks[0].text, 'The roundabout diagram.');
  assert.equal(state.boards.schemas.chunks[0].text, 'The right-of-way schema.');

  // And an excerpt added after the reload does not take an id the restored one
  // already has — which a counter starting again at one would have done.
  state.add(excerpt('A second image note.'));
  const ids = Object.values(second.usePrompt.getState().boards).flatMap(board =>
    board.chunks.map(chunk => chunk.id),
  );
  assert.equal(new Set(ids).size, ids.length, 'two excerpts share an id');
});

test('unreadable storage costs the session, never the start', async () => {
  // A half-written key, a value from a shape that no longer exists, a string
  // that is not JSON at all: the panel opens empty rather than not at all.
  for (const broken of [
    '{',
    'null',
    '[]',
    '{"boards":{"text":{"chunks":"not a list"}}}',
    '{"board":"notaboard","boards":{"text":{"chunks":[{"note":"no text"}]}}}',
  ]) {
    localStorage.setItem(KEY, broken);
    const { usePrompt, PROMPT_BOARDS } = await reload();
    const state = usePrompt.getState();
    assert.ok(
      PROMPT_BOARDS.includes(state.board),
      `${broken} left the board unusable`,
    );
    for (const board of PROMPT_BOARDS) {
      assert.ok(Array.isArray(state.boards[board].chunks), board);
      assert.equal(typeof state.boards[board].overallNote, 'string', board);
    }
    // And it is usable straight away.
    state.add(excerpt('Still works.'));
    assert.equal(
      usePrompt.getState().boards[state.board].chunks.at(-1)?.text,
      'Still works.',
    );
  }
});

test('an excerpt that survives a reload keeps where it came from', async () => {
  localStorage.clear();
  const first = await reload();
  first.usePrompt.getState().add({
    text: 'Stop behind the limit line.',
    source: 'CA 1.0.6 · Traffic signals',
    note: 'Say it in fewer words.',
    anchor: { blockId: 'ca-traffic-signals-slide-02', from: 1, to: 1 },
  });

  const second = await reload();
  const chunk = second.usePrompt.getState().boards.text.chunks[0];
  assert.equal(chunk.source, 'CA 1.0.6 · Traffic signals');
  assert.equal(chunk.note, 'Say it in fewer words.');
  // The anchor is what stops a request from being ambiguous, so it has to
  // outlive the page as much as the quote does.
  assert.deepEqual(chunk.anchor, {
    blockId: 'ca-traffic-signals-slide-02',
    from: 1,
    to: 1,
  });
});
