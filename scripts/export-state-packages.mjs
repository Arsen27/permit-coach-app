#!/usr/bin/env node
// The state packages, as data, for the panel.
//
//   node scripts/export-state-packages.mjs            # write it
//   node scripts/export-state-packages.mjs --check    # compare, write nothing
//
// Reads  courses/states/<xx>/state.json and lessons.mjs, and each state's rule
//        catalogue (the path its state.json names)
// Writes server/skeleton/states.json and server/skeleton/rules.json
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
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATES = path.join(ROOT, 'courses/states');
const SKELETON_DOC = path.join(ROOT, 'server/skeleton/skeleton.json');
const OUTPUT = path.join(ROOT, 'server/skeleton/states.json');
const RULES_OUTPUT = path.join(ROOT, 'server/skeleton/rules.json');

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

// Every number a rule states, gathered exactly the way the builder gathers them
// (values, authoringRule, conditions, exceptions, notes). A parameter's digits
// must all appear here or the build fails, so the panel validates against the
// same set rather than a second opinion about it.
const ruleNumbers = rule => {
  const found = new Set();
  const visit = value => {
    if (value == null) return;
    if (typeof value === 'number') found.add(String(value));
    else if (typeof value === 'string') {
      for (const n of value.match(/\d[\d,]*(?:\.\d+)?/g) || []) {
        found.add(n.replace(/,/g, ''));
      }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(rule.values);
  visit(rule.authoringRule);
  visit(rule.conditions);
  visit(rule.exceptions);
  visit(rule.notes);
  return [...found].sort();
};

// courses/states/<xx>/assets: the pictures a state adds or replaces, indexed
// the way the skeleton's own library is.
const stateAssets = dir => {
  const indexPath = path.join(STATES, dir, 'assets/index.json');
  if (!fs.existsSync(indexPath)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(readJson(indexPath)).map(([assetId, meta]) => {
      const file = path.join(STATES, dir, 'assets', `${assetId}.svg`);
      if (!fs.existsSync(file)) {
        throw new Error(`${dir}: asset ${assetId} is indexed but not on disk`);
      }
      return [
        assetId,
        {
          ...meta,
          sha256: crypto
            .createHash('sha256')
            .update(fs.readFileSync(file))
            .digest('hex'),
        },
      ];
    }),
  );
};

const states = [];
const catalogues = {};
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
  // The catalogue, projected to what citing and validating a rule needs: the
  // sentence a reviewer reads, and the numbers the builder will check against.
  // The full catalogues stay in scripts/ — they are scraped law, not authoring.
  if (state.ruleCatalog) {
    const catalog = readJson(path.join(ROOT, state.ruleCatalog));
    catalogues[state.stateCode] = {
      catalogId: catalog.catalogId,
      source: state.ruleCatalog,
      // The sha256 of the catalogue this was projected from. Nothing
      // regenerates the projection, so the server compares this against the
      // catalogue it is handed and refuses to validate a parameter against a
      // projection that has fallen behind — under lockstep, one wrongly
      // accepted value blocks the release for every state.
      catalogSha256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(ROOT, state.ruleCatalog)))
        .digest('hex'),
      rules: catalog.rules.map(rule => ({
        ruleId: rule.ruleId,
        conceptId: rule.conceptId,
        authoringRule: rule.authoringRule ?? '',
        status: rule.status ?? '',
        numbers: ruleNumbers(rule),
      })),
    };
  }

  states.push({
    stateCode: state.stateCode,
    courseId: state.courseId,
    idPrefix: state.idPrefix,
    name: state.vars.state,
    sourceVersionLabel: state.release.sourceVersionLabel,
    version: state.release.version,
    // What the generated course document says about itself, and what a release
    // of it carries. The version is not among them on purpose: the train
    // assigns one number to every member, so a package no longer names its own.
    // The state's own pictures, with the hash of each: the server generates the
    // course now, and a generated document carries the picture inline.
    assetIndex: stateAssets(dir),
    course: state.course,
    release: (({ version, ...rest }) => rest)(state.release),
    ruleCatalog: state.ruleCatalog,
    vars: state.vars,
    params: state.params,
    notes: state.notes ?? [],
    overrides: state.overrides ?? { cards: {}, questions: {} },
    lessons,
  });
}

const document = { schemaVersion: 1, states };
const body = json(document);
const rulesBody = json({ schemaVersion: 1, states: catalogues });

if (CHECK_ONLY) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : null;
  const currentRules = fs.existsSync(RULES_OUTPUT)
    ? fs.readFileSync(RULES_OUTPUT, 'utf8')
    : null;
  if (current === body && currentRules === rulesBody) {
    console.log(`states.json is current (${states.length} states)`);
    process.exit(0);
  }
  console.error('states.json or rules.json differs from courses/states; run without --check');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, body);
fs.writeFileSync(RULES_OUTPUT, rulesBody);
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
console.log(
  `${path.relative(ROOT, RULES_OUTPUT)}: ` +
    Object.entries(catalogues)
      .map(([code, catalog]) => `${code} ${catalog.rules.length} rules`)
      .join(' · '),
);
