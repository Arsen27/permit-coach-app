import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import ProgressTrack from '@/components/ProgressTrack';
import LessonCardBody from '@/components/lesson/LessonCardBody';
import { buildCards, cardAssetId } from '@/components/lesson/cards';
import type { LessonAnswer } from '@/components/lesson/types';
import { useCourse } from '@/data/course/CourseProvider';
import {
  courseLessonCount,
  courseLessonNumber,
  findCourseAsset,
  findCourseLesson,
  findCourseQuestion,
  orderedCourseLessons,
} from '@/data/course/learn';
import {
  clearLessonPlace,
  loadLessonPlace,
  saveLessonPlace,
} from '@/data/course/lessonProgressStore';
import { isCheckYourselfBlock } from '@/data/course/v2/wire';
import { RootStackParamList } from '@/navigation/types';
import { useAppState } from '@/state/AppState';
import { shadows } from '@/theme';

type TheoryScreenProps = NativeStackScreenProps<RootStackParamList, 'Theory'>;

// Card lesson player, built to the "Lesson format — card sequence" handoff.
// One card = one idea, always the same skeleton: back · progress · close, a
// card-type kicker, the content, one primary button. Card type is signalled by
// the kicker and its colour, never by a full coloured card; correct/incorrect
// always pairs a colour with an icon and a word.
//
// Legacy lessons can still contain inline checkpoints. New slide lessons keep
// theory and testing separate so learners can study, test immediately, or
// return to either path from the lesson overview.

const isIOS = Platform.OS === 'ios';

// ---------------------------------------------------------------------------
// Screen

// Lesson progress for the native iOS navigation bar title slot — the bar does
// not stretch flex children, so the width is fixed from the screen width.
const HeaderProgress: React.FC<{
  title: string;
  index: number;
  total: number;
}> = ({ title, index, total }) => {
  const { width } = useWindowDimensions();

  return (
    <HeaderWrap style={{ width: Math.min(250, width - 150) }}>
      <ProgressMeta>
        <ProgressTitle numberOfLines={1}>{title}</ProgressTitle>
        <ProgressCount>
          {index + 1} / {total}
        </ProgressCount>
      </ProgressMeta>
      <ProgressTrack progress={(index + 1) / total} />
    </HeaderWrap>
  );
};

