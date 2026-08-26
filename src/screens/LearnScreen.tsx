import React from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import styled, { useTheme } from 'styled-components/native';

import { useNavigation } from '@react-navigation/native';

import Icon from '@/components/Icon';
import ProgressRing from '@/components/ProgressRing';
import ScreenHeader from '@/components/ScreenHeader';
import { useCourse } from '@/data/course/CourseProvider';
import { courseLessonNumber, orderedCourseLessons } from '@/data/course/learn';
import { CourseModuleV2 } from '@/data/course/v2/wire';
import { useDevUnlockAll } from '@/lib/devUnlock';
import { RootNavigation } from '@/navigation/types';
import { LessonScore, useAppState } from '@/state/AppState';
import { shadows } from '@/theme';

// Progression is sequential in production: lessons unlock in order inside an
// unlocked module, the module test unlocks after all its lessons, and the
// next module unlocks after the previous module's test. The dev-only override
// (You → Developer → Unlock all lessons) makes every node tappable.

// Serpentine ladder geometry generalized from the 7-node reference layout
// (393-wide artboard): two slots per row, direction alternating per row, one
// extra slot for the module test. The x axis stretches with the screen, the
// y axis is fixed.
const ART_W = 393;
const COL_LEFT = 48;
const COL_RIGHT = 205;
const CENTER_LEFT = 118;
const CENTER_RIGHT = 275;
const COLUMN_W = 140;
const FIRST_CENTER_Y = 140;
const ROW_H = 180;
const NEXT_PILL_GAP = 85;

type LadderSlot = {
  x: number;
  nodeY: number;
  centerX: number;
  centerY: number;
};

type ModuleLayout = {
  slots: LadderSlot[];
  segments: string[];
  tail: string;
  height: number;
};

const buildModuleLayout = (slotCount: number): ModuleLayout => {
  const slots: LadderSlot[] = [];
  for (let i = 0; i < slotCount; i += 1) {
    const row = Math.floor(i / 2);
    const startsLeft = row % 2 === 0;
    const left = startsLeft === (i % 2 === 0);
    const centerY = FIRST_CENTER_Y + row * ROW_H;
    slots.push({
      x: left ? COL_LEFT : COL_RIGHT,
      nodeY: centerY - 40,
      centerX: left ? CENTER_LEFT : CENTER_RIGHT,
      centerY,
    });
  }

  // One path segment per slot so the done overlay can stop at any node.
  const segments = slots.map((slot, i) => {
    if (i === 0) {
      // A bare move: the ladder begins at the first lesson, with nothing
      // drawn back up to the module title.
      return `M ${slot.centerX} ${slot.centerY}`;
    }
    const prev = slots[i - 1];
    if (prev.centerY === slot.centerY) {
      return ` H ${slot.centerX}`;
    }
    const ctrl = prev.centerX === CENTER_RIGHT ? 365 : 30;
    return ` C ${ctrl} ${prev.centerY} ${ctrl} ${slot.centerY} ${slot.centerX} ${slot.centerY}`;
  });

  const last = slots[slots.length - 1];
  const height = last.centerY + NEXT_PILL_GAP;
  const tail =
    last.centerX === CENTER_LEFT
      ? `M ${CENTER_LEFT} ${last.centerY} C 55 ${last.centerY} 45 ${
          last.centerY + 70
        } 110 ${last.centerY + NEXT_PILL_GAP}`
      : `M ${CENTER_RIGHT} ${last.centerY} C 338 ${last.centerY} 348 ${
          last.centerY + 70
        } 283 ${last.centerY + NEXT_PILL_GAP}`;

  return { slots, segments, tail, height };
};

type ModuleLadderProps = {
  module: CourseModuleV2;
  moduleUnlocked: boolean;
  lessonScores: Record<string, LessonScore>;
  testScore: number | undefined;
  currentLessonId: string | undefined;
};

