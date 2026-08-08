'use client';

import { useEffect, useState } from 'react';
import { shipById, type ShipSkin } from '@/components/worlds/ships';

const KEY = 'soltrend-ship';

/** Player's chosen ship skin, persisted locally. */
export function useShipSkin(): [ShipSkin, (id: string) => void] {
  const [id, setId] = useState('dart');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setId(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const set = (next: string) => {
    setId(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  };
  return [shipById(id), set];
}
