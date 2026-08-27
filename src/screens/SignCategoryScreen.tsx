import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import GlassCircleButton from '@/components/GlassCircleButton';
import Icon from '@/components/Icon';
import SignArt from '@/components/SignArt';
import { findCategory, signsByCategory } from '@/data/signs';
import { useSignsCatalog } from '@/data/signs/SignsProvider';
import { RootStackParamList } from '@/navigation/types';

type SignCategoryScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SignCategory'
>;

// Category cheatsheet: 3-column sign grid + "Test yourself" row.
const SignCategoryScreen: React.FC<SignCategoryScreenProps> = ({
  navigation,
  route,
}) => {
  useSignsCatalog();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const category = findCategory(route.params.categoryId);
  const categorySigns = signsByCategory(route.params.categoryId);

  if (category == null) {
    return null;
  }

  return (
    <Screen
      contentContainerStyle={{
        paddingTop: Platform.OS === 'ios' ? 10 : insets.top + 10,
        paddingBottom: 40 + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      {Platform.OS !== 'ios' && (
        <Header>
          <GlassCircleButton
            icon="chevron-left"
            iconColor={theme.colors.body}
            onPress={() => navigation.goBack()}
          />
          <HeaderTitle>{category.name}</HeaderTitle>
          <HeaderCount>{categorySigns.length} signs</HeaderCount>
        </Header>
      )}
      <Blurb>{category.blurb}</Blurb>
      <Grid>
        {categorySigns.map(sign => (
          <Card
            key={sign.id}
            onPress={() =>
              navigation.navigate('SignDetail', { signId: sign.id })
            }
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <SignArt art={sign.art} size={52} />
            <CardLabel numberOfLines={2}>{sign.name}</CardLabel>
          </Card>
        ))}
      </Grid>
      <TestRow
        onPress={() =>
          navigation.navigate('Quiz', {
            mode: 'categoryQuiz',
            categoryId: category.id,
          })
        }
      >
        <Icon name="list-check" size={14} color={theme.colors.muted} />
        <TestText>
          Test yourself on {category.name.toLowerCase()} signs
        </TestText>
        <Icon name="chevron-right" size={12} color={theme.colors.dim2} />
      </TestRow>
    </Screen>
  );
};

const Screen = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 20px 16px;
`;

const HeaderTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  flex: 1;
  font-size: 19px;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.ink};
`;

const HeaderCount = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const Blurb = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  padding: 0 20px 18px;
  font-size: 13px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.strong};
`;

const Grid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 20px;
`;

const Card = styled.Pressable`
  flex-basis: 30%;
  flex-grow: 1;
  max-width: 32%;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 14px;
  padding: 16px 8px 12px;
  align-items: center;
  gap: 10px;
`;

const CardLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 11px;
  text-align: center;
  line-height: 14px;
  color: ${({ theme }) => theme.colors.strong};
`;

const TestRow = styled.Pressable`
  margin: 20px 20px 0;
  padding: 13px 16px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.faint};
  flex-direction: row;
  align-items: center;
  gap: 11px;
`;

const TestText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  flex: 1;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.strong};
`;

export default SignCategoryScreen;
