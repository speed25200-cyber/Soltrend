'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CanyonSymbol } from './CanyonSymbols';
import {
  REELS, ROWS, REEL_WEIGHTS, GOLDMINE, TRAIN, BELL, GTRAIN, PAYLINES,
  type GXSpin, type LineWin, type TrainColor,
} from '@/lib/slots/gold-express';
import { reelPlan } from './ExpressReels';

/**
 * The reel window of the canyon machine — a cabinet-maker's object: honeyed
 * wood with visible grain, brass corners and rivets, five recessed channels
 * the reels travel in, parchment tiles with real drop shadows, and a glass
 * pane that catches the sun. The travelling-band deal is identical to the
 * DOM machine (same reelPlan); everything here is realism.
 */

const SYMBOLS_PER_SEC = 26;

/** Cells lit by a line win. */
function litCells(spin: GXSpin | null, wins: LineWin[]): Set<string> {
  const out = new Set<string>();
  if (!spin) return out;
  for (const w of wins) {
    const line = PAYLINES[w.line];
    for (let r = 0; r < w.length; r++) out.add(`${r}:${line[r]}`);
  }
  return out;
}

/** Deterministic filler — the band shows everything but at teaser-safe density. */
function buildBand(weights: number[], count: number, seed: number): number[] {
  const w = weights.map((x, i) =>
    i === GOLDMINE ? x * 0.5 : i === TRAIN ? x * 0.5 : i === BELL || i === GTRAIN ? x * 0.35 : x,
  );
  const total = w.reduce((a, b) => a + b, 0);
  let s = (seed * 2654435761) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    let t = (s / 4294967296) * total;
    let pick = 0;
    for (let k = 0; k < w.length; k++) {
      t -= w[k];
      if (t < 0) { pick = k; break; }
    }
    out.push(pick);
  }
  return out;
}

interface ReelProps {
  index: number;
  spin: GXSpin | null;
  stopAt: number;
  antic: boolean;
  spinKey: number;
  spinning: boolean;
  free: boolean;
  lit: Set<string>;
  showWins: boolean;
  collected: boolean;
}

function Reel({ index, spin, stopAt, antic, spinKey, spinning, free, lit, showWins, collected }: ReelProps) {
  const weights = (free ? REEL_WEIGHTS.free : REEL_WEIGHTS.base)[index];
  const band = useMemo(
    () => buildBand(weights, Math.max(12, Math.round((stopAt / 1000) * SYMBOLS_PER_SEC)), spinKey * 31 + index),
    [weights, stopAt, spinKey, index],
  );

  const final = spin?.grid[index] ?? null;
  const cells = final ? [...final, ...band] : band;
  const unit = 100 / cells.length;
  const travel = final ? unit * band.length : 0;
  const bounce = unit * 0.3;
  const dur = stopAt / 1000;

  return (
    <div
      className="relative h-[196px] w-[56px] overflow-hidden rounded-md sm:h-[236px] sm:w-[68px] lg:h-[264px] lg:w-[76px]"
      style={{
        // the recessed channel the reel travels in — dark groove, lit edges
        background: 'linear-gradient(180deg,#170d04 0%,#241307 50%,#170d04 100%)',
        boxShadow:
          'inset 0 6px 14px rgba(0,0,0,0.85), inset 0 -6px 14px rgba(0,0,0,0.85), inset 3px 0 6px rgba(0,0,0,0.5), inset -3px 0 6px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,220,150,0.14)',
      }}
    >
      <motion.div
        key={`${spinKey}-${index}`}
        initial={spinning ? { y: `-${travel}%` } : { y: '0%' }}
        animate={spinning ? { y: [`-${travel}%`, `-${travel * 0.1}%`, `${bounce}%`, '0%'] } : { y: '0%' }}
        transition={spinning ? { duration: dur, times: [0, 0.74, 0.93, 1], ease: ['linear', 'easeOut', 'easeOut'] } : { duration: 0 }}
        className="will-change-transform"
      >
        {cells.map((sym, i) => {
          const isFinal = final !== null && i < ROWS;
          const row = i;
          const key = `${index}:${row}`;
          const cash = isFinal && sym === GOLDMINE ? spin!.cash[index][row] : null;
          const color = isFinal && sym === TRAIN ? spin!.trains[index][row] : null;
          return (
            <Cell
              key={i}
              sym={sym}
              cash={cash}
              trainColor={color}
              blurring={spinning}
              blurDur={dur}
              dim={showWins && lit.size > 0 && isFinal && !lit.has(key)}
              hit={showWins && isFinal && lit.has(key)}
              collected={collected && isFinal && sym === GOLDMINE}
            />
          );
        })}
      </motion.div>

      {spinning && antic && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.35, 0.9, 0] }}
          transition={{ duration: dur, times: [0, 0.5, 0.68, 0.86, 1] }}
          style={{
            background: 'linear-gradient(180deg,rgba(252,211,77,0.35),rgba(252,211,77,0.08) 45%,rgba(252,211,77,0.35))',
            boxShadow: 'inset 0 0 0 2px rgba(252,211,77,0.85), 0 0 22px rgba(252,211,77,0.5)',
          }}
        />
      )}
    </div>
  );
}

