/**
 * Generic game engine. Every "Original" is pure math on top of the
 * provably-fair float stream, so the same code powers both the built-in games
 * and any UGC GameSpec (§7 of the design doc).
 *
 * House-edge is ALWAYS applied here and is bounded — a game can never be
 * configured to pay more than fair, nor to rob the player beyond MAX_EDGE.
 */

import { firstFloat, floatStream, shuffledIndices } from './provably-fair';

export const MIN_EDGE = 0.01; // 1%
export const MAX_EDGE = 0.05; // 5%
export const DEFAULT_EDGE = 0.01;

/**
 * The largest multiplier any single round may pay. This mirrors the vault's
 * `max_payout_lamports` — a client that quotes past it is promising a payout the
 * chain will refuse to settle.
 */
export const MAX_MULTIPLIER = 1000;

export function clampEdge(edge: number): number {
  return Math.min(MAX_EDGE, Math.max(MIN_EDGE, edge));
}

export type Template = 'dice' | 'limbo' | 'coinflip' | 'wheel' | 'mines' | 'plinko' | 'towers' | 'graph' | 'board' | 'slots';

/* ----------------------------------------------------------------------- Dice */

export interface DiceResult {
  roll: number; // 0.00 – 99.99
  win: boolean;
  multiplier: number;
  payout: number;
}

/** Roll 0–100; win if (over ? roll > target : roll < target). */
export function playDice(
  bet: number,
  target: number,
  over: boolean,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
  edge = DEFAULT_EDGE,
): DiceResult {
  const roll = Math.floor(firstFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce) * 10000) / 100;
  const winChance = over ? 100 - target : target; // percent
  const win = over ? roll > target : roll < target;
  const multiplier = winChance > 0 ? ((100 - clampEdge(edge) * 100) / winChance) : 0;
  return { roll, win, multiplier, payout: win ? round2(bet * multiplier) : 0 };
}

export function diceMultiplier(target: number, over: boolean, edge = DEFAULT_EDGE): number {
  const winChance = over ? 100 - target : target;
  return winChance > 0 ? (100 - clampEdge(edge) * 100) / winChance : 0;
}

/* ---------------------------------------------------------------------- Limbo */

export interface LimboResult {
  crashPoint: number;
  win: boolean;
  multiplier: number;
  payout: number;
}

/** Instant crash: reveal a point; win if it reaches the player's target. */
export function playLimbo(
  bet: number,
  target: number,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
  edge = DEFAULT_EDGE,
): LimboResult {
  const crashPoint = crashPointFromFloat(
    firstFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce),
    edge,
  );
  const win = crashPoint >= target;
  return { crashPoint, win, multiplier: target, payout: win ? round2(bet * target) : 0 };
}

/** P(point ≥ x) = (1 - edge) / x  →  house edge exactly `edge`, unbounded upside. */
export function crashPointFromFloat(float: number, edge = DEFAULT_EDGE): number {
  const e = clampEdge(edge);
  const raw = (1 - e) / (1 - Math.min(0.9999999, float));
  return Math.max(1, Math.floor(raw * 100) / 100);
}

/* ------------------------------------------------------------------- Coinflip */

export interface CoinflipResult {
  heads: boolean;
  win: boolean;
  multiplier: number;
  payout: number;
}

export function playCoinflip(
  bet: number,
  pickHeads: boolean,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
  edge = DEFAULT_EDGE,
): CoinflipResult {
  const heads = firstFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce) < 0.5;
  const win = heads === pickHeads;
  const multiplier = 2 * (1 - clampEdge(edge));
  return { heads, win, multiplier, payout: win ? round2(bet * multiplier) : 0 };
}

/* ----------------------------------------------------------------------- Wheel */

export interface WheelSegment {
  multiplier: number;
  color: string;
  weight: number;
}

/** Slots per turn of the wheel. Every slot is equally likely, so the odds a
 *  player sees on the rim are the odds they get. */
export const WHEEL_SEGMENTS = 30;

/**
 * The wheel's shape: how many of the 30 slots carry each payout tier. Counts
 * must sum to WHEEL_SEGMENTS so every slot is 1/30 — a weighted wheel would be
 * one whose displayed rim does not match its real odds.
 */
