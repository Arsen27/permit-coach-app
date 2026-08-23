import styled from 'styled-components/native';

// Section label — 11/800, +0.9 tracking, uppercase, muted. Used for article
// meta, list-group headers, question counters and callout labels.
export const Eyebrow = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 11px;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

// Tab-screen title — 26/800/-0.8.
export const ScreenTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 26px;
  letter-spacing: -0.8px;
  color: ${({ theme }) => theme.colors.ink};
`;
