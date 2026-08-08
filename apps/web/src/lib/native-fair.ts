/**
 * Native on-chain fairness scheme — the byte-exact JS twin of the Rust in
 * `programs/house_vault/src/lib.rs` (`hmac_sha256` / `native_float_bps` /
 * `native_multiplier_bps`).
 *
 * For NATIVE templates (dice / coinflip / limbo) the house_vault program computes
 * the outcome on-chain, so the operator has zero discretion. This module lets the
 * client compute and verify the identical result. Both sides MUST agree on:
 *   float_bps = firstU32BE( HMAC_SHA256(serverSeed[32], clientSeed[32] ‖ nonceLE8) ) * 10000 >> 32
 * and the per-template multiplier formulas below.
 */

import { sha256Bytes } from './sha256';

export const TPL_DICE = 0;
export const TPL_COINFLIP = 1;
export const TPL_LIMBO = 2;
const BPS = 10_000;

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** HMAC-SHA256 with a raw 32-byte key (zero-padded to the 64-byte block). */
export function hmacSha256Raw(key32: Uint8Array, msg: Uint8Array): Uint8Array {
  const ipad = new Uint8Array(64).fill(0x36);
  const opad = new Uint8Array(64).fill(0x5c);
  for (let i = 0; i < 32; i++) {
    ipad[i] ^= key32[i];
    opad[i] ^= key32[i];
  }
  return sha256Bytes(concat(opad, sha256Bytes(concat(ipad, msg))));
}

/** Provably-fair float in basis points [0, 10000). */
export function nativeFloatBps(serverSeed: Uint8Array, clientSeed: Uint8Array, nonce: number | bigint): number {
  const msg = new Uint8Array(40);
  msg.set(clientSeed.subarray(0, 32), 0);
  new DataView(msg.buffer).setBigUint64(32, BigInt(nonce), true); // little-endian
  const d = hmacSha256Raw(serverSeed, msg);
  const r = (d[0] * 0x1000000 + d[1] * 0x10000 + d[2] * 0x100 + d[3]); // u32 big-endian
  return Math.floor((r * BPS) / 0x100000000);
}

/** The multiplier (bps) for a native template — a pure function of the fair float. */
export function nativeMultiplierBps(template: number, p0: number, p1: number, edgeBps: number, floatBps: number): number {
  const fair = BPS - edgeBps; // (1 - edge) in bps
  switch (template) {
    case TPL_DICE: {
      const win = p1 === 1 ? floatBps > p0 : floatBps < p0;
      if (!win) return 0;
      const winProb = p1 === 1 ? BPS - p0 : p0;
      return Math.floor((fair * BPS) / winProb);
    }
    case TPL_COINFLIP:
      return floatBps < 5000 ? fair * 2 : 0;
    case TPL_LIMBO: {
      const winProb = Math.floor((fair * BPS) / p0); // (1-edge)/target
      return floatBps < winProb ? p0 : 0;
    }
    default:
      return 0;
  }
}

/** Convenience: full native outcome from raw inputs. */
export function nativeOutcome(
  serverSeed: Uint8Array,
  clientSeed: Uint8Array,
  nonce: number | bigint,
  template: number,
  p0: number,
  p1: number,
  edgeBps: number,
): { floatBps: number; multiplierBps: number } {
  const floatBps = nativeFloatBps(serverSeed, clientSeed, nonce);
  return { floatBps, multiplierBps: nativeMultiplierBps(template, p0, p1, edgeBps, floatBps) };
}
