'use client';

// Side-effect import: installs Buffer/process before any wallet code runs.
import '@/lib/onchain/polyfill';
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import type { WalletError } from '@solana/wallet-adapter-base';

/**
 * Wallet layer. Phantom is the primary/targeted wallet; Solflare and any wallet
 * implementing the Wallet Standard (Backpack included) are auto-detected by
 * wallet-adapter, so they appear in the modal without an explicit adapter.
 */

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('devnet');

/** Which cluster the app is pointed at — surfaced so a mainnet user isn't left
 *  wondering why a connected wallet shows nothing. */
export function clusterName(): string {
  const u = RPC.toLowerCase();
  if (u.includes('devnet')) return 'Devnet';
  if (u.includes('testnet')) return 'Testnet';
  if (u.includes('localhost') || u.includes('127.0.0.1')) return 'Localnet';
  return 'Mainnet';
}

interface WalletErrorCtx {
  error: string | null;
  clear: () => void;
}
const ErrCtx = createContext<WalletErrorCtx>({ error: null, clear: () => {} });
export const useWalletError = () => useContext(ErrCtx);

export function WalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC, []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const [error, setError] = useState<string | null>(null);

  /**
   * wallet-adapter swallows failures unless an onError is supplied, which made a
   * refused, missing or locked wallet look like a dead button. Translate the
   * common cases into something a player can actually act on.
   */
  const onError = useCallback((e: WalletError) => {
    const name = e?.name ?? '';
    const msg = e?.message ?? '';
    if (name === 'WalletNotReadyError' || /not (be )?(detected|installed|ready)/i.test(msg)) {
      setError('That wallet is not installed in this browser. Install it, then reload the page.');
    } else if (/user rejected|rejected the request|declined/i.test(msg)) {
      setError('The request was declined in your wallet.');
    } else if (name === 'WalletTimeoutError') {
      setError('The wallet did not respond. Unlock it and try again.');
    } else {
      setError(msg || 'The wallet could not connect. Check it is unlocked, then try again.');
    }
    console.error('[wallet]', name, msg);
  }, []);

  const ctx = useMemo(() => ({ error, clear: () => setError(null) }), [error]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>
          <ErrCtx.Provider value={ctx}>{children}</ErrCtx.Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
