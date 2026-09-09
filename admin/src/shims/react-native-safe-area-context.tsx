import React from 'react';

// The admin draws its own device chrome, so screens that ask for insets get
// zeros.

type Insets = { top: number; bottom: number; left: number; right: number };

const ZERO: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export const useSafeAreaInsets = (): Insets => ZERO;

export const SafeAreaProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => <>{children}</>;

export const SafeAreaView: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => <>{children}</>;
