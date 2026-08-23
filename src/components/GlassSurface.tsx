import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

import { glass } from '@/theme';

type GlassSurfaceProps = {
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  children?: React.ReactNode;
};

// Glass building block: the native iOS 26 Liquid Glass material where
// available, a visually matching translucent surface elsewhere (Android and
// older iOS). Keep drop shadows on a wrapper View, not on this surface.
const GlassSurface: React.FC<GlassSurfaceProps> = ({
  style,
  interactive = false,
  children,
}) => {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView style={style} interactive={interactive} effect="regular">
        {children}
      </LiquidGlassView>
    );
  }

  return <View style={[styles.fallback, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: glass.fallbackFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
});

export default GlassSurface;
