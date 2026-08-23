import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { brandLogoXml } from '@/assets/brandLogos';
import AuthScreen from '@/screens/AuthScreen';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));

const mockAuth = {
  supabaseEnabled: true,
  appleAvailable: true,
  googleAvailable: true,
  registerWithEmail: jest.fn(),
  signInWithEmail: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
};
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));

const render = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AuthScreen />
      </ThemeProvider>,
    );
  });
  return tree;
};

// SvgXml renders the markup it was handed; reading the prop back is enough to
// tell which logo landed in which button.
const svgXmls = (tree: Renderer): string[] =>
  tree.root
    .findAll(
      node =>
        typeof node.type !== 'string' && typeof node.props.xml === 'string',
    )
    .map(node => node.props.xml as string);

describe('social sign-in buttons', () => {
  it('shows the Apple and Google marks next to their labels', async () => {
    const tree = await render();
    const xmls = svgXmls(tree);
    expect(xmls).toContain(brandLogoXml.apple);
    expect(xmls).toContain(brandLogoXml.google);
  });

  it('keeps Google on its own four brand colours', async () => {
    // Recolouring the G would breach Google's brand terms, so the artwork
    // must carry literal fills and no currentColor.
    expect(brandLogoXml.google).toContain('#4285F4');
    expect(brandLogoXml.google).toContain('#34A853');
    expect(brandLogoXml.google).toContain('#FBBC05');
    expect(brandLogoXml.google).toContain('#EB4335');
    expect(brandLogoXml.google).not.toContain('currentColor');
  });

  it('lets the Apple glyph follow the button label', async () => {
    expect(brandLogoXml.apple).toContain('currentColor');

    const tree = await render();
    const apple = tree.root.findAll(
      node =>
        typeof node.type !== 'string' && node.props.xml === brandLogoXml.apple,
    )[0];
    expect(apple.props.color).toBe(defaultTheme.colors.ink);
  });

  it('drops the button of a provider that is unavailable', async () => {
    mockAuth.appleAvailable = false;
    const tree = await render();
    expect(svgXmls(tree)).not.toContain(brandLogoXml.apple);
    expect(svgXmls(tree)).toContain(brandLogoXml.google);
    mockAuth.appleAvailable = true;
  });
});
