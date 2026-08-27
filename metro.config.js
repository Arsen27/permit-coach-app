const path = require('node:path');

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// admin/ is the web content admin — its own bundler owns it, and it carries a
// second copy of React that Metro must never pick up.
const config = {
  resolver: {
    blockList: [new RegExp(`^${path.resolve(__dirname, 'admin')}/.*`)],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
