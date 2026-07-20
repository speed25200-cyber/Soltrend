'use client';

import { ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

/**
 * Wallet layer. Phantom is the primary/targeted wallet (per the brief); Solflare
 * and Backpack round out the Solana standard three. Backpack + any wallet that
 * implements the Wallet Standard are auto-detected by wallet-adapter, so they
 * appear in the modal without an explicit adapter.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('devnet'),
    [],
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
