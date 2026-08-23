import { Platform } from 'react-native';

import notifee, { AuthorizationStatus } from '@notifee/react-native';

import { createLogger } from './log';

// Notification permission. Asking is a one-shot system dialog: once the user
// has answered, iOS never shows it again, so every caller must treat a
// refusal as final and carry on — reminders are a nice-to-have, never a gate.

const log = createLogger('notify');

export type NotificationPermission = 'granted' | 'denied' | 'unsupported';

const toResult = (status: AuthorizationStatus): NotificationPermission =>
  status === AuthorizationStatus.AUTHORIZED ||
  status === AuthorizationStatus.PROVISIONAL
    ? 'granted'
    : 'denied';

export const notificationPermission =
  async (): Promise<NotificationPermission> => {
    try {
      const settings = await notifee.getNotificationSettings();
      return toResult(settings.authorizationStatus);
    } catch (error) {
      log.warn('could not read notification settings', error);
      return 'unsupported';
    }
  };

// Shows the system prompt unless it has already been answered. Android below
// 13 has no runtime permission at all and reports authorized outright.
export const requestNotificationPermission =
  async (): Promise<NotificationPermission> => {
    try {
      const current = await notifee.getNotificationSettings();
      if (current.authorizationStatus !== AuthorizationStatus.NOT_DETERMINED) {
        log.info(`already answered: ${current.authorizationStatus}`);
        return toResult(current.authorizationStatus);
      }
      const settings = await notifee.requestPermission();
      const result = toResult(settings.authorizationStatus);
      log.info(`permission ${result} on ${Platform.OS}`);
      return result;
    } catch (error) {
      // A missing native module (dev build not rebuilt yet) must not break
      // onboarding — the flow continues without reminders.
      log.warn('permission request failed', error);
      return 'unsupported';
    }
  };
