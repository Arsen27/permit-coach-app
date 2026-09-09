// One-off: turns every sign's drawn `art` spec into a standalone SVG file.
//
// The app used to draw signs at runtime from a closed vocabulary of art kinds
// and symbols (src/components/SignArt.tsx, now deleted). Artwork is content
// now, so each sign gets its own file and the vocabulary goes away. This
// script exists to make that migration faithful rather than approximate: the
// geometry below is ported from that renderer, so what shipped before is what
// ships after.
//
// Two outputs:
//   server/content/signs/assets/<sha256>.svg  — what the server publishes
//   src/data/signs/seedAssets.ts              — the same markup, bundled, so
//                                               the app still renders offline
//
// Run once with `node scripts/generate-sign-svgs.mjs`. Keeping it in the tree
// documents where the artwork came from; it is not part of any build.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const ASSET_DIR = path.join(ROOT, 'server/content/signs/assets');
const SEED_MODULE = path.join(ROOT, 'src/data/signs/seedAssets.ts');
const SIGNS_JSON = path.join(ROOT, 'src/data/signs/signsData.json');

// Fixed MUTCD semantics, copied from src/theme/index.ts.
const C = {
  regulatory: '#C8102E',
  warning: '#FFB915',
  guide: '#003F87',
  highway: '#00693C',
  workzone: '#E67817',
  school: '#C9D64F',
  ink: '#1A1A1C',
  white: '#ffffff',
};

const FONT = 'Helvetica, Arial, sans-serif';

const esc = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// SignArt centred its text with `textAlign: center` inside a flex box; in SVG
// that is text-anchor plus a dominant-baseline, with y measured from the
// middle of the line rather than its baseline.
const text = (body, { x = 50, y, size, fill, weight = 800, maxChars }) => {
  const value = String(body);
  const chars = maxChars ?? Infinity;
  // The renderer let long labels wrap inside a maxWidth; approximate that by
  // splitting on words once a line grows past what fits.
  const words = value.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (candidate.length > chars && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);

  const lineHeight = size * 1.12;
  const top = y - ((lines.length - 1) * lineHeight) / 2;
  return lines
    .map(
      (entry, index) =>
        `<text x="${x}" y="${(top + index * lineHeight).toFixed(2)}" ` +
        `font-family="${FONT}" font-size="${size}" font-weight="${weight}" ` +
        `letter-spacing="0.5" fill="${fill}" text-anchor="middle" ` +
        `dominant-baseline="central">${esc(entry)}</text>`,
    )
    .join('');
};

// ---------------------------------------------------------------------------
// Symbols
//
// Stroke symbols are pure path data in the original and port verbatim.

const STROKES = {
  arrowUp: { d: 'M50 84 V26', heads: [[50, 20, 0]] },
  arrowLeft: { d: 'M80 50 H26', heads: [[20, 50, 270]] },
  arrowRight: { d: 'M20 50 H74', heads: [[80, 50, 90]] },
  turnLeft: { d: 'M62 84 V56 Q62 44 50 44 H34', heads: [[28, 44, 270]] },
  turnRight: { d: 'M38 84 V56 Q38 44 50 44 H66', heads: [[72, 44, 90]] },
  curveLeft: { d: 'M60 84 C60 62 40 62 40 42 V30', heads: [[40, 24, 0]] },
  curveRight: { d: 'M40 84 C40 62 60 62 60 42 V30', heads: [[60, 24, 0]] },
  winding: {
    d: 'M54 86 C54 74 42 74 42 62 C42 50 58 52 58 40 C58 30 50 32 50 24',
    heads: [[50, 18, 0]],
  },
  crossroad: { d: 'M50 86 V14 M20 50 H80', width: 12 },
  sideRoad: { d: 'M50 86 V14 M50 50 H82', width: 12 },
  tIntersection: { d: 'M50 86 V50 M18 50 H82', width: 12 },
  fork: {
    d: 'M50 88 V62 M50 62 C50 46 36 50 36 28 M50 62 C50 46 64 50 64 28',
    heads: [
      [36, 22, 0],
      [64, 22, 0],
    ],
  },
  merge: {
    d: 'M36 86 C36 60 48 62 50 30 M64 86 C64 60 52 62 50 30',
    heads: [[50, 24, 0]],
  },
  laneEnds: { d: 'M62 86 V16 M36 86 C36 60 58 62 60 40', width: 9 },
  divided: {
    d: 'M36 86 C36 60 30 52 30 36 M64 86 C64 60 70 52 70 36',
    width: 9,
  },
  twoWay: {
    d: 'M36 86 V26 M64 86 V26',
    heads: [
      [36, 20, 0],
      [64, 20, 0],
    ],
    width: 9,
  },
  uturn: { d: 'M36 86 V50 Q36 30 56 30 Q74 30 74 50 V64', heads: [[74, 70, 180]] },
  hill: { d: 'M14 80 L50 26 L86 80', width: 10 },
  bump: { d: 'M16 74 Q50 26 84 74', width: 10 },
  dip: { d: 'M16 34 Q50 84 84 34', width: 10 },
  narrowBridge: { d: 'M30 86 V14 M70 86 V14 M30 44 H70', width: 9 },
  softShoulder: { d: 'M40 86 V14 M62 86 C62 58 70 46 78 38', width: 9 },
  slippery: {
    d: 'M40 88 C40 66 28 60 34 44 C38 32 52 34 56 22',
    heads: [[58, 16, 0]],
  },
  roundabout: { d: 'M50 88 V64', heads: [[50, 20, 0]] },
};

