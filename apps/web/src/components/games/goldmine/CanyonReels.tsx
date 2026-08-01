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
 * The reel window of the canyon machine — parchment tiles in a gilded wooden
 * frame, like the reference game's bright reels. The travelling-band deal is
 * identical to the DOM machine (same reelPlan), only the wardrobe changed.
 */

const SETTLE_MS = 170;
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
    <div className="relative h-[196px] w-[56px] overflow-hidden sm:h-[236px] sm:w-[68px] lg:h-[264px] lg:w-[76px]">
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
            ? { filter: ['blur(4.5px)', 'blur(3.2px)', 'blur(0px)'], scaleY: [1.16, 1.1, 1] }
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
          background: 'linear-gradient(160deg,#f7e8c9 0%,#ecd3a3 55%,#d9b47e 100%)',
          boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.65), inset 0 -2px 5px rgba(122,72,20,0.35), 0 2px 5px rgba(60,35,8,0.45)',
          border: '1.5px solid #b48a3c',
        }}
      >
        <CanyonSymbol sym={sym} size={44} cash={cash} trainColor={trainColor} />
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

/* -------------------------------------------------------------- the window */

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
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(180deg,#6b4a22 0%,#4a2f14 50%,#33200e 100%)',
        boxShadow: 'inset 0 2px 0 rgba(255,220,150,0.35), inset 0 -3px 8px rgba(0,0,0,0.5), 0 18px 40px -14px rgba(0,0,0,0.7)',
        border: '2px solid #8a6528',
      }}
    >
      <motion.div
        animate={anticipating ? { x: [0, -1.5, 1.5, -1, 0] } : { x: 0 }}
        transition={anticipating ? { duration: 0.28, repeat: Infinity } : { duration: 0.2 }}
        className="flex gap-[3px] p-2"
        style={{ background: 'linear-gradient(180deg,rgba(46,29,10,0.7),rgba(30,18,6,0.85))' }}
      >
        {Array.from({ length: REELS }).map((_, r) => (
          <div key={r} className="relative rounded-lg" style={{ background: 'linear-gradient(180deg,#2e1d0c,#1c1006)' }}>
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

      {/* glass: soft top shadow + diagonal sheen */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            'linear-gradient(180deg,rgba(30,18,6,0.45),rgba(0,0,0,0) 14%,rgba(0,0,0,0) 86%,rgba(30,18,6,0.5)),' +
            'linear-gradient(112deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0) 34%,rgba(255,255,255,0) 66%,rgba(255,255,255,0.05) 100%)',
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
