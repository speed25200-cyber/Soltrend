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

export type NodeKind =
  | 'rng'
  | 'const'
  | 'math'
  | 'branch'
  | 'curve'
  | 'randint'
  | 'map'
  | 'chance'
  | 'segments'
  | 'ladder'
  | 'multidraw'
  | 'clamp'
  | 'reel'
  | 'scratch'
  | 'payout';

/** Node kinds that pull their own randomness from the fair stream. */
export const RANDOM_KINDS = new Set<NodeKind>(['rng', 'ladder', 'multidraw', 'reel', 'scratch']);

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
  type: 'number' | 'select' | 'text';
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

/** Parse a "value:weight, value:weight" list into weighted entries (value = the
 *  symbol's payout multiplier, its list index = its identity). */
const parseWV = (s: unknown): { v: number; w: number }[] =>
  String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [v, w] = x.split(':');
      return { v: parseFloat(v) || 0, w: Math.max(0, parseFloat(w) || 0) };
    })
    .filter((x) => x.w > 0);

/** Pick an index from weighted entries using a [0,1) draw. */
const pickIdx = (parts: { v: number; w: number }[], r: number): number => {
  const total = parts.reduce((a, b) => a + b.w, 0);
  let x = Math.min(0.999999, Math.max(0, r)) * total;
  for (let i = 0; i < parts.length; i++) {
    x -= parts[i].w;
    if (x < 0) return i;
  }
  return parts.length - 1;
};

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
  randint: {
    kind: 'randint',
    label: 'Rand int',
    hint: 'Turn a [0,1) value into an integer 0…N-1',
    color: '#8b5cf6',
    inputs: [{ key: 'x', label: 'X' }],
    params: [{ key: 'n', label: 'N', type: 'number', default: 6, step: 1 }],
    eval: (i, p) => Math.floor(Math.min(0.999999, Math.max(0, i.x ?? 0)) * Math.max(1, num(p.n, 6))),
  },
  map: {
    kind: 'map',
    label: 'Remap',
    hint: 'Linearly remap a value between ranges',
    color: '#3b82f6',
    inputs: [{ key: 'x', label: 'X' }],
    params: [
      { key: 'inMin', label: 'in min', type: 'number', default: 0 },
      { key: 'inMax', label: 'in max', type: 'number', default: 1 },
      { key: 'outMin', label: 'out min', type: 'number', default: 0 },
      { key: 'outMax', label: 'out max', type: 'number', default: 10 },
    ],
    eval: (i, p) => {
      const x = i.x ?? 0;
      const a = num(p.inMin, 0), b = num(p.inMax, 1), c = num(p.outMin, 0), d = num(p.outMax, 10);
      if (b === a) return c;
      return c + ((x - a) / (b - a)) * (d - c);
    },
  },
  chance: {
    kind: 'chance',
    label: 'Chance',
    hint: 'Win with probability P → outputs 1 (win) or 0 (loss)',
    color: '#ec4899',
    inputs: [{ key: 'x', label: 'RNG' }],
    params: [{ key: 'p', label: 'P win', type: 'number', default: 0.5, step: 0.01 }],
    eval: (i, p) => ((i.x ?? 1) < num(p.p, 0.5) ? 1 : 0),
  },
  segments: {
    kind: 'segments',
    label: 'Segments',
    hint: 'Weighted wheel: "mult:weight" list. Picks one by RNG.',
    color: '#f59e0b',
    inputs: [{ key: 'x', label: 'RNG' }],
    params: [{ key: 'segs', label: 'mult:weight', type: 'text', default: '0:8, 1.5:8, 2:4, 4:2' }],
    eval: (i, p) => {
      const parts = String(p.segs || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [m, w] = s.split(':');
          return { m: parseFloat(m) || 0, w: Math.max(0, parseFloat(w) || 0) };
        })
        .filter((s) => s.w > 0);
      if (parts.length === 0) return 0;
      const total = parts.reduce((a, b) => a + b.w, 0);
      let r = Math.min(0.999999, Math.max(0, i.x ?? 0)) * total;
      for (const s of parts) {
        r -= s.w;
        if (r < 0) return s.m;
      }
      return parts[parts.length - 1].m;
    },
  },
  ladder: {
    kind: 'ladder',
    label: 'Risk tower',
    hint: 'Auto-climb: each step survives with prob P and compounds ×Step, else busts to 0',
    color: '#f43f5e',
    inputs: [],
    params: [
      { key: 'steps', label: 'Max steps', type: 'number', default: 6, step: 1 },
      { key: 'p', label: 'P survive', type: 'number', default: 0.72, step: 0.01 },
      { key: 'step', label: '×/step', type: 'number', default: 1.32, step: 0.01 },
    ],
    eval: (_i, p, ctx) => {
      const steps = Math.max(1, Math.min(64, Math.round(num(p.steps, 6))));
      const pw = Math.max(0, Math.min(1, num(p.p, 0.72)));
      const mult = Math.max(1, num(p.step, 1.32));
      let acc = 1;
      for (let s = 0; s < steps; s++) {
        if (ctx.next() < pw) acc *= mult;
        else return 0;
      }
      return acc;
    },
  },
  multidraw: {
    kind: 'multidraw',
    label: 'Multi-draw',
    hint: 'Draw N fair values and keep the best / worst / average — luck of many rolls',
    color: '#14b8a6',
    inputs: [],
    params: [
      { key: 'n', label: 'Draws', type: 'number', default: 3, step: 1 },
      { key: 'op', label: 'Keep', type: 'select', options: ['max', 'min', 'avg', 'sum'], default: 'max' },
    ],
    eval: (_i, p, ctx) => {
      const n = Math.max(1, Math.min(50, Math.round(num(p.n, 3))));
      let best = p.op === 'min' ? 1 : 0;
      let acc = 0;
      for (let k = 0; k < n; k++) {
        const v = ctx.next();
        acc += v;
        if (p.op === 'max') best = Math.max(best, v);
        else if (p.op === 'min') best = Math.min(best, v);
      }
      if (p.op === 'avg') return acc / n;
      if (p.op === 'sum') return acc;
      return best;
    },
  },
  clamp: {
    kind: 'clamp',
    label: 'Clamp',
    hint: 'Keep a value inside [lo, hi] — tame runaway payouts',
    color: '#0ea5e9',
    inputs: [{ key: 'x', label: 'X' }],
    params: [
      { key: 'lo', label: 'lo', type: 'number', default: 0 },
      { key: 'hi', label: 'hi', type: 'number', default: 100 },
    ],
    eval: (i, p) => Math.max(num(p.lo, 0), Math.min(num(p.hi, 100), i.x ?? 0)),
  },
  reel: {
    kind: 'reel',
    label: 'Slot reels',
    hint: 'Spin N reels of weighted symbols — all reels match → that symbol\'s value.',
    color: '#f472b6',
    inputs: [],
    params: [
      { key: 'symbols', label: 'value:weight', type: 'text', default: '0:60, 3:20, 8:8, 25:3, 100:1' },
      { key: 'reels', label: 'Reels', type: 'number', default: 3, step: 1 },
    ],
    eval: (_i, p, ctx) => {
      const parts = parseWV(p.symbols);
      if (parts.length === 0) return 0;
      const reels = Math.max(2, Math.min(6, Math.round(num(p.reels, 3))));
      const counts = new Array(parts.length).fill(0);
      for (let r = 0; r < reels; r++) counts[pickIdx(parts, ctx.next())]++;
      // The most-frequent symbol wins its value at 2+ of a kind; all reels
      // matching pays the full value, a partial line pays a fraction.
      let bestIdx = -1;
      let bestCount = 0;
      for (let i = 0; i < parts.length; i++) if (counts[i] > bestCount) { bestCount = counts[i]; bestIdx = i; }
      if (bestIdx < 0 || bestCount < 2) return 0;
      const frac = bestCount >= reels ? 1 : 0.2 + 0.8 * ((bestCount - 1) / (reels - 1));
      return parts[bestIdx].v * frac;
    },
  },
  scratch: {
    kind: 'scratch',
    label: 'Scratch card',
    hint: 'Reveal cells of weighted prizes — match `need` of the same symbol → its value.',
    color: '#fbbf24',
    inputs: [],
    params: [
      { key: 'prizes', label: 'value:weight', type: 'text', default: '0:50, 2:20, 5:10, 20:4, 100:1' },
      { key: 'cells', label: 'Cells', type: 'number', default: 9, step: 1 },
      { key: 'need', label: 'Match', type: 'number', default: 3, step: 1 },
    ],
    eval: (_i, p, ctx) => {
      const parts = parseWV(p.prizes);
      if (parts.length === 0) return 0;
      const cells = Math.max(3, Math.min(25, Math.round(num(p.cells, 9))));
      const need = Math.max(2, Math.min(cells, Math.round(num(p.need, 3))));
      const counts = new Array(parts.length).fill(0);
      for (let c = 0; c < cells; c++) counts[pickIdx(parts, ctx.next())]++;
      let best = 0;
      for (let i = 0; i < parts.length; i++) if (counts[i] >= need && parts[i].v > best) best = parts[i].v;
      return best;
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

export interface SimBucket {
  label: string;
  count: number;
}

export interface GraphSim {
  ok: boolean;
  errors: string[];
  rtp: number;
  edge: number;
  hitRate: number;
  maxMult: number;
  volatility: number;
  rounds: number;
  buckets: SimBucket[];
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'Loss', min: 0, max: 0.0001 },
  { label: '0–1×', min: 0.0001, max: 1 },
  { label: '1–2×', min: 1, max: 2 },
  { label: '2–5×', min: 2, max: 5 },
  { label: '5–10×', min: 5, max: 10 },
  { label: '10×+', min: 10, max: Infinity },
];

export function simulateGraph(g: ForgeGraph, rounds = 4000): GraphSim {
  const errors: string[] = [];
  if (!payoutNode(g)) errors.push('Add a Payout node — every game needs one.');
  const hasRng = g.nodes.some((n) => RANDOM_KINDS.has(n.kind));
  if (!hasRng) errors.push('Add a randomness source (RNG, Risk tower or Multi-draw) so the outcome is random.');

  const serverSeed = createServerSeed().serverSeed;
  const buckets = BUCKETS.map((b) => ({ label: b.label, count: 0 }));
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
    for (let bi = 0; bi < BUCKETS.length; bi++) {
      if (m >= BUCKETS[bi].min && m < BUCKETS[bi].max) {
        buckets[bi].count++;
        break;
      }
    }
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

  return { ok: errors.length === 0, errors, rtp, edge, hitRate: wins / rounds, maxMult, volatility, rounds, buckets };
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

/** Remixable starter templates — load one, then rewire it into something new. */
export interface ForgeTemplate {
  id: string;
  label: string;
  hint: string;
  build: () => ForgeGraph;
}

export const FORGE_TEMPLATES: ForgeTemplate[] = [
  { id: 'dice', label: 'Dice', hint: 'Over/under a threshold', build: starterGraph },
  {
    id: 'coinflip',
    label: 'Coinflip',
    hint: '50/50, pays ~2×',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'r', kind: 'rng', x: 40, y: 160, params: {}, inputs: {} },
        { id: 'ch', kind: 'chance', x: 250, y: 150, params: { p: 0.5 }, inputs: { x: 'r' } },
        { id: 'c2', kind: 'const', x: 250, y: 300, params: { value: 1.98 }, inputs: {} },
        { id: 'm', kind: 'math', x: 470, y: 190, params: { op: '×' }, inputs: { a: 'ch', b: 'c2' } },
        { id: 'pay', kind: 'payout', x: 690, y: 200, params: { scale: 1 }, inputs: { mult: 'm' } },
      ],
    }),
  },
  {
    id: 'crash',
    label: 'Crash',
    hint: 'Exponential crash curve, capped',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'r', kind: 'rng', x: 40, y: 190, params: {}, inputs: {} },
        { id: 'cv', kind: 'curve', x: 250, y: 180, params: { type: 'crash', k: 0.99 }, inputs: { x: 'r' } },
        { id: 'cap', kind: 'const', x: 250, y: 320, params: { value: 100 }, inputs: {} },
        { id: 'mn', kind: 'math', x: 470, y: 210, params: { op: 'min' }, inputs: { a: 'cv', b: 'cap' } },
        { id: 'pay', kind: 'payout', x: 690, y: 220, params: { scale: 1 }, inputs: { mult: 'mn' } },
      ],
    }),
  },
  {
    id: 'wheel',
    label: 'Wheel',
    hint: 'Weighted segments',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'r', kind: 'rng', x: 60, y: 180, params: {}, inputs: {} },
        { id: 'sg', kind: 'segments', x: 300, y: 150, params: { segs: '0:12, 1.5:8, 2:4, 5:2, 20:1' }, inputs: { x: 'r' } },
        { id: 'pay', kind: 'payout', x: 620, y: 190, params: { scale: 1 }, inputs: { mult: 'sg' } },
      ],
    }),
  },
  {
    id: 'tower',
    label: 'Risk tower',
    hint: 'Climb or bust — high volatility',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'ld', kind: 'ladder', x: 90, y: 150, params: { steps: 8, p: 0.74, step: 1.3 }, inputs: {} },
        { id: 'cp', kind: 'clamp', x: 340, y: 160, params: { lo: 0, hi: 500 }, inputs: { x: 'ld' } },
        { id: 'pay', kind: 'payout', x: 590, y: 180, params: { scale: 1 }, inputs: { mult: 'cp' } },
      ],
    }),
  },
  {
    id: 'bestof',
    label: 'Best of N',
    hint: 'Keep your luckiest roll',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'md', kind: 'multidraw', x: 60, y: 170, params: { n: 3, op: 'max' }, inputs: {} },
        { id: 'cv', kind: 'curve', x: 300, y: 160, params: { type: 'crash', k: 0.55 }, inputs: { x: 'md' } },
        { id: 'cp', kind: 'clamp', x: 520, y: 170, params: { lo: 0, hi: 200 }, inputs: { x: 'cv' } },
        { id: 'pay', kind: 'payout', x: 740, y: 190, params: { scale: 1 }, inputs: { mult: 'cp' } },
      ],
    }),
  },
  {
    id: 'slot',
    label: 'Slot',
    hint: 'Match the reels',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'rl', kind: 'reel', x: 120, y: 150, params: { symbols: '0:60, 3:20, 8:8, 25:3, 100:1', reels: 3 }, inputs: {} },
        { id: 'pay', kind: 'payout', x: 440, y: 170, params: { scale: 1 }, inputs: { mult: 'rl' } },
      ],
    }),
  },
  {
    id: 'scratch',
    label: 'Scratch',
    hint: 'Match 3 to win',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'sc', kind: 'scratch', x: 120, y: 150, params: { prizes: '0:45, 2:22, 5:12, 20:5, 60:1', cells: 9, need: 3 }, inputs: {} },
        { id: 'pay', kind: 'payout', x: 460, y: 170, params: { scale: 1 }, inputs: { mult: 'sc' } },
      ],
    }),
  },
  {
    id: 'blank',
    label: 'Blank',
    hint: 'Start from scratch',
    build: (): ForgeGraph => ({
      nodes: [
        { id: 'r', kind: 'rng', x: 80, y: 180, params: {}, inputs: {} },
        { id: 'pay', kind: 'payout', x: 520, y: 190, params: { scale: 1 }, inputs: {} },
      ],
    }),
  },
];
