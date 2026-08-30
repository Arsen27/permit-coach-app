import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import UnofficialDisclaimer from '@/components/UnofficialDisclaimer';
import { retryStates, useStates } from '@/data/states';
import { useAppState } from '@/state/AppState';

import { STATE_SELECT_STEP } from './content';
import { pushNextStep } from './flow';
import { OnboardingParamList } from './types';
import {
  ContinueDock,
  Kicker,
  OptionCard,
  StepHint,
  StepScreen,
  StepTitle,
} from './ui';

type StateSelectScreenProps = NativeStackScreenProps<
  OnboardingParamList,
  'StateSelect'
>;

// First step of the ladder: which state's course to build. Only states with
// a shipped course are offered. Picking one is wipe-free here — there is no
// progress yet; the destructive switch lives in Settings.
const StateSelectScreen: React.FC<StateSelectScreenProps> = ({
  navigation,
}) => {
  const { user, setStateCode } = useAppState();
  const insets = useSafeAreaInsets();
  // The list is the server's. Until it answers there is nothing honest to
  // show: the states the binary carries may not be the ones on offer.
  const { states, source, offline } = useStates();

  return (
    <StepScreen>
      <Body>
        <Kicker>{STATE_SELECT_STEP.kicker}</Kicker>
        <StepTitle style={{ marginTop: 8 }}>
          {STATE_SELECT_STEP.title}
        </StepTitle>
        <StepHint style={{ marginTop: 6 }}>{STATE_SELECT_STEP.hint}</StepHint>
        {offline && (
          <Notice>
            <NoticeTitle>No connection</NoticeTitle>
            <NoticeBody>
              {source === 'cache'
                ? 'Showing the states from your last visit. Connect to see the full list.'
                : 'The list of states is downloaded when you start. Connect and try again.'}
            </NoticeBody>
            <NoticeAction onPress={() => void retryStates()}>
              <NoticeActionLabel>Try again</NoticeActionLabel>
            </NoticeAction>
          </Notice>
        )}
        <Options>
          {states.map(state => (
            <OptionCard
              key={state.code}
              label={state.name}
              multi={false}
              selected={user.stateCode === state.code}
              onPress={() => setStateCode(state.code)}
            />
          ))}
        </Options>
        {/* On the first step the learner sees before anything is bought or
            promised — kept clear of the floating CTA (54px button + 22px
            float) so neither ever covers the other. */}
        <Disclaimer style={{ marginBottom: insets.bottom + 96 }} />
      </Body>
      <ContinueDock
        disabled={states.length === 0}
        onPress={() => {
          // Reported on continue, not on tap: the learner can change their
          // mind on this screen, and only the choice they leave with matters.
          track('onboarding_state_selected', { state_code: user.stateCode });
          pushNextStep(navigation, 0);
        }}
      />
    </StepScreen>
  );
};

const Body = styled.View`
  flex: 1;
  padding: 24px 24px 0;
`;

const Options = styled.View`
  margin-top: 22px;
  gap: 10px;
`;

const Notice = styled.View`
  margin-top: 22px;
  padding: 14px 16px;
  border-radius: 14px;
  background-color: ${({ theme }) => theme.colors.faint};
`;

const NoticeTitle = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 14px;
  color: ${({ theme }) => theme.colors.ink};
`;

const NoticeBody = styled.Text`
  ${({ theme }) => theme.fonts.regular}
  margin-top: 4px;
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.body};
`;

const NoticeAction = styled.Pressable`
  margin-top: 10px;
  align-self: flex-start;
`;

const NoticeActionLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 13px;
  color: ${({ theme }) => theme.colors.accent};
`;

const Disclaimer = styled(UnofficialDisclaimer)`
  margin-top: auto;
`;

export default StateSelectScreen;
