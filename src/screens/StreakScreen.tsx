import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { track } from '@/analytics';
import { useAuth } from '@/auth/AuthProvider';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import { markStreakModalShown } from '@/lib/streakModalStore';
import { RootNavigation, RootStackParamList } from '@/navigation/types';
import { useAppState } from '@/state/AppState';
import { effectiveStreak, localToday, streakWeek } from '@/state/streak';
import { rgba } from '@/theme';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const NUMBER_WORDS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

const asWords = (value: number): string => NUMBER_WORDS[value] ?? String(value);

// The daily auto-show only fires at 2+ days, but the header chip opens the
// sheet with any streak — including none at all.
const leadCopy = (days: number, studiedToday: boolean): string => {
  if (days === 0) {
    return 'One lesson today starts your streak.';
  }
  if (days === 1) {
    return studiedToday
      ? "You've studied today — come back tomorrow to keep it going."
      : 'You studied yesterday — one lesson today keeps it alive.';
  }
  const words = asWords(days);
  return studiedToday
    ? `You've studied ${words} days in a row — one more lesson keeps it alive.`
    : `You've studied ${words} days in a row — one lesson today keeps it alive.`;
};

// Streak sheet per the onboarding board ("12 Streak — iOS sheet in-app"):
// flame badge, big count, week strip of flame dots, lifetime stats row.
// Presented as a native formSheet route (UISheetPresentationController on
// iOS) sized to its content — see the Streak screen options in App.tsx. iOS
// draws the system grabber; Android gets a hand-drawn analog.
const StreakScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'Streak'>>();
  const { userId } = useAuth();
  const { streak } = useAppState();

  const today = localToday();
  const days = effectiveStreak(streak, today);
  const week = streakWeek(streak, today);
  const studiedToday = streak.lastActiveDate === today;

  // Any presentation — the daily gate or the header chip — counts as today's
  // showing, so the gate won't pop the sheet again later in the day.
  useEffect(() => {
    markStreakModalShown(userId, localToday());
  }, [userId]);

  // The sheet is the app's only retention nudge, so both how often the daily
  // gate fires it and what streak it lands on are worth knowing. Fires once
  // per presentation — the route is mounted fresh each time.
  useEffect(() => {
    track('streak_sheet_opened', {
      streak: days,
      longest_streak: streak.longestStreak,
      days_studied: streak.daysStudied,
      studied_today: studiedToday,
      source: route.params?.source ?? 'manual',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Sheet
      style={{
        paddingTop: Platform.OS === 'ios' ? 26 : 10,
        // The home indicator overlays this gap rather than sitting below it,
        // so clearing it is enough — a full inset + margin reads as a hole.
        paddingBottom: Math.max(insets.bottom, 16),
      }}
    >
      {Platform.OS !== 'ios' && <Grabber />}

      <Hero>
        <Badge>
          <Icon name="flame" size={44} color={theme.colors.warning} />
        </Badge>
        <Count>{days}</Count>
        <CountLabel>day streak</CountLabel>
        <Lead>{leadCopy(days, studiedToday)}</Lead>
      </Hero>

      <Week>
        {week.map((day, index) => {
          const lit = day.state === 'done';
          const isToday = day.date === today;
          // Today burns solid with a glow once studied; past run days are
          // soft amber; everything else is a dashed empty slot.
          return (
            <DayCell key={day.date}>
              {lit && isToday ? (
                <DayDotToday
                  style={{
                    boxShadow: `0 0 0 3.5px ${rgba(theme.colors.warning, 0.2)}`,
                  }}
                >
                  <Icon name="flame" size={18} color={theme.colors.bg} />
                </DayDotToday>
              ) : lit ? (
                <DayDotDone>
                  <Icon name="flame" size={17} color={theme.colors.warning} />
                </DayDotDone>
              ) : (
                <DayDotEmpty />
              )}
              <DayLabel $lit={lit} $today={isToday}>
                {DAY_LABELS[index]}
              </DayLabel>
            </DayCell>
          );
        })}
      </Week>

      <Stats>
        <Stat>
          <StatValue>{days}</StatValue>
          <StatLabel>Current streak</StatLabel>
        </Stat>
        <Stat>
          <StatValue>{streak.longestStreak}</StatValue>
          <StatLabel>Longest streak</StatLabel>
        </Stat>
        <Stat>
          <StatValue>{streak.daysStudied}</StatValue>
          <StatLabel>Days studied</StatLabel>
        </Stat>
      </Stats>

      <PrimaryButton
        label="Continue studying"
        onPress={() => navigation.goBack()}
      />
    </Sheet>
  );
};

const Sheet = styled.View`
  padding: 0 22px;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const Grabber = styled.View`
  width: 38px;
  height: 5px;
  border-radius: 3px;
  background-color: ${({ theme }) => theme.colors.dim2};
  align-self: center;
  margin-bottom: 22px;
`;

const Hero = styled.View`
  align-items: center;
  margin-bottom: 24px;
`;

const Badge = styled.View`
  width: 96px;
  height: 96px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  background-color: ${({ theme }) => rgba(theme.colors.warning, 0.12)};
`;

const Count = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 56px;
  line-height: 56px;
  letter-spacing: -2.2px;
  color: ${({ theme }) => theme.colors.ink};
  font-variant: tabular-nums;
`;

const CountLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  margin-top: 6px;
  font-size: 15px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.body};
`;

const Lead = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin-top: 4px;
  font-size: 13.5px;
  line-height: 20px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

const Week = styled.View`
  flex-direction: row;
  gap: 4px;
  margin-bottom: 20px;
`;

const DayCell = styled.View`
  flex: 1;
  align-items: center;
  gap: 7px;
`;

const DayDotDone = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => rgba(theme.colors.warning, 0.14)};
`;

const DayDotToday = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.warning};
`;

const DayDotEmpty = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 9999px;
  border: 1.5px dashed ${({ theme }) => theme.colors.dim2};
`;

const DayLabel = styled.Text<{ $lit: boolean; $today: boolean }>`
  ${({ theme, $lit, $today }) =>
    $today
      ? theme.fonts.extraBold
      : $lit
      ? theme.fonts.bold
      : theme.fonts.semiBold}
  font-size: 11px;
  color: ${({ theme, $lit, $today }) => {
    if ($today) {
      return theme.colors.ink;
    }
    return $lit ? theme.colors.body : theme.colors.dim;
  }};
`;

const Stats = styled.View`
  flex-direction: row;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colors.line};
  padding-top: 16px;
  margin-bottom: 22px;
`;

const Stat = styled.View`
  flex: 1;
`;

const StatValue = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 19px;
  letter-spacing: -0.4px;
  color: ${({ theme }) => theme.colors.ink};
  font-variant: tabular-nums;
`;

const StatLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  margin-top: 2px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted};
`;

export default StreakScreen;
