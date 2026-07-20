import type { IconName } from '@/components/Icon';

/* ------------------------------------------------------------------ leveling */

/** XP required to go FROM level L to L+1 — a gentle escalating curve. */
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.35));
}

export interface LevelInfo {
  level: number;
  into: number; // xp accumulated into current level
  span: number; // xp needed to finish current level
  pct: number; // 0..1
  totalToNext: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  const span = xpForLevel(level);
  return { level, into: remaining, span, pct: span ? remaining / span : 0, totalToNext: span - remaining };
}

/** XP earned per bet — scales with wager, sub-linear so whales don't dominate. */
export function xpForBet(bet: number): number {
  return Math.max(1, Math.round(10 * Math.sqrt(bet) + bet * 2));
}

/* ---------------------------------------------------------------------- VIP */

export interface VipTier {
  name: string;
  min: number; // total wagered (SOL) to reach
  color: string;
  rakeback: number; // % cashback illustrative
  icon: IconName;
}

export const VIP_TIERS: VipTier[] = [
  { name: 'Bronze', min: 0, color: '#c2703f', rakeback: 1, icon: 'shield' },
  { name: 'Silver', min: 10, color: '#94a3b8', rakeback: 3, icon: 'shield' },
  { name: 'Gold', min: 50, color: '#ffd25f', rakeback: 5, icon: 'crown' },
  { name: 'Platinum', min: 200, color: '#67e8f9', rakeback: 8, icon: 'gem' },
  { name: 'Diamond', min: 1000, color: '#a855f7', rakeback: 12, icon: 'gem' },
];

export function vipFromWagered(wagered: number): { tier: VipTier; next: VipTier | null; pct: number } {
  let idx = 0;
  for (let i = 0; i < VIP_TIERS.length; i++) if (wagered >= VIP_TIERS[i].min) idx = i;
  const tier = VIP_TIERS[idx];
  const next = VIP_TIERS[idx + 1] ?? null;
  const pct = next ? Math.min(1, (wagered - tier.min) / (next.min - tier.min)) : 1;
  return { tier, next, pct };
}

/* ------------------------------------------------------------------ missions */

export type Metric = 'bets' | 'wins' | 'wagered' | 'games' | 'cashouts';

export interface MissionDef {
  id: string;
  label: string;
  metric: Metric;
  goal: number;
  reward: number; // demo SOL
}

export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'play10', label: 'Place 10 bets', metric: 'bets', goal: 10, reward: 0.05 },
  { id: 'win3', label: 'Win 3 rounds', metric: 'wins', goal: 3, reward: 0.05 },
  { id: 'variety', label: 'Play 3 different games', metric: 'games', goal: 3, reward: 0.08 },
  { id: 'wager1', label: 'Wager 1 SOL total', metric: 'wagered', goal: 1, reward: 0.1 },
];

/* --------------------------------------------------------------- achievements */

export interface AchievementDef {
  id: string;
  label: string;
  desc: string;
  icon: IconName;
  test: (s: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalBets: number;
  wageredTotal: number;
  bestMultiplier: number;
  gamesTried: number;
  publishedGames: number;
  level: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstbet', label: 'First Blood', desc: 'Place your first bet', icon: 'spark', test: (s) => s.totalBets >= 1 },
  { id: 'highroller', label: 'High Roller', desc: 'Wager 10 SOL total', icon: 'crown', test: (s) => s.wageredTotal >= 10 },
  { id: 'moon', label: 'To the Moon', desc: 'Hit a 10× or higher', icon: 'trend', test: (s) => s.bestMultiplier >= 10 },
  { id: 'legend', label: 'Legendary Hit', desc: 'Hit a 100× or higher', icon: 'flame', test: (s) => s.bestMultiplier >= 100 },
  { id: 'explorer', label: 'Explorer', desc: 'Try 5 different games', icon: 'orbit', test: (s) => s.gamesTried >= 5 },
  { id: 'creator', label: 'Game Designer', desc: 'Publish a game in the Studio', icon: 'pencil', test: (s) => s.publishedGames >= 1 },
  { id: 'lvl10', label: 'Seasoned', desc: 'Reach level 10', icon: 'star', test: (s) => s.level >= 10 },
];

/* --------------------------------------------------------------- jackpot */

/** Fraction of every wager that feeds the community jackpot. */
export const JACKPOT_CONTRIB = 0.005;
/** Base per-bet chance to trigger the jackpot (also scaled by bet size). */
export const JACKPOT_BASE_CHANCE = 0.0008;
