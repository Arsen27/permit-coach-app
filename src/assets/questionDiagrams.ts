// Schematic diagrams for the authored practice questions.
//
// The course packages ship a rendered illustration per question, but the
// hand-authored practice bank (data/practiceQuestions.json) and the legacy
// right-of-way bank (data/curriculum) never had any — one question even reads
// "The blue car wants to turn left", which is unanswerable without a picture.
//
// These are deliberately flat, top-down schematics rather than the course's
// perspective scenes: for right-of-way and curb rules, a plan view is the
// clearer teaching image, and it stays legible at the small size the quiz
// card renders it. Only questions a picture genuinely informs get one —
// purely numeric or legal answers (BAC limits, record retention, points) are
// left without, since a decorative image there is noise.

const W = 1200;
const H = 675;

const BG = '#EFEFF1';
const ASPHALT = '#4A4E57';
const ASPHALT_DARK = '#3C4048';
const PAINT = '#F2F4F7';
const PAINT_YELLOW = '#E8C33F';
const VERGE = '#DCDFE4';
const INK = '#2A2D33';
const MUTED = '#6E747E';

const CAR_BLUE = '#3B82F6';
const CAR_GREY = '#8C8F96';
const CAR_RED = '#C8102E';

const SIGN_RED = '#C8102E';
const SIGN_YELLOW = '#FFB915';
const SIGN_GREEN = '#00693C';
const SIGN_BLUE = '#003F87';

// ---------------------------------------------------------------------------
// Shared vocabulary

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<rect width="${W}" height="${H}" fill="${BG}"/>${body}</svg>`;

const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  rx = 0,
): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;

const text = (
  x: number,
  y: number,
  value: string,
  size = 34,
  fill = INK,
  anchor = 'middle',
  weight = '700',
): string =>
  `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;

// Dashed lane paint, horizontal or vertical.
const dashes = (
  from: number,
  to: number,
  fixed: number,
  vertical: boolean,
  colour = PAINT,
  thickness = 8,
  dash = 46,
  gap = 40,
): string => {
  let out = '';
  for (let at = from; at < to; at += dash + gap) {
    const length = Math.min(dash, to - at);
    out += vertical
      ? rect(fixed - thickness / 2, at, thickness, length, colour, 4)
      : rect(at, fixed - thickness / 2, length, thickness, colour, 4);
  }
  return out;
};

type Heading = 'up' | 'down' | 'left' | 'right';

// Top-down car: a rounded body with a lighter cabin toward the front, so the
// direction of travel reads without an arrow.
const car = (
  cx: number,
  cy: number,
  heading: Heading,
  colour: string,
): string => {
  const long = 118;
  const wide = 62;
  const vertical = heading === 'up' || heading === 'down';
  const w = vertical ? wide : long;
  const h = vertical ? long : wide;
  const body = rect(cx - w / 2, cy - h / 2, w, h, colour, 16);

  // Cabin sits 22% of the length toward the front.
  const shift = long * 0.16;
  const front = {
    up: [cx, cy - shift],
    down: [cx, cy + shift],
    left: [cx - shift, cy],
    right: [cx + shift, cy],
  }[heading];
  const cw = vertical ? wide - 22 : long * 0.34;
  const ch = vertical ? long * 0.34 : wide - 22;
  const cabin = rect(
    front[0] - cw / 2,
    front[1] - ch / 2,
    cw,
    ch,
    'rgba(255,255,255,0.65)',
    8,
  );
  return body + cabin;
};

const arrow = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  colour = INK,
  thickness = 9,
): string => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const head = 26;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const px = -uy * head * 0.6;
  const py = ux * head * 0.6;
  return (
    `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${colour}" stroke-width="${thickness}" stroke-linecap="round"/>` +
    `<polygon points="${x2},${y2} ${bx + px},${by + py} ${bx - px},${
      by - py
    }" fill="${colour}"/>`
  );
};

const octagon = (cx: number, cy: number, r: number): string => {
  const points = Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI / 4) * i + Math.PI / 8;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
  return `<polygon points="${points}" fill="${SIGN_RED}"/>`;
};

const stopSign = (cx: number, cy: number, r = 44): string =>
  octagon(cx, cy, r) + text(cx, cy + r * 0.28, 'STOP', r * 0.52, '#FFFFFF');

