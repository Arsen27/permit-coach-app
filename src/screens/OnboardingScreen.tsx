import React, { useCallback } from 'react';
import { Platform } from 'react-native';

import {
  NativeStackScreenProps,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import { RootStackParamList } from '@/navigation/types';

import BuildingScreen from './onboarding/BuildingScreen';
import PaywallScreen from './onboarding/PaywallScreen';
import QuestionScreen from './onboarding/QuestionScreen';
import RemindersScreen from './onboarding/RemindersScreen';
import ShowcaseScreen from './onboarding/ShowcaseScreen';
import StateSelectScreen from './onboarding/StateSelectScreen';
import TestDateScreen from './onboarding/TestDateScreen';
import {
  LADDER_STEP_COUNT,
  TEST_DATE_LADDER_INDEX,
  questionLadderIndex,
} from './onboarding/content';
import { OnboardingProvider } from './onboarding/context';
import { OnboardingParamList } from './onboarding/types';
import { LadderDots } from './onboarding/ui';

type OnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Onboarding'
>;

const isIOS = Platform.OS === 'ios';

const Steps = createNativeStackNavigator<OnboardingParamList>();

// Hidden for now (design call, 2026-08-12) — flip back on to restore the
// ladder in the navigation bar; every step still passes its position in.
const SHOW_LADDER = false;

// The ladder progress rides in the navigation bar next to the back button.
// iOS 26 gives custom bar items a shared glass background, which the dots
// should not sit in — same treatment as the SignCategory header count.
const ladderItems = (current: number) => {
  if (!SHOW_LADDER) {
    return {};
  }
  const dots = <LadderDots total={LADDER_STEP_COUNT} current={current} />;

  return isIOS
    ? {
        unstable_headerRightItems: () => [
          {
            type: 'custom' as const,
            element: dots,
            hidesSharedBackground: true,
          },
        ],
      }
    : { headerRight: () => dots };
};

// Onboarding runs as its own stack: one route per step, so going back is the
// platform's own navigation control (the iOS 26 glass back button, the
// Material arrow on Android) instead of a hand-drawn chevron.
const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const done = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }, [navigation]);

  return (
    <OnboardingProvider onDone={done}>
      <Steps.Navigator
        screenOptions={{
          headerShown: false,
          headerTitle: '',
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Steps.Screen
          name="StateSelect"
          component={StateSelectScreen}
          options={{
            headerShown: true,
            ...ladderItems(0),
          }}
        />
        <Steps.Screen
          name="Question"
          component={QuestionScreen}
          initialParams={{ index: 0 }}
          options={({ route }) => ({
            headerShown: true,
            ...ladderItems(questionLadderIndex(route.params.index)),
          })}
        />
        <Steps.Screen
          name="TestDate"
          component={TestDateScreen}
          options={{
            headerShown: true,
            ...ladderItems(TEST_DATE_LADDER_INDEX),
          }}
        />
        <Steps.Screen
          name="Showcase"
          component={ShowcaseScreen}
          options={{
            headerShown: true,
            // The illustration runs full-bleed under the bar.
            headerTransparent: true,
          }}
        />
        <Steps.Screen name="Building" component={BuildingScreen} />
        {/* A hard gate: full-bleed, and the back gesture is switched off at
            the navigator so it never even starts animating. The screen also
            refuses the removal itself, which is what stops Android's
            hardware button. */}
        <Steps.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ gestureEnabled: false }}
        />
        <Steps.Screen name="Reminders" component={RemindersScreen} />
      </Steps.Navigator>
    </OnboardingProvider>
  );
};

export default OnboardingScreen;
