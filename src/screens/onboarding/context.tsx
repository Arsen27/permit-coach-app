import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { track } from '@/analytics';
import { markOnboardingDone } from '@/lib/onboardingFlag';
import {
  ReminderPrefs,
  saveOnboardingAnswers,
  saveReminderPrefs,
} from '@/lib/onboardingPrefs';

// Onboarding state lives above the step navigator: the steps are separate
// routes (so the system back button works), but the answers they collect and
// the exit path belong to the flow as a whole.

// A booked date, an explicit "no date yet", or nothing chosen.
export type TestDateAnswer = Date | 'unscheduled' | null;

type OnboardingValue = {
  answers: Record<string, string[]>;
  toggleOption: (questionId: string, optionId: string, multi: boolean) => void;
  testDate: TestDateAnswer;
  setTestDate: (value: TestDateAnswer) => void;
  persistAnswers: () => void;
  finish: (prefs: ReminderPrefs | null) => Promise<void>;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

const pad = (value: number): string => String(value).padStart(2, '0');

// Local date parts, matching the streak store: the calendar day the learner
// picked, not a UTC instant that can land on the day before.
const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

type OnboardingProviderProps = {
  onDone: () => void;
  children: React.ReactNode;
};

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  onDone,
  children,
}) => {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [testDate, setTestDate] = useState<TestDateAnswer>(null);

  // How long the whole flow took, reported with onboarding_completed — the
  // number that says whether the ladder is too long.
  const startedAt = useRef(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    track('onboarding_started');
  }, []);

  const toggleOption = useCallback(
    (questionId: string, optionId: string, multi: boolean) => {
      setAnswers(current => {
        const picked = current[questionId] ?? [];
        const next = multi
          ? picked.includes(optionId)
            ? picked.filter(entry => entry !== optionId)
            : [...picked, optionId]
          : [optionId];
        return { ...current, [questionId]: next };
      });
    },
    [],
  );

  const persistAnswers = useCallback(() => {
    // Read through the setter so the latest answers are captured without
    // making this callback depend on (and re-create with) every keystroke.
    setAnswers(current => {
      saveOnboardingAnswers({
        reason: current.reason?.[0] ?? null,
        permitStatus: current.permitStatus?.[0] ?? null,
        testHistory: current.testHistory?.[0] ?? null,
        level: current.level?.[0] ?? null,
        ageBand: current.ageBand?.[0] ?? null,
        testDate:
          testDate instanceof Date
            ? isoDate(testDate)
            : testDate === 'unscheduled'
            ? 'unscheduled'
            : null,
      }).catch(() => undefined);
      return current;
    });
  }, [testDate]);

  const finish = useCallback(
    async (prefs: ReminderPrefs | null) => {
      if (prefs != null) {
        track('onboarding_reminders_saved', {
          day_count: prefs.days.length,
          hour: prefs.hour,
          minute: prefs.minute,
        });
        await saveReminderPrefs(prefs).catch(() => undefined);
      }
      // No state code here: it rides on every event as a super property.
      track('onboarding_completed', {
        duration_ms: Date.now() - startedAt.current,
        questions_answered: Object.values(answersRef.current).filter(
          picked => picked.length > 0,
        ).length,
      });
      await markOnboardingDone();
      onDone();
    },
    [onDone],
  );

  const value = useMemo<OnboardingValue>(
    () => ({
      answers,
      toggleOption,
      testDate,
      setTestDate,
      persistAnswers,
      finish,
    }),
    [answers, toggleOption, testDate, persistAnswers, finish],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingValue => {
  const value = useContext(OnboardingContext);
  if (value == null) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return value;
};
