import React from 'react';
import styled from 'styled-components/native';

type ProgressTrackProps = {
  progress: number;
  height?: number;
  color?: 'accent' | 'done';
  // Positions (0..1) marked with a dot (the lesson-card handoff's dotted
  // bar: questions woven into a deck, question boundaries of a test). A
  // design option no screen currently passes — wire it up by handing the
  // fractions in.
  marks?: number[];
};

// The dot overhangs the track vertically (its white ring sits on the page
// background), so the track lives inside a plain wrapper the dots overlay.
const DOT_SIZE = 8;

const ProgressTrack: React.FC<ProgressTrackProps> = ({
  progress,
  height = 5,
  color = 'accent',
  marks,
}) => {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <Wrap>
      <Track style={{ height, borderRadius: height / 2 }}>
        <Fill $color={color} style={{ width: `${clamped * 100}%` }} />
      </Track>
      {(marks ?? []).map(mark => (
        <Dot
          key={mark}
          testID="progress-mark"
          style={{ left: `${mark * 100}%`, top: (height - DOT_SIZE) / 2 }}
        />
      ))}
    </Wrap>
  );
};

const Wrap = styled.View``;

const Track = styled.View`
  background-color: ${({ theme }) => theme.colors.faint};
  overflow: hidden;
`;

const Fill = styled.View<{ $color: 'accent' | 'done' }>`
  height: 100%;
  background-color: ${({ theme, $color }) =>
    $color === 'done' ? theme.colors.done : theme.colors.accent};
`;

// Deep green with a white ring, per the handoff, so the dot reads on both the
// filled and the empty part of the track.
const Dot = styled.View`
  position: absolute;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  margin-left: ${-DOT_SIZE / 2}px;
  border-radius: ${DOT_SIZE / 2}px;
  border: 1.5px solid #ffffff;
  background-color: ${({ theme }) => theme.colors.recall};
`;

export default ProgressTrack;