export const WHEEL_RINGS: Record<'low' | 'medium' | 'high', { mult: number; color: string; count: number }[]> = {
  low: [
    { mult: 0, color: 'loss', count: 10 },
    { mult: 1.2, color: 'violet', count: 12 },
    { mult: 1.5, color: 'cyan', count: 6 },
    { mult: 2, color: 'gold', count: 2 },
  ],
  medium: [
    { mult: 0, color: 'loss', count: 15 },
    { mult: 1.5, color: 'violet', count: 8 },
    { mult: 2, color: 'cyan', count: 4 },
    { mult: 4, color: 'gold', count: 3 },
  ],
  high: [
    { mult: 0, color: 'loss', count: 22 },
    { mult: 3, color: 'violet', count: 4 },
    { mult: 10, color: 'cyan', count: 3 },
    { mult: 50, color: 'gold', count: 1 },
  ],
};

/**
 * Build the wheel a player actually spins: one entry per slot, equal weight,
 * scaled so expected return is exactly `1 - edge`.
 *
 * The component and the simulator both call this. They used to carry separate
 * tables with different odds, which meant the studio's projected edge belonged
 * to a wheel nobody ever span.
 */
export function buildWheel(risk: 'low' | 'medium' | 'high', segments = WHEEL_SEGMENTS, edge = DEFAULT_EDGE): WheelSegment[] {
  const cats = WHEEL_RINGS[risk] ?? WHEEL_RINGS.medium;
  const slots = cats.reduce((s, c) => s + c.count, 0) || segments;
  const rawEv = cats.reduce((s, c) => s + c.mult * c.count, 0) / slots;
  const scale = rawEv > 0 ? (1 - clampEdge(edge)) / rawEv : 1;

  const out: WheelSegment[] = [];
  for (const c of cats) {
    for (let i = 0; i < c.count; i++) {
      out.push({ multiplier: c.mult === 0 ? 0 : c.mult * scale, color: c.color, weight: 1 });
    }
  }
  return out;
}

/** Spread the slots around the rim so big payouts are never adjacent. Purely
 *  cosmetic — every slot is still 1/30, whatever order they sit in. */
export function interleaveWheel(slots: WheelSegment[]): WheelSegment[] {
  const n = slots.length;
  const ring = new Array<WheelSegment | undefined>(n);
  let idx = 0;
  const stride = 7; // coprime with 30 → even spread
  for (const slot of slots) {
    while (ring[idx % n]) idx++;
    ring[idx % n] = slot;
    idx = (idx + stride) % n;
  }
  return ring.map((s, i) => s ?? slots[i]);
}

export function spinWheel(
  segments: WheelSegment[],
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
): { index: number; multiplier: number } {
  const totalW = segments.reduce((s, x) => s + x.weight, 0);
  let r = firstFloat(seeds.serverSeed, seeds.clientSeed, seeds.nonce) * totalW;
  for (let i = 0; i < segments.length; i++) {
    r -= segments[i].weight;
    if (r < 0) return { index: i, multiplier: segments[i].multiplier };
  }
  return { index: segments.length - 1, multiplier: segments[segments.length - 1].multiplier };
}

/* ----------------------------------------------------------------------- Mines */

/** Deterministic bomb layout from the seed; UI reveals tiles one by one. */
export function minesLayout(
  grid: number,
  bombs: number,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
): Set<number> {
  const order = shuffledIndices(grid, seeds.serverSeed, seeds.clientSeed, seeds.nonce);
  return new Set(order.slice(0, bombs));
}

/**
 * Multiplier after revealing `picks` safe tiles on an N-tile board with M bombs.
 *
 * Held at the vault ceiling. A 25-tile board with 10 bombs cleared to the end
 * prices at over three million times the bet — a number the chain would refuse
 * to settle, so quoting it would be promising a payout that cannot be paid. The
 * cap only ever reduces what the player is quoted, and only on rungs whose odds
 * are astronomically long; the bet cap is sized against the same ceiling.
 */
export function minesMultiplier(grid: number, bombs: number, picks: number, edge = DEFAULT_EDGE): number {
  if (picks <= 0) return 1;
  let m = 1;
  for (let i = 0; i < picks; i++) {
    m *= (grid - i) / (grid - bombs - i);
  }
  return Math.min(MAX_MULTIPLIER, m * (1 - clampEdge(edge)));
}

/* ---------------------------------------------------------------------- Plinko */

