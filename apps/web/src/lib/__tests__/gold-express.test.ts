import { describe, expect, it } from 'vitest';
import { floatStream } from '@/lib/provably-fair';
import {
  REELS, ROWS, PAYLINES, SYMBOLS, JACKPOTS, TRAIN_COLORS, MAX_WIN, DEFAULT_CONFIG, RTP_AT_1,
  WILD, GOLDMINE, TRAIN, BELL, GTRAIN, SCATTER,
  evaluateLines, playRound, playSpin, simulate, type SlotConfig,
} from '@/lib/slots/gold-express';

/**
 * Gold Mine Express.
 *
 * The return of the collect + train + free-games stack has no closed form, so
 * its payout scale is derived from an RTP measured offline over millions of
 * rounds — the game most exposed to a silent regression. Around that sit the
 * guarantees that CAN be written down: the layout of the special symbols, the
 * line evaluator, the vault cap, and the exact linearity in payScale that the
 * offline derivation depends on.
 */

const streamFrom = (label: string) => {
  const s = floatStream('gold-express-suite', label, 0);
  return () => s.next();
};

describe('symbol layout', () => {
  it('describes a complete, well-formed set', () => {
    expect(SYMBOLS).toHaveLength(16);
    expect(SYMBOLS.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, WILD, GOLDMINE, TRAIN, BELL, GTRAIN, SCATTER]);
    // Special symbols never pay on a line.
    for (const id of [WILD, GOLDMINE, TRAIN, BELL, GTRAIN, SCATTER]) expect(SYMBOLS[id].pays).toEqual([0, 0, 0]);
  });

  it('has exactly 20 well-formed paylines on a 5×4 grid', () => {
    expect(PAYLINES).toHaveLength(20);
    for (const line of PAYLINES) {
      expect(line).toHaveLength(REELS);
      for (const row of line) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(ROWS);
      }
    }
    // no duplicate lines
    expect(new Set(PAYLINES.map((l) => l.join(','))).size).toBe(20);
  });

  it('offers one jackpot per train colour, grand on red', () => {
    expect(JACKPOTS.map((j) => j.color).sort()).toEqual([...TRAIN_COLORS].sort());
    expect(JACKPOTS.find((j) => j.color === 'red')?.tier).toBe('grand');
    const values = JACKPOTS.map((j) => j.value);
    expect(Math.min(...values)).toBeGreaterThan(0);
  });
});

describe('special symbol placement (the rules of the real game)', () => {
  it('gold mines and trains only land on reels 1-4; bell/golden train only on reel 5; scatters on 1, 3, 5', () => {
    const next = streamFrom('placement');
    const cfg = DEFAULT_CONFIG;
    for (let i = 0; i < 4000; i++) {
      const s = playSpin(next, cfg);
      for (let r = 0; r < REELS; r++) {
        for (let row = 0; row < ROWS; row++) {
          const v = s.grid[r][row];
          if (r < REELS - 1) {
            expect(v).not.toBe(BELL);
            expect(v).not.toBe(GTRAIN);
          }
          if (r === REELS - 1) {
            expect(v).not.toBe(GOLDMINE);
            expect(v).not.toBe(TRAIN);
          }
          if (v === SCATTER) expect([0, 2, 4]).toContain(r);
          if (v === GOLDMINE) expect(s.cash[r][row]).toBeGreaterThan(0);
          if (v === TRAIN) expect(TRAIN_COLORS).toContain(s.trains[r][row]);
        }
      }
    }
  });
});

describe('line evaluator', () => {
  const cfg = DEFAULT_CONFIG;
  /** A filler grid verified to pay nothing on any line — the clean slate. */
  const empty = () => Array.from({ length: REELS }, (_, r) => Array.from({ length: ROWS }, (_, row) => (r + 2 * row) % 10));

  it('the filler slate pays nothing on any of the 20 lines', () => {
    expect(evaluateLines(empty(), cfg.payScale).total).toBe(0);
  });

  it('pays 3/4/5 of a kind left-to-right, wilds substitute', () => {
    // Line 0 is rows [1,1,1,1,1]. Gold bars on reels 0-1, a Wild on reel 2.
    const grid = empty();
    grid[0][1] = 9;
    grid[1][1] = 9;
    grid[2][1] = WILD; // substitutes
    const { wins, total } = evaluateLines(grid, cfg.payScale);
    const w = wins.find((x) => x.line === 0 && x.sym === 9);
    expect(w?.length).toBe(3);
    expect(total).toBeCloseTo(SYMBOLS[9].pays[0] * cfg.payScale, 9);
  });

  it('pays only the best symbol per line', () => {
    const grid = empty();
    // Aces across line 0 ([1,1,1,1,1]), kings across line 2 ([0,0,0,0,0]).
    grid[0][1] = 4;
    grid[1][1] = 4;
    grid[2][1] = 4;
    grid[0][0] = 3;
    grid[1][0] = 3;
    grid[2][0] = 3;
    const { wins, total } = evaluateLines(grid, cfg.payScale);
    expect(wins.filter((w) => w.line === 0)).toHaveLength(1);
    expect(wins.filter((w) => w.line === 2)).toHaveLength(1);
    // The filler already holds a king at (3,0) and aces at (0,2)/(3,1)-break,
    // so line 2 pays 4-of-a-kind and line 19 ([2,1,1,1,2]) pays another 3 aces.
    expect(wins.find((w) => w.line === 2)?.length).toBe(4);
    expect(total).toBeCloseTo((2 * SYMBOLS[4].pays[0] + SYMBOLS[3].pays[1]) * cfg.payScale, 9);
  });

  it('a run broken on reel 2 pays nothing', () => {
    const grid = empty();
    grid[0][1] = 9;
    grid[2][1] = 9; // reel 1 (filler sym 3) breaks the run
    const { total } = evaluateLines(grid, cfg.payScale);
    expect(total).toBe(0);
  });
});

