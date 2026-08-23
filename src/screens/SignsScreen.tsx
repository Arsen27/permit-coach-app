import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import styled, { useTheme } from 'styled-components/native';

import { useNavigation } from '@react-navigation/native';

import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { Group, Row, RowTile } from '@/components/rows';
import { Eyebrow } from '@/components/typography';
import { signCategories, signsByCategory } from '@/data/signs';
import { RootNavigation } from '@/navigation/types';
import { rgba, shadows, signColors } from '@/theme';

// Miniature sign silhouettes for the category rows, mirroring the reference's
// CSS glyphs.
const CategoryGlyph: React.FC<{ categoryId: string }> = ({ categoryId }) => {
  switch (categoryId) {
    case 'regulatory':
      return (
        <Svg width={22} height={22} viewBox="0 0 100 100">
          <Polygon
            points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30"
            fill={signColors.regulatory}
          />
        </Svg>
      );
    case 'warning':
      return <Diamond style={{ backgroundColor: signColors.warning }} />;
    case 'guide':
      return <TallRect />;
    case 'highway':
      return <WideRect />;
    default:
      return <Diamond style={{ backgroundColor: signColors.workzone }} />;
  }
};

const SignsScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigation>();

  return (
    <Screen
      contentContainerStyle={
        Platform.OS === 'ios'
          ? { paddingTop: 10, paddingBottom: 24 }
          : { paddingTop: insets.top + 10, paddingBottom: 110 + insets.bottom }
      }
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Signs" />

      <QuizBanner>
        <BannerBody>
          <BannerTitle>Signs quiz</BannerTitle>
          <BannerMeta>20 flashcards · ~5 min</BannerMeta>
        </BannerBody>
        <StartPill
          style={({ pressed }) => [
            shadows.chipOnAccent,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => navigation.navigate('Quiz', { mode: 'signsQuiz' })}
        >
          <StartPillText>Start</StartPillText>
        </StartPill>
      </QuizBanner>

      <Section>
        <Eyebrow style={{ marginBottom: 12 }}>Cheatsheet</Eyebrow>
        <Group>
          {signCategories.map((category, index) => (
            <Row
              key={category.id}
              $divider={index < signCategories.length - 1}
              onPress={() =>
                navigation.navigate('SignCategory', {
                  categoryId: category.id,
                })
              }
              style={{ gap: 14, paddingVertical: 15 }}
            >
              <RowTile
                $bg={rgba(
                  categoryColorHex(category.id),
                  category.id === 'warning' ? 0.14 : 0.09,
                )}
                $size={42}
                $radius={12}
              >
                <CategoryGlyph categoryId={category.id} />
              </RowTile>
              <View style={{ flex: 1 }}>
                <CategoryTitle>{category.name}</CategoryTitle>
                <CategoryMeta>
                  {signsByCategory(category.id).length} signs ·{' '}
                  {category.subtitle}
                </CategoryMeta>
              </View>
              <Icon name="chevron-right" size={12} color={theme.colors.dim2} />
            </Row>
          ))}
        </Group>
      </Section>
    </Screen>
  );
};

const categoryColorHex = (categoryId: string): string => {
  switch (categoryId) {
    case 'regulatory':
      return signColors.regulatory;
    case 'warning':
      return signColors.warning;
    case 'guide':
      return signColors.guide;
    case 'highway':
      return signColors.highway;
    default:
      return signColors.workzone;
  }
};

const Screen = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const QuizBanner = styled.View`
  margin: 0 22px 26px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.accent};
  padding: 14px 16px;
  flex-direction: row;
  align-items: center;
  gap: 14px;
`;

const BannerBody = styled.View`
  flex: 1;
`;

const BannerTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 2px;
  font-size: 15px;
  letter-spacing: -0.25px;
  color: #ffffff;
`;

const BannerMeta = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  font-variant: tabular-nums;
`;

const StartPill = styled.Pressable`
  padding: 9px 18px;
  border-radius: 9999px;
  background-color: #ffffff;
`;

const StartPillText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 13px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.accent};
`;

const Section = styled.View`
  padding: 0 22px;
`;

const CategoryTitle = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  margin-bottom: 2px;
  font-size: 15px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.ink};
`;

const CategoryMeta = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const Diamond = styled.View`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  transform: rotate(45deg);
`;

const TallRect = styled.View`
  width: 18px;
  height: 22px;
  border-radius: 4px;
  background-color: ${signColors.guide};
`;

const WideRect = styled.View`
  width: 22px;
  height: 16px;
  border-radius: 3px;
  background-color: ${signColors.highway};
`;

export default SignsScreen;
