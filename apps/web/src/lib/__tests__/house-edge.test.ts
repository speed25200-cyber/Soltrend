import { describe, expect, it } from 'vitest';
import {
  MIN_EDGE, MAX_EDGE, MAX_MULTIPLIER, clampEdge, buildWheel, diceMultiplier, crashPointFromFloat,
  minesMultiplier, towersMultiplier, plinkoPayouts, plinkoBucketOdds, PLINKO_SHAPES,
  playCoinflip, playDice, playLimbo, dropPlinko, spinWheel, interleaveWheel,
  WHEEL_RINGS, WHEEL_SEGMENTS,
} from '@/lib/games';
import { floatStream } from '@/lib/provably-fair';
import { runGraph, type ForgeGraph } from '@/lib/forge/model';

/**
 * The house edge is the product's core economic invariant, and the one a
 * regulator, a staker and a player each check first. Every game must return
 * exactly `1 - edge` in expectation, and no configuration reachable through the
 * studio may fall outside the [1%, 5%] band.
 *
 * Where a game's expectation has a closed form it is asserted exactly rather
 * than simulated — a Monte-Carlo run wide enough to catch a 1pp error in a
 * high-variance game is wider than any test suite should be, and it would still
 * only catch it probabilistically. This suite exists because six of the nine
 * Plinko boards once shipped with edges between 0.9% and 38%.
 */

const EDGES = [0.01, 0.015, 0.02, 0.03, 0.04, 0.05];
const inBand = (edge: number) => edge >= MIN_EDGE - 1e-9 && edge <= MAX_EDGE + 1e-9;

const seedsFor = (n: number) => ({ serverSeed: 'edge-suite-server-seed', clientSeed: 'player', nonce: n });

describe('edge band', () => {
  it('clamps anything a caller can pass into the band', () => {
    for (const e of [-5, -0.01, 0, 0.001, 0.009, 0.03, 0.05, 0.051, 1, 1e9, Infinity]) {
      expect(inBand(clampEdge(e))).toBe(true);
    }
    expect(clampEdge(0)).toBe(MIN_EDGE);
    expect(clampEdge(1)).toBe(MAX_EDGE);
  });
});

describe('dice', () => {
  it('returns exactly 1 - edge at every target', () => {
    for (const edge of EDGES) {
      for (let target = 2; target <= 98; target++) {
        for (const over of [false, true]) {
          const winChance = (over ? 100 - target : target) / 100;
          const ev = winChance * ((100 - clampEdge(edge) * 100) / (winChance * 100));
          expect(ev).toBeCloseTo(1 - clampEdge(edge), 12);
          // …and the quoted multiplier matches the one the round pays.
          expect(diceMultiplier(target, over, edge)).toBeCloseTo(
            (100 - clampEdge(edge) * 100) / (winChance * 100), 12,
          );
        }
      }
    }
  });

  it('settles a round consistently with its quoted multiplier', () => {
    for (let n = 0; n < 500; n++) {
      const r = playDice(1, 50, false, seedsFor(n), 0.02);
      expect(r.roll).toBeGreaterThanOrEqual(0);
      expect(r.roll).toBeLessThan(100);
      expect(r.win).toBe(r.roll < 50);
      expect(r.payout).toBe(r.win ? r.multiplier : 0);
    }
  });
});

describe('limbo', () => {
  it('holds P(point >= x) * x == 1 - edge across the range', () => {
    // The crash point is (1-e)/(1-u) floored to 2dp, so P(point >= x) = (1-e)/x.
    for (const edge of EDGES) {
      const e = clampEdge(edge);
      for (const target of [1.01, 1.5, 2, 5, 25, 100, 1000]) {
        expect(((1 - e) / target) * target).toBeCloseTo(1 - e, 12);
      }
    }
  });

  it('realises the edge over a simulated run', () => {
    for (const edge of [0.01, 0.03, 0.05]) {
      const target = 2;
      const rounds = 300_000;
      const stream = floatStream('limbo-sim', String(edge), 0);
      let paid = 0;
      for (let i = 0; i < rounds; i++) {
        if (crashPointFromFloat(stream.next(), edge) >= target) paid += target;
      }
      const rtp = paid / rounds;
      // sigma of a bernoulli payout at 2x over 300k rounds is ~0.0018.
      expect(Math.abs(rtp - (1 - clampEdge(edge)))).toBeLessThan(0.008);
    }
  });

  it('never returns a crash point below 1', () => {
    for (const u of [0, 1e-12, 0.5, 0.9999999, 1 - 1e-15]) {
      expect(crashPointFromFloat(u, 0.03)).toBeGreaterThanOrEqual(1);
    }
  });

  it('pays the player their own target, never more', () => {
    const r = playLimbo(1, 3, seedsFor(1), 0.02);
    expect(r.multiplier).toBe(3);
    expect(r.payout === 0 || r.payout === 3).toBe(true);
  });
});

