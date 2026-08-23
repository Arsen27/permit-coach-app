import React from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider } from 'styled-components/native';

import { useAuth } from '@/auth/AuthProvider';
import PrimaryButton from '@/components/PrimaryButton';
import {
  Sheet,
  SheetBody,
  SheetMark,
  SheetMiddle,
  SheetTitle,
} from '@/components/resultSheet';
import { defaultTheme } from '@/theme';

// Deleting an account tears the signed-in user down and builds a fresh
// anonymous one, so the user id AppStateProvider is keyed on changes twice.
// Each change remounts the whole navigator, and the onboarding-flag gate in
// ThemedApp renders nothing while it re-reads storage — which is the flicker.
//
// This is mounted outside that keyed subtree and so survives both remounts,
// which makes it the one thing on screen for the whole operation. It carries
// its own ThemeProvider for the same reason: the themed tree it would
// otherwise inherit from is exactly the part being torn down.
const AccountDeletionOverlay: React.FC = () => {
  const { deletionState, acknowledgeDeletion } = useAuth();
  const insets = useSafeAreaInsets();
  const done = deletionState === 'deleted';

  return (
    <Modal
      visible={deletionState !== 'idle'}
      animationType="fade"
      // Nothing dismisses this by hand. Mid-teardown there is no coherent
      // screen to return to, and the confirmation is a receipt worth reading.
      onRequestClose={() => undefined}
    >
      <ThemeProvider theme={defaultTheme}>
        <Sheet style={{ paddingBottom: insets.bottom + 24 }}>
          <SheetMiddle>
            {done ? (
              <>
                <SheetMark tone="success" />
                <SheetTitle>Account deleted</SheetTitle>
                <SheetBody>
                  Your account and everything synced with it are gone for good.
                  PermitCoach has started over with a clean slate on this
                  device.
                </SheetBody>
              </>
            ) : (
              <>
                <ActivityIndicator
                  size="large"
                  color={defaultTheme.colors.dim}
                />
                <SheetTitle>Deleting your account</SheetTitle>
                <SheetBody>
                  Removing your account and synced study progress from our
                  servers. This only takes a moment.
                </SheetBody>
              </>
            )}
          </SheetMiddle>

          {/* Held in place rather than shown and hidden, so the sheet does not
              resize when the spinner gives way to the confirmation. Opacity
              alone would still swallow taps — an invisible control has to be
              taken out of the touch path too, not just dimmed. */}
          <View
            pointerEvents={done ? 'auto' : 'none'}
            style={{ opacity: done ? 1 : 0 }}
          >
            <PrimaryButton
              label="Done"
              onPress={acknowledgeDeletion}
              disabled={!done}
            />
          </View>
        </Sheet>
      </ThemeProvider>
    </Modal>
  );
};

export default AccountDeletionOverlay;
