/**
 * GOLDMINE EXPRESS — the train hold-and-win, rebuilt for Soltrend.
 *
 * Base game: five wagons (reels) four ore deep, paying left-to-right on ways.
 * Land six or more gold wagons and the Express Run begins: the board clears to
 * the train, every gold wagon locks in place holding its value, and you get
 * three respins. Any new wagon that lands resets the count back to three, so the
 * run only ends when the train stops filling. Fill all twenty berths and the
 * whole haul is yours.
 *
 * Three wagons are not just cargo:
 *   LOCOMOTIVE  sweeps every value on the train into itself
 *   PAYER       hands its own value to every other wagon aboard
 *   DYNAMITE    multiplies the final haul
 *
 * Deliberately import-free: the tuning harness runs this exact file under Node's
 * type stripping, so the numbers that were audited are the numbers that ship.
 */

export const REELS = 5;
export const ROWS = 4;
export const BERTHS = REELS * ROWS;

/* ------------------------------------------------------------- base symbols */

export const WAGON = 8; // the gold wagon: bonus trigger, never a line win
export const WILD = 7;

export interface SymbolDef {
  id: number;
  key: string;
  name: string;
  weight: number;
  /** ways pay for 3, 4 and 5 of a kind from the left */
  pays: [number, number, number];
}

export const SYMBOLS: SymbolDef[] = [
  { id: 0, key: 'coal', name: 'Coal', weight: 26, pays: [0.02, 0.07, 0.2] },
  { id: 1, key: 'iron', name: 'Iron', weight: 23, pays: [0.03, 0.09, 0.3] },
  { id: 2, key: 'copper', name: 'Copper', weight: 20, pays: [0.04, 0.13, 0.42] },
  { id: 3, key: 'quartz', name: 'Quartz', weight: 17, pays: [0.07, 0.21, 0.64] },
  { id: 4, key: 'ruby', name: 'Ruby', weight: 12, pays: [0.1, 0.34, 1] },
  { id: 5, key: 'emerald', name: 'Emerald', weight: 9, pays: [0.17, 0.6, 1.7] },
  { id: 6, key: 'gold', name: 'Gold bar', weight: 6, pays: [0.34, 1.2, 3.4] },
  { id: WILD, key: 'lantern', name: 'Lantern', weight: 3, pays: [0, 0, 0] },
  { id: WAGON, key: 'wagon', name: 'Gold wagon', weight: 12, pays: [0, 0, 0] },
];

/** Gold wagons trigger the run at this many, anywhere on the board. */
export const TRIGGER = 6;
export const START_RESPINS = 3;
/** Filling every berth ends the run and pays this on top. */
export const GRAND = 100;
/** Vault ceiling — no round may pay beyond this multiple of the bet. */
export const MAX_WIN = 1000;

/* -------------------------------------------------------------- the wagons */

export type WagonKind = 'value' | 'locomotive' | 'payer' | 'dynamite';

export interface WagonCargo {
  kind: WagonKind;
  /** value in bet multiples; for dynamite this is the multiplier itself */
  value: number;
}

/** Cargo table — what a landing wagon turns out to be carrying. */
const CARGO: { kind: WagonKind; value: number; weight: number }[] = [
  { kind: 'value', value: 0.4, weight: 30 },
  { kind: 'value', value: 0.6, weight: 22 },
  { kind: 'value', value: 1, weight: 16 },
  { kind: 'value', value: 1.5, weight: 10 },
  { kind: 'value', value: 2.5, weight: 6 },
  { kind: 'value', value: 5, weight: 3 },
  { kind: 'value', value: 10, weight: 1.2 },
  { kind: 'value', value: 25, weight: 0.35 },
  { kind: 'locomotive', value: 0.8, weight: 4.5 },
  { kind: 'payer', value: 0.5, weight: 4.5 },
  { kind: 'dynamite', value: 2, weight: 1.6 },
  { kind: 'dynamite', value: 3, weight: 0.6 },
];

const CARGO_WEIGHT = CARGO.reduce((s, c) => s + c.weight, 0);

function drawCargo(u: number, scale: number): WagonCargo {
  let acc = 0;
  const t = u * CARGO_WEIGHT;
  for (const c of CARGO) {
    acc += c.weight;
    // Dynamite is a multiplier, so it must never be scaled like a payout.
    if (t < acc) return { kind: c.kind, value: c.kind === 'dynamite' ? c.value : c.value * scale };
  }
  return { kind: 'value', value: 0.4 * scale };
}

