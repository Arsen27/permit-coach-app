import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_VERSION = '1.0.0';
const DELIVERY_VERSION = '2.0.0';
const SOURCE_VERSION = 'CA-2026.08.20-r01';
const RELEASE_DATE = '2026-08-20';
// The generation before the conversation course. Releases live in the content
// server's database now, so this reads a base package (npm run course:export)
// and writes one — it no longer touches a server tree or a bundled seed.
const BASE = path.join(
  ROOT,
  'out',
  'course-packages',
  `ca-class-c-${BASE_VERSION}`,
);
const OUTPUT = path.join(
  ROOT,
  'out',
  'course-packages',
  `ca-class-c-${DELIVERY_VERSION}`,
);
const AUTHORING = path.join(
  ROOT,
  'courses/California_DMV_Course_CA2026.08.20r01_Slides',
);
const COMPETITOR_ROOT =
  process.env.DMV_COMPETITOR_ROOT || path.resolve(ROOT, '../dmv-competitors');

const officialSources = [
  {
    name: 'California Driver’s Handbook',
    url: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/',
    use: 'Topic map and exam-preparation scope only; no copied prose or artwork.',
  },
  {
    name: 'California DMV sample knowledge tests',
    url: 'https://www.dmv.ca.gov/portal/driver-education-and-safety/educational-materials/sample-driver-license-dl-knowledge-tests/',
    use: 'Current question-domain coverage and scenario patterns only.',
  },
  {
    name: 'California Legislative Information',
    url: 'https://leginfo.legislature.ca.gov/faces/codes.xhtml',
    use: 'Primary-law facts and state-specific values.',
  },
  {
    name: 'California MUTCD',
    url: 'https://dot.ca.gov/programs/safety-programs/camutcd',
    use: 'Official traffic-control-device meanings and classifications.',
  },
];

const intro = (summary, keyPoints, supplements, question, sources = []) => ({
  summary,
  keyPoints,
  supplements,
  question,
  sources,
});

const slide = (
  title,
  bodyMarkdown,
  bullets,
  scope = 'universal',
  sourceRefs = [],
) => ({ title, bodyMarkdown, bullets, scope, sourceRefs });

const testQuestion = (
  prompt,
  choices,
  correct,
  explanation,
  scope = 'universal',
) => ({ prompt, choices, correct, explanation, scope });

