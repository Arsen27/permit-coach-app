import React from 'react';
import { SvgXml } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

import { BrandLogoName, brandLogoXml } from '@/assets/brandLogos';

type BrandLogoProps = {
  name: BrandLogoName;
  size?: number;
};

// Identity-provider marks, rendered at their own colours. Only Apple's glyph
// takes a tint (its artwork uses currentColor); Google's stays exactly as
// shipped, so no colour prop is offered here at all.
const BrandLogo: React.FC<BrandLogoProps> = ({ name, size = 17 }) => {
  const theme = useTheme();

  return (
    <SvgXml
      xml={brandLogoXml[name]}
      width={size}
      height={size}
      color={theme.colors.ink}
    />
  );
};

export default BrandLogo;
