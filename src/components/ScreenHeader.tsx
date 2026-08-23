import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import { useNavigation } from '@react-navigation/native';

import { RootNavigation } from '@/navigation/types';
import { useAppState } from '@/state/AppState';
import { effectiveStreak, localToday } from '@/state/streak';
import { shadows } from '@/theme';

import GlassSurface from './GlassSurface';
import Icon from './Icon';
import { ScreenTitle } from './typography';

type ScreenHeaderProps = {
  title: string;
};

// Tab-screen header: h1 + the daily-streak flame chip (shown in every tab
// header per the handoff). Tapping the chip opens the native streak sheet.
const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title }) => {
  const theme = useTheme();
  const { streak } = useAppState();
  const navigation = useNavigation<RootNavigation>();
  const streakDays = effectiveStreak(streak, localToday());

  return (
    <Row>
      <ScreenTitle>{title}</ScreenTitle>
      <ChipPress
        onPress={() => navigation.navigate('Streak', { source: 'manual' })}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${streakDays}-day streak`}
        style={({ pressed }) => [shadows.glass, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Chip>
          <Icon name="flame" size={14} color={theme.colors.warning} />
          <Count>{streakDays}</Count>
        </Chip>
      </ChipPress>
    </Row>
  );
};

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 22px 18px;
`;

const ChipPress = styled.Pressable`
  border-radius: 9999px;
`;

const Chip = styled(GlassSurface)`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 9999px;
`;

const Count = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  font-variant: tabular-nums;
`;

export default ScreenHeader;
