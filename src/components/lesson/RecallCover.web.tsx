import React from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';

// Web build of the recall gap cover (the admin phone preview): no Liquid
// Glass on the web, so this paints the card green over the sharp word and
// draws a CSS-blurred copy on top — the closest render of handoff screen 19
// a browser can do. Fades out with the host-driven `fade` on reveal.

type RecallCoverProps = {
  revealed: boolean;
  fade: Animated.AnimatedInterpolation<number>;
  word: string;
};

const RecallCover: React.FC<RecallCoverProps> = ({ fade, word }) => (
  <Animated.View testID="recall-cover" style={[styles.fill, { opacity: fade }]}>
    <View style={styles.blur as ViewStyle}>
      <Text style={styles.word}>{word}</Text>
    </View>
  </Animated.View>
);

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderRadius: 11,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // The card's recall green (theme.colors.recall), opaque so the sharp word
    // beneath cannot shine through.
    backgroundColor: '#00734A',
  },
  blur: {
    filter: 'blur(5px)',
  },
  word: {
    fontFamily: "'PlusJakartaSans-SemiBold', 'Plus Jakarta Sans', system-ui",
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.15,
    color: '#ffffff',
  },
});

export default RecallCover;
