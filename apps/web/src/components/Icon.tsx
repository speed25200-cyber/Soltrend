import type { SVGProps } from 'react';

/**
 * Bespoke line-icon system. One coherent set replaces every emoji so the whole
 * product reads as a single high-end brand. All icons are 24×24, stroke-based,
 * and inherit `currentColor` — so a game tile simply sets its accent colour and
 * the glyph follows.
 */
export type IconName =
  | 'trend'
  | 'dice'
  | 'bomb'
  | 'plinko'
  | 'limbo'
  | 'coin'
  | 'wheel'
  | 'spark'
  | 'bolt'
  | 'moon'
  | 'crown'
  | 'clover'
  | 'gem'
  | 'flame'
  | 'orbit'
  | 'target'
  | 'star'
  | 'heart'
  | 'check'
  | 'close'
  | 'warn'
  | 'block'
  | 'pencil'
  | 'shield'
  | 'sparkle';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const PATHS: Record<IconName, React.ReactNode> = {
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-9" {...P} />
      <path d="M16 6h5v5" {...P} />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" {...P} />
      <circle cx="9" cy="9" r="1.15" fill="currentColor" />
      <circle cx="15" cy="9" r="1.15" fill="currentColor" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
      <circle cx="9" cy="15" r="1.15" fill="currentColor" />
      <circle cx="15" cy="15" r="1.15" fill="currentColor" />
    </>
  ),
  bomb: (
    <>
      <circle cx="11" cy="15" r="6" {...P} />
      <path d="M16 10l2-2M18 8h3M18 8V5" {...P} />
      <path d="M8.5 13a3 3 0 013-2.5" {...P} opacity={0.6} />
    </>
  ),
  plinko: (
    <>
      <circle cx="12" cy="4.5" r="1.4" fill="currentColor" />
      <path d="M8 10h.01M12 10h.01M16 10h.01M6 15h.01M10 15h.01M14 15h.01M18 15h.01M8 20h.01M12 20h.01M16 20h.01" {...P} />
    </>
  ),
  limbo: (
    <>
      <path d="M3 20C7 20 8 5 20 5" {...P} />
      <circle cx="19.5" cy="5" r="2.2" {...P} />
    </>
  ),
  coin: (
    <>
      <ellipse cx="12" cy="12" rx="8" ry="8" {...P} />
      <path d="M12 7v10M9.5 9.2c0-1 1.1-1.6 2.5-1.6s2.5.7 2.5 1.7-1 1.5-2.5 1.7-2.5.7-2.5 1.7 1.1 1.7 2.5 1.7 2.5-.6 2.5-1.6" {...P} />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="8.5" {...P} />
      <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" {...P} opacity={0.7} />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),
  spark: <path d="M12 3l1.8 5.9L20 12l-6.2 3.1L12 21l-1.8-5.9L4 12l6.2-3.1z" {...P} />,
  sparkle: (
    <>
      <path d="M12 4l1.5 5L18 10.5 13.5 12 12 17l-1.5-5L6 10.5 10.5 9z" {...P} />
      <path d="M18.5 4.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8L16 7l1.8-.7z" {...P} opacity={0.7} />
    </>
  ),
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" {...P} />,
  moon: <path d="M20 14.5A8 8 0 019.5 4 7.5 7.5 0 1020 14.5z" {...P} />,
  crown: (
    <>
      <path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13z" {...P} />
      <path d="M5.5 18h13" {...P} opacity={0.6} />
    </>
  ),
  clover: (
    <>
      <path d="M12 12c-2-2.5-6-2-6 1s4 3.5 6 1zM12 12c2-2.5 6-2 6 1s-4 3.5-6 1zM12 12c-2.5-2-2-6 1-6s3.5 4 1 6zM12 12v7" {...P} />
    </>
  ),
  gem: (
    <>
      <path d="M6 4h12l3 5-9 11L3 9z" {...P} />
      <path d="M3 9h18M9 4l-3 5 6 11 6-11-3-5" {...P} opacity={0.6} />
    </>
  ),
  flame: <path d="M12 3c1 3 4 4 4 8a4 4 0 11-8 0c0-1.5.5-2.5 1.5-3.5C10 8 12 6 12 3z" {...P} />,
  orbit: (
    <>
      <circle cx="12" cy="12" r="3.5" {...P} />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(45 12 12)" {...P} opacity={0.7} />
      <circle cx="18.4" cy="5.6" r="1.4" fill="currentColor" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" {...P} />
      <circle cx="12" cy="12" r="4.5" {...P} opacity={0.7} />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 17l-5.3 3 1.2-6L3.4 9.8l6-.7z" {...P} />,
  heart: <path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0112 8a3.7 3.7 0 017 2.7C19 15.6 12 20 12 20z" {...P} />,
  check: <path d="M5 12.5l4.5 4.5L19 6.5" {...P} />,
  close: <path d="M6 6l12 12M18 6L6 18" {...P} />,
  warn: (
    <>
      <path d="M12 3.5L21 19H3z" {...P} />
      <path d="M12 10v4" {...P} />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="8.5" {...P} />
      <path d="M6 6l12 12" {...P} />
    </>
  ),
  pencil: <path d="M4 20l4-1L20 7l-3-3L5 16z" {...P} />,
  shield: (
    <>
      <path d="M12 3l7 3v5c0 5-3 7.5-7 9-4-1.5-7-4-7-9V6z" {...P} />
      <path d="M9 12l2 2 4-4" {...P} />
    </>
  ),
};

export function Icon({
  name,
  size = 24,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
      {PATHS[name]}
    </svg>
  );
}

/** Decorative glyphs offered in the Studio theme picker. */
export const STUDIO_ICONS: IconName[] = [
  'trend', 'dice', 'bomb', 'plinko', 'limbo', 'coin', 'wheel',
  'spark', 'bolt', 'moon', 'crown', 'clover', 'gem', 'flame', 'orbit', 'target',
];

/** Default glyph for a template. */
export const TEMPLATE_ICON: Record<string, IconName> = {
  dice: 'dice',
  limbo: 'limbo',
  mines: 'bomb',
  plinko: 'plinko',
  wheel: 'wheel',
  coinflip: 'coin',
  towers: 'target',
};
