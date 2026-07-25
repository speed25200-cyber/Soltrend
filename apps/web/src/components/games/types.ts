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
  /** Bankroll-relative max bet (◎). Enforced on-chain; mirrored here so the UI
   *  blocks over-cap bets. Undefined = no per-game cap (built-in Originals). */
  maxBet?: number;
  /** The game's top payout multiplier. For games where the PLAYER picks the
   *  multiplier (Limbo), this is the ceiling they may choose — the bet cap is
   *  sized against it, so letting them exceed it would break bankroll safety. */
  maxWin?: number;
}
