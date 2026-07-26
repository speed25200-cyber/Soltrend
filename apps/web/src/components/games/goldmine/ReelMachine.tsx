'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MineSymbol } from './MineSymbol';
import { REELS, ROWS, WAGON, WILD, type WayWin } from '@/lib/slots/goldmine';

/**
 * The reel head of Goldmine Express.
 *
 * A slot only feels like a slot when the reels genuinely *travel*: a long band
 * of ore blurs past, each reel brakes in turn with a mechanical overshoot, and
 * the last ones hang when the wagons are on pace. None of that touches the
 * outcome — the round was decided by the reserved seed before a pixel moved —
 * but it is the entire difference between a payout being printed on screen and
 * a payout being *dealt*.
 *
 * The reel band is measured in percentages of its own height rather than in
 * pixels, so the same transform is exact at every breakpoint.
 */

/** How long reel 1 travels before braking. */
const FIRST_STOP_MS = 660;
/** Gap between one reel braking and the next. */
const STAGGER_MS = 145;
/** Extra hang added to a reel while the wagons are still on pace. */
const ANTICIPATION_MS = 820;
/** Tail after the last reel lands, for the bounce to settle. */
const SETTLE_MS = 170;
/** Band speed, in symbols per second — sets how long each band has to be. */
const SYMBOLS_PER_SEC = 26;

export interface ReelPlan {
  /** Millisecond at which each reel comes to rest. */
  stops: number[];
  /** Reels that hang because the gold wagons are still on pace. */
  antic: boolean[];
  /** Total time from spin to fully settled. */
  total: number;
}

/**
 * Work out the braking schedule for one grid.
 *
 * The anticipation rule is the honest one: a reel only hangs when the wagons
 * that have *already landed* keep the trigger on pace. It reads the same grid
 * the engine produced, so the tease is never manufactured — when the reels hang,
 * the run really was still live.
 */
export function reelPlan(grid: number[][] | null, trigger: number): ReelPlan {
  const antic: boolean[] = [];
  const stops: number[] = [];
  let landed = 0;

  for (let r = 0; r < REELS; r++) {
    const onPace = grid ? landed >= Math.max(2, Math.ceil((trigger * r) / REELS)) : false;
    antic.push(r >= 2 && onPace);
    stops.push(r === 0 ? FIRST_STOP_MS : stops[r - 1] + STAGGER_MS + (antic[r] ? ANTICIPATION_MS : 0));
    if (grid) landed += grid[r].filter((s) => s === WAGON).length;
  }
  return { stops, antic, total: stops[REELS - 1] + SETTLE_MS };
}

/** Cells that took part in a win — reels 0..length-1, matching symbol or lantern. */
export function winningCells(grid: number[][] | null, wins: WayWin[]): Set<string> {
  const set = new Set<string>();
  if (!grid) return set;
  for (const w of wins) {
    for (let r = 0; r < w.length; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (grid[r]?.[row] === w.sym || grid[r]?.[row] === WILD) set.add(`${r}:${row}`);
      }
    }
  }
  return set;
}

/* ----------------------------------------------------------------- the band */

/** Deterministic filler drawn from the real symbol weights, minus the wagon —
 *  a band that showed wagons at rest density would tease on every single spin. */
function buildBand(weights: number[], count: number, seed: number): number[] {
  const w = weights.map((x, i) => (i === WAGON ? x * 0.22 : x));
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
  final: number[];
  stopAt: number;
  antic: boolean;
  weights: number[];
  spinKey: number;
  spinning: boolean;
  /** Set of "reel:row" keys that won — empty means no dimming. */
  lit: Set<string>;
  showWins: boolean;
}

