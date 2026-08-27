import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import { questionDiagram } from '@/assets/questionDiagrams';
import CourseAssetView from '@/components/CourseAssetView';
import GlassCircleButton from '@/components/GlassCircleButton';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import ProgressTrack from '@/components/ProgressTrack';
import RemoteImage from '@/components/RemoteImage';
import SignImage from '@/components/SignImage';
import { Eyebrow } from '@/components/typography';
import {
  FINAL_EXAM_TOPIC_ID,
  courseLessonQuiz,
  courseModuleTestQuiz,
  findCourseAsset,
} from '@/data/course/learn';
import { QuizQuestion } from '@/data/curriculum';
import {
  EXAM_PASS_PERCENT,
  examQuestions,
  finalExamQuestions,
  quickMixQuestions,
  resolveQuestions,
  topicQuestions,
} from '@/data/practice';
import { findSign, shuffle, signQuizQuestions } from '@/data/signs';
import { useSignsCatalog } from '@/data/signs/SignsProvider';
import { revealScrollOffset } from '@/lib/revealScroll';
import { QuizParams, RootStackParamList } from '@/navigation/types';
import { useAppState, PersistedState } from '@/state/AppState';

const EXAM_SECONDS = 60 * 60;

// The CTA floats over the bottom of the scroll viewport (22px above the safe
// area, 54px tall), so that strip does not count as visible.
const CTA_STRIP = 54 + 22;

const buildQuestions = (
  params: QuizParams,
  state: Pick<PersistedState, 'savedQuestionIds' | 'mistakeIds'>,
): QuizQuestion[] => {
  switch (params.mode) {
    case 'lessonTest':
      return courseLessonQuiz(params.lessonId);
    case 'moduleTest':
      // 10 canonical question references from the module test, shuffled.
      return shuffle(courseModuleTestQuiz(params.moduleId));
    case 'topic':
      return topicQuestions(params.topicId);
    case 'quickMix':
      return quickMixQuestions();
    case 'exam':
      return examQuestions();
    case 'finalExam':
      return finalExamQuestions();
    case 'signsQuiz':
      return signQuizQuestions(20);
    case 'categoryQuiz':
      return signQuizQuestions(10, params.categoryId);
    case 'saved':
      return resolveQuestions(state.savedQuestionIds);
    case 'mistakes':
      return resolveQuestions(state.mistakeIds);
  }
};

// The thing the session is about, for the modes that have one — module test,
// practice topic or sign category. Everything else is the whole bank.
const quizTargetId = (params: QuizParams): string | null => {
  switch (params.mode) {
    case 'lessonTest':
      return params.lessonId;
    case 'moduleTest':
      return params.moduleId;
    case 'topic':
      return params.topicId;
    case 'categoryQuiz':
      return params.categoryId;
    default:
      return null;
  }
};

const formatClock = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

type QuizScreenProps = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

// Progress track for the native iOS navigation bar title slot — the bar does
// not stretch flex children, so the width is fixed from the screen width.
const HeaderProgress: React.FC<{ progress: number }> = ({ progress }) => {
  const { width } = useWindowDimensions();

  return (
    <View style={{ width: Math.min(240, width - 160) }}>
      <ProgressTrack progress={progress} height={6} />
    </View>
  );
};

type QuizOption = QuizQuestion['options'][number];

type OptionRowProps = {
  option: QuizOption;
  state: OptionState;
  disabled: boolean;
  onSelect: (optionId: string) => void;
};

// One answer row. Memoized so rows only re-render when their own visual
// state changes — not on every screen re-render (exam clock ticks, app-state
// updates, the feedback reveal re-measuring).
const OptionRowComponent: React.FC<OptionRowProps> = ({
  option,
  state,
  disabled,
  onSelect,
}) => (
  <Option
    disabled={disabled}
    onPress={() => onSelect(option.id)}
    $state={state}
  >
    {state === 'correct' ? (
      <RadioDone>
        <Icon name="check" size={12} color="#ffffff" />
      </RadioDone>
    ) : (
      <Radio
        $state={
          state === 'wrong'
            ? 'wrong'
            : state === 'selected'
            ? 'selected'
            : 'default'
        }
      />
    )}
    <OptionText $emphasis={state !== 'default'}>{option.text}</OptionText>
  </Option>
);

