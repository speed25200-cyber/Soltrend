import type { GameMeta } from '@/lib/catalog';

/**
 * Every game component is driven by a GameConfig, so the exact same component
 * renders both a built-in Original (config from the catalog) and a UGC game
 * (config from a published GameSpec). Only `edge`/`params`/identity differ.
 */
export interface GameConfig {
  meta: GameMeta;
  edge?: number;
  /** Present when playing a community game — used to attribute volume. */
  gameId?: string;
  gameName?: string;
  params?: Record<string, number | string>;
}
