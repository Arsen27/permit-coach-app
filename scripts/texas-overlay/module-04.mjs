// Texas overlay · Module 4 · Lanes, Passing, and Freeways
// Facts: TX_TN_545_051_KEEP_RIGHT, TX_TN_545_060_LANE_DISCIPLINE, TX_TN_545_061_MULTILANE_LANE_ENTRY,
// TX_TN_545_053_054_PASSING_LEFT, TX_TN_545_055_NO_PASSING_ZONES, TX_TN_545_056_NO_LEFT_OF_CENTER_100_FEET,
// TX_TN_545_057_PASSING_RIGHT, TX_TN_545_058_IMPROVED_SHOULDER, TX_TMUTCD_2B_42_SLOW_VEHICLE_TURNOUT,
// TX_TN_545_415_BACKING, TX_TN_545_301_STOPPING_OUTSIDE_DISTRICT, TX_TMUTCD_4P_RAMP_METERS,
// TX_TMUTCD_3B_05_TWO_WAY_LEFT_TURN_LANE, TX_TMUTCD_9E_BICYCLE_LANES, TX_TMUTCD_2G_PREFERENTIAL_LANES,
// TX_TMUTCD_3J_03_FLUSH_MEDIAN.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-choosing-changing-lanes': {
    visuals: ['tx-turns-signals-q02-asset', 'tx-markings-q03-asset', 'tx-warning-guide-signs-asset-02'],
    cards: {
      'ca-choosing-changing-lanes-slide-01': {
        scope: 'state_specific',
        body: p(
          'Use signs, arrows, and your route.',
          'Last-second lane changes create extra risk.',
          'On a two-lane road, a slow vehicle with a queue behind it can use a marked turnout, or the paved shoulder when that is necessary and safe, to let traffic pass.',
          'Texas sets no vehicle count; the duty is not to impede normal traffic.',
          'Do not pull off where the surface or sight distance makes the cure more dangerous than the delay.',
        ),
      },
      'ca-choosing-changing-lanes-slide-05': {
        title: 'Slower traffic keeps right',
        body: p(
          'Texas law puts a slower driver in the right-hand lane, or as close to the right edge as practicable.',
          'The exceptions are passing and preparing for a left turn.',
          'On a one-way road with three or more lanes, a driver moving into a lane from the right yields to a driver moving into the same lane from the left.',
          'Settle in a lane; a device may prohibit lane changes on some stretches.',
        ),
      },
      'ca-choosing-changing-lanes-slide-06': {
        body: p(
          'Plan a merge when the warning appears.',
          'Do not wait for the pavement to disappear.',
          'A mirror shows only the angle reflected into it.',
          'Motorcycles, bicycles, and cars can travel in the uncovered zone slightly behind either side.',
          'Turn your head enough to check through the side window without turning the steering wheel or your whole body.',
          'Texas law lets you leave your lane only when the move can be made safely.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      {
        prompt: 'Vehicles are lined up behind you on a two-lane road where passing is unsafe. What should you do when a safe turnout or paved shoulder is available?',
        choices: ['Use it to let traffic pass, then re-enter with a safe gap', 'Speed up beyond what is safe', 'Stop in the travel lane'],
        correct: 0,
        explanation: 'A slow driver may not impede normal traffic; Texas allows a marked turnout or the improved shoulder to let faster vehicles pass when it is necessary and safe.',
      },
      { ca: 'q04' },
      {
        prompt: 'On a three-lane one-way road, you and another driver move into the same middle lane at the same moment — you from the right, the other driver from the left. Who yields?',
        choices: ['You, the driver entering from the right', 'The driver entering from the left', 'Whoever signaled first'],
        correct: 0,
        explanation: 'On a one-way roadway with three or more lanes, the driver entering a lane from the right must yield to a vehicle entering the same lane from the left.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-passing-rules': {
    visuals: ['tx-markings-q01-asset', 'tx-markings-q05-asset', 'tx-uturn-backing-q01-asset'],
    challenge: {
      scenario: 'A hill hides the road ahead on a two-lane road.',
      prompt: 'Should you pass?',
      choices: ['Yes, if you accelerate', 'No, wait for a clear view', 'Yes, if the other car is slow'],
      correct: 1,
      explanation: 'Texas allows a pass on the left only when the left side is clearly visible and free of approaching traffic far enough to complete it.',
    },
    cards: {
      'ca-passing-rules-slide-01': {
        body: p(
          'Check signs and lane markings.',
          'A safe-looking gap does not cancel a restriction.',
          'Texas bars driving left of center within 100 feet of an intersection or railroad crossing in a city, or of a bridge, viaduct, or tunnel anywhere.',
          'A solid yellow line on your side marks a no-passing zone.',
          'Read signs and markings, but also identify the roadway feature.',
        ),
      },
      'ca-passing-rules-slide-04': {
        body: p(
          'Do not stay beside the other vehicle.',
          'Finish without exceeding the legal speed.',
          'A pass must be both legal and safe for the conditions.',
          'Using the opposing lane, be back on your side before you come within 200 feet of an approaching vehicle.',
          'A legal location can still be unsafe because of sight distance, oncoming traffic, speed difference, a bicycle, or the space needed to return.',
        ),
      },
      'ca-passing-rules-slide-06': {
        body: p(
          'Crossings, intersections, bridges, and blocked views may prohibit passing.',
          'Read the exact scenario.',
          'Passing on the right is allowed only when the vehicle ahead is turning left and the road has room for two lines of traffic in your direction, or is one-way.',
          'Texas does let you use a paved shoulder to get around a vehicle that is stopped, disabled, or waiting to turn left — when it is necessary and safe.',
          'An unpaved shoulder is never a passing lane.',
        ),
      },
      'ca-passing-rules-slide-07': {
        body: p(
          'Keep a steady path.',
          'Do not speed up.',
          'Create room if needed.',
          'Texas law says a driver being passed may not accelerate until the pass is complete, and must move or stay right when the passing driver sounds the horn.',
          'A slow driver can also use a marked turnout or the paved shoulder to let faster traffic by.',
          'Make room when safe instead of competing with the passing driver.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'A car ahead is waiting to turn left on a two-lane road with a paved shoulder. May you use the shoulder to get past?',
        choices: ['Yes, if it is necessary and can be done safely', 'No, never', 'Only on an unpaved shoulder'],
        correct: 0,
        explanation: 'Texas allows driving on an improved (paved) shoulder to pass a vehicle that is stopped or preparing to turn left when it is necessary and safe; leaving the main roadway to pass is otherwise prohibited.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-freeway-merging': {
    visuals: ['tx-stop-yield-entry-q03-asset', 'tx-regulatory-signs-q02-asset', 'tx-warning-guide-signs-q05-asset'],
    cards: {
      'ca-freeway-merging-slide-02': {
        body: p(
          'Find a gap and adjust smoothly.',
          'Do not force another driver to brake.',
          'Use the acceleration lane to approach the freeway’s flow while staying within the posted limit and the conditions.',
          'Texas lets you use the paved shoulder to build speed before entering the main lane when that is necessary and safe.',
          'Do not assume freeway traffic must yield; enter only when the lane movement is safe.',
        ),
      },
      'ca-freeway-merging-slide-04': {
        body: p(
          'Check your following gap.',
          'Avoid staying beside another vehicle.',
          'Texas allows a stop on the paved shoulder only when it is necessary and safe, not for convenience.',
          'Outside town, a stopped vehicle must be visible for 200 feet each way and off the main traveled lanes whenever possible.',
          'If a real emergency forces a stop, move as far from traffic as possible and make the vehicle visible.',
        ),
      },
      'ca-freeway-merging-slide-07': {
        body: p(
          'Take the next one.',
          'Never stop, back up, or cross a gore area.',
          'Backing on the shoulder or roadway of a freeway is against Texas law.',
          'Yielding on a ramp does not mean an automatic stop.',
          'Stopping can erase the speed and distance needed to merge.',
          'Choose the action that fits the traffic, sign, and available lane—not a universal ramp ritual.',
        ),
      },
      'ca-freeway-merging-slide-08': {
        body: p(
          'Stop when the meter is red.',
          'Enter on the permitted signal and merge normally.',
          'A ramp meter spaces vehicles entering a freeway.',
          'Stop at red at the marked line.',
          'Proceed on green as the sign directs, often one vehicle per green.',
          'A dark ramp meter is simply switched off; it is not a stop sign.',
          'After the signal, use the rest of the ramp to merge normally.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'May you pull onto the paved freeway shoulder to check a map?',
        choices: ['No, the shoulder is for stops that are necessary and safe', 'Yes, whenever traffic is light', 'Yes, if you turn on the hazard lights'],
        correct: 0,
        explanation: 'Texas allows driving on an improved shoulder only when necessary and safe, for listed purposes such as stopping in an emergency, accelerating, slowing to turn, or avoiding a collision; convenience is not one of them.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-special-lanes': {
    visuals: [null, 'tx-markings-asset-03', 'tx-sign-language-q05-asset'],
    challenge: {
      scenario: 'You want to enter an HOV lane.',
      prompt: 'What should you trust?',
      choices: ['Yesterday’s rule', 'The current signs and markings', 'The car ahead'],
      correct: 1,
      explanation: 'Occupancy, hours, access points, and toll rules are set by the posted signs for that lane.',
    },
    cards: {
      'ca-special-lanes-slide-02': {
        body: p(
          'Use them to prepare for a legal left turn or U-turn.',
          'Do not cruise or pass in them.',
          'A two-way left-turn lane sits between two sets of yellow lines with the broken line on the inside.',
          'On a three-lane two-way road, Texas allows the center lane only for passing when it is clear, for preparing a left turn, or where a device assigns it to you.',
          'The exam may swap the turn lane with a painted median; read which marking is described.',
        ),
      },
      'ca-special-lanes-slide-03': {
        title: 'Texas keeps center-lane travel short',
        body: p(
          'Enter the shared center lane only to prepare for and make a lawful left turn or U-turn.',
          'Texas sets no fixed distance, so enter close to your turn and never use the lane to travel ahead.',
          'Watch for opposing drivers using it too.',
          'Look for drivers entering from driveways who may use the same lane to merge.',
        ),
      },
      'ca-special-lanes-slide-04': {
        body: p(
          'Check behind before crossing one.',
          'Enter for a turn only where allowed.',
          'A bicycle lane is reserved for bicycles.',
          'Before a right turn, the lane markings end and a dotted line shows where you may cross; the markings stop at least 100 feet before a turn-only lane.',
          'Before crossing, check the blind spot and yield to a bicyclist already using the lane.',
        ),
      },
      'ca-special-lanes-slide-05': {
        body: p(
          'Check occupancy, vehicle type, time, toll, and access point.',
          'Do not assume.',
          'Use a preferential lane only when your occupancy, vehicle class, access point, and time meet the signs and markings.',
          'Texas posts an occupancy sign, an hours sign, and toll terms for each managed lane.',
          'Enter and leave only where the separating line is broken.',
        ),
      },
      'ca-special-lanes-slide-06': {
        body: p(
          'A limited entry may be allowed for a turn.',
          'Yield to buses or other authorized users.',
          'A special lane’s rules may change by location, time, direction, or vehicle.',
          'Read occupancy, vehicle, time, and toll conditions before entering.',
          'Follow solid and broken access markings.',
          'Do not assume a rule from one freeway applies to another.',
        ),
      },
      'ca-special-lanes-slide-07': {
        body: p(
          'Two sets of double yellow lines form a painted median.',
          'Do not drive across it.',
          'The diagonal stripes inside are yellow and mark space that is not for travel.',
          'A two-way left-turn lane has a different marking pattern and exists for permitted left turns or U-turns.',
          'Do not use either space as an ordinary passing lane.',
        ),
      },
      'ca-special-lanes-slide-08': {
        body: p(
          'A slow vehicle may need to let traffic pass.',
          'Reenter only with a safe gap.',
          'Transit lanes reserve space for specified vehicles; turnouts let a slower vehicle release a queue.',
          'Do not use a bus-only lane as a general travel lane.',
          'Texas also lets a slow driver use the paved shoulder to let a faster vehicle by when that is necessary and safe.',
        ),
      },
    },
    recalls: {
      'ca-special-lanes-recall-01': {
        context: 'Recall · Center turn lane',
        rule: 'A two-way left-turn lane is for [[turning]] left, not for passing or driving ahead — enter close to your turn.',
      },
      'ca-special-lanes-recall-02': {
        context: 'Recall · Posted lane rules',
        rule: 'HOV and toll lanes work only under their [[posted]] rules — occupancy, hours, and access points.',
      },
    },
    tests: [
      {
        prompt: 'A center lane carries left-turn arrows pointing both ways. How may you use it?',
        choices: ['Enter it only to prepare for a left turn, close to your turn', 'Use it to pass a slow line of traffic', 'Drive in it whenever the right lanes are congested'],
        correct: 0,
        explanation: 'A two-way left-turn lane is a shared turning space for both directions; it is never a through or passing lane.',
      },
      {
        prompt: 'Can a painted median between two sets of double yellow lines be used as a waiting lane for a left turn?',
        choices: ['No', 'Yes, for up to two cars', 'Yes, if the stripes are white'],
        correct: 0,
        explanation: 'A flush median island marked by two sets of double solid yellow lines is not a travel or waiting lane; only a two-way left-turn lane, with its broken inner lines, is meant for turn preparation.',
      },
      {
        prompt: 'On a three-lane two-way road, when may you drive in the center lane?',
        choices: ['Only to pass when it is clear, to prepare for a left turn, or where a device assigns it to your direction', 'Whenever the right lane is slow', 'Never'],
        correct: 0,
        explanation: 'Texas restricts the center lane of a three-lane two-way road to passing when clear for a safe distance, preparing for a left turn, or use directed by an official device.',
      },
      { ca: 'q04' },
      {
        prompt: 'Where may a driver cross a bicycle lane to make a right turn?',
        choices: ['Where the solid line becomes dotted before the turn, after yielding to bicyclists', 'Anywhere along the lane', 'Only by stopping inside the bicycle lane'],
        correct: 0,
        explanation: 'Bicycle lane markings end before a turn lane and a dotted line marks the crossing point; a driver crosses there after checking behind and yielding to any bicyclist.',
      },
      { ca: 'q06' },
    ],
  },
};
