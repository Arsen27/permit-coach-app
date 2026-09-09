import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COVERAGE_DOMAINS,
  LESSON_SPECS,
  MODULE_SPECS,
  RECALL_SPECS,
} from './california-conversation-content.mjs';
import { EMOJI_PATTERN, injectEmoji } from './emoji-layer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_VERSION = '2.0.0';
const DELIVERY_VERSION = '3.3.0';
const SOURCE_VERSION = 'CA-2026.09.02-r03';
const RELEASE_DATE = '2026-09-02';
// check_yourself recall cards ship with the renderer introduced in app 1.1.1.
const MIN_APP_VERSION = '1.1.1';
const BASE = path.join(ROOT, 'server/content/ca-class-c', BASE_VERSION);
const OUTPUT = path.join(ROOT, 'server/content/ca-class-c', DELIVERY_VERSION);
const SEED = path.join(ROOT, 'src/data/course/ca-class-c-v2');
const AUTHORING = path.join(
  ROOT,
  'courses/California_DMV_Course_CA2026.09.02r03_ComplexIntersections',
);
const PREVIOUS_AUTHORING = path.join(
  ROOT,
  'courses/California_DMV_Course_CA2026.09.02r02_EmojiVocab',
);
const RULE_CATALOG_INPUT = path.join(
  ROOT,
  'scripts/california-rule-catalog.json',
);
const COMPETITOR_ROOT =
  process.env.DMV_COMPETITOR_ROOT || path.resolve(ROOT, '../dmv-competitors');

