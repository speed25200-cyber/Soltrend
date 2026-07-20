/**
 * Provably-fair protocol (Stake-style, dependency-free).
 *
 *   1. Server generates a `serverSeed`; only its SHA-256 hash is shown up-front.
 *   2. Player supplies a `clientSeed` (editable) and each bet uses an
 *      incrementing `nonce`.
 *   3. For each bet we derive a byte stream:
 *        HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`)
 *      and map consecutive groups of 4 bytes to floats in [0, 1).
 *   4. On seed rotation the old `serverSeed` is revealed so anyone can replay
 *      every past bet and confirm the hash matches → nothing was tampered with.
 */

import { hmacSha256Bytes, sha256Hex } from './sha256';

export interface SeedPair {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/** Cryptographically strong random hex string (browser + node via globalThis.crypto). */
export function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  (globalThis.crypto || (globalThis as any).msCrypto).getRandomValues(arr);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0');
  return s;
}

export function createServerSeed(): { serverSeed: string; serverSeedHash: string } {
  const serverSeed = randomHex(32);
  return { serverSeed, serverSeedHash: sha256Hex(serverSeed) };
}

/**
 * Deterministic float generator for a single bet. Each call to `next()` yields
 * the next float in [0, 1). `cursor` advances through the HMAC output and, once
 * exhausted, re-hashes with an incremented block index — giving an unbounded,
 * fully-reproducible stream for games that need many draws (Mines, Plinko…).
 */
export function floatStream(serverSeed: string, clientSeed: string, nonce: number) {
  let block = 0;
  let buf = hmacSha256Bytes(serverSeed, `${clientSeed}:${nonce}:${block}`);
  let pos = 0;

  const nextByte = (): number => {
    if (pos >= buf.length) {
      block += 1;
      buf = hmacSha256Bytes(serverSeed, `${clientSeed}:${nonce}:${block}`);
      pos = 0;
    }
    return buf[pos++];
  };

  return {
    next(): number {
      // 4 bytes → uniform float in [0, 1), same scheme Stake documents.
      let result = 0;
      let divider = 256;
      for (let i = 0; i < 4; i++) {
        result += nextByte() / divider;
        divider *= 256;
      }
      return result;
    },
  };
}

/** Convenience: the first float of a bet (Dice, Limbo, Coinflip, Wheel). */
export function firstFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  return floatStream(serverSeed, clientSeed, nonce).next();
}

/**
 * Fisher–Yates shuffle driven by the float stream — used to place Mines bombs
 * deterministically so the board is reproducible from the seeds alone.
 */
export function shuffledIndices(
  count: number,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number[] {
  const stream = floatStream(serverSeed, clientSeed, nonce);
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(stream.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export { sha256Hex };