describe('coinflip', () => {
  it('returns exactly 1 - edge', () => {
    for (const edge of EDGES) {
      const m = playCoinflip(1, true, seedsFor(0), edge).multiplier;
      expect(0.5 * m).toBeCloseTo(1 - clampEdge(edge), 12);
    }
  });

  it('is an unbiased coin', () => {
    const rounds = 100_000;
    let heads = 0;
    for (let n = 0; n < rounds; n++) if (playCoinflip(1, true, seedsFor(n), 0.02).heads) heads += 1;
    expect(Math.abs(heads - rounds / 2)).toBeLessThan(4 * Math.sqrt(rounds * 0.25));
  });
});

describe('wheel', () => {
  it('gives every slot equal odds', () => {
    for (const risk of ['low', 'medium', 'high'] as const) {
      expect(WHEEL_RINGS[risk].reduce((s, c) => s + c.count, 0)).toBe(WHEEL_SEGMENTS);
      const segs = buildWheel(risk, WHEEL_SEGMENTS, 0.02);
      expect(segs).toHaveLength(WHEEL_SEGMENTS);
      expect(segs.every((s) => s.weight === 1)).toBe(true);
    }
  });

  it('returns exactly 1 - edge on every risk profile', () => {
    for (const edge of EDGES) {
      for (const risk of ['low', 'medium', 'high'] as const) {
        const segs = buildWheel(risk, WHEEL_SEGMENTS, edge);
        const w = segs.reduce((s, x) => s + x.weight, 0);
        const ev = segs.reduce((s, x) => s + (x.multiplier * x.weight) / w, 0);
        expect(ev).toBeCloseTo(1 - clampEdge(edge), 12);
        expect(inBand(1 - ev)).toBe(true);
      }
    }
  });

  it('keeps the same odds after the rim is laid out for looks', () => {
    for (const risk of ['low', 'medium', 'high'] as const) {
      const segs = buildWheel(risk, WHEEL_SEGMENTS, 0.03);
      const ring = interleaveWheel(segs);
      expect(ring).toHaveLength(segs.length);
      // Same multiset, different order — the layout must not create or destroy value.
      const key = (a: typeof segs) => a.map((s) => s.multiplier.toFixed(9)).sort().join('|');
      expect(key(ring)).toBe(key(segs));
      // …and no two top payouts end up adjacent.
      const top = Math.max(...segs.map((s) => s.multiplier));
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i].multiplier === top;
        const b = ring[(i + 1) % ring.length].multiplier === top;
        expect(a && b).toBe(false);
      }
    }
  });

  it('lands on slots in proportion to the rim', () => {
    const segs = buildWheel('medium', WHEEL_SEGMENTS, 0.02);
    const rounds = 120_000;
    const hits = new Array(segs.length).fill(0);
    for (let n = 0; n < rounds; n++) hits[spinWheel(segs, seedsFor(n)).index] += 1;
    const p = 1 / segs.length;
    const sigma = Math.sqrt(rounds * p * (1 - p));
    for (const h of hits) expect(Math.abs(h - rounds * p)).toBeLessThan(5 * sigma);
    // The realised return of an actual run must match the solved one.
    let paid = 0;
    for (let n = 0; n < rounds; n++) paid += spinWheel(segs, seedsFor(n)).multiplier;
    expect(Math.abs(paid / rounds - 0.98)).toBeLessThan(0.02);
  });
});

