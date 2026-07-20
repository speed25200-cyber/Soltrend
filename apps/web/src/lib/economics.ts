/**
 * Soltrend economic model.
 *
 * Two revenue engines make the platform profitable while staying capital-light:
 *
 *  1. Creation deposit → game bankroll. To publish, a creator deposits SOL that
 *     becomes their game's bankroll (it pays that game's winners). The platform
 *     skims a small CREATION_FEE off the deposit (instant, anti-spam revenue).
 *
 *  2. House-edge rake on every bet. The house edge (1–5%) is split so the
 *     PLATFORM takes the single largest, RISK-FREE slice — it never holds the
 *     bankroll variance; the creator + community liquidity do. This is the
 *     "Uniswap-for-casino-games" model: creators bring the liquidity, the
 *     protocol takes rake, revenue scales linearly with volume.
 */

/** Platform fee taken off a creator's bankroll deposit at publish time. */
export const CREATION_FEE = 0.03; // 3%

/** How the house edge on every bet is divided. Sums to 1. Platform-favoured. */
export const EDGE_SPLIT = {
  platform: 0.5, // risk-free protocol rake — our core margin
  creator: 0.2, // design royalty
  bankroll: 0.2, // yield to whoever funds the game (creator + community LPs)
  community: 0.1, // jackpot + treasury
} as const;

/**
 * Bankroll safety: a single bet's max payout must stay a small fraction of the
 * bankroll so one lucky player can't ruin a game. maxPayout ≤ bankroll / RUIN_K.
 */
export const RUIN_K = 5; // → max payout capped at 20% of bankroll

export function maxBetFor(netBankroll: number, maxWinMult: number): number {
  if (maxWinMult <= 0) return 0;
  return Math.max(0, Math.round(((netBankroll / RUIN_K) / maxWinMult) * 10000) / 10000);
}

export interface RevenueProjection {
  totalEdge: number;
  platform: number;
  creator: number;
  bankroll: number;
  community: number;
}

/** Project how a given wagered `volume` (SOL) at `edge` splits across parties. */
export function projectRevenue(volume: number, edge: number): RevenueProjection {
  const totalEdge = volume * edge;
  return {
    totalEdge,
    platform: totalEdge * EDGE_SPLIT.platform,
    creator: totalEdge * EDGE_SPLIT.creator,
    bankroll: totalEdge * EDGE_SPLIT.bankroll,
    community: totalEdge * EDGE_SPLIT.community,
  };
}

/** Heuristic ruin risk given how much bankroll cushions the max payout + swings. */
export function ruinRisk(
  netBankroll: number,
  maxBet: number,
  maxWinMult: number,
): { label: 'Very low' | 'Low' | 'Medium' | 'High'; ratio: number } {
  const maxPayout = maxBet * maxWinMult;
  const ratio = maxPayout > 0 ? netBankroll / maxPayout : Infinity;
  const label = ratio >= 8 ? 'Very low' : ratio >= 5 ? 'Low' : ratio >= 3 ? 'Medium' : 'High';
  return { label, ratio };
}
