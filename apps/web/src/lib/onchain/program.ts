'use client';

import { PublicKey } from '@solana/web3.js';
import { sha256Bytes } from '@/lib/sha256';

/**
 * Shared primitives for hand-built `house_vault` instructions — no Anchor client
 * dependency, so the static export stays tiny. Every on-chain feature degrades
 * gracefully: when NEXT_PUBLIC_HOUSE_VAULT_PROGRAM is unset the app runs its
 * local demo ledger instead, so the public build always works.
 */

export const HOUSE_VAULT_PROGRAM = process.env.NEXT_PUBLIC_HOUSE_VAULT_PROGRAM || '';

export const onchainEnabled = () => !!HOUSE_VAULT_PROGRAM;

export function programId(): PublicKey {
  if (!HOUSE_VAULT_PROGRAM) throw new Error('House vault program is not configured');
  return new PublicKey(HOUSE_VAULT_PROGRAM);
}

/** Anchor's instruction discriminator: sha256("global:<name>")[..8]. */
export function discriminator(name: string): Uint8Array {
  return sha256Bytes(new TextEncoder().encode(`global:${name}`)).slice(0, 8);
}

/** Little-endian unsigned integer of `bytes` width (u64 = 8, u128 = 16). */
export function uintLe(value: bigint, bytes: number): Uint8Array {
  if (value < 0n) throw new Error('unsigned value must not be negative');
  const out = new Uint8Array(bytes);
  let v = value;
  for (let i = 0; i < bytes; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new Error('value overflows the target width');
  return out;
}

export const u64le = (n: bigint) => uintLe(n, 8);
export const u128le = (n: bigint) => uintLe(n, 16);

/* ---------------------------------------------------------------- PDAs */

export const configPda = () => PublicKey.findProgramAddressSync([Buffer.from('config')], programId())[0];
export const treasuryPda = () => PublicKey.findProgramAddressSync([Buffer.from('treasury')], programId())[0];

export const creatorVaultPda = (owner: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from('creator'), owner.toBuffer()], programId())[0];

/** A game PDA is seeded by its creator and the 32-byte spec hash. */
export const gamePda = (creator: PublicKey, specHash: Uint8Array) =>
  PublicKey.findProgramAddressSync([Buffer.from('game'), creator.toBuffer(), Buffer.from(specHash)], programId())[0];

export const poolPda = (game: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from('pool'), game.toBuffer()], programId())[0];

export const stakePositionPda = (pool: PublicKey, staker: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from('stake'), pool.toBuffer(), staker.toBuffer()], programId())[0];

/** Normalise any identifier to the 32-byte hash the program expects. */
export function specHashFromString(id: string): Uint8Array {
  return sha256Bytes(new TextEncoder().encode(id));
}
