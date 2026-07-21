'use client';

import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { sha256Bytes } from '@/lib/sha256';

/**
 * On-chain asset purchase — a hand-built `house_vault::buy_asset` instruction
 * (no Anchor client dependency). When NEXT_PUBLIC_HOUSE_VAULT_PROGRAM is set the
 * marketplace can settle a paid asset sale on Solana: the buyer pays into the
 * treasury, 5% goes to the platform, the rest accrues to the seller's creator
 * vault. Unset → the app falls back to free installs, so the static demo still
 * works. Mirrors the graceful-degradation pattern used by the realtime hooks.
 */
export const HOUSE_VAULT_PROGRAM = process.env.NEXT_PUBLIC_HOUSE_VAULT_PROGRAM || '';

export const onchainEnabled = () => !!HOUSE_VAULT_PROGRAM;

/** Anchor's instruction discriminator: sha256("global:<name>")[..8]. */
function discriminator(name: string): Uint8Array {
  return sha256Bytes(new TextEncoder().encode(`global:${name}`)).slice(0, 8);
}

const u64le = (n: bigint): Uint8Array => {
  const b = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
};

/**
 * Build the `buy_asset(asset_id: [u8;32], price: u64)` instruction. `assetId` is a
 * 32-byte identifier for the pack/module; account order matches the on-chain
 * `BuyAsset` context exactly (config, treasury, creator_vault, owner, seller,
 * buyer, system_program).
 */
export function buyAssetInstruction(params: {
  buyer: PublicKey;
  seller: PublicKey;
  assetId: Uint8Array; // 32 bytes
  priceLamports: bigint;
}): TransactionInstruction {
  const programId = new PublicKey(HOUSE_VAULT_PROGRAM);
  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
  const [treasury] = PublicKey.findProgramAddressSync([Buffer.from('treasury')], programId);
  const [creatorVault] = PublicKey.findProgramAddressSync([Buffer.from('creator'), params.seller.toBuffer()], programId);

  const assetId = params.assetId.length === 32 ? params.assetId : sha256Bytes(params.assetId); // normalise to 32 bytes
  const data = Buffer.concat([discriminator('buy_asset'), Buffer.from(assetId), Buffer.from(u64le(params.priceLamports))]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: params.seller, isSigner: false, isWritable: false }, // owner (= seller)
      { pubkey: params.seller, isSigner: false, isWritable: false }, // seller (PDA seed)
      { pubkey: params.buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** A stable 32-byte asset id from a pack/module id string. */
export function assetIdFromString(id: string): Uint8Array {
  return sha256Bytes(new TextEncoder().encode(id));
}
