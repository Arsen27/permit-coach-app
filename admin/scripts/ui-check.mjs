// Drives the whole panel in a real DOM against a live content server: loads the
// workspace, waits for the version list, clicks into a lesson and asserts the
// viewer painted it. Catches wiring mistakes a type-check cannot.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const PORT = process.env.ADMIN_TEST_PORT ?? '8795';
const bundle = readFileSync(
  new URL('../.smoke/app.js', import.meta.url),
  'utf8',
);

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: `http://localhost:${PORT}/admin/`,
});

// jsdom has no fetch; forward the panel's calls to the real server. A
// multipart upload arrives as a jsdom FormData holding a jsdom File, neither
// of which Node's fetch understands, so the body is rebuilt with the native
// ones — the panel keeps doing what a browser does.
const nativeBody = async init => {
  const body = init?.body;
  if (body == null || typeof body.getAll !== 'function') {
    return init;
  }
  const form = new FormData();
  for (const [name, value] of body.entries()) {
    if (value != null && typeof value.arrayBuffer === 'function') {
      form.set(
        name,
        new File([await value.arrayBuffer()], value.name, {
          type: value.type,
        }),
      );
    } else {
      form.set(name, value);
    }
  }
  return { ...init, body: form };
};

dom.window.fetch = async (input, init) =>
  fetch(
    new URL(String(input), `http://localhost:${PORT}`),
    await nativeBody(init),
  );
dom.window.localStorage.clear();

const settle = (ms = 400) =>
  new Promise(resolve => dom.window.setTimeout(resolve, ms));

const text = () => dom.window.document.body.textContent ?? '';
// Deepest node carrying the text — clicking an ancestor would not reach the
// row's handler, the same as it would not for a real user.
const find = (selector, match) =>
  [...dom.window.document.querySelectorAll(selector)]
    .filter(node => (node.textContent ?? '').trim() === match)
    .pop();

// Surface React crashes instead of silently rendering an empty page.
dom.window.addEventListener('error', event => {
  console.error('page error:', event.error?.stack ?? event.message);
});
const originalError = dom.window.console.error;
dom.window.console.error = (...args) => {
  const first = String(args[0] ?? '');
  if (!first.startsWith('Warning:')) {
    console.error('console.error:', ...args.map(a => String(a).slice(0, 400)));
  }
  originalError.apply(dom.window.console, args);
};

dom.window.eval(bundle);
await settle(900);

const checks = [];
// A throw anywhere below would otherwise take every earlier result with it.
let summarised = false;
process.on('exit', () => {
  if (!summarised) {
    summarise();
  }
});
const setInput = (node, value) => {
  if (node == null) return;
  const proto =
    node.tagName === 'TEXTAREA'
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
  node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};

const check = (name, ok, detail) => {
  checks.push([name, Boolean(ok), ok ? undefined : detail]);
};

check(
  'workspace loaded (no error banner)',
  !text().includes('Failed to fetch'),
);
check('brand rendered', text().includes('PermitCoach'));
check('state picker shows the course state', /STATE\s*CA/.test(text()));
check('released version listed', text().includes('v1.0.0'));
check(
  'single release — competitors are the other columns',
  !text().includes('v2.0.0'),
);
check('version status chip', text().includes('Released'));
// Module titles render in their authored casing — this column is where the
// casing gets typed, so it must be visible here.
check('module titles in the lessons column', text().includes('Read the Road'));
check('module test row', text().includes('Module test'));
check('lesson meta shows card counts', /13 cards/.test(text()));
check('viewer shows the first lesson card', text().includes('Quick challenge'));
check(
  'viewer renders artwork',
  // A picture is a file the content server holds, so the card shows an image
  // pointing at it rather than markup pasted into the page.
  [...dom.window.document.querySelectorAll('img')].some(node =>
    (node.getAttribute('src') ?? '').startsWith('/v1/assets/'),
  ),
);
check('checkpoint card rendered', text().includes('Checkpoint'));
check('read-only chrome for a release', text().includes('Read-only'));

// Click a different lesson and confirm the viewer follows.
const button = label =>
  [...dom.window.document.querySelectorAll('button')].find(node =>
    (node.textContent ?? '').includes(label),
  );

const click = async (node, wait = 600) => {
  if (node == null) return false;
  node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await settle(wait);
  return true;
};

// Opens the top-bar state picker and chooses a course by its id.
const clickStateOption = async courseId => {
  await click(button('STATE'), 300);
  await click(find('span, div', courseId), 1600);
};

const SECOND_LESSON = 'Signs That Control What You Do';
const target = find('span, div', SECOND_LESSON);
check('a second lesson is listed', target != null);
if (target != null) {
  target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await settle(700);
}
// The viewer's own heading repeats the title, so it now appears twice.
check(
  'clicking a lesson swaps the viewer',
  text().split(SECOND_LESSON).length - 1 >= 2,
);

// --- state switch keeps the place ------------------------------------------
// The operator is on module 1, lesson 02. Switching state swaps the whole
// course tree; the place must survive by position, not by lesson id.
const txOutline = await fetch(
  `http://localhost:${PORT}/v1/admin/courses/tx-class-c/released/1.0.0/outline`,
).then(response => response.json());
const txSecondLesson = txOutline.modules[0].lessons[1].title;

await clickStateOption('tx-class-c');
check('state pill switches to TX', /STATE\s*TX/.test(text()));
check(
  'the same lesson number is selected in the TX course',
  text().split(txSecondLesson).length - 1 >= 2,
);

await clickStateOption('ca-class-c');
check('state pill returns to CA', /STATE\s*CA/.test(text()));
check(
  'switching back restores the CA lesson',
  text().split(SECOND_LESSON).length - 1 >= 2,
);

await click(button('⇆ Compare'), 900);
check('compare mode announces both panes', text().includes('selected'));
// With a single release the only other columns are the competitor courses.
check(
  'with one release the reference falls back to a competitor',
  text().includes('Zutobi'),
);
check(
  'the reference pane owns a lesson picker',
  text().includes('Right of Way I') || text().includes('Choose lesson…'),
);
check('sync control offered', text().includes('⟺ Sync'));
check('find similar offered', text().includes('Find similar'));
check('format mismatch disables the diff', text().includes('Formats differ'));

// Adjacent chips concatenate in textContent, so each is read on its own.
// (The word-level diff itself is exercised later, draft against its base —
// artwork detection is covered by the model unit tests.)
const chipText = match =>
  [...dom.window.document.querySelectorAll('span')]
    .map(node => (node.textContent ?? '').trim())
    .find(value => match.test(value)) ?? '';

// --- phone simulator ------------------------------------------------------
await click(button('Phone'), 900);
const devices = () =>
  dom.window.document.querySelectorAll('[data-device="ios"]');
check('phone mode renders a device frame', devices().length >= 1);
check('phone shows the lesson header progress', text().includes('/ 13'));
check(
  'phone runs the app renderer (kicker from CARD_META)',
  text().includes('Quick challenge'),
);
// The opening card carries the quick challenge, so the button asks for an
// answer before it will advance — the same gate the app applies.
check('phone gates the opening challenge', text().includes('Check answer'));
check('size control offered', text().includes('SIZE'));

// Wheel ownership: the page scrolls until a phone is clicked; clicking
// outside any phone hands scrolling back to the page.
const sim = () => dom.window.document.querySelector('[data-sim-index="0"]');
check(
  'phones start with the page owning the wheel',
  sim()?.dataset.simFocused === 'false',
);
sim()?.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
await settle(250);
check(
  'clicking a phone focuses its scroller',
  sim()?.dataset.simFocused === 'true',
);
check(
  'the focused phone is ringed',
  dom.window.document.querySelector('[data-device]') != null,
);

// Arrow keys page the focused phone…
const pressKey = async key => {
  dom.window.document.body.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle(300);
};
await pressKey('ArrowRight');
check('ArrowRight pages the focused phone forward', /2 \/ 13/.test(text()));
await pressKey('ArrowLeft');
check(
  'ArrowLeft pages it back',
  /1 \/ 13/.test(text()) && !/2 \/ 13/.test(text()),
);

dom.window.document.body.dispatchEvent(
  new dom.window.MouseEvent('mousedown', { bubbles: true }),
);
await settle(250);
check(
  'clicking outside returns the wheel to the page',
  sim()?.dataset.simFocused === 'false',
);
// …and without focus the keyboard stays with the page.
await pressKey('ArrowRight');
check('arrows do nothing while no phone is focused', /1 \/ 13/.test(text()));
check('two phones while comparing', devices().length === 2);
check('synced pager drives both phones', /Card\s*\d+\s*of\s*\d+/.test(text()));

// The simulated screen is the app's own: its diagram, scenario, question and
// options all come from the shared renderer.
const deviceText = () => devices()[0]?.textContent ?? '';
check(
  'phone renders the card scenario',
  deviceText().includes('A ramp splits ahead'),
);
check(
  'phone renders the question and its options',
  deviceText().includes('What is the correct response?') &&
    deviceText().includes('Take the open branch'),
);
check(
  'phone renders the card artwork',
  devices()[0]?.querySelector('svg') != null,
);
check(
  'phone gates advancing until an answer is picked',
  deviceText().includes('Pick one answer to continue'),
);

// Stepping is driven by the panel's own pager, so it is exercised here;
// the in-card gesture handling belongs to react-native-web and is verified in
// the app's own test suite.
const beforeStep = deviceText();
await click(button('›'), 500);
check('the pager advances the simulated card', deviceText() !== beforeStep);
check('the pager reports the new position', /2 \/ 13/.test(text()));

await click(button('Text'), 700);

// --- draft lifecycle and editing -----------------------------------------
await click(button('Duplicate as draft'), 700);
check(
  'duplicate opens the version dialog',
  text().includes('Duplicate v1.0.0 as draft'),
);
check(
  'the dialog suggests the next free number',
  /Suggested next free number: 1\.1\.0/.test(text()),
);

const input = dom.window.document.querySelector(
  'input[type="text"], input:not([type])',
);
if (input != null) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value',
  ).set;
  setter.call(input, '1.0.1');
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settle(150);
}
await click(button('Create draft'), 1200);
check('a draft is created and selected', text().includes('v1.0.1'));
check('draft is labelled as a draft', text().includes('Draft'));
check('drafts offer structural editing', text().includes('+ Add module'));

await click(button('Edit lesson'), 800);
check('editing opens the card editor', text().includes('editing draft'));
check('the footer counts changed fields', /0 fields changed/.test(text()));

const titleInput = [...dom.window.document.querySelectorAll('input')].find(
  node => node.value === 'What would you do?',
);
check('card titles are editable', titleInput != null);
if (titleInput != null) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value',
  ).set;
  setter.call(titleInput, 'What would you do here?');
  titleInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settle(300);
}
check('an edit is counted', /1 field changed/.test(text()));

