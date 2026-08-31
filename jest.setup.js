/* eslint-env jest */
// async-storage v3 ships no jest mock — an in-memory implementation of the
// API surface the app uses (call AsyncStorage.clear() between tests).
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(key => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key, value) => {
        store[key] = String(value);
        return Promise.resolve();
      }),
      removeItem: jest.fn(key => {
        delete store[key];
        return Promise.resolve();
      }),
      getMany: jest.fn(keys =>
        Promise.resolve(
          Object.fromEntries(keys.map(key => [key, store[key] ?? null])),
        ),
      ),
      setMany: jest.fn(entries => {
        Object.assign(store, entries);
        return Promise.resolve();
      }),
      removeMany: jest.fn(keys => {
        keys.forEach(key => delete store[key]);
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

// The Liquid Glass TurboModule only exists in a real native runtime.
jest.mock('@callstack/liquid-glass', () => {
  const { View } = require('react-native');
  return { LiquidGlassView: View, isLiquidGlassSupported: false };
});

jest.mock('react-native-url-polyfill/auto', () => ({}));

// Native device info: only the build's version string is read (appVersion.ts).
// Kept a valid semver so the release check behaves like a real build in tests.
jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: { getVersion: jest.fn(() => '1.2.0') },
}));

// Notifee is a native module; onboarding only needs the permission answer.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
  default: {
    getNotificationSettings: jest.fn(() =>
      Promise.resolve({ authorizationStatus: -1 }),
    ),
    requestPermission: jest.fn(() =>
      Promise.resolve({ authorizationStatus: 1 }),
    ),
  },
}));

// Supabase client, mocked at the SDK boundary: no session, benign no-op auth.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signInAnonymously: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null }),
      ),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: {}, error: null }),
      ),
      signInWithIdToken: jest.fn(() =>
        Promise.resolve({ data: {}, error: null }),
      ),
      updateUser: jest.fn(() =>
        Promise.resolve({ data: { user: null }, error: null }),
      ),
      verifyOtp: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null }),
      ),
      resetPasswordForEmail: jest.fn(() =>
        Promise.resolve({ data: {}, error: null }),
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}));

// Native auth/keychain modules don't exist in the jest runtime.
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock' },
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    isSupported: false,
    Operation: { LOGIN: 1 },
    Scope: { EMAIL: 0, FULL_NAME: 1 },
    performRequest: jest.fn(() => Promise.reject(new Error('not supported'))),
  },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  LOG_LEVEL: {
    VERBOSE: 'VERBOSE',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    ERROR: 'ERROR',
  },
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    showManageSubscriptions: jest.fn(() => Promise.resolve()),
    logIn: jest.fn(() =>
      Promise.resolve({ customerInfo: { entitlements: { active: {} } } }),
    ),
    logOut: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    getCustomerInfo: jest.fn(() =>
      Promise.resolve({ entitlements: { active: {} } }),
    ),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(() =>
      Promise.resolve({ entitlements: { active: {} } }),
    ),
  },
}));

jest.mock('react-native-purchases-ui', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      // The native paywall host view, as a plain View like the other native
      // view mocks.
      Paywall: View,
      presentPaywall: jest.fn(() => Promise.resolve('CANCELLED')),
      presentPaywallIfNeeded: jest.fn(() => Promise.resolve('NOT_PRESENTED')),
    },
  };
});

// The community date-time picker is a native view; render a plain View.
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

// PostHog: analytics is off in the jest runtime anyway (see analytics/client),
// but the SDK still pulls in native device/locale modules on import. Mocked at
// the package boundary so nothing has to be transformed or linked.
jest.mock('posthog-react-native', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: jest.fn(),
    PostHogProvider: ({ children }) => children,
    usePostHog: () => undefined,
    useFeatureFlag: () => undefined,
    // A plain View, like the real one: screens wrap it in styled(), so it has
    // to take a style prop.
    PostHogMaskView: View,
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'cancelled', data: null })),
  },
}));

// react-native-blob-util is a native file-system module; an in-memory fs
// stands in for it. Files remember their write encoding so `hash` digests
// the true bytes. Downloads go through `globalThis.__blobDownload`, which a
// test sets to serve bodies; without it the network simply fails.
jest.mock('react-native-blob-util', () => {
  const files = {};
  const digest = path => {
    const file = files[path];
    if (file == null) {
      return Promise.reject(new Error(`no such file ${path}`));
    }
    const sha = require('./src/lib/sha256');
    const { base64ToBytes } = require('./src/lib/base64');
    return Promise.resolve(
      file.encoding === 'base64'
        ? sha.sha256HexOfBytes(base64ToBytes(file.data))
        : sha.sha256Hex(file.data),
    );
  };
  const api = {
    fs: {
      dirs: { DocumentDir: '/docs' },
      mkdir: jest.fn(() => Promise.resolve()),
      ls: jest.fn(dir =>
        Promise.resolve(
          Object.keys(files)
            .filter(key => key.startsWith(`${dir}/`))
            .map(key => key.slice(dir.length + 1)),
        ),
      ),
      exists: jest.fn(path => Promise.resolve(files[path] != null)),
      writeFile: jest.fn((path, data, encoding) => {
        files[path] = { data, encoding: encoding ?? 'utf8' };
        return Promise.resolve();
      }),
      readFile: jest.fn((path, encoding) => {
        const file = files[path];
        if (file == null) {
          return Promise.reject(new Error(`no such file ${path}`));
        }
        return Promise.resolve(file.data);
      }),
      unlink: jest.fn(path => {
        delete files[path];
        Object.keys(files).forEach(key => {
          if (key.startsWith(`${path}/`)) {
            delete files[key];
          }
        });
        return Promise.resolve();
      }),
      mv: jest.fn((from, to) => {
        if (files[from] == null) {
          return Promise.reject(new Error(`no such file ${from}`));
        }
        files[to] = files[from];
        delete files[from];
        return Promise.resolve();
      }),
      hash: jest.fn(path => digest(path)),
    },
    config: jest.fn(options => ({
      fetch: async (_method, url) => {
        const handler = globalThis.__blobDownload;
        if (handler == null) {
          throw new TypeError('Network request failed');
        }
        const result = await handler(url);
        if (result.status === 200) {
          files[options.path] = {
            data: result.body,
            encoding: result.encoding ?? 'utf8',
          };
        }
        return { info: () => ({ status: result.status }) };
      },
    })),
    __reset: () => {
      Object.keys(files).forEach(key => delete files[key]);
      delete globalThis.__blobDownload;
    },
  };
  return { __esModule: true, default: api, ...api };
});
