import React, { useEffect, useSyncExternalStore } from 'react';

import { signsStore } from './store';
import type { SignsCatalog } from './store';

// Same shape as CourseProvider: no context, just useSyncExternalStore over
// the module-level store plus a hydrate side effect. Screens that render the
// catalogue call useSignsCatalog() — often just to subscribe — so a committed
// signs update re-renders them in place.

export const useSignsCatalog = (): SignsCatalog =>
  useSyncExternalStore(signsStore.subscribe, signsStore.getSnapshot);

type SignsProviderProps = {
  children: React.ReactNode;
};

export const SignsProvider: React.FC<SignsProviderProps> = ({ children }) => {
  useEffect(() => {
    signsStore.hydrate().catch(() => undefined);
  }, []);
  return <>{children}</>;
};
