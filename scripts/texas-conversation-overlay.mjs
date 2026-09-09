// Texas overlay for the conversational course: course metadata, module
// renames, coverage domains, and the per-lesson overlays collected from
// scripts/texas-overlay/module-0N.mjs. See build-texas-conversation-course.mjs
// for the contract each entry follows.

import { LESSONS as MODULE_01 } from './texas-overlay/module-01.mjs';
import { LESSONS as MODULE_02 } from './texas-overlay/module-02.mjs';
import { LESSONS as MODULE_03 } from './texas-overlay/module-03.mjs';
import { LESSONS as MODULE_04 } from './texas-overlay/module-04.mjs';
import { LESSONS as MODULE_05 } from './texas-overlay/module-05.mjs';
import { LESSONS as MODULE_06 } from './texas-overlay/module-06.mjs';
import { LESSONS as MODULE_07 } from './texas-overlay/module-07.mjs';
import { LESSONS as MODULE_08 } from './texas-overlay/module-08.mjs';

export const COURSE = {
  title: 'Texas Class C Driver License Course',
  subtitle: 'Pass the Texas knowledge test and drive with judgment',
  targetLicense: 'Class C',
  releaseNotes:
    'Texas course rebuilt in the conversational format used by California 3.3.0: 8 modules, 33 lessons with scenario openers, chat-style theory cards, Check-yourself recall cards, emoji cues, and six-question lesson tests. Every state-specific card and question is Texas-authored from the Transportation Code, Penal Code, Alcoholic Beverage Code and Texas MUTCD snapshots; universal content is shared with the California course.',
  // Numbers that appear in scenario text or questions without being a legal
  // value: posted limits and counts used purely as story detail.
  approvedScenarioNumbers: ['70', '60', '55', '45', '40', '35', '30', '300', '250', '911', '24', '17', '16', '14', '11', '7', '0.06', '0.05', '6', '1', '2', '3', '4', '5', '10'],
};

export const MODULES = {
  'ca-pass-the-test': { title: 'Pass the Texas Test' },
};

export const LESSONS = {
  ...MODULE_01,
  ...MODULE_02,
  ...MODULE_03,
  ...MODULE_04,
  ...MODULE_05,
  ...MODULE_06,
  ...MODULE_07,
  ...MODULE_08,
};

