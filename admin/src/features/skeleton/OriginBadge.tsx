import React from 'react';
import styled from 'styled-components';

import type { Origin } from '@admin/model/blockOrigin';
import { admin } from '@admin/styles/theme';

// Where a block of a state's course actually comes from.
//
// On this screen every card looks alike, which is how editing a shared card
// here came to be a dead end: the edit was accepted, the next build regenerated
// the lesson from the skeleton, and the change was gone. The badge says which
// cards are everybody's, and the two actions are the only things that can be
// done about one — send this state back to the shared text, or make this
// state's text the shared one.

const STATE_BORDER = 'rgba(217,119,6,.55)';

type Props = {
  origin: Origin;
  stateCode: string;
  bareId: string;
  busy?: boolean;
  onRevert?: () => void;
  onPromote?: () => void;
};

const OriginBadge: React.FC<Props> = ({
  origin,
  stateCode,
  bareId,
  busy = false,
  onRevert,
  onPromote,
}) => (
  <Row data-block-origin={origin} data-block-bare-id={bareId}>
    {origin === 'shared' && (
      <Chip $tone="shared" title="Comes from the skeleton — every state has it">
        shared
      </Chip>
    )}
    {origin === 'overridden' && (
      <Chip
        $tone="overridden"
        title={`${stateCode} has taken this card over; the shared text no longer reaches it`}
      >
        overridden here
      </Chip>
    )}
    {origin === 'own' && (
      <Chip $tone="own" title={`${stateCode}'s own — no shared card behind it`}>
        {stateCode} only
      </Chip>
    )}
    {origin === 'overridden' && (
      <>
        <Action disabled={busy} data-revert-shared={bareId} onClick={onRevert}>
          Revert to shared
        </Action>
        <Action
          disabled={busy}
          data-promote-shared={bareId}
          onClick={onPromote}
        >
          Promote into the skeleton
        </Action>
      </>
    )}
  </Row>
);

export default OriginBadge;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
`;

const Chip = styled.span<{ $tone: Origin }>`
  font: 700 9px ${admin.mono};
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 99px;
  color: ${({ $tone }) =>
    $tone === 'shared'
      ? '#0369A1'
      : $tone === 'overridden'
      ? '#B45309'
      : '#6D28D9'};
  background: ${({ $tone }) =>
    $tone === 'shared'
      ? admin.accentSoft
      : $tone === 'overridden'
      ? 'rgba(217,119,6,.13)'
      : 'rgba(124,58,237,.12)'};
  outline: ${({ $tone }) =>
    $tone === 'overridden' ? `1px solid ${STATE_BORDER}` : 'none'};
`;

const Action = styled.button`
  border: 1px solid ${admin.line3};
  border-radius: 7px;
  background: ${admin.soft};
  padding: 3px 9px;
  font: 700 9.5px ${admin.mono};
  color: ${admin.muted};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${admin.hair};
    color: ${admin.ink};
  }
`;
