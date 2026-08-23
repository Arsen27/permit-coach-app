import React from 'react';
import { Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import GlassCircleButton from '@/components/GlassCircleButton';
import Icon from '@/components/Icon';
import { Group } from '@/components/rows';
import { SUPPORTED_STATES, UsState } from '@/data/states';
import { RootStackParamList } from '@/navigation/types';
import { useAppState } from '@/state/AppState';

type StatePickerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'StatePicker'
>;

// The selected state drives the course, so switching is destructive: the old
// state's progress dies with its course. The list is only the states that
// actually have a course.
const StatePickerScreen: React.FC<StatePickerScreenProps> = ({
  navigation,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, changeStateWipingProgress } = useAppState();

  const pick = (state: UsState) => {
    if (state.code === user.stateCode) {
      navigation.goBack();
      return;
    }
    // Always warn: even a fresh-looking account may carry progress the
    // learner forgot about, and a silent wipe is never worth the saved tap.
    Alert.alert(
      `Switch to ${state.name}?`,
      `Your course progress, scores and mistakes will be permanently erased — the ${state.name} course starts from scratch. Your streak stays.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch & erase',
          style: 'destructive',
          onPress: () => {
            track('state_changed', {
              from: user.stateCode,
              to: state.code,
            });
            changeStateWipingProgress(state.code);
            navigation.goBack();
          },
        },
      ],
    );
  };

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
          <HeaderTitle>State</HeaderTitle>
        </Header>
      )}
      <Body>
        <Group>
          {SUPPORTED_STATES.map((state, index) => {
            const selected = state.code === user.stateCode;
            return (
              <StateRow
                key={state.code}
                $divider={index < SUPPORTED_STATES.length - 1}
                $selected={selected}
                onPress={() => pick(state)}
              >
                <StateName $selected={selected}>{state.name}</StateName>
                {selected && (
                  <Icon name="check" size={14} color={theme.colors.accent} />
                )}
              </StateRow>
            );
          })}
        </Group>
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

const HeaderTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  flex: 1;
  font-size: 19px;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Body = styled.View`
  padding: 0 22px;
`;

const StateRow = styled.Pressable<{ $divider: boolean; $selected: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 13px 16px;
  border-bottom-width: ${({ $divider }) => ($divider ? 1 : 0)}px;
  border-bottom-color: ${({ theme }) => theme.colors.faint};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : 'transparent'};
`;

const StateName = styled.Text<{ $selected: boolean }>`
  ${({ theme, $selected }) =>
    $selected ? theme.fonts.bold : theme.fonts.semiBold}
  font-size: 14.5px;
  color: ${({ theme }) => theme.colors.ink};
`;

export default StatePickerScreen;
