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
import { SignCategoryGlyph } from '@/data/signs/wire';
import { RootNavigation } from '@/navigation/types';
import { rgba, shadows } from '@/theme';

// Miniature sign silhouettes for the category rows, mirroring the reference's
// CSS glyphs. Both the shape and the colour come from the category record, so
// adding a category is a content change rather than a code change here.
const CategoryGlyph: React.FC<{ glyph: SignCategoryGlyph; color: string }> = ({
  glyph,
  color,
}) => {
  switch (glyph) {
    case 'octagon':
      return (
        <Svg width={22} height={22} viewBox="0 0 100 100">
          <Polygon
            points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30"
            fill={color}
          />
        </Svg>
      );
    case 'tallRect':
      return <TallRect style={{ backgroundColor: color }} />;
    case 'wideRect':
      return <WideRect style={{ backgroundColor: color }} />;
    case 'pennant':
      return (
        <Svg width={22} height={22} viewBox="0 0 100 100">
          <Polygon points="2,18 98,50 2,82" fill={color} />
        </Svg>
      );
    case 'circle':
      return <Circle style={{ backgroundColor: color }} />;
    case 'diamond':
    default:
      return <Diamond style={{ backgroundColor: color }} />;
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
                $bg={rgba(category.color, tintOpacity(category.color))}
                $size={42}
                $radius={12}
              >
                <CategoryGlyph glyph={category.glyph} color={category.color} />
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

// Pale tints read weaker against a light tile, so a bright category gets a
// touch more of it. Derived from the colour itself rather than a per-category
// exception, which would need editing every time a category is added.
const tintOpacity = (hex: string): number => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? 0.14 : 0.09;
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
`;

const WideRect = styled.View`
  width: 22px;
  height: 16px;
  border-radius: 3px;
`;

const Circle = styled.View`
  width: 21px;
  height: 21px;
  border-radius: 11px;
`;

export default SignsScreen;
