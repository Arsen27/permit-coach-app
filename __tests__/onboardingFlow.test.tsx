import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import {
  LADDER_STEP_COUNT,
  ONBOARDING_FLOW,
  ONBOARDING_QUESTIONS,
  TEST_DATE_LADDER_INDEX,
  questionLadderIndex,
  showcaseLadderIndex,
  stepAfter,
} from '@/screens/onboarding/content';
import { OnboardingProvider } from '@/screens/onboarding/context';
import { pushNextStep } from '@/screens/onboarding/flow';
import QuestionScreen from '@/screens/onboarding/QuestionScreen';
import TestDateScreen from '@/screens/onboarding/TestDateScreen';
import { AccentId, defaultTheme, makeTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const push = jest.fn();
const navigation = { push } as never;

const renderStep = async (node: React.ReactNode): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <OnboardingProvider onDone={jest.fn()}>{node}</OnboardingProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const question = async (index: number): Promise<Renderer> =>
  renderStep(
    <QuestionScreen
      navigation={navigation}
      route={{ key: 'q', name: 'Question', params: { index } } as never}
    />,
  );

const textsOf = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => String(node.type) === 'Text' && node.children.length > 0)
    .map(node =>
      node.children
        .map(child => (typeof child === 'string' ? child : ''))
        .join(''),
    );

// Host-level only: styled-components forward props through several wrapper
// components, so a component-level search reports the same control 3× over.
const hostsWithRole = (tree: Renderer, role: string) =>
  tree.root.findAll(
    node =>
      typeof node.type === 'string' && node.props.accessibilityRole === role,
  );

// Pressable does not forward onPress to its host view, but it does merge
// `disabled` into accessibilityState — and the dock CTA is the only control
// on these steps that sets it.
const dockButton = (tree: Renderer) =>
  tree.root.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.accessibilityState?.disabled != null,
  )[0];

const pressable = (tree: Renderer, label: string) => {
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
  return targets[targets.length - 1];
};

