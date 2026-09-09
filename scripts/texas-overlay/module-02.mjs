// Texas overlay · Module 2 · Read the Road
// Facts: TX_TMUTCD_2A_*, TX_TMUTCD_2B_27_LANE_CONTROL_SIGNS, TX_TN_544_004_OBEY_DEVICES,
// TX_TN_542_501_OBEY_OFFICER, TX_TMUTCD_2B_46_DO_NOT_ENTER_WRONG_WAY, TX_TMUTCD_2C_*,
// TX_TN_545_251_RAILROAD_STOP, TX_TN_545_302_NO_STOPPING_IN_INTERSECTION, TX_TMUTCD_6_*,
// TX_TMUTCD_3A_04_*, TX_TMUTCD_3B_*, TX_TN_545_055_NO_PASSING_ZONES, TX_TN_545_302_303_SIGNS_CONTROL_STOPPING,
// TX_TN_545_302_NO_STANDING_DISTANCES.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-sign-shapes-and-colors': {
    visuals: ['tx-regulatory-signs-asset-01', 'tx-sign-language-asset-03', 'tx-sign-language-asset-02'],
    cards: {
      'ca-sign-shapes-and-colors-slide-06': {
        body: p(
          'The symbol shows the type of hazard you are approaching.',
          'Change your speed or position early, while you still have room.',
          'Shape and color help you predict the message, but the words, symbol, plaque, lane position, and stated hours give the real instruction.',
          'In Texas a sign mounted over one lane applies to that lane.',
          'A plaque can make a restriction active only during the hours or days it states.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'A lane-use sign is mounted directly over the left lane. Which drivers must follow it first?',
        choices: ['Drivers in the left lane', 'Drivers in every lane', 'Only drivers turning right'],
        correct: 0,
        explanation: 'A sign placed over a lane regulates that lane; read the arrow and any plaque, then check whether your own lane carries a sign.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-regulatory-signs': {
    visuals: [null, 'tx-regulatory-signs-q03-asset', 'tx-regulatory-signs-asset-03'],
    challenge: {
      scenario: 'A police officer waves you through a red light.',
      prompt: 'What should you follow?',
      choices: ['The red light only', 'The officer’s direction', 'The car beside you'],
      correct: 1,
      explanation: 'Texas law puts a police officer’s lawful direction above the signal. Follow it while checking that the path is safe.',
    },
    cards: {
      'ca-regulatory-signs-slide-04': {
        body: p(
          'The road or ramp is closed to your movement.',
          'Choose another legal path.',
          'Texas law requires you to obey every official traffic sign or signal that applies to you unless a police officer, traffic officer, or escort flagger directs otherwise.',
          'DO NOT ENTER stands where a two-way road becomes one-way and at exit ramps.',
          'Keep watching for people and drivers who may not expect the traffic pattern.',
        ),
      },
      'ca-regulatory-signs-slide-07': {
        body: p(
          'A police officer, school crossing guard, or escort flagger may override the normal pattern.',
          'Move carefully.',
          'Traffic may be directed differently during an emergency, a collision, or a special operation.',
          'Texas makes it an offense to wilfully refuse a lawful direction from any of them.',
          'Keep watching for pedestrians and drivers who may not understand the temporary pattern.',
          'Obeying the direction does not give you the right-of-way over someone already in danger.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'A police officer directs you through a red light. Which instruction controls?',
        choices: ['The officer’s direction', 'The red light', 'Whichever the driver behind you follows'],
        correct: 0,
        explanation: 'A lawful direction from a police officer overrides the signal; you must still check that the path is safe before moving.',
      },
      {
        prompt: 'A school crossing guard in a school crosswalk signals you to stop. What does Texas law require?',
        choices: ['Stop and comply with the guard’s direction', 'Continue if no child is visible', 'Slow down but keep rolling'],
        correct: 0,
        explanation: 'A crossing guard performing crossing-guard duties in a school crosswalk has the same authority to direct you as a police officer; refusing a lawful direction is an offense.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-warning-and-guide-signs': {
    visuals: ['tx-warning-guide-signs-asset-02', 'tx-warning-guide-signs-q03-asset', 'tx-warning-guide-signs-asset-03'],
    cards: {
      'ca-warning-and-guide-signs-slide-02': {
        body: p(
          'Curves, merges, crossings, and slippery roads use clear symbols.',
          'Match your action to the hazard.',
          'Do not start across tracks unless there is enough room for your whole vehicle on the far side.',
          'Texas law prohibits stopping on a railroad track.',
          'Stop when a signal, a lowered gate, a flagger, or an approaching train requires it.',
          'Never drive around, under, or through a gate that is closed, closing, or opening.',
        ),
      },
      'ca-warning-and-guide-signs-slide-03': {
        body: p(
          'It suggests a safer speed for the condition ahead.',
          'It is not the general speed limit.',
          'Curve, crossroad, merging, divided-highway, lane-ending, slippery-surface, and signal-ahead signs preview the road or traffic pattern.',
          'Identify the hazard, check the surrounding traffic, and make the smallest early speed or lane adjustment that keeps control.',
          'The posted regulatory limit stays the ceiling; the advisory number describes the hazard.',
        ),
      },
      'ca-warning-and-guide-signs-slide-05': {
        body: p(
          'Never enter tracks without room beyond them.',
          'A train cannot steer around you.',
          'The round advance sign and the crossbuck tell you to look, listen, and prepare for the crossing controls.',
          'When a stop is required, Texas has you stop between 15 and 50 feet from the nearest rail.',
          'Never begin across tracks unless the far side can hold the entire vehicle.',
          'Entering behind another vehicle can trap you even when the warning equipment was clear at first.',
        ),
      },
      'ca-warning-and-guide-signs-slide-06': {
        body: p(
          'Slow down.',
          'Expect workers, equipment, closed lanes, and flaggers.',
          'Work-zone signs, cones, drums, barriers, arrow boards, and flaggers can replace the normal path.',
          'In Texas, fines for traffic offenses double in a work zone when workers are present.',
          'Reduce speed for the actual conditions, increase space, and follow the temporary channel.',
          'Green, blue, and brown guide signs support navigation; read them early so you do not cut across traffic.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      { pick: ['tx-warning-guide-signs', 3] },
      {
        prompt: 'A crossing gate is closing ahead and no train is visible yet. What does Texas law require?',
        choices: ['Stop 15 to 50 feet from the nearest rail and wait', 'Drive around the gate if the tracks look clear', 'Speed up to cross before it closes'],
        correct: 0,
        explanation: 'A lowering gate requires a stop between 15 and 50 feet from the nearest rail, and driving around, under, or through a closing gate is an offense.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-road-markings-and-curbs': {
    title: 'Lines, Arrows, and Stop Lines',
    visuals: ['tx-stop-yield-entry-q02-asset', 'tx-markings-asset-02', 'tx-markings-asset-01'],
    challenge: {
      scenario: 'A stop sign has a painted stop line.',
      prompt: 'Where should you stop first?',
      choices: ['Before the line', 'Across the crosswalk', 'Beside the sign'],
      correct: 0,
      explanation: 'The stop line is the first stopping point in Texas law.',
    },
    cards: {
      'ca-road-markings-and-curbs-slide-02': {
        body: p(
          'Broken lines may allow crossing when safe.',
          'Solid lines warn or restrict it.',
          'A broken line generally marks a place where crossing may be allowed when the maneuver is otherwise legal and safe.',
          'A solid line warns or restricts crossing.',
          'A solid yellow line on your side marks a Texas no-passing zone; you may cross it only to turn left into a driveway, alley, or private road.',
          'Double solid white lines form a lane barrier; wait for a broken pattern instead of forcing a lane change.',
        ),
      },
      'ca-road-markings-and-curbs-slide-03': {
        body: p(
          'Do not treat every double line the same.',
          'Color, spacing, and road context matter.',
          'Do not answer a marking question from color alone.',
          'Yellow versus white identifies the traffic relationship; broken, solid, double, arrows, signs, and roadway context determine the permitted movement.',
          'A two-way left-turn lane between two sets of yellow lines is for turning, not for driving ahead.',
        ),
      },
      'ca-road-markings-and-curbs-slide-05': {
        body: p(
          'Stop before the line.',
          'Keep crosswalks clear.',
          'Stop lines and crosswalk markings show where the front of your vehicle should stop.',
          'Texas law names the order: the stop line first, then the near-side crosswalk, then the point where you can first see cross traffic.',
          'Move forward only as needed for visibility after the required stop and after yielding.',
        ),
      },
      'ca-road-markings-and-curbs-slide-06': {
        scope: 'state_specific',
        body: p(
          'Stay out unless markings allow entry.',
          'Do not use them to pass a queue.',
          'A single set of double solid yellow lines bars passing across the center; Texas lets you cross it only to turn left into a driveway, alley, or side road.',
          'Two sets of double yellow lines with diagonal stripes between them form a painted median island.',
          'Do not drive on or across it.',
          'Use only a marked opening or another legally allowed path.',
        ),
      },
      'ca-road-markings-and-curbs-slide-07': {
        title: 'Painted curbs follow local rules',
        body: p(
          'Texas has no statewide curb-color code.',
          'A city may paint a curb, and the sign or local rule beside it says what the paint means.',
          'Read the sign first; the paint is a reminder.',
          'Statewide, the distances are the rule.',
          'Never stop, stand, or park:',
        ),
        bullets: [
          'In front of a driveway.',
          'Within 15 feet of a fire hydrant.',
          'Within 20 feet of a crosswalk at an intersection.',
          'Within 30 feet on the approach to a roadside stop sign, yield sign, or traffic signal.',
          'Where a sign prohibits stopping or standing.',
        ],
      },
    },
    recalls: {
      'ca-road-markings-and-curbs-recall-03': {
        context: 'Recall · Painted curbs',
        rule: 'Texas has no statewide curb-color code — the posted [[sign]] decides. Never park within [[15 feet]] of a fire hydrant.',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      {
        prompt: 'Two sets of double yellow lines run down the middle of the road with yellow diagonal stripes between them. What do they form?',
        choices: ['A painted median you may not drive on or across', 'A two-way left-turn lane', 'A passing lane for either direction'],
        correct: 0,
        explanation: 'Two sets of double solid yellow lines form a flush median island; it is not a travel, turning, or passing lane.',
      },
      {
        prompt: 'How close to a fire hydrant may you park in Texas?',
        choices: ['No closer than 15 feet', 'No closer than 5 feet', 'Anywhere the curb is unpainted'],
        correct: 0,
        explanation: 'Standing or parking within 15 feet of a fire hydrant is prohibited, whether or not the curb is painted.',
      },
      {
        prompt: 'At a stop sign with a painted stop line, where should your vehicle first stop?',
        choices: ['Before the stop line', 'Even with the sign', 'At the far edge of the crosswalk'],
        correct: 0,
        explanation: 'The clearly marked stop line is the first stopping point; the crosswalk and the intersection edge apply only when no line exists.',
      },
    ],
  },
};
