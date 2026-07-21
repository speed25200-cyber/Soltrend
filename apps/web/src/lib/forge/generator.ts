/**
 * Game generator — turns "pick a feeling" into distinct, playable games.
 *
 * The anti-repetition engine has two parts:
 *  1. MECHANIC ARCHETYPES — structurally different graph skeletons (over/under,
 *     crash curve, best-of-N, risk tower, weighted wheel, double-or-nothing,
 *     hybrid). Randomised params make each roll unique.
 *  2. A NOVELTY SCORE — compares a candidate's payout DISTRIBUTION (histogram +
 *     hit-rate + volatility) to a reference set, so we can surface games that are
 *     genuinely different from what already exists (and from each other), instead
 *     of 500 reskins of the same maths.
 */

import { simulateGraph, normaliseEdge, type ForgeGraph, type GraphSim } from './model';

export type Feeling = 'fast' | 'tense' | 'jackpot' | 'slowburn';

export const FEELINGS: { id: Feeling; label: string; hint: string }[] = [
  { id: 'fast', label: 'Fast & punchy', hint: 'High hit-rate, quick swings' },
  { id: 'tense', label: 'Tense climb', hint: 'Build-up, cash-out pressure' },
  { id: 'jackpot', label: 'Jackpot hunt', hint: 'Rare, huge multipliers' },
  { id: 'slowburn', label: 'Slow burn', hint: 'Frequent small wins' },
];

const R = (rng: () => number, a: number, b: number) => a + rng() * (b - a);
const Ri = (rng: () => number, a: number, b: number) => Math.round(R(rng, a, b));

interface Archetype {
  id: string;
  label: string;
  feelings: Feeling[];
  build: (rng: () => number) => ForgeGraph;
}

