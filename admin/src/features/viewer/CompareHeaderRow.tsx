import React from 'react';
import styled from 'styled-components';

import { Chip, Dot, Mono } from '@admin/features/shell/ui';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import { formatLabel, statusOf } from '@admin/model/versionDescriptor';
import { admin } from '@admin/styles/theme';

import ReferencePicker from './ReferencePicker';

// Names both panes. The left one is fixed by the sidebar selection; the right
// one carries its own version picker and, when unsynced, its own lesson.

type Props = {
  left: VersionDescriptor;
  right: VersionDescriptor;
  options: VersionDescriptor[];
  leftLesson: string;
};

const CompareHeaderRow: React.FC<Props> = ({
  left,
  right,
  options,
  leftLesson,
}) => {
  const leftStatus = admin.status[statusOf(left)];

  return (
    <Row>
      <Side>
        <Dot $color={leftStatus.dot} />
        <Mono $size={13} $weight={700}>
          {left.label}
        </Mono>
        <Chip $color={leftStatus.col} $bg={leftStatus.bg}>
          {leftStatus.chip}
        </Chip>
        <Muted>{formatLabel(left.format)} · selected</Muted>
        <LessonName>— {leftLesson}</LessonName>
      </Side>

      <Side>
        <ReferencePicker current={right} options={options} />
      </Side>
    </Row>
  );
};

export default CompareHeaderRow;

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 20px;
  margin-bottom: 12px;
`;

const Side = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
`;

const Muted = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const LessonName = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${admin.ink};
`;
