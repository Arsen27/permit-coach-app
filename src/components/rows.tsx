import styled from 'styled-components/native';

// List-group primitives shared by Practice, Signs and You: bordered group
// (radius 16), rows with a 34–42px tinted icon tile, faint hairline dividers.

export const Group = styled.View`
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 16px;
  overflow: hidden;
`;

export const Row = styled.Pressable<{ $divider?: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 13px;
  padding: 14px 16px;
  border-bottom-width: ${({ $divider }) => ($divider ? 1 : 0)}px;
  border-bottom-color: ${({ theme }) => theme.colors.faint};
`;

export const RowTile = styled.View<{
  $bg: string;
  $size?: number;
  $radius?: number;
}>`
  width: ${({ $size }) => $size ?? 34}px;
  height: ${({ $size }) => $size ?? 34}px;
  border-radius: ${({ $radius }) => $radius ?? 10}px;
  background-color: ${({ $bg }) => $bg};
  align-items: center;
  justify-content: center;
`;

export const RowBody = styled.View`
  flex: 1;
`;

export const RowTitle = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 14.5px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.ink};
`;

export const RowSub = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

export const RowValue = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;
