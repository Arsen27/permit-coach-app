import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { stepAfter } from './content';
import { OnboardingParamList } from './types';

// Only the push side is used here, so the route the caller sits on (which is
// what makes the full navigation prop route-specific) does not matter.
type StepNavigation = Pick<
  NativeStackNavigationProp<OnboardingParamList>,
  'push'
>;

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
    navigation.push('Building');
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
