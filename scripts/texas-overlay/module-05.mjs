// Texas overlay · Module 5 · Share the Road
// Facts: TX_TN_551_101_103_BICYCLE_RIGHTS_POSITION, TX_HANDBOOK_PASSING_BICYCLE_SAFE_DISTANCE,
// TX_TN_551_104_BICYCLE_EQUIPMENT, TX_TN_545_0605_MOTORCYCLE_LANE, TX_TN_547_703_SLOW_MOVING_EMBLEM,
// TX_TN_545_156_EMERGENCY_VEHICLE_APPROACH, TX_TN_545_157_MOVE_OVER_SLOW_DOWN,
// TX_TN_545_407_408_FOLLOWING_FIRE_APPARATUS, TX_TN_545_066_SCHOOL_BUS, TX_TN_542_501_OBEY_OFFICER,
// TX_TN_545_251_RAILROAD_STOP, TX_TMUTCD_8B_LIGHT_RAIL_CROSSINGS, TX_TMUTCD_6_TEMPORARY_TRAFFIC_CONTROL,
// TX_TN_542_404_WORK_ZONE_FINES, TX_TN_545_058_IMPROVED_SHOULDER.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-bicycles-motorcycles': {
    visuals: ['tx-uturn-backing-q03-asset', 'tx-turns-signals-asset-03', 'tx-uncontrolled-intersections-q05-asset'],
    cards: {
      'ca-bicycles-motorcycles-slide-02': {
        body: p(
          'A cyclist may approach from behind.',
          'Yield before crossing the lane.',
          'Texas gives a bicyclist the rights and duties of a driver.',
          'A slower bicyclist rides near the right edge, but may take the lane to pass, to turn left, to avoid a hazard, or when the lane is narrower than 14 feet.',
          'Bicycles and motorcycles are narrow, easy to hide, and entitled to road space.',
          'Detect them before turning or changing lanes.',
        ),
      },
      'ca-bicycles-motorcycles-slide-04': {
        body: p(
          'Texas law requires a pass at a safe distance and no return until you are clear.',
          'Change lanes when needed and safe.',
          'The state sets no fixed number, but many Texas cities require at least 3 feet, and 3 feet is the practical minimum anywhere.',
          'When practicable and lawful, change lanes to pass a bicyclist.',
          'If neither option can be completed without danger, slow and remain behind until the situation improves.',
        ),
      },
      'ca-bicycles-motorcycles-slide-06': {
        body: p(
          'A narrow profile looks farther away.',
          'Check twice before turning across its path.',
          'Their narrow profile makes speed and distance harder to judge.',
          'Texas law entitles a motorcycle to the full use of its lane, and you may not drive in a way that takes it away.',
          'Give a full lane and normal following space.',
          'Check twice before turning or changing lanes.',
        ),
      },
      'ca-bicycles-motorcycles-slide-07': {
        title: 'Lane splitting is not legal in Texas',
        body: p(
          'A motorcyclist may not ride between lanes of traffic moving the same way.',
          'A motorcyclist also may not pass a vehicle while sharing its lane.',
          'Two motorcycles may ride side by side in one lane; more than two may not.',
          'Even so, check before opening a door or moving sideways in slow traffic — a rider may be beside you lawfully in the next lane.',
        ),
      },
    },
    recalls: {
      'ca-bicycles-motorcycles-recall-01': {
        context: 'Recall · Passing a bicycle',
        rule: 'Pass a bicycle at a [[safe]] distance — many Texas cities require at least [[3 feet]] — and slow down if you cannot.',
      },
      'ca-bicycles-motorcycles-recall-02': {
        context: 'Recall · Sharing lanes',
        rule: 'A motorcycle is entitled to its [[full lane]]. Riding between lanes is [[not legal]] in Texas.',
      },
    },
    tests: [
      { ca: 'q01' },
      {
        prompt: 'What does Texas law require when you pass a bicyclist?',
        choices: ['Pass at a safe distance and do not return until safely clear', 'Pass within the same lane at any distance', 'Sound the horn and pass immediately'],
        correct: 0,
        explanation: 'Texas requires every pass to be made at a safe distance with no return until clear; many cities add a 3-foot minimum by ordinance.',
      },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'Traffic is nearly stopped. May a motorcyclist ride between the lanes to get ahead in Texas?',
        choices: ['No, riding between lanes is prohibited', 'Yes, at any speed', 'Yes, if traffic is below 20 mph'],
        correct: 0,
        explanation: 'A motorcyclist may not operate between lanes of traffic moving in the same direction or pass a vehicle within its lane; lane splitting is unlawful in Texas.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-trucks-buses-slow-vehicles': {
    visuals: ['tx-uncontrolled-intersections-q04-asset', 'tx-regulatory-signs-q02-asset', 'tx-markings-q03-asset'],
    cards: {
      'ca-trucks-buses-slow-vehicles-slide-04': {
        body: p(
          'Move through the blind spot steadily.',
          'Return only when the truck is clearly visible in your mirror.',
          'Buses and light rail follow routes that can place passengers or rails beside ordinary traffic.',
          'Follow signs, signals, lane markings, and boarding-island rules.',
          'Do not turn across the path of an approaching rail vehicle.',
          'Watch for passengers crossing between a curb and a transit stop.',
        ),
      },
      'ca-trucks-buses-slow-vehicles-slide-06': {
        body: p(
          'A slow-moving vehicle emblem is an orange and red triangle on the back.',
          'Texas requires it on vehicles built to travel 25 mph or less, such as farm and road equipment, and on golf carts and off-highway vehicles on a highway.',
          'It must be visible from 500 feet.',
          'Spot it early and slow smoothly — pass only when the law and your view allow.',
        ),
      },
      'ca-trucks-buses-slow-vehicles-slide-07': {
        body: p(
          'Slow down near riders or livestock.',
          'Follow the rider’s signal when an animal is frightened.',
          'A slow driver in Texas can use a marked turnout, or the paved shoulder when it is safe, to let a queue pass.',
          'Near horses or livestock, reduce speed or stop as needed and follow the handler’s directions.',
          'Avoid horns, revving, or abrupt movement that can frighten an animal.',
        ),
      },
    },
    recalls: {
      'ca-trucks-buses-slow-vehicles-recall-03': {
        context: 'Recall · Orange triangle',
        rule: 'An orange and red [[triangle]] marks a slow-moving vehicle — built for [[25]] mph or less.',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'A rider signals you to stop because a horse beside the road is frightened. What should you do?',
        choices: ['Stop and follow the handler’s direction', 'Sound the horn to clear the road', 'Speed past to end the disturbance'],
        correct: 0,
        explanation: 'Slow or stop as needed near animals and follow the handler; horns, revving, and abrupt movement can panic the animal into the road.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-school-buses-emergency-vehicles': {
    visuals: [null, 'tx-warning-guide-signs-q02-asset', 'tx-regulatory-signs-q05-asset'],
    challenge: {
      scenario: 'An ambulance approaches from behind with lights and siren.',
      prompt: 'What should you do?',
      choices: ['Speed up', 'Move right and stop safely', 'Stop inside the intersection'],
      correct: 1,
      explanation: 'Texas law: pull parallel to the right edge, clear of any intersection, and stop until it passes.',
    },
    cards: {
      'ca-school-buses-emergency-vehicles-slide-01': {
        body: p(
          'Check around you.',
          'Move toward the right edge and stop when safe.',
          'When an emergency vehicle approaches with its siren and lights, Texas has you yield and immediately drive parallel to the right edge or curb.',
          'Stop clear of any intersection and stay stopped until it passes.',
          'A police officer’s direction overrides the rule.',
          'If already in an intersection, clear it before pulling over.',
        ),
      },
      'ca-school-buses-emergency-vehicles-slide-02': {
        body: p(
          'Clear the intersection first when necessary.',
          'Then stop where responders can pass.',
          'Look for more responders.',
          'One vehicle may be followed by several more.',
          'Check before reentering traffic.',
          'An emergency vehicle needs a predictable path.',
          'Do not stop in an intersection or block the emergency route.',
          'After it passes, check for additional responders before reentering traffic.',
        ),
      },
      'ca-school-buses-emergency-vehicles-slide-03': {
        body: p(
          'Move over when the law requires and space allows.',
          'Otherwise slow down.',
          'Texas protects a stopped emergency vehicle, tow truck, road maintenance or utility vehicle, garbage truck, and several other work vehicles showing their lights.',
          'On a road with two or more lanes in your direction, vacate the lane next to it.',
          'Otherwise slow to 20 mph below the limit, or to 5 mph where the limit is under 25 mph.',
          'The fine starts at $500.',
        ),
      },
      'ca-school-buses-emergency-vehicles-slide-04': {
        body: p(
          'Texas prohibits following a responding fire truck or ambulance within 500 feet.',
          'Give the scene room.',
          'Do not drive or park into the block where fire apparatus has stopped for an alarm.',
          'Never drive over an unprotected fire hose without the fire commander’s consent.',
          'Extra space keeps the route and scene available to responders.',
        ),
      },
      'ca-school-buses-emergency-vehicles-slide-05': {
        body: p(
          'Stop while the red signals flash.',
          'Watch for children crossing.',
          'Stop before reaching a school bus that is loading or unloading with its red lights flashing, from either direction.',
          'Stay stopped until the bus moves, the driver waves you on, or the lights stop.',
          'On a highway with separate roadways, only the bus’s roadway stops; a painted center lane does not separate roadways.',
          'The fine is $500 to $1,250, and more for a repeat offense.',
        ),
      },
      'ca-school-buses-emergency-vehicles-slide-06': {
        body: p(
          'Follow authorized crossing guards and officers.',
          'Stay stopped until they release your movement.',
          'A school crossing guard, a flagger, or a police officer may direct traffic through a temporary pattern.',
          'Texas makes refusing their lawful direction an offense.',
          'Slow early and expect workers, children, equipment, or stopped traffic.',
          'Do not resume normal speed until you are clear of the controlled area.',
        ),
      },
    },
    recalls: {
      'ca-school-buses-emergency-vehicles-recall-01': {
        context: 'Recall · Emergency vehicles',
        rule: 'Emergency vehicle with lights and siren? Pull to the [[right]] edge and [[stop]] clear of intersections.',
      },
      'ca-school-buses-emergency-vehicles-recall-02': {
        context: 'Recall · Move over',
        rule: 'Passing a stopped emergency or work vehicle with lights on: [[vacate]] the adjacent lane, or slow to [[20]] mph below the limit.',
      },
      'ca-school-buses-emergency-vehicles-recall-03': {
        context: 'Recall · School bus',
        rule: 'Flashing [[red]] school-bus lights mean stop — from either direction — and stay stopped until the signal [[ends]].',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      {
        prompt: 'How closely may an ordinary driver follow a fire truck responding to an alarm in Texas?',
        choices: ['Not within 500 feet', 'Not within 100 feet', 'As closely as traffic allows'],
        correct: 0,
        explanation: 'Following a responding fire apparatus or an ambulance flashing red lights closer than 500 feet is prohibited unless you are on official business.',
      },
      {
        prompt: 'When may you proceed after stopping for a school bus’s flashing red lights?',
        choices: ['When the bus moves, the driver signals you on, or the lights stop', 'As soon as no child is visible', 'After a full stop of three seconds'],
        correct: 0,
        explanation: 'A driver stopped for a loading school bus may not proceed until the bus resumes motion, the bus driver signals, or the visual signal is no longer operating.',
      },
      {
        prompt: 'A stopped tow truck with its lights flashing is on the shoulder of a two-lane road with a 60 mph limit. What must you do?',
        choices: ['Slow to no more than 40 mph', 'Maintain 60 mph in your lane', 'Stop behind it'],
        correct: 0,
        explanation: 'With no second lane to move into, Texas requires slowing to 20 mph below the posted limit when passing a protected stopped vehicle showing its lights.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-rail-light-rail-work-zones': {
    visuals: ['tx-warning-guide-signs-q03-asset', 'tx-warning-guide-signs-asset-03', 'tx-warning-guide-signs-q04-asset'],
    challenge: {
      scenario: 'Traffic is stopped just beyond railroad tracks.',
      prompt: 'May you enter the crossing?',
      choices: ['Yes, if no train is visible', 'Only when your car can clear', 'Yes, after the gate rises'],
      correct: 1,
      explanation: 'Texas prohibits stopping on a railroad track. Do not enter until the whole vehicle can fit beyond the rails.',
    },
    cards: {
      'ca-rail-light-rail-work-zones-slide-01': {
        body: p(
          'Check the space beyond the rails.',
          'Wait before the crossing when traffic is backed up.',
          'Do not start across tracks unless there is enough room for your whole vehicle on the far side.',
          'Texas law prohibits stopping on a railroad track and requires a stop 15 to 50 feet from the nearest rail when a signal, gate, flagger, or approaching train demands it.',
          'Never drive around, under, or through a closed or moving gate.',
        ),
      },
      'ca-rail-light-rail-work-zones-slide-02': {
        body: p(
          'Never race it.',
          'Stop for lights, gates, flaggers, and an approaching train.',
          'Stop when a train within about 1,500 feet sounds its horn and is an immediate hazard, or when a train is plainly visible and dangerously close.',
          'At a crossbuck without lights or gates, yield to any train and stop when safety requires.',
          'A train cannot steer away, and entering behind another vehicle can trap you.',
          'Never go around a gate.',
          'A second train may be hidden.',
          'If the vehicle stalls on the tracks, get everyone out immediately and away from the rails.',
          'Use the crossing emergency sign, then call 911.',
        ),
      },
      'ca-rail-light-rail-work-zones-slide-03': {
        body: p(
          'Check signals, signs, and the rail path.',
          'Never turn in front of an approaching rail vehicle.',
          'Light rail in Texas cities runs in and beside city streets, with crossbucks, signals, and gates like a railroad.',
          'Follow signs, signals, lane markings, and boarding-island rules.',
          'Do not turn across the path of an approaching rail vehicle.',
          'Watch for passengers crossing between a curb and a transit stop.',
        ),
      },
      'ca-rail-light-rail-work-zones-slide-04': {
        body: p(
          'Expect narrow lanes, workers, equipment, and sudden queues.',
          'Slow down early.',
          'Texas doubles the fines for traffic offenses in a work zone when workers are present.',
          'A flagger or a police officer may direct traffic through a temporary pattern.',
          'Obey the person’s signal even when it differs from the normal signal or lane.',
          'Do not resume normal speed until you are clear of the controlled area.',
        ),
      },
      'ca-rail-light-rail-work-zones-slide-05': {
        body: p(
          'Follow the flagger even when the usual signal differs.',
          'Do not move until released.',
          'A flagger uses a STOP/SLOW paddle or a red flag.',
          'Stay stopped until the paddle turns to SLOW.',
          'In work zones, follow temporary signs, channelizing devices, and flagger directions; expect narrowed lanes and sudden slowing.',
        ),
      },
      'ca-rail-light-rail-work-zones-slide-06': {
        body: p(
          'Keep the lower safe speed until you are fully clear.',
          'Watch for traffic merging back.',
          'Work-zone signs, cones, drums, barriers, arrow boards, and flaggers can replace the normal path.',
          'A posted work-zone speed limit is regulatory; the doubled fine applies where the zone is signed with it.',
          'Reduce speed for the actual conditions, increase space, and follow the temporary channel.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      {
        prompt: 'A flagger directs traffic through a temporary lane. What should you follow?',
        choices: ['The flagger and the temporary controls', 'The usual lane lines', 'The car ahead'],
        correct: 0,
        explanation: 'A flagger’s direction and the temporary traffic control replace the normal pattern; refusing a lawful direction is an offense.',
      },
      {
        prompt: 'Traffic is stopped just beyond railroad tracks. When may you enter the crossing?',
        choices: ['Only when there is enough room to clear the tracks completely', 'When the gate is up', 'When no train is visible'],
        correct: 0,
        explanation: 'Stopping on a railroad track is prohibited; enter only when the whole vehicle can fit on the far side.',
      },
      { ca: 'q04' },
      {
        prompt: 'May you drive around a lowered railroad gate when no train is visible?',
        choices: ['No', 'Yes, if you look both ways', 'Yes, if the lights have stopped flashing'],
        correct: 0,
        explanation: 'Driving around, under, or through a gate that is closed, closing, or opening is an offense in Texas.',
      },
      {
        prompt: 'Before turning across light-rail tracks in a city street, what should you check?',
        choices: ['The rail vehicle’s path and every crossing control', 'Only the traffic light', 'Only the car behind you'],
        correct: 0,
        explanation: 'Light-rail crossings use the same controls as railroads and trains can approach from behind or beside traffic; never turn across an approaching rail vehicle.',
      },
    ],
  },
};
