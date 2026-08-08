/**
 * Soltrend Arcade — a *spatial* game builder.
 *
 * Where the node Forge lets you design a game's math, the Arcade lets you design
 * a game's SPACE: a board of tiles the player reveals one by one, banking an
 * escalating multiplier and choosing when to walk away. It is the "design a
 * world, others play it" primitive — a creator ships a playable board; the
 * community plays and remixes it.
 *
 * The payout ladder is the classic reveal martingale: each safe reveal is a
 * fair bet with the house edge baked in once, so the realised edge is EXACT and
 * independent of how the player chooses to cash out — provably fair by
 * construction, and vault-safe without needing a Monte-Carlo pass.
 */

import { minesLayout, minesMultiplier, clampEdge, round2, MIN_EDGE, MAX_EDGE } from '../games';
import type { IconName } from '@/components/Icon';

/** Vault-safety cap: the most any single board round can ever pay. Clamping the
 *  ladder here (rather than rejecting boards) keeps EVERY board vault-safe by
 *  construction — the house liability per round is bounded, whatever the design. */
export const MAX_PAYOUT = 1000;

export type BoardSkin = 'gems' | 'vault' | 'cosmic' | 'neon' | 'inferno';
export type BoardFx = 'flip' | 'shatter' | 'bloom';

export interface BoardSpec {
  rows: number;
  cols: number;
  bombs: number;
  skin: BoardSkin;
  fx: BoardFx;
}

export interface SkinDef {
  id: BoardSkin;
  label: string;
  icon: IconName;
  /** face gradient of an unrevealed tile */
  tile: [string, string];
  /** gem/gain colours revealed on a safe pick */
  gem: string;
  gemGlow: string;
  /** the hazard colour */
  bomb: string;
  bombIcon: IconName;
  gemIcon: IconName;
}

export const BOARD_SKINS: Record<BoardSkin, SkinDef> = {
  gems: {
    id: 'gems', label: 'Gem mine', icon: 'gem',
    tile: ['#1b2340', '#0d1226'], gem: '#22d3ee', gemGlow: '#67e8f9', bomb: '#ff3b6b', bombIcon: 'bomb', gemIcon: 'gem',
  },
  vault: {
    id: 'vault', label: 'Gold vault', icon: 'coin',
    tile: ['#2a2410', '#14100a'], gem: '#ffd25f', gemGlow: '#fde68a', bomb: '#ff3b6b', bombIcon: 'flame', gemIcon: 'coin',
  },
  cosmic: {
    id: 'cosmic', label: 'Cosmic field', icon: 'orbit',
    tile: ['#241a3f', '#0e0a1e'], gem: '#a855f7', gemGlow: '#d8b4fe', bomb: '#ff3b6b', bombIcon: 'star', gemIcon: 'sparkle',
  },
  neon: {
    id: 'neon', label: 'Neon grid', icon: 'bolt',
    tile: ['#0c2a2a', '#06171a'], gem: '#10f5a0', gemGlow: '#6ee7b7', bomb: '#ff3b6b', bombIcon: 'bolt', gemIcon: 'spark',
  },
  inferno: {
    id: 'inferno', label: 'Inferno', icon: 'flame',
    tile: ['#331414', '#180909'], gem: '#fb923c', gemGlow: '#fdba74', bomb: '#ff2d55', bombIcon: 'flame', gemIcon: 'flame',
  },
};

export const BOARD_FX: { id: BoardFx; label: string }[] = [
  { id: 'flip', label: 'Flip' },
  { id: 'shatter', label: 'Shatter' },
  { id: 'bloom', label: 'Bloom' },
];

/* ----------------------------------------------------------------- geometry */

export const clampSpec = (s: Partial<BoardSpec>): BoardSpec => {
  const rows = Math.max(3, Math.min(6, Math.round(s.rows ?? 5)));
  const cols = Math.max(3, Math.min(6, Math.round(s.cols ?? 5)));
  const cells = rows * cols;
  // Leave at least one safe tile and cap bombs below the whole board.
  const bombs = Math.max(1, Math.min(cells - 1, Math.round(s.bombs ?? 3)));
  return { rows, cols, bombs, skin: (s.skin as BoardSkin) ?? 'gems', fx: (s.fx as BoardFx) ?? 'flip' };
};

