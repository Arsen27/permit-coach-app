import React from 'react';
import styled from 'styled-components';

// The device shell around a simulated screen: Dynamic Island, status bar and
// home indicator, drawn at the real iPhone 16 Pro logical size (402×874).

export const DEVICE_WIDTH = 402;
export const DEVICE_HEIGHT = 874;
export const FRAME_WIDTH = 420;
export const FRAME_HEIGHT = 892;

type Props = {
  children: React.ReactNode;
  dark?: boolean;
  // Set while this device owns wheel scrolling; drawn as a soft ring.
  focused?: boolean;
};

const IOSChrome: React.FC<Props> = ({
  children,
  dark = false,
  focused = false,
}) => (
  <Bezel data-device="ios" $focused={focused}>
    <Screen $dark={dark}>
      <Island />
      <StatusBar>
        <Time $dark={dark}>9:41</Time>
        <StatusIcons>
          <Signal $dark={dark} />
          <Wifi $dark={dark} />
          <Battery $dark={dark} />
        </StatusIcons>
      </StatusBar>

      <Content>{children}</Content>

      <HomeIndicator>
        <HomeBar $dark={dark} />
      </HomeIndicator>
    </Screen>
  </Bezel>
);

export default IOSChrome;

const Bezel = styled.div<{ $focused: boolean }>`
  width: ${DEVICE_WIDTH}px;
  height: ${DEVICE_HEIGHT}px;
  padding: 9px;
  border-radius: 57px;
  background: #050506;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.26),
    inset 0 0 0 1px rgba(255, 255, 255, 0.16)
      ${({ $focused }) =>
        $focused ? ', 0 0 0 3px rgba(4, 133, 247, 0.35)' : ''};
  box-sizing: border-box;
`;

const Screen = styled.div<{ $dark: boolean }>`
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 48px;
  overflow: hidden;
  background: ${({ $dark }) => ($dark ? '#000' : '#fff')};
  display: flex;
  flex-direction: column;
`;

const Island = styled.div`
  position: absolute;
  top: 11px;
  left: 50%;
  transform: translateX(-50%);
  width: 126px;
  height: 37px;
  border-radius: 24px;
  background: #000;
  z-index: 50;
`;

// Sits on the Dynamic Island's own line: the island spans 11–48px, so the bar
// occupies exactly that band and centres the clock and glyphs within it.
const StatusBar = styled.div`
  position: absolute;
  top: 11px;
  left: 0;
  right: 0;
  height: 37px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  z-index: 10;
  pointer-events: none;
`;

const Time = styled.span<{ $dark: boolean }>`
  font-family: -apple-system, 'SF Pro', system-ui, sans-serif;
  font-weight: 600;
  font-size: 17px;
  line-height: 22px;
  color: ${({ $dark }) => ($dark ? '#fff' : '#000')};
`;

const StatusIcons = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`;

const Signal = styled.div<{ $dark: boolean }>`
  width: 18px;
  height: 12px;
  background: linear-gradient(
      to right,
      currentColor 3px,
      transparent 3px 4.8px,
      currentColor 4.8px 8px,
      transparent 8px 9.6px,
      currentColor 9.6px 12.8px,
      transparent 12.8px 14.4px,
      currentColor 14.4px
    )
    bottom / 100% 100% no-repeat;
  clip-path: polygon(
    0 62%,
    27% 62%,
    27% 100%,
    0 100%,
    0 62%,
    27% 40%,
    53% 40%,
    53% 100%,
    27% 100%,
    27% 40%,
    53% 20%,
    80% 20%,
    80% 100%,
    53% 100%,
    53% 20%,
    80% 0,
    100% 0,
    100% 100%,
    80% 100%
  );
  color: ${({ $dark }) => ($dark ? '#fff' : '#000')};
`;

const Wifi = styled.div<{ $dark: boolean }>`
  width: 16px;
  height: 12px;
  border: 2px solid ${({ $dark }) => ($dark ? '#fff' : '#000')};
  border-bottom: none;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -5px;
    transform: translateX(-50%);
    width: 3px;
    height: 3px;
    border-radius: 99px;
    background: ${({ $dark }) => ($dark ? '#fff' : '#000')};
  }
`;

const Battery = styled.div<{ $dark: boolean }>`
  width: 24px;
  height: 12px;
  border: 1px solid
    ${({ $dark }) => ($dark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.35)')};
  border-radius: 3.5px;
  padding: 1.5px;
  position: relative;

  &::before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 1.5px;
    background: ${({ $dark }) => ($dark ? '#fff' : '#000')};
  }

  &::after {
    content: '';
    position: absolute;
    right: -3px;
    top: 3.5px;
    width: 2px;
    height: 4px;
    border-radius: 0 1px 1px 0;
    background: ${({ $dark }) =>
      $dark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.35)'};
  }
`;

const Content = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
`;

const HomeIndicator = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 34px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: 8px;
  z-index: 60;
  pointer-events: none;
`;

const HomeBar = styled.div<{ $dark: boolean }>`
  width: 139px;
  height: 5px;
  border-radius: 100px;
  background: ${({ $dark }) =>
    $dark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.25)'};
`;
