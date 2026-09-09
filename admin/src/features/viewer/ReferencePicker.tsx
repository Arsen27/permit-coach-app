import React, { useState } from 'react';
import styled from 'styled-components';

import { Chevron, Chip, Dot, Mono, Spacer } from '@admin/features/shell/ui';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import { formatLabel, statusOf } from '@admin/model/versionDescriptor';
import { selectOutline, useDocs } from '@admin/store/docsStore';
import { referenceLessonId, useSelection } from '@admin/store/selectionStore';
import { admin } from '@admin/styles/theme';

// Chooses what the right-hand pane shows. Used by both the compare header and
// the second phone, so the reference is always changed the same way.

// The right pane's own lesson list. The left sidebar shows the selected
// version's lessons, whose ids do not exist in another course — a competitor
// lesson can only be chosen from the competitor's own outline.
const LessonPicker: React.FC<{ version: VersionDescriptor }> = ({
  version,
}) => {
  const [open, setOpen] = useState(false);
  const outline = useDocs(state => selectOutline(state, version.key));
  const currentLessonId = useSelection(referenceLessonId);
  const pickReferenceLesson = useSelection(state => state.pickReferenceLesson);

  const lessons = outline?.modules.flatMap(module => module.lessons) ?? [];
  const current = lessons.find(lesson => lesson.lessonId === currentLessonId);
  const currentNumber =
    current == null
      ? null
      : String(
          current.number ??
            lessons.findIndex(lesson => lesson.lessonId === currentLessonId) +
              1,
        ).padStart(2, '0');

  // Numbered the way the course map counts: straight through the whole course,
  // so "lesson 12" here matches "lesson 12" in the competitor's own app.
  let ordinal = 0;

  return (
    <Wrap>
      <Button onClick={() => setOpen(value => !value)}>
        {currentNumber != null && (
          <Mono $size={10} $weight={600}>
            {currentNumber}
          </Mono>
        )}
        <LessonTitle>{current?.title ?? 'Choose lesson…'}</LessonTitle>
        <Chevron $dir="down" />
      </Button>
      {open && (
        <LessonDropdown onMouseLeave={() => setOpen(false)}>
          {outline?.modules.map(module => (
            <React.Fragment key={module.moduleId}>
              <GroupLabel>{module.title}</GroupLabel>
              {module.lessons.map(lesson => {
                ordinal += 1;
                const shown = lesson.number ?? ordinal;
                return (
                  <DropdownRow
                    key={lesson.lessonId}
                    onClick={() => {
                      setOpen(false);
                      pickReferenceLesson(lesson.lessonId);
                    }}
                  >
                    <RowNumber>{String(shown).padStart(2, '0')}</RowNumber>
                    <LessonName $active={lesson.lessonId === currentLessonId}>
                      {lesson.title}
                    </LessonName>
                  </DropdownRow>
                );
              })}
            </React.Fragment>
          ))}
        </LessonDropdown>
      )}
    </Wrap>
  );
};

type Props = {
  current: VersionDescriptor;
  options: VersionDescriptor[];
  compact?: boolean;
  showLessonPicker?: boolean;
};

const ReferencePicker: React.FC<Props> = ({
  current,
  options,
  compact = false,
  showLessonPicker = true,
}) => {
  const [open, setOpen] = useState(false);
  const setCompare = useSelection(state => state.setCompare);
  const refPick = useSelection(state => state.refPick);
  const toggleRefPick = useSelection(state => state.toggleRefPick);
  const status = admin.status[statusOf(current)];

  return (
    <Row>
      <Wrap>
        <Button onClick={() => setOpen(value => !value)}>
          <Dot $color={status.dot} />
          <Mono $size={compact ? 11.5 : 12} $weight={700}>
            {current.label}
          </Mono>
          {!compact && (
            <Chip $color={status.col} $bg={status.bg}>
              {status.chip}
            </Chip>
          )}
          <Chevron $dir="down" />
        </Button>
        {open && (
          <Dropdown onMouseLeave={() => setOpen(false)}>
            {options.map(option => (
              <DropdownRow
                key={option.key}
                onClick={() => {
                  setOpen(false);
                  setCompare(
                    option.key,
                    option.kind === 'competitor' ? { sync: false } : undefined,
                  );
                }}
              >
                <Dot $color={admin.status[statusOf(option)].dot} />
                <Mono $size={12} $weight={600}>
                  {option.name ?? option.label}
                </Mono>
                <Spacer />
                <Muted>{formatLabel(option.format)}</Muted>
              </DropdownRow>
            ))}
          </Dropdown>
        )}
      </Wrap>

      <LessonPicker version={current} />

      {/* Picking through the sidebar only makes sense while the reference
          shares the selected version's lesson ids. */}
      {showLessonPicker && current.kind !== 'competitor' && (
        <PickLesson $active={refPick} onClick={toggleRefPick}>
          {refPick ? 'Click a lesson in the sidebar…' : 'Pick lesson'}
        </PickLesson>
      )}
    </Row>
  );
};

export default ReferencePicker;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Wrap = styled.div`
  position: relative;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid ${admin.line};
  background: ${admin.surface};
  cursor: pointer;
  font-family: inherit;
  color: ${admin.dim};

  &:hover {
    background: ${admin.hair};
  }
`;

const Dropdown = styled.div`
  position: absolute;
  top: 32px;
  left: 0;
  width: 240px;
  background: ${admin.surface};
  border: 1px solid ${admin.line};
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14);
  padding: 6px;
  z-index: 40;
`;

const DropdownRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  border-radius: 8px;
  cursor: pointer;
  color: ${admin.ink};

  &:hover {
    background: ${admin.bg};
  }
`;

const LessonTitle = styled.span`
  max-width: 200px;
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.ink};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LessonDropdown = styled.div`
  position: absolute;
  top: 32px;
  left: 0;
  width: 300px;
  max-height: 340px;
  overflow: auto;
  background: ${admin.surface};
  border: 1px solid ${admin.line};
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14);
  padding: 6px;
  z-index: 40;
`;

const GroupLabel = styled.span`
  display: block;
  padding: 7px 9px 3px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${admin.dim2};
`;

const RowNumber = styled.span`
  flex: none;
  font: 600 10px ${admin.mono};
  color: ${admin.ghost};
  padding-top: 1px;
`;

const LessonName = styled.span<{ $active: boolean }>`
  display: block;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ $active }) => ($active ? admin.accent : admin.ink)};
`;

const Muted = styled.span`
  font-size: 10px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const PickLesson = styled.button<{ $active: boolean }>`
  padding: 4px 10px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${({ $active }) => ($active ? '#6D28D9' : admin.line)};
  background: ${({ $active }) =>
    $active ? 'rgba(124,58,237,.1)' : admin.surface};
  color: ${({ $active }) => ($active ? '#6D28D9' : admin.body)};
`;
