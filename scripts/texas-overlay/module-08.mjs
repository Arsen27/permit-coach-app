// Texas overlay · Module 8 · Pass the Texas Test
// Facts: TX_TN_521_222_LEARNER_LICENSE, TX_TN_521_204_PROVISIONAL_CLASS_C, TX_TN_521_1601_DRIVER_EDUCATION_UNDER_25,
// TX_TN_521_161_EXAMINATION, TX_HANDBOOK_KNOWLEDGE_TEST_AND_ITD, TX_TN_545_424_UNDER_18_RESTRICTIONS,
// TX_TN_521_021_025_LICENSE_REQUIRED_CARRIED, TX_TN_521_029_NEW_RESIDENT_90_DAYS, TX_TN_521_054_ADDRESS_CHANGE_30_DAYS,
// TX_TN_502_040_REGISTRATION_30_DAYS, TX_TN_501_145_147_TITLE_TRANSFER, TX_TN_521_292_SUSPENSION_GROUNDS,
// TX_HANDBOOK_NO_POINT_SYSTEM, TX_TN_521_246_IGNITION_INTERLOCK, TX_TN_545_421_FLEEING_POLICE,
// TX_TN_521_342_UNDER_21_ALCOHOL_SUSPENSION, TX_TN_724_011_035_IMPLIED_CONSENT_REFUSAL, TX_TN_601_051_072_FINANCIAL_RESPONSIBILITY.

const p = (...lines) => lines.join('\n\n');