function Cell({
  sym, cash, trainColor, blurring, blurDur, dim, hit, collected,
}: {
  sym: number;
  cash: number | null;
  trainColor: TrainColor | null;
  blurring: boolean;
  blurDur: number;
  dim: boolean;
  hit: boolean;
  collected: boolean;
}) {
  return (
    <div className="relative grid h-[49px] w-[56px] place-items-center sm:h-[59px] sm:w-[68px] lg:h-[66px] lg:w-[76px]">
      <motion.div
        animate={
          blurring
            ? { filter: ['blur(5px)', 'blur(3.2px)', 'blur(0px)'], scaleY: [1.18, 1.1, 1] }
            : { filter: 'blur(0px)', scaleY: 1, opacity: dim ? 0.3 : 1, scale: hit ? [1, 1.14, 1] : 1 }
        }
        transition={
          blurring
            ? { duration: blurDur, times: [0, 0.74, 0.95] }
            : hit
              ? { duration: 0.5, repeat: Infinity, repeatDelay: 0.35 }
              : { duration: 0.25 }
        }
        className="relative grid h-[88%] w-[88%] place-items-center rounded-lg will-change-transform"
        style={{
          background: 'linear-gradient(160deg,#faf0d8 0%,#f0dcae 50%,#dfbd85 100%)',
          boxShadow:
            'inset 0 2px 0 rgba(255,255,255,0.8), inset 0 -3px 6px rgba(122,72,20,0.4), 0 3px 7px rgba(30,16,4,0.55), 0 1px 1px rgba(30,16,4,0.4)',
          border: '1.5px solid #b48a3c',
        }}
      >
        {/* ambient occlusion at the tile's edges */}
        <span
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{ boxShadow: 'inset 0 0 10px rgba(122,72,20,0.28)' }}
        />
        <span style={{ filter: 'drop-shadow(0 2.5px 2.5px rgba(30,16,4,0.45))' }}>
          <CanyonSymbol sym={sym} size={44} cash={cash} trainColor={trainColor} />
        </span>
      </motion.div>

      {hit && (
        <motion.span
          className="pointer-events-none absolute inset-[2%] rounded-lg"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          style={{ boxShadow: 'inset 0 0 0 2.5px rgba(255,215,110,0.95), 0 0 22px -2px rgba(255,200,80,0.95)' }}
        />
      )}
      {collected && (
        <motion.span
          className="pointer-events-none absolute inset-[2%] rounded-lg"
          animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.05, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          style={{ boxShadow: 'inset 0 0 0 2.5px rgba(253,224,71,1), 0 0 26px -2px rgba(253,224,71,0.95)' }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ the cabinet */

function BrassCorner({ pos }: { pos: string }) {
  return (
    <svg className={`pointer-events-none absolute ${pos} z-10`} width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <defs>
        <linearGradient id="bc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d98b" />
          <stop offset="0.5" stopColor="#c9a35a" />
          <stop offset="1" stopColor="#8a6528" />
        </linearGradient>
      </defs>
      <path d="M2 28 L2 8 Q2 2 8 2 L28 2 L28 6 L8 6 Q6 6 6 8 L6 28 Z" fill="url(#bc)" />
      <circle cx="9" cy="9" r="2.6" fill="#5b3a10" />
      <circle cx="8.4" cy="8.4" r="1" fill="#ffe9a8" />
    </svg>
  );
}

function RivetRow({ className, count = 9 }: { className: string; count?: number }) {
  return (
    <div className={`pointer-events-none absolute flex justify-between px-2 ${className} z-10`}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #ffe9a8, #8a6528 70%)',
            boxShadow: '0 1px 1px rgba(0,0,0,0.6), inset 0 -1px 1px rgba(0,0,0,0.5)',
          }}
        />
      ))}
    </div>
  );
}

