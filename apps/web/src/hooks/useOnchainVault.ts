'use client';

import { useCallback } from 'react';
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { onchainEnabled, specHashFromString } from '@/lib/onchain/program';
import { stakeInstruction, unstakeInstruction } from '@/lib/onchain/stake';
import { claimRoyaltiesInstruction } from '@/lib/onchain/claim';

/**
 * The real money loop: stake into a game's bankroll, unstake shares, and claim
 * creator royalties — all wallet-signed, no settlement authority. Enabled only
 * when the program is configured AND a wallet is connected; callers fall back to
 * the local demo ledger otherwise, so the public build stays fully playable.
 */
export function useOnchainVault() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const enabled = onchainEnabled() && !!publicKey;

  const send = useCallback(
    async (tx: Transaction): Promise<string> => {
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      return sig;
    },
    [connection, sendTransaction],
  );

  const stake = useCallback(
    async (params: { gameCreatorWallet: string; specHash: string; amountSol: number }): Promise<string> => {
      if (!publicKey) throw new Error('Connect a wallet to stake on-chain');
      const ix = stakeInstruction({
        staker: publicKey,
        gameCreator: new PublicKey(params.gameCreatorWallet),
        specHash: specHashFromString(params.specHash),
        lamports: BigInt(Math.round(params.amountSol * LAMPORTS_PER_SOL)),
      });
      return send(new Transaction().add(ix));
    },
    [publicKey, send],
  );

  const unstake = useCallback(
    async (params: { gameCreatorWallet: string; specHash: string; shares: bigint }): Promise<string> => {
      if (!publicKey) throw new Error('Connect a wallet to unstake on-chain');
      const ix = unstakeInstruction({
        staker: publicKey,
        gameCreator: new PublicKey(params.gameCreatorWallet),
        specHash: specHashFromString(params.specHash),
        shares: params.shares,
      });
      return send(new Transaction().add(ix));
    },
    [publicKey, send],
  );

  const claimRoyalties = useCallback(async (): Promise<string> => {
    if (!publicKey) throw new Error('Connect a wallet to claim on-chain');
    return send(new Transaction().add(claimRoyaltiesInstruction({ creator: publicKey })));
  }, [publicKey, send]);

  return { enabled, stake, unstake, claimRoyalties };
}
