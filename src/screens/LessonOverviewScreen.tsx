import React from 'react';
import { Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import CourseAssetView from '@/components/CourseAssetView';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import { buildCards } from '@/components/lesson/cards';
import {
  courseLessonNumber,
  findCourseAsset,
  findCourseLesson,
} from '@/data/course/learn';
import type { CourseAssetV2, CourseLessonV2 } from '@/data/course/v2/wire';
import { blockAssetIds } from '@/data/course/v2/wire';
import { RootStackParamList } from '@/navigation/types';

type LessonOverviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Lesson'
>;

// The lesson's own opening illustration, as the screen's hero. Reading order
// over the blocks — not `lesson.assetIds`, which is a flat bag that also
// carries the quiz diagrams and is not ordered by where the art appears.
const lessonHeroAsset = (lesson: CourseLessonV2): CourseAssetV2 | undefined => {
  for (const block of lesson.blocks) {
    for (const assetId of blockAssetIds(block)) {
      const asset = findCourseAsset(assetId);
      if (asset != null) {
        return asset;
      }
    }
  }
  return undefined;
};

const LessonOverviewScreen: React.FC<LessonOverviewScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
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
  const hero = lessonHeroAsset(lesson);
  // The band the back control lives in: the status bar plus the navigation
  // bar. The hero runs underneath it, so the copy below only has to clear the
  // hero — without one, the content has to clear the band by itself.
  const chromeHeight = insets.top + (Platform.OS === 'ios' ? 46 : 14);

  return (
    <Root>
      <Screen
        // The hero is full-bleed under a transparent header, so iOS must not
        // inset the content to clear that bar (same posture as the
        // onboarding showcase step).
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 14 }}
        showsVerticalScrollIndicator={false}
      >
        {hero != null && (
          <Hero>
            <CourseAssetView asset={hero} radius={0} />
            {/* Keeps the back control readable over whatever the
                illustration happens to put under it. */}
            <HeroScrim height={chromeHeight + 10} />
          </Hero>
        )}

        <Content style={{ paddingTop: hero != null ? 22 : chromeHeight + 14 }}>
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
        </Content>
      </Screen>

      {/* Android's analog of the iOS navigation bar: it floats over the hero
          rather than scrolling with it, exactly like the native bar does. */}
      {Platform.OS !== 'ios' && (
        <BackButton
          style={{ top: insets.top + 8 }}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Icon name="chevron-left" size={16} color={theme.colors.strong} />
        </BackButton>
      )}
    </Root>
  );
};

export default LessonOverviewScreen;

type HeroScrimProps = {
  height: number;
};

// A white top fade over the hero. No gradient dependency in the app, and
// react-native-svg is already how every illustration here is drawn.
const HeroScrim: React.FC<HeroScrimProps> = ({ height }) => (
  <ScrimLayer pointerEvents="none" style={{ height }}>
    <Svg width="100%" height={height}>
      <Defs>
        <LinearGradient id="lessonHeroScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.92} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect
        x="0"
        y="0"
        width="100%"
        height={height}
        fill="url(#lessonHeroScrim)"
      />
    </Svg>
  </ScrimLayer>
);

const Root = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const Screen = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const Hero = styled.View`
  width: 100%;
  background-color: ${({ theme }) => theme.colors.faint};
`;

const ScrimLayer = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
`;

const Content = styled.View`
  padding: 0 22px;
`;

const BackButton = styled.Pressable`
  position: absolute;
  left: 16px;
  width: 42px;
  height: 42px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.line};
  background-color: rgba(255, 255, 255, 0.86);
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
