import React from 'react';
import { Animated, StyleSheet } from 'react-native';

import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

// The cover hiding one recall gap word. On iOS 26 it is a real Liquid Glass
// pill: the word underneath reads as a blur (lesson-card handoff screen 19),
// and revealing dematerializes the glass with UIKit's own animation. Where
// the glass material does not exist (Android, older iOS) the cover is the
// handoff's screen-17 opaque pill instead — the word is simply hidden — and
// fades out with the host-driven `fade`. `word` is unused here; the web
// preview build (RecallCover.web.tsx) draws a CSS-blurred copy of it.

type RecallCoverProps = {
  revealed: boolean;
  fade: Animated.AnimatedInterpolation<number>;
  word: string;
};

const RecallCover: React.FC<RecallCoverProps> = ({ revealed, fade }) =>
  isLiquidGlassSupported ? (
    <LiquidGlassView
      testID="recall-cover"
      style={styles.fill}
      effect={revealed ? 'none' : 'regular'}
      animationDuration={500}
      tintColor="rgba(255, 255, 255, 0.28)"
      colorScheme="light"
    />
  ) : (
    <Animated.View
      testID="recall-cover"
      style={[styles.fill, styles.solid, { opacity: fade }]}
    />
  );

const styles = StyleSheet.create({
  // Slightly proud of the word so no glyph edge peeks out of the cover.
  fill: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderRadius: 11,
    overflow: 'hidden',
  },
  // The screen-17 pill (26% white over the recall green), pre-blended so the
  // word underneath cannot shine through.
  solid: {
    backgroundColor: 'rgb(66, 151, 121)',
  },
});

export default RecallCover;
