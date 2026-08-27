import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import styled, { ThemeProvider, useTheme } from 'styled-components/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  AnalyticsIdentity,
  AnalyticsProvider,
} from '@/analytics/AnalyticsProvider';
import { captureCurrentScreen } from '@/analytics/screens';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import AccountDeletionOverlay from '@/components/AccountDeletionOverlay';
import AppUpdateGate from '@/components/AppUpdateGate';
import DailyStreakGate from '@/components/DailyStreakGate';
import GlassTabBar from '@/components/GlassTabBar';
import HeaderCount from '@/components/HeaderCount';
import { CourseProvider } from '@/data/course/CourseProvider';
import { SignsProvider } from '@/data/signs/SignsProvider';
import UpdateManager from '@/data/course/UpdateManager';
import { isOnboardingDone } from '@/lib/onboardingFlag';
import { migrateLegacyAgeBand } from '@/lib/onboardingPrefs';
import { PurchasesProvider } from '@/purchases/PurchasesProvider';
import { navigationRef } from '@/navigation/rootNavigation';
import { RootStackParamList, TabParamList } from '@/navigation/types';
import { findCategory, signsByCategory } from '@/data/signs';
import AuthScreen from '@/screens/AuthScreen';
import FontPickerScreen from '@/screens/FontPickerScreen';
import LearnScreen from '@/screens/LearnScreen';
import LessonOverviewScreen from '@/screens/LessonOverviewScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import PracticeScreen from '@/screens/PracticeScreen';
import QuizScreen from '@/screens/QuizScreen';
import SavedSignsScreen from '@/screens/SavedSignsScreen';
import SignCategoryScreen from '@/screens/SignCategoryScreen';
import SignDetailScreen from '@/screens/SignDetailScreen';
import SignsScreen from '@/screens/SignsScreen';
import StatePickerScreen from '@/screens/StatePickerScreen';
import StreakScreen from '@/screens/StreakScreen';
import TheoryScreen from '@/screens/TheoryScreen';
import YouScreen from '@/screens/YouScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { AppTheme, makeTheme } from '@/theme';

const isIOS = Platform.OS === 'ios';

const Tab = createBottomTabNavigator<TabParamList>();
const NativeTab = createNativeBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// iOS: the system UITabBarController — Apple's own Liquid Glass tab bar on
// iOS 26, SF Symbol icons, tinted with the user's accent.
const TabsIOS: React.FC = () => {
  const theme = useTheme();

  return (
    <NativeTab.Navigator
      screenOptions={{ tabBarActiveTintColor: theme.colors.accent }}
    >
      <NativeTab.Screen
        name="Learn"
        component={LearnScreen}
        options={{ tabBarIcon: { type: 'sfSymbol', name: 'book.fill' } }}
      />
      <NativeTab.Screen
        name="Practice"
        component={PracticeScreen}
        options={{ tabBarIcon: { type: 'sfSymbol', name: 'checklist' } }}
      />
      <NativeTab.Screen
        name="Signs"
        component={SignsScreen}
        options={{
          tabBarIcon: {
            type: 'sfSymbol',
            name: 'exclamationmark.triangle.fill',
          },
        }}
      />
      <NativeTab.Screen
        name="You"
        component={YouScreen}
        options={{ tabBarIcon: { type: 'sfSymbol', name: 'person.fill' } }}
      />
    </NativeTab.Navigator>
  );
};

// Android: visually-similar analog of the iOS bar — the custom floating
// Liquid Glass capsule; content scrolls beneath it.
const TabsAndroid: React.FC = () => (
  <Tab.Navigator
    tabBar={props => <GlassTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: 'transparent' },
    }}
  >
    <Tab.Screen name="Learn" component={LearnScreen} />
    <Tab.Screen name="Practice" component={PracticeScreen} />
    <Tab.Screen name="Signs" component={SignsScreen} />
    <Tab.Screen name="You" component={YouScreen} />
  </Tab.Navigator>
);

const Tabs = isIOS ? TabsIOS : TabsAndroid;

// Adopts the display name from the identity provider (Google/Apple) into the
// profile once: only while the profile name is still empty, so a name the
// user picks later is never overwritten. Runs headless inside AppState.
const IdentityNameSync: React.FC = () => {
  const { identityName } = useAuth();
  const { user, setName } = useAppState();

  useEffect(() => {
    if (user.name === '' && identityName != null) {
      setName(identityName);
    }
  }, [user.name, identityName, setName]);

  return null;
};

type AppShellProps = {
  theme: AppTheme;
  onboarded: boolean;
};

