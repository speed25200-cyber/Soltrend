import { firstFloat, sha256Hex } from '@soltrend/shared';

/**
 * Provably-fair 1v1 duel. Before the duel the server commits to
 * sha256(serverSeed); after it reveals serverSeed, so either player can
 * recompute the exact outcome from (serverSeed, matchSeed, nonce) and verify the
 * hash. The winner is chosen by a single uniform draw split by the pot-weighted
 * win chance — with equal antes it is a fair coin, and the house rake is the only
 * edge. Winner takes the pot minus rake.
 */
export const commit = (serverSeed: string) => sha256Hex(serverSeed);

export const RAKE = 0.02;

/**
 * Resolve a duel. Returns the index (0 or 1) of the winning player and the
 * uniform draw used, so the result is fully reconstructible. With equal antes
 * `threshold` is 0.5; unequal antes weight the odds by stake (bigger ante, bigger
 * chance) so expected value stays neutral before rake.
 */
export function resolveDuel(
  serverSeed: string,
  matchSeed: string,
  nonce: number,
  anteA: number,
  anteB: number,
): { winner: 0 | 1; draw: number; threshold: number } {
  const draw = firstFloat(serverSeed, matchSeed, nonce);
  const total = anteA + anteB;
  const threshold = total > 0 ? anteA / total : 0.5;
  return { winner: draw < threshold ? 0 : 1, draw, threshold };
}

/** Winner's payout: the whole pot minus the house rake. */
export function duelPayout(anteA: number, anteB: number): number {
  return Math.round((anteA + anteB) * (1 - RAKE) * 1000) / 1000;
}
