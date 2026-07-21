import { firstFloat, sha256Hex } from '@soltrend/shared';

/**
 * Provably-fair shared jackpot (community raffle). Every player who enters a
 * round buys tickets equal to their contribution; when the window closes the
 * server draws one uniform value and walks the weighted ticket list to pick the
 * winner. Commit-reveal (sha256(serverSeed) before, serverSeed after) makes the
 * draw verifiable: anyone can recompute the winning position from the pot order.
 * Winner takes the pot minus a small rake.
 */
export const commit = (serverSeed: string) => sha256Hex(serverSeed);

export const RAKE = 0.03;

export interface Entry {
  wallet: string;
  amount: number;
}

/**
 * Pick the winning entry. `draw` is a uniform in [0,1) mapped onto the pot: each
 * entry owns a slice proportional to its stake, so win chance == pot share.
 * Returns the winner index and the draw for reconstruction.
 */
export function drawWinner(
  serverSeed: string,
  roundSeed: string,
  nonce: number,
  entries: Entry[],
): { winner: number; draw: number; pot: number } {
  const pot = entries.reduce((s, e) => s + e.amount, 0);
  const draw = firstFloat(serverSeed, roundSeed, nonce);
  if (pot <= 0 || entries.length === 0) return { winner: -1, draw, pot: 0 };
  let cursor = draw * pot;
  for (let i = 0; i < entries.length; i++) {
    cursor -= entries[i].amount;
    if (cursor < 0) return { winner: i, draw, pot };
  }
  return { winner: entries.length - 1, draw, pot };
}

/** Winner's payout: the whole pot minus the house rake. */
export function jackpotPayout(pot: number): number {
  return Math.round(pot * (1 - RAKE) * 1000) / 1000;
}
