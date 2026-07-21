'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/** Set NEXT_PUBLIC_REALTIME_URL to the hosted API origin (e.g. https://api.soltrend.gg). */
export const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || '';

export type RoomPhase = 'offline' | 'connecting' | 'betting' | 'running' | 'result';

export interface RoomPlayer {
  wallet: string;
  bet: number;
  cashedAt: number | null;
  won: number;
}

export interface RoomState {
  phase: RoomPhase;
  roundId: number;
  hash: string;
  multiplier: number;
  crashPoint: number | null;
  serverSeed: string | null;
  players: RoomPlayer[];
  history: { id: number; crashPoint: number }[];
  connected: boolean;
}

const EMPTY: RoomState = {
  phase: REALTIME_URL ? 'connecting' : 'offline',
  roundId: 0, hash: '', multiplier: 1, crashPoint: null, serverSeed: null,
  players: [], history: [], connected: false,
};

/**
 * Live Crash room client. Connects to the hosted, server-authoritative gateway
 * (Socket.IO, /live namespace). When NEXT_PUBLIC_REALTIME_URL is unset the hook
 * stays 'offline' so the static site degrades gracefully — the room only lights
 * up once the API is deployed somewhere sockets can run.
 */
export function useCrashRoom() {
  const [state, setState] = useState<RoomState>(EMPTY);
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);

  useEffect(() => {
    if (!REALTIME_URL) return;
    let alive = true;
    let socket: import('socket.io-client').Socket | null = null;

    (async () => {
      const { io } = await import('socket.io-client');
      if (!alive) return;
      socket = io(`${REALTIME_URL}/live`, { transports: ['websocket'], reconnection: true });
      socketRef.current = socket;

      socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
      socket.on('disconnect', () => setState((s) => ({ ...s, connected: false, phase: 'connecting' })));
      socket.on('history', (h: RoomState['history']) => setState((s) => ({ ...s, history: h })));
      const apply = (d: any) => setState((s) => ({
        ...s,
        phase: d.phase,
        roundId: d.roundId,
        hash: d.hash ?? s.hash,
        multiplier: d.multiplier ?? s.multiplier,
        crashPoint: d.crashPoint ?? null,
        serverSeed: d.serverSeed ?? null,
        players: d.players ?? s.players,
      }));
      socket.on('snapshot', apply);
      socket.on('state', apply);
      socket.on('tick', (d: { multiplier: number }) => setState((s) => (s.phase === 'running' ? { ...s, multiplier: d.multiplier } : s)));
      socket.on('bust', (d: any) => setState((s) => ({
        ...s, phase: 'result', crashPoint: d.crashPoint, serverSeed: d.serverSeed, players: d.players ?? s.players,
        history: [...s.history, { id: d.roundId, crashPoint: d.crashPoint }].slice(-24),
      })));
    })();

    return () => { alive = false; socket?.disconnect(); socketRef.current = null; };
  }, []);

  const placeBet = useCallback((amount: number, wallet: string) => {
    socketRef.current?.emit('bet', { amount, wallet });
  }, []);
  const cashOut = useCallback(() => {
    socketRef.current?.emit('cashout');
  }, []);

  return { state, placeBet, cashOut, enabled: !!REALTIME_URL };
}