// The remaining symbols are drawn from primitives; ported one for one from the
// renderer's JSX.
const GLYPHS = {
  signal: ink =>
    `<rect x="35" y="16" width="30" height="68" rx="9" fill="${ink}"/>` +
    `<circle cx="50" cy="31" r="7.5" fill="#E53935"/>` +
    `<circle cx="50" cy="50" r="7.5" fill="#FDD835"/>` +
    `<circle cx="50" cy="69" r="7.5" fill="#43A047"/>`,
  stopAhead: ink =>
    `<polygon points="41,14 59,14 72,27 72,45 59,58 41,58 28,45 28,27" fill="${C.regulatory}"/>` +
    `<line x1="50" y1="60" x2="50" y2="88" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`,
  yieldAhead: ink =>
    `<polygon points="29,14 71,14 50,52" fill="${C.regulatory}"/>` +
    `<line x1="50" y1="58" x2="50" y2="88" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>`,
  pedestrian: ink =>
    `<circle cx="50" cy="21" r="8" fill="${ink}"/>` +
    `<path d="M50 32 L50 58 M50 40 L35 50 M50 40 L63 52 M50 58 L37 84 M50 58 L60 84" ` +
    `stroke="${ink}" stroke-width="8" stroke-linecap="round" fill="none"/>`,
  bicycle: ink =>
    `<circle cx="29" cy="66" r="14" stroke="${ink}" stroke-width="6" fill="none"/>` +
    `<circle cx="71" cy="66" r="14" stroke="${ink}" stroke-width="6" fill="none"/>` +
    `<path d="M29 66 L44 42 H60 L71 66 M44 42 L55 66 M60 42 L53 30 H64" ` +
    `stroke="${ink}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  deer: ink =>
    `<path d="M18 76 Q26 54 42 56 L58 56 Q64 46 72 42 L78 44 Q86 48 84 58 L74 60 L70 76 L63 76 L65 62 L46 62 L42 76 Z" fill="${ink}"/>` +
    `<path d="M74 42 L68 26 M74 42 L82 26" stroke="${ink}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  truck: ink =>
    `<rect x="12" y="40" width="46" height="30" rx="4" fill="${ink}"/>` +
    `<path d="M58 48 H74 L86 60 V70 H58 Z" fill="${ink}"/>` +
    `<circle cx="30" cy="76" r="9" fill="${ink}"/>` +
    `<circle cx="74" cy="76" r="9" fill="${ink}"/>`,
  workers: ink =>
    `<circle cx="50" cy="20" r="8" fill="${ink}"/>` +
    `<path d="M34 30 H66" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M50 30 L50 58 M50 38 L30 52 M50 38 L70 52 M50 58 L36 86 M50 58 L64 86" ` +
    `stroke="${ink}" stroke-width="8" stroke-linecap="round" fill="none"/>`,
  flagger: ink =>
    `<circle cx="42" cy="20" r="8" fill="${ink}"/>` +
    `<path d="M42 30 L42 58 M42 38 L24 50 M42 38 L66 30 M42 58 L30 86 M42 58 L54 86" ` +
    `stroke="${ink}" stroke-width="8" stroke-linecap="round" fill="none"/>` +
    `<rect x="64" y="18" width="22" height="16" fill="${C.regulatory}"/>`,
  gas: ink =>
    `<rect x="24" y="24" width="34" height="56" rx="5" fill="${ink}"/>` +
    `<path d="M62 40 H72 V66 Q72 74 66 74" stroke="${ink}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<rect x="31" y="32" width="20" height="14" rx="2" fill="${C.white}"/>`,
  roundaboutRing: ink =>
    `<circle cx="50" cy="46" r="20" stroke="${ink}" stroke-width="8" fill="none"/>`,
};

