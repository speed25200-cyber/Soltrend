'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REALTIME_URL } from './useCrashRoom';

export type HeistPhase = 'offline' | 'gather' | 'running' | 'result';

export interface HeistMember {
  wallet: string;
  ante: number;
  ship?: string;
  lockedM: number | null;
  won: number;
}

export interface HeistState {
  phase: HeistPhase;
  connected: boolean;
  runId: number;
  hash: string | null;
  multiplier: number;
  bust: number | null;
  gatherInMs: number;
  vaultCut: number;
  crew: HeistMember[];
  allGrabbed: boolean;
  vault: number;
  serverSeed: string | null;
}

const EMPTY: HeistState = {
  phase: REALTIME_URL ? 'gather' : 'offline',
  connected: false, runId: 0, hash: null, multiplier: 1, bust: null, gatherInMs: 0, vaultCut: 0.05,
  crew: [], allGrabbed: false, vault: 0, serverSeed: null,
};

/**
 * Co-op Heist client. Connects to the hosted heist gateway (Socket.IO, /heist
 * namespace): join the crew, watch the shared multiplier climb, and grab your
 * loot before the bust — a crew vault pays a bonus only if everyone makes it.
 * Stays 'offline' until NEXT_PUBLIC_REALTIME_URL is set.
 */
export function useHeist() {
  const [state, setState] = useState<HeistState>(EMPTY);
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);

  useEffect(() => {
    if (!REALTIME_URL) return;
    let alive = true;
    let socket: import('socket.io-client').Socket | null = null;

    (async () => {
      const { io } = await import('socket.io-client');
      if (!alive) return;
      socket = io(`${REALTIME_URL}/heist`, { transports: ['websocket'], reconnection: true });
      socketRef.current = socket;

      socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
      socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
      socket.on('state', (d: any) => setState((s) => ({
        ...s, phase: d.phase, runId: d.runId, hash: d.hash ?? s.hash, bust: d.bust ?? null,
        vaultCut: d.vaultCut ?? s.vaultCut, multiplier: d.multiplier ?? s.multiplier,
        gatherInMs: d.gatherInMs ?? 0, crew: d.crew ?? s.crew,
        allGrabbed: d.phase === 'gather' ? false : s.allGrabbed,
      })));
      socket.on('tick', (d: { multiplier: number }) => setState((s) => (s.phase === 'running' ? { ...s, multiplier: d.multiplier } : s)));
      socket.on('result', (d: any) => setState((s) => ({
        ...s, phase: 'result', bust: d.bust, allGrabbed: d.allGrabbed, vault: d.vault,
        serverSeed: d.serverSeed, crew: d.crew ?? s.crew,
      })));
    })();

    return () => { alive = false; socket?.disconnect(); socketRef.current = null; };
  }, []);

  const join = useCallback((ante: number, wallet: string, ship?: string) => {
    socketRef.current?.emit('join', { ante, wallet, ship });
  }, []);
  const grab = useCallback(() => {
    socketRef.current?.emit('grab');
  }, []);

  return { state, join, grab, enabled: !!REALTIME_URL };
}