export const LESSONS = {
  // ---------------------------------------------------------------------------
  'ca-permit-and-knowledge-test': {
    title: 'Learner License and Knowledge Test',
    summary: 'The learner license process checks driver education, knowledge, vision, and safe supervision.',
    keyPoints: ['Know the basic application flow.', 'Use a learner license only with a supervisor.', 'Know what the test covers.'],
    visuals: [null, 'tx-sign-language-asset-03', 'tx-turns-signals-asset-02'],
    challenge: {
      scenario: 'You have a learner license but no qualified supervisor in the car.',
      prompt: 'May you practice alone?',
      choices: ['Yes, on quiet roads', 'No', 'Only during daylight'],
      correct: 1,
      explanation: 'A Texas learner license works only with a licensed driver who is at least 21, with a year of experience, in the seat beside you.',
    },
    cards: {
      'ca-permit-and-knowledge-test-slide-01': {
        body: p(
          'The Department of Public Safety checks identity, eligibility, and required documents.',
          'The exact application requirements depend on the applicant and license class.',
          'Each stage confirms a different kind of readiness.',
          'Driver education comes first: everyone under 25 must complete an approved course before a Texas license is issued.',
          'The knowledge test checks rules and safe-driving decisions.',
          'The learner license and driving test add supervised practice and demonstrated vehicle control.',
        ),
      },
      'ca-permit-and-knowledge-test-slide-02': {
        body: p(
          'You need enough visual ability to drive safely.',
          'Texas law makes vision the first part of every examination.',
          'The knowledge test covers highway signs in English, Texas traffic laws, your duties toward bicyclists, and how phones and other distractions affect driving.',
          'You may take those parts in writing instead of on a screen.',
          'Study signs, laws, and real road situations.',
          'Learn why an answer is correct instead of memorizing answer letters.',
        ),
      },
      'ca-permit-and-knowledge-test-slide-03': {
        title: 'Texas scores the test at 70 percent',
        body: p(
          'The handbook sets the passing score at 70 percent.',
          'The exam is scheduled within 10 days of your application.',
          'A licensed driver education provider may give its own students the vision, sign, and traffic-law parts.',
          'Before the driving test, every applicant completes the free Impact Texas Drivers video course.',
          'The driving test itself checks ordinary and reasonable control of the vehicle.',
        ),
      },
      'ca-permit-and-knowledge-test-slide-04': {
        title: 'A failed test means another attempt',
        body: p(
          'Read the instructions the Department of Public Safety gives you before scheduling again.',
          'Use the eligibility date in your own record instead of guessing.',
          'Retake the whole knowledge test; there is no partial credit from the first try.',
          'Between attempts, go back to the rule behind each missed question.',
          'Most misses are conditions, not facts: who, where, and when.',
        ),
      },
      'ca-permit-and-knowledge-test-slide-05': {
        body: p(
          'Use a qualified licensed driver in the seat beside you.',
          'Do not practice alone.',
          'A learner license is available from age 15 after the classroom phase of driver education and the knowledge test.',
          'The supervisor must be licensed for the vehicle, at least 21, and have at least one year of driving experience.',
          'It is not an unrestricted license.',
          'Exam strategy: read the whole situation and choose the safest legal action, not the fastest.',
        ),
      },
    },
    recalls: {
      'ca-permit-and-knowledge-test-recall-01': {
        context: 'Recall · What the test covers',
        rule: 'The knowledge test covers [[signs]], traffic laws, duties toward [[bicyclists]], and distraction — after a vision check.',
      },
      'ca-permit-and-knowledge-test-recall-02': {
        context: 'Recall · Driver education',
        rule: 'Everyone under [[25]] completes an approved driver education course before a Texas license; 18 and older may take the [[adult]] course.',
      },
      'ca-permit-and-knowledge-test-recall-03': {
        context: 'Recall · Learner license',
        rule: 'Learner license from age [[15]]. Supervisor: licensed, at least [[21]], with a year of experience, in the seat beside you.',
      },
    },
    tests: [
      {
        prompt: 'What is the minimum age for a Texas learner license?',
        choices: ['15', '16', '14'],
        correct: 0,
        explanation: 'A learner license may be issued at 15 to an applicant under 18 who has completed the classroom phase of driver education and passed the non-driving parts of the exam.',
      },
      {
        prompt: 'Who may sit beside a learner-license holder as the supervising driver?',
        choices: ['A licensed driver at least 21 with at least one year of driving experience', 'Any licensed adult in the back seat', 'Any passenger over 18'],
        correct: 0,
        explanation: 'The supervisor must hold a license for that type of vehicle, be at least 21, have at least one year of driving experience, and occupy the seat beside the operator.',
      },
      {
        prompt: 'Which topics does the Texas knowledge examination cover?',
        choices: ['Signs, traffic laws, duties toward bicyclists, and distraction', 'Vehicle repair and insurance pricing', 'Only speed limits'],
        correct: 0,
        explanation: 'Texas law lists highway signs in English, state traffic laws, motorists’ rights and responsibilities toward bicyclists, and the effect of wireless devices and other distractions.',
      },
      {
        prompt: 'What must happen before you practice with a learner license?',
        choices: ['The license must be in your possession and a qualified supervisor beside you', 'Only a parent’s verbal permission', 'A written route plan'],
        correct: 0,
        explanation: 'A learner license permits driving only while it is in the holder’s possession and a qualified licensed driver occupies the seat beside the operator.',
      },
      {
        prompt: 'Who must complete a driver education course before receiving a Texas license?',
        choices: ['Everyone under 25, unless they hold a valid out-of-state license', 'Only drivers under 16', 'Only drivers over 70'],
        correct: 0,
        explanation: 'No one under 25 receives a Texas license without an approved driver education certificate; applicants 18 and older may take the adult course, and out-of-state license holders are exempt.',
      },
      {
        prompt: 'Why does the Department of Public Safety test vision first?',
        choices: ['To confirm safe visual ability before any other part of the exam', 'To assign a license class', 'To set the insurance rate'],
        correct: 0,
        explanation: 'Vision is the first required part of the examination because safe driving depends on seeing signs, signals, and hazards in time.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-drivers-under-18': {
    summary: 'Texas adds driver education, school attendance, and restrictions that last until 18.',
    keyPoints: ['Complete every licensing gate.', 'Hold the learner license six months.', 'Know the under-18 restrictions.'],
    visuals: [null, 'tx-signals-q05-asset', 'tx-regulatory-signs-q04-asset'],
    challenge: {
      scenario: 'A 16-year-old has held a learner license for three months and finished driver education.',
      prompt: 'Is the six-month holding rule complete?',
      choices: ['Yes', 'No', 'Only if the test is easy'],
      correct: 1,
      explanation: 'Finishing driver education does not replace the minimum six months with the learner license.',
    },
    cards: {
      'ca-drivers-under-18-slide-01': {
        body: p(
          'Texas’s learner license begins at 15.',
          'Reaching the minimum age does not remove the other requirements.',
          'You need the classroom phase of an approved driver education course, the school-attendance rule, and a pass on every exam part except driving.',
          'You may practice only with a qualified supervisor beside you.',
          'It is not an unrestricted license.',
        ),
      },
      'ca-drivers-under-18-slide-02': {
        body: p(
          'Complete every required part.',
          'One does not automatically replace another.',
          'Driver education, school attendance, and the six months on the learner license are separate gates.',
          'Count the six months from the date the learner license was issued.',
          'Keep your driver education certificate; the Department of Public Safety needs it.',
          'A minor generally has to meet all of these requirements:',
        ),
        bullets: [
          'Be at least 16.',
          'Complete an approved driver education course.',
          'Meet the school-attendance rule.',
          'Hold the learner license for at least six months.',
          'Pass the knowledge and driving tests.',
        ],
      },
      'ca-drivers-under-18-slide-03': {
        body: p(
          'Passing the driving test does not remove every restriction.',
          'Texas keeps the under-18 limits in place until the driver turns 18, however long the license has been held.',
          'Each stage confirms a different kind of readiness.',
          'The learner license proves supervised practice.',
          'The Class C license proves the driver can operate alone within the restrictions.',
          'School attendance stays a condition: 80 days in the previous semester, or an equivalency program.',
        ),
      },
      'ca-drivers-under-18-slide-04': {
        body: p(
          'Until 18, midnight to 5 a.m. is restricted.',
          'Work, a school activity, or a medical emergency are the only exceptions.',
          'No more than one passenger under 21 who is not a family member.',
          'No wireless device use at all, even hands-free, except in an emergency.',
          'The limits do not apply while a learner is accompanied by the required supervisor.',
          'Two moving violations in 12 months can cost an under-18 driver the license.',
          'Start with the licensing stage before choosing a number.',
        ),
      },
    },
    recalls: {
      'ca-drivers-under-18-recall-01': {
        context: 'Recall · Learner basics',
        rule: 'The learner license starts at age [[15]]. Hold it for at least [[six months]] before the Class C license.',
      },
      'ca-drivers-under-18-recall-02': {
        context: 'Recall · Class C at 16',
        rule: 'Class C at [[16]] needs driver education, school attendance, six months on the learner license, and the [[driving test]].',
      },
      'ca-drivers-under-18-recall-03': {
        context: 'Recall · Until 18',
        rule: 'Until 18: no driving [[midnight]]–5 a.m. except work, school, or emergency; no more than one passenger under [[21]] who is not family.',
      },
    },
    tests: [
      {
        prompt: 'A 16-year-old has held a learner license for four months and finished driver education. Is the applicant ready for a Class C license?',
        choices: ['No, the learner license must be held for at least six months', 'Yes, driver education completes the requirement', 'Yes, at 16 the waiting period ends'],
        correct: 0,
        explanation: 'Texas issues a Class C license to an applicant under 18 only after the learner or hardship license has been held for at least six months, along with driver education, school attendance, and the tests.',
      },
      {
        prompt: 'A 17-year-old with a Class C license wants to drive at 1 a.m. to a friend’s party. Is that allowed?',
        choices: ['No, driving between midnight and 5 a.m. is restricted except for work, school, or a medical emergency', 'Yes, with a parent’s permission', 'Yes, on any weekend'],
        correct: 0,
        explanation: 'A driver under 18 may not drive between midnight and 5 a.m. unless the trip is necessary for employment, a school-related activity, or a medical emergency.',
      },
      {
        prompt: 'How many non-family passengers under 21 may a driver under 18 carry in Texas?',
        choices: ['No more than one', 'Up to three', 'As many as there are seat belts'],
        correct: 0,
        explanation: 'A driver under 18 may not carry more than one passenger under 21 who is not a family member.',
      },
      {
        prompt: 'How long must a minor hold a learner license before a Class C license?',
        choices: ['At least six months', 'At least 30 days', 'At least one year'],
        correct: 0,
        explanation: 'Texas will not issue a Class C license to an applicant under 18 unless the learner or hardship license has been held for at least six months.',
      },
      {
        prompt: 'A driver under 18 is convicted of two moving violations within 12 months. What can happen?',
        choices: ['The license can be suspended', 'Nothing until a third violation', 'Only a warning letter'],
        correct: 0,
        explanation: 'Two or more moving-violation convictions within a 12-month period are a ground for suspending the license of a driver under 18.',
      },
      {
        prompt: 'May a 17-year-old driver ignore the passenger restriction when the passengers are close friends?',
        choices: ['No', 'Yes, if everyone wears a belt', 'Yes, after six months of driving'],
        correct: 0,
        explanation: 'The one-passenger-under-21 limit applies to anyone who is not a family member, and it lasts until the driver turns 18.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-licenses-and-registration': {
    keyPoints: ['Carry a valid license.', 'Match each deadline to the event.', 'Keep proof of submissions.'],
    visuals: [null, 'tx-uturn-backing-asset-02', 'tx-sign-language-q05-asset'],
    challenge: {
      scenario: 'You sold your car to a private buyer.',
      prompt: 'Who tells the state?',
      choices: ['Both of you, separately', 'Only the buyer', 'The insurance company'],
      correct: 0,
      explanation: 'The buyer files the title transfer; the seller submits a vehicle transfer notification to protect themselves.',
    },
    cards: {
      'ca-licenses-and-registration-slide-01': {
        body: p(
          'Carry it while driving unless a legal exception applies.',
          'Show it when lawfully required.',
          'You must not drive a motor vehicle on a Texas highway without a driver license unless you are expressly exempt.',
          'Keep the license of the right class in your possession while driving and display it when a peace officer, magistrate, or court officer demands it.',
          'A first violation carries a fine of up to $200.',
        ),
      },
      'ca-licenses-and-registration-slide-02': {
        title: 'Address change: 30 days',
        body: p(
          'Notify the Department of Public Safety after a move or a name change.',
          'Apply for a duplicate license showing the new address.',
          'The duty is separate from vehicle registration, ownership transfer, or license renewal.',
          'Registration: 30 days.',
          'Within 30 days of buying a vehicle or becoming a Texas resident, apply to register it through your county tax assessor-collector.',
          'The same 30 days apply to the buyer’s title transfer.',
        ),
      },
      'ca-licenses-and-registration-slide-03': {
        title: 'Buyer: 30 days',
        body: p(
          'File the assigned title with the county tax assessor-collector.',
          'Keep purchase and submission records.',
          'Active-duty military buyers have 60 days.',
          'These documents answer three separate questions.',
          'A license shows the person’s driving privilege.',
          'Registration connects a vehicle to its current operating record.',
          'Title records legal ownership; a transfer updates that ownership record.',
        ),
      },
      'ca-licenses-and-registration-slide-04': {
        title: 'New resident license: 90 days',
        body: p(
          'A new Texas resident who is at least 16 may drive on a valid out-of-state license for no more than 90 days.',
          'Get the Texas license within that window.',
          'Thirty and 90 days are both correct Texas numbers for different events.',
          'Never choose the number before identifying the license, the vehicle, or the seller.',
        ),
      },
      'ca-licenses-and-registration-slide-05': {
        title: 'Three events, two clocks',
        body: p(
          'Texas keeps the vehicle clocks simple: 30 days for registration, 30 days for the buyer’s title transfer, 30 days for a license address change.',
          'The driver clock is different: 90 days for a new resident to get a Texas license.',
          'Administrative questions become simple when you identify three things: the triggering event, the responsible person, and the deadline.',
          'Similar-looking clocks belong to different duties.',
        ),
      },
      'ca-licenses-and-registration-slide-06': {
        title: 'The seller has a job too',
        body: p(
          'After selling, submit a vehicle transfer notification to the Texas Department of Motor Vehicles, online or on paper.',
          'It records the vehicle, both parties, and the date you handed over possession.',
          'Do it promptly, before the buyer’s 30 days run out.',
          'Until the record changes, tickets and tolls on that car can still land on you.',
          'A new resident also registers the vehicle within 30 days, with proof of Texas insurance.',
        ),
      },
      'ca-licenses-and-registration-slide-07': {
        body: p(
          'First identify who must act and what changed.',
          'A number is useful only when it matches the correct event.',
          'The person responsible for a filing should act immediately instead of waiting for another party.',
          'A buyer files the title transfer within 30 days.',
          'A new resident registers within 30 days and licenses within 90 days.',
          'Keep the deadlines separate:',
        ),
        bullets: [
          'Buyer’s title transfer and vehicle registration: 30 days.',
          'License address or name change: 30 days.',
          'New resident’s Texas license: 90 days.',
        ],
      },
    },
    recalls: {
      'ca-licenses-and-registration-recall-01': {
        context: 'Recall · Deadlines',
        rule: 'Register a vehicle and transfer a title within [[30 days]]. A new resident gets a Texas license within [[90 days]].',
      },
      'ca-licenses-and-registration-recall-02': {
        context: 'Recall · Address change',
        rule: 'Moved or changed your name? Notify the Department of Public Safety within [[30 days]] and get a [[duplicate]] license.',
      },
    },
    tests: [
      {
        prompt: 'You moved to Texas with a car registered in another state. When must you register it in Texas?',
        choices: ['Within 30 days of becoming a resident', 'Within 90 days', 'When the old registration expires'],
        correct: 0,
        explanation: 'The owner must apply for Texas registration within 30 days of purchasing a vehicle or becoming a Texas resident.',
      },
      { ca: 'q02' },
      {
        prompt: 'How long does a Texas driver have to report a new address?',
        choices: ['30 days', '10 days', '90 days'],
        correct: 0,
        explanation: 'A license holder who moves must notify the Department of Public Safety within 30 days and apply for a duplicate license with the current address.',
      },
      {
        prompt: 'How long may a new Texas resident with a valid out-of-state license drive before getting a Texas license?',
        choices: ['No more than 90 days', 'No more than 30 days', 'One year'],
        correct: 0,
        explanation: 'A new resident who is at least 16 and holds a valid license from the previous state or country may drive on it for up to 90 days after entering Texas.',
      },
      {
        prompt: 'When must the buyer of a used vehicle file for title transfer in Texas?',
        choices: ['Within 30 days of the title assignment', 'Within 5 days', 'Only when the registration renews'],
        correct: 0,
        explanation: 'The buyer files the assigned title with the county tax assessor-collector within 30 days; active-duty military members have 60 days.',
      },
      {
        prompt: 'After a private-party vehicle sale in Texas, who has a filing to make?',
        choices: ['Both: the buyer transfers the title and the seller submits a transfer notification', 'Only the buyer', 'Only the seller'],
        correct: 0,
        explanation: 'The buyer must file the title transfer within 30 days; the seller submits a vehicle transfer notification so the record no longer ties the car to them.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  'ca-penalties-and-points': {
    title: 'Suspensions, Penalties, and Police Stops',
    summary: 'The final questions often test consequences, not just driving moves.',
    keyPoints: ['Know how Texas counts convictions.', 'Know the DWI consequences.', 'Make traffic stops predictable.'],
    visuals: [null, 'tx-regulatory-signs-q04-asset', 'tx-signals-q03-asset'],
    challenge: {
      scenario: 'An officer activates emergency lights behind you.',
      prompt: 'What should you do first?',
      choices: ['Accelerate', 'Signal and pull over safely', 'Stop in the active lane when a shoulder is open'],
      correct: 1,
      explanation: 'Choose a safe place, stop, and follow instructions. Refusing to stop for a police signal is a crime in Texas.',
    },
    cards: {
      'ca-penalties-and-points-slide-01': {
        title: 'Texas has no point system',
        body: p(
          'Texas does not add points to your record.',
          'It counts convictions instead.',
          'The old surcharge program that assigned points was repealed.',
          'Every moving-violation conviction still goes on the driving record, and the count itself can end your license.',
          'Insurance companies read the same record.',
        ),
      },
      'ca-penalties-and-points-slide-02': {
        title: 'Remember the 4/12 and 7/24 pattern',
        body: p(
          'A habitual violator has four or more moving-violation convictions from separate incidents in 12 consecutive months, or seven or more in 24 months.',
          'The Department of Public Safety suspends the license.',
          'For a driver under 18, two moving violations in 12 months are enough.',
          'Memorize the counts:',
        ),
        bullets: ['Four in 12 months.', 'Seven in 24 months.', 'Under 18: two in 12 months.'],
      },
      'ca-penalties-and-points-slide-03': {
        title: 'One event, one consequence',
        body: p(
          'Different events trigger different license actions.',
          'A collision you caused with serious injury or serious property damage can bring a suspension.',
          'Refusing a chemical test after a DWI arrest costs 180 days on its own, and a failed test costs an adult 90 days.',
          'Driving without insurance brings a fine of $175 to $350 the first time.',
          'Do not mix these consequences.',
        ),
      },
      'ca-penalties-and-points-slide-04': {
        body: p(
          'Criminal, licensing, insurance, and financial consequences can overlap.',
          'Read the exact offense.',
          'After a DWI conviction with a suspension, the judge generally orders an ignition interlock device: a breath tester wired to the starter.',
          'No clean sample, no start.',
          'A driver under 21 convicted of DWI loses the license for one year.',
          'The fine is only one possible result.',
          'Insurance cost and eligibility can change.',
        ),
      },
      'ca-penalties-and-points-slide-05': {
        body: p(
          'Signal and move to a safe place.',
          'Stop the vehicle and stay calm.',
          'Do not memorize a list without labels.',
          'Attach every number to its unit and trigger: feet for clearance, days for deadlines, months for conviction windows, and an alcohol concentration for a defined driver status.',
        ),
      },
      'ca-penalties-and-points-slide-06': {
        body: p(
          'Keep your hands where they can be seen.',
          'Explain before reaching for documents.',
          'A safe stop protects both the driver and the officer.',
          'Signal, pull to a safe place, stop, and remain in the vehicle unless directed otherwise.',
          'Have your license and proof of insurance ready; Texas requires you to show both on request.',
          'Never flee; wilfully refusing to stop for a police signal is a crime and a ground for suspension.',
        ),
      },
      'ca-penalties-and-points-slide-08': {
        scope: 'universal',
        body: p(
          'Final review is about conditions, not slogans.',
          'Penalties, suspensions, and exam numbers often look familiar; the correct answer connects each consequence to the exact violation, driver status, time window, and procedure.',
          'Use the same method on each exam question:',
        ),
        bullets: ['Name the situation.', 'Remove unsafe answers.', 'Apply the Texas rule and exact condition.'],
      },
      'ca-penalties-and-points-slide-07': {
        body: p(
          'Fleeing can become a serious offense.',
          'A safe stop is always the correct first move.',
          'Distractors often use words like always, never, automatic, or immediately while omitting a condition.',
          'A correct number attached to the wrong condition is still wrong.',
          'Before choosing an exam answer, identify each condition:',
        ),
        bullets: ['The driver involved', 'The type of road', 'The time window', 'The signal shown', 'Any stated exception'],
      },
    },
    recalls: {
      'ca-penalties-and-points-recall-01': {
        context: 'Recall · Habitual violator',
        rule: 'Texas has no points. [[Four]] moving violations in 12 months, or [[seven]] in 24, bring a suspension.',
      },
      'ca-penalties-and-points-recall-02': {
        context: 'Recall · Under 18',
        rule: 'A driver under 18 with [[two]] moving violations in 12 months can lose the license.',
      },
      'ca-penalties-and-points-recall-03': {
        context: 'Recall · Traffic stops',
        rule: 'Pulled over? Stop in a safe place, remain in the [[vehicle]], and keep your [[hands]] visible.',
      },
    },
    tests: [
      {
        prompt: 'How does Texas track repeat traffic offenders?',
        choices: ['By counting moving-violation convictions, not points', 'By a point system with a 12-point limit', 'By insurance company reports only'],
        correct: 0,
        explanation: 'Texas has no point system; the Department of Public Safety suspends the license of a habitual violator based on conviction counts.',
      },
      {
        prompt: 'How many moving-violation convictions in 12 consecutive months make a driver a habitual violator in Texas?',
        choices: ['Four or more', 'Two or more', 'Ten or more'],
        correct: 0,
        explanation: 'Four or more moving-violation convictions from separate incidents in 12 consecutive months, or seven or more in 24 months, make a habitual violator whose license is suspended.',
      },
      {
        prompt: 'Which count matches the 24-month habitual-violator threshold?',
        choices: ['Seven', 'Four', 'Twelve'],
        correct: 0,
        explanation: 'Seven or more moving-violation convictions from separate incidents within 24 months bring a suspension.',
      },
      {
        prompt: 'What does an ignition interlock device do?',
        choices: ['Prevents the engine from starting until the driver gives an alcohol-free breath sample', 'Limits the vehicle’s top speed', 'Records the vehicle’s location for the court'],
        correct: 0,
        explanation: 'After a DWI conviction with a suspension, the judge generally restricts the driver to a vehicle with an ignition interlock, a breath tester wired to the starter, at the driver’s expense.',
      },
      {
        prompt: 'An answer gives the correct number but applies it to the wrong driver status. Is it correct?',
        choices: ['No', 'Yes, the number is what matters', 'Only if the number is rounded'],
        correct: 0,
        explanation: 'Exam answers pair a number with a condition; a correct number attached to the wrong driver, road, time, or exception is still wrong.',
      },
      {
        prompt: 'An officer activates emergency lights behind you. What is the safest first response?',
        choices: ['Signal and pull over safely, then follow instructions', 'Speed up to find a parking lot', 'Stop immediately in the travel lane'],
        correct: 0,
        explanation: 'Signal, move to a safe place, stop, stay in the vehicle, and keep your hands visible; refusing to stop for a police signal is a crime.',
      },
    ],
  },
};
