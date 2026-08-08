/**
 * Cosmetic "journeys" — a per-game collection meta. As a player racks up rounds
 * on a game they climb purely-decorative tiers (an emblem + a title). This is
 * strictly cosmetic: it never touches odds, payouts or the bankroll, so the
 * vault-safety guarantees are unaffected, and it rides behind the same
 * responsible-gaming limits as all play. Think "badges", not "grind to win".
 */

export interface JourneyTier {
  at: number; // rounds required
  label: string;
  color: string;
}

export const TIERS: JourneyTier[] = [
  { at: 1, label: 'Explorer', color: '#94a3b8' },
  { at: 10, label: 'Bronze', color: '#b45309' },
  { at: 25, label: 'Silver', color: '#cbd5e1' },
  { at: 50, label: 'Gold', color: '#ffd25f' },
  { at: 100, label: 'Diamond', color: '#22d3ee' },
];

/** The tier a player has reached at `plays` rounds (undefined before the first). */
export function tierFor(plays: number): JourneyTier | undefined {
  let cur: JourneyTier | undefined;
  for (const t of TIERS) if (plays >= t.at) cur = t;
  return cur;
}

/** The next tier and progress toward it, for a progress bar. */
export function nextTier(plays: number): { next?: JourneyTier; progress: number } {
  const next = TIERS.find((t) => plays < t.at);
  if (!next) return { progress: 1 };
  const prevAt = [...TIERS].reverse().find((t) => t.at <= plays)?.at ?? 0;
  const span = next.at - prevAt;
  return { next, progress: span > 0 ? Math.min(1, (plays - prevAt) / span) : 0 };
}
