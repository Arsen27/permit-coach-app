import React from 'react';
import styled from 'styled-components/native';

import { Sign } from '@/data/signs';

import SignImage from './SignImage';

// The 3-column sign grid shared by the category cheatsheet and the saved
// list. Cards are fluid rather than a fixed width so the row still fills at
// larger text sizes; the label wraps to two lines and then truncates.

type SignGridProps = {
  signs: Sign[];
  onPressSign: (signId: string) => void;
};

const SignGrid: React.FC<SignGridProps> = ({ signs, onPressSign }) => (
  <Grid>
    {signs.map(sign => (
      <Card
        key={sign.id}
        onPress={() => onPressSign(sign.id)}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <SignImage sign={sign} size={52} />
        <CardLabel numberOfLines={2}>{sign.name}</CardLabel>
      </Card>
    ))}
  </Grid>
);

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

export default SignGrid;
