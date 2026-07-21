import { crashPoint, commit, liveMultiplier } from './crash';

/**
 * Co-op "Heist" — a shared crash run with a cooperative twist. The whole crew
 * rides ONE provably-fair multiplier that climbs in real time; each member grabs
 * their loot (locks the current multiplier) before the shared bust. What makes it
 * co-op: a slice of every ante feeds a crew vault that is only paid out — split
 * among the crew — if EVERY member grabs before the bust. One person busting
 * forfeits the bonus for everyone, so the crew is pulling for each other.
 *
 * Edge-safety: the crash edge lives in the bust distribution (same curve as the
 * Crash rooms); the crew vault is pure redistribution of player antes, never
 * house exposure.
 */
export { commit, liveMultiplier };

export const VAULT_CUT = 0.05;

export const heistBust = (serverSeed: string, roundSeed: string, nonce: number, edge = 0.02) =>
  crashPoint(serverSeed, roundSeed, nonce, edge);

/** The crash stake portion of an ante (the rest funds the crew vault). */
export const stakeOf = (ante: number) => Math.round(ante * (1 - VAULT_CUT) * 1000) / 1000;

/** The pooled crew vault from a set of antes. */
export const crewVault = (antes: number[]) => Math.round(antes.reduce((s, a) => s + a, 0) * VAULT_CUT * 1000) / 1000;

/**
 * A member's payout. `lockedM` is the multiplier they grabbed at (0 = busted).
 * `allGrabbed` triggers the shared vault split across `crewSize` survivors.
 */
export function heistPayout(ante: number, lockedM: number, allGrabbed: boolean, vault: number, crewSize: number): number {
  if (lockedM <= 0) return 0; // busted
  const base = stakeOf(ante) * lockedM;
  const bonus = allGrabbed && crewSize > 0 ? vault / crewSize : 0;
  return Math.round((base + bonus) * 1000) / 1000;
}
