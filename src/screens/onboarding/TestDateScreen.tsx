import React, { useState } from 'react';
import { Platform } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import Icon from '@/components/Icon';
import { requestNotificationPermission } from '@/lib/notifications';

import { TEST_DATE_LADDER_INDEX, TEST_DATE_STEP } from './content';
import { useOnboarding } from './context';
import { pushNextStep } from './flow';
import { OnboardingParamList } from './types';
import {
  CheckBox,
  ContinueDock,
  FadeIn,
  Kicker,
  StepHint,
  StepScreen,
  StepTitle,
} from './ui';

type TestDateScreenProps = NativeStackScreenProps<
  OnboardingParamList,
  'TestDate'
>;

// Booking a DMV test more than a year out is not a thing; the window keeps
// the spinner short enough to be usable.
const MAX_MONTHS_AHEAD = 12;

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addMonths = (date: Date, months: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + months, date.getDate());

export const daysUntil = (from: Date, to: Date): number =>
  Math.max(
    0,
    Math.round(
      (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
    ),
  );

export const formatTestDate = (date: Date): string =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const summaryFor = (date: Date, today: Date): string => {
  const days = daysUntil(today, date);
  const window =
    days === 0
      ? 'today'
      : days === 1
      ? '1 day to study'
      : `${days} days to study`;
  return `${formatTestDate(date)} · ${window}`;
};

// Question 5: the booked test date, taken with the platform's own date
// picker (inline spinner on iOS, the system dialog on Android) rather than a
// hand-rolled wheel. "Not scheduled yet" is a valid answer and switches the
// picker off instead of hiding it.
const TestDateScreen: React.FC<TestDateScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { testDate, setTestDate } = useOnboarding();
  const [today] = useState(() => startOfDay(new Date()));
  const [unscheduled, setUnscheduled] = useState(testDate === 'unscheduled');
  const picked = testDate instanceof Date ? testDate : null;
  const draft = picked ?? addMonths(today, 1);

  const choose = (date: Date) => {
    setUnscheduled(false);
    setTestDate(startOfDay(date));
  };

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: draft,
      mode: 'date',
      minimumDate: today,
      maximumDate: addMonths(today, MAX_MONTHS_AHEAD),
      onChange: (event: DateTimePickerEvent, date?: Date) => {
        if (event.type === 'set' && date != null) {
          choose(date);
        }
      },
    });
  };

  const toggleUnscheduled = () => {
    const next = !unscheduled;
    setUnscheduled(next);
    setTestDate(next ? 'unscheduled' : null);
  };

  return (
    <StepScreen>
      <Body>
        <Kicker>{TEST_DATE_STEP.kicker}</Kicker>
        <StepTitle style={{ marginTop: 8 }}>{TEST_DATE_STEP.title}</StepTitle>
        <StepHint style={{ marginTop: 6 }}>{TEST_DATE_STEP.hint}</StepHint>

        <PickerWrap $dimmed={unscheduled}>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              // The spinner takes the system appearance by default and can
              // land near-white on our white screen; pin it to ink on light.
              themeVariant="light"
              textColor={theme.colors.ink}
              minimumDate={today}
              maximumDate={addMonths(today, MAX_MONTHS_AHEAD)}
              disabled={unscheduled}
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
                if (date != null) {
                  choose(date);
                }
              }}
            />
          ) : (
            <AndroidField
              disabled={unscheduled}
              onPress={openAndroidPicker}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <AndroidFieldLabel $placeholder={picked == null}>
                {picked != null ? formatTestDate(picked) : 'Choose a date'}
              </AndroidFieldLabel>
              <Icon name="chevron-right" size={12} color={theme.colors.dim2} />
            </AndroidField>
          )}
        </PickerWrap>

        <FadeIn visible={picked != null && !unscheduled}>
          <Summary>
            <Icon name="flame" size={15} color={theme.colors.muted} />
            <SummaryText>
              {picked != null ? summaryFor(picked, today) : ''}
            </SummaryText>
          </Summary>
        </FadeIn>

        <UnscheduledRow
          accessibilityRole="checkbox"
          accessibilityState={{ checked: unscheduled }}
          onPress={toggleUnscheduled}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <CheckBox selected={unscheduled} />
          <UnscheduledLabel>{TEST_DATE_STEP.unscheduledLabel}</UnscheduledLabel>
        </UnscheduledRow>
      </Body>

      <ContinueDock
        disabled={picked == null && !unscheduled}
        onPress={() => {
          track('onboarding_test_date_selected', {
            scheduled: picked != null,
            days_until: picked != null ? daysUntil(today, picked) : null,
          });
          // The date is what reminders are paced against, so this is the
          // moment the ask makes sense. Whatever the answer (or if the
          // native module is missing), onboarding moves on.
          requestNotificationPermission()
            .then(result => {
              track('notification_permission_answered', {
                result,
                source: 'onboarding',
              });
            })
            .finally(() => {
              pushNextStep(navigation, TEST_DATE_LADDER_INDEX);
            });
        }}
      />
    </StepScreen>
  );
};

const Body = styled.View`
  flex: 1;
  padding: 24px 24px 0;
`;

const PickerWrap = styled.View<{ $dimmed: boolean }>`
  margin-top: 14px;
  opacity: ${({ $dimmed }) => ($dimmed ? 0.4 : 1)};
`;

const AndroidField = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 16px 17px;
  border-radius: 15px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.line};
`;

const AndroidFieldLabel = styled.Text<{ $placeholder: boolean }>`
  ${({ theme }) => theme.fonts.bold}
  flex: 1;
  font-size: 15px;
  letter-spacing: -0.2px;
  color: ${({ theme, $placeholder }) =>
    $placeholder ? theme.colors.dim : theme.colors.ink};
  font-variant: tabular-nums;
`;

const Summary = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 14px 17px;
  border-radius: 15px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const SummaryText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  flex: 1;
  font-size: 13.5px;
  letter-spacing: -0.15px;
  color: ${({ theme }) => theme.colors.body};
  font-variant: tabular-nums;
`;

const UnscheduledRow = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 13px;
  margin-top: 10px;
  padding: 14px 17px;
  border-radius: 15px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.line};
`;

const UnscheduledLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  flex: 1;
  font-size: 14.5px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.body};
`;

export default TestDateScreen;