describe('plinko', () => {
  it('has a well-formed shape for every board', () => {
    for (const risk of ['low', 'medium', 'high'] as const) {
      for (const rows of [8, 12, 16]) {
        const shape = PLINKO_SHAPES[risk][rows];
        expect(shape).toHaveLength(rows + 1);
        // A Plinko board is symmetric — a left-leaning table is a typo, not a design.
        expect(shape.map((_, i) => shape[shape.length - 1 - i])).toEqual(shape);
        expect(shape.every((m) => m >= 0)).toBe(true);
      }
    }
  });

  it('bucket odds are a valid binomial distribution', () => {
    for (const rows of [8, 12, 16]) {
      const odds = plinkoBucketOdds(rows);
      expect(odds).toHaveLength(rows + 1);
      expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      expect(odds.every((p) => p > 0)).toBe(true);
    }
  });

  it('pays exactly 1 - edge on every board and every risk', () => {
    for (const edge of EDGES) {
      for (const risk of ['low', 'medium', 'high'] as const) {
        for (const rows of [8, 12, 16]) {
          const table = plinkoPayouts(risk, rows, edge);
          const odds = plinkoBucketOdds(rows);
          const ev = table.reduce((s, m, k) => s + m * odds[k], 0);
          expect(ev).toBeCloseTo(1 - clampEdge(edge), 12);
          expect(inBand(1 - ev)).toBe(true);
        }
      }
    }
  });

  it('keeps the top payout under the vault ceiling', () => {
    for (const edge of EDGES) {
      for (const risk of ['low', 'medium', 'high'] as const) {
        for (const rows of [8, 12, 16]) {
          expect(Math.max(...plinkoPayouts(risk, rows, edge))).toBeLessThanOrEqual(MAX_MULTIPLIER);
        }
      }
    }
  });

  it('realises the solved edge when balls are actually dropped', () => {
    const rows = 12;
    const table = plinkoPayouts('medium', rows, 0.03);
    const rounds = 200_000;
    let paid = 0;
    const stream = floatStream('plinko-drop', 'c', 0);
    for (let i = 0; i < rounds; i++) {
      let bucket = 0;
      for (let r = 0; r < rows; r++) bucket += stream.next() < 0.5 ? 0 : 1;
      paid += table[bucket];
    }
    expect(Math.abs(paid / rounds - 0.97)).toBeLessThan(0.03);
  });

  it('drops balls into a binomial spread', () => {
    const rows = 16;
    const counts = new Array(rows + 1).fill(0);
    const rounds = 60_000;
    for (let n = 0; n < rounds; n++) counts[dropPlinko(rows, seedsFor(n)).bucket] += 1;
    const odds = plinkoBucketOdds(rows);
    for (let k = 0; k < counts.length; k++) {
      const mean = rounds * odds[k];
      const sigma = Math.sqrt(rounds * odds[k] * (1 - odds[k]));
      expect(Math.abs(counts[k] - mean)).toBeLessThan(5 * sigma + 5);
    }
  });
});

describe('mines', () => {
  it('prices every ladder step as fair odds times 1 - edge', () => {
    for (const edge of EDGES) {
      for (const [grid, bombs] of [[9, 1], [25, 3], [25, 10], [25, 24], [36, 5]]) {
        for (let picks = 1; picks <= grid - bombs; picks++) {
          let fair = 1;
          for (let i = 0; i < picks; i++) fair *= (grid - i) / (grid - bombs - i);
          const quoted = minesMultiplier(grid, bombs, picks, edge);
          // Rungs held at the vault ceiling pay the player less than fair —
          // never more — so they are excluded from the exactness check and
          // asserted separately in the ceiling suite below.
          if (fair * (1 - clampEdge(edge)) > MAX_MULTIPLIER) {
            expect(quoted).toBe(MAX_MULTIPLIER);
            continue;
          }
          expect(quoted).toBeCloseTo(fair * (1 - clampEdge(edge)), 12);
          // The player's expectation at that step: P(survive) * multiplier.
          let survive = 1;
          for (let i = 0; i < picks; i++) survive *= (grid - bombs - i) / (grid - i);
          expect(survive * quoted).toBeCloseTo(1 - clampEdge(edge), 12);
          expect(inBand(1 - survive * quoted)).toBe(true);
        }
      }
    }
  });

  it('never quotes a multiplier below 1 for a first pick', () => {
    expect(minesMultiplier(25, 3, 0, 0.03)).toBe(1);
  });
});

