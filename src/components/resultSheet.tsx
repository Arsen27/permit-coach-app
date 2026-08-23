import React from 'react';
import styled from 'styled-components/native';

import Icon from '@/components/Icon';

// Presentational primitives for the full-screen "here is how that went" sheets
// (account deletion, restore result). Kept together so those outcomes read as
// one family rather than two screens that happen to look similar.

export type SheetTone = 'success' | 'neutral' | 'error';

export const Sheet = styled.View`
  flex: 1;
  padding: 24px 25px 0;
  background-color: ${({ theme }) => theme.colors.bg};
`;

export const SheetMiddle = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 14px;
`;

export const SheetTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-top: 4px;
  font-size: 22px;
  letter-spacing: -0.6px;
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};
`;

export const SheetBody = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin: 0 12px;
  font-size: 14.5px;
  line-height: 22px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

type SheetMarkProps = {
  tone: SheetTone;
};

// The disc above the title. 'neutral' draws nothing at all: an outcome where
// simply nothing happened must not be dressed up as either a win or a
// failure, and the icon set has no honest symbol for it.
export const SheetMark: React.FC<SheetMarkProps> = ({ tone }) => {
  if (tone === 'neutral') {
    return null;
  }

  return (
    <MarkDisc $tone={tone}>
      <Icon
        name={tone === 'success' ? 'check' : 'xmark'}
        size={tone === 'success' ? 28 : 24}
        color="#FFFFFF"
      />
    </MarkDisc>
  );
};

const MarkDisc = styled.View<{ $tone: 'success' | 'error' }>`
  width: 62px;
  height: 62px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, $tone }) =>
    $tone === 'success' ? theme.colors.done : theme.colors.error};
`;
