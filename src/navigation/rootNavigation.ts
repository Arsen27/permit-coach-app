import { createNavigationContainerRef } from '@react-navigation/native';

import { RootStackParamList } from './types';

// Root container ref for navigating from outside the screen tree (the daily
// streak gate). NavigationContainer in App.tsx holds it.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