/**
 * The *shape* of each Plinko board — the relative payout profile that gives a
 * risk level its character, not the numbers a player is paid. Every row is
 * symmetric and has exactly rows+1 buckets.
 *
 * These are deliberately NOT the paid multipliers. A hand-written table carries
 * whatever house edge its author happened to type, which here ranged from 0.9%
 * to 38% and was then multiplied by the configured edge a second time. Payouts
 * are derived from these shapes by `plinkoPayouts`, which solves the scale so
 * the board's expected return is exactly `1 - edge`.
 */
export const PLINKO_SHAPES: Record<'low' | 'medium' | 'high', Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [76, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 76],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

/** Binomial coefficient, exact for the row counts Plinko uses. */
function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

/** Probability of landing in each bucket — a fair ball is a binomial walk. */
export function plinkoBucketOdds(rows: number): number[] {
  const denom = 2 ** rows;
  return Array.from({ length: rows + 1 }, (_, k) => binom(rows, k) / denom);
}

/**
 * The multipliers a Plinko board actually pays, solved so that expected return
 * equals `1 - clampEdge(edge)` exactly.
 *
 * This is the single source of truth: the ball is paid this table, the buckets
 * on screen display this table, and the simulator scores this table. There is no
 * second edge applied anywhere — a player is paid the number they were shown.
 */
export function plinkoPayouts(
  risk: 'low' | 'medium' | 'high',
  rows: number,
  edge = DEFAULT_EDGE,
): number[] {
  const shape = PLINKO_SHAPES[risk]?.[rows] ?? PLINKO_SHAPES.medium[12];
  const odds = plinkoBucketOdds(rows);
  const target = 1 - clampEdge(edge);
  const rawEv = shape.reduce((s, m, k) => s + m * (odds[k] ?? 0), 0);
  if (rawEv <= 0) return shape.slice();

  // Solve the scale, then hold the vault ceiling: any bucket that would pay past
  // MAX_MULTIPLIER is pinned there and the rest are re-solved around it, so the
  // board still returns exactly `1 - edge`. Without this a 1% board's top bucket
  // scales past 1000x and the chain rejects a win the client already showed.
  const capped = new Array<boolean>(shape.length).fill(false);
  let out = shape.map((m) => m * (target / rawEv));

  for (let pass = 0; pass < shape.length; pass++) {
    const over = out.findIndex((m, k) => !capped[k] && m > MAX_MULTIPLIER);
    if (over === -1) break;
    capped[over] = true;

    const pinnedEv = shape.reduce((s, _m, k) => (capped[k] ? s + MAX_MULTIPLIER * odds[k] : s), 0);
    const freeEv = shape.reduce((s, m, k) => (capped[k] ? s : s + m * odds[k]), 0);
    const scale = freeEv > 0 ? Math.max(0, target - pinnedEv) / freeEv : 0;
    out = shape.map((m, k) => (capped[k] ? MAX_MULTIPLIER : m * scale));
  }
  return out;
}

/** Drop the ball: each of `rows` pegs sends it left(0)/right(1). Bucket = # rights. */
export function dropPlinko(
  rows: number,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
): { path: number[]; bucket: number } {
  const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
  const path: number[] = [];
  let bucket = 0;
  for (let i = 0; i < rows; i++) {
    const right = stream.next() < 0.5 ? 0 : 1;
    path.push(right);
    bucket += right;
  }
  return { path, bucket };
}

/* --------------------------------------------------------------------- Towers */

/** Each row has `cols` tiles, one is a bomb. Climb without hitting it. */
export function towersLayout(
  rows: number,
  cols: number,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
): number[] {
  const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
  return Array.from({ length: rows }, () => Math.floor(stream.next() * cols));
}

export function towersMultiplier(cols: number, level: number, edge = DEFAULT_EDGE): number {
  if (level <= 0) return 1;
  const per = cols / (cols - 1);
  return Math.min(MAX_MULTIPLIER, Math.pow(per, level) * (1 - clampEdge(edge)));
}

/* ----------------------------------------------------------------------- utils */

/**
 * Rounding for MONEY, not for multipliers.
 *
 * A multiplier rounded to two decimals leaks real value: Mines 25/3 on its first
 * pick quotes 1.125x, and rounding that to 1.13 turns a configured 1% edge into
 * a realised 0.56% — outside the band the vault and the licence both assume.
 * Engines therefore return exact multipliers and only the settled payout is
 * rounded here; `fmtMult` shows the player the full precision they are paid.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
