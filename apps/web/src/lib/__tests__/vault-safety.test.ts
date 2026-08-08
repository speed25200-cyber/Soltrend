import { describe, expect, it } from 'vitest';
import { MIN_EDGE, MAX_EDGE, MAX_MULTIPLIER, clampEdge, minesMultiplier } from '@/lib/games';
import { CREATION_FEE, EDGE_SPLIT, RUIN_K, maxBetFor, projectRevenue, ruinRisk, stakerApr } from '@/lib/economics';
import {
  MAX_PAYOUT, boardMultiplier, boardStats, clampSpec, cellCount, safeCount, survivalTo,
  specFromParams, specToParams, BOARD_TEMPLATES,
} from '@/lib/forge/board';
import { fmtMult, fmtMultExact } from '@/lib/format';
import { simulateGraph, starterGraph } from '@/lib/forge/model';
import { EDGE_CHOICES, MAX_WIN, VOLATILITY, buildSlot, slotFromParams, slotToParams, type Volatility } from '@/lib/slots/goldmine';

/**
 * Vault safety.
 *
 * A creator can publish a game without anyone reviewing it, so the studio's
 * whole safety story rests on one claim: *no configuration a creator can reach
 * produces an unsafe game*. These tests enumerate the reachable space rather
 * than sampling it — the ranges are small enough to check exhaustively, and a
 * single unsafe combination is a drained bankroll.
 */

const inBand = (e: number) => e >= MIN_EDGE - 1e-9 && e <= MAX_EDGE + 1e-9;

describe('economic model', () => {
  it('splits the edge into exactly one whole', () => {
    const sum = Object.values(EDGE_SPLIT).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
    expect(Object.values(EDGE_SPLIT).every((v) => v > 0)).toBe(true);
    // Stakers carry the variance, so they must take the largest share.
    expect(EDGE_SPLIT.bankroll).toBeGreaterThan(Math.max(EDGE_SPLIT.creator, EDGE_SPLIT.platform, EDGE_SPLIT.insurance));
  });

  it('projects revenue that adds back up to the edge taken', () => {
    for (const volume of [0, 1, 1000, 1e6]) {
      for (const edge of [0.01, 0.03, 0.05]) {
        const p = projectRevenue(volume, edge);
        expect(p.bankroll + p.creator + p.platform + p.insurance).toBeCloseTo(p.totalEdge, 9);
        expect(p.totalEdge).toBeCloseTo(volume * edge, 12);
      }
    }
  });

  it('keeps the creation fee a fee, not a haircut', () => {
    expect(CREATION_FEE).toBeGreaterThan(0);
    expect(CREATION_FEE).toBeLessThan(0.1);
  });

  it('caps a single round at a survivable slice of the bankroll', () => {
    for (const bankroll of [0, 0.5, 1, 10, 500, 25_000]) {
      for (const maxWin of [2, 10, 100, 1000]) {
        const bet = maxBetFor(bankroll, maxWin);
        expect(bet).toBeGreaterThanOrEqual(0);
        // The defining invariant: one maximal win can never take more than
        // 1/RUIN_K of the bankroll. Allow a rounding tick on the 4dp bet.
        expect(bet * maxWin).toBeLessThanOrEqual(bankroll / RUIN_K + 1e-4 * maxWin);
      }
    }
  });

  it('refuses to size a bet against an unstaked or nonsensical game', () => {
    expect(maxBetFor(0, 100)).toBe(0);
    expect(maxBetFor(100, 0)).toBe(0);
    expect(maxBetFor(100, -1)).toBe(0);
  });

  it('sizes bets monotonically in bankroll and inversely in top payout', () => {
    expect(maxBetFor(100, 10)).toBeGreaterThan(maxBetFor(50, 10));
    expect(maxBetFor(100, 10)).toBeGreaterThan(maxBetFor(100, 100));
  });

  it('grades ruin risk against the cushion, not the mood', () => {
    expect(ruinRisk(1000, 1, 10).label).toBe('Very low'); // 100x cushion
    expect(ruinRisk(10, 1, 10).label).toBe('High'); // 1x cushion
    expect(ruinRisk(100, 0, 10).ratio).toBe(Infinity);
  });

  it('reports no yield on an empty pool', () => {
    expect(stakerApr(1000, 0, 0.03)).toBe(0);
  });
});

