'use client';

import { Buffer } from 'buffer';

/**
 * Node globals the Solana stack assumes exist.
 *
 * @solana/web3.js and the wallet adapters were written against Node and reach
 * for `Buffer` (and occasionally `process`) at runtime, deep inside code we do
 * not control. The browser has neither, so without this the wallet connects and
 * then every on-chain action — staking, unstaking, claiming royalties, buying an
 * asset — dies on "Buffer is not defined".
 *
 * A bundler ProvidePlugin only rewrites modules that name `Buffer` at build
 * time, which does not cover dependencies reaching for the global at runtime.
 * Assigning the real global is what actually holds, so this module is imported
 * for its side effect before any wallet code runs.
 */
if (typeof globalThis !== 'undefined') {
  // Cast through unknown: @types/node already declares these globals with full
  // Node shapes, and a browser shim only needs the handful of fields the Solana
  // stack actually touches.
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g.Buffer) g.Buffer = Buffer;
  if (!g.process) {
    g.process = { env: {}, browser: true, version: '', nextTick: (fn: () => void) => setTimeout(fn, 0) };
  }
}

export {};