/** Structurally distinct skeletons. Params randomised per generation. */
const ARCHETYPES: Archetype[] = [
  {
    id: 'overunder', label: 'Over / Under', feelings: ['fast', 'slowburn'],
    build: (rng): ForgeGraph => {
      const t = Ri(rng, 30, 70);
      const win = Math.round((100 / (100 - t)) * 100) / 100;
      return { nodes: [
        { id: 'c100', kind: 'const', x: 40, y: 40, params: { value: 100 }, inputs: {} },
        { id: 'r', kind: 'rng', x: 40, y: 150, params: {}, inputs: {} },
        { id: 'm', kind: 'math', x: 240, y: 90, params: { op: '×' }, inputs: { a: 'r', b: 'c100' } },
        { id: 'w', kind: 'const', x: 240, y: 250, params: { value: win }, inputs: {} },
        { id: 'l', kind: 'const', x: 240, y: 330, params: { value: 0 }, inputs: {} },
        { id: 'b', kind: 'branch', x: 470, y: 150, params: { op: '>', threshold: t }, inputs: { cond: 'm', a: 'w', b: 'l' } },
        { id: 'pay', kind: 'payout', x: 700, y: 170, params: { scale: 1 }, inputs: { mult: 'b' } },
      ] };
    },
  },
  {
    id: 'crashcurve', label: 'Crash curve', feelings: ['tense', 'jackpot'],
    build: (rng): ForgeGraph => {
      const k = Math.round(R(rng, 0.6, 0.99) * 100) / 100;
      const cap = Ri(rng, 20, 300);
      return { nodes: [
        { id: 'r', kind: 'rng', x: 40, y: 190, params: {}, inputs: {} },
        { id: 'cv', kind: 'curve', x: 250, y: 180, params: { type: 'crash', k }, inputs: { x: 'r' } },
        { id: 'cp', kind: 'clamp', x: 470, y: 190, params: { lo: 0, hi: cap }, inputs: { x: 'cv' } },
        { id: 'pay', kind: 'payout', x: 690, y: 200, params: { scale: 1 }, inputs: { mult: 'cp' } },
      ] };
    },
  },
  {
    id: 'bestof', label: 'Best of N', feelings: ['tense', 'fast'],
    build: (rng): ForgeGraph => {
      const n = Ri(rng, 2, 5);
      const k = Math.round(R(rng, 0.4, 0.8) * 100) / 100;
      return { nodes: [
        { id: 'md', kind: 'multidraw', x: 60, y: 170, params: { n, op: 'max' }, inputs: {} },
        { id: 'cv', kind: 'curve', x: 300, y: 160, params: { type: 'crash', k }, inputs: { x: 'md' } },
        { id: 'cp', kind: 'clamp', x: 520, y: 170, params: { lo: 0, hi: 200 }, inputs: { x: 'cv' } },
        { id: 'pay', kind: 'payout', x: 740, y: 190, params: { scale: 1 }, inputs: { mult: 'cp' } },
      ] };
    },
  },
  {
    id: 'tower', label: 'Risk tower', feelings: ['jackpot', 'tense'],
    build: (rng): ForgeGraph => {
      const steps = Ri(rng, 4, 12);
      const p = Math.round(R(rng, 0.62, 0.82) * 100) / 100;
      const step = Math.round(R(rng, 1.2, 1.5) * 100) / 100;
      return { nodes: [
        { id: 'ld', kind: 'ladder', x: 90, y: 150, params: { steps, p, step }, inputs: {} },
        { id: 'cp', kind: 'clamp', x: 340, y: 160, params: { lo: 0, hi: 500 }, inputs: { x: 'ld' } },
        { id: 'pay', kind: 'payout', x: 590, y: 180, params: { scale: 1 }, inputs: { mult: 'cp' } },
      ] };
    },
  },
  {
    id: 'wheel', label: 'Weighted wheel', feelings: ['slowburn', 'jackpot'],
    build: (rng): ForgeGraph => {
      const jackpot = Ri(rng, 8, 40);
      const mid = Math.round(R(rng, 1.5, 3) * 10) / 10;
      const zeros = Ri(rng, 8, 16);
      const segs = `0:${zeros}, ${mid}:6, ${mid * 2}:3, ${jackpot}:1`;
      return { nodes: [
        { id: 'r', kind: 'rng', x: 60, y: 180, params: {}, inputs: {} },
        { id: 'sg', kind: 'segments', x: 300, y: 150, params: { segs }, inputs: { x: 'r' } },
        { id: 'pay', kind: 'payout', x: 620, y: 190, params: { scale: 1 }, inputs: { mult: 'sg' } },
      ] };
    },
  },
  {
    id: 'double', label: 'Double or nothing', feelings: ['fast'],
    build: (rng): ForgeGraph => {
      const p = Math.round(R(rng, 0.42, 0.55) * 100) / 100;
      const mult = Math.round((1 / p) * 100) / 100;
      return { nodes: [
        { id: 'r', kind: 'rng', x: 40, y: 160, params: {}, inputs: {} },
        { id: 'ch', kind: 'chance', x: 250, y: 150, params: { p }, inputs: { x: 'r' } },
        { id: 'c', kind: 'const', x: 250, y: 300, params: { value: mult }, inputs: {} },
        { id: 'm', kind: 'math', x: 470, y: 190, params: { op: '×' }, inputs: { a: 'ch', b: 'c' } },
        { id: 'pay', kind: 'payout', x: 690, y: 200, params: { scale: 1 }, inputs: { mult: 'm' } },
      ] };
    },
  },
  {
    id: 'slot', label: 'Slot machine', feelings: ['jackpot', 'slowburn'],
    build: (rng): ForgeGraph => {
      const jackpot = Ri(rng, 40, 150);
      const mid = Ri(rng, 6, 12);
      const reels = Ri(rng, 3, 4);
      return { nodes: [
        { id: 'rl', kind: 'reel', x: 120, y: 150, params: { symbols: `0:60, 3:22, ${mid}:8, 25:3, ${jackpot}:1`, reels }, inputs: {} },
        { id: 'pay', kind: 'payout', x: 440, y: 170, params: { scale: 1 }, inputs: { mult: 'rl' } },
      ] };
    },
  },
  {
    id: 'scratch', label: 'Scratch card', feelings: ['fast', 'slowburn'],
    build: (rng): ForgeGraph => {
      const cells = Ri(rng, 8, 12);
      const jackpot = Ri(rng, 40, 80);
      return { nodes: [
        { id: 'sc', kind: 'scratch', x: 120, y: 150, params: { prizes: `0:45, 2:22, 5:12, 20:5, ${jackpot}:1`, cells, need: 3 }, inputs: {} },
        { id: 'pay', kind: 'payout', x: 460, y: 170, params: { scale: 1 }, inputs: { mult: 'sc' } },
      ] };
    },
  },
  {
    id: 'hybrid', label: 'Hybrid draw', feelings: ['tense', 'jackpot', 'slowburn'],
    build: (rng): ForgeGraph => {
      const n = Ri(rng, 2, 4);
      const jackpot = Ri(rng, 10, 30);
      return { nodes: [
        { id: 'md', kind: 'multidraw', x: 40, y: 90, params: { n, op: 'avg' }, inputs: {} },
        { id: 'r2', kind: 'rng', x: 40, y: 300, params: {}, inputs: {} },
        { id: 'sg', kind: 'segments', x: 260, y: 300, params: { segs: `0:10, 1.5:6, ${jackpot}:1` }, inputs: { x: 'r2' } },
        { id: 'cv', kind: 'curve', x: 260, y: 90, params: { type: 'pow', k: 2 }, inputs: { x: 'md' } },
        { id: 'mx', kind: 'math', x: 480, y: 180, params: { op: 'max' }, inputs: { a: 'cv', b: 'sg' } },
        { id: 'cp', kind: 'clamp', x: 680, y: 180, params: { lo: 0, hi: 300 }, inputs: { x: 'mx' } },
        { id: 'pay', kind: 'payout', x: 880, y: 190, params: { scale: 1 }, inputs: { mult: 'cp' } },
      ] };
    },
  },
];

