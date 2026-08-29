module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-svg|react-native-safe-area-context|react-native-screens|@callstack/liquid-glass|@react-native-async-storage|@supabase|react-native-url-polyfill|react-native-keychain|@invertase/react-native-apple-authentication|@react-native-google-signin|react-native-purchases|@revenuecat)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The server and the admin SPA have their own runners (node --test in
  // server/, `npm run smoke` in admin/).
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/server/',
    '<rootDir>/admin/',
    // Shared test data, not suites.
    '<rootDir>/__tests__/fixtures/',
  ],
};
