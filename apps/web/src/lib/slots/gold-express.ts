/**
 * GOLD MINE EXPRESS — rebuilt to match the modern online game (TaDa Gaming /
 * JILI, 2025): five reels, four rows, twenty fixed paylines, and the full
 * collect-train-jackpot feature stack.
 *
 * Base game: card ranks (10-A) and mining gear pay left-to-right on 20 lines;
 * the lantern is Wild for everything except the special symbols.
 *
 *   GOLD MINE    lands on reels 1-4 holding a cash value — but only pays when
 *   BELL         lands on reel 5 and collects every gold value on screen, or
 *   GOLDEN TRAIN lands on reel 5, collecting with a random multiplier.
 *   TRAIN        coloured trains (red/purple/blue/green) on reels 1-4; when a
 *                collector lands alongside them the TRAIN BONUS runs — each
 *                carriage of that colour pays, and the last carriage can award
 *                a multiplier or the colour's jackpot (Mini/Minor/Major/Grand).
 *   SCATTER      dynamite on reels 1, 3 and 5 — three trigger the Free Games,
 *                where gold rains far more often.
 *   MINE CART    gold that landed but was never collected feeds the cart above
 *                the reels; when it fills, the next spin drops it back as
 *                extra Gold Mines or a guaranteed collector on reel 5.
 *
 * Deliberately import-free (like the rest of the engines): the whole round is
 * a pure function of the provably-fair float stream, so any spin replays
 * exactly from its seeds. RTP is tuned to the real game's 97% — see
 * `DEFAULT_CONFIG.payScale`, derived offline from RTP@1 over millions of rounds.
 */

export const REELS = 5;
export const ROWS = 4;

/* ----------------------------------------------------------------- symbols */

export const WILD = 10;
export const GOLDMINE = 11;
export const TRAIN = 12;
export const BELL = 13; // reel 5 only — collects all gold values
export const GTRAIN = 14; // reel 5 only — collects with a multiplier
export const SCATTER = 15; // reels 1, 3, 5 only

export interface SymbolDef {
  id: number;
  key: string;
  name: string;
  /** line pay for 3, 4 and 5 of a kind, in bet multiples */
  pays: [number, number, number];
}

export const SYMBOLS: SymbolDef[] = [
  { id: 0, key: 'ten', name: '10', pays: [0.1, 0.25, 1] },
  { id: 1, key: 'jack', name: 'J', pays: [0.1, 0.25, 1] },
  { id: 2, key: 'queen', name: 'Q', pays: [0.1, 0.3, 1] },
  { id: 3, key: 'king', name: 'K', pays: [0.1, 0.3, 1] },
  { id: 4, key: 'ace', name: 'A', pays: [0.15, 0.4, 1] },
  { id: 5, key: 'lamp', name: 'Lamp', pays: [0.2, 0.5, 2] },
  { id: 6, key: 'shovel', name: 'Shovel', pays: [0.25, 0.6, 2.5] },
  { id: 7, key: 'hat', name: 'Hard hat', pays: [0.3, 0.75, 3] },
  { id: 8, key: 'bag', name: 'Money bag', pays: [0.4, 1, 4] },
  { id: 9, key: 'bars', name: 'Gold bars', pays: [0.5, 1.25, 5] },
  { id: WILD, key: 'wild', name: 'Wild lantern', pays: [0, 0, 0] },
  { id: GOLDMINE, key: 'mine', name: 'Gold Mine', pays: [0, 0, 0] },
  { id: TRAIN, key: 'train', name: 'Train', pays: [0, 0, 0] },
  { id: BELL, key: 'bell', name: 'Bell', pays: [0, 0, 0] },
  { id: GTRAIN, key: 'gtrain', name: 'Golden Train', pays: [0, 0, 0] },
  { id: SCATTER, key: 'scatter', name: 'Dynamite', pays: [0, 0, 0] },
];

/** Symbols that can form line wins (wilds substitute for these). */
const LINE_SYMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ---------------------------------------------------------------- paylines */

