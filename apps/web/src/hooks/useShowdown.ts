'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_URL } from './useCrashRoom';

export type ShowPhase = 'offline' | 'open' | 'showing' | 'result';

export interface ShowPlayer {
  wallet: string;
  ship?: string;
  alive: boolean;
}

export interface ShowdownState {
  phase: ShowPhase;
  connected: boolean;
  showId: number;
  hash: string | null;
  buyIn: number;
  pot: number;
  endsInMs: number;
  players: ShowPlayer[];
  lastEliminated: string | null;
  // result
  winnerWallet: string | null;
  payout: number;
  serverSeed: string | null;
}

const EMPTY: ShowdownState = {
  phase: REALTIME_URL ? 'open' : 'offline',
  connected: false, showId: 0, hash: null, buyIn: 0.1, pot: 0, endsInMs: 0, players: [],
  lastEliminated: null, winnerWallet: null, payout: 0, serverSeed: null,
};

/**
 * Game-show elimination client. Connects to the hosted showdown gateway
 * (Socket.IO, /showdown namespace): join the table, then watch contestants get
 * eliminated one at a time until a single provably-fair winner remains. Stays
 * 'offline' until NEXT_PUBLIC_REALTIME_URL is set.
 */
export function useShowdown() {
  const [state, setState] = useState<ShowdownState>(EMPTY);
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);

  useEffect(() => {
    if (!REALTIME_URL) return;
    let alive = true;
    let socket: import('socket.io-client').Socket | null = null;

    (async () => {
      const { io } = await import('socket.io-client');
      if (!alive) return;
      socket = io(`${REALTIME_URL}/showdown`, { transports: ['websocket'], reconnection: true });
      socketRef.current = socket;

      socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
      socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
      socket.on('state', (d: any) => setState((s) => ({
        ...s, phase: d.phase, showId: d.showId, hash: d.hash ?? s.hash, buyIn: d.buyIn ?? s.buyIn,
        pot: d.pot, endsInMs: d.endsInMs ?? 0, players: d.players ?? s.players,
        lastEliminated: d.phase === 'open' ? null : s.lastEliminated,
        winnerWallet: d.phase === 'open' ? null : s.winnerWallet,
      })));
      socket.on('eliminated', (d: any) => setState((s) => ({
        ...s, lastEliminated: d.wallet,
        players: s.players.map((p) => (p.wallet === d.wallet ? { ...p, alive: false } : p)),
      })));
      socket.on('winner', (d: any) => setState((s) => ({
        ...s, phase: 'result', winnerWallet: d.winnerWallet, payout: d.payout, pot: d.pot, serverSeed: d.serverSeed,
      })));
    })();

    return () => { alive = false; socket?.disconnect(); socketRef.current = null; };
  }, []);

  const join = useCallback((wallet: string, ship?: string) => {
    socketRef.current?.emit('join', { wallet, ship });
  }, []);

  return { state, join, enabled: !!REALTIME_URL };
}
