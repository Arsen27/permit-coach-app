import { navigationRef } from '@/navigation/rootNavigation';

import { posthog } from './client';

// Manual $screen capture. @react-navigation/native v7 changed how the
// container exposes state, so the SDK's own screen autocapture no longer
// works with it (autocapture.captureScreens is off in AnalyticsProvider) —
// the container's onStateChange drives it instead.

// Name plus params, so replacing Theory with the next lesson counts as a new
// screen while a re-render of the same route does not.
let lastScreen: string | null = null;

const snakeCase = (key: string): string =>
  key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// Route params, minus anything that is not a plain value. Params in this app
// are ids, modes and indices — keep them that way: whatever lands here lands
// on the event.
const screenProperties = (
  params: object | undefined,
): Record<string, string | number | boolean> | undefined => {
  if (params == null) {
    return undefined;
  }
  const properties: Record<string, string | number | boolean> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      properties[snakeCase(key)] = value;
    }
  });
  return Object.keys(properties).length > 0 ? properties : undefined;
};

// The innermost active route — the tab or onboarding step the learner is
// actually looking at, not the "Tabs"/"Onboarding" wrapper.
export const captureCurrentScreen = (): void => {
  if (posthog == null || !navigationRef.isReady()) {
    return;
  }
  const route = navigationRef.getCurrentRoute();
  if (route == null) {
    return;
  }
  const properties = screenProperties(route.params);
  const signature = `${route.name}:${JSON.stringify(properties ?? {})}`;
  if (signature === lastScreen) {
    return;
  }
  lastScreen = signature;
  posthog.screen(route.name, properties);
};
