/**
 * Soltrend Forge — a node-graph game engine.
 *
 * A game is a directed acyclic graph of typed nodes. An RNG node draws from the
 * provably-fair stream; transform nodes reshape values; a single Payout node
 * emits the final multiplier (0 = loss). The SAME interpreter runs both the
 * live game and the Monte-Carlo validator, so what a creator designs is exactly
 * what settles on-chain — and every graph is proven vault-safe before publish.
 *
 * This is the "invent your own casino game" primitive: nobody assembles new
 * mechanics from wired nodes on Solana today.
 */

import { createServerSeed, floatStream } from '../provably-fair';
import { MIN_EDGE, MAX_EDGE } from '../games';

export type NodeKind = 'rng' | 'const' | 'math' | 'branch' | 'curve' | 'payout';

export interface ForgeNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  params: Record<string, number | string>;
  /** input port key → source node id (each node has exactly one output value) */
  inputs: Record<string, string | undefined>;
}

export interface ForgeGraph {
  nodes: ForgeNode[];
}

export interface PortDef {
  key: string;
  label: string;
}
export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  default: number | string;
}
export interface NodeDef {
  kind: NodeKind;
  label: string;
  hint: string;
  color: string;
  inputs: PortDef[];
  params: ParamDef[];
  /** value output = eval(inputs, params, ctx) */
  eval: (inp: Record<string, number>, p: Record<string, number | string>, ctx: { next: () => number }) => number;
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(+v) ? +v : d);

export const NODE_DEFS: Record<NodeKind, NodeDef> = {
  rng: {
    kind: 'rng',
    label: 'RNG',
    hint: 'Provably-fair random in [0,1)',
    color: '#a855f7',
    inputs: [],
    params: [],
    eval: (_i, _p, ctx) => ctx.next(),
  },
  const: {
    kind: 'const',
    label: 'Constant',
    hint: 'A fixed number',
    color: '#64748b',
    inputs: [],
    params: [{ key: 'value', label: 'Value', type: 'number', default: 2, step: 0.1 }],
    eval: (_i, p) => num(p.value, 0),
  },
  math: {
    kind: 'math',
    label: 'Math',
    hint: 'Combine two values',
    color: '#22d3ee',
    inputs: [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ],
    params: [{ key: 'op', label: 'Op', type: 'select', options: ['+', '-', '×', '÷', 'min', 'max'], default: '×' }],
    eval: (i, p) => {
      const a = i.a ?? 0;
      const b = i.b ?? 0;
      switch (p.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '÷': return b === 0 ? 0 : a / b;
        case 'min': return Math.min(a, b);
        case 'max': return Math.max(a, b);
        default: return a * b;
      }
    },
  },
  branch: {
    kind: 'branch',
    label: 'Branch',
    hint: 'If condition, pass A, else B',
    color: '#ec4899',
    inputs: [
      { key: 'cond', label: 'Value' },
      { key: 'a', label: 'Then' },
      { key: 'b', label: 'Else' },
    ],
    params: [
      { key: 'op', label: 'Test', type: 'select', options: ['>', '<', '≥', '≤'], default: '>' },
      { key: 'threshold', label: 'Threshold', type: 'number', default: 0.5, step: 0.01 },
    ],
    eval: (i, p) => {
      const v = i.cond ?? 0;
      const t = num(p.threshold, 0.5);
      const pass = p.op === '<' ? v < t : p.op === '≥' ? v >= t : p.op === '≤' ? v <= t : v > t;
      return pass ? (i.a ?? 0) : (i.b ?? 0);
    },
  },
  curve: {
    kind: 'curve',
    label: 'Curve',
    hint: 'Shape a value into a multiplier',
    color: '#10f5a0',
    inputs: [{ key: 'x', label: 'X' }],
    params: [
      { key: 'type', label: 'Shape', type: 'select', options: ['crash', 'pow', 'linear', 'inverse'], default: 'crash' },
      { key: 'k', label: 'K', type: 'number', default: 1, step: 0.1 },
    ],
    eval: (i, p) => {
      const x = Math.min(0.999999, Math.max(0, i.x ?? 0));
      const k = num(p.k, 1);
      switch (p.type) {
        case 'pow': return Math.pow(x, k);
        case 'linear': return k * x;
        case 'inverse': return (1 - x) * k;
        default: return k / (1 - x); // crash-style, unbounded upside
      }
    },
  },
  payout: {
    kind: 'payout',
    label: 'Payout',
    hint: 'Final multiplier (0 = loss). Scale tunes the house edge.',
    color: '#ffd25f',
    inputs: [{ key: 'mult', label: 'Multiplier' }],
    params: [{ key: 'scale', label: 'Edge scale', type: 'number', default: 1, step: 0.001 }],
    eval: (i, p) => Math.max(0, (i.mult ?? 0) * num(p.scale, 1)),
  },
};

/* --------------------------------------------------------------- interpreter */

export function payoutNode(g: ForgeGraph): ForgeNode | undefined {
  return g.nodes.find((n) => n.kind === 'payout');
}

