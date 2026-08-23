import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import { buildCards } from '@/components/lesson/cards';
import { useCourse } from '@/data/course/CourseProvider';
import { courseLessonNumber, findCourseLesson } from '@/data/course/learn';
import { RootStackParamList } from '@/navigation/types';

type LessonOverviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Lesson'
>;

const LessonOverviewScreen: React.FC<LessonOverviewScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { bundle } = useCourse();
  const ref = findCourseLesson(route.params.lessonId);

  if (ref == null) {
    return null;
  }

  const { lesson, module } = ref;
  const intro = lesson.intro ?? {
    summary: lesson.objective,
    keyPoints: [
      'Learn the rule behind the most common exam scenarios.',
      'See the trap that makes a plausible answer wrong.',
      'Check your understanding with a short test.',
    ],
    theoryMinutes: Math.max(
      4,
      Number.parseInt(lesson.estimatedMinutes, 10) || 6,
    ),
    testMinutes: Math.max(2, Math.ceil(lesson.questionIds.length / 2)),
  };
  const slideCount = buildCards(lesson).length;
  const testQuestionCount = (lesson.testQuestionIds ?? lesson.questionIds)
    .length;

  return (
    <Screen
      contentContainerStyle={{
        paddingTop: Platform.OS === 'ios' ? 18 : insets.top + 14,
        paddingBottom: insets.bottom + 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      {Platform.OS !== 'ios' && (
        <BackButton onPress={() => navigation.goBack()} hitSlop={12}>
          <Icon name="chevron-left" size={16} color={theme.colors.strong} />
        </BackButton>
      )}

      <Eyebrow>
        {module.title} · Lesson {courseLessonNumber(lesson.lessonId)}
      </Eyebrow>
      <Title>{lesson.title}</Title>
      <Summary>{intro.summary}</Summary>

      <MetaRow>
        <MetaChip>
          <MetaValue>{slideCount}</MetaValue>
          <MetaLabel>slides</MetaLabel>
        </MetaChip>
        <MetaChip>
          <MetaValue>{intro.theoryMinutes} min</MetaValue>
          <MetaLabel>theory</MetaLabel>
        </MetaChip>
        <MetaChip>
          <MetaValue>{testQuestionCount}</MetaValue>
          <MetaLabel>questions</MetaLabel>
        </MetaChip>
      </MetaRow>

      <SectionTitle>What you will know</SectionTitle>
      <KeyPointList>
        {intro.keyPoints.map(point => (
          <KeyPoint key={point}>
            <CheckCircle>
              <Icon name="check" size={11} color="#ffffff" />
            </CheckCircle>
            <KeyPointText>{point}</KeyPointText>
          </KeyPoint>
        ))}
      </KeyPointList>

      <StateNote>
        <Icon name="bookmark" size={16} color={theme.colors.accent} />
        <StateNoteText>
          Built for the {bundle.course.state} knowledge test. State-specific
          facts are marked inside the theory.
        </StateNoteText>
      </StateNote>

      <Actions>
        <PrimaryButton
          label="Study the theory"
          sublabel={`${intro.theoryMinutes} min`}
          onPress={() =>
            navigation.navigate('Theory', { lessonId: lesson.lessonId })
          }
        />
        <TestButton
          onPress={() =>
            navigation.navigate('Quiz', {
              mode: 'lessonTest',
              lessonId: lesson.lessonId,
            })
          }
        >
          <TestButtonText>Go straight to the test</TestButtonText>
          <TestButtonMeta>{intro.testMinutes} min</TestButtonMeta>
        </TestButton>
      </Actions>
    </Screen>
  );
};

export default LessonOverviewScreen;

const Screen = styled.ScrollView`
  flex: 1;
  padding: 0 22px;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const BackButton = styled.Pressable`
  width: 42px;
  height: 42px;
  margin-bottom: 20px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.line};
`;

const Eyebrow = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 10px;
  font-size: 11px;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
`;

const Title = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 14px;
  font-size: 32px;
  line-height: 39px;
  letter-spacing: -1.1px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Summary = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin-bottom: 22px;
  font-size: 17px;
  line-height: 27px;
  color: ${({ theme }) => theme.colors.body};
`;

const MetaRow = styled.View`
  flex-direction: row;
  gap: 9px;
  margin-bottom: 30px;
`;

const MetaChip = styled.View`
  flex: 1;
  padding: 13px 10px;
  border-radius: 14px;
  background-color: ${({ theme }) => theme.colors.faint};
`;

const MetaValue = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 15px;
  color: ${({ theme }) => theme.colors.ink};
`;

const MetaLabel = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin-top: 2px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const SectionTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 14px;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.ink};
`;

const KeyPointList = styled.View`
  gap: 14px;
  margin-bottom: 26px;
`;

const KeyPoint = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
`;

const CheckCircle = styled.View`
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accent};
`;

const KeyPointText = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  flex: 1;
  font-size: 15.5px;
  line-height: 23px;
  color: ${({ theme }) => theme.colors.body};
`;

const StateNote = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 11px;
  margin-bottom: 28px;
  padding: 15px 16px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const StateNoteText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  flex: 1;
  font-size: 13.5px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.body};
`;

const Actions = styled.View`
  gap: 11px;
`;

const TestButton = styled.Pressable`
  height: 54px;
  padding: 0 20px;
  border-radius: 9999px;
  border: 1.5px solid ${({ theme }) => theme.colors.accent};
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;
`;

const TestButtonText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 15.5px;
  color: ${({ theme }) => theme.colors.accent};
`;

const TestButtonMeta = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted};
`;
