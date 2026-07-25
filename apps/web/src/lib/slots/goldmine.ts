/**
 * GOLDMINE EXPRESS — the mining-cascade slot, rebuilt for Soltrend.
 *
 * The spirit of the original is kept intact: you are digging a seam, wins blow
 * up and the rubble falls into fresh ore, and every consecutive collapse drives
 * a multiplier higher until the seam finally runs dry. Dynamite blows the shaft
 * open into free spins where the multiplier never resets — the "express" run.
 *
 * What is rebuilt is everything underneath. The grid pays *anywhere* rather than
 * on drawn lines, so a win is a cluster you can read at a glance instead of a
 * diagram; the whole spin resolves as a timeline of discrete rounds, which is
 * what lets the UI animate every collapse instead of cutting to a result; and
 * the maths is a pure function of an injected random stream, so the same engine
 * that renders is the one that gets simulated and audited.
 *
 * Deliberately free of imports: the tuning harness runs this exact file, so the
 * numbers that were verified are the numbers that ship.
 */

export const COLS = 6;
export const ROWS = 5;
export const CELLS = COLS * ROWS;

/** Pay symbols are 0..7, ordered low to premium; 8 is the dynamite scatter. */
export const SCATTER = 8;

export interface SymbolDef {
  id: number;
  key: string;
  name: string;
  weight: number;
  /** payout as a multiple of the bet, for counts [10-11, 12-13, 14+] */
  pays: [number, number, number];
}

export const SYMBOLS: SymbolDef[] = [
  { id: 0, key: 'coal', name: 'Coal', weight: 21, pays: [1, 2.5, 6] },
  { id: 1, key: 'iron', name: 'Iron', weight: 19, pays: [1.8, 3.6, 8.2] },
  { id: 2, key: 'copper', name: 'Copper', weight: 17, pays: [2.3, 5.6, 11.3] },
  { id: 3, key: 'quartz', name: 'Quartz', weight: 14, pays: [3.5, 8.2, 17.5] },
  { id: 4, key: 'ruby', name: 'Ruby', weight: 10, pays: [7.2, 15.4, 33] },
  { id: 5, key: 'emerald', name: 'Emerald', weight: 7.5, pays: [11.3, 27.7, 57.5] },
  { id: 6, key: 'gold', name: 'Gold', weight: 5, pays: [21.6, 48.3, 103] },
  { id: 7, key: 'diamond', name: 'Diamond', weight: 2.6, pays: [46, 103, 216] },
  { id: SCATTER, key: 'dynamite', name: 'Dynamite', weight: 3.9, pays: [0, 0, 0] },
];

/** Minimum matching symbols anywhere on the grid for a payout. */
export const MIN_CLUSTER = 10;
/** Scatters needed to blow the shaft open. */
export const SCATTERS_FOR_BONUS = 4;
export const FREE_SPINS = 10;
export const RETRIGGER_SPINS = 5;
/** Vault ceiling — no single spin may pay beyond this multiple of the bet. */
export const MAX_WIN = 1000;

/** Multiplier ladder walked by consecutive collapses within one spin. */
export const LADDER = [1, 2, 3, 5, 8, 12, 20, 30];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, d) => s + d.weight, 0);

/** Draw one symbol from the weighted reel set. */
function drawSymbol(u: number): number {
  let acc = 0;
  const target = u * TOTAL_WEIGHT;
  for (const s of SYMBOLS) {
    acc += s.weight;
    if (target < acc) return s.id;
  }
  return SYMBOLS[SYMBOLS.length - 1].id;
}

/** Payout for `count` of `sym`, as a multiple of the bet (0 when it doesn't pay). */
export function payFor(sym: number, count: number): number {
  if (sym === SCATTER || count < MIN_CLUSTER) return 0;
  const def = SYMBOLS[sym];
  const tier = count >= 14 ? 2 : count >= 12 ? 1 : 0;
  return def.pays[tier];
}

/* ------------------------------------------------------------------ the spin */

export interface Collapse {
  /** grid as it stood when this round was evaluated, column-major: grid[col][row] */
  grid: number[][];
  /** symbols that paid this round, with their cell indices */
  wins: { sym: number; count: number; cells: number[]; pay: number }[];
  /** multiplier applied to this round's wins */
  multiplier: number;
  /** credited this round, already multiplied (bet multiples) */
  won: number;
}

export interface SpinResult {
  /** every collapse in order — the UI animates straight down this list */
  rounds: Collapse[];
  /** scatters on the opening grid */
  scatters: number;
  /** total for this spin as a multiple of the bet, after the vault cap */
  total: number;
  /** true when this spin was played inside the bonus */
  free: boolean;
  /** multiplier carried out of this spin (bonus only) */
  carriedMultiplier: number;
}

export interface RoundResult {
  spins: SpinResult[];
  /** free spins awarded across the whole round */
  freeSpins: number;
  /** grand total as a multiple of the bet, after the vault cap */
  total: number;
}

