import styled, { css } from 'styled-components';

import { admin } from '@admin/styles/theme';

// Small chrome primitives shared across the panel, matching the mockup's
// spacing and type scale.

export const Row = styled.div<{ $gap?: number }>`
  display: flex;
  align-items: center;
  gap: ${({ $gap = 8 }) => $gap}px;
`;

export const Spacer = styled.div`
  flex: 1;
`;

export const Mono = styled.span<{ $size?: number; $weight?: number }>`
  font: ${({ $weight = 600, $size = 12 }) => `${$weight} ${$size}px`}
    ${admin.mono};
`;

export const SectionLabel = styled.span`
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  color: ${admin.dim2};
`;

export const Chip = styled.span<{ $color: string; $bg: string }>`
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
  background: ${({ $bg }) => $bg};
  padding: 2.5px 7px;
  border-radius: 99px;
  white-space: nowrap;
`;

export const Dot = styled.div<{ $color: string }>`
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: ${({ $color }) => $color};
`;

const buttonBase = css`
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
  white-space: nowrap;
`;

export const GhostButton = styled.button<{ $active?: boolean }>`
  ${buttonBase};
  padding: 6px 13px;
  border-color: ${({ $active }) => ($active ? admin.accent : admin.line)};
  background: ${({ $active }) => ($active ? admin.accentSoft : admin.surface)};
  color: ${({ $active }) => ($active ? admin.accent : admin.body)};

  &:hover:not(:disabled) {
    background: ${({ $active }) => ($active ? admin.accentSoft : admin.bg)};
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

export const PrimaryButton = styled.button`
  ${buttonBase};
  padding: 7px 15px;
  background: ${admin.accent};
  color: #fff;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

export const IconButton = styled.button`
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${admin.dim2};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  font-size: 11px;
  line-height: 1;

  &:hover {
    background: #efeff1;
  }
`;

// Chevron drawn in CSS so the panel needs no icon assets of its own.
export const Chevron = styled.span<{ $dir: 'left' | 'right' | 'up' | 'down' }>`
  display: inline-block;
  width: 7px;
  height: 7px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(
    ${({ $dir }) =>
      $dir === 'right'
        ? '-45deg'
        : $dir === 'left'
        ? '135deg'
        : $dir === 'down'
        ? '45deg'
        : '-135deg'}
  );
`;

export const CollapsedRail = styled.button<{ $bg?: string }>`
  flex: none;
  width: 34px;
  border: none;
  border-right: 1px solid ${admin.line2};
  background: ${({ $bg = admin.soft }) => $bg};
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14px;
  cursor: pointer;
  color: ${admin.dim};

  &:hover {
    background: ${admin.hair};
  }
`;

export const Segmented = styled.div`
  display: flex;
  background: ${admin.hair};
  border-radius: 9px;
  padding: 3px;
`;

export const SegmentedItem = styled.button<{ $active: boolean }>`
  padding: 4px 13px;
  border: none;
  border-radius: 7px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $active }) => ($active ? admin.ink : admin.dim)};
  background: ${({ $active }) => ($active ? admin.surface : 'transparent')};
  box-shadow: ${({ $active }) =>
    $active ? '0 1px 3px rgba(0,0,0,.1)' : 'none'};
`;

export const Switch = styled.button<{ $on: boolean }>`
  width: 30px;
  height: 18px;
  border: none;
  border-radius: 99px;
  padding: 2px;
  cursor: pointer;
  background: ${({ $on }) => ($on ? admin.accent : '#D4D4D8')};
  transition: background 0.15s;
  display: flex;

  &::after {
    content: '';
    width: 14px;
    height: 14px;
    border-radius: 99px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transform: translateX(${({ $on }) => ($on ? '12px' : '0')});
    transition: transform 0.15s;
  }
`;
