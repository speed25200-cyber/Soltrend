'use client';

import { useId } from 'react';
import { WAGON, WILD } from '@/lib/slots/goldmine';

/**
 * The ore set, drawn as faceted vector minerals rather than illustrations: each
 * symbol is a handful of flat planes with its own gradient, so it reads
 * instantly at grid size, stays razor sharp at any resolution, and costs
 * nothing to animate en masse during a cascade.
 */

export const SYMBOL_COLORS: Record<number, { a: string; b: string; glow: string }> = {
  0: { a: '#4b5563', b: '#1f2937', glow: '#64748b' }, // coal
  1: { a: '#94a3b8', b: '#475569', glow: '#cbd5e1' }, // iron
  2: { a: '#f97316', b: '#9a3412', glow: '#fb923c' }, // copper
  3: { a: '#e0e7ff', b: '#8b95c9', glow: '#c7d2fe' }, // quartz
  4: { a: '#fb7185', b: '#9f1239', glow: '#fda4af' }, // ruby
  5: { a: '#34d399', b: '#065f46', glow: '#6ee7b7' }, // emerald
  6: { a: '#fcd34d', b: '#b45309', glow: '#fde68a' }, // gold
  [WILD]: { a: '#fde68a', b: '#b45309', glow: '#fef3c7' }, // lantern (wild)
  [WAGON]: { a: '#fcd34d', b: '#78350f', glow: '#fde68a' }, // gold wagon
};

/** Facets in a 0..100 box. `face` is the lit gradient, `side` the shaded one. */
function facets(sym: number, face: string, side: string) {
  switch (sym) {
    case 0: // coal — irregular chunk
      return (
        <>
          <path d="M22 40 L44 20 L74 30 L82 58 L58 82 L26 72 Z" fill={face} />
          <path d="M44 20 L74 30 L58 52 Z" fill="#fff" opacity="0.12" />
          <path d="M26 72 L58 82 L58 52 Z" fill="#000" opacity="0.25" />
        </>
      );
    case 1: // iron — ingot
      return (
        <>
          <path d="M18 62 L34 38 L82 38 L66 62 Z" fill={face} />
          <path d="M18 62 L66 62 L66 76 L18 76 Z" fill={side} />
          <path d="M66 62 L82 38 L82 52 L66 76 Z" fill="#000" opacity="0.3" />
          <path d="M34 38 L82 38 L74 44 L30 44 Z" fill="#fff" opacity="0.18" />
        </>
      );
    case 2: // copper — nugget cluster
      return (
        <>
          <circle cx="40" cy="56" r="20" fill={face} />
          <circle cx="64" cy="44" r="14" fill={face} />
          <circle cx="34" cy="50" r="6" fill="#fff" opacity="0.3" />
          <circle cx="60" cy="39" r="4" fill="#fff" opacity="0.3" />
        </>
      );
    case 3: // quartz — hexagonal prism
      return (
        <>
          <path d="M50 12 L74 30 L74 66 L50 86 L26 66 L26 30 Z" fill={face} />
          <path d="M50 12 L74 30 L50 44 L26 30 Z" fill="#fff" opacity="0.28" />
          <path d="M50 44 L74 30 L74 66 L50 86 Z" fill="#000" opacity="0.18" />
        </>
      );
    case 4: // ruby — cushion cut
      return (
        <>
          <path d="M50 14 L80 34 L70 76 L30 76 L20 34 Z" fill={face} />
          <path d="M50 14 L80 34 L50 46 L20 34 Z" fill="#fff" opacity="0.3" />
          <path d="M50 46 L80 34 L70 76 Z" fill="#000" opacity="0.2" />
          <path d="M50 46 L20 34 L30 76 Z" fill="#000" opacity="0.1" />
        </>
      );
    case 5: // emerald — step cut
      return (
        <>
          <path d="M32 16 L68 16 L84 34 L84 66 L68 84 L32 84 L16 66 L16 34 Z" fill={face} />
          <path d="M32 16 L68 16 L84 34 L16 34 Z" fill="#fff" opacity="0.26" />
          <rect x="28" y="42" width="44" height="6" fill="#fff" opacity="0.16" />
          <path d="M16 66 L84 66 L68 84 L32 84 Z" fill="#000" opacity="0.22" />
        </>
      );
    case 6: // gold — bar
      return (
        <>
          <path d="M14 66 L30 34 L86 34 L70 66 Z" fill={face} />
          <path d="M14 66 L70 66 L70 82 L14 82 Z" fill={side} />
          <path d="M70 66 L86 34 L86 50 L70 82 Z" fill="#000" opacity="0.28" />
          <path d="M30 34 L86 34 L78 41 L26 41 Z" fill="#fff" opacity="0.35" />
        </>
      );
    case WILD: // miner's lantern — substitutes for any ore
      return (
        <>
          <path d="M38 30 L62 30 L66 74 L34 74 Z" fill={face} />
          <ellipse cx="50" cy="52" rx="12" ry="16" fill="#fffbeb" opacity="0.9" />
          <rect x="34" y="24" width="32" height="8" rx="3" fill={side} />
          <path d="M44 18 C44 10 56 10 56 18" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="32" y="72" width="36" height="8" rx="3" fill={side} />
        </>
      );
    default: // the gold wagon — a loaded minecart
      return (
        <>
          <path d="M18 40 L82 40 L74 70 L26 70 Z" fill={face} />
          <path d="M18 40 L82 40 L78 47 L22 47 Z" fill="#fff" opacity="0.3" />
          <circle cx="26" cy="46" r="5" fill="#fde68a" />
          <circle cx="40" cy="42" r="6" fill="#fef3c7" />
          <circle cx="56" cy="43" r="5" fill="#fde68a" />
          <circle cx="70" cy="46" r="4" fill="#fef3c7" />
          <circle cx="36" cy="78" r="8" fill="#1f2937" />
          <circle cx="64" cy="78" r="8" fill="#1f2937" />
          <circle cx="36" cy="78" r="3" fill="#6b7280" />
          <circle cx="64" cy="78" r="3" fill="#6b7280" />
        </>
      );
  }
}

export function MineSymbol({ sym, size = 48 }: { sym: number; size?: number }) {
  const c = SYMBOL_COLORS[sym] ?? SYMBOL_COLORS[0];
  // useId keeps every instance's gradients unique, so a grid full of the same
  // ore doesn't collide on ids.
  const uid = useId().replace(/:/g, '');
  const faceId = `f${uid}`;
  const sideId = `s${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={faceId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.a} />
          <stop offset="1" stopColor={c.b} />
        </linearGradient>
        <linearGradient id={sideId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.b} />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <g style={{ filter: `drop-shadow(0 2px 6px ${c.b}88)` }}>
        {facets(sym, `url(#${faceId})`, `url(#${sideId})`)}
      </g>
    </svg>
  );
}
