import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import AuthScreen from '@/screens/AuthScreen';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));

const mockAuth = {
  supabaseEnabled: true,
  appleAvailable: false,
  googleAvailable: false,
  registerWithEmail: jest.fn(),
  confirmEmailCode: jest.fn(),
  resendEmailCode: jest.fn(),
  sendPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
  signInWithEmail: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
};
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));

// The resend cooldown runs on an interval, so a tree left mounted keeps
// ticking into the next test — and past the teardown.
const mounted: Renderer[] = [];

afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(tree => tree.unmount());
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.registerWithEmail.mockResolvedValue({
    ok: true,
    needsVerification: true,
  });
  mockAuth.confirmEmailCode.mockResolvedValue({ ok: true });
  mockAuth.resendEmailCode.mockResolvedValue({ ok: true });
  mockAuth.sendPasswordReset.mockResolvedValue({ ok: true });
  mockAuth.confirmPasswordReset.mockResolvedValue({ ok: true });
});

const render = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AuthScreen />
      </ThemeProvider>,
    );
  });
  mounted.push(tree);
  return tree;
};

// Password inputs carry no native placeholder — iOS would render it in the
// wrong font — so they are addressed by the accessibility label instead.
const inputs = (tree: Renderer, label: string) =>
  tree.root.findAll(
    node =>
      typeof node.type === 'string' &&
      (node.props.placeholder === label ||
        node.props.accessibilityLabel === label),
  );

const fieldByPlaceholder = (tree: Renderer, placeholder: string) =>
  inputs(tree, placeholder)[0];

const hasField = (tree: Renderer, placeholder: string): boolean =>
  inputs(tree, placeholder).length > 0;

// Host text nodes are the only place the screen states which step it is on.
const texts = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => typeof node.type === 'string' && node.props.children)
    .flatMap(node =>
      typeof node.props.children === 'string' ? [node.props.children] : [],
    );

const pressables = (tree: Renderer) =>
  tree.root.findAll(
    node =>
      typeof node.type !== 'string' && typeof node.props.onPress === 'function',
  );

