import React, { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import { Group } from '@/components/rows';
import { useStoredCourse } from '@/data/course/CourseProvider';
import { bundleLessonCount } from '@/data/course/v2/wire';

import { useOnboarding } from './context';
import { Radio, StepScreen } from './ui';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const PRESETS = [
  { id: 'morning', label: 'Morning', hour: 8, minute: 0 },
  { id: 'afternoon', label: 'Afternoon', hour: 16, minute: 0 },
  { id: 'evening', label: 'Evening', hour: 18, minute: 0 },
] as const;

type PresetId = (typeof PRESETS)[number]['id'] | 'custom';

const timeAsDate = (hour: number, minute: number): Date =>
  new Date(2000, 0, 1, hour, minute);

const formatTime = (hour: number, minute: number): string =>
  timeAsDate(hour, minute).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

// "Mo, We and Fr" — the sheet's chip order, comma-joined with a final "and".
const formatDayList = (days: number[]): string => {
  const labels = [...days].sort((a, b) => a - b).map(day => DAY_LABELS[day]);
  if (labels.length <= 1) {
    return labels.join('');
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};

// Study-reminder ask, shown as a bottom sheet over a mock of the Learn screen
// (per the onboarding board). Preset times are list rows; "Custom time…"
// opens the platform's standard time picker — inline spinner on iOS, the
// system clock dialog on Android.
const RemindersScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The Building step downloaded the course before this sheet; the fallback
  // only keeps the mock honest-looking if a replayed flow ever lands here
  // without one.
  const course = useStoredCourse();
  const lessonCount = course == null ? 30 : bundleLessonCount(course.bundle);
  const { finish } = useOnboarding();

  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [choice, setChoice] = useState<PresetId>('evening');
  const [custom, setCustom] = useState<{ hour: number; minute: number } | null>(
    null,
  );
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Date>(timeAsDate(18, 0));

  const chosenTime = (): { hour: number; minute: number } => {
    if (choice === 'custom' && custom != null) {
      return custom;
    }
    const preset = PRESETS.find(entry => entry.id === choice) ?? PRESETS[2];
    return { hour: preset.hour, minute: preset.minute };
  };

  const toggleDay = (day: number) => {
    setDays(current =>
      current.includes(day)
        ? current.filter(entry => entry !== day)
        : [...current, day],
    );
  };

  const save = (hour: number, minute: number) => {
    finish({ days: [...days].sort((a, b) => a - b), hour, minute });
  };

  const openCustom = () => {
    const start = custom ?? chosenTime();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeAsDate(start.hour, start.minute),
        mode: 'time',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date != null) {
            setCustom({ hour: date.getHours(), minute: date.getMinutes() });
            setChoice('custom');
          }
        },
      });
      return;
    }
    setDraft(timeAsDate(start.hour, start.minute));
    setPicking(true);
  };

  return (
    <StepScreen>
      <Backdrop style={{ paddingTop: insets.top + 12 }}>
        <MockTitle>Permit test</MockTitle>
        <MockMeta>7 / {lessonCount} lessons · 508 pts</MockMeta>
        <MockUnitPill>
          <MockUnitLabel>Road rules I</MockUnitLabel>
        </MockUnitPill>
        <MockNodes>
          <MockNode style={{ backgroundColor: theme.colors.done }}>
            <Icon name="check" size={24} color={theme.colors.bg} />
          </MockNode>
          <MockNode style={{ backgroundColor: theme.colors.accent }}>
            <MockNodeText style={{ color: theme.colors.bg }}>2</MockNodeText>
          </MockNode>
          <MockNode style={{ backgroundColor: theme.colors.faint }}>
            <MockNodeText style={{ color: theme.colors.dim }}>3</MockNodeText>
          </MockNode>
        </MockNodes>
      </Backdrop>
      <Scrim />

      <Sheet
        style={[
          { paddingBottom: insets.bottom + 24 },
          { boxShadow: '0 -18px 60px rgba(0, 0, 0, 0.22)' },
        ]}
      >
        <Grabber />

        {!picking ? (
          <>
            <SheetTitle>When should we remind you?</SheetTitle>
            <SheetLead>
              A few minutes a day is enough to keep the streak going.
            </SheetLead>

            <ChipRow>
              {DAY_LABELS.map((label, day) => {
                const active = days.includes(day);
                return (
                  <DayChip
                    key={label}
                    $active={active}
                    onPress={() => toggleDay(day)}
                  >
                    <DayChipLabel $active={active}>{label}</DayChipLabel>
                  </DayChip>
                );
              })}
            </ChipRow>

            <Group style={{ marginBottom: 20 }}>
              {PRESETS.map(preset => {
                const selected = choice === preset.id;
                return (
                  <TimeRow
                    key={preset.id}
                    $selected={selected}
                    $divider
                    onPress={() => setChoice(preset.id)}
                  >
                    <TimeLabel $selected={selected}>
                      {preset.label} · {formatTime(preset.hour, preset.minute)}
                    </TimeLabel>
                    <Radio selected={selected} />
                  </TimeRow>
                );
              })}
              <TimeRow $selected={choice === 'custom'} onPress={openCustom}>
                <TimeLabel $selected={choice === 'custom'}>
                  {custom != null
                    ? `Custom · ${formatTime(custom.hour, custom.minute)}`
                    : 'Custom time…'}
                </TimeLabel>
                {choice === 'custom' ? (
                  <Radio selected />
                ) : (
                  <Icon
                    name="chevron-right"
                    size={13}
                    color={theme.colors.dim2}
                  />
                )}
              </TimeRow>
            </Group>

            <PrimaryButton
              label="Set reminder"
              disabled={days.length === 0}
              onPress={() => {
                const time = chosenTime();
                save(time.hour, time.minute);
              }}
            />
          </>
        ) : (
          <>
            <BackLink onPress={() => setPicking(false)}>
              <Icon name="chevron-left" size={13} color={theme.colors.accent} />
              <BackLabel>Back</BackLabel>
            </BackLink>
            <SheetTitle>Pick a time</SheetTitle>
            <SheetLead>
              {days.length > 0
                ? `We'll remind you on ${formatDayList(days)}.`
                : 'Pick at least one day of the week.'}
            </SheetLead>

            <PickerWrap>
              <DateTimePicker
                value={draft}
                mode="time"
                display="spinner"
                themeVariant="light"
                textColor={theme.colors.ink}
                minuteInterval={5}
                onChange={(_event: DateTimePickerEvent, date?: Date) => {
                  if (date != null) {
                    setDraft(date);
                  }
                }}
              />
            </PickerWrap>

            <PrimaryButton
              label={`Set reminder for ${formatTime(
                draft.getHours(),
                draft.getMinutes(),
              )}`}
              disabled={days.length === 0}
              onPress={() => {
                setCustom({
                  hour: draft.getHours(),
                  minute: draft.getMinutes(),
                });
                setChoice('custom');
                save(draft.getHours(), draft.getMinutes());
              }}
            />
          </>
        )}

        <SkipAction onPress={() => finish(null)}>
          <SkipLabel>Not now</SkipLabel>
        </SkipAction>
      </Sheet>
    </StepScreen>
  );
};