const arrowHead = ([x, y, angle], ink) =>
  `<polygon points="0,-11 9,7 -9,7" fill="${ink}" transform="translate(${x}, ${y}) rotate(${angle})"/>`;

// A symbol drawn into its own 100-unit space, then scaled and centred into the
// parent sign the way SignArt nested one <Svg> inside its box.
const symbolMarkup = (symbol, ink = C.ink) => {
  const parts = [];
  const stroke = STROKES[symbol];
  if (stroke != null) {
    parts.push(
      `<path d="${stroke.d}" stroke="${ink}" stroke-width="${stroke.width ?? 8}" ` +
        `stroke-linecap="round" fill="none"/>`,
    );
    for (const head of stroke.heads ?? []) {
      parts.push(arrowHead(head, ink));
    }
  }
  if (symbol === 'roundabout') {
    parts.push(GLYPHS.roundaboutRing(ink));
  }
  const glyph = GLYPHS[symbol];
  if (glyph != null && symbol !== 'roundaboutRing') {
    parts.push(glyph(ink));
  }
  if (parts.length === 0) {
    throw new Error(`no artwork for symbol ${symbol}`);
  }
  return parts.join('');
};

// Places a symbol's 100-unit drawing at `size` units, centred on (cx, cy).
const placedSymbol = (symbol, size, cx = 50, cy = 50, ink = C.ink) => {
  const scale = size / 100;
  const x = cx - size / 2;
  const y = cy - size / 2;
  return `<g transform="translate(${x.toFixed(2)}, ${y.toFixed(
    2,
  )}) scale(${scale.toFixed(4)})">${symbolMarkup(symbol, ink)}</g>`;
};

// ---------------------------------------------------------------------------
// Art kinds
//
// Each returns the inner markup of a 100x100 viewBox. Geometry and type sizes
// are the renderer's, with its `s * f` factors read as f * 100.

const OCTAGON = '30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30';

const stackedLines = (lines, { top, size, fill, gap = 1.12 }) =>
  lines
    .map((line, index) =>
      text(line, {
        y: top + index * size * gap,
        size,
        fill,
        maxChars: 14,
      }),
    )
    .join('');

