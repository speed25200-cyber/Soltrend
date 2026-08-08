'use client';

/**
 * Test-drive credits.
 *
 * Demo mode runs the *real* engine — same seed chain, same paytable, same house
 * edge — and only skips the ledger. Nothing here touches the wallet, the vault,
 * the history, progression or the jackpot. It exists so a creator can actually
 * play the game they are building before publishing it, and so a player can try
 * a community game before staking on it.
 *
 * The balance lives in a store rather than in `usePlay` so the surrounding UI
 * (the studio's test-drive bar) can read the running stats and reset the session
 * without the game component having to plumb them outwards.
 */

import { create } from 'zustand';

/** Pretend bankroll handed to every demo session. */
export const DEMO_CREDITS = 50;

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export interface DemoState {
  balance: number;
  /** Rounds played this session. */
  spins: number;
  wagered: number;
  returned: number;
  /** Biggest multiplier seen — the number creators actually want from a test. */
  best: number;
  wins: number;
  apply: (bet: number, payout: number, multiplier: number) => void;
  reset: () => void;
}

const EMPTY = { balance: DEMO_CREDITS, spins: 0, wagered: 0, returned: 0, best: 0, wins: 0 };

export const useDemo = create<DemoState>((set) => ({
  ...EMPTY,
  apply: (bet, payout, multiplier) =>
    set((s) => ({
      balance: round4(s.balance - bet + payout),
      spins: s.spins + 1,
      wagered: round4(s.wagered + bet),
      returned: round4(s.returned + payout),
      best: Math.max(s.best, multiplier),
      wins: s.wins + (payout > bet ? 1 : 0),
    })),
  reset: () => set({ ...EMPTY }),
}));

/** Observed return-to-player so far, or null before the first round. */
export function demoRtp(s: Pick<DemoState, 'wagered' | 'returned'>): number | null {
  return s.wagered > 0 ? s.returned / s.wagered : null;
}
