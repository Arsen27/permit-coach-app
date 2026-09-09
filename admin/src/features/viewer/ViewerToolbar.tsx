import React from 'react';
import styled from 'styled-components';

import {
  Chip,
  GhostButton,
  Mono,
  PrimaryButton,
  Segmented,
  SegmentedItem,
  Spacer,
  Switch,
} from '@admin/features/shell/ui';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import { useSelection } from '@admin/store/selectionStore';
import { admin } from '@admin/styles/theme';

// The row above the lesson: what to show, what to compare it against, and what
// may be done to it. Editing is offered for drafts only; releases can be
// duplicated, competitor courses are read-only throughout.

type Props = {
  version: VersionDescriptor | null;
  reference: VersionDescriptor | null;
  moduleTitle: string;
  lessonTitle: string;
  diffStats?: { insertions: number; deletions: number } | null;
  artworkChanges?: number;
  formatsMatch: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onFindSimilar?: () => void;
  onRelease?: () => void;
  onPublish?: () => void;
  onCaptureSelection?: () => void;
};

const ViewerToolbar: React.FC<Props> = ({
  version,
  reference,
  moduleTitle,
  lessonTitle,
  diffStats,
  artworkChanges = 0,
  formatsMatch,
  onEdit,
  onDuplicate,
  onFindSimilar,
  onRelease,
  onPublish,
  onCaptureSelection,
}) => {
  const mode = useSelection(state => state.mode);
  const setMode = useSelection(state => state.setMode);
  const compareOn = useSelection(state => state.compareOn);
  const toggleCompare = useSelection(state => state.toggleCompare);
  const syncOn = useSelection(state => state.syncOn);
  const toggleSync = useSelection(state => state.toggleSync);
  const diffOn = useSelection(state => state.diffOn);
  const toggleDiff = useSelection(state => state.toggleDiff);

  const comparing = compareOn && reference != null;
  const diffAvailable = comparing && formatsMatch && syncOn;

  return (
    <Bar>
      <Crumbs>
        <CrumbModule>{moduleTitle}</CrumbModule>
        <CrumbLesson>{lessonTitle}</CrumbLesson>
      </Crumbs>

      <Segmented>
        <SegmentedItem
          $active={mode === 'text'}
          onClick={() => setMode('text')}
        >
          Text
        </SegmentedItem>
        <SegmentedItem
          $active={mode === 'phone'}
          onClick={() => setMode('phone')}
        >
          Phone
        </SegmentedItem>
      </Segmented>

      <GhostButton $active={compareOn} onClick={toggleCompare}>
        ⇆ Compare
      </GhostButton>

      {comparing && (
        <>
          <GhostButton
            $active={syncOn}
            title="Show the same lesson on both panes"
            onClick={toggleSync}
          >
            ⟺ Sync
          </GhostButton>

          <GhostButton
            title="Find similar content in the reference version (uses the selected text if any)"
            onMouseDown={onCaptureSelection}
            onClick={onFindSimilar}
          >
            Find similar
          </GhostButton>

          {diffAvailable ? (
            <DiffGroup>
              <DiffToggle onClick={toggleDiff}>
                <Switch as="span" $on={diffOn} />
                <DiffLabel>Diff</DiffLabel>
              </DiffToggle>
              {diffOn && diffStats != null && (
                <>
                  {diffStats.insertions + diffStats.deletions > 0 ? (
                    <Stats>
                      <Ins>+{diffStats.insertions}</Ins>{' '}
                      <Del>−{diffStats.deletions}</Del>
                    </Stats>
                  ) : (
                    artworkChanges === 0 && <NoChanges>No changes</NoChanges>
                  )}
                  {artworkChanges > 0 && (
                    <ArtworkStat>
                      {artworkChanges} illustration
                      {artworkChanges === 1 ? '' : 's'} redrawn
                    </ArtworkStat>
                  )}
                </>
              )}
            </DiffGroup>
          ) : (
            !formatsMatch && <Warn>Formats differ — diff unavailable</Warn>
          )}
        </>
      )}

      <Spacer />
      <Divider />

      {version?.kind === 'draft' && onEdit != null && (
        <GhostButton onClick={onEdit}>Edit lesson</GhostButton>
      )}

      {version?.kind === 'draft' && onRelease != null && (
        <PrimaryButton onClick={onRelease}>Release…</PrimaryButton>
      )}

      {version?.kind === 'released' && (
        <>
          <ReadOnly>
            <Lock /> Read-only
          </ReadOnly>
          {onDuplicate != null && (
            <GhostButton onClick={onDuplicate}>Duplicate as draft</GhostButton>
          )}
          {onPublish != null && (
            <GhostButton onClick={onPublish}>Publish…</GhostButton>
          )}
        </>
      )}

      {version?.kind === 'competitor' && (
        <Chip $color="#6D28D9" $bg="rgba(124,58,237,.1)">
          Competitor · read-only
        </Chip>
      )}
    </Bar>
  );
};

export default ViewerToolbar;

const Bar = styled.div`
  flex: none;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 16px;
  background: ${admin.surface};
  border-bottom: 1px solid ${admin.line};
  flex-wrap: wrap;
`;

const Crumbs = styled.div`
  flex: 1;
  min-width: 140px;
  /* Long lesson titles must never grow the bar — they trim instead. */
  overflow: hidden;
`;

const CrumbModule = styled.span`
  display: block;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${admin.dim2};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CrumbLesson = styled.span`
  display: block;
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: -0.2px;
  color: ${admin.ink};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DiffGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DiffToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
`;

const DiffLabel = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${admin.body};
`;

const Stats = styled(Mono).attrs({ $size: 11, $weight: 600 })`
  padding: 3px 8px;
  border-radius: 6px;
  background: ${admin.bg};
`;

const Ins = styled.span`
  color: #166534;
`;

const Del = styled.span`
  color: #b91c1c;
`;

const NoChanges = styled.span`
  font-size: 10.5px;
  font-weight: 700;
  color: ${admin.dim2};
  background: ${admin.bg};
  padding: 3px 8px;
  border-radius: 6px;
`;

const ArtworkStat = styled.span`
  font-size: 10.5px;
  font-weight: 700;
  color: #b45309;
  background: rgba(217, 119, 6, 0.11);
  padding: 3px 8px;
  border-radius: 6px;
`;

const Warn = styled.span`
  font-size: 10.5px;
  font-weight: 600;
  color: #b45309;
  background: rgba(217, 119, 6, 0.1);
  padding: 4px 9px;
  border-radius: 6px;
`;

const Divider = styled.div`
  width: 1px;
  height: 22px;
  background: ${admin.line};
`;

const ReadOnly = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: ${admin.dim2};
`;

const Lock = styled.span`
  width: 9px;
  height: 8px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 1.5px;
    top: -4px;
    width: 4px;
    height: 4px;
    border: 1.5px solid currentColor;
    border-bottom: none;
    border-radius: 3px 3px 0 0;
  }
`;