// Buttons are addressed by the label a learner would read on them, so the
// tests break when the wording drifts rather than when the tree is reshaped.
const press = async (tree: Renderer, label: string) => {
  const target = pressables(tree).find(
    node =>
      node.props.accessibilityLabel === label ||
      node.findAll(
        child =>
          typeof child.type === 'string' && child.props.children === label,
      ).length > 0,
  );
  if (target == null) {
    throw new Error(`no pressable labelled "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    target.props.onPress();
  });
};

const type = async (tree: Renderer, placeholder: string, value: string) => {
  await ReactTestRenderer.act(async () => {
    fieldByPlaceholder(tree, placeholder).props.onChangeText(value);
  });
};

const CODE_PLACEHOLDER = '——————';

const fillSignUpForm = async (tree: Renderer) => {
  await type(tree, 'Name', 'Casey Rivera');
  await type(tree, 'Email', ' casey@example.com ');
  await type(tree, 'Password', 'longenough1');
};

describe('sign-up form', () => {
  it('asks for a name when signing up and drops the field when logging in', async () => {
    const tree = await render();
    expect(hasField(tree, 'Name')).toBe(true);

    await press(tree, 'Log in');

    expect(hasField(tree, 'Name')).toBe(false);
  });

  it('refuses to send a code until the name is filled in', async () => {
    const tree = await render();
    await type(tree, 'Email', 'casey@example.com');
    await type(tree, 'Password', 'longenough1');
    await press(tree, 'Sign up');

    expect(mockAuth.registerWithEmail).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Enter your name.');
  });

  it('passes the trimmed name and email on to registration', async () => {
    const tree = await render();
    await fillSignUpForm(tree);
    await press(tree, 'Sign up');

    expect(mockAuth.registerWithEmail).toHaveBeenCalledWith({
      name: 'Casey Rivera',
      email: 'casey@example.com',
      password: 'longenough1',
    });
  });
});

describe('email confirmation step', () => {
  it('moves to the code step instead of closing the modal', async () => {
    const tree = await render();
    await fillSignUpForm(tree);
    await press(tree, 'Sign up');

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Confirm your email');
    expect(texts(tree)).toContain(
      'We sent a 6-digit code to casey@example.com. Enter it to finish creating your account.',
    );
  });

  it('confirms on the sixth digit, carrying the password the form held', async () => {
    const tree = await render();
    await fillSignUpForm(tree);
    await press(tree, 'Sign up');
    await type(tree, CODE_PLACEHOLDER, '123456');

    expect(mockAuth.confirmEmailCode).toHaveBeenCalledWith({
      code: '123456',
      email: 'casey@example.com',
      password: 'longenough1',
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('ignores anything that is not a digit and stops at six', async () => {
    const tree = await render();
    await fillSignUpForm(tree);
    await press(tree, 'Sign up');
    await type(tree, CODE_PLACEHOLDER, '12ab34');

    expect(mockAuth.confirmEmailCode).not.toHaveBeenCalled();
    expect(fieldByPlaceholder(tree, CODE_PLACEHOLDER).props.value).toBe('1234');
  });

  it('keeps the learner on the code step when the code is wrong', async () => {
    mockAuth.confirmEmailCode.mockResolvedValue({
      ok: false,
      message: 'Token has expired or is invalid',
    });
    const tree = await render();
    await fillSignUpForm(tree);
    await press(tree, 'Sign up');
    await type(tree, CODE_PLACEHOLDER, '000000');

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Token has expired or is invalid');
    expect(texts(tree)).toContain('Confirm your email');
  });

  it('holds the resend link on a cooldown so taps cannot outrun the mail', async () => {
    const tree = await render();
    await fillSignUpForm(tree);
    await press(tree, 'Sign up');

    expect(texts(tree)).toContain('Resend code in 45s');
    expect(mockAuth.resendEmailCode).not.toHaveBeenCalled();
  });

  it('skips the code step for a project that does not confirm emails', async () => {
    mockAuth.registerWithEmail.mockResolvedValue({
      ok: true,
      needsVerification: false,
    });
    const tree = await render();
    await fillSignUpForm(tree);
    await press(tree, 'Sign up');

    expect(mockGoBack).toHaveBeenCalled();
    expect(texts(tree)).not.toContain('Confirm your email');
  });
});

describe('password reset', () => {
  // Reaching the reset flow always starts the same way: log-in side, address
  // typed, link tapped.
  const startReset = async (tree: Renderer, email = 'casey@example.com') => {
    await press(tree, 'Log in');
    await type(tree, 'Email', email);
    await press(tree, 'Forgot password?');
  };

  it('offers the link only on the log-in side', async () => {
    const tree = await render();
    expect(texts(tree)).not.toContain('Forgot password?');

    await press(tree, 'Log in');

    expect(texts(tree)).toContain('Forgot password?');
  });

  it('needs the address before it can send anything', async () => {
    const tree = await render();
    await press(tree, 'Log in');
    await press(tree, 'Forgot password?');

    expect(mockAuth.sendPasswordReset).not.toHaveBeenCalled();
    expect(texts(tree)).toContain(
      'Enter your email first, then tap Forgot password.',
    );
  });

  it('sends the code and asks for a new password alongside it', async () => {
    const tree = await render();
    await startReset(tree);

    expect(mockAuth.sendPasswordReset).toHaveBeenCalledWith(
      'casey@example.com',
    );
    expect(texts(tree)).toContain('Reset your password');
    expect(hasField(tree, CODE_PLACEHOLDER)).toBe(true);
    expect(hasField(tree, 'New password')).toBe(true);
  });

  it('does not fire on the sixth digit, since the password is still missing', async () => {
    const tree = await render();
    await startReset(tree);
    await type(tree, CODE_PLACEHOLDER, '123456');

    expect(mockAuth.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('holds out for a password long enough to be accepted', async () => {
    const tree = await render();
    await startReset(tree);
    await type(tree, CODE_PLACEHOLDER, '123456');
    await type(tree, 'New password', 'short');
    await press(tree, 'Set new password');

    expect(mockAuth.confirmPasswordReset).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Password must be at least 8 characters.');
  });

  it('submits the code with the new password and closes on success', async () => {
    const tree = await render();
    await startReset(tree);
    await type(tree, CODE_PLACEHOLDER, '123456');
    await type(tree, 'New password', 'brandnew123');
    await press(tree, 'Set new password');

    expect(mockAuth.confirmPasswordReset).toHaveBeenCalledWith({
      code: '123456',
      email: 'casey@example.com',
      password: 'brandnew123',
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('never reuses the login password the learner already got wrong', async () => {
    const tree = await render();
    await press(tree, 'Log in');
    await type(tree, 'Email', 'casey@example.com');
    await type(tree, 'Password', 'theforgottenone');
    await press(tree, 'Forgot password?');

    expect(fieldByPlaceholder(tree, 'New password').props.value).toBe('');
  });

  it('resends through the reset endpoint, not the sign-up one', async () => {
    const tree = await render();
    await startReset(tree);
    // The cooldown gates the link, so this is the resend that must not fire.
    await press(tree, 'Resend code in 45s');

    expect(mockAuth.resendEmailCode).not.toHaveBeenCalled();
    expect(mockAuth.sendPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('goes back to the form with the address kept when the inbox is wrong', async () => {
    const tree = await render();
    await startReset(tree);
    await press(tree, 'Use a different email');

    expect(hasField(tree, 'Email')).toBe(true);
    expect(fieldByPlaceholder(tree, 'Email').props.value).toBe(
      'casey@example.com',
    );
  });
});
