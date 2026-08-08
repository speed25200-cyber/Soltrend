'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_URL } from './useCrashRoom';

export type DuelPhase = 'offline' | 'idle' | 'queued' | 'matched' | 'result';

export interface DuelOpponent {
  wallet: string;
  ante: number;
  ship: string;
}

export interface DuelState {
  phase: DuelPhase;
  connected: boolean;
  waiting: number; // players in queue
  matchId: string | null;
  hash: string | null;
  you: DuelOpponent | null;
  opponent: DuelOpponent | null;
  pot: number;
  revealInMs: number;
  // result
  youWon: boolean | null;
  payout: number;
  draw: number | null;
  serverSeed: string | null;
  matchSeed: string | null;
  nonce: number | null;
}

const EMPTY: DuelState = {
  phase: REALTIME_URL ? 'idle' : 'offline',
  connected: false, waiting: 0, matchId: null, hash: null, you: null, opponent: null,
  pot: 0, revealInMs: 0, youWon: null, payout: 0, draw: null, serverSeed: null, matchSeed: null, nonce: null,
};

/**
 * PvP duel client. Connects to the hosted duel gateway (Socket.IO, /duel
 * namespace) to queue for a 1v1, then watch the provably-fair reveal. Stays
 * 'offline' until NEXT_PUBLIC_REALTIME_URL is set, so the static site degrades
 * gracefully — the duel lights up once the API is deployed.
 */
export function useDuel() {
  const [state, setState] = useState<DuelState>(EMPTY);
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);

  useEffect(() => {
    if (!REALTIME_URL) return;
    let alive = true;
    let socket: import('socket.io-client').Socket | null = null;

    (async () => {
      const { io } = await import('socket.io-client');
      if (!alive) return;
      socket = io(`${REALTIME_URL}/duel`, { transports: ['websocket'], reconnection: true });
      socketRef.current = socket;

      socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
      socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
      socket.on('queue-size', (d: { waiting: number }) => setState((s) => ({ ...s, waiting: d.waiting })));
      socket.on('matched', (d: any) => setState((s) => ({
        ...s, phase: 'matched', matchId: d.matchId, hash: d.hash, you: d.you, opponent: d.opponent,
        pot: d.pot, revealInMs: d.revealInMs, youWon: null, payout: 0, draw: null, serverSeed: null,
      })));
      socket.on('duel-result', (d: any) => setState((s) => ({
        ...s, phase: 'result', youWon: d.youWon, payout: d.payout, draw: d.draw,
        serverSeed: d.serverSeed, matchSeed: d.matchSeed, nonce: d.nonce,
      })));
      socket.on('opponent-left', () => setState((s) => ({ ...s, phase: 'result', youWon: true })));
    })();

    return () => { alive = false; socket?.disconnect(); socketRef.current = null; };
  }, []);

  const queue = useCallback((ante: number, wallet: string, ship?: string) => {
    socketRef.current?.emit('queue', { ante, wallet, ship });
    setState((s) => ({ ...s, phase: 'queued' }));
  }, []);
  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('leave-queue');
    setState((s) => ({ ...s, phase: 'idle' }));
  }, []);
  const reset = useCallback(() => setState((s) => ({ ...s, phase: 'idle', matchId: null, youWon: null })), []);

  return { state, queue, leaveQueue, reset, enabled: !!REALTIME_URL };
}
