// One route per onboarding step, so back is the platform's own navigation
// control instead of a hand-drawn chevron.
export type OnboardingParamList = {
  StateSelect: undefined;
  Question: { index: number };
  TestDate: undefined;
  Showcase: { index: number };
  Building: undefined;
  Paywall: undefined;
  Reminders: undefined;
};
