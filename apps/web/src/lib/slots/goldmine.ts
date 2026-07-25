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

/**
 * Everything one slot needs to differ from another. Creator-made slots vary the
 * weights, the cluster threshold and the ladder; `payScale` is then solved for
 * so the edge lands exactly where the creator asked, which is why no dial a
 * creator can turn is able to break the maths.
 */
export interface SlotConfig {
  /** weight per symbol id 0..7 plus the scatter last */
  weights: number[];
  /** pay tiers per pay symbol 0..7 */
  pays: [number, number, number][];
  /** multiplies every payout — solved by normaliseSlot to hit a target edge */
  payScale: number;
  minCluster: number;
  ladder: number[];
  scattersForBonus: number;
  freeSpins: number;
}

export const DEFAULT_CONFIG: SlotConfig = {
  weights: SYMBOLS.map((s) => s.weight),
  pays: SYMBOLS.filter((s) => s.id !== SCATTER).map((s) => s.pays),
  payScale: 1,
  minCluster: MIN_CLUSTER,
  ladder: LADDER,
  scattersForBonus: SCATTERS_FOR_BONUS,
  freeSpins: FREE_SPINS,
};

/** Draw one symbol from the weighted reel set. */
function drawSymbol(u: number, cfg: SlotConfig): number {
  const total = cfg.weights.reduce((a, b) => a + b, 0);
  const target = u * total;
  let acc = 0;
  for (let i = 0; i < cfg.weights.length; i++) {
    acc += cfg.weights[i];
    // The scatter always occupies the final weight slot.
    if (target < acc) return i === cfg.weights.length - 1 ? SCATTER : i;
  }
  return SCATTER;
}

/** Payout for `count` of `sym`, as a multiple of the bet (0 when it doesn't pay). */
export function payFor(sym: number, count: number, cfg: SlotConfig = DEFAULT_CONFIG): number {
  if (sym === SCATTER || count < cfg.minCluster) return 0;
  const row = cfg.pays[sym];
  if (!row) return 0;
  const tier = count >= cfg.minCluster + 4 ? 2 : count >= cfg.minCluster + 2 ? 1 : 0;
  return row[tier] * cfg.payScale;
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

function freshGrid(next: () => number, cfg: SlotConfig): number[][] {
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => drawSymbol(next(), cfg)));
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
function collapse(grid: number[][], winning: Set<number>, next: () => number, cfg: SlotConfig): number[][] {
  const out: number[][] = [];
  for (let c = 0; c < COLS; c++) {
    // Keep survivors in order, then pad the top with fresh ore.
    const survivors = grid[c].filter((_, r) => !winning.has(cellIndex(c, r)));
    const missing = ROWS - survivors.length;
    const fresh = Array.from({ length: missing }, () => drawSymbol(next(), cfg));
    out.push([...fresh, ...survivors]);
  }
  return out;
}

/**
 * One spin, resolved to completion. `startMultiplier` carries the bonus ladder
 * in; in the base game the ladder resets every spin, which is what keeps the
 * free-spin run feeling like a different gear.
 */