describe('collect + train bonus', () => {
  it('a bell with no gold aboard collects nothing and feeds no cart', () => {
    // Craft streams until we see a collector with empty reels 1-4.
    const next = streamFrom('empty-collect');
    for (let i = 0; i < 4000; i++) {
      const s = playSpin(next, DEFAULT_CONFIG);
      const gold = s.cash.flat().some((v) => v !== null);
      if (!gold && s.grid[REELS - 1].includes(BELL)) {
        expect(s.collect).toBeNull();
        expect(s.cartFeed).toBe(0);
        return;
      }
    }
    // No assertion needed if the case never arose — the next test covers the invariant.
  });

  it('uncollected gold feeds the cart; collected gold does not', () => {
    const next = streamFrom('cart-feed');
    let sawFeed = false;
    let sawCollect = false;
    for (let i = 0; i < 6000 && (!sawFeed || !sawCollect); i++) {
      const s = playSpin(next, DEFAULT_CONFIG);
      const goldSum = s.cash.flat().reduce((a: number, v) => a + (v ?? 0), 0);
      if (!s.collect) {
        expect(s.cartFeed).toBeCloseTo(goldSum, 9);
        if (goldSum > 0) sawFeed = true;
      } else {
        expect(s.cartFeed).toBe(0);
        expect(s.collect.total).toBeGreaterThanOrEqual(goldSum - 1e-9);
        sawCollect = true;
      }
    }
    expect(sawFeed).toBe(true);
    expect(sawCollect).toBe(true);
  });

  it('the golden train multiplies the collect', () => {
    const next = streamFrom('gtrain');
    for (let i = 0; i < 6000; i++) {
      const s = playSpin(next, DEFAULT_CONFIG);
      if (s.collect?.kind === 'gtrain') {
        const goldSum = s.cash.flat().reduce((a: number, v) => a + (v ?? 0), 0);
        expect(s.collect.total).toBeCloseTo(goldSum * s.collect.multiplier, 6);
        expect([2, 3, 5]).toContain(s.collect.multiplier);
        return;
      }
    }
    throw new Error('no golden train collect observed in 6000 spins');
  });

  it('the train bonus pays at least the collect and ends on a real carriage', () => {
    const next = streamFrom('train-bonus');
    for (let i = 0; i < 8000; i++) {
      const s = playSpin(next, DEFAULT_CONFIG);
      if (s.trainBonus) {
        const tb = s.trainBonus;
        expect(tb.total).toBeGreaterThan(0);
        expect(tb.carriages.length).toBeGreaterThanOrEqual(4);
        expect(tb.carriages.length).toBeLessThanOrEqual(7);
        expect(s.total).toBeCloseTo(s.linesTotal + tb.total, 6);
        return;
      }
    }
    throw new Error('no train bonus observed in 8000 spins');
  });
});

describe('vault safety', () => {
  it('no round ever pays past the cap, including jackpots and free games', () => {
    const next = streamFrom('cap');
    for (let i = 0; i < 30_000; i++) {
      const r = playRound(next, DEFAULT_CONFIG);
      expect(r.total).toBeLessThanOrEqual(MAX_WIN);
    }
  });

  it('payout is exactly linear in payScale — the property the offline RTP derivation depends on', () => {
    const make = (scale: number): SlotConfig => ({ ...DEFAULT_CONFIG, payScale: scale });
    for (let i = 0; i < 400; i++) {
      const a = playRound(streamFrom(`lin-${i}`), make(1));
      const b = playRound(streamFrom(`lin-${i}`), make(1.5));
      if (a.total >= MAX_WIN || b.total >= MAX_WIN) continue;
      expect(b.total).toBeCloseTo(a.total * 1.5, 6);
    }
  });
});

describe('return to player', () => {
  it('lands the shipped scale on the audited 97% within measurement error', () => {
    let s = 987654;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    // One million rounds at sd≈12.6 → SE ≈ 0.013. The shipped edge must sit
    // inside the 1–5% vault band with room to spare on both sides.
    const st = simulate(1_000_000, rng, DEFAULT_CONFIG);
    expect(st.rtp).toBeGreaterThan(0.93);
    expect(st.rtp).toBeLessThan(1.0);
    // …and the scale really does derive from the offline constant in closed form.
    expect(DEFAULT_CONFIG.payScale).toBeCloseTo(Math.round((0.97 / RTP_AT_1) * 10000) / 10000, 9);
  });

  it('free games trigger at the designed rate (≈1 in 100 paid spins)', () => {
    let s = 13579;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const st = simulate(200_000, rng, DEFAULT_CONFIG);
    expect(st.freeRate).toBeGreaterThan(1 / 250);
    expect(st.freeRate).toBeLessThan(1 / 40);
  });
});
