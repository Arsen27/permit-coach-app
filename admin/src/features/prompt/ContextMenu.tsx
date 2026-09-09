import React, { useEffect } from 'react';
import styled from 'styled-components';

import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

// Right-click menu over selected lesson text. Both actions work on the same
// selection: collect it for a prompt, or look for it in the reference course.

type Props = {
  onAddToPrompt: (text: string) => void;
  onFindSimilar?: (text: string) => void;
  canFindSimilar: boolean;
};

const MENU_WIDTH = 250;
const MENU_HEIGHT = 150;

export const menuPosition = (
  x: number,
  y: number,
  viewport: { width: number; height: number },
) => ({
  x: Math.max(8, Math.min(x, viewport.width - MENU_WIDTH - 8)),
  y: Math.max(8, Math.min(y, viewport.height - MENU_HEIGHT - 8)),
});

const ContextMenu: React.FC<Props> = ({
  onAddToPrompt,
  onFindSimilar,
  canFindSimilar,
}) => {
  const menu = useUi(state => state.contextMenu);
  const close = useUi(state => state.closeContextMenu);

  useEffect(() => {
    if (menu == null) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, close]);

  if (menu == null) {
    return null;
  }

  const snippet =
    menu.text.length > 70 ? `${menu.text.slice(0, 70)}…` : menu.text;

  return (
    <Overlay onClick={close} onContextMenu={close}>
      <Menu
        style={{ left: menu.x, top: menu.y }}
        onClick={event => event.stopPropagation()}
      >
        <Item
          onClick={() => {
            onAddToPrompt(menu.text);
            close();
          }}
        >
          <Bookmark />
          Add to prompt
        </Item>

        {canFindSimilar && onFindSimilar != null && (
          <Item
            onClick={() => {
              onFindSimilar(menu.text);
              close();
            }}
          >
            <Magnifier />
            Find similar in the reference
          </Item>
        )}

        <Snippet>{snippet}</Snippet>
      </Menu>
    </Overlay>
  );
};

export default ContextMenu;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 70;
`;

const Menu = styled.div`
  position: absolute;
  width: ${MENU_WIDTH}px;
  background: ${admin.surface};
  border: 1px solid ${admin.line};
  border-radius: 12px;
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.22);
  padding: 6px;
`;

const Item = styled.button`
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  color: ${admin.ink};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${admin.bg};
  }
`;

const Bookmark = styled.span`
  flex: none;
  width: 10px;
  height: 13px;
  background: ${admin.accent};
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%);
`;

const Magnifier = styled.span`
  flex: none;
  width: 11px;
  height: 11px;
  border: 2px solid ${admin.accent};
  border-radius: 99px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: 5px;
    height: 2px;
    background: ${admin.accent};
    transform: rotate(45deg);
  }
`;

const Snippet = styled.p`
  margin: 2px 10px 6px;
  padding-left: 8px;
  border-left: 2px solid ${admin.line};
  font-size: 10.5px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.dim2};
`;