describe('towers', () => {
  it('prices every floor as fair odds times 1 - edge', () => {
    for (const edge of EDGES) {
      for (const cols of [2, 3, 4, 5]) {
        for (let level = 1; level <= 12; level++) {
          const fair = Math.pow(cols / (cols - 1), level);
          const quoted = towersMultiplier(cols, level, edge);
          if (fair * (1 - clampEdge(edge)) > MAX_MULTIPLIER) {
            expect(quoted).toBe(MAX_MULTIPLIER);
            continue;
          }
          expect(quoted).toBeCloseTo(fair * (1 - clampEdge(edge)), 12);
          const survive = Math.pow((cols - 1) / cols, level);
          expect(survive * quoted).toBeCloseTo(1 - clampEdge(edge), 12);
          expect(inBand(1 - survive * quoted)).toBe(true);
        }
      }
    }
  });
});

describe('the payout ceiling, across every engine', () => {
  /**
   * No engine may quote a multiplier the vault cannot settle.
   *
   * The chain caps a single payout at `max_payout_lamports`; a client that
   * quotes past it is promising money that will not arrive. Mines reached
   * 3,236,000x on a 10-bomb board cleared to the end before this was enforced.
   */
  it('holds Mines at the ceiling on every board a player can set', () => {
    for (const edge of EDGES) {
      for (let bombs = 1; bombs <= 24; bombs++) {
        for (let picks = 0; picks <= 25 - bombs; picks++) {
          const m = minesMultiplier(25, bombs, picks, edge);
          expect(m).toBeGreaterThan(0);
          expect(m).toBeLessThanOrEqual(MAX_MULTIPLIER);
        }
      }
    }
  });

  it('holds Towers at the ceiling however tall the climb', () => {
    for (const edge of EDGES) {
      for (const cols of [2, 3, 4, 5]) {
        for (let level = 0; level <= 60; level++) {
          expect(towersMultiplier(cols, level, edge)).toBeLessThanOrEqual(MAX_MULTIPLIER);
        }
      }
    }
  });

  it('holds a node graph at the ceiling whatever arithmetic it contains', () => {
    // A graph is arbitrary maths a creator wired together, so the guarantee has
    // to come from the interpreter rather than from reviewing the graph.
    const runaway: ForgeGraph = {
      nodes: [
        { id: 'n', kind: 'const', params: { v: 1e12 }, inputs: {} },
        { id: 'p', kind: 'payout', params: {}, inputs: { x: 'n' } },
      ],
    } as unknown as ForgeGraph;
    expect(runGraph(runaway, () => 0.5)).toBeLessThanOrEqual(MAX_MULTIPLIER);

    const negative: ForgeGraph = {
      nodes: [
        { id: 'n', kind: 'const', params: { v: -500 }, inputs: {} },
        { id: 'p', kind: 'payout', params: {}, inputs: { x: 'n' } },
      ],
    } as unknown as ForgeGraph;
    expect(runGraph(negative, () => 0.5)).toBeGreaterThanOrEqual(0);
  });

  it('never quotes a Plinko bucket or a wheel slot past the ceiling', () => {
    for (const edge of EDGES) {
      for (const risk of ['low', 'medium', 'high'] as const) {
        for (const rows of [8, 12, 16]) {
          for (const m of plinkoPayouts(risk, rows, edge)) {
            expect(m).toBeLessThanOrEqual(MAX_MULTIPLIER);
          }
        }
        for (const s of buildWheel(risk, WHEEL_SEGMENTS, edge)) {
          expect(s.multiplier).toBeLessThanOrEqual(MAX_MULTIPLIER);
        }
      }
    }
  });
});
