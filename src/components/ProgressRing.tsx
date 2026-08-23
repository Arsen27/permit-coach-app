import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

type ProgressRingProps = {
  size: number;
  thickness: number;
  progress: number;
  children?: React.ReactNode;
};

// Hard-stop progress ring matching the reference's conic-gradient (accent
// portion, faint remainder), starting at 12 o'clock.
const ProgressRing: React.FC<ProgressRingProps> = ({
  size,
  thickness,
  progress,
  children,
}) => {
  const theme = useTheme();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.faint}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.accent}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={[styles.center, { padding: thickness }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProgressRing;
