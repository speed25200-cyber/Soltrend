import { firstFloat, sha256Hex } from '@soltrend/shared';

/**
 * Provably-fair crash point. The server commits to sha256(serverSeed) BEFORE the
 * round, then reveals serverSeed AFTER the bust — anyone can recompute the exact
 * crash point from (serverSeed, roundSeed, nonce) and verify the hash. The house
 * edge is baked into the curve; the tail is unbounded up to `cap`.
 */
export function crashPoint(serverSeed: string, roundSeed: string, nonce: number, edge = 0.02, cap = 1000): number {
  const u = firstFloat(serverSeed, roundSeed, nonce); // uniform in [0,1)
  if (u >= 0.999999) return cap;
  const raw = (1 - edge) / (1 - u);
  return Math.max(1, Math.min(cap, Math.floor(raw * 100) / 100));
}

export const commit = (serverSeed: string) => sha256Hex(serverSeed);

/** The live multiplier at `elapsedMs` into the running phase (exponential climb). */
export function liveMultiplier(elapsedMs: number): number {
  const m = Math.pow(Math.E, 0.00007 * elapsedMs);
  return Math.max(1, Math.floor(m * 100) / 100);
}

/** Inverse: how long until the multiplier reaches `target` (ms). */
export function msToReach(target: number): number {
  return Math.log(Math.max(1, target)) / 0.00007;
}
