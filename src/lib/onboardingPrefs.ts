import AsyncStorage from '@react-native-async-storage/async-storage';

// Choices captured during onboarding. Local-only (not synced): nothing on the
// server consumes them yet, and the sync schema stays untouched. Reminder
// prefs are the input for a future notifications feature.

export type OnboardingAnswers = {
  reason: string | null;
  permitStatus: string | null;
  testHistory: string | null;
  level: string | null;
  ageBand: string | null;
  // The booked test date as YYYY-MM-DD, 'unscheduled' when the learner has
  // no date yet, or null when the step was skipped.
  testDate: string | 'unscheduled' | null;
};

// days: 0 = Monday … 6 = Sunday, matching the sheet's chip order.
export type ReminderPrefs = {
  days: number[];
  hour: number;
  minute: number;
};

const ANSWERS_KEY = 'dmv-prep/onboarding-answers/v1';
const REMINDER_KEY = 'dmv-prep/reminder-prefs/v1';

export const saveOnboardingAnswers = async (
  answers: OnboardingAnswers,
): Promise<void> => {
  await AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
};

export const loadOnboardingAnswers =
  async (): Promise<OnboardingAnswers | null> => {
    try {
      const stored = await AsyncStorage.getItem(ANSWERS_KEY);
      return stored == null ? null : (JSON.parse(stored) as OnboardingAnswers);
    } catch {
      return null;
    }
  };

// The age-band answer 'under-18' predates the 13–17 band. Rewriting the
// stored id in place keeps the answer answered — nobody is asked again just
// because the identifier changed.
export const migrateLegacyAgeBand = async (): Promise<void> => {
  const answers = await loadOnboardingAnswers();
  if (answers?.ageBand === 'under-18') {
    await saveOnboardingAnswers({ ...answers, ageBand: '13-17' }).catch(
      () => undefined,
    );
  }
};

export const saveReminderPrefs = async (
  prefs: ReminderPrefs,
): Promise<void> => {
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(prefs));
};