export const cellCount = (s: BoardSpec) => s.rows * s.cols;
export const safeCount = (s: BoardSpec) => cellCount(s) - s.bombs;

/** Deterministic bomb layout from the reserved seeds — revealed after settle. */
export function boardLayout(spec: BoardSpec, seeds: { serverSeed: string; clientSeed: string; nonce: number }): Set<number> {
  return minesLayout(cellCount(spec), spec.bombs, seeds);
}

/** Multiplier after `picks` successful reveals. Edge is applied once, exactly,
 *  then clamped to the vault cap so no round can ever exceed MAX_PAYOUT. */
export function boardMultiplier(spec: BoardSpec, picks: number, edge: number): number {
  return Math.min(MAX_PAYOUT, minesMultiplier(cellCount(spec), spec.bombs, picks, edge));
}

/** Probability of surviving to exactly `picks` safe reveals (no bomb yet). */
export function survivalTo(spec: BoardSpec, picks: number): number {
  const n = cellCount(spec);
  let p = 1;
  for (let i = 0; i < picks; i++) p *= (n - spec.bombs - i) / (n - i);
  return p;
}

export interface BoardStats {
  cells: number;
  safe: number;
  maxMult: number;
  /** multiplier ladder: value after 1..safe reveals */
  ladder: { picks: number; mult: number; survive: number }[];
  edge: number;
  capped: boolean;
  ok: boolean;
  errors: string[];
}

/** Exact stats for the builder — no Monte-Carlo needed, the edge is closed-form. */
export function boardStats(spec: BoardSpec, edge: number): BoardStats {
  const safe = safeCount(spec);
  const e = clampEdge(edge);
  const ladder = Array.from({ length: safe }, (_, i) => {
    const picks = i + 1;
    return { picks, mult: boardMultiplier(spec, picks, e), survive: survivalTo(spec, picks) };
  });
  const maxMult = ladder.length ? ladder[ladder.length - 1].mult : 1;
  const errors: string[] = [];
  if (spec.bombs < 1) errors.push('Add at least one hazard tile.');
  if (safe < 1) errors.push('Leave at least one safe tile.');
  if (edge < MIN_EDGE - 1e-9) errors.push(`House edge ${(edge * 100).toFixed(2)}% is below the ${MIN_EDGE * 100}% minimum.`);
  if (edge > MAX_EDGE + 1e-9) errors.push(`House edge ${(edge * 100).toFixed(2)}% exceeds the ${MAX_EDGE * 100}% maximum.`);
  return { cells: cellCount(spec), safe, maxMult: round2(maxMult), ladder, edge: e, capped: maxMult >= MAX_PAYOUT - 0.5, ok: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ starters */

export interface BoardTemplate {
  id: string;
  label: string;
  hint: string;
  spec: BoardSpec;
  edge: number;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  { id: 'gemhunt', label: 'Gem Hunt', hint: 'Gentle 5×5, three hazards', spec: { rows: 5, cols: 5, bombs: 3, skin: 'gems', fx: 'flip' }, edge: 0.02 },
  { id: 'vaultrun', label: 'Vault Run', hint: 'Golden 5×5, five hazards', spec: { rows: 5, cols: 5, bombs: 5, skin: 'vault', fx: 'bloom' }, edge: 0.02 },
  { id: 'cosmic', label: 'Cosmic Field', hint: 'Wide 6×6, eight hazards', spec: { rows: 6, cols: 6, bombs: 8, skin: 'cosmic', fx: 'shatter' }, edge: 0.025 },
  { id: 'inferno', label: 'Inferno', hint: 'Brutal 4×4, six hazards', spec: { rows: 4, cols: 4, bombs: 6, skin: 'inferno', fx: 'shatter' }, edge: 0.03 },
];

/** Parse a stored params bag back into a spec (published game round-trip). */
export function specFromParams(params?: Record<string, number | string>): BoardSpec {
  return clampSpec({
    rows: Number(params?.rows),
    cols: Number(params?.cols),
    bombs: Number(params?.bombs),
    skin: params?.skin as BoardSkin,
    fx: params?.fx as BoardFx,
  });
}

export const specToParams = (spec: BoardSpec): Record<string, number | string> => ({
  rows: spec.rows, cols: spec.cols, bombs: spec.bombs, skin: spec.skin, fx: spec.fx,
});
