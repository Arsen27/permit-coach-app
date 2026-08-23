import React from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrimaryButton from '@/components/PrimaryButton';
import {
  Sheet,
  SheetBody,
  SheetMark,
  SheetMiddle,
  SheetTitle,
} from '@/components/resultSheet';

// What a tap on "Restore purchases" actually did. Every one of the three gets
// said out loud: the native paywall reports a restore that granted nothing
// exactly like one that granted everything, so without this the button reads
// as broken whenever there is nothing to bring back.
export type RestoreOutcome = 'restored' | 'nothing' | 'failed';

const COPY: Record<
  RestoreOutcome,
  {
    tone: 'success' | 'neutral' | 'error';
    title: string;
    body: string;
    action: string;
  }
> = {
  restored: {
    tone: 'success',
    title: 'Purchases restored',
    body: 'Your PermitCoach Pro subscription is active on this device again. Everything is unlocked.',
    action: 'Continue',
  },
  nothing: {
    tone: 'neutral',
    title: 'Nothing to restore',
    body: 'This Apple ID has no PermitCoach subscription attached to it. If you subscribed with a different Apple ID, sign in to that one in Settings and try again.',
    action: 'Got it',
  },
  failed: {
    tone: 'error',
    title: 'Restore did not finish',
    body: 'The App Store could not be reached just now. Check your connection and try again in a moment.',
    action: 'Close',
  },
};

type RestoreResultModalProps = {
  outcome: RestoreOutcome | null;
  onDismiss: () => void;
};

const RestoreResultModal: React.FC<RestoreResultModalProps> = ({
  outcome,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  // Frozen while the modal animates away, so the copy does not flip to another
  // outcome on the way out.
  const shown = outcome ?? 'nothing';
  const copy = COPY[shown];

  return (
    <Modal
      visible={outcome != null}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Sheet style={{ paddingBottom: insets.bottom + 24 }}>
        <SheetMiddle>
          <SheetMark tone={copy.tone} />
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetBody>{copy.body}</SheetBody>
        </SheetMiddle>
        <View>
          <PrimaryButton label={copy.action} onPress={onDismiss} />
        </View>
      </Sheet>
    </Modal>
  );
};

export default RestoreResultModal;