// --- illustrations in the editor -------------------------------------------
const altInput = [...dom.window.document.querySelectorAll('input')].find(
  node => node.placeholder === 'Describe the illustration',
);
check('image descriptions are editable', altInput != null);
if (altInput != null) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value',
  ).set;
  setter.call(altInput, 'A redrawn diagram of sign shapes');
  altInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settle(250);
}
check('an alt edit is counted', /2 fields changed/.test(text()));

check(
  'replace is offered on every illustration',
  [...dom.window.document.querySelectorAll('button')].filter(
    node => (node.textContent ?? '').trim() === 'Replace',
  ).length >= 3,
);
check('a picture can be dropped anywhere in a body', button('+ Image') != null);

const fileInput = dom.window.document.querySelector('input[type="file"]');
check('a hidden file input backs the image actions', fileInput != null);
const SVG_UPLOAD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#e5e7eb"/><circle cx="600" cy="337" r="140" fill="#059669"/></svg>';
const plantFile = async name => {
  const file = new dom.window.File([SVG_UPLOAD], name, {
    type: 'image/svg+xml',
  });
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: { 0: file, length: 1, item: index => (index === 0 ? file : null) },
  });
  fileInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await settle(500);
};

// The uploaded file is named by its own hash, so the card can be checked for
// exactly the picture that was planted.
const UPLOAD_SHA = createHash('sha256').update(SVG_UPLOAD).digest('hex');
const uploadedArtworkDrawn = () =>
  [...dom.window.document.querySelectorAll('img')].some(node =>
    (node.getAttribute('src') ?? '').includes(UPLOAD_SHA),
  );

await click(button('+ Image'), 200);
await plantFile('roundabout-diagram.svg');
check(
  'an uploaded illustration lands in the lesson',
  text().includes('Illustration added'),
  text().slice(-400),
);
check('the new artwork is drawn in the card', uploadedArtworkDrawn());

// --- full control of a slide ----------------------------------------------
// PC-6: the order, the kind, the type and the body of a slide are all the
// operator's. Everything here works on the *last* slide, so the checks above
// and the diff checks below keep the content they were written against.
const slideTitles = () =>
  [...dom.window.document.querySelectorAll('input')]
    .filter(node => node.placeholder === 'Slide title')
    .map(node => node.value);

// Slide-level controls carry their own titles; the body element rails use the
// same glyphs, so selecting on text alone would reach the wrong button.
const slideButtons = title =>
  [...dom.window.document.querySelectorAll('button')].filter(
    node => node.title === title,
  );
const lastSlideButton = title => slideButtons(title).pop();

const titlesBefore = slideTitles();
check('slides are listed as editable cards', titlesBefore.length >= 3);

await click(lastSlideButton('Move this slide up'), 400);
const titlesMoved = slideTitles();
const last = titlesBefore.length - 1;
check(
  'a slide can be moved and takes its place in the deck',
  titlesMoved[last] === titlesBefore[last - 1] &&
    titlesMoved[last - 1] === titlesBefore[last],
);
// The moved slide now sits second from the end, so that is whose ↓ reverses it.
await click(slideButtons('Move this slide down').at(-2), 400);
check('the move is reversible', slideTitles()[last] === titlesBefore[last]);

// The body is a list of lines. One row is one line, added from a single bar
// under the list rather than from controls between every pair of lines.
const paragraphs = () =>
  [...dom.window.document.querySelectorAll('textarea')].filter(
    node => node.placeholder === 'Write a line…',
  );
const bullets = () =>
  [...dom.window.document.querySelectorAll('textarea')].filter(
    node => node.placeholder === 'Bullet',
  );
check('body lines are edited one by one', paragraphs().length >= 1);
const lastInsert = label =>
  [...dom.window.document.querySelectorAll('button')]
    .filter(node => (node.textContent ?? '').trim() === label)
    .pop();

// The add controls appear once per body, not once per line.
const lastSlide = () =>
  [...dom.window.document.querySelectorAll('input')]
    .filter(node => node.placeholder === 'Slide title')
    .pop()
    ?.closest('div[class]')?.parentElement;
check(
  'adding is offered in one place, not under every line',
  [...dom.window.document.querySelectorAll('button')].filter(
    node => (node.textContent ?? '').trim() === '+ Text',
  ).length <= slideTitles().length,
);

const paragraphsBefore = paragraphs().length;
await click(lastInsert('+ Text'), 300);
check('a line can be added', paragraphs().length === paragraphsBefore + 1);
await click(lastInsert('+ Bullets'), 300);
check('a bullet line can be added', bullets().length >= 1);

// A line is one row tall until its own text needs more, so the field is a
// single-row textarea sized by CSS rather than by a row count.
check(
  'a line starts one row tall',
  paragraphs().every(node => node.rows === 1),
);

// --- dragging a line ------------------------------------------------------
// Notion-style: a handle on the left, a drop indicator, and the row lands
// wherever it was let go. A drag stays inside one body — the editor never
// moves a line from one slide into another.
const lastBody = () =>
  [...dom.window.document.querySelectorAll('[data-body]')].pop();
const bodyRowsOf = body => [...body.querySelectorAll('[data-row]')];
const fieldOf = row =>
  row.querySelector(
    'textarea[placeholder="Write a line…"], textarea[placeholder="Bullet"]',
  );
const bodyTexts = () =>
  bodyRowsOf(lastBody())
    .map(row => fieldOf(row)?.value)
    .filter(value => value != null);

const handles = () =>
  [...dom.window.document.querySelectorAll('button')].filter(
    node => node.title === 'Drag to move this line',
  );
check('every line carries a drag handle', handles().length >= 2);
check(
  'the body and its rows are addressable',
  bodyRowsOf(lastBody()).length >= 3,
);

const setField = (node, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  setter.call(node, value);
  node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};

// Give the last body's last two lines telling text so a move is observable.
const lineRowsOfBody = () =>
  bodyRowsOf(lastBody()).filter(row => fieldOf(row) != null);
setField(fieldOf(lineRowsOfBody().at(-2)), 'DRAG-ME');
await settle(200);
setField(fieldOf(lineRowsOfBody().at(-1)), 'AFTER-ME');
await settle(200);
check(
  'the two marker lines are in place',
  bodyTexts().at(-2) === 'DRAG-ME' && bodyTexts().at(-1) === 'AFTER-ME',
);

const dragRow = async (source, target, atBottom) => {
  const handle = [...source.querySelectorAll('button')].find(
    node => node.title === 'Drag to move this line',
  );
  handle.dispatchEvent(
    new dom.window.MouseEvent('mousedown', { bubbles: true }),
  );
  await settle(120);
  const data = new Map();
  const transfer = {
    effectAllowed: '',
    setData: (key, value) => data.set(key, value),
    getData: key => data.get(key) ?? '',
  };
  const fire = (node, type, extra = {}) => {
    const event = new dom.window.Event(type, {
      bubbles: true,
      cancelable: true,
    });
    event.dataTransfer = transfer;
    Object.assign(event, extra);
    node.dispatchEvent(event);
  };
  fire(source, 'dragstart');
  await settle(120);
  // jsdom gives every element a zero-size box, so the editor's "nearer edge"
  // maths would always read the same way. Giving the target a real box is what
  // makes dropping above and dropping below distinguishable at all.
  target.getBoundingClientRect = () => ({
    top: 100,
    bottom: 120,
    height: 20,
    left: 0,
    right: 200,
    width: 200,
    x: 0,
    y: 100,
  });
  const clientY = atBottom ? 118 : 102;
  fire(target, 'dragover', { clientY });
  await settle(80);
  fire(target, 'drop', { clientY });
  await settle(250);
  delete target.getBoundingClientRect;
};

const beforeDrag = bodyTexts();
const rowsNow = lineRowsOfBody();
await dragRow(rowsNow.at(-2), rowsNow[0], false);
check(
  'a line dropped above the first one lands there',
  bodyTexts()[0] === 'DRAG-ME',
);
check(
  'dragging moves a line rather than copying it',
  bodyTexts().length === beforeDrag.length,
);
check(
  'nothing else about the body changed',
  [...bodyTexts()].sort().join('|') === [...beforeDrag].sort().join('|'),
);

// And dropping on the lower half of a row lands after it.
const rowsAgain = lineRowsOfBody();
await dragRow(rowsAgain[0], rowsAgain[1], true);
check(
  'a line dropped below another lands after it',
  bodyTexts()[1] === 'DRAG-ME',
);

// --- removing a line ------------------------------------------------------
const removeInBody = () =>
  [...lastBody().querySelectorAll('button')].filter(
    node => node.title === 'Remove this line',
  );
check('every line carries its own remove control', removeInBody().length >= 2);
const countBeforeRemove = bodyTexts().length;
await click(removeInBody()[1], 300);
check('the ✕ removes that line', bodyTexts().length === countBeforeRemove - 1);
check('and it is the line that was asked for', bodyTexts()[1] !== 'DRAG-ME');

// Right-clicking a line offers the same, plus inserting around it.
const contextMenu = async row => {
  row.dispatchEvent(
    new dom.window.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 40,
    }),
  );
  await settle(200);
};
await contextMenu(lineRowsOfBody()[0]);
check('right-clicking a line opens its menu', text().includes('Delete line'));
check('the menu can insert around the line', text().includes('Insert below'));
const countBeforeMenuInsert = bodyTexts().length;
const menuItem = label =>
  [...dom.window.document.querySelectorAll('button')].find(
    node => (node.textContent ?? '').trim() === label,
  );
await click(menuItem('Bullet'), 300);
check(
  'inserting from the menu adds a line',
  bodyTexts().length === countBeforeMenuInsert + 1,
);
check('the menu closes after acting', !text().includes('Delete line'));

await contextMenu(lineRowsOfBody()[0]);
const countBeforeMenuDelete = bodyTexts().length;
await click(menuItem('Delete line'), 300);
check(
  'deleting from the menu removes the line',
  bodyTexts().length === countBeforeMenuDelete - 1,
);

// A second illustration, dropped into the same body as the first.
const artworkCount = () =>
  [...dom.window.document.querySelectorAll('img')].filter(node =>
    (node.getAttribute('src') ?? '').startsWith('/v1/assets/'),
  ).length;
const artworkBefore = artworkCount();
await click(lastInsert('+ Image'), 200);
await plantFile('second-diagram.svg');
check(
  'more than one picture can sit in one slide',
  artworkCount() === artworkBefore + 1,
);

// Slide kind: text / quiz / check yourself.
const selectValue = (node, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLSelectElement.prototype,
    'value',
  ).set;
  setter.call(node, value);
  node.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
};
const lastKindSelect = () =>
  [...dom.window.document.querySelectorAll('select')]
    .filter(node => [...node.options].some(option => option.value === 'recall'))
    .pop();
check('every slide offers its kind', lastKindSelect() != null);

const countOf = needle => text().split(needle).length - 1;
const recallLabels = () =>
  [...dom.window.document.querySelectorAll('input')].filter(
    node => node.placeholder === 'e.g. Recall · Yellow lines',
  ).length;
const recallBefore = recallLabels();
selectValue(lastKindSelect(), 'recall');
await settle(400);
check(
  'a slide can be turned into a check-yourself card',
  recallLabels() === recallBefore + 1,
);

