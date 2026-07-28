import { describe, expect, it } from 'vitest';
import { floatStream } from '@/lib/provably-fair';
import {
  REELS, ROWS, BERTHS, WAGON, WILD, SYMBOLS, MAX_WIN, DEFAULT_CONFIG, EDGE_CHOICES, VOLATILITY,
  buildSlot, evaluateBase, playRound, spinBase, type SlotConfig, type Volatility,
} from '@/lib/slots/goldmine';

/**
 * Goldmine Express.
 *
 * The slot is the only game whose return cannot be written down in closed form —
 * the express run is a stochastic process — so its payout scale is derived from
 * an RTP measured offline over two million rounds. That makes it the game most
 * exposed to a silent regression: change a weight and nothing fails, the house
 * just starts losing money.
 *
 * The base game *is* exactly solvable, so it is asserted exactly. Around it sit
 * the two structural guarantees that hold whatever the express run does: the
 * vault cap, and the exact linearity that the offline derivation depends on.
 */

const streamFrom = (label: string) => {
  const s = floatStream('goldmine-suite', label, 0);
  return () => s.next();
};

/**
 * Exact expected base-game payout, by enumeration over reel counts.
 *
 * Ways-pays factorises: a symbol scores on reels 0..L-1 when each holds at least
 * one of it, and the ways are the product of those counts. Reels are i.i.d., and
 * E[count · 1{count>0}] is just E[count], so the whole expectation collapses to
 * a product — no simulation needed.
 */
function exactBaseRtp(cfg: SlotConfig): number {
  const total = cfg.weights.reduce((a, b) => a + b, 0);
  const pWild = cfg.weights[WILD] / total;
  let ev = 0;
  for (let sym = 0; sym <= 6; sym++) {
    const q = cfg.weights[sym] / total + pWild; // the lantern substitutes for any ore
    const perReel = ROWS * q; // E[count]
    const empty = Math.pow(1 - q, ROWS); // P(a reel holds none)
    for (let len = 3; len <= REELS; len++) {
      const closes = len < REELS ? empty : 1;
      ev += cfg.pays[sym][len - 3] * cfg.payScale * Math.pow(perReel, len) * closes;
    }
  }
  return ev;
}

describe('goldmine symbols', () => {
  it('describes a complete, well-formed reel', () => {
    expect(SYMBOLS).toHaveLength(9);
    expect(SYMBOLS.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6, WILD, WAGON]);
    expect(SYMBOLS.every((s) => s.weight > 0)).toBe(true);
    // The lantern and the wagon never form a line of their own.
    expect(SYMBOLS[WILD].pays).toEqual([0, 0, 0]);
    expect(SYMBOLS[WAGON].pays).toEqual([0, 0, 0]);
  });

  it('pays more for rarer ore and for longer lines', () => {
    for (let s = 1; s <= 6; s++) {
      expect(SYMBOLS[s].weight).toBeLessThan(SYMBOLS[s - 1].weight);
      for (let i = 0; i < 3; i++) expect(SYMBOLS[s].pays[i]).toBeGreaterThan(SYMBOLS[s - 1].pays[i]);
    }
    for (const s of SYMBOLS.slice(0, 7)) {
      expect(s.pays[1]).toBeGreaterThan(s.pays[0]);
      expect(s.pays[2]).toBeGreaterThan(s.pays[1]);
    }
  });
});

describe('base game', () => {
  it('scores ways-pays exactly as the rules describe', () => {
    // Five reels of gold bars: 4 of a kind on every reel = 4^5 ways at the 5-pay.
    const grid = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => 6));
    const cfg: SlotConfig = { ...DEFAULT_CONFIG, payScale: 1 };
    const res = evaluateBase(grid, cfg);
    const win = res.wins.find((w) => w.sym === 6);
    expect(win).toBeDefined();
    expect(win!.length).toBe(5);
    expect(win!.ways).toBe(ROWS ** REELS);
    expect(win!.pay).toBeCloseTo(SYMBOLS[6].pays[2] * ROWS ** REELS, 9);
  });

  it('lets the lantern stand in for any ore', () => {
    const grid = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => WILD));
    grid[0] = [4, WILD, WILD, WILD]; // one ruby anchors the line
    const res = evaluateBase(grid, { ...DEFAULT_CONFIG, payScale: 1 });
    expect(res.wins.find((w) => w.sym === 4)).toBeDefined();
  });

  it('never lets a gold wagon form a line', () => {
    const grid = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => WAGON));
    const res = evaluateBase(grid, DEFAULT_CONFIG);
    expect(res.won).toBe(0);
    expect(res.wins).toHaveLength(0);
    expect(res.wagons).toBe(BERTHS);
  });

  it('needs three reels from the left, never a scattered three', () => {
    const grid = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => 0));
    grid[1] = [1, 1, 1, 1]; // break the chain on reel 2
    const res = evaluateBase(grid, DEFAULT_CONFIG);
    expect(res.wins.find((w) => w.sym === 0)).toBeUndefined();
  });

  it('matches its closed-form expectation when actually spun', () => {
    const cfg = DEFAULT_CONFIG;
    const exact = exactBaseRtp(cfg);
    const next = streamFrom('base-rtp');
    const rounds = 400_000;
    let paid = 0;
    for (let i = 0; i < rounds; i++) paid += spinBase(next, cfg).won;
    const measured = paid / rounds;
    // The base game's per-round SD is well under 1x, so 400k rounds pins this
    // to a couple of thousandths. A weight or paytable edit fails here.
    expect(Math.abs(measured - exact)).toBeLessThan(0.02);
    expect(exact).toBeGreaterThan(0.2);
    expect(exact).toBeLessThan(1);
  });
});

