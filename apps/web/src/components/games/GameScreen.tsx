'use client';

import type { Template } from '@/lib/games';
import type { GameConfig } from './types';
import { DiceGame } from './DiceGame';
import { LimboGame } from './LimboGame';
import { CrashGame } from './CrashGame';
import { MinesGame } from './MinesGame';
import { PlinkoGame } from './PlinkoGame';
import { CoinflipGame } from './CoinflipGame';
import { WheelGame } from './WheelGame';
import { GraphGame } from './GraphGame';
import { WorldGame } from './WorldGame';
import { TowersGame } from './TowersGame';

const BY_TEMPLATE: Record<Template, (c: GameConfig) => JSX.Element> = {
  dice: DiceGame,
  limbo: LimboGame,
  mines: MinesGame,
  plinko: PlinkoGame,
  coinflip: CoinflipGame,
  wheel: WheelGame,
  towers: TowersGame,
  graph: GraphGame,
  board: WorldGame, // board games render in the 3D World runtime
};

/**
 * Renders the right game for a config. `crashVariant` swaps the Limbo template
 * for the animated multiplayer-style Crash presentation while sharing identical
 * math (both are crash-point games).
 */
export function GameScreen({ config, crashVariant }: { config: GameConfig; crashVariant?: boolean }) {
  if (crashVariant) return <CrashGame {...config} />;
  const Comp = BY_TEMPLATE[config.meta.template];
  return <Comp {...config} />;
}
