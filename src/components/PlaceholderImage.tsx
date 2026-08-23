import React, { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import styled from 'styled-components/native';

type PlaceholderImageProps = {
  label: string;
  height: number;
  radius?: number;
};

// Perpendicular stripe spacing/width matching the reference's
// repeating-linear-gradient(135deg, #E7E7EA 0 8px, #EFEFF1 8px 16px).
const STRIPE_PERIOD = 16 * Math.SQRT2;

// Hatched stand-in for photos/diagrams that are not supplied yet; the caption
// names the required asset (see handoff README "Assets").
const PlaceholderImage: React.FC<PlaceholderImageProps> = ({
  label,
  height,
  radius = 0,
}) => {
  const [width, setWidth] = useState(0);

  const stripes: React.ReactElement[] = [];
  for (let d = STRIPE_PERIOD / 2; d < width + height; d += STRIPE_PERIOD) {
    stripes.push(
      <Line
        key={d}
        x1={d}
        y1={0}
        x2={0}
        y2={d}
        stroke="#E7E7EA"
        strokeWidth={8}
      />,
    );
  }

  return (
    <Frame
      style={{ height, borderRadius: radius }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {stripes}
        </Svg>
      )}
      <Caption>{label}</Caption>
    </Frame>
  );
};

const Frame = styled.View`
  overflow: hidden;
  background-color: #efeff1;
  justify-content: flex-end;
  align-items: flex-start;
`;

const Caption = styled.Text`
  margin: 8px;
  padding: 3px 6px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.82);
  font-family: ${Platform.OS === 'ios' ? 'Menlo' : 'monospace'};
  font-size: 9.5px;
  color: #71717a;
`;

export default PlaceholderImage;
