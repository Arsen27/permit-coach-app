import React from 'react';
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

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockAuth = {
  signedIn: false,
  hasAccount: false,
  email: null as string | null,
  logOut: jest.fn(),
  deleteAccount: jest.fn(),
};
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/purchases/PurchasesProvider', () => ({
  usePurchases: () => ({
    isPlus: false,
    purchasesEnabled: false,
    presentPaywall: jest.fn(),
    restore: jest.fn(),
  }),
}));

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
  mockNavigate.mockClear();
  mockAuth.signedIn = false;
  mockAuth.email = null;
});

describe('YouScreen account section (signed out)', () => {
  it('offers both signing up and signing in', async () => {
    const tree = await render();
    const texts = textsOf(tree);
    expect(texts).toContain('Sign up');
    expect(texts).toContain('I already have an account');
  });

  it('opens the form on its sign-in side for a returning learner', async () => {
    const tree = await render();
    await press(tree, 'I already have an account');
    expect(mockNavigate).toHaveBeenLastCalledWith('Auth', { mode: 'signIn' });
  });

  it('opens the form on its sign-up side from the primary button', async () => {
    const tree = await render();
    await press(tree, 'Sign up');
    expect(mockNavigate).toHaveBeenLastCalledWith('Auth', { mode: 'signUp' });
  });
});

describe('YouScreen account section (signed in)', () => {
  it('drops both auth entry points once there is an account', async () => {
    mockAuth.signedIn = true;
    mockAuth.email = 'ada@example.com';
    const tree = await render();
    const texts = textsOf(tree);
    expect(texts).toContain('ada@example.com');
    expect(texts).not.toContain('Sign up');
    expect(texts).not.toContain('I already have an account');
  });
});
