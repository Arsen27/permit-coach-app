import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import styled from 'styled-components/native';

// The short unofficial/no-guarantee notice shown on the first onboarding step
// and the paywall (About carries the longer version). One component so the
// wording can never drift between the two placements. Muted but real body
// text — never a tooltip, never truncated, scales with Dynamic Type.

export const UNOFFICIAL_DISCLAIMER_TEXT =
  'PermitCoach is an independent, unofficial study app. It is not affiliated with or endorsed by any DMV or government agency. Passing is not guaranteed.';

type UnofficialDisclaimerProps = {
  style?: StyleProp<TextStyle>;
};

const UnofficialDisclaimer: React.FC<UnofficialDisclaimerProps> = ({
  style,
}) => (
  <DisclaimerText accessibilityRole="text" style={style}>
    {UNOFFICIAL_DISCLAIMER_TEXT}
  </DisclaimerText>
);

const DisclaimerText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 12px;
  line-height: 17px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

export default UnofficialDisclaimer;