/** The 20 fixed lines, as row indices per reel (0 = top row). */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 0, 0, 0, 0],
  [3, 3, 3, 3, 3],
  [0, 1, 2, 1, 0],
  [3, 2, 1, 2, 3],
  [1, 0, 0, 0, 1],
  [2, 3, 3, 3, 2],
  [1, 2, 3, 2, 1],
  [2, 1, 0, 1, 2],
  [1, 0, 1, 0, 1],
  [2, 3, 2, 3, 2],
  [0, 1, 0, 1, 0],
  [3, 2, 3, 2, 3],
  [1, 1, 0, 1, 1],
  [2, 2, 3, 2, 2],
  [0, 0, 1, 0, 0],
  [3, 3, 2, 3, 3],
  [1, 2, 2, 2, 1],
  [2, 1, 1, 1, 2],
];

/* --------------------------------------------------------------- reel math */

/**
 * Symbol weights. Reels 1-4 carry Gold Mines and coloured Trains; reel 5
 * carries the Bell and the Golden Train instead; scatters live on 1, 3, 5.
 * `FREE_*` is the Free-Games strip — same shape, much richer in gold.
 */
const BASE_SCAT = [14, 14, 13, 13, 13, 8, 8, 7, 7, 7, 5, 4.5, 1.6, 0, 0, 7]; // reels 1 & 3 — carry dynamite
const BASE_PLAIN = [15.4, 15.4, 14.4, 14.4, 14.4, 8, 8, 7, 7, 7, 5, 4.5, 1.6, 0, 0, 0]; // reels 2 & 4 — never
const BASE_R5 = [14, 14, 13, 13, 13, 8, 8, 7, 7, 7, 5, 0, 0, 1.8, 1.0, 7];
const FREE_SCAT = [13, 13, 12, 12, 12, 8, 8, 7, 7, 7, 5, 10, 1.8, 0, 0, 3];
const FREE_PLAIN = [13.6, 13.6, 12.6, 12.6, 12.6, 8, 8, 7, 7, 7, 5, 10, 1.8, 0, 0, 0];
const FREE_R5 = [13, 13, 12, 12, 12, 8, 8, 7, 7, 7, 5, 0, 0, 3.6, 2.2, 3];

/** Per-reel weight tables. Dynamite lives on reels 1, 3 and 5 — never 2 or 4. */
export const REEL_WEIGHTS = {
  base: [BASE_SCAT, BASE_PLAIN, BASE_SCAT, BASE_PLAIN, BASE_R5],
  free: [FREE_SCAT, FREE_PLAIN, FREE_SCAT, FREE_PLAIN, FREE_R5],
};

/** Gold Mine cash values, in bet multiples (before payScale). */
const CASH: { v: number; w: number }[] = [
  { v: 0.5, w: 26 },
  { v: 1, w: 22 },
  { v: 1.5, w: 16 },
  { v: 2, w: 12 },
  { v: 3, w: 9 },
  { v: 5, w: 6 },
  { v: 10, w: 2.4 },
  { v: 15, w: 0.8 },
];
const CASH_W = CASH.reduce((s, c) => s + c.w, 0);

/** Golden Train collect multiplier. */
const GTRAIN_MULT: { v: number; w: number }[] = [
  { v: 2, w: 60 },
  { v: 3, w: 28 },
  { v: 5, w: 12 },
];
const GTRAIN_W = GTRAIN_MULT.reduce((s, m) => s + m.w, 0);

export type TrainColor = 'green' | 'blue' | 'purple' | 'red';
export const TRAIN_COLORS: TrainColor[] = ['green', 'blue', 'purple', 'red'];
/** Colour frequency on the reels — red is deliberately the rarest. */
const TRAIN_COLOR_W = [38, 28, 20, 14];
const TRAIN_COLOR_TOTAL = TRAIN_COLOR_W.reduce((a, b) => a + b, 0);

export interface Jackpot {
  tier: 'mini' | 'minor' | 'major' | 'grand';
  color: TrainColor;
  /** bet multiple, before payScale */
  value: number;
}
export const JACKPOTS: Jackpot[] = [
  { tier: 'mini', color: 'green', value: 10 },
  { tier: 'minor', color: 'blue', value: 25 },
  { tier: 'major', color: 'purple', value: 75 },
  { tier: 'grand', color: 'red', value: 500 },
];

