import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The admin renders lesson cards with the app's own React components, so the
// bundle resolves React Native to react-native-web and stubs the few native
// modules that graph touches (SVG rendering, safe-area insets, storage,
// the on-device picture files).

const here = import.meta.dirname;
const repoRoot = path.resolve(here, '..');

// Absolute, so files imported from outside admin/ (the shared app components)
// resolve to this one copy instead of being duplicated or missed.
const reactNativeWeb = path.resolve(
  here,
  'node_modules/react-native-web/dist/index.js',
);

// The shared app components live outside admin/, so without pinning they would
// pull React (and styled-components) from the app's own node_modules and end up
// with two copies of the hook dispatcher.
const dep = (name: string) => path.resolve(here, 'node_modules', name);

export default defineConfig({
  plugins: [react()],
  // Served by the content server under /admin, so every asset URL must say so.
  base: '/admin/',
  resolve: {
    alias: [
      { find: '@admin', replacement: path.resolve(here, 'src') },
      {
        find: 'react-native-svg',
        replacement: path.resolve(here, 'src/shims/react-native-svg.tsx'),
      },
      {
        find: 'react-native-safe-area-context',
        replacement: path.resolve(
          here,
          'src/shims/react-native-safe-area-context.tsx',
        ),
      },
      {
        find: '@react-native-async-storage/async-storage',
        replacement: path.resolve(here, 'src/shims/async-storage.ts'),
      },
      {
        find: 'react-native-blob-util',
        replacement: path.resolve(here, 'src/shims/react-native-blob-util.ts'),
      },
      { find: /^react-native$/, replacement: reactNativeWeb },
      { find: '@', replacement: path.resolve(repoRoot, 'src') },
      { find: /^react$/, replacement: dep('react') },
      { find: /^react-dom$/, replacement: dep('react-dom') },
      { find: /^styled-components$/, replacement: dep('styled-components') },
      {
        find: /^styled-components\/native$/,
        replacement: dep('styled-components/native'),
      },
    ],
    dedupe: ['react', 'react-dom', 'styled-components', 'react-native-web'],
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    global: 'globalThis',
  },
  server: {
    port: 5273,
    proxy: { '/v1': { target: 'http://localhost:8787', changeOrigin: true } },
    // The simulator loads the app's own font files from ../assets, which sits
    // outside Vite's default allow list — without this the dev server refuses
    // them and the phone falls back to system fonts.
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: path.resolve(repoRoot, 'server/admin-ui'),
    emptyOutDir: true,
  },
});