export interface Candidate {
  graph: ForgeGraph;
  sim: GraphSim;
  archetype: string;
  edge: number;
}

/** A compact fingerprint of a game's payout distribution for novelty distance. */
function fingerprint(sim: GraphSim): number[] {
  const total = sim.buckets.reduce((a, b) => a + b.count, 0) || 1;
  return [
    ...sim.buckets.map((b) => b.count / total),
    sim.hitRate,
    Math.min(1, sim.volatility / 5),
  ];
}

function distance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/** 0..1 — how different this game's distribution is from its nearest neighbour. */
export function noveltyScore(sim: GraphSim, refs: GraphSim[]): number {
  if (refs.length === 0) return 1;
  const f = fingerprint(sim);
  const nearest = Math.min(...refs.map((r) => distance(f, fingerprint(r))));
  return Math.round(Math.min(1, nearest / 0.9) * 100) / 100;
}

function generateOne(feeling: Feeling, rng: () => number): Candidate | null {
  const pool = ARCHETYPES.filter((a) => a.feelings.includes(feeling));
  const arc = (pool.length ? pool : ARCHETYPES)[Math.floor(rng() * (pool.length || ARCHETYPES.length))];
  const graph = arc.build(rng);
  const targetEdge = 0.015 + rng() * 0.02;
  const scale = normaliseEdge(graph, targetEdge);
  const pay = graph.nodes.find((n) => n.kind === 'payout');
  if (pay) pay.params.scale = scale;
  const sim = simulateGraph(graph, 16000);
  if (!sim.ok) return null;
  return { graph, sim, archetype: arc.label, edge: sim.edge };
}

/**
 * Generate `n` playable candidates for a feeling that are mutually DISTINCT
 * (farthest-point selection on the distribution fingerprint) and novel vs any
 * `existing` games. This is what keeps the catalogue from converging on clones.
 */
export function generateDistinct(feeling: Feeling, n: number, existing: GraphSim[], rng: () => number = Math.random): Candidate[] {
  const pool: Candidate[] = [];
  for (let i = 0; i < 16 && pool.length < 12; i++) {
    const c = generateOne(feeling, rng);
    if (c) pool.push(c);
  }
  if (pool.length === 0) return [];
  // greedy farthest-point: seed with the most novel vs existing, then keep
  // adding the candidate farthest from everything already chosen.
  const chosen: Candidate[] = [];
  const remaining = [...pool];
  remaining.sort((a, b) => noveltyScore(b.sim, existing) - noveltyScore(a.sim, existing));
  chosen.push(remaining.shift()!);
  while (chosen.length < n && remaining.length) {
    let bestIdx = 0, bestD = -1;
    remaining.forEach((c, i) => {
      const d = Math.min(...chosen.map((ch) => distance(fingerprint(c.sim), fingerprint(ch.sim))));
      if (d > bestD) { bestD = d; bestIdx = i; }
    });
    chosen.push(remaining.splice(bestIdx, 1)[0]);
  }
  return chosen;
}
