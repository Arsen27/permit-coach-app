import React, { useEffect } from 'react';
import styled from 'styled-components';

import CourseEditorScreen from './features/course/CourseEditorScreen';
import QuestionsScreen from './features/questions/QuestionsScreen';
import SignsScreen from './features/signs/SignsScreen';
import FormatsScreen from './features/formats/FormatsScreen';
import SettingsScreen from './features/settings/SettingsScreen';
import SkeletonScreen from './features/skeleton/SkeletonScreen';
import LoginScreen from './features/shell/LoginScreen';
import NavRail from './features/shell/NavRail';
import ToastHost from './features/shell/ToastHost';
import TopBar from './features/shell/TopBar';
import { useAuth } from './store/authStore';
import { useUi } from './store/uiStore';
import { useWorkspace } from './store/workspaceStore';
import { GlobalStyle } from './styles/GlobalStyle';
import { admin } from './styles/theme';

const App: React.FC = () => {
  const ready = useWorkspace(state => state.ready);
  const error = useWorkspace(state => state.error);
  const load = useWorkspace(state => state.load);
  const screen = useUi(state => state.screen);
  const tab = useUi(state => state.tab);

  const authConfig = useAuth(state => state.config);
  const session = useAuth(state => state.session);
  const manualToken = useAuth(state => state.manualToken);
  const loadAuth = useAuth(state => state.load);
  const authenticated = useAuth(state => state.authenticated());

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  // The workspace loads once someone may actually read it — and reloads after
  // a sign-in.
  useEffect(() => {
    if (authConfig != null && authenticated) {
      void load();
    }
  }, [authConfig, authenticated, session, manualToken, load]);

  if (authConfig == null) {
    return (
      <>
        <GlobalStyle />
        <Shell>
          <Centered>checking access…</Centered>
        </Shell>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <GlobalStyle />
        <Shell>
          <LoginScreen />
        </Shell>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <Shell>
        <TopBar />
        {error != null ? (
          <Centered>{error}</Centered>
        ) : !ready ? (
          <Centered>loading course data…</Centered>
        ) : (
          <Body>
            <NavRail />
            {/* The skeleton is one document shared by every state, so it
                replaces the per-course screens rather than sitting beside
                them in the rail. */}
            {tab === 'skeleton' ? (
              <SkeletonScreen />
            ) : (
              <>
                {screen === 'course' && <CourseEditorScreen />}
                {screen === 'questions' && <QuestionsScreen />}
                {screen === 'signs' && <SignsScreen />}
                {screen === 'formats' && <FormatsScreen />}
                {screen === 'settings' && <SettingsScreen />}
              </>
            )}
          </Body>
        )}
        <ToastHost />
      </Shell>
    </>
  );
};

export default App;

const Shell = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${admin.bg};
  color: ${admin.ink};
  overflow: hidden;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

const Centered = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 500 12px ${admin.mono};
  color: ${admin.dim2};
`;
