'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { minesLayout, minesMultiplier, DEFAULT_EDGE, round2 } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import { Icon } from '@/components/Icon';
import type { GameConfig } from './types';

const GRID = 25;
type Phase = 'idle' | 'playing' | 'busted' | 'cashed';

export function MinesGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params }: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay();
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [bombs, setBombs] = useState((params?.bombs as number) ?? 3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [bombSet, setBombSet] = useState<Set<number>>(new Set());
  const [seeds, setSeeds] = useState<ReturnType<typeof reserveSeeds> | null>(null);
  // Synchronous re-entry guard: blocks a double-tap settling the same round twice
  // (React `phase` state updates async, so it can't block back-to-back events).
  const settledRef = useRef(false);

  const picks = revealed.size;
  const nextMult = minesMultiplier(GRID, bombs, picks + 1, edge);
  const curMult = picks > 0 ? minesMultiplier(GRID, bombs, picks, edge) : 1;
  const g = guard(bet);

  const start = () => {
    const s = reserveSeeds();
    setSeeds(s);
    setBombSet(minesLayout(GRID, bombs, s));
    setRevealed(new Set());
    settledRef.current = false;
    setPhase('playing');
  };

  const reveal = (i: number) => {
    if (phase !== 'playing' || revealed.has(i) || !seeds) return;
    if (bombSet.has(i)) {
      if (settledRef.current) return;
      settledRef.current = true;
      setBombSet(new Set(bombSet));
      setPhase('busted');
      settle({
        game: gameName ?? meta.name,
        template: 'mines',
        bet,
        multiplier: 0,
        payout: 0,
        win: false,
        meta: { bombs, hit: i, picks },
        seeds,
      });
      if (gameId) bumpUgc(gameId, bet);
      setTimeout(() => setPhase((p) => (p === 'busted' ? 'idle' : p)), 2200);
      return;
    }
    const next = new Set(revealed).add(i);
    setRevealed(next);
    // Auto cash-out when every safe tile is cleared.
    if (next.size === GRID - bombs) cashOut(next.size);
  };

  const cashOut = (picksOverride?: number) => {
    if (phase !== 'playing' || !seeds) return;
    const p = picksOverride ?? picks;
    if (p === 0) return;
    if (settledRef.current) return;
    settledRef.current = true;
    const m = minesMultiplier(GRID, bombs, p, edge);
    setPhase('cashed');
    settle({
      game: gameName ?? meta.name,
      template: 'mines',
      bet,
      multiplier: m,
      payout: round2(bet * m),
      win: true,
      meta: { bombs, picks: p },
      seeds,
    });
    if (gameId) bumpUgc(gameId, bet);
    setTimeout(() => setPhase((ph) => (ph === 'cashed' ? 'idle' : ph)), 2200);
  };

  const showBomb = (i: number) => (phase === 'busted' || phase === 'cashed') && bombSet.has(i);

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="grid h-full place-items-center">
          <div className="grid grid-cols-5 gap-2 md:gap-2.5">
            {Array.from({ length: GRID }, (_, i) => {
              const isRevealed = revealed.has(i);
              const isBomb = showBomb(i);
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.92 }}
                  disabled={phase !== 'playing' || isRevealed}
                  onClick={() => reveal(i)}
                  className={`grid h-14 w-14 place-items-center rounded-xl transition-all md:h-16 md:w-16 ${
                    isBomb
                      ? 'bg-loss/20 border border-loss/50 text-loss'
                      : isRevealed
                        ? 'bg-win/15 border border-win/40 text-win'
                        : 'border border-white/[0.07] bg-void-900/70 hover:border-neon-violet/50 hover:bg-void-700/60'
                  }`}
                  style={isRevealed && !isBomb ? { boxShadow: '0 0 20px -6px #10f5a0' } : undefined}
                >
                  {isBomb ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Icon name="bomb" size={26} />
                    </motion.span>
                  ) : isRevealed ? (
                    <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}>
                      <Icon name="gem" size={26} />
                    </motion.span>
                  ) : (
                    ''
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Mines</span>
              <span className="font-mono text-sm font-bold text-white">{bombs}</span>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              value={bombs}
              disabled={phase === 'playing'}
              onChange={(e) => setBombs(parseInt(e.target.value))}
              className="mt-2 w-full accent-neon-violet"
            />
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={phase === 'playing'} />

          <div className="grid grid-cols-2 gap-2">
            <Info label="Current" value={picks > 0 ? fmtMult(curMult) : '—'} />
            <Info label="Next tile" value={fmtMult(nextMult)} accent />
          </div>

          {phase === 'playing' ? (
            <button
              className="btn-primary btn-win mt-4 w-full disabled:opacity-40"
              disabled={picks === 0}
              onClick={() => cashOut()}
            >
              {picks === 0 ? 'Pick a tile to start' : `Cash out ◎${(bet * curMult).toFixed(4)}`}
            </button>
          ) : (
            <BetButton guard={g} onClick={start} busy={phase === 'busted' || phase === 'cashed'}>
              Start ◎{bet}
            </BetButton>
          )}
        </div>
      }
    />
  );
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`font-mono text-lg font-bold ${accent ? 'text-win' : 'text-white'}`}>{value}</div>
    </div>
  );
}
