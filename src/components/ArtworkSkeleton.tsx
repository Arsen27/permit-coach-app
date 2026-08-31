import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import styled from 'styled-components/native';

// The space a picture will occupy, held while it is on its way. It is the
// shape of the picture itself — the frame takes the asset's own ratio — so
// the illustration lands into the space that was already there and nothing
// on the screen moves. No caption: what the picture shows is the picture's
// job, and a line of grey text where an illustration belongs is worse than
// an empty frame. The alt text still reaches a screen reader.
//
// A picture that is coming shimmers; one that is genuinely not coming — a
// file that would not decode — holds still, so waiting and failure do not
// look the same.

type ArtworkSkeletonProps = {
  // The picture's own ratio, or nothing for the 16:9 default.
  aspectRatio?: number;
  // A square instead of a ratio: a sign's tile is sized in points.
  size?: number;
  radius?: number;
  still?: boolean;
  label?: string;
};

const SWEEP_MS = 1150;

// How much of the frame the moving highlight covers. Wide enough to read as
// a sweep rather than a passing line.
const BAND_FRACTION = 0.6;

const ArtworkSkeleton: React.FC<ArtworkSkeletonProps> = ({
  aspectRatio,
  size,
  radius = 0,
  still = false,
  label,
}) => {
  const [width, setWidth] = useState(size ?? 0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sweep = useRef(new Animated.Value(0)).current;

  // A learner who asked the system for less movement gets a still frame.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(on => {
        if (alive) {
          setReduceMotion(on);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const animating = !still && !reduceMotion && width > 0;
  useEffect(() => {
    if (!animating) {
      return;
    }
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animating, sweep]);

  const band = Math.max(width * BAND_FRACTION, 48);

  return (
    <Frame
      style={[
        { borderRadius: radius },
        size != null
          ? { width: size, height: size }
          : { width: '100%', aspectRatio: aspectRatio ?? 16 / 9 },
      ]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {animating && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              width: band,
              transform: [
                {
                  translateX: sweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-band, width],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.85" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#sheen)" />
          </Svg>
        </Animated.View>
      )}
    </Frame>
  );
};

const Frame = styled.View`
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.faint};
`;

export default ArtworkSkeleton;
