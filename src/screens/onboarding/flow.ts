import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { stepAfter } from './content';
import { OnboardingParamList } from './types';

// Only the push side is used here, so the route the caller sits on (which is
// what makes the full navigation prop route-specific) does not matter.
type StepNavigation = Pick<
  NativeStackNavigationProp<OnboardingParamList>,
  'push' | 'getState'
>;

// push() unconditionally adds an instance, so two quick taps on the same
// Continue button used to stack the next screen twice — most visibly the
// course loader, which the learner could then swipe back out of. Navigation
// state updates synchronously on dispatch, so the second tap sees the first
// push already sitting on top and walks away.
const alreadyOnTop = (
  navigation: StepNavigation,
  name: keyof OnboardingParamList,
  index?: number,
): boolean => {
  const routes = navigation.getState()?.routes ?? [];
  const top = routes[routes.length - 1];
  return (
    top?.name === name &&
    (top.params as { index?: number } | undefined)?.index === index
  );
};

// Advances from a ladder position to whatever ONBOARDING_FLOW says comes
// next, or into the course loader once the ladder is finished. Keeping this
// in one place means reordering the flow is a content edit, not a hunt
// through screens for hard-coded successors.
export const pushNextStep = (
  navigation: StepNavigation,
  position: number,
): void => {
  const next = stepAfter(position);
  if (next == null) {
    if (!alreadyOnTop(navigation, 'Building')) {
      navigation.push('Building');
    }
    return;
  }
  const index =
    next.route === 'Question' || next.route === 'Showcase'
      ? next.index
      : undefined;
  if (alreadyOnTop(navigation, next.route, index)) {
    return;
  }
  switch (next.route) {
    case 'StateSelect':
      navigation.push('StateSelect');
      return;
    case 'Question':
      navigation.push('Question', { index: next.index });
      return;
    case 'TestDate':
      navigation.push('TestDate');
      return;
    case 'Showcase':
      navigation.push('Showcase', { index: next.index });
  }
};
