export type UsState = {
  code: string;
  name: string;
  // Official DMV/DOT domain — the state handbook opens here in the system
  // browser and drives the You-screen subtitle.
  domain: string;
};

// Exactly the states with a shipped course. The pickers (settings and
// onboarding) render this list as-is, so adding a state here without adding
// its course seed would offer content that does not exist — see
// STATE_COURSE_IDS in data/course, which must stay in step.
export const SUPPORTED_STATES: UsState[] = [
  { code: 'CA', name: 'California', domain: 'dmv.ca.gov' },
  { code: 'FL', name: 'Florida', domain: 'flhsmv.gov' },
  { code: 'TX', name: 'Texas', domain: 'dps.texas.gov' },
];

export const findState = (code: string): UsState =>
  SUPPORTED_STATES.find(state => state.code === code) ?? SUPPORTED_STATES[0];
