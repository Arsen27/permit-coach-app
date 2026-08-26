import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { useNavigation } from '@react-navigation/native';

import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { useCourse } from '@/data/course/CourseProvider';
import { Eyebrow } from '@/components/typography';
import { PRACTICE_TOPICS, questionBankIds } from '@/data/practice';
import { RootNavigation } from '@/navigation/types';
import { useAppState } from '@/state/AppState';
import { MasteryState, summarizeBank } from '@/state/questionStats';
import { AppTheme, rgba, shadows } from '@/theme';

// Bank map geometry: 20 squares per row, matching the handoff.
const BANK_COLUMNS = 20;

const MASTERY_LEGEND: { state: MasteryState; label: string }[] = [
  { state: 'mastered', label: 'Mastered' },
  { state: 'seenOnce', label: 'Seen once' },
  { state: 'shaky', label: 'Shaky' },
  { state: 'missed', label: 'Missed' },
];

const masteryColor = (theme: AppTheme, state: MasteryState): string => {
  switch (state) {
    case 'mastered':
      return theme.colors.done;
    // One step lighter than mastered, so the two read as the same family.
    case 'seenOnce':
      return rgba(theme.colors.done, 0.55);
    case 'shaky':
      return theme.colors.warning;
    case 'missed':
      return theme.colors.error;
    default:
      return theme.colors.faint;
  }
};

// Colour of a topic's score bar: the bands the handoff uses for "where you
// stand" (red below half, amber up to the CA pass mark, accent above).
const scoreColor = (theme: AppTheme, percent: number | null): string => {
  if (percent == null) {
    return theme.colors.line;
  }
  if (percent < 50) {
    return theme.colors.error;
  }
  return percent < 83 ? theme.colors.warning : theme.colors.done;
};

type BankCellViewProps = {
  color: string;
};

// One square of the bank map. Memoized: the screen stays mounted behind a
// running quiz and re-renders on every answered question — of the ~hundreds
// of cells only the one whose mastery changed should pay for it.
const BankCellViewComponent: React.FC<BankCellViewProps> = ({ color }) => (
  <BankCell testID="bank-cell">
    <BankFill style={{ backgroundColor: color }} />
  </BankCell>
);

const BankCellView = React.memo(BankCellViewComponent);

const PracticeScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigation>();
  const { bestExam, savedQuestionIds, mistakeIds, topicScores, questionStats } =
    useAppState();
  // Re-derives the bank when the course itself changes (state switch).
  const { bundle } = useCourse();

  const bank = useMemo(
    () => summarizeBank(questionBankIds(), questionStats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questionStats, bundle],
  );

  // The third mode card is a shortcut to wherever the learner is weakest:
  // the lowest-scoring topic, or the first untouched one if nothing is scored
  // yet. Always defined — PRACTICE_TOPICS is never empty.
  const weakestTopic = useMemo(() => {
    const untouched = PRACTICE_TOPICS.find(
      topic => topicScores[topic.id] == null,
    );
    if (untouched != null) {
      return untouched;
    }
    return [...PRACTICE_TOPICS].sort(
      (a, b) => (topicScores[a.id] ?? 0) - (topicScores[b.id] ?? 0),
    )[0];
  }, [topicScores]);

  const weakestScore = topicScores[weakestTopic.id] ?? null;

  return (
    <Screen
      contentContainerStyle={
        Platform.OS === 'ios'
          ? { paddingTop: 10, paddingBottom: 24 }
          : { paddingTop: insets.top + 10, paddingBottom: 110 + insets.bottom }
      }
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Practice" />
      <Lead>Pick how you want to train today.</Lead>

      <ModeGrid>
        <PrimaryMode
          onPress={() => navigation.navigate('Quiz', { mode: 'quickMix' })}
          style={({ pressed }) => [
            shadows.glass,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <ModeHead>
            <ModeTile $bg="rgba(255, 255, 255, 0.22)">
              <Icon name="list-check" size={13} color="#FFFFFF" />
            </ModeTile>
          </ModeHead>
          <PrimaryModeTitle>Quick 10</PrimaryModeTitle>
          <PrimaryModeMeta>Mixed · 4 min</PrimaryModeMeta>
        </PrimaryMode>

        <ModeCard
          onPress={() => navigation.navigate('Quiz', { mode: 'mistakes' })}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ModeHead>
            <ModeTile $bg={rgba(theme.colors.error, 0.09)}>
              <Icon name="xmark" size={13} color={theme.colors.error} />
            </ModeTile>
            {mistakeIds.length > 0 && (
              <ModeCount $color={theme.colors.error}>
                {mistakeIds.length}
              </ModeCount>
            )}
          </ModeHead>
          <ModeTitle>Missed only</ModeTitle>
          <ModeMeta>Until they stick</ModeMeta>
        </ModeCard>

        <ModeCard
          onPress={() =>
            navigation.navigate('Quiz', {
              mode: 'topic',
              topicId: weakestTopic.id,
            })
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ModeHead>
            <ModeTile $bg={rgba(theme.colors.warning, 0.12)}>
              <Icon
                name={weakestTopic.icon}
                size={13}
                color={theme.colors.warning}
              />
            </ModeTile>
          </ModeHead>
          <ModeTitle numberOfLines={1}>{weakestTopic.title}</ModeTitle>
          <ModeMeta>
            {weakestScore == null
              ? 'Not started yet'
              : `Weakest topic · ${weakestScore}%`}
          </ModeMeta>
        </ModeCard>

        <ModeCard
          onPress={() => navigation.navigate('Quiz', { mode: 'saved' })}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ModeHead>
            <ModeTile $bg={theme.colors.faint}>
              <Icon name="bookmark" size={13} color={theme.colors.muted} />
            </ModeTile>
            {savedQuestionIds.length > 0 && (
              <ModeCount $color={theme.colors.muted}>
                {savedQuestionIds.length}
              </ModeCount>
            )}
          </ModeHead>
          <ModeTitle>Saved</ModeTitle>
          <ModeMeta>Your bookmarks</ModeMeta>
        </ModeCard>
      </ModeGrid>

      <ExamBar
        onPress={() => navigation.navigate('Quiz', { mode: 'exam' })}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <ExamBody>
          <ExamTitle>Exam simulator</ExamTitle>
          <ExamMeta>
            46 questions · 60 min
            {bestExam != null ? ` · best ${bestExam}%` : ''}
          </ExamMeta>
        </ExamBody>
        <ExamStart>
          <ExamStartText>Start</ExamStartText>
        </ExamStart>
      </ExamBar>

      <Section>
        <SectionHead>
          <Eyebrow>Your question bank</Eyebrow>
          <BankCount>
            {bank.answered} / {bank.total}
          </BankCount>
        </SectionHead>
        <BankGrid>
          {bank.states.map((state, index) => (
            <BankCellView
              // Position in the bank is the identity here: the list is a fixed
              // ordered map, never reordered or filtered.
              key={index}
              color={masteryColor(theme, state)}
            />
          ))}
        </BankGrid>
        <Legend>
          {MASTERY_LEGEND.map(item => (
            <LegendItem key={item.state}>
              <LegendSwatch
                style={{ backgroundColor: masteryColor(theme, item.state) }}
              />
              <LegendLabel>{item.label}</LegendLabel>
            </LegendItem>
          ))}
        </Legend>
      </Section>

      <Section>
        <Eyebrow style={{ marginBottom: 12 }}>Where you stand</Eyebrow>
        <TopicGrid>
          {PRACTICE_TOPICS.map(topic => {
            const percent = topicScores[topic.id] ?? null;
            return (
              <TopicCard
                key={topic.id}
                onPress={() =>
                  navigation.navigate('Quiz', {
                    mode: 'topic',
                    topicId: topic.id,
                  })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <TopicBar
                  style={{ backgroundColor: scoreColor(theme, percent) }}
                />
                <TopicPercent $muted={percent == null}>
                  {percent == null ? '—' : `${percent}%`}
                </TopicPercent>
                <TopicName numberOfLines={2}>{topic.title}</TopicName>
              </TopicCard>
            );
          })}
        </TopicGrid>
      </Section>
    </Screen>
  );
};

const Screen = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const Lead = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  margin: 0 22px 16px;
  font-size: 14px;
  line-height: 21px;
  color: ${({ theme }) => theme.colors.muted};
`;

const ModeGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 9px;
  padding: 0 22px;
  margin-bottom: 9px;
`;

// Two-up grid: each card takes half the row minus half the gap.
const modeCardBase = `
  width: 48%;
  flex-grow: 1;
  border-radius: 16px;
  padding: 14px 15px;
`;

const ModeCard = styled.Pressable`
  ${modeCardBase}
  border: 1px solid ${({ theme }) => theme.colors.line};
`;

const PrimaryMode = styled.Pressable`
  ${modeCardBase}
  background-color: ${({ theme }) => theme.colors.accent};
`;

const ModeHead = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 14px;
`;

const ModeTile = styled.View<{ $bg: string }>`
  width: 26px;
  height: 26px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  background-color: ${({ $bg }) => $bg};
`;

const ModeCount = styled.Text<{ $color: string }>`
  ${({ theme }) => theme.fonts.extraBold}
  margin-left: auto;
  font-size: 11.5px;
  color: ${({ $color }) => $color};
  font-variant: tabular-nums;
`;

const ModeTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 2px;
  font-size: 15.5px;
  letter-spacing: -0.35px;
  color: ${({ theme }) => theme.colors.ink};
`;

const PrimaryModeTitle = styled(ModeTitle)`
  color: #ffffff;
`;

const ModeMeta = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const PrimaryModeMeta = styled(ModeMeta)`
  color: rgba(255, 255, 255, 0.8);
`;

const ExamBar = styled.Pressable`
  margin: 0 22px 22px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.ink};
  padding: 14px 16px;
  flex-direction: row;
  align-items: center;
  gap: 14px;
`;

const ExamBody = styled.View`
  flex: 1;
`;

const ExamTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 2px;
  font-size: 15.5px;
  letter-spacing: -0.35px;
  color: #ffffff;
`;

const ExamMeta = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.6);
  font-variant: tabular-nums;
`;

const ExamStart = styled.View`
  padding: 10px 18px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const ExamStartText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 12.5px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Section = styled.View`
  padding: 0 22px 22px;
`;

const SectionHead = styled.View`
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const BankCount = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 12px;
  color: ${({ theme }) => theme.colors.strong};
  font-variant: tabular-nums;
`;

const BankGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-bottom: 13px;
`;

// The gap lives inside the cell rather than on the grid, so an exact 1/20
// width always yields 20 columns — with a row gap the count would drift with
// the screen width (21 would fit on a tablet).
const BankCell = styled.View`
  width: ${100 / BANK_COLUMNS}%;
  aspect-ratio: 1;
  padding: 1.5px;
`;

const BankFill = styled.View`
  flex: 1;
  border-radius: 2px;
`;

const Legend = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
`;

const LegendItem = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

const LegendSwatch = styled.View`
  width: 9px;
  height: 9px;
  border-radius: 2px;
`;

const LegendLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const TopicGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 9px;
`;

// Three-up band; the trailing cards keep the column width when the row is
// not full.
const TopicCard = styled.Pressable`
  width: 31%;
  flex-grow: 1;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 14px;
  padding: 12px 13px;
`;

const TopicBar = styled.View`
  height: 4px;
  border-radius: 2px;
  margin-bottom: 10px;
`;

const TopicPercent = styled.Text<{ $muted: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 18px;
  letter-spacing: -0.5px;
  color: ${({ theme, $muted }) =>
    $muted ? theme.colors.dim : theme.colors.ink};
  font-variant: tabular-nums;
`;

const TopicName = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  margin-top: 2px;
  font-size: 11.5px;
  line-height: 15px;
  color: ${({ theme }) => theme.colors.strong};
`;

export default PracticeScreen;
