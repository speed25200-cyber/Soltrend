'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { REALTIME_URL } from './useCrashRoom';

export interface PlazaPeer {
  id: string;
  name: string;
  ship: string;
  x: number;
  z: number;
}

/**
 * Shared-plaza presence client. Connects to the hosted /plaza namespace, streams
 * this player's position up and receives everyone else's back at 10 Hz. Gated by
 * NEXT_PUBLIC_REALTIME_URL — stays disabled (solo) on the static site.
 */
export function usePlaza(name: string, shipId: string) {
  const [peers, setPeers] = useState<PlazaPeer[]>([]);
  const [online, setOnline] = useState(0);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);
  const idRef = useRef('');

  useEffect(() => {
    if (!REALTIME_URL) return;
    let alive = true;
    let socket: import('socket.io-client').Socket | null = null;
    (async () => {
      const { io } = await import('socket.io-client');
      if (!alive) return;
      socket = io(`${REALTIME_URL}/plaza`, { transports: ['websocket'], reconnection: true });
      socketRef.current = socket;
      socket.on('connect', () => { setConnected(true); idRef.current = socket!.id ?? ''; });
      socket.on('disconnect', () => setConnected(false));
      socket.on('welcome', (d: { id: string; online: number }) => { idRef.current = d.id; setOnline(d.online); });
      socket.on('peers', (list: PlazaPeer[]) => {
        setOnline(list.length);
        setPeers(list.filter((p) => p.id !== idRef.current));
      });
    })();
    return () => { alive = false; socket?.disconnect(); socketRef.current = null; };
  }, []);

  const move = useCallback((x: number, z: number) => {
    socketRef.current?.emit('move', { x, z, name, ship: shipId });
  }, [name, shipId]);

  return { peers, online, connected, enabled: !!REALTIME_URL, move };
}