export const FREE_GAMES = 8;
export const MAX_WIN = 5000;
/** Cart capacity in bet multiples — when the meter fills, the drop comes. */
export const CART_CAPACITY = 25;

/* ------------------------------------------------------------------ config */

export interface SlotConfig {
  /** scales every payout so the edge lands on the audited number */
  payScale: number;
  freeGames: number;
}

/**
 * The shipped tuning. Like its predecessor, `payScale` is not computed at
 * runtime: the collect + train + free-games stack is a stochastic process with
 * no closed form, so RTP@1 was measured offline over 2,000,000 rounds and the
 * scale derives from that constant in closed form. Payout is exactly linear in
 * the scale, which the test-suite asserts.
 */
export const RTP_AT_1 = 0.852; // measured offline, pooled 4M rounds across three seeds
export const DEFAULT_CONFIG: SlotConfig = {
  payScale: Math.round((0.97 / RTP_AT_1) * 10000) / 10000,
  freeGames: FREE_GAMES,
};

export function slotFromParams(params?: Record<string, number | string>): SlotConfig {
  if (!params?.slot) return DEFAULT_CONFIG;
  try {
    const c = JSON.parse(String(params.slot)) as Partial<SlotConfig>;
    if (!Number.isFinite(c.payScale) || (c.payScale as number) <= 0 || (c.payScale as number) > 5) {
      return DEFAULT_CONFIG;
    }
    return { payScale: c.payScale as number, freeGames: FREE_GAMES };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/* ------------------------------------------------------------------ helpers */

function drawWeighted(u: number, table: number[]): number {
  const total = table.reduce((a, b) => a + b, 0);
  let t = u * total;
  for (let i = 0; i < table.length; i++) {
    t -= table[i];
    if (t < 0) return i;
  }
  return 0;
}

const drawCash = (u: number) => {
  let t = u * CASH_W;
  for (const c of CASH) {
    t -= c.w;
    if (t < 0) return c.v;
  }
  return CASH[0].v;
};

const drawGtrainMult = (u: number) => {
  let t = u * GTRAIN_W;
  for (const m of GTRAIN_MULT) {
    t -= m.w;
    if (t < 0) return m.v;
  }
  return GTRAIN_MULT[0].v;
};

const drawTrainColor = (u: number): TrainColor => {
  let t = u * TRAIN_COLOR_TOTAL;
  for (let i = 0; i < TRAIN_COLORS.length; i++) {
    t -= TRAIN_COLOR_W[i];
    if (t < 0) return TRAIN_COLORS[i];
  }
  return 'green';
};

/* --------------------------------------------------------------- line wins */

export interface LineWin {
  line: number;
  sym: number;
  length: number;
  pay: number;
}

/**
 * Score the 20 lines on a grid (grid[reel][row]). Only the ten paying symbols
 * form lines; the Wild substitutes for any of them. Special symbols never do.
 */
export function evaluateLines(grid: number[][], payScale: number): { wins: LineWin[]; total: number } {
  const wins: LineWin[] = [];
  let total = 0;
  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li];
    for (const sym of LINE_SYMS) {
      let length = 0;
      for (let r = 0; r < REELS; r++) {
        const s = grid[r][line[r]];
        if (s === sym || s === WILD) length += 1;
        else break;
      }
      if (length >= 3) {
        const pay = SYMBOLS[sym].pays[length - 3] * payScale;
        wins.push({ line: li, sym, length, pay });
        total += pay;
        break; // one win per line — the best symbol already counted
      }
    }
  }
  return { wins, total };
}

/* ------------------------------------------------------------- train bonus */

export interface Carriage {
  /** cash award in bet multiples (after payScale), or the jackpot/mult event */
  award: number;
  jackpot: Jackpot | null;
  multiplier: number; // 1 unless this carriage multiplies the whole train
}

export interface TrainBonus {
  color: TrainColor;
  carriages: Carriage[];
  /** cash collected on the triggering spin (bell/golden train), before the train runs */
  collect: number;
  /** everything the train itself pays, jackpots and multiplier included */
  total: number;
}

