#!/usr/bin/env node
// Build one state's course from the universal skeleton and the state package.
//
//   node scripts/build-state-course.mjs ca            # courses/states/ca
//   node scripts/build-state-course.mjs ca --check    # validate, write nothing
//
// Inputs
//   courses/skeleton/course.mjs           module structure, checks' vocabulary
//   courses/skeleton/modules/module-0N.mjs universal lessons with placeholders
//   courses/skeleton/assets/               shared SVG library + index.json
//   courses/states/<xx>/state.json        vars, params (each backed by a rule
//                                         of the state's catalog), notes,
//                                         overrides, release metadata
//   courses/states/<xx>/lessons.mjs       lessons of the state module(s)
//
// Output
//   server/content/<courseId>/<version>/{course.json,modules/*,lessons/*}
//   server/content/<courseId>/manifest.json (entry added or replaced)
//   courses/states/<xx>/build-report.md and build-report.json
//
// Everything a learner reads is either byte-identical to the skeleton, the
// skeleton rendered with this state's parameters, a state note, a state
// override, or a state lesson — and the report says which, per block.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { injectEmojiEverywhere, EMOJI_PATTERN } from './emoji-layer.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKELETON = path.join(ROOT, 'courses/skeleton');
const COMPETITOR_ROOT =
  process.env.DMV_COMPETITOR_ROOT || path.resolve(ROOT, '../dmv-competitors');

const [stateArg, ...flags] = process.argv.slice(2);
if (!stateArg) {
  console.error('usage: build-state-course.mjs <state> [--check]');
  process.exit(2);
}
const CHECK_ONLY = flags.includes('--check');
const STATE_DIR = path.join(ROOT, 'courses/states', stateArg.toLowerCase());

