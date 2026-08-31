import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import { useAuth } from '@/auth/AuthProvider';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import ProgressRing from '@/components/ProgressRing';
import ProgressTrack from '@/components/ProgressTrack';
import { courseIdForState } from '@/data/course';
import { courseStore } from '@/data/course/store';
import { installCourse } from '@/data/course/useCourseInstall';
import { findState } from '@/data/states';
import { isServerConfigured } from '@/lib/serverConfig';
import { usePurchases } from '@/purchases/PurchasesProvider';
import { useAppState } from '@/state/AppState';

import { OnboardingParamList } from './types';
import { Kicker, StepScreen, StepTitle, useToggle } from './ui';

type BuildingScreenProps = NativeStackScreenProps<
  OnboardingParamList,
  'Building'
>;

const CHECKLIST = [
  'Reviewing your answers',
  'Picking your first unit',
  'Scheduling mistake reviews',
  'Calibrating the exam simulator',
];

const THRESHOLDS = [0.18, 0.45, 0.7, 0.92];

// Minimum time the loader stays on screen so the checklist reads as real
// work even when the course is already on the device.
const MIN_RUN_MS = 2400;

// Why the download did not land. Each gets its own words below: offline is
// the one the learner can fix by finding a connection, and the copy has to
// carry the promise that internet is needed once, not every time.
type Failure = 'offline' | 'failed' | 'app-update-required';
type Phase = 'running' | Failure;

const FAILURE_COPY: Record<Failure, (stateName: string) => string> = {
  offline: stateName =>
    `You're offline. Downloading your ${stateName} course for the first time needs an internet connection — after that, the whole course works offline.`,
  failed: () =>
    'The download could not finish. Check your connection and try again — nothing on your phone was changed.',
  'app-update-required': stateName =>
    `This version of the app is too old for the ${stateName} course. Install the latest update from the store, then try again.`,
};

// The designed loader is the real first-launch course download: nothing ships
// in the binary, so the learner's state course comes from the content server
// here, before the paywall. The bar eases toward actual fetch progress and
// only completes once the course is committed — there is no continuing
// without it. Replaces itself with the step that follows, so back skips it.
const BuildingScreen: React.FC<BuildingScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { user, lessonScores, topicScores, resetLessons, resetTopics } =
    useAppState();
  const { purchasesEnabled, plusActive } = usePurchases();
  const stateName = findState(user.stateCode).name;
  const courseId = courseIdForState(user.stateCode);

  const [phase, setPhase] = useState<Phase>('running');
  const [shown, setShown] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const progressRef = useRef({ lessonScores, topicScores });
  progressRef.current = { lessonScores, topicScores };

  const settledRef = useRef<'ok' | Failure | null>(null);
  const doneRef = useRef(false);

  // The loader hands off to the paywall step, which hands on to the reminders
  // sheet. Both are replace()d in, so back never lands on the finished loader.
  //
  // The paywall is a screen now rather than presentPaywallIfNeeded, and that
  // "if needed" was doing real work: skipping the paywall for anyone who
  // already holds Plus. Nothing in the component does that, so the check has
  // to happen before we navigate — otherwise a returning subscriber gets sold
  // what they already own.
  const finish = useCallback(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    if (!purchasesEnabled) {
      navigation.replace('Reminders');
      return;
    }
    if (plusActive === true) {
      // Same funnel shape the imperative API reported for this case.
      track('paywall_presented', { source: 'onboarding' });
      track('paywall_closed', {
        source: 'onboarding',
        result: 'NOT_PRESENTED',
      });
      navigation.replace('Reminders');
      return;
    }
    navigation.replace('Paywall');
  }, [navigation, purchasesEnabled, plusActive]);

  useEffect(() => {
    settledRef.current = null;
    setShown(0);
    setPhase('running');

    const settle = async (): Promise<'ok' | Failure> => {
      const stored = await courseStore.hydrateCourse(courseId);
      // Under the lazy model a download is the outline and the bank; a course
      // already on the phone still gets a refresh, best-effort.
      const result = await installCourse(courseId);
      if (stored != null) {
        return 'ok';
      }
      return result.status === 'installed' ? 'ok' : result.status;
    };
    settle().then(
      outcome => {
        settledRef.current = outcome;
      },
      () => {
        settledRef.current = 'failed';
      },
    );

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / MIN_RUN_MS;
      // The download is two small documents now; the ring paces the step
      // itself rather than pretending to count bytes.
      const target =
        settledRef.current === 'ok'
          ? Math.min(1, elapsed)
          : Math.min(0.6, elapsed, 0.95);

      const settled = settledRef.current;
      if (settled != null && settled !== 'ok') {
        clearInterval(timer);
        track('onboarding_course_built', {
          outcome: settled === 'offline' ? 'offline' : 'failed',
          attempt: attempt + 1,
          duration_ms: Date.now() - startedAt,
        });
        setPhase(settled);
        return;
      }

      setShown(prev => {
        const next = prev + (target - prev) * 0.16;
        if (settledRef.current === 'ok' && next > 0.985) {
          clearInterval(timer);
          track('onboarding_course_built', {
            outcome: 'ok',
            attempt: attempt + 1,
            duration_ms: Date.now() - startedAt,
          });
          finish();
          return 1;
        }
        return next;
      });
    }, 80);

    return () => clearInterval(timer);
  }, [attempt, courseId, finish, resetLessons, resetTopics, userId]);

  const pct = Math.round(shown * 100);
  const activeIndex = THRESHOLDS.findIndex(threshold => shown < threshold);

  const itemState = (index: number): 'done' | 'active' | 'pending' => {
    if (activeIndex === -1 || index < activeIndex) {
      return 'done';
    }
    return index === activeIndex ? 'active' : 'pending';
  };

  const ringProgress = (index: number): number => {
    const from = index === 0 ? 0 : THRESHOLDS[index - 1];
    return (shown - from) / (THRESHOLDS[index] - from);
  };

  return (
    <StepScreen>
      <Body style={{ paddingTop: insets.top + 120 }}>
        <Kicker>Setting up</Kicker>
        <StepTitle style={{ marginTop: 8 }}>
          Building your {stateName} course
        </StepTitle>

        <Checklist>
          {CHECKLIST.map((label, index) => (
            <ChecklistItem
              key={label}
              label={label}
              index={index}
              state={itemState(index)}
              ringProgress={ringProgress(index)}
            />
          ))}
        </Checklist>

        {phase === 'running' ? (
          <ProgressBlock>
            <ProgressTrack progress={shown} height={6} />
            <ProgressLabel>
              {pct}% — {pct < 50 ? 'setting things up' : 'almost there'}
            </ProgressLabel>
          </ProgressBlock>
        ) : (
          <FailedLabel>{FAILURE_COPY[phase](stateName)}</FailedLabel>
        )}
      </Body>

      {phase !== 'running' && (
        <Dock style={{ bottom: insets.bottom + 22 }}>
          <PrimaryButton
            label="Try again"
            onPress={() => setAttempt(current => current + 1)}
          />
        </Dock>
      )}
    </StepScreen>
  );
};

