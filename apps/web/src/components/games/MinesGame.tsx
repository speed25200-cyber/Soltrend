'use client';

import dynamic from 'next/dynamic';
import { SceneLoader } from './SceneLoader';
import { useMemo, useRef, useState } from 'react';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { minesLayout, minesMultiplier, MAX_MULTIPLIER, DEFAULT_EDGE, round2 } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import { defaultWorld } from '@/lib/forge/world';
import { BOARD_SKINS } from '@/lib/forge/board';
import type { GameConfig } from './types';

const World3D = dynamic(() => import('@/components/worlds/World3D'), {
  ssr: false,
  loading: () => <SceneLoader label="Loading the mine…" />,
});

const GRID = 25;
type Phase = 'idle' | 'playing' | 'busted' | 'cashed';

const SKIN: keyof typeof BOARD_SKINS = 'gems';

/**
 * Mines — now dealt on the full 3D board (lacquered slabs, hover halos,
 * floating gems, drifting atmosphere). The maths is untouched: same layout,
 * same ladder, same seeds as the flat board it replaces.
 */
export function MinesGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params , maxBet, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [bombs, setBombs] = useState((params?.bombs as number) ?? 3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [bombSet, setBombSet] = useState<Set<number>>(new Set());
  const [hitIndex, setHitIndex] = useState<number | null>(null);
  const [seeds, setSeeds] = useState<ReturnType<typeof reserveSeeds> | null>(null);
  // Synchronous re-entry guard: blocks a double-tap settling the same round twice
  // (React `phase` state updates async, so it can't block back-to-back events).
  const settledRef = useRef(false);

  const spec = useMemo(() => defaultWorld({ rows: 5, cols: 5, bombs, skin: SKIN, fx: 'bloom' }), [bombs]);
  const skin = BOARD_SKINS[SKIN];

  const picks = revealed.size;
  const nextMult = minesMultiplier(GRID, bombs, picks + 1, edge);
  const curMult = picks > 0 ? minesMultiplier(GRID, bombs, picks, edge) : 1;
  const heat = Math.min(1, Math.log10(Math.max(1, curMult)) / 2);
  const g = guard(bet);

  const start = () => {
    const s = reserveSeeds();
    setSeeds(s);
    setBombSet(minesLayout(GRID, bombs, s));
    setRevealed(new Set());
    setHitIndex(null);
    settledRef.current = false;
    setPhase('playing');
  };

  const reveal = (i: number) => {
    if (phase !== 'playing' || revealed.has(i) || !seeds) return;
    if (bombSet.has(i)) {
      if (settledRef.current) return;
      settledRef.current = true;
      setHitIndex(i);
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

  const showBombs = phase === 'busted' || phase === 'cashed';

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl">
          {/* The renderer is absolutely positioned: a percentage height resolves
              against the parent's height, not its min-height. */}
          <div className="absolute inset-0">
            <World3D
              spec={spec}
              revealed={revealed}
              bombSet={bombSet}
              showBombs={showBombs}
              playing={phase === 'playing'}
              hitIndex={hitIndex}
              onReveal={reveal}
              heat={heat}
            />
          </div>
          {/* HUD overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <div className="rounded-xl border border-white/10 bg-void-950/70 px-3 py-2 backdrop-blur">
              <div className="font-mono text-2xl font-black" style={{ color: phase === 'busted' ? '#ff3b6b' : skin.gemGlow, textShadow: `0 0 ${14 + heat * 26}px ${skin.gem}` }}>
                {phase === 'busted' ? 'BUST' : `${curMult.toFixed(2)}×`}
              </div>
              <div className="text-[0.62rem] uppercase tracking-[0.25em] text-slate-400">
                {phase === 'playing' && picks > 0 ? `◎${(bet * curMult).toFixed(3)}` : `${GRID - bombs} safe · ${bombs} mines`}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-void-950/70 px-3 py-2 text-right backdrop-blur">
              <div className="font-mono text-lg font-bold text-white">{picks}</div>
              <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">revealed</div>
            </div>
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
              aria-label="Number of mines"
              value={bombs}
              disabled={phase === 'playing'}
              onChange={(e) => setBombs(parseInt(e.target.value))}
              className="mt-2 w-full accent-neon-violet"
            />
            {/* The ladder on a heavily-mined board runs past what the vault can
                settle, so the ceiling is stated rather than discovered. */}
            <p className="mt-1.5 text-[0.62rem] text-slate-600">
              Max win {fmtMult(MAX_MULTIPLIER)} — the vault&apos;s payout ceiling.
            </p>
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
          <p className="text-center text-[0.68rem] text-slate-600">Drag to orbit the board · click a slab to reveal it</p>
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
