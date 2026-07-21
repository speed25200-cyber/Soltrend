'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_URL } from './useCrashRoom';

export type JackpotPhase = 'offline' | 'open' | 'result';

export interface JackpotEntry {
  wallet: string;
  amount: number;
  ship?: string;
  chance: number; // %
}

export interface JackpotState {
  phase: JackpotPhase;
  connected: boolean;
  roundId: number;
  hash: string | null;
  pot: number;
  endsInMs: number;
  entries: JackpotEntry[];
  // result
  winnerWallet: string | null;
  payout: number;
  draw: number | null;
  serverSeed: string | null;
}

const EMPTY: JackpotState = {
  phase: REALTIME_URL ? 'open' : 'offline',
  connected: false, roundId: 0, hash: null, pot: 0, endsInMs: 0, entries: [],
  winnerWallet: null, payout: 0, draw: null, serverSeed: null,
};

/**
 * Shared-jackpot client. Connects to the hosted jackpot gateway (Socket.IO,
 * /jackpot namespace): watch the community pot grow, enter, then see the
 * provably-fair weighted draw. Stays 'offline' until NEXT_PUBLIC_REALTIME_URL is
 * set so the static site degrades gracefully.
 */
export function useJackpot() {
  const [state, setState] = useState<JackpotState>(EMPTY);
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);

  useEffect(() => {
    if (!REALTIME_URL) return;
    let alive = true;
    let socket: import('socket.io-client').Socket | null = null;

    (async () => {
      const { io } = await import('socket.io-client');
      if (!alive) return;
      socket = io(`${REALTIME_URL}/jackpot`, { transports: ['websocket'], reconnection: true });
      socketRef.current = socket;

      socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
      socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
      socket.on('state', (d: any) => setState((s) => ({
        ...s, phase: d.phase, roundId: d.roundId, hash: d.hash ?? s.hash, pot: d.pot,
        endsInMs: d.endsInMs ?? 0, entries: d.entries ?? s.entries,
      })));
      socket.on('result', (d: any) => setState((s) => ({
        ...s, phase: 'result', winnerWallet: d.winnerWallet, payout: d.payout, draw: d.draw,
        serverSeed: d.serverSeed, pot: d.pot, entries: d.entries ?? s.entries,
      })));
    })();

    return () => { alive = false; socket?.disconnect(); socketRef.current = null; };
  }, []);

  const enter = useCallback((amount: number, wallet: string, ship?: string) => {
    socketRef.current?.emit('enter', { amount, wallet, ship });
  }, []);

  return { state, enter, enabled: !!REALTIME_URL };
}
