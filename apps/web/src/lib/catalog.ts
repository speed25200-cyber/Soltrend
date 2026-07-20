import type { Template } from './games';

export interface GameMeta {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  template: Template;
  tier: 1 | 2;
  accent: 'violet' | 'cyan' | 'gold' | 'pink' | 'win' | 'loss';
  hot?: boolean;
}

/** Launch catalogue — the "Originals" that drive the volume (§2). */
export const CATALOG: GameMeta[] = [
  { slug: 'crash', name: 'Crash', emoji: '🚀', tagline: 'Cash out before it blows', template: 'limbo', tier: 1, accent: 'pink', hot: true },
  { slug: 'dice', name: 'Dice', emoji: '🎲', tagline: 'Roll over or under', template: 'dice', tier: 1, accent: 'violet', hot: true },
  { slug: 'mines', name: 'Mines', emoji: '💣', tagline: 'Dodge the bombs, bank the gems', template: 'mines', tier: 1, accent: 'cyan', hot: true },
  { slug: 'plinko', name: 'Plinko', emoji: '⚪', tagline: 'Drop the ball, chase the edges', template: 'plinko', tier: 1, accent: 'gold', hot: true },
  { slug: 'limbo', name: 'Limbo', emoji: '📈', tagline: 'Aim for the multiplier', template: 'limbo', tier: 1, accent: 'win' },
  { slug: 'coinflip', name: 'Coinflip', emoji: '🪙', tagline: 'Fifty-fifty, instant', template: 'coinflip', tier: 2, accent: 'gold' },
  { slug: 'wheel', name: 'Wheel', emoji: '🎡', tagline: 'Spin the segments', template: 'wheel', tier: 2, accent: 'violet' },
];

export const bySlug = (slug: string) => CATALOG.find((g) => g.slug === slug);

export const ACCENT_HEX: Record<GameMeta['accent'], string> = {
  violet: '#a855f7',
  cyan: '#22d3ee',
  gold: '#ffd25f',
  pink: '#ec4899',
  win: '#10f5a0',
  loss: '#ff3b6b',
};