const questionFields = () =>
  [...dom.window.document.querySelectorAll('textarea')].filter(
    node => node.placeholder === 'What the learner is asked',
  ).length;
const questionsBefore = questionFields();
selectValue(lastKindSelect(), 'quiz');
await settle(400);
check(
  'and into a quiz, which brings its own question',
  questionFields() === questionsBefore + 1,
);

selectValue(lastKindSelect(), 'text');
await settle(400);
check('and back to plain teaching copy', paragraphs().length >= 1);

// The slide type — the kicker, its icon and its colours.
const lastTypeSelect = () =>
  [...dom.window.document.querySelectorAll('select')]
    .filter(node =>
      [...node.options].some(option => option.value === 'exam_trap'),
    )
    .pop();
check('every slide offers its type', lastTypeSelect() != null);
const trapsBefore = countOf('Exam trap');
selectValue(lastTypeSelect(), 'exam_trap');
await settle(400);
check(
  'changing the type changes the kicker',
  countOf('Exam trap') === trapsBefore + 1,
);

// A follow-up checkpoint, added and taken away again.
const checkpointCount = () => countOf('FOLLOW-UP CHECKPOINT');
const checkpointsBefore = checkpointCount();
await click(lastInsert('+ Add checkpoint question'), 400);
check(
  'a text slide can ask a question of its own',
  checkpointCount() === checkpointsBefore + 1,
);
await click(lastInsert('Remove checkpoint'), 400);
check('and give it up again', checkpointCount() === checkpointsBefore);

// --- the lesson screen -------------------------------------------------------
// The overview a learner reads before the first slide is authored here too:
// summary, key points, minutes, and a pinned hero — the derived hero moved
// whenever artwork landed in an early slide.
check(
  'the lesson screen is editable above the slides',
  text().includes('LESSON SCREEN') && text().includes('OPENING ILLUSTRATION'),
);
const summaryArea = () =>
  [...dom.window.document.querySelectorAll('textarea')].find(
    node => node.placeholder === 'One paragraph on what this lesson teaches',
  );
check('the summary is a field', summaryArea() != null);
const summaryBefore = summaryArea().value;
setInput(summaryArea(), `${summaryBefore} (edited)`);
await settle(150);
check(
  'editing the summary counts as a change',
  /field(s)? changed/.test(text()),
);
check(
  'an unpinned hero says it follows the slides',
  text().includes('Follows the first picture a slide shows'),
);
// An abandoned "+ Add point" leaves an empty line; the save must drop it
// rather than park a document the release validator will refuse later.
const addPoint = () =>
  [...dom.window.document.querySelectorAll('button')].find(
    node => node.textContent?.trim() === '+ Add point',
  );
await click(addPoint(), 200);
const pointInputs = () =>
  [...dom.window.document.querySelectorAll('input')].filter(
    node => node.placeholder === 'One thing the learner walks away with',
  );
check('an added point starts empty', pointInputs().some(n => n.value === ''));

// Put it back: the sections below assert exact field counts and diffs.
setInput(summaryArea(), summaryBefore);
await settle(150);
const emptyPoint = pointInputs().find(n => n.value === '');
const removeEmpty =
  emptyPoint?.parentElement?.querySelector('button[title="Remove this point"]');
await click(removeEmpty, 200);

// --- the question pool -----------------------------------------------------
// Questions are the course's own entity: slides reference them by id, so a
// slide must be able to ask a different one, and a question must be editable
// without hunting for the slide that asks it.
const promptValues = () =>
  [...dom.window.document.querySelectorAll('textarea')]
    .filter(node => node.placeholder === 'What the learner is asked')
    .map(node => node.value);

const changeButtons = () =>
  [...dom.window.document.querySelectorAll('button')].filter(
    node => node.textContent?.trim() === 'Change question\u2026',
  );
check('a slide that asks a question offers to change it', changeButtons().length > 0);

const askedBefore = promptValues()[0];
await click(changeButtons()[0], 800);
check('the pool opens', text().includes('Ask a different question'));
check(
  'and groups the pool by what asks it',
  text().includes('This lesson') || text().includes('Elsewhere in the course'),
);

// Every row in the picker is a question; the first one that is not the one
// already asked here is the swap.
const poolRows = () =>
  [...dom.window.document.querySelectorAll('div[title]')].filter(
    node => node.getAttribute('title') === 'Ask this one instead',
  );
check('the pool lists questions to swap in', poolRows().length > 0);
await click(poolRows()[0], 600);
check(
  'picking one re-points the slide at it',
  promptValues()[0] !== askedBefore,
  `${askedBefore?.slice(0, 40)} -> ${promptValues()[0]?.slice(0, 40)}`,
);

// The same pool, listed in the sidebar — the map from a lesson to what it
// asks. Bodies live on the Questions screen.
const poolHead = () =>
  [...dom.window.document.querySelectorAll('span')].find(
    node => node.textContent?.trim() === 'Question pool',
  );
check('the sidebar lists the course question pool', poolHead() != null);
await click(poolHead()?.parentElement, 700);
const poolSidebarRows = () => [
  ...dom.window.document.querySelectorAll('div[data-question-id]'),
];
check('the pool opens with its questions', poolSidebarRows().length > 0);
check(
  'each row says which lesson asks it',
  (poolSidebarRows()[0].getAttribute('title') ?? '').includes(
    'Questions screen',
  ),
);

// New slides can be inserted after any existing one, and deleted.
const slideCount = slideTitles().length;
await click(lastInsert('+ Text slide'), 400);
check('a new slide can be inserted', slideTitles().length === slideCount + 1);
await click(lastSlideButton('Delete this slide'), 400);
check('and deleted again', slideTitles().length === slideCount);

// --- slide types -----------------------------------------------------------
await click(button('Slide types\u2026'), 600);
check('the slide-type manager opens', text().includes('Built-in types'));
check(
  'every built-in family is listed for editing',
  text().includes('Exam trap') && text().includes('Core rule'),
);
check(
  'text and icon colours are both editable',
  dom.window.document.querySelectorAll('input[type="color"]').length >= 2,
);
await click(button('+ Add slide type'), 400);
const typeLabel = [...dom.window.document.querySelectorAll('input')].find(
  node => node.value === 'New slide type',
);
check('a course can add a type of its own', typeLabel != null);
if (typeLabel != null) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value',
  ).set;
  setter.call(typeLabel, 'Road hazard');
  typeLabel.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settle(250);
}
check('the type preview follows its label', text().includes('Road hazard'));

// --- a glyph the course ships itself ---------------------------------------
// The point of this: a new icon must not need an app release.
check(
  'the icon budget is shown while it is being spent',
  /Icons 0\.0 KB of \d+ KB/.test(text()),
);
check(
  'uploading a glyph is offered',
  [...dom.window.document.querySelectorAll('button')].some(
    node => (node.textContent ?? '').trim() === 'Upload…',
  ),
);
const iconFile = [...dom.window.document.querySelectorAll('input[type="file"]')]
  .filter(node => node.closest('div') != null)
  .pop();
const GLYPH_UPLOAD = `<?xml version="1.0"?><!-- drawn somewhere -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" inkscape:version="1.1">
    <title>Hazard</title>
    <path   d="M2 2h12v12H2z"   fill="#B45309"/>
  </svg>`;
const plantIcon = async () => {
  const file = new dom.window.File([GLYPH_UPLOAD], 'hazard.svg', {
    type: 'image/svg+xml',
  });
  Object.defineProperty(iconFile, 'files', {
    configurable: true,
    value: { 0: file, length: 1, item: index => (index === 0 ? file : null) },
  });
  iconFile.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await settle(400);
};
// The course's own types are listed first, so the first Upload… is the one
// belonging to the type just added.
await click(
  [...dom.window.document.querySelectorAll('button')].find(
    node => (node.textContent ?? '').trim() === 'Upload…',
  ),
  200,
);
await plantIcon();
check(
  'the uploaded glyph replaces the built-in picker with its size',
  /\d+ B/.test(text()) && text().includes('Replace…'),
);
check('the budget moves when a glyph is added', !/Icons 0\.0 KB/.test(text()));
check(
  'the glyph was minified on the way in',
  !dom.window.document.body.innerHTML.includes('inkscape:version') &&
    !dom.window.document.body.innerHTML.includes('<title>Hazard'),
);
// The glyph as the page is actually showing it, so a tint check cannot be
// satisfied by some other element's colour.
const glyphMarkup = () =>
  [...dom.window.document.querySelectorAll('span')]
    .map(node => node.innerHTML)
    .filter(html => html.includes('M2 2h12v12H2z'))
    .join('');
check(
  'and recoloured to follow its type, which is what a first upload does',
  glyphMarkup().includes('currentColor'),
);

// Whether a glyph keeps its own colours is the slide type's own answer: the
// control sits on that type's row alone, and flipping it needs no re-upload.
const glyphPickers = () =>
  [...dom.window.document.querySelectorAll('select')].filter(node =>
    [...node.options].some(option => option.value === 'own'),
  );
check(
  'the tint choice is offered on the type holding the glyph, and only there',
  glyphPickers().length === 1,
);
selectValue(glyphPickers()[0], 'own');
await settle(300);
check(
  'that type alone can keep the colours its glyph was drawn with',
  glyphMarkup().includes('#B45309'),
);
selectValue(glyphPickers()[0], 'tint');
await settle(300);
check(
  'and can follow its type again without re-uploading the glyph',
  !glyphMarkup().includes('#B45309') && glyphMarkup().includes('currentColor'),
);

await click(button('Save slide types'), 1200);
check(
  'slide types are saved to the draft',
  text().includes('Slide types saved'),
);

// Saving reloads the lesson, so editing starts again for the checks below.
await click(button('Edit lesson'), 800);
check(
  'the editor reopens after saving types',
  text().includes('editing draft'),
);
check(
  'the new type is offered to every slide',
  [...dom.window.document.querySelectorAll('select')].some(node =>
    [...node.options].some(option => option.value === 'road_hazard'),
  ),
);

// The glyph survived the round trip to the server and back.
const draftsNow = await fetch(
  `http://localhost:${PORT}/v1/admin/courses/ca-class-c/versions`,
).then(response => response.json());
const draftId = draftsNow.drafts?.[0]?.draftId;
check('the draft is addressable for a direct read-back', draftId != null);
const savedOutline = await fetch(
  `http://localhost:${PORT}/v1/admin/courses/ca-class-c/drafts/${draftId}/outline`,
).then(response => response.json());
const savedStyle = savedOutline.cardStyles?.find(
  style => style.styleId === 'road_hazard',
);
check('the glyph is stored on the course', savedStyle?.iconSvg != null);
check(
  'it is stored minified and tinted',
  savedStyle?.iconSvg?.includes('currentColor') &&
    !savedStyle?.iconSvg?.includes('inkscape'),
);

// --- editing inside the simulator ------------------------------------------
await click(button('Phone'), 1200);
const editables = [
  ...(devices()[0]?.querySelectorAll('[contenteditable="true"]') ?? []),
];
check('the phone card is editable while editing a draft', editables.length > 0);

