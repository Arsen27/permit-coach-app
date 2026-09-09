import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import type { ChannelMove } from '@admin/api/types';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import {
  CHANNEL_CHIPS,
  formatLabel,
  statusOf,
} from '@admin/model/versionDescriptor';
import { useDocs } from '@admin/store/docsStore';
import { useEdit } from '@admin/store/editStore';
import { useSelection } from '@admin/store/selectionStore';
import { useUi } from '@admin/store/uiStore';
import { useWorkspace } from '@admin/store/workspaceStore';
import { admin } from '@admin/styles/theme';
import {
  Chevron,
  Chip,
  CollapsedRail,
  Dot,
  IconButton,
  Mono,
  Row,
  SectionLabel,
  Spacer,
} from '@admin/features/shell/ui';

// Left-most content column: our versions, then the competitor courses. A
// version row drives the whole left pane; a competitor row can only become the
// right-hand reference, which is what makes the left pane the primary one.

type RowProps = {
  version: VersionDescriptor;
  selected: boolean;
  isReference: boolean;
  onClick: () => void;
  // Offered on a selected draft: the only kind of version that can go.
  onDelete?: () => void;
};

const VersionRow: React.FC<RowProps> = ({
  version,
  selected,
  isReference,
  onClick,
  onDelete,
}) => {
  const status = admin.status[statusOf(version)];

  return (
    <Card
      $selected={selected}
      $reference={isReference}
      aria-current={selected ? 'true' : undefined}
      data-version={version.key}
      onClick={onClick}
    >
      <Row>
        <Dot $color={status.dot} />
        {version.name == null ? (
          <Mono $size={12.5} $weight={700}>
            {version.label}
          </Mono>
        ) : (
          <Name>{version.name}</Name>
        )}
        <Spacer />
        {version.channels?.map(channel => (
          <Chip
            key={channel}
            $color={CHANNEL_CHIPS[channel].col}
            $bg={CHANNEL_CHIPS[channel].bg}
          >
            {CHANNEL_CHIPS[channel].chip}
          </Chip>
        ))}
        <Chip $color={status.col} $bg={status.bg}>
          {status.chip}
        </Chip>
        {onDelete != null && (
          <IconButton
            title="Delete draft"
            onClick={event => {
              event.stopPropagation();
              onDelete();
            }}
          >
            ✕
          </IconButton>
        )}
      </Row>
      <Meta>
        <span>{formatLabel(version.format)}</span>
        <MetaDim>· {version.date}</MetaDim>
      </Meta>
    </Card>
  );
};