const ENRICHMENT = {
  'ca-sign-shapes-and-colors': intro(
    'Learn the visual shortcuts that tell you what a sign is trying to do before you can read every detail.',
    [
      'Sort signs into regulatory, warning, and guide families.',
      'Recognize the shapes with a unique meaning.',
      'Use color as a clue, then obey the exact message.',
    ],
    [
      slide(
        'Use a three-step scan',
        'A sign is easier to read when you do not treat it as one big picture.',
        [
          'First: identify the family from shape and color.',
          'Second: read the symbol, words, arrow, or plaque.',
          'Third: turn the message into an action you can take now.',
        ],
      ),
      slide(
        'The exact message always wins',
        'Shape and color help you predict a sign, but they do not replace its actual instruction.',
        [
          'A plaque may limit a rule to certain hours or vehicles.',
          'An overhead sign may control only the lane below it.',
          'Road conditions and an officer’s directions can change what you do next.',
        ],
      ),
    ],
    testQuestion(
      'You recognize a sign’s color but cannot yet see its symbol. What is the best next step?',
      [
        'Treat the color as the complete instruction',
        'Use the color to identify the family, then read the exact message',
        'Ignore the sign until you are beside it',
      ],
      1,
      'Color is an early clue. The symbol, words, placement, and plaques give the exact instruction.',
    ),
  ),
  'ca-regulatory-signs': intro(
    'Turn regulatory signs into clear actions: stop, yield, enter, turn, park, or stay out.',
    [
      'Separate a required stop from a yield decision.',
      'Read which lane, vehicle, movement, or time is controlled.',
      'Know when an authorized officer’s direction takes priority.',
    ],
    [
      slide(
        'Read regulatory signs as verbs',
        'The fastest exam strategy is to ask what action the sign controls.',
        [
          'STOP means make a complete stop at the lawful stopping point.',
          'YIELD means give way and stop if needed.',
          'Turn, entry, speed, lane-use, and parking signs control a specific choice.',
        ],
      ),
      slide(
        'Temporary direction can override the normal pattern',
        'Traffic may be directed differently during an emergency, collision, or special operation.',
        [
          'Follow a peace officer or other person legally authorized to direct traffic.',
          'Keep watching for pedestrians and drivers who may not understand the temporary pattern.',
          'Do not assume obeying a signal gives you the right-of-way over someone already in danger.',
        ],
        'state_specific',
        ['CVC §2410'],
      ),
    ],
    testQuestion(
      'A police officer waves you through an intersection while your signal is red. What should you do?',
      [
        'Wait for green in every case',
        'Follow the officer’s direction while checking that the path is safe',
        'Reverse away from the intersection',
      ],
      1,
      'An authorized traffic direction takes priority over the ordinary signal, but you must still move carefully.',
      'state_specific',
    ),
    ['CVC §2410'],
  ),
  'ca-warning-and-guide-signs': intro(
    'Recognize hazards early, find your route without sudden moves, and approach railroad crossings with a clear escape path.',
    [
      'Respond to warnings before reaching the hazard.',
      'Use guide signs for routes, destinations, and services.',
      'Never enter tracks unless your vehicle can clear them.',
    ],
    [
      slide(
        'Warning signs buy you time',
        'A warning sign does not tell you one fixed speed or maneuver. It tells you to prepare.',
        [
          'Look farther ahead for the condition shown.',
          'Adjust speed and lane position before the hazard.',
          'Expect the risk to be hidden around a curve, hill, work area, or crossing.',
        ],
      ),
      slide(
        'Railroad and rail-transit crossings need an exit',
        'Do not start across tracks unless there is enough room for your whole vehicle on the far side.',
        [
          'Stop when required by a signal, gate, flagger, or approaching rail vehicle.',
          'Never drive around, under, or through a closed or moving gate.',
          'Treat stopped traffic beyond the tracks as a reason to wait before the crossing.',
        ],
        'state_specific',
        ['CVC §§22451, 22526'],
      ),
    ],
    testQuestion(
      'Traffic is stopped just beyond railroad tracks. When may you enter the crossing?',
      [
        'As soon as the vehicle ahead begins moving',
        'Only when there is enough room to clear the tracks completely',
        'Whenever no train is visible',
      ],
      1,
      'You need a clear space beyond the tracks before entering, even when no train is currently visible.',
      'state_specific',
    ),
    ['CVC §§22451, 22526'],
  ),
  'ca-traffic-signals': intro(
    'Read signal colors and arrows as decisions, then check the intersection before you move.',
    [
      'Handle steady, flashing, arrow, and dark signals.',
      'Know that green is permission to proceed only when the path is clear.',
      'Avoid entering an intersection you cannot clear.',
    ],
    [
      slide(
        'A green signal is not a guarantee',
        'Green allows movement, but it does not make a blocked or unsafe path legal.',
        [
          'Yield to pedestrians and vehicles still in the intersection.',
          'Do not enter if traffic will leave you stopped in the intersection.',
          'Check again before turning, especially for bicycles and pedestrians.',
        ],
      ),
      slide(
        'If the signal is dark',
        'A signal that has lost power needs a cautious, predictable response.',
        [
          'Slow down and prepare to stop.',
          'Treat the intersection like an all-way stop unless a sign or officer directs otherwise.',
          'Take turns and do not assume another driver has noticed the outage.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'Your light is green, but traffic is backed up across the intersection. What should you do?',
      [
        'Enter and wait in the intersection',
        'Stay out until you can clear the intersection',
        'Drive around the queue using the opposing lane',
      ],
      1,
      'Do not enter an intersection unless there is enough space on the other side for your vehicle.',
      'state_specific',
    ),
    ['CVC §22526'],
  ),
  'ca-road-markings-and-curbs': intro(
    'Use line color, line pattern, arrows, limit lines, and curb colors to understand where you may drive or stop.',
    [
      'Separate traffic moving together from opposing traffic.',
      'Know when a broken line permits a maneuver and a solid line restricts it.',
      'Read arrows, limit lines, crosswalks, and curb colors together.',
    ],
    [
      slide(
        'Read markings in layers',
        'One marking rarely tells the whole story.',
        [
          'Color tells you whether traffic usually moves in the same or opposite directions.',
          'Broken or solid patterns show where crossing is permitted or restricted.',
          'Arrows and words assign movements to particular lanes.',
        ],
      ),
      slide(
        'The stopping point comes before the conflict',
        'Limit lines and crosswalk markings show where the front of your vehicle should stop.',
        [
          'Stop before the limit line when one is present.',
          'If there is no limit line, stop before the crosswalk.',
          'Move forward only as needed for visibility after the required stop and after yielding.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'At a stop sign with a marked limit line, where should your vehicle first stop?',
      ['Past the crosswalk', 'Before the limit line', 'Beside the stop sign'],
      1,
      'The marked limit line is the first lawful stopping point.',
      'state_specific',
    ),
  ),
  'ca-uncontrolled-intersections': intro(
    'Make safe right-of-way decisions when signs or signals do not settle who goes first.',
    [
      'Slow early and identify every possible conflict.',
      'Apply arrival order and right-side rules without forcing priority.',
      'Handle narrow mountain roads and blocked views safely.',
    ],
    [
      slide(
        'Right-of-way is a conflict rule, not a reward',
        'The goal is to prevent two road users from choosing the same space.',
        [
          'Slow enough to see cross traffic, bicycles, and pedestrians.',
          'Yield when the rule requires it or when proceeding would cause a crash.',
          'Do not insist on priority when another person is already moving into the conflict.',
        ],
      ),
      slide(
        'Narrow mountain roads have a special problem',
        'When two vehicles meet on a steep, narrow road and neither can pass, the vehicle facing downhill is generally better able to back up.',
        [
          'The descending vehicle must yield and back up when necessary.',
          'Use the nearest safe place rather than squeezing past.',
          'Drive at a speed that lets you stop within the road you can see.',
        ],
        'state_specific',
        ['CVC §21661'],
      ),
    ],
    testQuestion(
      'Two vehicles meet on a steep, narrow California road where neither can pass. Which driver normally yields and backs up?',
      [
        'The driver facing uphill',
        'The driver facing downhill',
        'The driver in the larger vehicle',
      ],
      1,
      'California law generally places this duty on the descending driver when backing is necessary to pass safely.',
      'state_specific',
    ),
    ['CVC §21661'],
  ),
  'ca-stop-yield-entering-traffic': intro(
    'Choose the correct stopping point, yield to the people already in the conflict, and enter only when the gap is truly usable.',
    [
      'Make a complete stop in the correct place.',
      'Yield to pedestrians and traffic close enough to be a hazard.',
      'Avoid blocking crosswalks, intersections, or tracks.',
    ],
    [
      slide(
        'Stop, look, then creep only if needed',
        'A blocked view does not erase the first required stop.',
        [
          'Stop at the limit line, crosswalk, or intersection edge as the situation requires.',
          'After stopping and yielding, edge forward slowly for a better view.',
          'Stop again if a new conflict appears.',
        ],
      ),
      slide(
        'Do not enter a space you cannot leave',
        'A green light or your turn at a stop does not allow you to block the conflict area.',
        [
          'Wait before an intersection when traffic is backed up beyond it.',
          'Wait before tracks until your entire vehicle can fit on the far side.',
          'Keep crosswalks clear for pedestrians and mobility-device users.',
        ],
        'state_specific',
        ['CVC §22526'],
      ),
    ],
    testQuestion(
      'After a complete stop, a building still blocks your view of cross traffic. What should you do?',
      [
        'Accelerate through before traffic arrives',
        'Creep forward slowly after yielding until you can see',
        'Sound the horn and enter without looking',
      ],
      1,
      'After the required stop, move forward only as needed and continue checking for conflicts.',
    ),
  ),
  'ca-turns-and-signals': intro(
    'Prepare turns early, choose the correct lane, communicate, and finish in a legal lane without cutting across traffic.',
    [
      'Signal early enough to warn others.',
      'Start and finish turns from the proper position.',
      'Handle red lights, one-way streets, bicycles, and transit lanes.',
    ],
    [
      slide(
        'A turn has four decisions',
        'Break every turn into the same short sequence.',
        [
          'Choose the legal lane before the turn.',
          'Signal and reduce speed while checking all sides.',
          'Yield to pedestrians, bicycles, and opposing traffic.',
          'Complete the turn into a legal lane without drifting.',
        ],
      ),
      slide(
        'Some restricted lanes allow a necessary turn',
        'A transit-only or bicycle lane is not a general travel lane, but a posted or statutory exception may allow entry for a turn.',
        [
          'Check signs and markings before entering.',
          'Enter only where and when permitted for the maneuver.',
          'Yield to users already traveling in that lane.',
        ],
        'state_specific',
        ['CVC §21655.1'],
      ),
    ],
    testQuestion(
      'Before crossing a bicycle lane to make a permitted right turn, what must you do?',
      [
        'Stop in the travel lane until every bicycle is out of sight',
        'Check for and yield to bicyclists before entering the lane legally',
        'Use the bicycle lane as a passing lane',
      ],
      1,
      'Enter a bicycle lane for a turn only where allowed, after checking for and yielding to bicyclists.',
      'state_specific',
    ),
  ),
  'ca-u-turns-starting-backing': intro(
    'Start, back, and reverse direction only where visibility, space, and law make the movement safe.',
    [
      'Check around the vehicle before moving from a stopped position.',
      'Back slowly while looking in the direction of travel.',
      'Know where U-turns are allowed, restricted, or unsafe.',
    ],
    [
      slide(
        'Backing needs a direct view',
        'Mirrors and cameras help, but they do not show every person or object.',
        [
          'Walk around the vehicle first when the area may hide a child or obstacle.',
          'Look over the appropriate shoulder and back at walking speed.',
          'Stop whenever your view becomes uncertain.',
        ],
      ),
      slide(
        'Never trade one hazard for another',
        'A missed turn or driveway is not an emergency.',
        [
          'Continue to a place where you can turn around legally.',
          'Do not back on a freeway or across traffic to recover a missed exit.',
          'Make a U-turn only when it is legal and you can see far enough in both directions.',
        ],
      ),
    ],
    testQuestion(
      'You miss your freeway exit. What is the safest response?',
      [
        'Back along the shoulder',
        'Continue to the next exit',
        'Make a U-turn through the median',
      ],
      1,
      'Continue to the next exit. Never back up or make an unsafe reversal to recover a missed freeway exit.',
    ),
  ),
  'ca-crosswalks-and-roundabouts': intro(
    'Protect pedestrians and move through roundabouts without turning a shared space into a guessing game.',
    [
      'Treat marked and unmarked crosswalks as real conflict zones.',
      'Give extra care to blind pedestrians and people using mobility devices.',
      'Yield before entering a roundabout and choose your lane early.',
    ],
    [
      slide(
        'Crosswalk safety starts before the paint',
        'A pedestrian may be difficult to see until you are very close.',
        [
          'Scan sidewalks, corners, parked vehicles, and median islands.',
          'Do not pass a vehicle stopped at a crosswalk.',
          'Wait until the pedestrian is safely out of your path before proceeding.',
        ],
      ),
      slide(
        'Blind pedestrians use specific cues',
        'A white cane or guide dog tells you that a pedestrian may rely on traffic sounds and predictable vehicle movement.',
        [
          'Stop and yield; do not use the horn to invite the person across.',
          'Do not block the crosswalk or stop so close that engine noise is misleading.',
          'Remain still until the person is safely clear of your path.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'A blind pedestrian with a white cane is waiting to cross. What should you do?',
      [
        'Honk to signal that you are stopping',
        'Stop, remain predictable, and yield',
        'Drive through quickly before the pedestrian steps out',
      ],
      1,
      'Yield and stay predictable. Do not use the horn as an invitation because it can confuse a pedestrian who relies on sound.',
      'state_specific',
    ),
  ),
  'ca-choosing-changing-lanes': intro(
    'Choose a useful lane, check the space you cannot see, and change lanes without making another driver rescue the maneuver.',
    [
      'Plan lane choice from destination, signs, and traffic flow.',
      'Use mirrors, a signal, and a shoulder check.',
      'Recognize blind spots, traffic breaks, and lane-control instructions.',
    ],
    [
      slide(
        'A signal asks; it does not reserve space',
        'Your turn signal communicates intent but does not give you the right to move.',
        [
          'Check mirrors for traffic approaching from behind.',
          'Look over your shoulder for the blind spot.',
          'Move only when the gap is large enough without forcing another driver to brake.',
        ],
      ),
      slide(
        'Traffic breaks create a temporary pattern',
        'Law enforcement may slow or weave across lanes to create space ahead for a hazard or operation.',
        [
          'Do not try to pass the patrol vehicle.',
          'Reduce speed smoothly and follow its directions.',
          'Expect stopped traffic or an incident beyond the point you can see.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'You signal a lane change, but a vehicle is still in your blind spot. What should you do?',
      [
        'Move because the signal gives you priority',
        'Wait until the blind spot and target gap are clear',
        'Speed up and force the other driver behind you',
      ],
      1,
      'A signal communicates your plan; it never makes an unsafe gap available.',
    ),
  ),
  'ca-passing-rules': intro(
    'Decide whether passing is legal, visible, and worth the risk before you leave your lane.',
    [
      'Check markings, signs, sight distance, and oncoming traffic.',
      'Pass only with enough room to return safely.',
      'Know how to respond when another driver passes you.',
    ],
    [
      slide(
        'Passing needs a complete plan',
        'Do not begin with only enough space to pull out.',
        [
          'See the full distance needed to pass and return.',
          'Check for driveways, intersections, hills, curves, and changing markings.',
          'Cancel the pass early if any part of the plan becomes uncertain.',
        ],
      ),
      slide(
        'Do not create a new road to get around someone',
        'The shoulder and unpaved area are not ordinary passing lanes.',
        [
          'Do not leave the paved or main-traveled part of the roadway to pass.',
          'When being passed, hold a steady course and do not increase speed.',
          'Make room when safe instead of competing with the passing driver.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'Another driver begins passing you on a two-lane road. What should you do?',
      [
        'Increase speed so the driver returns behind you',
        'Keep a steady course and do not increase speed',
        'Move toward the centerline',
      ],
      1,
      'Be predictable and do not increase speed while another vehicle is passing.',
    ),
  ),
  'ca-freeway-merging': intro(
    'Use ramps to build a safe gap, match traffic appropriately, and recover calmly when you miss an exit.',
    [
      'Scan freeway traffic before the acceleration lane ends.',
      'Merge at a speed that fits a safe available gap.',
      'Exit from the proper lane and never back up for a missed exit.',
    ],
    [
      slide(
        'Use the ramp to prepare, not to pause',
        'The acceleration lane gives you time to observe traffic and adjust speed.',
        [
          'Find a gap before you reach the merge point.',
          'Match the flow without exceeding a safe and legal speed.',
          'Yield to freeway traffic already in the lane.',
        ],
      ),
      slide(
        'Ramp signals control the start of the merge',
        'A metering signal spaces vehicles entering a freeway.',
        [
          'Stop at red at the marked line.',
          'Proceed on green for the number of vehicles shown by the sign.',
          'After the signal, use the rest of the ramp to merge normally.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'When entering a freeway, what is the main purpose of the acceleration lane?',
      [
        'To stop until the freeway is empty',
        'To find a gap and adjust to a safe merging speed',
        'To pass freeway traffic on the right shoulder',
      ],
      1,
      'Use the acceleration lane to observe traffic, choose a gap, and adjust speed before merging.',
    ),
  ),
  'ca-special-lanes': intro(
    'Read the signs and markings that control HOV, bicycle, center turn, turnout, and transit-only lanes.',
    [
      'Identify who may use a special lane and when.',
      'Enter or leave only where markings and rules allow.',
      'Do not turn a special-purpose lane into a passing lane.',
    ],
    [
      slide(
        'The sign defines the lane',
        'A special lane’s rules may change by location, time, direction, or vehicle.',
        [
          'Read occupancy, vehicle, time, and toll conditions before entering.',
          'Follow solid and broken access markings.',
          'Do not assume a rule from one freeway applies to another.',
        ],
      ),
      slide(
        'Transit-only and turnout lanes solve different problems',
        'Transit lanes reserve space for specified vehicles; turnouts let a slower vehicle release a queue.',
        [
          'Do not use a transit-only lane as a general travel lane.',
          'Use a turnout when required and safe to let following traffic pass.',
          'Reenter only after checking for a safe gap.',
        ],
        'state_specific',
        ['CVC §21655.1'],
      ),
    ],
    testQuestion(
      'Before entering an HOV or toll lane, what should you rely on?',
      [
        'The rule from the last freeway you used',
        'The signs and markings for that lane and time',
        'Whether another car entered ahead of you',
      ],
      1,
      'Special-lane conditions vary. Read the posted occupancy, vehicle, time, toll, and access rules.',
    ),
  ),
  'ca-speed-laws': intro(
    'Choose a speed that is legal for the location and safe for the actual conditions—not merely the number on a sign.',
    [
      'Apply California’s Basic Speed Law.',
      'Know the common maximum and special-condition limits tested by DMV.',
      'Reduce speed for visibility, traffic, surface, and vulnerable road users.',
    ],
    [
      slide(
        'A posted maximum is not a target',
        'The safe speed can be lower than the sign when conditions reduce your margin.',
        [
          'Slow for rain, fog, darkness, curves, hills, traffic, and road work.',
          'Choose a speed that lets you stop within the distance you can see.',
          'Never drive faster than is safe for current conditions.',
        ],
        'state_specific',
      ),
      slide(
        'Special limits depend on exact conditions',
        'Exam questions often attach a number to a very specific place or visibility condition.',
        [
          'Read whether the question describes an uncontrolled railroad crossing, an alley, a blind intersection, a school area, or another special location.',
          'Do not transfer a special limit to every crossing or every neighborhood.',
          'When signs or conditions require a lower speed, use the lower safe speed.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'The posted speed is 55 mph, but heavy fog limits how far you can see. What controls your safe speed?',
      [
        'The posted number alone',
        'A lower speed that is reasonable for visibility and conditions',
        'The speed of the fastest vehicle nearby',
      ],
      1,
      'California’s Basic Speed Law requires a reasonable and prudent speed for actual conditions.',
      'state_specific',
    ),
  ),
  'ca-following-distance-scanning': intro(
    'Build time and space around your vehicle so you can see trouble, decide, and stop without panic.',
    [
      'Scan far ahead and keep checking mirrors.',
      'Choose more following space as risk increases.',
      'Handle tailgaters without braking suddenly or racing.',
    ],
    [
      slide(
        'Stopping is more than braking',
        'Your vehicle keeps moving while you see a hazard and decide what to do.',
        [
          'Perception distance passes before you recognize the problem.',
          'Reaction distance passes before your foot begins braking.',
          'Braking distance changes with speed, tires, brakes, slope, and road surface.',
        ],
      ),
      slide(
        'Give a tailgater an easy way out',
        'Trying to teach a close follower a lesson increases the danger.',
        [
          'Increase the space ahead so you can slow gradually.',
          'Change lanes or use a turnout when safe.',
          'Avoid sudden braking, speeding up, or blocking a pass.',
        ],
      ),
    ],
    testQuestion(
      'A driver is following too closely behind you. What is the safest response?',
      [
        'Brake sharply to make the driver back off',
        'Increase space ahead and let the driver pass when safe',
        'Speed far above the limit',
      ],
      1,
      'Create more room ahead and allow the tailgater to pass safely instead of escalating the risk.',
    ),
  ),
  'ca-parking-and-curbs': intro(
    'Park legally, secure the vehicle on hills, and keep clear of places where a stopped car creates danger.',
    [
      'Read curb colors and posted restrictions.',
      'Use the correct hill-parking wheel direction.',
      'Know the basic steps for parallel parking and leaving the curb.',
    ],
    [
      slide(
        'Parallel parking is a slow positioning task',
        'Accuracy comes from low speed and repeated checks, not one fast steering move.',
        [
          'Signal and stop beside the vehicle ahead of the space.',
          'Check mirrors, blind spots, pedestrians, bicycles, and traffic.',
          'Back slowly into the space, straighten, and center without touching other vehicles.',
        ],
      ),
      slide(
        'Secure the vehicle before you leave',
        'Wheel direction is only one part of hill parking.',
        [
          'Set the parking brake and place the transmission in Park or the proper gear.',
          'Turn the wheels so a rolling vehicle moves toward the curb or edge rather than traffic.',
          'Before pulling out, signal and check traffic and blind spots.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'After parking on a hill, what should you do in addition to turning the wheels correctly?',
      [
        'Leave the transmission in Neutral',
        'Set the parking brake and secure the transmission',
        'Keep the engine running',
      ],
      1,
      'Secure the vehicle with the parking brake and the correct transmission position before leaving it.',
    ),
  ),
  'ca-bicycles-motorcycles': intro(
    'Share lanes with people who are smaller, less protected, and easier to hide in a blind spot.',
    [
      'Search for bicycles before turns, lane changes, and opening a door.',
      'Give lawful passing space and change lanes when required and available.',
      'Treat a motorcycle as a full vehicle, not spare lane space.',
    ],
    [
      slide(
        'Look where a bicycle can appear',
        'A bicyclist may be beside you even when the travel lane looked clear a moment ago.',
        [
          'Check the bicycle lane and right-side blind spot before turning.',
          'Look behind before opening a door next to traffic.',
          'Expect a bicyclist to leave the edge to avoid debris, drains, or parked cars.',
        ],
      ),
      slide(
        'Motorcycles need the whole safety margin',
        'Their narrow profile makes speed and distance harder to judge.',
        [
          'Give a full lane and normal following space.',
          'Check twice before turning or changing lanes.',
          'Do not share a lane with a motorcycle or block lawful lane splitting.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'Before turning right across a bicycle lane, where should you check?',
      [
        'Only the rearview mirror',
        'Mirrors and the right-side blind spot for bicyclists',
        'Only the traffic signal',
      ],
      1,
      'A bicyclist can be beside your vehicle, so check mirrors and the blind spot before crossing the lane.',
    ),
  ),
  'ca-trucks-buses-slow-vehicles': intro(
    'Predict the space needs of trucks, buses, light rail, and slow vehicles instead of waiting until they crowd your path.',
    [
      'Stay out of large-vehicle blind spots and allow extra stopping room.',
      'Expect wide turns and never squeeze beside a turning truck.',
      'Handle buses, streetcars, light rail, and slow vehicles safely.',
    ],
    [
      slide(
        'Large vehicles trade visibility for size',
        'A truck driver may be unable to see a car close to the front, rear, or sides.',
        [
          'If you cannot see the driver in a mirror, assume the driver may not see you.',
          'Do not cut closely in front after passing.',
          'Leave extra room on grades and at stops because a heavy vehicle needs more space.',
        ],
      ),
      slide(
        'Transit vehicles may control the space around them',
        'Buses, streetcars, and light rail follow routes that can place passengers or rails beside ordinary traffic.',
        [
          'Follow signs, signals, lane markings, and boarding-island rules.',
          'Do not turn across the path of an approaching rail vehicle.',
          'Watch for passengers crossing between a curb and a transit stop.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'A truck begins a wide right turn. What should you do?',
      [
        'Drive into the space on its right',
        'Stay back and out of the truck’s turning path',
        'Pass between the truck and curb',
      ],
      1,
      'A truck may swing wide and then close the space beside it. Never squeeze into that path.',
    ),
  ),
  'ca-emergency-school-work-zones': intro(
    'Respond correctly to emergency vehicles, school buses, crossing guards, flaggers, and temporary work-zone patterns.',
    [
      'Yield and stop for emergency vehicles without blocking their route.',
      'Know when school-bus red lights require a stop.',
      'Treat flaggers and temporary controls as real traffic directions.',
    ],
    [
      slide(
        'Make space without making chaos',
        'An emergency vehicle needs a predictable path.',
        [
          'Check around you before moving toward the required side and stopping.',
          'Do not stop in an intersection or block the emergency route.',
          'After it passes, check for additional responders before reentering traffic.',
        ],
      ),
      slide(
        'People can be the traffic control',
        'A crossing guard, flagger, or authorized officer may direct traffic through a temporary pattern.',
        [
          'Obey the person’s signal even when it differs from the normal signal or lane.',
          'Slow early and expect workers, children, equipment, or stopped traffic.',
          'Do not resume normal speed until you are clear of the controlled area.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'A work-zone flagger signals you to stop even though the nearby light is green. What should you do?',
      [
        'Follow the green light',
        'Stop as directed by the flagger',
        'Drive around the flagger',
      ],
      1,
      'Authorized temporary traffic direction controls the movement through the work area.',
    ),
  ),
  'ca-night-weather-visibility': intro(
    'Keep enough visibility to stop safely at night, in rain, fog, smoke, glare, and other extreme conditions.',
    [
      'Use the correct headlights and dim high beams when required.',
      'Reduce speed when sight distance or traction falls.',
      'Know when conditions are too poor to continue safely.',
    ],
    [
      slide(
        'Drive within the distance you can see',
        'If your stopping distance is longer than your visible road, a hidden hazard can become unavoidable.',
        [
          'Slow before dark curves, crests, fog banks, smoke, or heavy rain.',
          'Use low beams in fog or smoke because high beams reflect light back.',
          'Keep the windshield, lights, mirrors, and wipers clean and working.',
        ],
      ),
      slide(
        'Glare and severe weather need a plan',
        'Sun glare, dust, snow, flooding, or strong wind can remove your normal safety margin.',
        [
          'Slow smoothly and increase following distance.',
          'Use lane markings or the right road edge as a guide without staring at oncoming lights.',
          'If you cannot see well enough to drive, leave the roadway at a safe place and wait.',
        ],
      ),
    ],
    testQuestion(
      'Which headlights should you normally use in fog or smoke?',
      ['High beams', 'Low beams', 'Parking lights only'],
      1,
      'Low beams reduce reflected glare and help you see the roadway better in fog or smoke.',
    ),
  ),
  'ca-skids-and-emergencies': intro(
    'Stay calm through loss of traction, a tire blowout, leaving the pavement, brake trouble, or a vehicle disabled on tracks.',
    [
      'Look and steer toward the safe path instead of fixating on the hazard.',
      'Avoid sudden braking or steering during a blowout or skid.',
      'Know when getting people out of the vehicle is the first priority.',
    ],
    [
      slide(
        'A tire blowout needs smooth control',
        'The first seconds are about keeping the vehicle stable.',
        [
          'Hold the steering wheel firmly and keep the vehicle pointed straight.',
          'Ease off the accelerator; do not slam on the brakes.',
          'Slow gradually, signal, and move off the roadway when safe.',
        ],
      ),
      slide(
        'If your wheels leave the pavement',
        'A fast steering correction can turn a small drift into a loss of control.',
        [
          'Ease off the accelerator and hold the wheel firmly.',
          'Brake gently if needed while keeping the vehicle straight.',
          'Return to the pavement gradually when speed and traffic allow.',
        ],
      ),
    ],
    testQuestion(
      'A front tire suddenly blows out. What should you do first?',
      [
        'Brake as hard as possible',
        'Hold the wheel firmly and ease off the accelerator',
        'Turn sharply toward the shoulder',
      ],
      1,
      'Keep control with a firm grip and smooth deceleration before moving off the roadway.',
    ),
  ),
  'ca-distraction-and-fatigue': intro(
    'Protect your attention from phones, fatigue, emotion, medication, poor health, and anything that blocks your senses.',
    [
      'Recognize visual, manual, and mental distraction.',
      'Treat sleepiness and impairing medication as driving risks.',
      'Keep hearing, vision, and emotional control available for the road.',
    ],
    [
      slide(
        'Hands-free does not mean risk-free',
        'A conversation can take attention even when your hands remain on the wheel.',
        [
          'Set navigation and music before moving.',
          'Let a passenger handle tasks or pull over safely.',
          'Do not read, type, eat, reach, or handle objects when it takes your eyes or mind from driving.',
        ],
      ),
      slide(
        'Your condition is part of vehicle safety',
        'Illness, strong emotion, poor sleep, vision changes, and medicine can reduce judgment or reaction.',
        [
          'Read medicine warnings and ask a professional when effects are unclear.',
          'Do not drive when drowsy, dizzy, angry, or unable to focus.',
          'Avoid covering both ears with a headset or earplugs while driving.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'A prescription label warns that the medicine may cause drowsiness. What is the safest choice?',
      [
        'Drive faster so the trip is shorter',
        'Do not drive until you know you can do so safely',
        'Drink coffee and ignore the warning',
      ],
      1,
      'Medication can impair driving. Follow the warning and do not drive until its effects are understood and safe.',
    ),
  ),
  'ca-alcohol-drugs-dui': intro(
    'Understand how alcohol, cannabis, illegal drugs, and medication affect driving—and why feeling fine is not a defense.',
    [
      'Recognize that several kinds of substances can cause impairment.',
      'Know the core California DUI and open-container rules.',
      'Plan a sober ride before drinking or using an impairing drug.',
    ],
    [
      slide(
        'Impairment begins before obvious drunkenness',
        'Judgment, attention, vision, coordination, and reaction can worsen before a person notices.',
        [
          'Coffee, food, a shower, or fresh air does not quickly remove alcohol.',
          'Cannabis and medicines can impair driving even when legally obtained.',
          'Combining substances can make the effect stronger and less predictable.',
        ],
      ),
      slide(
        'Separate driving from substance use',
        'The reliable plan is made before impairment starts.',
        [
          'Choose a sober driver, transit, taxi, or rideshare.',
          'Never ride with a driver you believe is impaired.',
          'Keep alcoholic beverages and cannabis containers where California law allows; an open container does not belong in the passenger area.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'Can a legally prescribed medicine still make it illegal or unsafe to drive?',
      [
        'No, prescriptions never impair driving',
        'Yes, if it impairs the ability to drive safely',
        'Only when mixed with coffee',
      ],
      1,
      'A prescription does not make impaired driving safe or legal.',
      'state_specific',
    ),
  ),
  'ca-seat-belts-child-safety': intro(
    'Use seat belts, child restraints, airbags, and supervision together to protect everyone in the vehicle.',
    [
      'Know who must be restrained and how children move through restraint stages.',
      'Place occupants safely around airbags.',
      'Never leave a child or dependent person in a dangerous unattended vehicle.',
    ],
    [
      slide(
        'Airbags support the seat belt',
        'An airbag is designed to work with correct seating and restraint.',
        [
          'Wear the lap belt low across the hips and the shoulder belt across the chest.',
          'Sit upright and keep a safe distance from the airbag cover.',
          'Use the rear seat and the correct child restraint for young passengers.',
        ],
      ),
      slide(
        'A parked vehicle can become dangerous quickly',
        'Heat, controls, windows, and traffic make an unattended vehicle unsafe for children and dependent people.',
        [
          'Check the entire vehicle before locking it.',
          'Do not leave a child where heat or access to controls can create danger.',
          'Secure pets so they do not distract the driver or enter a dangerous area.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'What is the relationship between an airbag and a seat belt?',
      [
        'The airbag replaces the seat belt',
        'The airbag supplements a correctly worn seat belt',
        'Only rear-seat passengers need belts',
      ],
      1,
      'Airbags are supplemental protection and are designed to work with seat belts.',
    ),
  ),
  'ca-equipment-loads-towing': intro(
    'Check the vehicle before driving, secure every load, and understand how towing changes stopping, turning, and visibility.',
    [
      'Confirm tires, lights, glass, mirrors, brakes, and controls are usable.',
      'Secure cargo so it cannot fall, leak, drag, or block the driver.',
      'Allow extra space and follow equipment rules when towing.',
    ],
    [
      slide(
        'A short pre-drive check prevents long problems',
        'You do not need a workshop inspection before every trip, but safety-critical items must work.',
        [
          'Walk around for tire damage, leaks, obstacles, and people near the vehicle.',
          'Check lights, mirrors, windows, wipers, brakes, horn, and seat position.',
          'Make sure loose objects cannot roll under pedals or block your view.',
          'Correct tire pressure, smooth acceleration, and avoiding unnecessary idling can also reduce fuel use.',
        ],
      ),
      slide(
        'Cargo must stay part of the vehicle',
        'A load becomes a road hazard when it shifts, falls, leaks, drags, or hides required lights and plates.',
        [
          'Distribute weight and use restraints strong enough for the cargo.',
          'Recheck a load after starting the trip.',
          'Rules for a rear-projecting load are under legal review in this package, so no disputed flag-size number is taught or tested.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'What is the safest way to carry loose objects inside a vehicle?',
      [
        'Place them near the pedals',
        'Secure them so they cannot move or block controls',
        'Stack them above the driver’s line of sight',
      ],
      1,
      'Loose objects can interfere with controls or become dangerous in a sudden stop.',
    ),
  ),
  'ca-crashes-and-insurance': intro(
    'Protect people first after a collision, exchange the required information, and complete California reporting duties.',
    [
      'Stop, reduce further danger, and help injured people.',
      'Exchange identification and insurance information.',
      'Know that police, DMV, and insurance reports can be separate duties.',
    ],
    [
      slide(
        'The first priority is preventing another injury',
        'A collision scene can create a second crash.',
        [
          'Stop and remain at the scene as the law requires.',
          'Call emergency services for injuries or immediate danger.',
          'Move vehicles only when safe and appropriate, and warn approaching traffic when possible.',
        ],
      ),
      slide(
        'One report does not replace every other report',
        'Different agencies use collision information for different purposes.',
        [
          'Exchange the required driver, vehicle, and insurance details.',
          'Report to law enforcement when the circumstances require it.',
          'File the DMV collision report when California’s injury, death, or property-damage threshold is met, even if another person also reports.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'After a reportable California collision, does a police report automatically replace the required DMV report?',
      [
        'Yes, in every case',
        'No, the DMV reporting duty can be separate',
        'Only when both vehicles are insured',
      ],
      1,
      'The DMV report can be a separate duty from police and insurance reports.',
      'state_specific',
    ),
  ),
  'ca-permits-provisional-licenses': intro(
    'Understand the application, knowledge test, permit, supervised practice, provisional license, and retest rules without starting the course with paperwork.',
    [
      'Know the path from application to full driving privilege.',
      'Separate adult and minor requirements.',
      'Remember the three-attempt rule while avoiding an unresolved retest-date number.',
    ],
    [
      slide(
        'Think of licensing as gates',
        'Each stage confirms a different kind of readiness.',
        [
          'The application establishes identity, eligibility, and required documents.',
          'The knowledge test checks rules and safe-driving decisions.',
          'The permit and drive test add supervised practice and demonstrated vehicle control.',
        ],
        'state_specific',
      ),
      slide(
        'Three attempts, then a new application',
        'California DMV currently allows three attempts for each required knowledge test during an application.',
        [
          'After a third failure, the application becomes invalid and the applicant must reapply.',
          'Minor-applicant pages describe the waiting period in different ways.',
          'This course does not teach or test a numerical minor retest interval until the normalized earliest date is formally approved.',
        ],
        'state_specific',
      ),
    ],
    testQuestion(
      'What happens after a third failed attempt at a required California knowledge test?',
      [
        'The same application stays valid forever',
        'The application becomes invalid and the applicant must reapply',
        'The applicant automatically receives a permit',
      ],
      1,
      'DMV states that an application becomes invalid after the third failed required knowledge-test attempt.',
      'state_specific',
    ),
  ),
  'ca-licenses-and-registration': intro(
    'Keep driving and vehicle records current after a move, purchase, sale, or change in California residency.',
    [
      'Distinguish a driver license from vehicle registration and title.',
      'Know the buyer, seller, and new-resident deadlines.',
      'Update address and ownership information with the correct agency process.',
    ],
    [
      slide(
        'License, registration, and title do different jobs',
        'These documents answer three separate questions.',
        [
          'A license shows the person’s driving privilege.',
          'Registration connects a vehicle to its current operating record.',
          'Title records legal ownership; a transfer updates that ownership record.',
        ],
        'state_specific',
      ),
      slide(
        'California transfer and residency clocks are short',
        'The person responsible for a filing should act immediately instead of waiting for another party.',
        [
          'A seller reports the transfer or release of liability within 5 calendar days.',
          'A buyer applies to transfer ownership within 10 days.',
          'A new resident or person accepting California employment generally applies for California vehicle registration within 20 days when the statutory duty applies.',
        ],
        'state_specific',
        ['CVC §§516, 5900, 5902, 6700'],
      ),
    ],
    testQuestion(
      'After a private-party vehicle sale in California, who has a separate DMV filing duty?',
      [
        'Only the buyer',
        'Both seller and buyer have their own filing duties',
        'Only the insurance company',
      ],
      1,
      'The seller reports the transfer, while the buyer applies to transfer ownership.',
      'state_specific',
    ),
  ),
  'ca-penalties-and-points': intro(
    'See how violations can affect the driving record, privilege, insurance, and criminal exposure—and finish with the enforcement scenarios DMV tests.',
    [
      'Understand points, suspensions, and the difference between traffic and criminal consequences.',
      'Know how to behave during a law-enforcement stop.',
      'Recognize why evading an officer can become a serious crime.',
    ],
    [
      slide(
        'A citation can have more than one consequence',
        'The fine is only one possible result.',
        [
          'A conviction may add points or trigger a licensing action.',
          'Insurance cost and eligibility can change.',
          'Serious conduct can bring criminal penalties beyond an ordinary traffic infraction.',
        ],
        'state_specific',
      ),
      slide(
        'During a traffic stop, make your actions predictable',
        'A safe stop protects both the driver and the officer.',
        [
          'Signal, pull to a safe place, stop, and remain in the vehicle unless directed otherwise.',
          'Keep hands visible and explain before reaching for documents.',
          'Never flee; California law treats evading that causes serious bodily injury as a serious offense with possible imprisonment.',
        ],
        'state_specific',
        ['CVC §2800.3'],
      ),
    ],
    testQuestion(
      'An officer activates emergency lights behind you. What is the safest first response?',
      [
        'Accelerate until you find your destination',
        'Signal and pull over safely, then follow instructions',
        'Stop immediately in the active traffic lane when a shoulder is available',
      ],
      1,
      'Signal, choose a safe stopping place, stop, and make your actions predictable.',
      'state_specific',
    ),
    ['CVC §2800.3'],
  ),
};

const coverageDomains = [
  [
    'Signs: shapes, colors, regulatory, warning, guide',
    [
      'ca-sign-shapes-and-colors',
      'ca-regulatory-signs',
      'ca-warning-and-guide-signs',
    ],
  ],
  ['Signals, arrows, flashing and dark signals', ['ca-traffic-signals']],
  [
    'Pavement markings, limit lines, crosswalks and curbs',
    ['ca-road-markings-and-curbs'],
  ],
  [
    'Right-of-way and uncontrolled intersections',
    ['ca-uncontrolled-intersections', 'ca-stop-yield-entering-traffic'],
  ],
  [
    'Turns, signals, backing and U-turns',
    ['ca-turns-and-signals', 'ca-u-turns-starting-backing'],
  ],
  [
    'Pedestrians, blind pedestrians and roundabouts',
    ['ca-crosswalks-and-roundabouts'],
  ],
  [
    'Lane choice, lane changes and traffic breaks',
    ['ca-choosing-changing-lanes'],
  ],
  ['Passing and being passed', ['ca-passing-rules']],
  ['Freeway entry, exit and ramp controls', ['ca-freeway-merging']],
  [
    'HOV, bicycle, center-turn, turnout and transit lanes',
    ['ca-special-lanes'],
  ],
  ['Basic Speed Law and special limits', ['ca-speed-laws']],
  [
    'Scanning, following distance and stopping distance',
    ['ca-following-distance-scanning'],
  ],
  ['Parking, curb rules, hills and parallel parking', ['ca-parking-and-curbs']],
  ['Bicycles and motorcycles', ['ca-bicycles-motorcycles']],
  [
    'Trucks, buses, slow vehicles and light rail',
    ['ca-trucks-buses-slow-vehicles'],
  ],
  [
    'Emergency vehicles, school buses and work zones',
    ['ca-emergency-school-work-zones'],
  ],
  [
    'Night, rain, fog, smoke, glare and severe weather',
    ['ca-night-weather-visibility'],
  ],
  [
    'Skids, blowouts, off-pavement and roadside emergencies',
    ['ca-skids-and-emergencies'],
  ],
  [
    'Distraction, fatigue, health, hearing and medication',
    ['ca-distraction-and-fatigue'],
  ],
  ['Alcohol, drugs, DUI and open containers', ['ca-alcohol-drugs-dui']],
  [
    'Seat belts, child restraints, airbags and unattended children',
    ['ca-seat-belts-child-safety'],
  ],
  ['Vehicle condition, loads and towing', ['ca-equipment-loads-towing']],
  ['Collisions, insurance and reporting', ['ca-crashes-and-insurance']],
  [
    'Permits, provisional licensing and knowledge tests',
    ['ca-permits-provisional-licenses'],
  ],
  [
    'License, registration, residency and ownership transfer',
    ['ca-licenses-and-registration'],
  ],
  [
    'Points, penalties, enforcement stops and evading',
    ['ca-penalties-and-points'],
  ],
];

// Competitor material is used only as a checklist of generic topics. These
// mappings do not make competitor lessons a source for course wording, facts,
// questions, sequence, artwork, or interaction design.
const MYDMV_LESSON_MAP = [
  'ca-sign-shapes-and-colors',
  'ca-passing-rules',
  'ca-regulatory-signs',
  'ca-penalties-and-points',
  'ca-turns-and-signals',
  'ca-uncontrolled-intersections',
  'ca-parking-and-curbs',
  'ca-special-lanes',
  'ca-following-distance-scanning',
  'ca-bicycles-motorcycles',
  'ca-warning-and-guide-signs',
  'ca-traffic-signals',
  'ca-warning-and-guide-signs',
  'ca-night-weather-visibility',
  'ca-speed-laws',
  'ca-traffic-signals',
  'ca-uncontrolled-intersections',
  'ca-crosswalks-and-roundabouts',
  'ca-alcohol-drugs-dui',
  'ca-warning-and-guide-signs',
  'ca-following-distance-scanning',
  'ca-regulatory-signs',
  'ca-passing-rules',
  'ca-crashes-and-insurance',
  'ca-trucks-buses-slow-vehicles',
  'ca-emergency-school-work-zones',
  'ca-bicycles-motorcycles',
  'ca-warning-and-guide-signs',
  'ca-permits-provisional-licenses',
  'ca-skids-and-emergencies',
  'ca-penalties-and-points',
  'ca-penalties-and-points',
  'ca-licenses-and-registration',
  'ca-sign-shapes-and-colors',
  'final-assessment',
  'outside-knowledge-test-scope',
];

const ZUTOBI_LESSON_MAP = [
  'ca-uncontrolled-intersections',
  'ca-equipment-loads-towing',
  'ca-road-markings-and-curbs',
  'ca-stop-yield-entering-traffic',
  'ca-turns-and-signals',
  'ca-turns-and-signals',
  'ca-warning-and-guide-signs',
  'ca-equipment-loads-towing',
  'ca-distraction-and-fatigue',
  'ca-following-distance-scanning',
  'ca-freeway-merging',
  'ca-freeway-merging',
  'ca-stop-yield-entering-traffic',
  'ca-traffic-signals',
  'ca-road-markings-and-curbs',
  'ca-regulatory-signs',
  'ca-speed-laws',
  'ca-crosswalks-and-roundabouts',
  'ca-trucks-buses-slow-vehicles',
  'ca-trucks-buses-slow-vehicles',
  'ca-bicycles-motorcycles',
  'ca-emergency-school-work-zones',
  'ca-regulatory-signs',
  'ca-turns-and-signals',
  'ca-parking-and-curbs',
  'ca-parking-and-curbs',
  'ca-parking-and-curbs',
  'ca-equipment-loads-towing',
  'ca-penalties-and-points',
  'ca-sign-shapes-and-colors',
  'ca-warning-and-guide-signs',
  'ca-following-distance-scanning',
  'ca-alcohol-drugs-dui',
  'ca-alcohol-drugs-dui',
  'ca-distraction-and-fatigue',
  'ca-distraction-and-fatigue',
  'ca-alcohol-drugs-dui',
  'ca-distraction-and-fatigue',
  'ca-permits-provisional-licenses',
  'ca-warning-and-guide-signs',
  'ca-night-weather-visibility',
  'ca-night-weather-visibility',
  'ca-passing-rules',
  'ca-following-distance-scanning',
  'ca-following-distance-scanning',
  'ca-warning-and-guide-signs',
  'ca-warning-and-guide-signs',
  'ca-regulatory-signs',
  'ca-night-weather-visibility',
  'ca-night-weather-visibility',
  'ca-skids-and-emergencies',
  'ca-skids-and-emergencies',
  'ca-emergency-school-work-zones',
  'ca-emergency-school-work-zones',
  'ca-crashes-and-insurance',
  'ca-warning-and-guide-signs',
  'ca-crosswalks-and-roundabouts',
  'ca-seat-belts-child-safety',
  'ca-equipment-loads-towing',
  'ca-equipment-loads-towing',
  'ca-equipment-loads-towing',
  'ca-licenses-and-registration',
];

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
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  );
};
const conceptId = id => id.replace(/^ca-/, '');
const plainEnglish = text =>
  text
    .replace(
      'A driver approaching an intersection must yield to a vehicle that has already entered from another highway.',
      'If another vehicle is already inside the intersection, let it clear before you enter.',
    )
    .replace(
      'When vehicles enter from different highways at the same time, the driver on the left yields to the vehicle on the immediate right.',
      'If two vehicles reach an uncontrolled intersection together, the vehicle on the right goes first.',
    )
    .replace(
      'When two vehicles enter from different highways at the same time, the driver on the left yields to the immediate right.',
      'If two vehicles reach an uncontrolled intersection together, the vehicle on the right goes first.',
    )
    .replace(
      'At a T-shaped intersection without another control, the driver on the road that ends must yield to traffic on the continuing road.',
      'At an uncontrolled T-intersection, traffic on the continuing road goes first.',
    )
    .replace(/\bA driver must\b/g, 'You must')
    .replace(/\bA driver may not\b/g, 'You must not')
    .replace(/\bA person may not\b/g, 'You must not')
    .replace(/\bA licensed driver must\b/g, 'You must')
    .replace(/\bstatutory\b/g, 'legal')
    .replace(/\bthe statute's\b/g, "California law's")
    .replace(/\bthe statute\b/g, 'California law')
    .replace(/\btransferee\b/g, 'buyer')
    .replace(/\bwillful or wanton disregard\b/g, 'a conscious disregard')
    .replace(
      /\ban applicable official traffic-control device\b/g,
      'a traffic sign or signal that applies to you',
    );
const sentences = text =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“])/)
    .filter(Boolean);
const simplifyBlock = (block, lessonId) => {
  if (block.type === 'quick_challenge') return null;
  if (block.type === 'image') return { ...block };
  const copy = { ...block };
  const explicitlyStateSpecific =
    copy.type === 'california_specific' || copy.type === 'state_specific';
  delete copy.checkpointQuestionId;
  if (copy.type === 'california_specific') copy.type = 'state_specific';
  copy.conceptId =
    conceptId(lessonId) +
    '.' +
    conceptId(copy.blockId).replace(conceptId(lessonId) + '-', '');
  if (typeof copy.bodyMarkdown === 'string') {
    const parts = sentences(plainEnglish(copy.bodyMarkdown));
    if (parts.length > 1) {
      copy.bodyMarkdown = parts[0];
      copy.bullets = parts.slice(1);
    }
  }
  const scopeText = [copy.title, copy.bodyMarkdown, ...(copy.bullets || [])]
    .filter(Boolean)
    .join(' ');
  const containsStateMarker =
    /\b(?:California|DMV|CVC)\b|\b\d+(?:[.,]\d+)?(?:%|\s*(?:feet|foot|inches|inch|days?|hours?|months?|years?|mph|pounds?))?\b/i.test(
      scopeText,
    );
  copy.scope =
    explicitlyStateSpecific || containsStateMarker
      ? 'state_specific'
      : 'universal';
  return copy;
};
const makeExtraQuestion = (lessonId, data) => {
  const questionId = lessonId + '-q06';
  const answerId = ['A', 'B', 'C'][data.correct];
  return {
    questionId,
    uuid: uuidFor(questionId),
    kind: 'lesson_test',
    conceptId: conceptId(lessonId) + '.test.06',
    scope: data.scope,
    prompt: data.prompt,
    choices: data.choices.map((text, index) => ({
      id: ['A', 'B', 'C'][index],
      text,
      feedback:
        (index === data.correct ? 'Correct. ' : 'Not quite. ') +
        data.explanation,
    })),
    correctAnswerId: answerId,
    explanation: data.explanation,
  };
};
const docRef = filename => {
  const data = fs.readFileSync(filename);
  return { sha256: sha256(data), sizeBytes: data.byteLength };
};
const parseCourseMap = brand => {
  const filename = path.join(COMPETITOR_ROOT, brand, 'course-map.md');
  if (!fs.existsSync(filename)) {
    throw new Error(
      'Missing competitor topic map. Set DMV_COMPETITOR_ROOT or restore ' +
        filename,
    );
  }
  return fs
    .readFileSync(filename, 'utf8')
    .split('## Source Screenshots')[0]
    .split('\n')
    .flatMap(line => {
      const match = line.match(/^(\d+)\.\s+.*—\s+(.+)$/);
      return match
        ? [{ number: Number(match[1]), title: match[2].trim() }]
        : [];
    });
};
const walkFiles = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filename) : [filename];
  });
const competitorLessonFiles = brand =>
  walkFiles(path.join(COMPETITOR_ROOT, brand)).filter(filename =>
    /\/lesson-\d+\.md$/.test(filename),
  );
const normalizedWords = text =>
  (
    text
      .toLowerCase()
      .normalize('NFKD')
      .match(/[a-z0-9]+/g) || []
  ).filter(Boolean);
const shingles = (text, size) => {
  const words = normalizedWords(text);
  return new Set(
    Array.from({ length: Math.max(0, words.length - size + 1) }, (_, index) =>
      words.slice(index, index + size).join(' '),
    ),
  );
};
const exactPhraseOverlap = (courseText, brand, size = 10) => {
  const files = competitorLessonFiles(brand);
  const competitorText = files.map(filename =>
    fs.readFileSync(filename, 'utf8'),
  );
  const coursePhrases = shingles(courseText, size);
  const competitorPhrases = shingles(competitorText.join('\n'), size);
  const overlaps = [...coursePhrases]
    .filter(phrase => competitorPhrases.has(phrase))
    .sort();
  return {
    lessonFilesChecked: files.length,
    shingleWords: size,
    overlapCount: overlaps.length,
    overlaps,
  };
};

const myDmvTopics = parseCourseMap('myDMV');
const zutobiTopics = parseCourseMap('Zutobi');
if (myDmvTopics.length !== MYDMV_LESSON_MAP.length) {
  throw new Error(
    `Expected ${MYDMV_LESSON_MAP.length} myDMV topics, got ${myDmvTopics.length}`,
  );
}
if (zutobiTopics.length !== ZUTOBI_LESSON_MAP.length) {
  throw new Error(
    `Expected ${ZUTOBI_LESSON_MAP.length} Zutobi topics, got ${zutobiTopics.length}`,
  );
}

if (Object.keys(ENRICHMENT).length !== 30) {
  throw new Error(
    'Expected 30 enrichment entries, got ' + Object.keys(ENRICHMENT).length,
  );
}

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.rmSync(AUTHORING, { recursive: true, force: true });
fs.mkdirSync(path.join(OUTPUT, 'modules'), { recursive: true });
fs.mkdirSync(path.join(OUTPUT, 'lessons'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'lessons'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'reports'), { recursive: true });
fs.mkdirSync(path.join(AUTHORING, 'rules'), { recursive: true });

const baseCourseDoc = readJson(path.join(BASE, 'course.json'));
const baseModuleFiles = fs.readdirSync(path.join(BASE, 'modules')).sort();
const baseLessonFiles = fs.readdirSync(path.join(BASE, 'lessons')).sort();
const lessonDocs = [];
const questionById = new Map();
const originalRuleIdsBySequence = new Map();
const oldSourceDir = path.join(
  ROOT,
  'courses/California_DMV_Course_CA2026.08.10r01_Illustrated_20260811',
);

if (fs.existsSync(path.join(oldSourceDir, 'lessons'))) {
  for (const filename of fs.readdirSync(path.join(oldSourceDir, 'lessons'))) {
    const sourceLesson = readJson(path.join(oldSourceDir, 'lessons', filename));
    originalRuleIdsBySequence.set(sourceLesson.globalSequence, {
      primaryRuleIds: sourceLesson.primaryRuleIds || [],
      reinforcementRuleIds: sourceLesson.reinforcementRuleIds || [],
    });
  }
}

for (const filename of baseLessonFiles) {
  const source = readJson(path.join(BASE, 'lessons', filename));
  const lesson = source.lesson;
  const data = ENRICHMENT[lesson.lessonId];
  if (!data) throw new Error('Missing enrichment for ' + lesson.lessonId);

  const stateQuestionIds = new Set(
    lesson.blocks
      .filter(
        block =>
          block.type === 'california_specific' ||
          block.type === 'state_specific',
      )
      .map(block => block.checkpointQuestionId)
      .filter(Boolean),
  );
  const transformedBlocks = lesson.blocks
    .map(block => simplifyBlock(block, lesson.lessonId))
    .filter(Boolean);

  data.supplements.forEach((item, index) => {
    transformedBlocks.splice(transformedBlocks.length - 2 + index, 0, {
      blockId: lesson.lessonId + '-deep-' + String(index + 1).padStart(2, '0'),
      type: item.scope === 'state_specific' ? 'state_specific' : 'related_rule',
      title: item.title,
      bodyMarkdown: item.bodyMarkdown,
      bullets: item.bullets,
      conceptId:
        conceptId(lesson.lessonId) +
        '.deep.' +
        String(index + 1).padStart(2, '0'),
      scope: item.scope,
    });
  });

  const questions = source.questions.map((question, index) => {
    const factText = question.prompt + ' ' + question.explanation;
    const scope =
      stateQuestionIds.has(question.questionId) ||
      /California|\d/.test(factText)
        ? 'state_specific'
        : 'universal';
    return {
      ...question,
      prompt: plainEnglish(question.prompt),
      choices: question.choices.map(choice => ({
        ...choice,
        feedback: plainEnglish(choice.feedback),
      })),
      explanation: plainEnglish(question.explanation),
      kind: 'lesson_test',
      conceptId:
        conceptId(lesson.lessonId) +
        '.test.' +
        String(index + 1).padStart(2, '0'),
      scope,
    };
  });
  const extra = makeExtraQuestion(lesson.lessonId, data.question);
  questions.push(extra);
  questions.forEach(question =>
    questionById.set(question.questionId, question),
  );

  const nextLesson = {
    ...lesson,
    conceptId: conceptId(lesson.lessonId),
    intro: {
      summary: data.summary,
      keyPoints: data.keyPoints,
      theoryMinutes: 7,
      testMinutes: 4,
    },
    objective: data.summary,
    estimatedMinutes: '9-12',
    format: 'intro_slides_test',
    blocks: transformedBlocks,
    questionIds: questions.map(question => question.questionId),
  };
  const runtimeDoc = {
    schemaVersion: 2,
    deliveryVersion: DELIVERY_VERSION,
    lesson: nextLesson,
    questions,
    assets: source.assets,
  };
  lessonDocs.push(runtimeDoc);
  writeJson(path.join(OUTPUT, 'lessons', filename), runtimeDoc);

  const rules = originalRuleIdsBySequence.get(lesson.globalSequence) || {
    primaryRuleIds: [],
    reinforcementRuleIds: [],
  };
  const authoringDoc = {
    lesson: nextLesson,
    questions,
    assetRefs: source.assets.map(asset => ({
      assetId: asset.assetId,
      uuid: asset.uuid,
      type: asset.type,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
      sha256: asset.sha256,
      runtimeLocation:
        'ca-class-c@' + DELIVERY_VERSION + ' lessons/' + filename,
    })),
    evidence: {
      inheritedPrimaryRuleIds: rules.primaryRuleIds,
      inheritedReinforcementRuleIds: rules.reinforcementRuleIds,
      addedOfficialSourceRefs: [
        ...new Set(
          data.supplements
            .flatMap(item => item.sourceRefs)
            .concat(data.sources),
        ),
      ],
      status: 'draft_generated_human_review_required',
    },
  };
  writeJson(path.join(AUTHORING, 'lessons', filename), authoringDoc);
}

lessonDocs.sort(
  (left, right) => left.lesson.globalSequence - right.lesson.globalSequence,
);
const lessonById = new Map(
  lessonDocs.map(doc => [doc.lesson.lessonId, doc.lesson]),
);
const modules = [];
for (const filename of baseModuleFiles) {
  const source = readJson(path.join(BASE, 'modules', filename));
  const lessonIds = source.module.lessons.map(lesson => lesson.lessonId);
  const lessons = lessonIds.map(id => lessonById.get(id));
  const moduleQuestions = lessons.flatMap(lesson => lesson.questionIds);
  const testCount = Math.min(12, moduleQuestions.length);
  const module = {
    ...source.module,
    lessons,
    moduleTest: {
      ...source.module.moduleTest,
      questionIds: Array.from({ length: testCount }, (_, index) => {
        const position = Math.floor(
          (index * moduleQuestions.length) / testCount,
        );
        return moduleQuestions[position];
      }),
    },
  };
  const ids = new Set(lessons.flatMap(lesson => lesson.questionIds));
  const moduleDoc = {
    schemaVersion: 2,
    deliveryVersion: DELIVERY_VERSION,
    module,
    questions: [...ids].map(id => questionById.get(id)),
    assets: source.assets,
  };
  modules.push(module);
  writeJson(path.join(OUTPUT, 'modules', filename), moduleDoc);
}
modules.sort((left, right) => left.sequence - right.sequence);

const sourceContentHash = sha256(
  lessonDocs
    .map(doc => json({ lesson: doc.lesson, questions: doc.questions }))
    .join(''),
);
const courseDoc = {
  schemaVersion: 2,
  deliveryVersion: DELIVERY_VERSION,
  course: {
    ...baseCourseDoc.course,
    title: 'California Knowledge Test Course',
    subtitle: 'Clear slides, complete coverage, exam-focused practice.',
    sourceVersionLabel: SOURCE_VERSION,
    sourceContentHash,
    sourceCheckedAt: RELEASE_DATE,
    sourceReviewStatus: 'draft_generated_human_review_required',
    publicationAuthorized: false,
  },
};
writeJson(path.join(OUTPUT, 'course.json'), courseDoc);

const documents = {
  modules: Object.fromEntries(
    baseModuleFiles.map(filename => {
      const id = path.basename(filename, '.json');
      return [id, docRef(path.join(OUTPUT, 'modules', filename))];
    }),
  ),
  lessons: Object.fromEntries(
    baseLessonFiles.map(filename => {
      const id = path.basename(filename, '.json');
      const ref = docRef(path.join(OUTPUT, 'lessons', filename));
      return [id, { moduleId: lessonById.get(id).moduleId, ...ref }];
    }),
  ),
  course: docRef(path.join(OUTPUT, 'course.json')),
};

const versionEntry = {
  version: DELIVERY_VERSION,
  releasedAt: RELEASE_DATE,
  status: 'release_candidate',
  minAppVersion: '1.0.0',
  notes:
    'New intro to slide theory to lesson test format, expanded handbook coverage, 30 lessons and 180 unique questions.',
  sourceVersionLabel: SOURCE_VERSION,
  sourceReviewStatus: 'draft_generated_human_review_required',
  publicationAuthorized: false,
  instructions: [
    {
      op: 'full',
      severity: 'soft',
      message:
        'The California course has a new lesson format and expanded exam coverage.',
    },
  ],
  documents,
};
// What a push would ask the server for; the server owns the release history.
writeJson(path.join(OUTPUT, 'release.json'), {
  courseId: 'ca-class-c',
  versionLabel: DELIVERY_VERSION,
  baseVersion: BASE_VERSION,
  notes: versionEntry.notes,
  minAppVersion: versionEntry.minAppVersion,
  instructions: versionEntry.instructions,
});

const questions = lessonDocs.flatMap(doc => doc.questions);
const assets = [
  ...new Map(
    lessonDocs.flatMap(doc => doc.assets).map(asset => [asset.assetId, asset]),
  ).values(),
];
const learnerText = lessonDocs
  .flatMap(doc => [
    doc.lesson.title,
    doc.lesson.objective,
    doc.lesson.intro.summary,
    ...doc.lesson.intro.keyPoints,
    ...doc.lesson.blocks.flatMap(block => [
      block.title,
      block.bodyMarkdown,
      ...(block.bullets || []),
    ]),
    ...doc.questions.flatMap(question => [
      question.prompt,
      question.explanation,
      ...question.choices.flatMap(choice => [choice.text, choice.feedback]),
    ]),
  ])
  .filter(Boolean)
  .join('\n');
const originality = {
  generatedAt: new Date().toISOString(),
  method:
    'Exact normalized 10-word shingle comparison against locally archived lesson text.',
  interpretation:
    'A zero result is a useful automated screen, not a substitute for human originality and legal review.',
  competitors: {
    myDMV: exactPhraseOverlap(learnerText, 'myDMV'),
    Zutobi: exactPhraseOverlap(learnerText, 'Zutobi'),
  },
};
originality.pass = Object.values(originality.competitors).every(
  result => result.overlapCount === 0,
);
writeJson(path.join(AUTHORING, 'reports/originality-check.json'), originality);


const oldRuleCatalog = path.join(oldSourceDir, 'rules/rule-catalog.json');
if (fs.existsSync(oldRuleCatalog)) {
  const catalog = readJson(oldRuleCatalog);
  catalog.catalogId = 'ca-rule-catalog-ca-2026.08.20-r01';
  catalog.courseVersion = SOURCE_VERSION;
  catalog.sourceCheckedAt = RELEASE_DATE;
  writeJson(path.join(AUTHORING, 'rules/rule-catalog.json'), catalog);
}
writeJson(path.join(AUTHORING, 'rules/added-source-review.json'), {
  status: 'human_legal_review_required',
  sources: officialSources,
  newPrimaryLawChecks: [
    {
      citation: 'CVC §2410',
      topic: 'authorized traffic direction',
    },
    {
      citation: 'CVC §§22451, 22526',
      topic: 'rail crossing and gridlock clearance',
    },
    {
      citation: 'CVC §21661',
      topic: 'descending vehicle yields on a narrow grade',
    },
    {
      citation: 'CVC §21655.1',
      topic: 'transit-only lanes',
    },
    {
      citation: 'CVC §2800.3',
      topic: 'evading causing serious bodily injury',
    },
  ],
  excludedPendingResolution: [
    'Numerical flag size for a rear-projecting load',
    'Numerical minor knowledge-test retest interval',
  ],
});

const crosswalkRows = (topics, mappings, brand) =>
  topics
    .map((topic, index) => {
      const target = mappings[index];
      const outsideScope = target === 'outside-knowledge-test-scope';
      const note = outsideScope
        ? 'Outside this knowledge-test course; vehicle-control fundamentals remain covered in equipment and emergency lessons.'
        : target === 'final-assessment'
        ? 'Covered by the app’s final assessment rather than a theory lesson.'
        : 'Covered in the named course lesson.';
      return `| ${brand} ${topic.number} | ${topic.title} | ${target} | ${
        outsideScope ? 'Out of scope' : 'Covered'
      } | ${note} |`;
    })
    .join('\n');
const competitorCrosswalk = [
  '# Competitor topic crosswalk',
  '',
  'Purpose: verify topic breadth only. Competitor courses are not factual or creative sources for this course. Their prose, questions, artwork, lesson sequence, and branded presentation are not reused.',
  '',
  '## myDMV',
  '',
  '| Source | Generic topic | Our destination | Status | Note |',
  '| --- | --- | --- | --- | --- |',
  crosswalkRows(myDmvTopics, MYDMV_LESSON_MAP, 'myDMV'),
  '',
  'Result: all 35 myDMV knowledge-test lessons are mapped. Its behind-the-wheel video lesson is outside the stated knowledge-test scope.',
  '',
  '## Zutobi',
  '',
  '| Source | Generic topic | Our destination | Status | Note |',
  '| --- | --- | --- | --- | --- |',
  crosswalkRows(zutobiTopics, ZUTOBI_LESSON_MAP, 'Zutobi'),
  '',
  'Result: all 62 listed Zutobi theory topics are mapped to this compact 30-lesson course.',
  '',
  'Lesson count is intentionally not matched one-for-one: related ideas are grouped into longer lessons, while topic breadth is preserved.',
  '',
].join('\n');
fs.writeFileSync(
  path.join(AUTHORING, 'reports/competitor-topic-crosswalk.md'),
  competitorCrosswalk,
);

const visibleWords = lessonDocs.reduce(
  (total, doc) =>
    total +
    doc.lesson.blocks.reduce((sum, block) => {
      const content = [block.bodyMarkdown, ...(block.bullets || [])]
        .filter(Boolean)
        .join(' ');
      return sum + content.split(/\s+/).filter(Boolean).length;
    }, 0),
  0,
);
const cardCounts = lessonDocs.map(
  doc => doc.lesson.blocks.filter(block => block.type !== 'image').length,
);
const theoryBlocks = lessonDocs.flatMap(doc =>
  doc.lesson.blocks.filter(block => block.type !== 'image'),
);
const minimumSlides = Math.min(...cardCounts);
const maximumSlides = Math.max(...cardCounts);
const slideCountLabel =
  minimumSlides === maximumSlides
    ? String(minimumSlides)
    : `${minimumSlides}–${maximumSlides}`;
const validation = {
  generatedAt: new Date().toISOString(),
  deliveryVersion: DELIVERY_VERSION,
  sourceVersion: SOURCE_VERSION,
  status: 'pass_structural_human_review_required',
  counts: {
    modules: modules.length,
    lessons: lessonDocs.length,
    uniqueQuestions: questions.length,
    moduleTestQuestionRefs: modules.reduce(
      (sum, module) => sum + module.moduleTest.questionIds.length,
      0,
    ),
    assets: assets.length,
    visibleTheoryWords: visibleWords,
    minimumSlidesPerLesson: minimumSlides,
    maximumSlidesPerLesson: maximumSlides,
    universalTheoryBlocks: theoryBlocks.filter(
      block => block.scope === 'universal',
    ).length,
    stateSpecificTheoryBlocks: theoryBlocks.filter(
      block => block.scope === 'state_specific',
    ).length,
    universalQuestions: questions.filter(
      question => question.scope === 'universal',
    ).length,
    stateSpecificQuestions: questions.filter(
      question => question.scope === 'state_specific',
    ).length,
    myDmvKnowledgeTestTopicsMapped: MYDMV_LESSON_MAP.filter(
      target => target !== 'outside-knowledge-test-scope',
    ).length,
    zutobiTopicsMapped: ZUTOBI_LESSON_MAP.length,
  },
  checks: {
    allLessonsHaveIntro: lessonDocs.every(doc => doc.lesson.intro),
    allLessonsUseSplitFormat: lessonDocs.every(
      doc => doc.lesson.format === 'intro_slides_test',
    ),
    sixQuestionsPerLesson: lessonDocs.every(
      doc => doc.lesson.questionIds.length === 6,
    ),
    noInlineQuestions: lessonDocs.every(doc =>
      doc.lesson.blocks.every(
        block => !block.questionId && !block.checkpointQuestionId,
      ),
    ),
    allQuestionsResolvable: lessonDocs.every(doc =>
      doc.lesson.questionIds.every(id => questionById.has(id)),
    ),
    unresolvedProjectingLoadNumberAbsent: !lessonDocs.some(doc =>
      /rear-projecting.{0,160}(12|18)[-\s]inch/i.test(json(doc)),
    ),
    unresolvedRetestNumberAbsent: !lessonDocs.some(doc =>
      /(one week|seven days|7 days|8 days)/i.test(json(doc)),
    ),
    allMyDmvKnowledgeTestTopicsMapped:
      MYDMV_LESSON_MAP.filter(
        target => target !== 'outside-knowledge-test-scope',
      ).length === 35,
    allZutobiTopicsMapped: ZUTOBI_LESSON_MAP.length === 62,
    noExactTenWordCompetitorOverlap: originality.pass,
    noObviousStateFactMarkedUniversal: theoryBlocks
      .filter(block => block.scope === 'universal')
      .every(
        block =>
          !/\b(?:California|DMV|CVC)\b|\b\d+(?:[.,]\d+)?/i.test(
            [block.title, block.bodyMarkdown, ...(block.bullets || [])]
              .filter(Boolean)
              .join(' '),
          ),
      ),
    publicationStillBlocked: courseDoc.course.publicationAuthorized === false,
  },
};
if (Object.values(validation.checks).some(value => value !== true)) {
  throw new Error('Validation failed:\n' + json(validation.checks));
}
writeJson(
  path.join(AUTHORING, 'reports/automated-validation.json'),
  validation,
);

const coverageRows = coverageDomains
  .map(entry => '| ' + entry[0] + ' | ' + entry[1].join(', ') + ' | Covered |')
  .join('\n');
const coverageDocument = [
  '# California topic coverage matrix',
  '',
  'This matrix uses the current California Driver’s Handbook as the official topic map and current California DMV sample tests as a scenario check. The handbook is not copied: its text and illustrations are not course assets.',
  '',
  '| Exam domain | Lessons | Status |',
  '| --- | --- | --- |',
  coverageRows,
  '',
  '## Coverage decision',
  '',
  '- 26 exam domains are mapped to 30 lessons.',
  '- The compact ladder remains at 8 modules and 30 lessons.',
  '- Depth is added inside lessons: ' +
    slideCountLabel +
    ' theory slides and 6 lesson-test questions per lesson.',
  '- The bank contains ' +
    questions.length +
    ' unique lesson questions plus ' +
    validation.counts.moduleTestQuestionRefs +
    ' module-test references.',
  '- Numeric facts with unresolved source conflicts are deliberately excluded from lessons, answers, and distractors.',
  '- Complete coverage means every current official handbook domain and sampled DMV scenario domain is represented. It is not a promise that DMV will never introduce a new question.',
  '',
].join('\n');
fs.writeFileSync(
  path.join(AUTHORING, 'reports/topic-coverage-matrix.md'),
  coverageDocument,
);

writeJson(path.join(AUTHORING, 'course.json'), {
  course: courseDoc.course,
  design: {
    format: 'intro_slides_test',
    lessonEntry: {
      contents: [
        'short summary',
        'three learning outcomes',
        'theory and test estimates',
      ],
      actions: ['Study the theory', 'Go straight to the test'],
    },
    theory: {
      presentation: 'one idea per slide',
      proseStyle: 'plain English lead plus short bullets',
      stateFacts: 'explicit state_specific blocks',
    },
    test: {
      questionsPerLesson: 6,
      completionPoint: 'after lesson test',
    },
  },
  stateReuse: {
    strategy: 'stable concept IDs with explicit, fully rendered state packages',
    universalContent: 'reuse or adapt blocks with scope=universal',
    stateContent:
      'replace blocks and questions with scope=state_specific from verified state sources',
    prohibited: 'runtime insertion of unreviewed numeric variables into prose',
  },
  counts: validation.counts,
});

const readme = [
  '# California slide course — ' + SOURCE_VERSION,
  '',
  'This is the editable, LLM-friendly source package for delivery version ' +
    DELIVERY_VERSION +
    '.',
  '',
  '## Learner experience',
  '',
  '1. Tap a lesson.',
  '2. Read a short summary and three outcomes.',
  '3. Choose Study the theory or Go straight to the test.',
  '4. Theory uses ' +
    slideCountLabel +
    ' slides per lesson, one main idea per slide.',
  '5. The separate lesson test has 6 questions and completes the lesson.',
  '',
  '## What is included',
  '',
  '- 8 modules and 30 lessons.',
  '- ' + questions.length + ' unique lesson questions.',
  '- ' +
    validation.counts.moduleTestQuestionRefs +
    ' module-test question references.',
  '- ' +
    assets.length +
    ' existing original course illustrations embedded in runtime documents.',
  '- A complete topic map in reports/topic-coverage-matrix.md.',
  '- A line-by-line competitor breadth audit in reports/competitor-topic-crosswalk.md.',
  '- An automated long-phrase screen in reports/originality-check.json.',
  '- Per-lesson JSON files that keep prose, questions, asset references, scope, and evidence metadata together.',
  '',
  '## Editing with an LLM',
  '',
  'Edit one file in lessons/. Keep IDs stable. Universal facts use scope universal; California law or values use scope state_specific. Do not edit embedded SVG data in runtime JSON. After review, apply the equivalent lesson update through the existing server-driven version system.',
  '',
  '## Copyright and source policy',
  '',
  '- Competitor courses were used only to compare topic presence, reading difficulty, and generic interaction patterns.',
  '- No competitor wording, question, illustration, title sequence, or branded visual design is copied.',
  '- The California handbook is used as a topic map only because its current license is noncommercial.',
  '- Legal facts come from official DMV, Legislative Information, and Caltrans/MUTCD sources, then are independently explained.',
  '- This package remains publicationAuthorized false until human legal, content, originality, and visual review.',
  '',
  '## Known exclusions',
  '',
  '- Rear-projecting-load flag size remains excluded pending formal conflict resolution.',
  '- The numerical minor retest waiting period remains excluded pending formal normalization of DMV wording.',
  '',
].join('\n');
fs.writeFileSync(path.join(AUTHORING, 'README.md'), readme);

const specDir = path.join(ROOT, 'docs/course-authoring');
fs.mkdirSync(specDir, { recursive: true });
const spec = [
  '# State course format: intro to slides to test',
  '',
  '## Contract',
  '',
  'Every lesson has a stable conceptId, an intro, a theory slide deck, and a separate test. Tapping a lesson opens the intro. Learners may study theory or go directly to the test. A lesson is completed after its test, not merely after reading slides.',
  '',
  '## State reuse',
  '',
  'Use one shared concept taxonomy, not one shared final paragraph. Blocks and questions marked universal may be reused after review. Items marked state_specific must be generated from that jurisdiction’s verified sources. Each state ships a complete explicit package, which makes diffs, rollback, review, and LLM editing predictable.',
  '',
  'Do not insert unreviewed state values into prose at runtime. Generate the complete state lesson first, validate it, then publish it as a versioned server document.',
  '',
  '## Clean-room originality',
  '',
  'Competitors may inform a list of missing topics and generic product expectations. Do not use their prose, question wording, distinctive lesson sequence, artwork, screenshots, mnemonic language, or branded styling. Draft from official sources and the rule catalog, then run originality and legal review.',
  '',
].join('\n');
fs.writeFileSync(path.join(specDir, 'slide-course-v2.md'), spec);

console.log(json(validation));
