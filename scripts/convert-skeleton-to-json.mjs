#!/usr/bin/env node
// One-time converter: the universal skeleton stops being JavaScript modules
// and becomes one data document the server owns.
//
//   node scripts/convert-skeleton-to-json.mjs            # write it
//   node scripts/convert-skeleton-to-json.mjs --check    # compare, write nothing
//
// Reads
//   courses/skeleton/course.mjs            SKELETON_VERSION, MODULES, vocabulary
//   courses/skeleton/modules/module-0N.mjs the 29 universal lessons
//   courses/skeleton/assets/index.json     alt text and dimensions of the library
//
// Writes
//   server/skeleton/skeleton.json
//
// The .mjs files stay where they are: they are this converter's input, and the
// helpers in courses/skeleton/helpers.mjs are how the lessons were authored.
// Nothing else reads them once the builder has moved over — the document is the
// source of truth from here on, and re-running this after editing a .mjs is how
// an old-style edit reaches the builder.
//
// What travels unresolved, on purpose:
//   - every {{param}} placeholder, exactly as authored. The builder resolves
//     them per state; the document must not.
//   - the lesson and card order, because the concept ids the builder derives
//     (traffic-signals.slide.03) are positional. Reordering a card renames a
//     concept, so the conversion preserves order rather than normalising it.
//   - STATE_TOKENS, a regular expression, which JSON has no type for: it is
//     written as { pattern, flags } and rebuilt with new RegExp.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKELETON = path.join(ROOT, 'courses/skeleton');
const OUTPUT = path.join(ROOT, 'server/skeleton/skeleton.json');

const CHECK_ONLY = process.argv.slice(2).includes('--check');

const json = value => JSON.stringify(value, null, 2) + '\n';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const importModule = async file =>
  import(pathToFileURL(file).href + `?t=${Date.now()}`);

const course = await importModule(path.join(SKELETON, 'course.mjs'));

// A card, an image or a recall card, verbatim. The helpers already produce
// plain data; this only refuses anything JSON would silently drop.
const plain = (value, where) => {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
      throw new Error(`${where}: ${typeof value} cannot become data`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`${where}: ${value} cannot become data`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => plain(item, `${where}[${i}]`));
  }
  if (value instanceof RegExp || value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new Error(`${where}: ${value.constructor.name} cannot become data`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, plain(item, `${where}.${key}`)]),
  );
};

// The identity the builder derives for every card, added here so that the
// document names its own slots. A state note anchors on one of these
// ("distraction-and-fatigue-slide-03"), and the concept id is what the app's
// mastery model counts — both are positional, so they are written down rather
// than left to be recomputed by whoever reads the document next. The builder
// checks its own numbering against them on every build.
const pad = n => String(n).padStart(2, '0');
const withIdentity = (lessonId, cards) => {
  let slide = 0;
  let recall = 0;
  return cards.map(card => {
    if (card.kind === 'image') {
      // An image takes the number of the card that follows it.
      return { ...card, anchor: `${lessonId}-image-${pad(slide + 1)}` };
    }
    if (card.kind === 'recall') {
      recall += 1;
      return {
        ...card,
        anchor: `${lessonId}-recall-${pad(recall)}`,
        conceptId: `${lessonId}.recall.${pad(recall)}`,
      };
    }
    slide += 1;
    return {
      ...card,
      anchor: `${lessonId}-slide-${pad(slide)}`,
      conceptId: `${lessonId}.slide.${pad(slide)}`,
    };
  });
};

const modules = [];
for (const spec of course.MODULES) {
  // A module marked `state: true` has no universal lessons at all — every
  // state supplies its own. It stays in the document because it is part of the
  // shared structure: the title, the outcome and the position are universal,
  // only the lessons are not.
  const lessons = spec.state
    ? []
    : (await importModule(path.join(SKELETON, 'modules', spec.file))).LESSONS;
  if (!spec.state && !Array.isArray(lessons)) {
    throw new Error(`module ${spec.id}: ${spec.file} has no LESSONS export`);
  }
  modules.push({
    id: spec.id,
    title: spec.title,
    outcome: spec.outcome,
    scope: spec.state ? 'state_specific' : 'universal',
    lessons: plain(lessons, `module ${spec.id}`).map(lesson => ({
      ...lesson,
      conceptId: lesson.id,
      cards: withIdentity(lesson.id, lesson.cards),
    })),
  });
}

const document = {
  schemaVersion: 1,
  skeletonVersion: course.SKELETON_VERSION,
  vocabulary: {
    universalLiterals: course.UNIVERSAL_LITERALS,
    // Words the builder refuses in universal content.
    stateTokens: {
      pattern: course.STATE_TOKENS.source,
      flags: course.STATE_TOKENS.flags,
    },
    moduleTestPicks: course.MODULE_TEST_PICKS,
  },
  modules,
  // Alt text and dimensions of the shared picture library. The SVG files stay
  // files (courses/skeleton/assets/*.svg); only what was authored about them —
  // the alt sentence, the numbers baked into the drawing — becomes data, so
  // that the server can describe a picture it does not hold.
  assets: readJson(path.join(SKELETON, 'assets/index.json')),
};

const body = json(document);
const revision = crypto.createHash('sha256').update(body).digest('hex');
const lessons = modules.reduce((n, m) => n + m.lessons.length, 0);
const cards = modules.reduce(
  (n, m) => n + m.lessons.reduce((k, l) => k + l.cards.length, 0),
  0,
);
const placeholders = new Set(
  [...body.matchAll(/\{\{([A-Za-z][\w.]*)\}\}/g)].map(match => match[1]),
);

if (CHECK_ONLY) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : null;
  if (current === body) {
    console.log(`skeleton.json is current (${revision.slice(0, 12)})`);
    process.exit(0);
  }
  console.error(
    current == null
      ? 'skeleton.json does not exist; run without --check'
      : 'skeleton.json differs from the .mjs sources; run without --check',
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, body);
console.log(
  `${path.relative(ROOT, OUTPUT)}: ${document.skeletonVersion} · ${modules.length} modules · ` +
    `${lessons} universal lessons · ${cards} cards · ${Object.keys(document.assets).length} pictures · ` +
    `${placeholders.size} distinct placeholders`,
);
console.log(`revision ${revision}`);
