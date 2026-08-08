'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
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

// Ambience only — the readout stays DOM-crisp on top of it.
const CrystalScene3D = dynamic(() => import('./CrystalScene3D'), { ssr: false, loading: () => null });

export function LimboGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params, maxBet, maxWin, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
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
  const [launch, setLaunch] = useState(0); // increments per round — drives the arc
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const winChance = ((1 - clampEdge(edge)) / target) * 100;
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

  const doBet = () => {
    setBusy(true);
    setWin(null);
    setResult(null);
    setLaunch((k) => k + 1);
    // The climb is theatre (~1s); the point was decided by the seed already.
    setTimeout(() => {
      playRound(bet, false);
      setBusy(false);
    }, 950);
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative grid h-full place-items-center overflow-hidden">
          {/* the oracle crystal tumbles while the climb is live */}
          <div className="pointer-events-none absolute inset-0">
            <CrystalScene3D spin={busy} verdict={result === null ? null : win ? 'win' : 'loss'} />
          </div>
          <ClimbArc launch={launch} result={result} win={win} />
          <div className="relative z-10 text-center">
            {result === null && launch === 0 && (
              <div className="font-display text-7xl font-bold tabular-nums text-slate-300 md:text-8xl" style={{ textShadow: '0 0 30px rgba(148,163,184,0.3)' }}>
                1.00×
              </div>
            )}
            {result === null && launch > 0 && <ClimbCounter />}
            {result !== null && (
              <motion.div
                key={result}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 16 }}
                className={`font-display text-7xl font-bold tabular-nums md:text-8xl ${win ? 'text-win' : 'text-loss'}`}
                style={{ textShadow: win ? '0 0 50px rgba(16,245,160,0.6)' : '0 0 50px rgba(255,59,107,0.5)' }}
              >
                {fmtMult(result)}
              </motion.div>
            )}
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

/** The exponential climb, drawn as it happens — a rocket-arc behind the counter. */
function ClimbArc({ launch, result, win }: { launch: number; result: number | null; win: boolean | null }) {
  if (launch === 0) return null;
  const done = result !== null;
  const color = !done ? '#a855f7' : win ? '#10f5a0' : '#ff3b6b';
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`arc-${launch}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.1" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" y1={300 * f} x2="400" y2={300 * f} stroke="#ffffff" strokeOpacity="0.05" />
      ))}
      <motion.path
        key={launch}
        d="M 20 285 Q 120 260 200 190 T 390 12"
        fill="none"
        stroke={`url(#arc-${launch})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.95, ease: [0.25, 0.8, 0.35, 1] }}
        style={{ filter: `drop-shadow(0 0 10px ${color})` }}
      />
      <motion.circle
        key={`dot-${launch}`}
        r="7"
        fill={color}
        initial={{ cx: 20, cy: 285, opacity: 1 }}
        animate={{ cx: [20, 200, 390], cy: [285, 190, 12] }}
        transition={{ duration: 0.95, ease: [0.25, 0.8, 0.35, 1] }}
        style={{ filter: `drop-shadow(0 0 14px ${color})` }}
      />
    </svg>
  );
}

/** The counter climbing while the outcome is still "in the air". */
function ClimbCounter() {
  const [v, setV] = useState(1);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const e = performance.now() - t0;
      setV(Math.max(1, Math.pow(Math.E, 0.0011 * e)));
      if (e < 940) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="font-display text-7xl font-bold tabular-nums text-neon-violet md:text-8xl" style={{ textShadow: '0 0 46px rgba(168,85,247,0.65)' }}>
      {fmtMult(Math.floor(v * 100) / 100)}
    </div>
  );
}
