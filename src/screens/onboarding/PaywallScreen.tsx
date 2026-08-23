import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Purchases, { PurchasesError } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { track } from '@/analytics';
import RestoreResultModal, {
  RestoreOutcome,
} from '@/components/RestoreResultModal';
import UnofficialDisclaimer from '@/components/UnofficialDisclaimer';
import { createLogger } from '@/lib/log';
import {
  PLUS_ENTITLEMENT_ID,
  REVENUECAT_VERBOSE_LOGGING,
} from '@/lib/revenueCatConfig';

import { OnboardingParamList } from './types';
import { StepScreen } from './ui';

type PaywallScreenProps = NativeStackScreenProps<
  OnboardingParamList,
  'Paywall'
>;

// Purchases made here run inside the paywall template, not through
// PurchasesProvider, so they carry their own source in the funnel.
const PURCHASE_SOURCE = 'onboarding_paywall';

const log = createLogger('paywall', REVENUECAT_VERBOSE_LOGGING);

const describeError = (error: PurchasesError | undefined) => ({
  code: error?.code,
  readable: error?.userInfo?.readableErrorCode,
  message: error?.message,
  // Where the real reason lives: code 23 is generic, and this carries
  // StoreKit's own complaint underneath it.
  underlying: error?.underlyingErrorMessage,
});

// The dashboard-configured paywall as a real onboarding step rather than a
// modal over one, so it inherits the stack's own push animation like every
// other step.
//
// This is a HARD gate: Plus is the only way past it. The close button is off,
// back is refused, and a failed or cancelled purchase leaves the learner
// exactly where they are. Only a completed purchase — or a restore that
// actually granted the entitlement — moves onboarding on.
//
// <RevenueCatUI.Paywall> is a native view host and drives the whole purchase
// flow itself; never call Purchases.purchasePackage from these callbacks.
const PaywallScreen: React.FC<PaywallScreenProps> = ({ navigation }) => {
  const settledRef = useRef(false);
  const insets = useSafeAreaInsets();
  // Every restore reports its outcome before anything moves. A restore that
  // granted nothing used to leave the screen untouched, which is why the
  // button read as broken.
  const [restoreOutcome, setRestoreOutcome] = useState<RestoreOutcome | null>(
    null,
  );

  useEffect(() => {
    track('paywall_presented', { source: 'onboarding' });

    // The paywall view fetches offerings itself but surfaces a failure only as
    // a bare native error code. This probe asks the same question out loud, so
    // the log separates the two things code 23 conflates: an offering that
    // arrived with no packages (nothing configured for this store) versus one
    // whose packages never resolved to store products (App Store refused).
    Purchases.getOfferings()
      .then(offerings => {
        const current = offerings.current;
        log.info('offerings fetched', {
          current: current?.identifier ?? null,
          available: Object.keys(offerings.all),
          packages: (current?.availablePackages ?? []).map(item => ({
            package: item.identifier,
            product: item.product.identifier,
            price: item.product.priceString,
          })),
        });
      })
      .catch(error => log.error('offerings failed', describeError(error)));
  }, []);

  // beforeRemove covers every retreat at once: the iOS swipe, the Android
  // hardware button, any stray goBack(). The replace() below is let through
  // because it only ever runs after settledRef is set.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (!settledRef.current) {
          event.preventDefault();
        }
      }),
    [navigation],
  );

  // onDismiss also fires on a successful purchase, so the first outcome to
  // arrive wins — otherwise replace() would run twice and the purchase would
  // report a second time.
  const unlock = useCallback(
    (result: string) => {
      if (settledRef.current) {
        return;
      }
      settledRef.current = true;
      log.info(`unlocked via ${result}`);
      track('paywall_closed', { source: 'onboarding', result });
      navigation.replace('Reminders');
    },
    [navigation],
  );

  return (
    <StepScreen>
      <RevenueCatUI.Paywall
        options={{ displayCloseButton: false }}
        onPurchaseCompleted={() => unlock('PURCHASED')}
        // A restore fires even when it granted nothing, so it opens the gate
        // only once Plus is actually on the account.
        onRestoreCompleted={({ customerInfo }) => {
          const granted =
            customerInfo.entitlements.active[PLUS_ENTITLEMENT_ID] != null;
          // Names every entitlement that did arrive, so a restore that looks
          // like it "did nothing" immediately shows whether the identifier is
          // simply spelled differently than PLUS_ENTITLEMENT_ID.
          log.info(`restore completed, ${PLUS_ENTITLEMENT_ID} granted`, {
            granted,
            active: Object.keys(customerInfo.entitlements.active),
          });
          track('purchase_restored', {
            source: PURCHASE_SOURCE,
            found: granted,
          });
          // The gate opens on dismissal, not here — the learner reads the
          // confirmation before the screen moves out from under it.
          setRestoreOutcome(granted ? 'restored' : 'nothing');
        }}
        // Nothing below navigates. Failures are recorded and the paywall stays
        // put — a cancelled purchase must not become a way in.
        onPurchaseCancelled={() => {
          log.info('purchase cancelled by the learner');
          track('purchase_failed', {
            source: PURCHASE_SOURCE,
            cancelled: true,
            reason: 'cancelled',
          });
        }}
        onPurchaseError={({ error }) => {
          log.error('purchase failed', describeError(error));
          track('purchase_failed', {
            source: PURCHASE_SOURCE,
            cancelled: false,
            reason: error?.message ?? 'unknown',
          });
        }}
        onRestoreError={({ error }) => {
          log.error('restore failed', describeError(error));
          track('purchase_restored', { source: PURCHASE_SOURCE, found: false });
          setRestoreOutcome('failed');
        }}
      />
      {/* Only the unofficial notice. Terms and Privacy belong to the paywall
          template's own footer row, beside Restore purchases — a second pair
          here put them on screen twice. Keep the two in step: the URLs the
          template opens are the ones in @/lib/legalLinks. */}
      <LegalFooter style={{ paddingBottom: insets.bottom + 10 }}>
        <UnofficialDisclaimer />
      </LegalFooter>

      <RestoreResultModal
        outcome={restoreOutcome}
        onDismiss={() => {
          const restored = restoreOutcome === 'restored';
          setRestoreOutcome(null);
          if (restored) {
            unlock('RESTORED');
          }
        }}
      />
    </StepScreen>
  );
};

const LegalFooter = styled.View`
  padding: 10px 25px 0;
  gap: 6px;
  background-color: ${({ theme }) => theme.colors.bg};
`;

export default PaywallScreen;
