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
 * balance checks, responsible-gaming limits, self-exclusion and the per-game
 * bankroll cap are enforced uniformly — exactly one code path can move funds.
 *
 * `maxBet` is the game's bankroll-relative ceiling (bankroll / RUIN_K / maxWin,
 * also enforced on-chain). Passing it here rather than re-implementing the check
 * per game is what keeps a community game from being drained by one lucky round:
 * a game that forgets the check simply cannot exist.
 */
export function usePlay(maxBet?: number) {
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
      if (maxBet != null && bet > maxBet) return { ok: false, reason: `Max bet ◎${maxBet} — this game's bankroll cap` };
      if (rg.dailyLossLimit && sessionLossToday >= rg.dailyLossLimit)
        return { ok: false, reason: 'Daily loss limit reached — take a break' };
      return { ok: true };
    },
    [connected, balance, rg, sessionLossToday, maxBet],
  );

  /** Increment the nonce and return the seed snapshot for this bet/round. */
  const reserveSeeds = useCallback((): SeedsSnapshot => {
    sfx.bet();
    return nextNonce();
  }, [nextNonce]);

  /** Commit a finished bet to the ledger (atomic debit/credit + history). */
  const settle = useCallback(
    (
      args: {
        game: string;
        template: Template;
        bet: number;
        multiplier: number;
        payout: number;
        win: boolean;
        meta?: Record<string, unknown>;
        seeds: SeedsSnapshot;
      },
      opts?: { quiet?: boolean },
    ) => {
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
      const quiet = opts?.quiet;
      // In auto-bet we suppress the per-round feedback, but a genuinely big win
      // (or the jackpot) still breaks through the quiet.
      if (!quiet && args.win && args.payout > args.bet) {
        sfx.win(args.multiplier);
        burstWin(args.multiplier);
      } else if (!quiet && !args.win) {
        sfx.loss();
      } else if (quiet && args.multiplier >= 10 && args.win) {
        burstWin(args.multiplier);
      }
      if (events.jackpotWon > 0) {
        sfx.jackpot();
        burstJackpot(events.jackpotWon);
      }
      if (!quiet && events.leveledUp) window.setTimeout(() => sfx.levelUp(), 260);
      return { ...events, win: args.win, payout: args.payout, multiplier: args.multiplier };
    },
    [settleBet, recordProgress],
  );

  return { connected, balance, guard, reserveSeeds, settle };
}
