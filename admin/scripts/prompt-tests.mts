import assert from 'node:assert/strict';
import { test } from 'node:test';

import './browserEnv.mts';

// The prompt builder keeps two boards and loses neither of them.
//
// Both of these are promises to whoever spends an hour picking excerpts out of
// a course: the text request and the images request never bleed into one
// another, and nothing collected goes away because a page reloaded or the panel
// was redeployed under it. The store is the only thing that can keep either
// promise, so it is tested directly rather than through the panel.

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

test('the two boards do not see each other', async () => {
  localStorage.clear();
  const { usePrompt } = await reload();
  const it = usePrompt.getState;

  it().add(excerpt('A yellow light means the signal is changing.'));
  it().setOverallNote('Plain words, keep every number.');
  assert.equal(it().boards.text.chunks.length, 1);
  assert.equal(it().boards.images.chunks.length, 0);

  it().setBoard('images');
  assert.equal(it().board, 'images');
  it().add(excerpt('The diagram shows three lanes.'));
  it().setOverallNote('Redraw at 16:9.');

  // Each board kept its own excerpts and its own instructions.
  assert.equal(it().boards.text.chunks.length, 1);
  assert.equal(it().boards.images.chunks.length, 1);
  assert.equal(it().boards.text.overallNote, 'Plain words, keep every number.');
  assert.equal(it().boards.images.overallNote, 'Redraw at 16:9.');

  // Editing one leaves the other exactly where it was.
  const textChunk = it().boards.text.chunks[0];
  it().setBoard('text');
  it().setNote(textChunk.id, 'Shorter.');
  assert.equal(it().boards.text.chunks[0].note, 'Shorter.');
  assert.equal(it().boards.images.chunks[0].note, '');
});

test('clearing empties the board being looked at, and only it', async () => {
  localStorage.clear();
  const { usePrompt } = await reload();
  const it = usePrompt.getState;

  it().add(excerpt('Text one.'));
  it().setBoard('images');
  it().add(excerpt('Image one.'));
  it().setOverallNote('Keep the sign shapes.');

  it().clear();
  assert.deepEqual(it().boards.images.chunks, []);
  assert.equal(it().boards.images.overallNote, '');
  // The other board is somebody's unfinished work as far as this is concerned.
  assert.equal(it().boards.text.chunks.length, 1);
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

  // A reload is a new module instance reading the same storage.
  const second = await reload();
  const state = second.usePrompt.getState();
  assert.equal(state.board, 'images', 'it reopens on the board last used');
  assert.equal(state.boards.text.chunks.length, 1);
  assert.equal(state.boards.text.chunks[0].text, 'A yellow light.');
  assert.equal(state.boards.text.chunks[0].note, 'Make this shorter.');
  assert.equal(state.boards.text.overallNote, 'Eighth-grade reading level.');
  assert.equal(state.boards.images.chunks[0].text, 'The roundabout diagram.');

  // And an excerpt added after the reload does not take an id the restored one
  // already has — which a counter starting again at one would have done.
  state.add(excerpt('A second image note.'));
  const ids = [
    ...state.boards.text.chunks,
    ...second.usePrompt.getState().boards.images.chunks,
  ].map(chunk => chunk.id);
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
    const { usePrompt } = await reload();
    const state = usePrompt.getState();
    assert.ok(
      state.board === 'text' || state.board === 'images',
      `${broken} left the board unusable`,
    );
    assert.ok(Array.isArray(state.boards.text.chunks));
    assert.ok(Array.isArray(state.boards.images.chunks));
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
