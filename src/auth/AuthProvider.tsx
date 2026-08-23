import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState as RNAppState, Platform } from 'react-native';

import { appleAuth } from '@invertase/react-native-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';

import { forgetIdentity, requestAccountErasure, track } from '@/analytics';
import { createLogger } from '@/lib/log';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@/lib/supabaseConfig';
import { detachRevenueCatIdentity } from '@/purchases/client';
import {
  migrateLocalDataToUser,
  stageAdoptFromUser,
} from '@/sync/pendingStore';
import { LOCAL_USER_ID } from '@/sync/types';

const LAST_USER_KEY = 'dmv-prep/last-user-id';

const log = createLogger('auth');

export type AuthResult = { ok: true } | { ok: false; message: string };

// Registering is two-phase whenever the project confirms email addresses: the
// code goes out first and the password only lands once the address is proven.
// `needsVerification: false` is the confirmation-off project taking one step.
export type RegisterResult =
  | { ok: true; needsVerification: boolean }
  | { ok: false; message: string };

export type EmailRegistration = {
  email: string;
  password: string;
  name: string;
};

// What the code screen submits, for either flow it serves: the emailed code
// and the password it unlocks (the one chosen at sign-up, or the new one
// replacing a forgotten password).
export type EmailCodeSubmission = {
  email: string;
  code: string;
  password: string;
};

type AuthValue = {
  // Supabase user id, or LOCAL_USER_ID before the first successful sign-in.
  userId: string;
  email: string | null;
  // Display name from the identity provider (Google/Apple user_metadata),
  // null for email/anonymous users. The app adopts it into the profile once.
  identityName: string | null;
  // Has a real (non-anonymous) identity attached.
  signedIn: boolean;
  // A live Supabase session exists — anonymous ones included. This is what
  // "there is an account to delete" means; before the first (possibly
  // offline) sign-in there is nothing on the server to erase.
  hasAccount: boolean;
  supabaseEnabled: boolean;
  appleAvailable: boolean;
  googleAvailable: boolean;
  registerWithEmail: (details: EmailRegistration) => Promise<RegisterResult>;
  // Second phase: the 6-digit code from the email, plus the password held on
  // the form since the first phase (the server refuses it any earlier).
  confirmEmailCode: (details: EmailCodeSubmission) => Promise<AuthResult>;
  resendEmailCode: (details: {
    email: string;
    name: string;
  }) => Promise<AuthResult>;
  // Forgotten password: the same code-then-password shape, on the one flow
  // that works without a session to start from.
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  confirmPasswordReset: (details: EmailCodeSubmission) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  logOut: () => Promise<void>;
  // App Store guideline 5.1.1(v): accounts must be deletable in-app.
  deleteAccount: () => Promise<AuthResult>;
  // Drives the overlay that covers the deletion: 'deleting' from the first
  // server call until the session is gone, then 'deleted' until the learner
  // dismisses the confirmation.
  deletionState: DeletionState;
  acknowledgeDeletion: () => void;
};

export type DeletionState = 'idle' | 'deleting' | 'deleted';

const AuthContext = createContext<AuthValue | null>(null);

// Typed to the failing arm alone, so it stands in for both AuthResult and
// RegisterResult without widening either.
const failure = (
  error: { message?: string } | null,
): { ok: false; message: string } => ({
  ok: false,
  message: error?.message ?? 'Something went wrong. Please try again.',
});

const appleSupported = (): boolean => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return appleAuth.isSupported;
  } catch {
    // Native module missing (pods not installed yet) — hide the button.
    return false;
  }
};