// ---------------------------------------------------------------- utilities
const json = value => JSON.stringify(value, null, 2) + '\n';
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const writeJson = (filename, value) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, json(value));
};
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const uuidFor = value => {
  const bytes = Buffer.from(sha256('dmv-learning:' + value).slice(0, 32), 'hex');
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
const pad = n => String(n).padStart(2, '0');
const importModule = async filename =>
  import(pathToFileURL(filename).href + `?t=${Date.now()}`);

// A sentence ends at . ! ? followed by space — but not inside "a.m." / "p.m.".
const SENTENCE_BREAK = /(?<=[.!?])(?<![ap]\.m\.)\s+/;
const wordCount = text =>
  ((text ?? '').normalize('NFKD').match(/[A-Za-z0-9½]+(?:['’][A-Za-z]+)?/g) || [])
    .length;
const sentences = text =>
  (text ?? '')
    .replace(/\[\[|\]\]/g, '')
    .split(SENTENCE_BREAK)
    .map(s => s.trim())
    .filter(Boolean);
const normalizedWords = text =>
  text.toLowerCase().normalize('NFKD').match(/[a-z0-9]+/g) || [];
const shingles = (text, size) => {
  const words = normalizedWords(text);
  return new Set(
    Array.from({ length: Math.max(0, words.length - size + 1) }, (_, i) =>
      words.slice(i, i + size).join(' '),
    ),
  );
};
const walkFiles = dir =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory()
          ? walkFiles(path.join(dir, entry.name))
          : [path.join(dir, entry.name)],
      )
    : [];

// ------------------------------------------------------------------- inputs
const course = await importModule(path.join(SKELETON, 'course.mjs'));
const { MODULES, UNIVERSAL_LITERALS, STATE_TOKENS, MODULE_TEST_PICKS } = course;
const state = readJson(path.join(STATE_DIR, 'state.json'));
const stateLessons = fs.existsSync(path.join(STATE_DIR, 'lessons.mjs'))
  ? (await importModule(path.join(STATE_DIR, 'lessons.mjs'))).LESSONS ?? {}
  : {};
// The shared library plus the state's own pictures (courses/states/<xx>/assets):
// a state entry overrides a library entry of the same bare id, and a state may
// add pictures the library does not have (its module-8 lessons, say).
const stateAssetIndexPath = path.join(STATE_DIR, 'assets/index.json');
const stateAssetIndex = fs.existsSync(stateAssetIndexPath) ? readJson(stateAssetIndexPath) : {};
const assetIndex = { ...readJson(path.join(SKELETON, 'assets/index.json')), ...stateAssetIndex };
const catalog = state.ruleCatalog
  ? readJson(path.join(ROOT, state.ruleCatalog))
  : { rules: [] };
const rulesById = new Map(catalog.rules.map(rule => [rule.ruleId, rule]));

const PREFIX = state.idPrefix;
const VERSION = state.release.version;
const OUTPUT = path.join(ROOT, 'server/content', state.courseId, VERSION);

const errors = [];
const warnings = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

// ------------------------------------------------------------ placeholders
const PLACEHOLDER = /\{\{([A-Za-z][\w.]*)\}\}/g;
const paramUse = new Map(); // key -> Set of block/question ids
const formatValue = value =>
  typeof value === 'number'
    ? Number.isInteger(value) && Math.abs(value) >= 1000
      ? value.toLocaleString('en-US')
      : String(value)
    : String(value);
const lookup = key => {
  if (Object.hasOwn(state.vars, key)) return { found: true, value: state.vars[key] };
  if (Object.hasOwn(state.params, key)) {
    return { found: true, value: state.params[key].value };
  }
  return { found: false };
};
const hasPlaceholder = text => PLACEHOLDER.test(text ?? '') && !(PLACEHOLDER.lastIndex = 0);

// Render one text: substitute; a sentence with a null value is dropped
// (mode 'drop'), or the null is an error (mode 'strict').
const render = (text, where, mode = 'drop') => {
  if (text == null) return text;
  let rendered = false;
  const renderSentence = sentence => {
    let dropped = false;
    const out = sentence.replace(PLACEHOLDER, (_, key) => {
      rendered = true;
      const hit = lookup(key);
      if (!hit.found) {
        fail(where, `unknown placeholder {{${key}}}`);
        return `{{${key}}}`;
      }
      if (!paramUse.has(key)) paramUse.set(key, new Set());
      paramUse.get(key).add(where);
      if (hit.value == null) {
        if (mode === 'strict') fail(where, `{{${key}}} is null in ${state.stateCode}`);
        dropped = true;
        return '';
      }
      return formatValue(hit.value);
    });
    return dropped ? null : out;
  };
  const parts = text.split(SENTENCE_BREAK);
  const kept = parts.map(renderSentence).filter(part => part != null);
  const result = kept.join(' ').replace(/\s{2,}/g, ' ').trim();
  return { text: result, rendered, dropped: kept.length < parts.length };
};

// -------------------------------------------------------------- validation
const universalText = (where, text) => {
  if (text == null) return;
  const stripped = text.replace(PLACEHOLDER, '');
  const digits = stripped.match(/\d[\d,.:]*/g) || [];
  for (const literal of digits) {
    const clean = literal.replace(/[,.:]$/, '');
    if (!UNIVERSAL_LITERALS.includes(clean)) {
      fail(where, `literal number "${clean}" in universal text — make it a placeholder or a state note`);
    }
  }
  const token = stripped.match(STATE_TOKENS);
  if (token) fail(where, `state token "${token[0]}" in universal text`);
};
const stateText = (where, text, sourceRules) => {
  if (text == null) return;
  if (hasPlaceholder(text)) {
    fail(where, 'placeholders are not rendered inside state notes or state lessons');
  }
  const digits = (text.match(/\d[\d,.]*/g) || []).map(d => d.replace(/[,.]$/, ''));
  if (digits.length > 0 && (sourceRules ?? []).length === 0) {
    fail(where, `numbers ${digits.join(', ')} without a rule citation (add "rules": [...])`);
  }
  for (const ruleId of sourceRules ?? []) {
    if (!rulesById.has(ruleId)) fail(where, `unknown rule ${ruleId}`);
  }
};
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
  return found;
};

// Every parameter is backed by a catalog rule that states its number.
for (const [key, param] of Object.entries(state.params)) {
  const where = `param ${key}`;
  if (param.value === undefined) fail(where, 'missing "value" (use null for "not codified")');
  if (param.value == null) continue;
  if (param.rule == null) {
    if (param.status !== 'needs_review') {
      fail(where, 'no "rule" citation — cite a catalog rule or mark status needs_review');
    }
    continue;
  }
  const rule = rulesById.get(param.rule);
  if (rule == null) {
    fail(where, `rule ${param.rule} is not in ${state.ruleCatalog}`);
    continue;
  }
  const numbers = ruleNumbers(rule);
  // `equivalent` lets a learner-facing form ("4 feet 9 inches") be checked
  // against the rule's own unit ("57" inches).
  const wanted = (String(param.equivalent ?? param.value).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n =>
    n.replace(/,/g, ''),
  );
  for (const n of wanted) {
    if (!numbers.has(n)) {
      fail(where, `value "${param.value}" — ${n} is not stated by ${param.rule} (${[...numbers].join(', ') || 'no numbers'})`);
    }
  }
}

// ------------------------------------------------------------- assembling
const assetLibrary = new Map();
const libraryAsset = (bareId, where) => {
  if (!assetIndex[bareId]) {
    fail(where, `asset ${bareId} is not in courses/skeleton/assets or the state's assets`);
    return null;
  }
  if (!assetLibrary.has(bareId)) {
    const stateSvg = path.join(STATE_DIR, 'assets', `${bareId}.svg`);
    const file = fs.existsSync(stateSvg)
      ? stateSvg
      : path.join(SKELETON, 'assets', `${bareId}.svg`);
    const svgXml = fs.readFileSync(file, 'utf8');
    const meta = assetIndex[bareId];
    const assetId = `${PREFIX}-${bareId}`;
    assetLibrary.set(bareId, {
      assetId,
      uuid: uuidFor(assetId),
      type: 'svg',
      width: meta.width,
      height: meta.height,
      alt: meta.alt,
      sha256: sha256(svgXml),
      svgXml,
      stateOverride: file === stateSvg,
    });
  }
  return assetLibrary.get(bareId);
};

// Emoji layer: every mention of a concept gets its emoji, with a space after
// it (and before it when it would touch a letter). Bodies, bullets and the
// challenge scenario only — never titles, recall rules or questions.
const withEmoji = card => {
  const bodyMarkdown =
    card.bodyMarkdown == null ? undefined : injectEmojiEverywhere(card.bodyMarkdown);
  const bullets = card.bullets?.map(b => injectEmojiEverywhere(b));
  return {
    ...card,
    ...(bodyMarkdown != null && { bodyMarkdown }),
    ...(bullets != null && { bullets }),
  };
};

const LETTERS = ['A', 'B', 'C'];
const notesByAnchor = new Map();
for (const note of state.notes ?? []) {
  if (!notesByAnchor.has(note.after)) notesByAnchor.set(note.after, []);
  notesByAnchor.get(note.after).push(note);
}
const usedNotes = new Set();
const overrides = state.overrides ?? { cards: {}, questions: {} };
const usedOverrides = new Set();

const report = {
  state: state.stateCode,
  courseId: state.courseId,
  version: VERSION,
  skeletonVersion: course.SKELETON_VERSION,
  blocks: { identical: 0, rendered: 0, note: 0, override: 0, stateLesson: 0, image: 0, challenge: 0, dropped: 0 },
  questions: { identical: 0, rendered: 0, override: 0, stateLesson: 0 },
  lessons: [],
  imagesWithNumbers: [],
};

// Deterministic shuffle for numeric questions, seeded by the question id.
const shuffle = (items, seed) => {
  const out = [...items];
  let h = parseInt(sha256(seed).slice(0, 8), 16);
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const buildQuestion = (spec, questionId, kind, conceptId, origin, where) => {
  let choices;
  let correct;
  let prompt;
  let explanation;
  let rendered = false;
  if (spec.numeric != null) {
    const hit = lookup(spec.numeric.param);
    if (!hit.found || hit.value == null) {
      fail(where, `numeric question needs a non-null {{${spec.numeric.param}}}`);
      return null;
    }
    if (!paramUse.has(spec.numeric.param)) paramUse.set(spec.numeric.param, new Set());
    paramUse.get(spec.numeric.param).add(where);
    const value = Number(hit.value);
    const unit = spec.numeric.unit ? ` ${spec.numeric.unit}` : '';
    const options = [value, ...spec.numeric.offsets.map(o => value + o)];
    if (new Set(options).size !== options.length || options.some(o => o <= 0)) {
      fail(where, `numeric distractors collide or are not positive: ${options.join(', ')}`);
    }
    const ordered = shuffle(options, `${questionId}:${state.stateCode}`);
    choices = ordered.map(o => `${formatValue(o)}${unit}`);
    correct = ordered.indexOf(value);
    prompt = render(spec.prompt, where, 'strict').text;
    explanation = render(spec.explanation, where, 'strict').text;
    rendered = true;
  } else {
    const p = render(spec.prompt, where, 'strict');
    const e = render(spec.explanation, where, 'strict');
    const cs = spec.choices.map(c => render(c, where, 'strict'));
    rendered = p.rendered || e.rendered || cs.some(c => c.rendered);
    prompt = p.text;
    explanation = e.text;
    choices = cs.map(c => c.text);
    correct = spec.correct;
  }
  if (choices.length !== 3) fail(where, `expected 3 choices, got ${choices.length}`);
  if (new Set(choices.map(c => c.toLowerCase())).size !== choices.length) {
    fail(where, `duplicate choices: ${choices.join(' | ')}`);
  }
  if (correct == null || correct < 0 || correct > 2) fail(where, 'correct index out of range');
  const asset = spec.image ? libraryAsset(spec.image, where) : null;
  if (asset && origin === 'skeleton') {
    const baked = assetIndex[spec.image].numbers ?? [];
    universalText(`${where} image ${spec.image} alt`, baked.reduce((alt, n) => alt.replaceAll(n, ''), asset.alt));
    const label = `${spec.image} (${baked.join(', ')})`;
    if (baked.length && !report.imagesWithNumbers.includes(label)) report.imagesWithNumbers.push(label);
  }
  return {
    doc: {
      questionId,
      uuid: uuidFor(questionId),
      kind,
      conceptId,
      scope: origin === 'skeleton' ? 'universal' : 'state_specific',
      prompt,
      choices: choices.map((text, index) => ({
        id: LETTERS[index],
        text,
        feedback: (index === correct ? 'Correct. ' : 'Not quite. ') + explanation,
      })),
      correctAnswerId: LETTERS[correct],
      explanation,
      ...(asset != null && { assetId: asset.assetId }),
    },
    rendered,
    asset,
  };
};

const buildLesson = (spec, module, origin, globalSequence, moduleSequence) => {
  const bare = spec.id;
  const lessonId = `${PREFIX}-${bare}`;
  const where = `lesson ${bare}`;
  const isState = origin === 'state';
  const assets = new Map();
  const questions = [];
  const blocks = [];
  const lessonReport = {
    lessonId,
    origin,
    blocks: [],
    theoryWords: 0,
    warnings: [],
  };
  const noteAsset = asset => asset && assets.set(asset.assetId, asset);

  // Text checks by origin: universal text must be jurisdiction-free; state
  // text must cite rules for its numbers.
  const checkText = (subWhere, text, rules) =>
    isState ? stateText(subWhere, text, rules ?? spec.rules) : universalText(subWhere, text);

  // Opening challenge.
  const theoryQuestionId = `${lessonId}-theory-q01`;
  checkText(`${where} challenge`, [spec.challenge.scenario, spec.challenge.prompt, ...spec.challenge.choices, spec.challenge.explanation].join(' '));
  const theory = buildQuestion(
    spec.challenge,
    theoryQuestionId,
    'opening_challenge',
    `${bare}.theory.01`,
    origin === 'state' ? 'state' : 'skeleton',
    `${where} challenge`,
  );
  if (theory) {
    questions.push(theory.doc);
    noteAsset(theory.asset);
    if (theory.rendered) report.questions.rendered++;
    else if (isState) report.questions.stateLesson++;
    else report.questions.identical++;
  }
  const scenario = render(spec.challenge.scenario, `${where} challenge`, 'strict').text;
  blocks.push({
    blockId: `${lessonId}-challenge`,
    type: 'quick_challenge',
    title: 'What would you do?',
    scenario: injectEmojiEverywhere(scenario),
    questionPreview: render(spec.challenge.prompt, `${where} challenge`, 'strict').text,
    questionId: theoryQuestionId,
  });
  report.blocks.challenge++;

  // Cards, images, recall cards, and the state notes anchored after them.
  let slide = 0;
  let recallN = 0;
  let noteN = 0;
  const pushNotes = anchorBare => {
    for (const note of notesByAnchor.get(anchorBare) ?? []) {
      usedNotes.add(note);
      noteN += 1;
      const blockId = `${lessonId}-note-${pad(noteN)}`;
      const noteWhere = `${where} note after ${anchorBare}`;
      stateText(noteWhere, [note.title, ...note.lines, ...(note.bullets ?? [])].join(' '), note.rules);
      if (note.image) {
        const asset = libraryAsset(note.image, noteWhere);
        if (asset) {
          noteAsset(asset);
          const imageId = `${lessonId}-note-image-${pad(noteN)}`;
          blocks.push({ blockId: imageId, type: 'image', assetId: asset.assetId });
          report.blocks.image++;
          lessonReport.blocks.push({ blockId: imageId, origin: 'image' });
        }
      }
      const card = withEmoji({
        blockId,
        type: 'state_specific',
        title: note.title,
        bodyMarkdown: note.lines.join('\n\n'),
        ...(note.bullets != null && { bullets: note.bullets }),
        conceptId: `${bare}.note.${pad(noteN)}`,
        scope: 'state_specific',
      });
      blocks.push(card);
      report.blocks.note++;
      lessonReport.blocks.push({ blockId, origin: 'note', words: wordCount([card.title, card.bodyMarkdown, ...(card.bullets ?? [])].join(' ')) });
      lessonReport.theoryWords += wordCount([card.bodyMarkdown, ...(card.bullets ?? [])].join(' '));
    }
  };

  for (const item of spec.cards) {
    if (item.kind === 'image') {
      const asset = libraryAsset(item.assetId, `${where} image ${item.assetId}`);
      if (!asset) continue;
      // A picture that carries a number (a "100 FT" dimension arrow) declares
      // it in the asset index; the report lists such pictures per state.
      if (!isState) {
        const baked = assetIndex[item.assetId].numbers ?? [];
        universalText(
          `${where} image ${item.assetId} alt`,
          baked.reduce((alt, n) => alt.replaceAll(n, ''), asset.alt),
        );
        if (baked.length) report.imagesWithNumbers.push(`${item.assetId} (${baked.join(', ')})`);
      }
      noteAsset(asset);
      const blockId = `${lessonId}-image-${pad(slide + 1)}`;
      blocks.push({ blockId, type: 'image', assetId: asset.assetId });
      report.blocks.image++;
      lessonReport.blocks.push({ blockId, origin: asset.stateOverride ? 'override' : 'image' });
      continue;
    }
    if (item.kind === 'recall') {
      recallN += 1;
      const bareBlock = `${bare}-recall-${pad(recallN)}`;
      const blockId = `${PREFIX}-${bareBlock}`;
      const recallWhere = `${where} ${bareBlock}`;
      let source = item;
      let blockOrigin = isState ? 'stateLesson' : 'identical';
      if (overrides.cards?.[bareBlock]) {
        source = overrides.cards[bareBlock];
        usedOverrides.add(bareBlock);
        blockOrigin = 'override';
        stateText(recallWhere, [source.context, source.ruleMarkdown].join(' '), source.rules);
      } else {
        checkText(recallWhere, [item.context, item.ruleMarkdown].join(' '));
      }
      const rendered = render(source.ruleMarkdown, recallWhere);
      if (rendered.text.length === 0) {
        // Every sentence depended on a value this state does not have.
        report.blocks.dropped++;
        lessonReport.blocks.push({ blockId, origin: 'dropped' });
        pushNotes(bareBlock);
        continue;
      }
      if (rendered.dropped) fail(recallWhere, 'a recall rule cannot lose part of its sentences — split it into two recalls');
      if (rendered.rendered && blockOrigin === 'identical') blockOrigin = 'rendered';
      const gaps = rendered.text.match(/\[\[[^\]]+\]\]/g) || [];
      if (gaps.length < 1 || gaps.length > 3) fail(recallWhere, `recall needs 1–3 [[gaps]], has ${gaps.length}`);
      if (EMOJI_PATTERN.test(rendered.text)) fail(recallWhere, 'no emoji in recall rules');
      blocks.push({
        blockId,
        type: 'check_yourself',
        title: 'Can you finish the rule?',
        context: render(source.context, recallWhere, 'strict').text,
        ruleMarkdown: rendered.text,
        conceptId: `${bare}.recall.${pad(recallN)}`,
        scope: blockOrigin === 'identical' || blockOrigin === 'rendered' ? 'universal' : 'state_specific',
      });
      report.blocks[blockOrigin]++;
      lessonReport.blocks.push({ blockId, origin: blockOrigin });
      pushNotes(bareBlock);
      continue;
    }
    // A card.
    slide += 1;
    const bareBlock = `${bare}-slide-${pad(slide)}`;
    const blockId = `${PREFIX}-${bareBlock}`;
    const cardWhere = `${where} ${bareBlock}`;
    let source = item;
    let blockOrigin = isState ? 'stateLesson' : 'identical';
    if (overrides.cards?.[bareBlock]) {
      source = { ...item, ...overrides.cards[bareBlock] };
      usedOverrides.add(bareBlock);
      blockOrigin = 'override';
      stateText(cardWhere, [source.title, ...source.lines, ...(source.bullets ?? [])].join(' '), source.rules);
    } else {
      checkText(cardWhere, [item.title, ...item.lines, ...(item.bullets ?? [])].join(' '));
    }
    const title = render(source.title, cardWhere, 'strict');
    const lines = source.lines
      .map(line => render(line, cardWhere))
      .filter(line => line.text.length > 0);
    const bullets = source.bullets
      ?.map(b => render(b, cardWhere))
      .filter(b => b.text.length > 0)
      .map(b => b.text);
    const rendered = title.rendered || lines.some(l => l.rendered) || (source.bullets ?? []).length !== (bullets ?? []).length;
    if (rendered && blockOrigin === 'identical') blockOrigin = 'rendered';
    const type = source.type;
    const card = withEmoji({
      blockId,
      type,
      title: title.text,
      bodyMarkdown: lines.map(l => l.text).join('\n\n'),
      ...(bullets != null && bullets.length > 0 && { bullets }),
      conceptId: `${bare}.slide.${pad(slide)}`,
      scope: blockOrigin === 'identical' || blockOrigin === 'rendered' ? 'universal' : 'state_specific',
    });
    const words = wordCount([card.title, card.bodyMarkdown, ...(card.bullets ?? [])].join(' '));
    if (words < 42 || words > 135) warn(cardWhere, `${words} words (band 42–135)`);
    for (const s of sentences([card.bodyMarkdown, ...(card.bullets ?? [])].join(' '))) {
      if (wordCount(s) > 38) warn(cardWhere, `sentence of ${wordCount(s)} words`);
    }
    for (const para of card.bodyMarkdown.split('\n\n')) {
      if (sentences(para).length > 2) warn(cardWhere, `message with ${sentences(para).length} sentences`);
    }
    blocks.push(card);
    report.blocks[blockOrigin]++;
    lessonReport.blocks.push({ blockId, origin: blockOrigin, words });
    lessonReport.theoryWords += wordCount([card.bodyMarkdown, ...(card.bullets ?? [])].join(' '));
    pushNotes(bareBlock);
  }
  if (lessonReport.theoryWords < 285 || lessonReport.theoryWords > 560) {
    warn(where, `theory ${lessonReport.theoryWords} words (band 285–560)`);
  }
  if (recallN === 0) warn(where, 'no recall card');

  // Lesson test.
  if (spec.test.length !== 6) fail(where, `lesson test needs 6 questions, has ${spec.test.length}`);
  const testIds = [];
  spec.test.forEach((item, index) => {
    const bareQ = `${bare}-q${pad(index + 1)}`;
    const questionId = `${PREFIX}-${bareQ}`;
    const qWhere = `${where} ${bareQ}`;
    let source = item;
    let qOrigin = isState ? 'state' : 'skeleton';
    if (overrides.questions?.[bareQ]) {
      source = { ...item, ...overrides.questions[bareQ] };
      if (overrides.questions[bareQ].numeric == null) delete source.numeric;
      usedOverrides.add(bareQ);
      qOrigin = 'override';
      stateText(qWhere, [source.prompt, ...(source.choices ?? []), source.explanation].join(' '), source.rules);
    } else if (item.numeric == null) {
      checkText(qWhere, [item.prompt, ...item.choices, item.explanation].join(' '));
    } else {
      checkText(qWhere, [item.prompt, item.explanation].join(' '));
    }
    const built = buildQuestion(source, questionId, 'lesson_test', `${bare}.test.${pad(index + 1)}`, qOrigin === 'skeleton' ? 'skeleton' : 'state', qWhere);
    if (!built) return;
    questions.push(built.doc);
    noteAsset(built.asset);
    testIds.push(questionId);
    if (qOrigin === 'override') report.questions.override++;
    else if (built.rendered) report.questions.rendered++;
    else if (isState) report.questions.stateLesson++;
    else report.questions.identical++;
  });

  const objective = render(spec.objective, where, 'strict').text;
  checkText(`${where} intro`, [spec.title, spec.objective, ...spec.keyPoints].join(' '));
  const lessonDoc = {
    lessonId,
    uuid: uuidFor(lessonId),
    moduleId: `${PREFIX}-${module.id}`,
    globalSequence,
    moduleSequence,
    title: render(spec.title, where, 'strict').text,
    conceptId: bare,
    objective,
    intro: {
      summary: objective,
      keyPoints: spec.keyPoints.map(k => render(k, where, 'strict').text),
      theoryMinutes: Math.max(6, Math.ceil((slide + 1) * 0.9)),
      testMinutes: 4,
    },
    estimatedMinutes: '10-15',
    format: 'intro_conversation_slides_test',
    blocks,
    questionIds: [theoryQuestionId, ...testIds],
    theoryQuestionIds: [theoryQuestionId],
    testQuestionIds: testIds,
    assetIds: [...assets.keys()],
    language: 'en-US',
  };
  report.lessons.push(lessonReport);
  return { lesson: lessonDoc, questions, assets: [...assets.values()] };
};

// -------------------------------------------------------------- the course
const lessonDocs = [];
const modules = [];
let globalSequence = 0;
// SKELETON_MODULES=1,2 limits a --check run to some modules while authoring.
const onlyModules = process.env.SKELETON_MODULES
  ? new Set(process.env.SKELETON_MODULES.split(',').map(Number))
  : null;
for (const [index, moduleSpec] of MODULES.entries()) {
  if (onlyModules && !onlyModules.has(index + 1)) continue;
  const lessons = moduleSpec.state
    ? stateLessons[moduleSpec.id]
    : (await importModule(path.join(SKELETON, 'modules', moduleSpec.file))).LESSONS;
  if (!lessons) {
    fail(`module ${moduleSpec.id}`, moduleSpec.state ? `state package has no lessons for it` : `no LESSONS export`);
    continue;
  }
  const moduleId = `${PREFIX}-${moduleSpec.id}`;
  const docs = lessons.map((spec, i) =>
    buildLesson(spec, moduleSpec, moduleSpec.state ? 'state' : 'skeleton', ++globalSequence, i + 1),
  );
  lessonDocs.push(...docs);
  const testQuestionIds = docs.flatMap(doc =>
    MODULE_TEST_PICKS.map(pick => doc.lesson.testQuestionIds[pick]).filter(Boolean),
  );
  modules.push({
    moduleId,
    uuid: uuidFor(moduleId),
    sequence: index + 1,
    title: render(moduleSpec.title, `module ${moduleSpec.id}`, 'strict').text,
    outcome: render(moduleSpec.outcome, `module ${moduleSpec.id}`, 'strict').text,
    lessons: docs.map(doc => doc.lesson),
    moduleTest: {
      testId: `${moduleId}-test`,
      uuid: uuidFor(`${moduleId}-test`),
      moduleId,
      questionIds: testQuestionIds,
    },
    docs,
  });
}

// Unused state material is almost always a typo in an anchor or id.
for (const note of state.notes ?? []) {
  if (!usedNotes.has(note)) fail(`note after ${note.after}`, 'anchor does not exist in the skeleton');
}
for (const id of [...Object.keys(overrides.cards ?? {}), ...Object.keys(overrides.questions ?? {})]) {
  if (!usedOverrides.has(id)) fail(`override ${id}`, 'no such block or question in the skeleton');
}
for (const key of Object.keys(state.params)) {
  if (!paramUse.has(key)) warn(`param ${key}`, 'declared but never used');
}
// Duplicate ids across the course.
const allIds = [
  ...lessonDocs.map(d => d.lesson.lessonId),
  ...lessonDocs.flatMap(d => d.lesson.blocks.map(b => b.blockId)),
  ...lessonDocs.flatMap(d => d.questions.map(q => q.questionId)),
];
const seen = new Set();
for (const id of allIds) {
  if (seen.has(id)) fail(id, 'duplicate id');
  seen.add(id);
}

// Originality: no 10-word run shared with a competitor lesson.
const learnerText = lessonDocs
  .flatMap(doc => [
    doc.lesson.title,
    doc.lesson.objective,
    ...doc.lesson.intro.keyPoints,
    ...doc.lesson.blocks.flatMap(b => [b.title, b.scenario, b.bodyMarkdown, b.ruleMarkdown, ...(b.bullets ?? [])]),
    ...doc.questions.flatMap(q => [q.prompt, q.explanation, ...q.choices.map(c => c.text)]),
  ])
  .filter(Boolean)
  .join('\n');
const ownShingles = shingles(learnerText, 10);
const competitorOverlaps = {};
for (const brand of ['Zutobi', 'myDMV']) {
  const files = walkFiles(path.join(COMPETITOR_ROOT, brand)).filter(f => /\/lesson-\d+\.md$/.test(f));
  const text = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const theirs = shingles(text, 10);
  const shared = [...ownShingles].filter(s => theirs.has(s));
  competitorOverlaps[brand] = { files: files.length, shared };
  if (files.length === 0) warn(`competitor ${brand}`, 'no corpus found — originality check skipped');
  for (const s of shared) fail(`competitor ${brand}`, `shared 10-word run: "${s}"`);
}

// ------------------------------------------------------------------ report
const summary = {
  ...report,
  params: Object.fromEntries(
    Object.entries(state.params).map(([key, p]) => [key, {
      value: p.value,
      rule: p.rule ?? null,
      // A parameter is only as verified as the rule behind it.
      status: p.status ?? (p.value == null ? 'not_codified' : p.rule && rulesById.get(p.rule)?.status === 'verified' ? 'verified' : 'needs_review'),
      usedIn: [...(paramUse.get(key) ?? [])],
    }]),
  ),
  notes: (state.notes ?? []).length,
  overrides: usedOverrides.size,
  warnings,
  errors,
  competitorOverlaps: Object.fromEntries(Object.entries(competitorOverlaps).map(([k, v]) => [k, { files: v.files, shared: v.shared.length }])),
};
const fmtBlocks = report.blocks;
const md = [
  `# ${state.courseId} ${VERSION} — build report`,
  '',
  `Skeleton ${course.SKELETON_VERSION} · state package ${state.release.sourceVersionLabel} · ${lessonDocs.length} lessons in ${modules.length} modules`,
  '',
  '## Where every block comes from',
  '',
  `| origin | blocks |`,
  `|---|---|`,
  `| identical to the skeleton | ${fmtBlocks.identical} |`,
  `| skeleton rendered with ${state.stateCode} parameters | ${fmtBlocks.rendered} |`,
  `| ${state.stateCode} note (state_specific card after a skeleton card) | ${fmtBlocks.note} |`,
  `| ${state.stateCode} override of a skeleton card | ${fmtBlocks.override} |`,
  `| ${state.stateCode} lesson card (state module) | ${fmtBlocks.stateLesson} |`,
  `| pictures | ${fmtBlocks.image} |`,
  `| opening challenges | ${fmtBlocks.challenge} |`,
  '',
  `Questions: ${report.questions.identical} identical · ${report.questions.rendered} rendered from parameters · ${report.questions.override} overridden · ${report.questions.stateLesson} in state lessons.`,
  '',
  `Parameters: ${Object.keys(state.params).length} (${Object.values(summary.params).filter(p => p.status === 'needs_review').length} needs_review, ${Object.values(summary.params).filter(p => p.value == null).length} null). Notes: ${summary.notes}. Overrides: ${summary.overrides}.`,
  '',
  `Skeleton pictures that carry a number (check they match this state): ${report.imagesWithNumbers.length ? report.imagesWithNumbers.join('; ') : 'none'}.`,
  '',
  '## Lessons',
  '',
  '| # | lesson | origin | theory words | identical | rendered | notes | overrides |',
  '|---|---|---|---|---|---|---|---|',
  ...report.lessons.map((l, i) => {
    const c = origin => l.blocks.filter(b => b.origin === origin).length;
    return `| ${i + 1} | ${l.lessonId} | ${l.origin} | ${l.theoryWords} | ${c('identical')} | ${c('rendered')} | ${c('note')} | ${c('override')} |`;
  }),
  '',
  `## Errors (${errors.length})`,
  '',
  ...(errors.length ? errors.map(e => `- ${e}`) : ['none']),
  '',
  `## Warnings (${warnings.length})`,
  '',
  ...(warnings.length ? warnings.map(w => `- ${w}`) : ['none']),
  '',
].join('\n');
fs.writeFileSync(path.join(STATE_DIR, 'build-report.md'), md);
writeJson(path.join(STATE_DIR, 'build-report.json'), summary);

console.log(
  `${state.courseId} ${VERSION}: ${lessonDocs.length} lessons · blocks identical ${fmtBlocks.identical}, rendered ${fmtBlocks.rendered}, notes ${fmtBlocks.note}, overrides ${fmtBlocks.override}, state-lesson ${fmtBlocks.stateLesson} · questions ${report.questions.identical}/${report.questions.rendered}/${report.questions.override}/${report.questions.stateLesson} · ${errors.length} errors, ${warnings.length} warnings`,
);
if (errors.length) {
  for (const e of errors.slice(0, 60)) console.log('  ✗ ' + e);
  if (errors.length > 60) console.log(`  … ${errors.length - 60} more in build-report.md`);
  process.exit(1);
}
if (CHECK_ONLY) process.exit(0);

// ------------------------------------------------------------------ output
fs.rmSync(OUTPUT, { recursive: true, force: true });
const deliveryVersion = VERSION;
const lessonFiles = [];
for (const doc of lessonDocs) {
  const file = path.join(OUTPUT, 'lessons', `${doc.lesson.lessonId}.json`);
  writeJson(file, { schemaVersion: 2, deliveryVersion, lesson: doc.lesson, questions: doc.questions, assets: doc.assets });
  lessonFiles.push(file);
}
const moduleFiles = [];
for (const module of modules) {
  const { docs, ...moduleDoc } = module;
  const assets = [...new Map(docs.flatMap(d => d.assets).map(a => [a.assetId, a])).values()];
  const file = path.join(OUTPUT, 'modules', `${module.moduleId}.json`);
  writeJson(file, { schemaVersion: 2, deliveryVersion, module: moduleDoc, questions: docs.flatMap(d => d.questions), assets });
  moduleFiles.push(file);
}
const sourceContentHash = sha256(
  lessonDocs.map(doc => json({ lesson: doc.lesson, questions: doc.questions })).join(''),
);
const courseDoc = {
  schemaVersion: 2,
  deliveryVersion,
  course: {
    courseId: state.courseId,
    title: state.course.title,
    subtitle: state.course.subtitle,
    jurisdiction: state.stateCode,
    state: state.vars.state,
    language: 'en-US',
    targetLicense: state.course.targetLicense,
    moduleIds: modules.map(m => m.moduleId),
    sourceVersionLabel: state.release.sourceVersionLabel,
    skeletonVersion: course.SKELETON_VERSION,
    sourceContentHash,
    sourceCheckedAt: state.release.releasedAt,
    sourceReviewStatus: 'draft_generated_human_review_required',
    publicationAuthorized: false,
  },
};
const courseFile = path.join(OUTPUT, 'course.json');
writeJson(courseFile, courseDoc);

const docRef = file => {
  const data = fs.readFileSync(file);
  return { sha256: sha256(data), sizeBytes: data.byteLength };
};
const lessonModule = new Map(modules.flatMap(m => m.docs.map(d => [d.lesson.lessonId, m.moduleId])));
const manifestPath = path.join(ROOT, 'server/content', state.courseId, 'manifest.json');
const manifest = fs.existsSync(manifestPath)
  ? readJson(manifestPath)
  : { schemaVersion: 2, courseId: state.courseId, latestVersion: VERSION, seedVersion: VERSION, versions: [] };
const entry = {
  version: VERSION,
  releasedAt: state.release.releasedAt,
  status: 'release_candidate',
  minAppVersion: state.release.minAppVersion,
  notes: state.release.notes,
  sourceVersionLabel: state.release.sourceVersionLabel,
  sourceReviewStatus: 'draft_generated_human_review_required',
  publicationAuthorized: false,
  instructions: [{ op: 'full', severity: 'soft', message: state.release.updateMessage }],
  documents: {
    modules: Object.fromEntries(moduleFiles.map(f => [path.basename(f, '.json'), docRef(f)])),
    lessons: Object.fromEntries(lessonFiles.map(f => [path.basename(f, '.json'), { moduleId: lessonModule.get(path.basename(f, '.json')), ...docRef(f) }])),
    course: docRef(courseFile),
  },
};
manifest.latestVersion = VERSION;
manifest.seedVersion = VERSION;
manifest.versions = manifest.versions.filter(v => v.version !== VERSION).concat(entry);
writeJson(manifestPath, manifest);
writeJson(path.join(STATE_DIR, 'release.json'), {
  courseId: state.courseId,
  version: VERSION,
  ...state.release,
});
console.log(`wrote ${path.relative(ROOT, OUTPUT)} (${lessonFiles.length} lessons, ${moduleFiles.length} modules) and manifest`);