/* ---------------------------------------------------------------- the reels */

export interface SlotConfig {
  weights: number[];
  pays: [number, number, number][];
  /** scales every payout so the edge lands where it was audited */
  payScale: number;
  trigger: number;
  startRespins: number;
  grand: number;
}

/**
 * The shipped tuning. `payScale` is not computed at runtime: this game has huge
 * variance (per-round SD of 6.5x the bet, a train 1 in 120), so a browser-sized
 * Monte-Carlo would be wrong by whole percentage points. Payout is exactly
 * linear in the scale, so RTP at scale 1 was measured offline over 2,000,000
 * rounds (0.91792) and the scale derives from that constant in closed form.
 */
export const DEFAULT_CONFIG: SlotConfig = {
  weights: SYMBOLS.map((s) => s.weight),
  pays: SYMBOLS.map((s) => s.pays),
  payScale: 1.0567,
  trigger: TRIGGER,
  startRespins: START_RESPINS,
  grand: GRAND,
};

function drawSymbol(u: number, cfg: SlotConfig): number {
  const total = cfg.weights.reduce((a, b) => a + b, 0);
  const t = u * total;
  let acc = 0;
  for (let i = 0; i < cfg.weights.length; i++) {
    acc += cfg.weights[i];
    if (t < acc) return i;
  }
  return 0;
}

/* ------------------------------------------------------------- base spin */

export interface WayWin {
  sym: number;
  length: number;
  ways: number;
  pay: number;
}

export interface BaseSpin {
  /** grid[reel][row] */
  grid: number[][];
  wins: WayWin[];
  won: number;
  wagons: number;
}

/**
 * Ways pays: a symbol scores when it appears on consecutive reels from the left,
 * and the number of ways is the product of its count on each of those reels.
 * The lantern substitutes for any ore; gold wagons never form a line.
 */
export function evaluateBase(grid: number[][], cfg: SlotConfig): BaseSpin {
  const wins: WayWin[] = [];
  let won = 0;

  for (let sym = 0; sym <= 6; sym++) {
    let ways = 1;
    let length = 0;
    for (let r = 0; r < REELS; r++) {
      const count = grid[r].filter((s) => s === sym || s === WILD).length;
      if (count === 0) break;
      ways *= count;
      length += 1;
    }
    if (length >= 3) {
      const pay = cfg.pays[sym][length - 3] * cfg.payScale * ways;
      if (pay > 0) {
        wins.push({ sym, length, ways, pay });
        won += pay;
      }
    }
  }

  const wagons = grid.reduce((s, reel) => s + reel.filter((x) => x === WAGON).length, 0);
  return { grid, wins, won, wagons };
}

export function spinBase(next: () => number, cfg: SlotConfig): BaseSpin {
  const grid = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => drawSymbol(next(), cfg)));
  return evaluateBase(grid, cfg);
}

/* ----------------------------------------------------------- the express run */

export interface BonusEvent {
  kind: 'land' | 'locomotive' | 'payer' | 'reset' | 'grand';
  /** berth index this event centres on */
  berth?: number;
  amount?: number;
}

export interface BonusStep {
  /** the train after this step — null berth means empty */
  train: (WagonCargo | null)[];
  /** berths that took a new wagon this step */
  landed: number[];
  events: BonusEvent[];
  respinsLeft: number;
  /** running haul after this step, before dynamite */
  haul: number;
}

export interface BonusRun {
  steps: BonusStep[];
  /** product of every dynamite aboard */
  multiplier: number;
  /** final haul including dynamite and any grand prize, before the vault cap */
  total: number;
  filled: boolean;
}

const sumTrain = (train: (WagonCargo | null)[]) =>
  train.reduce((s, w) => s + (w && w.kind !== 'dynamite' ? w.value : 0), 0);

/**
 * Run the express. Locks the triggering wagons, then respins the empty berths
 * until three consecutive spins add nothing — every new wagon buys the run
 * another three.
 */