const OptionRow = React.memo(OptionRowComponent);

// One quiz engine for every session type. Lesson/topic flows reveal the
// answer on "Check answer"; the mock exam follows real exam rules — no
// hints, no reveal, a 60-minute clock.
const QuizScreen: React.FC<QuizScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  // Subscribes to the signs store: sign flashcards render `findSign` art at
  // render time, so a committed catalogue update must re-render this screen.
  useSignsCatalog();
  const insets = useSafeAreaInsets();
  const params = route.params;
  // Both exams run under real exam rules: no reveal, no hints, a 60-minute
  // clock. Only the wording and where the score lands differ.
  const isFinalExam = params.mode === 'finalExam';
  const isExam = params.mode === 'exam' || isFinalExam;
  const app = useAppState();
  const {
    toggleSavedQuestion,
    savedQuestionIds,
    recordQuestionAnswer,
    recordMistake,
    clearMistake,
    applyTopicResult,
    applyExamResult,
    applyLessonResult,
  } = app;

  const [questions] = useState(() => buildQuestions(params, app));
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);

  const question: QuizQuestion | undefined = questions[index];
  const total = questions.length;
  const isLast = index === total - 1;
  const saved = question != null && savedQuestionIds.includes(question.id);

  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  // At most one auto-scroll per reveal: onLayout also fires when the content
  // re-measures (image loading, rotation) and scrolling again then would
  // fight whatever the user has scrolled to in the meantime.
  const feedbackNudged = useRef(false);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  };

  const onScrollLayout = (event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  };

  // The ScrollView keeps its offset across question changes, and the reveal
  // above may well have left it scrolled down — every question starts at the
  // top, like the lesson player does.
  const goToQuestion = (nextIndex: number) => {
    setIndex(nextIndex);
    setSelectedId(null);
    setChecked(false);
    feedbackNudged.current = false;
    scrollOffset.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  // A long question can push the answer feedback below the fold. Measure it
  // as it appears and scroll down only when it does not fit.
  const onFeedbackLayout = (event: LayoutChangeEvent) => {
    if (feedbackNudged.current) {
      return;
    }
    const { y, height } = event.nativeEvent.layout;
    const target = revealScrollOffset({
      offset: scrollOffset.current,
      viewport: viewportHeight.current,
      blockY: y,
      blockHeight: height,
      bottomOverlay: CTA_STRIP + insets.bottom,
    });
    if (target == null) {
      return;
    }
    feedbackNudged.current = true;
    scrollRef.current?.scrollTo({ y: target, animated: true });
  };

  useEffect(() => {
    track('quiz_started', {
      mode: params.mode,
      question_count: questions.length,
      target_id: quizTargetId(params),
    });
    // Once per mounted session: a quiz builds its questions on mount and the
    // route is never reused for a second run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    (correct: number, answered: number, timedOut = false) => {
      const percent =
        answered === 0 ? 0 : Math.round((correct / answered) * 100);
      track('quiz_completed', {
        mode: params.mode,
        correct,
        question_count: total,
        percent,
        passed: isExam ? percent >= EXAM_PASS_PERCENT : null,
        timed_out: timedOut,
      });
      if (params.mode === 'lessonTest') {
        applyLessonResult({
          lessonId: params.lessonId,
          answered,
          correct,
          points: percent,
          completed: true,
        });
      } else if (params.mode === 'moduleTest') {
        // Module-test best score rides the topic_scores channel; module ids
        // and practice-topic ids share the same key space without colliding.
        applyTopicResult(params.moduleId, percent);
      } else if (params.mode === 'topic') {
        applyTopicResult(params.topicId, percent);
      } else if (
        params.mode === 'categoryQuiz' ||
        params.mode === 'signsQuiz'
      ) {
        applyTopicResult('road-signs', percent);
      } else if (params.mode === 'exam') {
        applyExamResult(percent);
      } else if (params.mode === 'finalExam') {
        applyTopicResult(FINAL_EXAM_TOPIC_ID, percent);
      }
      setFinished(true);
    },
    [
      params,
      total,
      isExam,
      applyLessonResult,
      applyTopicResult,
      applyExamResult,
    ],
  );

  useEffect(() => {
    if (!isExam || finished) {
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isExam, finished]);

  useEffect(() => {
    if (isExam && secondsLeft === 0 && !finished) {
      finish(correctCount, index, true);
    }
  }, [isExam, secondsLeft, finished, correctCount, index, finish]);

  const confirmExit = useCallback(() => {
    Alert.alert(
      'Leave the quiz?',
      'Your progress in this session will be lost.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            track('quiz_abandoned', {
              mode: params.mode,
              question_index: index,
              question_count: total,
              correct: correctCount,
            });
            navigation.popToTop();
          },
        },
      ],
    );
  }, [navigation, params.mode, index, total, correctCount]);

  const onSelectOption = useCallback(
    (optionId: string) => setSelectedId(optionId),
    [],
  );

  const toggleBookmark = useCallback(
    (questionId: string, wasSaved: boolean) => {
      track('question_bookmark_toggled', {
        question_id: questionId,
        saved: !wasSaved,
      });
      toggleSavedQuestion(questionId);
    },
    [toggleSavedQuestion],
  );

  // iOS: X, progress track and bookmark live in the native navigation bar as
  // UIBarButtonItems / a custom title view (glass bubbles on iOS 26). Android
  // draws the analog header row in-screen below.
  useLayoutEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    if (finished || question == null) {
      navigation.setOptions({ headerShown: false });
      return;
    }
    navigation.setOptions({
      headerShown: true,
      unstable_headerLeftItems: () => [
        {
          type: 'button',
          label: 'Close',
          icon: { type: 'sfSymbol', name: 'xmark' },
          tintColor: theme.colors.body,
          onPress: confirmExit,
        },
      ],
      headerTitle: () => <HeaderProgress progress={(index + 1) / total} />,
      unstable_headerRightItems: () => [
        {
          type: 'button',
          label: saved ? 'Saved' : 'Save',
          icon: {
            type: 'sfSymbol',
            name: saved ? 'bookmark.fill' : 'bookmark',
          },
          tintColor: saved ? theme.colors.accent : theme.colors.body,
          onPress: () => toggleBookmark(question.id, saved),
        },
      ],
    });
  }, [
    navigation,
    finished,
    question,
    saved,
    index,
    total,
    confirmExit,
    toggleBookmark,
    theme.colors.accent,
    theme.colors.body,
  ]);

  const onPrimaryPress = () => {
    if (question == null) {
      navigation.popToTop();
      return;
    }
    const isCorrect = selectedId === question.correctId;

    if (!checked) {
      // Graded exactly once per question per session, before any reveal —
      // this is what the Practice bank map is built from.
      recordQuestionAnswer(question.id, isCorrect);
      track('quiz_question_answered', {
        mode: params.mode,
        question_id: question.id,
        correct: isCorrect,
        question_index: index,
        question_count: total,
      });
      if (isCorrect) {
        if (params.mode === 'mistakes') {
          clearMistake(question.id);
        }
      } else {
        recordMistake(question.id);
      }
      const nextCorrect = correctCount + (isCorrect ? 1 : 0);
      setCorrectCount(nextCorrect);
      if (isExam) {
        // Real exam rules: no reveal — go straight on.
        if (isLast) {
          finish(nextCorrect, total);
        } else {
          goToQuestion(index + 1);
        }
        return;
      }
      setChecked(true);
      return;
    }

    if (isLast) {
      finish(correctCount, total);
    } else {
      goToQuestion(index + 1);
    }
  };

  if (finished || question == null) {
    const percent = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    return (
      <Screen style={{ paddingTop: insets.top }}>
        <Summary>
          {total === 0 ? (
            <>
              <SummaryTitle>Nothing here yet</SummaryTitle>
              <SummaryMeta>
                {params.mode === 'saved'
                  ? 'Bookmark questions during a quiz and they will show up here.'
                  : 'No questions to review — keep practicing.'}
              </SummaryMeta>
            </>
          ) : (
            <>
              <SummaryPercent>{percent}%</SummaryPercent>
              <SummaryTitle>
                {isExam
                  ? percent >= EXAM_PASS_PERCENT
                    ? isFinalExam
                      ? 'You passed the final exam'
                      : 'You passed the mock exam'
                    : 'Keep practicing'
                  : 'Nice work!'}
              </SummaryTitle>
              <SummaryMeta>
                {correctCount} of {total} correct
              </SummaryMeta>
            </>
          )}
        </Summary>
        <Floating style={{ bottom: insets.bottom + 22 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => navigation.popToTop()}
          />
        </Floating>
      </Screen>
    );
  }

  const signId = question.signId;
  const sign = signId != null ? findSign(signId) : undefined;
  // Course questions carry a rendered illustration; the authored practice
  // banks have schematic diagrams keyed by question id instead.
  const diagram = questionDiagram(question.id);
  const courseAsset =
    question.assetId != null
      ? findCourseAsset(question.assetId)
      : diagram != null
      ? { svgXml: diagram.xml, alt: diagram.alt }
      : undefined;

  return (
    <Screen
      style={{ paddingTop: Platform.OS === 'ios' ? 10 : insets.top + 10 }}
    >
      {Platform.OS !== 'ios' && (
        <Header>
          <GlassCircleButton
            icon="xmark"
            iconSize={15}
            iconColor={theme.colors.body}
            onPress={confirmExit}
          />
          <TrackWrap>
            <ProgressTrack progress={(index + 1) / total} height={6} />
          </TrackWrap>
          <GlassCircleButton
            icon={saved ? 'bookmark-filled' : 'bookmark'}
            iconSize={16}
            iconColor={saved ? theme.colors.accent : theme.colors.body}
            onPress={() => toggleBookmark(question.id, saved)}
          />
        </Header>
      )}
      <Scroll
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onLayout={onScrollLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Eyebrow style={{ marginBottom: 14 }}>
          Question {index + 1} of {total}
          {isExam ? ` · ${formatClock(secondsLeft)}` : ''}
        </Eyebrow>
        {sign != null ? (
          <SignStage>
            <SignImage sign={sign} size={150} />
          </SignStage>
        ) : courseAsset != null ? (
          <ImageWrap>
            <CourseAssetView asset={courseAsset} />
          </ImageWrap>
        ) : question.imageUrl != null || question.imageCaption != null ? (
          <ImageWrap>
            <RemoteImage
              image={
                question.imageUrl != null
                  ? {
                      url: question.imageUrl,
                      caption: question.imageCaption,
                    }
                  : undefined
              }
              height={question.imageHeight ?? 186}
              radius={14}
              placeholderLabel={question.imageCaption ?? ''}
            />
          </ImageWrap>
        ) : null}
        <Prompt>{question.prompt}</Prompt>
        <Options>
          {question.options.map(option => {
            const isSelected = option.id === selectedId;
            const isCorrect = option.id === question.correctId;
            const state: OptionState = checked
              ? isCorrect
                ? 'correct'
                : isSelected
                ? 'wrong'
                : 'default'
              : isSelected
              ? 'selected'
              : 'default';

            return (
              <OptionRow
                key={option.id}
                option={option}
                state={state}
                disabled={checked}
                onSelect={onSelectOption}
              />
            );
          })}
        </Options>
        {checked && !isExam && (
          <Feedback
            $correct={selectedId === question.correctId}
            onLayout={onFeedbackLayout}
          >
            <FeedbackTitle $correct={selectedId === question.correctId}>
              {selectedId === question.correctId ? 'Correct' : 'Not quite'}
            </FeedbackTitle>
            <FeedbackText>
              {(selectedId != null
                ? question.feedbackByChoiceId?.[selectedId]
                : undefined) ?? question.explanation}
            </FeedbackText>
          </Feedback>
        )}
      </Scroll>
      <Floating style={{ bottom: insets.bottom + 22 }}>
        <PrimaryButton
          label={
            !checked
              ? isExam
                ? isLast
                  ? 'Finish exam'
                  : 'Next question'
                : 'Check answer'
              : isLast
              ? 'Finish'
              : 'Continue'
          }
          onPress={onPrimaryPress}
          disabled={selectedId == null && !checked}
        />
      </Floating>
    </Screen>
  );
};

const Screen = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 14px;
  padding: 10px 20px 18px;
`;

const TrackWrap = styled.View`
  flex: 1;
`;

const Scroll = styled(ScrollView)`
  flex: 1;
  padding: 0 20px;
`;

const SignStage = styled.View`
  align-items: center;
  padding: 10px 0 26px;
`;

const ImageWrap = styled.View`
  margin-bottom: 20px;
`;

const Prompt = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 20px;
  font-size: 22px;
  line-height: 28px;
  letter-spacing: -0.7px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Options = styled.View`
  gap: 10px;
`;

type OptionState = 'default' | 'selected' | 'correct' | 'wrong';

const Option = styled.Pressable<{ $state: OptionState }>`
  flex-direction: row;
  align-items: center;
  gap: 13px;
  padding: 15px 16px;
  border-radius: 12px;
  border: ${({ theme, $state }) =>
    $state === 'selected'
      ? `1.5px solid ${theme.colors.accent}`
      : $state === 'correct'
      ? `1.5px solid ${theme.colors.done}`
      : $state === 'wrong'
      ? `1.5px solid ${theme.colors.error}`
      : `1px solid ${theme.colors.line}`};
  background-color: ${({ theme, $state }) =>
    $state === 'selected'
      ? theme.colors.accentSoft
      : $state === 'correct'
      ? theme.colors.doneSoft
      : $state === 'wrong'
      ? 'rgba(239, 68, 68, 0.07)'
      : 'transparent'};
`;

const Radio = styled.View<{ $state: 'default' | 'selected' | 'wrong' }>`
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  border: ${({ theme, $state }) =>
    $state === 'selected'
      ? `6.5px solid ${theme.colors.accent}`
      : $state === 'wrong'
      ? `6.5px solid ${theme.colors.error}`
      : `1.5px solid ${theme.colors.dim2}`};
`;

const RadioDone = styled.View`
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.done};
  align-items: center;
  justify-content: center;