const countNow = () =>
  Number((text().match(/(\d+) fields? changed/) ?? [])[1] ?? '0');
const beforePhoneEdit = countNow();
const bodyNode = editables[1] ?? editables[0];
if (bodyNode != null) {
  bodyNode.textContent = `${bodyNode.textContent} Edited in the phone.`;
  bodyNode.dispatchEvent(
    new dom.window.FocusEvent('focusout', { bubbles: true }),
  );
  await settle(500);
}
check(
  'a blur in the phone commits to the draft',
  countNow() === beforePhoneEdit + 1,
);

await click(button('Text'), 900);
check(
  'the phone edit shows up in the text editor',
  text().includes('Edited in the phone.'),
);

await click(button('Save to v1.0.1'), 1200);
check('saving leaves edit mode', !text().includes('editing draft'));
check(
  'the saved text is served back',
  text().includes('What would you do here?'),
);
check(
  'the uploaded illustration survives the save',
  uploadedArtworkDrawn(),
);

// The edited draft against its base: the one replaced word must show up in
// the word-level diff, on both sides of the pane.
await click(button('Zutobi'), 400); // the reference picker still points there
await click(find('span, div', 'v1.0.0'), 1100);
const draftStats = chipText(/^\+\d+\s*−\d+$/).match(/\+(\d+)\s*−(\d+)/);
console.log(`   draft diff: ${draftStats?.[0] ?? 'absent'}`);
check('the draft diff counts the replaced words', draftStats != null);
check(
  'insertions and deletions both counted',
  Number(draftStats?.[1]) >= 1 && Number(draftStats?.[2]) >= 1,
);
// The removed wording renders in its own span on the reference side: the old
// title text appears as a distinct marked run, separate from the kept words.
const removedRun = [...dom.window.document.querySelectorAll('h3 span, p span')]
  .map(node => (node.textContent ?? '').trim())
  .filter(value => value === 'do?' || value === 'do here?');
check(
  'the diff marks the replaced wording in its own runs',
  removedRun.length >= 2,
);
check(
  'both panes render their cards',
  text().split('Quick challenge').length - 1 >= 2,
);

// The same diff, inside the simulators.
await click(button('Phone'), 1200);
const deviceSpans = which =>
  [...(devices()[which]?.querySelectorAll('span') ?? [])].map(node =>
    (node.textContent ?? '').trim(),
  );
check('phone A marks the inserted words', deviceSpans(0).includes('do here?'));
check('phone B marks the removed words', deviceSpans(1).includes('do?'));
await click(button('Text'), 800);

// --- every lesson in a draft is editable -----------------------------------
// The editor holds one lesson. Selecting another used to leave the first on
// screen under the new lesson's name, so a whole draft looked like one lesson.
const lessonRows = () => [
  ...dom.window.document.querySelectorAll('[data-lesson-id]'),
];
const selectedLessonId = () =>
  dom.window.document.querySelector('[data-lesson-id][aria-current="true"]')
    ?.dataset.lessonId ?? null;
const controlOf = (row, title) =>
  row?.querySelector(`button[title="${title}"]`) ??
  row?.querySelector(`button[title^="${title}"]`) ??
  null;
const pressEnter = node =>
  node?.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
const adminGet = path =>
  fetch(`http://localhost:${PORT}/v1/admin${path}`).then(r => r.json());

// The sidebar card for a version — never the same label in a compare header
// or a picker, which is what a text search lands on once a reference is set.
const versionCard = label =>
  [...dom.window.document.querySelectorAll('[data-version]')].find(node =>
    (node.textContent ?? '').includes(label),
  );
const lessonBefore = selectedLessonId();
check('the tree marks the selected lesson', lessonBefore != null);

await click(lessonRows()[0], 900);
await click(button('Edit lesson'), 900);
const firstLesson = lessonRows()[0]?.dataset.lessonId;
const secondLesson = lessonRows()[1]?.dataset.lessonId;
const firstLessonTitle = slideTitles()[0];
check(
  'editing opened on the first lesson',
  text().includes('editing draft') && firstLessonTitle != null,
);

await click(lessonRows()[1], 1500);
check(
  'selecting another lesson moves the editor to it',
  text().includes('editing draft') && selectedLessonId() === secondLesson,
  `selected ${selectedLessonId()}, wanted ${secondLesson}`,
);
check(
  'the editor shows that lesson, not the first one',
  slideTitles()[0] != null && slideTitles()[0] !== firstLessonTitle,
  `first slide is still "${slideTitles()[0]}"`,
);
check('nothing is counted as changed yet', /0 fields changed/.test(text()));

const secondTitleInput = [
  ...dom.window.document.querySelectorAll('input'),
].find(node => node.placeholder === 'Slide title');
setInput(secondTitleInput, `${secondTitleInput?.value ?? ''} (audit)`);
await settle(200);
check('an edit on the second lesson is counted', /1 field changed/.test(text()));

dom.window.confirm = () => false;
await click(lessonRows()[0], 900);
check(
  'refusing to discard keeps the selection on the edited lesson',
  selectedLessonId() === secondLesson && /1 field changed/.test(text()),
);
dom.window.confirm = () => true;
await click(lessonRows()[0], 1500);
check(
  'agreeing to discard moves the editor to the first lesson',
  selectedLessonId() === firstLesson &&
    slideTitles()[0] === firstLessonTitle &&
    /0 fields changed/.test(text()),
  `selected ${selectedLessonId()}, first slide "${slideTitles()[0]}"`,
);

// The same move across modules, and in the phone preview: the editor holds
// one lesson, and the sidebar is the only thing that says which.
const moduleOfRow = row =>
  row?.closest('div')?.parentElement?.textContent?.slice(0, 40) ?? '';
const firstTitlesAll = slideTitles();
// The tree row carries the lesson's own title, which is what the simulator
// puts in its header — a lesson-specific string that is on screen at card 1.
const titleOfRow = row =>
  (row?.querySelector('[data-lesson-title]')?.textContent ?? '').trim();
const firstRowTitle = titleOfRow(lessonRows()[0]);
const lastLesson = lessonRows().at(-1);
const lastRowTitle = titleOfRow(lastLesson);
const lastLessonId = lastLesson?.dataset.lessonId;
check(
  'the tree lists lessons from more than one module',
  lastLessonId != null && lastLessonId !== firstLesson,
  `${lessonRows().length} rows`,
);
await click(lastLesson, 1600);
check(
  'selecting a lesson in another module moves the editor to it',
  selectedLessonId() === lastLessonId,
  `selected ${selectedLessonId()}, wanted ${lastLessonId}`,
);
const lastTitles = slideTitles();
check(
  'and the editor shows that lesson',
  lastTitles.length > 0 &&
    lastTitles.join('|') !== firstTitlesAll.join('|'),
  `same ${lastTitles.length} titles as the first lesson`,
);
check('still editing after the move', text().includes('editing draft'));

// The simulator draws the lesson being edited, and a move made while it is
// on screen has to reach it too.
await click(button('Phone'), 1400);
check(
  'the phone draws the lesson the tree says',
  deviceText().includes(lastRowTitle),
  `phone says ${deviceText().slice(0, 90)}, wanted ${lastRowTitle}`,
);
await click(lessonRows()[0], 1800);
check(
  'and follows a move made while the phone is showing',
  selectedLessonId() === firstLesson && deviceText().includes(firstRowTitle),
  `selected ${selectedLessonId()}, phone says ${deviceText().slice(0, 90)}`,
);
await click(button('Text'), 900);
check(
  'back in text mode the editor is on the lesson the tree says',
  slideTitles().join('|') === firstTitlesAll.join('|'),
  `first slide "${slideTitles()[0]}"`,
);

// Artwork has to be on screen in the editor, not only in the read-only view:
// an author cannot judge a slide whose picture is missing.
const artworkSrcs = () =>
  [...dom.window.document.querySelectorAll('img')]
    .map(node => node.getAttribute('src') ?? '')
    .filter(src => src.startsWith('/v1/assets/'));
check(
  'the editor draws the lesson artwork',
  artworkSrcs().length > 0,
  `${artworkSrcs().length} pictures`,
);
// A quiz card's picture belongs to its question, and used to be drawn only in
// the read-only view: opening the editor made it vanish from the one place an
// author judges it.
check(
  'including the picture a question carries',
  text().includes('QUESTION IMAGE'),
);

// A question's picture belongs to the question, so the slide that asks it can
// swap it — describing it was all the editor used to allow.
const questionImageButtons = () =>
  [...dom.window.document.querySelectorAll('button')].filter(node =>
    ['Replace', 'Remove', '+ Add a picture'].includes(
      node.textContent?.trim() ?? '',
    ),
  );
check(
  'a quiz slide can change the picture its question shows',
  questionImageButtons().length > 0,
  `${questionImageButtons().length} controls`,
);

// --- questions ---------------------------------------------------------------
const prompts = () =>
  [...dom.window.document.querySelectorAll('textarea')].filter(
    node => node.placeholder === 'What the learner is asked',
  );
check('the lesson questions are editable', prompts().length > 0);
const prompt = prompts()[0];
const promptBefore = prompt?.value ?? '';
setInput(prompt, `${promptBefore} (audit)`);
await settle(150);
check('a prompt edit is counted', /1 field changed/.test(text()));
const questionWrap = prompt?.parentElement?.parentElement;
// The answer options, and nothing else the question editor holds: its
// feedback lines, and the alt text of the picture the question carries.
const choiceInputs = () =>
  [...(questionWrap?.querySelectorAll('input') ?? [])].filter(
    node =>
      !node.placeholder.startsWith('Feedback') &&
      !node.placeholder.startsWith('Describe the illustration'),
  );
const choiceBefore = choiceInputs()[0]?.value ?? '';
setInput(choiceInputs()[0], `${choiceBefore} (audit)`);
await settle(150);
const marks = questionWrap?.querySelectorAll(
  '[title="Mark as the correct answer"]',
);
check('each option can be marked correct', (marks?.length ?? 0) >= 3);
await click(marks?.[1], 200);
const optionsBefore = choiceInputs().length;
await click(
  [...(questionWrap?.querySelectorAll('button') ?? [])].find(node =>
    (node.textContent ?? '').includes('+ Add answer option'),
  ),
  200,
);
check(
  'an answer option can be added',
  choiceInputs().length === optionsBefore + 1,
);
const removes = questionWrap?.querySelectorAll('button[title="Remove option"]');
await click(removes?.[removes.length - 1], 200);
check('and removed again', choiceInputs().length === optionsBefore);
await click(button('Save to v1.0.1'), 1500);
check('the question edits save', !text().includes('editing draft'));
const savedLesson = await adminGet(
  `/courses/ca-class-c/drafts/${draftId}/lessons/${firstLesson}`,
);
const savedQuestion = savedLesson.questions?.find(
  question => question.prompt === `${promptBefore} (audit)`,
);
check('the prompt reached the server', savedQuestion != null);
check(
  'so did the choice text',
  savedQuestion?.choices?.[0]?.text === `${choiceBefore} (audit)`,
);
check(
  'and the correct answer',
  savedQuestion != null &&
    savedQuestion.correctAnswerId === savedQuestion.choices[1].id,
);

