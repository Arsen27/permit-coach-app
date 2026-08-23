import { isAnalyticsConfigured } from '@/lib/analyticsConfig';
import { createLogger } from '@/lib/log';
import { SERVER_URL } from '@/lib/serverConfig';

// Nudging the durable account-erasure queue after in-app account deletion.
//
// The delete_account RPC has already queued the Supabase user id atomically.
// This call asks Railway to process it immediately; if the request is lost,
// the server worker retries the same job later. Provider secrets never enter
// the app bundle.

const log = createLogger('analytics');

// Deliberately gated on the key being configured rather than on events
// actually being sent: a dev build with analytics muted still has to be able
// to erase the person a production build created on that account.
const canErase = isAnalyticsConfigured && SERVER_URL.length > 0;

export const requestAccountErasure = async (
  accessToken: string,
): Promise<boolean> => {
  if (!canErase) {
    return true;
  }
  try {
    const response = await fetch(`${SERVER_URL}/v1/account/erasure`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      log.warn(`account erasure nudge rejected: ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    log.warn('account erasure nudge failed', error);
    return false;
  }
};
