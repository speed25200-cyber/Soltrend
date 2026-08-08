import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * The engine test suite runs in plain Node against the exact modules the app
 * ships — no mocks of the maths, no reimplementation. Anything that decides how
 * much money moves is expected to be covered here.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The edge simulations run hundreds of thousands of rounds.
    testTimeout: 120_000,
  },
});
