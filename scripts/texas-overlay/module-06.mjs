// Texas overlay · Module 6 · When Driving Gets Hard
// Facts: TX_TN_547_302_LIGHTS_REQUIRED, TX_TN_547_333_DIM_HIGH_BEAMS, TX_TN_545_351_REASONABLE_PRUDENT_SPEED,
// TX_TMUTCD_2C_34_WEATHER_SIGNS, TX_TN_545_058_IMPROVED_SHOULDER, TX_TN_550_021_022_CRASH_DUTIES,
// TX_TN_550_023_INFORMATION_AND_AID, TX_TN_550_024_025_UNATTENDED_VEHICLE_PROPERTY, TX_TN_550_026_IMMEDIATE_REPORT,
// TX_TN_550_062_OFFICER_REPORT, TX_TN_601_051_072_FINANCIAL_RESPONSIBILITY.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-driving-after-dark': {
    visuals: ['tx-signals-q03-asset', 'tx-regulatory-signs-q04-asset', 'tx-warning-guide-signs-q05-asset'],
    cards: {
      'ca-driving-after-dark-slide-01': {
        body: p(
          'They do more than light the road.',
          'Texas requires them whenever a person or vehicle cannot be clearly seen 1,000 feet ahead — in rain, fog, dust, or smoke, not only at night.',
          'Never drive faster than is reasonable for darkness, fog, smoke, rain, glare, or traffic.',
          'Keep stopping distance within the visible usable path.',
          'If you cannot see enough road to stop safely, reduce speed further or leave the roadway at a safe place.',
        ),
      },
      'ca-driving-after-dark-slide-02': {
        body: p(
          'In Texas, headlights go on 30 minutes after sunset and stay on until 30 minutes before sunrise.',
          'That is how the law defines nighttime.',
          'The clock applies even when the sky still looks bright.',
          'An exam answer like “only when it is fully dark” is wrong.',
        ),
      },
      'ca-driving-after-dark-slide-04': {
        body: p(
          'Dim within 500 feet of an approaching vehicle.',
          'Dim within 300 feet when following.',
          'Texas law names both numbers: low beams for an oncoming vehicle within 500 feet, and no high beams behind another vehicle within 300 feet.',
          'Looking toward the right edge can reduce glare from an oncoming driver, but you must still hold your lane and a speed that fits what you can see.',
        ),
      },
    },
    recalls: {
      'ca-driving-after-dark-recall-02': {
        context: 'Recall · Headlight hours',
        rule: 'Headlights on from [[30 minutes]] after sunset until 30 minutes before [[sunrise]] — and whenever you cannot see 1,000 feet ahead.',
      },
      'ca-driving-after-dark-recall-03': {
        context: 'Recall · High beams',
        rule: 'Dim within [[500 feet]] of an approaching vehicle and within [[300 feet]] when following.',
      },
    },
    tests: [
      { ca: 'q01' },
      {
        prompt: 'When following another vehicle, within what distance must you switch off your high beams in Texas?',
        choices: ['300 feet', '500 feet', '100 feet'],
        correct: 0,
        explanation: 'A driver approaching a vehicle from the rear within 300 feet may not use the high beam.',
      },
      {
        prompt: 'When should you dim your high beams for an approaching car?',
        choices: ['Within 500 feet', 'Within 300 feet', 'Only when the other driver flashes'],
        correct: 0,
        explanation: 'Texas requires the low beam when approaching an oncoming vehicle within 500 feet.',
      },
      { ca: 'q04' },
      { ca: 'q05' },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-weather-and-mountain-roads': {
    title: 'Rain, Fog, Heat, and Flooded Roads',
    summary: 'Bad conditions reduce the grip and visibility you normally trust.',
    keyPoints: ['Slow before traction disappears.', 'Use low beams in fog.', 'Turn around at flooded roads.'],
    visuals: ['tx-markings-q03-asset', 'tx-warning-guide-signs-asset-01', 'tx-uturn-backing-q01-asset'],
    cards: {
      'ca-weather-and-mountain-roads-slide-01': {
        body: p(
          'Rain reduces visibility as well as tire grip.',
          'Your tires also have less grip.',
          'Bridges and overpasses ice over before the road around them.',
          'Shaded patches freeze first and dry out last.',
          'After deep water, brakes can go soft — dry them by pressing brake and accelerator lightly at the same time.',
          'Texas law tells you to slow for any special hazard from weather or road conditions.',
          'If hydroplaning begins, ease speed down progressively and avoid abrupt braking or steering.',
        ),
      },
      'ca-weather-and-mountain-roads-slide-02': {
        body: p(
          'Sun glare, dust, snow, flooding, or strong wind can remove your normal safety margin.',
          'Slow smoothly and increase following distance.',
          'Use lane markings or the right road edge as a guide without staring at oncoming lights.',
          'If you cannot see well enough to drive, leave the roadway at a safe place and wait.',
          'In poor conditions, make these three changes:',
        ),
        bullets: ['Brake earlier.', 'Turn gently.', 'Leave a larger following gap.'],
      },
      'ca-weather-and-mountain-roads-slide-03': {
        body: p(
          'High beams reflect light back.',
          'Use low beams and reduce speed.',
          'Texas law requires headlights whenever you cannot see 1,000 feet ahead, so fog and heavy rain switch them on by day.',
          'Never drive into unknown water.',
          'Depth and current are hard to judge.',
          'Heat can hurt the vehicle.',
          'Watch tires, temperature, and warning lights.',
          'Never leave a child in a parked car.',
        ),
      },
      'ca-weather-and-mountain-roads-slide-04': {
        title: 'Flooded roads: turn around',
        body: p(
          'Expect trucks, trailers, bicycles, and debris to shift in wind.',
          'Hold space on both sides.',
          'Texas posts ROAD MAY FLOOD and WATER CROSSING signs where low places go under water.',
          'A WHEN FLOODED TURN AROUND DON’T DROWN sign, often with a depth gauge, marks a crossing that can sweep a car away.',
          'Water over the road hides its depth, its current, and whether the pavement is still there.',
          'Turn around and find another route.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      {
        prompt: 'What control style is safest when traction is reduced?',
        choices: ['Smooth and progressive', 'Quick and firm', 'Braking only while turning'],
        correct: 0,
        explanation: 'Reduced grip calls for earlier, gentler braking, steering, and acceleration so the tires are never asked for more than they can give.',
      },
      { ca: 'q04' },
      { ca: 'q05' },
      {
        prompt: 'Water is flowing across the road ahead at a low crossing. What should you do?',
        choices: ['Turn around and use another route', 'Cross slowly in a low gear', 'Follow the vehicle ahead through it'],
        correct: 0,
        explanation: 'Depth and current cannot be judged from the driver’s seat and the pavement may be gone; Texas signs the message plainly: when flooded, turn around, don’t drown.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-skids-and-emergencies': {
    visuals: [null, 'tx-uncontrolled-intersections-asset-03', 'tx-markings-q02-asset'],
    cards: {
      'ca-skids-and-emergencies-slide-07': {
        body: p(
          'Pull fully away from traffic.',
          'Use hazards and stay protected when possible.',
          'Texas lets you use the paved shoulder to avoid a collision and to stop when a stop is necessary and safe.',
          'When a collision threat develops, reduce speed and choose the path that preserves control while protecting people.',
          'An empty shoulder may be better than a crowded lane; a controlled impact may be better than a violent swerve into pedestrians or opposing traffic.',
        ),
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      { ca: 'q03' },
      { ca: 'q04' },
      {
        prompt: 'What guides the last-second escape choice when a crash seems unavoidable?',
        choices: ['Protecting people while preserving control', 'Reaching the highest speed first', 'Closing your eyes and braking'],
        correct: 0,
        explanation: 'Keep control, reduce speed, and aim for the path with the least severe consequences for people; the shoulder is a lawful escape route to avoid a collision.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-crashes-and-insurance': {
    keyPoints: ['Stop and protect the scene.', 'Exchange required information.', 'Report when the law requires it.'],
    visuals: [null, 'tx-uncontrolled-intersections-q04-asset', 'tx-turns-signals-q01-asset'],
    challenge: {
      scenario: 'A crash causes an injury.',
      prompt: 'What is the first priority?',
      choices: ['Leave before traffic builds', 'Stop and get help', 'Call the insurance company first'],
      correct: 1,
      explanation: 'Texas law: stop, check who needs aid, get emergency help, and stay at the scene.',
    },
    cards: {
      'ca-crashes-and-insurance-slide-01': {
        body: p(
          'Do not leave the scene.',
          'Move out of traffic when the law and safety allow.',
          'A collision scene can create a second crash.',
          'Texas requires you to stop at the scene or as close as possible, return if you stopped elsewhere, and remain until your duties are done.',
          'Leaving an injury crash is a felony.',
          'Call emergency services for injuries or immediate danger.',
        ),
      },
      'ca-crashes-and-insurance-slide-02': {
        body: p(
          'Call 911 for injury or immediate danger.',
          'Give reasonable help without creating another hazard.',
          'A collision creates several separate duties: protect people, stop, give information, render aid, and notify police when the law requires.',
          'Texas law names the check: find out whether anyone involved needs aid.',
          'Police, insurance, and later paperwork are not interchangeable.',
        ),
      },
      'ca-crashes-and-insurance-slide-03': {
        body: p(
          'Share identification, vehicle, and insurance details.',
          'Stay calm and factual.',
          'Texas requires your name and address, the vehicle’s registration number, and the name of your insurer.',
          'Show your driver license when asked.',
          'Give reasonable help to anyone injured, including arranging transport to a doctor or hospital when treatment is clearly needed or requested.',
        ),
      },
      'ca-crashes-and-insurance-slide-04': {
        body: p(
          'Leave the required notice.',
          'Texas spells out what it must say.',
          'After hitting an unattended vehicle, stop and find its owner, or attach a written notice with your name, your address, the owner’s name and address, and what happened.',
          'Damage a fence, sign, or landscaping? Take reasonable steps to notify the owner.',
          'Leaving because the damage looks small can turn a crash into a failure-to-stop offense.',
        ),
      },
      'ca-crashes-and-insurance-slide-05': {
        title: 'Police notice, not a driver report',
        body: p(
          'Texas uses one police notice, not a separate driver report.',
          'Check every trigger.',
          'Notify police immediately, by the quickest means, when someone is injured or killed, or when a vehicle can no longer be driven normally and safely.',
          'Exchange the required driver, vehicle, and insurance details.',
          'Texas no longer asks drivers to file their own crash report; the investigating officer files one for injury, death, or $1,000 in damage.',
        ),
      },
      'ca-crashes-and-insurance-slide-06': {
        title: 'Freeway crashes: clear the lanes',
        body: p(
          'On a freeway in a metropolitan area, Texas law tells you to move a drivable car off the main lanes.',
          'Use a crash investigation site, the frontage road, or the nearest suitable cross street.',
          'Then exchange information there.',
          'Keep the reporting duties separate:',
        ),
        bullets: [
          'Injury, death, or an undrivable vehicle: notify police immediately.',
          'Damage only and everyone present: exchange information; no state report from you.',
        ],
      },
      'ca-crashes-and-insurance-slide-07': {
        body: p(
          'Document the scene when safe.',
          'Notify the insurer and keep records.',
          'Do not confuse the police notice with an insurance claim.',
          'The immediate notice goes to the local police, the sheriff, or the nearest Department of Public Safety office, depending on where the crash happened.',
          'Your insurer has its own claim process and deadlines.',
        ),
      },
      'ca-crashes-and-insurance-slide-08': {
        body: p(
          'Drivers must be able to establish financial responsibility.',
          'Texas sets minimum liability limits of $30,000 for one person’s injury or death, $60,000 for two or more, and $25,000 for property damage.',
          'Carry proof, on paper or on your phone, and show it to an officer or to the other driver.',
          'Driving without it costs $175 to $350 the first time.',
          'After a collision, keep these actions in order:',
        ),
        bullets: ['Stop.', 'Protect.', 'Help.', 'Exchange.', 'Notify.'],
      },
    },
    recalls: {
      'ca-crashes-and-insurance-recall-01': {
        context: 'Recall · After a crash',
        rule: 'Stop, check [[people]] first, exchange [[information]] — never leave the scene.',
      },
      'ca-crashes-and-insurance-recall-02': {
        context: 'Recall · Police notice',
        rule: 'Injury, death, or a car that cannot be driven? Notify police [[immediately]] by the quickest means.',
      },
      'ca-crashes-and-insurance-recall-03': {
        context: 'Recall · Insurance minimums',
        rule: 'Texas minimum liability: [[$30,000]] per person, $60,000 per crash, and [[$25,000]] property damage.',
      },
    },
    tests: [
      {
        prompt: 'You back into a parked, unattended car and its owner is nowhere to be found. What must you do?',
        choices: ['Stop and leave a written notice with your name and address and what happened, securely attached in plain sight', 'Leave, since no one was hurt', 'Wait only for an insurance agent'],
        correct: 0,
        explanation: 'Texas requires a driver who hits an unattended vehicle to stop and either find the owner or leave a conspicuous written notice giving the driver’s and owner’s names and addresses and a statement of the circumstances.',
      },
      {
        prompt: 'What is the minimum property-damage liability coverage in the Texas 30/60/25 set?',
        choices: ['$25,000', '$30,000', '$60,000'],
        correct: 0,
        explanation: 'Texas requires at least $30,000 per person, $60,000 per collision for injury or death, and $25,000 for property damage.',
      },
      {
        prompt: 'You damage a roadside fence and no one is around. What does Texas require?',
        choices: ['Take reasonable steps to find and notify the owner, giving your name, address, and registration number', 'Nothing, because a fence is not a vehicle', 'Report it only to your insurer'],
        correct: 0,
        explanation: 'A driver who damages only a structure, fixture, or landscaping beside the road must take reasonable steps to locate and notify the owner and show a license on request.',
      },
      {
        prompt: 'A collision leaves one driver injured. When must police be notified in Texas?',
        choices: ['Immediately, by the quickest means', 'Within 24 hours', 'Within 10 days'],
        correct: 0,
        explanation: 'A crash involving injury or death, or a vehicle that cannot be driven safely, must be reported immediately to the local police, the sheriff, or the nearest Department of Public Safety office.',
      },
      {
        prompt: 'A minor crash on a Houston freeway leaves both cars drivable. What does Texas law require?',
        choices: ['Move the cars off the main lanes to a safe location, then exchange information', 'Stay exactly where the cars stopped until police arrive', 'Leave a note on the other car and go'],
        correct: 0,
        explanation: 'On a freeway in a metropolitan area, drivable vehicles must move to a crash investigation site, the frontage road, or the nearest suitable cross street before information is exchanged.',
      },
      {
        prompt: 'After a damage-only crash where both drivers are present, must you file your own crash report with the state?',
        choices: ['No, Texas has no driver-filed crash report; exchange information and notify police only when the law requires it', 'Yes, within 10 days', 'Yes, within 24 hours'],
        correct: 0,
        explanation: 'Texas drivers exchange information at the scene and notify police immediately for injury, death, or an undrivable vehicle; the investigating officer files any written report.',
      },
    ],
  },
};