/**
 * Run the Train Bonus. Carriage count and prizes come from the stream; the
 * last carriage carries the suspense — a multiplier, or the colour's jackpot.
 */
function runTrainBonus(next: () => number, color: TrainColor, collect: number, payScale: number): TrainBonus {
  const count = 4 + Math.floor(next() * 4); // 4-7 carriages
  const carriages: Carriage[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    if (last) {
      const roll = next();
      if (roll < 0.12) {
        const jp = JACKPOTS.find((j) => j.color === color)!;
        carriages.push({ award: jp.value * payScale, jackpot: jp, multiplier: 1 });
        continue;
      }
      if (roll < 0.36) {
        carriages.push({ award: 0, jackpot: null, multiplier: next() < 0.7 ? 2 : 3 });
        continue;
      }
    }
    const v = drawCash(next()) * (last ? 1.5 : 1);
    carriages.push({ award: v * payScale, jackpot: null, multiplier: 1 });
    sum += v * payScale;
  }
  const mult = carriages.reduce((m, c) => m * c.multiplier, 1);
  const jackpots = carriages.reduce((s, c) => s + (c.jackpot ? c.award : 0), 0);
  return { color, carriages, collect, total: (collect + sum) * mult + jackpots };
}

/* ---------------------------------------------------------------- one spin */

export interface GXSpin {
  grid: number[][];
  /** cash value on each Gold Mine cell (null elsewhere) — bet multiples, scaled */
  cash: (number | null)[][];
  /** colour of each Train cell (null elsewhere) */
  trains: (TrainColor | null)[][];
  lineWins: LineWin[];
  linesTotal: number;
  /** the collect that happened on this spin, if any */
  collect: { kind: 'bell' | 'gtrain'; multiplier: number; total: number } | null;
  trainBonus: TrainBonus | null;
  /** gold value that landed but was not collected → feeds the mine cart */
  cartFeed: number;
  freeSpinsTriggered: boolean;
  /** goldmines the cart dropped onto the board this spin (reel/row pairs) */
  cartDrop: { r: number; row: number }[];
  total: number;
}

/**
 * Play one spin of the reels. `free` selects the Free-Games strip (more gold);
 * `cartDrop >= 0` means the filled mine cart empties onto this spin, injecting
 * extra Gold Mines onto reels 1-4 or forcing a collector onto reel 5.
 */
