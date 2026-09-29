import type { BankQuestion, Outline } from '@admin/api/types';
import type { RenderCard } from '@admin/model/renderCard';
import { renderCardsFromLessonDoc } from '@admin/model/renderCard';
import type {
  CourseAssetV2,
  CourseQuestionV2,
  LessonDocV2,
  LessonElementV2,
} from '@/data/course/v2/wire';
import {
  ASSET_EXTENSIONS,
  isBulletsElement,
  isImageElement,
  isParagraphElement,
  recallSegments,
} from '@/data/course/v2/wire';

// One course version as a folder of plain HTML pages, for reading, reviewing
// or handing to someone without the panel: a contents page, then a folder per
// module holding its lessons — every slide the learner swipes through and the
// lesson's test — its module test, and the pictures those pages show. Built
// from the same cards the viewer draws, so the archive reads the way the
// course plays. Pure: the caller fetches the documents and the picture bytes.

export type ArchiveInput = {
  outline: Outline;
  // Every lesson of the outline, by id.
  lessons: ReadonlyMap<string, LessonDocV2>;
  // The version's bank: what a device on it is actually tested with.
  bank: { questions: BankQuestion[]; assets: CourseAssetV2[] };
  draft: boolean;
  generatedAt: Date;
};

export type ArchiveFile =
  | { path: string; kind: 'page'; html: string }
  | { path: string; kind: 'asset'; asset: CourseAssetV2 };

export type CourseArchive = {
  // The single folder everything unpacks into; also the zip's name.
  root: string;
  files: ArchiveFile[];
};

// ---------------------------------------------------------------------------
// Names

// A file name every desktop and every unzip accepts: plain ASCII (macOS's
// command-line unzip ignores the UTF-8 flag and mangles an em dash), no path
// separators or reserved characters, no trailing dot, not absurdly long.
export const safeName = (text: string, fallback: string): string => {
  const cleaned = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―]/g, ' - ')
    .replace(/[‘’‚′]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, '');
  return cleaned.length > 0 ? cleaned : fallback;
};

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0');

// A relative link to a file inside the archive, one encoded segment at a time.
const href = (...segments: string[]): string =>
  segments
    .map(segment => (segment === '..' ? segment : encodeURIComponent(segment)))
    .join('/');

const questionAnchor = (questionId: string): string => `q-${questionId}`;

const MODULE_TEST_FILE = 'Module test.html';
const IMAGES_DIR = 'images';

