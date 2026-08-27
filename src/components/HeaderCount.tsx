import styled from 'styled-components/native';

// Muted count that rides in a screen header's trailing slot — "18 signs" on a
// sign category, "6 signs" on the saved list. It is a label, not a control, so
// on iOS it goes in as a `custom` bar item rather than a button.
const HeaderCount = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

export default HeaderCount;