// --- save as a new version -----------------------------------------------------
// Edits can leave the draft they were made in untouched and start a new one.
await click(button('Edit lesson'), 900);
const saveAsInput = [...dom.window.document.querySelectorAll('input')].find(
  node => node.placeholder === 'Slide title',
);
const saveAsTitle = `${saveAsInput?.value ?? ''} (save-as)`;
setInput(saveAsInput, saveAsTitle);
await settle(200);
await click(button('Save as new version…'), 1200);
check(
  'the save-as dialog opens',
  text().includes('Save as new version') &&
    text().includes('v1.0.1 stays untouched'),
);
setInput(
  [...dom.window.document.querySelectorAll('input')]
    .filter(node => /^\d+\.\d+\.\d+$/.test(node.value))
    .pop(),
  '1.0.3',
);
await settle(150);
await click(button('Create draft'), 1500);
check(
  'the edit lands in a brand-new draft',
  text().includes('v1.0.3') && !text().includes('editing draft'),
);
const afterSaveAs = await adminGet('/courses/ca-class-c/versions');
const saveAsId = afterSaveAs.drafts?.find(
  draft => draft.draftId !== draftId && Object.values(draft).includes('1.0.3'),
)?.draftId;
check('the new draft is addressable', saveAsId != null, JSON.stringify(afterSaveAs.drafts).slice(0, 300));
if (saveAsId != null) {
  const [inNew, inOld] = await Promise.all([
    adminGet(`/courses/ca-class-c/drafts/${saveAsId}/lessons/${firstLesson}`),
    adminGet(`/courses/ca-class-c/drafts/${draftId}/lessons/${firstLesson}`),
  ]);
  check(
    'the new draft holds the edit',
    inNew.lesson?.blocks?.some(block => block.title === saveAsTitle),
  );
  check(
    'and the draft it came from is untouched',
    !inOld.lesson?.blocks?.some(block => block.title === saveAsTitle),
  );
}

// --- structure: modules and lessons ------------------------------------------
// On a second draft forked from the same release, so the release checks below
// keep the draft they were written against. Every move is read back from the
// server: the tree is a view, the outline is the truth.
const draftsBeforeFork = new Set(
  (await adminGet('/courses/ca-class-c/versions')).drafts?.map(
    draft => draft.draftId,
  ) ?? [],
);
await click(versionCard('v1.0.0'), 1100);
await click(button('Duplicate as draft'), 700);
check(
  'the release offers duplication',
  text().includes('Duplicate v1.0.0 as draft'),
);
setInput(
  dom.window.document.querySelector('input[type="text"], input:not([type])'),
  '1.0.2',
);
await settle(150);
await click(button('Create draft'), 1500);
check(
  'a second draft can be forked from the same release',
  text().includes('v1.0.2'),
);
const versionsNow = await adminGet('/courses/ca-class-c/versions');
const forkId = versionsNow.drafts?.find(
  draft => !draftsBeforeFork.has(draft.draftId),
)?.draftId;
check('the fork is addressable', forkId != null, JSON.stringify(versionsNow).slice(0, 300));
if (forkId != null) {
const outlineOf = () =>
  adminGet(`/courses/ca-class-c/drafts/${forkId}/outline`);
const control = title =>
  dom.window.document.querySelector(`button[title="${title}"]`);

let now = await outlineOf();
check('the fork outline loads', Array.isArray(now.modules), JSON.stringify(now).slice(0, 200));
const firstModuleId = now.modules?.[0]?.moduleId;
await click(control('Rename module'), 200);
const moduleRename = [...dom.window.document.querySelectorAll('input')].find(
  node => node.value === now.modules[0].title,
);
check('renaming a module opens an inline field', moduleRename != null);
setInput(moduleRename, 'Road basics (audit)');
pressEnter(moduleRename);
await settle(900);
now = await outlineOf();
check(
  'the module rename reaches the server',
  now.modules[0].title === 'Road basics (audit)',
);
check('and the tree', text().includes('Road basics (audit)'));
check(
  'and the label above the lesson',
  text().includes('Module · Road basics (audit)'),
);

await click(control('Move module down'), 900);
now = await outlineOf();
check('a module can move down', now.modules[1].moduleId === firstModuleId);
await click(
  dom.window.document.querySelectorAll('button[title="Move module up"]')[1],
  900,
);
now = await outlineOf();
check('and back up', now.modules[0].moduleId === firstModuleId);

const lesson0 = lessonRows()[0]?.dataset.lessonId;
await click(controlOf(lessonRows()[0], 'Rename'), 200);
const lessonRename = [...dom.window.document.querySelectorAll('input')].find(
  node => node.value === now.modules[0].lessons[0].title,
);
check('renaming a lesson opens an inline field', lessonRename != null);
setInput(lessonRename, 'Signals (audit)');
pressEnter(lessonRename);
await settle(900);
now = await outlineOf();
check(
  'the lesson rename reaches the server',
  now.modules[0].lessons[0].title === 'Signals (audit)',
);
await click(lessonRows()[0], 900);
const renamedDoc = await adminGet(
  `/courses/ca-class-c/drafts/${forkId}/lessons/${lesson0}`,
);
check(
  'the lesson document carries the new title',
  renamedDoc.lesson?.title === 'Signals (audit)',
);
check(
  'the viewer shows the new title, not a cached one',
  (text().match(/Signals \(audit\)/g) ?? []).length >= 2,
);

await click(controlOf(lessonRows()[0], 'Move down'), 900);
now = await outlineOf();
check(
  'a lesson can move down within its module',
  now.modules[0].lessons[1].lessonId === lesson0,
);
await click(controlOf(lessonRows()[1], 'Move up'), 900);
now = await outlineOf();
check('and back up', now.modules[0].lessons[0].lessonId === lesson0);

const lessonsBefore = now.modules[0].lessons.length;
await click(control('Add lesson'), 900);
now = await outlineOf();
check(
  'a lesson can be added to a module',
  now.modules[0].lessons.length === lessonsBefore + 1 &&
    text().includes('Untitled lesson'),
);
const modulesBefore = now.modules.length;
await click(button('+ Add module'), 900);
now = await outlineOf();
check(
  'a module can be added to the course',
  now.modules.length === modulesBefore + 1 && text().includes('New module'),
);

await click(lessonRows()[0], 900);
await click(button('Edit lesson'), 900);
await click(controlOf(lessonRows()[0], 'Move down'), 700);
check(
  'the tree refuses to move a lesson while it is being edited',
  text().includes('Finish or discard the lesson edit first'),
);
now = await outlineOf();
check('and nothing moved', now.modules[0].lessons[0].lessonId === lesson0);
await click(button('Discard'), 600);

// --- moving a lesson elsewhere, deleting a lesson, deleting a module ----------
const newModuleId = now.modules.at(-1).moduleId;
const lesson0Doc = await adminGet(
  `/courses/ca-class-c/drafts/${forkId}/lessons/${lesson0}`,
);
const lesson0Questions = (lesson0Doc.questions ?? []).map(
  question => question.questionId,
);
check('the lesson to be moved has questions of its own', lesson0Questions.length > 0);
check(
  'no separate control is needed to change module',
  lessonRows()[0]?.querySelector('select') == null,
);
// Down past the last lesson of a module is the first place in the next one:
// the two arrows place a lesson anywhere in the course.
const lessonsInFirst = now.modules[0].lessons.length;
for (let step = 0; step < lessonsInFirst; step += 1) {
  const row = lessonRows().find(node => node.dataset.lessonId === lesson0);
  await click(controlOf(row, 'Move down'), 800);
}
now = await outlineOf();
check(
  'the arrow carries the lesson into the next module',
  now.modules[1].lessons[0]?.lessonId === lesson0 &&
    !now.modules[0].lessons.some(lesson => lesson.lessonId === lesson0),
  JSON.stringify(now.modules.map(m => m.lessons.map(l => l.lessonId))).slice(0, 200),
);
check(
  'the module it left no longer tests on it',
  !now.modules[0].moduleTestQuestionIds.some(id =>
    lesson0Questions.includes(id),
  ),
);
// And back up the way it came.
const backRow = lessonRows().find(node => node.dataset.lessonId === lesson0);
await click(controlOf(backRow, 'Move up'), 900);
now = await outlineOf();
check(
  'and back into the module above',
  now.modules[0].lessons.at(-1)?.lessonId === lesson0,
);
// Leave it in the second module for the checks below.
const againRow = lessonRows().find(node => node.dataset.lessonId === lesson0);
await click(controlOf(againRow, 'Move down'), 900);
now = await outlineOf();
check('it is still the selected lesson', selectedLessonId() === lesson0);

const movedRow = lessonRows().find(row => row.dataset.lessonId === lesson0);
dom.window.confirm = () => true;
await click(controlOf(movedRow, 'Delete lesson'), 900);
now = await outlineOf();
check(
  'a lesson can be deleted',
  !now.modules.some(module =>
    module.lessons.some(lesson => lesson.lessonId === lesson0),
  ),
);
check(
  'its questions leave every module test',
  now.modules.every(
    module =>
      !module.moduleTestQuestionIds.some(id => lesson0Questions.includes(id)),
  ),
);
check(
  'the viewer moves on to a lesson that exists',
  selectedLessonId() != null && selectedLessonId() !== lesson0,
);

const deleteModuleButtons = () => [
  ...dom.window.document.querySelectorAll('button[title="Delete module"]'),
];
check(
  'every module offers deletion while there is more than one',
  deleteModuleButtons().length === now.modules.length &&
    deleteModuleButtons().every(node => !node.disabled),
);
await click(deleteModuleButtons().at(-1), 900);
now = await outlineOf();
check(
  'a module can be deleted',
  now.modules.length === modulesBefore &&
    !now.modules.some(module => module.moduleId === newModuleId) &&
    !text().includes('New module'),
);
}

// --- deleting a draft --------------------------------------------------------
await click(versionCard('v1.0.2'), 900);
const deleteDraftButton = versionCard('v1.0.2')?.querySelector(
  'button[title="Delete draft"]',
);
check('a selected draft offers deletion', deleteDraftButton != null);
check(
  'a release does not',
  versionCard('v1.0.0')?.querySelector('button[title="Delete draft"]') == null,
);
dom.window.confirm = () => true;
await click(deleteDraftButton, 1500);
check('the draft is gone from the sidebar', versionCard('v1.0.2') == null);
const afterDelete = await adminGet('/courses/ca-class-c/versions');
check(
  'and from the server',
  !afterDelete.drafts?.some(draft => draft.draftId === forkId),
);
check(
  'the viewer moved to a release',
  (
    dom.window.document.querySelector('[data-version][aria-current="true"]')
      ?.textContent ?? ''
  ).includes('v1.0.0'),
);