const yieldSign = (cx: number, cy: number, r = 52): string =>
  `<polygon points="${cx},${cy + r} ${cx - r},${cy - r * 0.7} ${cx + r},${
    cy - r * 0.7
  }" fill="#FFFFFF" stroke="${SIGN_RED}" stroke-width="14" stroke-linejoin="round"/>`;

// White regulatory speed plate on a post.
const speedSign = (cx: number, cy: number, limit: string): string =>
  rect(cx - 52, cy - 66, 104, 132, '#FFFFFF', 8) +
  `<rect x="${cx - 52}" y="${
    cy - 66
  }" width="104" height="132" rx="8" fill="none" stroke="${INK}" stroke-width="7"/>` +
  text(cx, cy - 18, 'SPEED', 20, INK) +
  text(cx, cy + 4, 'LIMIT', 20, INK) +
  text(cx, cy + 52, limit, 46, INK);

// A kerb strip with its painted colour, under a stretch of pavement.
const paintedCurb = (colour: string, label: string, note: string): string =>
  svg(
    rect(0, 0, W, 300, VERGE) +
      rect(0, 300, W, 40, colour) +
      rect(0, 340, W, H - 340, ASPHALT) +
      dashes(60, W - 60, 520, false, PAINT, 10, 70, 50) +
      text(W / 2, 190, 'PAVEMENT', 30, MUTED) +
      text(W / 2, 430, label, 54, PAINT) +
      text(W / 2, 490, note, 32, '#C9CDD4'),
  );

// ---------------------------------------------------------------------------
// Intersection scaffolding, shared by the right-of-way diagrams

const CX = W / 2;
const CY = H / 2 - 20;
const ROAD = 240;

const crossroads = (): string =>
  rect(0, CY - ROAD / 2, W, ROAD, ASPHALT) +
  rect(CX - ROAD / 2, 0, ROAD, H, ASPHALT) +
  // Lane centre lines stop short of the box.
  dashes(40, CX - ROAD / 2 - 30, CY, false, PAINT_YELLOW) +
  dashes(CX + ROAD / 2 + 30, W - 40, CY, false, PAINT_YELLOW) +
  dashes(30, CY - ROAD / 2 - 30, CX, true, PAINT_YELLOW) +
  dashes(CY + ROAD / 2 + 30, H - 30, CX, true, PAINT_YELLOW);

const tJunction = (): string =>
  rect(0, CY - ROAD / 2, W, ROAD, ASPHALT) +
  rect(CX - ROAD / 2, CY - ROAD / 2, ROAD, H - (CY - ROAD / 2), ASPHALT) +
  dashes(40, CX - ROAD / 2 - 30, CY, false, PAINT_YELLOW) +
  dashes(CX + ROAD / 2 + 30, W - 40, CY, false, PAINT_YELLOW) +
  dashes(CY + ROAD / 2 + 30, H - 30, CX, true, PAINT_YELLOW);

// "You" is always the blue car, and always on the roadway — so its label is
// light. Anything else written over asphalt uses `onRoad` for the same
// reason; dark ink on dark asphalt is what the first draft got wrong.
const youLabel = (x: number, y: number): string => text(x, y, 'YOU', 26, PAINT);

const onRoad = (x: number, y: number, value: string, size = 30): string =>
  text(x, y, value, size, PAINT);

// ---------------------------------------------------------------------------
// Diagrams