const KINDS = {
  octagon: art =>
    `<polygon points="${OCTAGON}" fill="${C.regulatory}"/>` +
    text(art.label, { y: 50, size: 20, fill: C.white }),

  yield: () =>
    `<polygon points="50,100 0,0 100,0" fill="${C.regulatory}"/>` +
    text('YIELD', { y: 26, size: 14.5, fill: C.white }),

  doNotEnter: () =>
    `<circle cx="50" cy="50" r="50" fill="${C.regulatory}"/>` +
    `<rect x="23" y="43.75" width="54" height="12.5" rx="2" fill="${C.white}"/>`,

  // A white plate with a heavy dark border; 77 units wide, centred.
  whiteRect: art => {
    const parts = [
      `<rect x="11.5" y="2.4" width="77" height="95.2" rx="9.6" fill="${C.white}" ` +
        `stroke="${C.ink}" stroke-width="4.8"/>`,
    ];
    const rows = [];
    if (art.lines != null) rows.push({ kind: 'lines', value: art.lines });
    if (art.big != null) rows.push({ kind: 'big', value: art.big });
    if (art.symbol != null) rows.push({ kind: 'symbol', value: art.symbol });
    // The renderer stacked whatever was present in a centred column.
    const heights = rows.map(row =>
      row.kind === 'lines'
        ? row.value.length * 10.75
        : row.kind === 'big'
          ? 27
          : 52,
    );
    const total = heights.reduce((sum, height) => sum + height, 0);
    let cursor = 50 - total / 2;
    rows.forEach((row, index) => {
      const height = heights[index];
      const centre = cursor + height / 2;
      if (row.kind === 'lines') {
        parts.push(
          stackedLines(row.value, {
            top: centre - ((row.value.length - 1) * 10.75) / 2,
            size: 9.6,
            fill: C.ink,
          }),
        );
      } else if (row.kind === 'big') {
        parts.push(text(row.value, { y: centre, size: 27, fill: C.ink }));
      } else {
        parts.push(placedSymbol(row.value, 52, 50, centre));
      }
      cursor += height;
    });
    if (art.slash === true) {
      parts.push(
        `<rect x="10" y="46.65" width="80" height="6.7" rx="3.35" ` +
          `fill="${C.regulatory}" transform="rotate(-45 50 50)"/>`,
      );
    }
    return parts.join('');
  },

  redRing: art =>
    `<circle cx="50" cy="50" r="46.65" fill="${C.white}" stroke="${C.regulatory}" stroke-width="6.7"/>` +
    placedSymbol(art.symbol, 56) +
    `<rect x="9" y="46.65" width="82" height="6.7" rx="3.35" ` +
    `fill="${C.regulatory}" transform="rotate(-45 50 50)"/>`,

  yellowDiamond: art => diamond(art, C.warning),
  orangeDiamond: art => diamond(art, C.workzone),

  orangeRect: art =>
    `<rect x="1" y="23.5" width="98" height="55" rx="6" fill="${C.workzone}" ` +
    `stroke="${C.ink}" stroke-width="2"/>` +
    stackedLines(art.lines, {
      top: 50 - ((art.lines.length - 1) * 12.88) / 2,
      size: 11.5,
      fill: C.ink,
    }),

  blueRect: art =>
    `<rect x="7.5" y="7.5" width="85" height="85" rx="8" fill="${C.guide}"/>` +
    (art.big != null
      ? text(art.big, { y: 50, size: 42, fill: C.white })
      : text(art.label.toUpperCase(), {
          y: 50,
          size: 11.5,
          fill: C.white,
          maxChars: 11,
        })),

  greenRect: art => greenPanel(art, false),
  greenExit: art => greenPanel(art, true),

  shield: art =>
    `<path d="M50 4 C62 12 80 14 94 12 C96 40 88 74 50 96 C12 74 4 40 6 12 C20 14 38 12 50 4 Z" ` +
    `fill="${C.guide}" stroke="${C.white}" stroke-width="3"/>` +
    `<path d="M50 4 C62 12 80 14 94 12 C94.4 16.5 94.4 21 94 25 L6 25 C5.6 21 5.6 16.5 6 12 C20 14 38 12 50 4 Z" ` +
    `fill="${C.regulatory}"/>` +
    text(art.label, { y: 62, size: 30, fill: C.white }),

  pentagon: () =>
    `<polygon points="50,2 98,40 89,98 11,98 2,40" fill="${C.school}" ` +
    `stroke="${C.ink}" stroke-width="2.5"/>` +
    placedSymbol('pedestrian', 50, 50, 62),

  yellowCircle: () =>
    `<circle cx="50" cy="50" r="49" fill="${C.warning}" stroke="${C.ink}" stroke-width="2"/>` +
    `<path d="M32 32 L68 68 M68 32 L32 68" stroke="${C.ink}" stroke-width="7" ` +
    `stroke-linecap="round" fill="none"/>` +
    `<text x="17" y="58" font-family="${FONT}" font-size="22" font-weight="800" ` +
    `fill="${C.ink}" text-anchor="middle">R</text>` +
    `<text x="83" y="58" font-family="${FONT}" font-size="22" font-weight="800" ` +
    `fill="${C.ink}" text-anchor="middle">R</text>`,

  pennant: art =>
    `<polygon points="2,18 98,50 2,82" fill="${C.warning}" stroke="${C.ink}" stroke-width="2.5"/>` +
    text(art.label.toUpperCase(), {
      x: 31,
      y: 50,
      size: 8.5,
      fill: C.ink,
      maxChars: 12,
    }),
};