const VersionsSidebar: React.FC = () => {
  const open = useUi(state => state.versionsOpen);
  const toggle = useUi(state => state.toggleVersions);
  const versions = useWorkspace(state => state.versions);
  const competitors = useWorkspace(state => state.competitors);
  const selectedKey = useSelection(state => state.selectedKey);
  const compareKey = useSelection(state => state.compareKey);
  const compareOn = useSelection(state => state.compareOn);
  const selectVersion = useSelection(state => state.selectVersion);
  const setCompare = useSelection(state => state.setCompare);
  const courseId = useWorkspace(state => state.courseId);
  const channels = useWorkspace(state => state.channels);
  const reloadVersions = useWorkspace(state => state.reloadVersions);
  const invalidate = useDocs(state => state.invalidate);
  const showToast = useUi(state => state.showToast);

  // Every move a channel ever made, newest first. Loaded when opened, and
  // again whenever the pointers change, so a publish shows up at once.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moves, setMoves] = useState<ChannelMove[] | null>(null);
  useEffect(() => {
    if (!historyOpen || courseId == null) {
      return undefined;
    }
    let live = true;
    adminApi
      .channelHistory(courseId, 20)
      .then(response => {
        if (live) setMoves(response.moves);
      })
      .catch(() => {
        if (live) setMoves([]);
      });
    return () => {
      live = false;
    };
  }, [historyOpen, courseId, channels]);

  // A draft is the only version that can be thrown away. The release it was
  // based on is untouched; the viewer moves to the newest release.
  const deleteDraft = async (version: VersionDescriptor) => {
    if (version.courseId == null || version.draftId == null) {
      return;
    }
    if (
      !window.confirm(
        `Delete draft ${version.label}? Its edits are lost; the release it was based on is untouched.`,
      )
    ) {
      return;
    }
    try {
      if (useEdit.getState().versionKey === version.key) {
        useEdit.getState().cancel();
      }
      await adminApi.deleteDraft(version.courseId, version.draftId);
      invalidate(version.key);
      const next = await reloadVersions();
      const fallback = next.find(item => item.kind === 'released') ?? next[0];
      if (fallback != null) {
        selectVersion(fallback.key);
      }
      showToast(`Deleted draft ${version.label}`);
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  if (!open) {
    return (
      <CollapsedRail title="Show versions" onClick={toggle}>
        <Chevron $dir="right" />
      </CollapsedRail>
    );
  }

  return (
    <Panel>
      <Head>
        <SectionLabel>Versions</SectionLabel>
        <Spacer />
        <IconButton title="Collapse" onClick={toggle}>
          <Chevron $dir="left" />
        </IconButton>
      </Head>

      {versions.map(version => (
        <VersionRow
          key={version.key}
          version={version}
          selected={version.key === selectedKey}
          isReference={compareOn && version.key === compareKey}
          onClick={() => selectVersion(version.key)}
          onDelete={
            version.kind === 'draft' && version.key === selectedKey
              ? () => void deleteDraft(version)
              : undefined
          }
        />
      ))}

      {competitors.length > 0 && (
        <>
          <Rule />
          <CompetitorLabel>Competitors</CompetitorLabel>
          {competitors.map(version => (
            <VersionRow
              key={version.key}
              version={version}
              selected={false}
              isReference={compareOn && version.key === compareKey}
              onClick={() => setCompare(version.key, { sync: false })}
            />
          ))}
        </>
      )}

      <HistoryHead
        type="button"
        aria-expanded={historyOpen}
        onClick={() => setHistoryOpen(current => !current)}
      >
        <SectionLabel>History</SectionLabel>
        <Spacer />
        <Chevron $dir={historyOpen ? 'up' : 'down'} />
      </HistoryHead>
      {historyOpen && (
        <HistoryList data-history>
          {moves == null ? (
            <HistoryNote>loading…</HistoryNote>
          ) : moves.length === 0 ? (
            <HistoryNote>No channel moves yet.</HistoryNote>
          ) : (
            moves.map((move, index) => (
              <HistoryRow key={index} data-history-row>
                <Chip
                  $color={CHANNEL_CHIPS[move.channel].col}
                  $bg={CHANNEL_CHIPS[move.channel].bg}
                >
                  {CHANNEL_CHIPS[move.channel].chip}
                </Chip>
                <Mono $size={11} $weight={600}>
                  {move.from == null ? '—' : `v${move.from}`} → v{move.to}
                </Mono>
                <HistoryMeta>
                  {move.actor} · {new Date(move.at).toLocaleString()}
                </HistoryMeta>
              </HistoryRow>
            ))
          )}
        </HistoryList>
      )}

      <Spacer />
      <Note>
        Released versions are immutable — duplicate one to edit, or publish it
        to a channel. Competitor courses open in the right compare pane,
        read-only.
      </Note>
    </Panel>
  );
};

export default VersionsSidebar;

const Panel = styled.aside`
  flex: none;
  width: 230px;
  background: ${admin.soft};
  border-right: 1px solid ${admin.line2};
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 14px 0 10px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  padding: 0 12px 8px 20px;
`;

const Card = styled.div<{ $selected: boolean; $reference: boolean }>`
  margin: 0 10px 5px;
  padding: 9px 11px;
  border-radius: 10px;
  cursor: pointer;
  background: ${({ $selected }) => ($selected ? admin.surface : 'transparent')};
  border: 1px solid
    ${({ $selected, $reference }) =>
      $selected
        ? admin.line
        : $reference
        ? 'rgba(124,58,237,.35)'
        : 'transparent'};
  box-shadow: ${({ $selected }) =>
    $selected ? '0 1px 3px rgba(0,0,0,.05)' : 'none'};

  &:hover {
    border-color: ${admin.line};
  }
`;

const HistoryHead = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: 10px;
  padding: 6px 12px 6px 20px;
  border: 0;
  border-top: 1px solid ${admin.line2};
  background: transparent;
  cursor: pointer;
  text-align: left;
`;

const HistoryList = styled.div`
  padding: 2px 10px 6px;
`;

const HistoryRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
`;

const HistoryMeta = styled.span`
  width: 100%;
  padding-left: 2px;
  font-size: 10.5px;
  color: ${admin.muted};
`;

const HistoryNote = styled.p`
  margin: 4px 10px;
  font-size: 11px;
  color: ${admin.muted};
`;

const Name = styled.span`
  font-size: 12.5px;
  font-weight: 700;
  color: ${admin.ink};
`;

const Meta = styled.div`
  display: flex;
  gap: 5px;
  margin-top: 4px;
  padding-left: 15px;
  font-size: 10.5px;
  font-weight: 500;
  color: ${admin.dim};
`;

const MetaDim = styled.span`
  color: ${admin.faint};
`;

const Rule = styled.div`
  height: 1px;
  background: ${admin.line2};
  margin: 10px 16px;
`;

const CompetitorLabel = styled(SectionLabel)`
  padding: 0 20px 8px;
`;

const Note = styled.p`
  margin: 12px 20px 0;
  font-size: 10.5px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.faint};
`;
