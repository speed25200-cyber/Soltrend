'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { crashPointFromFloat, DEFAULT_EDGE, round2 } from '@/lib/games';
import { firstFloat } from '@/lib/provably-fair';
import { fmtMult } from '@/lib/format';
import type { GameConfig } from './types';

type Phase = 'idle' | 'running' | 'crashed' | 'cashed';

// Multiplier as a function of elapsed seconds — smooth exponential ramp.
const multAt = (s: number) => Math.max(1, Math.pow(Math.E, 0.11 * s));
const RATE = 0.11;

export function CrashGame({ meta, edge = DEFAULT_EDGE, gameId, gameName }: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay();
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [autoCashout, setAutoCashout] = useState(2);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mult, setMult] = useState(1);
  const [cashMult, setCashMult] = useState<number | null>(null);

  const raf = useRef<number>();
  const startTs = useRef<number>(0);
  const crashPoint = useRef<number>(0);
  const betRef = useRef(bet);
  const seedsRef = useRef<ReturnType<typeof reserveSeeds> | null>(null);
  const settledRef = useRef(false);

  useEffect(() => () => cancelAnimationFrame(raf.current!), []);

  const g = guard(bet);

  const start = () => {
    const seeds = reserveSeeds();
    seedsRef.current = seeds;
    betRef.current = bet;
    settledRef.current = false;
    crashPoint.current = crashPointFromFloat(
      firstFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce),
      edge,
    );
    setCashMult(null);
    setMult(1);
    setPhase('running');
    startTs.current = performance.now();
    tick();
  };

  const tick = () => {
    const elapsed = (performance.now() - startTs.current) / 1000;
    const m = multAt(elapsed);
    if (m >= crashPoint.current) {
      setMult(crashPoint.current);
      bust();
      return;
    }
    setMult(m);
    // auto cash-out
    if (autoCashout > 1 && m >= autoCashout) {
      cashOut(autoCashout);
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  const bust = () => {
    cancelAnimationFrame(raf.current!);
    setPhase('crashed');
    if (!settledRef.current && seedsRef.current) {
      settledRef.current = true;
      settle({
        game: gameName ?? meta.name,
        template: 'limbo',
        bet: betRef.current,
        multiplier: crashPoint.current,
        payout: 0,
        win: false,
        meta: { crashPoint: crashPoint.current, cashedAt: null },
        seeds: seedsRef.current,
      });
      if (gameId) bumpUgc(gameId, betRef.current);
    }
    setTimeout(() => setPhase((p) => (p === 'crashed' ? 'idle' : p)), 1800);
  };

  const cashOut = (at?: number) => {
    if (phase !== 'running' || settledRef.current || !seedsRef.current) return;
    cancelAnimationFrame(raf.current!);
    const m = round2(at ?? mult);
    settledRef.current = true;
    setCashMult(m);
    setPhase('cashed');
    settle({
      game: gameName ?? meta.name,
      template: 'limbo',
      bet: betRef.current,
      multiplier: m,
      payout: round2(betRef.current * m),
      win: true,
      meta: { crashPoint: crashPoint.current, cashedAt: m },
      seeds: seedsRef.current,
    });
    if (gameId) bumpUgc(gameId, betRef.current);
    setTimeout(() => setPhase((p) => (p === 'cashed' ? 'idle' : p)), 1800);
  };

  // Build the curve path (0..1 normalized then scaled in SVG viewBox 100x100).
  const curve = buildCurve(mult);
  const color = phase === 'crashed' ? '#ff3b6b' : phase === 'cashed' ? '#10f5a0' : '#a855f7';

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative grid h-full place-items-center">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-90">
            <defs>
              <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.35" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* grid */}
            {[20, 40, 60, 80].map((y) => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.3" />
            ))}
            <path d={`${curve} L 100 100 L 0 100 Z`} fill="url(#crashFill)" />
            <path d={curve} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          </svg>

          <div className="relative z-10 text-center">
            <motion.div
              key={phase}
              className="font-display text-7xl font-bold tabular-nums md:text-8xl"
              style={{ color, textShadow: `0 0 50px ${color}88` }}
              animate={phase === 'crashed' ? { scale: [1, 1.1, 1], rotate: [0, -2, 2, 0] } : {}}
            >
              {fmtMult(phase === 'cashed' && cashMult ? cashMult : mult)}
            </motion.div>
            <div className="mt-2 h-6 font-semibold">
              {phase === 'crashed' && <span className="text-loss">💥 Crashed @ {fmtMult(crashPoint.current)}</span>}
              {phase === 'cashed' && <span className="text-win">✅ Cashed out {fmtMult(cashMult!)}</span>}
              {phase === 'running' && <span className="text-slate-400">Cash out any time…</span>}
              {phase === 'idle' && <span className="text-slate-600">Place a bet to launch 🚀</span>}
            </div>
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <BetAmount value={bet} onChange={setBet} disabled={phase === 'running'} />

          <div>
            <span className="label-eyebrow">Auto cash-out</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-void-900/80 px-3">
              <input
                className="w-full bg-transparent py-2.5 font-mono text-white outline-none"
                value={autoCashout}
                inputMode="decimal"
                disabled={phase === 'running'}
                onChange={(e) => {
                  const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
                  setAutoCashout(Math.max(1.01, Number.isFinite(n) ? n : 1.01));
                }}
              />
              <span className="font-mono text-slate-500">×</span>
            </div>
          </div>

          {phase === 'running' ? (
            <button className="btn-primary btn-win mt-4 w-full text-base" onClick={() => cashOut()}>
              Cash out ◎{(bet * mult).toFixed(4)} ({fmtMult(mult)})
            </button>
          ) : (
            <BetButton guard={g} onClick={start} busy={phase === 'crashed' || phase === 'cashed'}>
              Launch ◎{bet}
            </BetButton>
          )}
        </div>
      }
    />
  );
}

/** Sample the exponential up to the current multiplier into an SVG polyline. */
function buildCurve(currentMult: number): string {
  const totalS = Math.log(Math.max(1.0001, currentMult)) / RATE;
  const yMax = Math.max(2, currentMult * 1.15);
  const pts: string[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const s = (totalS * i) / N;
    const m = multAt(s);
    const x = totalS > 0 ? (i / N) * 100 : 0;
    const y = 100 - ((m - 1) / (yMax - 1)) * 96 - 2;
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(' ');
}
