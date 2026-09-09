import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { useAuth } from '@admin/store/authStore';
import { usePrompt } from '@admin/store/promptStore';
import { useUi } from '@admin/store/uiStore';
import { stateOfCourse, useWorkspace } from '@admin/store/workspaceStore';
import { admin } from '@admin/styles/theme';

import { Chevron, Mono, Row, Spacer } from './ui';

// Header row from the mockup: identity, the course chip, the state picker,
// which screen is open, and the prompt-builder toggle with its count.

const SCREEN_TITLES = {
  course: 'Course editor',
  questions: 'Question bank',
  signs: 'Signs catalogue',
  formats: 'Card formats',
  settings: 'Settings',
} as const;

const TopBar: React.FC = () => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const courses = useWorkspace(state => state.courses);
  const courseId = useWorkspace(state => state.courseId);
  const settings = useWorkspace(state => state.settings);
  const selectCourse = useWorkspace(state => state.selectCourse);
  const screen = useUi(state => state.screen);
  const rightDock = useUi(state => state.rightDock);
  const toggleRightDock = useUi(state => state.toggleRightDock);
  const chunkCount = usePrompt(state => state.chunks.length);
  const session = useAuth(state => state.session);
  const authMode = useAuth(state => state.config?.mode ?? 'open');
  const logout = useAuth(state => state.logout);

  const initials =
    session?.email?.split('@')[0].slice(0, 2).toUpperCase() ?? 'OK';

  const usState = stateOfCourse(courses, courseId);
  const current = courses.find(course => course.courseId === courseId);

  // Track the browser's own state: Esc leaves fullscreen without telling us.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement == null) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  return (
    <Bar>
      <Row $gap={9}>
        <Logo>
          <LogoRing />
        </Logo>
        <Brand>PermitCoach</Brand>
        <Sub>Content Admin</Sub>
      </Row>

      <Pill as="div">
        <LiveDot />
        <PillText>{settings?.courseName ?? 'Course'}</PillText>
      </Pill>

      <PickerWrap>
        <Pill onClick={() => setPickerOpen(open => !open)}>
          <PillLabel>STATE</PillLabel>
          <PillValue>{usState || '—'}</PillValue>
          <Chevron $dir="down" />
        </Pill>
        {pickerOpen && (
          <Dropdown onMouseLeave={() => setPickerOpen(false)}>
            {courses.map(course => (
              <DropdownRow
                key={course.courseId}
                $selected={course.courseId === courseId}
                onClick={() => {
                  setPickerOpen(false);
                  void selectCourse(course.courseId);
                }}
              >
                <Mono $size={10.5} $weight={700}>
                  {course.usState}
                </Mono>
                <DropdownName>{course.courseId}</DropdownName>
                <Spacer />
                {course.courseId === courseId && <Check />}
              </DropdownRow>
            ))}
            <DropdownNote>
              Each state is its own course version tree — switching reloads the
              lesson set and its state-specific cards.
            </DropdownNote>
          </Dropdown>
        )}
      </PickerWrap>

      <Spacer />

      <ScreenTitle>{SCREEN_TITLES[screen]}</ScreenTitle>
      <Divider />
      {current != null && (
        <Channels title="What each channel serves">
          <ChannelChip
            $tone="staging"
            $differs={current.channels.staging !== current.channels.production}
          >
            STAGING{' '}
            {current.channels.staging == null
              ? '—'
              : `v${current.channels.staging}`}
          </ChannelChip>
          <ChannelChip $tone="production">
            PROD{' '}
            {current.channels.production == null
              ? '—'
              : `v${current.channels.production}`}
          </ChannelChip>
        </Channels>
      )}

      <Pill
        title="Prompt builder"
        $active={rightDock === 'prompt'}
        onClick={() => toggleRightDock('prompt')}
      >
        <PillValue>Prompt</PillValue>
        {chunkCount > 0 && <Badge>{chunkCount}</Badge>}
      </Pill>

      <FullscreenButton
        title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
        onClick={toggleFullscreen}
      >
        <FullscreenGlyph $exit={fullscreen} />
      </FullscreenButton>

      <Avatar
        as={authMode === 'open' ? 'div' : 'button'}
        title={
          authMode === 'open'
            ? 'Open access (development)'
            : `${session?.email ?? 'admin token'} — click to sign out`
        }
        onClick={
          authMode === 'open'
            ? undefined
            : () => {
                logout();
              }
        }
      >
        {initials}
      </Avatar>
    </Bar>
  );
};

