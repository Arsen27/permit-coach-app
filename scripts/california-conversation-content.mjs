// Clean-room course copy. Competitor material informed only the readability
// target: direct headings, plain language, concrete situations, and a short
// recap. Facts come from the verified California source package and v2 course.

const slide = (title, lines, options = {}) => ({
  title,
  lines,
  scope: options.scope ?? 'universal',
  type: options.type,
  // A slide with noExpansion keeps exactly its authored lines: it does not
  // take part in source-expansion matching, so inserting it cannot reshuffle
  // which existing card each verified source block enriches.
  noExpansion: options.noExpansion,
});

const challenge = (scenario, prompt, choices, correct, explanation, scope) => ({
  scenario,
  prompt,
  choices,
  correct,
  explanation,
  scope: scope ?? 'universal',
});

const test = (prompt, choices, correct, explanation, scope) => ({
  prompt,
  choices,
  correct,
  explanation,
  scope: scope ?? 'universal',
});

export const MODULE_SPECS = [
  {
    id: 'ca-your-first-drive',
    title: 'Your First Drive',
    outcome: 'Make the basic decisions that appear on almost every drive.',
    lessons: [
      'ca-traffic-signals',
      'ca-stop-yield-entering-traffic',
      'ca-turns-and-signals',
      'ca-speed-and-space',
    ],
  },
  {
    id: 'ca-read-the-road',
    title: 'Read the Road',
    outcome: 'Read signs, warnings, lines, arrows, and curb controls quickly.',
    lessons: [
      'ca-sign-shapes-and-colors',
      'ca-regulatory-signs',
      'ca-warning-and-guide-signs',
      'ca-road-markings-and-curbs',
    ],
  },
  {
    id: 'ca-everyday-moves',
    title: 'Intersections and Everyday Moves',
    outcome: 'Handle right-of-way, people, backing, U-turns, and parking.',
    lessons: [
      'ca-uncontrolled-intersections',
      'ca-crosswalks-and-roundabouts',
      'ca-complex-intersections',
      'ca-u-turns-starting-backing',
      'ca-parking-and-curbs',
    ],
  },
  {
    id: 'ca-lanes-passing-freeways',
    title: 'Lanes, Passing, and Freeways',
    outcome: 'Choose lanes, pass safely, merge, and use special lanes.',
    lessons: [
      'ca-choosing-changing-lanes',
      'ca-passing-rules',
      'ca-freeway-merging',
      'ca-special-lanes',
    ],
  },
  {
    id: 'ca-share-the-road',
    title: 'Share the Road',
    outcome: 'Protect road users who move, stop, and see differently.',
    lessons: [
      'ca-bicycles-motorcycles',
      'ca-trucks-buses-slow-vehicles',
      'ca-school-buses-emergency-vehicles',
      'ca-rail-light-rail-work-zones',
    ],
  },
  {
    id: 'ca-hard-driving',
    title: 'When Driving Gets Hard',
    outcome: 'Stay in control when visibility, traction, or the vehicle fails.',
    lessons: [
      'ca-driving-after-dark',
      'ca-weather-and-mountain-roads',
      'ca-skids-and-emergencies',
      'ca-crashes-and-insurance',
    ],
  },
  {
    id: 'ca-driver-and-vehicle',
    title: 'The Driver and the Vehicle',
    outcome: 'Manage impairment, distraction, passengers, and vehicle safety.',
    lessons: [
      'ca-distraction-and-fatigue',
      'ca-alcohol-drugs-dui',
      'ca-seat-belts-child-safety',
      'ca-equipment-loads-towing',
    ],
  },
  {
    id: 'ca-pass-the-test',
    title: 'Pass the California Test',
    outcome: 'Understand licensing rules and finish with exam-ready judgment.',
    lessons: [
      'ca-permit-and-knowledge-test',
      'ca-drivers-under-18',
      'ca-licenses-and-registration',
      'ca-penalties-and-points',
    ],
  },
];