const Backdrop = styled.View`
  flex: 1;
  padding: 0 22px;
`;

const MockTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 26px;
  letter-spacing: -0.8px;
  margin-bottom: 4px;
  color: ${({ theme }) => theme.colors.ink};
`;

const MockMeta = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  margin-bottom: 20px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const MockUnitPill = styled.View`
  height: 52px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.faint};
  align-items: center;
  justify-content: center;
`;

const MockUnitLabel = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 15.5px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.ink};
`;

const MockNodes = styled.View`
  flex-direction: row;
  justify-content: space-around;
  margin-top: 34px;
`;

const MockNode = styled.View`
  width: 64px;
  height: 64px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
`;

const MockNodeText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 20px;
`;

const Scrim = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(24, 24, 27, 0.42);
`;

const Sheet = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  background-color: ${({ theme }) => theme.colors.bg};
  padding: 10px 22px;
`;

const Grabber = styled.View`
  width: 38px;
  height: 5px;
  border-radius: 3px;
  background-color: ${({ theme }) => theme.colors.dim2};
  align-self: center;
  margin-bottom: 20px;
`;

const SheetTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 21px;
  line-height: 26px;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
  color: ${({ theme }) => theme.colors.ink};
`;

const SheetLead = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13.5px;
  line-height: 20px;
  margin-bottom: 20px;
  color: ${({ theme }) => theme.colors.strong};
`;

const ChipRow = styled.View`
  flex-direction: row;
  gap: 8px;
  margin-bottom: 18px;
`;

const DayChip = styled.Pressable<{ $active: boolean }>`
  flex: 1;
  height: 44px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.faint};
`;

const DayChipLabel = styled.Text<{ $active: boolean }>`
  ${({ theme, $active }) => ($active ? theme.fonts.bold : theme.fonts.semiBold)}
  font-size: 13px;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.bg : theme.colors.strong};
`;

const TimeRow = styled.Pressable<{ $selected: boolean; $divider?: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom-width: ${({ $divider }) => ($divider ? 1 : 0)}px;
  border-bottom-color: ${({ theme }) => theme.colors.faint};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : 'transparent'};
`;

const TimeLabel = styled.Text<{ $selected: boolean }>`
  ${({ theme, $selected }) =>
    $selected ? theme.fonts.bold : theme.fonts.semiBold}
  flex: 1;
  font-size: 15px;
  letter-spacing: ${({ $selected }) => ($selected ? -0.2 : 0)}px;
  color: ${({ theme }) => theme.colors.ink};
  font-variant: tabular-nums;
`;

const BackLink = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  align-self: flex-start;
`;

const BackLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 14.5px;
  color: ${({ theme }) => theme.colors.accent};
`;

const PickerWrap = styled.View`
  align-items: center;
  margin-bottom: 8px;
`;

const SkipAction = styled.Pressable`
  align-items: center;
  padding-top: 14px;
`;

const SkipLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

export default RemindersScreen;