// A rotated square with a dark keyline, plus a symbol or a label.
function diamond(art, fill) {
  const parts = [
    `<rect x="14" y="14" width="72" height="72" rx="8" fill="${fill}" ` +
      `stroke="${C.ink}" stroke-width="2" transform="rotate(45 50 50)"/>`,
  ];
  if (art.symbol != null) {
    parts.push(placedSymbol(art.symbol, 52));
  } else if (art.label != null) {
    parts.push(
      text(art.label.toUpperCase(), {
        y: 50,
        size: 10.5,
        fill: C.ink,
        maxChars: 10,
      }),
    );
  }
  return parts.join('');
}

// Green guide panel; the exit variant carries an EXIT kicker above its lines.
function greenPanel(art, isExit) {
  const lines = isExit ? ['EXIT', ...art.lines] : art.lines;
  const sizes = isExit ? [9, ...art.lines.map(() => 10.5)] : lines.map(() => 10.5);
  const gap = 1.25;
  const totalHeight = sizes.reduce((sum, size) => sum + size * gap, 0);
  let cursor = 50 - totalHeight / 2 + (sizes[0] * gap) / 2;
  const rows = lines
    .map((line, index) => {
      const markup = text(line, {
        y: cursor,
        size: sizes[index],
        fill: C.white,
        maxChars: 16,
      });
      cursor += sizes[index] * gap;
      return markup;
    })
    .join('');
  return (
    `<rect x="1" y="21" width="98" height="60" rx="6" fill="${C.highway}" ` +
    `stroke="${C.white}" stroke-width="2"/>` +
    rows
  );
}

// ---------------------------------------------------------------------------

const render = art => {
  const emit = KINDS[art.kind];
  if (emit == null) {
    throw new Error(`no emitter for art kind ${art.kind}`);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ` +
    `width="100" height="100">${emit(art)}</svg>\n`
  );
};

const UNSAFE = [
  [/<script/i, '<script>'],
  [/<foreignObject/i, '<foreignObject>'],
  [/\son\w+\s*=/i, 'inline event handler'],
  [/javascript:/i, 'javascript: URI'],
  [/(?:href|src)\s*=\s*["']https?:/i, 'external reference'],
  [/<image[\s>]/i, '<image>'],
];

const doc = JSON.parse(readFileSync(SIGNS_JSON, 'utf8'));

rmSync(ASSET_DIR, { recursive: true, force: true });
mkdirSync(ASSET_DIR, { recursive: true });

const byKind = {};
const map = {};
const bundle = {};

for (const sign of doc.signs) {
  const art = sign.art;
  if (art == null) {
    throw new Error(`${sign.id} has no art to convert`);
  }
  const svg = render(art);
  for (const [pattern, label] of UNSAFE) {
    if (pattern.test(svg)) {
      throw new Error(`${sign.id}: generated SVG contains ${label}`);
    }
  }
  const bytes = Buffer.from(svg, 'utf8');
  const assetId = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(path.join(ASSET_DIR, `${assetId}.svg`), bytes);
  map[sign.id] = { assetId, sizeBytes: bytes.byteLength };
  bundle[assetId] = svg;
  byKind[art.kind] = (byKind[art.kind] ?? 0) + 1;
}

writeFileSync(
  SEED_MODULE,
  `// GENERATED by scripts/generate-sign-svgs.mjs — do not edit by hand.\n` +
    `//\n` +
    `// The bundled catalogue's artwork, inlined so a fresh install renders every\n` +
    `// sign with no network. Anything published later is fetched from the server\n` +
    `// and is not in here; SignImage checks this map first and falls back to the\n` +
    `// asset URL.\n\n` +
    `export const SEED_SIGN_SVGS: Record<string, string> = ${JSON.stringify(
      bundle,
      null,
      2,
    )};\n`,
  'utf8',
);

writeFileSync('/tmp/sign-svg-map.json', JSON.stringify(map, null, 2));

const totalBytes = Object.values(bundle).reduce(
  (sum, svg) => sum + Buffer.byteLength(svg, 'utf8'),
  0,
);
console.log(`generated ${Object.keys(map).length} SVGs into ${ASSET_DIR}`);
console.log(`bundled ${(totalBytes / 1024).toFixed(1)}KB into seedAssets.ts`);
console.table(byKind);
