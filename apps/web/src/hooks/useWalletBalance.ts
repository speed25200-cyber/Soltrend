'use client';

import { useEffect, useState } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

/**
 * The connected wallet's real on-chain SOL balance. Polls slowly and also
 * subscribes to account changes so a deposit or a settled bet shows up without a
 * refresh. Returns null while unknown (disconnected, or the RPC is unreachable)
 * so callers can fall back to the local play balance rather than showing a lie.
 */
export function useWalletBalance(pollMs = 30_000) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [sol, setSol] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setSol(null);
      return;
    }
    let alive = true;
    const read = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        if (alive) setSol(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (alive) setSol(null); // RPC unreachable — caller falls back
      }
    };
    read();
    const timer = window.setInterval(read, pollMs);

    // Push updates too, so a confirmed transaction reflects immediately.
    let subId: number | undefined;
    try {
      subId = connection.onAccountChange(publicKey, (acc) => {
        if (alive) setSol(acc.lamports / LAMPORTS_PER_SOL);
      });
    } catch {
      /* websocket unavailable — polling still covers it */
    }

    return () => {
      alive = false;
      window.clearInterval(timer);
      if (subId !== undefined) connection.removeAccountChangeListener(subId).catch(() => {});
    };
  }, [connection, publicKey, pollMs]);

  return sol;
}
