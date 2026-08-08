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

/** Platform fee skimmed off a creator's bond at publish time (anti-spam + instant rake). */
export const CREATION_FEE = 0.03; // 3%

/**
 * How the house edge on every bet is divided. Sums to 1.
 *
 * STAKER-FAVOURED by design: the people who put up the bankroll and carry the
 * variance must earn the majority, or no one funds the house and the whole
 * zero-capital bootstrap stalls. The protocol takes a small, RISK-FREE rake — it
 * never holds bankroll variance, so its margin scales with volume, not luck.
 */
export const EDGE_SPLIT = {
  bankroll: 0.6, // stakers (creator bond + community LPs) — they fund + risk it
  creator: 0.2, // design royalty — incentive to ship good, popular games
  platform: 0.15, // risk-free protocol rake — our core margin, zero capital in
  insurance: 0.05, // solvency backstop for black-swan runs (protects stakers)
} as const;

/**
 * Bankroll safety: a single round's max payout must stay a small fraction of the
 * game's bankroll so one lucky player can't ruin it. maxPayout ≤ bankroll / RUIN_K.
 * This is the mechanism that lets a game open on a TINY bankroll (even just the
 * creator's bond) and grow its bet limits organically as stakers pile in.
 */
export const RUIN_K = 5; // → max payout capped at 20% of the game's bankroll

export function maxBetFor(netBankroll: number, maxWinMult: number): number {
  if (maxWinMult <= 0) return 0;
  return Math.max(0, Math.round(((netBankroll / RUIN_K) / maxWinMult) * 10000) / 10000);
}

export interface RevenueProjection {
  totalEdge: number;
  bankroll: number;
  creator: number;
  platform: number;
  insurance: number;
}

/** Project how a given wagered `volume` (SOL) at `edge` splits across parties. */
export function projectRevenue(volume: number, edge: number): RevenueProjection {
  const totalEdge = volume * edge;
  return {
    totalEdge,
    bankroll: totalEdge * EDGE_SPLIT.bankroll,
    creator: totalEdge * EDGE_SPLIT.creator,
    platform: totalEdge * EDGE_SPLIT.platform,
    insurance: totalEdge * EDGE_SPLIT.insurance,
  };
}

/** Rough annualised yield for a staker, given a game's daily volume vs its bankroll. */
export function stakerApr(dailyVolume: number, bankroll: number, edge: number): number {
  if (bankroll <= 0) return 0;
  const dailyYield = (dailyVolume * edge * EDGE_SPLIT.bankroll) / bankroll;
  return dailyYield * 365;
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
