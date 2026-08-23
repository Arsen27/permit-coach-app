import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import { IconName } from '@/assets/icons';
import { shadows } from '@/theme';

import GlassSurface from './GlassSurface';
import Icon from './Icon';

type GlassCircleButtonProps = {
  icon: IconName;
  onPress: () => void;
  iconSize?: number;
  iconColor?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

// 44×44 glass circle for nav actions (close, back, bookmark) per the kit.
// Android-only analog of iOS's native UIBarButtonItems — iOS screens use the
// native navigation bar instead.
const GlassCircleButton: React.FC<GlassCircleButtonProps> = ({
  icon,
  onPress,
  iconSize = 15,
  iconColor,
  size = 44,
  style,
}) => {
  return (
    <Press
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        shadows.glass,
        { borderRadius: size / 2, opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Circle style={{ width: size, height: size, borderRadius: size / 2 }}>
        <Icon name={icon} size={iconSize} color={iconColor} />
      </Circle>
    </Press>
  );
};

const Press = styled.Pressable`
  align-self: flex-start;
`;

const Circle = styled(GlassSurface)`
  align-items: center;
  justify-content: center;
`;

export default GlassCircleButton;