const cellIndex = (col: number, row: number) => col * ROWS + row;

function freshGrid(next: () => number): number[][] {
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => drawSymbol(next())));
}

/** Count every symbol on the grid, remembering where each one sat. */
function tally(grid: number[][]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const sym = grid[c][r];
      const cells = map.get(sym);
      if (cells) cells.push(cellIndex(c, r));
      else map.set(sym, [cellIndex(c, r)]);
    }
  }
  return map;
}

/**
 * Blow out the winning cells, let the column above fall into the hole, and top
 * up from the seam. Mutates a copy — the caller keeps each round's grid intact
 * so the animation can replay the collapse exactly as it was evaluated.
 */
function collapse(grid: number[][], winning: Set<number>, next: () => number): number[][] {
  const out: number[][] = [];
  for (let c = 0; c < COLS; c++) {
    // Keep survivors in order, then pad the top with fresh ore.
    const survivors = grid[c].filter((_, r) => !winning.has(cellIndex(c, r)));
    const missing = ROWS - survivors.length;
    const fresh = Array.from({ length: missing }, () => drawSymbol(next()));
    out.push([...fresh, ...survivors]);
  }
  return out;
}

/**
 * One spin, resolved to completion. `startMultiplier` carries the bonus ladder
 * in; in the base game the ladder resets every spin, which is what keeps the
 * free-spin run feeling like a different gear.
 */
export function spin(next: () => number, opts: { free: boolean; startMultiplier: number }): SpinResult {
  const rounds: Collapse[] = [];
  let grid = freshGrid(next);
  const scatters = tally(grid).get(SCATTER)?.length ?? 0;

  let step = 0;
  let mult = opts.startMultiplier;
  let total = 0;

  for (;;) {
    const counts = tally(grid);
    const wins: Collapse['wins'] = [];
    const winning = new Set<number>();

    for (const [sym, cells] of counts) {
      const pay = payFor(sym, cells.length);
      if (pay > 0) {
        wins.push({ sym, count: cells.length, cells, pay });
        for (const cell of cells) winning.add(cell);
      }
    }

    if (wins.length === 0) break;

    // In the bonus the ladder keeps climbing; in the base game it walks per spin.
    const multiplier = opts.free ? mult : LADDER[Math.min(step, LADDER.length - 1)];
    const won = wins.reduce((s, w) => s + w.pay, 0) * multiplier;
    total += won;
    rounds.push({ grid: grid.map((col) => [...col]), wins, multiplier, won });

    grid = collapse(grid, winning, next);
    step += 1;
    if (opts.free) mult = LADDER[Math.min(step, LADDER.length - 1)];
    // Safety rail: a pathological stream cannot spin forever.
    if (step > 40) break;
  }

  return {
    rounds,
    scatters,
    total: Math.min(total, MAX_WIN),
    free: opts.free,
    carriedMultiplier: opts.free ? mult : 1,
  };
}

/** A full round: the paid spin, plus the bonus run it may open. */
export function playRound(next: () => number): RoundResult {
  const spins: SpinResult[] = [];
  const first = spin(next, { free: false, startMultiplier: 1 });
  spins.push(first);

  let freeSpins = first.scatters >= SCATTERS_FOR_BONUS ? FREE_SPINS : 0;
  let awarded = freeSpins;
  let carried = 1;

  let remaining = freeSpins;
  let guard = 0;
  while (remaining > 0 && guard < 200) {
    const s = spin(next, { free: true, startMultiplier: carried });
    spins.push(s);
    carried = s.carriedMultiplier;
    remaining -= 1;
    guard += 1;
    // Retrigger — the shaft opens again mid-run.
    if (s.scatters >= 3) {
      remaining += RETRIGGER_SPINS;
      awarded += RETRIGGER_SPINS;
    }
  }

  const raw = spins.reduce((sum, s) => sum + s.total, 0);
  return { spins, freeSpins: awarded, total: Math.min(raw, MAX_WIN) };
}

/* -------------------------------------------------------------------- audit */

export interface SlotStats {
  rtp: number;
  edge: number;
  hitRate: number;
  bonusRate: number;
  maxWin: number;
  capHits: number;
}

/** Monte-Carlo the real engine. Used by the tuning harness and the studio. */
export function simulate(rounds: number, rng: () => number): SlotStats {
  let paid = 0;
  let hits = 0;
  let bonuses = 0;
  let best = 0;
  let capHits = 0;
  for (let i = 0; i < rounds; i++) {
    const r = playRound(rng);
    paid += r.total;
    if (r.total > 0) hits += 1;
    if (r.freeSpins > 0) bonuses += 1;
    if (r.total > best) best = r.total;
    if (r.total >= MAX_WIN - 1e-9) capHits += 1;
  }
  const rtp = paid / rounds;
  return {
    rtp,
    edge: 1 - rtp,
    hitRate: hits / rounds,
    bonusRate: bonuses / rounds,
    maxWin: best,
    capHits,
  };
}