export const questionDiagrams: Record<string, { xml: string; alt: string }> = {
  // --- Right of way -------------------------------------------------------
  'row-1': {
    alt: 'Top-down four-way stop: your car arrives from the south at the same moment as a car on your right, coming from the east.',
    xml: svg(
      crossroads() +
        stopSign(CX - ROAD / 2 - 70, CY + ROAD / 2 + 70) +
        stopSign(CX + ROAD / 2 + 70, CY - ROAD / 2 - 70) +
        stopSign(CX - ROAD / 2 - 70, CY - ROAD / 2 - 70) +
        stopSign(CX + ROAD / 2 + 70, CY + ROAD / 2 + 70) +
        car(CX - 58, CY + 200, 'up', CAR_BLUE) +
        youLabel(CX - 58, CY + 296) +
        car(CX + 210, CY - 58, 'left', CAR_GREY) +
        arrow(CX + 300, CY - 150, CX + 210, CY - 110, INK, 7) +
        text(CX + 390, CY - 190, 'on your right', 28, INK),
    ),
  },
  'row-2': {
    alt: 'Top-down uncontrolled crossing with no signs: another car is already entering the box from the left while you are still approaching from the south.',
    xml: svg(
      crossroads() +
        car(CX - 58, CY + 240, 'up', CAR_BLUE) +
        youLabel(CX - 58, CY + 336) +
        car(CX - 150, CY + 58, 'right', CAR_GREY) +
        text(CX - 150, CY + 150, 'arrived first', 28, INK) +
        text(250, 60, 'no signs, no signals', 30, INK),
    ),
  },
  'row-3': {
    alt: 'Top-down intersection: a blue car waits to turn left across the path of a grey car coming straight from the opposite direction.',
    xml: svg(
      crossroads() +
        car(CX - 58, CY + 190, 'up', CAR_BLUE) +
        onRoad(CX - 58, CY + 286, 'blue car', 28) +
        arrow(CX - 58, CY + 120, CX - 190, CY - 58, CAR_BLUE, 9) +
        car(CX + 58, CY - 210, 'down', CAR_GREY) +
        arrow(CX + 58, CY - 130, CX + 58, CY + 60, INK, 7) +
        onRoad(CX + 58, CY - 258, 'oncoming', 28),
    ),
  },
  'row-4': {
    alt: 'Top-down view of a yield sign on your approach, with cross traffic already moving through the intersection.',
    xml: svg(
      crossroads() +
        yieldSign(CX - ROAD / 2 - 80, CY + ROAD / 2 + 80) +
        car(CX - 58, CY + 210, 'up', CAR_BLUE) +
        youLabel(CX - 58, CY + 306) +
        car(CX - 190, CY + 58, 'right', CAR_GREY) +
        car(CX + 250, CY - 58, 'left', CAR_GREY) +
        text(250, 60, 'cross traffic', 30, INK),
    ),
  },
  'row-5': {
    alt: 'Top-down view of a stop sign at an empty intersection, with a solid white limit line across your lane.',
    xml: svg(
      crossroads() +
        rect(CX - ROAD / 2 + 10, CY + ROAD / 2 + 6, ROAD / 2 - 16, 14, PAINT) +
        stopSign(CX - ROAD / 2 - 80, CY + ROAD / 2 + 80) +
        car(CX - 58, CY + 240, 'up', CAR_BLUE) +
        youLabel(CX - 58, CY + 336) +
        text(CX + 250, CY + 250, 'limit line', 28, INK) +
        arrow(CX + 190, CY + 235, CX + 40, CY + ROAD / 2 + 16, INK, 6),
    ),
  },
  'row-6': {
    alt: 'Top-down corner with no painted crosswalk: a pedestrian has stepped off the kerb into the unmarked crossing as your car approaches.',
    xml: svg(
      crossroads() +
        car(CX - 58, CY + 250, 'up', CAR_BLUE) +
        youLabel(CX - 58, CY + 346) +
        // Pedestrian: head plus body, mid-crossing.
        `<circle cx="${CX - 20}" cy="${
          CY + ROAD / 2 - 40
        }" r="20" fill="${INK}"/>` +
        rect(CX - 32, CY + ROAD / 2 - 14, 24, 54, INK, 12) +
        arrow(CX - 60, CY + ROAD / 2 - 4, CX + 90, CY + ROAD / 2 - 4, INK, 7) +
        onRoad(CX + 250, CY + ROAD / 2 - 4, 'unmarked crossing', 28) +
        text(260, 60, 'no painted lines', 30, INK),
    ),
  },
  'row-7': {
    alt: 'Top-down two-lane road: an emergency vehicle with lights on comes up behind you while you pull over to the right kerb.',
    xml: svg(
      rect(0, 120, W, 440, ASPHALT) +
        rect(0, 100, W, 20, VERGE) +
        rect(0, 560, W, 20, VERGE) +
        dashes(40, W - 40, 340, false, PAINT_YELLOW) +
        car(760, 250, 'right', CAR_BLUE) +
        youLabel(760, 186) +
        arrow(760, 300, 900, 470, CAR_BLUE, 8) +
        car(330, 250, 'right', CAR_RED) +
        `<circle cx="290" cy="215" r="16" fill="#E53935"/>` +
        `<circle cx="290" cy="285" r="16" fill="#1E88E5"/>` +
        onRoad(330, 176, 'emergency vehicle', 28) +
        text(950, 625, 'pull right and stop', 28, INK),
    ),
  },
  'row-8': {
    alt: 'Top-down T-junction: your road ends at a through road that carries traffic across in front of you.',
    xml: svg(
      tJunction() +
        car(CX - 58, CY + 230, 'up', CAR_BLUE) +
        youLabel(CX - 58, CY + 326) +
        text(CX + 200, CY + 300, 'your road ends', 28, INK) +
        car(180, CY + 58, 'right', CAR_GREY) +
        car(W - 180, CY - 58, 'left', CAR_GREY) +
        text(250, 90, 'through road', 30, INK),
    ),
  },

  // --- Parking and stopping ----------------------------------------------
  'ps-1': {
    alt: 'A kerb painted red running the length of the street.',
    xml: paintedCurb(SIGN_RED, 'RED KERB', 'no stopping, standing or parking'),
  },
  'ps-2': {
    alt: 'A kerb painted white with a car briefly stopped beside it to let a passenger out.',
    xml: paintedCurb(
      '#FFFFFF',
      'WHITE KERB',
      'picking up or dropping off only',
    ),
  },
  'ps-3': {
    alt: 'A fire hydrant on the pavement with a measured gap marked along the kerb on both sides.',
    xml: svg(
      rect(0, 0, W, 300, VERGE) +
        rect(0, 300, W, 26, '#C9CDD4') +
        rect(0, 326, W, H - 326, ASPHALT) +
        // Hydrant
        rect(CX - 22, 190, 44, 100, SIGN_RED, 10) +
        rect(CX - 46, 214, 92, 22, SIGN_RED, 8) +
        `<circle cx="${CX}" cy="182" r="26" fill="${SIGN_RED}"/>` +
        // Measured span
        arrow(CX - 40, 380, CX - 330, 380, INK, 7) +
        arrow(CX + 40, 380, CX + 330, 380, INK, 7) +
        text(CX, 452, 'keep this space clear', 34, PAINT) +
        text(CX - 190, 350, '?', 40, PAINT) +
        text(CX + 190, 350, '?', 40, PAINT) +
        car(880, 540, 'right', CAR_GREY),
    ),
  },
  'ps-4': {
    alt: 'A kerb painted blue next to a parking space marked with the international symbol of access.',
    xml: paintedCurb(SIGN_BLUE, 'BLUE KERB', 'disabled permit or plates only'),
  },
  'ps-5': {
    alt: 'Side view of a car parked facing downhill, its front wheels turned in toward the kerb so it would roll into it.',
    xml: svg(
      // Slope
      `<polygon points="0,240 ${W},430 ${W},${H} 0,${H}" fill="${ASPHALT}"/>` +
        `<polygon points="0,200 ${W},390 ${W},430 0,240" fill="${VERGE}"/>` +
        text(120, 170, 'DOWNHILL', 36, MUTED, 'start') +
        arrow(120, 200, 420, 258, MUTED, 8) +
        // Car body following the slope
        `<g transform="rotate(9 700 400)">` +
        rect(560, 330, 300, 96, CAR_BLUE, 22) +
        rect(620, 300, 170, 46, 'rgba(255,255,255,0.7)', 12) +
        `<circle cx="640" cy="436" r="34" fill="${INK}"/>` +
        `<circle cx="820" cy="436" r="34" fill="${INK}"/>` +
        // Front wheel turned toward the kerb
        `<g transform="rotate(28 820 436)">` +
        rect(796, 410, 48, 52, '#111418', 12) +
        `</g>` +
        `</g>` +
        arrow(900, 470, 1010, 520, INK, 8) +
        text(1010, 570, 'toward the kerb', 28, PAINT, 'middle'),
    ),
  },
  'ps-6': {
    alt: 'A kerb painted yellow beside a delivery van stopped to unload.',
    xml: paintedCurb(
      SIGN_YELLOW,
      'YELLOW KERB',
      'loading only, for a limited time',
    ),
  },
  'ps-7': {
    alt: 'Top-down street corner with a painted crosswalk and a measured gap between it and the nearest parked car.',
    xml: svg(
      rect(0, 0, W, 210, VERGE) +
        rect(0, 210, W, H - 210, ASPHALT) +
        // Zebra crossing
        Array.from({ length: 6 }, (_, i) =>
          rect(300 + i * 52, 230, 30, 200, PAINT, 4),
        ).join('') +
        text(378, 470, 'crosswalk', 30, PAINT) +
        car(880, 330, 'right', CAR_GREY) +
        arrow(600, 560, 800, 560, PAINT, 7) +
        text(700, 620, 'how close may you park?', 30, PAINT),
    ),
  },
  'ps-8': {
    alt: 'A kerb painted green with a clock face beside it, marking a time-limited parking space.',
    xml: paintedCurb(SIGN_GREEN, 'GREEN KERB', 'parking for a limited time'),
  },

  // --- Speed and lanes ----------------------------------------------------
  'sl-1': {
    alt: 'A car on a wet road in heavy rain, passing a posted speed limit sign.',
    xml: svg(
      rect(0, 0, W, 300, '#98A2AE') +
        rect(0, 300, W, H - 300, ASPHALT_DARK) +
        dashes(40, W - 40, 500, false, PAINT_YELLOW) +
        // Rain
        Array.from({ length: 26 }, (_, i) => {
          const x = 40 + i * 45;
          return `<line x1="${x}" y1="${30 + (i % 4) * 30}" x2="${
            x - 22
          }" y2="${
            110 + (i % 4) * 30
          }" stroke="#C9D3DE" stroke-width="6" stroke-linecap="round"/>`;
        }).join('') +
        speedSign(210, 200, '55') +
        car(760, 430, 'right', CAR_BLUE) +
        text(760, 620, 'wet road, poor visibility', 32, PAINT),
    ),
  },
  'sl-2': {
    alt: 'A two-lane undivided road with one lane in each direction, separated by a yellow centre line.',
    xml: svg(
      rect(0, 140, W, 400, ASPHALT) +
        rect(0, 120, W, 20, VERGE) +
        rect(0, 540, W, 20, VERGE) +
        rect(40, 334, W - 80, 10, PAINT_YELLOW, 5) +
        car(430, 250, 'right', CAR_BLUE) +
        car(830, 430, 'left', CAR_GREY) +
        speedSign(1050, 592, '?') +
        text(300, 90, 'two-lane undivided highway', 34, INK),
    ),
  },
  'sl-3': {
    alt: 'A multi-lane freeway in clear weather with light traffic and a posted 65 sign.',
    xml: svg(
      rect(0, 130, W, 420, ASPHALT) +
        rect(0, 110, W, 20, VERGE) +
        rect(0, 550, W, 20, VERGE) +
        dashes(40, W - 40, 270, false) +
        dashes(40, W - 40, 410, false) +
        car(360, 200, 'right', CAR_GREY) +
        car(700, 340, 'right', CAR_BLUE) +
        car(980, 480, 'right', CAR_GREY) +
        speedSign(150, 592, '65') +
        text(760, 80, 'clear weather, light traffic', 32, INK),
    ),
  },
  'sl-4': {
    alt: 'A narrow alley running between two buildings, with a car entering it slowly.',
    xml: svg(
      rect(0, 0, W, H, '#C4C8CF') +
        rect(0, 0, 340, H, '#AEB4BD') +
        rect(W - 340, 0, 340, H, '#AEB4BD') +
        rect(340, 0, W - 680, H, ASPHALT) +
        // Building windows
        Array.from(
          { length: 4 },
          (_, i) =>
            rect(70, 60 + i * 150, 200, 90, '#8C939D', 8) +
            rect(W - 270, 60 + i * 150, 200, 90, '#8C939D', 8),
        ).join('') +
        car(CX, 380, 'up', CAR_BLUE) +
        text(CX, 620, 'ALLEY', 40, PAINT),
    ),
  },
  'sl-5': {
    alt: 'A school zone: a yellow school sign, children on the pavement and a car slowing as it passes.',
    xml: svg(
      rect(0, 0, W, 320, VERGE) +
        rect(0, 320, W, H - 320, ASPHALT) +
        dashes(40, W - 40, 500, false, PAINT_YELLOW) +
        // School warning sign (yellow pentagon-ish diamond)
        `<polygon points="200,90 300,190 200,290 100,190" fill="${SIGN_YELLOW}" stroke="${INK}" stroke-width="8"/>` +
        `<circle cx="185" cy="170" r="16" fill="${INK}"/>` +
        `<circle cx="222" cy="178" r="13" fill="${INK}"/>` +
        rect(176, 190, 20, 44, INK, 8) +
        rect(212, 196, 17, 38, INK, 8) +
        // Children by the kerb
        `<circle cx="640" cy="210" r="20" fill="${INK}"/>` +
        rect(628, 236, 24, 56, INK, 12) +
        `<circle cx="710" cy="222" r="17" fill="#4A4E57"/>` +
        rect(700, 244, 20, 48, '#4A4E57', 10) +
        car(940, 430, 'left', CAR_BLUE) +
        text(CX + 60, 620, 'children present', 32, PAINT),
    ),
  },
  'sl-6': {
    alt: 'A freeway whose left lane is marked with a white diamond, the carpool lane, separated from the general lanes.',
    xml: svg(
      rect(0, 130, W, 420, ASPHALT) +
        rect(0, 110, W, 20, VERGE) +
        rect(0, 550, W, 20, VERGE) +
        rect(40, 265, W - 80, 9, PAINT, 4) +
        dashes(40, W - 40, 410, false) +
        // Diamond marking in the leftmost lane
        [280, 700, 1080]
          .map(
            x =>
              `<polygon points="${x},170 ${x + 42},200 ${x},230 ${
                x - 42
              },200" fill="${PAINT}"/>`,
          )
          .join('') +
        car(500, 200, 'right', CAR_BLUE) +
        car(880, 340, 'right', CAR_GREY) +
        text(180, 90, 'carpool (HOV) lane', 32, INK, 'start'),
    ),
  },
  'sl-7': {
    alt: 'A multi-lane road where a slow car keeps to the rightmost lane while faster traffic flows past on its left.',
    xml: svg(
      rect(0, 130, W, 420, ASPHALT) +
        rect(0, 110, W, 20, VERGE) +
        rect(0, 550, W, 20, VERGE) +
        dashes(40, W - 40, 270, false) +
        dashes(40, W - 40, 410, false) +
        car(700, 470, 'right', CAR_BLUE) +
        youLabel(700, 538) +
        car(430, 200, 'right', CAR_GREY) +
        car(820, 200, 'right', CAR_GREY) +
        car(620, 340, 'right', CAR_GREY) +
        arrow(300, 200, 180, 200, INK, 7) +
        text(CX + 180, 80, 'faster traffic passes on the left', 32, INK),
    ),
  },
  'sl-8': {
    alt: 'A two-lane road where another car is overtaking you on the left while you hold your lane and speed.',
    xml: svg(
      rect(0, 140, W, 400, ASPHALT) +
        rect(0, 120, W, 20, VERGE) +
        rect(0, 540, W, 20, VERGE) +
        dashes(40, W - 40, 340, false) +
        car(640, 430, 'right', CAR_BLUE) +
        youLabel(640, 512) +
        car(760, 240, 'right', CAR_GREY) +
        arrow(880, 240, 1030, 240, INK, 7) +
        onRoad(760, 190, 'passing you', 30),
    ),
  },

  // --- Alcohol ------------------------------------------------------------
  'ap-6': {
    alt: 'Side view of a car showing an opened bottle stowed in the boot rather than in the cabin.',
    xml: svg(
      rect(0, 470, W, H - 470, VERGE) +
        // Car silhouette
        rect(300, 330, 620, 140, CAR_BLUE, 30) +
        `<polygon points="430,330 560,240 760,240 850,330" fill="${CAR_BLUE}"/>` +
        rect(455, 258, 110, 66, 'rgba(255,255,255,0.7)', 8) +
        rect(590, 258, 150, 66, 'rgba(255,255,255,0.7)', 8) +
        `<circle cx="430" cy="470" r="56" fill="${INK}"/>` +
        `<circle cx="800" cy="470" r="56" fill="${INK}"/>` +
        // Boot, highlighted
        rect(860, 350, 90, 100, '#1F62C4', 12) +
        rect(884, 372, 42, 56, '#E8C33F', 6) +
        rect(896, 356, 18, 22, '#E8C33F', 4) +
        `<circle cx="905" cy="400" r="10" fill="#8A6A18"/>` +
        arrow(1060, 300, 950, 380, INK, 8) +
        text(1060, 270, 'boot', 30, INK) +
        // Cabin marked as not allowed
        `<circle cx="640" cy="290" r="40" fill="none" stroke="${SIGN_RED}" stroke-width="12"/>` +
        `<line x1="612" y1="318" x2="668" y2="262" stroke="${SIGN_RED}" stroke-width="12" stroke-linecap="round"/>`,
    ),
  },
};

export const questionDiagram = (
  questionId: string,
): { xml: string; alt: string } | undefined => questionDiagrams[questionId];
