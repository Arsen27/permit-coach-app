import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import YouScreen from '@/screens/YouScreen';
import { AppStateProvider } from '@/state/AppState';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const mockAuth = {
  signedIn: false,
  hasAccount: false,
  email: null as string | null,
  logOut: jest.fn(),
  deleteAccount: jest.fn(async () => ({ ok: true as const })),
};
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));

const mockPurchases = { plusActive: null as boolean | null };
jest.mock('@/purchases/PurchasesProvider', () => ({
  usePurchases: () => mockPurchases,
}));

const mockOpenManageSubscriptions = jest.fn(async () => undefined);
jest.mock('@/purchases/manageSubscriptions', () => ({
  openManageSubscriptions: () => mockOpenManageSubscriptions(),
}));

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

type AlertButton = { text: string; style?: string; onPress?: () => void };

const lastAlert = () => {
  const call = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  return {
    title: call[0] as string,
    body: call[1] as string,
    buttons: (call[2] ?? []) as AlertButton[],
  };
};

const pressAlertButton = async (label: string): Promise<void> => {
  const button = lastAlert().buttons.find(entry => entry.text === label);
  if (button == null) {
    throw new Error(`no alert button "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    button.onPress?.();
  });
};

const render = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <YouScreen />
        </AppStateProvider>
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

const press = async (tree: Renderer, label: string): Promise<void> => {
  const targets = tree.root.findAll(node => {
    if (typeof node.type === 'string' || node.props.onPress == null) {
      return false;
    }
    return node
      .findAll(inner => String(inner.type) === 'Text')
      .flatMap(text => text.children.filter(c => typeof c === 'string'))
      .join(' ')
      .includes(label);
  });
  if (targets.length === 0) {
    throw new Error(`no pressable containing "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    targets[targets.length - 1].props.onPress();
  });
};

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  alertSpy.mockClear();
  mockOpenManageSubscriptions.mockClear();
  mockAuth.signedIn = false;
  mockAuth.hasAccount = false;
  mockAuth.email = null;
  mockAuth.deleteAccount = jest.fn(async () => ({ ok: true as const }));
  mockPurchases.plusActive = null;
});

describe('Delete Account visibility', () => {
  it('shows it for a registered account', async () => {
    mockAuth.signedIn = true;
    mockAuth.hasAccount = true;
    mockAuth.email = 'ada@example.com';
    const texts = textsOf(await render());
    expect(texts).toContain('Delete account');
    expect(texts).toContain('Log out');
  });

  it('shows it for an anonymous Supabase account, without Log out', async () => {
    mockAuth.hasAccount = true;
    const texts = textsOf(await render());
    expect(texts).toContain('Delete account');
    expect(texts).not.toContain('Log out');
  });

  it('hides it while no Supabase session exists at all', async () => {
    const texts = textsOf(await render());
    expect(texts).not.toContain('Delete account');
  });
});

describe('Delete Account confirmation', () => {
  beforeEach(() => {
    mockAuth.signedIn = true;
    mockAuth.hasAccount = true;
    mockAuth.email = 'ada@example.com';
  });

  it('warns that the store subscription survives when Plus is active', async () => {
    mockPurchases.plusActive = true;
    const tree = await render();
    await press(tree, 'Delete account');

    const alert = lastAlert();
    expect(alert.title).toBe('Delete account?');
    expect(alert.body).toContain(
      'It will not cancel your App Store subscription',
    );
    expect(alert.buttons.map(button => button.text)).toEqual([
      'Manage Subscription',
      'Delete Anyway',
      'Cancel',
    ]);
    // Only the actual deletion is destructive-styled.
    expect(
      alert.buttons.find(button => button.text === 'Delete Anyway')?.style,
    ).toBe('destructive');
    expect(
      alert.buttons.find(button => button.text === 'Manage Subscription')
        ?.style,
    ).toBeUndefined();
  });

  it('treats an unknown entitlement state exactly like an active one', async () => {
    mockPurchases.plusActive = null;
    const tree = await render();
    await press(tree, 'Delete account');
    expect(lastAlert().body).toContain(
      'you may continue to be charged unless you cancel it separately',
    );
  });

  it('uses the plain destructive confirmation when Plus is definitely off', async () => {
    mockPurchases.plusActive = false;
    const tree = await render();
    await press(tree, 'Delete account');

    const alert = lastAlert();
    expect(alert.title).toBe('Delete account?');
    expect(alert.body).toBe(
      'This permanently deletes your PermitCoach account and synced study progress. This action cannot be undone.',
    );
    expect(alert.buttons.map(button => button.text)).toEqual([
      'Delete Account',
      'Cancel',
    ]);
    expect(
      alert.buttons.find(button => button.text === 'Delete Account')?.style,
    ).toBe('destructive');
  });

  it('Manage Subscription opens the store and deletes nothing', async () => {
    mockPurchases.plusActive = true;
    const tree = await render();
    await press(tree, 'Delete account');
    await pressAlertButton('Manage Subscription');

    expect(mockOpenManageSubscriptions).toHaveBeenCalled();
    expect(mockAuth.deleteAccount).not.toHaveBeenCalled();
  });

  it('Delete Anyway runs the existing deletion flow', async () => {
    mockPurchases.plusActive = true;
    const tree = await render();
    await press(tree, 'Delete account');
    await pressAlertButton('Delete Anyway');

    expect(mockAuth.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('Cancel leaves the account alone', async () => {
    mockPurchases.plusActive = true;
    const tree = await render();
    await press(tree, 'Delete account');
    await pressAlertButton('Cancel');
    expect(mockAuth.deleteAccount).not.toHaveBeenCalled();
  });

  it('ignores a second tap while a deletion is already running', async () => {
    mockPurchases.plusActive = false;
    let resolveDeletion!: (value: { ok: true }) => void;
    mockAuth.deleteAccount = jest.fn(
      () =>
        new Promise<{ ok: true }>(resolve => {
          resolveDeletion = resolve;
        }),
    );

    const tree = await render();
    await press(tree, 'Delete account');
    await pressAlertButton('Delete Account');
    // Second confirmation arriving while the first is in flight (double tap,
    // stale alert) must not queue a second deletion.
    await pressAlertButton('Delete Account');

    expect(mockAuth.deleteAccount).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      resolveDeletion({ ok: true });
    });
  });
});

describe('You settings surface', () => {
  it('offers Manage Subscription as its own settings row', async () => {
    const tree = await render();
    const texts = textsOf(tree);
    expect(texts).toContain('Manage Subscription');

    await press(tree, 'Manage Subscription');
    expect(mockOpenManageSubscriptions).toHaveBeenCalled();
  });

  it('carries the full unofficial disclaimer and support contact in About', async () => {
    const texts = textsOf(await render());
    expect(
      texts.some(text =>
        text.includes(
          'PermitCoach is an independent educational study aid. It is not affiliated with, endorsed by, approved by, sponsored by, authorized by, or operated by any DMV or other government agency.',
        ),
      ),
    ).toBe(true);
    expect(texts).toContain('Privacy Policy');
    expect(texts).toContain('Terms of Use');
    expect(texts).toContain('Support');
    expect(texts).toContain('support@permitcoach.app');
  });
});
