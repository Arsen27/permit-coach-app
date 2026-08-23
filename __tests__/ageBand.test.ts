import {
  loadOnboardingAnswers,
  migrateLegacyAgeBand,
  saveOnboardingAnswers,
} from '@/lib/onboardingPrefs';
import { ONBOARDING_QUESTIONS } from '@/screens/onboarding/content';

const AsyncStorage =
  require('@react-native-async-storage/async-storage').default;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('age band question', () => {
  const ageBand = ONBOARDING_QUESTIONS.find(
    question => question.id === 'ageBand',
  )!;

  it('starts at 13–17 and has no band that could include under-13s', () => {
    const ids = ageBand.options.map(option => option.id);
    expect(ids).toContain('13-17');
    expect(ids).not.toContain('under-18');
    const labels = ageBand.options.map(option => option.label);
    expect(labels).toContain('13 – 17');
    expect(labels.join(' ')).not.toContain('Under');
  });

  it('migrates a stored under-18 answer to 13-17 without dropping the rest', async () => {
    await saveOnboardingAnswers({
      reason: 'first-license',
      permitStatus: 'studying',
      testHistory: 'first-attempt',
      level: 'basics',
      ageBand: 'under-18',
      testDate: 'unscheduled',
    });
    await migrateLegacyAgeBand();
    const migrated = await loadOnboardingAnswers();
    expect(migrated?.ageBand).toBe('13-17');
    expect(migrated?.reason).toBe('first-license');

    // Any other value is left alone.
    await migrateLegacyAgeBand();
    expect((await loadOnboardingAnswers())?.ageBand).toBe('13-17');
  });

  it('does nothing when no answers are stored yet', async () => {
    await migrateLegacyAgeBand();
    expect(await loadOnboardingAnswers()).toBeNull();
  });
});