// Everything below the theme seam, memoized: AppState changes on every
// answered question, and only the theme actually derives from it here — the
// navigator and every mounted screen must not pay a re-render for progress
// updates. On iOS the stack uses native UINavigationBar headers (system back
// button and bar items get the iOS 26 glass treatment); Android screens draw
// their own analog headers, so the base stays headerShown:false.
const AppShellComponent: React.FC<AppShellProps> = ({ theme, onboarded }) => {
  // Stable object identity: React Navigation publishes this through its own
  // context, so a fresh object per render would re-render every navigator.
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: theme.colors.bg,
        primary: theme.colors.accent,
        card: theme.colors.bg,
        text: theme.colors.ink,
      },
    }),
    [theme],
  );

  return (
    <ThemeProvider theme={theme}>
      <Container>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.bg} />
        <IdentityNameSync />
        <AnalyticsIdentity />
        <DailyStreakGate />
        <UpdateManager />
        <AppUpdateGate />
        <NavigationContainer
          ref={navigationRef}
          // @react-navigation/native v7 no longer feeds the PostHog SDK's own
          // screen autocapture, so $screen rides on the container's own
          // callbacks: once when it mounts, then on every navigation.
          onReady={captureCurrentScreen}
          onStateChange={captureCurrentScreen}
          theme={navigationTheme}
        >
          <Stack.Navigator
            initialRouteName={onboarded ? 'Tabs' : 'Onboarding'}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              // No swiping out of onboarding — except in the dev replay
              // (You → Run onboarding), where it is the only way back. On a
              // real first launch this route has nothing under it anyway.
              options={{ gestureEnabled: __DEV__ }}
            />
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen
              name="Lesson"
              component={LessonOverviewScreen}
              options={
                isIOS
                  ? {
                      headerShown: true,
                      title: '',
                      headerBackButtonDisplayMode: 'minimal',
                      // The lesson hero runs full-bleed under the bar.
                      headerTransparent: true,
                    }
                  : undefined
              }
            />
            <Stack.Screen
              name="Theory"
              component={TheoryScreen}
              // iOS: back, lesson progress and close are native bar items the
              // screen installs itself. Android draws the analog header row.
              options={{
                gestureEnabled: false,
                ...(isIOS && { headerShown: true, headerBackVisible: false }),
              }}
            />
            <Stack.Screen
              name="Quiz"
              component={QuizScreen}
              options={{
                gestureEnabled: false,
                ...(isIOS && { headerShown: true, headerBackVisible: false }),
              }}
            />
            <Stack.Screen
              name="SignCategory"
              component={SignCategoryScreen}
              options={({ route }) =>
                isIOS
                  ? {
                      headerShown: true,
                      headerBackButtonDisplayMode: 'minimal',
                      title: findCategory(route.params.categoryId)?.name ?? '',
                      unstable_headerRightItems: () => [
                        {
                          type: 'custom',
                          element: (
                            <HeaderCount>
                              {`${
                                signsByCategory(route.params.categoryId).length
                              } signs`}
                            </HeaderCount>
                          ),
                          hidesSharedBackground: true,
                        },
                      ],
                    }
                  : {}
              }
            />
            <Stack.Screen
              name="SavedSigns"
              component={SavedSignsScreen}
              options={
                isIOS
                  ? {
                      headerShown: true,
                      title: 'Saved',
                      headerBackButtonDisplayMode: 'minimal',
                    }
                  : undefined
              }
            />
            <Stack.Screen
              name="SignDetail"
              component={SignDetailScreen}
              options={
                isIOS
                  ? {
                      headerShown: true,
                      headerBackButtonDisplayMode: 'minimal',
                    }
                  : undefined
              }
            />
            <Stack.Screen
              name="StatePicker"
              component={StatePickerScreen}
              options={
                isIOS
                  ? {
                      headerShown: true,
                      title: 'State',
                      headerBackButtonDisplayMode: 'minimal',
                    }
                  : undefined
              }
            />
            <Stack.Screen
              name="FontPicker"
              component={FontPickerScreen}
              options={
                isIOS
                  ? {
                      headerShown: true,
                      title: 'App font',
                      headerBackButtonDisplayMode: 'minimal',
                    }
                  : undefined
              }
            />
            <Stack.Screen
              name="Auth"
              component={AuthScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="Streak"
              component={StreakScreen}
              // Native sheet sized to its content: iOS presents it via
              // UISheetPresentationController with the system grabber.
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: 'fitToContents',
                sheetGrabberVisible: true,
                sheetCornerRadius: 28,
                contentStyle: { backgroundColor: theme.colors.bg },
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </Container>
    </ThemeProvider>
  );
};

const AppShell = React.memo(AppShellComponent);

// Theme depends on the persisted appearance settings, so this seam sits
// inside AppState. The theme is memoized on the two settings it reads:
// styled-components has no bail-out on deep-equal themes, so a fresh object
// here would re-run every styled component's css on every state change.
const ThemedApp: React.FC = () => {
  const { accentId, fontId } = useAppState();
  const theme = useMemo(() => makeTheme(accentId, fontId), [accentId, fontId]);
  // Gate on the onboarding flag before the navigator mounts, mirroring the
  // AppState hydration gate: initialRouteName is fixed at first render.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    // Older installs may hold the retired 'under-18' age band; rewrite it
    // before anything reads the stored answers.
    migrateLegacyAgeBand();
    isOnboardingDone().then(setOnboarded);
  }, []);

  if (onboarded == null) {
    return null;
  }

  return <AppShell theme={theme} onboarded={onboarded} />;
};

// Keyed on the user id: switching accounts (including the first anonymous
// sign-in) remounts AppState, which re-hydrates the right user's data.
const AuthedApp: React.FC = () => {
  const { userId } = useAuth();

  return (
    <>
      <AppStateProvider key={userId} userId={userId}>
        <ThemedApp />
      </AppStateProvider>
      {/* Deliberately outside the keyed provider: account deletion changes
          that key twice, and this has to hold still across both remounts. */}
      <AccountDeletionOverlay />
    </>
  );
};

const App: React.FC = () => (
  <SafeAreaProvider>
    <AnalyticsProvider>
      <AuthProvider>
        <PurchasesProvider>
          <CourseProvider>
            <SignsProvider>
              <AuthedApp />
            </SignsProvider>
          </CourseProvider>
        </PurchasesProvider>
      </AuthProvider>
    </AnalyticsProvider>
  </SafeAreaProvider>
);

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme: t }) => t.colors.bg};
`;

export default App;
