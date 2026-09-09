// Texas overlay · Module 1 · Your First Drive
// Facts: TX_TN_544_007_*, TX_TMUTCD_4A_03_RED_ARROW, TX_TMUTCD_4A_04_FLASHING_YELLOW_ARROW,
// TX_TN_544_008_FLASHING_SIGNALS, TX_TN_544_007_DARK_SIGNAL, TX_TMUTCD_4T_02_LANE_USE_CONTROL_SIGNALS,
// TX_TN_552_002_PEDESTRIAN_SIGNALS, TX_TN_544_010_*, TX_TN_545_153_*, TX_TN_545_155_*, TX_TN_545_256_*,
// TX_TN_545_302_NO_STOPPING_IN_INTERSECTION, TX_TN_545_101_*, TX_TN_545_103_*, TX_TN_545_104_*,
// TX_TN_545_106_107_*, TX_TN_545_152_*, TX_TN_545_351_*, TX_TN_545_352_*, TX_TN_545_353_*,
// TX_TN_545_363_*, TX_TN_545_062_*, TX_HANDBOOK_FOLLOWING_INTERVAL.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-traffic-signals': {
    visuals: ['tx-signals-q01-asset', 'tx-signals-asset-01', 'tx-signals-asset-03'],
    challenge: {
      scenario: 'Your light is green, but traffic blocks the other side.',
      prompt: 'What should you do?',
      choices: ['Enter and wait inside', 'Stay behind the line', 'Honk and move forward'],
      correct: 1,
      explanation: 'Texas law bars stopping in an intersection or on a crosswalk. Stay out until your car can clear the far side.',
    },
    cards: {
      'ca-traffic-signals-slide-01': {
        body: p(
          'A green light lets you move only when the intersection is clear.',
          'Check the intersection before you go.',
          '“Green means go” is incomplete.',
          'Texas law makes you yield to vehicles already lawfully in the intersection.',
          'It also makes you stop and yield to pedestrians and sidewalk users in the intersection or an adjacent crosswalk.',
          'A sign can still prohibit a turn on green.',
        ),
      },
      'ca-traffic-signals-slide-02': {
        body: p(
          'Someone may still be in the intersection.',
          'Let pedestrians, cyclists, and vehicles clear your path.',
          'Green allows movement, but it does not make a blocked or unsafe path legal.',
          'Yield to pedestrians and vehicles still in the intersection.',
          'Do not enter if traffic will leave you stopped in the intersection.',
          'Check again before turning, especially for bicycles and people in the crosswalk ahead.',
        ),
      },
      'ca-traffic-signals-slide-03': {
        body: p(
          'Yellow means the light is changing.',
          'Stop if you can do it safely.',
          'A circular green permits the movement, but the intersection must be usable and every required yield still applies.',
          'A steady yellow warns that the green movement is ending and a red signal will follow.',
          'Do not race the change; the rules of the ending movement still apply while yellow shows.',
        ),
      },
      'ca-traffic-signals-slide-04': {
        body: p(
          'Make a complete stop.',
          'Use the stop line.',
          'If there is no line, stop before the near-side crosswalk.',
          'A turn on red has extra conditions.',
          'In Texas you may turn right on red after a full stop, once the intersection can be entered safely.',
          'A left on red is allowed only between two one-way streets.',
          'A posted notice at the intersection can prohibit the turn.',
          'Yield to pedestrians and traffic as you would after a stop sign.',
          'If you are not turning, stay stopped until an indication to proceed appears.',
        ),
      },
      'ca-traffic-signals-slide-05': {
        body: p(
          'An arrow controls the direction it points.',
          'A green arrow lets you enter cautiously, only for that movement, and you still yield to people in the crosswalk.',
          'A steady red arrow means stop for that turn.',
          'Texas treats it like a red light: after stopping, the turn-on-red rules apply in the arrow direction unless a sign prohibits it.',
          'A flashing yellow arrow means turn with caution; oncoming traffic and pedestrians still come first.',
          'A person who started crossing on WALK may finish, so a turning driver keeps yielding.',
        ),
      },
      'ca-traffic-signals-slide-06': {
        body: p(
          'Flashing red works like a STOP sign.',
          'Flashing yellow means slow down and use caution.',
          'Flashing red means stop at the usual stopping point, then proceed under stop-sign rules when safe.',
          'Flashing yellow means proceed only with caution; it does not require a stop.',
          'Overhead lane-use signals also differ: a green arrow opens the lane, a yellow X warns it is closing, and a red X closes it.',
        ),
      },
      'ca-traffic-signals-slide-07': {
        body: p(
          'Treat a dark signal like a STOP sign.',
          'Move carefully.',
          'Other drivers may read the dark signal differently, so expect hesitation.',
          'Texas law says a signal that shows nothing in any head is handled as if the intersection had a stop sign.',
          'Slow down, stop at the usual stopping point, and yield.',
          'Take turns and do not assume another driver has noticed the outage.',
        ),
      },
    },
    recalls: {
      'ca-traffic-signals-recall-01': {
        context: 'Recall · Turns on red',
        rule: 'Right on red is allowed after a full [[stop]] and a yield — unless a posted [[sign]] prohibits it. Left on red only between two one-way streets.',
      },
      'ca-traffic-signals-recall-02': {
        context: 'Recall · Flashing signals',
        rule: 'Flashing [[red]] works like a STOP sign. Flashing [[yellow]] means slow down and use caution.',
      },
      'ca-traffic-signals-recall-03': {
        context: 'Recall · Dark signal',
        rule: 'A dark signal? Stop as if the intersection had a [[stop sign]], then yield.',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      {
        prompt: 'A steady red arrow points right and a NO TURN ON RED sign is posted. What should you do?',
        choices: ['Stop and wait for a green indication', 'Stop, then turn when clear', 'Turn without stopping if the way is clear'],
        correct: 0,
        explanation: 'A red arrow means stop for that movement, and the posted sign removes any turn on red; wait for a green light or green arrow.',
      },
      { ca: 'q04' },
      {
        prompt: 'A pedestrian is still in the crosswalk as the signal changes to DON’T WALK. What must a turning driver do?',
        choices: ['Continue yielding until the path is clear', 'Proceed, because the pedestrian lost the right-of-way', 'Sound the horn and edge forward'],
        correct: 0,
        explanation: 'A person who started crossing on WALK may finish to the sidewalk or safety island, and drivers must keep yielding.',
      },
      { pick: ['tx-signals', 3] },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-stop-yield-entering-traffic': {
    visuals: ['tx-stop-yield-entry-q03-asset', 'tx-stop-yield-entry-asset-01', 'tx-stop-yield-entry-asset-03'],
    cards: {
      'ca-stop-yield-entering-traffic-slide-01': {
        body: p(
          'Slow down early.',
          'Stop fully before moving again.',
          'After the complete stop, scan for vehicles, bicycles, and pedestrians.',
          'Texas then makes you yield to any vehicle already in the intersection or approaching closely enough to be an immediate hazard.',
          'If a building or parked vehicle blocks the view, move forward only as needed and only after protecting the crosswalk.',
          'A gap that existed when the wheels stopped can close before you move.',
        ),
      },
      'ca-stop-yield-entering-traffic-slide-02': {
        body: p(
          'When there is a stop line, stop before your vehicle reaches it.',
          'If there is no line, use the crosswalk or the intersection edge.',
          'At a stop sign, stop at the clearly marked stop line.',
          'If there is no line, stop before the near-side crosswalk.',
          'If neither exists, stop at the place nearest the intersecting roadway where you can see approaching traffic.',
          'Keep the vehicle out of pedestrian space.',
        ),
      },
      'ca-stop-yield-entering-traffic-slide-03': {
        body: p(
          'Make the required stop first.',
          'Then creep forward slowly for a better view.',
          'A blocked view does not erase the first required stop.',
          'Stop at the stop line, the crosswalk, or the intersection edge as the situation requires.',
          'After stopping and yielding, edge forward slowly for a better view.',
          'Stop again if a new conflict appears.',
        ),
      },
      'ca-stop-yield-entering-traffic-slide-05': {
        body: p(
          'People already on the road go first.',
          'Check sidewalks, bikes, and both traffic directions.',
          'Leaving an alley, driveway, or private road in Texas means yielding to every vehicle approaching on the highway.',
          'In a business or residence district you must also stop before the sidewalk area and yield to the people on it.',
          'One exam answer may stop in the right place but fail to yield before entering.',
          'A complete solution protects the stopping point and the moving path.',
        ),
      },
      'ca-stop-yield-entering-traffic-slide-06': {
        body: p(
          'Wait when you cannot clear the intersection.',
          'The same idea applies at railroad tracks.',
          'Texas law prohibits stopping in an intersection, on a crosswalk, or on a railroad track.',
          'A green light or your turn at a stop does not allow you to block the conflict area.',
          'Wait before an intersection when traffic is backed up beyond it.',
          'Wait before tracks until your entire vehicle can fit on the far side.',
          'Keep crosswalks clear for pedestrians and mobility-device users.',
        ),
      },
      'ca-stop-yield-entering-traffic-slide-07': {
        body: p(
          'A correct rule cannot prevent another driver’s mistake.',
          'Yield again if a crash is developing.',
          'A driver who rolls past a yield sign and collides with a vehicle in the intersection is presumed to have failed to yield.',
          'Keep yielding until it is safe to enter.',
          'Cross the sidewalk only after checking for pedestrians, wheelchairs, bicycles, and other users who may be hidden by walls or landscaping.',
        ),
      },
    },
    recalls: {
      'ca-stop-yield-entering-traffic-recall-01': {
        context: 'Recall · Stop position',
        rule: 'Stop before the [[stop line]]. No line? Stop before the [[crosswalk]]. Neither? Stop where you can first see cross traffic.',
      },
      'ca-stop-yield-entering-traffic-recall-03': {
        context: 'Recall · Driveways and alleys',
        rule: 'Leaving a driveway or alley? [[Stop]] before the sidewalk, then [[yield]] to traffic already on the road.',
      },
    },
    tests: [
      {
        prompt: 'A stop sign has a crosswalk but no painted stop line. Where should you make the required stop?',
        choices: ['Before entering the crosswalk', 'In the middle of the crosswalk', 'Only after entering the intersection'],
        correct: 0,
        explanation: 'With no stop line, Texas has you stop before entering the crosswalk on the near side of the intersection.',
      },
      {
        prompt: 'A painted stop line is present before a crosswalk. Where do you stop?',
        choices: ['At the stop line', 'At the far edge of the crosswalk', 'Even with the stop sign'],
        correct: 0,
        explanation: 'Texas names the clearly marked stop line as the first stopping point; the crosswalk applies only when there is no line.',
      },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'You are leaving a parking lot across a sidewalk in a business district. What does Texas law require?',
        choices: ['Stop before the sidewalk, yield to people on it, then yield to road traffic', 'Roll across slowly; sidewalk users must wait', 'Sound the horn and enter when a gap appears'],
        correct: 0,
        explanation: 'Emerging from a driveway, alley, or private road in a business or residence district requires a stop before the sidewalk and a yield to sidewalk users and roadway traffic.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-turns-and-signals': {
    visuals: ['tx-turns-signals-asset-01', 'tx-turns-signals-asset-02', 'tx-turns-signals-asset-03'],
    cards: {
      'ca-turns-and-signals-slide-02': {
        body: p(
          'Give other people time to react.',
          'In Texas, signal continuously for at least the last 100 feet before the turn.',
          'Signal a lane change and signal before starting from a parked position.',
          'Turn signals are not a courtesy tool: flashing them to tell the driver behind “go ahead and pass” is against the law.',
          'A signal communicates intent; it does not order another road user to make space.',
        ),
      },
      'ca-turns-and-signals-slide-03': {
        body: p(
          'Move into the legal turn position.',
          'Watch for cyclists between you and the curb.',
          'A right turn is approached and finished as close as practicable to the right curb or edge.',
          'A left turn starts in the extreme left lane lawfully available to you and ends in a lane lawfully open to your direction.',
          'On a two-way street, keep the left turn to the left of the intersection center.',
          'Marked arrows and official devices can require a different course, so read them early.',
        ),
      },
      'ca-turns-and-signals-slide-04': {
        body: p(
          'Yield to approaching traffic.',
          'Turn only when the gap is safe.',
          'A driver turning left at an intersection, into an alley, or into a driveway must yield to oncoming traffic close enough to be an immediate hazard.',
          'After yielding, complete the turn only when the movement can be made safely.',
          'A circular green or a flashing yellow arrow may permit the turn, but neither protects it from oncoming traffic.',
        ),
      },
      'ca-turns-and-signals-slide-06': {
        body: p(
          'Signs and arrows show the legal turn lane.',
          'Check the destination street before you move.',
          'Turning left between two signed one-way streets, hug the left curb or edge as closely as practicable.',
          'That is also the one left turn Texas allows on a red light, after a full stop, unless a sign prohibits it.',
          'A bicycle lane or transit lane is not a general travel lane; enter only where signs and markings permit, and yield to users already in it.',
        ),
      },
      'ca-turns-and-signals-slide-08': {
        body: p(
          'Use your left arm for hand signals.',
          'Hold it straight out for a left turn.',
          'Point it up for a right turn.',
          'Point it down to slow or stop.',
          'Texas law lets a bicyclist signal a right turn with the right arm instead.',
          'Before turning across a bicycle lane, check your mirrors and blind spot.',
          'Yield to any bicyclist already in that space.',
          'Run through this checklist before and during the turn:',
        ),
        bullets: ['Lane.', 'Signal.', 'Mirrors.', 'Blind spot.', 'Yield.', 'Turn.'],
      },
    },
    recalls: {
      'ca-turns-and-signals-recall-01': {
        context: 'Recall · Signal timing',
        rule: 'In Texas, signal continuously for at least the last [[100 feet]] before your turn.',
      },
      'ca-turns-and-signals-recall-02': {
        context: 'Recall · Hand signals',
        rule: 'Left arm straight out: [[left]] turn. Arm up: [[right]] turn. Arm down: [[slow]] or stop.',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      {
        prompt: 'How long before a turn must your signal be on in Texas?',
        choices: ['At least the last 100 feet', 'Only while turning the wheel', 'At least the last mile'],
        correct: 0,
        explanation: 'Texas requires a continuous signal for not less than the last 100 feet of movement before the turn.',
      },
      {
        prompt: 'A driver’s left arm points downward. What is being signaled?',
        choices: ['Slowing or stopping', 'A right turn', 'A left turn'],
        correct: 0,
        explanation: 'Arm straight out means left turn, arm up means right turn, arm down means slowing or stopping.',
      },
      {
        prompt: 'May you flash a turn signal to tell the driver behind that it is safe to pass you?',
        choices: ['No, Texas law bars using signals as a “do pass” courtesy', 'Yes, if the road ahead is clear', 'Yes, but only on a two-lane road'],
        correct: 0,
        explanation: 'Turn signals show your own intention to turn, change lanes, or pull out; using them as a courtesy or “do pass” message to a following driver is prohibited.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-speed-and-space': {
    visuals: ['tx-markings-q03-asset', 'tx-warning-guide-signs-asset-01', 'tx-uncontrolled-intersections-asset-03'],
    challenge: {
      scenario: 'The sign says 70 mph. Heavy rain hides the lane lines.',
      prompt: 'Which speed should you choose?',
      choices: ['Exactly 70 mph', 'A lower speed you can control', 'The speed of the fastest car'],
      correct: 1,
      explanation: 'The posted limit is a ceiling for good conditions. Texas requires a speed that is reasonable and prudent for the conditions you actually have.',
    },
    cards: {
      'ca-speed-and-space-slide-01': {
        body: p(
          'A posted limit assumes good conditions.',
          'Rain, fog, traffic, or glare may require less.',
          'Learn the Texas defaults that apply when nothing different is posted.',
          'In an urban district: 30 mph on a street and 15 mph in an alley.',
          'Outside an urban district: 70 mph on a state- or U.S.-numbered highway and 60 mph on other highways.',
          'On a beach: 15 mph.',
          'Texas law also tells you to slow down near intersections, railroad crossings, curves, hill crests, narrow winding roads, and any special hazard.',
          'Choose a speed that lets you stop within the distance you can see.',
        ),
      },
      'ca-speed-and-space-slide-02': {
        title: 'Texas asks for a reasonable and prudent speed',
        body: p(
          'Never drive faster than is reasonable and prudent for the circumstances.',
          'You can be too fast below the posted limit.',
          'Consider weather, visibility, traffic, the road surface, and road width.',
          'Going over a default limit is evidence in itself that your speed was unreasonable.',
          'Driving so slowly that you impede normal traffic is also unlawful, unless safety requires it.',
        ),
      },
      'ca-speed-and-space-slide-04': {
        body: p(
          'Pick a fixed point ahead.',
          'Count after the vehicle in front passes it.',
          'Add more time when risk grows.',
          'Texas requires an assured clear distance: enough room, at your speed and in these conditions, to stop without hitting the vehicle ahead or swerving into anything else.',
          'A 2-second count is the practical minimum in good conditions; stretch it to 3 or 4 in rain, darkness, or behind a large vehicle.',
        ),
      },
      'ca-speed-and-space-slide-06': {
        body: p(
          'Avoid sitting beside another vehicle.',
          'Leave room to move if traffic stops suddenly.',
          'Avoid driving boxed in beside other vehicles.',
          'Outside a business or residential district, a vehicle in a caravan or motorcade must leave enough space for a passing vehicle to pull in.',
          'Leave room around parked cars, merging traffic, bicycles, and uncertain drivers.',
          'If a conflict develops ahead, a usable side space may prevent a rear-end collision when braking alone is not enough.',
        ),
      },
    },
    recalls: {
      'ca-speed-and-space-recall-01': {
        context: 'Recall · Texas speed law',
        rule: 'Never drive faster than is [[reasonable]] and prudent for conditions, even below the posted [[limit]].',
      },
      'ca-speed-and-space-recall-02': {
        context: 'Recall · Default limits',
        rule: 'When nothing is posted: [[30]] mph on an urban street, [[15]] mph in an alley, 70 mph on a numbered highway outside town.',
      },
    },
    tests: [
      {
        prompt: 'The limit is 70 mph, but fog cuts your view to a few car lengths. Which speed rule controls your decision?',
        choices: ['Slow below the posted limit to a speed reasonable for conditions', 'Hold 70 mph because the sign allows it', 'Match the fastest vehicle you can see'],
        correct: 0,
        explanation: 'Texas requires a reasonable and prudent speed for the actual conditions; the posted number is only the ceiling for good conditions.',
      },
      { ca: 'q02' },
      {
        prompt: 'When does the 70 mph default limit apply in Texas?',
        choices: ['On a state- or U.S.-numbered highway outside an urban district, when no other limit is posted', 'On every road outside a city', 'Whenever traffic is light'],
        correct: 0,
        explanation: 'The 70 mph default covers numbered highways, including farm-to-market roads, outside an urban district; other rural highways default to 60 mph, and a posted limit always controls.',
      },
      { ca: 'q04' },
      { ca: 'q05' },
      { ca: 'q06' },
    ],
  },
};
