'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { dropPlinko, plinkoPayouts, DEFAULT_EDGE, round2 } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import type { GameConfig } from './types';

type Risk = 'low' | 'medium' | 'high';
type RowCount = 8 | 12 | 16;

interface Ball {
  id: string;
  xs: number[];
  ys: number[];
  bucket: number;
}

export function PlinkoGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params , maxBet, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [risk, setRisk] = useState<Risk>((params?.risk as Risk) ?? 'medium');
  const [rows, setRows] = useState<RowCount>((params?.rows as RowCount) ?? 12);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [flash, setFlash] = useState<number | null>(null);

  // Already edge-solved: what the buckets show is what the ball pays.
  const payouts = useMemo(() => plinkoPayouts(risk, rows, edge), [risk, rows, edge]);
  const g = guard(bet);

  const drop = () => {
    const seeds = reserveSeeds();
    const { path, bucket } = dropPlinko(rows, seeds);
    const mult = round2(payouts[bucket] ?? 1);
    const xs: number[] = [];
    const ys: number[] = [];
    let sr = 0;
    xs.push(50);
    ys.push(0);
    for (let r = 1; r <= rows; r++) {
      sr += path[r - 1];
      xs.push(50 + ((2 * sr - r) / (2 * rows)) * 84);
      ys.push((r / rows) * 88);
    }
    const id = seeds.nonce + '-' + Math.round(xs[xs.length - 1]);
    setBalls((b) => [...b, { id, xs, ys, bucket }]);

    settle({
      game: gameName ?? meta.name,
      template: 'plinko',
      bet,
      multiplier: mult,
      payout: round2(bet * mult),
      win: mult >= 1,
      meta: { bucket, risk, rows },
      seeds,
    });
    if (gameId) bumpUgc(gameId, bet);
  };

  const onLand = (ball: Ball) => {
    setFlash(ball.bucket);
    setTimeout(() => setFlash((f) => (f === ball.bucket ? null : f)), 500);
    setTimeout(() => setBalls((b) => b.filter((x) => x.id !== ball.id)), 200);
  };

  const pegRows = Array.from({ length: rows }, (_, r) => r + 3);

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="flex h-full flex-col">
          <div className="relative flex-1">
            {/* pegs */}
            <div className="absolute inset-0 flex flex-col justify-between py-2">
              {pegRows.map((count, r) => (
                <div key={r} className="flex justify-center gap-[3%]">
                  {Array.from({ length: count }, (_, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/25 md:h-2 md:w-2" />
                  ))}
                </div>
              ))}
            </div>
            {/* balls */}
            {balls.map((ball) => (
              <motion.div
                key={ball.id}
                className="absolute h-3 w-3 rounded-full bg-gradient-to-br from-neon-violet to-neon-magenta shadow-glow-violet"
                style={{ left: '50%', top: 0, marginLeft: -6 }}
                initial={{ left: '50%', top: '0%' }}
                animate={{ left: ball.xs.map((x) => `${x}%`), top: ball.ys.map((y) => `${y}%`) }}
                transition={{ duration: rows * 0.085, ease: 'linear', times: ball.xs.map((_, i) => i / rows) }}
                onAnimationComplete={() => onLand(ball)}
              />
            ))}
          </div>
          {/* buckets */}
          <div className="flex justify-center gap-1">
            {payouts.map((m: number, i: number) => {
              const hot = m >= 5;
              return (
                <motion.div
                  key={i}
                  animate={flash === i ? { y: [0, 6, 0], scale: [1, 1.12, 1] } : {}}
                  className="grid flex-1 place-items-center rounded-md py-1.5 text-[0.6rem] font-bold tabular-nums md:text-xs"
                  style={{
                    background:
                      flash === i
                        ? 'linear-gradient(180deg,#10f5a0,#059669)'
                        : hot
                          ? 'rgba(255,210,95,0.14)'
                          : 'rgba(255,255,255,0.04)',
                    color: flash === i ? '#05060f' : hot ? '#ffd25f' : '#94a3b8',
                  }}
                >
                  {fmtMult(m)}
                </motion.div>
              );
            })}
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
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
                    risk === r ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label-eyebrow">Rows</span>
            <div className="mt-1.5 flex gap-1 rounded-xl bg-void-900/80 p-1">
              {([8, 12, 16] as RowCount[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRows(r)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                    rows === r ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} />

          <BetButton guard={g} onClick={drop}>
            Drop ball ◎{bet}
          </BetButton>
          <p className="text-center text-xs text-slate-600">Multiple balls can fall at once — tap away.</p>
        </div>
      }
    />
  );
}
