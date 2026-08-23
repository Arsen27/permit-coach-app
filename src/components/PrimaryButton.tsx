import React from 'react';
import styled from 'styled-components/native';

import { shadows } from '@/theme';

type PrimaryButtonProps = {
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
  height?: number;
};

// Liquid Glass primary CTA: accent capsule with the kit's glass shadow and
// top highlight. Screens float it 22px above the bottom edge — no footer bar.
// Disabled means "you cannot proceed yet", so it drops to a flat grey pill
// rather than a faded accent one.
const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  sublabel,
  onPress,
  disabled = false,
  height = 54,
}) => (
  <Button
    $disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      disabled ? null : shadows.cta,
      { height, opacity: !disabled && pressed ? 0.85 : 1 },
    ]}
  >
    {/* Labels can carry content titles ("Next lesson · …"), so they clip
        instead of wrapping out of the fixed-height capsule. */}
    <Label $disabled={disabled} numberOfLines={1} ellipsizeMode="tail">
      {label}
    </Label>
    {sublabel != null && <Sublabel numberOfLines={1}>{sublabel}</Sublabel>}
  </Button>
);

const Button = styled.Pressable<{ $disabled: boolean }>`
  border-radius: 1000px;
  background-color: ${({ theme, $disabled }) =>
    $disabled ? '#E9E9EB' : theme.colors.accent};
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;
`;

const Label = styled.Text<{ $disabled: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  flex-shrink: 1;
  font-size: 16px;
  letter-spacing: -0.25px;
  color: ${({ theme, $disabled }) =>
    $disabled ? theme.colors.dim : '#ffffff'};
`;

const Sublabel = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
  font-variant: tabular-nums;
`;

export default PrimaryButton;
