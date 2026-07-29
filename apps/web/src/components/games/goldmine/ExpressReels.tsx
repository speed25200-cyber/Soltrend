'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ExpressSymbol } from './ExpressSymbols';
import {
  REELS, ROWS, REEL_WEIGHTS, GOLDMINE, TRAIN, BELL, GTRAIN, SCATTER, PAYLINES,
  type GXSpin, type LineWin, type TrainColor,
} from '@/lib/slots/gold-express';

/**
 * The reel head of Gold Mine Express — five travelling bands behind glass,
 * braking one at a time, hanging when a feature is genuinely on pace. Same
 * principle as the original machine: the outcome was fixed by the reserved
 * seed before anything moved; the reels are how it is *dealt*, not decided.
 */

const FIRST_STOP_MS = 640;
const STAGGER_MS = 150;
const ANTICIPATION_MS = 900;
const SETTLE_MS = 170;
const SYMBOLS_PER_SEC = 26;

export interface ReelPlan {
  stops: number[];
  antic: boolean[];
  total: number;
}

/**
 * The honest hang: a reel only holds when the grid the engine produced really
 * is on pace — gold stacked on reels 1-4 with reel 5 still to land (the Bell
 * tease), trains aboard awaiting a collector, or dynamite on 1 and 3 with
 * reel 5 to come.
 */
export function reelPlan(spin: GXSpin | null, fast = false): ReelPlan {
  const first = fast ? 380 : FIRST_STOP_MS;
  const stagger = fast ? 90 : STAGGER_MS;
  const antic: boolean[] = [];
  const stops: number[] = [];
  let mines = 0;
  let trains = 0;
  const scatterOn = (r: number) => (spin ? spin.grid[r].includes(SCATTER) : false);

  for (let r = 0; r < REELS; r++) {
    let hang = false;
    if (spin && r >= 2) {
      if (r < REELS - 1) hang = mines >= 2; // gold collecting on pace
      else hang = mines >= 1 || trains >= 1 || (scatterOn(0) && scatterOn(2));
    }
    antic.push(hang);
    stops.push(r === 0 ? first : stops[r - 1] + stagger + (hang ? ANTICIPATION_MS : 0));
    if (spin) {
      mines += spin.grid[r].filter((s) => s === GOLDMINE).length;
      trains += spin.grid[r].filter((s) => s === TRAIN).length;
    }
  }
  return { stops, antic, total: stops[REELS - 1] + SETTLE_MS };
}

/** Cells lit by a line win: every cell on a winning line up to the win length. */
export function litCells(spin: GXSpin | null, wins: LineWin[]): Set<string> {
  const out = new Set<string>();
  if (!spin) return out;
  for (const w of wins) {
    const line = PAYLINES[w.line];
    for (let r = 0; r < w.length; r++) out.add(`${r}:${line[r]}`);
  }
  return out;
}

/* ------------------------------------------------------------------ band */

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
    <div className="relative h-[208px] w-[54px] overflow-hidden sm:h-[264px] sm:w-[68px] lg:h-[296px] lg:w-[76px]">
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
          animate={{ opacity: [0, 0.9, 0.3, 0.9, 0] }}
          transition={{ duration: dur, times: [0, 0.5, 0.68, 0.86, 1] }}
          style={{
            background: 'linear-gradient(180deg,rgba(252,211,77,0.25),rgba(252,211,77,0.05) 45%,rgba(252,211,77,0.25))',
            boxShadow: 'inset 0 0 0 1.5px rgba(252,211,77,0.6)',
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
    <div className="relative grid h-[52px] w-[54px] place-items-center sm:h-[66px] sm:w-[68px] lg:h-[74px] lg:w-[76px]">
      <motion.div
        animate={
          blurring
            ? { filter: ['blur(4.5px)', 'blur(3.2px)', 'blur(0px)'], scaleY: [1.16, 1.1, 1] }
            : { filter: 'blur(0px)', scaleY: 1, opacity: dim ? 0.28 : 1, scale: hit ? [1, 1.16, 1] : 1 }
        }
        transition={
          blurring
            ? { duration: blurDur, times: [0, 0.74, 0.95] }
            : hit
              ? { duration: 0.5, repeat: Infinity, repeatDelay: 0.35 }
              : { duration: 0.25 }
        }
        className="relative grid place-items-center will-change-transform"
      >
        <span className="block origin-center lg:scale-[1.16]">
          <ExpressSymbol sym={sym} size={44} trainColor={trainColor} />
        </span>
        {cash !== null && (
          <span
            className="absolute -bottom-0.5 rounded-md border border-amber-300/60 bg-black/75 px-1 font-mono text-[0.6rem] font-black text-amber-300"
            style={{ textShadow: '0 0 8px rgba(252,211,77,0.8)' }}
          >
            {cash.toFixed(cash < 2 ? 2 : 1)}×
          </span>
        )}
      </motion.div>

      {hit && (
        <motion.span
          className="pointer-events-none absolute inset-[9%] rounded-xl"
          animate={{ opacity: [0.25, 0.9, 0.25] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ boxShadow: 'inset 0 0 0 2px rgba(252,211,77,0.9), 0 0 22px -4px rgba(252,211,77,0.9)' }}
        />
      )}
      {collected && (
        <motion.span
          className="pointer-events-none absolute inset-[6%] rounded-xl"
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.06, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          style={{ boxShadow: 'inset 0 0 0 2px rgba(253,224,71,0.95), 0 0 28px -4px rgba(253,224,71,0.9)' }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- the window */

export interface ExpressReelsProps {
  spin: GXSpin | null;
  plan: ReelPlan;
  spinning: boolean;
  spinKey: number;
  free: boolean;
  showWins: boolean;
  collected: boolean;
}

export function ExpressReels({ spin, plan, spinning, spinKey, free, showWins, collected }: ExpressReelsProps) {
  const lit = useMemo(() => (showWins ? litCells(spin, spin?.lineWins ?? []) : new Set<string>()), [spin, showWins]);
  const anticipating = spinning && plan.antic.some(Boolean);

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#06040a]">
      <motion.div
        animate={anticipating ? { x: [0, -1.5, 1.5, -1, 0] } : { x: 0 }}
        transition={anticipating ? { duration: 0.28, repeat: Infinity } : { duration: 0.2 }}
        className="flex gap-px"
      >
        {Array.from({ length: REELS }).map((_, r) => (
          <div key={r} className="relative bg-gradient-to-b from-[#150e07] via-[#0b0710] to-[#150e07]">
            <Reel
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
          </div>
        ))}
      </motion.div>

      {/* glass */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg,rgba(0,0,0,0.72),rgba(0,0,0,0) 16%,rgba(0,0,0,0) 84%,rgba(0,0,0,0.72)),' +
            'linear-gradient(112deg,rgba(255,255,255,0.09) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,0) 62%,rgba(255,255,255,0.05) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.35) 0 1px,transparent 1px 3px)' }}
      />
      {showWins && lit.size > 0 && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/3"
          initial={{ x: '-120%' }}
          animate={{ x: '340%' }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
          style={{ background: 'linear-gradient(100deg,transparent,rgba(255,236,170,0.16),transparent)' }}
        />
      )}
    </div>
  );
}