const TheoryScreen: React.FC<TheoryScreenProps> = ({ route, navigation }) => {
  const { bundle } = useCourse();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, applyLessonResult, lessonScores, recordQuestionAnswer } =
    useAppState();
  const { lessonId } = route.params;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LessonAnswer>>({});
  // check_yourself cards that have been revealed, by blockId. Deliberately not
  // persisted with the lesson place: resuming on a recall card starts it
  // hidden again, so the learner always recalls before seeing the words.
  const [recallRevealed, setRecallRevealed] = useState<Record<string, boolean>>(
    {},
  );
  const [leaving, setLeaving] = useState(false);
  const [footerHeight, setFooterHeight] = useState(120);
  const [restored, setRestored] = useState(false);
  const finishedRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const courseLesson = findCourseLesson(lessonId);
  const splitLesson =
    courseLesson?.lesson.testQuestionIds != null ||
    courseLesson?.lesson.format === 'intro_slides_test';
  const cards = useMemo(
    () => (courseLesson == null ? [] : buildCards(courseLesson.lesson)),
    [courseLesson],
  );
  const done = cards.length > 0 && index >= cards.length;

  // Snapshots taken at mount for the lesson_opened event: reading them out of
  // refs keeps the restore effect below off lessonScores, which changes the
  // moment the lesson is completed.
  const cardCountRef = useRef(cards.length);
  const completedRef = useRef(lessonScores[lessonId]?.completed === true);

  // Bring the learner back to where they stopped (the leave sheet promises it).
  useEffect(() => {
    let active = true;
    loadLessonPlace(userId, lessonId).then(place => {
      if (!active) {
        return;
      }
      const resumed = place != null && place.cardIndex > 0;
      if (resumed) {
        setIndex(place.cardIndex);
        setAnswers(place.answers);
      }
      // Reported here rather than on mount: whether the learner is resuming
      // is only known once the saved place has been read.
      track('lesson_opened', {
        lesson_id: lessonId,
        lesson_number: courseLessonNumber(lessonId),
        card_count: cardCountRef.current,
        resumed,
        already_completed: completedRef.current,
      });
      setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [userId, lessonId]);

  useEffect(() => {
    if (!restored || done) {
      return;
    }
    saveLessonPlace(userId, lessonId, { cardIndex: index, answers });
  }, [restored, done, userId, lessonId, index, answers]);

  const questionIds = useMemo(() => {
    const activeLesson = courseLesson?.lesson;
    if (activeLesson == null) return [];
    return splitLesson
      ? activeLesson.theoryQuestionIds ?? []
      : activeLesson.questionIds;
  }, [courseLesson, splitLesson]);
  const correctCount = useMemo(
    () =>
      questionIds.filter(id => {
        const question = findCourseQuestion(id);
        return (
          question != null &&
          answers[id]?.selectedId === question.correctAnswerId
        );
      }).length,
    [questionIds, answers],
  );

  const complete = useCallback(() => {
    if (finishedRef.current || courseLesson == null) {
      return;
    }
    finishedRef.current = true;
    const answered = questionIds.length;
    track('lesson_completed', {
      lesson_id: lessonId,
      correct: correctCount,
      question_count: answered,
      percent: answered === 0 ? 0 : Math.round((correctCount / answered) * 100),
    });
    applyLessonResult({
      lessonId,
      answered,
      correct: correctCount,
      points: answered === 0 ? 0 : Math.round((correctCount / answered) * 100),
      completed: true,
    });
    clearLessonPlace(userId, lessonId);
  }, [
    applyLessonResult,
    correctCount,
    courseLesson,
    lessonId,
    questionIds.length,
    userId,
  ]);

  const completeTheory = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    track('lesson_theory_completed', {
      lesson_id: lessonId,
      card_count: cards.length,
    });
    clearLessonPlace(userId, lessonId);
  }, [cards.length, lessonId, userId]);

  const goTo = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // Every mid-lesson exit — the iOS alert and the Android sheet — reports the
  // card it happened on: where a lesson loses people is the whole question.
  const trackAbandoned = useCallback(() => {
    track('lesson_abandoned', {
      lesson_id: lessonId,
      card_index: index,
      card_count: cards.length,
      questions_answered: questionIds.filter(id => answers[id]?.checked).length,
      question_count: questionIds.length,
    });
  }, [answers, cards.length, index, lessonId, questionIds]);

  const leave = useCallback(() => {
    trackAbandoned();
    setLeaving(false);
    navigation.goBack();
  }, [navigation, trackAbandoned]);

  // Leaving mid-lesson is a system decision, so iOS asks with a native alert;
  // Android gets the designed bottom sheet.
  const confirmLeave = useCallback(() => {
    if (!isIOS) {
      setLeaving(true);
      return;
    }
    const answered = questionIds.filter(id => answers[id]?.checked).length;
    const progressLine = splitLesson
      ? 'Your theory progress is saved.'
      : `Progress saved · ${answered} of ${questionIds.length} questions answered`;
    Alert.alert(
      'Leave this lesson?',
      `You're on card ${index + 1} of ${cards.length}. We'll save your place ` +
        `and bring you right back here.\n\n${progressLine}`,
      [
        { text: 'Keep studying', style: 'cancel' },
        {
          text: 'Leave lesson',
          style: 'destructive',
          onPress: () => {
            trackAbandoned();
            navigation.goBack();
          },
        },
      ],
    );
  }, [
    answers,
    cards.length,
    index,
    navigation,
    questionIds,
    splitLesson,
    trackAbandoned,
  ]);

  // iOS: back, progress and close are real UINavigationBar items (glass bar
  // buttons on iOS 26). Android draws the analog row inside the screen.
  useLayoutEffect(() => {
    if (!isIOS || cards.length === 0) {
      return;
    }
    const closeItem = {
      type: 'button',
      label: 'Close',
      icon: { type: 'sfSymbol', name: 'xmark' },
      tintColor: theme.colors.body,
      onPress: done ? () => navigation.goBack() : confirmLeave,
    } as const;
    navigation.setOptions({
      headerShown: true,
      headerTitle: done
        ? ''
        : () => (
            <HeaderProgress
              title={courseLesson?.lesson.title ?? ''}
              index={index}
              total={cards.length}
            />
          ),
      unstable_headerLeftItems: () =>
        done || index === 0
          ? []
          : [
              {
                type: 'button',
                label: 'Back',
                icon: { type: 'sfSymbol', name: 'chevron.left' },
                tintColor: theme.colors.body,
                onPress: () => goTo(index - 1),
              } as const,
            ],
      unstable_headerRightItems: () => [closeItem],
    });
  }, [
    navigation,
    done,
    index,
    cards.length,
    courseLesson,
    confirmLeave,
    goTo,
    theme.colors.body,
  ]);

  if (courseLesson == null || cards.length === 0) {
    return null;
  }
  const { lesson } = courseLesson;

  const advance = () => {
    if (index === cards.length - 1) {
      if (splitLesson) {
        completeTheory();
      } else {
        complete();
      }
    }
    goTo(index + 1);
  };

  // -------------------------------------------------------------------------
  // Lesson complete

  if (done) {
    if (splitLesson) {
      return (
        <Screen style={{ paddingTop: isIOS ? 0 : insets.top + 12 }}>
          {!isIOS && (
            <CloseRow>
              <CircleButton onPress={() => navigation.goBack()} hitSlop={10}>
                <Icon name="xmark" size={13} color={theme.colors.strong} />
              </CircleButton>
            </CloseRow>
          )}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{
              paddingBottom: footerHeight + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
          >
            <DoneHeader>
              <DoneSeal>
                <Icon
                  name="circle-check"
                  size={32}
                  color={theme.colors.accent}
                />
              </DoneSeal>
              <DoneTitle>Theory complete</DoneTitle>
              <DoneSub>
                You reviewed {cards.length} slides in {lesson.title}. Take the
                lesson test when you are ready.
              </DoneSub>
            </DoneHeader>

            <ScoreCard>
              <ScoreNumbers>
                <ScoreValue>{cards.length}</ScoreValue>
                <ScoreLabel>slides reviewed</ScoreLabel>
              </ScoreNumbers>
              <ScoreChips>
                <ChipCaption>
                  Your lesson is completed after you finish the test.
                </ChipCaption>
              </ScoreChips>
            </ScoreCard>
          </ScrollView>
          <Footer
            style={{ paddingBottom: insets.bottom + 22 }}
            onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
          >
            <PrimaryButton
              label="Start lesson test"
              onPress={() =>
                navigation.replace('Quiz', { mode: 'lessonTest', lessonId })
              }
            />
            <SecondaryAction onPress={() => navigation.popToTop()}>
              <SecondaryText>Back to course</SecondaryText>
            </SecondaryAction>
          </Footer>
        </Screen>
      );
    }

    const total = questionIds.length;
    const wrong = total - correctCount;
    const points = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    const lessons = orderedCourseLessons();
    const position = lessons.findIndex(ref => ref.lesson.lessonId === lessonId);
    const next = position >= 0 ? lessons[position + 1] : undefined;
    const doneTotal = lessons.filter(
      ref => lessonScores[ref.lesson.lessonId]?.completed,
    ).length;

    return (
      <Screen style={{ paddingTop: isIOS ? 0 : insets.top + 12 }}>
        {!isIOS && (
          <CloseRow>
            <CircleButton onPress={() => navigation.goBack()} hitSlop={10}>
              <Icon name="xmark" size={13} color={theme.colors.strong} />
            </CircleButton>
          </CloseRow>
        )}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingBottom: footerHeight + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <DoneHeader>
            <DoneSeal>
              <Icon name="circle-check" size={32} color={theme.colors.accent} />
            </DoneSeal>
            <DoneTitle>Lesson complete</DoneTitle>
            <DoneSub>
              {`${lesson.title} is done.`}
              {wrong > 0
                ? ` ${wrong} ${
                    wrong === 1 ? 'question' : 'questions'
                  } to review.`
                : ' Every question correct.'}
            </DoneSub>
          </DoneHeader>

          <ScoreCard>
            <ScoreNumbers>
              <ScoreValue>
                {correctCount}
                <ScoreTotal>/{total}</ScoreTotal>
              </ScoreValue>
              <ScoreLabel>correct</ScoreLabel>
            </ScoreNumbers>
            <ScoreChips>
              <ChipRow>
                {questionIds.map(id => {
                  const question = findCourseQuestion(id);
                  const ok =
                    question != null &&
                    answers[id]?.selectedId === question.correctAnswerId;
                  return (
                    <Chip key={id} $ok={ok}>
                      <Icon
                        name={ok ? 'check' : 'xmark'}
                        size={ok ? 13 : 11}
                        color={ok ? theme.colors.accent : theme.colors.wrong}
                      />
                    </Chip>
                  );
                })}
              </ChipRow>
              <ChipCaption>
                {`Questions 1–${total} · ${
                  wrong === 0 ? 'all correct' : `${wrong} to review`
                }`}
              </ChipCaption>
            </ScoreChips>
          </ScoreCard>

          <StatRow>
            <StatCard>
              <StatValue>+{points}</StatValue>
              <StatLabel>points earned</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>
                {doneTotal} / {courseLessonCount()}
              </StatValue>
              <StatLabel>lessons done</StatLabel>
            </StatCard>
          </StatRow>
        </ScrollView>
        <Footer
          style={{ paddingBottom: insets.bottom + 22 }}
          onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
        >
          <PrimaryButton
            label={
              next != null
                ? `Next lesson · ${next.lesson.title}`
                : 'Back to course'
            }
            onPress={() => {
              if (next == null) {
                navigation.goBack();
                return;
              }
              navigation.replace('Lesson', { lessonId: next.lesson.lessonId });
            }}
          />
          {next != null && (
            <SecondaryAction onPress={() => navigation.goBack()}>
              <SecondaryText>Back to course</SecondaryText>
            </SecondaryAction>
          )}
        </Footer>
      </Screen>
    );
  }

  // -------------------------------------------------------------------------
  // Cards

  const card = cards[index];
  const { block } = card;
  const courseState = bundle.course.state;
  const question =
    card.questionId != null ? findCourseQuestion(card.questionId) : undefined;
  const answer = card.questionId != null ? answers[card.questionId] : undefined;
  const checked = answer?.checked ?? false;
  const awaitingCheck = question != null && !checked;
  const assetId = cardAssetId(card, question?.assetId);
  const asset = assetId != null ? findCourseAsset(assetId) : undefined;
  const selectedChoice = question?.choices.find(
    choice => choice.id === answer?.selectedId,
  );
  const isRight =
    question != null && answer?.selectedId === question.correctAnswerId;

  const select = (choiceId: string) => {
    if (card.questionId == null) {
      return;
    }
    setAnswers(prev => ({
      ...prev,
      [card.questionId!]: { selectedId: choiceId, checked: false },
    }));
  };

  const check = () => {
    if (card.questionId == null || answer?.selectedId == null) {
      return;
    }
    // Lesson questions come from the same bank the Practice map is drawn
    // over, and the button only reaches here while unchecked, so this counts
    // each question once per run through the lesson.
    if (!checked) {
      // Opening challenges teach; they do not grade the learner or change
      // mastery. Legacy inline checkpoints retain their old scored behaviour.
      if (!(splitLesson && question?.kind === 'opening_challenge')) {
        recordQuestionAnswer(card.questionId, isRight);
      }
      track('lesson_checkpoint_answered', {
        lesson_id: lessonId,
        question_id: card.questionId,
        correct: isRight,
        ordinal: questionIds.indexOf(card.questionId) + 1,
        question_count: questionIds.length,
      });
    }
    setAnswers(prev => ({
      ...prev,
      [card.questionId!]: { ...prev[card.questionId!], checked: true },
    }));
  };

  const questionOrdinal =
    card.questionId != null ? questionIds.indexOf(card.questionId) + 1 : 0;

  // Check-yourself recall flow: reveal first, then self-report. Unscored —
  // either answer advances, only analytics hears which one it was.
  const recallBlock = isCheckYourselfBlock(block) ? block : null;
  const recallShown =
    recallBlock != null && recallRevealed[recallBlock.blockId] === true;

  const revealRecall = () => {
    if (recallBlock == null) {
      return;
    }
    track('lesson_recall_revealed', {
      lesson_id: lessonId,
      block_id: recallBlock.blockId,
    });
    // Smooths the footer swap (Reveal words → the self-report pair); the gap
    // pills animate themselves and never change layout.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRecallRevealed(prev => ({ ...prev, [recallBlock.blockId]: true }));
  };

  const answerRecall = (remembered: boolean) => {
    if (recallBlock == null) {
      return;
    }
    track('lesson_recall_answered', {
      lesson_id: lessonId,
      block_id: recallBlock.blockId,
      remembered,
    });
    advance();
  };

  return (
    <Screen style={{ paddingTop: isIOS ? 4 : insets.top + 12 }}>
      {!isIOS && (
        <TopBar>
          <CircleButton
            onPress={() => goTo(index - 1)}
            disabled={index === 0}
            $dim={index === 0}
            hitSlop={10}
          >
            <Icon name="chevron-left" size={14} color={theme.colors.strong} />
          </CircleButton>
          <Progress>
            <ProgressMeta>
              <ProgressTitle numberOfLines={1}>{lesson.title}</ProgressTitle>
              <ProgressCount>
                {index + 1} / {cards.length}
              </ProgressCount>
            </ProgressMeta>
            <ProgressTrack progress={(index + 1) / cards.length} />
          </Progress>
          <CircleButton onPress={confirmLeave} hitSlop={10}>
            <Icon name="xmark" size={13} color={theme.colors.strong} />
          </CircleButton>
        </TopBar>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: footerHeight + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <LessonCardBody
          card={card}
          question={question}
          asset={asset}
          answer={answer}
          onSelect={select}
          stateLabel={courseState}
          cardStyles={bundle.course.cardStyles}
          resolveAsset={findCourseAsset}
          checkpointOrdinal={questionOrdinal}
          checkpointTotal={questionIds.length}
          revealed={recallShown}
        />
      </ScrollView>

      <Footer
        $bordered={checked}
        style={{ paddingBottom: insets.bottom + 22 }}
        onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}
      >
        {checked && question != null && (
          <Verdict>
            <VerdictRow>
              <Icon
                name={isRight ? 'circle-check' : 'triangle-exclamation'}
                size={19}
                color={isRight ? theme.colors.correct : theme.colors.wrong}
              />
              <VerdictWord $ok={isRight}>
                {isRight ? 'Correct' : 'Not quite'}
              </VerdictWord>
            </VerdictRow>
            <VerdictText>
              {selectedChoice?.feedback ?? question.explanation}
            </VerdictText>
          </Verdict>
        )}
        {recallBlock != null ? (
          recallShown ? (
            <>
              <RecallAsk>Did you remember it?</RecallAsk>
              <RecallChoices>
                <RecallNo
                  accessibilityRole="button"
                  accessibilityLabel="Not yet"
                  onPress={() => answerRecall(false)}
                >
                  <Icon name="xmark" size={12} color={theme.colors.muted} />
                  <RecallNoText>Not yet</RecallNoText>
                </RecallNo>
                <RecallYes
                  accessibilityRole="button"
                  accessibilityLabel="I knew it"
                  onPress={() => answerRecall(true)}
                  style={shadows.cta}
                >
                  <Icon name="check" size={13} color="#ffffff" />
                  <RecallYesText>I knew it</RecallYesText>
                </RecallYes>
              </RecallChoices>
            </>
          ) : (
            <PrimaryButton label="Reveal words" onPress={revealRecall} />
          )
        ) : (
          <PrimaryButton
            label={
              awaitingCheck
                ? 'Check answer'
                : index === cards.length - 1
                ? splitLesson
                  ? 'Finish theory'
                  : 'Finish lesson'
                : 'Continue'
            }
            disabled={awaitingCheck && answer?.selectedId == null}
            onPress={awaitingCheck ? check : advance}
          />
        )}
        {block.type === 'drive_smarter' && (
          <SecondaryAction onPress={advance}>
            <SecondaryText>Skip this card</SecondaryText>
          </SecondaryAction>
        )}
      </Footer>

      <Modal
        visible={!isIOS && leaving}
        transparent
        animationType="slide"
        onRequestClose={() => setLeaving(false)}
      >
        <SheetBackdrop onPress={() => setLeaving(false)} />
        <Sheet style={{ paddingBottom: insets.bottom + 28 }}>
          <Grabber />
          <SheetTitle>Leave this lesson?</SheetTitle>
          <SheetText>
            {`You're on card ${index + 1} of ${
              cards.length
            }. We'll save your place and bring you right back here.`}
          </SheetText>
          <SavedRow>
            <SavedIcon>
              <Icon name="bookmark" size={15} color={theme.colors.accent} />
            </SavedIcon>
            <SavedText>
              {splitLesson
                ? 'Your theory progress is saved.'
                : `Progress saved · ${
                    questionIds.filter(id => answers[id]?.checked).length
                  } of ${questionIds.length} questions answered`}
            </SavedText>
          </SavedRow>
          <PrimaryButton
            label="Keep studying"
            onPress={() => setLeaving(false)}
          />
          <SecondaryAction onPress={leave}>
            <LeaveText>Leave lesson</LeaveText>
          </SecondaryAction>
        </Sheet>
      </Modal>
    </Screen>
  );
};

// ---------------------------------------------------------------------------
// Styles

const styles = StyleSheet.create({
  scroll: { flex: 1 },
});

const Screen = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const TopBar = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 14px;
  padding: 0 20px 4px;
`;

const CloseRow = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  padding: 0 20px;
`;

const CircleButton = styled.Pressable<{ $dim?: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.surface};
  align-items: center;
  justify-content: center;
  opacity: ${({ $dim }) => ($dim ? 0.45 : 1)};
`;

const Progress = styled.View`
  flex: 1;
`;

// Title-slot progress for the native iOS bar: same meta row and track as the
// Android header, sized to the bar rather than the screen.
const HeaderWrap = styled.View`
  gap: 3px;
`;

const ProgressMeta = styled.View`
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
`;

const ProgressTitle = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  flex: 1;
  font-size: 12.5px;
  letter-spacing: -0.1px;
  color: ${({ theme }) => theme.colors.ink};
`;

const ProgressCount = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const Footer = styled.View<{ $bordered?: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px 25px 0;
  background-color: ${({ theme }) => theme.colors.bg};
  border-top-width: ${({ $bordered }) => ($bordered ? '1px' : '0px')};
  border-top-color: ${({ theme }) => theme.colors.line};
`;

const Verdict = styled.View`
  margin-bottom: 14px;
`;

const VerdictRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 9px;
  margin-bottom: 8px;
`;

const VerdictWord = styled.Text<{ $ok: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 17px;
  letter-spacing: -0.3px;
  color: ${({ theme, $ok }) =>
    $ok ? theme.colors.correctText : theme.colors.wrongText};
`;

const VerdictText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 14.5px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.body};
`;

const RecallAsk = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  margin-bottom: 12px;
  font-size: 13px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

const RecallChoices = styled.View`
  flex-direction: row;
  gap: 10px;
`;

const RecallNo = styled.Pressable`
  flex: 1;
  height: 54px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 1000px;
  border: 1.5px solid ${({ theme }) => theme.colors.line};
  background-color: ${({ theme }) => theme.colors.bg};
`;

const RecallNoText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 15px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.body};
`;

const RecallYes = styled.Pressable`
  flex: 1;
  height: 54px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 1000px;
  background-color: ${({ theme }) => theme.colors.accent};
`;

const RecallYesText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 15px;
  letter-spacing: -0.2px;
  color: #ffffff;
`;

const SecondaryAction = styled.Pressable`
  align-items: center;
  padding: 14px 0 2px;
`;

const SecondaryText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const LeaveText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 14px;
  color: ${({ theme }) => theme.colors.wrong};
`;

const DoneHeader = styled.View`
  align-items: center;
  margin: 36px 24px 0;
`;

const DoneSeal = styled.View`
  width: 72px;
  height: 72px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: ${({ theme }) => theme.colors.accent};
`;

const DoneTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 8px;
  font-size: 27px;
  letter-spacing: -0.8px;
  color: ${({ theme }) => theme.colors.ink};
`;

const DoneSub = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 15px;
  line-height: 22px;
  text-align: center;
  color: ${({ theme }) => theme.colors.strong};
`;

const ScoreCard = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 20px;
  margin: 26px 20px 0;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid ${({ theme }) => theme.colors.line};
`;

const ScoreNumbers = styled.View`
  width: 88px;
  align-items: center;
`;

const ScoreValue = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 38px;
  letter-spacing: -1.4px;
  color: ${({ theme }) => theme.colors.accent};
  font-variant: tabular-nums;
`;

const ScoreTotal = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 20px;
  color: ${({ theme }) => theme.colors.dim};
`;

const ScoreLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  margin-top: 5px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const ScoreChips = styled.View`
  flex: 1;
  gap: 8px;
`;

const ChipRow = styled.View`
  flex-direction: row;
  gap: 6px;
`;

const Chip = styled.View<{ $ok: boolean }>`
  flex: 1;
  height: 30px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $ok }) =>
    $ok ? theme.colors.accentSoft : theme.colors.wrongSoft};
`;

const ChipCaption = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const StatRow = styled.View`
  flex-direction: row;
  gap: 10px;
  margin: 12px 20px 0;
`;

const StatCard = styled.View`
  flex: 1;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.line};
`;

const StatValue = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 19px;
  letter-spacing: -0.4px;
  color: ${({ theme }) => theme.colors.ink};
  font-variant: tabular-nums;
`;

const StatLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  margin-top: 2px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const SheetBackdrop = styled.Pressable`
  flex: 1;
  background-color: rgba(24, 24, 27, 0.42);
`;

const Sheet = styled.View`
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

const SheetTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin: 0 2px 6px;
  font-size: 21px;
  line-height: 26px;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.ink};
`;

const SheetText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin: 0 2px 20px;
  font-size: 14px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.strong};
`;

const SavedRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 20px;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.colors.line};
`;

const SavedIcon = styled.View`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
`;

const SavedText = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  flex: 1;
  font-size: 14px;
  line-height: 21px;
  color: ${({ theme }) => theme.colors.ink};
`;

export default TheoryScreen;
