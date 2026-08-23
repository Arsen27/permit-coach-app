import React from 'react';
import { SvgXml } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

import { iconXml, IconName } from '@/assets/icons';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

// Renders the design-system SVGs at a square `size`, letterboxed like the
// HTML reference's `mask: center/contain` (the viewBoxes are not all square).
const Icon: React.FC<IconProps> = ({ name, size = 16, color }) => {
  const theme = useTheme();

  return (
    <SvgXml
      xml={iconXml[name]}
      width={size}
      height={size}
      color={color ?? theme.colors.ink}
    />
  );
};

export default Icon;