export const LESSON_SPECS = [
  {
    id: 'ca-traffic-signals',
    sources: ['ca-traffic-signals'],
    title: 'The Light Changes. What Now?',
    summary:
      'Traffic lights look simple. The situation around them may not be.',
    keyPoints: [
      'Read every signal.',
      'Keep intersections clear.',
      'Protect people in your path.',
    ],
    challenge: challenge(
      'Your light is green, but traffic blocks the other side.',
      'What should you do?',
      [
        'Enter and wait inside',
        'Stay behind the line',
        'Honk and move forward',
      ],
      1,
      'Stay out until your car can clear the intersection.',
      'state_specific',
    ),
    slides: [
      slide(
        'Green means check first',
        ['Green means you may go.', 'First, make sure the path is clear.'],
        { scope: 'state_specific' },
      ),
      slide(
        'Let people clear the road',
        [
          'Someone may still be in the intersection.',
          'Let pedestrians, cyclists, and vehicles clear your path.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Yellow means decide safely',
        [
          'Yellow means the light is changing.',
          'Stop if you can do it safely.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Red means stop',
        [
          'Make a complete stop.',
          'Use the limit line. If there is no line, stop before the crosswalk.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Turning right on red',
        [
          'In California, this turn is usually allowed after a full stop.',
          'A sign may prohibit it.',
          'Yield before you turn.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Arrows control one direction',
        [
          'An arrow controls the direction it points.',
          'A red arrow means stop and wait.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Flashing signals',
        [
          'Flashing red works like a STOP sign.',
          'Flashing yellow means slow down and use caution.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A dark signal',
        [
          'Treat a broken signal like an all-way stop.',
          'Move carefully. Other drivers may be confused.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Remember the full picture', [
        'The light is only the first clue.',
        'Check arrows, signs, people, traffic, and space ahead.',
      ]),
    ],
  },
  {
    id: 'ca-stop-yield-entering-traffic',
    sources: ['ca-stop-yield-entering-traffic'],
    title: 'STOP, YIELD, or Keep Going?',
    summary: 'Three simple controls can create very different decisions.',
    keyPoints: [
      'Stop in the right place.',
      'Yield without forcing a gap.',
      'Enter only when you can clear.',
    ],
    challenge: challenge(
      'A YIELD sign faces you. Cross traffic is close.',
      'What should you do?',
      [
        'Keep your speed',
        'Slow and stop if needed',
        'Enter before the other car',
      ],
      1,
      'Yield means give others the space they need. Stop when necessary.',
    ),
    slides: [
      slide(
        'STOP means zero movement',
        ['Slow down early.', 'Stop fully before moving again.'],
        { scope: 'state_specific' },
      ),
      slide(
        'Use the first stopping point',
        [
          'Stop before the limit line.',
          'If there is no line, use the crosswalk or intersection edge.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A blocked view changes the next step',
        [
          'Make the required stop first.',
          'Then creep forward slowly for a better view.',
        ],
        { scope: 'state_specific' },
      ),
      slide('YIELD is not a rolling STOP', [
        'Slow enough to judge the gap.',
        'Stop only when traffic or people require it.',
      ]),
      slide(
        'Driveways join active traffic',
        [
          'People already on the road go first.',
          'Check sidewalks, bikes, and both traffic directions.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Do not enter a trap',
        [
          'Wait when you cannot clear the intersection.',
          'The same idea applies at railroad tracks.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Never force your priority', [
        'A correct rule cannot prevent another driver’s mistake.',
        'Yield again if a crash is developing.',
      ]),
      slide('Remember this order', [
        'Stop when required.',
        'Look for conflicts.',
        'Yield.',
        'Then enter a clear space.',
      ]),
    ],
  },
  {
    id: 'ca-turns-and-signals',
    sources: ['ca-turns-and-signals'],
    title: 'Make a Safe Turn',
    summary: 'A safe turn starts before the steering wheel moves.',
    keyPoints: [
      'Choose the correct lane.',
      'Signal and check early.',
      'Finish without drifting.',
    ],
    challenge: challenge(
      'You plan to turn right across a bicycle lane.',
      'What comes first?',
      [
        'Check for cyclists',
        'Move into the lane quickly',
        'Wait until the last second to signal',
      ],
      0,
      'Check the lane and blind spot. Yield before crossing it.',
    ),
    slides: [
      slide('A turn has four parts', [
        'Choose the lane.',
        'Signal.',
        'Yield.',
        'Finish in a legal lane.',
      ]),
      slide(
        'Signal before the turn',
        [
          'Give other people time to react.',
          'In California, signal during the final 100 feet.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Right turns start near the right edge',
        [
          'Move into the legal turn position.',
          'Watch for cyclists between you and the curb.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Left turns cross more traffic',
        ['Yield to approaching traffic.', 'Turn only when the gap is safe.'],
        { scope: 'state_specific' },
      ),
      slide('Do not cut the corner', [
        'Stay on your side while entering the intersection.',
        'Finish in a lane that permits your movement.',
      ]),
      slide(
        'One-way streets change the setup',
        [
          'Signs and arrows show the legal turn lane.',
          'Check the destination street before you move.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Cancel the signal', [
        'A forgotten signal tells a false story.',
        'Make sure it turns off after the maneuver.',
      ]),
      slide('Turn checklist', [
        'Lane. Signal. Mirrors. Blind spot. Yield. Turn.',
      ]),
    ],
  },
  {
    id: 'ca-speed-and-space',
    sources: ['ca-speed-laws', 'ca-following-distance-scanning'],
    questionPicks: [
      ['ca-speed-laws', 0],
      ['ca-speed-laws', 1],
      ['ca-speed-laws', 2],
      ['ca-following-distance-scanning', 0],
      ['ca-following-distance-scanning', 1],
      ['ca-following-distance-scanning', 5],
    ],
    title: 'Keep Space Around Your Car',
    summary: 'Speed and distance buy you time when something changes.',
    keyPoints: [
      'Choose a safe speed.',
      'Scan beyond the next car.',
      'Protect an escape space.',
    ],
    challenge: challenge(
      'The limit is 55 mph. Heavy fog hides the road ahead.',
      'Which speed should you choose?',
      [
        'Exactly 55 mph',
        'A lower speed you can control',
        'The speed of the fastest car',
      ],
      1,
      'The posted limit is a maximum. Conditions may require less.',
      'state_specific',
    ),
    slides: [
      slide(
        'The limit is not a target',
        [
          'A posted limit assumes good conditions.',
          'Rain, fog, traffic, or glare may require less.',
          'Learn the special 15 mph zones: blind intersections, alleys, and within 100 feet of a railroad crossing you cannot see for 400 feet in both directions.',
          'Gates, a warning signal, or a flagman at the crossing lift that railroad limit.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'California uses the Basic Speed Law',
        [
          'Never drive faster than conditions allow.',
          'You can be too fast below the posted limit.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Look beyond the next car', [
        'Scan far enough to see trouble early.',
        'Early changes are smoother and safer.',
      ]),
      slide('Leave a time gap', [
        'Pick a fixed point ahead.',
        'Count after the vehicle in front passes it.',
        'Add more time when risk grows.',
      ]),
      slide('Stopping takes three stages', [
        'First you see the problem.',
        'Then you react.',
        'Only then do the brakes slow the car.',
      ]),
      slide('Keep an escape space', [
        'Avoid sitting beside another vehicle.',
        'Leave room to move if traffic stops suddenly.',
      ]),
      slide('Handle a tailgater calmly', [
        'Create more room ahead.',
        'Change lanes or use a turnout when safe.',
        'Do not brake-check.',
      ]),
      slide('Remember the goal', [
        'See early.',
        'Leave space.',
        'Slow before the situation becomes urgent.',
      ]),
    ],
  },
  {
    id: 'ca-sign-shapes-and-colors',
    sources: ['ca-sign-shapes-and-colors'],
    title: 'Sign Shapes Give You a Head Start',
    summary: 'A sign can warn you before every word becomes readable.',
    keyPoints: [
      'Use shape first.',
      'Use color as a clue.',
      'Read the exact message.',
    ],
    challenge: challenge(
      'You see a red eight-sided sign ahead.',
      'What should you expect?',
      ['A warning', 'A full stop', 'A guide sign'],
      1,
      'The octagon is reserved for STOP.',
    ),
    slides: [
      slide('Start with the family', [
        'Shape and color give you an early clue.',
        'They help before the details are clear.',
      ]),
      slide('The octagon means STOP', [
        'Eight sides have one traffic meaning.',
        'Prepare for a complete stop.',
      ]),
      slide('The downward triangle means YIELD', [
        'Slow down and scan for conflicts.',
        'Stop if someone needs the space.',
      ]),
      slide('The round sign warns about tracks', [
        'A railroad crossing is ahead.',
        'Look for gates, lights, and a clear exit.',
      ]),
      slide('The pentagon marks a school area', [
        'Expect children near the road.',
        'Slow down and scan the sidewalks.',
      ]),
      slide('A diamond warns', [
        'The symbol previews the hazard.',
        'Change your speed or position early, while you still have room.',
      ]),
      slide('Colors support the message', [
        'Red often restricts.',
        'Yellow warns.',
        'Orange marks work zones.',
        'Green guides.',
      ]),
      slide('The exact message wins', [
        'Shape and color are shortcuts.',
        'Words, symbols, arrows, and plaques give the full rule.',
      ]),
    ],
  },
  {
    id: 'ca-regulatory-signs',
    sources: ['ca-regulatory-signs'],
    title: 'Signs That Tell You What to Do',
    summary:
      'Regulatory signs control a specific action, lane, vehicle, or time.',
    keyPoints: [
      'Read signs as actions.',
      'Check every plaque.',
      'Follow authorized directions.',
    ],
    challenge: challenge(
      'A police officer waves you through a red light.',
      'What should you follow?',
      ['The red light only', 'The officer’s direction', 'The car beside you'],
      1,
      'Follow the authorized direction while checking that the path is safe.',
      'state_specific',
    ),
    slides: [
      slide('Read the sign as a verb', [
        'Stop. Yield. Turn. Enter. Park.',
        'Ask which action the sign controls.',
      ]),
      slide('White rectangles give exact rules', [
        'They often control speed, turns, parking, or lane use.',
        'Read the full message.',
      ]),
      slide('A red slash means no', [
        'The symbol shows the prohibited move.',
        'Do not perform that action.',
      ]),
      slide('DO NOT ENTER protects one direction', [
        'The road or ramp is closed to your movement.',
        'Choose another legal path.',
      ]),
      slide('WRONG WAY means act now', [
        'Slow down.',
        'Move out of opposing traffic without creating another hazard.',
      ]),
      slide('Plaques narrow the rule', [
        'A rule may apply only at certain times.',
        'It may target one lane or vehicle type.',
      ]),
      slide(
        'People can direct traffic',
        [
          'An authorized officer or flagger may override the normal pattern.',
          'Move carefully.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Exam shortcut', [
        'Find the controlled action first.',
        'Then check lane, time, vehicle, and exception.',
      ]),
    ],
  },
  {
    id: 'ca-warning-and-guide-signs',
    sources: ['ca-warning-and-guide-signs'],
    title: 'Signs That Warn You Early',
    summary: 'A warning sign gives you time. Use that time before the hazard.',
    keyPoints: [
      'Read the symbol.',
      'Adjust before the hazard.',
      'Use guide signs without sudden moves.',
    ],
    challenge: challenge(
      'A LANE ENDS sign appears ahead.',
      'What should you do first?',
      [
        'Wait for the lane to disappear',
        'Check traffic and plan a merge',
        'Stop in your lane',
      ],
      1,
      'Plan early. A small speed change is better than a last-second move.',
    ),
    slides: [
      slide('Warnings buy you time', [
        'Look farther ahead.',
        'Prepare before the road changes.',
      ]),
      slide('The symbol names the problem', [
        'Curves, merges, crossings, and slippery roads use clear symbols.',
        'Match your action to the hazard.',
      ]),
      slide(
        'Advisory speed is about the hazard',
        [
          'It suggests a safer speed for the condition ahead.',
          'It is not the general speed limit.',
        ],
        { scope: 'state_specific' },
      ),
      slide('School signs widen your scan', [
        'Watch sidewalks, parked cars, and crosswalks.',
        'A child may appear from the side.',
      ]),
      slide(
        'Railroad warnings need an exit plan',
        [
          'Never enter tracks without room beyond them.',
          'A train cannot steer around you.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Orange means temporary work', [
        'Slow down.',
        'Expect workers, equipment, closed lanes, and flaggers.',
      ]),
      slide('Guide signs help you plan', [
        'Green shows routes and destinations.',
        'Blue often shows services.',
        'Brown points to recreation.',
      ]),
      slide('Missed the sign?', [
        'Continue safely.',
        'Do not make a sudden turn or reverse to recover the route.',
      ]),
    ],
  },
  {
    id: 'ca-road-markings-and-curbs',
    sources: ['ca-road-markings-and-curbs'],
    title: 'Lines, Arrows, and Curb Colors',
    summary: 'The road surface tells you where to drive, stop, and turn.',
    keyPoints: [
      'Read color and pattern.',
      'Follow lane arrows.',
      'Use the correct stopping point.',
    ],
    challenge: challenge(
      'A stop sign has a painted limit line.',
      'Where should you stop first?',
      ['Before the line', 'Across the crosswalk', 'Beside the sign'],
      0,
      'The limit line is the first stopping point.',
      'state_specific',
    ),
    slides: [
      slide('Color tells you the traffic relationship', [
        'Yellow usually separates opposing traffic.',
        'White usually separates traffic moving together.',
      ]),
      slide(
        'Pattern tells you about crossing',
        [
          'Broken lines may allow crossing when safe.',
          'Solid lines warn or restrict it.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Double lines need attention',
        [
          'Do not treat every double line the same.',
          'Color, spacing, and road context matter.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Arrows assign a movement', [
        'Choose the lane before the last moment.',
        'Follow the arrow painted in your lane.',
      ]),
      slide(
        'Limit lines show where to stop',
        ['Stop before the line.', 'Keep crosswalks clear.'],
        { scope: 'state_specific' },
      ),
      slide('Painted islands are not travel lanes', [
        'Stay out unless markings allow entry.',
        'Do not use them to pass a queue.',
      ]),
      slide(
        'Curb colors control stopping',
        [
          'Red, white, green, yellow, and blue have different uses.',
          'Check signs for details.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Read markings in layers', [
        'Color first.',
        'Then pattern.',
        'Then arrows, signs, and nearby traffic.',
      ]),
    ],
  },
  {
    id: 'ca-uncontrolled-intersections',
    sources: ['ca-uncontrolled-intersections'],
    title: 'Who Goes First?',
    summary: 'Right-of-way rules organize movement. They do not remove danger.',
    keyPoints: [
      'Check who arrived first.',
      'Look right when arrival is tied.',
      'Never force a turn.',
    ],
    challenge: challenge(
      'Two cars reach an uncontrolled intersection together.',
      'Which car normally goes first?',
      ['The car on the right', 'The car on the left', 'The faster car'],
      0,
      'When arrival is tied, the car on the right normally goes first.',
      'state_specific',
    ),
    slides: [
      slide(
        'Someone already inside goes first',
        [
          'Let the intersection clear.',
          'Do not challenge a vehicle already in your path.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Arrival order organizes the queue',
        [
          'The first clear arrival normally moves first.',
          'A later arrival waits.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Same time? Look right',
        [
          'The driver on the left yields.',
          'Confirm that the other driver is actually moving.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A T-intersection has a continuing road',
        [
          'Traffic on the ending road yields.',
          'People in the intersection still come first.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Blocked views demand less speed', [
        'Cover the brake.',
        'Move only far enough to see.',
      ]),
      slide('Eye contact is not a legal signal', [
        'A driver may look at you and still move.',
        'Trust space and speed, not a glance.',
      ]),
      slide(
        'Mountain roads have a special rule',
        [
          'When neither car can pass, the downhill-facing driver normally backs up.',
          'Use the nearest safe space.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Right-of-way is never forced',
        [
          'Give up your turn when a crash is developing.',
          'Safety beats being technically first.',
          'A funeral procession led by a traffic officer has the right-of-way.',
          'Never cut into or through it — interrupting a procession can bring a ticket.',
        ],
        { scope: 'state_specific' },
      ),
    ],
  },
  {
    id: 'ca-crosswalks-and-roundabouts',
    sources: ['ca-crosswalks-and-roundabouts'],
    title: 'People in Your Path',
    summary:
      'Pedestrians can be hard to see and have no protection from your car.',
    keyPoints: [
      'Scan before the crosswalk.',
      'Protect blind pedestrians.',
      'Yield before a roundabout.',
    ],
    challenge: challenge(
      'A car is stopped at a crosswalk in the next lane.',
      'What should you do?',
      ['Pass it', 'Slow and prepare to stop', 'Honk and continue'],
      1,
      'The stopped car may be hiding a pedestrian.',
      'state_specific',
    ),
    slides: [
      slide(
        'A crosswalk may be unmarked',
        [
          'Intersection corners can form a crosswalk without painted lines.',
          'Scan both sides.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Slow before the person appears', [
        'Parked cars and large vehicles can block your view.',
        'Expect movement from the side.',
      ]),
      slide(
        'Do not pass a stopped crosswalk vehicle',
        ['It may be protecting someone you cannot see.', 'Stop and check.'],
        { scope: 'state_specific' },
      ),
      slide(
        'Blind pedestrians need predictable traffic',
        [
          'A white cane or guide dog is an important clue.',
          'Stop and stay quiet.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Do not wave someone into danger', [
        'Another lane may still be moving.',
        'Yield without giving a risky signal.',
      ]),
      slide(
        'Roundabout traffic already inside goes first',
        [
          'Slow before the entry.',
          'Choose a safe gap and enter in the correct direction.',
          'Enter heading to the right of the central island.',
          'Inside, everyone moves counterclockwise — do not stop or pass.',
          'Missed your exit? Circle around once more.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Choose the roundabout lane early', [
        'Signs and arrows show the lane for your exit.',
        'Avoid changing lanes inside.',
      ]),
      slide('Exit with a final check', [
        'Signal when useful.',
        'Watch the crosswalk beyond the roundabout.',
      ]),
    ],
  },
  {
    id: 'ca-complex-intersections',
    sources: [],
    visuals: [
      'ca-traffic-signals-a01',
      'ca-turns-and-signals-q03-a',
      'ca-turns-and-signals-a02',
    ],
    questionPicks: [],
    extraTests: [
      test(
        'Your left-turn signal changes from a green arrow to a steady yellow arrow while you are already inside the intersection.',
        [
          'Stop where you are',
          'Cautiously complete the turn',
          'Reverse behind the limit line',
        ],
        1,
        'A yellow arrow means the protected time is ending. A driver already in the intersection completes the turn carefully.',
        'state_specific',
      ),
      test(
        'You face a flashing yellow arrow for your left turn. A pedestrian is crossing the street you are turning into.',
        [
          'Turn behind the pedestrian right away',
          'Yield to the pedestrian and oncoming traffic, then turn',
          'Wait — this arrow never allows a turn',
        ],
        1,
        'A flashing yellow arrow allows the turn only after yielding to oncoming traffic and anyone crossing.',
        'state_specific',
      ),
      test(
        'You want to turn right, and your lane faces a steady red arrow.',
        [
          'Stop, then turn when clear',
          'Wait for a green light or green arrow',
          'Treat it like a STOP sign',
        ],
        1,
        'No turn is allowed against a red arrow — turning right on red applies to a plain red light, not a red arrow.',
        'state_specific',
      ),
      test(
        'You turn left from a two-way street onto another two-way street.',
        [
          'End in the left lane closest to the middle',
          'End in any lane that looks open',
          'End near the right curb',
        ],
        0,
        'A left turn onto a two-way street ends in the left lane closest to the middle of the road.',
        'state_specific',
      ),
      test(
        'A dedicated right-turn lane curves behind an island. The through lanes face a red light.',
        [
          'Stop and wait for green with the through traffic',
          'Keep moving under the lane\u2019s own light or sign, yielding to pedestrians',
          'Merge left into the through lanes',
        ],
        1,
        'A dedicated right-turn lane does not merge and keeps moving under its own controls, with pedestrians protected.',
        'state_specific',
      ),
      test(
        'A green circle — not an arrow — faces you as you wait to turn left.',
        [
          'The turn is protected',
          'Turn only after yielding to oncoming traffic and pedestrians',
          'Left turns are not allowed on a green circle',
        ],
        1,
        'A green circular light permits the turn but does not protect it. Yield first, then turn.',
        'state_specific',
      ),
    ],
    title: 'Read the Whole Intersection',
    summary:
      'Busy intersections stack signals, arrows, and lane rules. Read them in one order.',
    keyPoints: [
      'Find the signal for your lane.',
      'Know which turns are protected.',
      'Finish in the correct lane.',
    ],
    challenge: challenge(
      'You wait to turn left. Your signal shows a flashing yellow arrow, and oncoming traffic keeps coming.',
      'What should you do?',
      [
        'Turn now — the arrow allows it',
        'Yield to oncoming traffic, then turn when clear',
        'Stop and wait for a green arrow',
      ],
      1,
      'A flashing yellow arrow allows the turn only after you yield. It is not a protected turn.',
      'state_specific',
    ),
    slides: [
      slide(
        'Every lane has its own signal',
        [
          'A big intersection can show several signal heads at once.',
          'Find the one over your lane before anything else.',
          'A circular light speaks to everyone moving in that direction.',
          'An arrow speaks only to the turn it points at.',
          'Signs on the corner can add or remove options.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide(
        'A green arrow is a promise',
        [
          'A green arrow means a protected turn.',
          'Oncoming traffic is held by a red light.',
          'A green circle makes a different offer.',
          'You may turn, but you must yield to oncoming traffic and pedestrians first.',
          'Same direction, very different duties.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide(
        'Yellow arrows end the protection',
        [
          'A steady yellow arrow means your protected time is ending.',
          'Already in the intersection? Complete the turn with care.',
          'A flashing yellow arrow never protects you.',
          'Turn only after yielding to oncoming traffic, and watch for people crossing.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide(
        'A red arrow closes the turn',
        [
          'A red arrow means stop and wait.',
          'No turning while it shows — not even right on red.',
          'Wait for the green light or green arrow.',
          'A plain red light is different: a right turn is usually allowed after a full stop, unless a sign prohibits it.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide(
        'Finish in the matching lane',
        [
          'Turns have a home lane on both ends.',
          'Right turns start near the right edge and end there. Do not swing wide.',
          'A left turn onto a two-way street ends in the lane closest to the middle.',
          'One-way onto one-way with three or more lanes? Any open lane works.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide(
        'An island lane keeps moving',
        [
          'Some right turns get a dedicated lane behind an island.',
          'It does not merge with through traffic.',
          'You may keep moving even when the through lanes face a red light.',
          'Obey the lane\u2019s own light or sign, and always yield to pedestrians in the crosswalk.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide(
        'One order for every intersection',
        [
          'Read the signs first. They set the rules of the place.',
          'Then find your lane\u2019s signal and its arrows.',
          'Then people: crosswalks, cyclists, and anyone still clearing the road.',
          'Then pick the gap that lets you finish in the right lane.',
          'The pieces live in earlier lessons — lights, STOP and YIELD, who goes first, people in your path.',
          'This is where they meet.',
        ],
        { noExpansion: true },
      ),
    ],
  },
  {
    id: 'ca-u-turns-starting-backing',
    sources: ['ca-u-turns-starting-backing'],
    title: 'Driveways, Backing, and U-Turns',
    summary: 'Slow maneuvers still create serious conflicts.',
    keyPoints: [
      'Look around before moving.',
      'Back at walking speed.',
      'Check every U-turn condition.',
    ],
    challenge: challenge(
      'You miss your freeway exit.',
      'What is the safe choice?',
      [
        'Back along the shoulder',
        'Continue to the next exit',
        'Use the median',
      ],
      1,
      'Keep going. Never reverse to recover a missed freeway exit.',
    ),
    slides: [
      slide('Check before the car moves', [
        'Walk around when a child or object may be hidden.',
        'Use mirrors and a shoulder check.',
      ]),
      slide('Back slowly', [
        'Look in the direction you are moving.',
        'Stop when the view becomes uncertain.',
      ]),
      slide('Cameras do not show everything', [
        'A lens can miss low, close, or side hazards.',
        'Use it as one tool, not the only tool.',
      ]),
      slide(
        'Driveways cross sidewalks',
        [
          'Yield to people before entering the road.',
          'Then find a safe traffic gap.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A U-turn needs legal space',
        [
          'Check signs, lane position, traffic, and visibility.',
          'Possible does not always mean legal.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'California uses a 200-foot visibility test',
        [
          'You need a clear view in both directions.',
          'Other location rules can still prohibit the turn.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Fire stations and business districts add limits',
        [
          'Read the exact location in the question.',
          'Do not apply one U-turn rule everywhere.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Missed your move?', [
        'Continue to a legal place.',
        'A wrong route is safer than a sudden reversal.',
      ]),
    ],
  },
  {
    id: 'ca-parking-and-curbs',
    sources: ['ca-parking-and-curbs'],
    title: 'Park Without Getting a Ticket',
    summary: 'Good parking protects visibility, access, and moving traffic.',
    keyPoints: [
      'Read signs and curbs.',
      'Secure the car on hills.',
      'Leave the curb safely.',
    ],
    challenge: challenge(
      'You park downhill beside a curb.',
      'Where should the front wheels point?',
      ['Toward the curb', 'Away from the curb', 'Straight ahead'],
      0,
      'Turn toward the curb so a rolling car moves away from traffic.',
      'state_specific',
    ),
    slides: [
      slide(
        'Check the place before the technique',
        [
          'A perfect parking move is still illegal in a prohibited spot.',
          'Read signs and curb color first.',
          'Double parking — waiting in the road beside a parked car — is on the never list, even briefly.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Parallel parking stays slow', [
        'Signal and check around the car.',
        'Back in gradually and center the vehicle.',
      ]),
      slide(
        'Stay close to the curb',
        [
          'California generally requires parking within 18 inches.',
          'One-way roads can change the allowed side.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Secure the car', [
        'Set the parking brake.',
        'Use Park or the correct gear before leaving.',
      ]),
      slide(
        'Hill parking controls a possible roll',
        [
          'With a curb, turn the wheels so the curb can stop the car.',
          'Without a curb, turn toward the road edge.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Hydrants need clear space',
        [
          'California generally requires 15 feet.',
          'A legal exception must be clear.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Blue spaces are protected',
        [
          'Use them only with valid authorization.',
          'Keep access aisles clear.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Leaving is another maneuver', [
        'Signal.',
        'Check mirrors and blind spots.',
        'Enter only when the gap is safe.',
      ]),
    ],
  },
  {
    id: 'ca-choosing-changing-lanes',
    sources: ['ca-choosing-changing-lanes'],
    title: 'Choose the Right Lane',
    summary: 'Good lane choices prevent sudden moves later.',
    keyPoints: [
      'Plan your lane early.',
      'Check every blind spot.',
      'Change one lane at a time.',
    ],
    challenge: challenge(
      'Your mirror looks clear before a lane change.',
      'What should you do next?',
      ['Move immediately', 'Check the blind spot', 'Brake in your lane'],
      1,
      'Mirrors leave blind spots. Look over your shoulder before moving.',
    ),
    slides: [
      slide('Choose early', [
        'Use signs, arrows, and your route.',
        'Last-second lane changes create extra risk.',
      ]),
      slide('Use the full check', [
        'Mirror.',
        'Signal.',
        'Blind spot.',
        'Gap.',
        'Then move.',
      ]),
      slide('One lane at a time', [
        'Finish one lane change before starting another.',
        'Keep the signal useful and clear.',
      ]),
      slide('Do not camp beside another car', [
        'That car may need your lane.',
        'Move ahead or drop back when safe.',
      ]),
      slide(
        'Traffic breaks need patience',
        [
          'An officer may weave to slow traffic.',
          'Do not pass or race the controlled pattern.',
        ],
        { scope: 'state_specific' },
      ),
      slide('A lane can end quickly', [
        'Plan a merge when the warning appears.',
        'Do not wait for the pavement to disappear.',
      ]),
      slide('Missed the lane?', [
        'Continue safely and reroute.',
        'Do not cut across traffic or painted barriers.',
      ]),
      slide('Make your move predictable', [
        'Signal early enough to help.',
        'Use a steady speed and smooth path.',
      ]),
    ],
  },
  {
    id: 'ca-passing-rules',
    sources: ['ca-passing-rules'],
    title: 'Pass—or Wait?',
    summary:
      'Passing needs legal permission, enough sight distance, and a safe return.',
    keyPoints: [
      'Check the markings.',
      'See the whole passing path.',
      'Return without cutting in.',
    ],
    challenge: challenge(
      'A hill hides the road ahead on a two-lane road.',
      'Should you pass?',
      [
        'Yes, if you accelerate',
        'No, wait for a clear view',
        'Yes, if the other car is slow',
      ],
      1,
      'Never use an opposing lane when the view ahead is blocked.',
      'state_specific',
    ),
    slides: [
      slide(
        'Passing begins with permission',
        [
          'Check signs and lane markings.',
          'A safe-looking gap does not cancel a restriction.',
        ],
        { scope: 'state_specific' },
      ),
      slide('See the complete path', [
        'You need room to move out, pass, and return.',
        'Do not guess beyond a hill or curve.',
      ]),
      slide('Check behind before moving out', [
        'Another driver may already be passing.',
        'Use mirrors and a blind-spot check.',
      ]),
      slide(
        'Pass with a clear speed difference',
        [
          'Do not stay beside the other vehicle.',
          'Finish without exceeding the legal speed.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Return with space', [
        'See the passed vehicle clearly in your mirror.',
        'Do not cut closely in front.',
      ]),
      slide(
        'Never pass near certain conflicts',
        [
          'Crossings, intersections, bridges, and blocked views may prohibit passing.',
          'Read the exact scenario.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'When someone passes you',
        ['Keep a steady path.', 'Do not speed up.', 'Create room if needed.'],
        { scope: 'state_specific' },
      ),
      slide('Waiting is a valid decision', [
        'A few seconds can remove the risk.',
        'Pass only when every part of the path works.',
      ]),
    ],
  },
  {
    id: 'ca-freeway-merging',
    sources: ['ca-freeway-merging'],
    title: 'Enter and Leave the Freeway',
    summary:
      'Freeway driving works best when speed and lane choices are planned early.',
    keyPoints: [
      'Match traffic before merging.',
      'Protect following space.',
      'Never reverse for an exit.',
    ],
    challenge: challenge(
      'You are entering from an acceleration lane.',
      'What is the main goal?',
      [
        'Stop at the lane end',
        'Match traffic and find a gap',
        'Enter at a very low speed',
      ],
      1,
      'Use the ramp to build a safe speed and join a real gap.',
    ),
    slides: [
      slide('Use the ramp to prepare', [
        'Build speed while scanning traffic.',
        'Do not wait until the merge point to look.',
      ]),
      slide(
        'Freeway traffic has priority',
        [
          'Find a gap and adjust smoothly.',
          'Do not force another driver to brake.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Use the whole acceleration lane', [
        'More lane gives you more time.',
        'Stop only when traffic leaves no safe alternative.',
      ]),
      slide('Once inside, rebuild space', [
        'Check your following gap.',
        'Avoid staying beside another vehicle.',
      ]),
      slide('Plan the exit early', [
        'Read signs and move into the correct lane.',
        'Signal before the exit.',
      ]),
      slide('Slow on the exit ramp', [
        'Leave freeway traffic at a stable speed.',
        'Reduce speed where the ramp allows it.',
      ]),
      slide(
        'Missed the exit?',
        ['Take the next one.', 'Never stop, back up, or cross a gore area.'],
        { scope: 'state_specific' },
      ),
      slide(
        'Ramp signals control entry',
        [
          'Stop when the meter is red.',
          'Enter on the permitted signal and merge normally.',
        ],
        { scope: 'state_specific' },
      ),
    ],
  },
  {
    id: 'ca-special-lanes',
    sources: ['ca-special-lanes'],
    title: 'Lanes with Special Rules',
    summary: 'Some lanes are legal only for a certain move, vehicle, or time.',
    keyPoints: [
      'Read the posted condition.',
      'Enter only where allowed.',
      'Watch for people already in the lane.',
    ],
    challenge: challenge(
      'You want to enter an HOV lane.',
      'What should you trust?',
      ['Yesterday’s rule', 'The current signs and markings', 'The car ahead'],
      1,
      'Occupancy, hours, access, and toll rules can change by location.',
      'state_specific',
    ),
    slides: [
      slide('A special lane has a specific job', [
        'Identify the lane before entering.',
        'Do not treat it as ordinary travel space.',
      ]),
      slide(
        'Center-turn lanes are for turns',
        [
          'Use them to prepare for a legal left turn or U-turn.',
          'Do not cruise or pass in them.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'California limits center-lane travel',
        [
          'Do not travel more than 200 feet in the lane.',
          'Watch for opposing drivers using it too.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Bicycle lanes carry real traffic',
        [
          'Check behind before crossing one.',
          'Enter for a turn only where allowed.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'HOV and toll lanes use posted rules',
        [
          'Check occupancy, vehicle type, time, toll, and access point.',
          'Do not assume.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Transit lanes are not shortcuts',
        [
          'A limited entry may be allowed for a turn.',
          'Yield to buses or other authorized users.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Barriers are not passing areas',
        [
          'Two separated sets of double lines form a barrier.',
          'Do not drive across it.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Use turnouts when required and safe',
        [
          'A slow vehicle may need to let traffic pass.',
          'Reenter only with a safe gap.',
        ],
        { scope: 'state_specific' },
      ),
    ],
  },
  {
    id: 'ca-bicycles-motorcycles',
    sources: ['ca-bicycles-motorcycles'],
    title: 'Bicycles and Motorcycles',
    summary: 'Smaller road users are easy to hide and easy to injure.',
    keyPoints: [
      'Search every blind spot.',
      'Give real passing space.',
      'Respect the full lane.',
    ],
    challenge: challenge(
      'You plan to open a door beside moving traffic.',
      'What should you check?',
      [
        'Only the front mirror',
        'Behind you for bikes and motorcycles',
        'Only the sidewalk',
      ],
      1,
      'A rider may be beside the vehicle. Check before opening the door.',
    ),
    slides: [
      slide('Look where riders can disappear', [
        'Check mirrors and blind spots.',
        'Look again before turning or changing lanes.',
      ]),
      slide(
        'Bicycle lanes carry traffic',
        [
          'A cyclist may approach from behind.',
          'Yield before crossing the lane.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Expect movement away from the edge', [
        'Debris, drains, and parked doors can push a cyclist left.',
        'Leave room.',
      ]),
      slide(
        'Pass with space',
        [
          'California requires at least three feet when possible.',
          'Change lanes when needed and safe.',
        ],
        { scope: 'state_specific' },
      ),
      slide('A motorcycle owns its lane', [
        'Do not squeeze beside it.',
        'Use a normal lane-change gap.',
      ]),
      slide('Their speed is hard to judge', [
        'A narrow profile looks farther away.',
        'Check twice before turning across its path.',
      ]),
      slide(
        'Lane splitting is legal in California',
        [
          'Do not block or crowd a rider doing it lawfully.',
          'Stay predictable.',
        ],
        { scope: 'state_specific' },
      ),
      slide('The safety rule is simple', [
        'Search longer.',
        'Leave more room.',
        'Never assume the rider saw you.',
      ]),
    ],
  },
  {
    id: 'ca-trucks-buses-slow-vehicles',
    sources: ['ca-trucks-buses-slow-vehicles'],
    title: 'Trucks, Buses, and Slow Vehicles',
    summary:
      'Large vehicles need more room. Slow vehicles change closing speed.',
    keyPoints: [
      'Stay out of no-zones.',
      'Expect wide turns.',
      'Plan before passing.',
    ],
    challenge: challenge(
      'A truck starts a wide right turn.',
      'Where should you be?',
      [
        'Beside the truck',
        'Behind its turning path',
        'Between the truck and curb',
      ],
      1,
      'Stay back. The trailer can close the space beside it.',
    ),
    slides: [
      slide('Large vehicles have large blind spots', [
        'If you cannot see the driver in a mirror, the driver may not see you.',
        'Move out of the no-zone.',
      ]),
      slide('They need more stopping room', [
        'Do not cut closely in front.',
        'Leave extra space after passing.',
      ]),
      slide('Wide turns use two paths', [
        'The cab may swing out.',
        'The rear wheels may track close to the curb.',
      ]),
      slide('Never squeeze beside a turning truck', [
        'The open space can disappear.',
        'Wait behind the vehicle.',
      ]),
      slide('Pass without lingering', [
        'Move through the blind spot steadily.',
        'Return only when the truck is clearly visible in your mirror.',
      ]),
      slide('Slow vehicles change your timing', [
        'You may close the gap faster than expected.',
        'Brake early and wait for a legal pass.',
      ]),
      slide(
        'An orange triangle means very slow',
        [
          'A slow-moving vehicle emblem is an orange and red triangle on the back.',
          'It marks machines that usually travel 25 mph or less, like farm or road equipment.',
          'Spot it early and slow smoothly — pass only when the law and your view allow.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide(
        'Animals can react suddenly',
        [
          'Slow down near riders or livestock.',
          'Follow the rider’s signal when an animal is frightened.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Give size the space it needs', [
        'More room helps everyone see, stop, and turn.',
      ]),
    ],
  },
  {
    id: 'ca-school-buses-emergency-vehicles',
    sources: ['ca-emergency-school-work-zones'],
    questionPicks: [
      ['ca-emergency-school-work-zones', 0],
      ['ca-emergency-school-work-zones', 1],
      ['ca-emergency-school-work-zones', 2],
      ['ca-emergency-school-work-zones', 3],
      ['ca-emergency-school-work-zones', 4],
    ],
    extraTests: [
      test(
        'A crossing guard tells you to wait. What should you do?',
        [
          'Follow the guard',
          'Follow the nearest driver',
          'Continue if your lane looks clear',
        ],
        0,
        'An authorized crossing guard controls traffic at that moment.',
        'state_specific',
      ),
    ],
    title: 'School Buses and Emergency Vehicles',
    summary: 'Some vehicles and people need the road cleared immediately.',
    keyPoints: [
      'Make a predictable path.',
      'Stop for school-bus red lights.',
      'Protect stopped responders.',
    ],
    challenge: challenge(
      'An ambulance approaches from behind with lights and siren.',
      'What should you do?',
      [
        'Speed up',
        'Move right and stop safely',
        'Stop inside the intersection',
      ],
      1,
      'Make a clear path. Avoid stopping where you block the intersection.',
      'state_specific',
    ),
    slides: [
      slide(
        'Emergency vehicles need a clear path',
        ['Check around you.', 'Move toward the right edge and stop when safe.'],
        { scope: 'state_specific' },
      ),
      slide(
        'Do not stop in the conflict',
        [
          'Clear the intersection first when necessary.',
          'Then stop where responders can pass.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Look for more responders', [
        'One vehicle may be followed by several more.',
        'Check before reentering traffic.',
      ]),
      slide(
        'Protect vehicles stopped on the roadside',
        [
          'Move over when the law requires and space allows.',
          'Otherwise slow down safely.',
          'Since 2026, California extends this protection to any stopped vehicle displaying warning or hazard lights, not only emergency vehicles.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Do not follow the response',
        [
          'California prohibits following a responding emergency vehicle within 300 feet.',
          'Give the scene room.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'School-bus red lights mean stop',
        ['Stop while the red signals flash.', 'Watch for children crossing.'],
        { scope: 'state_specific' },
      ),
      slide(
        'A divided road can change who stops',
        [
          'Read the median and road design carefully.',
          'Do not invent an exception on an ordinary road.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'People can control traffic too',
        [
          'Follow authorized crossing guards and officers.',
          'Stay stopped until they release your movement.',
        ],
        { scope: 'state_specific' },
      ),
    ],
  },
  {
    id: 'ca-rail-light-rail-work-zones',
    sources: [
      'ca-warning-and-guide-signs',
      'ca-emergency-school-work-zones',
      'ca-trucks-buses-slow-vehicles',
    ],
    questionPicks: [
      ['ca-warning-and-guide-signs', 3],
      ['ca-warning-and-guide-signs', 4],
      ['ca-warning-and-guide-signs', 5],
      ['ca-emergency-school-work-zones', 5],
    ],
    extraTests: [
      test(
        'May you drive around a lowered railroad gate when no train is visible?',
        ['Yes', 'No', 'Only after honking'],
        1,
        'Never drive around, under, or through a closed or moving gate.',
        'state_specific',
      ),
      test(
        'Before turning across light-rail tracks, what should you check?',
        [
          'Only the traffic light',
          'The rail vehicle’s path and every control',
          'Only the car behind you',
        ],
        1,
        'A rail vehicle cannot steer away. Check its path before crossing.',
        'state_specific',
      ),
    ],
    title: 'Railroads, Light Rail, and Work Zones',
    summary: 'Tracks and temporary lanes punish last-second decisions.',
    keyPoints: [
      'Keep an exit beyond tracks.',
      'Never bypass a gate.',
      'Follow temporary controls.',
    ],
    challenge: challenge(
      'Traffic is stopped just beyond railroad tracks.',
      'May you enter the crossing?',
      [
        'Yes, if no train is visible',
        'Only when your car can clear',
        'Yes, after the gate rises',
      ],
      1,
      'Do not enter until the whole vehicle can fit beyond the tracks.',
      'state_specific',
    ),
    slides: [
      slide(
        'Tracks need an exit',
        [
          'Check the space beyond the rails.',
          'Wait before the crossing when traffic is backed up.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A train cannot avoid you',
        [
          'Never race it.',
          'Stop for lights, gates, flaggers, and an approaching train.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Never go around a gate',
        [
          'A second train may be hidden.',
          'Wait until the control fully allows movement.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Stalled on tracks? Get out', [
        'Move everyone away from the rails.',
        'Use the crossing emergency sign, then call 911.',
      ]),
      slide(
        'Light rail shares city space',
        [
          'Check signals, signs, and the rail path.',
          'Never turn in front of an approaching rail vehicle.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Orange means the road may change', [
        'Expect narrow lanes, workers, equipment, and sudden queues.',
        'Slow down early.',
      ]),
      slide(
        'Flaggers give real directions',
        [
          'Follow the flagger even when the usual signal differs.',
          'Do not move until released.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Leave the work zone calmly', [
        'Keep the lower safe speed until you are fully clear.',
        'Watch for traffic merging back.',
      ]),
    ],
  },
  {
    id: 'ca-driving-after-dark',
    sources: ['ca-night-weather-visibility'],
    questionPicks: [
      ['ca-night-weather-visibility', 1],
      ['ca-night-weather-visibility', 2],
    ],
    extraTests: [
      test(
        'When should you switch from high beams for an approaching car?',
        ['Within 500 feet', 'Within 50 feet', 'Only after it flashes'],
        0,
        'California requires dimming within 500 feet of an approaching vehicle.',
        'state_specific',
      ),
      test(
        'What should you do when oncoming headlights create glare?',
        [
          'Look directly at them',
          'Use the right road edge as a guide',
          'Close one eye',
        ],
        1,
        'Look toward the right edge and reduce speed without staring at the lights.',
      ),
      test(
        'Your headlights show less road than you need to stop. What should you do?',
        ['Slow down', 'Use parking lights', 'Drive faster'],
        0,
        'Your speed must let you stop within the road you can see.',
      ),
      test(
        'Why clean headlights and windows before a night drive?',
        ['To improve visibility', 'To save fuel', 'To reduce tire wear'],
        0,
        'Clean glass and lights help you see and be seen.',
      ),
    ],
    title: 'Driving After Dark',
    summary:
      'At night, you must control speed with the road you can actually see.',
    keyPoints: [
      'Use the correct lights.',
      'Dim high beams early.',
      'Slow when sight distance shrinks.',
    ],
    challenge: challenge(
      'Your headlights cannot show enough road for your current stopping distance.',
      'What should you change?',
      ['Your speed', 'Your radio', 'Your lane only'],
      0,
      'Slow down until the visible road is long enough for a safe stop.',
    ),
    slides: [
      slide(
        'Headlights help others see you',
        [
          'They do more than light the road.',
          'Use them whenever visibility rules require.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Headlights run on a clock too',
        [
          'In California, headlights go on 30 minutes after sunset and stay on until 30 minutes before sunrise.',
          'The clock applies even when the sky still looks bright.',
          'An exam answer like “only when it is fully dark” is wrong.',
        ],
        { scope: 'state_specific', noExpansion: true },
      ),
      slide('Do not outrun your lights', [
        'You need enough visible road to stop.',
        'Slow down before dark curves and hills.',
      ]),
      slide(
        'High beams have limits',
        [
          'Dim within 500 feet of an approaching vehicle.',
          'Dim within 300 feet when following.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Glare steals detail', [
        'Look toward the right road edge.',
        'Reduce speed without staring at oncoming lights.',
      ]),
      slide('Interior light can hurt night vision', [
        'Keep the dashboard readable but not bright.',
        'Put the phone away.',
      ]),
      slide('Clean glass matters', [
        'Dust and streaks scatter light.',
        'Keep windows, mirrors, and lamps clear.',
      ]),
      slide('Watch for what has no light', [
        'Pedestrians, animals, debris, and parked cars may appear late.',
        'Scan the edges.',
      ]),
      slide('Night rule', [
        'See less? Slow down.',
        'Give yourself more time and more space.',
      ]),
    ],
  },
  {
    id: 'ca-weather-and-mountain-roads',
    sources: ['ca-night-weather-visibility', 'ca-uncontrolled-intersections'],
    questionPicks: [
      ['ca-night-weather-visibility', 0],
      ['ca-night-weather-visibility', 3],
      ['ca-night-weather-visibility', 4],
      ['ca-night-weather-visibility', 5],
    ],
    extraTests: [
      test(
        'Which beams usually work best in fog?',
        ['Low beams', 'High beams', 'Parking lights only'],
        0,
        'Low beams reduce reflected glare in fog or smoke.',
      ),
      test(
        'Two cars meet on a steep narrow road and cannot pass. Who normally backs up?',
        [
          'The downhill-facing driver',
          'The uphill-facing driver',
          'The larger car',
        ],
        0,
        'California normally requires the downhill-facing driver to yield and back up.',
        'state_specific',
      ),
    ],
    title: 'Rain, Fog, Heat, and Mountain Roads',
    summary:
      'Bad conditions reduce the grip and visibility you normally trust.',
    keyPoints: [
      'Slow before traction disappears.',
      'Use low beams in fog.',
      'Plan space on narrow grades.',
    ],
    challenge: challenge(
      'Heavy fog reflects your high beams back at you.',
      'Which lights should you use?',
      ['Low beams', 'High beams', 'Parking lights only'],
      0,
      'Low beams reduce glare and light the road more effectively.',
    ),
    slides: [
      slide('Rain changes two things', [
        'You see less.',
        'Your tires also have less grip.',
        'Bridges and overpasses ice over before the road around them.',
        'Shaded patches freeze first and dry out last.',
        'After deep water, brakes can go soft — dry them by pressing brake and accelerator lightly at the same time.',
      ]),
      slide('Make every control smoother', [
        'Brake earlier.',
        'Turn gently.',
        'Leave a larger following gap.',
      ]),
      slide('Fog needs low beams', [
        'High beams reflect light back.',
        'Use low beams and reduce speed.',
      ]),
      slide('Never drive into unknown water', [
        'Depth and current are hard to judge.',
        'Turn around when the road is flooded.',
      ]),

      slide(
        'Heat can hurt the vehicle',
        [
          'Watch tires, temperature, and warning lights.',
          'Never leave a child in a parked car.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Wind moves more than your car', [
        'Expect trucks, trailers, bicycles, and debris to shift.',
        'Hold space on both sides.',
      ]),
      slide(
        'Narrow mountain roads need cooperation',
        [
          'When cars cannot pass, the downhill-facing driver normally backs up.',
          'Use a safe turnout.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Conditions set the pace', [
        'If you cannot see or grip enough road, slow down or stop somewhere safe.',
      ]),
    ],
  },
  {
    id: 'ca-skids-and-emergencies',
    sources: ['ca-skids-and-emergencies'],
    title: 'Skids, Blowouts, and Vehicle Failure',
    summary:
      'Smooth control matters most when the vehicle stops behaving normally.',
    keyPoints: [
      'Avoid sudden inputs.',
      'Look toward the safe path.',
      'Move people away from greater danger.',
    ],
    challenge: challenge(
      'A front tire suddenly blows out.',
      'What should you do first?',
      ['Brake hard', 'Hold the wheel and ease off', 'Turn sharply'],
      1,
      'Keep the car stable before moving toward the roadside.',
    ),
    slides: [
      slide('A blowout needs calm hands', [
        'Grip the wheel firmly.',
        'Keep the car pointed where you want to go.',
      ]),
      slide('Do not slam the brakes', [
        'Ease off the accelerator.',
        'Slow gradually before leaving the road.',
      ]),
      slide('A skid means lost grip', [
        'Look toward the safe path.',
        'Ease off the cause and steer smoothly.',
      ]),
      slide('Different skids need different corrections', [
        'Avoid one memorized steering slogan.',
        'Use the vehicle handbook and modern stability systems correctly.',
      ]),
      slide('Off the pavement? Slow first', [
        'Hold the wheel steady.',
        'Return at a shallow angle only when speed and traffic allow.',
      ]),
      slide('Brake failure needs options', [
        'Try controlled braking, a lower gear, and the parking brake gradually.',
        'Look for a safe escape path.',
      ]),
      slide('A roadside stop is still dangerous', [
        'Pull fully away from traffic.',
        'Use hazards and stay protected when possible.',
      ]),
      slide('Emergency order', [
        'Control the car.',
        'Reduce speed.',
        'Choose the safest place.',
        'Call for help.',
      ]),
    ],
  },
  {
    id: 'ca-crashes-and-insurance',
    sources: ['ca-crashes-and-insurance'],
    title: 'After a Crash',
    summary:
      'Protect people first. Reports and insurance come after immediate safety.',
    keyPoints: [
      'Stop and protect the scene.',
      'Exchange required information.',
      'Complete every required report.',
    ],
    challenge: challenge(
      'A crash causes an injury.',
      'What is the first priority?',
      [
        'Leave before traffic builds',
        'Stop and get help',
        'Call the insurance company first',
      ],
      1,
      'Stop, protect people, and arrange emergency help.',
      'state_specific',
    ),
    slides: [
      slide(
        'Stop after a collision',
        [
          'Do not leave the scene.',
          'Move out of traffic when the law and safety allow.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Check people before property',
        [
          'Call 911 for injury or immediate danger.',
          'Give reasonable help without creating another hazard.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Exchange the required information',
        [
          'Share identification, vehicle, and insurance details.',
          'Stay calm and factual.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'An unattended car still creates duties',
        [
          'Leave the required notice.',
          'California may also require police notification.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Police and DMV reports are different',
        [
          'One report does not automatically replace the other.',
          'Check every trigger.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'California uses separate clocks',
        [
          'An injury or death can trigger a 24-hour police report.',
          'A reportable collision can trigger a DMV report within 10 days.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Insurance follows its own process', [
        'Document the scene when safe.',
        'Notify the insurer and keep records.',
      ]),
      slide('Remember the order', [
        'Stop.',
        'Protect.',
        'Help.',
        'Exchange.',
        'Report.',
      ]),
    ],
  },
  {
    id: 'ca-distraction-and-fatigue',
    sources: ['ca-distraction-and-fatigue'],
    title: 'Phones, Fatigue, and Road Rage',
    summary: 'Driving needs your eyes, hands, judgment, and emotional control.',
    keyPoints: [
      'Remove tasks before moving.',
      'Stop when sleepiness appears.',
      'Do not escalate conflict.',
    ],
    challenge: challenge(
      'A message arrives while you are driving.',
      'What is the safe response?',
      [
        'Read it at the next light',
        'Let it wait or pull over safely',
        'Hold the phone below the window',
      ],
      1,
      'The message can wait. Pull over safely if it truly cannot.',
    ),
    slides: [
      slide('Distraction has several forms', [
        'Your eyes can leave the road.',
        'Your hands or mind can leave driving too.',
      ]),
      slide('Set up before moving', [
        'Choose navigation, music, mirrors, and temperature first.',
        'Then put the phone away.',
      ]),
      slide(
        'California limits device use',
        [
          'Adult mounted use is narrow and hands-free.',
          'A long task is not allowed because the phone is mounted.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Drivers under 18 have stricter rules',
        [
          'California generally prohibits device use, even hands-free.',
          'Emergency use is different.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Fatigue can copy impairment', [
        'Heavy eyes, missed signs, and drifting are warnings.',
        'Coffee does not replace sleep.',
      ]),
      slide('Stop before you nod off', [
        'Leave the road at a safe place.',
        'Rest or change drivers.',
      ]),
      slide('Road rage is a choice you can exit', [
        'Do not chase, block, stare, or argue.',
        'Create distance and call for help if threatened.',
      ]),
      slide('Your condition is part of safety', [
        'Angry, sick, dizzy, or exhausted?',
        'Do not drive until you can focus.',
      ]),
    ],
  },
  {
    id: 'ca-alcohol-drugs-dui',
    sources: ['ca-alcohol-drugs-dui'],
    title: 'Alcohol, Drugs, and Medication',
    summary: 'A legal substance can still make driving unsafe and illegal.',
    keyPoints: [
      'Plan a sober ride.',
      'Know California BAC rules.',
      'Treat medicine warnings seriously.',
    ],
    challenge: challenge(
      'A prescription warns that it may cause drowsiness.',
      'What should you do?',
      [
        'Drive and test the effect',
        'Wait until driving is safe',
        'Add an energy drink',
      ],
      1,
      'Do not drive until you understand the effect and can drive safely.',
    ),
    slides: [
      slide('Impairment starts before you feel drunk', [
        'Judgment and reaction can change early.',
        'Feeling normal is not proof of safe driving.',
      ]),
      slide('Time removes alcohol', [
        'Coffee, food, air, and showers do not sober you quickly.',
        'Plan another ride.',
      ]),
      slide(
        'California has several BAC rules',
        [
          'The adult per se level is 0.08%.',
          'Lower rules apply to drivers under 21 and people on DUI probation.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Cannabis can impair driving',
        [
          'Legal purchase does not make impaired driving legal.',
          'Mixing substances adds risk.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Medication counts too', [
        'Read warnings.',
        'Ask a professional when the effect is unclear.',
      ]),
      slide(
        'A DUI arrest can trigger chemical testing',
        [
          'Refusal can create separate consequences.',
          'The exact rule depends on the legal situation.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Open containers have their own rules',
        [
          'Keep alcohol and cannabis where California law allows.',
          'The passenger area is restricted.',
          'The glove compartment counts — an open container there is illegal too.',
          'The trunk is the right place.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Make the decision before using', [
        'Choose a sober driver, transit, taxi, or rideshare.',
        'Do not negotiate after impairment starts.',
      ]),
    ],
  },
  {
    id: 'ca-seat-belts-child-safety',
    sources: ['ca-seat-belts-child-safety'],
    title: 'Protect Everyone in the Car',
    summary: 'Belts, child restraints, airbags, and supervision work together.',
    keyPoints: [
      'Buckle every occupant.',
      'Use the correct child restraint.',
      'Never leave a child in danger.',
    ],
    challenge: challenge(
      'A car has airbags. Does everyone still need a seat belt?',
      'Does everyone still need a seat belt?',
      ['Yes', 'Only front passengers', 'Only at freeway speed'],
      0,
      'Airbags support seat belts. They do not replace them.',
    ),
    slides: [
      slide(
        'Seat belts work on every trip',
        [
          'Buckle before the car moves.',
          'The driver must also protect passengers under California law.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Wear the belt correctly', [
        'Place the lap belt low across the hips.',
        'Keep the shoulder belt across the chest.',
      ]),
      slide('Airbags are extra protection', [
        'Sit upright and keep space from the cover.',
        'Never rely on an airbag alone.',
      ]),
      slide('Children move through restraint stages', [
        'Use a seat that fits the child and the manufacturer instructions.',
        'The back seat is generally safest.',
      ]),
      slide(
        'California uses age and size rules',
        [
          'Children under eight generally need a child restraint.',
          'A child at least 4 feet 9 inches may use a belt.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Rear-facing protects the youngest children',
        [
          'California generally requires it under age two.',
          'The law includes verified height and weight exceptions.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A parked car can become deadly',
        [
          'Heat rises fast.',
          'Do not leave a child where heat or controls create danger.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Smoking with a minor is prohibited',
        [
          'California covers a moving or parked vehicle.',
          'The maximum fine is $100 per violation.',
        ],
        { scope: 'state_specific' },
      ),
    ],
  },
  {
    id: 'ca-equipment-loads-towing',
    sources: ['ca-equipment-loads-towing'],
    title: 'Is Your Car Ready?',
    summary: 'A short check can catch a dangerous problem before the trip.',
    keyPoints: [
      'Check safety equipment.',
      'Secure every load.',
      'Allow more room when towing.',
    ],
    challenge: challenge(
      'A loose object can roll under the brake pedal.',
      'What should you do?',
      [
        'Leave it on the floor',
        'Secure it before driving',
        'Move it while driving',
      ],
      1,
      'Nothing should block the pedals or driver’s view.',
    ),
    slides: [
      slide('Walk around the car', [
        'Look for tire damage, leaks, obstacles, and people nearby.',
        'Check before moving.',
      ]),
      slide(
        'Make sure you can see',
        [
          'Windows, mirrors, lights, and wipers must work.',
          'Remove anything blocking the view.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Controls must work too',
        [
          'Check brakes, horn, steering, and warning lights.',
          'Do not ignore a safety problem.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Cargo must stay with the vehicle',
        [
          'Secure it against shifting, falling, leaking, or blowing out.',
          'Recheck it during the trip.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Keep every load secure and visible',
        [
          'Secure cargo before the vehicle moves.',
          'Do not let a load hide your lights, plate, mirrors, or view.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Towing changes the drive', [
        'Allow more stopping room.',
        'Turn wider and check mirrors often.',
      ]),
      slide(
        'Passengers and pets need protection',
        [
          'Keep them out of open load areas unless every legal safety condition is met.',
          'Prevent distraction.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Smooth driving can save fuel', [
        'Correct tire pressure helps.',
        'Avoid hard acceleration and unnecessary idling.',
      ]),
    ],
  },
  {
    id: 'ca-permit-and-knowledge-test',
    sources: ['ca-permits-provisional-licenses'],
    questionPicks: [
      ['ca-permits-provisional-licenses', 1],
      ['ca-permits-provisional-licenses', 4],
      ['ca-permits-provisional-licenses', 5],
    ],
    extraTests: [
      test(
        'What must happen before practice with an instruction permit?',
        [
          'The permit must be valid and supervision must meet the rule',
          'The driver may practice alone',
          'Only insurance matters',
        ],
        0,
        'Practice starts only with a valid permit and qualifying supervision.',
        'state_specific',
      ),
      test(
        'Why does DMV screen vision?',
        [
          'To confirm safe visual ability',
          'To set insurance prices',
          'To choose a vehicle',
        ],
        0,
        'Vision is part of the licensing safety check.',
        'state_specific',
      ),
      test(
        'After three failed attempts at the required knowledge test, what happens?',
        [
          'The application becomes invalid',
          'A fourth attempt starts automatically',
          'The license is mailed',
        ],
        0,
        'The applicant must reapply after the third failed attempt.',
        'state_specific',
      ),
    ],
    title: 'Permit and Knowledge Test',
    summary:
      'The permit process checks knowledge, vision, identity, and safe supervision.',
    keyPoints: [
      'Know the basic application flow.',
      'Use a permit only with supervision.',
      'Understand the three-attempt rule.',
    ],
    challenge: challenge(
      'You have an instruction permit but no qualified supervisor.',
      'May you practice alone?',
      ['Yes, on quiet roads', 'No', 'Only during daylight'],
      1,
      'An instruction permit does not allow solo driving.',
      'state_specific',
    ),
    slides: [
      slide(
        'The application starts the process',
        [
          'DMV checks identity, eligibility, and required documents.',
          'Requirements depend on the applicant.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Vision is part of the test',
        [
          'You need enough visual ability to drive safely.',
          'DMV may require more review.',
          'Health counts too: doctors must report drivers 14 and older whose conditions can affect safe driving, like a lapse of consciousness.',
          'A report is not an automatic loss — DMV can reexamine and decide.',
        ],
        { scope: 'state_specific' },
      ),

      slide('The knowledge test checks decisions', [
        'Study signs, laws, and real road situations.',
        'Do not memorize answer letters.',
      ]),
      slide(
        'California allows three attempts',
        [
          'The rule applies to each required knowledge test.',
          'After the third failure, the application becomes invalid.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A new application means starting again',
        [
          'Reapply and pay the required fees.',
          'Do not assume a fourth attempt appears automatically.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'After a failed test',
        [
          'Read the instructions DMV gives you before scheduling again.',
          'Use the eligibility date in your own record instead of guessing.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'A permit requires supervision',
        [
          'Use a qualified licensed driver in the required position.',
          'Do not practice alone.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Exam strategy', [
        'Read the whole situation.',
        'Choose the safest legal action, not the fastest action.',
      ]),
    ],
  },
  {
    id: 'ca-drivers-under-18',
    sources: ['ca-permits-provisional-licenses'],
    questionPicks: [
      ['ca-permits-provisional-licenses', 0],
      ['ca-permits-provisional-licenses', 2],
      ['ca-permits-provisional-licenses', 3],
    ],
    extraTests: [
      test(
        'How long must a minor generally hold the permit before provisional licensing?',
        ['At least six months', 'A few days', 'Thirty days'],
        0,
        'California generally requires at least six months.',
        'state_specific',
      ),
      test(
        'How many verified supervised practice hours are generally required?',
        ['50, including 10 at night', '10 total', '100, all at night'],
        0,
        'The verified requirement is 50 hours, including 10 at night.',
        'state_specific',
      ),
      test(
        'During the first 12 months, may a provisional driver ignore passenger restrictions with friends?',
        ['No', 'Yes, with permission from a friend', 'Yes, during daylight'],
        0,
        'The first-year restrictions apply unless a legal exception or qualifying supervision exists.',
        'state_specific',
      ),
    ],
    title: 'Rules for Drivers Under 18',
    summary:
      'California adds training and first-year limits for new drivers under 18.',
    keyPoints: [
      'Complete every training gate.',
      'Track supervised practice.',
      'Know first-year restrictions.',
    ],
    challenge: challenge(
      'A minor has held a permit for three months and completed practice hours.',
      'Is the six-month holding rule complete?',
      ['Yes', 'No', 'Only if the test is easy'],
      1,
      'The practice hours do not replace the minimum permit-holding period.',
      'state_specific',
    ),
    slides: [
      slide(
        'The permit has a minimum age',
        [
          'California’s ordinary Class C instruction permit begins at 15½.',
          'Other requirements still apply.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Education and training are separate gates',
        [
          'Complete every required part.',
          'One does not automatically replace another.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Hold the permit long enough',
        [
          'A minor generally holds it for at least six months.',
          'Count the correct date.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Practice must be documented',
        [
          'California generally requires 50 supervised hours.',
          'At least 10 are at night.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'The provisional license starts another stage',
        [
          'Passing the drive test does not remove every restriction.',
          'The first year has limits.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Night driving is restricted',
        [
          'During the first 12 months, 11 p.m. to 5 a.m. is generally restricted.',
          'Legal exceptions exist.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Young passengers are restricted too',
        [
          'Passengers under 20 generally require qualifying supervision during the first year.',
          'Check exceptions carefully.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Timeline before numbers', [
        'Ask which stage the question describes.',
        'Then apply its age, time, practice, or passenger rule.',
      ]),
    ],
  },
  {
    id: 'ca-licenses-and-registration',
    sources: ['ca-licenses-and-registration'],
    title: 'License, Registration, and Vehicle Transfer',
    summary: 'Different events create different people, forms, and deadlines.',
    keyPoints: [
      'Carry a valid license.',
      'Match each deadline to the event.',
      'Keep proof of submissions.',
    ],
    challenge: challenge(
      'You sold a California vehicle.',
      'Who reports the sale or release of liability?',
      ['The seller', 'Only the buyer', 'The insurance company'],
      0,
      'The seller has a separate reporting duty.',
      'state_specific',
    ),
    slides: [
      slide(
        'Driving requires a valid license',
        [
          'Carry it while driving unless a legal exception applies.',
          'Show it when lawfully required.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Address change: 10 days',
        [
          'Notify California DMV after a residence or mailing address change.',
          'Keep the confirmation.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Seller: 5 calendar days',
        [
          'Report the transfer or release of liability.',
          'This does not complete the buyer’s job.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Buyer: 10 days',
        [
          'Apply to transfer ownership.',
          'Keep purchase and submission records.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'New registration: 20 days',
        [
          'A new resident or person accepting California employment may trigger this clock.',
          'Check when the duty begins.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Residency is more than one address',
        [
          'California looks at intent and listed indicators.',
          'A temporary visit is different.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Out-of-state vehicles have a deadline too',
        [
          'Registration may be due within 20 days after the obligation arises.',
          'Do not wait for the old registration to expire.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Match each deadline to the event',
        [
          'First identify who must act and what changed.',
          'A seller reports the transfer within 5 calendar days.',
          'An address change or a buyer transfer uses a 10-day deadline.',
          'New California registration can use a 20-day deadline.',
          'A number is useful only when it matches the correct event.',
        ],
        { scope: 'state_specific' },
      ),
    ],
  },
  {
    id: 'ca-penalties-and-points',
    sources: ['ca-penalties-and-points'],
    title: 'Points, Penalties, and Police Stops',
    summary:
      'The final questions often test consequences, not just driving moves.',
    keyPoints: [
      'Separate one- and two-point events.',
      'Know the 4/6/8 pattern.',
      'Make traffic stops predictable.',
    ],
    challenge: challenge(
      'An officer activates emergency lights behind you.',
      'What should you do first?',
      [
        'Accelerate',
        'Signal and pull over safely',
        'Stop in the active lane when a shoulder is open',
      ],
      1,
      'Choose a safe place, stop, and follow instructions.',
      'state_specific',
    ),
    slides: [
      slide(
        'Not every conviction has the same points',
        [
          'California assigns two points to specified serious offenses.',
          'Other moving convictions are often one point.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Remember the 4/6/8 pattern',
        ['Four points in 12 months.', 'Six in 24.', 'Eight in 36.'],
        { scope: 'state_specific' },
      ),
      slide(
        'A point trigger can start DMV action',
        [
          'The numbers create a negligent-operator presumption.',
          'The process still includes legal procedures.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'DUI and hit-and-run bring more than points',
        [
          'Criminal, licensing, insurance, and financial consequences can overlap.',
          'Read the exact offense.',
          'A DUI can also bring an ignition interlock device: a breath tester wired to the starter.',
          'No clean sample, no start.',
        ],
        { scope: 'state_specific' },
      ),
      slide(
        'Start a traffic stop safely',
        ['Signal and move to a safe place.', 'Stop the vehicle and stay calm.'],
        { scope: 'state_specific' },
      ),
      slide('Make your hands and movements visible', [
        'Keep your hands where they can be seen.',
        'Explain before reaching for documents.',
      ]),
      slide(
        'Never flee',
        [
          'Evading can become a serious offense.',
          'A safe stop is always the correct first move.',
        ],
        { scope: 'state_specific' },
      ),
      slide('Final exam method', [
        'Name the situation.',
        'Remove unsafe answers.',
        'Apply the California rule and exact condition.',
      ]),
    ],
  },
];

// Exam-domain coverage map. Each required knowledge-test domain names its
// official source family, the verified catalog rules that back it, and the
// lessons that teach it. The course builder validates that every lesson is
// claimed by at least one domain and that every catalog rule is claimed by
// exactly one domain, so catalog or course drift breaks the build instead of
// silently going stale.
export const COVERAGE_DOMAINS = [
  {
    domain: 'Signs: shapes, colors, regulatory, warning, guide',
    officialSource: 'California MUTCD 2026 Part 2; CVC § 21461',
    ruleIds: [
      'CA_MUTCD_2A_03_SIGN_CLASSES',
      'CA_MUTCD_2A_05_SIGN_SHAPES',
      'CA_MUTCD_2A_06_SIGN_COLORS',
      'CA_MUTCD_COMMON_SIGN_MEANINGS',
      'CA_VEH_21461_OBEY_TRAFFIC_CONTROLS',
    ],
    lessons: [
      'ca-sign-shapes-and-colors',
      'ca-regulatory-signs',
      'ca-warning-and-guide-signs',
    ],
  },
  {
    domain: 'Signals, arrows, flashing and dark signals',
    officialSource: 'CVC §§ 21450–21457',
    ruleIds: [
      'CA_VEH_21451_GREEN_SIGNAL',
      'CA_VEH_21452_YELLOW_SIGNAL',
      'CA_VEH_21453_RED_SIGNAL',
      'CA_VEH_21451_21453_ARROW_SIGNAL',
      'CA_VEH_21454_LANE_USE_CONTROL',
      'CA_VEH_21456_PEDESTRIAN_SIGNAL',
      'CA_VEH_21457_FLASHING_SIGNAL',
    ],
    lessons: ['ca-traffic-signals'],
  },
  {
    domain: 'Pavement markings, limit lines and lane lines',
    officialSource: 'California MUTCD 2026 Part 3; CVC § 21460',
    ruleIds: [
      'CA_MUTCD_3A_03_MARKING_COLORS',
      'CA_MUTCD_MARKING_PATTERNS',
      'CA_VEH_21460_DOUBLE_LINES',
    ],
    lessons: ['ca-road-markings-and-curbs'],
  },
  {
    domain: 'Right-of-way, STOP and YIELD control, entering traffic',
    officialSource: 'CVC §§ 21800–21804, 22450',
    ruleIds: [
      'CA_VEH_21800_UNCONTROLLED_INTERSECTION',
      'CA_VEH_21801_LEFT_TURN_YIELD',
      'CA_VEH_21802_YIELD_SIGN',
      'CA_VEH_21804_ENTERING_HIGHWAY',
      'CA_VEH_22450_STOP_POSITION',
      'CA_HANDBOOK_FUNERAL_PROCESSION',
    ],
    lessons: [
      'ca-uncontrolled-intersections',
      'ca-stop-yield-entering-traffic',
    ],
  },
  {
    domain: 'Turns, signals, backing and U-turns',
    officialSource: 'CVC §§ 22100–22111',
    ruleIds: [
      'CA_VEH_22100_TURN_POSITION',
      'CA_VEH_22100_5_U_TURN_SIGNAL',
      'CA_VEH_22102_U_TURN_BUSINESS',
      'CA_VEH_22103_U_TURN_RESIDENCE',
      'CA_VEH_22104_U_TURN_FIRE_STATION',
      'CA_VEH_22105_U_TURN_VISIBILITY',
      'CA_VEH_22106_BACKING',
      'CA_VEH_22107_MOVE_AND_SIGNAL',
      'CA_VEH_22108_TURN_SIGNAL_DISTANCE',
      'CA_VEH_22111_HAND_SIGNALS',
    ],
    lessons: ['ca-turns-and-signals', 'ca-u-turns-starting-backing'],
  },
  {
    domain: 'Pedestrians, blind pedestrians and roundabouts',
    officialSource: 'CVC §§ 21950–21964; California MUTCD 2026',
    ruleIds: [
      'CA_VEH_21950_CROSSWALK',
      'CA_VEH_21951_STOPPED_AT_CROSSWALK',
      'CA_VEH_21954_OUTSIDE_CROSSWALK',
      'CA_VEH_21964_BLIND_PEDESTRIAN',
      'CA_MUTCD_ROUNDABOUT_CONTROL',
    ],
    lessons: ['ca-crosswalks-and-roundabouts'],
  },
  {
    domain: 'Lane choice, lane changes and lane discipline',
    officialSource: 'CVC §§ 21650–21658',
    ruleIds: [
      'CA_VEH_21650_RIGHT_HALF',
      'CA_VEH_21654_SLOW_TRAFFIC_RIGHT',
      'CA_VEH_21658_LANE_DISCIPLINE',
      'CA_UC_BLIND_SPOT_CHECK',
    ],
    lessons: ['ca-choosing-changing-lanes'],
  },
  {
    domain: 'Passing and being passed',
    officialSource: 'CVC §§ 21750–21759',
    ruleIds: [
      'CA_VEH_21750_PASS_LEFT',
      'CA_VEH_21751_CLEAR_VIEW_PASS',
      'CA_VEH_21752_NO_PASSING_LOCATIONS',
      'CA_VEH_21754_21755_PASS_RIGHT',
      'CA_VEH_21759_ANIMALS',
    ],
    lessons: ['ca-passing-rules'],
  },
  {
    domain: 'Freeway entry, exit and stopping rules',
    officialSource: 'CVC § 21718',
    ruleIds: ['CA_VEH_21718_FREEWAY_STOPPING'],
    lessons: ['ca-freeway-merging'],
  },
  {
    domain: 'HOV, bicycle, center-turn and other special lanes',
    officialSource: 'CVC §§ 21209, 21460.5, 21655.5, 21717',
    ruleIds: [
      'CA_VEH_21209_MOTOR_VEHICLE_BIKE_LANE',
      'CA_VEH_21460_5_MEDIAN_AND_CENTER_TURN',
      'CA_VEH_21655_5_HOV',
      'CA_VEH_21717_CROSS_BIKE_LANE_TO_TURN',
    ],
    lessons: ['ca-special-lanes'],
  },
  {
    domain: 'Basic Speed Law, maximum and prima facie limits',
    officialSource: 'CVC §§ 22349–22400',
    ruleIds: [
      'CA_VEH_22349_MAXIMUM_SPEED',
      'CA_VEH_22350_BASIC_SPEED_LAW',
      'CA_VEH_22352_FIFTEEN_MPH',
      'CA_VEH_22352_TWENTY_FIVE_MPH',
      'CA_VEH_22356_POSTED_70',
      'CA_VEH_22400_IMPEDING_TRAFFIC',
    ],
    lessons: ['ca-speed-and-space'],
  },
  {
    domain: 'Scanning, following distance and space management',
    officialSource: 'CVC § 21703; defensive-driving technique',
    ruleIds: [
      'CA_VEH_21703_REASONABLE_FOLLOWING',
      'CA_UC_SPACE_CUSHION',
      'CA_UC_SCAN_AND_PREDICT',
    ],
    lessons: ['ca-speed-and-space'],
  },
  {
    domain: 'Parking, stopping prohibitions and curb rules',
    officialSource: 'CVC §§ 21458, 22500–22517',
    ruleIds: [
      'CA_VEH_21458_CURB_COLORS',
      'CA_VEH_22500_PROHIBITED_STOPPING',
      'CA_VEH_22502_CURB_PARKING',
      'CA_VEH_22507_8_ACCESSIBLE_PARKING',
      'CA_VEH_22514_FIRE_HYDRANT',
      'CA_VEH_22515_UNATTENDED_VEHICLE',
      'CA_VEH_22517_OPENING_DOOR',
    ],
    lessons: ['ca-parking-and-curbs'],
  },
  {
    domain: 'Bicycles and motorcycles',
    officialSource: 'CVC §§ 21658.1, 21760',
    ruleIds: ['CA_VEH_21658_1_LANE_SPLITTING', 'CA_VEH_21760_PASS_BICYCLE'],
    lessons: ['ca-bicycles-motorcycles'],
  },
  {
    domain: 'Trucks, buses, slow vehicles and turnouts',
    officialSource: 'CVC § 21656',
    ruleIds: ['CA_VEH_21656_USE_TURNOUT', 'CA_VEH_24615_SLOW_MOVING_EMBLEM'],
    lessons: ['ca-trucks-buses-slow-vehicles'],
  },
  {
    domain: 'Emergency vehicles, school buses and work zones',
    officialSource: 'CVC §§ 21706–21809, 22454; California MUTCD 2026 Part 6',
    ruleIds: [
      'CA_VEH_21706_FOLLOW_EMERGENCY',
      'CA_VEH_21708_FIRE_HOSE',
      'CA_VEH_21806_EMERGENCY_VEHICLE',
      'CA_VEH_21809_MOVE_OVER',
      'CA_VEH_22454_SCHOOL_BUS',
      'CA_MUTCD_WORK_ZONE_CONTROLS',
    ],
    lessons: [
      'ca-school-buses-emergency-vehicles',
      'ca-rail-light-rail-work-zones',
    ],
  },
  {
    domain: 'Night driving, lighting, weather and visibility',
    officialSource: 'CVC §§ 24250–24409',
    ruleIds: [
      'CA_VEH_24250_24400_HEADLIGHT_USE',
      'CA_VEH_24409_HIGH_BEAM_DIMMING',
      'CA_UC_WEATHER_ADAPTATION',
      'CA_HANDBOOK_SLIPPERY_SPOTS',
    ],
    lessons: ['ca-driving-after-dark', 'ca-weather-and-mountain-roads'],
  },
  {
    domain: 'Skids, vehicle failures and roadside emergencies',
    officialSource: 'Universal defensive-driving technique (instructional)',
    ruleIds: [
      'CA_UC_SKID_RESPONSE',
      'CA_UC_VEHICLE_FAILURE',
      'CA_UC_COLLISION_AVOIDANCE',
    ],
    lessons: ['ca-skids-and-emergencies'],
  },
  {
    domain: 'Distraction, wireless devices, fatigue and hearing',
    officialSource: 'CVC §§ 23123–23124, 27400, 27602',
    ruleIds: [
      'CA_VEH_23123_HANDHELD_PHONE',
      'CA_VEH_23123_5_WIRELESS_DEVICE',
      'CA_VEH_23124_MINOR_WIRELESS',
      'CA_VEH_27400_BOTH_EARS_COVERED',
      'CA_VEH_27602_DRIVER_VISIBLE_DISPLAY',
      'CA_UC_FATIGUE_SELF_CHECK',
    ],
    lessons: ['ca-distraction-and-fatigue'],
  },
  {
    domain: 'Alcohol, drugs, DUI, implied consent and open containers',
    officialSource: 'CVC §§ 13353, 23103–23222, 23612',
    ruleIds: [
      'CA_VEH_13353_TEST_REFUSAL',
      'CA_VEH_23103_RECKLESS_DRIVING',
      'CA_VEH_23136_UNDER_21_ZERO_TOLERANCE',
      'CA_VEH_23140_UNDER_21_BAC',
      'CA_VEH_23152_BAC',
      'CA_VEH_23152_DUI_IMPAIRMENT',
      'CA_VEH_23154_DUI_PROBATION_BAC',
      'CA_VEH_23221_DRINKING_IN_VEHICLE',
      'CA_VEH_23222_OPEN_CONTAINER',
      'CA_VEH_23225_OPEN_CONTAINER_STORAGE',
      'CA_VEH_23575_IGNITION_INTERLOCK',
      'CA_VEH_23612_CHEMICAL_TEST',
    ],
    lessons: ['ca-alcohol-drugs-dui'],
  },
  {
    domain: 'Seat belts, child passengers and children in vehicles',
    officialSource: 'CVC §§ 15620, 27315–27363; HSC §§ 118947–118949',
    ruleIds: [
      'CA_VEH_15620_UNATTENDED_CHILD',
      'CA_VEH_27315_SEAT_BELTS',
      'CA_VEH_27360_27363_CHILD_RESTRAINT',
      'CA_VEH_27360_5_CHILD_PASSENGER',
      'CA_HSC_118948_118949_SMOKING_WITH_MINOR',
    ],
    lessons: ['ca-seat-belts-child-safety'],
  },
  {
    domain: 'Vehicle condition, loads, towing and equipment',
    officialSource: 'CVC §§ 22406, 23111–23117, 26450–27465',
    ruleIds: [
      'CA_VEH_22406_TOWING_SPEED',
      'CA_VEH_23111_FLAMING_SUBSTANCE',
      'CA_VEH_23113_SECURE_LOAD',
      'CA_VEH_23116_TRUCK_BED_PASSENGERS',
      'CA_VEH_23117_ANIMALS_IN_LOAD_SPACE',
      'CA_VEH_26450_BRAKES',
      'CA_VEH_26708_DRIVER_VIEW',
      'CA_VEH_26709_MIRRORS',
      'CA_VEH_27000_HORN',
      'CA_VEH_27465_TIRE_TREAD',
    ],
    lessons: ['ca-equipment-loads-towing'],
  },
  {
    domain: 'Collisions, insurance and reporting duties',
    officialSource: 'CVC §§ 16000–16070, 20001–20008',
    ruleIds: [
      'CA_VEH_16000_COLLISION_DMV_REPORT',
      'CA_VEH_16020_FINANCIAL_RESPONSIBILITY',
      'CA_VEH_16028_PROOF_ON_DEMAND',
      'CA_VEH_16056_LIABILITY_LIMITS',
      'CA_VEH_16070_UNINSURED_COLLISION',
      'CA_VEH_20001_INJURY_COLLISION_STOP',
      'CA_VEH_20002_PROPERTY_COLLISION',
      'CA_VEH_20003_INJURY_INFORMATION_AID',
      'CA_VEH_20008_POLICE_REPORT',
    ],
    lessons: ['ca-crashes-and-insurance'],
  },
  {
    domain: 'Permits, provisional licensing and knowledge tests',
    officialSource:
      'CVC §§ 12509, 12814.6; 13 CCR § 20.03; DMV licensing pages',
    ruleIds: [
      'CA_VEH_12509_INSTRUCTION_PERMIT',
      'CA_VEH_12814_6_PROVISIONAL_ELIGIBILITY',
      'CA_VEH_12814_6_PROVISIONAL_RESTRICTIONS',
      'CA_DMV_KNOWLEDGE_TEST_ATTEMPTS',
      'CA_DMV_KNOWLEDGE_PASSING_SCORE',
      'CA_CCR_T13_20_03_VISION_STANDARD',
      'CA_HANDBOOK_MEDICAL_REPORTING',
    ],
    lessons: ['ca-permit-and-knowledge-test', 'ca-drivers-under-18'],
  },
  {
    domain: 'License, registration, residency and ownership transfer',
    officialSource: 'CVC §§ 516, 4152.5, 5900–6700, 12500–12951, 14600',
    ruleIds: [
      'CA_VEH_516_RESIDENCY',
      'CA_VEH_4152_5_6700_NEW_RESIDENT_REGISTRATION',
      'CA_VEH_5900_SELLER_TRANSFER_NOTICE',
      'CA_VEH_5902_BUYER_TRANSFER_APPLICATION',
      'CA_VEH_12500_LICENSE_REQUIRED',
      'CA_VEH_12951_LICENSE_POSSESSION',
      'CA_VEH_14600_ADDRESS_CHANGE',
    ],
    lessons: ['ca-licenses-and-registration'],
  },
  {
    domain: 'Points, negligent-operator thresholds and enforcement',
    officialSource: 'CVC §§ 12810, 12810.5',
    ruleIds: ['CA_VEH_12810_POINT_VALUES', 'CA_VEH_12810_5_NEGLIGENT_OPERATOR'],
    lessons: ['ca-penalties-and-points'],
  },
  {
    domain: 'Complex intersections: arrow signals and turn-lane discipline',
    officialSource:
      "California Driver's Handbook (current edition); CVC \u00a7\u00a7 21451\u201321457, 22100",
    ruleIds: [
      'CA_HANDBOOK_FLASHING_YELLOW_ARROW',
      'CA_HANDBOOK_DEDICATED_RIGHT_TURN_LANE',
    ],
    lessons: ['ca-complex-intersections'],
  },
];

// "Check yourself" recall cards. Each lesson gets one (dense fact-cluster
// lessons get two) so active recall lands without overloading the deck. The
// builder inserts every card directly after the theory card that teaches the
// fact, matched by content overlap, so placement survives card merges. Hidden
// words sit in [[double brackets]]; every fact repeats a verified rule that
// the same lesson already teaches.
const recall = (context, rule, scope = 'state_specific', options = {}) => ({
  title: 'Can you finish the rule?',
  context,
  rule,
  scope,
  afterTitle: options.afterTitle,
});

export const RECALL_SPECS = {
  'ca-traffic-signals': [
    recall(
      'Recall · Right on red',
      'Right on red is usually allowed after a full [[stop]] — unless a [[sign]] prohibits it.',
    ),
    recall(
      'Recall · Flashing signals',
      'Flashing [[red]] works like a STOP sign. Flashing [[yellow]] means slow down and use caution.',
      'state_specific',
      { afterTitle: 'Flashing signals' },
    ),
    recall(
      'Recall · Dark signal',
      'A dark signal? Treat the intersection as an [[all-way stop]].',
    ),
  ],
  'ca-stop-yield-entering-traffic': [
    recall(
      'Recall · Stop position',
      'Stop before the [[limit line]]. If there is no line, use the [[crosswalk]] or the intersection edge.',
    ),
    recall(
      'Recall · YIELD meaning',
      'YIELD means slow down, judge the [[gap]], and [[stop]] when traffic requires it.',
      'universal',
    ),
    recall(
      'Recall · Driveways',
      'Entering the road from a [[driveway]] or private property? Yield until it is [[safe]].',
    ),
  ],
  'ca-turns-and-signals': [
    recall(
      'Recall · Signal timing',
      'In California, signal continuously during the final [[100 feet]] before your turn.',
    ),
    recall(
      'Recall · Hand signals',
      'Left arm straight out: [[left]] turn. Arm up: [[right]] turn. Arm down: [[slow]] or stop.',
    ),
  ],
  'ca-speed-and-space': [
    recall(
      'Recall · Basic Speed Law',
      'Never drive faster than is [[safe]] for current conditions, even below the posted [[limit]].',
    ),
    recall(
      'Recall · 15 mph zones',
      '[[15]] mph: blind intersections, alleys, and near tracks you cannot see for [[400 feet]].',
    ),
    recall(
      'Recall · Stopping distance',
      'You stop in three stages: you [[see]] the problem, you [[react]], and only then the brakes slow the car.',
      'universal',
    ),
  ],
  'ca-sign-shapes-and-colors': [
    recall(
      'Recall · Shapes',
      'The eight-sided octagon always means [[STOP]]. The downward triangle always means [[YIELD]].',
      'universal',
    ),
    recall(
      'Recall · Round sign',
      'A [[round]] sign warns that [[railroad]] tracks are ahead.',
      'universal',
    ),
    recall(
      'Recall · Colors',
      '[[Red]] restricts. [[Yellow]] warns. [[Orange]] means work zones.',
      'universal',
    ),
  ],
  'ca-regulatory-signs': [
    recall(
      'Recall · Red slash',
      'A red circle with a slash means that movement is [[not allowed]].',
      'universal',
    ),
    recall(
      'Recall · One direction',
      'DO NOT ENTER protects [[one direction]] of traffic — WRONG WAY means you are already against it.',
      'universal',
    ),
  ],
  'ca-warning-and-guide-signs': [
    recall(
      'Recall · Advisory speed',
      'A yellow advisory speed describes the [[hazard]] — it is not a separate legal limit.',
      'universal',
    ),
    recall(
      'Recall · Orange signs',
      '[[Orange]] warning signs mean a [[temporary]] work zone ahead.',
      'universal',
    ),
  ],
  'ca-road-markings-and-curbs': [
    recall(
      'Recall · Line colors',
      '[[Yellow]] lines separate opposite directions. [[White]] lines separate lanes going the same way.',
      'universal',
    ),
    recall(
      'Recall · Line patterns',
      'A [[broken]] line allows crossing when safe. A [[solid]] line restricts it.',
      'universal',
    ),
    recall(
      'Recall · Curb colors',
      'A [[red]] curb means no stopping, standing, or parking. A [[blue]] curb is only for authorized disabled parking.',
    ),
  ],
  'ca-uncontrolled-intersections': [
    recall(
      'Recall · Same-time arrival',
      'Arriving together? The [[left]] driver yields to the driver on the [[right]].',
      'universal',
    ),
    recall(
      'Recall · Mountain roads',
      'On a narrow mountain road, the vehicle facing [[downhill]] backs up to make room.',
    ),
    recall(
      'Recall · Funeral processions',
      'A funeral [[procession]] has the right-of-way. Do not cut [[through]] it.',
    ),
  ],
  'ca-complex-intersections': [
    recall(
      'Recall \u00b7 Flashing yellow arrow',
      'A flashing yellow arrow means turn only after [[yielding]] \u2014 the turn is not [[protected]].',
      'state_specific',
      { afterTitle: 'Yellow arrows end the protection' },
    ),
    recall(
      'Recall \u00b7 Red arrow',
      'At a red arrow, no turn at all \u2014 wait for a [[green]] indication. Right on red applies only to a plain [[red light]].',
      'state_specific',
      { afterTitle: 'A red arrow closes the turn' },
    ),
    recall(
      'Recall \u00b7 Finishing lane',
      'Right turns begin and end near the [[right edge]]; a left turn onto a two-way street ends closest to the [[middle]].',
      'state_specific',
      { afterTitle: 'An island lane keeps moving' },
    ),
  ],
  'ca-crosswalks-and-roundabouts': [
    recall(
      'Recall · Unmarked crosswalks',
      'A crosswalk can be [[unmarked]] — pedestrian right-of-way still applies.',
    ),
    recall(
      'Recall · Crosswalks and circles',
      'Never pass a vehicle [[stopped]] at a crosswalk. Entering a roundabout, yield to traffic [[already inside]].',
    ),
    recall(
      'Recall · Roundabout direction',
      'Enter to the [[right]] of the central island and move [[counterclockwise]].',
      'universal',
    ),
  ],
  'ca-u-turns-starting-backing': [
    recall(
      'Recall · U-turn visibility',
      'A U-turn needs an unobstructed view for [[200 feet]] in both directions.',
    ),
    recall(
      'Recall · Fire stations',
      'No U-turns in front of a [[fire station]] — ever.',
    ),
  ],
  'ca-parking-and-curbs': [
    recall(
      'Recall · Parking distances',
      'Park within [[18 inches]] of the curb and at least [[15 feet]] from a fire hydrant.',
    ),
    recall(
      'Recall · Hill parking',
      'Turn the wheels so a rolling car goes toward the [[curb]] or edge, and set the [[parking brake]].',
      'universal',
    ),
    recall(
      'Recall · Double parking',
      'Stopping in the road beside a parked car is [[double parking]] — [[illegal]], even briefly.',
    ),
  ],
  'ca-choosing-changing-lanes': [
    recall(
      'Recall · Lane change',
      'Before moving sideways: signal, mirrors, then a head check of the [[blind spot]].',
      'universal',
    ),
    recall(
      'Recall · One at a time',
      'Change [[one]] lane at a time — settle, recheck, then move again.',
      'universal',
    ),
  ],
  'ca-passing-rules': [
    recall(
      'Recall · Clear-view pass',
      'Do not move into oncoming traffic until you can see far enough [[ahead]] to complete the whole pass.',
      'universal',
    ),
    recall(
      'Recall · No-pass spots',
      'Skip the pass near an intersection, a railroad [[crossing]], or a hidden [[curve]].',
      'universal',
    ),
  ],
  'ca-freeway-merging': [
    recall(
      'Recall · Merging',
      'Freeway traffic has [[priority]]. Use the whole [[acceleration lane]] to match its speed.',
      'universal',
    ),
    recall(
      'Recall · Missed exit',
      'Missed the exit? Continue to the [[next]] one — never stop or [[back up]] on the freeway.',
      'universal',
    ),
  ],
  'ca-special-lanes': [
    recall(
      'Recall · Center turn lane',
      'In a two-way left-turn lane, travel no more than [[200 feet]].',
    ),
    recall(
      'Recall · Posted lane rules',
      'HOV and toll lanes work only under their [[posted]] rules — occupancy, hours, and permits.',
    ),
  ],
  'ca-bicycles-motorcycles': [
    recall(
      'Recall · Passing a bicycle',
      'Give a bicycle at least [[three feet]] of clearance when passing — slow down if you cannot.',
    ),
    recall(
      'Recall · Sharing lanes',
      'A motorcycle is entitled to its [[full lane]]. Lane splitting is [[legal]] in California.',
    ),
  ],
  'ca-trucks-buses-slow-vehicles': [
    recall(
      'Recall · Truck blind spots',
      'If you cannot see the truck driver in a [[mirror]], the driver may not see [[you]].',
      'universal',
    ),
    recall(
      'Recall · Cutting in',
      'Never cut [[closely]] in front of a truck — it needs far more [[stopping room]].',
      'universal',
    ),
    recall(
      'Recall · Orange triangle',
      'An orange and red [[triangle]] marks a slow-moving vehicle — usually [[25]] mph or less.',
    ),
  ],
  'ca-school-buses-emergency-vehicles': [
    recall(
      'Recall · Emergency vehicles',
      'Emergency vehicle with lights or siren? Pull to the [[right]] edge and [[stop]] clear of intersections.',
    ),
    recall(
      'Recall · Move over',
      'Passing a stopped vehicle with warning lights: move to a [[nonadjacent]] lane, or [[slow]] to a safe speed.',
    ),
    recall(
      'Recall · School bus',
      'Flashing [[red]] school-bus lights mean stop — and stay stopped until the signal [[ends]].',
    ),
  ],
  'ca-rail-light-rail-work-zones': [
    recall(
      'Recall · Rail crossings',
      'Cross the tracks only when you can see a clear [[exit]] on the other side.',
      'universal',
    ),
    recall(
      'Recall · Stalled on tracks',
      'Stalled on the tracks? Get everyone [[out]] and away immediately.',
      'universal',
    ),
  ],
  'ca-driving-after-dark': [
    recall(
      'Recall · Outdriving your lights',
      'Do not outrun your headlights — be able to [[stop]] inside the distance you can [[see]].',
      'universal',
    ),
    recall(
      'Recall · Headlight hours',
      'Headlights on from [[30 minutes]] after sunset until 30 minutes before [[sunrise]].',
    ),
    recall(
      'Recall · High beams',
      'Dim within [[500 feet]] of an approaching vehicle and within [[300 feet]] when following.',
    ),
  ],
  'ca-weather-and-mountain-roads': [
    recall(
      'Recall · Rain',
      'Rain cuts [[grip]] and [[visibility]] — slow down and smooth every control.',
      'universal',
    ),
    recall(
      'Recall · Ice and wet brakes',
      'Bridges and overpasses ice over [[first]]. Dry wet brakes with [[light]] presses on brake and gas.',
      'universal',
    ),
    recall(
      'Recall · Fog',
      'In fog, use [[low]] beams — high beams reflect back and reduce what you see.',
      'universal',
    ),
  ],
  'ca-skids-and-emergencies': [
    recall(
      'Recall · Blowout',
      'Blowout? [[Grip]] the wheel, ease off the gas, and do not [[slam]] the brakes.',
      'universal',
    ),
    recall(
      'Recall · Skid response',
      'In a skid, ease off the cause, look toward your intended [[path]], and steer [[smoothly]].',
      'universal',
    ),
  ],
  'ca-crashes-and-insurance': [
    recall(
      'Recall · After a crash',
      'Stop, check [[people]] first, exchange [[information]] — never leave the scene.',
    ),
    recall(
      'Recall · Police report',
      'After an injury or death, the written police report is due within [[24 hours]].',
    ),
    recall(
      'Recall · DMV report',
      'Report to DMV within [[10 days]] after injury, death, or more than [[$1,000]] damage to one person.',
    ),
  ],
  'ca-distraction-and-fatigue': [
    recall(
      'Recall · Phones for adults',
      'An adult may use a phone only [[hands-free]], activated with a single [[swipe or tap]].',
    ),
    recall(
      'Recall · Under 18',
      'A driver under 18 may not use a phone while driving — even [[hands-free]] — except in an emergency.',
    ),
  ],
  'ca-alcohol-drugs-dui': [
    recall(
      'Recall · BAC limits',
      'Adult per se limit: [[0.08%]]. Under 21, zero tolerance starts at [[0.01%]].',
    ),
    recall(
      'Recall · Open containers',
      'An open container never rides in the [[passenger area]] — the [[glove compartment]] counts. Use the trunk.',
    ),
    recall(
      'Recall · Implied consent',
      'By driving in California, you consent to [[chemical testing]] after a lawful DUI arrest.',
    ),
  ],
  'ca-seat-belts-child-safety': [
    recall(
      'Recall · Under eight',
      'A child under [[eight]] rides properly restrained in the [[back seat]], with listed exceptions.',
    ),
    recall(
      'Recall · Rear-facing',
      'A child under [[two]] rides rear-facing unless at least [[40 pounds]] or 40 inches tall.',
    ),
    recall(
      'Recall · Children alone',
      'Never leave a child [[six]] or younger alone in a car — especially with the engine on or [[keys]] inside.',
    ),
  ],
  'ca-equipment-loads-towing': [
    recall(
      'Recall · Tire tread',
      'The minimum tire tread is [[1/32 inch]] in two adjacent grooves.',
    ),
    recall(
      'Recall · Equipment',
      'Your horn must be audible from at least [[200 feet]].',
    ),
  ],
  'ca-permit-and-knowledge-test': [
    recall(
      'Recall · Vision screening',
      'The vision screening standard is [[20/40]] with both eyes together.',
    ),
    recall(
      'Recall · Medical fitness',
      'Conditions like a lapse of [[consciousness]] are reported to [[DMV]], which can reexamine a driver.',
    ),
    recall(
      'Recall · Knowledge test',
      'You get [[three]] attempts per application. DMV publishes an [[80%]] passing score.',
    ),
  ],
  'ca-drivers-under-18': [
    recall(
      'Recall · Permit basics',
      'The instruction permit starts at age [[15½]]. Hold it for at least [[six months]].',
    ),
    recall(
      'Recall · Practice hours',
      'Record [[50]] supervised practice hours, including [[10]] at night.',
    ),
    recall(
      'Recall · First 12 months',
      'First 12 months: no driving [[11 p.m.]]–5 a.m., and passengers under [[20]] need qualifying supervision.',
    ),
  ],
  'ca-licenses-and-registration': [
    recall(
      'Recall · DMV deadlines',
      "Address change: [[10 days]]. Seller's notice: [[5 days]]. New California registration: [[20 days]].",
    ),
    recall(
      'Recall · Residency',
      'Six months of presence in a 12-month period creates a presumption of [[residency]].',
    ),
  ],
  'ca-penalties-and-points': [
    recall(
      'Recall · 4/6/8',
      'The negligent-operator thresholds: [[4]] points in 12 months, [[6]] in 24, [[8]] in 36.',
    ),
    recall(
      'Recall · DUI points',
      'A DUI conviction carries [[two]] points, not one.',
    ),
    recall(
      'Recall · Traffic stops',
      'Pulled over? Stop in a safe place, remain in the [[vehicle]], and keep your [[hands]] visible.',
    ),
  ],
};

export { challenge, slide, test };
