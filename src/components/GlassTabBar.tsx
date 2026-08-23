import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { IconName } from '@/assets/icons';
import { shadows } from '@/theme';

import GlassSurface from './GlassSurface';
import Icon from './Icon';

const TAB_ICONS: Record<string, { icon: IconName; size: number }> = {
  Learn: { icon: 'book-open', size: 22 },
  Practice: { icon: 'list-check', size: 21 },
  Signs: { icon: 'triangle-exclamation', size: 21 },
  You: { icon: 'person', size: 20 },
};

// Android-only analog of the native iOS tab bar: floating Liquid Glass
// capsule, height 62, inset 25px from the screen edges, 22px above the
// bottom; content scrolls beneath it. The selected tab sits in an
// rgb(237,237,237) pill tinted with the accent. iOS uses the system
// UITabBarController (see TabsIOS in App.tsx).
const GlassTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const theme = useTheme();

  return (
    <Wrap pointerEvents="box-none">
      <BarShadow style={shadows.glass}>
        <Bar>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { icon, size } = TAB_ICONS[route.name];

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const color = focused
              ? theme.colors.accent
              : theme.glass.tabInactive;

            return (
              <Slot key={route.key} onPress={onPress} hitSlop={6}>
                <Item $focused={focused}>
                  <Icon name={icon} size={size} color={color} />
                  <Label style={{ color }}>{route.name}</Label>
                </Item>
              </Slot>
            );
          })}
        </Bar>
      </BarShadow>
    </Wrap>
  );
};

const Wrap = styled.View`
  position: absolute;
  left: 25px;
  right: 25px;
  bottom: 22px;
`;

const BarShadow = styled.View`
  border-radius: 999px;
`;

const Bar = styled(GlassSurface)`
  height: 62px;
  border-radius: 999px;
  flex-direction: row;
  align-items: center;
  padding: 0 6px;
`;

const Slot = styled.Pressable`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

const Item = styled.View<{ $focused: boolean }>`
  align-items: center;
  gap: 1px;
  padding: 7px 16px 6px;
  border-radius: 100px;
  background-color: ${({ theme, $focused }) =>
    $focused ? theme.glass.selection : 'transparent'};
`;

const Label = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 10px;
  letter-spacing: -0.1px;
`;

export default GlassTabBar;
