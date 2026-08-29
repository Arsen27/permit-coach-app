import React, { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled from 'styled-components/native';

import PrimaryButton from '@/components/PrimaryButton';
import ProgressRing from '@/components/ProgressRing';
import {
  Sheet,
  SheetBody,
  SheetMark,
  SheetMiddle,
  SheetTitle,
} from '@/components/resultSheet';
import type { CourseInstallPhase } from '@/data/course/useCourseInstall';

export type CourseInstallViewPhase = Exclude<CourseInstallPhase, 'idle'>;

type CourseInstallViewProps = {
  phase: CourseInstallViewPhase;
  progress: number;
  stateName: string;
  onRetry: () => void;
  // Present when the learner can walk away from a failed download (a state
  // switch keeps the old course); absent when there is nothing to go back to.
  onCancel?: () => void;
};

type Copy = {
  title: string;
  body: string;
  tone: 'success' | 'error' | null;
};

// The words for each outcome of a first download. The offline text carries
// the one promise that matters here: internet is needed once, not every time.
export const courseInstallCopy = (
  phase: CourseInstallViewPhase,
  stateName: string,
): Copy => {
  switch (phase) {
    case 'downloading':
      return {
        title: `Downloading your ${stateName} course`,
        body: 'A one-time download of every lesson, question and illustration. Once it is on your phone, the whole course works offline.',
        tone: null,
      };
    case 'done':
      return {
        title: 'Course ready',
        body: `Your ${stateName} course is on this phone and works offline from here on.`,
        tone: 'success',
      };
    case 'offline':
      return {
        title: "You're offline",
        body: `The first download of your ${stateName} course needs an internet connection. After that, everything works offline — connect once and try again.`,
        tone: 'error',
      };
    case 'app-update-required':
      return {
        title: 'Update the app first',
        body: `This version of the app is too old for the ${stateName} course. Install the latest update from the store, then try again.`,
        tone: 'error',
      };
    case 'failed':
      return {
        title: 'Download interrupted',
        body: 'The download could not finish. Nothing on your phone was changed — check your connection and try again.',
        tone: 'error',
      };
  }
};

// The ring trails the raw per-document ticks (same easing as the update
// sheet) so a burst of small documents reads as one sweep, not a stutter.
const TICK_MS = 50;
const EASE_DOWNLOADING = 0.14;
const EASE_DONE = 0.35;
const SNAP = 0.002;
const FLOOR = 0.06;

// The body of a first-download surface: ring while fetching, then either the
// success disc or the failure with its reason and a retry. Shared by the
// modal sheet (state switch in Settings) and the full-screen gate (an
// onboarded device with no course), so both say the same thing.
export const CourseInstallView: React.FC<CourseInstallViewProps> = ({
  phase,
  progress,
  stateName,
  onRetry,
  onCancel,
}) => {
  const [shown, setShown] = useState(0);
  const targetRef = useRef(0);
  targetRef.current = phase === 'done' ? 1 : Math.max(progress, FLOOR);

  useEffect(() => {
    if (phase !== 'downloading' && phase !== 'done') {
      return undefined;
    }
    const timer = setInterval(() => {
      setShown(prev => {
        const target = targetRef.current;
        const factor = phase === 'done' ? EASE_DONE : EASE_DOWNLOADING;
        const next = prev + (target - prev) * factor;
        return target - next < SNAP ? target : next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [phase]);

  const copy = courseInstallCopy(phase, stateName);
  // 'done' first sweeps the ring to full, then the checkmark takes its place.
  const confirmed = phase === 'done' && shown >= 1;
  const failed = copy.tone === 'error';
  const canRetry = phase === 'offline' || phase === 'failed';

  return (
    <>
      <SheetMiddle>
        {confirmed ? (
          <SheetMark tone="success" />
        ) : failed ? (
          <SheetMark tone="error" />
        ) : (
          <ProgressRing size={62} thickness={5} progress={shown}>
            <RingLabel>{Math.round(shown * 100)}</RingLabel>
          </ProgressRing>
        )}
        <SheetTitle>{copy.title}</SheetTitle>
        <SheetBody>{copy.body}</SheetBody>
      </SheetMiddle>

      {failed && (
        <>
          {canRetry && <PrimaryButton label="Try again" onPress={onRetry} />}
          {onCancel != null && (
            <CancelAction
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
            >
              <CancelLabel>
                {phase === 'app-update-required' ? 'Not now' : 'Cancel'}
              </CancelLabel>
            </CancelAction>
          )}
        </>
      )}
    </>
  );
};

type CourseInstallSheetProps = {
  phase: CourseInstallPhase;
  progress: number;
  stateName: string;
  onRetry: () => void;
  onCancel: () => void;
};

// The download sheet a state switch in Settings shows: the new course has to
// be on the phone before the switch happens, so the learner watches it land.
// Only a failure is dismissable — mid-download there is nothing coherent to
// return to, and success closes itself when the switch goes through.
const CourseInstallSheet: React.FC<CourseInstallSheetProps> = ({
  phase,
  progress,
  stateName,
  onRetry,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const dismissable =
    phase === 'offline' ||
    phase === 'failed' ||
    phase === 'app-update-required';

  return (
    <Modal
      visible={phase !== 'idle'}
      animationType="fade"
      onRequestClose={dismissable ? onCancel : () => undefined}
    >
      <Sheet style={{ paddingBottom: insets.bottom + 24 }}>
        {phase !== 'idle' && (
          <CourseInstallView
            phase={phase}
            progress={progress}
            stateName={stateName}
            onRetry={onRetry}
            onCancel={onCancel}
          />
        )}
      </Sheet>
    </Modal>
  );
};

const RingLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 15px;
  color: ${({ theme }) => theme.colors.ink};
  font-variant: tabular-nums;
`;

const CancelAction = styled.Pressable`
  align-items: center;
  padding: 16px 0 0;
`;

const CancelLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 14px;
  color: ${({ theme }) => theme.colors.muted};
`;

export default CourseInstallSheet;