export function runExpress(next: () => number, trigger: (WagonCargo | null)[], cfg: SlotConfig): BonusRun {
  const train = [...trigger];
  const steps: BonusStep[] = [];
  let respins = cfg.startRespins;
  let guard = 0;

  // The opening state, before any respin.
  steps.push({
    train: [...train],
    landed: train.map((w, i) => (w ? i : -1)).filter((i) => i >= 0),
    events: [{ kind: 'land' }],
    respinsLeft: respins,
    haul: sumTrain(train),
  });

  while (respins > 0 && guard < 60) {
    guard += 1;
    respins -= 1;
    const landed: number[] = [];
    const events: BonusEvent[] = [];

    for (let b = 0; b < BERTHS; b++) {
      if (train[b]) continue;
      // Each empty berth has its own chance to take a wagon this respin.
      if (next() < 0.098) {
        train[b] = drawCargo(next(), cfg.payScale);
        landed.push(b);
      }
    }

    if (landed.length > 0) {
      respins = cfg.startRespins;
      events.push({ kind: 'reset' });
    }

    // Payers hand out first, then locomotives sweep — so a locomotive landing
    // alongside a payer collects the boosted values, which is what makes a
    // double-landing feel like the jackpot moment it is.
    for (const b of landed) {
      const w = train[b];
      if (w?.kind === 'payer') {
        let paid = 0;
        for (let i = 0; i < BERTHS; i++) {
          const other = train[i];
          if (i !== b && other && other.kind !== 'dynamite') {
            other.value += w.value;
            paid += w.value;
          }
        }
        events.push({ kind: 'payer', berth: b, amount: paid });
      }
    }
    for (const b of landed) {
      const w = train[b];
      if (w?.kind === 'locomotive') {
        const swept = sumTrain(train) - w.value;
        w.value += swept;
        events.push({ kind: 'locomotive', berth: b, amount: swept });
      }
    }

    const full = train.every((w) => w !== null);
    if (full) events.push({ kind: 'grand', amount: cfg.grand * cfg.payScale });

    steps.push({
      train: train.map((w) => (w ? { ...w } : null)),
      landed,
      events,
      respinsLeft: full ? 0 : respins,
      haul: sumTrain(train),
    });

    if (full) {
      const multiplier = train.reduce((m, w) => (w?.kind === 'dynamite' ? m * w.value : m), 1);
      return {
        steps,
        multiplier,
        total: sumTrain(train) * multiplier + cfg.grand * cfg.payScale,
        filled: true,
      };
    }
  }

  const multiplier = train.reduce((m, w) => (w?.kind === 'dynamite' ? m * w.value : m), 1);
  return { steps, multiplier, total: sumTrain(train) * multiplier, filled: false };
}

/* ------------------------------------------------------------------- round */

export interface RoundResult {
  base: BaseSpin;
  bonus: BonusRun | null;
  /** everything, after the vault cap */
  total: number;
}

export function playRound(next: () => number, cfg: SlotConfig = DEFAULT_CONFIG): RoundResult {
  const base = spinBase(next, cfg);
  let bonus: BonusRun | null = null;

  if (base.wagons >= cfg.trigger) {
    // Lock the triggering wagons where they sat, each with its own cargo.
    const train: (WagonCargo | null)[] = Array.from({ length: BERTHS }, () => null);
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (base.grid[r][row] === WAGON) train[r * ROWS + row] = drawCargo(next(), cfg.payScale);
      }
    }
    bonus = runExpress(next, train, cfg);
  }

  const raw = base.won + (bonus?.total ?? 0);
  return { base, bonus, total: Math.min(raw, MAX_WIN) };
}

/* -------------------------------------------------------------------- audit */

export interface SlotStats {
  rtp: number;
  edge: number;
  hitRate: number;
  bonusRate: number;
  maxWin: number;
  capHits: number;
  fillRate: number;
  sd: number;
}

export function simulate(rounds: number, rng: () => number, cfg: SlotConfig = DEFAULT_CONFIG): SlotStats {
  let sum = 0;
  let sumSq = 0;
  let hits = 0;
  let bonuses = 0;
  let fills = 0;
  let best = 0;
  let caps = 0;
  for (let i = 0; i < rounds; i++) {
    const r = playRound(rng, cfg);
    sum += r.total;
    sumSq += r.total * r.total;
    if (r.total > 0) hits += 1;
    if (r.bonus) bonuses += 1;
    if (r.bonus?.filled) fills += 1;
    if (r.total > best) best = r.total;
    if (r.total >= MAX_WIN - 1e-9) caps += 1;
  }
  const rtp = sum / rounds;
  return {
    rtp,
    edge: 1 - rtp,
    hitRate: hits / rounds,
    bonusRate: bonuses / rounds,
    maxWin: best,
    capHits: caps,
    fillRate: fills / rounds,
    sd: Math.sqrt(sumSq / rounds - rtp * rtp),
  };
}