function Reel({ index, final, stopAt, antic, weights, spinKey, spinning, lit, showWins }: ReelProps) {
  const band = useMemo(
    () => buildBand(weights, Math.max(12, Math.round((stopAt / 1000) * SYMBOLS_PER_SEC)), spinKey * 31 + index),
    [weights, stopAt, spinKey, index],
  );

  // Strip = [final rows, then the band]. Travelling from -band% to 0 slides the
  // band past the window and drops the final rows into place.
  const cells = [...final, ...band];
  const unit = 100 / cells.length; // one symbol, as a share of the strip
  const travel = unit * band.length;
  const bounce = unit * 0.3;
  const dur = stopAt / 1000;

  // Window height is exactly ROWS pitches, so the band is clipped to four symbols.
  return (
    <div className="relative h-[208px] w-[52px] overflow-hidden sm:h-[264px] sm:w-[66px] lg:h-[296px] lg:w-[74px]">
      {/* the band */}
      <motion.div
        key={`${spinKey}-${index}`}
        initial={spinning ? { y: `-${travel}%` } : { y: '0%' }}
        animate={spinning ? { y: [`-${travel}%`, `-${travel * 0.1}%`, `${bounce}%`, '0%'] } : { y: '0%' }}
        transition={
          spinning
            ? { duration: dur, times: [0, 0.74, 0.93, 1], ease: ['linear', 'easeOut', 'easeOut'] }
            : { duration: 0 }
        }
        className="will-change-transform"
      >
        {cells.map((sym, i) => (
          <Cell
            key={i}
            sym={sym}
            blurring={spinning}
            blurDur={dur}
            dim={showWins && lit.size > 0 && i < ROWS && !lit.has(`${index}:${i}`)}
            hit={showWins && i < ROWS && lit.has(`${index}:${i}`)}
            wagon={!spinning && i < ROWS && sym === WAGON}
          />
        ))}
      </motion.div>

      {/* the hang: a gold column breathing while the wagons are still on pace */}
      {spinning && antic && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.3, 0.85, 0] }}
          transition={{ duration: dur, times: [0, 0.5, 0.68, 0.86, 1] }}
          style={{
            background: 'linear-gradient(180deg,rgba(252,211,77,0.22),rgba(252,211,77,0.05) 45%,rgba(252,211,77,0.22))',
            boxShadow: 'inset 0 0 0 1.5px rgba(252,211,77,0.55)',
          }}
        />
      )}
    </div>
  );
}

