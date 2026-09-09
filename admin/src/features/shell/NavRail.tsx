import React from 'react';
import styled from 'styled-components';

import { useUi, type Screen } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

// The dark rail on the far left. Icons are drawn in CSS so the panel carries
// no icon assets of its own.

const ITEMS: { key: Screen; label: string }[] = [
  { key: 'course', label: 'Course' },
  { key: 'questions', label: 'Questions' },
  { key: 'signs', label: 'Signs' },
  { key: 'formats', label: 'Formats' },
  { key: 'settings', label: 'Settings' },
];

const Glyph: React.FC<{ screen: Screen; color: string }> = ({
  screen,
  color,
}) => {
  if (screen === 'settings') {
    return (
      <Gear>
        <GearBar $color={color} $x="2px" />
        <GearBar $color={color} $x="9px" />
        <GearBar $color={color} $x="5px" />
      </Gear>
    );
  }
  if (screen === 'course') {
    return <BookGlyph $color={color} />;
  }
  if (screen === 'signs') {
    return <OctagonGlyph $color={color} />;
  }
  if (screen === 'questions') {
    return <MarkGlyph $color={color}>?</MarkGlyph>;
  }
  return <PageGlyph $color={color} />;
};

const NavRail: React.FC = () => {
  const screen = useUi(state => state.screen);
  const setScreen = useUi(state => state.setScreen);

  return (
    <Rail>
      {ITEMS.map(item => {
        const active = screen === item.key;
        const color = active ? '#FFFFFF' : admin.railText;
        return (
          <Item
            key={item.key}
            $active={active}
            title={item.label}
            onClick={() => setScreen(item.key)}
          >
            <Glyph screen={item.key} color={color} />
            <Label $color={color}>{item.label}</Label>
          </Item>
        );
      })}
    </Rail>
  );
};

export default NavRail;

const MarkGlyph = styled.div<{ $color: string }>`
  width: 15px;
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
  color: ${({ $color }) => $color};
`;

const OctagonGlyph = styled.div<{ $color: string }>`
  width: 15px;
  height: 15px;
  background: ${({ $color }) => $color};
  clip-path: polygon(
    30% 0,
    70% 0,
    100% 30%,
    100% 70%,
    70% 100%,
    30% 100%,
    0 70%,
    0 30%
  );
`;

const Rail = styled.nav`
  flex: none;
  width: 68px;
  background: ${admin.rail};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 0;
`;

const Item = styled.button<{ $active: boolean }>`
  width: 52px;
  padding: 8px 0 6px;
  border: none;
  border-radius: 11px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-family: inherit;
  background: ${({ $active }) =>
    $active ? 'rgba(255,255,255,.12)' : 'transparent'};

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

const Label = styled.span<{ $color: string }>`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: ${({ $color }) => $color};
`;

const Gear = styled.div`
  width: 15px;
  height: 15px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
`;

const GearBar = styled.div<{ $color: string; $x: string }>`
  height: 2px;
  border-radius: 2px;
  background: ${({ $color }) => $color};
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: ${({ $x }) => $x};
    top: -2px;
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: ${({ $color }) => $color};
  }
`;

const BookGlyph = styled.div<{ $color: string }>`
  width: 15px;
  height: 13px;
  border: 1.8px solid ${({ $color }) => $color};
  border-radius: 2px 3px 3px 2px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -1.8px;
    bottom: -1.8px;
    width: 1.8px;
    background: ${({ $color }) => $color};
  }
`;

const PageGlyph = styled.div<{ $color: string }>`
  width: 12px;
  height: 15px;
  border: 1.8px solid ${({ $color }) => $color};
  border-radius: 2px;
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 2px;
    right: 2px;
    height: 1.6px;
    background: ${({ $color }) => $color};
  }
  &::before {
    top: 3px;
  }
  &::after {
    top: 7px;
  }
`;