describe('community boards — the whole reachable space', () => {
  const SPECS = (() => {
    const out = [];
    for (let rows = 3; rows <= 6; rows++) {
      for (let cols = 3; cols <= 6; cols++) {
        for (let bombs = 1; bombs < rows * cols; bombs++) out.push(clampSpec({ rows, cols, bombs }));
      }
    }
    return out;
  })();

  it('covers every board a creator can draw', () => {
    expect(SPECS.length).toBeGreaterThan(300);
  });

  it('never quotes past the vault ceiling, at any edge', () => {
    for (const spec of SPECS) {
      for (const edge of [MIN_EDGE, 0.03, MAX_EDGE]) {
        for (let picks = 0; picks <= safeCount(spec); picks++) {
          const m = boardMultiplier(spec, picks, edge);
          expect(m).toBeGreaterThan(0);
          expect(m).toBeLessThanOrEqual(MAX_PAYOUT);
        }
      }
    }
  });

  it('holds the edge on every rung the ladder is not capped on', () => {
    for (const spec of SPECS) {
      for (const edge of [MIN_EDGE, 0.025, MAX_EDGE]) {
        for (let picks = 1; picks <= safeCount(spec); picks++) {
          const uncapped = minesMultiplier(cellCount(spec), spec.bombs, picks, edge);
          if (uncapped >= MAX_PAYOUT) continue; // capped rungs pay the player less, never more
          const realised = 1 - survivalTo(spec, picks) * boardMultiplier(spec, picks, edge);
          expect(realised).toBeCloseTo(clampEdge(edge), 9);
          expect(inBand(realised)).toBe(true);
        }
      }
    }
  });

  it('rejects an out-of-band edge instead of publishing it', () => {
    const spec = clampSpec({ rows: 5, cols: 5, bombs: 3 });
    expect(boardStats(spec, 0.001).ok).toBe(false);
    expect(boardStats(spec, 0.2).ok).toBe(false);
    expect(boardStats(spec, 0.03).ok).toBe(true);
    // …and the stats it reports are the clamped truth, never the request.
    expect(inBand(boardStats(spec, 0.2).edge)).toBe(true);
  });

  it('always leaves at least one safe tile and one bomb', () => {
    for (const s of [{ rows: 3, cols: 3, bombs: 0 }, { rows: 3, cols: 3, bombs: 99 }, { rows: 0, cols: 0, bombs: 5 }]) {
      const c = clampSpec(s);
      expect(c.bombs).toBeGreaterThanOrEqual(1);
      expect(safeCount(c)).toBeGreaterThanOrEqual(1);
      expect(c.rows).toBeGreaterThanOrEqual(3);
      expect(c.cols).toBeLessThanOrEqual(6);
    }
  });

  it('round-trips a spec through the params a published game carries', () => {
    for (const spec of SPECS.slice(0, 60)) {
      expect(specFromParams(specToParams(spec))).toEqual(spec);
    }
    // A published game with junk params must degrade to a valid board, not crash.
    const junk = specFromParams({ rows: 'x' as unknown as number, cols: -4, bombs: 1e9 });
    expect(boardStats(junk, 0.03).ok).toBe(true);
  });

  it('ships templates that are all publishable as-is', () => {
    for (const t of BOARD_TEMPLATES) {
      const stats = boardStats(clampSpec(t.spec), 0.03);
      expect(stats.ok).toBe(true);
      expect(stats.maxMult).toBeLessThanOrEqual(MAX_PAYOUT);
    }
  });
});

