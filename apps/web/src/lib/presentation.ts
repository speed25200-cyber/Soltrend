/**
 * Presentation engine — the *visual* half of a community game.
 *
 * The Forge lets creators design the maths; this lets them design the LOOK. A
 * game picks an animated "scene" for its outcome, and its colour palette is
 * derived procedurally from its seed, so every community game feels distinct and
 * original — with zero design skill required.
 */

export type PresentationId = 'pulse' | 'orb' | 'rocket' | 'reel' | 'burst';

export const PRESENTATIONS: { id: PresentationId; label: string; hint: string }[] = [
  { id: 'pulse', label: 'Pulse', hint: 'Bold multiplier pop' },
  { id: 'orb', label: 'Energy orb', hint: 'A charging orb that bursts' },
  { id: 'rocket', label: 'Rocket', hint: 'Climbs to your multiplier' },
  { id: 'reel', label: 'Slot reel', hint: 'Spins and locks in' },
  { id: 'burst', label: 'Supernova', hint: 'Radial shockwave' },
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
