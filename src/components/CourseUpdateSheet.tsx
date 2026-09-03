import React, { useEffect, useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import Icon from '@/components/Icon';
import type { IconName } from '@/assets/icons';
import PrimaryButton from '@/components/PrimaryButton';
import { rgba } from '@/theme';

// The three sheets a course update can raise, in the shape the daily streak
// sheet established: a dimmed screen behind, a 28px bottom sheet, a 96px
// medallion, one headline, one paragraph, a divider-separated detail block,
// one filled action and one quiet way out.
//
// Only the medallion and the detail block change register: amber when the
// mistake was ours, plain ink when the law moved under the learner, and for
// the one that throws progress away, a red box listing exactly what goes.

export type CourseUpdateVariant = 'apology' | 'rules' | 'offer';

// What updating costs, in the learner's own numbers. Only what the accept
// actually clears is listed — the streak survives a course change, so it is
// said out loud rather than counted among the losses.
export type UpdateCost = {
  lessonsDone: number;
  points: number;
  bestExam: number | null;
  note: string;
  keeps: string;
};

type CourseUpdateSheetProps = {
  visible: boolean;
  variant: CourseUpdateVariant;
  eyebrow: string;
  title: string;
  body: string;
  // The reassurance lines under the paragraph; empty for the offer, which
  // carries the cost block instead.
  points?: string[];
  cost?: UpdateCost;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  // Fired when the sheet has finished dismissing (iOS). The accept flow
  // waits for it before presenting the download overlay: presenting one
  // modal while another is still dismissing leaves iOS with a dead black
  // window until the app is relaunched.
  onDismissed?: () => void;
  // Destructive actions hold the door: the filled button stays grey for this
  // many seconds, counting down in its label, so the choice cannot be a
  // reflex tap. The countdown restarts each time the sheet is shown.
  armSeconds?: number;
};

const MEDALLION: Record<CourseUpdateVariant, IconName> = {
  apology: 'triangle-exclamation',
  rules: 'file-text',
  offer: 'list-check',
};

const CourseUpdateSheet: React.FC<CourseUpdateSheetProps> = ({
  visible,
  variant,
  eyebrow,
  title,
  body,
  points = [],
  cost,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onDismissed,
  armSeconds = 0,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState(armSeconds);
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    setSecondsLeft(armSeconds);
    if (armSeconds <= 0) {
      return undefined;
    }
    const timer = setInterval(
      () => setSecondsLeft(prev => Math.max(0, prev - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [visible, armSeconds]);
  // Amber is ours to own — we got it wrong. A rule that changed under the
  // learner is nobody's fault, so it stays in the app's own ink.
  const accent =
    variant === 'apology' ? theme.colors.warning : theme.colors.ink;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onSecondary}
      onDismiss={onDismissed}
    >
      <Backdrop onPress={onSecondary} />
      <Sheet style={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <Grabber />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          <Hero>
            <Medallion
              style={{
                backgroundColor:
                  variant === 'apology'
                    ? rgba(theme.colors.warning, 0.12)
                    : theme.colors.faint,
              }}
            >
              <Icon name={MEDALLION[variant]} size={40} color={accent} />
            </Medallion>
            <Eyebrow
              style={{
                color:
                  variant === 'apology'
                    ? theme.colors.warningText
                    : theme.colors.muted,
              }}
            >
              {eyebrow}
            </Eyebrow>
            <Title>{title}</Title>
            <Body>{body}</Body>
          </Hero>

          {points.length > 0 && (
            <Points>
              {points.map(point => (
                <PointRow key={point}>
                  <PointDot
                    style={{ backgroundColor: rgba(theme.colors.done, 0.14) }}
                  >
                    <Icon name="check" size={10} color={theme.colors.done} />
                  </PointDot>
                  <PointText>{point}</PointText>
                </PointRow>
              ))}
            </Points>
          )}

          {cost != null && (
            <>
              <Cost>
                <CostHead>
                  <Icon
                    name="triangle-exclamation"
                    size={16}
                    color={theme.colors.wrong}
                  />
                  <CostTitle>Updating erases everything below</CostTitle>
                </CostHead>
                <CostStats>
                  <CostStat>
                    <CostValue>{cost.lessonsDone}</CostValue>
                    <CostLabel>Lessons done</CostLabel>
                  </CostStat>
                  <CostStat>
                    <CostValue>{cost.points}</CostValue>
                    <CostLabel>Points</CostLabel>
                  </CostStat>
                  {cost.bestExam != null && (
                    <CostStat>
                      <CostValue>{cost.bestExam}%</CostValue>
                      <CostLabel>Best exam</CostLabel>
                    </CostStat>
                  )}
                </CostStats>
                <CostNote>{cost.note}</CostNote>
              </Cost>
              <Keeps>
                <Icon name="lock" size={16} color={theme.colors.dim2} />
                <KeepsText>{cost.keeps}</KeepsText>
              </Keeps>
            </>
          )}
        </ScrollView>

        <PrimaryButton
          label={
            secondsLeft > 0 ? `${primaryLabel} · ${secondsLeft}` : primaryLabel
          }
          onPress={onPrimary}
          disabled={secondsLeft > 0}
        />
        <Secondary
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          onPress={onSecondary}
        >
          <SecondaryLabel>{secondaryLabel}</SecondaryLabel>
        </Secondary>
      </Sheet>
    </Modal>
  );
};

export default CourseUpdateSheet;

const Backdrop = styled.Pressable`
  flex: 1;
  background-color: rgba(24, 24, 27, 0.42);
`;

const Sheet = styled.View`
  max-height: 88%;
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  background-color: ${({ theme }) => theme.colors.bg};
  padding: 10px 22px 0;
`;

const Grabber = styled.View`
  width: 38px;
  height: 5px;
  border-radius: 3px;
  background-color: ${({ theme }) => theme.colors.dim2};
  align-self: center;
  margin-bottom: 22px;
`;

const Hero = styled.View`
  align-items: center;
  margin-bottom: 22px;
`;

const Medallion = styled.View`
  width: 96px;
  height: 96px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
`;

const Eyebrow = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  margin-bottom: 10px;
  font-size: 10.5px;
  letter-spacing: 1.2px;
  text-align: center;
`;

const Title = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 8px;
  font-size: 23px;
  line-height: 28px;
  letter-spacing: -0.7px;
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};
`;

const Body = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13.5px;
  line-height: 21px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

const Points = styled.View`
  gap: 10px;
  padding-top: 16px;
  margin-bottom: 20px;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colors.line};
`;

const PointRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 11px;
`;

const PointDot = styled.View`
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
`;

const PointText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  flex: 1;
  font-size: 13.5px;
  line-height: 19px;
  letter-spacing: -0.15px;
  color: ${({ theme }) => theme.colors.strong};
`;

const Cost = styled.View`
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 18px;
  border-width: 1px;
  border-color: ${({ theme }) => rgba(theme.colors.wrong, 0.22)};
  background-color: ${({ theme }) => rgba(theme.colors.wrong, 0.06)};
`;

const CostHead = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`;

const CostTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  flex: 1;
  font-size: 13.5px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.wrongText};
`;

const CostStats = styled.View`
  flex-direction: row;
`;

const CostStat = styled.View`
  flex: 1;
`;

const CostValue = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 18px;
  letter-spacing: -0.4px;
  color: ${({ theme }) => theme.colors.wrongText};
  font-variant: tabular-nums;
`;

const CostLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  margin-top: 1px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted};
`;

const CostNote = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin-top: 10px;
  font-size: 12.5px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.muted};
`;

const Keeps = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 18px;
  border-radius: 14px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const KeepsText = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  flex: 1;
  font-size: 12.5px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.muted};
`;

const Secondary = styled.Pressable`
  align-items: center;
  padding: 14px 0 0;
`;

const SecondaryLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 14px;
  color: ${({ theme }) => theme.colors.muted};
`;
