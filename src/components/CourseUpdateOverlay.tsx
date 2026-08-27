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
import type { CourseOffer } from '@/data/course/updater';

export type CourseUpdatePhase =
  | 'idle'
  | 'offer'
  | 'downloading'
  | 'done'
  | 'failed';

type CourseUpdateOverlayProps = {
  phase: CourseUpdatePhase;
  progress: number;
  // The opt-in course waiting for consent; rendered only in the offer phase.
  offer?: CourseOffer | null;
  onAcceptOffer?: () => void;
  onDeclineOffer?: () => void;
};

// The raw progress ticks once per fetched document and documents land in
// bursts, so a ring that snaps to each tick reads as broken. The displayed
// value trails the newest target instead (the BuildingScreen easing), which
// sweeps through the gaps; 'done' fills fast so the checkmark lands on a
// completed ring rather than cutting it off mid-arc.
const TICK_MS = 50;
const EASE_DOWNLOADING = 0.14;
const EASE_DONE = 0.35;
// Close enough to stop chasing — also what makes the label settle on the
// exact target instead of hovering one percent under it.
const SNAP = 0.002;
// A ring at true zero looks stalled before the first document lands.
const FLOOR = 0.06;

// The sheet for course updates that actually involve the user: a download in
// flight, its outcome, or an opt-in offer of a fundamentally new course. The
// far more common check — the server has nothing newer — never reaches this,
// so a normal launch stays untouched.
//
// The ring and the success disc are both 62px, so settling into the
// confirmation swaps the mark without moving the title under it.
const CourseUpdateOverlay: React.FC<CourseUpdateOverlayProps> = ({
  phase,
  progress,
  offer,
  onAcceptOffer,
  onDeclineOffer,
}) => {
  const insets = useSafeAreaInsets();

  const [shown, setShown] = useState(0);
  // Read by the ticker so target changes never re-arm the interval.
  const targetRef = useRef(0);
  targetRef.current = phase === 'done' ? 1 : Math.max(progress, FLOOR);

  useEffect(() => {
    if (phase === 'idle') {
      setShown(0);
      return undefined;
    }
    if (phase === 'failed' || phase === 'offer') {
      // No ring on screen; nothing to animate.
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

  // The confirmation waits for the fill: 'done' first sweeps the ring to
  // full, then the checkmark takes its place.
  const confirmed = phase === 'done' && shown >= 1;

  return (
    <Modal
      visible={phase !== 'idle'}
      animationType="fade"
      // The offer is declinable; every other phase has no coherent screen to
      // return to until the update settles, so back does nothing there.
      onRequestClose={phase === 'offer' ? onDeclineOffer : () => undefined}
    >
      <Sheet style={{ paddingBottom: insets.bottom + 24 }}>
        <SheetMiddle>
          {phase === 'offer' ? (
            <>
              <SheetTitle>A new course is ready</SheetTitle>
              {offer?.notes ? <SheetBody>{offer.notes}</SheetBody> : null}
              <SheetBody>
                Your current course keeps working as it is. Starting the new one
                clears your course progress — lessons and module tests begin
                fresh.
              </SheetBody>
            </>
          ) : confirmed ? (
            <>
              <SheetMark tone="success" />
              <SheetTitle>Course updated</SheetTitle>
              <SheetBody>
                You have the newest lessons and questions. Your progress is
                exactly where you left it.
              </SheetBody>
            </>
          ) : phase === 'failed' ? (
            <>
              <SheetMark tone="error" />
              <SheetTitle>Update interrupted</SheetTitle>
              <SheetBody>
                The download could not finish. Your course is untouched — we
                will try again automatically.
              </SheetBody>
            </>
          ) : (
            <>
              <ProgressRing size={62} thickness={5} progress={shown}>
                <RingLabel>{Math.round(shown * 100)}</RingLabel>
              </ProgressRing>
              <SheetTitle>Updating your course</SheetTitle>
              <SheetBody>
                Downloading the newest lessons and questions. This only takes a
                moment.
              </SheetBody>
            </>
          )}
        </SheetMiddle>

        {phase === 'offer' && (
          <>
            <PrimaryButton
              label="Start the new course"
              onPress={onAcceptOffer ?? (() => undefined)}
            />
            <DeclineAction
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={onDeclineOffer}
            >
              <DeclineLabel>Not now</DeclineLabel>
            </DeclineAction>
          </>
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

const DeclineAction = styled.Pressable`
  align-items: center;
  padding: 16px 0 0;
`;

const DeclineLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 14px;
  color: ${({ theme }) => theme.colors.muted};
`;

export default CourseUpdateOverlay;
