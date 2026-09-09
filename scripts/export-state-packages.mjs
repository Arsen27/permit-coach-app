#!/usr/bin/env node
// The state packages, as data, for the panel.
//
//   node scripts/export-state-packages.mjs            # write it
//   node scripts/export-state-packages.mjs --check    # compare, write nothing
//
// Reads  courses/states/<xx>/state.json and lessons.mjs
// Writes server/skeleton/states.json
//
// The skeleton document says what every state shares. This says what each one
// does not: the parameter values behind the {{placeholders}}, the notes each
// state anchors onto a skeleton card, the overrides, and the lessons of the
// state module. Together they are what the panel needs to show, on one screen,
// which part of a lesson is universal and which part belongs to one state.
//
// Nothing here is served to the app: a state's material reaches a device only
// as a built release. This is the panel's read-only view of the inputs.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATES = path.join(ROOT, 'courses/states');
const SKELETON_DOC = path.join(ROOT, 'server/skeleton/skeleton.json');
const OUTPUT = path.join(ROOT, 'server/skeleton/states.json');

const CHECK_ONLY = process.argv.slice(2).includes('--check');

const json = value => JSON.stringify(value, null, 2) + '\n';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const skeleton = readJson(SKELETON_DOC);
// Every anchor the skeleton owns, so a note pointing at a card that no longer
// exists is reported here rather than discovered at build time.
const anchors = new Set(
  skeleton.modules.flatMap(module =>
    module.lessons.flatMap(lesson => lesson.cards.map(card => card.anchor)),
  ),
);

const states = [];
for (const dir of fs.readdirSync(STATES).sort()) {
  const statePath = path.join(STATES, dir, 'state.json');
  if (!fs.existsSync(statePath)) {
    continue;
  }
  const state = readJson(statePath);
  const lessonsPath = path.join(STATES, dir, 'lessons.mjs');
  const lessons = fs.existsSync(lessonsPath)
    ? (await import(pathToFileURL(lessonsPath).href + `?t=${Date.now()}`))
        .LESSONS ?? {}
    : {};
  const dangling = (state.notes ?? [])
    .map(note => note.after)
    .filter(after => !anchors.has(after));
  if (dangling.length > 0) {
    console.warn(
      `${state.stateCode}: ${dangling.length} note(s) anchored on a card the skeleton does not have — ${dangling
        .slice(0, 3)
        .join(', ')}`,
    );
  }
  states.push({
    stateCode: state.stateCode,
    courseId: state.courseId,
    idPrefix: state.idPrefix,
    name: state.vars.state,
    sourceVersionLabel: state.release.sourceVersionLabel,
    version: state.release.version,
    vars: state.vars,
    params: state.params,
    notes: state.notes ?? [],
    overrides: state.overrides ?? { cards: {}, questions: {} },
    lessons,
  });
}

const document = { schemaVersion: 1, states };
const body = json(document);

if (CHECK_ONLY) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : null;
  if (current === body) {
    console.log(`states.json is current (${states.length} states)`);
    process.exit(0);
  }
  console.error('states.json differs from courses/states; run without --check');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, body);
console.log(
  `${path.relative(ROOT, OUTPUT)}: ` +
    states
      .map(
        state =>
          `${state.stateCode} (${Object.keys(state.params).length} params, ` +
          `${state.notes.length} notes, ` +
          `${Object.values(state.lessons).flat().length} state lessons)`,
      )
      .join(' · '),
);
