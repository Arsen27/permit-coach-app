import React from 'react';
import styled from 'styled-components/native';

type ProgressTrackProps = {
  progress: number;
  height?: number;
  color?: 'accent' | 'done';
};

const ProgressTrack: React.FC<ProgressTrackProps> = ({
  progress,
  height = 5,
  color = 'accent',
}) => {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <Track style={{ height, borderRadius: height / 2 }}>
      <Fill $color={color} style={{ width: `${clamped * 100}%` }} />
    </Track>
  );
};

const Track = styled.View`
  background-color: ${({ theme }) => theme.colors.faint};
  overflow: hidden;
`;

const Fill = styled.View<{ $color: 'accent' | 'done' }>`
  height: 100%;
  background-color: ${({ theme, $color }) =>
    $color === 'done' ? theme.colors.done : theme.colors.accent};
`;

export default ProgressTrack;
