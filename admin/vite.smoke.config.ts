import path from 'node:path';

import { defineConfig, mergeConfig } from 'vite';

import base from './vite.config';

// Builds the renderer gate as a single self-executing bundle so it can be run
// in a real DOM (jsdom) rather than only type-checked or linked.

export default mergeConfig(
  base,
  defineConfig({
    // lib builds skip Vite's automatic NODE_ENV substitution.
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir: path.resolve(import.meta.dirname, '.smoke'),
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: path.resolve(
          import.meta.dirname,
          process.env.SMOKE_ENTRY ?? 'scripts/smokeEntry.tsx',
        ),
        formats: ['iife'],
        name: 'AdminSmoke',
        fileName: () => process.env.SMOKE_OUT ?? 'smoke.js',
      },
    },
  }),
);
