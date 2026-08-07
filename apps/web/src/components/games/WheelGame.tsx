'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
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

// The carnival machine — brass rim, strobing lamps, printed disc.
const WheelScene3D = dynamic(() => import('./WheelScene3D'), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[380px] place-items-center text-sm text-slate-500">Oiling the wheel…</div>,
});

type Risk = 'low' | 'medium' | 'high';
const SEG = 30;

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
        <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl">
          <div className="absolute inset-0">
            <WheelScene3D
              ring={ring}
              rotation={rotation}
              spinning={busy}
              result={result?.mult ?? null}
            />
          </div>
          {/* result chip, floating over the hub */}
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            {result ? (
              <motion.span
                key={result.mult}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`rounded-2xl border border-white/10 bg-void-950/70 px-5 py-2 font-display text-3xl font-bold backdrop-blur ${result.mult >= 1 ? 'text-win' : 'text-loss'}`}
                style={{ textShadow: result.mult >= 1 ? '0 0 22px rgba(16,245,160,0.7)' : '0 0 22px rgba(255,59,107,0.6)' }}
              >
                {fmtMult(result.mult)}
              </motion.span>
            ) : !busy ? (
              <span className="rounded-2xl border border-white/[0.07] bg-void-950/50 px-4 py-1.5 text-sm text-slate-500 backdrop-blur">
                <Icon name="wheel" size={16} /> Spin to play
              </span>
            ) : null}
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
