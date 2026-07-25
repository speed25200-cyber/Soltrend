'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { round2, DEFAULT_EDGE } from '@/lib/games';
import { floatStream } from '@/lib/provably-fair';
import { Icon } from '@/components/Icon';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import { MineSymbol, SYMBOL_COLORS } from './goldmine/MineSymbol';
import {
  COLS, ROWS, SCATTER, SYMBOLS, MAX_WIN,
  playRound, slotFromParams, type Collapse, type RoundResult, type SlotConfig,
} from '@/lib/slots/goldmine';
import type { GameConfig } from './types';

/** One step of the animation timeline, flattened across every spin in a round. */
interface Frame {
  collapse: Collapse;
  spinIndex: number;
  free: boolean;
  /** running total in bet multiples once this frame has paid */
  running: number;
}

const WIN_MS = 620;
const BLAST_MS = 260;

/**
 * GOLDMINE EXPRESS — the mining cascade, rebuilt.
 *
 * The whole round is resolved by the engine up front (so the outcome is fixed by
 * the reserved seed and nothing on screen can change it), then replayed as a
 * timeline: each collapse lights its winning ore, detonates it, and drops fresh
 * rock in from above. That split is what lets the animation be as slow and
 * physical as it likes without ever being the thing that decides the money.
 */