/** Evaluate the graph once, pulling RNG from `next`. Returns the multiplier. */
export function runGraph(g: ForgeGraph, next: () => number): number {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const stack = new Set<string>();

  const evalNode = (id: string | undefined): number => {
    if (!id) return 0;
    if (memo.has(id)) return memo.get(id)!;
    if (stack.has(id)) return 0; // cycle guard
    const node = byId.get(id);
    if (!node) return 0;
    stack.add(id);
    const def = NODE_DEFS[node.kind];
    const inp: Record<string, number> = {};
    for (const port of def.inputs) inp[port.key] = evalNode(node.inputs[port.key]);
    const out = def.eval(inp, node.params, { next });
    stack.delete(id);
    memo.set(id, out);
    return out;
  };

  const pay = payoutNode(g);
  if (!pay) return 0;
  return evalNode(pay.id);
}

/* ---------------------------------------------------------------- validation */

export interface GraphSim {
  ok: boolean;
  errors: string[];
  rtp: number;
  edge: number;
  hitRate: number;
  maxMult: number;
  volatility: number;
  rounds: number;
}

export function simulateGraph(g: ForgeGraph, rounds = 4000): GraphSim {
  const errors: string[] = [];
  if (!payoutNode(g)) errors.push('Add a Payout node — every game needs one.');
  const hasRng = g.nodes.some((n) => n.kind === 'rng');
  if (!hasRng) errors.push('Add at least one RNG node so the outcome is random.');

  const serverSeed = createServerSeed().serverSeed;
  let total = 0;
  let wins = 0;
  let maxMult = 0;
  let sum = 0;
  let sumSq = 0;
  for (let n = 1; n <= rounds; n++) {
    const stream = floatStream(serverSeed, 'forge-sim', n);
    const m = clampNum(runGraph(g, () => stream.next()));
    total += m;
    sum += m;
    sumSq += m * m;
    if (m >= 1) wins++;
    if (m > maxMult) maxMult = m;
  }
  const rtp = total / rounds;
  const edge = 1 - rtp;
  const mean = sum / rounds;
  const volatility = Math.sqrt(Math.max(0, sumSq / rounds - mean * mean));

  if (errors.length === 0) {
    if (edge < MIN_EDGE - 0.006) errors.push(`House edge ${(edge * 100).toFixed(2)}% is below the ${MIN_EDGE * 100}% minimum — lower the payout scale.`);
    if (edge > MAX_EDGE + 0.006) errors.push(`House edge ${(edge * 100).toFixed(2)}% exceeds the ${MAX_EDGE * 100}% maximum — raise the payout scale.`);
    if (maxMult > 1000) errors.push(`Max payout ${maxMult.toFixed(0)}× exceeds the 1000× vault-safety cap.`);
  }

  return { ok: errors.length === 0, errors, rtp, edge, hitRate: wins / rounds, maxMult, volatility, rounds };
}

/** Find the payout scale that makes the realised edge hit `targetEdge`. */
export function normaliseEdge(g: ForgeGraph, targetEdge: number): number {
  const pay = payoutNode(g);
  if (!pay) return 1;
  const prev = num(pay.params.scale, 1);
  pay.params.scale = 1;
  const sim = simulateGraph(g, 24000);
  pay.params.scale = prev;
  if (sim.rtp <= 0) return prev;
  return Math.round(((1 - targetEdge) / sim.rtp) * 1000) / 1000;
}

const clampNum = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100000, n)) : 0);

/* ------------------------------------------------------------------ starters */

let idc = 0;
export const newId = () => `n${(idc++).toString(36)}${Math.floor(performance.now() % 1000).toString(36)}`;

/** A working starter graph: RNG → (×100) → Branch(>50 ? 1.98 : 0) → Payout. Classic dice. */
export function starterGraph(): ForgeGraph {
  const rng = { id: 'rng1', kind: 'rng' as const, x: 40, y: 140, params: {}, inputs: {} };
  const hundred = { id: 'c100', kind: 'const' as const, x: 40, y: 40, params: { value: 100 }, inputs: {} };
  const scaled = { id: 'm1', kind: 'math' as const, x: 240, y: 90, params: { op: '×' }, inputs: { a: 'rng1', b: 'c100' } };
  const win = { id: 'cw', kind: 'const' as const, x: 240, y: 250, params: { value: 1.98 }, inputs: {} };
  const lose = { id: 'cl', kind: 'const' as const, x: 240, y: 330, params: { value: 0 }, inputs: {} };
  const branch = { id: 'b1', kind: 'branch' as const, x: 470, y: 150, params: { op: '>', threshold: 50 }, inputs: { cond: 'm1', a: 'cw', b: 'cl' } };
  const payout = { id: 'pay', kind: 'payout' as const, x: 700, y: 170, params: { scale: 1 }, inputs: { mult: 'b1' } };
  return { nodes: [hundred, rng, scaled, win, lose, branch, payout] };
}
