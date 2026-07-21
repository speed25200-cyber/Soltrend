/**
 * Presentation engine — the *visual* half of a community game.
 *
 * The Forge lets creators design the maths; this lets them design the LOOK. A
 * game picks an animated "scene" for its outcome, and its colour palette is
 * derived procedurally from its seed, so every community game feels distinct and
 * original — with zero design skill required.
 */

export type PresentationId = 'pulse' | 'orb' | 'rocket' | 'reel' | 'burst' | 'wheel' | 'cards' | 'shatter';

export const PRESENTATIONS: { id: PresentationId; label: string; hint: string }[] = [
  { id: 'pulse', label: 'Pulse', hint: 'Bold multiplier pop' },
  { id: 'orb', label: 'Energy orb', hint: 'A charging orb that bursts' },
  { id: 'rocket', label: 'Rocket', hint: 'Climbs to your multiplier' },
  { id: 'reel', label: 'Slot reel', hint: 'Spins and locks in' },
  { id: 'burst', label: 'Supernova', hint: 'Radial shockwave' },
  { id: 'wheel', label: 'Wheel', hint: 'Spins to the result' },
  { id: 'cards', label: 'Card flip', hint: 'Flips to reveal' },
  { id: 'shatter', label: 'Crystal', hint: 'A crystal that cracks' },
];

export type BackgroundId = 'none' | 'coins' | 'grid' | 'stars' | 'aurora';
export const BACKGROUNDS: { id: BackgroundId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'coins', label: 'Coin rain' },
  { id: 'grid', label: 'Neon grid' },
  { id: 'stars', label: 'Starfield' },
];

export type SoundPackId = 'arcade' | 'deep' | 'crystal' | 'retro' | 'none';
export const SOUND_PACKS: { id: SoundPackId; label: string }[] = [
  { id: 'arcade', label: 'Arcade' },
  { id: 'deep', label: 'Deep' },
  { id: 'crystal', label: 'Crystal' },
  { id: 'retro', label: 'Retro' },
  { id: 'none', label: 'Silent' },
];

export type WinEffectId = 'confetti' | 'coins' | 'sparks' | 'rings';
export const WIN_EFFECTS: { id: WinEffectId; label: string }[] = [
  { id: 'confetti', label: 'Confetti' },
  { id: 'coins', label: 'Coins' },
  { id: 'sparks', label: 'Sparks' },
  { id: 'rings', label: 'Rings' },
];

export interface GameStyle {
  presentation: PresentationId;
  background: BackgroundId;
  soundPack: SoundPackId;
  winEffect: WinEffectId;
  accent: string;
  aura: string;
}

/** Curated one-click look presets — the "style marketplace" starter set. */
export const STYLE_PRESETS: { id: string; label: string; style: GameStyle }[] = [
  { id: 'neon', label: 'Neon Arcade', style: { presentation: 'reel', background: 'grid', soundPack: 'arcade', winEffect: 'confetti', accent: 'violet', aura: 'nebula' } },
  { id: 'cosmic', label: 'Cosmic', style: { presentation: 'rocket', background: 'stars', soundPack: 'deep', winEffect: 'sparks', accent: 'cyan', aura: 'ice' } },
  { id: 'royal', label: 'Royal Gold', style: { presentation: 'burst', background: 'coins', soundPack: 'retro', winEffect: 'coins', accent: 'gold', aura: 'gold' } },
  { id: 'crystal', label: 'Crystal', style: { presentation: 'shatter', background: 'aurora', soundPack: 'crystal', winEffect: 'rings', accent: 'cyan', aura: 'ice' } },
  { id: 'inferno', label: 'Inferno', style: { presentation: 'orb', background: 'coins', soundPack: 'arcade', winEffect: 'sparks', accent: 'pink', aura: 'sunset' } },
  { id: 'matrix', label: 'Matrix', style: { presentation: 'pulse', background: 'grid', soundPack: 'crystal', winEffect: 'confetti', accent: 'win', aura: 'matrix' } },
];

export interface Palette {
  primary: string;
  secondary: string;
  glow: string;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Deterministic, distinct palette from any seed string (spec hash / id). */
export function paletteFromSeed(seed: string, accentHex?: string): Palette {
  const h = hash(seed || 'soltrend');
  const h1 = h % 360;
  const h2 = (h1 + 60 + ((h >> 8) % 120)) % 360;
  return {
    primary: accentHex || `hsl(${h1} 85% 62%)`,
    secondary: `hsl(${h2} 85% 62%)`,
    glow: accentHex || `hsl(${h1} 90% 60%)`,
  };
}