const press = async (tree: Renderer, label: string): Promise<void> => {
  const target = pressable(tree, label);
  if (target == null) {
    throw new Error(`no pressable containing "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    target.props.onPress();
  });
};

beforeEach(() => {
  push.mockClear();
});

describe('onboarding flow definition', () => {
  it('opens with the state pick, then questions, date fifth, three showcases', () => {
    expect(ONBOARDING_QUESTIONS).toHaveLength(5);
    expect(LADDER_STEP_COUNT).toBe(10);
    expect(ONBOARDING_FLOW.map(step => step.route)).toEqual([
      'StateSelect',
      'Question',
      'Question',
      'Question',
      'Question',
      'TestDate',
      'Question',
      'Showcase',
      'Showcase',
      'Showcase',
    ]);
    // The date sits between "how prepared" and "how old", per the board.
    expect(TEST_DATE_LADDER_INDEX).toBe(5);
    expect(questionLadderIndex(4)).toBe(6);
    expect(showcaseLadderIndex(0)).toBe(7);
  });

  it('numbers every question the way its kicker claims', () => {
    const numbered = [1, 2, 3, 4, 6];
    ONBOARDING_QUESTIONS.forEach((entry, index) => {
      expect(entry.kicker).toBe(`About you · Question ${numbered[index]} of 6`);
    });
  });

  it('ends the ladder after the last showcase', () => {
    expect(stepAfter(LADDER_STEP_COUNT - 1)).toBeNull();
  });
});

describe('pushNextStep', () => {
  it('walks each route in order and leaves for the loader at the end', () => {
    pushNextStep(navigation, 0);
    expect(push).toHaveBeenLastCalledWith('Question', { index: 0 });

    pushNextStep(navigation, questionLadderIndex(3));
    expect(push).toHaveBeenLastCalledWith('TestDate');

    pushNextStep(navigation, TEST_DATE_LADDER_INDEX);
    expect(push).toHaveBeenLastCalledWith('Question', { index: 4 });

    pushNextStep(navigation, questionLadderIndex(4));
    expect(push).toHaveBeenLastCalledWith('Showcase', { index: 0 });

    pushNextStep(navigation, LADDER_STEP_COUNT - 1);
    expect(push).toHaveBeenLastCalledWith('Building');
  });
});

describe('QuestionScreen', () => {
  it('renders the first question as a single-choice list', async () => {
    const tree = await question(0);
    const texts = textsOf(tree);
    expect(texts).toContain('What brings you to the DMV?');
    expect(texts).toContain('This sets which rules we put first');
    expect(texts).toContain('Getting my first license');
    expect(texts).toContain('Something else');

    expect(hostsWithRole(tree, 'radio')).toHaveLength(5);
  });

  it('keeps Continue disabled until an option is picked', async () => {
    const tree = await question(0);
    expect(dockButton(tree).props.accessibilityState.disabled).toBe(true);
    await press(tree, 'Getting my first license');
    expect(dockButton(tree).props.accessibilityState.disabled).toBe(false);
  });

  it('replaces the previous answer on a single-choice question', async () => {
    const tree = await question(0);
    const checkedLabels = () =>
      hostsWithRole(tree, 'radio')
        .filter(node => node.props.accessibilityState?.checked === true)
        .map(node =>
          node
            .findAll(inner => String(inner.type) === 'Text')
            .flatMap(t => t.children.filter(c => typeof c === 'string'))
            .join(' '),
        );

    await press(tree, 'Getting my first license');
    expect(checkedLabels()).toEqual(['Getting my first license']);
    await press(tree, 'Renewing my license');
    expect(checkedLabels()).toEqual(['Renewing my license']);
  });

  it('advances to the date step after the fourth question', async () => {
    const tree = await question(3);
    expect(textsOf(tree)).toContain('How prepared do you feel right now?');
    // The level question carries a second line per option.
    expect(textsOf(tree)).toContain(
      'Signs and simple rules, but gaps elsewhere',
    );

    await press(tree, 'I know the basics');
    await press(tree, 'Continue');
    expect(push).toHaveBeenLastCalledWith('TestDate');
  });

  it('moves from the age question into the showcases', async () => {
    const tree = await question(4);
    expect(textsOf(tree)).toContain('How old are you?');
    await press(tree, '18 – 24');
    await press(tree, 'Continue');
    expect(push).toHaveBeenLastCalledWith('Showcase', { index: 0 });
  });
});

describe('option icon tints', () => {
  // The accent is a post-onboarding preference; these tiles also carry
  // meaning (red = failed, amber = warning), so they must not follow it.
  const iconColors = async (accentId: AccentId) => {
    let tree!: Renderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider theme={makeTheme(accentId, 'jakarta')}>
          <OnboardingProvider onDone={jest.fn()}>
            <QuestionScreen
              navigation={navigation}
              route={
                { key: 'q', name: 'Question', params: { index: 2 } } as never
              }
            />
          </OnboardingProvider>
        </ThemeProvider>,
      );
    });
    return tree.root
      .findAll(
        node =>
          typeof node.type !== 'string' &&
          (node.type as { name?: string }).name === 'Icon',
      )
      .map(node => node.props.color);
  };

  it('does not follow the theme accent', async () => {
    // Question 3's answers: neutral-blue, red, amber, green — none of which
    // is the emerald accent the app is themed with.
    const colors = await iconColors('emerald');
    expect(colors).toEqual(['#0485F7', '#EF4444', '#F59E0B', '#16A34A']);
    expect(colors).not.toContain(defaultTheme.colors.accent);
  });
});

describe('TestDateScreen', () => {
  const render = async () =>
    renderStep(
      <TestDateScreen
        navigation={navigation}
        route={{ key: 'd', name: 'TestDate' } as never}
      />,
    );

  it('asks for the booked date and blocks Continue until answered', async () => {
    const tree = await render();
    const texts = textsOf(tree);
    expect(texts).toContain('When is your test booked?');
    expect(texts).toContain('We pace your lessons to that date');
    expect(texts).toContain("My test isn't scheduled yet");

    expect(dockButton(tree).props.accessibilityState.disabled).toBe(true);
  });

  it('asks for notification permission before moving on', async () => {
    const notifee = require('@notifee/react-native').default;
    notifee.requestPermission.mockClear();
    notifee.getNotificationSettings.mockResolvedValue({
      authorizationStatus: -1,
    });

    const tree = await render();
    await press(tree, "My test isn't scheduled yet");
    await press(tree, 'Continue');

    expect(notifee.requestPermission).toHaveBeenCalled();
    expect(push).toHaveBeenLastCalledWith('Question', { index: 4 });
  });

  it('moves on even when the permission is refused', async () => {
    const notifee = require('@notifee/react-native').default;
    notifee.getNotificationSettings.mockRejectedValueOnce(
      new Error('native module missing'),
    );

    const tree = await render();
    await press(tree, "My test isn't scheduled yet");
    await press(tree, 'Continue');

    expect(push).toHaveBeenLastCalledWith('Question', { index: 4 });
  });

  it('accepts "not scheduled yet" as an answer and moves on', async () => {
    const tree = await render();
    await press(tree, "My test isn't scheduled yet");

    expect(
      hostsWithRole(tree, 'checkbox')[0].props.accessibilityState.checked,
    ).toBe(true);

    await press(tree, 'Continue');
    expect(push).toHaveBeenLastCalledWith('Question', { index: 4 });
  });

  it('uses the platform date picker rather than a hand-rolled wheel', async () => {
    const tree = await render();
    const pickers = tree.root.findAll(
      node =>
        typeof node.type !== 'string' &&
        (node.props.mode === 'date' ||
          String((node.type as { name?: string }).name) === 'AndroidField'),
    );
    expect(pickers.length).toBeGreaterThan(0);
  });
});
