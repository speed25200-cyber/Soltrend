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
  return { roll, win, multiplier: round2(multiplier), payout: win ? round2(bet * multiplier) : 0 };
}

export function diceMultiplier(target: number, over: boolean, edge = DEFAULT_EDGE): number {
  const winChance = over ? 100 - target : target;
  return winChance > 0 ? round2((100 - clampEdge(edge) * 100) / winChance) : 0;
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
  return { heads, win, multiplier: round2(multiplier), payout: win ? round2(bet * multiplier) : 0 };
}

/* ----------------------------------------------------------------------- Wheel */

export interface WheelSegment {
  multiplier: number;
  color: string;
  weight: number;
}

/** Build a balanced wheel whose expected return equals (1 - edge). */
export function buildWheel(risk: 'low' | 'medium' | 'high', segments = 30, edge = DEFAULT_EDGE): WheelSegment[] {
  // Base multiplier pattern per risk profile (relative weights).
  const patterns: Record<string, { mult: number; color: string; weight: number }[]> = {
    low: [
      { mult: 0, color: 'loss', weight: 8 },
      { mult: 1.2, color: 'violet', weight: 14 },
      { mult: 1.5, color: 'cyan', weight: 6 },
      { mult: 2, color: 'gold', weight: 2 },
    ],
    medium: [
      { mult: 0, color: 'loss', weight: 16 },
      { mult: 1.5, color: 'violet', weight: 8 },
      { mult: 2, color: 'cyan', weight: 4 },
      { mult: 4, color: 'gold', weight: 2 },
    ],
    high: [
      { mult: 0, color: 'loss', weight: 24 },
      { mult: 3, color: 'violet', weight: 4 },
      { mult: 10, color: 'cyan', weight: 1 },
      { mult: 50, color: 'gold', weight: 1 },
    ],
  };
  const base = patterns[risk];
  // Normalise so EV == 1 - edge.
  const totalW = base.reduce((s, x) => s + x.weight, 0);
  const rawEv = base.reduce((s, x) => s + (x.mult * x.weight) / totalW, 0);
  const scale = rawEv > 0 ? (1 - clampEdge(edge)) / rawEv : 1;
  return base.map((x) => ({ multiplier: round2(x.mult * scale), color: x.color, weight: x.weight }));
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

/** Multiplier after revealing `picks` safe tiles on an N-tile board with M bombs. */
export function minesMultiplier(grid: number, bombs: number, picks: number, edge = DEFAULT_EDGE): number {
  if (picks <= 0) return 1;
  let m = 1;
  for (let i = 0; i < picks; i++) {
    m *= (grid - i) / (grid - bombs - i);
  }
  return round2(m * (1 - clampEdge(edge)));
}

/* ---------------------------------------------------------------------- Plinko */

export const PLINKO_PAYOUTS: Record<'low' | 'medium' | 'high', Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    12: [8.4, 3, 1.6, 1.1, 1, 0.5, 1, 1, 0.5, 1, 1.1, 1.6, 3, 8.4].slice(0, 13),
    16: [16, 9, 2, 1.4, 1.1, 1, 0.5, 1, 0.5, 1, 1, 1.1, 1.4, 2, 9, 16, 110].slice(0, 17),
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [24, 5, 2, 1.4, 0.6, 0.4, 0.3, 0.4, 0.6, 1.4, 2, 5, 24],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [58, 8, 3, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 3, 8, 58],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

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
  return round2(Math.pow(per, level) * (1 - clampEdge(edge)));
}

/* ----------------------------------------------------------------------- utils */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
