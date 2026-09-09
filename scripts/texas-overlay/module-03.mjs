// Texas overlay · Module 3 · Intersections and Everyday Moves
// Facts: TX_TN_545_151_*, TX_TN_552_003/005/008/010_*, TX_TMUTCD_2B_10_ROUNDABOUT_YIELD,
// TX_TN_544_007_*, TX_TMUTCD_4A_03_RED_ARROW, TX_TMUTCD_4A_04_FLASHING_YELLOW_ARROW,
// TX_TN_545_101_TURN_POSITIONS, TX_TN_545_102_TURNAROUND_CURVE_CREST, TX_TMUTCD_2B_30A_TURNAROUND_LANES,
// TX_TN_545_415_BACKING, TX_TN_545_402_MOVING_PARKED_VEHICLE, TX_TN_545_404_UNATTENDED_VEHICLE,
// TX_HANDBOOK_HILL_PARKING_WHEELS, TX_TN_545_301_*, TX_TN_545_302_*, TX_TN_545_303_CURB_18_INCHES,
// TX_TN_545_418_OPENING_DOORS, TX_HANDBOOK_ACCESSIBLE_PARKING.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-uncontrolled-intersections': {
    visuals: ['tx-uncontrolled-intersections-q01-asset', 'tx-uncontrolled-intersections-asset-02', 'tx-uncontrolled-intersections-q04-asset'],
    keyPoints: ['Check who is already inside.', 'Look right when arrival is tied.', 'Never force a turn.'],
    challenge: {
      scenario: 'Two cars reach an uncontrolled intersection together.',
      prompt: 'Which car normally goes first?',
      choices: ['The car on the right', 'The car on the left', 'The faster car'],
      correct: 0,
      explanation: 'Texas law has the driver on the left stop and yield to the vehicle on the right when arrival is tied.',
    },
    cards: {
      'ca-uncontrolled-intersections-slide-01': {
        body: p(
          'Let the intersection clear.',
          'Do not challenge a vehicle already in your path.',
          'If another vehicle is already inside the intersection, let it clear before you enter.',
          'Texas words it as yielding to a vehicle that has entered the intersection or is approaching so closely as to be a hazard.',
          'Do not use your speed or arrival story to challenge someone who is physically in the conflict area.',
          'Slow early and keep an escape option.',
        ),
      },
      'ca-uncontrolled-intersections-slide-02': {
        body: p(
          'The first clear arrival normally moves first.',
          'A driver who arrives later should wait for the earlier vehicle.',
          'When one road user clearly arrives first, that person normally proceeds first after checking the intersection.',
          'The useful clue is not which vehicle is larger or moving faster; it is the order in which each reaches the decision point.',
          'At an all-way stop the same order applies after each driver has stopped.',
        ),
      },
      'ca-uncontrolled-intersections-slide-03': {
        body: p(
          'The driver on the left yields.',
          'Confirm that the other driver is actually moving.',
          'If two vehicles reach an uncontrolled intersection together, Texas has the driver on the left stop, yield, and grant immediate use of the intersection to the vehicle on the right.',
          'The same left-yields-right pattern settles ties at an all-way stop after both vehicles have stopped.',
        ),
      },
      'ca-uncontrolled-intersections-slide-04': {
        body: p(
          'Traffic on the ending road yields.',
          'People in the intersection still come first.',
          'At an uncontrolled T-intersection, Texas law has the driver on the road that ends stop and yield to traffic on the continuing road.',
          'This is not permission for through traffic to ignore a collision risk—both drivers still watch, slow, and protect people in the intersection.',
        ),
      },
      'ca-uncontrolled-intersections-slide-07': {
        title: 'Bigger roads and paved roads go first',
        body: p(
          'Texas adds two tie-breakers that many states do not have.',
          'A driver on a one- or two-lane road meeting an uncontrolled intersection with a divided highway, or with a road of three or more lanes, must stop and yield to traffic on the bigger road.',
          'A driver on an unpaved road meeting a paved road must stop and yield to traffic on the paved road.',
          'In both cases you proceed only when the intersection can be entered safely.',
        ),
      },
      'ca-uncontrolled-intersections-slide-08': {
        body: p(
          'Give up your turn when a crash is developing.',
          'Safety beats being technically first.',
          'Texas law never lets you take the intersection; it lets you proceed only when you can enter without interference or collision.',
          'Right-of-way is something the other road user yields; it is not something you force.',
          'If another driver fails to follow the sequence, give up the turn rather than turn a correct exam answer into a crash.',
        ),
      },
    },
    recalls: {
      'ca-uncontrolled-intersections-recall-02': {
        context: 'Recall · Big road, paved road',
        rule: 'A small road meeting a divided highway or a road with three or more lanes stops and yields. An [[unpaved]] road stops and yields to a [[paved]] road.',
      },
      'ca-uncontrolled-intersections-recall-03': {
        context: 'Recall · Never forced',
        rule: 'Right-of-way is [[yielded]], never forced. Proceed only when you can enter without a [[collision]].',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'Your road ends at a T-intersection with no signs. What is your duty?',
        choices: ['Stop, yield, and enter only when it is safe', 'Proceed first because you are turning', 'Take the right-of-way if you arrived first'],
        correct: 0,
        explanation: 'A driver on a road that ends at an uncontrolled intersection must stop and yield to traffic on the continuing road, then proceed only when the intersection can be entered safely.',
      },
      {
        prompt: 'You are on a two-lane road approaching an uncontrolled intersection with a divided highway. Who yields?',
        choices: ['You stop and yield to traffic on the divided highway', 'The highway traffic yields to you', 'Whoever arrives first goes first'],
        correct: 0,
        explanation: 'A driver on a one- or two-lane road must stop, yield, and grant immediate use of the intersection to traffic on a divided highway or a road with three or more marked lanes.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-crosswalks-and-roundabouts': {
    visuals: ['tx-pedestrians-roundabouts-q01-asset', 'tx-pedestrians-roundabouts-asset-02', 'tx-pedestrians-roundabouts-asset-03'],
    challenge: {
      scenario: 'A car is stopped at a crosswalk in the next lane.',
      prompt: 'What should you do?',
      choices: ['Pass it', 'Slow and prepare to stop', 'Honk and continue'],
      correct: 1,
      explanation: 'Texas law bars passing a vehicle stopped at a crosswalk for a pedestrian. The stopped car may be hiding someone.',
    },
    cards: {
      'ca-crosswalks-and-roundabouts-slide-01': {
        body: p(
          'Intersection corners can form a crosswalk without painted lines.',
          'Scan both sides.',
          'Texas defines a crosswalk at every intersection, marked or not, where the sidewalk lines would meet the road.',
          'Where no signal is working, stop and yield to a pedestrian in the crosswalk on your half of the road or coming close from the other half.',
          'A pedestrian crossing elsewhere must yield to vehicles, but you still owe due care and a horn warning when needed.',
        ),
      },
      'ca-crosswalks-and-roundabouts-slide-03': {
        body: p(
          'It may be protecting someone you cannot see.',
          'Stop and check.',
          'Texas law says a driver coming up behind a vehicle stopped at a crosswalk to let a pedestrian cross may not pass it.',
          'The stopped vehicle blocks your view and may be the only clue that someone is in front of it.',
          'Cover the brake and wait until the entire crossing is visible and safe.',
        ),
      },
      'ca-crosswalks-and-roundabouts-slide-04': {
        body: p(
          'A white cane or guide dog is an important clue.',
          'Stop and stay quiet.',
          'A white cane or an assistance animal tells you that a pedestrian may rely on traffic sounds and predictable vehicle movement.',
          'Texas requires every necessary precaution, including a full stop when that is the only way to avoid danger.',
          'Do not use the horn to invite the person across, and do not stop so close that engine noise is misleading.',
          'Remain still until the person is safely clear of your path.',
        ),
      },
      'ca-crosswalks-and-roundabouts-slide-06': {
        body: p(
          'Slow before the entry.',
          'Choose a safe gap and enter in the correct direction.',
          'Enter heading to the right of the central island.',
          'Inside, everyone moves counterclockwise — do not stop or pass.',
          'Missed your exit? Circle around once more.',
          'Every roundabout approach in Texas carries a YIELD sign, so entering traffic yields to traffic already circulating.',
          'Slow, read the signs and lane arrows, choose the lane before entry, and enter only into a usable gap.',
          'Signal the exit when required.',
        ),
      },
    },
    recalls: {
      'ca-crosswalks-and-roundabouts-recall-01': {
        context: 'Recall · Unmarked crosswalks',
        rule: 'A crosswalk can be [[unmarked]] — at an intersection, pedestrian right-of-way still applies.',
      },
      'ca-crosswalks-and-roundabouts-recall-02': {
        context: 'Recall · Crosswalks and circles',
        rule: 'Never pass a vehicle [[stopped]] at a crosswalk. Entering a roundabout, yield to traffic [[already inside]].',
      },
    },
    tests: [
      { ca: 'q01' },
      {
        prompt: 'A pedestrian is crossing at an unmarked crosswalk at an intersection with no signal. What is your duty?',
        choices: ['Stop and yield, and use due care', 'Sound the horn and continue', 'Yield only if the crosswalk is painted'],
        correct: 0,
        explanation: 'An unmarked crosswalk exists at every intersection; where no signal is operating, a driver must stop and yield to a pedestrian on the driver’s half of the road or approaching closely from the other half.',
      },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'Who yields at a roundabout entrance in Texas?',
        choices: ['Entering traffic', 'Traffic already circulating', 'Whoever is on the right'],
        correct: 0,
        explanation: 'YIELD signs control every roundabout approach; the circulating roadway is never yield-controlled.',
      },
      {
        prompt: 'A pedestrian with a white cane is stepping into the crosswalk ahead. What does Texas law require?',
        choices: ['Take every precaution, including a full stop if needed', 'Slow down and steer around the person', 'Sound the horn so the person waits'],
        correct: 0,
        explanation: 'A driver must take necessary precautions to avoid endangering a pedestrian with a white cane or assistance animal and must come to a full stop if that is the only way to avoid danger.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-complex-intersections': {
    visuals: ['tx-signals-q02-asset', 'tx-turns-signals-q04-asset', 'tx-turns-signals-q03-asset'],
    challenge: {
      scenario: 'You wait to turn left. Your signal shows a flashing yellow arrow, and oncoming traffic keeps coming.',
      prompt: 'What should you do?',
      choices: ['Turn now — the arrow allows it', 'Yield to oncoming traffic, then turn when clear', 'Stop and wait for a green arrow'],
      correct: 1,
      explanation: 'A flashing yellow arrow allows the turn only after you yield. It is not a protected turn.',
    },
    cards: {
      'ca-complex-intersections-slide-01': {
        body: p(
          'A big intersection can show several signal heads at once.',
          'Find the one over your lane before anything else.',
          'A circular light speaks to everyone moving in that direction.',
          'An arrow speaks only to the turn it points at.',
          'Signs on the corner can add or remove options.',
        ),
      },
      'ca-complex-intersections-slide-02': {
        body: p(
          'A green arrow means a protected turn.',
          'Oncoming traffic is held by a red light.',
          'You still stop for pedestrians lawfully in the crosswalk you cross.',
          'A green circle makes a different offer.',
          'You may turn, but you must yield to oncoming traffic and pedestrians first.',
          'Same direction, very different duties.',
        ),
      },
      'ca-complex-intersections-slide-03': {
        body: p(
          'A steady yellow arrow means your protected time is ending.',
          'Already in the intersection? Complete the turn with care.',
          'A flashing yellow arrow never protects you.',
          'Turn only after yielding to oncoming traffic, and watch for people crossing.',
        ),
      },
      'ca-complex-intersections-slide-04': {
        body: p(
          'A red arrow means stop for that turn and wait.',
          'Do not enter the intersection while it shows.',
          'Texas treats the arrow like a red light: after a full stop, a right turn, or a left between one-way streets, may be allowed unless a sign prohibits it.',
          'A NO TURN ON RED sign is common next to a red arrow.',
          'Look for the sign before assuming anything, and when in doubt, wait for a green indication.',
        ),
      },
      'ca-complex-intersections-slide-05': {
        body: p(
          'Turns have a home lane on both ends.',
          'Right turns start near the right edge and end there.',
          'Do not swing wide.',
          'Texas law says a left turn must end in a lane lawfully open to your direction.',
          'Choose the one nearest the middle so nobody has to cross your path.',
          'Between one-way streets, hug the left curb into the turn.',
        ),
      },
      'ca-complex-intersections-slide-06': {
        body: p(
          'Some right turns get a dedicated lane behind an island.',
          'It does not merge with through traffic.',
          'You may keep moving even when the through lanes face a red light.',
          'Obey the lane’s own YIELD sign or signal, and always stop for pedestrians in its crosswalk.',
        ),
      },
    },
    recalls: {
      'ca-complex-intersections-recall-01': {
        context: 'Recall · Flashing yellow arrow',
        rule: 'A flashing yellow arrow means turn only after [[yielding]] — the turn is not [[protected]].',
      },
      'ca-complex-intersections-recall-02': {
        context: 'Recall · Red arrow',
        rule: 'At a red arrow, [[stop]]. Turn on red only if no sign prohibits it, after yielding; with a NO TURN ON RED sign, wait for [[green]].',
      },
      'ca-complex-intersections-recall-03': {
        context: 'Recall · Finishing lane',
        rule: 'Right turns begin and end near the [[right edge]]; a left turn ends in a lane open to your [[direction]] — nearest the middle is safest.',
      },
    },
    tests: [
      {
        prompt: 'Your left-turn signal changes from a green arrow to a steady yellow arrow while you are already inside the intersection. What should you do?',
        choices: ['Cautiously complete the turn', 'Stop where you are', 'Back up behind the stop line'],
        correct: 0,
        explanation: 'A steady yellow arrow warns that the protected movement is ending; a driver already in the intersection completes the turn with care.',
      },
      {
        prompt: 'You face a flashing yellow arrow for your left turn. A pedestrian is crossing the street you are turning into. What should you do?',
        choices: ['Yield to the pedestrian and oncoming traffic, then turn', 'Turn now — the arrow protects you', 'Sound the horn and turn quickly'],
        correct: 0,
        explanation: 'A flashing yellow arrow permits the turn only after yielding to pedestrians in the crosswalk and to oncoming traffic.',
      },
      {
        prompt: 'Your lane faces a steady red arrow and a NO TURN ON RED sign is posted. What should you do?',
        choices: ['Stop and wait for a green light or green arrow', 'Stop, then turn when clear', 'Turn without stopping if no one is coming'],
        correct: 0,
        explanation: 'A red arrow means stop for that movement, and a NO TURN ON RED sign removes any turn on red; wait for a green indication.',
      },
      {
        prompt: 'You turn left from a two-way street onto another two-way street. Where should the turn end?',
        choices: ['In a lane open to your direction, ideally the one nearest the center', 'In the lane nearest the right curb', 'In the oncoming lane until traffic clears'],
        correct: 0,
        explanation: 'Texas law requires the turn to end in a lane lawfully available to your direction; taking the one nearest the center keeps you from crossing other drivers’ paths.',
      },
      {
        prompt: 'A dedicated right-turn lane curves behind an island. The through lanes face a red light. What should you do?',
        choices: ['Keep moving under the lane’s own sign or signal, yielding to pedestrians', 'Stop and wait with the through lanes', 'Merge into the through lane first'],
        correct: 0,
        explanation: 'A channelized turn lane is controlled by its own YIELD sign or signal, not by the through lanes’ light; pedestrians in its crosswalk still come first.',
      },
      {
        prompt: 'A green circle — not an arrow — faces you as you wait to turn left. What should you do?',
        choices: ['Turn only after yielding to oncoming traffic and pedestrians', 'Turn immediately — green means go', 'Wait for a green arrow'],
        correct: 0,
        explanation: 'A circular green permits the left turn but does not protect it; you must yield to oncoming traffic close enough to be a hazard and to pedestrians in the crosswalk.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-u-turns-starting-backing': {
    visuals: [null, 'tx-uturn-backing-asset-03', 'tx-uturn-backing-q01-asset'],
    keyPoints: ['Look around before moving.', 'Back at walking speed.', 'Check every turnaround condition.'],
    cards: {
      'ca-u-turns-starting-backing-slide-02': {
        body: p(
          'Look in the direction you are moving.',
          'Stop when the view becomes uncertain.',
          'Texas allows backing only when it can be done safely and without interfering with other traffic.',
          'Never back on the shoulder or roadway of a freeway or other controlled-access highway.',
          'Check behind, beside, and for small road users hidden below the windows.',
          'Move slowly enough to stop immediately if the scene changes.',
        ),
      },
      'ca-u-turns-starting-backing-slide-03': {
        scope: 'state_specific',
        body: p(
          'A lens can miss low, close, or side hazards.',
          'Use it as one tool, not the only tool.',
          'At a signal, a U-turn is allowed on a circular green unless a sign prohibits it, and it begins from the far-left lawful lane.',
          'Texas has no separate business-district U-turn rule; the sign, the signal, and the view decide.',
          'A red light means no U-turn at all.',
        ),
      },
      'ca-u-turns-starting-backing-slide-04': {
        body: p(
          'Yield to people before entering the road.',
          'Then find a safe traffic gap.',
          'Leaving a driveway or alley in a business or residence district, stop before the sidewalk area and yield to the people on it.',
          'A driver entering the road from any driveway, alley, or private road yields to approaching traffic.',
          'A parked car may not move until the movement can be made safely, and you must signal before pulling out.',
        ),
      },
      'ca-u-turns-starting-backing-slide-05': {
        body: p(
          'Check signs, lane position, traffic, and visibility.',
          'Possible does not always mean legal.',
          'Texas allows a U-turn unless a sign, signal, or local rule prohibits it, and you yield to oncoming traffic as for a left turn.',
          'A U-turn can look physically possible and still be illegal because of a NO U-TURN sign, a curve, a hill, or the traffic around you.',
          'Backing has the same underlying rule: begin only when the movement can be made safely.',
        ),
      },
      'ca-u-turns-starting-backing-slide-06': {
        title: 'Texas uses a 500-foot visibility test',
        body: p(
          'Never turn around near a curve or the crest of a hill unless drivers 500 feet away in both directions can see you.',
          'Other location rules can still prohibit the turn.',
          'On a freeway frontage road, use the turnaround lane under the overpass instead; a Turnaround ONLY sign marks it.',
          'It lets you reverse direction without crossing the intersection.',
          'Meeting the visibility test does not cancel a posted prohibition.',
        ),
      },
      'ca-u-turns-starting-backing-slide-07': {
        title: 'Signs and signals add limits',
        body: p(
          'Read the exact location in the question.',
          'Do not apply one U-turn rule everywhere.',
          'Do not reduce turnaround questions to a single 500-foot number.',
          'A NO U-TURN sign settles the matter, and a red light means no U-turn at all.',
          'The exam may change the location, the signal, the visibility, or the presence of a sign.',
        ),
      },
    },
    recalls: {
      'ca-u-turns-starting-backing-recall-01': {
        context: 'Recall · Turnaround visibility',
        rule: 'Near a curve or hill crest, turn around only if drivers [[500 feet]] away in both directions can see you.',
      },
      'ca-u-turns-starting-backing-recall-02': {
        context: 'Recall · Freeway backing',
        rule: 'Never back on the [[shoulder]] or roadway of a freeway — ever.',
      },
    },
    tests: [
      {
        prompt: 'You want to turn around just before a hill crest. Drivers coming over the crest could not see you until they were 300 feet away. Is the turn allowed?',
        choices: ['No, drivers within 500 feet must be able to see you', 'Yes, if you signal first', 'Yes, because you are below the crest'],
        correct: 0,
        explanation: 'Texas prohibits turning around near a curve or hill crest when the vehicle cannot be seen by drivers approaching from either direction within 500 feet.',
      },
      {
        prompt: 'You wait at a signal in the far-left lane and the light turns circular green with no sign about U-turns. May you make a U-turn?',
        choices: ['Yes, after yielding to oncoming traffic and pedestrians', 'No, a U-turn needs a green arrow', 'Only in a business district'],
        correct: 0,
        explanation: 'A circular green permits a U-turn from the far-left lawful lane unless a sign or signal prohibits it; the turn still yields like a left turn.',
      },
      {
        prompt: 'A NO U-TURN sign faces you at the intersection, but the road is empty. May you make the U-turn?',
        choices: ['No, the sign prohibits it', 'Yes, if no vehicle is within 500 feet', 'Yes, on a green light'],
        correct: 0,
        explanation: 'A posted prohibition controls regardless of traffic; an empty road does not cancel the sign.',
      },
      {
        prompt: 'Where may you never back your vehicle in Texas?',
        choices: ['On the shoulder or roadway of a freeway', 'In a parking lot aisle', 'Out of a residential driveway'],
        correct: 0,
        explanation: 'Backing on the shoulder or roadway of a limited-access or controlled-access highway is prohibited; elsewhere it must be done safely and without interfering with traffic.',
      },
      {
        prompt: 'Before moving a parked car from the curb, what does Texas law require?',
        choices: ['Signal and confirm the movement can be made safely', 'Sound the horn twice', 'Wait for a gap of at least 500 feet'],
        correct: 0,
        explanation: 'A stopped, standing, or parked vehicle may not begin moving unless the movement can be made safely, and the driver must signal before starting from a parked position.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-parking-and-curbs': {
    visuals: [null, 'tx-uturn-backing-asset-02', 'tx-regulatory-signs-q03-asset'],
    keyPoints: ['Read the signs.', 'Secure the car on hills.', 'Leave the curb safely.'],
    challenge: {
      scenario: 'You park downhill beside a curb.',
      prompt: 'Where should the front wheels point?',
      choices: ['Toward the curb', 'Away from the curb', 'Straight ahead'],
      correct: 0,
      explanation: 'On a grade Texas law has you turn the front wheels to the curb, so a rolling car is caught before it reaches traffic.',
    },
    cards: {
      'ca-parking-and-curbs-slide-01': {
        body: p(
          'A perfect parking move is still illegal in a prohibited spot.',
          'Read the signs first; Texas has no statewide curb-color code.',
          'Double parking — waiting in the road beside a parked car — is on the never list, even briefly.',
          'Stay at least 15 feet from a fire hydrant except for a moment to let a passenger in or out.',
          'Posted local time limits still control how long you may park.',
        ),
      },
      'ca-parking-and-curbs-slide-03': {
        body: p(
          'Texas requires parking within 18 inches of the curb.',
          'One-way roads allow either side.',
          'On a two-way road, park with the right wheels parallel to and within 18 inches of the right curb or edge.',
          'On a one-way road you may use either curb, facing the direction of traffic, unless a local rule says otherwise.',
          'Before leaving, stop the engine, lock the ignition, remove the key, and set the parking brake.',
        ),
      },
      'ca-parking-and-curbs-slide-04': {
        body: p(
          'Set the parking brake.',
          'Use Park or the correct gear before leaving.',
          'Texas lists the places where stopping, standing, or parking is prohibited outright.',
          'They include sidewalks, crosswalks, intersections, bridges and tunnels, railroad tracks, and any spot where a sign prohibits stopping.',
          'Standing is also barred in front of a driveway and near hydrants, crosswalks, and roadside signs and signals.',
        ),
      },
      'ca-parking-and-curbs-slide-05': {
        body: p(
          'With a curb, turn the wheels so the curb can stop the car.',
          'Without a curb, turn toward the road edge.',
          'Wheel direction is only one part of hill parking.',
          'Texas law requires the parking brake and, on a grade, front wheels turned to the curb or side of the highway.',
          'Downhill, point them toward the curb; uphill beside a curb, turn them away so the tire rests against it.',
          'Before pulling out, signal and check traffic and blind spots.',
        ),
      },
      'ca-parking-and-curbs-slide-06': {
        body: p(
          'In Texas, keep at least 15 feet of space from a fire hydrant.',
          'The only exception is a momentary stop to pick up or drop off a passenger.',
          'The same rule keeps you 20 feet from a crosswalk at an intersection and 30 feet before a roadside stop sign, yield sign, or signal.',
          '“I will be quick” does not erase a prohibited stopping place.',
          'The law regulates standing even when the driver stays in the car.',
        ),
      },
      'ca-parking-and-curbs-slide-07': {
        body: p(
          'Use them only with a valid disabled placard or plate.',
          'Keep access aisles clear.',
          'Parking rules protect sight lines, access, traffic flow, and people who must cross or open doors.',
          'Solve them by checking the place, the measured clearance, the posted sign, the vehicle position, and the safe exit.',
        ),
      },
      'ca-parking-and-curbs-slide-08': {
        body: p(
          'Signal.',
          'Check mirrors and blind spots.',
          'Enter only when the gap is safe.',
          'Texas law lets you open a door toward moving traffic only when it is reasonably safe, and only for as long as loading takes.',
          'Check for bicycles and motorcycles before exiting.',
          'Outside a business or residence district, stay off the main traveled part of the highway unless there is no alternative and the car is visible for 200 feet each way.',
        ),
      },
    },
    recalls: {
      'ca-parking-and-curbs-recall-01': {
        context: 'Recall · Parking distances',
        rule: 'Park within [[18 inches]] of the curb and at least [[15 feet]] from a fire hydrant.',
      },
      'ca-parking-and-curbs-recall-03': {
        context: 'Recall · Double parking',
        rule: 'Stopping in the road beside a parked car is [[double parking]] — [[illegal]], even briefly.',
      },
    },
    tests: [
      {
        prompt: 'The only open curb space is 10 feet from a fire hydrant. May you park there?',
        choices: ['No, you must stay at least 15 feet away', 'Yes, if you leave the flashers on', 'Yes, if the curb is not painted'],
        correct: 0,
        explanation: 'Standing or parking within 15 feet of a fire hydrant is prohibited; only a momentary stop to pick up or drop off a passenger is allowed.',
      },
      { ca: 'q02' },
      {
        prompt: 'How close to the curb must a parallel-parked vehicle be in Texas?',
        choices: ['Within 18 inches', 'Within 3 feet', 'Touching the curb'],
        correct: 0,
        explanation: 'The wheels on the curb side must be parallel to and within 18 inches of the curb or edge of the roadway.',
      },
      {
        prompt: 'Who may park in a space marked with the accessibility symbol?',
        choices: ['A vehicle displaying a valid disabled-person placard or plate', 'Anyone stopping for less than 10 minutes', 'Any vehicle with hazard lights on'],
        correct: 0,
        explanation: 'Accessible spaces are reserved for vehicles showing a valid disabled placard or plate, and the striped access aisle beside them must stay clear.',
      },
      {
        prompt: 'What must you check before opening a street-side door?',
        choices: ['That it can be opened in reasonable safety without interfering with traffic, including bicycles', 'Only that the engine is off', 'Only that a passenger is waiting'],
        correct: 0,
        explanation: 'Texas law allows a door toward moving traffic to be opened only when it is reasonably safe and without interfering with traffic, and not left open longer than loading requires.',
      },
      { ca: 'q06' },
    ],
  },
};