let googleConfigured = false;
const configureGoogle = (): void => {
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    });
    googleConfigured = true;
  }
};

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // null until the cached user id is read — a fast local-storage read, never
  // gated on the network.
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [deletionState, setDeletionState] = useState<DeletionState>('idle');
  const userIdRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  // Switches the app to a (possibly new) authenticated user. First switch
  // away from LOCAL_USER_ID hands the pre-auth data over via adopt-staging.
  const adoptUser = useCallback(async (uid: string) => {
    const prev = userIdRef.current;
    if (prev === uid) {
      return;
    }
    if (prev === LOCAL_USER_ID) {
      await migrateLocalDataToUser(LOCAL_USER_ID);
    } else if (prev != null) {
      // The session changed away from a real user without an explicit
      // sign-in staging it (stale keychain session falling back to a new
      // anonymous user, a backup-restored install with a dead session, or a
      // provider sign-in landing on a different id). Carry the previous
      // user's local progress over instead of stranding it — the monotonic
      // merge makes this safe, and explicit sign-ins staging the same
      // snapshot earlier are idempotent.
      await stageAdoptFromUser(prev);
    }
    await AsyncStorage.setItem(LAST_USER_KEY, uid).catch(() => undefined);
    userIdRef.current = uid;
    setUserId(uid);
  }, []);

  const ensureAnonymousSession = useCallback(async () => {
    if (supabase == null || sessionRef.current != null) {
      return;
    }
    // Failure (offline, rate limit) is fine: the app keeps working under the
    // current id; we retry on the next foreground.
    await supabase.auth.signInAnonymously().catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      const cached = await AsyncStorage.getItem(LAST_USER_KEY).catch(
        () => null,
      );
      if (active && userIdRef.current == null) {
        userIdRef.current = cached ?? LOCAL_USER_ID;
        setUserId(userIdRef.current);
      }
      if (supabase == null) {
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session == null) {
        await ensureAnonymousSession();
      }
    };
    boot();
    return () => {
      active = false;
    };
  }, [ensureAnonymousSession]);

  useEffect(() => {
    if (supabase == null) {
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession != null) {
        adoptUser(nextSession.user.id);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [adoptUser]);

  // Retry anonymous sign-in when the app comes back to the foreground with no
  // session (first launch happened offline, or the rate limit was hit).
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', status => {
      if (status === 'active') {
        ensureAnonymousSession();
      }
    });
    return () => sub.remove();
  }, [ensureAnonymousSession]);

  // Supabase refuses a password until the address behind it is verified, so
  // this is always the last step of registering — never part of the call that
  // sends the code.
  const applyPassword = useCallback(
    async (password: string): Promise<AuthResult> => {
      if (supabase == null) {
        return failure(null);
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        track('auth_failed', {
          method: 'email',
          mode: 'password',
          reason: error.message,
        });
        return failure(error);
      }
      return { ok: true };
    },
    [],
  );

  const registerWithEmail = useCallback(
    async ({
      email,
      password,
      name,
    }: EmailRegistration): Promise<RegisterResult> => {
      if (supabase == null) {
        return failure(null);
      }
      track('auth_attempted', { method: 'email', mode: 'register' });
      // Converts the current anonymous user in place — same user id, all
      // synced progress carries over. The name rides along in user_metadata,
      // which (unlike the address) applies without confirmation; IdentityNameSync
      // then adopts it into the profile.
      const { data, error } = await supabase.auth.updateUser({
        email,
        data: { full_name: name },
      });
      if (error) {
        track('auth_failed', {
          method: 'email',
          mode: 'register',
          reason: error.message,
        });
        return failure(error);
      }
      // A project with "Confirm email" off converts in one step: the address
      // is already on the user and no code was ever sent. Finish here instead
      // of parking on a verification screen no email can clear.
      if (data.user?.new_email == null && data.user?.email === email) {
        // Says out loud what is otherwise invisible from the app side: the
        // learner just registered on an address nobody proved they own.
        log.warn(
          'registered without confirmation — Supabase "Confirm email" is off ' +
            '(auth/v1/settings reports mailer_autoconfirm: true)',
        );
        const applied = await applyPassword(password);
        if (!applied.ok) {
          return applied;
        }
        track('auth_succeeded', { method: 'email', mode: 'register' });
        return { ok: true, needsVerification: false };
      }
      return { ok: true, needsVerification: true };
    },
    [applyPassword],
  );

  // The shared tail of both code flows. A code can only be spent once, so the
  // address already sitting on the session is taken as proof it was accepted:
  // that makes retrying a failed password step — the one path that could
  // otherwise strand an account with no way back in — safe.
  const verifyAndSetPassword = useCallback(
    async (
      { email, code, password }: EmailCodeSubmission,
      type: 'email_change' | 'recovery',
    ): Promise<AuthResult> => {
      if (supabase == null) {
        return failure(null);
      }
      if (sessionRef.current?.user.email !== email) {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type,
        });
        if (error) {
          track('auth_failed', {
            method: 'email',
            mode: 'verify',
            reason: error.message,
          });
          return failure(error);
        }
      }
      return applyPassword(password);
    },
    [applyPassword],
  );

  const confirmEmailCode = useCallback(
    async (details: EmailCodeSubmission): Promise<AuthResult> => {
      track('auth_attempted', { method: 'email', mode: 'verify' });
      const result = await verifyAndSetPassword(details, 'email_change');
      if (result.ok) {
        track('auth_succeeded', { method: 'email', mode: 'register' });
      }
      return result;
    },
    [verifyAndSetPassword],
  );

  // Works from the anonymous session every install already has — no sign-in
  // required, which is the whole point of a forgotten password.
  const sendPasswordReset = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (supabase == null) {
        return failure(null);
      }
      track('auth_attempted', { method: 'email', mode: 'reset' });
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        track('auth_failed', {
          method: 'email',
          mode: 'reset',
          reason: error.message,
        });
        return failure(error);
      }
      return { ok: true };
    },
    [],
  );

  const confirmPasswordReset = useCallback(
    async (details: EmailCodeSubmission): Promise<AuthResult> => {
      if (supabase == null || userIdRef.current == null) {
        return failure(null);
      }
      track('auth_attempted', { method: 'email', mode: 'resetVerify' });
      // Recovery lands on whichever user owns the address, which is rarely
      // the anonymous one asking. Stage the local progress first so the merge
      // carries it over, exactly as signing in does.
      await stageAdoptFromUser(userIdRef.current);
      const result = await verifyAndSetPassword(details, 'recovery');
      if (result.ok) {
        track('auth_succeeded', { method: 'email', mode: 'reset' });
      }
      return result;
    },
    [verifyAndSetPassword],
  );

  // Re-issuing the same email change is what sends a fresh code; auth-js's
  // `resend()` covers sign-up and magic-link tokens, not this one.
  const resendEmailCode = useCallback(
    async ({
      email,
      name,
    }: {
      email: string;
      name: string;
    }): Promise<AuthResult> => {
      if (supabase == null) {
        return failure(null);
      }
      track('auth_attempted', { method: 'email', mode: 'resend' });
      const { error } = await supabase.auth.updateUser({
        email,
        data: { full_name: name },
      });
      if (error) {
        track('auth_failed', {
          method: 'email',
          mode: 'resend',
          reason: error.message,
        });
        return failure(error);
      }
      return { ok: true };
    },
    [],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (supabase == null || userIdRef.current == null) {
        return failure(null);
      }
      track('auth_attempted', { method: 'email', mode: 'signIn' });
      // Stage current progress: if this lands on a different user id, the
      // next hydration merges it in (adopt-and-merge).
      await stageAdoptFromUser(userIdRef.current);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        track('auth_failed', {
          method: 'email',
          mode: 'signIn',
          reason: error.message,
        });
        return failure(error);
      }
      track('auth_succeeded', { method: 'email', mode: 'signIn' });
      return { ok: true };
    },
    [],
  );

  const signInWithApple = useCallback(async (): Promise<AuthResult> => {
    if (supabase == null || userIdRef.current == null) {
      return failure(null);
    }
    track('auth_attempted', { method: 'apple', mode: 'signIn' });
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      if (response.identityToken == null) {
        track('auth_failed', {
          method: 'apple',
          mode: 'signIn',
          reason: 'cancelled',
        });
        return failure({ message: 'Apple sign-in was cancelled.' });
      }
      await stageAdoptFromUser(userIdRef.current);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: response.identityToken,
        nonce: response.nonce,
      });
      if (error) {
        track('auth_failed', {
          method: 'apple',
          mode: 'signIn',
          reason: error.message,
        });
        return failure(error);
      }
      track('auth_succeeded', { method: 'apple', mode: 'signIn' });
      // Apple sends the name only on the very first authorization and never
      // again — persist it into user_metadata right away, best-effort.
      const fullName = [
        response.fullName?.givenName,
        response.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (fullName.length > 0) {
        await supabase.auth
          .updateUser({ data: { full_name: fullName } })
          .catch(() => undefined);
      }
      return { ok: true };
    } catch (error) {
      // A real cancel also lands here; the log tells them apart.
      log.warn('Apple sign-in failed', error);
      track('auth_failed', {
        method: 'apple',
        mode: 'signIn',
        reason: 'cancelled-or-error',
      });
      return failure({ message: 'Apple sign-in was cancelled.' });
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (supabase == null || userIdRef.current == null) {
      return failure(null);
    }
    track('auth_attempted', { method: 'google', mode: 'signIn' });
    try {
      configureGoogle();
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success' || response.data.idToken == null) {
        track('auth_failed', {
          method: 'google',
          mode: 'signIn',
          reason: 'cancelled',
        });
        return failure({ message: 'Google sign-in was cancelled.' });
      }
      await stageAdoptFromUser(userIdRef.current);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      });
      if (error) {
        track('auth_failed', {
          method: 'google',
          mode: 'signIn',
          reason: error.message,
        });
        return failure(error);
      }
      track('auth_succeeded', { method: 'google', mode: 'signIn' });
      return { ok: true };
    } catch (error) {
      // A real cancel also lands here; the log tells them apart.
      log.warn('Google sign-in failed', error);
      track('auth_failed', {
        method: 'google',
        mode: 'signIn',
        reason: 'cancelled-or-error',
      });
      return failure({ message: 'Google sign-in was cancelled.' });
    }
  }, []);

  // The session teardown both logging out and deleting an account share. Kept
  // event-free so account deletion does not report a sign-out for a learner
  // whose analytics are being erased in the same breath.
  const clearSession = useCallback(async () => {
    await supabase?.auth.signOut().catch(() => undefined);
    // Drop to a fresh zero state immediately; a new anonymous session (and
    // user id) replaces it as soon as the network allows.
    await AsyncStorage.removeItem(LAST_USER_KEY).catch(() => undefined);
    userIdRef.current = LOCAL_USER_ID;
    setUserId(LOCAL_USER_ID);
    setSession(null);
    await ensureAnonymousSession();
  }, [ensureAnonymousSession]);

  const logOut = useCallback(async () => {
    if (supabase == null) {
      return;
    }
    track('auth_signed_out');
    await clearSession();
  }, [clearSession]);

  // App Store guideline 5.1.1(v): deleting the account has to take the
  // learner's data with it. That means the analytics person too — the events,
  // the person properties (email, name) and the session recordings.
  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (supabase == null) {
      return failure(null);
    }
    // Raised before the first server call and lowered only by the learner, so
    // the double AppStateProvider remount underneath is never on screen.
    setDeletionState('deleting');
    // Captured before the account goes. The token stays cryptographically
    // valid for the rest of its lifetime once the auth.users row is deleted,
    // and it is what proves to the server whose person may be erased.
    const accessToken = sessionRef.current?.access_token ?? null;

    const { error } = await supabase.rpc('delete_account');
    if (error) {
      setDeletionState('idle');
      track('auth_account_deletion_failed', { reason: error.message });
      return failure(error);
    }

    // Do not let the fresh anonymous Supabase user become an alias of the
    // RevenueCat customer that the server has just queued for erasure.
    const revenueCatDetached = await detachRevenueCatIdentity();
    if (!revenueCatDetached) {
      log.warn('RevenueCat identity was not detached after account deletion');
    }

    // Order matters: flush and drop the identity first, so nothing sent from
    // here on (including the queue that was already waiting) lands on the
    // person the server is about to delete and quietly recreates it.
    await forgetIdentity();
    if (accessToken != null) {
      const nudgeAccepted = await requestAccountErasure(accessToken);
      if (!nudgeAccepted) {
        // The database job already exists, so a lost nudge is not a lost
        // deletion request. The Railway worker will claim it independently.
        // Deliberately do not report this to PostHog and recreate the person.
        log.warn('account erasure remains queued for the background worker');
      }
    }

    await clearSession();
    setDeletionState('deleted');
    return { ok: true };
  }, [clearSession]);

  const acknowledgeDeletion = useCallback(() => setDeletionState('idle'), []);

  const value = useMemo<AuthValue | null>(() => {
    if (userId == null) {
      return null;
    }
    const user = session?.user;
    const metadataName = [
      user?.user_metadata?.full_name,
      user?.user_metadata?.name,
    ].find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    );
    return {
      userId,
      email: user?.email ?? null,
      identityName: metadataName?.trim() ?? null,
      signedIn: user != null && (user.is_anonymous !== true || !!user.email),
      hasAccount: user != null,
      supabaseEnabled: isSupabaseConfigured,
      appleAvailable: isSupabaseConfigured && appleSupported(),
      googleAvailable: isSupabaseConfigured && GOOGLE_WEB_CLIENT_ID.length > 0,
      registerWithEmail,
      confirmEmailCode,
      resendEmailCode,
      sendPasswordReset,
      confirmPasswordReset,
      signInWithEmail,
      signInWithApple,
      signInWithGoogle,
      logOut,
      deleteAccount,
      deletionState,
      acknowledgeDeletion,
    };
  }, [
    userId,
    session,
    registerWithEmail,
    confirmEmailCode,
    resendEmailCode,
    sendPasswordReset,
    confirmPasswordReset,
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
    logOut,
    deleteAccount,
    deletionState,
    acknowledgeDeletion,
  ]);

  // One fast AsyncStorage read gates this — same latency class as the state
  // hydration that AppStateProvider already waits for.
  if (value == null) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext);
  if (value == null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return value;
};