export interface CanyonReelsProps {
  spin: GXSpin | null;
  plan: ReturnType<typeof reelPlan>;
  spinning: boolean;
  spinKey: number;
  free: boolean;
  showWins: boolean;
  collected: boolean;
}

export function CanyonReels({ spin, plan, spinning, spinKey, free, showWins, collected }: CanyonReelsProps) {
  const lit = useMemo(() => (showWins ? litCells(spin, spin?.lineWins ?? []) : new Set<string>()), [spin, showWins]);
  const anticipating = spinning && plan.antic.some(Boolean);

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-[3px]"
      style={{
        // honeyed wood with visible grain + a soft outer shadow
        background:
          'repeating-linear-gradient(94deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 9px), repeating-linear-gradient(87deg, rgba(255,235,190,0.05) 0 1px, transparent 1px 13px), linear-gradient(180deg,#8a5f2c 0%,#6b4a22 45%,#4a2f14 80%,#33200e 100%)',
        boxShadow:
          'inset 0 2px 0 rgba(255,220,150,0.4), inset 0 -4px 10px rgba(0,0,0,0.55), inset 3px 0 8px rgba(0,0,0,0.25), 0 22px 44px -14px rgba(20,10,2,0.85)',
        border: '2px solid #6e4c1c',
      }}
    >
      <BrassCorner pos="left-1 top-1" />
      <BrassCorner pos="right-1 top-1 -scale-x-100" />
      <BrassCorner pos="left-1 bottom-1 -scale-y-100" />
      <BrassCorner pos="right-1 bottom-1 -scale-x-100 -scale-y-100" />
      <RivetRow className="inset-x-0 top-1.5" />
      <RivetRow className="inset-x-0 bottom-1.5" />

      <motion.div
        animate={anticipating ? { x: [0, -1.5, 1.5, -1, 0] } : { x: 0 }}
        transition={anticipating ? { duration: 0.28, repeat: Infinity } : { duration: 0.2 }}
        className="flex gap-[3px] rounded-xl p-1.5"
        style={{ background: 'linear-gradient(180deg,rgba(40,24,8,0.85),rgba(26,15,5,0.9))', boxShadow: 'inset 0 3px 12px rgba(0,0,0,0.8)' }}
      >
        {Array.from({ length: REELS }).map((_, r) => (
          <Reel
            key={r}
            index={r}
            spin={spin}
            stopAt={plan.stops[r]}
            antic={plan.antic[r]}
            spinKey={spinKey}
            spinning={spinning}
            free={free}
            lit={lit}
            showWins={showWins}
            collected={collected}
          />
        ))}
      </motion.div>

      {/* the glass pane: edge shadows + two angled reflections */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            'linear-gradient(180deg,rgba(20,10,2,0.5),rgba(0,0,0,0) 12%,rgba(0,0,0,0) 88%,rgba(20,10,2,0.55)),' +
            'linear-gradient(112deg,rgba(255,255,255,0.13) 0%,rgba(255,255,255,0) 30%,rgba(255,255,255,0) 62%,rgba(255,255,255,0.06) 100%)',
        }}
      />
      {showWins && lit.size > 0 && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/3"
          initial={{ x: '-120%' }}
          animate={{ x: '340%' }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
          style={{ background: 'linear-gradient(100deg,transparent,rgba(255,236,170,0.22),transparent)' }}
        />
      )}
    </div>
  );
}
