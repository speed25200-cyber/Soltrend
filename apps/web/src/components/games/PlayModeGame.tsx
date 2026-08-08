'use client';

import { GameScreen } from './GameScreen';
import { DemoBar } from './DemoBar';
import { PlayModeToggle } from './PlayModeToggle';
import { usePlayMode } from '@/hooks/usePlayMode';
import type { GameConfig } from './types';

/**
 * A game with a demo / real switch above it.
 *
 * Every game on Soltrend can be played for pretend credits before a single
 * lamport is staked — same engine, same seed chain, same edge, no ledger. The
 * decision itself lives in `usePlayMode` so bespoke screens (the 3D Crash page)
 * behave identically.
 */
export function PlayModeGame({ config, crashVariant }: { config: GameConfig; crashVariant?: boolean }) {
  const { demo, pick, connected } = usePlayMode();

  return (
    <div className="space-y-2">
      <PlayModeToggle demo={demo} connected={connected} onPick={pick} />
      {demo && <DemoBar compact theoreticalRtp={config.edge != null ? 1 - config.edge : undefined} />}
      <GameScreen config={{ ...config, demo }} crashVariant={crashVariant} />
    </div>
  );
}