// Back to the draft and the lesson the rest of this run was written against.
await click(versionCard('v1.0.1'), 1100);
await click(
  lessonRows().find(row => row.dataset.lessonId === lessonBefore),
  900,
);
check('the original selection is restored', selectedLessonId() === lessonBefore);

// --- module test ----------------------------------------------------------
// The first module's test, so the expected questions are known.
const testRow = [...dom.window.document.querySelectorAll('div')].filter(node =>
  (node.textContent ?? '').trim().startsWith('TModule test'),
)[0];
await click(testRow, 900);
check('the module test opens its editor', text().includes('Module test —'));
check('the current selection is preloaded', /10 selected/.test(text()));
check(
  'questions are grouped by their lesson',
  text().includes('ca-sign-shapes-and-colors'),
);

const firstQuestion = [...dom.window.document.querySelectorAll('div')]
  .filter(node =>
    (node.textContent ?? '').trim().startsWith('What should you expect'),
  )
  .pop();
await click(firstQuestion, 200);
check('a question can be toggled off', /9 selected/.test(text()));

await click(button('Save module test'), 900);
check(
  'the module test count updates in the tree',
  text().includes('9 questions'),
);

// --- prompt builder -------------------------------------------------------
// The panel reads the live selection, so one is planted the way a user makes it.
// Must be a paragraph inside the viewer — the sidebar's own prose sits
// outside the pane that owns the context menu.
const paragraph = [...dom.window.document.querySelectorAll('section p')].find(
  node => (node.textContent ?? '').length > 40,
);
check('there is lesson prose to select', paragraph != null);
const selectedText = (paragraph?.textContent ?? '').slice(0, 60);
dom.window.getSelection = () => ({
  toString: () => selectedText,
  removeAllRanges: () => {},
});

paragraph?.dispatchEvent(
  new dom.window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 300,
    clientY: 300,
  }),
);
await settle(300);
check(
  'right-clicking a selection opens the menu',
  text().includes('Add to prompt'),
);

await click(button('Add to prompt'), 400);
check(
  'the excerpt lands in the prompt panel',
  text().includes('Prompt builder'),
);
check('the excerpt keeps its text', text().includes(selectedText.slice(0, 30)));
check('the excerpt is attributed to its lesson', text().includes('1 excerpt'));
// Placeholders live in the attribute, not in the document's text.
check(
  'a note can be written per excerpt',
  [...dom.window.document.querySelectorAll('textarea')].some(
    node => node.placeholder === 'What should change here?',
  ),
);

// Copy assembles the whole request.
let copied = '';
dom.window.navigator.clipboard = {
  writeText: async value => {
    copied = value;
  },
};
await click(button('Copy prompt'), 400);
check(
  'copy produces a markdown request',
  copied.startsWith('# Course content revision request'),
);
check(
  'the request names the working version',
  /Working version: v1\.0\.1/.test(copied),
);
check(
  'the request quotes the excerpt',
  copied.includes('> ' + selectedText.slice(0, 20)),
);
check('copying is confirmed with a toast', text().includes('Prompt copied'));

// --- competitor courses ---------------------------------------------------
check(
  'competitor courses are listed',
  text().includes('Zutobi') && text().includes('myDMV'),
);
check('competitors show their size', /\d+ modules · \d+ lessons/.test(text()));

// A competitor row sets the right-hand reference, never the primary pane.
const zutobiRow = find('span, div', 'Zutobi');
await click(zutobiRow, 1200);
check('the primary pane still holds our course', text().includes('v1.0.1'));
check(
  'the reference switched to the competitor',
  text().includes('Article + quiz'),
);
check(
  'competitor content is rendered as sections',
  text().includes('Article section') || text().includes('Lesson opening'),
);
check('formats differing disables the diff', text().includes('Formats differ'));

// The right pane's lesson comes from the reference course's own outline —
// the left sidebar cannot offer competitor lesson ids.
await click(button('Right of Way I'), 400);
// Rows are numbered straight through the course, like the competitor's app.
// Folder lesson-4 is "Lesson 4" in Zutobi's own app — the row must say 04
// even though an earlier lesson is missing from the capture.
const lessonRow = [...dom.window.document.querySelectorAll('div')]
  .filter(node => (node.textContent ?? '').trim() === '04Right of way II')
  .pop();
check('picker rows carry the course-wide lesson number', lessonRow != null);
await click(lessonRow ?? find('span, div', 'Right of way II'), 1400);
check(
  'another competitor lesson can be chosen for the right pane',
  text().includes('STOP and YIELD signs'),
);
check(
  'the picker button shows the chosen number',
  text().includes('04Right of way II'),
);

// Our own course is also a valid reference — with a single release that is
// the only way to see it on both sides.
const refVersionButton = [...dom.window.document.querySelectorAll('button')]
  .filter(node => (node.textContent ?? '').trim().startsWith('Zutobi'))
  .shift();
await click(refVersionButton, 400);
if (process.env.UI_DUMP) {
  const opened = [...dom.window.document.querySelectorAll('span')].map(node =>
    (node.textContent ?? '').trim(),
  );
  console.log('--- picker state ---');
  console.log('dropdown shows myDMV row:', opened.includes('myDMV'));
  console.log(
    'v1.0.1 spans:',
    opened.filter(value => value === 'v1.0.1').length,
  );
  console.log(
    'v1.0.0 spans:',
    opened.filter(value => value === 'v1.0.0').length,
  );
}
const ownOption = [...dom.window.document.querySelectorAll('span')]
  .filter(node => (node.textContent ?? '').trim() === 'v1.0.1')
  .pop();
check('the reference dropdown offers our own course', ownOption != null);
await click(ownOption, 1600);
if (process.env.UI_DUMP) {
  console.log('--- after own-course pick ---');
  console.log(text().slice(-1200));
}
check(
  'our course opens in the right pane',
  text().split('Quick challenge').length - 1 >= 2,
);
// Back to Zutobi for the phone checks below.
await click(
  [...dom.window.document.querySelectorAll('button')]
    .filter(node => (node.textContent ?? '').trim().startsWith('v1.0.1'))
    .shift(),
  400,
);
await click(find('span, div', 'Zutobi'), 1200);

await click(button('Phone'), 1200);
check('the competitor is drawn in its own app style', devices().length === 2);
const competitorDevice = devices()[1];
check(
  'the competitor phone shows its lesson',
  (competitorDevice?.textContent ?? '').includes('Lesson'),
);
check(
  'the competitor phone uses captured photography',
  competitorDevice?.querySelector('img') != null,
);
await click(button('Text'), 600);

// --- find similar ---------------------------------------------------------
await click(button('Find similar'), 2500);
check(
  'the similar panel opens beside the lesson',
  text().includes('Similar in'),
);
check(
  'it reports what ranked the matches',
  /No API key|Ranked by/.test(text()),
);
const matchPercent = /\d+%/.test(text());
check(
  'matches are scored',
  matchPercent || text().includes('No similar content'),
);

// --- formats and settings screens ----------------------------------------
await click(button('Formats'), 600);
check(
  'the formats screen lists every card type',
  text().includes('Quick challenge') && text().includes('Remember this'),
);
check('formats name their API key', text().includes('"type":"core_rule"'));
check(
  'formats describe the checkpoint split',
  text().includes('checkpointQuestionId'),
);
check(
  'competitor formats are documented too',
  text().includes('Article section'),
);
check('lesson-level constraints are stated', text().includes('12 blocks'));

await click(button('Settings'), 600);
check('settings shows the course name', text().includes('Course name'));
check(
  'settings offers the publishing gates',
  text().includes('Require change note'),
);
check('settings offers the AI provider', text().includes('anthropic'));
check(
  'settings explains the key situation',
  /API key detected|No API key/.test(text()),
);

const spellToggle = [...dom.window.document.querySelectorAll('button')].filter(
  node => node.textContent === '',
);
await click(spellToggle[spellToggle.length - 1], 500);
check('a setting can be toggled', text().includes('Settings saved'));

// --- app releases --------------------------------------------------------------
check(
  'settings offers the app release gates',
  text().includes('Minimum supported app') && text().includes('iOS — store URL'),
);
const versionFields = [...dom.window.document.querySelectorAll('input')].filter(
  node => node.value === '1.0.0',
);
check('the three version fields start at 1.0.0', versionFields.length === 3);
setInput(versionFields[1], '1.2.0');
setInput(
  [...dom.window.document.querySelectorAll('input')].find(
    node => node.placeholder === 'https://apps.apple.com/…',
  ),
  'https://apps.apple.com/app/id123',
);
await settle(200);
await click(button('Save app releases'), 1200);
check('app releases save', text().includes('App releases saved'));
const appRelease = await adminGet('/app-release');
check(
  'the iOS release reaches the server',
  appRelease.ios?.latestVersion === '1.2.0' &&
    appRelease.ios?.storeUrl === 'https://apps.apple.com/app/id123',
  JSON.stringify(appRelease).slice(0, 200),
);
check(
  'the app gate is untouched',
  appRelease.minSupportedAppVersion === '1.0.0',
);

await click(button('Course'), 800);

// --- release --------------------------------------------------------------
// Back to the draft that was edited earlier in this run.
const draftRow = find('span, div', 'v1.0.1');
await click(draftRow, 900);
check('the draft can be reselected', text().includes('Release…'));

await click(button('Release…'), 1500);
check('the release dialog opens', text().includes('Release v1.0.1'));
const dialog = [...dom.window.document.querySelectorAll('div')]
  .filter(node => (node.textContent ?? '').startsWith('Release v1.0.1'))
  .pop();
if (process.env.UI_DUMP) {
  console.log('--- release dialog ---');
  console.log((dialog?.textContent ?? '(none)').slice(0, 700));
}
check('it reports what changed', /\d+ lesson/.test(dialog?.textContent ?? ''));
// A module test was edited earlier in this run, so the change is module-wide
// and the contract demands a minor bump rather than a patch.
const dialogText = () =>
  [...dom.window.document.querySelectorAll('div')]
    .filter(node => (node.textContent ?? '').startsWith('Release v1.0.1'))
    .pop()?.textContent ?? '';
check(
  'it states the bump the changes need',
  /a minor bump from 1\.0\.0/.test(dialogText()),
);
check(
  'it suggests the next free number',
  dialogText().includes('Suggested 1.1.0'),
);
// The old soft/optional/hard instruction plan fed a client that no longer
// exists; the dialog carries the Delivery taxonomy and nothing else.
check(
  'the severity plan is gone from the dialog',
  !dialogText().includes('Update instructions') &&
    !dialogText().includes('soft'),
);

const noteField = [...dom.window.document.querySelectorAll('textarea')].find(
  node => node.placeholder === 'What changed and why',
);
check('a change note can be written', noteField != null);
if (noteField != null) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  setter.call(noteField, 'Reworded the opening challenge.');
  noteField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settle(200);
}

