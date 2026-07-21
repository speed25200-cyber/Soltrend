import { shuffledIndices, sha256Hex } from '@soltrend/shared';

/**
 * Provably-fair game-show elimination (battle-royale). Everyone buys in for the
 * SAME table stake, so it is a fair last-one-standing: a single seeded Fisher-
 * Yates shuffle fixes the elimination order before the show starts, and the
 * server reveals players one-eliminated-at-a-time for suspense. The last name in
 * the shuffle is the winner and takes the pot minus rake. Anyone can recompute
 * the exact order from (serverSeed, roundSeed, nonce) and the join order.
 */
export const commit = (serverSeed: string) => sha256Hex(serverSeed);

export const RAKE = 0.04;

/**
 * The elimination order (indices into the join-ordered player list). Players are
 * eliminated from the front; the final index is the winner. Reproducible from the
 * seeds alone.
 */
export function eliminationOrder(serverSeed: string, roundSeed: string, nonce: number, count: number): number[] {
  return shuffledIndices(count, serverSeed, roundSeed, nonce);
}

/** Winner's payout: whole pot (buyIn * players) minus the house rake. */
export function showdownPayout(buyIn: number, players: number): number {
  return Math.round(buyIn * players * (1 - RAKE) * 1000) / 1000;
}