export default TopBar;

const Bar = styled.header`
  flex: none;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: ${admin.surface};
  border-bottom: 1px solid ${admin.line};
`;

const Logo = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: ${admin.accent};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoRing = styled.div`
  width: 9px;
  height: 9px;
  border-radius: 99px;
  border: 2.5px solid #fff;
  box-sizing: border-box;
`;

const Brand = styled.span`
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const Sub = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const Pill = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  border: 1px solid ${({ $active }) => ($active ? admin.accent : admin.line)};
  border-radius: 99px;
  background: ${({ $active }) => ($active ? admin.accentSoft : admin.soft)};
  cursor: ${({ onClick }) => (onClick == null ? 'default' : 'pointer')};
  font-family: inherit;
  color: ${admin.body};

  &:hover {
    background: ${({ $active }) => ($active ? admin.accentSoft : admin.hair)};
  }
`;

const LiveDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background: #22c55e;
`;

const PillText = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${admin.body};
`;

const PillLabel = styled.span`
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.7px;
  color: ${admin.dim2};
`;

const PillValue = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${admin.ink};
`;

const Badge = styled.span`
  font: 700 10px ${admin.mono};
  color: #fff;
  background: ${admin.accent};
  padding: 1.5px 6px;
  border-radius: 99px;
`;

const PickerWrap = styled.div`
  position: relative;
`;

const Dropdown = styled.div`
  position: absolute;
  top: 34px;
  left: 0;
  width: 220px;
  background: ${admin.surface};
  border: 1px solid ${admin.line};
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14);
  padding: 6px;
  z-index: 45;
`;

const DropdownRow = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: ${admin.dim};
  background: ${({ $selected }) =>
    $selected ? admin.accentSoft : 'transparent'};

  &:hover {
    background: ${admin.bg};
  }
`;

const DropdownName = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: ${admin.ink};
`;

const Check = styled.span`
  width: 9px;
  height: 5px;
  border-left: 2px solid ${admin.accent};
  border-bottom: 2px solid ${admin.accent};
  transform: rotate(-45deg);
`;

const DropdownNote = styled.p`
  margin: 6px 10px;
  font-size: 10px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.faint};
`;

const ScreenTitle = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${admin.body};
`;

const Divider = styled.div`
  width: 1px;
  height: 20px;
  background: ${admin.line};
`;

const Channels = styled.div`
  display: flex;
  gap: 6px;
`;

const ChannelChip = styled.span<{
  $tone: 'staging' | 'production';
  $differs?: boolean;
}>`
  font: 700 10px ${admin.mono};
  letter-spacing: 0.3px;
  padding: 3px 8px;
  border-radius: 999px;
  color: ${({ $tone }) => ($tone === 'production' ? '#1D4ED8' : '#6D28D9')};
  background: ${({ $tone }) =>
    $tone === 'production' ? 'rgba(37,99,235,.12)' : 'rgba(124,58,237,.12)'};
  outline: ${({ $differs }) =>
    $differs ? '1px solid rgba(124,58,237,.45)' : 'none'};
`;

const FullscreenButton = styled.button`
  width: 28px;
  height: 28px;
  border: 1px solid ${admin.line};
  border-radius: 8px;
  background: ${admin.soft};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${admin.muted};

  &:hover {
    background: ${admin.hair};
  }
`;

// Four corner brackets, pointing out to enter and in to exit.
const FullscreenGlyph = styled.span<{ $exit: boolean }>`
  position: relative;
  width: 11px;
  height: 11px;

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    border: 1.6px solid currentColor;
  }

  &::before {
    ${({ $exit }) =>
      $exit
        ? 'right: 0; bottom: 0; border-left: none; border-top: none;'
        : 'left: 0; top: 0; border-right: none; border-bottom: none;'}
  }

  &::after {
    ${({ $exit }) =>
      $exit
        ? 'left: 0; top: 0; border-right: none; border-bottom: none;'
        : 'right: 0; bottom: 0; border-left: none; border-top: none;'}
  }
`;

const Avatar = styled.div`
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 99px;
  background: ${admin.line};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10.5px;
  font-weight: 700;
  color: ${admin.muted};
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: ${admin.hair};
  }
`;
