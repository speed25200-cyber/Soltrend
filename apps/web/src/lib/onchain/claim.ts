'use client';

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { configPda, creatorVaultPda, discriminator, programId, treasuryPda } from './program';

/**
 * `claim_royalties()` — a creator withdraws the design royalties their games have
 * accrued in their on-chain creator vault. Wallet-signed and trustless: the
 * program pays out `creator_vault.owner` only, and enforces KYC on mainnet.
 * ClaimRoyalties context: config, treasury, creator_vault, owner, creator.
 */
export function claimRoyaltiesInstruction(params: { creator: PublicKey }): TransactionInstruction {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: configPda(), isSigner: false, isWritable: false },
      { pubkey: treasuryPda(), isSigner: false, isWritable: true },
      { pubkey: creatorVaultPda(params.creator), isSigner: false, isWritable: true },
      { pubkey: params.creator, isSigner: false, isWritable: false }, // owner (has_one)
      { pubkey: params.creator, isSigner: true, isWritable: true }, // creator (signer)
    ],
    data: Buffer.from(discriminator('claim_royalties')),
  });
}
