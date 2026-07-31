'use client';

import dynamic from 'next/dynamic';
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
import type { PlinkoBall } from './PlinkoScene3D';

const Scene3D = dynamic(() => import('./PlinkoScene3D'), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[380px] place-items-center text-sm text-slate-500">Loading the board…</div>,
});

type Risk = 'low' | 'medium' | 'high';
type RowCount = 8 | 12 | 16;

/** A bucket's payout, at the shortest length that still reads as a number and
 *  never rounds up. Full precision stays on the tooltip. */
function bucketLabel(m: number): string {
  const down = (dp: number) => (Math.floor(m * 10 ** dp) / 10 ** dp).toString();
  if (m >= 10) return down(0);
  if (m >= 1) return down(1);
  return down(2);
}

/**
 * Plinko — dealt on the full 3D board now: brass pins, a glowing ball that
 * squashes at every pin, a column of light where it lands. Buckets stay DOM
 * (crisp labels, exact values); the ball's lane maps 1:1 onto them.
 */
export function PlinkoGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params , maxBet, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [risk, setRisk] = useState<Risk>((params?.risk as Risk) ?? 'medium');
  const [rows, setRows] = useState<RowCount>((params?.rows as RowCount) ?? 12);
  const [balls, setBalls] = useState<PlinkoBall[]>([]);
  const [flash, setFlash] = useState<number | null>(null);

  // Already edge-solved: what the buckets show is what the ball pays.
  const payouts = useMemo(() => plinkoPayouts(risk, rows, edge), [risk, rows, edge]);
  const g = guard(bet);

  const drop = () => {
    const seeds = reserveSeeds();
    const { path, bucket } = dropPlinko(rows, seeds);
    const mult = round2(payouts[bucket] ?? 1);
    const id = seeds.nonce + '-' + bucket;
    setBalls((b) => [...b, { id, path, bucket }]);

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

  const onLand = (ball: PlinkoBall) => {
    setFlash(ball.bucket);
    setTimeout(() => setFlash((f) => (f === ball.bucket ? null : f)), 500);
    setTimeout(() => setBalls((b) => b.filter((x) => x.id !== ball.id)), 200);
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="flex h-full flex-col gap-2">
          <div className="relative min-h-[380px] flex-1 overflow-hidden rounded-2xl">
            <div className="absolute inset-0">
              <Scene3D rows={rows} balls={balls} onLand={onLand} />
            </div>
          </div>
          {/* buckets — 17 of them have to fit a 390px phone, so the label is
              compacted rather than allowed to push the page sideways. It still
              rounds down, so it never promises more than the bucket pays. */}
          <div className="flex justify-center gap-0.5 sm:gap-1">
            {payouts.map((m: number, i: number) => {
              const hot = m >= 5;
              return (
                <motion.div
                  key={i}
                  animate={flash === i ? { y: [0, 6, 0], scale: [1, 1.12, 1] } : {}}
                  title={fmtMult(m)}
                  className="grid min-w-0 flex-1 place-items-center overflow-hidden rounded-md py-1.5 text-[0.5rem] font-bold tabular-nums sm:text-[0.6rem] md:text-xs"
                  style={{
                    background:
                      flash === i
                        ? 'linear-gradient(180deg,#10f5a0,#059669)'
                        : hot
                          ? 'linear-gradient(180deg,rgba(255,210,95,0.22),rgba(255,210,95,0.08))'
                          : 'linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))',
                    boxShadow:
                      flash === i
                        ? '0 0 22px rgba(16,245,160,0.8), inset 0 1px 0 rgba(255,255,255,0.4)'
                        : hot
                          ? 'inset 0 1px 0 rgba(255,210,95,0.35), 0 0 10px -2px rgba(255,210,95,0.3)'
                          : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    color: flash === i ? '#05060f' : hot ? '#ffd25f' : '#94a3b8',
                  }}
                >
                  {bucketLabel(m)}
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
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
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
