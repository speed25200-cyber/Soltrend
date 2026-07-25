'use client';

import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  discriminator,
  gamePda,
  poolPda,
  programId,
  stakePositionPda,
  u128le,
  u64le,
} from './program';

/**
 * Staking — "be the house". A staker deposits SOL into a game's bankroll pool and
 * receives pro-rata shares (ERC-4626-style with a virtual offset, enforced
 * on-chain); the pool pays winners and accrues its slice of the house edge.
 * These are the two genuinely trustless, wallet-signed money instructions: the
 * staker signs for themselves, no settlement authority involved.
 */

/** `stake(amount: u64)` — Stake context: pool, position, staker, system_program. */
export function stakeInstruction(params: {
  staker: PublicKey;
  gameCreator: PublicKey;
  specHash: Uint8Array;
  lamports: bigint;
}): TransactionInstruction {
  const game = gamePda(params.gameCreator, params.specHash);
  const pool = poolPda(game);
  const position = stakePositionPda(pool, params.staker);
  const data = Buffer.concat([discriminator('stake'), Buffer.from(u64le(params.lamports))]);

  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: params.staker, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** `unstake(shares: u128)` — Unstake context: pool, position, owner, staker. */
export function unstakeInstruction(params: {
  staker: PublicKey;
  gameCreator: PublicKey;
  specHash: Uint8Array;
  shares: bigint;
}): TransactionInstruction {
  const game = gamePda(params.gameCreator, params.specHash);
  const pool = poolPda(game);
  const position = stakePositionPda(pool, params.staker);
  const data = Buffer.concat([discriminator('unstake'), Buffer.from(u128le(params.shares))]);

  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: params.staker, isSigner: false, isWritable: false }, // owner (has_one)
      { pubkey: params.staker, isSigner: true, isWritable: true }, // staker (signer)
    ],
    data,
  });
}