describe('community slots — every preset and edge', () => {
  const PRESETS = Object.keys(VOLATILITY) as Volatility[];

  it('offers only audited edges', () => {
    expect(EDGE_CHOICES.length).toBeGreaterThan(0);
    for (const e of EDGE_CHOICES) expect(inBand(e)).toBe(true);
  });

  it('solves a payout scale that lands the audited edge', () => {
    for (const preset of PRESETS) {
      for (const edge of EDGE_CHOICES) {
        const cfg = buildSlot(preset, edge);
        // payScale is derived in closed form from the measured RTP at scale 1,
        // so the shipped RTP is that constant times the scale.
        const rtp = VOLATILITY[preset].rtpAt1 * cfg.payScale;
        expect(inBand(1 - rtp)).toBe(true);
        expect(1 - rtp).toBeCloseTo(edge, 3);
      }
    }
  });

  it('carries a measured RTP constant for every preset, never a guess', () => {
    for (const preset of PRESETS) {
      const p = VOLATILITY[preset];
      expect(p.rtpAt1).toBeGreaterThan(0.5);
      expect(p.rtpAt1).toBeLessThan(2);
      expect(p.stats.trainRate).toBeGreaterThan(0);
      expect(p.stats.trainRate).toBeLessThan(0.2);
      expect(p.stats.hitRate).toBeGreaterThan(0);
      expect(p.stats.hitRate).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the top win inside the vault ceiling', () => {
    expect(MAX_WIN).toBeLessThanOrEqual(MAX_MULTIPLIER);
    for (const preset of PRESETS) {
      for (const edge of EDGE_CHOICES) {
        const cfg = buildSlot(preset, edge);
        expect(cfg.grand * cfg.payScale).toBeLessThanOrEqual(MAX_WIN);
      }
    }
  });

  it('falls back to an audited build when a game carries tampered params', () => {
    for (const junk of [
      undefined,
      { slot: 'not json' },
      { slot: JSON.stringify({ weights: [1], pays: [] }) },
      { slot: JSON.stringify({ ...buildSlot('balanced', 0.03), payScale: 99 }) },
      { slot: JSON.stringify({ ...buildSlot('balanced', 0.03), payScale: -1 }) },
    ]) {
      const cfg = slotFromParams(junk as Record<string, number | string> | undefined);
      expect(cfg.weights).toHaveLength(9);
      expect(cfg.pays).toHaveLength(9);
      expect(cfg.payScale).toBeGreaterThan(0);
      expect(cfg.payScale).toBeLessThanOrEqual(5);
      expect(cfg.trigger).toBeGreaterThanOrEqual(4);
      expect(cfg.trigger).toBeLessThanOrEqual(8);
    }
  });

  it('round-trips a built config through published params', () => {
    for (const preset of PRESETS) {
      const cfg = buildSlot(preset, EDGE_CHOICES[0]);
      const back = slotFromParams(slotToParams(cfg));
      expect(back.payScale).toBeCloseTo(cfg.payScale, 9);
      expect(back.trigger).toBe(cfg.trigger);
      expect(back.grand).toBe(cfg.grand);
    }
  });
});

describe('what the player is shown', () => {
  it('never quotes a multiplier above the one that settles', () => {
    // Display floors to two decimals while the engine keeps full precision, so
    // a player is always paid at least the figure they were quoted.
    for (const m of [1, 1.125, 1.2375, 0.9899, 33.0036, 1000, 2.999999, 0.005]) {
      const shown = Number(fmtMult(m).replace('×', ''));
      expect(shown).toBeLessThanOrEqual(m + 1e-12);
      expect(m - shown).toBeLessThan(0.01);
    }
  });

  it('keeps the exact figure available for audit', () => {
    expect(fmtMultExact(1.125)).toBe('1.125×');
    expect(fmtMultExact(2)).toBe('2.00×');
    expect(fmtMult(Number.NaN)).toBe('—');
    expect(fmtMultExact(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('graph simulation', () => {
  const GRAPH = starterGraph();

  it('scores the same graph the same way every time', () => {
    // A ranking or an RTP readout that moves between two calls is a ranking the
    // server and the browser will disagree about — which throws away the
    // prerendered page and reshuffles Discover on every load.
    const a = simulateGraph(GRAPH, 3_000);
    const b = simulateGraph(GRAPH, 3_000);
    expect(a.rtp).toBe(b.rtp);
    expect(a.maxMult).toBe(b.maxMult);
    expect(a.hitRate).toBe(b.hitRate);
    expect(a.buckets).toEqual(b.buckets);
  });

  it('still allows an independent run when one is asked for', () => {
    const a = simulateGraph(GRAPH, 2_000, 'seed-a');
    const b = simulateGraph(GRAPH, 2_000, 'seed-b');
    expect(a.rtp).not.toBe(b.rtp);
  });

  it('never reports a max multiplier past the vault ceiling', () => {
    expect(simulateGraph(GRAPH, 2_000).maxMult).toBeLessThanOrEqual(MAX_MULTIPLIER);
  });
});
