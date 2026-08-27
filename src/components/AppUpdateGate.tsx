import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState as RNAppState, Platform } from 'react-native';

import { track } from '@/analytics';
import {
  AppRelease,
  checkForAppUpdate,
  openStoreListing,
} from '@/lib/appUpdate';
import { isOnboardingDone } from '@/lib/onboardingFlag';

// Headless gate for the "there is a new version" prompt: asks the server on
// app entry (and on every foreground — checkForAppUpdate keeps the request
// itself to once a day), then shows the plain system alert. Accepting hands
// the learner to the store listing the server named.
//
// Deliberately a system Alert and not a designed sheet: this is an OS-level
// housekeeping message, and UIAlertController is what learners already read
// as one. It also survives whatever screen happens to be on top.

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

const promptForUpdate = (release: AppRelease): void => {
  track('app_update_prompted', { latest_version: release.latestVersion });
  Alert.alert(
    'Update Available',
    `PermitCoach ${release.latestVersion} is available in the ${STORE_NAME}. Update to get the latest questions and fixes.`,
    [
      {
        text: 'Not Now',
        style: 'cancel',
        onPress: () =>
          track('app_update_prompt_answered', {
            latest_version: release.latestVersion,
            accepted: false,
          }),
      },
      {
        text: 'Update',
        // Last button is the default (bold) one on iOS.
        onPress: () => {
          track('app_update_prompt_answered', {
            latest_version: release.latestVersion,
            accepted: true,
          });
          openStoreListing(release.storeUrl);
        },
      },
    ],
  );
};

const AppUpdateGate: React.FC = () => {
  // One network attempt per foreground at most; the persisted day throttle
  // does the real rate limiting across launches.
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current) {
      return;
    }
    checking.current = true;
    try {
      // Onboarding owns the screen on a first run, and a fresh install is on
      // the newest build anyway — nothing to prompt about.
      if (!(await isOnboardingDone())) {
        return;
      }
      const release = await checkForAppUpdate();
      if (release != null) {
        promptForUpdate(release);
      }
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    check();
    const subscription = RNAppState.addEventListener('change', status => {
      if (status === 'active') {
        check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  return null;
};

export default AppUpdateGate;
