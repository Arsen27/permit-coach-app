import React, { useCallback, useLayoutEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import GlassCircleButton from '@/components/GlassCircleButton';
import Icon from '@/components/Icon';
import SignArt from '@/components/SignArt';
import { Eyebrow } from '@/components/typography';
import { categoryColor, findCategory, findSign } from '@/data/signs';
import { RootStackParamList } from '@/navigation/types';
import { useAppState } from '@/state/AppState';
import { rgba } from '@/theme';

type SignDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SignDetail'
>;

const SignDetailScreen: React.FC<SignDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { savedSignIds, toggleSavedSign } = useAppState();
  const sign = findSign(route.params.signId);
  const category = sign != null ? findCategory(sign.categoryId) : undefined;
  const saved = sign != null && savedSignIds.includes(sign.id);

  const toggleBookmark = useCallback(
    (signId: string, wasSaved: boolean) => {
      track('sign_bookmark_toggled', { sign_id: signId, saved: !wasSaved });
      toggleSavedSign(signId);
    },
    [toggleSavedSign],
  );

  // iOS: category title + bookmark as a native UIBarButtonItem (glass bubble
  // on iOS 26); Android draws the analog header row below.
  useLayoutEffect(() => {
    if (Platform.OS !== 'ios' || sign == null || category == null) {
      return;
    }
    navigation.setOptions({
      title: category.name,
      unstable_headerRightItems: () => [
        {
          type: 'button',
          label: saved ? 'Saved' : 'Save',
          icon: {
            type: 'sfSymbol',
            name: saved ? 'bookmark.fill' : 'bookmark',
          },
          tintColor: saved ? theme.colors.accent : theme.colors.body,
          onPress: () => toggleBookmark(sign.id, saved),
        },
      ],
    });
  }, [
    navigation,
    sign,
    category,
    saved,
    toggleBookmark,
    theme.colors.accent,
    theme.colors.body,
  ]);

  if (sign == null || category == null) {
    return null;
  }
  const catColor = categoryColor[sign.categoryId];

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
          <HeaderCategory>{category.name}</HeaderCategory>
          <GlassCircleButton
            icon={saved ? 'bookmark-filled' : 'bookmark'}
            iconSize={16}
            iconColor={saved ? theme.colors.accent : theme.colors.body}
            onPress={() => toggleBookmark(sign.id, saved)}
          />
        </Header>
      )}

      <Stage>
        <SignArt art={sign.art} size={150} />
      </Stage>

      <Body>
        <Chips>
          <CategoryChip style={{ backgroundColor: rgba(catColor, 0.08) }}>
            <CategoryChipText style={{ color: catColor }}>
              {category.name.toUpperCase()}
            </CategoryChipText>
          </CategoryChip>
          <CodeChip>
            <CodeChipText>{sign.code}</CodeChipText>
          </CodeChip>
        </Chips>
        <Title>{sign.name}</Title>
        <Description>{sign.description}</Description>

        <Eyebrow style={{ marginBottom: 12 }}>What to do</Eyebrow>
        <Steps>
          {sign.steps.map((step, index) => (
            <Step key={step}>
              <StepBadge>
                <StepNumber>{index + 1}</StepNumber>
              </StepBadge>
              <StepText>{step}</StepText>
            </Step>
          ))}
        </Steps>

        <Trap>
          <Icon
            name="triangle-exclamation"
            size={15}
            color={theme.colors.warning}
          />
          <TrapText>Common exam trap: {sign.trap}</TrapText>
        </Trap>
      </Body>
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

const HeaderCategory = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  flex: 1;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted};
`;

const Stage = styled.View`
  align-items: center;
  padding: 26px 0 22px;
`;

const Body = styled.View`
  padding: 0 22px;
`;

const Chips = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-bottom: 8px;
`;

const CategoryChip = styled.View`
  padding: 4px 12px;
  border-radius: 9999px;
`;

const CategoryChipText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 11px;
  letter-spacing: 0.4px;
`;

const CodeChip = styled.View`
  padding: 4px 12px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.faint};
`;

const CodeChipText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted};
`;

const Title = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 18px;
  font-size: 24px;
  letter-spacing: -0.7px;
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};
`;

const Description = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin-bottom: 22px;
  font-size: 15px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.body};
`;

const Steps = styled.View`
  gap: 10px;
  margin-bottom: 24px;
`;

const Step = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
`;

const StepBadge = styled.View`
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
  align-items: center;
  justify-content: center;
  margin-top: 1px;
`;

const StepNumber = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 11px;
  color: ${({ theme }) => theme.colors.accent};
  font-variant: tabular-nums;
`;

const StepText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  flex: 1;
  font-size: 14px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.body};
`;

const Trap = styled.View`
  padding: 14px 16px;
  border-radius: 12px;
  background-color: rgba(245, 158, 11, 0.08);
  flex-direction: row;
  align-items: flex-start;
  gap: 11px;
`;

const TrapText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  flex: 1;
  font-size: 13px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.body};
`;

export default SignDetailScreen;