// Memoized below as ModuleLadder: the screen consumes AppState, which
// changes on every answered question (even mid-quiz, behind the pushed Quiz
// screen), and the ladders are by far the heaviest thing it renders. Their
// inputs only change when a lesson or test actually completes.
const ModuleLadderComponent: React.FC<ModuleLadderProps> = ({
  module,
  moduleUnlocked,
  lessonScores,
  testScore,
  currentLessonId,
}) => {
  const theme = useTheme();
  const navigation = useNavigation<RootNavigation>();
  const { width } = useWindowDimensions();
  const devUnlockAll = useDevUnlockAll();

  const lessons = module.lessons;
  const layout = buildModuleLayout(lessons.length + 1);
  const testSlot = layout.slots[lessons.length];

  const doneCount = lessons.filter(
    lesson => lessonScores[lesson.lessonId]?.completed,
  ).length;
  const testDone = testScore != null;
  const testLocked =
    !devUnlockAll &&
    !testDone &&
    (!moduleUnlocked || doneCount < lessons.length);
  // Lessons are freely reorderable, so the travelled-path overlay follows the
  // consecutive completed stretch from the module start only.
  let prefixDone = 0;
  while (
    prefixDone < lessons.length &&
    lessonScores[lessons[prefixDone].lessonId]?.completed
  ) {
    prefixDone += 1;
  }
  const progressed =
    prefixDone === lessons.length && testDone ? prefixDone + 1 : prefixDone;
  const currentIndex = Math.min(progressed, layout.slots.length - 1);
  const donePath = layout.segments.slice(0, currentIndex + 1).join('');

  const scaleX = (x: number) => (x * width) / ART_W;

  return (
    <Ladder style={{ height: layout.height }}>
      <Svg
        width={width}
        height={layout.height}
        viewBox={`0 0 ${ART_W} ${layout.height}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Path
          d={layout.segments.join('')}
          stroke={theme.colors.faint}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        {progressed > 0 && (
          <Path
            d={donePath}
            stroke={theme.colors.doneLine}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        )}
        <Path
          d={layout.tail}
          stroke={theme.colors.faint}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="2 8"
          fill="none"
        />
      </Svg>

      <UnitPill style={{ left: scaleX(22), right: scaleX(22), top: 0 }}>
        <UnitTitle numberOfLines={1}>
          {module.sequence}. {module.title}
        </UnitTitle>
      </UnitPill>

      {lessons.map((lesson, index) => {
        const slot = layout.slots[index];
        const score = lessonScores[lesson.lessonId];
        const previousDone = lessons
          .slice(0, index)
          .every(prev => lessonScores[prev.lessonId]?.completed);
        const unlocked = devUnlockAll || (moduleUnlocked && previousDone);
        const status =
          score?.completed === true
            ? 'done'
            : !unlocked
            ? 'locked'
            : lesson.lessonId === currentLessonId
            ? 'current'
            : 'available';
        const left = scaleX(slot.x);
        const number = courseLessonNumber(lesson.lessonId);

        if (status === 'current') {
          const answered = score?.answered ?? 0;
          return (
            <Node
              key={lesson.lessonId}
              style={{ left, top: slot.nodeY - 10, width: COLUMN_W }}
              onPress={() =>
                navigation.navigate('Lesson', { lessonId: lesson.lessonId })
              }
            >
              <ProgressRing
                size={100}
                thickness={9}
                progress={answered / lesson.questionIds.length}
              >
                <RingCircle>
                  <RingNumber>{number}</RingNumber>
                  <RingMeta>
                    {answered}/{lesson.questionIds.length}
                  </RingMeta>
                </RingCircle>
              </ProgressRing>
              <CurrentLabel numberOfLines={2}>{lesson.title}</CurrentLabel>
              <ContinuePill style={shadows.chip}>
                <ContinueText>Continue</ContinueText>
              </ContinuePill>
            </Node>
          );
        }

        if (status === 'done') {
          return (
            <Node
              key={lesson.lessonId}
              style={{ left, top: slot.nodeY, width: COLUMN_W }}
              onPress={() =>
                navigation.navigate('Lesson', { lessonId: lesson.lessonId })
              }
            >
              <DoneCircle>
                <Icon name="check" size={30} color="#ffffff" />
              </DoneCircle>
              <DoneLabel numberOfLines={2}>{lesson.title}</DoneLabel>
            </Node>
          );
        }

        if (status === 'locked') {
          return (
            <Node
              key={lesson.lessonId}
              style={{ left, top: slot.nodeY, width: COLUMN_W }}
              disabled
            >
              <LockedCircle>
                <Icon name="lock" size={24} color={theme.colors.dim2} />
              </LockedCircle>
              <LockedLabel numberOfLines={2}>{lesson.title}</LockedLabel>
            </Node>
          );
        }

        return (
          <Node
            key={lesson.lessonId}
            style={{ left, top: slot.nodeY, width: COLUMN_W }}
            onPress={() =>
              navigation.navigate('Lesson', { lessonId: lesson.lessonId })
            }
          >
            <AvailableCircle>
              <AvailableNumber>{number}</AvailableNumber>
            </AvailableCircle>
            <AvailableLabel numberOfLines={2}>{lesson.title}</AvailableLabel>
          </Node>
        );
      })}

      <Node
        style={{
          left: scaleX(testSlot.x),
          top: testSlot.nodeY,
          width: COLUMN_W,
        }}
        disabled={testLocked}
        onPress={() =>
          navigation.navigate('Quiz', {
            mode: 'moduleTest',
            moduleId: module.moduleId,
          })
        }
      >
        <TestDiamond
          $state={testDone ? 'done' : testLocked ? 'locked' : 'ready'}
        >
          {testLocked ? (
            <LockInDiamond>
              <Icon name="lock" size={18} color={theme.colors.dim2} />
            </LockInDiamond>
          ) : (
            <TestMark $state={testDone ? 'done' : 'ready'}>
              {testDone ? '✓' : '?'}
            </TestMark>
          )}
          {testDone && (
            <TestBadge>
              <TestBadgeText>{testScore}%</TestBadgeText>
            </TestBadge>
          )}
        </TestDiamond>
        <TestLabel>Module test</TestLabel>
      </Node>
    </Ladder>
  );
};

const ModuleLadder = React.memo(ModuleLadderComponent);

const LearnScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { lessonScores, topicScores, points } = useAppState();
  const { bundle } = useCourse();
  const devUnlockAll = useDevUnlockAll();

  const modules = bundle.modules;
  const courseLessons = orderedCourseLessons();
  const doneTotal = React.useMemo(
    () =>
      courseLessons.filter(ref => lessonScores[ref.lesson.lessonId]?.completed)
        .length,
    [courseLessons, lessonScores],
  );
  const totalLessons = courseLessons.length;

  // A module is unlocked once the previous module's test is done; the current
  // lesson is the first unlocked, not-yet-completed one.
  const moduleUnlockedById = React.useMemo(() => {
    const unlocked = new Map<string, boolean>();
    modules.forEach((module, index) => {
      const previous = modules[index - 1];
      unlocked.set(
        module.moduleId,
        index === 0 || topicScores[previous.moduleId] != null,
      );
    });
    return unlocked;
  }, [modules, topicScores]);
  const currentLessonId = React.useMemo(
    () =>
      courseLessons.find(
        ref =>
          (devUnlockAll || moduleUnlockedById.get(ref.module.moduleId)) &&
          !lessonScores[ref.lesson.lessonId]?.completed,
      )?.lesson.lessonId,
    [courseLessons, devUnlockAll, moduleUnlockedById, lessonScores],
  );

  return (
    <Screen
      contentContainerStyle={
        Platform.OS === 'ios'
          ? { paddingTop: 10, paddingBottom: 40 }
          : { paddingTop: insets.top + 10, paddingBottom: 110 + insets.bottom }
      }
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Learn" />
      <CourseMeta>
        {doneTotal} / {totalLessons} lessons · {points} pts
      </CourseMeta>
      {modules.map(module => (
        <ModuleLadder
          key={module.moduleId}
          module={module}
          moduleUnlocked={moduleUnlockedById.get(module.moduleId) ?? false}
          lessonScores={lessonScores}
          testScore={topicScores[module.moduleId]}
          currentLessonId={currentLessonId}
        />
      ))}
    </Screen>
  );
};

const Screen = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const CourseMeta = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  text-align: center;
  margin: 4px 0 12px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const Ladder = styled.View`
  width: 100%;
`;

const UnitPill = styled.View`
  position: absolute;
  height: 52px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.faint};
  overflow: hidden;
  align-items: center;
  justify-content: center;
  padding: 0 52px;
`;

const UnitTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 15.5px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Node = styled.Pressable`
  position: absolute;
  align-items: center;
  gap: 9px;
`;

const DoneCircle = styled.View`
  width: 80px;
  height: 80px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.done};
  align-items: center;
  justify-content: center;
`;

const DoneLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 13px;
  text-align: center;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.strong};
`;

const RingCircle = styled.View`
  flex: 1;
  align-self: stretch;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.bg};
  align-items: center;
  justify-content: center;
  gap: 1px;
`;

const RingNumber = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 26px;
  letter-spacing: -0.6px;
  color: ${({ theme }) => theme.colors.accent};
`;

const RingMeta = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const CurrentLabel = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 13.5px;
  letter-spacing: -0.2px;
  text-align: center;
  line-height: 17px;
  color: ${({ theme }) => theme.colors.ink};
`;

const ContinuePill = styled.View`
  padding: 8px 18px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.accent};
`;

const ContinueText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 12px;
  color: #ffffff;
`;

const AvailableCircle = styled.View`
  width: 80px;
  height: 80px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.faint};
  align-items: center;
  justify-content: center;
