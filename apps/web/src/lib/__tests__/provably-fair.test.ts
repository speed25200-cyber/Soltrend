import { createHmac, createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createServerSeed, firstFloat, floatStream, randomHex, sha256Hex, shuffledIndices,
} from '@/lib/provably-fair';

/**
 * The fairness protocol is the product's central claim: a player can replay any
 * past bet and confirm nothing was tampered with. These tests hold the
 * dependency-free implementation to Node's own crypto, byte for byte, and pin
 * the derivation so a refactor can never silently change what a seed produces —
 * that would invalidate every previously published proof.
 */
describe('provably-fair', () => {
  it('hashes identically to node crypto', () => {
    for (const s of ['', 'a', 'soltrend', 'x'.repeat(1000), '🎲 unicode']) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
    }
  });

  it('publishes a hash that commits to the server seed', () => {
    const { serverSeed, serverSeedHash } = createServerSeed();
    expect(serverSeed).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(serverSeed)).toBe(serverSeedHash);
  });

  it('derives the float stream from HMAC-SHA256 exactly as documented', () => {
    const serverSeed = 'deadbeef'.repeat(8);
    const clientSeed = 'player-seed';
    const nonce = 7;

    // Independent reimplementation from the documented scheme.
    const bytes = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:0`).digest();
    let expected = 0;
    let divider = 256;
    for (let i = 0; i < 4; i++) {
      expected += bytes[i] / divider;
      divider *= 256;
    }

    expect(firstFloat(serverSeed, clientSeed, nonce)).toBeCloseTo(expected, 15);
  });

  it('rolls to a fresh HMAC block once the first is exhausted', () => {
    const serverSeed = 'ab'.repeat(32);
    const stream = floatStream(serverSeed, 'c', 1);
    // 32 bytes of HMAC = 8 floats; the 9th must come from block 1.
    const drawn = Array.from({ length: 9 }, () => stream.next());

    const block1 = createHmac('sha256', serverSeed).update('c:1:1').digest();
    let expected = 0;
    let divider = 256;
    for (let i = 0; i < 4; i++) {
      expected += block1[i] / divider;
      divider *= 256;
    }
    expect(drawn[8]).toBeCloseTo(expected, 15);
  });

  it('is fully reproducible and seed-sensitive', () => {
    const take = (ss: string, cs: string, n: number) => {
      const s = floatStream(ss, cs, n);
      return Array.from({ length: 20 }, () => s.next());
    };
    expect(take('s', 'c', 1)).toEqual(take('s', 'c', 1));
    expect(take('s', 'c', 1)).not.toEqual(take('s', 'c', 2));
    expect(take('s', 'c', 1)).not.toEqual(take('s', 'd', 1));
    expect(take('s', 'c', 1)).not.toEqual(take('t', 'c', 1));
  });

  it('produces floats strictly inside [0, 1)', () => {
    const s = floatStream('seed', 'client', 0);
    for (let i = 0; i < 50_000; i++) {
      const f = s.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('is uniform enough to build games on', () => {
    const buckets = new Array(10).fill(0);
    const n = 200_000;
    const s = floatStream('uniformity', 'client', 0);
    for (let i = 0; i < n; i++) buckets[Math.floor(s.next() * 10)] += 1;
    // 3.5 sigma on a binomial(n, 0.1) — a real bias fails, noise does not.
    const sigma = Math.sqrt(n * 0.1 * 0.9);
    for (const b of buckets) expect(Math.abs(b - n / 10)).toBeLessThan(3.5 * sigma);
  });

  it('shuffles to a genuine permutation', () => {
    for (const nonce of [0, 1, 42]) {
      const out = shuffledIndices(25, 'server', 'client', nonce);
      expect(out).toHaveLength(25);
      expect(new Set(out).size).toBe(25);
      expect(out.every((v) => Number.isInteger(v) && v >= 0 && v < 25)).toBe(true);
    }
    // Same seeds → same board, or a Mines bet could not be verified after the fact.
    expect(shuffledIndices(25, 's', 'c', 3)).toEqual(shuffledIndices(25, 's', 'c', 3));
  });

  it('places bombs uniformly across the board', () => {
    const grid = 25;
    const hits = new Array(grid).fill(0);
    const rounds = 40_000;
    for (let n = 0; n < rounds; n++) {
      for (const i of shuffledIndices(grid, 'bombs', 'client', n).slice(0, 3)) hits[i] += 1;
    }
    const p = 3 / grid;
    const sigma = Math.sqrt(rounds * p * (1 - p));
    for (const h of hits) expect(Math.abs(h - rounds * p)).toBeLessThan(4 * sigma);
  });

  it('generates random hex of the requested length', () => {
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(randomHex(32)).not.toBe(randomHex(32));
  });
});
