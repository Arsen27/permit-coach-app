import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { UNOFFICIAL_DISCLAIMER_TEXT } from '@/components/UnofficialDisclaimer';
import PaywallScreen from '@/screens/onboarding/PaywallScreen';
import StateSelectScreen from '@/screens/onboarding/StateSelectScreen';
import { AppStateProvider } from '@/state/AppState';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const renderWithProviders = async (
  node: React.ReactNode,
): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">{node}</AppStateProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsOf = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => String(node.type) === 'Text' && node.children.length > 0)
    .map(node =>
      node.children
        .map(child => (typeof child === 'string' ? child : ''))
        .join(''),
    );

const BANNED_CLAIMS = [
  'official questions',
  'DMV approved',
  'guaranteed pass',
  'pass guaranteed',
];

describe('unofficial disclaimer', () => {
  it('names independence, non-affiliation and no pass guarantee', () => {
    expect(UNOFFICIAL_DISCLAIMER_TEXT).toBe(
      'PermitCoach is an independent, unofficial study app. It is not affiliated with or endorsed by any DMV or government agency. Passing is not guaranteed.',
    );
  });

  it('is visible on the first onboarding step, before Continue', async () => {
    const navigation = { push: jest.fn() } as never;
    const tree = await renderWithProviders(
      <StateSelectScreen
        navigation={navigation}
        route={{ key: 's', name: 'StateSelect' } as never}
      />,
    );
    const texts = textsOf(tree);
    expect(texts).toContain(UNOFFICIAL_DISCLAIMER_TEXT);
    expect(texts).toContain('Continue');

    const lowered = texts.join(' ').toLowerCase();
    BANNED_CLAIMS.forEach(claim => {
      expect(lowered).not.toContain(claim.toLowerCase());
    });
  });

  // Terms and Privacy are NOT asserted here any more. They live in the
  // dashboard paywall template's own footer row, next to Restore purchases,
  // and <RevenueCatUI.Paywall> is a native view that renders nothing under
  // jest — so no test in this repo can see them. Their presence is now only
  // verifiable in the RevenueCat paywall editor; treat removing them there as
  // a release blocker, because App Store review expects both before purchase.
  it('is visible on the paywall', async () => {
    const navigation = {
      addListener: jest.fn(() => jest.fn()),
      replace: jest.fn(),
    } as never;
    const tree = await renderWithProviders(
      <PaywallScreen
        navigation={navigation}
        route={{ key: 'p', name: 'Paywall' } as never}
      />,
    );
    const texts = textsOf(tree);
    expect(texts).toContain(UNOFFICIAL_DISCLAIMER_TEXT);
    // The app-side pair is gone; anything matching here would be a duplicate
    // of what the template already draws.
    expect(texts).not.toContain('Privacy Policy');
    expect(texts).not.toContain('Terms of Use');
  });
});