`;

const OptionText = styled.Text<{ $emphasis: boolean }>`
  ${({ theme, $emphasis }) =>
    $emphasis ? theme.fonts.semiBold : theme.fonts.medium}
  flex: 1;
  font-size: 15.5px;
  line-height: 22px;
  color: ${({ theme, $emphasis }) =>
    $emphasis ? theme.colors.ink : theme.colors.body};
`;

const Feedback = styled.View<{ $correct: boolean }>`
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  background-color: ${({ theme, $correct }) =>
    $correct ? theme.colors.doneSoft : 'rgba(239, 68, 68, 0.07)'};
`;

const FeedbackTitle = styled.Text<{ $correct: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 4px;
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${({ theme, $correct }) =>
    $correct ? theme.colors.doneText : theme.colors.error};
`;

const FeedbackText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13.5px;
  line-height: 21px;
  color: ${({ theme }) => theme.colors.body};
`;

const Summary = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 0 40px;
  gap: 8px;
`;

const SummaryPercent = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 54px;
  letter-spacing: -1.5px;
  color: ${({ theme }) => theme.colors.accent};
  font-variant: tabular-nums;
`;

const SummaryTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 22px;
  letter-spacing: -0.6px;
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};
`;

const SummaryMeta = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 14px;
  line-height: 21px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const Floating = styled.View`
  position: absolute;
  left: 25px;
  right: 25px;
`;

export default QuizScreen;
