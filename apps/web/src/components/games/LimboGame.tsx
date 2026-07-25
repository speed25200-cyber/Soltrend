'use client';

import { useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { AutoBet } from './AutoBet';
import { ModeTabs } from './ModeTabs';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { playLimbo, clampEdge, DEFAULT_EDGE } from '@/lib/games';
import { MAX_PAYOUT } from '@/lib/forge/board';
import { fmtMult } from '@/lib/format';
import type { GameConfig } from './types';

export function LimboGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params, maxBet, maxWin }: GameConfig) {
  const { guard: rawGuard, reserveSeeds, settle } = usePlay();
  const bumpUgc = useCasino((s) => s.bumpUgc);

  // The player picks their own multiplier here, so it must be capped: the
  // bankroll-relative bet cap is sized against this ceiling, and the vault
  // itself never pays beyond MAX_PAYOUT.
  const targetCeiling = Math.max(1.01, Math.min(maxWin ?? MAX_PAYOUT, MAX_PAYOUT));
  const clampTarget = (t: number) => Math.max(1.01, Math.min(t, targetCeiling));

  const [bet, setBet] = useState(0.1);
  const [target, setTarget] = useState(() => clampTarget((params?.target as number) ?? 2));
  const [result, setResult] = useState<number | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const controls = useAnimationControls();

  const winChance = ((1 - clampEdge(edge)) / target) * 100;
  const guard = (b: number) => (maxBet != null && b > maxBet ? { ok: false, reason: `Max bet ◎${maxBet} — this game's bankroll cap` } : rawGuard(b));
  const g = guard(bet);

  const playRound = (amount: number, quiet: boolean) => {
    const seeds = reserveSeeds();
    const res = playLimbo(amount, target, seeds, edge);
    setResult(res.crashPoint);
    setWin(res.win);
    settle(
      {
        game: gameName ?? meta.name,
        template: 'limbo',
        bet: amount,
        multiplier: res.multiplier,
        payout: res.payout,
        win: res.win,
        meta: { crashPoint: res.crashPoint, target },
        seeds,
      },
      { quiet },
    );
    if (gameId) bumpUgc(gameId, amount);
    return { win: res.win, payout: res.payout };
  };

  const doBet = async () => {
    setBusy(true);
    setWin(null);
    await controls.start({ opacity: [0.3, 1], transition: { duration: 0.15 } });
    playRound(bet, false);
    setBusy(false);
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="grid h-full place-items-center">
          <div className="text-center">
            <motion.div
              animate={controls}
              key={result ?? 'idle'}
              className={`font-display text-7xl font-bold tabular-nums md:text-8xl ${
                win === null ? 'text-slate-300' : win ? 'text-win' : 'text-loss'
              }`}
              style={{
                textShadow:
                  win === null
                    ? '0 0 30px rgba(148,163,184,0.3)'
                    : win
                      ? '0 0 50px rgba(16,245,160,0.6)'
                      : '0 0 50px rgba(255,59,107,0.5)',
              }}
            >
              {result === null ? '1.00×' : fmtMult(result)}
            </motion.div>
            {win !== null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 font-semibold ${win ? 'text-win' : 'text-loss'}`}
              >
                {win ? `You hit ${fmtMult(target)} — nice.` : `Busted below ${fmtMult(target)}.`}
              </motion.div>
            )}
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <ModeTabs mode={mode} setMode={setMode} />
          <div>
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Target multiplier</span>
              <span className="font-mono text-xs text-slate-500">win {winChance.toFixed(2)}%</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-void-900/80 px-3">
              <input
                className="w-full bg-transparent py-3 font-mono text-lg font-bold text-white outline-none"
                value={target}
                inputMode="decimal"
                onChange={(e) => {
                  const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
                  setTarget(clampTarget(Number.isFinite(n) ? n : 1.01));
                }}
              />
              <span className="font-mono text-slate-500">×</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[1.5, 2, 5, 10, 100].filter((v) => v <= targetCeiling).map((v) => (
                <button
                  key={v}
                  onClick={() => setTarget(v)}
                  className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 text-xs font-semibold text-slate-400 transition hover:border-neon-violet/40 hover:text-white"
                >
                  {v}×
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[0.62rem] text-slate-600">Max {fmtMult(targetCeiling)} — this game&apos;s payout ceiling.</p>
          </div>

          {mode === 'manual' ? (
            <>
              <BetAmount value={bet} onChange={setBet} disabled={busy} />
              <div className="rounded-xl border border-white/[0.06] bg-void-900/50 px-4 py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payout on win</span>
                  <span className="font-mono font-semibold text-win">◎ {(bet * target).toFixed(4)}</span>
                </div>
              </div>
              <BetButton guard={g} onClick={doBet} busy={busy}>
                Bet {bet > 0 ? `◎${bet}` : ''}
              </BetButton>
            </>
          ) : (
            <AutoBet baseBet={bet} setBaseBet={setBet} guard={guard} playRound={playRound} />
          )}
        </div>
      }
    />
  );
}
