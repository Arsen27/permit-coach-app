import { create } from 'zustand';

// Who is signed into the panel. Two modes, decided by the server:
//   - supabase: e-mail + password against the project's auth, the resulting
//     JWT goes to /v1/admin as a Bearer; the server checks its allowlist.
//   - token: the shared admin token, for setups without Supabase.
// In development with nothing configured the panel runs open.

type AuthConfig = {
  mode: 'open' | 'token' | 'supabase';
  tokenFallback: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
};

const SESSION_KEY = 'permitcoach.adminSession';
const TOKEN_KEY = 'permitcoach.adminToken';

const loadSession = (): Session | null => {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored == null ? null : (JSON.parse(stored) as Session);
  } catch {
    return null;
  }
};

type AuthState = {
  config: AuthConfig | null;
  session: Session | null;
  manualToken: string;
  error: string | null;
  busy: boolean;
  load: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  useToken: (token: string) => void;
  logout: () => void;
  // The Bearer for the next request, refreshed when close to expiry.
  bearer: () => Promise<string>;
  authenticated: () => boolean;
};

export const useAuth = create<AuthState>((set, get) => ({
  config: null,
  session: loadSession(),
  manualToken: localStorage.getItem(TOKEN_KEY) ?? '',
  error: null,
  busy: false,

  load: async () => {
    try {
      const response = await fetch('/v1/admin/auth-config');
      set({ config: (await response.json()) as AuthConfig });
    } catch {
      set({ config: { mode: 'open', tokenFallback: false } });
    }
  },

  login: async (email, password) => {
    const { config } = get();
    if (config?.mode !== 'supabase' || config.supabaseUrl == null) {
      return false;
    }
    set({ busy: true, error: null });
    try {
      const response = await fetch(
        `${config.supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.supabaseAnonKey ?? '',
          },
          body: JSON.stringify({ email, password }),
        },
      );
      const body = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        user?: { email?: string };
        error_description?: string;
        msg?: string;
      };
      if (!response.ok || body.access_token == null) {
        set({
          busy: false,
          error: body.error_description ?? body.msg ?? 'Sign-in failed',
        });
        return false;
      }
      const session: Session = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? '',
        expiresAt: body.expires_at ?? Math.floor(Date.now() / 1000) + 3000,
        email: body.user?.email ?? email,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      set({ session, busy: false });
      return true;
    } catch (error) {
      set({ busy: false, error: (error as Error).message });
      return false;
    }
  },

  useToken: token => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ manualToken: token, error: null });
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    set({ session: null, manualToken: '' });
  },

  bearer: async () => {
    const { session, manualToken, config } = get();
    if (manualToken.length > 0) {
      return manualToken;
    }
    if (session == null) {
      return '';
    }
    // Refresh a minute early; on failure the session is dropped and the login
    // screen returns.
    if (session.expiresAt * 1000 - Date.now() > 60_000) {
      return session.accessToken;
    }
    if (config?.supabaseUrl == null) {
      return session.accessToken;
    }
    try {
      const response = await fetch(
        `${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.supabaseAnonKey ?? '',
          },
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        },
      );
      const body = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
      };
      if (body.access_token == null) {
        throw new Error('refresh failed');
      }
      const next: Session = {
        ...session,
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? session.refreshToken,
        expiresAt: body.expires_at ?? session.expiresAt + 3000,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      set({ session: next });
      return next.accessToken;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      set({ session: null });
      return '';
    }
  },

  authenticated: () => {
    const { config, session, manualToken } = get();
    if (config == null) {
      return false;
    }
    if (config.mode === 'open') {
      return true;
    }
    return session != null || manualToken.length > 0;
  },
}));
