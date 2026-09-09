// Texas overlay · Module 7 · The Driver and the Vehicle
// Facts: TX_TN_545_4251_TEXTING_BAN, TX_TN_545_425_SCHOOL_CROSSING_ZONE_PHONES, TX_TN_545_424_UNDER_18_RESTRICTIONS,
// TX_TN_545_401_RECKLESS_DRIVING, TX_TN_547_611_VIDEO_DISPLAYS, TX_PE_49_01_04_DWI, TX_PE_49_031_OPEN_CONTAINER,
// TX_AL_106_041_MINOR_DUI, TX_TN_724_011_035_IMPLIED_CONSENT_REFUSAL, TX_TN_524_022_ALR_SUSPENSION,
// TX_TN_545_413_SAFETY_BELTS, TX_TN_545_412_CHILD_SAFETY_SEATS, TX_TN_545_414_OPEN_TRUCK_BEDS,
// TX_HANDBOOK_CHILD_LEFT_IN_VEHICLE, TX_TN_547_EQUIPMENT_BASICS, TX_TN_545_417_VIEW_OBSTRUCTION,
// TX_TN_547_382_PROJECTING_LOADS.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-distraction-and-fatigue': {
    visuals: [null, 'tx-turns-signals-q01-asset', 'tx-signals-q03-asset'],
    cards: {
      'ca-distraction-and-fatigue-slide-03': {
        title: 'Texas bans texting behind the wheel',
        body: p(
          'Reading, writing, or sending an electronic message while the vehicle is moving is against the law.',
          'Stopped at a light? The ban lifts, but the light will change.',
          'Hands-free use, GPS navigation, and calling for emergency help are allowed.',
          'In a school crossing zone, any handheld phone use is illegal unless you are stopped.',
          'Watch for the sign at the zone entrance.',
        ),
      },
      'ca-distraction-and-fatigue-slide-04': {
        body: p(
          'Texas prohibits any wireless device use by a driver under 18, even hands-free.',
          'The only exception is an emergency.',
          'A driver under 18 also may not drive between midnight and 5 a.m. except for work, a school activity, or a medical emergency.',
          'No more than one passenger under 21 who is not family may ride along.',
          'Do not borrow the adult hands-free rule for a minor-driver question.',
        ),
      },
      'ca-distraction-and-fatigue-slide-05': {
        scope: 'state_specific',
        body: p(
          'Heavy eyes, missed signs, and drifting are warnings.',
          'Coffee may increase alertness briefly, but it does not replace sleep.',
          'Texas allows an adult to hold a phone for a call outside a school crossing zone, but a legal call still takes attention from the road.',
          'Hands-free is the safer habit everywhere, and it is the law in school crossing zones.',
          'Holding the phone at a red light to read a message is legal only while stopped; the light will change.',
        ),
      },
      'ca-distraction-and-fatigue-slide-07': {
        scope: 'universal',
        body: p(
          'Do not chase, block, stare, or argue.',
          'Create distance and call for help if threatened.',
          'Legal use is not safe attention.',
          'The exam may describe a hands-free call but then add reading, typing, video, a school crossing zone, or a driver under 18 — facts that change the answer.',
        ),
      },
      'ca-distraction-and-fatigue-slide-06': {
        body: p(
          'Leave the road at a safe place.',
          'Rest or change drivers.',
          'Texas law keeps video screens out of the driver’s sight unless the car is in Park or the parking brake is set.',
          'Stop the trip when fatigue prevents timely decisions.',
          'Reckless driving means wilful or wanton disregard for safety; it carries a fine, jail time up to 30 days, or both.',
        ),
      },
      'ca-distraction-and-fatigue-slide-08': {
        body: p(
          'Angry, sick, dizzy, or exhausted? Do not drive until you can focus.',
          'Illness, strong emotion, poor sleep, vision changes, and medicine can reduce judgment or reaction.',
          'Read medicine warnings and ask a professional when effects are unclear.',
          'Do not drive when drowsy, dizzy, angry, or unable to focus.',
          'Keep both ears free to hear sirens, horns, and trains.',
        ),
      },
    },
    recalls: {
      'ca-distraction-and-fatigue-recall-01': {
        context: 'Recall · Phones for adults',
        rule: 'No reading, writing, or sending messages while [[moving]]. In a school crossing zone, [[hands-free]] only.',
      },
      'ca-distraction-and-fatigue-recall-02': {
        context: 'Recall · Under 18',
        rule: 'A driver under 18 may not use a phone while driving — even [[hands-free]] — except in an emergency.',
      },
    },
    tests: [
      {
        prompt: 'A long phone conversation needs your full attention while you drive. What is the safest way to handle it?',
        choices: ['Wait until you are safely parked', 'Hold the phone closer to the wheel', 'Continue because a call is legal for adults'],
        correct: 0,
        explanation: 'A call that is legal for an adult outside a school crossing zone still takes attention from driving; anything demanding waits until you are parked.',
      },
      {
        prompt: 'May an adult driver type a text message while moving in traffic in Texas?',
        choices: ['No, messaging while the vehicle is moving is prohibited', 'Yes, if the message is short', 'Yes, below 30 mph'],
        correct: 0,
        explanation: 'Texas bars reading, writing, or sending an electronic message while operating a motor vehicle unless it is stopped; hands-free and navigation use are exceptions.',
      },
      {
        prompt: 'You are driving through a signed school crossing zone. How may you use your phone?',
        choices: ['Only hands-free, or after stopping', 'Any way you like at low speed', 'Only for text messages'],
        correct: 0,
        explanation: 'In a school crossing zone a driver may not use a wireless communication device unless the vehicle is stopped or the device is hands-free.',
      },
      {
        prompt: 'May a 17-year-old make an ordinary hands-free call while driving in Texas?',
        choices: ['No', 'Yes, if the phone is mounted', 'Yes, on any call under one minute'],
        correct: 0,
        explanation: 'A driver under 18 may not use a wireless communication device while driving, handheld or hands-free, except in an emergency.',
      },
      {
        prompt: 'You are fighting sleep and missing roadway information. What is the correct response?',
        choices: ['Stop driving at a safe place', 'Open the windows and continue', 'Follow another car closely'],
        correct: 0,
        explanation: 'Fatigue removes the ability to make timely decisions; the only reliable fix is to stop and rest or change drivers.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-alcohol-drugs-dui': {
    keyPoints: ['Plan a sober ride.', 'Know the Texas DWI rules.', 'Treat medicine warnings seriously.'],
    visuals: [null, 'tx-regulatory-signs-q04-asset', 'tx-signals-q03-asset'],
    cards: {
      'ca-alcohol-drugs-dui-slide-03': {
        title: 'Texas defines intoxication two ways',
        body: p(
          'An alcohol concentration of 0.08 or more is intoxication by itself.',
          'So is losing the normal use of your mental or physical faculties from alcohol, a drug, or any combination — at any number.',
          'Drivers under 21 have no allowance at all.',
          'Match the rule to the driver:',
        ),
        bullets: [
          'Any adult: 0.08 or more, or lost normal faculties.',
          'Under 21: any detectable amount of alcohol is an offense.',
          'At 0.15 or more, the charge is a more serious misdemeanor.',
        ],
      },
      'ca-alcohol-drugs-dui-slide-08': {
        scope: 'universal',
        body: p(
          'Do not negotiate after impairment starts.',
          'DWI questions become easier when you separate impairment, the alcohol-concentration rule, chemical testing, and container rules.',
          'A number can prove a specific violation; it never guarantees that the person is safe to drive.',
        ),
      },
      'ca-alcohol-drugs-dui-slide-04': {
        body: p(
          'Legal purchase does not make impaired driving legal.',
          'Using cannabis with alcohol or another drug can increase impairment.',
          'Judgment, attention, vision, coordination, and reaction can worsen before a person notices.',
          'Coffee, food, a shower, or fresh air does not quickly remove alcohol.',
          'Texas counts any drug or controlled substance that takes away your normal faculties, even a legal one.',
          'Combining substances can make the effect stronger and less predictable.',
        ),
      },
      'ca-alcohol-drugs-dui-slide-05': {
        body: p(
          'Read warnings.',
          'Ask a professional when the effect is unclear.',
          'A first DWI in Texas is a Class B misdemeanor with at least 72 hours of confinement.',
          'An open container within the driver’s reach raises the minimum to six days.',
          'Driving intoxicated with a passenger under 15, or in a school crossing zone during its reduced limit, is a state jail felony.',
        ),
      },
      'ca-alcohol-drugs-dui-slide-06': {
        body: p(
          'Refusing a required test can create consequences separate from the DWI case.',
          'By driving in Texas, you consent to a breath or blood test after a lawful arrest for driving while intoxicated.',
          'Refuse, and your license is suspended for 180 days — two years with a prior alcohol or drug contact in the last 10 years.',
          'Fail the test, and an adult loses the license for 90 days on a first contact.',
        ),
      },
      'ca-alcohol-drugs-dui-slide-07': {
        body: p(
          'Keep alcohol out of the passenger area.',
          'Texas defines the passenger area as the seating space.',
          'A locked glove compartment, the trunk, or the space behind the last upright seat does not count.',
          'The trunk is the right place.',
          'The reliable plan is made before impairment starts.',
          'Choose a sober driver, transit, taxi, or rideshare.',
          'Never ride with a driver you believe is impaired.',
          'An open container is an offense even in a parked car on a public street.',
        ),
      },
    },
    recalls: {
      'ca-alcohol-drugs-dui-recall-01': {
        context: 'Recall · Intoxication',
        rule: 'Intoxicated: [[0.08]] or more, or lost normal faculties at any number. Under 21: [[any]] detectable alcohol is an offense.',
      },
      'ca-alcohol-drugs-dui-recall-02': {
        context: 'Recall · Open containers',
        rule: 'An open container never rides in the [[passenger area]]. A locked glove compartment or the [[trunk]] is outside it.',
      },
      'ca-alcohol-drugs-dui-recall-03': {
        context: 'Recall · Implied consent',
        rule: 'By driving in Texas, you consent to [[chemical testing]] after a lawful DWI arrest. Refusal costs the license for [[180 days]].',
      },
    },
    tests: [
      {
        prompt: 'A driver tests at 0.06 but cannot walk a straight line or focus. Can the driver be charged with DWI in Texas?',
        choices: ['Yes, losing normal faculties is intoxication regardless of the number', 'No, only 0.08 or more counts', 'Only if a passenger complains'],
        correct: 0,
        explanation: 'Texas defines intoxication as either an alcohol concentration of 0.08 or more or the loss of the normal use of mental or physical faculties from alcohol or drugs.',
      },
      { ca: 'q02' },
      {
        prompt: 'Which alcohol concentration is intoxication by itself for an adult driver in Texas?',
        choices: ['0.08', '0.15', '0.05'],
        correct: 0,
        explanation: 'An alcohol concentration of 0.08 or more is intoxication; 0.15 or more raises the charge to a Class A misdemeanor.',
      },
      {
        prompt: 'A driver refuses a breath test after a lawful DWI arrest. What is the license suspension for a first refusal?',
        choices: ['180 days', '30 days', 'One week'],
        correct: 0,
        explanation: 'Refusing a peace officer’s request for a specimen brings a 180-day suspension, or two years with a prior alcohol- or drug-related contact in the previous 10 years.',
      },
      {
        prompt: 'Where may an opened bottle of beer legally ride in a car on a Texas highway?',
        choices: ['In the trunk or a locked glove compartment', 'On the passenger seat', 'In a cup holder if the driver is sober'],
        correct: 0,
        explanation: 'An open container may not be in the passenger area; a locked glove compartment, the trunk, or the area behind the last upright seat is outside that area.',
      },
      {
        prompt: 'Can a legally prescribed medicine still make it illegal to drive in Texas?',
        choices: ['Yes, if it takes away the normal use of your faculties', 'No, a prescription is a complete defense', 'Only if it contains alcohol'],
        correct: 0,
        explanation: 'Texas defines intoxication to include losing the normal use of mental or physical faculties from a drug or any substance, prescribed or not.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-seat-belts-child-safety': {
    keyPoints: ['Buckle every occupant.', 'Use the correct child restraint.', 'Never leave a child in danger.'],
    visuals: [null, 'tx-uturn-backing-q04-asset', 'tx-warning-guide-signs-q02-asset'],
    cards: {
      'ca-seat-belts-child-safety-slide-01': {
        body: p(
          'Buckle before the car moves.',
          'Texas requires everyone 15 or older to wear a belt in any seat that has one, front or back.',
          'The driver is responsible for every passenger under 17.',
          'A short trip, low speed, or rear seat does not make an unrestrained occupant safe.',
        ),
      },
      'ca-seat-belts-child-safety-slide-04': {
        scope: 'state_specific',
        body: p(
          'Use a seat that fits the child and the manufacturer instructions.',
          'The back seat is generally safest.',
          'In Texas a child under 8 must ride in a child safety seat unless taller than 4 feet 9 inches.',
          'The system must fit the child and comply with the manufacturer’s limits.',
          'The law excepts vehicles for hire, emergencies, and a vehicle whose belted seats are all full; do not invent an exception from convenience.',
        ),
      },
      'ca-seat-belts-child-safety-slide-05': {
        title: 'Texas uses one age and one height',
        body: p(
          'Children under 8 need a child safety seat unless they are taller than 4 feet 9 inches.',
          'The seat must be used as its manufacturer directs.',
          'Use the rule that matches the child:',
        ),
        bullets: [
          'Under 8 and 4 feet 9 inches or shorter: a child safety seat or booster, per its instructions.',
          'Taller than 4 feet 9 inches, or 8 and older: a properly fitted safety belt.',
          'The fine for an unrestrained child is $25 to $250.',
        ],
      },
      'ca-seat-belts-child-safety-slide-06': {
        title: 'Rear-facing follows the seat’s instructions',
        body: p(
          'Texas law sets no separate rear-facing age.',
          'The seat’s manufacturer decides when a child outgrows rear-facing, then forward-facing, then the booster.',
          'Keep children rear-facing as long as the seat allows; it protects the neck best.',
          'Age is important, but height and the seat’s limits decide the stage.',
        ),
      },
      'ca-seat-belts-child-safety-slide-07': {
        body: p(
          'Heat rises fast.',
          'Do not leave a child where heat or controls create danger.',
          'Leaving a young child alone in a vehicle is an offense in Texas.',
          'Heat, controls, windows, and traffic make an unattended vehicle unsafe for children and dependent people.',
          'Check the entire vehicle before locking it.',
          'Secure pets so they do not distract the driver or enter a dangerous area.',
        ),
      },
      'ca-seat-belts-child-safety-slide-08': {
        title: 'Truck beds are not seats',
        body: p(
          'Texas prohibits a child under 18 from riding in the open bed of a pickup or flatbed truck or trailer.',
          'The fine is $25 to $200.',
          'Parades, emergencies, farm work on rural roads, and a few other situations are defenses, not everyday permissions.',
          'An adult may ride there legally but has no belt and no protection.',
          'Passengers belong in belted seats.',
        ),
      },
    },
    recalls: {
      'ca-seat-belts-child-safety-recall-01': {
        context: 'Recall · Under eight',
        rule: 'A child under [[8]] rides in a child safety seat unless taller than [[4 feet 9 inches]].',
      },
      'ca-seat-belts-child-safety-recall-02': {
        context: 'Recall · Belts',
        rule: 'Everyone [[15]] and older buckles up in any seat with a belt; the driver answers for passengers under [[17]].',
      },
      'ca-seat-belts-child-safety-recall-03': {
        context: 'Recall · Children alone',
        rule: 'Never leave a child alone in a car — it is an [[offense]] in Texas, and heat turns deadly within [[minutes]].',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      {
        prompt: 'A 6-year-old who is 4 feet tall rides in your car. What does Texas require?',
        choices: ['A child safety seat used according to its instructions', 'A lap belt only', 'Nothing on trips under 10 miles'],
        correct: 0,
        explanation: 'A child under 8 who is not taller than 4 feet 9 inches must be secured in a child passenger safety seat system used as the manufacturer directs.',
      },
      {
        prompt: 'A 7-year-old is 4 feet 11 inches tall. What does Texas require?',
        choices: ['A properly fitted safety belt', 'A child safety seat', 'A rear-facing seat'],
        correct: 0,
        explanation: 'A child under 8 needs a child safety seat unless taller than 4 feet 9 inches; this child may use a safety belt.',
      },
      {
        prompt: 'May a 16-year-old ride in the open bed of a pickup on a city street in Texas?',
        choices: ['No, children under 18 may not ride in an open truck bed', 'Yes, if seated against the cab', 'Yes, below 30 mph'],
        correct: 0,
        explanation: 'Operating an open-bed pickup or flatbed with a child under 18 in the bed is an offense; parades, emergencies, and a few rural or household situations are the only defenses.',
      },
      { ca: 'q06' },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-equipment-loads-towing': {
    visuals: [null, 'tx-markings-q03-asset', 'tx-regulatory-signs-q02-asset'],
    cards: {
      'ca-equipment-loads-towing-slide-02': {
        body: p(
          'Windows, mirrors, lights, and wipers must work.',
          'Remove anything blocking the view.',
          'Texas no longer requires a safety inspection for most passenger cars — only an emissions test in some counties — so the checks are yours.',
          'Walk around for tire damage, leaks, obstacles, and people near the vehicle.',
          'Check lights, mirrors, windows, wipers, brakes, horn, and seat position.',
          'Make sure loose objects cannot roll under pedals or block your view.',
        ),
      },
      'ca-equipment-loads-towing-slide-03': {
        body: p(
          'Check brakes, horn, steering, and warning lights.',
          'Do not ignore a safety problem.',
          'Texas requires a horn audible from at least 200 feet, used only when needed for safety.',
          'It also requires a mirror that shows the road 200 feet behind, a working wiper, a muffler, and working lamps.',
          'Tires need enough tread to grip in rain; replace them before the grooves wear away.',
        ),
      },
      'ca-equipment-loads-towing-slide-04': {
        body: p(
          'Secure it against shifting, falling, leaking, or blowing out.',
          'Stop safely and recheck the load during a long trip.',
          'A load that sticks out 4 feet or more behind the vehicle needs two red lamps at night and red flags at least 12 inches square by day.',
          'Recheck straps after the vehicle has moved and keep loose material contained.',
          'A cover is useful only when it actually prevents the load from escaping.',
        ),
      },
      'ca-equipment-loads-towing-slide-05': {
        body: p(
          'Secure cargo before the vehicle moves.',
          'Do not let a load hide your lights, plate, mirrors, or view.',
          'Texas bars driving with a load, or with more than three people in the front seat, that blocks your view or your control of the vehicle.',
          'A camera can help, but it does not legalize an obstructed view or replace the required mirror.',
          'Towing changes the drive.',
          'Allow more stopping room.',
          'Turn wider and check mirrors often.',
        ),
      },
      'ca-equipment-loads-towing-slide-06': {
        body: p(
          'Keep people out of open load areas.',
          'Prevent distraction.',
          'Texas prohibits a child under 18 in the open bed of a pickup, flatbed, or trailer.',
          'Adults may ride there legally but travel without belts or protection.',
          'Pets belong in a carrier or harness, never loose where they can jump or distract you.',
          'Smooth acceleration and braking, correct tire pressure, and less idling also save fuel.',
        ),
      },
    },
    recalls: {
      'ca-equipment-loads-towing-recall-01': {
        context: 'Recall · Projecting loads',
        rule: 'A load sticking out [[4 feet]] or more behind you needs red lamps at night and red [[flags]] by day.',
      },
      'ca-equipment-loads-towing-recall-02': {
        context: 'Recall · Equipment',
        rule: 'Your horn must be audible from at least [[200 feet]], and your mirror must show the road [[200 feet]] behind.',
      },
    },
    tests: [
      { ca: 'q01' },
      { ca: 'q02' },
      {
        prompt: 'From what distance must a horn be audible under normal conditions in Texas?',
        choices: ['At least 200 feet', 'At least 50 feet', 'At least 1 mile'],
        correct: 0,
        explanation: 'A motor vehicle must have a horn in good working condition that can be heard from at least 200 feet.',
      },
      { ca: 'q04' },
      {
        prompt: 'A load extends 5 feet beyond the rear of your pickup during the day. What does Texas require?',
        choices: ['Red flags at least 12 inches square on the end of the load', 'Nothing, if the load is tied down', 'A flashing amber light'],
        correct: 0,
        explanation: 'A load projecting 4 feet or more beyond the rear must carry red flags at least 12 inches square by day and two red lamps visible from 500 feet at night.',
      },
      { ca: 'q06' },
    ],
  },
};
