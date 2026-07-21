'use client';

import { useCallback } from 'react';
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { buyAssetInstruction, assetIdFromString, onchainEnabled } from '@/lib/onchain/buyAsset';

/**
 * Sends a `buy_asset` transaction for a paid marketplace asset. Enabled only when
 * NEXT_PUBLIC_HOUSE_VAULT_PROGRAM is configured and a wallet is connected;
 * otherwise the market falls back to a free install. Returns the signature.
 */
export function useBuyAsset() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const enabled = onchainEnabled() && !!publicKey;

  const buy = useCallback(
    async (params: { assetKey: string; sellerWallet: string; priceSol: number }): Promise<string> => {
      if (!publicKey) throw new Error('Connect a wallet to buy on-chain');
      const ix = buyAssetInstruction({
        buyer: publicKey,
        seller: new PublicKey(params.sellerWallet),
        assetId: assetIdFromString(params.assetKey),
        priceLamports: BigInt(Math.round(params.priceSol * LAMPORTS_PER_SOL)),
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      return sig;
    },
    [connection, publicKey, sendTransaction],
  );

  return { buy, enabled };
}