export function playSpin(
  next: () => number,
  cfg: SlotConfig,
  opts: { free?: boolean; cartDrop?: number } = {},
): GXSpin {
  const free = !!opts.free;
  const weights = free ? REEL_WEIGHTS.free : REEL_WEIGHTS.base;

  const grid: number[][] = [];
  for (let r = 0; r < REELS; r++) {
    grid.push(Array.from({ length: ROWS }, () => drawWeighted(next(), weights[r])));
  }

  const cartDrop: { r: number; row: number }[] = [];
  if ((opts.cartDrop ?? 0) > 0) {
    // The cart tips over: either it rains Gold Mines, or a collector is
    // guaranteed on reel 5. Uses the same stream — fully replayable.
    if (next() < 0.55) {
      const n = 2 + Math.floor(next() * 4); // 2-5 extra gold mines
      for (let i = 0; i < n; i++) {
        const r = Math.floor(next() * (REELS - 1));
        const row = Math.floor(next() * ROWS);
        if (grid[r][row] !== GOLDMINE) {
          grid[r][row] = GOLDMINE;
          cartDrop.push({ r, row });
        }
      }
    } else {
      const row = Math.floor(next() * ROWS);
      grid[REELS - 1][row] = next() < 0.5 ? BELL : GTRAIN;
    }
  }

  // Cash values + train colours ride alongside the grid.
  const cash: (number | null)[][] = [];
  const trains: (TrainColor | null)[][] = [];
  for (let r = 0; r < REELS; r++) {
    cash.push(grid[r].map((s) => (s === GOLDMINE ? drawCash(next()) * cfg.payScale : null)));
    trains.push(grid[r].map((s) => (s === TRAIN ? drawTrainColor(next()) : null)));
  }

  const { wins, total: linesTotal } = evaluateLines(grid, cfg.payScale);

  // The collect: a Bell or Golden Train anywhere on reel 5 sweeps the gold.
  const goldSum = cash.flat().reduce((s: number, v) => s + (v ?? 0), 0);
  const collector = grid[REELS - 1].find((s) => s === BELL || s === GTRAIN) ?? null;
  let collect: GXSpin['collect'] = null;
  let collectTotal = 0;
  if (collector && goldSum > 0) {
    const multiplier = collector === GTRAIN ? drawGtrainMult(next()) : 1;
    collectTotal = goldSum * multiplier;
    collect = { kind: collector === BELL ? 'bell' : 'gtrain', multiplier, total: collectTotal };
  }

  // The Train Bonus: collector + at least one coloured train aboard.
  let trainBonus: TrainBonus | null = null;
  if (collector) {
    const aboard = trains.flat().filter((c): c is TrainColor => c !== null);
    if (aboard.length > 0) {
      // The train takes the colour of the rarest train aboard — the biggest
      // tease on the grid is the one that runs.
      const color = TRAIN_COLORS.map((c, i) => ({ c, i, n: aboard.filter((x) => x === c).length }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.i - a.i || b.n - a.n)[0].c;
      trainBonus = runTrainBonus(next, color, collectTotal, cfg.payScale);
    }
  }

  // Three dynamites — one on each of reels 1, 3 and 5 — trigger the Free Games.
  const freeTrigger =
    grid[0].some((s) => s === SCATTER) && grid[2].some((s) => s === SCATTER) && grid[4].some((s) => s === SCATTER);

  const bonusTotal = trainBonus ? trainBonus.total : collectTotal;
  return {
    grid,
    cash,
    trains,
    lineWins: wins,
    linesTotal,
    collect,
    trainBonus,
    cartFeed: collector ? 0 : goldSum,
    freeSpinsTriggered: !free && freeTrigger,
    cartDrop,
    total: linesTotal + bonusTotal,
  };
}

/* ------------------------------------------------------------------ round */

export interface RoundResult {
  /** the paid spin first, then every free game in order */
  spins: GXSpin[];
  freeGames: number;
  /** everything, after the vault cap */
  total: number;
  capped: boolean;
}

export function playRound(
  next: () => number,
  cfg: SlotConfig = DEFAULT_CONFIG,
  opts: { cartDrop?: number } = {},
): RoundResult {
  const spins: GXSpin[] = [playSpin(next, cfg, { cartDrop: opts.cartDrop })];
  let total = spins[0].total;

  if (spins[0].freeSpinsTriggered) {
    for (let i = 0; i < cfg.freeGames; i++) {
      const s = playSpin(next, cfg, { free: true });
      spins.push(s);
      total += s.total;
      if (total >= MAX_WIN) break;
    }
  }

  const capped = total > MAX_WIN;
  return { spins, freeGames: spins[0].freeSpinsTriggered ? cfg.freeGames : 0, total: Math.min(total, MAX_WIN), capped };
}

/* -------------------------------------------------------------------- audit */

export interface SlotStats {
  rtp: number;
  edge: number;
  hitRate: number;
  collectRate: number;
  trainRate: number;
  freeRate: number;
  maxWin: number;
  sd: number;
}

export function simulate(rounds: number, rng: () => number, cfg: SlotConfig = DEFAULT_CONFIG): SlotStats {
  let sum = 0;
  let sumSq = 0;
  let hits = 0;
  let collects = 0;
  let trains = 0;
  let frees = 0;
  let best = 0;
  for (let i = 0; i < rounds; i++) {
    const r = playRound(rng, cfg);
    sum += r.total;
    sumSq += r.total * r.total;
    if (r.total > 0) hits += 1;
    if (r.spins[0].collect) collects += 1;
    if (r.spins[0].trainBonus) trains += 1;
    if (r.freeGames > 0) frees += 1;
    if (r.total > best) best = r.total;
  }
  const rtp = sum / rounds;
  return {
    rtp,
    edge: 1 - rtp,
    hitRate: hits / rounds,
    collectRate: collects / rounds,
    trainRate: trains / rounds,
    freeRate: frees / rounds,
    maxWin: best,
    sd: Math.sqrt(sumSq / rounds - rtp * rtp),
  };
}