function Cell({
  sym, blurring, blurDur, dim, hit, wagon,
}: { sym: number; blurring: boolean; blurDur: number; dim: boolean; hit: boolean; wagon: boolean }) {
  // Every cell is exactly one pitch tall, which is what makes the percentage
  // travel above land on a symbol boundary at any screen size.
  return (
    <div className="relative grid h-[52px] w-[52px] place-items-center sm:h-[66px] sm:w-[66px] lg:h-[74px] lg:w-[74px]">
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
        className="grid place-items-center will-change-transform"
      >
        {/* the scale lives outside the animated node — framer owns that transform */}
        <span className="block origin-center lg:scale-[1.16]">
          <MineSymbol sym={sym} size={42} />
        </span>
      </motion.div>

      {hit && (
        <motion.span
          className="pointer-events-none absolute inset-[9%] rounded-xl"
          animate={{ opacity: [0.25, 0.9, 0.25] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ boxShadow: 'inset 0 0 0 2px rgba(252,211,77,0.9), 0 0 22px -4px rgba(252,211,77,0.9)' }}
        />
      )}
      {wagon && (
        <motion.span
          className="pointer-events-none absolute inset-[6%] rounded-xl"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.05, repeat: Infinity }}
          style={{ boxShadow: 'inset 0 0 0 2px rgba(253,224,71,0.95), 0 0 26px -4px rgba(253,224,71,0.85)' }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- the cabinet */

export interface ReelWindowProps {
  grid: number[][] | null;
  weights: number[];
  plan: ReelPlan;
  spinning: boolean;
  spinKey: number;
  wins: WayWin[];
  showWins: boolean;
}

/** The reel window: five bands behind glass, in a lit cabinet. */
export function ReelWindow({ grid, weights, plan, spinning, spinKey, wins, showWins }: ReelWindowProps) {
  const lit = useMemo(() => (showWins ? winningCells(grid, wins) : new Set<string>()), [grid, wins, showWins]);
  // Before the first spin the reels still have to look like reels, so the resting
  // face is drawn from the same weighted band rather than one repeated column.
  const idle = useMemo(
    () => Array.from({ length: REELS }, (_, r) => buildBand(weights, ROWS, 7 + r * 13)),
    [weights],
  );
  const anticipating = spinning && plan.antic.some(Boolean);

  return (
    <Cabinet lit={showWins && lit.size > 0} anticipating={anticipating} spinning={spinning}>
      <div className="relative overflow-hidden rounded-xl bg-[#06040a]">
        <div className="flex gap-px">
          {Array.from({ length: REELS }).map((_, r) => (
            <div key={r} className="relative bg-gradient-to-b from-[#150e07] via-[#0b0710] to-[#150e07]">
              <Reel
                index={r}
                final={grid?.[r] ?? idle[r]}
                stopAt={plan.stops[r]}
                antic={plan.antic[r]}
                weights={weights}
                spinKey={spinKey}
                spinning={spinning}
                lit={lit}
                showWins={showWins}
              />
            </div>
          ))}
        </div>

        {/* glass: depth above and below, a diagonal sheen, and a scanline grain */}
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
        {/* light sweep across the glass on a win */}
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
    </Cabinet>
  );
}

/** The machine around the glass — brass frame, marquee lamps, bottom lip. */
export function Cabinet({
  children, lit, anticipating, spinning, title = 'Goldmine Express',
}: {
  children: React.ReactNode;
  lit?: boolean;
  anticipating?: boolean;
  spinning?: boolean;
  title?: string;
}) {
  const lamps = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);

  return (
    <motion.div
      animate={anticipating ? { x: [0, -1.5, 1.5, -1, 0] } : { x: 0 }}
      transition={anticipating ? { duration: 0.28, repeat: Infinity } : { duration: 0.2 }}
      className="w-fit max-w-full rounded-[1.4rem] p-[2px]"
      style={{
        background: 'linear-gradient(180deg,#e6b455 0%,#8a5f22 22%,#2a1a08 60%,#120a03 100%)',
        boxShadow: lit
          ? '0 0 60px -12px rgba(252,211,77,0.55), 0 24px 60px -24px rgba(0,0,0,0.9)'
          : '0 24px 60px -28px rgba(0,0,0,0.9)',
      }}
    >
      <div className="rounded-[1.28rem] border border-black/60 bg-[linear-gradient(180deg,#241708_0%,#150d05_45%,#0b0703_100%)] px-2 pb-2 pt-1.5 sm:px-2.5 sm:pb-2.5">
        {/* marquee */}
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <div className="flex flex-1 items-center gap-[3px]">
            {lamps.map((i) => (
              <motion.span
                key={i}
                className="h-[3px] flex-1 rounded-full bg-amber-300/25"
                animate={spinning ? { opacity: [0.2, 1, 0.2] } : { opacity: lit ? [0.3, 1, 0.3] : 0.28 }}
                transition={
                  spinning
                    ? { duration: 0.7, repeat: Infinity, delay: (i % 7) * 0.07 }
                    : lit
                      ? { duration: 0.55, repeat: Infinity, delay: (i % 4) * 0.09 }
                      : { duration: 0.3 }
                }
              />
            ))}
          </div>
          <span
            className="shrink-0 font-display text-[0.58rem] font-black uppercase tracking-[0.32em] sm:text-[0.66rem]"
            style={{
              color: '#fde68a',
              textShadow: '0 0 14px rgba(252,211,77,0.55), 0 1px 0 rgba(0,0,0,0.8)',
            }}
          >
            {title}
          </span>
          <div className="flex flex-1 items-center gap-[3px]">
            {lamps.map((i) => (
              <motion.span
                key={i}
                className="h-[3px] flex-1 rounded-full bg-amber-300/25"
                animate={spinning ? { opacity: [0.2, 1, 0.2] } : { opacity: lit ? [0.3, 1, 0.3] : 0.28 }}
                transition={
                  spinning
                    ? { duration: 0.7, repeat: Infinity, delay: ((13 - i) % 7) * 0.07 }
                    : lit
                      ? { duration: 0.55, repeat: Infinity, delay: (i % 4) * 0.09 }
                      : { duration: 0.3 }
                }
              />
            ))}
          </div>
        </div>

        {children}

        {/* bottom lip: rivets on a brass rail */}
        <div className="mt-1.5 flex items-center justify-between rounded-lg bg-[linear-gradient(180deg,#3a2510,#170e05)] px-2 py-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-amber-200/30 shadow-[0_0_4px_rgba(252,211,77,0.4)]" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
