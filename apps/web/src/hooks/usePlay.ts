'use client';

import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import type { BetRecord } from '@/lib/store';
import type { Template } from '@/lib/games';
import { sfx } from '@/lib/sound';
import { burstJackpot, burstWin } from '@/lib/fx';

export interface BetGuard {
  ok: boolean;
  reason?: string;
}

interface SeedsSnapshot {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/**
 * Central betting guard + settlement. Every game funnels through here so that
 * balance checks, responsible-gaming limits and self-exclusion are enforced
 * uniformly — exactly one code path can move funds.
 */
export function usePlay() {
  const { connected } = useWallet();
  const balance = useCasino((s) => s.balance);
  const rg = useCasino((s) => s.rg);
  const sessionLossToday = useCasino((s) => s.sessionLossToday);
  const nextNonce = useCasino((s) => s.nextNonce);
  const settleBet = useCasino((s) => s.settleBet);
  const recordProgress = useCasino((s) => s.recordProgress);

  const guard = useCallback(
    (bet: number): BetGuard => {
      if (!connected) return { ok: false, reason: 'Connect your wallet to play' };
      if (rg.selfExcludedUntil && rg.selfExcludedUntil > Date.now())
        return { ok: false, reason: 'Self-exclusion active — see Profile' };
      if (bet <= 0) return { ok: false, reason: 'Enter a bet amount' };
      if (bet > balance) return { ok: false, reason: 'Insufficient balance' };
      if (rg.maxBet && bet > rg.maxBet) return { ok: false, reason: `Max bet limit is ${rg.maxBet} SOL` };
      if (rg.dailyLossLimit && sessionLossToday >= rg.dailyLossLimit)
        return { ok: false, reason: 'Daily loss limit reached — take a break' };
      return { ok: true };
    },
    [connected, balance, rg, sessionLossToday],
  );

  /** Increment the nonce and return the seed snapshot for this bet/round. */
  const reserveSeeds = useCallback((): SeedsSnapshot => {
    sfx.bet();
    return nextNonce();
  }, [nextNonce]);

  /** Commit a finished bet to the ledger (atomic debit/credit + history). */
  const settle = useCallback(
    (args: {
      game: string;
      template: Template;
      bet: number;
      multiplier: number;
      payout: number;
      win: boolean;
      meta?: Record<string, unknown>;
      seeds: SeedsSnapshot;
    }) => {
      const rec: Omit<BetRecord, 'id' | 'ts' | 'serverSeed' | 'serverSeedHash' | 'clientSeed' | 'nonce'> & {
        seeds: SeedsSnapshot;
      } = {
        game: args.game,
        template: args.template,
        bet: args.bet,
        multiplier: args.multiplier,
        payout: args.payout,
        win: args.win,
        meta: args.meta,
        seeds: args.seeds,
      };
      settleBet(rec);

      // Progression + feedback (the community + feel layer).
      const events = recordProgress({ bet: args.bet, win: args.win, payout: args.payout, key: args.game });
      if (args.win && args.payout > args.bet) {
        sfx.win(args.multiplier);
        burstWin(args.multiplier);
      } else if (!args.win) {
        sfx.loss();
      }
      if (events.jackpotWon > 0) {
        sfx.jackpot();
        burstJackpot(events.jackpotWon);
      }
      if (events.leveledUp) window.setTimeout(() => sfx.levelUp(), 260);
    },
    [settleBet, recordProgress],
  );

  return { connected, balance, guard, reserveSeeds, settle };
}
