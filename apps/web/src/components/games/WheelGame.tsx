'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { buildWheel, interleaveWheel, DEFAULT_EDGE, round2 } from '@/lib/games';
import { firstFloat } from '@/lib/provably-fair';
import { fmtMult } from '@/lib/format';
import { Icon } from '@/components/Icon';
import type { GameConfig } from './types';

type Risk = 'low' | 'medium' | 'high';
const SEG = 30;

const COLORS: Record<string, string> = {
  loss: '#242a4d',
  violet: '#a855f7',
  cyan: '#22d3ee',
  gold: '#ffd25f',
};

/** The rim, laid out for looks. The economics live in `buildWheel`. */
function buildRing(risk: Risk, edge: number): { mult: number; color: string }[] {
  return interleaveWheel(buildWheel(risk, SEG, edge)).map((s) => ({ mult: s.multiplier, color: s.color }));
}

export function WheelGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params , maxBet, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [risk, setRisk] = useState<Risk>((params?.risk as Risk) ?? 'medium');
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ mult: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const ring = useMemo(() => buildRing(risk, edge), [risk, edge]);
  const conic = useMemo(
    () =>
      `conic-gradient(${ring
        .map((s, i) => `${COLORS[s.color]} ${(i / SEG) * 360}deg ${((i + 1) / SEG) * 360}deg`)
        .join(',')})`,
    [ring],
  );
  const g = guard(bet);

  const doBet = () => {
    setBusy(true);
    const seeds = reserveSeeds();
    const idx = Math.floor(firstFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce) * SEG) % SEG;
    const slot = ring[idx];
    const segAngle = 360 / SEG;
    const base = rotation - (rotation % 360);
    // bring segment center to the top pointer (12 o'clock)
    const target = base + 360 * 5 - (idx * segAngle + segAngle / 2);
    setRotation(target);
    setResult(null);
    setTimeout(() => {
      setResult({ mult: slot.mult });
      settle({
        game: gameName ?? meta.name,
        template: 'wheel',
        bet,
        multiplier: slot.mult,
        payout: round2(bet * slot.mult),
        win: slot.mult >= 1,
        meta: { index: idx, risk },
        seeds,
      });
      if (gameId) bumpUgc(gameId, bet);
      setBusy(false);
    }, 4100);
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="grid h-full place-items-center">
          <div className="relative h-80 w-80">
            {/* brass rim with marquee bulbs */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(160deg,#e6b455,#6b4a17 55%,#2a1a08)',
                boxShadow: '0 0 60px -14px rgba(230,180,85,0.45), inset 0 2px 3px rgba(255,255,255,0.35), inset 0 -4px 8px rgba(0,0,0,0.6)',
              }}
            />
            {Array.from({ length: 20 }).map((_, i) => {
              const a = (i / 20) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-amber-200"
                  style={{
                    left: `${50 + Math.cos(a) * 47.5}%`,
                    top: `${50 + Math.sin(a) * 47.5}%`,
                    boxShadow: '0 0 8px rgba(253,230,138,0.9)',
                  }}
                  animate={busy ? { opacity: [0.25, 1, 0.25] } : { opacity: 0.55 }}
                  transition={busy ? { duration: 0.6, repeat: Infinity, delay: i * 0.05 } : { duration: 0.3 }}
                />
              );
            })}
            {/* the wheel itself, with segment separators and a glass coat */}
            <motion.div
              className="absolute inset-[5.5%] rounded-full"
              style={{
                background: conic,
                boxShadow: 'inset 0 0 0 3px rgba(0,0,0,0.45), inset 0 0 40px rgba(0,0,0,0.5), 0 0 46px -14px #a855f7',
              }}
              animate={{ rotate: rotation }}
              transition={{ duration: 4, ease: [0.15, 0.85, 0.2, 1] }}
            >
              {/* separators */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `repeating-conic-gradient(rgba(0,0,0,0.55) 0deg 0.6deg, transparent 0.6deg ${360 / SEG}deg)`,
                }}
              />
              {/* glass coat */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'conic-gradient(from 210deg, rgba(255,255,255,0.22), transparent 18%, transparent 55%, rgba(255,255,255,0.1) 78%, transparent 90%)',
                }}
              />
            </motion.div>
            {/* pointer — wobbles as the wheel brakes */}
            <motion.div
              className="absolute left-1/2 top-[1.5%] z-20 -translate-x-1/2"
              animate={result ? { rotate: [0, -14, 10, -5, 0] } : { rotate: 0 }}
              transition={{ duration: 0.5 }}
              style={{ transformOrigin: '50% 20%' }}
            >
              <div
                className="h-0 w-0 border-x-[11px] border-t-[18px] border-x-transparent"
                style={{ borderTopColor: '#f8fafc', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.7)) drop-shadow(0 0 8px rgba(255,255,255,0.5))' }}
              />
            </motion.div>
            {/* hub */}
            <div
              className="absolute left-1/2 top-1/2 z-10 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #2a2f57, #0d1024 70%)',
                boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.2), inset 0 -4px 8px rgba(0,0,0,0.7), 0 8px 24px -6px rgba(0,0,0,0.8)',
              }}
            >
              {result ? (
                <motion.span
                  key={result.mult}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`font-display text-2xl font-bold ${result.mult >= 1 ? 'text-win' : 'text-loss'}`}
                  style={{ textShadow: result.mult >= 1 ? '0 0 18px rgba(16,245,160,0.7)' : '0 0 18px rgba(255,59,107,0.6)' }}
                >
                  {fmtMult(result.mult)}
                </motion.span>
              ) : (
                <span className="text-slate-500">
                  <Icon name="wheel" size={30} />
                </span>
              )}
            </div>
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div>
            <span className="label-eyebrow">Risk</span>
            <div className="mt-1.5 flex gap-1 rounded-xl bg-void-900/80 p-1">
              {(['low', 'medium', 'high'] as Risk[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  disabled={busy}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
                    risk === r ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={busy} />

          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set(ring.map((s) => s.mult)))
              .sort((a, b) => a - b)
              .map((m) => (
                <span key={m} className="chip !text-[0.65rem]">
                  {fmtMult(m)}
                </span>
              ))}
          </div>

          <BetButton guard={g} onClick={doBet} busy={busy}>
            Spin ◎{bet}
          </BetButton>
        </div>
      }
    />
  );
}