`;

const AvailableNumber = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 24px;
  color: ${({ theme }) => theme.colors.accent};
`;

const AvailableLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  text-align: center;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.muted};
`;

const LockedCircle = styled.View`
  width: 80px;
  height: 80px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.faint};
  align-items: center;
  justify-content: center;
  opacity: 0.75;
`;

const LockedLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  text-align: center;
  line-height: 16px;
  color: ${({ theme }) => theme.colors.dim};
`;

const LockInDiamond = styled.View`
  transform: rotate(-45deg);
`;

type TestState = { $state: 'ready' | 'done' | 'locked' };

const TestDiamond = styled.View<TestState>`
  width: 54px;
  height: 54px;
  margin: 10px;
  border: 3px solid
    ${({ theme, $state }) =>
      $state === 'done'
        ? theme.colors.done
        : $state === 'locked'
        ? theme.colors.line
        : theme.colors.warning};
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.bg};
  align-items: center;
  justify-content: center;
  transform: rotate(45deg);
`;

const TestMark = styled.Text<TestState>`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 20px;
  color: ${({ theme, $state }) =>
    $state === 'done' ? theme.colors.done : theme.colors.warning};
  transform: rotate(-45deg);
`;

const TestBadge = styled.View`
  position: absolute;
  top: -18px;
  right: -18px;
  padding: 3px 9px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.doneSoft};
  transform: rotate(-45deg);
`;

const TestBadgeText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.doneText};
  font-variant: tabular-nums;
`;

const TestLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 12.5px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

export default LearnScreen;