// ---------------------------------------------------------------------------
// Markup

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Authored text keeps its line breaks.
const textHtml = (text: string): string =>
  escapeHtml(text).replace(/\n/g, '<br />');

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; max-width: 760px; padding: 32px 20px 64px;
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Helvetica, Arial, sans-serif;
    color: #1d1d1f; background: #f5f5f7;
  }
  a { color: #1d4ed8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { font-size: 28px; line-height: 1.2; margin: 8px 0 6px; }
  h2 { font-size: 20px; margin: 36px 0 12px; }
  h3 { font-size: 18px; line-height: 1.3; margin: 4px 0 10px; }
  code { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #86868b; }
  .crumbs { font-size: 13px; color: #6e6e73; }
  .lead { font-size: 17px; color: #3a3a3c; margin: 6px 0 4px; }
  .meta { font-size: 13px; color: #6e6e73; margin: 4px 0; }
  .card {
    background: #fff; border: 1px solid #e5e5ea; border-radius: 14px;
    padding: 18px 20px; margin: 0 0 14px; break-inside: avoid;
  }
  .kicker {
    display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px;
    font-size: 12px; font-weight: 700; letter-spacing: .04em;
    text-transform: uppercase; color: #1d4ed8;
  }
  .kicker .n { color: #aeaeb2; font-weight: 600; }
  .tone-muted .kicker { color: #6e6e73; }
  .tone-trap .kicker { color: #c2410c; }
  .tone-california .kicker { color: #7c3aed; }
  .optional { color: #aeaeb2; font-weight: 600; }
  .card p { margin: 0 0 10px; }
  .card ul { margin: 0 0 10px; padding-left: 22px; }
  figure { margin: 4px 0 12px; }
  figure img {
    display: block; max-width: 100%; height: auto; max-height: 360px;
    margin: 0 auto; border-radius: 10px;
  }
  .ask { font-weight: 600; }
  .context {
    font-size: 12px; font-weight: 700; letter-spacing: .04em;
    text-transform: uppercase; color: #6e6e73;
  }
  .gap { background: #fde68a; padding: 0 3px; border-radius: 4px; }
  ol.choices { list-style: none; padding: 0; margin: 10px 0; }
  ol.choices li {
    display: flex; gap: 10px; padding: 8px 12px; margin-bottom: 6px;
    border: 1px solid #e5e5ea; border-radius: 10px;
  }
  ol.choices li .letter { font-weight: 700; color: #86868b; }
  ol.choices li.correct {
    border-color: #34c759; background: #f0fdf4; font-weight: 600;
  }
  ol.choices li.correct .letter { color: #15803d; }
  .explanation {
    font-size: 15px; color: #3a3a3c; background: #f5f5f7;
    border-radius: 10px; padding: 10px 12px;
  }
  .note { font-size: 13px; color: #6e6e73; font-style: italic; }
  .warning { color: #c2410c; }
  .toc { list-style: none; padding: 0; margin: 0; }
  .toc li { padding: 8px 0; border-bottom: 1px solid #e5e5ea; }
  .toc .num { display: inline-block; min-width: 30px; color: #86868b;
    font-weight: 600; }
  .toc .sub { display: block; margin-left: 30px; font-size: 14px;
    color: #6e6e73; }
  .pager { display: flex; justify-content: space-between; gap: 16px;
    margin-top: 32px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; background: #fff;
    border: 1px solid #e5e5ea; border-radius: 14px; overflow: hidden; }
  th, td { text-align: left; vertical-align: top; padding: 10px 12px;
    border-bottom: 1px solid #e5e5ea; font-size: 15px; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em;
    color: #6e6e73; }
  @media print {
    body { background: #fff; max-width: none; }
    .pager { display: none; }
  }
`;

const page = (title: string, body: string): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Pictures

// Each module folder carries the pictures its pages show, so a module can be
// read — or sent on — without the rest. Files keep the author's asset id;
// two different pictures under one id get the hash to tell them apart.
const createImageShelf = () => {
  const byFolder = new Map<string, Map<string, CourseAssetV2>>();

  const place = (folder: string, asset: CourseAssetV2): string => {
    const shelf = byFolder.get(folder) ?? new Map<string, CourseAssetV2>();
    byFolder.set(folder, shelf);
    const extension = ASSET_EXTENSIONS[asset.mime] ?? 'svg';
    const base = safeName(asset.assetId, asset.sha256.slice(0, 12));
    for (const name of [
      `${base}.${extension}`,
      `${base}-${asset.sha256.slice(0, 8)}.${extension}`,
    ]) {
      const held = shelf.get(name);
      if (held == null || held.sha256 === asset.sha256) {
        shelf.set(name, asset);
        return href(IMAGES_DIR, name);
      }
    }
    const name = `${asset.sha256}.${extension}`;
    shelf.set(name, asset);
    return href(IMAGES_DIR, name);
  };

  const files = (root: string): ArchiveFile[] =>
    [...byFolder].flatMap(([folder, shelf]) =>
      [...shelf].map(
        ([name, asset]): ArchiveFile => ({
          path: `${root}/${folder}/${IMAGES_DIR}/${name}`,
          kind: 'asset',
          asset,
        }),
      ),
    );

  return { place, files };
};

type PlaceImage = (asset: CourseAssetV2) => string;

const figure = (src: string, alt: string): string =>
  `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" /></figure>`;

// ---------------------------------------------------------------------------
// Cards

const LETTERS = 'ABCDEFGHIJ';

const questionBody = (
  question: CourseQuestionV2,
  prompt: string | null,
): string => {
  const choices = question.choices
    .map((choice, index) => {
      const correct = choice.id === question.correctAnswerId;
      return `<li${correct ? ' class="correct"' : ''}><span class="letter">${
        LETTERS[index] ?? choice.id
      }</span><span>${textHtml(choice.text)}${correct ? ' ✓' : ''}</span></li>`;
    })
    .join('');
  return [
    prompt == null ? '' : `<p class="ask">${textHtml(prompt)}</p>`,
    `<ol class="choices">${choices}</ol>`,
    question.explanation.trim().length > 0
      ? `<p class="explanation"><strong>Explanation.</strong> ${textHtml(
          question.explanation,
        )}</p>`
      : '',
  ].join('');
};

const elementsHtml = (
  elements: LessonElementV2[],
  assets: ReadonlyMap<string, CourseAssetV2>,
  placeImage: PlaceImage,
): string =>
  elements
    .map(element => {
      if (isParagraphElement(element)) {
        return element.text.trim().length > 0
          ? `<p>${textHtml(element.text)}</p>`
          : '';
      }
      if (isBulletsElement(element)) {
        const items = element.items.filter(item => item.trim().length > 0);
        return items.length > 0
          ? `<ul>${items
              .map(item => `<li>${textHtml(item)}</li>`)
              .join('')}</ul>`
          : '';
      }
      if (isImageElement(element)) {
        const asset = assets.get(element.assetId);
        return asset == null
          ? `<p class="note warning">Missing picture ${escapeHtml(
              element.assetId,
            )}</p>`
          : figure(placeImage(asset), asset.alt);
      }
      return '';
    })
    .join('');

type CardContext = {
  questions: ReadonlyMap<string, CourseQuestionV2>;
  assets: ReadonlyMap<string, CourseAssetV2>;
  placeImage: PlaceImage;
};

const cardImage = (card: RenderCard, context: CardContext): string => {
  if (card.image == null) {
    return '';
  }
  const asset = context.assets.get(card.image.assetId);
  return asset == null ? '' : figure(context.placeImage(asset), asset.alt);
};

// One slide of the lesson as the learner meets it: the kicker, the picture,
// the text, and any question it asks with its answer shown.
const slideHtml = (
  card: RenderCard,
  index: number,
  context: CardContext,
  anchored: Set<string>,
): string => {
  const question =
    card.refs.questionId != null
      ? context.questions.get(card.refs.questionId)
      : undefined;
  // A question's anchor sits on its first appearance on the page — the
  // test, when the lesson tests it — which is where a module test links.
  let anchor = '';
  if (question != null && !anchored.has(question.questionId)) {
    anchored.add(question.questionId);
    anchor = ` id="${escapeHtml(questionAnchor(question.questionId))}"`;
  }

  let body: string;
  if (card.type === 'check_yourself') {
    const [context = '', rule = ''] = card.bodies;
    body = [
      context.length > 0 ? `<p class="context">${textHtml(context)}</p>` : '',
      `<p>${recallSegments(rule)
        .map(segment =>
          segment.gap
            ? `<span class="gap">${textHtml(segment.text)}</span>`
            : textHtml(segment.text),
        )
        .join('')}</p>`,
      '<p class="note">Highlighted words are hidden until the learner reveals them.</p>',
    ].join('');
  } else if (card.type === 'checkpoint') {
    body = question == null ? '' : questionBody(question, null);
  } else if (card.type === 'quick_challenge') {
    body = [
      card.bodies.map(text => `<p>${textHtml(text)}</p>`).join(''),
      question == null
        ? ''
        : questionBody(question, card.ask ?? question.prompt),
    ].join('');
  } else if (card.type === 'image') {
    body = '';
  } else if (card.elements != null) {
    body = elementsHtml(card.elements, context.assets, context.placeImage);
  } else {
    body = card.bodies.map(text => `<p>${textHtml(text)}</p>`).join('');
  }

  const tone = card.kicker.tone === 'accent' ? '' : ` tone-${card.kicker.tone}`;
  const title =
    card.type === 'image' || card.title.trim().length === 0
      ? ''
      : `<h3>${textHtml(card.title)}</h3>`;
  return `<section class="card${tone}"${anchor}>
<div class="kicker"><span class="n">${index + 1}</span><span>${escapeHtml(
    card.kicker.label,
  )}</span>${
    card.optional && !/optional/i.test(card.kicker.label)
      ? '<span class="optional">· optional</span>'
      : ''
  }</div>
${cardImage(card, context)}${title}${body}
</section>`;
};

// A scored question in full: prompt, picture, choices with the correct one
// marked, and the explanation the learner reads after answering.
const questionCardHtml = (
  question: CourseQuestionV2,
  label: string,
  context: Pick<CardContext, 'assets' | 'placeImage'>,
  anchor: boolean,
): string => {
  const asset =
    question.assetId != null ? context.assets.get(question.assetId) : undefined;
  return `<section class="card"${
    anchor ? ` id="${escapeHtml(questionAnchor(question.questionId))}"` : ''
  }>
<div class="kicker"><span>${escapeHtml(label)}</span></div>
${
  asset == null ? '' : figure(context.placeImage(asset), asset.alt)
}<h3>${textHtml(question.prompt)}</h3>${questionBody(question, null)}
<code>${escapeHtml(question.questionId)}</code>
</section>`;
};

// ---------------------------------------------------------------------------
// The archive

type LessonPlace = {
  lessonId: string;
  number: number;
  title: string;
  moduleIndex: number;
  folder: string;
  file: string;
};

// What a lesson's test and its slides show, taken from the version's bank:
// the bank is what a device is tested with, and the lesson document's own
// copies are an authoring artefact that can lag behind it.
const withBankQuestions = (
  doc: LessonDocV2,
  bankQuestions: ReadonlyMap<string, CourseQuestionV2>,
  bankAssets: ReadonlyMap<string, CourseAssetV2>,
): LessonDocV2 => {
  const questions = doc.questions.map(
    question => bankQuestions.get(question.questionId) ?? question,
  );
  const known = new Set(doc.assets.map(asset => asset.assetId));
  const extra = questions
    .map(question => question.assetId)
    .filter((id): id is string => id != null && !known.has(id))
    .map(id => bankAssets.get(id))
    .filter((asset): asset is CourseAssetV2 => asset != null);
  return { ...doc, questions, assets: [...doc.assets, ...extra] };
};

const withoutLesson = ({
  lessonId: _lessonId,
  ...question
}: BankQuestion): CourseQuestionV2 => question;

export const buildCourseArchive = (input: ArchiveInput): CourseArchive => {
  const { outline, draft } = input;
  const root = safeName(
    `${outline.courseId} v${outline.version}${draft ? ' draft' : ''}`,
    'course',
  );
  const bankQuestions = new Map(
    input.bank.questions.map(question => [
      question.questionId,
      withoutLesson(question),
    ]),
  );
  const lessonOf = new Map(
    input.bank.questions.map(question => [
      question.questionId,
      question.lessonId,
    ]),
  );
  const bankAssets = new Map(
    input.bank.assets.map(asset => [asset.assetId, asset]),
  );
  const shelf = createImageShelf();
  const files: ArchiveFile[] = [];

  const lessonCount = outline.modules.reduce(
    (sum, module) => sum + module.lessons.length,
    0,
  );
  const lessonWidth = Math.max(2, String(lessonCount).length);
  const moduleWidth = Math.max(2, String(outline.modules.length).length);

  // Where every lesson lands, before any page is written: a page links to
  // its neighbours, and a module test to the lessons its questions come from.
  const folders = outline.modules.map((module, index) =>
    safeName(
      `${pad(index + 1, moduleWidth)} ${module.title}`,
      pad(index + 1, moduleWidth),
    ),
  );
  const places: LessonPlace[] = [];
  outline.modules.forEach((module, moduleIndex) => {
    for (const lesson of module.lessons) {
      const number = places.length + 1;
      places.push({
        lessonId: lesson.lessonId,
        number,
        title: lesson.title,
        moduleIndex,
        folder: folders[moduleIndex],
        file: `${safeName(
          `${pad(number, lessonWidth)} ${lesson.title}`,
          pad(number, lessonWidth),
        )}.html`,
      });
    }
  });
  const placeOf = new Map(places.map(place => [place.lessonId, place]));

  const courseLine = `${escapeHtml(outline.title)} · v${escapeHtml(
    outline.version,
  )}${draft ? ' (draft)' : ''}`;
  const crumbs = (moduleIndex: number): string =>
    `<p class="crumbs"><a href="${href(
      '..',
      'index.html',
    )}">${courseLine}</a> › Module ${moduleIndex + 1} · ${escapeHtml(
      outline.modules[moduleIndex].title,
    )}</p>`;

  // Lessons.
  const lessonSummaries = new Map<
    string,
    { objective: string; slides: number; tests: number }
  >();
  places.forEach((place, index) => {
    const raw = input.lessons.get(place.lessonId);
    const placeImage: PlaceImage = asset => shelf.place(place.folder, asset);
    const previous = places[index - 1];
    const next = places[index + 1];
    const link = (target: LessonPlace): string =>
      href('..', target.folder, target.file);
    const lastOfModule = next == null || next.moduleIndex !== place.moduleIndex;
    const pager = `<nav class="pager"><span>${
      previous == null
        ? ''
        : `<a href="${link(previous)}">← ${pad(
            previous.number,
            lessonWidth,
          )} ${escapeHtml(previous.title)}</a>`
    }</span><span>${
      lastOfModule
        ? `<a href="${href(MODULE_TEST_FILE)}">Module ${
            place.moduleIndex + 1
          } test →</a>`
        : `<a href="${link(next)}">${pad(
            next.number,
            lessonWidth,
          )} ${escapeHtml(next.title)} →</a>`
    }</span></nav>`;
    const heading = `${crumbs(place.moduleIndex)}
<h1>Lesson ${pad(place.number, lessonWidth)} · ${escapeHtml(place.title)}</h1>`;

    if (raw == null) {
      files.push({
        path: `${root}/${place.folder}/${place.file}`,
        kind: 'page',
        html: page(
          place.title,
          `${heading}<p class="warning">This lesson's document could not be read.</p>${pager}`,
        ),
      });
      return;
    }

    const doc = withBankQuestions(raw, bankQuestions, bankAssets);
    const rendered = renderCardsFromLessonDoc(
      doc,
      outline.state,
      outline.cardStyles,
    );
    const context: CardContext = {
      questions: new Map(doc.questions.map(q => [q.questionId, q])),
      assets: new Map(doc.assets.map(asset => [asset.assetId, asset])),
      placeImage,
    };
    // The test takes the anchors first, so a module test's link lands on
    // the question as a test question.
    const anchored = new Set(
      rendered.testCards
        .map(card => card.refs.questionId)
        .filter((id): id is string => id != null),
    );
    const slides = rendered.cards
      .map((card, cardIndex) => slideHtml(card, cardIndex, context, anchored))
      .join('\n');
    const tests = rendered.testCards
      .map((card, cardIndex) => {
        const question = context.questions.get(card.refs.questionId ?? '');
        return question == null
          ? ''
          : questionCardHtml(
              question,
              `Test question ${cardIndex + 1}`,
              context,
              true,
            );
      })
      .join('\n');
    lessonSummaries.set(place.lessonId, {
      objective: doc.lesson.objective,
      slides: rendered.cards.length,
      tests: rendered.testCards.length,
    });

    const intro = doc.lesson.intro;
    const introHtml =
      intro == null
        ? ''
        : [
            // Often the objective word for word, which already leads the page.
            intro.summary.trim().length > 0 &&
            intro.summary.trim() !== doc.lesson.objective.trim()
              ? `<p>${textHtml(intro.summary)}</p>`
              : '',
            intro.keyPoints.length > 0
              ? `<ul>${intro.keyPoints
                  .map(point => `<li>${textHtml(point)}</li>`)
                  .join('')}</ul>`
              : '',
          ].join('');
    const minutes =
      intro != null
        ? `Theory ${intro.theoryMinutes} min · test ${intro.testMinutes} min`
        : `${escapeHtml(doc.lesson.estimatedMinutes)} min`;
    const hero =
      doc.lesson.heroAssetId != null
        ? context.assets.get(doc.lesson.heroAssetId)
        : undefined;

    files.push({
      path: `${root}/${place.folder}/${place.file}`,
      kind: 'page',
      html: page(
        `${pad(place.number, lessonWidth)} ${place.title}`,
        `${heading}
<p class="lead">${textHtml(doc.lesson.objective)}</p>
<p class="meta">${minutes} · ${rendered.cards.length} slides · ${
          rendered.testCards.length
        } test questions · <code>${escapeHtml(place.lessonId)}</code></p>
${hero == null ? '' : figure(placeImage(hero), hero.alt)}${introHtml}
<h2>Slides</h2>
${slides}
<h2>Lesson test · ${rendered.testCards.length} questions</h2>
${
  tests.length > 0
    ? tests
    : '<p class="note">This lesson has no test questions.</p>'
}
${pager}`,
      ),
    });
  });

  // Module tests: which questions each one draws, in order, and where each
  // is read in full. A pool question belongs to no lesson, so this is the
  // only page that shows it, and it is shown whole.
  outline.modules.forEach((module, moduleIndex) => {
    const folder = folders[moduleIndex];
    const placeImage: PlaceImage = asset => shelf.place(folder, asset);
    const rows: string[] = [];
    const pool: string[] = [];
    module.moduleTestQuestionIds.forEach((questionId, index) => {
      const question = bankQuestions.get(questionId);
      const owner = lessonOf.get(questionId);
      const place = owner == null ? undefined : placeOf.get(owner);
      let source: string;
      if (question == null) {
        source = '<span class="warning">not in this version’s bank</span>';
      } else if (place != null) {
        source = `<a href="${href(
          '..',
          place.folder,
          place.file,
        )}#${encodeURIComponent(questionAnchor(questionId))}">Lesson ${pad(
          place.number,
          lessonWidth,
        )} · ${escapeHtml(place.title)}</a>`;
      } else {
        source = `<a href="#${encodeURIComponent(
          questionAnchor(questionId),
        )}">Pool question (below)</a>`;
        pool.push(
          questionCardHtml(
            question,
            `Question ${index + 1} · pool`,
            { assets: bankAssets, placeImage },
            true,
          ),
        );
      }
      rows.push(
        `<tr><td>${index + 1}</td><td>${
          question == null ? '' : textHtml(question.prompt)
        }<br /><code>${escapeHtml(
          questionId,
        )}</code></td><td>${source}</td></tr>`,
      );
    });

    const lessonsOfModule = places.filter(
      place => place.moduleIndex === moduleIndex,
    );
    const last = lessonsOfModule[lessonsOfModule.length - 1];
    const nextModule = places.find(place => place.moduleIndex > moduleIndex);
    files.push({
      path: `${root}/${folder}/${MODULE_TEST_FILE}`,
      kind: 'page',
      html: page(
        `Module ${moduleIndex + 1} test · ${module.title}`,
        `${crumbs(moduleIndex)}
<h1>Module ${moduleIndex + 1} test · ${escapeHtml(module.title)}</h1>
<p class="meta">${
          module.moduleTestQuestionIds.length
        } questions, in the order the module names them.</p>
${
  rows.length > 0
    ? `<table><thead><tr><th>#</th><th>Question</th><th>Read it in</th></tr></thead><tbody>${rows.join(
        '',
      )}</tbody></table>`
    : '<p class="note">This module has no test.</p>'
}
${pool.length > 0 ? `<h2>Pool questions</h2>${pool.join('\n')}` : ''}
<nav class="pager"><span>${
          last == null
            ? ''
            : `<a href="${href(last.file)}">← ${pad(
                last.number,
                lessonWidth,
              )} ${escapeHtml(last.title)}</a>`
        }</span><span>${
          nextModule == null
            ? `<a href="${href('..', 'index.html')}">Contents</a>`
            : `<a href="${href(
                '..',
                nextModule.folder,
                nextModule.file,
              )}">${pad(nextModule.number, lessonWidth)} ${escapeHtml(
                nextModule.title,
              )} →</a>`
        }</span></nav>`,
      ),
    });
  });

  // Contents.
  const generated = input.generatedAt.toISOString().slice(0, 10);
  const modulesHtml = outline.modules
    .map((module, moduleIndex) => {
      const lessons = places
        .filter(place => place.moduleIndex === moduleIndex)
        .map(place => {
          const summary = lessonSummaries.get(place.lessonId);
          return `<li><span class="num">${pad(
            place.number,
            lessonWidth,
          )}</span><a href="${href(place.folder, place.file)}">${escapeHtml(
            place.title,
          )}</a>${
            summary == null
              ? ''
              : `<span class="sub">${escapeHtml(summary.objective)} · ${
                  summary.slides
                } slides · ${summary.tests} test questions</span>`
          }</li>`;
        })
        .join('');
      return `<h2>Module ${moduleIndex + 1} · ${escapeHtml(module.title)}</h2>
<ul class="toc">${lessons}<li><span class="num">✓</span><a href="${href(
        folders[moduleIndex],
        MODULE_TEST_FILE,
      )}">Module test</a><span class="sub">${
        module.moduleTestQuestionIds.length
      } questions</span></li></ul>`;
    })
    .join('\n');
  files.unshift({
    path: `${root}/index.html`,
    kind: 'page',
    html: page(
      `${outline.title} v${outline.version}`,
      `<p class="crumbs">${escapeHtml(outline.courseId)} · ${escapeHtml(
        outline.state,
      )}</p>
<h1>${escapeHtml(outline.title)}</h1>
<p class="meta">Version ${escapeHtml(outline.version)}${
        draft ? ' (draft, not released)' : ''
      } · ${outline.modules.length} modules · ${places.length} lessons · ${
        input.bank.questions.length
      } questions in the bank · exported ${generated}</p>
${modulesHtml}`,
    ),
  });

  files.push(...shelf.files(root));
  return { root, files };
};