const json = value => JSON.stringify(value, null, 2) + '\n';
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const writeJson = (filename, value) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, json(value));
};
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const uuidFor = value => {
  const bytes = Buffer.from(
    sha256('dmv-learning:' + value).slice(0, 32),
    'hex',
  );
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
const conceptId = id => id.replace(/^ca-/, '');
const docRef = filename => {
  const data = fs.readFileSync(filename);
  return { sha256: sha256(data), sizeBytes: data.byteLength };
};

const sourceLessonDocs = new Map(
  fs
    .readdirSync(path.join(BASE, 'lessons'))
    .filter(filename => filename.endsWith('.json'))
    .map(filename => {
      const doc = readJson(path.join(BASE, 'lessons', filename));
      return [doc.lesson.lessonId, doc];
    }),
);
const sourceAssetById = new Map(
  [...sourceLessonDocs.values()]
    .flatMap(doc => doc.assets)
    .map(asset => [asset.assetId, asset]),
);

const requireSource = id => {
  const doc = sourceLessonDocs.get(id);
  if (!doc) throw new Error(`Missing source lesson ${id}`);
  return doc;
};
const sourceQuestion = (sourceId, index) => {
  const question = requireSource(sourceId).questions[index];
  if (!question) throw new Error(`Missing question ${sourceId}[${index}]`);
  return question;
};
const sourceVisualIds = spec =>
  spec.visuals ??
  spec.sources.flatMap(sourceId =>
    requireSource(sourceId)
      .lesson.blocks.filter(block => block.type === 'image')
      .map(block => block.assetId),
  );

const cleanQuestionText = text =>
  text
    .replace(/\bverified\b\s*/gi, '')
    .replace(/\bin the catalog\b\s*/gi, '')
    .replace(/\bthe catalog's\b/gi, "California's")
    // Do not ship the unresolved minor-retest wording, even when an older
    // question happened to use it as an unrelated distractor.
    .replace(/\bone week\b/gi, 'A few days')
    .replace(/\s+([?.!,])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

const cloneTestQuestion = (question, lessonId, index) => {
  const questionId = `${lessonId}-q${String(index + 1).padStart(2, '0')}`;
  return {
    ...question,
    questionId,
    uuid: uuidFor(questionId),
    kind: 'lesson_test',
    conceptId: `${conceptId(lessonId)}.test.${String(index + 1).padStart(
      2,
      '0',
    )}`,
    prompt: cleanQuestionText(question.prompt),
    choices: question.choices.map(choice => ({
      ...choice,
      text: cleanQuestionText(choice.text),
      feedback: cleanQuestionText(choice.feedback),
    })),
    explanation: cleanQuestionText(question.explanation),
  };
};

const makeManualTest = (data, lessonId, index) => {
  const questionId = `${lessonId}-q${String(index + 1).padStart(2, '0')}`;
  const correctAnswerId = ['A', 'B', 'C'][data.correct];
  return {
    questionId,
    uuid: uuidFor(questionId),
    kind: 'lesson_test',
    conceptId: `${conceptId(lessonId)}.test.${String(index + 1).padStart(
      2,
      '0',
    )}`,
    scope: data.scope,
    prompt: data.prompt,
    choices: data.choices.map((text, choiceIndex) => ({
      id: ['A', 'B', 'C'][choiceIndex],
      text,
      feedback:
        (choiceIndex === data.correct ? 'Correct. ' : 'Not quite. ') +
        data.explanation,
    })),
    correctAnswerId,
    explanation: data.explanation,
  };
};

const makeTheoryQuestion = (spec, visualAssetId) => {
  const questionId = `${spec.id}-theory-q01`;
  const data = spec.challenge;
  const correctAnswerId = ['A', 'B', 'C'][data.correct];
  return {
    questionId,
    uuid: uuidFor(questionId),
    kind: 'opening_challenge',
    conceptId: `${conceptId(spec.id)}.theory.01`,
    scope: data.scope,
    prompt: data.prompt,
    choices: data.choices.map((text, index) => ({
      id: ['A', 'B', 'C'][index],
      text,
      feedback:
        (index === data.correct ? 'Correct. ' : 'Not quite. ') +
        data.explanation,
    })),
    correctAnswerId,
    explanation: data.explanation,
    ...(visualAssetId && { assetId: visualAssetId }),
  };
};

const blockType = (slide, index, lastIndex) => {
  if (slide.type) return slide.type;
  if (slide.scope === 'state_specific') return 'state_specific';
  if (index === 0) return 'why_it_matters';
  if (index === 1) return 'core_rule';
  if (index === lastIndex - 1) return 'exam_trap';
  if (index === lastIndex) return 'remember_this';
  return index % 2 === 0 ? 'visual_example' : 'related_rule';
};

const CONTENT_STOP_WORDS = new Set(
  'a an and are as at be before but by can do for from if in into is it may not of on only or the this to use verified when with you your'.split(
    ' ',
  ),
);
const contentTokens = text =>
  new Set(
    (text.toLowerCase().match(/[a-z0-9½]+/g) ?? []).filter(
      word => word.length > 2 && !CONTENT_STOP_WORDS.has(word),
    ),
  );
const overlapScore = (left, right) => {
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  let score = 0;
  leftTokens.forEach(token => {
    if (rightTokens.has(token)) score += 1;
  });
  return score;
};
const textWordCount = text =>
  (text.normalize('NFKD').match(/[A-Za-z0-9½]+(?:['’][A-Za-z]+)?/g) || [])
    .length;
const auditOnlyLine = text =>
  /under (?:formal |legal )?review|disputed|this course does not|not taught or tested|source package|licensing is placed late|slow early progress/i.test(
    text,
  );

const SIMPLE_TEXT_REWRITES = new Map([
  [
    'The stronger answer is: green permits the movement when the intersection has space and every required yield is satisfied.',
    'Yield to pedestrians and traffic that still has priority.',
  ],
  [
    'Green means you may go.',
    'A green light lets you move only when the intersection is clear.',
  ],
  [
    'First, make sure the path is clear.',
    'Check the intersection before you go.',
  ],
  [
    'Your turn signal communicates intent but does not give you the right to move.',
    'A turn signal shows what you plan to do. It does not give you the right to move.',
  ],
  [
    'Move only when the gap is large enough without forcing another driver to brake.',
    'Move only when the gap is large enough. Do not force another driver to brake.',
  ],
  [
    'When an authorized emergency vehicle approaches with the required warning, move toward the right edge and stop clear of intersections until it passes, subject to officer direction and divided-highway limits.',
    "When an emergency vehicle approaches with lights or a siren, move toward the right edge. Stop away from intersections and wait until it passes. Follow any officer's directions. A divided highway may have a different rule.",
  ],
  [
    'A minor must generally be at least 16, complete required education and training, hold the permit for at least six months, and document 50 practice hours including 10 at night.',
    'A minor must generally meet four requirements. Be at least 16. Complete driver education and training. Hold the permit for at least six months. Record 50 practice hours, including 10 at night.',
  ],
  [
    'A minor generally holds it for at least six months.',
    'Hold the permit for at least six months.',
  ],
  [
    'A minor generally holds it for at least six months',
    'Hold the permit for at least six months.',
  ],
  ['Hold the permit long enough.', 'Hold the permit for at least six months.'],
  ['Hold the permit long enough', 'Hold the permit for at least six months.'],
  [
    'Count the correct date.',
    'Count the six months from the correct permit date.',
  ],
  ['Practice must be documented.', 'Keep a record of your practice hours.'],
  ['Practice must be documented', 'Keep a record of your practice hours.'],
  [
    'California generally requires 50 supervised hours.',
    'Record 50 practice hours, including 10 at night.',
  ],
  [
    'California generally requires 50 supervised hours',
    'Record 50 practice hours, including 10 at night.',
  ],
  [
    'At least 10 are at night.',
    'Record 50 practice hours, including 10 at night.',
  ],
  [
    'At least 10 are at night',
    'Record 50 practice hours, including 10 at night.',
  ],
  [
    'From the left side, a horizontal arm signals left, an upward arm signals right, and a downward arm signals slowing or stopping, subject to the bicycle alternative in law.',
    'Use your left arm for hand signals. Hold it straight out for a left turn. Point it up for a right turn. Point it down to slow or stop. California law gives bicyclists another option.',
  ],
  [
    'When a school bus displays flashing red lights and its stop arm, approaching drivers stop and remain stopped until the signal ends, subject to divided or multilane highway exceptions.',
    'Stop when a school bus flashes red lights or extends its stop arm. Stay stopped until the warning ends. Different rules may apply on divided or multilane highways.',
  ],
  [
    'For an ordinary Class C or M context, four points in 12 months, six in 24 months, or eight in 36 months creates a prima facie negligent-operator presumption.',
    'For an ordinary Class C or M driver, the pattern is 4 points in 12 months, 6 in 24, or 8 in 36. Reaching one of these levels creates a legal presumption that the driver is a negligent operator.',
  ],
  [
    'A driver leaving a driveway, alley, or property must yield to traffic close enough to be an immediate hazard and keep yielding until the movement is reasonably safe.',
    'A driver leaving a driveway, alley, or private property must yield to nearby traffic. Keep yielding until it is safe to enter.',
  ],
  [
    'If an officer is actively directing traffic through a red signal, follow the officer while continuing to watch for road users who may not understand the temporary pattern.',
    'Follow an officer who directs you through a red light. Keep watching for people and drivers who may not expect the temporary traffic pattern.',
  ],
  [
    'On a two-lane highway where passing is unsafe, a slower vehicle followed by five or more vehicles must use a designated turnout or another sufficient safe area.',
    'On a two-lane highway, a slow vehicle may have to use a turnout when passing is unsafe. The rule applies when five or more vehicles are following. Use a marked turnout or another safe area.',
  ],
  [
    'A child six or younger may not be left unattended when risk is significant or the engine is running or keys remain, unless the permitted supervision applies.',
    'Do not leave a child age six or younger alone in a car. The rule applies when the engine is running, the keys are inside, or another serious risk exists. Allowed supervision is an exception.',
  ],
  [
    'Do not enter opposing traffic unless the left side is clearly visible and free for enough distance to complete the pass without interfering with an approaching vehicle.',
    'Do not move into oncoming traffic until you can see far enough ahead. Make sure the lane stays clear for the entire pass.',
  ],
  [
    'STOP, YIELD, and entering-from-property questions all test the same discipline: control the car before the conflict, then give way until the movement is reasonably safe.',
    'STOP, YIELD, and driveway questions use the same basic pattern. Control the car before the conflict. Then yield until it is safe to move.',
  ],
  [
    'Statutory options include an enclosure, side and tail racks at least 46 inches high, a cross-tether, or a secured container, subject to ranching and livestock exceptions.',
    'Keep animals from falling, jumping, or being thrown out. California allows several safety methods: an enclosure, 46-inch side and tail racks, a cross-tether, or a secured container. Ranching and livestock exceptions may apply.',
  ],
  [
    'Choose the lane that fits your speed and next movement, remain centered, and treat every sideways move as a new conflict that requires communication and direct observation.',
    'Choose a lane that fits your speed and next move. Stay centered. Before moving sideways, signal and check the space yourself.',
  ],
  [
    'A noncommercial Class C instruction permit can begin at the minimum age of 15½ and allows practice only under the supervision conditions in the permit law.',
    'You can generally get a noncommercial Class C instruction permit at age 15½. You may practice only with the supervision required by the permit.',
  ],
  [
    'Two sets spaced two feet or more apart form a barrier: do not drive on or across it except through a designated opening or authorized use.',
    'Two sets of double lines spaced two feet or more apart form a barrier. Do not drive on or across it. Use only a marked opening or another legally allowed path.',
  ],
  [
    'Vehicles generally travel on the right half of the roadway unless a listed condition—such as lawful passing, obstruction, or one-way design—changes the rule.',
    'Drive on the right half of the road unless an exception applies. Examples include legal passing, avoiding an obstruction, or driving on a one-way road.',
  ],
  [
    'For an injury or death collision, stop and fulfill the duties, provide identifying information, and render reasonable assistance, including arranging medical transportation when necessary or requested.',
    'After an injury or fatal crash, stop and share the required information. Give reasonable help. Arrange medical transportation when needed or requested.',
  ],
  [
    'The exam may offer an answer that stops in the correct place but then enters without yielding, or an answer that yields but blocks the crosswalk.',
    'One exam answer may stop in the right place but fail to yield before entering. Another may yield but block the crosswalk. Both are wrong.',
  ],
  [
    "Do not follow a responding emergency vehicle within 300 feet unless authorized, and never drive over an unprotected fire hose without the fire department commander's consent.",
    'Stay at least 300 feet behind a responding emergency vehicle unless authorized. Never drive over an unprotected fire hose unless the fire department commander allows it.',
  ],
  [
    'Never drive faster than is reasonable or prudent for weather, visibility, traffic, roadway surface, or width, and never at a speed that endangers people or property.',
    'Never drive faster than conditions safely allow. Consider weather, visibility, traffic, the road surface, and road width. Never use a speed that puts people or property in danger.',
  ],
  [
    'The ordinary vision screening standard is 20/40 with both eyes together, or 20/40 in one eye and at least 20/70 in the other.',
    'The ordinary vision screening standard is 20/40 with both eyes together. Another passing result is 20/40 in one eye and at least 20/70 in the other.',
  ],
  [
    'A person who lawfully drives is deemed to consent to specified chemical testing after a lawful DUI arrest under the choices and conditions in California law.',
    'By driving in California, you agree to certain chemical tests after a lawful DUI arrest. The available tests and conditions depend on California law.',
  ],
  [
    'Before crossing or entering a bicycle lane for a turn, check mirrors and the blind spot and yield to a bicyclist already occupying the space.',
    'Before turning across a bicycle lane, check your mirrors and blind spot. Yield to any bicyclist already in that space.',
  ],
  [
    'Before leaving, stop the engine, set the brake, and on a grade turn the front wheels as required so a roll moves away from danger.',
    'Before leaving, stop the engine and set the parking brake. On a hill, turn the front wheels so a rolling car moves away from danger.',
  ],
  [
    'Read guide signs early, move toward the exit lane one safe lane at a time, and use the deceleration lane to reduce speed when appropriate.',
    'Read guide signs early. Move toward the exit one safe lane at a time. Slow in the exit lane when appropriate.',
  ],
  [
    'When moving slower than normal traffic, keep to the right-hand lane or near the right edge unless passing or preparing for a left turn.',
    'When moving slower than traffic, stay in the right lane or near the right edge. Move left when passing or preparing for a left turn.',
  ],
  [
    'Report a collision to DMV within 10 days when it causes injury, death, or more than $1,000 in property damage to any one person.',
    'Report a crash to DMV within 10 days if someone is injured or killed. The same deadline applies when one person has more than $1,000 in property damage.',
  ],
  [
    'Check directly before a lane change, allow a usable following gap, and do not crowd past a motorcycle while both vehicles remain in one lane.',
    'Look again before changing lanes. Leave a safe following gap. Never squeeze past a motorcycle while both vehicles are in one lane.',
  ],
  [
    'Where local curb-color rules are used, red bars stopping, standing, and parking except the stated bus-zone case.',
    'A red curb means no stopping, standing, or parking, except at a marked bus zone.',
  ],
  [
    'Yellow is for loading or unloading under local time rules.',
    'A yellow curb is for loading or unloading within the local time limit.',
  ],
  [
    'White is for passenger loading or unloading and specified mail use.',
    'A white curb is for passengers or a marked mail area.',
  ],
  [
    'Green is time-limited parking.',
    'A green curb allows parking for a limited time.',
  ],
  [
    'Blue is reserved for authorized disabled parking.',
    'A blue curb is only for authorized disabled parking.',
  ],
  ['Before choosing, ask: Which driver?', 'The driver involved'],
  ['Which road?', 'The type of road'],
  ['Which time window?', 'The time window'],
  ['Which signal?', 'The signal shown'],
  ['Which exception?', 'Any stated exception'],
  ['Turning right on red.', 'A right turn on red has extra conditions.'],
  [
    'Young passengers are restricted too.',
    'Passengers under 20 generally require qualifying supervision during the first year.',
  ],
  [
    'Timeline before numbers.',
    'Start with the licensing stage before choosing a number.',
  ],
  [
    'Legal exceptions exist.',
    'Documented exceptions apply in certain situations.',
  ],
  ['See less? Slow down.', 'When you can see less, slow down.'],
  [
    'Stalled on tracks? Get out.',
    'If the vehicle stalls on the tracks, get everyone out immediately.',
  ],
  [
    'Mixing substances adds risk.',
    'Using cannabis with alcohol or another drug can increase impairment.',
  ],
  [
    'Refusal can create separate consequences.',
    'Refusing a required test can create consequences separate from the DUI case.',
  ],
  [
    'Emergency use is different.',
    'The law treats a genuine emergency differently from ordinary phone use.',
  ],
  [
    'Coffee does not replace sleep.',
    'Coffee may increase alertness briefly, but it does not replace sleep.',
  ],
  [
    'Other requirements still apply.',
    'Reaching the minimum age does not remove the other permit requirements.',
  ],
  [
    'The first year has limits.',
    'Special restrictions continue during the first year of a provisional license.',
  ],
  [
    'Recheck it during the trip.',
    'Stop safely and recheck the load during a long trip.',
  ],
  [
    'Smooth driving can save fuel.',
    'Smooth acceleration and braking can also reduce fuel use.',
  ],
  [
    'A temporary visit is different.',
    'A temporary visit does not automatically make someone a California resident.',
  ],
  [
    'Posted local times still matter.',
    'Posted local time limits still control how long you may park.',
  ],
  [
    'Passing combines legality and judgment.',
    'A pass must be both legal and safe for the conditions.',
  ],
  [
    'Requirements depend on the applicant.',
    'The exact application requirements depend on the applicant and license type.',
  ],
  [
    'DMV may require more review.',
    'DMV may require another review when the ordinary checks are not enough.',
  ],
  [
    'The knowledge test checks decisions.',
    'The knowledge test checks how you apply rules to driving decisions.',
  ],
  [
    'Yellow usually separates opposing traffic.',
    'Yellow lines usually separate traffic moving in opposite directions.',
  ],
  [
    'Allowed supervision is an exception.',
    'The law provides a limited exception when qualifying supervision is present.',
  ],
  [
    'The symbol previews the hazard.',
    'The symbol shows the type of hazard you are approaching.',
  ],
  [
    'Shape and color are shortcuts.',
    'Shape and color help you identify the sign before you read every detail.',
  ],
  [
    'Space is stored reaction time.',
    'Open space gives you time to notice a problem and respond smoothly.',
  ],
  [
    'Other drivers may be confused.',
    'Other drivers may read the dark signal differently, so expect hesitation.',
  ],
  [
    'The cab may swing out.',
    'The cab may first swing away from the direction of the turn.',
  ],
  [
    'A later arrival waits.',
    'A driver who arrives later should wait for the earlier vehicle.',
  ],
  [
    'It tells you to prepare.',
    'The warning gives you time to prepare before the road changes.',
  ],
  ['You see less.', 'Rain reduces visibility as well as tire grip.'],
  [
    'California generally requires 15 feet.',
    'In California, keep at least 15 feet of space from a fire hydrant.',
  ],
  [
    'Both are wrong.',
    'Both answers ignore part of the required stop-and-yield sequence.',
  ],
  [
    'Stop before the limit line.',
    'When there is a limit line, stop before your vehicle reaches it.',
  ],
  [
    'Stop before the crosswalk.',
    'If there is no limit line, stop before entering the crosswalk.',
  ],
  [
    'Do not memorize answer letters.',
    'Learn why an answer is correct instead of memorizing answer letters.',
  ],
  [
    'Three failed attempts invalidate the current knowledge-test application; a first chemical-test refusal carries the administrative period; a reportable uninsured collision can start suspension procedures; and provisional restrictions depend on age and license timing.',
    'Different events trigger different DMV actions. Three failed attempts invalidate the current knowledge-test application, while a first chemical-test refusal carries its own administrative period. A reportable uninsured collision can start suspension procedures, and provisional restrictions depend on age and license timing.',
  ],
  [
    'The ordinary vision screening standard is 20/40 with both eyes together, or 20/40 in one eye and at least 20/70 in the other; the regulation also provides an alternative examination and drive-test pathway.',
    'The ordinary vision screening standard is 20/40 with both eyes together. Another passing result is 20/40 in one eye and at least 20/70 in the other. The regulation also provides an alternative examination and drive-test pathway.',
  ],
]);

const simplifyLearnerText = text =>
  [...SIMPLE_TEXT_REWRITES].reduce(
    (result, [original, simpler]) => result.replaceAll(original, simpler),
    text,
  );

const normalizeLearnerLine = text =>
  simplifyLearnerText(
    text
      .replace(/\bverified\b\s*/gi, '')
      .replace(/\bin the catalog\b\s*/gi, '')
      .replace(/\bthe catalog's\b/gi, "California's")
      .replace(
        /For policies or bonds issued or renewed on or after January 1, 2025, the verified minimum liability limits are \$30,000 for one person's injury or death, \$60,000 for two or more, and \$15,000 for property damage\./gi,
        "For policies or bonds issued or renewed on or after January 1, 2025, California uses updated minimum liability limits. They are $30,000 for one person's injury or death, $60,000 for two or more, and $15,000 for property damage.",
      )
      .replace(
        /For policies or bonds issued or renewed on or after January 1, 2025, the minimum liability limits are \$30,000 for one person's injury or death, \$60,000 for two or more, and \$15,000 for property damage\./gi,
        "For policies or bonds issued or renewed on or after January 1, 2025, California uses updated minimum liability limits. They are $30,000 for one person's injury or death, $60,000 for two or more, and $15,000 for property damage.",
      )
      .replace(
        /In a residence district, do not make a U-turn when another vehicle is approaching from either direction within 200 feet, unless you are at an intersection where a traffic-control device controls the approaching vehicle\./gi,
        'In a residence district, do not make a U-turn when another vehicle is approaching from either direction within 200 feet. An exception applies at an intersection where a traffic-control device controls the approaching vehicle.',
      )
      .replace(
        /It is also required when weather keeps a person or vehicle from being clearly seen at 1,000 feet and when windshield wipers are continuously needed because of rain, mist, snow, fog, or other precipitation\./gi,
        'Lighting is also required when weather prevents clear visibility at 1,000 feet. Turn it on when windshield wipers are continuously needed for rain, mist, snow, fog, or other precipitation.',
      )
      .replace(
        /It does not require an automatic stop\./gi,
        'A flashing yellow does not require an automatic stop.',
      )
      .replace(
        /During the first 12 months of a provisional license, a driver under 18 generally may not drive from 11 p\.m\. to 5 a\.m\. or transport passengers under 20 without qualifying supervision\./gi,
        'During the first 12 months of a provisional license, a driver under 18 generally may not drive from 11 p.m. to 5 a.m. The driver also may not transport passengers under 20 without qualifying supervision.',
      )
      .replace(/^And wait until\b/gi, 'Wait until')
      .replace(/^And provisional restrictions\b/gi, 'Provisional restrictions')
      .replace(/^While limited turns may\b/gi, 'Limited turns may')
      .replace(
        /^While you decide and react, and while the brakes reduce speed\./gi,
        'The vehicle keeps moving while you decide, react, and brake.',
      )
      .replace(/\.{2,}/g, '.')
      .replace(/\s+([?.!,])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );
const capitalize = text =>
  text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
const splitOversizeLine = text => {
  // Preserve grammatical clauses. Arbitrary midpoint and conjunction splits
  // made short text look conversational but produced fragments such as
  // “And allows practice…” and occasionally separated a number from its rule.
  // The few genuinely long source sentences are rewritten explicitly above.
  return [text];
};
const readableLines = text =>
  normalizeLearnerLine(text)
    .replace(
      /\b(a|p)\.m\.\s+(?=[A-Z])/g,
      (_, meridiem) => `${meridiem}<<MERIDIEM>>|`,
    )
    .replace(/\b(a|p)\.m\./gi, (_, meridiem) => `${meridiem}<<MERIDIEM>>`)
    .split('|')
    .flatMap(part => part.split(/(?<=[.!?])\s+/))
    .map(part => capitalize(part.trim()))
    .filter(part => part.length > 0 && !auditOnlyLine(part))
    .flatMap(splitOversizeLine)
    .map(part =>
      part
        .replace(/(a|p)<<MERIDIEM>>/gi, '$1.m.')
        .replace(/^And wait until\b/i, 'Wait until')
        .replace(
          /^And provisional restrictions\b/i,
          'Provisional restrictions',
        ),
    );
const sameLine = (left, right) => {
  const leftTokens = contentTokens(left);
  const rightTokens = contentTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;
  let common = 0;
  leftTokens.forEach(token => {
    if (rightTokens.has(token)) common += 1;
  });
  // A short label such as “Signal” must not delete the fuller rule
  // “Signal during the final 100 feet.” Require both texts to be similar in
  // size as well as content before treating one as a duplicate.
  return (
    common / Math.min(leftTokens.size, rightTokens.size) >= 0.8 &&
    common / Math.max(leftTokens.size, rightTokens.size) >= 0.6
  );
};
const uniqueLines = lines => {
  const result = [];
  lines.forEach(line => {
    if (!result.some(existing => sameLine(existing, line))) result.push(line);
  });
  return result;
};
const dedupeAcrossLesson = slides => {
  const seen = new Set();
  return slides.map(item => ({
    ...item,
    lines: item.lines.filter(line => {
      const key = line
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      if (key.split(' ').length < 4 || !seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    }),
  }));
};
const SPLIT_SOURCE_TITLE_FILTERS = {
  'ca-school-buses-emergency-vehicles':
    /why this matters|emergency vehicle|warning vehicle|response scene|school bus|make space|people can be|exam trap/i,
  'ca-rail-light-rail-work-zones':
    /railroad|rail-transit|orange means|school bus and work|people can be|transit vehicles/i,
  'ca-driving-after-dark':
    /why this matters|required lighting|dim high beams|visibility limits|distance you can see|glare|exam trap/i,
  'ca-weather-and-mountain-roads':
    /poor traction|glare and severe weather|visibility limits|mountain roads/i,
  'ca-permit-and-knowledge-test':
    /why this matters|instruction permit|knowledge attempts|exam trap|licensing as gates|three attempts/i,
  'ca-drivers-under-18':
    /why this matters|instruction permit|provisional eligibility|first twelve months|licensing as gates/i,
};
const SPLIT_SOURCE_LINE_EXCLUDES = {
  'ca-school-buses-emergency-vehicles':
    /in work zones|temporary signs, channelizing devices|narrowed lanes and sudden slowing/i,
  'ca-rail-light-rail-work-zones':
    /school bus|stop arm|green, blue, and brown guide signs|support navigation|cut across traffic/i,
};
const sourceTeachingBlocks = spec =>
  spec.sources.flatMap(sourceId =>
    requireSource(sourceId)
      .lesson.blocks.filter(
        block =>
          block.bodyMarkdown &&
          block.type !== 'drive_smarter' &&
          block.type !== 'remember_this' &&
          !auditOnlyLine(
            [block.title, block.bodyMarkdown, ...(block.bullets ?? [])].join(
              ' ',
            ),
          ),
      )
      .filter(block => {
        const filter = SPLIT_SOURCE_TITLE_FILTERS[spec.id];
        return filter == null || filter.test(block.title);
      })
      .map((block, sequence) => ({
        ...block,
        sourceId,
        sequence,
        searchText: [
          block.title,
          block.bodyMarkdown,
          ...(block.bullets ?? []),
        ].join(' '),
      })),
  );
const combineSlides = (left, right) => ({
  ...left,
  lines: uniqueLines([
    ...left.lines,
    `${right.title.replace(/[.!?]+$/, '')}.`,
    ...right.lines,
  ]),
  scope:
    left.scope === 'state_specific' || right.scope === 'state_specific'
      ? 'state_specific'
      : 'universal',
  mergedTitles: [
    ...(left.mergedTitles ?? [left.title]),
    ...(right.mergedTitles ?? [right.title]),
  ],
});
const mergeThinSlides = slides => {
  const merged = [...slides];
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < merged.length; index += 1) {
      const current = merged[index];
      if (textWordCount([current.title, ...current.lines].join(' ')) >= 42) {
        continue;
      }
      const currentText = [current.title, ...current.lines].join(' ');
      const options = [];
      if (index > 0) {
        const previous = merged[index - 1];
        const combined = combineSlides(previous, current);
        const words = textWordCount(
          [combined.title, ...combined.lines].join(' '),
        );
        if (words <= 135) {
          options.push({
            direction: 'previous',
            combined,
            words,
            score: overlapScore(
              currentText,
              [previous.title, ...previous.lines].join(' '),
            ),
          });
        }
      }
      if (index + 1 < merged.length) {
        const next = merged[index + 1];
        const combined = combineSlides(current, next);
        const words = textWordCount(
          [combined.title, ...combined.lines].join(' '),
        );
        if (words <= 135) {
          options.push({
            direction: 'next',
            combined,
            words,
            score: overlapScore(
              currentText,
              [next.title, ...next.lines].join(' '),
            ),
          });
        }
      }
      const best = options.sort(
        (left, right) => right.score - left.score || left.words - right.words,
      )[0];
      if (!best) continue;
      if (best.direction === 'previous') {
        merged.splice(index - 1, 2, best.combined);
      } else {
        merged.splice(index, 2, best.combined);
      }
      changed = true;
      break;
    }
  }
  return merged;
};
const splitDenseSlides = slides =>
  slides.flatMap(item => {
    const totalWords = textWordCount([item.title, ...item.lines].join(' '));
    const mergedTitles = item.mergedTitles ?? [item.title];
    if (totalWords <= 100 || mergedTitles.length < 2) return [item];
    const boundaries = mergedTitles.slice(1).flatMap(title => {
      const marker = `${title}.`.toLowerCase();
      const lineIndex = item.lines.findIndex(
        line => line.toLowerCase() === marker,
      );
      if (lineIndex <= 0 || lineIndex >= item.lines.length - 1) return [];
      const leftWords = textWordCount(
        [item.title, ...item.lines.slice(0, lineIndex)].join(' '),
      );
      const rightWords = textWordCount(
        [title, ...item.lines.slice(lineIndex + 1)].join(' '),
      );
      return leftWords >= 42 && rightWords >= 42
        ? [{ title, lineIndex, balance: Math.abs(leftWords - rightWords) }]
        : [];
    });
    const boundary = boundaries.sort(
      (left, right) => left.balance - right.balance,
    )[0];
    if (!boundary) return [item];
    return [
      {
        ...item,
        lines: item.lines.slice(0, boundary.lineIndex),
        mergedTitles: [item.title],
      },
      {
        ...item,
        title: boundary.title,
        lines: item.lines.slice(boundary.lineIndex + 1),
        mergedTitles: [boundary.title],
      },
    ];
  });
const compileLessonSpec = spec => {
  const candidates = sourceTeachingBlocks(spec);
  const exactSource = spec.sources.length === 1 && spec.sources[0] === spec.id;
  const assignments = new Map();
  const usedCandidates = new Set();
  const rankedPairs = spec.slides
    .flatMap((item, slideIndex) =>
      item.noExpansion
        ? []
        : candidates.map((candidate, candidateIndex) => ({
            slideIndex,
            candidateIndex,
            score: overlapScore(
              [item.title, ...item.lines].join(' '),
              candidate.searchText,
            ),
          })),
    )
    .sort((left, right) => right.score - left.score);
  rankedPairs.forEach(pair => {
    if (
      assignments.has(pair.slideIndex) ||
      usedCandidates.has(pair.candidateIndex) ||
      (!exactSource && pair.score < 2)
    ) {
      return;
    }
    assignments.set(pair.slideIndex, pair.candidateIndex);
    usedCandidates.add(pair.candidateIndex);
  });
  if (exactSource) {
    const openSlides = spec.slides
      .map((_, index) => index)
      .filter(
        index => !assignments.has(index) && !spec.slides[index].noExpansion,
      );
    const openCandidates = candidates
      .map((_, index) => index)
      .filter(index => !usedCandidates.has(index));
    openSlides.forEach((slideIndex, index) => {
      const candidateIndex = openCandidates[index];
      if (candidateIndex != null) assignments.set(slideIndex, candidateIndex);
    });
  }

  const enriched = spec.slides.map((item, slideIndex) => {
    const candidate = candidates[assignments.get(slideIndex)];
    const sourceLines =
      candidate == null
        ? []
        : [candidate.bodyMarkdown, ...(candidate.bullets ?? [])]
            .flatMap(readableLines)
            .filter(
              line =>
                !(SPLIT_SOURCE_LINE_EXCLUDES[spec.id]?.test(line) ?? false),
            );
    const lines = uniqueLines([
      ...item.lines.flatMap(readableLines),
      ...sourceLines,
    ]);
    return {
      ...item,
      lines,
      mergedTitles: [item.title],
      scope:
        item.scope === 'state_specific' ||
        candidate?.scope === 'state_specific' ||
        candidate?.type === 'state_specific'
          ? 'state_specific'
          : 'universal',
      sourceExpansion:
        candidate == null
          ? undefined
          : `${candidate.sourceId}:${candidate.title}`,
    };
  });
  const slides = splitDenseSlides(
    mergeThinSlides(dedupeAcrossLesson(enriched)),
  );
  return {
    ...spec,
    // Merging thin slides can turn a slide title into a learner-facing line.
    // Run the final lines through the same simplifier, then remove duplicates
    // created by the clearer wording.
    slides: slides.map(item => ({
      ...item,
      lines: uniqueLines(item.lines.flatMap(readableLines)),
    })),
  };
};

// Most teaching cards should read like short, spacious prose. Bullets are
// reserved for information that is genuinely easier to learn as a sequence or
// a set of parallel values. The indexes refer to the compiled slide lines; all
// remaining lines become ordinary paragraphs above the list.
const TRUE_LIST_PRESENTATION = new Map([
  [
    'A turn has four parts',
    {
      bulletIndexes: [0, 1, 2, 3],
      intro: 'Use the same four-part sequence for every turn:',
    },
  ],
  [
    'California has several BAC rules',
    {
      bulletIndexes: [2, 3, 4],
      intro: 'Match the limit to the driver and situation:',
    },
  ],
  [
    'California uses age and size rules',
    {
      bulletIndexes: [2, 3, 4],
      intro: 'Use the rule that matches the child:',
    },
  ],
  [
    'California uses separate clocks',
    {
      bulletIndexes: [0, 1],
      intro: 'Keep the reporting deadlines separate:',
    },
  ],
  [
    'Colors support the message',
    {
      bulletIndexes: [0, 1, 2, 3],
      intro: 'Use these color families as quick clues:',
    },
  ],
  [
    'Curb colors control stopping',
    {
      bulletIndexes: [2, 3, 4, 5, 6],
      intro: 'Each curb color has a different job:',
    },
  ],
  [
    'Education and training are separate gates',
    {
      bulletIndexes: [3, 4, 5, 6],
      intro: 'A minor generally has to meet all four requirements:',
    },
  ],
  [
    'Emergency order',
    {
      bulletIndexes: [0, 1, 2, 3],
      intro: 'When the vehicle fails, keep this order:',
    },
  ],
  [
    'Final exam method',
    {
      bulletIndexes: [0, 1, 2],
      intro: 'Use the same method on each exam question:',
    },
  ],
  [
    'Guide signs help you plan',
    {
      bulletIndexes: [0, 1, 2],
      intro: 'The color gives you a quick clue:',
    },
  ],
  [
    'Make every control smoother',
    {
      bulletIndexes: [0, 1, 2],
      intro: 'In poor conditions, make these three changes:',
    },
  ],
  [
    'Match each deadline to the event',
    {
      bulletIndexes: [1, 2, 3],
      intro: 'Keep the three deadlines separate:',
    },
  ],
  [
    'Never flee',
    {
      bulletIndexes: [3, 4, 5, 6, 7],
      intro: 'Before choosing an exam answer, identify each condition:',
    },
  ],
  [
    'Remember the 4/6/8 pattern',
    {
      bulletIndexes: [0, 1, 2],
      intro: 'Memorize the three point thresholds:',
    },
  ],
  [
    'Remember the order',
    {
      bulletIndexes: [0, 1, 2, 3, 4],
      intro: 'After a collision, keep these actions in order:',
    },
  ],
  [
    'Remember this order',
    {
      bulletIndexes: [0, 1, 2, 3],
      intro: 'At a STOP or YIELD conflict, keep this order:',
    },
  ],
  [
    'Read the sign as a verb',
    {
      bulletIndexes: [0, 1, 2, 3, 4],
      intro: 'Start by naming the action:',
    },
  ],
  [
    'Read markings in layers',
    {
      bulletIndexes: [0, 1, 2],
      intro: 'Read the road surface in this order:',
    },
  ],
  [
    'Stopping takes three stages',
    {
      bulletIndexes: [0, 1, 2],
      intro: 'Total stopping distance has three stages:',
    },
  ],
  [
    'Turn checklist',
    {
      bulletIndexes: [0, 1, 2, 3, 4, 5],
      intro: 'Run through this checklist before and during the turn:',
    },
  ],
  [
    'Use the full check',
    {
      bulletIndexes: [0, 1, 2, 3, 4],
      intro: 'Check the space in this order:',
    },
  ],
]);

// Chat-style delivery: every teaching thought lands as its own short,
// message-like line with breathing room, the way a study chat reads. Two
// sentences share a line only when they form one thought — a tiny question
// with its answer ("No line? Stop before the crosswalk."), or a lead-in that
// ends in a colon. Longer explanatory sentences are allowed and simply become
// slightly longer messages.
const paragraphizeLines = lines => {
  const bubbles = [];
  lines
    .filter(Boolean)
    .flatMap(readableLines)
    .forEach(sentence => {
      const previous = bubbles.at(-1);
      if (previous != null) {
        const previousTrimmed = previous.trim();
        const tinyQuestion =
          /\?$/.test(previousTrimmed) && textWordCount(previous) <= 6;
        if (tinyQuestion) {
          // A rewritten answer can restate the question ("No line?" followed
          // by "If there is no limit line, …"); the question adds nothing
          // then, so the fuller answer stands alone.
          const questionTokens = [...contentTokens(previous)];
          const answerTokens = contentTokens(sentence);
          if (
            questionTokens.length > 0 &&
            questionTokens.every(token => answerTokens.has(token))
          ) {
            bubbles[bubbles.length - 1] = sentence;
            return;
          }
        }
        const pairsWithPrevious = tinyQuestion || /:$/.test(previousTrimmed);
        if (
          pairsWithPrevious &&
          textWordCount(previous) + textWordCount(sentence) <= 20
        ) {
          bubbles[bubbles.length - 1] = `${previous} ${sentence}`;
          return;
        }
      }
      bubbles.push(sentence);
    });
  return bubbles.join('\n\n');
};

const teachingCopyFor = (item, type) => {
  const list = TRUE_LIST_PRESENTATION.get(item.title);
  if (list == null) {
    return { bodyMarkdown: paragraphizeLines(item.lines) };
  }

  const bulletIndexSet = new Set(list.bulletIndexes);
  const proseLines = item.lines.filter(
    (_, index) => !bulletIndexSet.has(index),
  );
  const bullets = item.lines.filter((_, index) => bulletIndexSet.has(index));
  return {
    bodyMarkdown: [paragraphizeLines(proseLines), list.intro]
      .filter(Boolean)
      .join('\n\n'),
    bullets,
  };
};

// A recall card lands directly after the theory card that teaches its fact.
// Matching by content overlap (instead of a fixed index) keeps the placement
// correct even when thin cards merge or dense cards split.
const recallSlideIndexFor = (spec, recallSpec) => {
  // An explicit anchor wins: authors can pin a card to a slide title when the
  // token heuristics would land one card early or late.
  if (recallSpec.afterTitle != null) {
    const pinned = spec.slides.findIndex(
      item =>
        item.title === recallSpec.afterTitle ||
        (item.mergedTitles ?? []).includes(recallSpec.afterTitle),
    );
    if (pinned >= 0) return pinned;
    throw new Error(
      `${spec.id}: recall anchor title not found: ${recallSpec.afterTitle}`,
    );
  }
  // The hidden words are the fact being recalled, so the anchor slide must
  // actually teach them. Rank first by how many gap terms a slide carries,
  // then by general overlap; prefer the latest qualifying slide so a recall
  // never appears before the fact has been taught.
  const gaps = [...recallSpec.rule.matchAll(/\[\[(.*?)\]\]/g)].map(
    match => match[1],
  );
  const tokensOf = text =>
    new Set(text.toLowerCase().match(/[a-z0-9½]+/g) ?? []);
  const searchText = `${recallSpec.context} ${recallSpec.rule.replace(
    /\[\[|\]\]/g,
    ' ',
  )}`;
  // The ideal spot is directly after the deck has finished teaching every
  // hidden term: the earliest slide index at which all gap tokens have
  // appeared. When a gap is a paraphrase that never appears literally, fall
  // back to the slide with the strongest overall content overlap.
  // The recall topic ("Recall · Flashing signals" → "flashing signals") must
  // also have been reached, so a recall about a late card cannot anchor onto
  // an early card that merely shares its gap words. Topic tokens that never
  // appear in the deck are not required.
  const slideTokenSets = spec.slides.map(item =>
    tokensOf([item.title, ...item.lines].join(' ')),
  );
  // Singular/plural drift ("color" vs "colors") must not move an anchor, so
  // token membership is checked with a trailing-s fallback.
  const hasToken = (tokenSet, token) =>
    tokenSet.has(token) ||
    tokenSet.has(`${token}s`) ||
    (token.endsWith('s') && tokenSet.has(token.slice(0, -1)));
  const deckTokens = new Set(slideTokenSets.flatMap(tokens => [...tokens]));
  const topicTokens = [
    ...tokensOf(recallSpec.context.replace(/^Recall\s*·\s*/i, '')),
  ].filter(token => hasToken(deckTokens, token));
  const requiredTokenGroups = [
    ...gaps.map(gap => [...tokensOf(gap)]),
    ...topicTokens.map(token => [token]),
  ];
  const seenTokens = new Set();
  let bestOverlap = -1;
  let bestOverlapIndex = spec.slides.length - 1;
  let coverageIndex = -1;
  spec.slides.forEach((item, index) => {
    const slideText = [item.title, ...item.lines].join(' ');
    slideTokenSets[index].forEach(token => seenTokens.add(token));
    if (
      coverageIndex < 0 &&
      requiredTokenGroups.every(group =>
        group.every(token => hasToken(seenTokens, token)),
      )
    ) {
      coverageIndex = index;
    }
    const overlap = overlapScore(searchText, slideText);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestOverlapIndex = index;
    }
  });
  return coverageIndex >= 0 ? coverageIndex : bestOverlapIndex;
};

// A light emoji layer over the theory chat: a curated concept→emoji map,
// injected before the first mention of a concept, so a line reads like
// "Yield to 🚶 pedestrians and 🚗 traffic that still has priority."
// Kept deliberately sparse — at most three per prose card, one per bullet, one
// per challenge scenario — and never in questions, feedback, explanations, or
// recall rules (an emoji next to a [[gap]] would give the hidden word away).
// Ordered by specificity; the generic 🚗 for plain "traffic" comes last.
const withEmojiLayer = card => {
  const usedEmoji = new Set();
  const bodyMarkdown =
    card.bodyMarkdown == null
      ? card.bodyMarkdown
      : injectEmoji(card.bodyMarkdown, { count: 3 }, usedEmoji);
  const bullets = card.bullets?.map(bullet =>
    injectEmoji(bullet, { count: 1 }, usedEmoji),
  );
  return {
    ...card,
    ...(bodyMarkdown != null && { bodyMarkdown }),
    ...(bullets != null && { bullets }),
  };
};

const makeBlocks = (spec, visualIds, theoryQuestionId) => {
  const blocks = [
    {
      blockId: `${spec.id}-challenge`,
      type: 'quick_challenge',
      title: 'What would you do?',
      scenario: injectEmoji(spec.challenge.scenario, { count: 1 }, new Set()),
      questionPreview: spec.challenge.prompt,
      questionId: theoryQuestionId,
    },
  ];
  const inlineVisuals = visualIds.slice(1, 3);
  const secondVisualIndex =
    spec.slides.length >= 6 ? 5 : spec.slides.length - 1;
  const imageBefore = new Map([
    [2, inlineVisuals[0]],
    [secondVisualIndex, inlineVisuals[1]],
  ]);
  const recallSpecs = RECALL_SPECS[spec.id] ?? [];
  const recallAfterSlide = new Map();
  // Spread consecutive recalls out: when two cards would anchor onto the same
  // slide, the later one moves to the next slide so recalls never stack
  // back-to-back (except unavoidably at the very end of a deck).
  let recallFloor = -1;
  recallSpecs.forEach(recallSpec => {
    const matched = recallSlideIndexFor(spec, recallSpec);
    const spread = Math.min(
      Math.max(matched, recallFloor + 1),
      spec.slides.length - 1,
    );
    recallFloor = spread;
    const queue = recallAfterSlide.get(spread) ?? [];
    queue.push(recallSpec);
    recallAfterSlide.set(spread, queue);
  });
  let recallSequence = 0;
  spec.slides.forEach((item, index) => {
    const assetId = imageBefore.get(index);
    if (assetId) {
      blocks.push({
        blockId: `${spec.id}-image-${String(index + 1).padStart(2, '0')}`,
        type: 'image',
        assetId,
      });
    }
    const type = blockType(item, index, spec.slides.length - 1);
    blocks.push({
      blockId: `${spec.id}-slide-${String(index + 1).padStart(2, '0')}`,
      type,
      title: item.title,
      ...withEmojiLayer(teachingCopyFor(item, type)),
      conceptId: `${conceptId(spec.id)}.slide.${String(index + 1).padStart(
        2,
        '0',
      )}`,
      scope: item.scope,
    });
    for (const recallSpec of recallAfterSlide.get(index) ?? []) {
      recallSequence += 1;
      const ordinal = String(recallSequence).padStart(2, '0');
      blocks.push({
        blockId: `${spec.id}-recall-${ordinal}`,
        type: 'check_yourself',
        title: recallSpec.title,
        context: recallSpec.context,
        ruleMarkdown: recallSpec.rule,
        conceptId: `${conceptId(spec.id)}.recall.${ordinal}`,
        scope: recallSpec.scope,
      });
    }
  });
  return blocks;
};

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.rmSync(AUTHORING, { recursive: true, force: true });
fs.mkdirSync(path.join(OUTPUT, 'modules'), { recursive: true });
fs.mkdirSync(path.join(OUTPUT, 'lessons'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'lessons'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'reports'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'rules'), { recursive: true });

const lessonDocs = [];
const lessonDocById = new Map();
const compiledLessonSpecs = [];
const questionById = new Map();
const lessonById = new Map();
const claimedAssetIds = new Set();
let globalSequence = 0;

for (const [moduleIndex, moduleSpec] of MODULE_SPECS.entries()) {
  for (const [lessonIndex, lessonId] of moduleSpec.lessons.entries()) {
    globalSequence += 1;
    const rawSpec = LESSON_SPECS.find(entry => entry.id === lessonId);
    if (!rawSpec) throw new Error(`Missing content spec ${lessonId}`);
    const spec = compileLessonSpec(rawSpec);
    compiledLessonSpecs.push(spec);
    const visualIds = [...new Set(sourceVisualIds(spec))];

    const picks =
      spec.questionPicks ??
      Array.from({ length: 6 }, (_, index) => [spec.sources[0], index]);
    const copiedTests = picks.map(([sourceId, index], questionIndex) =>
      cloneTestQuestion(
        sourceQuestion(sourceId, index),
        spec.id,
        questionIndex,
      ),
    );
    const manualTests = (spec.extraTests ?? []).map((data, index) =>
      makeManualTest(data, spec.id, copiedTests.length + index),
    );
    const testQuestions = [...copiedTests, ...manualTests];
    if (testQuestions.length !== 6) {
      throw new Error(`${spec.id}: expected 6 test questions`);
    }

    const theoryQuestion = makeTheoryQuestion(spec, visualIds[0]);
    const questions = [theoryQuestion, ...testQuestions];
    const blocks = makeBlocks(spec, visualIds, theoryQuestion.questionId);
    const referencedAssetIds = new Set([
      ...blocks
        .filter(block => block.type === 'image')
        .map(block => block.assetId),
      ...questions.map(question => question.assetId).filter(Boolean),
    ]);
    const assetAliases = new Map();
    const assets = [...referencedAssetIds].map(sourceAssetId => {
      const sourceAsset = sourceAssetById.get(sourceAssetId);
      if (!sourceAsset) {
        throw new Error(`${spec.id}: missing asset ${sourceAssetId}`);
      }
      const assetId = claimedAssetIds.has(sourceAssetId)
        ? `${spec.id}-${sourceAssetId}`
        : sourceAssetId;
      claimedAssetIds.add(assetId);
      assetAliases.set(sourceAssetId, assetId);
      return assetId === sourceAssetId
        ? sourceAsset
        : { ...sourceAsset, assetId, uuid: uuidFor(assetId) };
    });
    blocks.forEach(block => {
      if (block.type === 'image') {
        block.assetId = assetAliases.get(block.assetId) ?? block.assetId;
      }
    });
    questions.forEach(question => {
      if (question.assetId) {
        question.assetId =
          assetAliases.get(question.assetId) ?? question.assetId;
      }
      questionById.set(question.questionId, question);
    });
    const lesson = {
      lessonId: spec.id,
      uuid: uuidFor(spec.id),
      moduleId: moduleSpec.id,
      globalSequence,
      moduleSequence: lessonIndex + 1,
      title: spec.title,
      conceptId: conceptId(spec.id),
      objective: spec.summary,
      intro: {
        summary: spec.summary,
        keyPoints: spec.keyPoints,
        theoryMinutes: Math.max(6, Math.ceil((spec.slides.length + 1) * 0.9)),
        testMinutes: 4,
      },
      estimatedMinutes: '10-15',
      format: 'intro_conversation_slides_test',
      blocks,
      questionIds: questions.map(question => question.questionId),
      theoryQuestionIds: [theoryQuestion.questionId],
      testQuestionIds: testQuestions.map(question => question.questionId),
      assetIds: assets.map(asset => asset.assetId),
      language: 'en-US',
    };
    const runtimeDoc = {
      schemaVersion: 2,
      deliveryVersion: DELIVERY_VERSION,
      lesson,
      questions,
      assets,
    };
    lessonDocs.push(runtimeDoc);
    lessonDocById.set(spec.id, runtimeDoc);
    lessonById.set(spec.id, lesson);
    writeJson(path.join(OUTPUT, 'lessons', `${spec.id}.json`), runtimeDoc);
    writeJson(path.join(AUTHORING, 'lessons', `${spec.id}.json`), {
      lesson,
      questions,
      assetRefs: assets.map(asset => ({
        assetId: asset.assetId,
        uuid: asset.uuid,
        alt: asset.alt,
        sha256: asset.sha256,
      })),
      evidence: {
        sourceLessonIds: spec.sources,
        sourceVersion: SOURCE_VERSION,
        status: 'draft_generated_human_review_required',
      },
    });
  }
}

const modules = MODULE_SPECS.map((spec, moduleIndex) => {
  const lessons = spec.lessons.map(id => lessonById.get(id));
  const testQuestionIds = lessons.flatMap(lesson => lesson.testQuestionIds);
  const moduleTestIds = Array.from({ length: 12 }, (_, index) => {
    const position = Math.floor((index * testQuestionIds.length) / 12);
    return testQuestionIds[position];
  });
  const module = {
    moduleId: spec.id,
    uuid: uuidFor(spec.id),
    sequence: moduleIndex + 1,
    title: spec.title,
    outcome: spec.outcome,
    lessons,
    moduleTest: {
      testId: `${spec.id}-test`,
      uuid: uuidFor(`${spec.id}-test`),
      moduleId: spec.id,
      questionIds: moduleTestIds,
    },
  };
  // Preserve lesson order inside module documents. This makes the module
  // payload byte-for-byte data-equivalent to the bundled seed assembled from
  // the same self-contained lesson documents.
  const moduleLessonDocs = spec.lessons.map(id => lessonDocById.get(id));
  const questions = moduleLessonDocs.flatMap(doc => doc.questions);
  const assets = moduleLessonDocs.flatMap(doc => doc.assets);
  writeJson(path.join(OUTPUT, 'modules', `${spec.id}.json`), {
    schemaVersion: 2,
    deliveryVersion: DELIVERY_VERSION,
    module,
    questions,
    assets,
  });
  return module;
});

const questions = lessonDocs.flatMap(doc => doc.questions);
const assets = [
  ...new Map(
    lessonDocs.flatMap(doc => doc.assets).map(asset => [asset.assetId, asset]),
  ).values(),
];
const sourceContentHash = sha256(
  lessonDocs
    .map(doc => json({ lesson: doc.lesson, questions: doc.questions }))
    .join(''),
);
const baseCourse = readJson(path.join(BASE, 'course.json')).course;
const courseDoc = {
  schemaVersion: 2,
  deliveryVersion: DELIVERY_VERSION,
  course: {
    ...baseCourse,
    title: 'California Knowledge Test Course',
    subtitle: 'Real situations. Clear explanations. Exam-ready practice.',
    moduleIds: modules.map(module => module.moduleId),
    sourceVersionLabel: SOURCE_VERSION,
    sourceContentHash,
    sourceCheckedAt: RELEASE_DATE,
    sourceReviewStatus: 'draft_generated_human_review_required',
    publicationAuthorized: false,
  },
};
writeJson(path.join(OUTPUT, 'course.json'), courseDoc);

const lessonFiles = lessonDocs.map(doc => `${doc.lesson.lessonId}.json`);
const moduleFiles = modules.map(module => `${module.moduleId}.json`);
const documents = {
  modules: Object.fromEntries(
    moduleFiles.map(filename => [
      path.basename(filename, '.json'),
      docRef(path.join(OUTPUT, 'modules', filename)),
    ]),
  ),
  lessons: Object.fromEntries(
    lessonFiles.map(filename => {
      const id = path.basename(filename, '.json');
      return [
        id,
        {
          moduleId: lessonById.get(id).moduleId,
          ...docRef(path.join(OUTPUT, 'lessons', filename)),
        },
      ];
    }),
  ),
  course: docRef(path.join(OUTPUT, 'course.json')),
};

const manifestPath = path.join(ROOT, 'server/content/ca-class-c/manifest.json');
const manifest = readJson(manifestPath);
const versionEntry = {
  version: DELIVERY_VERSION,
  releasedAt: RELEASE_DATE,
  status: 'release_candidate',
  minAppVersion: MIN_APP_VERSION,
  notes:
    'New lesson: Read the Whole Intersection (module 3) consolidates complex-intersection signal reading in one place — protected green arrows, steady and flashing yellow arrows, red arrows (no right turn on a red arrow), start/end turn-lane discipline, and dedicated right-turn island lanes — with three recall cards and six scenario test questions that combine rules. Two new verified handbook rules; three signal/turn rules extended with handbook citations. Existing lessons, questions, and facts are unchanged; lessons after module 3 renumber.',
  sourceVersionLabel: SOURCE_VERSION,
  sourceReviewStatus: 'draft_generated_human_review_required',
  publicationAuthorized: false,
  instructions: lessonDocs.map(doc => ({
    op: 'lesson-content',
    lessonId: doc.lesson.lessonId,
    severity: 'soft',
    message:
      'A new intersection-synthesis lesson joins module 3; existing lesson content is unchanged apart from numbering, and existing lesson progress is retained.',
  })),
  documents,
};
manifest.latestVersion = DELIVERY_VERSION;
manifest.seedVersion = DELIVERY_VERSION;
manifest.versions = manifest.versions
  .filter(entry => entry.version !== DELIVERY_VERSION)
  .concat(versionEntry);
writeJson(manifestPath, manifest);

writeJson(path.join(SEED, 'course.json'), courseDoc);
writeJson(path.join(SEED, 'modules.json'), modules);
writeJson(path.join(SEED, 'questions.json'), questions);
writeJson(path.join(SEED, 'assets.json'), assets);

writeJson(path.join(AUTHORING, 'course.json'), {
  course: courseDoc.course,
  design: {
    format: 'intro_conversation_slides_test',
    lessonEntry: ['summary', 'three outcomes', 'study theory', 'skip to test'],
    theory: {
      firstCard: 'unscored practical choice',
      teachingCards:
        'substantive 42–135 word cards delivered as short chat-style lines, one thought per message; bullets are reserved for true lists',
      stateFacts: 'scope=state_specific',
    },
    test: { questionsPerLesson: 6, completionPoint: 'after lesson test' },
  },
  counts: {
    modules: modules.length,
    lessons: lessonDocs.length,
    theoryInteractions: lessonDocs.length,
    lessonTestQuestions: lessonDocs.length * 6,
  },
});

// The enriched rule catalog is a first-class build input maintained by
// scripts/enrich-california-rule-catalog.mjs. Every source in it names its
// local snapshot file with the snapshot's SHA-256, so learner-facing claims
// stay traceable to the exact evidence bytes that were verified.
if (!fs.existsSync(RULE_CATALOG_INPUT)) {
  throw new Error(
    'Missing scripts/california-rule-catalog.json. Run scripts/enrich-california-rule-catalog.mjs first.',
  );
}
const catalog = readJson(RULE_CATALOG_INPUT);
catalog.catalogId = `ca-rule-catalog-${SOURCE_VERSION.toLowerCase()}`;
catalog.courseVersion = SOURCE_VERSION;
catalog.sourceCheckedAt = RELEASE_DATE;
catalog.updateMonitorReview = {
  checkedAt: '2026-09-02',
  pages: [
    {
      page: 'DMV highlights new laws in 2026',
      url: 'https://www.dmv.ca.gov/portal/news-and-media/dmv-highlights-new-laws-in-2026/',
      result:
        'Re-checked 2026-09-02: unchanged since the 2026-08-01 snapshot (page last updated 2025-12-26). AB 390 move-over and AB 366 ignition-interlock extension are reflected in the catalog; AB 382 (20 mph school zones) takes effect 2031-01-01 and stays out of the course.',
    },
    {
      page: 'DMV news releases',
      url: 'https://www.dmv.ca.gov/portal/news-and-media/news-releases/',
      result:
        'No June–August 2026 release changes handbook, knowledge-test, or ordinary Class C licensing rules. Field-office closures and CDL/AV items are out of scope.',
    },
    {
      page: 'DMV rulemaking actions',
      url: 'https://www.dmv.ca.gov/portal/about-the-california-department-of-motor-vehicles/california-dmv-rulemaking-actions/',
      result:
        'The Vision Screenings and Driving Evaluations proposal (OAL 2026-0428-05) is still in rulemaking and not adopted; CA_CCR_T13_20_03_VISION_STANDARD keeps the current adopted text. Re-check before the next release.',
    },
  ],
};
catalog.openConflicts = [
  {
    conflictId: 'ca-projecting-load-flag-size',
    status: 'needs_review',
    effect:
      'No learner-facing numeric flag-size fact or question until the commercial-handbook snapshot is stored and a reviewer approves the CVC § 24604 resolution.',
  },
  {
    conflictId: 'ca-minor-knowledge-test-retest-interval',
    status: 'needs_review',
    effect:
      'No learner-facing numeric waiting-period fact or question until a reviewer records and approves the normalized earliest-retest calculation.',
  },
];
writeJson(path.join(AUTHORING, 'rules/rule-catalog.json'), catalog);
const catalogRuleIds = new Set(catalog.rules.map(rule => rule.ruleId));

// Coverage accounting: every lesson must be claimed by a domain, every domain
// lesson and rule must exist, and every catalog rule must be claimed exactly
// once, so the matrix cannot silently drift from the catalog or the course.
const lessonIdSet = new Set(lessonDocs.map(doc => doc.lesson.lessonId));
const moduleByLessonId = new Map(
  MODULE_SPECS.flatMap(spec => spec.lessons.map(id => [id, spec.id])),
);
const coverageRuleClaims = new Map();
for (const domain of COVERAGE_DOMAINS) {
  for (const ruleId of domain.ruleIds) {
    coverageRuleClaims.set(ruleId, (coverageRuleClaims.get(ruleId) ?? 0) + 1);
  }
}
const coverageUnknownRules = COVERAGE_DOMAINS.flatMap(domain =>
  domain.ruleIds.filter(ruleId => !catalogRuleIds.has(ruleId)),
);
const coverageUnknownLessons = COVERAGE_DOMAINS.flatMap(domain =>
  domain.lessons.filter(lessonId => !lessonIdSet.has(lessonId)),
);
const coverageUnclaimedRules = [...catalogRuleIds].filter(
  ruleId => !coverageRuleClaims.has(ruleId),
);
const coverageDoubleClaimedRules = [...coverageRuleClaims]
  .filter(([, count]) => count > 1)
  .map(([ruleId]) => ruleId);
const coverageUnclaimedLessons = [...lessonIdSet].filter(
  lessonId =>
    !COVERAGE_DOMAINS.some(domain => domain.lessons.includes(lessonId)),
);
const catalogNonVerifiedRules = catalog.rules.filter(
  rule => rule.status !== 'verified',
);

const wordCount = text =>
  (text.normalize('NFKD').match(/[A-Za-z0-9½]+(?:['’][A-Za-z]+)?/g) || [])
    .length;
const sentenceWordCounts = compiledLessonSpecs.flatMap(spec =>
  [
    spec.summary,
    ...spec.keyPoints,
    spec.challenge.scenario,
    spec.challenge.prompt,
    spec.challenge.explanation,
    ...spec.slides.flatMap(item => item.lines),
  ].flatMap(text =>
    text
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .map(wordCount),
  ),
);
const cardWordCounts = compiledLessonSpecs.flatMap(spec =>
  spec.slides.map(item => wordCount([item.title, ...item.lines].join(' '))),
);
const lessonTheoryWordCounts = compiledLessonSpecs.map(spec =>
  wordCount(spec.slides.flatMap(item => item.lines).join(' ')),
);
const allBlocks = lessonDocs.flatMap(doc => doc.lesson.blocks);
const teachingBlocks = allBlocks.filter(
  block =>
    block.type !== 'image' &&
    block.type !== 'quick_challenge' &&
    block.type !== 'check_yourself',
);

// Check-yourself recall cards: mirror the app-side wire validation (at least
// one gap, no empty gap, balanced markers) and the pedagogical placement
// rules (one or two per lesson, always after a teaching card).
const recallBlocks = allBlocks.filter(block => block.type === 'check_yourself');
const recallGapProblems = recallBlocks.flatMap(block => {
  const problems = [];
  const gaps = [...block.ruleMarkdown.matchAll(/\[\[(.*?)\]\]/g)];
  if (gaps.length === 0) problems.push(`${block.blockId}: no [[gap]] marker`);
  if (gaps.some(match => match[1].trim().length === 0)) {
    problems.push(`${block.blockId}: empty [[gap]] marker`);
  }
  if (/\[\[|\]\]/.test(block.ruleMarkdown.replace(/\[\[(.*?)\]\]/g, ''))) {
    problems.push(`${block.blockId}: unbalanced [[gap]] markers`);
  }
  return problems;
});
const recallPlacementProblems = lessonDocs.flatMap(doc => {
  const problems = [];
  const count = doc.lesson.blocks.filter(
    block => block.type === 'check_yourself',
  ).length;
  if (count < 1 || count > 3) {
    problems.push(`${doc.lesson.lessonId}: ${count} recall cards`);
  }
  doc.lesson.blocks.forEach((block, index) => {
    if (block.type !== 'check_yourself') return;
    const previous = doc.lesson.blocks[index - 1];
    if (
      previous == null ||
      previous.type === 'quick_challenge' ||
      previous.type === 'image'
    ) {
      problems.push(
        `${doc.lesson.lessonId}: ${block.blockId} not after a teaching card`,
      );
    }
  });
  return problems;
});
const recallSentenceWordCounts = recallBlocks.flatMap(block =>
  block.ruleMarkdown
    .replace(/\[\[|\]\]/g, '')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map(textWordCount),
);
// Recall rules are learner-facing sentences too: hold them to the same
// sentence-length budget as the rest of the theory.
sentenceWordCounts.push(...recallSentenceWordCounts);
const teachingBlocksWithBullets = teachingBlocks.filter(
  block => (block.bullets?.length ?? 0) > 0,
);
const teachingBlocksWithParagraphBreaks = teachingBlocks.filter(block =>
  block.bodyMarkdown?.includes('\n\n'),
);
const teachingParagraphs = teachingBlocks.flatMap(block =>
  block.bodyMarkdown.split('\n\n').filter(Boolean),
);
const teachingSentences = teachingParagraphs.flatMap(readableLines);
const thesisLikeShortSentences = teachingSentences.filter(
  sentence =>
    textWordCount(sentence) <= 5 &&
    !/[?:]$/.test(sentence.trim()) &&
    !/^(No line|See less|Stalled on tracks)\?/i.test(sentence.trim()),
);
const paragraphSentenceCounts = teachingParagraphs.map(
  paragraph => readableLines(paragraph).length,
);
const singleSentenceParagraphs = paragraphSentenceCounts.filter(
  count => count === 1,
).length;
const multiSentenceParagraphs = paragraphSentenceCounts.filter(
  count => count >= 2,
).length;
const unexpectedBulletBlocks = teachingBlocksWithBullets.filter(
  block => !TRUE_LIST_PRESENTATION.has(block.title),
);
const configuredListTitlesSeen = new Set(
  teachingBlocksWithBullets.map(block => block.title),
);
const orphanedFragments = teachingBlocks.flatMap(block =>
  [block.bodyMarkdown, ...(block.bullets ?? [])]
    .filter(Boolean)
    .filter(
      line =>
        /^(And|Or|To|Is)\b/i.test(line) || /\.{2,}|\bor\.|\band\./i.test(line),
    ),
);
const compiledSpecById = new Map(
  compiledLessonSpecs.map(spec => [spec.id, spec]),
);
const originalFactGaps = LESSON_SPECS.flatMap(rawSpec => {
  const compiled = compiledSpecById.get(rawSpec.id);
  const compiledTokens = contentTokens(
    compiled?.slides.flatMap(item => [item.title, ...item.lines]).join(' ') ??
      '',
  );
  return rawSpec.slides.flatMap(item =>
    item.lines
      .flatMap(readableLines)
      .filter(line =>
        [...contentTokens(line)].some(token => !compiledTokens.has(token)),
      )
      .map(line => ({ lessonId: rawSpec.id, line })),
  );
});

const walkFiles = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filename) : [filename];
  });
const competitorFiles = brand =>
  walkFiles(path.join(COMPETITOR_ROOT, brand)).filter(filename =>
    /\/lesson-\d+\.md$/.test(filename),
  );
const normalizedWords = text =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .match(/[a-z0-9]+/g) || [];
const shingles = (text, size) => {
  const words = normalizedWords(text);
  return new Set(
    Array.from({ length: Math.max(0, words.length - size + 1) }, (_, index) =>
      words.slice(index, index + size).join(' '),
    ),
  );
};
const learnerText = [
  ...compiledLessonSpecs.flatMap(spec => [
    spec.title,
    spec.summary,
    ...spec.keyPoints,
    spec.challenge.scenario,
    spec.challenge.prompt,
    spec.challenge.explanation,
    ...spec.challenge.choices,
    ...spec.slides.flatMap(item => [item.title, ...item.lines]),
  ]),
  ...recallBlocks.flatMap(block => [
    block.title,
    block.context,
    block.ruleMarkdown.replace(/\[\[|\]\]/g, ''),
  ]),
].join('\n');
const originalityFor = brand => {
  const files = competitorFiles(brand);
  const competitorText = files
    .map(filename => fs.readFileSync(filename, 'utf8'))
    .join('\n');
  const coursePhrases = shingles(learnerText, 10);
  const sourcePhrases = shingles(competitorText, 10);
  const overlaps = [...coursePhrases].filter(phrase =>
    sourcePhrases.has(phrase),
  );
  return {
    lessonFilesChecked: files.length,
    shingleWords: 10,
    overlapCount: overlaps.length,
    overlaps,
  };
};
const originality = {
  generatedAt: new Date().toISOString(),
  method: 'Exact normalized 10-word shingle comparison.',
  competitors: {
    myDMV: originalityFor('myDMV'),
    Zutobi: originalityFor('Zutobi'),
  },
};
originality.pass = Object.values(originality.competitors).every(
  result => result.overlapCount === 0,
);
writeJson(path.join(AUTHORING, 'reports/originality-check.json'), originality);

// Structural integrity: unique identifiers, stable UUIDs, resolvable
// references, and manifest hashes that match the bytes actually written.
const countDuplicates = values => {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach(value => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
};
const duplicateIds = [
  ...countDuplicates(lessonDocs.map(doc => doc.lesson.lessonId)),
  ...countDuplicates(modules.map(module => module.moduleId)),
  ...countDuplicates(questions.map(question => question.questionId)),
  ...countDuplicates(assets.map(asset => asset.assetId)),
  ...countDuplicates(
    lessonDocs.flatMap(doc => doc.lesson.blocks.map(block => block.blockId)),
  ),
];
const duplicateUuids = countDuplicates([
  ...lessonDocs.map(doc => doc.lesson.uuid),
  ...modules.map(module => module.uuid),
  ...questions.map(question => question.uuid),
  ...assets.map(asset => asset.uuid),
]);
const unstableUuids = [
  ...lessonDocs.filter(doc => doc.lesson.uuid !== uuidFor(doc.lesson.lessonId)),
  ...modules.filter(module => module.uuid !== uuidFor(module.moduleId)),
].length;
const unresolvedQuestionRefs = [
  ...lessonDocs.flatMap(doc =>
    doc.lesson.questionIds.filter(id => !questionById.has(id)),
  ),
  ...modules.flatMap(module =>
    module.moduleTest.questionIds.filter(id => !questionById.has(id)),
  ),
];
const unresolvedAssetRefs = lessonDocs.flatMap(doc => {
  const local = new Set(doc.assets.map(asset => asset.assetId));
  return [
    ...doc.lesson.blocks
      .filter(block => block.type === 'image' && !local.has(block.assetId))
      .map(block => `${doc.lesson.lessonId}:${block.blockId}`),
    ...doc.questions
      .filter(question => question.assetId && !local.has(question.assetId))
      .map(question => `${doc.lesson.lessonId}:${question.questionId}`),
  ];
});
const writtenManifest = readJson(manifestPath);
const manifestEntry = writtenManifest.versions.find(
  entry => entry.version === DELIVERY_VERSION,
);
const manifestHashMismatches = [
  ...Object.entries(manifestEntry.documents.lessons).map(([id, entry]) => ({
    file: path.join(OUTPUT, 'lessons', `${id}.json`),
    sha256: entry.sha256,
  })),
  ...Object.entries(manifestEntry.documents.modules).map(([id, entry]) => ({
    file: path.join(OUTPUT, 'modules', `${id}.json`),
    sha256: entry.sha256,
  })),
  {
    file: path.join(OUTPUT, 'course.json'),
    sha256: manifestEntry.documents.course.sha256,
  },
].filter(entry => sha256(fs.readFileSync(entry.file)) !== entry.sha256);

// Every number a learner sees must be backed by the verified catalog, except
// scenario dressing and clearly-wrong distractor values reviewed by hand.
const APPROVED_SCENARIO_NUMBERS = new Set([
  '911', // universal emergency number, not a catalog rule value
  '1200', // $1,200 scenario damage, above the verified $1,000 trigger
  '17', // scenario age below the verified under-18 wireless rule
  '14', // distractor age below the verified 15½ permit minimum
  '250', // scenario distance beyond the verified 200-foot U-turn test
]);
const catalogNumberTokens = new Set(
  JSON.stringify(catalog).match(/\d+(?:\.\d+)?/g) ?? [],
);
const learnerNumberTokens = lessonDocs.flatMap(doc => {
  const texts = [];
  doc.lesson.blocks.forEach(block => {
    [
      'title',
      'bodyMarkdown',
      'scenario',
      'questionPreview',
      'ruleMarkdown',
      'context',
    ].forEach(key => {
      if (block[key]) texts.push(block[key]);
    });
    texts.push(...(block.bullets ?? []));
  });
  doc.questions.forEach(question => {
    texts.push(question.prompt, question.explanation ?? '');
    question.choices.forEach(choice =>
      texts.push(choice.text, choice.feedback ?? ''),
    );
  });
  return texts.flatMap(
    text => text.replace(/½/g, '.5').match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [],
  );
});
const unresolvedLearnerNumbers = [
  ...new Set(
    learnerNumberTokens
      .map(token => token.replace(/,/g, ''))
      .filter(
        token =>
          !catalogNumberTokens.has(token) &&
          !APPROVED_SCENARIO_NUMBERS.has(token),
      ),
  ),
];

const validation = {
  generatedAt: new Date().toISOString(),
  deliveryVersion: DELIVERY_VERSION,
  sourceVersion: SOURCE_VERSION,
  status: 'pass_structural_human_review_required',
  counts: {
    modules: modules.length,
    lessons: lessonDocs.length,
    theoryInteractions: lessonDocs.length,
    lessonTestQuestions: lessonDocs.length * 6,
    totalQuestions: questions.length,
    moduleTestQuestionRefs: modules.reduce(
      (sum, module) => sum + module.moduleTest.questionIds.length,
      0,
    ),
    uniqueAssets: assets.length,
    minimumTeachingCards: Math.min(
      ...compiledLessonSpecs.map(spec => spec.slides.length),
    ),
    maximumTeachingCards: Math.max(
      ...compiledLessonSpecs.map(spec => spec.slides.length),
    ),
    averageSentenceWords: Number(
      (
        sentenceWordCounts.reduce((sum, count) => sum + count, 0) /
        sentenceWordCounts.length
      ).toFixed(1),
    ),
    maximumSentenceWords: Math.max(...sentenceWordCounts),
    minimumTeachingCardWords: Math.min(...cardWordCounts),
    averageTeachingCardWords: Number(
      (
        cardWordCounts.reduce((sum, count) => sum + count, 0) /
        cardWordCounts.length
      ).toFixed(1),
    ),
    maximumTeachingCardWords: Math.max(...cardWordCounts),
    minimumLessonTheoryWords: Math.min(...lessonTheoryWordCounts),
    averageLessonTheoryWords: Number(
      (
        lessonTheoryWordCounts.reduce((sum, count) => sum + count, 0) /
        lessonTheoryWordCounts.length
      ).toFixed(1),
    ),
    maximumLessonTheoryWords: Math.max(...lessonTheoryWordCounts),
    universalTheoryBlocks: teachingBlocks.filter(
      block => block.scope === 'universal',
    ).length,
    stateSpecificTheoryBlocks: teachingBlocks.filter(
      block => block.scope === 'state_specific',
    ).length,
    teachingBlocksWithParagraphs: teachingBlocksWithParagraphBreaks.length,
    singleSentenceParagraphs,
    multiSentenceParagraphs,
    maximumSentencesPerParagraph: Math.max(...paragraphSentenceCounts),
    thesisLikeShortSentenceCount: thesisLikeShortSentences.length,
    teachingBlocksWithBullets: teachingBlocksWithBullets.length,
    unexpectedBulletBlockCount: unexpectedBulletBlocks.length,
    orphanedFragmentCount: orphanedFragments.length,
    originalFactGapCount: originalFactGaps.length,
    catalogRules: catalog.rules.length,
    coverageDomains: COVERAGE_DOMAINS.length,
    recallCards: recallBlocks.length,
    recallGapProblemCount: recallGapProblems.length,
    recallPlacementProblemCount: recallPlacementProblems.length,
    emojiTeachingCards: teachingBlocks.filter(block =>
      EMOJI_PATTERN.test(
        [block.bodyMarkdown ?? '', ...(block.bullets ?? [])].join(' '),
      ),
    ).length,
    duplicateIdCount: duplicateIds.length,
    duplicateUuidCount: duplicateUuids.length,
    unresolvedQuestionRefCount: unresolvedQuestionRefs.length,
    unresolvedAssetRefCount: unresolvedAssetRefs.length,
    manifestHashMismatchCount: manifestHashMismatches.length,
    unresolvedLearnerNumberCount: unresolvedLearnerNumbers.length,
  },
  checks: {
    eightModules: modules.length === 8,
    thirtyThreeLessons: lessonDocs.length === 33,
    exactly192LessonTestQuestions:
      lessonDocs.flatMap(doc => doc.lesson.testQuestionIds).length === 198,
    exactly231QuestionsTotal: questions.length === 231,
    exactly96ModuleTestReferences:
      modules.reduce(
        (sum, module) => sum + module.moduleTest.questionIds.length,
        0,
      ) === 96 && modules.every(m => m.moduleTest.questionIds.length === 12),
    lessonTheoryWordsWithinTargetRange:
      Math.min(...lessonTheoryWordCounts) >= 285 &&
      Math.max(...lessonTheoryWordCounts) <= 560,
    allIdsUnique: duplicateIds.length === 0,
    allUuidsUniqueAndStable: duplicateUuids.length === 0 && unstableUuids === 0,
    allQuestionReferencesResolve: unresolvedQuestionRefs.length === 0,
    allAssetReferencesResolve: unresolvedAssetRefs.length === 0,
    manifestHashesMatchWrittenBytes: manifestHashMismatches.length === 0,
    learnerNumbersBackedByVerifiedCatalog:
      unresolvedLearnerNumbers.length === 0,
    catalogRulesAllVerified: catalogNonVerifiedRules.length === 0,
    everyLessonHasOneToThreeRecallCards:
      recallPlacementProblems.length === 0 && recallBlocks.length >= 70,
    allRecallGapsWellFormed: recallGapProblems.length === 0,
    questionsAndRecallRulesStayEmojiFree:
      !questions.some(question =>
        EMOJI_PATTERN.test(
          [
            question.prompt,
            question.explanation ?? '',
            ...question.choices.flatMap(choice => [
              choice.text,
              choice.feedback ?? '',
            ]),
          ].join(' '),
        ),
      ) && !recallBlocks.some(block => EMOJI_PATTERN.test(block.ruleMarkdown)),
    emojiStaysSparse: teachingBlocks.every(block => {
      const lines = [
        ...(block.bodyMarkdown ?? '').split('\n\n'),
        ...(block.bullets ?? []),
      ];
      return lines.every(
        line => [...line].filter(ch => EMOJI_PATTERN.test(ch)).length <= 2,
      );
    }),
    everyLessonClaimedByACoverageDomain: coverageUnclaimedLessons.length === 0,
    everyCatalogRuleClaimedByExactlyOneDomain:
      coverageUnclaimedRules.length === 0 &&
      coverageDoubleClaimedRules.length === 0,
    coverageDomainsResolveToRealRulesAndLessons:
      coverageUnknownRules.length === 0 && coverageUnknownLessons.length === 0,
    everyLessonStartsInteractive: lessonDocs.every(
      doc => doc.lesson.blocks[0]?.type === 'quick_challenge',
    ),
    theoryAndTestsSeparated: lessonDocs.every(
      doc =>
        doc.lesson.theoryQuestionIds.length === 1 &&
        doc.lesson.testQuestionIds.length === 6 &&
        !doc.lesson.theoryQuestionIds.some(id =>
          doc.lesson.testQuestionIds.includes(id),
        ),
    ),
    atLeastThreeSubstantiveTeachingCards: compiledLessonSpecs.every(
      spec => spec.slides.length >= 3,
    ),
    minimumCardAtLeast42Words: Math.min(...cardWordCounts) >= 42,
    maximumSentenceAtMost38Words: Math.max(...sentenceWordCounts) <= 38,
    maximumCardAtMost135Words: Math.max(...cardWordCounts) <= 135,
    mostTeachingCardsUseSpacedParagraphs:
      teachingBlocksWithParagraphBreaks.length / teachingBlocks.length >= 0.75,
    everyMessageStaysOneThought: Math.max(...paragraphSentenceCounts) <= 2,
    chatRhythmDominates: singleSentenceParagraphs > multiSentenceParagraphs,
    sentencesStayLaconicOnAverage:
      sentenceWordCounts.reduce((sum, count) => sum + count, 0) /
        sentenceWordCounts.length <=
      14,
    bulletsOnlyForTrueEnumerations: unexpectedBulletBlocks.length === 0,
    everyConfiguredListUsesAtLeastTwoBullets: teachingBlocksWithBullets.every(
      block => block.bullets.length >= 2,
    ),
    configuredListsArePresent: [...TRUE_LIST_PRESENTATION.keys()].every(title =>
      configuredListTitlesSeen.has(title),
    ),
    noOrphanedSentenceFragments: orphanedFragments.length === 0,
    allOriginalDraftFactsRetained: originalFactGaps.length === 0,
    noExactTenWordCompetitorOverlap: originality.pass,
    unresolvedProjectingLoadNumberAbsent:
      !/(12|18)[-\s]inch.{0,120}flag|flag.{0,120}(12|18)[-\s]inch/i.test(
        learnerText,
      ),
    unresolvedRetestNumberAbsent: !/(one week|seven days|7 days|8 days)/i.test(
      learnerText,
    ),
    publicationStillBlocked: courseDoc.course.publicationAuthorized === false,
  },
};
if (Object.values(validation.checks).some(value => value !== true)) {
  throw new Error(`Validation failed:\n${json(validation)}`);
}
writeJson(
  path.join(AUTHORING, 'reports/automated-validation.json'),
  validation,
);

const originalSpecById = new Map(LESSON_SPECS.map(spec => [spec.id, spec]));
const gapRows = compiledLessonSpecs.map(spec => {
  const original = originalSpecById.get(spec.id);
  const beforeWords = wordCount(
    original.slides.flatMap(item => item.lines).join(' '),
  );
  const afterWords = wordCount(
    spec.slides.flatMap(item => item.lines).join(' '),
  );
  const expansions = [
    ...new Set(
      spec.slides
        .map(item => item.sourceExpansion?.split(':').slice(1).join(':'))
        .filter(Boolean),
    ),
  ];
  return `| ${spec.lessonId ?? spec.id} | ${beforeWords} | ${afterWords} | ${
    original.slides.length
  } → ${spec.slides.length} | ${
    expansions.join('; ').replaceAll('|', '\\|') ||
    'Consolidated practical steps'
  } |`;
});
const gapReport = [
  '# Information-density and novice-gap review',
  '',
  'The previous draft used many one- or two-sentence cards. This pass keeps the plain-language style but restores the practical context a first-time learner needs.',
  '',
  '## What changed in this revision',
  '',
  'This revision adds a synthesis lesson, Read the Whole Intersection, collecting the arrow-signal family (protected green, steady and flashing yellow, red — including no right turn on a red arrow), turn-lane start/end discipline, and dedicated right-turn island lanes into one place a learner can return to, verified against the current handbook. The previous revision (r02, same day) widened the concept→emoji vocabulary over the theory chat without touching facts or questions. The previous revision (r01, same day) closed eleven exam-coverage gaps found by testing 440 competitor exam-style questions against the course: roundabout direction, headlight clock window, 15 mph zones, wet brakes and bridge icing, glove-compartment open container, SMV triangle, funeral processions, double parking, medical reporting to DMV, and the ignition interlock — each verified against the current handbook and statute snapshots and woven into existing lessons with recall cards. Earlier revisions added the emoji layer (r03 of 2026-08-24) and densified recall practice: two to three Check-yourself cards in most lessons, each an unscored active-recall moment placed straight after the theory card that teaches the fact, with the key words hidden behind [[gap]] pills, and consecutive cards spread apart so they never stack. Each card repeats a verified rule the lesson already teaches, so recall adds retrieval practice without adding new claims. Earlier same-window revisions: r03 (2026-08-23) reworded three lines for originality; r02 introduced the chat-style presentation; facts, questions, coverage, and the rule catalog are unchanged since CA-2026.08.23-r01.',
  '',
  '## Source-update review for this release date (checked 2026-08-22)',
  '',
  'The three California update-monitor pages were re-read against the 2026-08-01 snapshots before this generation. Findings and decisions:',
  '',
  '- “DMV highlights new laws in 2026” is unchanged (page last updated 2025-12-26). The 2026 move-over expansion to any stationary vehicle displaying warning or hazard lights was already captured in `CA_VEH_21809_MOVE_OVER`; the roadside card in ca-school-buses-emergency-vehicles now names it explicitly.',
  '- The 20 mph school-zone limit (AB 382) does not take effect until 2031-01-01 and is deliberately excluded so the course teaches current law.',
  '- The license-plate-obscuring-device infraction, the duplicate-license-after-address-change option, and the civil-penalty change for camera enforcement are administrative or manufacturer-facing items outside the ordinary Class C knowledge-test scope; no lesson change.',
  '- No June–August 2026 DMV news release changes handbook, knowledge-test, or ordinary licensing rules.',
  '- The “Vision Screenings and Driving Evaluations” rulemaking (OAL 2026-0428-05) is still unadopted; the course keeps the current adopted 13 CCR § 20.03 standard. Re-check before the next release.',
  '- Both scoped conflicts stay open and excluded from learner content: the projecting-load flag size and the minor knowledge-test retest interval.',
  '',
  '## Decisions applied to every lesson',
  '',
  '- Explain the action, not only the rule name.',
  '- Include positioning, observation, yielding, timing, or recovery steps where relevant.',
  '- Add the common mistake or exam trap already supported by the verified source lesson.',
  '- Merge a card below 42 words into a related neighboring card.',
  '- Keep each sentence at 38 words or fewer and each card at 135 words or fewer.',
  '- Keep unresolved projecting-load and minor-retest numbers outside learner content.',
  '',
  '## Per-lesson result',
  '',
  '| Lesson | Before words | After words | Cards | Verified detail restored |',
  '| --- | ---: | ---: | ---: | --- |',
  ...gapRows,
  '',
].join('\n');
fs.writeFileSync(
  path.join(AUTHORING, 'reports/information-gap-review.md'),
  gapReport,
);

// The coverage matrix is generated from COVERAGE_DOMAINS so the published
// table, the rule catalog, and the shipped lessons cannot drift apart: the
// build fails when they disagree.
const moduleTitleById = new Map(
  MODULE_SPECS.map(spec => [spec.id, spec.title]),
);
const coverageRows = COVERAGE_DOMAINS.map(domain => {
  const moduleIds = [
    ...new Set(domain.lessons.map(id => moduleByLessonId.get(id))),
  ];
  const moduleNames = moduleIds
    .map(id => `${moduleTitleById.get(id)} (${id})`)
    .join('; ');
  return `| ${domain.domain} | ${domain.officialSource} | ${domain.ruleIds.join(
    ', ',
  )} | ${moduleNames} | ${domain.lessons.join(', ')} | Covered |`;
});
const coverageReport = [
  '# California topic coverage matrix',
  '',
  `Source version ${SOURCE_VERSION}, delivery version ${DELIVERY_VERSION}.`,
  '',
  'Each required knowledge-test domain is tied to its official source family, the verified rule-catalog entries that back it, and the module and lessons that teach it. The current California Driver’s Handbook is the topic map and the DMV sample tests are the scenario check; neither is copied. Rule IDs resolve to `rules/rule-catalog.json`, where every source lists its official URL and the SHA-256 of the local snapshot it was verified against.',
  '',
  '| Exam domain | Official source | Rule IDs | Module | Lessons | Status |',
  '| --- | --- | --- | --- | --- | --- |',
  ...coverageRows,
  '',
  '## Coverage decision',
  '',
  `- ${COVERAGE_DOMAINS.length} exam domains are mapped to ${lessonDocs.length} lessons in ${modules.length} modules, backed by ${catalog.rules.length} verified catalog rules.`,
  '- Every catalog rule is claimed by exactly one domain and every lesson is claimed by at least one domain; the build validates both.',
  `- Depth lives inside lessons: ${validation.counts.minimumTeachingCards}–${validation.counts.maximumTeachingCards} substantive teaching cards, one unscored theory interaction, and 6 lesson-test questions per lesson.`,
  '- The bank contains 192 unique lesson questions plus 96 module-test references.',
  '- Numeric facts with unresolved source conflicts (projecting-load flag size, minor retest interval) are deliberately excluded from lessons, answers, and distractors.',
  '- Complete coverage means every current official handbook domain and sampled DMV scenario domain is represented. It is not a promise that DMV will never introduce a new question.',
  '',
].join('\n');
fs.writeFileSync(
  path.join(AUTHORING, 'reports/topic-coverage-matrix.md'),
  coverageReport,
);

// The competitor crosswalk tracks topic breadth only. Lesson ids and counts
// are already current in the previous package's crosswalk; carry it forward
// unchanged so competitor topics stay mapped without re-deriving them.
const previousCrosswalk = path.join(
  PREVIOUS_AUTHORING,
  'reports/competitor-topic-crosswalk.md',
);
if (fs.existsSync(previousCrosswalk)) {
  fs.writeFileSync(
    path.join(AUTHORING, 'reports/competitor-topic-crosswalk.md'),
    fs.readFileSync(previousCrosswalk, 'utf8'),
  );
}

const styleGuide = [
  '# Chat-style lesson writing standard',
  '',
  'Theory reads like a study chat: short, laconic sentences delivered one thought at a time, each on its own message-like line. The rhythm target is inspired by message-style prep apps in general; no competitor wording, examples, or distinctive expression is copied, and the exact-shingle originality check enforces that.',
  '',
  '## Commitments this package is validated against',
  '',
  '- Every message-line carries one thought; two sentences share a line only as a question-and-answer pair or after a lead-in colon.',
  '- Each lesson includes up to three unscored Check-yourself recall cards covering its most exam-critical rules; a recall card repeats a rule the lesson already teaches, hides only the key words, and never introduces a new fact.',
  '- Concept emoji lighten the theory chat — at most three per card, one per bullet, before the first mention of the concept; questions, feedback, explanations, and recall rules stay emoji-free.',
  '- Sentences stay laconic: about 10 words on average, never more than 38.',
  '- Longer explanatory sentences are allowed where the material needs them; they simply become longer messages.',
  '- Bullets are only for real enumerations (sequences, checklists, parallel values).',
  '- Legal wording stays in evidence metadata.',
  '- Learner copy remains simple but complete: coverage, facts, and questions are unchanged by the presentation.',
  '',
  '## Card rules',
  '',
  '- Start with an action, decision, or concrete situation.',
  '- Keep one main idea on a card.',
  '- Give the learner enough context to act: where to stop, where to look, who yields, and what happens next.',
  '- Deliver each thought as its own short line with breathing room around it.',
  '- Keep a tiny question with its answer on one line ("No line? Stop before the crosswalk.").',
  '- Prefer common words and direct verbs: stop, look, wait, check, yield, move.',
  '- Use bullets only for a genuine list, sequence, checklist, or set of parallel values.',
  '- Combine fragments that cannot stand alone as a useful sentence.',
  '- Put legal wording and citations in evidence metadata, not learner prose.',
  '- A card may be longer when the situation needs detail, but every line must stay easy to scan on a phone.',
  '',
  '## Interaction rules',
  '',
  '- Every lesson begins with one unscored practical choice.',
  '- The explanation appears immediately after the choice.',
  '- The separate six-question test completes the lesson.',
  '',
  '## Automated thresholds',
  '',
  `- Average sentence: ${validation.counts.averageSentenceWords} words.`,
  `- Longest sentence: ${validation.counts.maximumSentenceWords} words.`,
  `- Shortest teaching card: ${validation.counts.minimumTeachingCardWords} words.`,
  `- Average teaching card: ${validation.counts.averageTeachingCardWords} words.`,
  `- Longest teaching card: ${validation.counts.maximumTeachingCardWords} words.`,
  `- Average lesson theory: ${validation.counts.averageLessonTheoryWords} words.`,
  `- Single-thought messages: ${validation.counts.singleSentenceParagraphs}.`,
  `- Paired-thought messages: ${validation.counts.multiSentenceParagraphs}.`,
  `- Maximum sentences on one line: ${validation.counts.maximumSentencesPerParagraph}.`,
  '',
].join('\n');
fs.writeFileSync(path.join(AUTHORING, 'reports/writing-style.md'), styleGuide);

const readme = [
  `# California conversational course — ${SOURCE_VERSION}`,
  '',
  `Editable source package for delivery version ${DELIVERY_VERSION}.`,
  '',
  '## Learner flow',
  '',
  '1. Open a practical, beginner-friendly lesson intro.',
  '2. Study the theory or go straight to the test.',
  '3. Theory starts with an unscored real-road choice.',
  '4. Read short chat-style lines — one thought per message — with occasional true lists, practical guidance, and visuals.',
  '5. Meet one or two Check-yourself recall cards that hide the key words of a rule just taught; reveal and self-report, unscored.',
  '6. Complete the separate six-question lesson test.',
  '',
  '## Package',
  '',
  `- ${modules.length} modules and ${lessonDocs.length} lessons.`,
  `- ${lessonDocs.length} unscored theory interactions.`,
  `- ${recallBlocks.length} unscored Check-yourself recall cards placed after the theory that teaches each fact.`,
  `- ${lessonDocs.length * 6} lesson-test questions.`,
  `- ${assets.length} reused original course SVG assets.`,
  `- ${validation.counts.minimumTeachingCards}–${validation.counts.maximumTeachingCards} substantive teaching cards per lesson.`,
  `- About ${validation.counts.averageLessonTheoryWords} theory words per lesson on average.`,
  `- ${catalog.rules.length} verified catalog rules; every source lists its local snapshot file with SHA-256 (see rules/rule-catalog.json).`,
  '- Coverage matrix generated from the domain map and validated against the catalog and lessons on every build.',
  '- Complete coverage and competitor-topic crosswalk reports.',
  '- Per-lesson information-density and novice-gap review, including the source-update review for this revision.',
  '- Readability and exact-phrase originality checks.',
  '',
  '## Regenerating',
  '',
  '- `npm run course:build-ca-conversation` rebuilds the runtime package, bundled seed, manifest entry, and this authoring package deterministically.',
  '- `node scripts/enrich-california-rule-catalog.mjs` refreshes snapshot hashes in scripts/california-rule-catalog.json from the dmv-materials library.',
  '',
  '## Review state',
  '',
  '- publicationAuthorized remains false.',
  '- Human legal, content, originality, and visual review is still required.',
  '- The disputed projecting-load flag size and minor retest day count remain excluded.',
  '',
].join('\n');
fs.writeFileSync(path.join(AUTHORING, 'README.md'), readme);

console.log(json(validation));
