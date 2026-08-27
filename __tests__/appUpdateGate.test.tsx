import React from 'react';
import { Alert, AlertButton } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import AppUpdateGate from '@/components/AppUpdateGate';
import { checkForAppUpdate, openStoreListing } from '@/lib/appUpdate';
import { isOnboardingDone } from '@/lib/onboardingFlag';

jest.mock('@/lib/appUpdate', () => ({
  checkForAppUpdate: jest.fn(),
  openStoreListing: jest.fn(),
}));
jest.mock('@/lib/onboardingFlag', () => ({
  isOnboardingDone: jest.fn(),
}));

const mockCheck = checkForAppUpdate as jest.MockedFunction<
  typeof checkForAppUpdate
>;
const mockOpen = openStoreListing as jest.MockedFunction<
  typeof openStoreListing
>;
const mockOnboardingDone = isOnboardingDone as jest.MockedFunction<
  typeof isOnboardingDone
>;

const RELEASE = {
  latestVersion: '1.3.0',
  storeUrl: 'https://apps.apple.com/app/id123',
};

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

beforeEach(() => {
  alertSpy.mockClear();
  mockOpen.mockClear();
  mockCheck.mockReset().mockResolvedValue(RELEASE);
  mockOnboardingDone.mockReset().mockResolvedValue(true);
});

const mount = async (): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<AppUpdateGate />);
  });
};

const buttons = (): AlertButton[] =>
  (alertSpy.mock.calls[0][2] ?? []) as AlertButton[];

describe('AppUpdateGate', () => {
  it('shows the system alert naming the new version', async () => {
    await mount();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][1]).toContain('1.3.0');
    expect(buttons().map(button => button.text)).toEqual(['Not Now', 'Update']);
  });

  it('sends the learner to the store URL the server named', async () => {
    await mount();

    buttons()[1].onPress?.();
    expect(mockOpen).toHaveBeenCalledWith(RELEASE.storeUrl);
  });

  it('opens nothing when the prompt is dismissed', async () => {
    await mount();

    buttons()[0].onPress?.();
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('stays silent when there is no newer release', async () => {
    mockCheck.mockResolvedValue(null);
    await mount();

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('does not talk to the server during onboarding', async () => {
    mockOnboardingDone.mockResolvedValue(false);
    await mount();

    expect(mockCheck).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