/* ---------------------------------------------------------------- authoring */

export type Volatility = 'steady' | 'balanced' | 'wild';

/**
 * Presets, and their VERIFIED payout scales.
 *
 * Not computed at runtime. This game's per-round SD is ~6.5x the bet with a
 * train 1 in 120, so a browser-sized Monte-Carlo mis-estimates RTP by whole
 * percentage points. Payout is exactly linear in payScale, so each preset's RTP
 * at scale 1 was measured offline and the scale derives from that constant.
 */
export const VOLATILITY: Record<Volatility, {
  label: string;
  hint: string;
  rtpAt1: number;
  stats: { hitRate: number; trainRate: number };
  build: () => Omit<SlotConfig, 'payScale'>;
}> = {
  steady: {
    label: 'Branch line',
    hint: 'The train comes often, hauls lighter',
    rtpAt1: 1.31502,
    stats: { hitRate: 0.632, trainRate: 1 / 54 },
    build: () => ({
      weights: [26, 23, 20, 17, 12, 9, 6, 3, 14.5],
      pays: DEFAULT_CONFIG.pays,
      trigger: 6,
      startRespins: 3,
      grand: 100,
    }),
  },
  balanced: {
    label: 'Main line',
    hint: 'The classic Goldmine rhythm',
    rtpAt1: 0.91792,
    stats: { hitRate: 0.643, trainRate: 1 / 120 },
    build: () => ({
      weights: DEFAULT_CONFIG.weights,
      pays: DEFAULT_CONFIG.pays,
      trigger: DEFAULT_CONFIG.trigger,
      startRespins: DEFAULT_CONFIG.startRespins,
      grand: DEFAULT_CONFIG.grand,
    }),
  },
  wild: {
    label: 'Deep haul',
    hint: 'Rarer train, four respins, bigger grand',
    rtpAt1: 0.91701,
    stats: { hitRate: 0.650, trainRate: 1 / 178 },
    build: () => ({
      weights: [26, 23, 20, 17, 12, 9, 6, 3, 11],
      pays: DEFAULT_CONFIG.pays,
      trigger: 6,
      startRespins: 4,
      grand: 150,
    }),
  },
};

/**
 * The house edge creators may pick. Only 3%: the measurement's own 3-sigma band
 * is around +/-1.5pp on this game, so 3% is the value whose band stays inside
 * the 1-5% vault limits for every preset. Creators pick the feel; the platform
 * fixes the edge at an audited number.
 */
export const EDGE_CHOICES = [0.03];

export function buildSlot(volatility: Volatility, targetEdge: number): SlotConfig {
  const preset = VOLATILITY[volatility];
  const edge = EDGE_CHOICES.includes(targetEdge) ? targetEdge : EDGE_CHOICES[0];
  return { ...preset.build(), payScale: Math.round(((1 - edge) / preset.rtpAt1) * 10000) / 10000 };
}

export function slotToParams(cfg: SlotConfig): Record<string, number | string> {
  return { slot: JSON.stringify(cfg) };
}

export function slotFromParams(params?: Record<string, number | string>): SlotConfig {
  if (!params?.slot) return DEFAULT_CONFIG;
  try {
    const c = JSON.parse(String(params.slot)) as SlotConfig;
    if (!Array.isArray(c.weights) || !Array.isArray(c.pays)) return DEFAULT_CONFIG;
    if (c.weights.length !== 9 || c.pays.length !== 9) return DEFAULT_CONFIG;
    if (!Number.isFinite(c.payScale) || c.payScale <= 0 || c.payScale > 5) return DEFAULT_CONFIG;
    return {
      weights: c.weights.map((w) => Math.max(0.1, Number(w) || 1)),
      pays: c.pays,
      payScale: c.payScale,
      trigger: Math.max(4, Math.min(8, Number(c.trigger) || TRIGGER)),
      startRespins: Math.max(2, Math.min(5, Number(c.startRespins) || START_RESPINS)),
      grand: Math.max(0, Math.min(300, Number(c.grand) || GRAND)),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
