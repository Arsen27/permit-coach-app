import React from 'react';
import styled from 'styled-components';

import { admin } from '@admin/styles/theme';

// The right-click menu on a body line. It offers the same things the row's own
// controls do, plus inserting above or below without dragging — the mouse is
// already where the author wants the new line.

export type RowMenuState = { x: number; y: number; index: number };

export type InsertKind = 'paragraph' | 'bullet' | 'image';

type Props = {
  state: RowMenuState;
  canRemove: boolean;
  onInsertAbove: (kind: InsertKind) => void;
  onInsertBelow: (kind: InsertKind) => void;
  onRemove: () => void;
  onClose: () => void;
};

const WIDTH = 178;
const HEIGHT = 232;

const RowMenu: React.FC<Props> = ({
  state,
  canRemove,
  onInsertAbove,
  onInsertBelow,
  onRemove,
  onClose,
}) => {
  React.useEffect(() => {
    const dismiss = () => onClose();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    // Capture, so a click that also lands on something else still closes.
    window.addEventListener('mousedown', dismiss, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('mousedown', dismiss, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', dismiss);
    };
  }, [onClose]);

  // Flip rather than overflow when the click was near an edge.
  const left = Math.min(state.x, window.innerWidth - WIDTH - 8);
  const top = Math.min(state.y, window.innerHeight - HEIGHT - 8);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <Menu
      style={{ left, top }}
      onMouseDown={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
    >
      <Label>Insert above</Label>
      <Item onClick={run(() => onInsertAbove('paragraph'))}>Text</Item>
      <Item onClick={run(() => onInsertAbove('bullet'))}>Bullet</Item>
      <Item onClick={run(() => onInsertAbove('image'))}>Image…</Item>

      <Label>Insert below</Label>
      <Item onClick={run(() => onInsertBelow('paragraph'))}>Text</Item>
      <Item onClick={run(() => onInsertBelow('bullet'))}>Bullet</Item>
      <Item onClick={run(() => onInsertBelow('image'))}>Image…</Item>

      <Divider />
      <Item $danger disabled={!canRemove} onClick={run(onRemove)}>
        Delete line
      </Item>
    </Menu>
  );
};

export default RowMenu;

const Menu = styled.div`
  position: fixed;
  z-index: 60;
  width: ${WIDTH}px;
  padding: 5px;
  background: ${admin.surface};
  border: 1px solid ${admin.line};
  border-radius: 10px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.16);
`;

const Label = styled.div`
  font: 600 8.5px ${admin.mono};
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: ${admin.dim2};
  padding: 6px 8px 3px;
`;

const Item = styled.button<{ $danger?: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: ${({ $danger }) => ($danger ? '#B91C1C' : admin.body)};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ $danger }) =>
      $danger ? 'rgba(185,28,28,.08)' : admin.bg};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const Divider = styled.div`
  height: 1px;
  margin: 5px 3px;
  background: ${admin.hair};
`;
