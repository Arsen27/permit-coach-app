import React from 'react';
import styled from 'styled-components/native';

import { useStoredCourse } from '@/data/course/CourseProvider';
import { useContentChannel } from '@/lib/contentChannel';

// A standing reminder that this device is not looking at what everyone else
// is. Renders nothing on production — and therefore never in a release build,
// where the channel cannot be anything else.

const ChannelBadge: React.FC = () => {
  const channel = useContentChannel();
  const course = useStoredCourse();

  if (channel !== 'staging') {
    return null;
  }

  return (
    <Pill pointerEvents="none" accessibilityRole="text">
      <Label>
        STAGING{course == null ? '' : ` · v${course.deliveryVersion}`}
      </Label>
    </Pill>
  );
};

export default ChannelBadge;

const Pill = styled.View`
  position: absolute;
  top: 4px;
  right: 10px;
  z-index: 100;
  padding: 3px 8px;
  border-radius: 999px;
  background-color: rgba(124, 58, 237, 0.92);
`;

const Label = styled.Text`
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.4px;
  color: #ffffff;
`;