const Body = styled.View`
  flex: 1;
  padding: 0 24px;
`;

type ChecklistItemProps = {
  label: string;
  index: number;
  state: 'done' | 'active' | 'pending';
  ringProgress: number;
};

// Each row slides in on its own beat, and the three status marks cross-fade
// into each other rather than swapping — the checklist is the only thing
// moving on this screen, so the transitions carry it.
const ChecklistItem: React.FC<ChecklistItemProps> = ({
  label,
  index,
  state,
  ringProgress,
}) => {
  const theme = useTheme();
  const entered = useRef(new Animated.Value(0)).current;
  const done = useToggle(state === 'done', false);
  const active = useToggle(state === 'active', false);

  useEffect(() => {
    const animation = Animated.timing(entered, {
      toValue: 1,
      duration: 320,
      delay: index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entered, index]);

  return (
    <Animated.View
      style={{
        opacity: entered,
        transform: [
          {
            translateY: entered.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      <ChecklistRow>
        <MarkSlot>
          <PendingCircle />
          <MarkLayer style={{ opacity: active }}>
            <ProgressRing size={26} thickness={4} progress={ringProgress} />
          </MarkLayer>
          <MarkLayer style={{ opacity: done, transform: [{ scale: done }] }}>
            <DoneCircle>
              <Icon name="check" size={11} color={theme.colors.bg} />
            </DoneCircle>
          </MarkLayer>
        </MarkSlot>
        <ChecklistLabel $pending={state === 'pending'}>{label}</ChecklistLabel>
      </ChecklistRow>
    </Animated.View>
  );
};

const MarkSlot = styled.View`
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
`;

const MarkLayer = styled(Animated.View)`
  position: absolute;
  top: 0;
  left: 0;
`;

const Checklist = styled.View`
  margin-top: 30px;
  gap: 18px;
`;

const ChecklistRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 13px;
`;

const DoneCircle = styled.View`
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.accent};
  align-items: center;
  justify-content: center;
`;

const PendingCircle = styled.View`
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  border: 1.5px solid ${({ theme }) => theme.colors.line};
`;

const ChecklistLabel = styled.Text<{ $pending: boolean }>`
  ${({ theme, $pending }) =>
    $pending ? theme.fonts.medium : theme.fonts.semiBold}
  font-size: 15px;
  color: ${({ theme, $pending }) =>
    $pending ? theme.colors.dim : theme.colors.ink};
`;

const ProgressBlock = styled.View`
  margin-top: 44px;
  gap: 10px;
`;

const ProgressLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const FailedLabel = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin-top: 44px;
  font-size: 14.5px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.body};
`;

const Dock = styled.View`
  position: absolute;
  left: 25px;
  right: 25px;
`;

export default BuildingScreen;