describe('the express run', () => {
  it('triggers only on enough wagons, and locks exactly those berths', () => {
    const next = streamFrom('trigger');
    let rounds = 0;
    let bonuses = 0;
    for (let i = 0; i < 60_000; i++) {
      const r = playRound(next, DEFAULT_CONFIG);
      rounds += 1;
      if (r.bonus) {
        bonuses += 1;
        expect(r.base.wagons).toBeGreaterThanOrEqual(DEFAULT_CONFIG.trigger);
        expect(r.bonus.steps.length).toBeGreaterThan(0);
        // The train has one berth per cell and never more.
        expect(r.bonus.steps[0].train).toHaveLength(BERTHS);
      } else {
        expect(r.base.wagons).toBeLessThan(DEFAULT_CONFIG.trigger);
      }
    }
    expect(bonuses).toBeGreaterThan(0);
    // Roughly the advertised rate for the shipped preset (1 in ~120).
    const rate = bonuses / rounds;
    expect(rate).toBeGreaterThan(1 / 400);
    expect(rate).toBeLessThan(1 / 30);
  });

  it('resets the respins whenever a new wagon lands', () => {
    const next = streamFrom('respins');
    for (let i = 0; i < 40_000; i++) {
      const r = playRound(next, DEFAULT_CONFIG);
      if (!r.bonus) continue;
      for (const step of r.bonus.steps) {
        expect(step.respinsLeft).toBeGreaterThanOrEqual(0);
        expect(step.respinsLeft).toBeLessThanOrEqual(DEFAULT_CONFIG.startRespins);
        // A full train ends the run outright, so it reports no respins left.
        const full = step.train.every((w) => w !== null);
        if (step.landed.length > 0 && !full) expect(step.respinsLeft).toBe(DEFAULT_CONFIG.startRespins);
      }
      // A run ends either out of respins or with every berth full.
      const last = r.bonus.steps[r.bonus.steps.length - 1];
      expect(last.respinsLeft === 0 || r.bonus.filled).toBe(true);
    }
  });
});

describe('structural guarantees', () => {
  it('never pays past the vault ceiling', () => {
    for (const preset of Object.keys(VOLATILITY) as Volatility[]) {
      const cfg = buildSlot(preset, EDGE_CHOICES[0]);
      const next = streamFrom(`cap-${preset}`);
      for (let i = 0; i < 25_000; i++) {
        const r = playRound(next, cfg);
        expect(r.total).toBeGreaterThanOrEqual(0);
        expect(r.total).toBeLessThanOrEqual(MAX_WIN);
        expect(Number.isFinite(r.total)).toBe(true);
      }
    }
  });

  it('is exactly linear in the payout scale', () => {
    // This is the property the offline RTP derivation rests on: measure the
    // return at scale 1 and the scale for any target edge follows in closed
    // form. If a payout ever stops scaling, that derivation silently breaks.
    const rounds = 20_000;
    const run = (payScale: number) => {
      const next = streamFrom('linearity');
      let paid = 0;
      for (let i = 0; i < rounds; i++) paid += playRound(next, { ...DEFAULT_CONFIG, payScale }).total;
      return paid;
    };
    const at1 = run(1);
    expect(at1).toBeGreaterThan(0);
    for (const scale of [0.5, 1.5, 2]) {
      // Uncapped rounds scale exactly; the cap can only hold a round back.
      expect(run(scale)).toBeLessThanOrEqual(at1 * scale + 1e-6);
      expect(run(scale)).toBeGreaterThan(at1 * scale * 0.999);
    }
  });

  it('replays identically from the same seed', () => {
    const a = playRound(streamFrom('replay'), DEFAULT_CONFIG);
    const b = playRound(streamFrom('replay'), DEFAULT_CONFIG);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('reproduces the measured RTP each preset ships its scale from', () => {
    // 150k rounds cannot pin a game with this variance precisely, but it does
    // catch the regressions that matter: a wrong constant, a broken preset, a
    // paytable edit that moves the return by whole percentage points.
    for (const preset of Object.keys(VOLATILITY) as Volatility[]) {
      const cfg = { ...buildSlot(preset, EDGE_CHOICES[0]), payScale: 1 };
      const next = streamFrom(`rtp-${preset}`);
      const rounds = 150_000;
      let paid = 0;
      for (let i = 0; i < rounds; i++) paid += playRound(next, cfg).total;
      const measured = paid / rounds;
      const declared = VOLATILITY[preset].rtpAt1;
      expect(Math.abs(measured - declared)).toBeLessThan(0.12);
    }
  });
});