// What this release means for the field: a minor bump is a course update,
// and by default only new users see it.
check(
  'the dialog says what the release means for devices',
  dialogText().includes('Delivery'),
);
check(
  'a minor bump defaults to new-users-only',
  dialogText().includes('new users only') &&
    dialogText().includes('offer to everyone'),
);
await click(button('Release 1.1.0'), 2500);
check('the release succeeds', text().includes('Released v1.1.0'));
check('the new version is now a release', !text().includes('Release…'));
check('released versions offer publishing', text().includes('Publish…'));

// Releasing is not publishing: the version exists, but production still
// serves what it served before.
const bootstrapOf = async () =>
  fetch(
    `http://localhost:${PORT}/v1/bootstrap?course=ca-class-c&courseVersion=1.0.0`,
  ).then(response => response.json());
const released = await bootstrapOf();
check(
  'a release alone changes nothing for the app',
  released.course.latestVersion === '1.0.0' && released.course.mode === 'none',
);

// Publishing points a channel at the release. Production asks for the version
// to be typed out, because it reaches everyone.
await click(button('Publish…'), 700);
check(
  'the publish dialog offers both channels',
  text().includes('Staging') && text().includes('Production'),
);
check(
  'it says a channel is pointed, not deployed',
  text().includes('Points a channel at this release'),
);
await click(button('Publish to staging'), 1200);
check('staging takes the release', text().includes('Staging now serves v1.1.0'));
await click(button('Done'), 500);

const afterStaging = await bootstrapOf();
check(
  'production is still untouched',
  afterStaging.course.latestVersion === '1.0.0',
);

await click(button('Publish…'), 700);
await click(find('span, div, button', 'Production'), 400);
const confirmField = [...dom.window.document.querySelectorAll('input')].find(
  node => node.placeholder === '1.1.0',
);
check('production asks the version to be typed out', confirmField != null);
if (confirmField != null) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value',
  ).set;
  setter.call(confirmField, '1.1.0');
  confirmField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settle(200);
}
await click(button('Publish to production'), 1500);
check(
  'production takes the release',
  text().includes('Production now serves v1.1.0'),
);
await click(button('Done'), 500);

// --- rolling back ------------------------------------------------------------
// Publishing an older release is the same move. Production only takes what
// has been on staging, so the older one goes there first — the same order a
// new release goes in.
const bootstrapNow = () =>
  fetch(`http://localhost:${PORT}/v1/bootstrap?course=ca-class-c`).then(r =>
    r.json(),
  );
const typeConfirm = async version => {
  await click(find('span, div, button', 'Production'), 400);
  setInput(
    [...dom.window.document.querySelectorAll('input')].find(
      node => node.placeholder === version,
    ),
    version,
  );
  await settle(200);
};
await click(versionCard('v1.0.0'), 1100);
await click(button('Publish…'), 700);
check(
  'an older release can be published',
  text().includes('Points a channel at this release'),
);
check(
  'the dialog warns that this is a rollback',
  text().includes('Rollback: devices on v1.1.0 will download v1.0.0 whole'),
);
await click(button('Roll back staging'), 1200);
check(
  'staging rolls back',
  text().includes('Staging now serves v1.0.0 (was v1.1.0)'),
);
await click(button('Done'), 500);
await click(button('Publish…'), 700);
await typeConfirm('1.0.0');
await click(button('Roll back production'), 1500);
check(
  'production rolls back',
  text().includes('Production now serves v1.0.0 (was v1.1.0)'),
);
await click(button('Done'), 500);
check(
  'the app is served the older release again',
  (await bootstrapNow()).course.latestVersion === '1.0.0',
);
const history = await adminGet('/courses/ca-class-c/channels/history');
const moves = Array.isArray(history) ? history : history.moves ?? [];
check(
  'every move is on record with who made it',
  moves.length >= 4 &&
    moves.every(move => typeof move.actor === 'string' && move.actor.length > 0),
  JSON.stringify(moves).slice(0, 200),
);
await click(button('History'), 900);
check(
  'the sidebar shows the channel history',
  dom.window.document.querySelectorAll('[data-history-row]').length >= 4,
);
check(
  'newest first, with the rollback on top',
  (dom.window.document.querySelector('[data-history-row]')?.textContent ?? '')
    .includes('v1.1.0 → v1.0.0'),
);
check(
  'each move names who made it',
  [...dom.window.document.querySelectorAll('[data-history-row]')].every(
    node => /·/.test(node.textContent ?? ''),
  ),
);
await click(button('History'), 400);

// Forward again, so the rest of the run sees the newer release live.
await click(versionCard('v1.1.0'), 1100);
await click(button('Publish…'), 700);
await click(button('Publish to staging'), 1200);
await click(button('Done'), 500);
await click(button('Publish…'), 700);
await typeConfirm('1.1.0');
await click(button('Publish to production'), 1500);
await click(button('Done'), 500);
check(
  'and forward again',
  (await bootstrapNow()).course.latestVersion === '1.1.0',
);

// End to end through the verdict: 1.1.0 released as new-users-only, so an
// existing device on 1.0.0 hears nothing while a fresh one starts on it.
const verdictHeld = await fetch(
  `http://localhost:${PORT}/v2/bootstrap?course=ca-class-c&courseVersion=1.0.0&appVersion=9.0.0`,
).then(response => response.json());
check(
  'a new-users-only release is never mentioned to existing devices',
  verdictHeld.course.replace == null && verdictHeld.course.offer == null,
  JSON.stringify(verdictHeld.course).slice(0, 200),
);
const verdictFresh = await fetch(
  `http://localhost:${PORT}/v2/bootstrap?course=ca-class-c&appVersion=9.0.0`,
).then(response => response.json());
check(
  'while a fresh device starts on it',
  verdictFresh.course.replace?.version === '1.1.0',
);

// Only now does the app see it.
const published = await bootstrapOf();
check(
  'the app is offered the new version',
  published.course.latestVersion === '1.1.0',
);
check(
  'it is offered as a delta on the legacy route',
  published.course.mode === 'delta',
);

// Collapse the versions sidebar.
const collapse = [...dom.window.document.querySelectorAll('button')].find(
  node => node.title === 'Collapse',
);
if (collapse != null) {
  collapse.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await settle(200);
}
check(
  'a panel can be collapsed',
  !text().includes('Released versions are immutable'),
);

// --- the signs catalogue ----------------------------------------------------
// Unversioned and image-only: edit, save, publish. Every sign's artwork is an
// uploaded picture, so there is no art-kind vocabulary in the editor at all.
// --- the question bank, at the level of the signs catalogue ----------------
// Questions are the course's own entity: the app downloads the bank on its
// own, so a fix reaches learners without a course release.
await click(find('span, div, button', 'Questions'), 1200);
check('the question bank opens from the rail', text().includes('Question bank'));
const bankRows = () => [
  ...dom.window.document.querySelectorAll('div[data-bank-question]'),
];
check('it lists the published questions', bankRows().length > 0);
check(
  'and says what each channel serves',
  /staging [0-9a-f—]/.test(text()) && /production [0-9a-f—]/.test(text()),
);

// A question's picture is edited where the question is, so the bank has to
// carry it: the app asks bank questions wherever their ids are referenced.
const illustrated = () =>
  bankRows().find(node => (node.textContent ?? '').length > 0);
await click(illustrated() ?? bankRows()[0], 600);
const bankImages = () =>
  [...dom.window.document.querySelectorAll('img')].filter(node =>
    (node.getAttribute('src') ?? '').startsWith('/v1/assets/'),
  );
const pictureButtons = () =>
  [...dom.window.document.querySelectorAll('button')]
    .map(node => node.textContent?.trim() ?? '')
    .filter(label => ['Replace', 'Remove', '+ Add a picture'].includes(label));
check(
  'a question offers its picture, or offers to add one',
  pictureButtons().length > 0,
  pictureButtons().join(' | '),
);

const poolToggle = () =>
  [...dom.window.document.querySelectorAll('div[title]')].find(node =>
    (node.getAttribute('title') ?? '').startsWith(
      'Whether the general Practice pool',
    ),
  );
check('a question opens for editing', poolToggle() != null);
// Whichever question the list opened with: if it names a picture, the bank
// carries it and the editor draws it.
const askedPicture = pictureButtons().includes('Replace');
check(
  'an illustrated question draws its picture here',
  !askedPicture || bankImages().length > 0,
  `${bankImages().length} drawn`,
);
check(
  'and can be kept out of the general Practice pool',
  !text().includes('lesson only'),
);
await click(poolToggle(), 500);
check(
  'the flag is set on the question',
  text().includes('lesson only'),
  text().slice(0, 0),
);

const saveBank = () =>
  [...dom.window.document.querySelectorAll('button')].find(node =>
    (node.textContent ?? '').startsWith('Save ('),
  );
check('saving is offered once something changed', saveBank() != null);
await click(saveBank(), 1200);
check('the bank saves', !text().includes('Save ('));
// Saving is not publishing, and the screen has to say so — this is exactly
// the gap an author falls into: edit, save, and wonder why the phone shows
// the old question.
check(
  'and says the save has not reached anyone yet',
  text().includes('not published') &&
    text().includes('learners still get the older set'),
);

// Staging first, then everyone: the same order a course and the signs go in.
const publishStaging = () =>
  [...dom.window.document.querySelectorAll('button')].find(
    node => node.textContent?.trim() === 'Publish to staging',
  );
await click(publishStaging(), 1200);
const bankLatest = await fetch(
  `http://localhost:${PORT}/v1/bank/ca-class-c/latest?channel=production`,
).then(response => (response.ok ? response.json() : null));
check(
  'publishing to staging leaves production alone',
  bankLatest == null || typeof bankLatest.sha256 === 'string',
);
check(
  'and the screen now points at the last step',
  text().includes('publish to production to send it to everyone'),
);

await click(find('span, div, button', 'Signs'), 1000);
check('signs screen opens from the rail', text().includes('Signs catalogue'));
check(
  'the catalogue counts its contents',
  /\d+ signs · \d+ categories/.test(text()),
);
check(
  'it opens directly editable — no draft step',
  text().includes('no unsaved changes') && !text().includes('New draft'),
);
check(
  'the catalogue lists its categories',
  text().includes('Regulatory') && text().includes('Work zone'),
);
check(
  'signs are listed by their own artwork',
  dom.window.document.querySelectorAll('img[src^="/v1/signs/assets/"]').length >
    10,
);

await click(find('span, div', 'Stop'), 600);
check(
  'the sign editor shows the MUTCD code',
  [...dom.window.document.querySelectorAll('input')].some(
    node => node.value === 'R1-1',
  ),
);
check(
  'both preview sizes are shown',
  text().includes('detail') && text().includes('grid & quiz'),
);
check(
  'the editor offers a detail image and a thumbnail slot',
  text().includes('detail image') && text().includes('thumbnail (optional)'),
);
check(
  'a file input backs each image slot',
  dom.window.document.querySelectorAll('input[type="file"]').length >= 2,
);
// The whole point of this pass: the art-spec pickers are gone.
check(
  'no art-kind vocabulary is offered',
  !text().includes('yellowDiamond') &&
    !text().includes('red slash') &&
    !text().includes('big text') &&
    !text().includes('drawn fallback'),
);