export function spin(next: () => number, opts: { free: boolean; startMultiplier: number }, cfg: SlotConfig = DEFAULT_CONFIG): SpinResult {
  const rounds: Collapse[] = [];
  let grid = freshGrid(next, cfg);
  const scatters = tally(grid).get(SCATTER)?.length ?? 0;

  let step = 0;
  let mult = opts.startMultiplier;
  let total = 0;

  for (;;) {
    const counts = tally(grid);
    const wins: Collapse['wins'] = [];
    const winning = new Set<number>();

    for (const [sym, cells] of counts) {
      const pay = payFor(sym, cells.length, cfg);
      if (pay > 0) {
        wins.push({ sym, count: cells.length, cells, pay });
        for (const cell of cells) winning.add(cell);
      }
    }

    if (wins.length === 0) break;

    // In the bonus the ladder keeps climbing; in the base game it walks per spin.
    const multiplier = opts.free ? mult : cfg.ladder[Math.min(step, cfg.ladder.length - 1)];
    const won = wins.reduce((s, w) => s + w.pay, 0) * multiplier;
    total += won;
    rounds.push({ grid: grid.map((col) => [...col]), wins, multiplier, won });

    grid = collapse(grid, winning, next, cfg);
    step += 1;
    if (opts.free) mult = cfg.ladder[Math.min(step, cfg.ladder.length - 1)];
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
export function playRound(next: () => number, cfg: SlotConfig = DEFAULT_CONFIG): RoundResult {
  const spins: SpinResult[] = [];
  const first = spin(next, { free: false, startMultiplier: 1 }, cfg);
  spins.push(first);

  let freeSpins = first.scatters >= cfg.scattersForBonus ? cfg.freeSpins : 0;
  let awarded = freeSpins;
  let carried = 1;

  let remaining = freeSpins;
  let guard = 0;
  while (remaining > 0 && guard < 200) {
    const s = spin(next, { free: true, startMultiplier: carried }, cfg);
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
export function simulate(rounds: number, rng: () => number, cfg: SlotConfig = DEFAULT_CONFIG): SlotStats {
  let paid = 0;
  let hits = 0;
  let bonuses = 0;
  let best = 0;
  let capHits = 0;
  for (let i = 0; i < rounds; i++) {
    const r = playRound(rng, cfg);
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

/* --------------------------------------------------------------- authoring */

export type Volatility = 'steady' | 'balanced' | 'wild';

/**
 * Volatility presets and their VERIFIED payout scales.
 *
 * These numbers are not computed at runtime. This slot has enormous variance
 * (per-round SD of 3-10x the bet, with a bonus 1 in 33-51), so a Monte-Carlo
 * run short enough for a browser gives an RTP estimate that is wrong by whole
 * percentage points — an early attempt at live normalisation produced a
 * NEGATIVE house edge on the wild preset. Payout is exactly linear in the
 * paytable, so instead each preset's RTP at payScale=1 was measured offline over
 * 2,000,000 rounds and the scale is derived in closed form from that constant.
 *
 * `rtpAt1` is the measured constant; `stats` are the measured shape figures the
 * builder shows. Re-measure with scripts/audit if the weights ever change.
 */
export const VOLATILITY: Record<Volatility, {
  label: string;
  hint: string;
  rtpAt1: number;
  stats: { hitRate: number; bonusRate: number; sd: number };
  build: () => Omit<SlotConfig, 'payScale'>;
}> = {
  steady: {
    label: 'Steady seam',
    hint: 'Frequent small hits, a gentle ladder',
    rtpAt1: 2.13174,
    stats: { hitRate: 0.261, bonusRate: 1 / 33, sd: 9.69 },
    build: () => ({
      weights: [19, 18, 16, 14, 11, 8.5, 6, 3.5, 4],
      pays: DEFAULT_CONFIG.pays,
      minCluster: 9,
      ladder: [1, 2, 3, 4, 6, 8, 10, 12],
      scattersForBonus: 4,
      freeSpins: 8,
    }),
  },
  balanced: {
    label: 'Deep vein',
    hint: 'The classic Goldmine rhythm',
    rtpAt1: 0.96603,
    stats: { hitRate: 0.177, bonusRate: 1 / 36, sd: 4.71 },
    build: () => ({
      weights: DEFAULT_CONFIG.weights,
      pays: DEFAULT_CONFIG.pays,
      minCluster: DEFAULT_CONFIG.minCluster,
      ladder: DEFAULT_CONFIG.ladder,
      scattersForBonus: DEFAULT_CONFIG.scattersForBonus,
      freeSpins: DEFAULT_CONFIG.freeSpins,
    }),
  },
  wild: {
    label: 'Blast shaft',
    hint: 'Rare, violent, express-driven',
    rtpAt1: 0.53817,
    stats: { hitRate: 0.120, bonusRate: 1 / 51, sd: 3.23 },
    build: () => ({
      weights: [23, 20, 18, 14, 9, 6.5, 4, 2, 3.5],
      pays: DEFAULT_CONFIG.pays,
      minCluster: 11,
      ladder: [1, 3, 6, 10, 16, 25, 40, 60],
      scattersForBonus: 4,
      freeSpins: 12,
    }),
  },
};

/**
 * The house edge creators may pick. Only 3% is offered: at 2M rounds the
 * measurement's own 3-sigma band is +/-0.9 to 1.25pp depending on preset, so 3%
 * is the single value whose band stays inside the 1-5% vault limits for ALL
 * three presets. Offering 2% or 4% as well would have let the wild preset ship
 * a game whose true edge might sit outside the band. Creators pick the feel;
 * the platform fixes the edge at an audited value.
 */
export const EDGE_CHOICES = [0.03];

/** Build a finished, vault-safe config from a preset and an audited edge. */
export function buildSlot(volatility: Volatility, targetEdge: number): SlotConfig {
  const preset = VOLATILITY[volatility];
  const edge = EDGE_CHOICES.includes(targetEdge) ? targetEdge : EDGE_CHOICES[0];
  return { ...preset.build(), payScale: Math.round(((1 - edge) / preset.rtpAt1) * 10000) / 10000 };
}

/** Live audit, for scripts and tests — too slow to be worth calling in the UI. */
export function auditSlot(cfg: SlotConfig, rounds = 60000, seed = 0xa11ce): SlotStats {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return simulate(rounds, rng, cfg);
}

/* ------------------------------------------------------------ serialisation */

export function slotToParams(cfg: SlotConfig): Record<string, number | string> {
  return { slot: JSON.stringify(cfg) };
}

export function slotFromParams(params?: Record<string, number | string>): SlotConfig {
  if (!params?.slot) return DEFAULT_CONFIG;
  try {
    const c = JSON.parse(String(params.slot)) as SlotConfig;
    // Anything malformed falls back rather than producing a broken paytable.
    if (!Array.isArray(c.weights) || !Array.isArray(c.pays) || !Array.isArray(c.ladder)) return DEFAULT_CONFIG;
    if (c.weights.length !== 9 || c.pays.length !== 8) return DEFAULT_CONFIG;
    if (!Number.isFinite(c.payScale) || c.payScale <= 0) return DEFAULT_CONFIG;
    return {
      weights: c.weights.map((w) => Math.max(0.1, Number(w) || 1)),
      pays: c.pays,
      payScale: c.payScale,
      minCluster: Math.max(5, Math.min(20, Number(c.minCluster) || MIN_CLUSTER)),
      ladder: c.ladder.map((n) => Math.max(1, Number(n) || 1)),
      scattersForBonus: Math.max(3, Math.min(6, Number(c.scattersForBonus) || 4)),
      freeSpins: Math.max(4, Math.min(20, Number(c.freeSpins) || 10)),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
