import React, { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import CourseInstallSheet from '@/components/CourseInstallSheet';
import GlassCircleButton from '@/components/GlassCircleButton';
import Icon from '@/components/Icon';
import { Group } from '@/components/rows';
import { courseIdForState } from '@/data/course';
import { courseStore } from '@/data/course/store';
import { useCourseInstall } from '@/data/course/useCourseInstall';
import { SUPPORTED_STATES, UsState } from '@/data/states';
import { RootStackParamList } from '@/navigation/types';
import { useAppState } from '@/state/AppState';

type StatePickerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'StatePicker'
>;

// Long enough for the ring to finish its sweep and the checkmark to read
// before the sheet closes with the switch.
const DONE_HOLD_MS = 900;

const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// The selected state drives the course, so switching is destructive: the old
// state's progress dies with its course. The list is only the states that
// actually have a course.
//
// The new state's course has to be on the phone before the switch: nothing
// ships in the binary, so a state whose course was never downloaded goes
// through the download sheet first, and the switch only happens once the
// course committed. A failed download changes nothing — the learner stays on
// the state they had.
const StatePickerScreen: React.FC<StatePickerScreenProps> = ({
  navigation,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, changeStateWipingProgress } = useAppState();
  const install = useCourseInstall();
  // The state whose course is downloading (or failed to); drives the sheet.
  const [target, setTarget] = useState<UsState | null>(null);

  const switchTo = useCallback(
    (state: UsState) => {
      track('state_changed', { from: user.stateCode, to: state.code });
      changeStateWipingProgress(state.code);
      navigation.goBack();
    },
    [changeStateWipingProgress, navigation, user.stateCode],
  );

  const download = useCallback(
    async (state: UsState) => {
      setTarget(state);
      const startedAt = Date.now();
      const result = await install.start(courseIdForState(state.code));
      track('course_download_finished', {
        source: 'state_switch',
        outcome:
          result.status === 'installed'
            ? 'ok'
            : result.status === 'app-update-required'
            ? 'app_update_required'
            : result.status,
        duration_ms: Date.now() - startedAt,
      });
      if (result.status === 'installed') {
        await wait(DONE_HOLD_MS);
        switchTo(state);
      }
    },
    [install, switchTo],
  );

  const cancelDownload = useCallback(() => {
    install.reset();
    setTarget(null);
  }, [install]);

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
          onPress: async () => {
            // A course chosen before is still on the phone: switch straight
            // away. Anything else is downloaded first.
            const stored = await courseStore.hydrateCourse(
              courseIdForState(state.code),
            );
            if (stored != null) {
              switchTo(state);
              return;
            }
            download(state);
          },
        },
      ],
    );
  };

  return (
    <>
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
      <CourseInstallSheet
        phase={install.phase}
        progress={install.progress}
        stateName={target?.name ?? ''}
        onRetry={() => {
          if (target != null) {
            download(target);
          }
        }}
        onCancel={cancelDownload}
      />
    </>
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