// Every catalog rule belongs to exactly one domain; every lesson is claimed.
export const COVERAGE_DOMAINS = [
  {
    domain: 'Traffic signals and signal indications',
    officialSource: 'Transportation Code ch. 544, 552; Texas MUTCD Part 4',
    ruleIds: [
      'TX_TN_544_007_GREEN_SIGNAL',
      'TX_TN_544_007_YELLOW_SIGNAL',
      'TX_TN_544_007_RED_SIGNAL_STOP_POSITION',
      'TX_TN_544_007_TURN_ON_RED',
      'TX_TMUTCD_4A_03_RED_ARROW',
      'TX_TMUTCD_4A_04_FLASHING_YELLOW_ARROW',
      'TX_TN_544_008_FLASHING_SIGNALS',
      'TX_TN_544_007_DARK_SIGNAL',
      'TX_TMUTCD_4T_02_LANE_USE_CONTROL_SIGNALS',
      'TX_TN_552_002_PEDESTRIAN_SIGNALS',
    ],
    lessons: ['tx-traffic-signals', 'tx-complex-intersections'],
  },
  {
    domain: 'Stop and yield control, driveways and blocked intersections',
    officialSource: 'Transportation Code §§ 544.010, 545.153, 545.155, 545.256, 545.302',
    ruleIds: [
      'TX_TN_544_010_STOP_SIGN_POSITION',
      'TX_TN_544_010_YIELD_SIGN',
      'TX_TN_545_153_STOP_YIELD_RIGHT_OF_WAY',
      'TX_TN_545_155_DRIVEWAY_ALLEY_ENTRY',
      'TX_TN_545_256_EMERGING_ACROSS_SIDEWALK',
      'TX_TN_545_302_NO_STOPPING_IN_INTERSECTION',
    ],
    lessons: ['tx-stop-yield-entering-traffic', 'tx-u-turns-starting-backing'],
  },
  {
    domain: 'Turns and signaling',
    officialSource: 'Transportation Code §§ 545.101–545.107, 545.152',
    ruleIds: [
      'TX_TN_545_101_TURN_POSITIONS',
      'TX_TN_545_103_SAFE_TURN',
      'TX_TN_545_104_SIGNAL_100_FEET',
      'TX_TN_545_106_107_HAND_SIGNALS',
      'TX_TN_545_152_LEFT_TURN_YIELD',
    ],
    lessons: ['tx-turns-and-signals'],
  },
  {
    domain: 'Speed and following distance',
    officialSource: 'Transportation Code §§ 545.062, 545.351–545.363',
    ruleIds: [
      'TX_TN_545_351_REASONABLE_PRUDENT_SPEED',
      'TX_TN_545_352_PRIMA_FACIE_LIMITS',
      'TX_TN_545_353_COMMISSION_MAXIMUM',
      'TX_TN_545_363_MINIMUM_SPEED',
      'TX_TN_545_062_FOLLOWING_DISTANCE',
      'TX_HANDBOOK_FOLLOWING_INTERVAL',
    ],
    lessons: ['tx-speed-and-space'],
  },
  {
    domain: 'Sign families, shapes, colors and obedience',
    officialSource: 'Texas MUTCD Part 2; Transportation Code §§ 542.501, 544.004',
    ruleIds: [
      'TX_TMUTCD_2A_03_SIGN_CLASSES',
      'TX_TMUTCD_2A_05_SIGN_SHAPES',
      'TX_TMUTCD_2A_06_SIGN_COLORS',
      'TX_TMUTCD_2B_27_LANE_CONTROL_SIGNS',
      'TX_TN_544_004_OBEY_DEVICES',
      'TX_TN_542_501_OBEY_OFFICER',
      'TX_TMUTCD_2B_46_DO_NOT_ENTER_WRONG_WAY',
    ],
    lessons: ['tx-sign-shapes-and-colors', 'tx-regulatory-signs'],
  },
  {
    domain: 'Warning, school, and guide signs',
    officialSource: 'Texas MUTCD Chapters 2C, 2D, 7B',
    ruleIds: [
      'TX_TMUTCD_2C_WARNING_SIGNS',
      'TX_TMUTCD_2C_ADVISORY_SPEED',
      'TX_TMUTCD_7B_SCHOOL_SIGNS',
      'TX_TMUTCD_2D_GUIDE_SIGNS',
    ],
    lessons: ['tx-warning-and-guide-signs'],
  },
  {
    domain: 'Pavement markings and curb controls',
    officialSource: 'Texas MUTCD Part 3; Transportation Code §§ 545.055, 545.302, 545.303',
    ruleIds: [
      'TX_TMUTCD_3A_04_MARKING_COLORS_PATTERNS',
      'TX_TMUTCD_3B_03_NO_PASSING_MARKINGS',
      'TX_TN_545_055_NO_PASSING_ZONES',
      'TX_TMUTCD_3B_23_LANE_USE_ARROWS',
      'TX_TMUTCD_3B_16_STOP_LINES',
      'TX_TMUTCD_3B_25_CHEVRON_ISLANDS',
      'TX_TMUTCD_3B_26_DO_NOT_BLOCK_INTERSECTION',
      'TX_TN_545_302_303_SIGNS_CONTROL_STOPPING',
    ],
    lessons: ['tx-road-markings-and-curbs'],
  },
  {
    domain: 'Uncontrolled intersections and right-of-way',
    officialSource: 'Transportation Code § 545.151',
    ruleIds: ['TX_TN_545_151_UNCONTROLLED_INTERSECTION_RIGHT', 'TX_TN_545_151_BIG_ROAD_PAVED_ROAD'],
    lessons: ['tx-uncontrolled-intersections'],
  },
  {
    domain: 'Pedestrians, crosswalks and roundabouts',
    officialSource: 'Transportation Code ch. 552; Texas MUTCD § 2B.10',
    ruleIds: [
      'TX_TN_552_003_CROSSWALK_RIGHT_OF_WAY',
      'TX_TN_552_005_CROSSING_OUTSIDE_CROSSWALK',
      'TX_TN_552_008_DUE_CARE',
      'TX_TN_552_010_BLIND_PEDESTRIANS',
      'TX_TMUTCD_2B_10_ROUNDABOUT_YIELD',
    ],
    lessons: ['tx-crosswalks-and-roundabouts'],
  },
  {
    domain: 'Turnarounds, starting and backing',
    officialSource: 'Transportation Code §§ 545.102, 545.402, 545.415; Texas MUTCD §§ 2B.30A, 2D.52A',
    ruleIds: [
      'TX_TN_545_102_TURNAROUND_CURVE_CREST',
      'TX_TMUTCD_2B_30A_TURNAROUND_LANES',
      'TX_TN_545_415_BACKING',
      'TX_TN_545_402_MOVING_PARKED_VEHICLE',
    ],
    lessons: ['tx-u-turns-starting-backing'],
  },
  {
    domain: 'Parking and stopping',
    officialSource: 'Transportation Code §§ 545.301–545.303, 545.404, 545.418',
    ruleIds: [
      'TX_TN_545_302_NO_STANDING_DISTANCES',
      'TX_TN_545_302_PROHIBITED_PLACES',
      'TX_TN_545_301_STOPPING_OUTSIDE_DISTRICT',
      'TX_TN_545_303_CURB_18_INCHES',
      'TX_TN_545_404_UNATTENDED_VEHICLE',
      'TX_HANDBOOK_HILL_PARKING_WHEELS',
      'TX_TN_545_418_OPENING_DOORS',
      'TX_HANDBOOK_ACCESSIBLE_PARKING',
    ],
    lessons: ['tx-parking-and-curbs'],
  },
  {
    domain: 'Lane use and lane changes',
    officialSource: 'Transportation Code §§ 545.051, 545.060, 545.061',
    ruleIds: ['TX_TN_545_051_KEEP_RIGHT', 'TX_TN_545_060_LANE_DISCIPLINE', 'TX_TN_545_061_MULTILANE_LANE_ENTRY'],
    lessons: ['tx-choosing-changing-lanes'],
  },
  {
    domain: 'Passing',
    officialSource: 'Transportation Code §§ 545.053–545.058',
    ruleIds: [
      'TX_TN_545_053_054_PASSING_LEFT',
      'TX_TN_545_056_NO_LEFT_OF_CENTER_100_FEET',
      'TX_TN_545_057_PASSING_RIGHT',
      'TX_TN_545_058_IMPROVED_SHOULDER',
      'TX_TMUTCD_2B_42_SLOW_VEHICLE_TURNOUT',
    ],
    lessons: ['tx-passing-rules'],
  },
  {
    domain: 'Freeway entry and exit',
    officialSource: 'Texas MUTCD Chapter 4P; Transportation Code § 544.007',
    ruleIds: ['TX_TMUTCD_4P_RAMP_METERS'],
    lessons: ['tx-freeway-merging'],
  },
  {
    domain: 'Special lanes',
    officialSource: 'Texas MUTCD Chapters 2G, 3B, 3J, 9E',
    ruleIds: [
      'TX_TMUTCD_3B_05_TWO_WAY_LEFT_TURN_LANE',
      'TX_TMUTCD_9E_BICYCLE_LANES',
      'TX_TMUTCD_2G_PREFERENTIAL_LANES',
      'TX_TMUTCD_3J_03_FLUSH_MEDIAN',
    ],
    lessons: ['tx-special-lanes'],
  },
  {
    domain: 'Bicycles and motorcycles',
    officialSource: 'Transportation Code §§ 551.101–551.104, 545.0605',
    ruleIds: [
      'TX_TN_551_101_103_BICYCLE_RIGHTS_POSITION',
      'TX_HANDBOOK_PASSING_BICYCLE_SAFE_DISTANCE',
      'TX_TN_551_104_BICYCLE_EQUIPMENT',
      'TX_TN_545_0605_MOTORCYCLE_LANE',
    ],
    lessons: ['tx-bicycles-motorcycles'],
  },
  {
    domain: 'Trucks, buses and slow vehicles',
    officialSource: 'Transportation Code §§ 547.001, 547.703',
    ruleIds: ['TX_TN_547_703_SLOW_MOVING_EMBLEM'],
    lessons: ['tx-trucks-buses-slow-vehicles'],
  },
  {
    domain: 'School buses and emergency vehicles',
    officialSource: 'Transportation Code §§ 545.066, 545.156, 545.157, 545.407, 545.408',
    ruleIds: [
      'TX_TN_545_156_EMERGENCY_VEHICLE_APPROACH',
      'TX_TN_545_157_MOVE_OVER_SLOW_DOWN',
      'TX_TN_545_407_408_FOLLOWING_FIRE_APPARATUS',
      'TX_TN_545_066_SCHOOL_BUS',
    ],
    lessons: ['tx-school-buses-emergency-vehicles'],
  },
  {
    domain: 'Railroad crossings, light rail and work zones',
    officialSource: 'Transportation Code §§ 545.251, 545.252, 542.404; Texas MUTCD Parts 6 and 8',
    ruleIds: ['TX_TN_545_251_RAILROAD_STOP', 'TX_TMUTCD_8B_LIGHT_RAIL_CROSSINGS', 'TX_TN_542_404_WORK_ZONE_FINES', 'TX_TMUTCD_6_TEMPORARY_TRAFFIC_CONTROL'],
    lessons: ['tx-rail-light-rail-work-zones'],
  },
  {
    domain: 'Night driving and lights',
    officialSource: 'Transportation Code §§ 541.401, 547.302, 547.333',
    ruleIds: ['TX_TN_547_302_LIGHTS_REQUIRED', 'TX_TN_547_333_DIM_HIGH_BEAMS'],
    lessons: ['tx-driving-after-dark'],
  },
  {
    domain: 'Weather and flooded roads',
    officialSource: 'Texas MUTCD § 2C.34',
    ruleIds: ['TX_TMUTCD_2C_34_WEATHER_SIGNS'],
    lessons: ['tx-weather-and-mountain-roads', 'tx-skids-and-emergencies'],
  },
  {
    domain: 'Crashes, reporting and financial responsibility',
    officialSource: 'Transportation Code ch. 550, ch. 601',
    ruleIds: [
      'TX_TN_550_021_022_CRASH_DUTIES',
      'TX_TN_550_023_INFORMATION_AND_AID',
      'TX_TN_550_024_025_UNATTENDED_VEHICLE_PROPERTY',
      'TX_TN_550_026_IMMEDIATE_REPORT',
      'TX_TN_550_062_OFFICER_REPORT',
      'TX_TN_601_051_072_FINANCIAL_RESPONSIBILITY',
    ],
    lessons: ['tx-crashes-and-insurance'],
  },
  {
    domain: 'Distraction, fatigue and reckless driving',
    officialSource: 'Transportation Code §§ 545.401, 545.424, 545.425, 545.4251, 547.611',
    ruleIds: [
      'TX_TN_545_4251_TEXTING_BAN',
      'TX_TN_545_425_SCHOOL_CROSSING_ZONE_PHONES',
      'TX_TN_545_401_RECKLESS_DRIVING',
      'TX_TN_547_611_VIDEO_DISPLAYS',
    ],
    lessons: ['tx-distraction-and-fatigue'],
  },
  {
    domain: 'Alcohol, drugs and chemical testing',
    officialSource: 'Penal Code ch. 49; Alcoholic Beverage Code § 106.041; Transportation Code chs. 524, 724',
    ruleIds: [
      'TX_PE_49_01_04_DWI',
      'TX_PE_49_031_OPEN_CONTAINER',
      'TX_AL_106_041_MINOR_DUI',
      'TX_TN_724_011_035_IMPLIED_CONSENT_REFUSAL',
      'TX_TN_524_022_ALR_SUSPENSION',
    ],
    lessons: ['tx-alcohol-drugs-dui'],
  },
  {
    domain: 'Occupant protection',
    officialSource: 'Transportation Code §§ 545.412–545.414',
    ruleIds: [
      'TX_TN_545_413_SAFETY_BELTS',
      'TX_TN_545_412_CHILD_SAFETY_SEATS',
      'TX_TN_545_414_OPEN_TRUCK_BEDS',
      'TX_HANDBOOK_CHILD_LEFT_IN_VEHICLE',
    ],
    lessons: ['tx-seat-belts-child-safety'],
  },
  {
    domain: 'Vehicle equipment and loads',
    officialSource: 'Transportation Code ch. 547; § 545.417',
    ruleIds: [
      'TX_TN_547_EQUIPMENT_BASICS',
      'TX_TN_545_417_VIEW_OBSTRUCTION',
      'TX_TN_547_382_PROJECTING_LOADS',
      'TX_TXDMV_INSPECTION_REPLACEMENT',
    ],
    lessons: ['tx-equipment-loads-towing'],
  },
  {
    domain: 'Learner license, examination and driver education',
    officialSource: 'Transportation Code §§ 521.161, 521.1601, 521.1655, 521.222',
    ruleIds: [
      'TX_TN_521_222_LEARNER_LICENSE',
      'TX_TN_521_1601_DRIVER_EDUCATION_UNDER_25',
      'TX_TN_521_161_EXAMINATION',
      'TX_HANDBOOK_KNOWLEDGE_TEST_AND_ITD',
    ],
    lessons: ['tx-permit-and-knowledge-test'],
  },
  {
    domain: 'Drivers under 18',
    officialSource: 'Transportation Code §§ 521.204, 545.424',
    ruleIds: ['TX_TN_521_204_PROVISIONAL_CLASS_C', 'TX_TN_545_424_UNDER_18_RESTRICTIONS'],
    lessons: ['tx-drivers-under-18'],
  },
  {
    domain: 'Licenses, residency, registration and title',
    officialSource: 'Transportation Code §§ 501.145, 501.147, 502.040, 521.021, 521.025, 521.029, 521.054',
    ruleIds: [
      'TX_TN_521_021_025_LICENSE_REQUIRED_CARRIED',
      'TX_TN_521_029_NEW_RESIDENT_90_DAYS',
      'TX_TN_521_054_ADDRESS_CHANGE_30_DAYS',
      'TX_TN_502_040_REGISTRATION_30_DAYS',
      'TX_TN_501_145_147_TITLE_TRANSFER',
    ],
    lessons: ['tx-licenses-and-registration'],
  },
  {
    domain: 'Suspensions, penalties and police stops',
    officialSource: 'Transportation Code §§ 521.246, 521.292, 521.342, 545.421',
    ruleIds: [
      'TX_TN_521_292_SUSPENSION_GROUNDS',
      'TX_HANDBOOK_NO_POINT_SYSTEM',
      'TX_TN_521_246_IGNITION_INTERLOCK',
      'TX_TN_545_421_FLEEING_POLICE',
      'TX_TN_521_342_UNDER_21_ALCOHOL_SUSPENSION',
    ],
    lessons: ['tx-penalties-and-points'],
  },
];