export function GoldmineGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params, maxBet }: GameConfig) {
  // A creator-published slot carries its own tuned config; the Original uses the
  // default. Malformed configs fall back rather than shipping a broken paytable.
  const cfg = useMemo(() => slotFromParams(params), [params]);
  const { guard, reserveSeeds, settle } = usePlay(maxBet);
  const bumpUgc = useCasino((s) => s.bumpUgc);
  const recordBest = useCasino((s) => s.recordBest);

  const [bet, setBet] = useState(0.1);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [frameIdx, setFrameIdx] = useState(-1);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'win' | 'blast' | 'done'>('idle');
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [banked, setBanked] = useState(0);
  const timers = useRef<number[]>([]);
  const busyRef = useRef(false);

  // Any pending step must die with the component, or a late timer would write
  // into an unmounted tree.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms) as unknown as number);
  };

  const g = guard(bet);
  const current = frameIdx >= 0 ? frames[frameIdx] : undefined;
  const showGrid = grid ?? current?.collapse.grid ?? null;
  const winningCells = phase === 'win' || phase === 'blast'
    ? new Set(current?.collapse.wins.flatMap((w) => w.cells) ?? [])
    : new Set<number>();

  const spin = () => {
    if (busyRef.current || !g.ok) return;
    busyRef.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const seeds = reserveSeeds();
    const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
    const round = playRound(() => stream.next(), cfg);

    // Flatten every spin's collapses into one timeline the UI can walk.
    const flat: Frame[] = [];
    let running = 0;
    round.spins.forEach((s, si) => {
      s.rounds.forEach((c) => {
        running += c.won;
        flat.push({ collapse: c, spinIndex: si, free: s.free, running: Math.min(running, MAX_WIN) });
      });
    });

    setResult(round);
    setFrames(flat);
    setBanked(0);
    setPhase('spinning');
    sfx.bet();

    // Settle immediately — the money is decided by the seed, not by the replay.
    const payout = round2(bet * round.total);
    settle(
      {
        game: gameName ?? meta.name,
        template: 'slots',
        bet,
        multiplier: round.total,
        payout,
        win: round.total > 0,
        meta: { freeSpins: round.freeSpins, cascades: flat.length },
        seeds,
      },
      { quiet: true },
    );
    if (gameId) bumpUgc(gameId, bet);
    if (round.total > 0) recordBest(gameId ?? meta.slug, round.total);

    // The opening grid drops in, then the timeline plays.
    const first = round.spins[0];
    setGrid(first.rounds[0]?.grid ?? null);
    if (flat.length === 0) {
      // A dead spin still needs a grid to look at.
      after(520, () => {
        setPhase('done');
        sfx.loss();
        busyRef.current = false;
      });
      // Nothing paid, so show the opening grid the engine actually drew.
      setGrid(dryGrid(seeds, cfg));
      return;
    }
    after(420, () => step(0, flat, round));
  };

  /** Walk one collapse: light it, blow it, drop the next. */
  const step = (i: number, flat: Frame[], round: RoundResult) => {
    setFrameIdx(i);
    setGrid(flat[i].collapse.grid);
    setPhase('win');
    sfx.tick(i + 1);

    after(WIN_MS, () => {
      setPhase('blast');
      after(BLAST_MS, () => {
        setBanked(flat[i].running);
        if (i + 1 < flat.length) {
          step(i + 1, flat, round);
        } else {
          setPhase('done');
          if (round.total > 0) {
            sfx.win(round.total);
            burstWin(round.total, { colors: ['#fcd34d', '#fb923c', '#ffffff'] });
          }
          busyRef.current = false;
        }
      });
    });
  };

  const inBonus = current?.free ?? false;
  const multiplier = current?.collapse.multiplier ?? 1;

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative h-full min-h-[380px] overflow-hidden rounded-2xl">
          {/* mine shaft backdrop — depth without a single image asset */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#241a0e_0%,#0d0a06_55%,#05060f_100%)]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'repeating-linear-gradient(115deg, #fcd34d 0 1px, transparent 1px 34px)' }}
          />
          <AnimatePresence>
            {inBonus && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_50%,#ff8a3c22,transparent_70%)]"
              />
            )}
          </AnimatePresence>

          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 p-4">
            {/* the seam */}
            <div
              className="grid gap-1.5 rounded-2xl border border-white/[0.07] bg-void-950/40 p-2 backdrop-blur-sm sm:gap-2 sm:p-3"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: COLS }).map((_, c) => (
                <div key={c} className="flex flex-col gap-1.5 sm:gap-2">
                  {Array.from({ length: ROWS }).map((_, r) => {
                    const sym = showGrid?.[c]?.[r];
                    const cell = c * ROWS + r;
                    const isWin = winningCells.has(cell);
                    const blasting = isWin && phase === 'blast';
                    return (
                      <div key={r} className="relative grid h-10 w-10 place-items-center sm:h-12 sm:w-12 md:h-14 md:w-14">
                        <AnimatePresence mode="popLayout">
                          {sym !== undefined && !blasting && (
                            <motion.div
                              key={`${frameIdx}-${c}-${r}-${sym}`}
                              initial={{ y: -60, opacity: 0, scale: 0.7 }}
                              animate={{
                                y: 0,
                                opacity: 1,
                                scale: isWin ? 1.16 : 1,
                                filter: isWin ? `drop-shadow(0 0 12px ${SYMBOL_COLORS[sym]?.glow ?? '#fff'})` : 'none',
                              }}
                              exit={{ scale: 1.7, opacity: 0, transition: { duration: BLAST_MS / 1000 } }}
                              transition={{
                                type: 'spring',
                                stiffness: 420,
                                damping: 26,
                                delay: phase === 'win' ? 0 : (ROWS - r) * 0.025 + c * 0.012,
                              }}
                              className="absolute inset-0 grid place-items-center"
                            >
                              <MineSymbol sym={sym} size={44} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {/* the empty socket the ore sits in */}
                        <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-white/[0.05] bg-black/25" />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* running total + multiplier gear */}
            <div className="flex items-center gap-3">
              <AnimatePresence mode="popLayout">
                {multiplier > 1 && (phase === 'win' || phase === 'blast') && (
                  <motion.span
                    key={`m-${frameIdx}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-1 font-mono text-lg font-black text-gold"
                    style={{ textShadow: '0 0 18px #fcd34d88' }}
                  >
                    ×{multiplier}
                  </motion.span>
                )}
              </AnimatePresence>
              {banked > 0 && (
                <motion.span
                  key={banked}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  className="font-mono text-2xl font-black text-white"
                  style={{ textShadow: '0 0 22px #fcd34d66' }}
                >
                  {banked.toFixed(2)}×
                </motion.span>
              )}
            </div>
          </div>

          {/* bonus banner */}
          <AnimatePresence>
            {inBonus && (
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -30, opacity: 0 }}
                className="absolute inset-x-0 top-0 z-20 flex justify-center p-3"
              >
                <span className="rounded-xl border border-orange-400/40 bg-void-950/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-orange-300 backdrop-blur">
                  Express run · spin {current!.spinIndex} of {result?.freeSpins}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* result */}
          <AnimatePresence>
            {phase === 'done' && result && result.total > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 bottom-4 z-20 flex justify-center"
              >
                <span className="rounded-2xl border border-gold/40 bg-void-950/85 px-5 py-2 font-display text-xl font-black text-gold backdrop-blur">
                  {result.total.toFixed(2)}× · ◎{(bet * result.total).toFixed(4)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/15 text-gold"><Icon name="gem" size={16} /></span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Goldmine Express</div>
              <div className="text-[0.68rem] text-slate-500">{COLS}×{ROWS} · pays anywhere · cascades</div>
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={phase !== 'idle' && phase !== 'done'} />

          <BetButton guard={g} onClick={spin} busy={phase !== 'idle' && phase !== 'done'}>
            Dig ◎{bet}
          </BetButton>

          <Paytable cfg={cfg} />
        </div>
      }
    />
  );
}

/** A losing spin still shows the grid the engine drew, rather than a blank seam. */
function dryGrid(seeds: { serverSeed: string; clientSeed: string; nonce: number }, cfg: SlotConfig): number[][] {
  const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
  const total = cfg.weights.reduce((a, b) => a + b, 0);
  const draw = () => {
    const u = stream.next() * total;
    let acc = 0;
    for (let i = 0; i < cfg.weights.length; i++) {
      acc += cfg.weights[i];
      if (u < acc) return i === cfg.weights.length - 1 ? SCATTER : i;
    }
    return 0;
  };
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, draw));
}

function Paytable({ cfg }: { cfg: SlotConfig }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">Paytable</span>
        <span className="text-[0.6rem] text-slate-600">{cfg.minCluster}+ anywhere</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {SYMBOLS.filter((s) => s.id !== SCATTER).slice().reverse().map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <MineSymbol sym={s.id} size={20} />
            <span className="font-mono text-[0.62rem] text-slate-400">
              {(cfg.pays[s.id][0] * cfg.payScale).toFixed(1)} / {(cfg.pays[s.id][1] * cfg.payScale).toFixed(1)} / {(cfg.pays[s.id][2] * cfg.payScale).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.05] pt-2">
        <MineSymbol sym={SCATTER} size={20} />
        <span className="text-[0.62rem] text-slate-400">
          {cfg.scattersForBonus}+ dynamite opens the Express run — the multiplier never resets
        </span>
      </div>
    </div>
  );
}