const signName = [...dom.window.document.querySelectorAll('input')].find(
  node => node.value === 'Stop',
);
check('the sign name is editable', signName != null);
if (signName != null) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    'value',
  ).set;
  setter.call(signName, 'Stop — ui-check');
  signName.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await settle(300);
}
check('a signs edit is counted', /1 changed/.test(text()));

await click(button('Save'), 1200);
check('saving clears the change count', /no unsaved changes/.test(text()));

// Saving writes the working copy; what the app is served is whatever the
// channel points at, which is still the catalogue from before the edit.
// Staging always needs its key — the server has no environment exception —
// so the check presents one the way a developer's device does.
const STAGING_KEY = 'ui-check-staging-key';
const signsDocOf = async (channel = 'production') =>
  fetch(
    `http://localhost:${PORT}/v1/signs/doc${channel === 'production' ? '' : `?channel=${channel}`}`,
    channel === 'production' ? {} : { headers: { 'X-Staging-Key': STAGING_KEY } },
  ).then(response => (response.ok ? response.json() : null));
const beforePublish = await signsDocOf();
check(
  'a save alone changes nothing for the app',
  beforePublish == null ||
    !beforePublish.signs.some(sign => sign.name === 'Stop — ui-check'),
);

await click(button('Publish to staging'), 1200);
const staged = await signsDocOf('staging');
check(
  'staging serves the saved catalogue',
  staged != null && staged.signs.some(sign => sign.name === 'Stop — ui-check'),
);
check(
  'production is still untouched',
  JSON.stringify(await signsDocOf()) !== JSON.stringify(staged),
);

// Production asks before reaching every install.
dom.window.confirm = () => true;
await click(button('Publish to production'), 1200);
const savedDoc = await signsDocOf();
check(
  'the published catalogue is what the app is served',
  savedDoc != null &&
    savedDoc.signs.some(sign => sign.name === 'Stop — ui-check'),
);
check(
  'every served sign carries its own artwork',
  savedDoc.signs.every(sign =>
    /^[0-9a-f]{64}$/.test(sign.image?.full?.assetId),
  ),
);

// --- signs: adding, artwork, deleting, reverting ------------------------------
const signsSaved = () => adminGet('/signs/doc');
await click(button('+ category'), 500);
check(
  'a category can be added',
  text().includes('New category') && /1 changed/.test(text()),
);
check(
  'a category with no signs cannot be saved',
  text().includes('problem') && button('Save')?.disabled === true,
);
await click(
  [...dom.window.document.querySelectorAll('button')]
    .filter(node => (node.textContent ?? '').trim() === '+ sign')
    .pop(),
  500,
);
check(
  'a sign can be added to it',
  text().includes('New sign') && /2 changed/.test(text()),
);
check(
  'the new sign needs artwork before it can be saved',
  button('Save')?.disabled === true,
);
setInput(
  [...dom.window.document.querySelectorAll('input')].find(
    node => node.value === 'New sign',
  ),
  'Audit sign',
);
setInput(
  [...dom.window.document.querySelectorAll('input')].find(
    node => node.value === 'R0-0',
  ),
  'R9-9',
);
await settle(200);
const slotInputs = [
  ...dom.window.document.querySelectorAll('input[type="file"]'),
];
check('the new sign offers both image slots', slotInputs.length >= 2);
const SIGN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#c8102e"/></svg>';
const SIGN_SHA = createHash('sha256').update(SIGN_SVG).digest('hex');
{
  const file = new dom.window.File([SIGN_SVG], 'audit.svg', {
    type: 'image/svg+xml',
  });
  Object.defineProperty(slotInputs[0], 'files', {
    configurable: true,
    value: { 0: file, length: 1, item: index => (index === 0 ? file : null) },
  });
  slotInputs[0].dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await settle(1200);
}
check(
  'uploaded artwork is drawn by its own hash',
  [...dom.window.document.querySelectorAll('img')].some(node =>
    (node.getAttribute('src') ?? '').includes(SIGN_SHA),
  ),
);
check(
  'with the artwork in place the catalogue can be saved',
  button('Save')?.disabled === false,
  text().slice(-300),
);
await click(button('Save'), 1500);
check('the new category and sign are saved', /no unsaved changes/.test(text()));
let signsNow = await signsSaved();
const auditSign = signsNow.signs?.find(sign => sign.name === 'Audit sign');
check(
  'the sign reached the server with its code and artwork',
  auditSign?.code === 'R9-9' &&
    auditSign?.image?.full?.assetId === SIGN_SHA &&
    auditSign?.categoryId === 'new-category',
  JSON.stringify(auditSign).slice(0, 200),
);
check(
  'the category reached the server',
  signsNow.categories?.some(category => category.id === 'new-category'),
);

await click(find('span, div', 'Audit sign'), 500);
dom.window.confirm = () => true;
await click(button('Delete sign'), 500);
check(
  'a sign can be deleted',
  !text().includes('Audit sign') && /1 changed/.test(text()),
);
check(
  'which leaves its category empty and the catalogue unsaveable',
  button('Save')?.disabled === true,
);
await click(find('span, div', 'New category'), 500);
await click(button('Delete category'), 500);
check(
  'an empty category can be deleted',
  !text().includes('New category') && button('Save')?.disabled === false,
);
await click(button('Save'), 1500);
signsNow = await signsSaved();
check(
  'both deletions reach the server',
  !signsNow.signs.some(sign => sign.name === 'Audit sign') &&
    !signsNow.categories.some(category => category.id === 'new-category'),
);

await click(find('span, div', 'Stop — ui-check'), 500);
setInput(
  [...dom.window.document.querySelectorAll('input')].find(
    node => node.value === 'Stop — ui-check',
  ),
  'Stop — reverted',
);
await settle(200);
check('a signs edit is counted before reverting', /1 changed/.test(text()));
await click(button('Revert'), 500);
check(
  'revert restores the saved catalogue',
  /no unsaved changes/.test(text()) && !text().includes('Stop — reverted'),
);

// --- signs: rolling back from the history --------------------------------------
await click(button('History'), 900);
const signsHistoryRows = () => [
  ...dom.window.document.querySelectorAll('[data-signs-history-row]'),
];
check('the signs history lists every publish', signsHistoryRows().length >= 4);
const oldest = signsHistoryRows().at(-1);
const rowButton = (row, label) =>
  [...(row?.querySelectorAll('button') ?? [])].find(node =>
    (node.textContent ?? '').includes(label),
  );
await click(rowButton(oldest, 'Staging ← this'), 1500);
const stagingRolled = await signsDocOf('staging');
check(
  'staging can be pointed at an earlier catalogue',
  stagingRolled != null &&
    !stagingRolled.signs.some(sign => sign.name === 'Stop — ui-check'),
);
dom.window.confirm = () => true;
await click(rowButton(signsHistoryRows().at(-1), 'Production ← this'), 1500);
const productionRolled = await signsDocOf();
check(
  'and so can production',
  productionRolled != null &&
    !productionRolled.signs.some(sign => sign.name === 'Stop — ui-check'),
);
check(
  'the rollbacks are themselves on record',
  (signsHistoryRows()[0]?.textContent ?? '').includes('production') &&
    (signsHistoryRows()[1]?.textContent ?? '').includes('staging'),
);

// --- the universal skeleton, read-only -------------------------------------
// The tab in the header swaps the whole body for the shared document every
// state's course is built from. What has to be legible there is which parts
// are not shared and which words are variables.
await click(button('Skeleton'), 1500);
check('the header switches to the skeleton', text().includes('Universal skeleton'));
check(
  'the skeleton lists its 29 universal lessons',
  /29 universal lessons/.test(text()),
);
check(
  'the skeleton names its own revision',
  /SK-\d{4}\.\d{2}\.\d{2}-r\d+/.test(text()),
);
check(
  'the state module is marked as filled in per state',
  text().includes('per state'),
);

// A lesson every state extends: the shared cards, then each state's note.
const skeletonLesson = find('span, div', 'Phones, Fatigue, and Road Rage');
check('a skeleton lesson can be opened', skeletonLesson != null);
if (skeletonLesson != null) {
  skeletonLesson.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true }),
  );
  await settle(600);
}

const skeletonBlocks = scope =>
  [...dom.window.document.querySelectorAll('[data-skeleton-block]')].filter(
    node => node.dataset.skeletonBlock === scope,
  );
check('shared cards are drawn', skeletonBlocks('universal').length > 0);
check(
  'the state notes anchored on them are drawn too',
  skeletonBlocks('state_specific').length > 0,
);
check(
  'each state block says whose it is and where it attaches',
  /(CA|TX) only · after distraction-and-fatigue-slide-\d+/.test(text()),
);
// The border is the whole point: a state-specific block must not read as
// shared content. styled-components emits the rule only when a card is
// actually given the colour.
// styled-components inserts through the CSSOM, so the rules are in the sheet
// rather than in the tag's text.
const styleText = [
  ...[...dom.window.document.querySelectorAll('style')].map(
    node => node.textContent ?? '',
  ),
  ...[...dom.window.document.styleSheets].flatMap(sheet => {
    try {
      return [...sheet.cssRules].map(rule => rule.cssText);
    } catch {
      return [];
    }
  }),
]
  .join('')
  .replace(/\s+/g, '');
check(
  'state-specific blocks carry the yellow border',
  styleText.includes('rgba(217,119,6,.55)') ||
    styleText.includes('rgba(217,119,6,0.55)'),
  styleText.slice(0, 200),
);

// Placeholders read as variables, not as text that happens to be there.
const chips = () => [
  ...dom.window.document.querySelectorAll('[data-param]'),
];
check('parameters render as chips', chips().length > 0);
check(
  'a chip is named after its parameter key',
  chips().some(node => (node.textContent ?? '').trim().length > 0),
);
check(
  'a chip says what each state fills in',
  chips().some(node => /CA:/.test(node.getAttribute('title') ?? '')),
);
check('nothing here offers to edit', !text().includes('Edit lesson'));

// The state module: four lessons per state, all of them state-specific.
const stateLesson = find('span, div', 'Points, Penalties, and Police Stops');
if (stateLesson != null) {
  stateLesson.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true }),
  );
  await settle(600);
}
check(
  'a state lesson is state-specific throughout',
  skeletonBlocks('state_specific').length > 0 &&
    skeletonBlocks('universal').length === 0,
);

await click(button('State course'), 1200);
check('the header switches back to the state course', /STATE\s*CA/.test(text()));

function summarise() {
  summarised = true;
  let failed = 0;
  for (const [name, ok, detail] of checks) {
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
    if (!ok && detail != null) {
      console.log(`      ${String(detail).replace(/\s+/g, ' ').slice(0, 300)}`);
    }
  }
  console.log(`\n${text().length} characters of UI text rendered`);
  if (failed > 0) {
    console.error(`${failed} check(s) failed`);
    if (process.env.UI_DUMP) {
      console.log(text().slice(0, 3000));
    }
    process.exitCode = 1;
  }
}
summarise();
