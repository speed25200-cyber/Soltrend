'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { sfx } from '@/lib/sound';

/**
 * The demo / real decision, shared by every surface that offers both.
 *
 * Starts in demo for a visitor with no wallet — asking someone to connect
 * before they know whether they like the game is the wrong way round — and
 * flips to real once a wallet connects, unless the player has already chosen
 * for themselves. Extracted from PlayModeGame so bespoke screens (the 3D
 * Crash page) make exactly the same decision instead of a near copy.
 */
export function usePlayMode() {
  const { connected } = useWallet();
  const [demo, setDemo] = useState(true);
  const chosen = useRef(false);

  useEffect(() => {
    if (!chosen.current && connected) setDemo(false);
  }, [connected]);

  const pick = (next: boolean) => {
    chosen.current = true;
    setDemo(next);
    sfx.click();
  };

  return { demo, pick, connected };
}
