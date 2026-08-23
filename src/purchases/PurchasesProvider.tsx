import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Purchases, {
  CustomerInfo,
  PurchasesError,
} from 'react-native-purchases';

import { track } from '@/analytics';
import { useAuth } from '@/auth/AuthProvider';
import { PLUS_ENTITLEMENT_ID } from '@/lib/revenueCatConfig';
import { LOCAL_USER_ID } from '@/sync/types';
import { ensureRevenueCatConfigured, isRevenueCatConfigured } from './client';

export { isRevenueCatConfigured } from './client';

export type PurchaseResult =
  | { ok: true }
  | { ok: false; message: string; cancelled?: boolean };

type PurchasesValue = {
  purchasesEnabled: boolean;
  // null = unknown (SDK not configured / no info yet) — callers fall back to
  // the server-mirrored profiles.plan.
  plusActive: boolean | null;
  purchasePlus: () => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
};

const PurchasesContext = createContext<PurchasesValue | null>(null);

const hasPlus = (info: CustomerInfo): boolean =>
  info.entitlements.active[PLUS_ENTITLEMENT_ID] != null;

const purchaseFailure = (error: unknown): PurchaseResult => {
  const purchasesError = error as PurchasesError;
  if (purchasesError?.userCancelled) {
    return { ok: false, message: 'Purchase cancelled.', cancelled: true };
  }
  return {
    ok: false,
    message:
      purchasesError?.message ?? 'Something went wrong. Please try again.',
  };
};

// Entitlement state as last reported, so only real transitions are sent. At
// module scope for the same reason sdkConfigured is: one value per launch.
// The first known value is the baseline, not a change — a subscriber opening
// the app has not just subscribed.
let lastPlusActive: boolean | null = null;

const notePlusStatus = (active: boolean): void => {
  const isFirst = lastPlusActive == null;
  if (lastPlusActive === active) {
    return;
  }
  lastPlusActive = active;
  if (!isFirst) {
    track('plus_status_changed', { active });
  }
};

// Purchases started from code rather than from the RevenueCat paywall UI,
// which reports itself through the paywall_* events.
const PURCHASE_SOURCE = 'direct';

type PurchasesProviderProps = {
  children: React.ReactNode;
};

// Sits directly under AuthProvider (NOT keyed on userId — the SDK must be
// configured once) and mirrors the Supabase user id into RevenueCat, so the
// same appUserID follows the user through anonymous → registered and across
// devices. The `plus` entitlement read here is the UI's source of truth;
// profiles.plan is only the server-side mirror written by the webhook.
export const PurchasesProvider: React.FC<PurchasesProviderProps> = ({
  children,
}) => {
  const { userId } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    if (!isRevenueCatConfigured) {
      return;
    }
    ensureRevenueCatConfigured(userId === LOCAL_USER_ID ? null : userId);
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [userId]);

  useEffect(() => {
    if (!isRevenueCatConfigured) {
      return;
    }
    let active = true;
    // The update listener above only fires when the native SDK reports a
    // change — configure() never replays the cached state — so the current
    // entitlements have to be pulled in explicitly on launch, or plusActive
    // would sit at null for every already-subscribed learner.
    //
    // For a signed-in learner that pull is logIn: it is a no-op when already
    // identified as this user, transfers the anonymous RevenueCat customer on
    // first identification, and hands back the info in the same round trip.
    const request =
      userId === LOCAL_USER_ID
        ? Purchases.getCustomerInfo()
        : Purchases.logIn(userId).then(result => result.customerInfo);
    request
      .then(info => {
        if (active) {
          setCustomerInfo(info);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  const purchasePlus = useCallback(async (): Promise<PurchaseResult> => {
    if (!isRevenueCatConfigured) {
      return { ok: false, message: 'Purchases are not configured yet.' };
    }
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages[0];
      if (pkg == null) {
        track('purchase_failed', {
          source: PURCHASE_SOURCE,
          cancelled: false,
          reason: 'no-package',
        });
        return { ok: false, message: 'No subscription is available yet.' };
      }
      track('purchase_started', {
        product_id: pkg.product.identifier,
        source: PURCHASE_SOURCE,
      });
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      if (!hasPlus(info)) {
        track('purchase_failed', {
          source: PURCHASE_SOURCE,
          cancelled: false,
          reason: 'entitlement-missing',
        });
        return { ok: false, message: 'Purchase did not unlock Plus.' };
      }
      track('purchase_completed', {
        product_id: pkg.product.identifier,
        source: PURCHASE_SOURCE,
      });
      return { ok: true };
    } catch (error) {
      const result = purchaseFailure(error);
      track('purchase_failed', {
        source: PURCHASE_SOURCE,
        cancelled: result.ok ? false : result.cancelled === true,
        reason: result.ok ? '' : result.message,
      });
      return result;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    if (!isRevenueCatConfigured) {
      return { ok: false, message: 'Purchases are not configured yet.' };
    }
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const found = hasPlus(info);
      track('purchase_restored', { source: PURCHASE_SOURCE, found });
      return found
        ? { ok: true }
        : { ok: false, message: 'No previous purchases found.' };
    } catch (error) {
      return purchaseFailure(error);
    }
  }, []);

  // Any entitlement transition, whoever caused it: a purchase in this app, a
  // renewal, a lapse, or a restore on another device arriving through the
  // customer-info listener.
  useEffect(() => {
    if (customerInfo != null) {
      notePlusStatus(hasPlus(customerInfo));
    }
  }, [customerInfo]);

  const value = useMemo<PurchasesValue>(
    () => ({
      purchasesEnabled: isRevenueCatConfigured,
      plusActive: customerInfo == null ? null : hasPlus(customerInfo),
      purchasePlus,
      restorePurchases,
    }),
    [customerInfo, purchasePlus, restorePurchases],
  );

  return (
    <PurchasesContext.Provider value={value}>
      {children}
    </PurchasesContext.Provider>
  );
};

export const usePurchases = (): PurchasesValue => {
  const value = useContext(PurchasesContext);
  if (value == null) {
    throw new Error('usePurchases must be used within a PurchasesProvider');
  }
  return value;
};
